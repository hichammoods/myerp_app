-- Migration: Fix calculate_quotation_totals trigger to respect include_tax flag
-- Version: 012
-- Description: The trigger was always adding tax_amount, even when include_tax is false

-- Drop and recreate the trigger function with include_tax support
CREATE OR REPLACE FUNCTION calculate_quotation_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(12,2);
    v_tax_total DECIMAL(12,2);
BEGIN
    -- Calculate subtotal and tax from line_total (which already includes line discounts)
    SELECT
        COALESCE(SUM(line_total), 0),
        COALESCE(SUM(tax_amount), 0)
    INTO v_subtotal, v_tax_total
    FROM quotation_lines
    WHERE quotation_id = COALESCE(NEW.quotation_id, OLD.quotation_id);

    -- Update quotation totals
    -- Global discount is applied to v_subtotal (which is sum of discounted line_totals)
    -- Tax is only added if include_tax is true
    UPDATE quotations
    SET
        subtotal = v_subtotal,
        tax_amount = v_tax_total,
        discount_amount = v_subtotal * (discount_percent / 100),
        total_amount = v_subtotal
            - (v_subtotal * discount_percent / 100)
            + shipping_cost
            + installation_cost
            + CASE WHEN include_tax THEN tax_amount ELSE 0 END
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
COMMENT ON FUNCTION calculate_quotation_totals() IS 'Trigger function to recalculate quotation totals from line items. Respects include_tax flag to conditionally add tax. Fixed in migration 012.';
