# MyERP Deployment Plan

## Overview
This document outlines the deployment plan for recent changes to the MyERP application.

---

## PHASE 1: Quotation Editable Fields (SAFE - Frontend Only)

### Changes
- **File Modified**: `frontend/src/pages/quotations/EnhancedQuotationBuilder.tsx`
- **What Changed**: Product name and description in quotation line items are now editable inline
- **Database Impact**: ⚠️ **NONE** - No database changes required

### Deployment Steps

1. **On VPS - Update Frontend**
   ```bash
   cd /path/to/myerp_app/frontend

   # Pull latest changes (or manually copy the file)
   git pull origin main  # OR manually upload the file

   # Rebuild frontend
   npm run build

   # Restart frontend service
   pm2 restart myerp-frontend  # or your service name
   ```

2. **Verify**
   - Open a quotation
   - Try editing product name and description fields
   - Save and verify changes persist

### Rollback Plan
- Simply restore the previous version of `EnhancedQuotationBuilder.tsx`
- No database rollback needed

---

## PHASE 2: Complete Feature Update (REQUIRES DATABASE MIGRATION)

### Changes Summary

#### Backend Changes
1. **Database Migration 022** - Adds customization tracking to sales orders and invoices
2. **Invoice JSON Fix** - Proper JSON stringification for custom components
3. **Backorder Support** - Allow negative stock with warnings
4. **Custom Components in Sales Orders** - Full tracking of customized products

#### Frontend Changes
1. **Sales Order Details** - Display custom component details
2. **Invoice Details** - Display custom component details
3. **Error Handling** - Remove duplicate error toasts
4. **PDF Generation** - Include custom component details (already working)

### Files Modified

#### Backend Files
```
backend/src/database/migrations/022_add_customization_to_sales_order_items.sql  (NEW)
backend/src/database/run-migration-022.ts                                        (NEW)
backend/src/routes/invoices.ts                                                   (MODIFIED - line 334)
backend/src/routes/sales-orders.ts                                              (MODIFIED - lines 289-332, 367-407, 510, 519-522)
```

#### Frontend Files
```
frontend/src/services/api.ts                                            (MODIFIED - lines 62-64)
frontend/src/pages/sales-orders/SalesOrderManagement.tsx               (MODIFIED - lines 705-718)
frontend/src/pages/invoices/InvoiceManagement.tsx                      (MODIFIED - lines 583-596)
```

---

## DETAILED DEPLOYMENT STEPS FOR PHASE 2

### Pre-Deployment Checklist

- [ ] **Backup Database**
  ```bash
  pg_dump -U myerp -d myerp_db > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Backup Application Code**
  ```bash
  cd /path/to/myerp_app
  tar -czf myerp_backup_$(date +%Y%m%d_%H%M%S).tar.gz backend frontend
  ```

- [ ] **Check Current Database State**
  ```sql
  -- Check if migration 022 columns exist
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'sales_order_items'
    AND column_name IN ('is_customized', 'base_product_id', 'custom_components');
  ```

---

### Step 1: Deploy Backend Changes (15-20 minutes)

#### 1.1 Upload New Files
```bash
# On your local machine, copy the new files to VPS
scp backend/src/database/migrations/022_add_customization_to_sales_order_items.sql user@vps:/path/to/myerp_app/backend/src/database/migrations/
scp backend/src/database/run-migration-022.ts user@vps:/path/to/myerp_app/backend/src/database/
```

#### 1.2 Update Modified Backend Files
```bash
# On your local machine
scp backend/src/routes/invoices.ts user@vps:/path/to/myerp_app/backend/src/routes/
scp backend/src/routes/sales-orders.ts user@vps:/path/to/myerp_app/backend/src/routes/
```

#### 1.3 Run Database Migration
```bash
# On VPS
cd /path/to/myerp_app/backend

# Run migration 022
npx ts-node -r tsconfig-paths/register src/database/run-migration-022.ts

# Verify migration succeeded
# You should see: "✅ Migration 022 completed successfully!"
```

#### 1.4 Verify Database Changes
```sql
-- Connect to database
psql -U myerp -d myerp_db

-- Check new columns exist
\d sales_order_items

-- You should see:
--   is_customized        | boolean
--   base_product_id      | uuid
--   custom_components    | jsonb

\d invoice_items
-- Should have same columns

-- Check indexes
\di sales_order_items_custom_components
\di invoice_items_custom_components
```

#### 1.5 Restart Backend
```bash
# Rebuild backend (if using TypeScript compilation)
cd /path/to/myerp_app/backend
npm run build  # if you compile to dist/

# Restart backend service
pm2 restart myerp-backend  # or your service name

# Check logs for errors
pm2 logs myerp-backend --lines 50
```

---

### Step 2: Deploy Frontend Changes (10 minutes)

#### 2.1 Update Frontend Files
```bash
# On your local machine
scp frontend/src/services/api.ts user@vps:/path/to/myerp_app/frontend/src/services/
scp frontend/src/pages/sales-orders/SalesOrderManagement.tsx user@vps:/path/to/myerp_app/frontend/src/pages/sales-orders/
scp frontend/src/pages/invoices/InvoiceManagement.tsx user@vps:/path/to/myerp_app/frontend/src/pages/invoices/
```

#### 2.2 Rebuild and Restart Frontend
```bash
# On VPS
cd /path/to/myerp_app/frontend

# Rebuild
npm run build

# Restart service
pm2 restart myerp-frontend  # or your service name
```

---

### Step 3: Verification & Testing (15 minutes)

#### 3.1 Test Backorder Functionality
1. Create a quotation with a product where quantity > stock
2. Convert to sales order
3. **Expected Result**:
   - Order created successfully
   - Warning toast shows: "Stock insuffisant: [details]"
   - Stock goes negative
   - Inventory movements created

#### 3.2 Test Custom Components
1. Create a quotation with a customized product
2. Convert to sales order
3. View sales order details
4. **Expected Result**:
   - Custom components displayed with materials, finishes, quantities
5. Generate invoice from sales order
6. View invoice details
7. **Expected Result**:
   - Custom components displayed correctly

#### 3.3 Test PDFs
1. Generate sales order PDF
2. **Expected Result**: PDF shows custom component details
3. Generate invoice PDF
4. **Expected Result**: PDF shows custom component details

---

## DATABASE MIGRATION DETAILS

### Migration 022: Add Customization to Sales Order Items

**What it does:**
- Adds `is_customized` (boolean) to `sales_order_items` and `invoice_items`
- Adds `base_product_id` (UUID) to track the original product template
- Adds `custom_components` (JSONB) to store customization details
- Creates GIN indexes for performance on JSONB columns

**Impact on Existing Data:**
- ✅ **SAFE** - Uses `ADD COLUMN IF NOT EXISTS`
- ✅ Existing rows will have `NULL` values for new columns
- ✅ Existing functionality continues to work
- ✅ New functionality only activates when these fields are populated

**SQL Preview:**
```sql
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS is_customized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS base_product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS custom_components JSONB;

CREATE INDEX IF NOT EXISTS idx_sales_order_items_custom_components
  ON sales_order_items USING gin(custom_components);
```

**Rollback (if needed):**
```sql
-- Only if you need to rollback
ALTER TABLE sales_order_items
  DROP COLUMN IF EXISTS is_customized,
  DROP COLUMN IF EXISTS base_product_id,
  DROP COLUMN IF EXISTS custom_components;

ALTER TABLE invoice_items
  DROP COLUMN IF EXISTS is_customized,
  DROP COLUMN IF EXISTS base_product_id,
  DROP COLUMN IF EXISTS custom_components;
```

---

## DATA SAFETY GUARANTEES

### ✅ No Data Loss
- Migration uses `ADD COLUMN IF NOT EXISTS` - safe operation
- Existing data in other columns is untouched
- New columns start as NULL for existing rows

### ✅ Backward Compatible
- Old sales orders and invoices continue to work
- New fields only used when `is_customized = true`
- Default values ensure old data displays correctly

### ✅ Tested Migration
- Migration 022 has been tested locally
- Successfully run on development database
- No errors or data corruption observed

---

## ROLLBACK PROCEDURE

### If Issues Occur After Deployment

#### Backend Rollback
```bash
# On VPS
cd /path/to/myerp_app/backend

# Restore from backup
tar -xzf myerp_backup_YYYYMMDD_HHMMSS.tar.gz backend/

# Restart backend
pm2 restart myerp-backend
```

#### Frontend Rollback
```bash
# On VPS
cd /path/to/myerp_app/frontend

# Restore from backup
tar -xzf myerp_backup_YYYYMMDD_HHMMSS.tar.gz frontend/

# Rebuild
npm run build

# Restart
pm2 restart myerp-frontend
```

#### Database Rollback (if migration was run)
```bash
# Restore from database backup
psql -U myerp -d myerp_db < backup_YYYYMMDD_HHMMSS.sql
```

---

## POST-DEPLOYMENT MONITORING

### What to Monitor

1. **Backend Logs**
   ```bash
   pm2 logs myerp-backend --lines 100
   ```
   - Look for errors related to `custom_components`
   - Check for JSON parsing errors
   - Monitor database query errors

2. **Frontend Console**
   - Open browser console
   - Check for JavaScript errors
   - Test all quotation/order/invoice flows

3. **Database Performance**
   ```sql
   -- Check if indexes are being used
   EXPLAIN ANALYZE
   SELECT * FROM sales_order_items
   WHERE custom_components @> '{"material_id": "some-uuid"}';
   ```

---

## ESTIMATED TIMELINE

| Phase | Task | Duration | Downtime |
|-------|------|----------|----------|
| **Phase 1** | Quotation fields editable | 5 min | None |
| **Phase 2** | Full deployment | 40-50 min | 2-3 min |
| - Backup | | 5 min | No |
| - Backend deployment | | 15-20 min | Yes (2-3 min) |
| - Frontend deployment | | 10 min | No (optional) |
| - Testing | | 15 min | No |

**Total Downtime**: 2-3 minutes (only during backend restart)

---

## SUPPORT & TROUBLESHOOTING

### Common Issues

#### 1. Migration Fails
**Symptom**: Error during migration execution
**Solution**:
- Check database connection
- Verify user has ALTER TABLE permissions
- Check migration logs for specific error

#### 2. Backend Won't Start
**Symptom**: PM2 shows error state
**Solution**:
- Check logs: `pm2 logs myerp-backend`
- Verify all required files are present
- Check database connectivity

#### 3. Custom Components Not Displaying
**Symptom**: Details view shows only "Product (Personnalisé)"
**Solution**:
- Clear browser cache
- Verify frontend build includes latest changes
- Check browser console for errors

---

## CONCLUSION

This deployment plan ensures:
- ✅ Zero data loss
- ✅ Minimal downtime (2-3 minutes)
- ✅ Complete rollback capability
- ✅ Comprehensive testing procedures
- ✅ Safe, incremental deployment

**Recommendation**:
1. Deploy **Phase 1** first (quotation fields) - no risk
2. Schedule **Phase 2** during low-traffic period
3. Have database backup ready
4. Test thoroughly in staging environment if available

