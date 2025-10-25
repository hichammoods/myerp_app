# PostgreSQL DECIMAL Columns Analysis
## String vs Number Type Issue in JavaScript

**Date:** 2025-10-26
**Issue:** PostgreSQL NUMERIC/DECIMAL columns are returned as strings by the `pg` (node-postgres) driver

---

## Why This Happens

The PostgreSQL `pg` driver returns NUMERIC and DECIMAL values as **strings** instead of numbers to **preserve precision**. JavaScript's `Number` type uses IEEE 754 floating-point which can lose precision for large numbers or many decimal places.

---

## All DECIMAL/NUMERIC Columns in Database

### 🔴 HIGH RISK - Require parseFloat() in API responses

#### **PRODUCTS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `dimensions_length` | DECIMAL(8,2) | Comparisons | ⚠️ HIGH |
| `dimensions_width` | DECIMAL(8,2) | Comparisons | ⚠️ HIGH |
| `dimensions_height` | DECIMAL(8,2) | Comparisons | ⚠️ HIGH |
| `seat_height` | DECIMAL(8,2) | Comparisons | ⚠️ HIGH |
| `seat_depth` | DECIMAL(8,2) | Comparisons | ⚠️ HIGH |
| `weight` | DECIMAL(8,2) | Comparisons | ⚠️ HIGH |
| `max_load_capacity` | DECIMAL(8,2) | Comparisons | ⚠️ HIGH |
| `base_price` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `cost_price` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `stock_quantity` | DECIMAL(10,2) | **Comparisons** | 🔴 **CRITICAL** ✅ FIXED |
| `reserved_quantity` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `min_stock_level` | DECIMAL(10,2) | **Comparisons** | 🔴 **CRITICAL** ✅ FIXED |
| `max_stock_level` | DECIMAL(10,2) | **Comparisons** | 🔴 **CRITICAL** ✅ FIXED |
| `tax_rate` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |

#### **MATERIALS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `cost_per_unit` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `stock_quantity` | DECIMAL(10,2) | Comparisons | ⚠️ HIGH |
| `min_stock_level` | DECIMAL(10,2) | Comparisons | ⚠️ HIGH |

#### **FINISHES Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `extra_cost` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |

#### **CONTACTS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `credit_limit` | DECIMAL(12,2) | Comparisons | ⚠️ HIGH |

#### **QUOTATIONS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `exchange_rate` | DECIMAL(10,6) | Calculations | 🔴 CRITICAL |
| `subtotal` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `tax_amount` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `shipping_cost` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `discount_percent` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |
| `discount_amount` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `total_amount` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |

#### **QUOTATION_LINES Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `quantity` | DECIMAL(10,3) | Calculations | 🔴 CRITICAL |
| `unit_price` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `discount_percent` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |
| `discount_amount` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `tax_rate` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |
| `tax_amount` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `line_total` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |
| `cost_price` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |

#### **SALES_ORDERS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `subtotal` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `discount_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `tax_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `shipping_cost` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `installation_cost` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `total_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |

#### **SALES_ORDER_ITEMS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `quantity` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `unit_price` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `discount_percent` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |
| `discount_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `tax_rate` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |
| `tax_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `line_total` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |

#### **INVOICES Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `subtotal` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `discount_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `tax_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `shipping_cost` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `installation_cost` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `total_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `amount_paid` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `amount_due` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |

#### **INVOICE_ITEMS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `quantity` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `unit_price` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `discount_percent` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |
| `discount_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `tax_rate` | DECIMAL(5,2) | Calculations | 🔴 CRITICAL |
| `tax_amount` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |
| `line_total` | DECIMAL(10,2) | Calculations | 🔴 CRITICAL |

#### **INVENTORY_MOVEMENTS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `quantity` | DECIMAL(10,3) | Calculations | 🔴 CRITICAL |
| `quantity_before` | DECIMAL(10,3) | Display | ⚠️ MEDIUM |
| `quantity_after` | DECIMAL(10,3) | Display | ⚠️ MEDIUM |
| `unit_cost` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |

#### **CUSTOMIZATION_OPTIONS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `extra_cost` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |

#### **QUOTATION_SECTIONS Table**
| Column | Type | Usage | Risk Level |
|--------|------|-------|------------|
| `subtotal` | DECIMAL(12,2) | Calculations | 🔴 CRITICAL |

---

## Safe VARCHAR/TEXT Columns (No Risk)

These are correctly treated as strings:
- All `name`, `description`, `notes`, `code`, `sku` columns
- All `VARCHAR` address fields
- All `TEXT` fields
- All `status`, `type` enum-like VARCHAR fields
- All identifier strings like `order_number`, `invoice_number`, etc.

---

## Fixed Issues ✅

### 1. Products Stock Comparison (FIXED)
**File:** `/backend/src/routes/products-simple.ts` (lines 603-605)

```typescript
// ✅ FIXED - Now converts to numbers
stockQuantity: parseFloat(row.stock_quantity) || 0,
minStockLevel: parseFloat(row.min_stock_level) || 0,
maxStockLevel: parseFloat(row.max_stock_level) || 0,
```

**File:** `/frontend/src/pages/products/ProductManagement.tsx` (lines 328-331)

```typescript
// ✅ FIXED - Now converts to numbers
const stock = parseFloat(row.getValue('stockQuantity')) || 0
const product = row.original
const minStock = parseFloat(product.minStockLevel) || 0
const maxStock = parseFloat(product.maxStockLevel) || 0
```

**Bug Example:**
- Before: `"9.00" > "20.00"` = `true` (string comparison!)
- After: `9 > 20` = `false` ✅

---

## Recommended Fixes

### Strategy 1: Backend Conversion (RECOMMENDED)
Convert all DECIMAL values to numbers in the backend API response mapping.

**Example for quotations:**
```typescript
const mappedQuotations = result.rows.map(row => ({
  id: row.id,
  quotation_number: row.quotation_number,
  subtotal: parseFloat(row.subtotal) || 0,
  tax_amount: parseFloat(row.tax_amount) || 0,
  discount_amount: parseFloat(row.discount_amount) || 0,
  total_amount: parseFloat(row.total_amount) || 0,
  // ... other fields
}));
```

### Strategy 2: TypeScript Type Guards
Create utility functions for type-safe conversions:

```typescript
// utils/numberUtils.ts
export const toNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
};

export const toDecimal = (value: any, decimals: number = 2): number => {
  return Number(toNumber(value).toFixed(decimals));
};
```

### Strategy 3: Database Configuration (NOT RECOMMENDED)
You could configure `pg` to parse numerics as floats globally, but this risks precision loss:

```typescript
// DON'T DO THIS - Risks precision loss for large numbers
const types = require('pg').types;
types.setTypeParser(1700, 'text', parseFloat); // NUMERIC type
```

---

## Action Items

### 🔴 CRITICAL - Financial Calculations
Need immediate review in these files:

1. `/backend/src/routes/quotations.ts`
   - [ ] Convert all financial DECIMAL fields to numbers in response mapping
   - [ ] Check quotation line calculations

2. `/backend/src/routes/sales-orders.ts`
   - [ ] Convert all financial DECIMAL fields to numbers
   - [ ] Check order total calculations

3. `/backend/src/routes/invoices.ts`
   - [ ] Convert all financial DECIMAL fields to numbers
   - [ ] Check invoice amount calculations
   - [ ] Verify `amount_due` calculations

4. `/backend/src/routes/inventory.routes.ts`
   - [ ] Convert quantity and cost fields to numbers
   - [ ] Check stock movement calculations

### ⚠️ HIGH - Comparison Operations
Need review in these areas:

5. Materials stock management
   - [ ] Review stock comparison logic similar to products

6. Contact credit limit checks
   - [ ] Ensure credit limit comparisons use numbers

### 💡 LOW - Display Only
Less urgent but should be fixed:

7. Product dimensions display
8. Weight and capacity display
9. Custom cost calculations

---

## Testing Checklist

After implementing fixes, test:

- [ ] Product stock status badges (out of stock, low, normal, overstock)
- [ ] Quotation total calculations
- [ ] Sales order total calculations
- [ ] Invoice amount calculations
- [ ] Invoice payment status (paid vs due)
- [ ] Stock movement quantity calculations
- [ ] Material stock comparisons
- [ ] Credit limit validations
- [ ] Price comparisons and sorting
- [ ] Discount calculations
- [ ] Tax calculations

---

## Prevention

Going forward:

1. **Always use `parseFloat()` or `Number()` when reading DECIMAL columns from PostgreSQL**
2. **Add TypeScript interfaces that explicitly type financial fields as `number`**
3. **Use utility functions like `toNumber()` consistently**
4. **Add unit tests for numeric comparisons**
5. **Document in code comments when DECIMAL columns are involved**

---

## Reference

- PostgreSQL node-postgres driver: https://node-postgres.com/features/types
- JavaScript Number precision: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number
