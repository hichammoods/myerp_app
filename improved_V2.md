# Sales Order & Invoice System - Development Plan V2

## Overview

This document outlines the complete development plan for implementing the **Sales Order → Invoice workflow** in MyERP. This is Phase 1 MVP with manual conversion and automatic stock deduction.

---

## Workflow Summary

```
Quotation (Accepted)
    ↓ [Manual: "Créer Commande" button]
Sales Order (En cours) → Stock deducted automatically
    ↓ [Confirmer]
En préparation
    ↓ [Marquer comme expédié]
Expédié
    ↓ [Confirmer livraison]
Livré
    ↓ [Créer facture]
Invoice created → Order marked as "Facturé"
    ↓ [Optional: Clôturer]
Terminé
```

---

## Database Schema

### 1. Sales Orders Table
```sql
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  quotation_id UUID REFERENCES quotations(id) NOT NULL,
  contact_id UUID REFERENCES contacts(id) NOT NULL,

  -- Dates
  order_date DATE DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  shipped_date DATE,
  delivered_date DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'en_cours',
  -- Values: en_cours, en_preparation, expedie, livre, termine, annule

  -- Financial
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),

  -- Delivery
  delivery_address TEXT,
  tracking_number VARCHAR(100),

  -- References
  invoice_id UUID REFERENCES invoices(id), -- Link to invoice when created

  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(255),
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20,
  line_total DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Invoices Table
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id) NOT NULL,
  quotation_id UUID REFERENCES quotations(id),
  contact_id UUID REFERENCES contacts(id) NOT NULL,

  -- Dates
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,

  -- Status
  status VARCHAR(50) DEFAULT 'brouillon',
  -- Values: brouillon, envoyee, payee, en_retard, annulee

  -- Financial
  subtotal DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_due DECIMAL(10,2),

  payment_terms VARCHAR(100) DEFAULT '30 jours',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(255),
  description TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20,
  line_total DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Update Quotations Table
```sql
ALTER TABLE quotations ADD COLUMN sales_order_id UUID REFERENCES sales_orders(id);
ALTER TABLE quotations ADD COLUMN converted_to_order_at TIMESTAMP;
```

---

## Backend API Endpoints

### Sales Orders API (`/api/sales-orders`)

```typescript
POST   /api/sales-orders              // Create from quotation
GET    /api/sales-orders               // List all
GET    /api/sales-orders/:id           // Get by ID
PATCH  /api/sales-orders/:id/status    // Update status
POST   /api/sales-orders/:id/cancel    // Cancel order
GET    /api/sales-orders/stats/overview // Stats
```

### Invoices API (`/api/invoices`)

```typescript
POST   /api/invoices                  // Create from sales order
GET    /api/invoices                  // List all
GET    /api/invoices/:id              // Get by ID
PATCH  /api/invoices/:id/status       // Update status
POST   /api/invoices/:id/cancel       // Cancel invoice
GET    /api/invoices/stats/overview   // Stats
```

---

## Stock Deduction Logic

### When Sales Order is Created

```typescript
async function createSalesOrder(quotationId: string) {
  // 1. Get quotation with items
  const quotation = await getQuotationById(quotationId)

  // 2. Create sales order
  const salesOrder = await db.query(`
    INSERT INTO sales_orders (...)
    VALUES (...)
    RETURNING *
  `)

  // 3. Copy items from quotation to sales order
  for (const item of quotation.line_items) {
    await db.query(`
      INSERT INTO sales_order_items (...)
      VALUES (...)
    `)

    // 4. DEDUCT STOCK
    await db.query(`
      UPDATE products
      SET stock_quantity = stock_quantity - $1
      WHERE id = $2
    `, [item.quantity, item.product_id])
  }

  // 5. Link quotation to sales order
  await db.query(`
    UPDATE quotations
    SET sales_order_id = $1, converted_to_order_at = NOW()
    WHERE id = $2
  `, [salesOrder.id, quotationId])

  return salesOrder
}
```

### When Sales Order is Cancelled

```typescript
async function cancelSalesOrder(salesOrderId: string) {
  // 1. Get sales order items
  const items = await getSalesOrderItems(salesOrderId)

  // 2. RESTORE STOCK
  for (const item of items) {
    await db.query(`
      UPDATE products
      SET stock_quantity = stock_quantity + $1
      WHERE id = $2
    `, [item.quantity, item.product_id])
  }

  // 3. Update sales order status
  await db.query(`
    UPDATE sales_orders
    SET status = 'annule', updated_at = NOW()
    WHERE id = $1
  `, [salesOrderId])

  // 4. Unlink from quotation (optional - or keep for history)
  await db.query(`
    UPDATE quotations
    SET sales_order_id = NULL
    WHERE sales_order_id = $1
  `, [salesOrderId])
}
```

---

## UI/UX Design

### 1. Quotation Detail Page - When Status = "Accepted"

**Show conversion card:**
```
┌────────────────────────────────────────────────────────────┐
│ ✅ Devis Accepté                                           │
│                                                             │
│ Ce devis peut maintenant être converti en commande de vente│
│                                                             │
│ [🔄 Créer une Commande de Vente]  [📄 Télécharger PDF]    │
└────────────────────────────────────────────────────────────┘
```

**When button clicked, show confirmation dialog:**
```
┌─────────────────────────────────────────────────┐
│ Créer une Commande de Vente                     │
├─────────────────────────────────────────────────┤
│                                                  │
│ Devis: DEV-2024-001                             │
│ Client: Entreprise ABC                          │
│ Montant: 12,450.00 €                            │
│                                                  │
│ ⚠️  Le stock sera automatiquement déduit        │
│                                                  │
│ Date de livraison prévue:                       │
│ [__________________] (Optional)                 │
│                                                  │
│ [Annuler]  [✓ Créer la Commande]               │
└─────────────────────────────────────────────────┘
```

**After conversion, show link:**
```
┌────────────────────────────────────────────────────────────┐
│ ✅ Devis Accepté → Commande Créée                         │
│                                                             │
│ Commande de vente: CMD-2024-001                            │
│ Créée le: 15/01/2024                                       │
│                                                             │
│ [👁️ Voir la Commande]  [📄 Télécharger PDF Devis]         │
└────────────────────────────────────────────────────────────┘
```

---

### 2. Sales Order Detail Page

**Header with breadcrumb:**
```
Commandes > CMD-2024-001

┌────────────────────────────────────────────────────────────┐
│ Commande de Vente #CMD-2024-001        [📄 Télécharger PDF]│
├────────────────────────────────────────────────────────────┤
│ Statut: [🔵 En cours]                 Date: 15/01/2024     │
│                                                             │
│ Références:                                                 │
│ • Devis: DEV-2024-001 [Voir]                               │
│ • Facture: - (Non créée)                                   │
└────────────────────────────────────────────────────────────┘
```

**Action Buttons (Context-Sensitive):**

**When status = "En cours":**
```
┌──────────────────────────────────────────────────────────────┐
│ Actions                                                       │
├──────────────────────────────────────────────────────────────┤
│ [✓ Confirmer la Commande] → Passer en préparation           │
│ [📄 Créer une Facture] → Générer la facture                 │
│ [❌ Annuler la Commande] → Annuler et restaurer le stock     │
└──────────────────────────────────────────────────────────────┘
```

**When status = "En préparation":**
```
┌──────────────────────────────────────────────────────────────┐
│ Actions                                                       │
├──────────────────────────────────────────────────────────────┤
│ [📦 Marquer comme Expédié] → Passer en expédié              │
│                                                               │
│ Facture: [📄 Créer une Facture] OU [👁️ Voir FACT-2024-001] │
└──────────────────────────────────────────────────────────────┘
```

**When status = "Expédié":**
```
┌──────────────────────────────────────────────────────────────┐
│ Actions                                                       │
├──────────────────────────────────────────────────────────────┤
│ Numéro de suivi: [________________] [Enregistrer]            │
│                                                               │
│ [✓ Confirmer la Livraison] → Marquer comme livré            │
│                                                               │
│ Facture: [👁️ Voir FACT-2024-001]                            │
└──────────────────────────────────────────────────────────────┘
```

**When status = "Livré":**
```
┌──────────────────────────────────────────────────────────────┐
│ Actions                                                       │
├──────────────────────────────────────────────────────────────┤
│ ✅ Commande livrée le: 02/02/2024                            │
│                                                               │
│ Facture: [📄 Créer une Facture] OU [👁️ Voir FACT-2024-001] │
│                                                               │
│ [🔒 Clôturer la Commande] → Marquer comme terminé           │
└──────────────────────────────────────────────────────────────┘
```

---

### 3. Sales Order List Page

**URL:** `/commandes`

**Metrics Cards:**
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Total Commandes │ │   En cours      │ │  CA du mois     │
│      24         │ │       8         │ │   45,678 €      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**Table:**
```
┌───────────────────────────────────────────────────────────────────┐
│ N° Commande  │ Date       │ Client      │ Statut        │ Total  │
├───────────────────────────────────────────────────────────────────┤
│ CMD-2024-003 │ 15/01/2024 │ ABC Corp    │ 🔵 En cours   │3,378 € │
│ CMD-2024-002 │ 14/01/2024 │ XYZ Ltd     │ 🟡 Préparation│5,200 € │
│ CMD-2024-001 │ 10/01/2024 │ Test Co     │ 🟢 Livré      │2,100 € │
└───────────────────────────────────────────────────────────────────┘
```

---

### 4. Invoice Creation Dialog

**When user clicks "Créer une Facture":**
```
┌─────────────────────────────────────────────────┐
│ Créer une Facture                                │
├─────────────────────────────────────────────────┤
│                                                  │
│ Commande: CMD-2024-001                          │
│ Client: Entreprise ABC                          │
│                                                  │
│ Date de facturation:                            │
│ [15/01/2024] ← Today                            │
│                                                  │
│ Conditions de paiement:                         │
│ [30 jours fin de mois ▼]                        │
│                                                  │
│ Date d'échéance:                                │
│ [14/02/2024] ← Calculated                       │
│                                                  │
│ Notes (optionnel):                              │
│ [________________________________]              │
│                                                  │
│ Montant total: 3,378.00 €                       │
│                                                  │
│ [Annuler]  [✓ Créer la Facture]                │
└─────────────────────────────────────────────────┘
```

---

### 5. Invoice Detail Page

**Header:**
```
Factures > FACT-2024-001

┌────────────────────────────────────────────────────────────┐
│ Facture #FACT-2024-001                  [📄 Télécharger PDF]│
├────────────────────────────────────────────────────────────┤
│ Statut: [🟡 Envoyée]                  Date: 15/01/2024     │
│ Échéance: 14/02/2024 (dans 30 jours)                       │
│                                                             │
│ Références:                                                 │
│ • Devis: DEV-2024-001 [Voir]                               │
│ • Commande: CMD-2024-001 [Voir]                            │
└────────────────────────────────────────────────────────────┘
```

**Payment Status:**
```
┌──────────────────────────────────────────────────────────────┐
│ Paiement                                                      │
├──────────────────────────────────────────────────────────────┤
│ Total facturé:     3,378.00 €                                │
│ Payé:                  0.00 €                                │
│ Reste à payer:     3,378.00 €                                │
│                                                               │
│ [███████░░░░░░░░░░░] 0%                                      │
└──────────────────────────────────────────────────────────────┘
```

**Actions:**
```
┌──────────────────────────────────────────────────────────────┐
│ Actions                                                       │
├──────────────────────────────────────────────────────────────┤
│ [📧 Envoyer par Email]                                       │
│ [💰 Enregistrer un Paiement]                                 │
│ [❌ Annuler la Facture]                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Document Reference System

### PDF Headers - Show All References

**Quotation PDF:**
```
DEVIS N° DEV-2024-001
Date: 15/01/2024
```

**Sales Order PDF:**
```
BON DE COMMANDE N° CMD-2024-001
Devis de référence: DEV-2024-001
Date: 15/01/2024
```

**Invoice PDF:**
```
FACTURE N° FACT-2024-001
Commande de référence: CMD-2024-001
Devis de référence: DEV-2024-001
Date: 15/01/2024
Échéance: 14/02/2024
```

---

## Development Plan - Task Breakdown

### Phase 1: Database Foundation

#### Task 1: Create sales_orders tables migration ⏱️ 30 min
**Files to create:**
- `backend/src/database/migrations/009_create_sales_orders_table.sql`
- `backend/src/database/run-migration-009.ts`

**What it does:**
- Creates `sales_orders` table with all fields
- Creates `sales_order_items` table
- Sets up foreign key relationships
- Creates indexes for performance

---

#### Task 2: Create invoices tables migration ⏱️ 30 min
**Files to create:**
- `backend/src/database/migrations/010_create_invoices_table.sql`
- `backend/src/database/run-migration-010.ts`

**What it does:**
- Creates `invoices` table
- Creates `invoice_items` table
- Sets up foreign key relationships
- Creates indexes

---

#### Task 3: Update quotations table ⏱️ 15 min
**Files to create:**
- `backend/src/database/migrations/011_add_sales_order_to_quotations.sql`
- `backend/src/database/run-migration-011.ts`

**What it does:**
- Adds `sales_order_id` column to quotations
- Adds `converted_to_order_at` timestamp

---

### Phase 2: Backend API Development

#### Task 4: Create sales orders API ⏱️ 2-3 hours
**Files to create:**
- `backend/src/routes/sales-orders.ts`

**Endpoints to implement:**
- `POST /api/sales-orders` - Create from quotation
- `GET /api/sales-orders` - List all
- `GET /api/sales-orders/:id` - Get by ID
- `PATCH /api/sales-orders/:id/status` - Update status
- `POST /api/sales-orders/:id/cancel` - Cancel order
- `GET /api/sales-orders/stats/overview` - Stats

**Key features:**
- Create order from quotation (copy line items)
- Automatic stock deduction on creation
- Stock restoration on cancellation
- Status validation (can only move forward)
- Generate order number (CMD-YYYY-NNN)

---

#### Task 5: Create invoices API ⏱️ 2 hours
**Files to create:**
- `backend/src/routes/invoices.ts`

**Endpoints to implement:**
- `POST /api/invoices` - Create from sales order
- `GET /api/invoices` - List all
- `GET /api/invoices/:id` - Get by ID
- `PATCH /api/invoices/:id/status` - Update status
- `POST /api/invoices/:id/cancel` - Cancel invoice
- `GET /api/invoices/stats/overview` - Stats

**Key features:**
- Create invoice from sales order (copy items)
- Generate invoice number (FACT-YYYY-NNN)
- Calculate due date based on payment terms
- Link back to sales order and quotation

---

#### Task 6: Implement stock deduction logic ⏱️ 1 hour
**Files to modify:**
- `backend/src/routes/sales-orders.ts`

**What it does:**
- In createSalesOrder: Loop through items, deduct from products.stock_quantity
- In cancelSalesOrder: Loop through items, restore stock_quantity
- Add validation: Check if enough stock before creating order
- Add transaction handling to ensure atomicity

---

### Phase 3: PDF Generation

#### Task 7: Sales order PDF generator ⏱️ 1-1.5 hours
**Files to create:**
- `frontend/src/services/salesOrderPdfGenerator.ts` (or extend existing pdfGenerator.ts)

**What it does:**
- Similar to quotation PDF but with "BON DE COMMANDE" header
- Shows reference to quotation number
- Shows order status and dates
- Shows delivery information
- Can reuse most of quotation PDF code

---

#### Task 8: Invoice PDF generator ⏱️ 1-1.5 hours
**Files to create:**
- `frontend/src/services/invoicePdfGenerator.ts` (or extend pdfGenerator.ts)

**What it does:**
- "FACTURE" header
- Shows references to quotation and sales order
- Shows invoice date and due date
- Shows payment terms
- Payment status section
- Legal mentions for invoices

---

### Phase 4: Frontend API Integration

#### Task 9: Add sales order API to frontend ⏱️ 30 min
**Files to modify:**
- `frontend/src/services/api.ts`

**What to add:**
```typescript
export const salesOrdersApi = {
  getAll: async (params?) => { ... },
  getById: async (id: string) => { ... },
  create: async (quotationId: string, data: any) => { ... },
  updateStatus: async (id: string, status: string) => { ... },
  cancel: async (id: string) => { ... },
  getStats: async () => { ... }
}
```

---

#### Task 10: Add invoice API to frontend ⏱️ 30 min
**Files to modify:**
- `frontend/src/services/api.ts`

**What to add:**
```typescript
export const invoicesApi = {
  getAll: async (params?) => { ... },
  getById: async (id: string) => { ... },
  create: async (salesOrderId: string, data: any) => { ... },
  updateStatus: async (id: string, status: string) => { ... },
  cancel: async (id: string) => { ... },
  getStats: async () => { ... }
}
```

---

### Phase 5: Frontend UI - Quotation Updates

#### Task 11: Update quotation detail page ⏱️ 1-1.5 hours
**Files to modify:**
- `frontend/src/pages/quotations/QuotationManagement.tsx` or detail component

**What to add:**
- "Créer Commande" button when status = "accepted"
- Confirmation dialog for order creation
- Show sales order reference if already converted
- Link to sales order detail page

---

### Phase 6: Frontend UI - Sales Orders

#### Task 12: Create sales order list page ⏱️ 2-3 hours
**Files to create:**
- `frontend/src/pages/sales-orders/SalesOrderManagement.tsx`

**What it includes:**
- Metrics cards (total, in progress, revenue)
- Filters (status, date range, client)
- Sales orders table with columns
- Status badges with colors
- Action buttons (view, PDF)

---

#### Task 13: Create sales order detail page ⏱️ 3-4 hours
**Files to create:**
- `frontend/src/pages/sales-orders/SalesOrderDetail.tsx`

**What it includes:**
- Header with order number and status
- Breadcrumb references (quotation, invoice)
- Client and delivery information
- Items table
- Totals section
- **Context-sensitive action buttons** (main feature!)
  - En cours: Confirmer, Créer facture, Annuler
  - En préparation: Marquer expédié, Voir facture
  - Expédié: Confirmer livraison, tracking number
  - Livré: Clôturer commande
- Status change dialogs/confirmations

---

### Phase 7: Frontend UI - Invoices

#### Task 14: Create invoice list page ⏱️ 2-3 hours
**Files to create:**
- `frontend/src/pages/invoices/InvoiceManagement.tsx`

**What it includes:**
- Metrics cards (total, pending payment, overdue)
- Filters (status, client, date range)
- Invoices table
- Payment status indicators
- Overdue warnings (red badges)

---

#### Task 15: Create invoice detail page ⏱️ 2-3 hours
**Files to create:**
- `frontend/src/pages/invoices/InvoiceDetail.tsx`

**What it includes:**
- Header with invoice number and status
- Breadcrumb references (quotation, sales order)
- Client information
- Items and totals
- Payment status section with progress bar
- Due date with countdown/overdue warning
- Action buttons (send email, download PDF, cancel)

---

### Phase 8: Navigation & Integration

#### Task 16: Add navigation menu items ⏱️ 30 min
**Files to modify:**
- `frontend/src/components/Layout.tsx` or navigation component
- `frontend/src/App.tsx` (routes)

**What to add:**
- Menu item: "Commandes" → `/commandes`
- Menu item: "Factures" → `/factures`
- Routes for all new pages
- Protect routes with authentication

---

### Phase 9: Testing & Validation

#### Task 17: Test complete workflow ⏱️ 2-3 hours
**What to test:**
1. Create quotation → Accept → Convert to Sales Order
2. Verify stock deduction
3. Move order through statuses (en cours → preparation → expédié → livré)
4. Create invoice from order
5. Download all PDFs (quotation, order, invoice)
6. Verify document references are correct
7. Cancel order → verify stock restoration
8. Test edge cases (insufficient stock, invalid status changes)

---

## Time Estimates

- **Phase 1:** 1.25 hours (Database)
- **Phase 2:** 5-6 hours (Backend API)
- **Phase 3:** 2-3 hours (PDF Generation)
- **Phase 4:** 1 hour (Frontend API)
- **Phase 5:** 1-1.5 hours (Quotation Updates)
- **Phase 6:** 5-7 hours (Sales Order UI)
- **Phase 7:** 4-6 hours (Invoice UI)
- **Phase 8:** 0.5 hours (Navigation)
- **Phase 9:** 2-3 hours (Testing)

**Total: 22-31 hours** (approximately 3-4 full working days)

---

## Recommended Development Schedule

### Day 1: Backend Foundation
- Tasks 1-6 (Database + API + Stock Logic)
- Run migrations
- Test API endpoints with Postman/curl

### Day 2: PDF & Frontend API
- Tasks 7-10 (PDF generators + Frontend API integration)
- Test PDF generation
- Test API calls from frontend

### Day 3: Sales Orders UI
- Tasks 11-13 (Quotation updates + Sales order pages)
- Test order creation flow
- Test status transitions

### Day 4: Invoices UI & Testing
- Tasks 14-17 (Invoice pages + Navigation + Full workflow testing)
- Integration testing
- Bug fixes

---

## Success Criteria

✅ Quotation can be converted to Sales Order with one click
✅ Stock is automatically deducted when order is created
✅ Stock is restored when order is cancelled
✅ Order status can progress through all stages
✅ Invoice can be created from sales order
✅ All PDFs show correct document references
✅ User can download quotation, order, and invoice PDFs
✅ Status transitions are validated (can't skip stages)
✅ UI is responsive and user-friendly

---

## Next Steps

1. Review and approve this plan
2. Start with Task 1: Create sales_orders database migration
3. Work through tasks sequentially
4. Test each phase before moving to the next
5. Deploy to production after full testing

---

**Last Updated:** 2024
**Version:** 2.0
**Status:** Ready for Implementation

---

## Inventory Movement Tracking

### Overview

When sales orders are confirmed, the system will automatically create detailed inventory movement records. This provides full traceability and audit trail for all stock changes.

### Automatic Inventory Movements on Sales Order Confirmation

#### Implementation Flow

```typescript
async function confirmSalesOrder(orderId: string, userId: string) {
  // Start transaction
  await client.query('BEGIN');

  try {
    // 1. Update sales order status
    await client.query(
      'UPDATE sales_orders SET status = $1, confirmed_at = NOW(), confirmed_by = $2 WHERE id = $3',
      ['confirmed', userId, orderId]
    );

    // 2. Get order details
    const orderResult = await client.query(
      'SELECT order_number FROM sales_orders WHERE id = $1',
      [orderId]
    );
    const orderNumber = orderResult.rows[0].order_number;

    // 3. Get all order line items
    const itemsResult = await client.query(
      'SELECT product_id, quantity FROM sales_order_items WHERE order_id = $1',
      [orderId]
    );

    // 4. For each product in the order, deduct stock and create movement
    for (const item of itemsResult.rows) {
      // Get current stock
      const stockResult = await client.query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [item.product_id]
      );
      const currentStock = stockResult.rows[0].stock_quantity;
      const newStock = currentStock - item.quantity;

      // Validate sufficient stock
      if (newStock < 0) {
        throw new Error(`Insufficient stock for product ${item.product_id}`);
      }

      // Update stock
      await client.query(
        'UPDATE products SET stock_quantity = $1 WHERE id = $2',
        [newStock, item.product_id]
      );

      // CREATE INVENTORY MOVEMENT RECORD
      await client.query(`
        INSERT INTO inventory_movements (
          product_id,
          movement_type,
          quantity,
          quantity_before,
          quantity_after,
          reference_type,
          reference_id,
          reference_number,
          reason,
          created_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        item.product_id,
        'out',                                    // Stock going OUT
        item.quantity,                            // How much
        currentStock,                             // Before
        newStock,                                 // After
        'sales_order',                            // Reference type
        orderId,                                  // Order UUID
        orderNumber,                              // Order number (e.g., "CMD-2024-001")
        `Sales order ${orderNumber}`,            // Human-readable reason
        userId                                    // Who confirmed it
      ]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
```

### Movement Record Structure

Movements in the inventory system will appear like this:

```javascript
{
  "id": "abc123...",
  "item_id": "product-uuid",
  "item_name": "Chaise en chêne",
  "type": "out",                           // Stock leaving (sales)
  "quantity": 5,                           // 5 units sold
  "before_stock": 100,
  "after_stock": 95,                       // Reduced from 100 to 95
  "reason": "Sales order CMD-2024-001",    // Clear reason
  "reference": "CMD-2024-001",             // Order number
  "user": "Jean Dupont",                   // Who confirmed the order
  "date": "2025-10-24T10:30:00Z",
  "notes": null
}
```

### Movement Types Reference

| Movement Type | Reason Examples | Triggered By |
|---------------|----------------|--------------|
| `in` | "Purchase order PO-2024-001" | Purchase order receipt |
| `in` | "Customer return RET-2024-001" | Return confirmation |
| `in` | "Manual stock addition" | Inventory adjustment |
| **`out`** | **"Sales order CMD-2024-001"** | **Sales order confirmation** ⭐ |
| `out` | "Manual stock removal" | Inventory adjustment |
| `out` | "Damaged goods" | Write-off |
| `adjustment` | "Stock count correction" | Manual adjustment |
| `transfer` | "Transfer to Warehouse B" | Location transfer |

### Enhanced Movement Query with Sales Context

```sql
SELECT
  im.id,
  COALESCE(im.product_id, im.material_id) as item_id,
  CASE
    WHEN im.product_id IS NOT NULL THEN p.name
    WHEN im.material_id IS NOT NULL THEN m.name
  END as item_name,
  im.movement_type as type,
  im.quantity,
  im.quantity_before as before_stock,
  im.quantity_after as after_stock,
  im.reason,
  im.reference_type,              -- 'sales_order', 'purchase_order', etc.
  im.reference_number,             -- 'CMD-2024-001', 'PO-2024-001', etc.
  im.reference_id,                 -- UUID to link to the actual order
  COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Système') as user,
  im.created_at as date,
  im.notes,
  -- Join to get sales order details
  so.customer_name,                -- Customer name
  so.status as order_status        -- Current order status
FROM inventory_movements im
LEFT JOIN products p ON im.product_id = p.id
LEFT JOIN materials m ON im.material_id = m.id
LEFT JOIN users u ON im.created_by = u.id
LEFT JOIN sales_orders so ON im.reference_type = 'sales_order' AND im.reference_id = so.id
ORDER BY im.created_at DESC
```

### UI Enhancements for Movement Display

#### Visual Indicators

```typescript
const getMovementIcon = (type: string, reason: string) => {
  if (reason?.includes('Sales order') || reason?.includes('CMD-')) {
    return '🛒'; // Shopping cart for sales
  }

  switch (type) {
    case 'in':
      return '📥'; // Stock added
    case 'out':
      return '📤'; // Stock removed
    case 'adjustment':
      return '⚙️'; // Manual adjustment
    case 'return':
      return '↩️'; // Customer return
    case 'transfer':
      return '🔄'; // Transfer between locations
  }
};

const getMovementBadgeColor = (type: string) => {
  switch (type) {
    case 'in':
      return 'bg-green-100 text-green-800';
    case 'out':
      return 'bg-red-100 text-red-800';
    case 'adjustment':
      return 'bg-yellow-100 text-yellow-800';
    case 'return':
      return 'bg-blue-100 text-blue-800';
    case 'transfer':
      return 'bg-purple-100 text-purple-800';
  }
};
```

#### Movement History Display

In the Stock Management → Movements tab, users will see:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Date/Time        │ Item           │ Type    │ Qty │ Before│ After│ By  │
├────────────────────────────────────────────────────────────────────────┤
│ 24/10 14:30     │ Chaise en chêne│ 🛒 Out  │  5  │  100  │  95  │ JD  │
│                 │ Sales order CMD-2024-001                            │
├────────────────────────────────────────────────────────────────────────┤
│ 23/10 09:15     │ Table basse    │ 📥 In   │ 10  │   20  │  30  │ MA  │
│                 │ Purchase order PO-2024-015                          │
├────────────────────────────────────────────────────────────────────────┤
│ 22/10 16:45     │ Armoire        │ ⚙️ Adj  │  2  │   18  │  20  │ JD  │
│                 │ Stock count correction                               │
└────────────────────────────────────────────────────────────────────────┘
```

### Benefits

✅ **Full Traceability** - Every stock change is recorded with who, when, why
✅ **Audit Trail** - You can trace back any stock level to specific orders
✅ **Accountability** - Know which user confirmed orders that depleted stock
✅ **Debugging** - If stock levels look wrong, you can review all movements
✅ **Reports** - Generate sales reports by analyzing movements with `reference_type='sales_order'`
✅ **Reversals** - If an order is cancelled, create a reverse movement (`type='return'`)
✅ **Compliance** - Meet audit requirements for inventory tracking

### Optional: Stock Reservation System

For orders that are created but not yet confirmed, consider implementing stock reservations:

#### Reservation Database Schema

```sql
ALTER TABLE products ADD COLUMN reserved_quantity INTEGER DEFAULT 0;

-- View showing available stock
CREATE VIEW product_availability AS
SELECT
  id,
  name,
  stock_quantity,
  reserved_quantity,
  (stock_quantity - reserved_quantity) as available_quantity
FROM products;
```

#### Reservation Flow

1. **Order Created (Draft)** → Reserve stock
   - `UPDATE products SET reserved_quantity = reserved_quantity + qty WHERE id = product_id`
   - Stock is "held" but not deducted

2. **Order Confirmed** → Convert reservation to movement
   - `UPDATE products SET stock_quantity = stock_quantity - qty, reserved_quantity = reserved_quantity - qty`
   - Create inventory movement record

3. **Order Cancelled** → Release reservation
   - `UPDATE products SET reserved_quantity = reserved_quantity - qty`
   - No movement record needed

#### Benefits of Reservations

- Prevents overselling when multiple pending orders exist
- Shows true "available to sell" quantity
- Allows orders to be created without immediate stock commitment
- Better inventory visibility

---

## Future Enhancements

### Purchase Order Integration
- Similar flow but with `movement_type = 'in'`
- Link to purchase orders with `reference_type = 'purchase_order'`
- Track supplier deliveries

### Multi-Location Inventory
- Utilize `location_from` and `location_to` fields
- Track transfers between warehouses
- Location-based stock levels and alerts

### Batch/Lot Tracking
- Track products by batch numbers
- Expiration date management
- First-in-first-out (FIFO) enforcement

### Advanced Reporting
- Stock movement analysis by time period
- Inventory turnover rates by product
- Slow-moving inventory identification
- Stock valuation reports
- Sales vs. stock depletion correlation
