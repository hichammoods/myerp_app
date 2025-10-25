-- Migration: Fix calculate_quotation_totals trigger tax calculation
-- Version: 014
-- Description: Calculate tax on FINAL amount (after discount + shipping + installation) using global tax_rate

-- Drop and recreate the trigger function with correct tax calculation
CREATE OR REPLACE FUNCTION calculate_quotation_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_subtotal DECIMAL(12,2);
    v_tax_total DECIMAL(12,2);
    v_discount_amount DECIMAL(12,2);
    v_base_for_tax DECIMAL(12,2);
    v_tax_rate DECIMAL(5,2);
    v_include_tax BOOLEAN;
BEGIN
    -- Calculate subtotal from line_total (which already includes line discounts)
    SELECT
        COALESCE(SUM(line_total), 0)
    INTO v_subtotal
    FROM quotation_lines
    WHERE quotation_id = COALESCE(NEW.quotation_id, OLD.quotation_id);

    -- Get tax_rate and include_tax from quotation
    SELECT tax_rate, include_tax
    INTO v_tax_rate, v_include_tax
    FROM quotations
    WHERE id = COALESCE(NEW.quotation_id, OLD.quotation_id);

    -- Update quotation totals
    -- Global discount is applied to v_subtotal (which is sum of discounted line_totals)
    UPDATE quotations
    SET
        subtotal = v_subtotal,
        discount_amount = v_subtotal * (discount_percent / 100),
        -- Calculate tax on FINAL amount (after discount + shipping + installation)
        tax_amount = CASE
            WHEN include_tax THEN
                ROUND(((v_subtotal - (v_subtotal * discount_percent / 100) + shipping_cost + installation_cost) * tax_rate / 100)::numeric, 2)
            ELSE 0
        END,
        total_amount = v_subtotal
            - (v_subtotal * discount_percent / 100)
            + shipping_cost
            + installation_cost
            + CASE
                WHEN include_tax THEN
                    ROUND(((v_subtotal - (v_subtotal * discount_percent / 100) + shipping_cost + installation_cost) * tax_rate / 100)::numeric, 2)
                ELSE 0
            END
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
COMMENT ON FUNCTION calculate_quotation_totals() IS 'Trigger function to recalculate quotation totals from line items. Tax is calculated on final amount (after all discounts + shipping + installation) using quotations.tax_rate. Fixed in migration 014.';
