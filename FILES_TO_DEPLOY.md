# Files to Deploy - Quick Reference

## PHASE 1: Quotation Editable Fields (SAFE - No Database Changes)

### Frontend Only - 1 File
```
frontend/src/pages/quotations/EnhancedQuotationBuilder.tsx
```

**What changed:** Product name and description are now editable input fields
**Risk Level:** ⚠️ **ZERO RISK** - Frontend only, no database changes

---

## PHASE 2: Complete Feature Update (Database Migration Required)

### Backend Files - 4 Files

#### New Files (2)
```
backend/src/database/migrations/022_add_customization_to_sales_order_items.sql
backend/src/database/run-migration-022.ts
```

#### Modified Files (2)
```
backend/src/routes/invoices.ts                 (Line 334 - JSON.stringify fix)
backend/src/routes/sales-orders.ts             (Lines 289-332, 367-407, 510, 519-522)
```

### Frontend Files - 3 Files

```
frontend/src/services/api.ts                            (Lines 62-64 - Remove duplicate toasts)
frontend/src/pages/sales-orders/SalesOrderManagement.tsx  (Lines 705-718 - Custom components display)
frontend/src/pages/invoices/InvoiceManagement.tsx        (Lines 583-596 - Custom components display)
```

---

## Summary

### Phase 1: 1 file
- `EnhancedQuotationBuilder.tsx`

### Phase 2: 7 files total
- **Backend**: 4 files (2 new, 2 modified)
- **Frontend**: 3 files (all modified)

---

## Database Migration

**Migration 022** adds 3 columns to 2 tables:
- `sales_order_items`: `is_customized`, `base_product_id`, `custom_components`
- `invoice_items`: `is_customized`, `base_product_id`, `custom_components`

**Safety:** Uses `ADD COLUMN IF NOT EXISTS` - completely safe, no data loss

