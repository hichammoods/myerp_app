# Manual Deployment Guide - Custom Components & Backorder Support

**⚠️ IMPORTANT**: This guide shows EXACT line changes to make manually on VPS.
**DO NOT use `git pull`** - Make changes manually to preserve your VPS customizations.

---

## Overview

This deployment adds:
1. **Custom Components Tracking** - Sales orders and invoices track customized product details
2. **Backorder Support** - Allow negative stock with warnings instead of blocking orders
3. **Enhanced PDFs** - Show custom component details in PDFs
4. **Better UI** - Display custom components in details views

---

## Pre-Deployment Checklist

### 1. Backup Your VPS Database

**On VPS**, run:
```bash
# Create backup
docker-compose -f docker-compose.production.yml --env-file .env.production exec -T postgres \
  pg_dump -U myerp myerp_db > backup_before_custom_components_$(date +%Y%m%d).sql

# Compress it
gzip backup_before_custom_components_$(date +%Y%m%d).sql

# Verify backup exists
ls -lh backup_before_custom_components_*.sql.gz
```

### 2. Backup Your Application Code

```bash
# Create a backup of current backend and frontend
tar -czf myerp_app_backup_$(date +%Y%m%d).tar.gz backend/src frontend/src

# Verify backup
ls -lh myerp_app_backup_*.tar.gz
```

---

## PHASE 1: Database Migration (15 minutes)

### Step 1.1: Create Migration File

**On VPS**, create file:
```bash
nano backend/src/database/migrations/022_add_customization_to_sales_order_items.sql
```

**Paste this content:**
```sql
-- Migration 022: Add customization fields to sales_order_items and invoice_items
-- This migration is SAFE - adds new columns without modifying existing data

-- Add customization fields to sales_order_items
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS custom_components JSONB;

-- Add customization fields to invoice_items
ALTER TABLE invoice_items
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS custom_components JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_order_items_custom_components
  ON sales_order_items USING gin(custom_components);

CREATE INDEX IF NOT EXISTS idx_invoice_items_custom_components
  ON invoice_items USING gin(custom_components);
```

**Save and exit** (Ctrl+X, Y, Enter)

### Step 1.2: Create Migration Runner Script

**On VPS**, create file:
```bash
nano backend/src/database/run-migration-022.ts
```

**Paste this content:**
```typescript
import { db } from './connection';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('Starting migration 022: Add customization to sales_order_items...');

    const sqlPath = path.join(__dirname, 'migrations', '022_add_customization_to_sales_order_items.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await db.query(sql);

    console.log('✅ Migration 022 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration 022 failed:', error);
    process.exit(1);
  }
}

runMigration();
```

**Save and exit**

### Step 1.3: Run the Migration

**On VPS**, navigate to backend and run migration:
```bash
cd backend

# Run migration
npx ts-node -r tsconfig-paths/register src/database/run-migration-022.ts
```

**Expected output:**
```
Starting migration 022: Add customization to sales_order_items...
✅ Migration 022 completed successfully!
```

### Step 1.4: Verify Database Changes

**On VPS**, check the database:
```bash
docker-compose -f ../docker-compose.production.yml --env-file ../.env.production exec postgres \
  psql -U myerp -d myerp_db -c "\d sales_order_items"
```

**You should see these new columns:**
- `is_customized` (boolean)
- `base_product_id` (uuid)
- `custom_components` (jsonb)

---

## PHASE 2: Backend Changes (20 minutes)

### Change 2.1: Fix Invoice JSON Error

**File:** `backend/src/routes/invoices.ts`

**Find line 334** (search for `item.custom_components || null`):

```bash
nano +334 backend/src/routes/invoices.ts
```

**OLD CODE (line 334):**
```typescript
item.custom_components || null,
```

**NEW CODE (line 334):**
```typescript
item.custom_components ? JSON.stringify(item.custom_components) : null,
```

**Save and exit**

---

### Change 2.2: Add Backorder Support to Sales Orders

**File:** `backend/src/routes/sales-orders.ts`

This file needs multiple changes. Let me break them down:

#### Change 2.2a: Replace Stock Checking Logic (Lines ~289-332)

**Open the file:**
```bash
nano backend/src/routes/sales-orders.ts
```

**Find the section around line 289** that looks like:
```typescript
// Check stock availability for all products
for (const line of linesResult.rows) {
  if (line.product_id) {
    const stockResult = await client.query(
      'SELECT stock_quantity FROM products WHERE id = $1',
      [line.product_id]
    );

    if (stockResult.rows.length > 0) {
      const availableStock = stockResult.rows[0].stock_quantity;
      if (availableStock < line.quantity) {
        throw new Error(
          `Stock insuffisant pour ${line.product_name}: ${availableStock} disponible(s), ${line.quantity} nécessaire(s)`
        );
      }
    }
  }
}
```

**REPLACE with:**
```typescript
// Check stock availability for all products (warnings only, don't block order)
const stockWarnings: string[] = [];
for (const line of linesResult.rows) {
  if (line.product_id) {
    const stockResult = await client.query(
      'SELECT stock_quantity FROM products WHERE id = $1',
      [line.product_id]
    );

    if (stockResult.rows.length > 0) {
      const availableStock = stockResult.rows[0].stock_quantity;
      if (availableStock < line.quantity) {
        stockWarnings.push(`${line.product_name}: ${availableStock} disponible(s), ${line.quantity} nécessaire(s)`);
      }
    }
  }

  // Check material stock for customized products
  if (line.is_customized) {
    const customComponentsResult = await client.query(
      `SELECT qlc.*, m.name as material_name, m.stock_quantity as material_stock, m.unit_of_measure
       FROM quotation_line_components qlc
       LEFT JOIN materials m ON qlc.material_id = m.id
       WHERE qlc.quotation_line_id = $1 AND qlc.material_id IS NOT NULL`,
      [line.id]
    );

    for (const component of customComponentsResult.rows) {
      const requiredQuantity = parseFloat(component.quantity) * parseFloat(line.quantity);
      const availableStock = parseFloat(component.material_stock || 0);

      if (availableStock < requiredQuantity) {
        stockWarnings.push(
          `Matériau "${component.material_name}" pour ${line.product_name}: ` +
          `${availableStock} ${component.unit_of_measure || 'unités'} disponible(s), ` +
          `${requiredQuantity} nécessaire(s)`
        );
      }
    }
  }
}

// Note: We continue with order creation even if stock is insufficient
// Stock can go negative to track backorders
```

#### Change 2.2b: Save Custom Components in Sales Order Items (Lines ~367-407)

**Find the section around line 367** that looks like:
```typescript
// Insert sales order items
for (const line of linesResult.rows) {
  await client.query(
    `INSERT INTO sales_order_items (
      sales_order_id, product_id, product_name, product_sku,
      description, quantity, unit_price, discount_percent,
      discount_amount, tax_rate, tax_amount, line_total
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      salesOrder.id,
      line.product_id,
      line.product_name,
      line.product_sku,
      line.description,
      line.quantity,
      line.unit_price,
      line.discount_percent,
      line.discount_amount,
      line.tax_rate,
      line.tax_amount,
      line.line_total,
    ]
  );
}
```

**REPLACE with:**
```typescript
// Insert sales order items
for (const line of linesResult.rows) {
  // Get custom components if this is a customized product
  let customComponents = null;
  if (line.is_customized) {
    const customComponentsResult = await client.query(
      `SELECT qlc.*, m.name as material_name, f.name as finish_name
       FROM quotation_line_components qlc
       LEFT JOIN materials m ON qlc.material_id = m.id
       LEFT JOIN finishes f ON qlc.finish_id = f.id
       WHERE qlc.quotation_line_id = $1`,
      [line.id]
    );
    customComponents = customComponentsResult.rows;
  }

  await client.query(
    `INSERT INTO sales_order_items (
      sales_order_id, product_id, product_name, product_sku,
      description, quantity, unit_price, discount_percent,
      discount_amount, tax_rate, tax_amount, line_total,
      is_customized, base_product_id, custom_components
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      salesOrder.id,
      line.product_id,
      line.product_name,
      line.product_sku,
      line.description,
      line.quantity,
      line.unit_price,
      line.discount_percent,
      line.discount_amount,
      line.tax_rate,
      line.tax_amount,
      line.line_total,
      line.is_customized || false,
      line.base_product_id || null,
      customComponents ? JSON.stringify(customComponents) : null,
    ]
  );
}
```

#### Change 2.2c: Return Stock Warnings (Line ~510 and ~519-522)

**Find line ~510** where the function returns the sales order. It looks like:
```typescript
return salesOrder;
```

**REPLACE with:**
```typescript
return { salesOrder, stockWarnings };
```

**Then find the response around line 519-522:**
```typescript
res.status(201).json(result);
```

**REPLACE with:**
```typescript
res.status(201).json({
  ...result.salesOrder,
  stockWarnings: result.stockWarnings
});
```

**Save and exit**

---

## PHASE 3: Frontend Changes (15 minutes)

### Change 3.1: Remove Duplicate Error Toasts

**File:** `frontend/src/services/api.ts`

**Find lines 62-64** (in the axios response interceptor):

```bash
nano frontend/src/services/api.ts
```

**Find this code (around lines 62-67):**
```typescript
if (error.response?.data?.error) {
  toast.error(error.response.data.error);
} else if (error.message) {
  toast.error(error.message);
}
return Promise.reject(error);
```

**REPLACE with:**
```typescript
// Don't show automatic error toast here - let individual mutations handle their own errors
// This prevents duplicate error messages
return Promise.reject(error);
```

**Save and exit**

---

### Change 3.2: Display Custom Components in Sales Order Details

**File:** `frontend/src/pages/sales-orders/SalesOrderManagement.tsx`

#### Change 3.2a: Update PDF Generation (Lines ~266-297)

**Open file:**
```bash
nano frontend/src/pages/sales-orders/SalesOrderManagement.tsx
```

**Find the PDF generation section around line 266** that starts with:
```typescript
items: (fullOrder.items || []).map((item: any) => ({
  id: item.id,
  description: item.product_name,
```

**REPLACE the entire `items` mapping with:**
```typescript
items: (fullOrder.items || []).map((item: any) => {
  // Build description with custom components if present
  let description = item.product_name

  // Add custom components details if this is a customized product
  if (item.is_customized && item.custom_components && item.custom_components.length > 0) {
    description += '\nPersonnalisation:'
    item.custom_components.forEach((comp: any) => {
      description += `\n  • ${comp.component_name}`
      if (comp.quantity) description += `\n    Quantité: ${comp.quantity}`
      if (comp.material_name) description += `\n    Matériau: ${comp.material_name}`
      if (comp.finish_name) description += `\n    Finition: ${comp.finish_name}`
      if (comp.notes) description += `\n    Note: ${comp.notes}`
    })
  }

  // Add user description if present
  if (item.description && item.description.trim()) {
    description += '\n' + item.description
  }

  return {
    id: item.id,
    description,
    quantity: parseFloat(item.quantity),
    unitPrice: parseFloat(item.unit_price),
    discount: parseFloat(item.discount_percent) || 0,
    discountType: 'percent' as const,
    tax: parseFloat(item.tax_rate) || 20,
    total: parseFloat(item.line_total),
  }
}),
```

#### Change 3.2b: Update Details View (Lines ~705-718)

**In the same file, find the details view around line 705** where items are displayed.

**Find the section that shows item.product_name:**
```typescript
<div className="font-medium text-gray-900 dark:text-white">
  {item.product_name}
</div>
{item.description && (
  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
    {item.description}
  </div>
)}
```

**ADD this code RIGHT AFTER the description section:**
```typescript
{item.is_customized && item.custom_components && item.custom_components.length > 0 && (
  <div className="mt-2 text-xs">
    <div className="font-semibold text-blue-600">Personnalisation:</div>
    {item.custom_components.map((comp: any, compIdx: number) => (
      <div key={compIdx} className="ml-2 mt-1 text-gray-600 dark:text-gray-400">
        <div className="font-medium">• {comp.component_name}</div>
        {comp.quantity && <div className="ml-4">Quantité: {comp.quantity}</div>}
        {comp.material_name && <div className="ml-4">Matériau: {comp.material_name}</div>}
        {comp.finish_name && <div className="ml-4">Finition: {comp.finish_name}</div>}
        {comp.notes && <div className="ml-4 italic">Note: {comp.notes}</div>}
      </div>
    ))}
  </div>
)}
```

**Save and exit**

---

### Change 3.3: Display Custom Components in Invoice Details

**File:** `frontend/src/pages/invoices/InvoiceManagement.tsx`

**Apply the EXACT SAME changes as in 3.2:**

#### Change 3.3a: Update PDF Generation (Lines ~583-596)

Same changes as SalesOrderManagement.tsx PDF section

#### Change 3.3b: Update Details View

Same changes as SalesOrderManagement.tsx details view section

---

## PHASE 4: Rebuild and Restart (10 minutes)

### Step 4.1: Rebuild Backend

**On VPS:**
```bash
cd /path/to/myerp_app

# Stop backend
docker-compose -f docker-compose.production.yml --env-file .env.production stop api

# Rebuild backend
docker-compose -f docker-compose.production.yml --env-file .env.production up -d --build api

# Check logs
docker-compose -f docker-compose.production.yml --env-file .env.production logs -f api
```

Wait for "Server started on port 4000" message, then Ctrl+C to exit logs.

### Step 4.2: Rebuild Frontend

```bash
# Stop frontend
docker-compose -f docker-compose.production.yml --env-file .env.production stop frontend

# Remove old container
docker-compose -f docker-compose.production.yml --env-file .env.production rm -f frontend

# Rebuild frontend
docker-compose -f docker-compose.production.yml --env-file .env.production up -d --build frontend

# Check status
docker-compose -f docker-compose.production.yml --env-file .env.production ps
```

---

## PHASE 5: Testing (15 minutes)

### Test 1: Backorder Support

1. Create a quotation with a product where `quantity > current stock`
2. Convert to sales order
3. **Expected**:
   - ✅ Order created successfully
   - ⚠️ Warning toast: "Stock insuffisant: [product]: X disponible(s), Y nécessaire(s)"
   - ✅ Stock goes negative
   - ✅ Inventory movements created

### Test 2: Custom Components in Sales Order

1. Create a quotation with a customized product
2. Convert to sales order
3. View sales order details
4. **Expected**:
   - ✅ Custom components displayed with materials, finishes, quantities
5. Generate sales order PDF
6. **Expected**:
   - ✅ PDF shows custom component details

### Test 3: Custom Components in Invoice

1. From a sales order with custom components, generate invoice
2. View invoice details
3. **Expected**:
   - ✅ Custom components displayed correctly
4. Generate invoice PDF
5. **Expected**:
   - ✅ PDF shows custom component details

---

## Rollback Procedure (If Something Goes Wrong)

### Rollback Database

```bash
# On VPS
cd /path/to/myerp_app

# Find your backup
ls -lh backup_before_custom_components_*.sql.gz

# Restore database
gunzip -c backup_before_custom_components_YYYYMMDD.sql.gz | \
  docker-compose -f docker-compose.production.yml --env-file .env.production exec -T postgres \
  psql -U myerp myerp_db
```

### Rollback Code

```bash
# Extract backup
tar -xzf myerp_app_backup_YYYYMMDD.tar.gz

# Rebuild containers
docker-compose -f docker-compose.production.yml --env-file .env.production up -d --build api frontend
```

---

## Verification Checklist

After deployment, verify:

- [ ] Database migration completed successfully
- [ ] New columns exist in `sales_order_items` and `invoice_items`
- [ ] Backend container running: `docker ps | grep myerp-api`
- [ ] Frontend container running: `docker ps | grep myerp-frontend`
- [ ] Can create sales order with insufficient stock (backorder)
- [ ] Stock warnings displayed correctly
- [ ] Custom components display in sales order details
- [ ] Custom components display in invoice details
- [ ] PDFs include custom component information
- [ ] No console errors in browser

---

## Summary of Changes

### Database
- ✅ Added 3 columns to `sales_order_items`
- ✅ Added 3 columns to `invoice_items`
- ✅ Created GIN indexes for JSONB columns

### Backend (3 files)
- ✅ `invoices.ts`: Fixed JSON.stringify (1 line)
- ✅ `sales-orders.ts`: Backorder support + custom components (~100 lines)

### Frontend (3 files)
- ✅ `api.ts`: Removed duplicate toasts (5 lines)
- ✅ `SalesOrderManagement.tsx`: Custom component display (~40 lines)
- ✅ `InvoiceManagement.tsx`: Custom component display (~40 lines)

---

**Total Changes**: 1 migration + ~200 lines of code across 6 files

**Estimated Time**: 60-75 minutes

**Downtime**: ~5 minutes during container restarts
