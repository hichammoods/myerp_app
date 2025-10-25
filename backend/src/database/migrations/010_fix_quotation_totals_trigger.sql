-- Migration: Fix calculate_quotation_totals trigger to include installation_cost
-- Version: 010
-- Description: The trigger was missing installation_cost in total_amount calculation

-- Drop and recreate the trigger function with the fix
CREATE OR REPLACE FUNCTION calculate_quotation_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(12,2);
    v_tax_total DECIMAL(12,2);
    v_discount_total DECIMAL(12,2);
BEGIN
    -- Calculate subtotal, tax, and discount from lines
    SELECT
        COALESCE(SUM(quantity * unit_price), 0),
        COALESCE(SUM(tax_amount), 0),
        COALESCE(SUM(discount_amount), 0)
    INTO v_subtotal, v_tax_total, v_discount_total
    FROM quotation_lines
    WHERE quotation_id = COALESCE(NEW.quotation_id, OLD.quotation_id);

    -- Update quotation totals (FIX: Added installation_cost to the formula)
    UPDATE quotations
    SET
        subtotal = v_subtotal,
        tax_amount = v_tax_total,
        discount_amount = v_discount_total + (v_subtotal * discount_percent / 100),
        total_amount = v_subtotal + v_tax_total + shipping_cost + installation_cost - (v_discount_total + (v_subtotal * discount_percent / 100))
    WHERE id = COALESCE(NEW.quotation_id, OLD.quotation_id);

    -- Update section subtotals if applicable
    IF NEW.section_id IS NOT NULL THEN
        UPDATE quotation_sections
        SET subtotal = (
            SELECT COALESCE(SUM(line_total), 0)
            FROM quotation_lines
            WHERE section_id = NEW.section_id
        )
        WHERE id = NEW.section_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment to document the fix
COMMENT ON FUNCTION calculate_quotation_totals() IS 'Trigger function to recalculate quotation totals from line items. Includes installation_cost and shipping_cost in total_amount calculation (fixed in migration 010).';
