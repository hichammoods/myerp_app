--
-- PostgreSQL database dump
--

\restrict UnTq4yGcL6qof1V4nUVErV2k8XX9qlHCClrfJGb3FPrWfkGtEoAL5ZjdURujkk8

-- Dumped from database version 15.14
-- Dumped by pg_dump version 15.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: calculate_invoice_amount_due(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.calculate_invoice_amount_due() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.amount_due := NEW.total_amount - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_invoice_amount_due() OWNER TO myerp;

--
-- Name: calculate_quotation_totals(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.calculate_quotation_totals() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.calculate_quotation_totals() OWNER TO myerp;

--
-- Name: FUNCTION calculate_quotation_totals(); Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON FUNCTION public.calculate_quotation_totals() IS 'Trigger function to recalculate quotation totals from line items. Tax is calculated on final amount (after all discounts + shipping + installation) using quotations.tax_rate. Fixed in migration 014.';


--
-- Name: check_invoice_overdue(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.check_invoice_overdue() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'envoyee' AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'en_retard';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_invoice_overdue() OWNER TO myerp;

--
-- Name: generate_contact_code(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.generate_contact_code() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    new_code VARCHAR;
BEGIN
    new_code := 'CNT-' || LPAD(NEXTVAL('contact_code_seq')::TEXT, 6, '0');
    RETURN new_code;
END;
$$;


ALTER FUNCTION public.generate_contact_code() OWNER TO myerp;

--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.generate_invoice_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  -- Get current year
  SELECT COUNT(*) + 1 INTO counter
  FROM invoices
  WHERE EXTRACT(YEAR FROM invoice_date) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Format: FACT-YYYY-XXXX (e.g., FACT-2025-0001)
  new_number := 'FACT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(counter::TEXT, 4, '0');

  RETURN new_number;
END;
$$;


ALTER FUNCTION public.generate_invoice_number() OWNER TO myerp;

--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.generate_order_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  new_number TEXT;
  counter INTEGER;
BEGIN
  -- Get current year
  SELECT COUNT(*) + 1 INTO counter
  FROM sales_orders
  WHERE EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Format: CMD-YYYY-XXXX (e.g., CMD-2025-0001)
  new_number := 'CMD-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(counter::TEXT, 4, '0');

  RETURN new_number;
END;
$$;


ALTER FUNCTION public.generate_order_number() OWNER TO myerp;

--
-- Name: generate_quotation_number(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.generate_quotation_number() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    year_month VARCHAR;
    seq_num INTEGER;
BEGIN
    year_month := TO_CHAR(CURRENT_DATE, 'YYYYMM');
    seq_num := NEXTVAL('quotation_number_seq');
    RETURN 'QT-' || year_month || '-' || LPAD(seq_num::TEXT, 5, '0');
END;
$$;


ALTER FUNCTION public.generate_quotation_number() OWNER TO myerp;

--
-- Name: set_contact_code(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.set_contact_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.contact_code IS NULL THEN
        NEW.contact_code := generate_contact_code();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_contact_code() OWNER TO myerp;

--
-- Name: set_invoice_number(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.set_invoice_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_invoice_number() OWNER TO myerp;

--
-- Name: set_order_number(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.set_order_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_order_number() OWNER TO myerp;

--
-- Name: set_quotation_number(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.set_quotation_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.quotation_number IS NULL THEN
        NEW.quotation_number := generate_quotation_number();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_quotation_number() OWNER TO myerp;

--
-- Name: update_invoice_updated_at(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.update_invoice_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_invoice_updated_at() OWNER TO myerp;

--
-- Name: update_sales_order_updated_at(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.update_sales_order_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_sales_order_updated_at() OWNER TO myerp;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: myerp
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO myerp;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100) NOT NULL,
    parent_id uuid,
    description text,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.categories OWNER TO myerp;

--
-- Name: company_settings; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.company_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    address character varying(500),
    city character varying(100),
    postal_code character varying(20),
    country character varying(100) DEFAULT 'France'::character varying,
    phone character varying(50),
    email character varying(255),
    website character varying(255),
    siret character varying(50),
    tva character varying(50),
    logo_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.company_settings OWNER TO myerp;

--
-- Name: TABLE company_settings; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON TABLE public.company_settings IS 'Company information used in PDF generation and quotations';


--
-- Name: contact_code_seq; Type: SEQUENCE; Schema: public; Owner: myerp
--

CREATE SEQUENCE public.contact_code_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.contact_code_seq OWNER TO myerp;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contact_code character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(20),
    mobile character varying(20),
    company_name character varying(200),
    job_title character varying(100),
    address_street character varying(200),
    address_city character varying(100),
    address_state character varying(100),
    address_zip character varying(20),
    address_country character varying(100),
    tax_id character varying(50),
    customer_type character varying(20) DEFAULT 'individual'::character varying,
    credit_limit numeric(12,2) DEFAULT 0,
    payment_terms integer DEFAULT 30,
    notes text,
    tags text[],
    assigned_to uuid,
    created_by uuid,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    type character varying(20) DEFAULT 'client'::character varying,
    discount_rate numeric(5,2) DEFAULT 0,
    CONSTRAINT contacts_customer_type_check CHECK (((customer_type)::text = ANY ((ARRAY['individual'::character varying, 'company'::character varying])::text[]))),
    CONSTRAINT contacts_type_check CHECK (((type)::text = ANY ((ARRAY['client'::character varying, 'supplier'::character varying, 'partner'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.contacts OWNER TO myerp;

--
-- Name: COLUMN contacts.customer_type; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.contacts.customer_type IS 'Legal entity type: individual or company';


--
-- Name: COLUMN contacts.type; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.contacts.type IS 'Business relationship type: client, supplier, partner, or other';


--
-- Name: COLUMN contacts.discount_rate; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.contacts.discount_rate IS 'Discount rate percentage for this contact';


--
-- Name: customization_options; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.customization_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customization_id uuid,
    material_id uuid,
    finish_id uuid,
    option_name character varying(100) NOT NULL,
    option_value character varying(200),
    extra_cost numeric(12,2) DEFAULT 0,
    extra_production_days integer DEFAULT 0,
    is_default boolean DEFAULT false,
    is_available boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customization_options OWNER TO myerp;

--
-- Name: finishes; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.finishes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50),
    code character varying(50),
    hex_color character varying(7),
    image_url character varying(500),
    extra_cost numeric(12,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT finishes_type_check CHECK (((type)::text = ANY ((ARRAY['couleur'::character varying, 'finition_bois'::character varying, 'motif_tissu'::character varying, 'finition_metal'::character varying])::text[])))
);


ALTER TABLE public.finishes OWNER TO myerp;

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    movement_type character varying(20) NOT NULL,
    quantity numeric(10,3) NOT NULL,
    quantity_before numeric(10,3),
    quantity_after numeric(10,3),
    unit_cost numeric(12,2),
    reference_type character varying(50),
    reference_id uuid,
    reference_number character varying(100),
    location_from character varying(100),
    location_to character varying(100),
    reason character varying(200),
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    material_id uuid,
    CONSTRAINT check_product_or_material CHECK ((((product_id IS NOT NULL) AND (material_id IS NULL)) OR ((product_id IS NULL) AND (material_id IS NOT NULL)))),
    CONSTRAINT inventory_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['in'::character varying, 'out'::character varying, 'adjustment'::character varying, 'transfer'::character varying, 'return'::character varying])::text[])))
);


ALTER TABLE public.inventory_movements OWNER TO myerp;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid,
    product_name character varying(255) NOT NULL,
    product_sku character varying(100),
    description text,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 20,
    tax_amount numeric(10,2) DEFAULT 0,
    line_total numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT invoice_items_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))),
    CONSTRAINT invoice_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT invoice_items_tax_rate_check CHECK ((tax_rate >= (0)::numeric))
);


ALTER TABLE public.invoice_items OWNER TO myerp;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    sales_order_id uuid NOT NULL,
    quotation_id uuid,
    contact_id uuid NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE,
    due_date date,
    payment_date date,
    status character varying(50) DEFAULT 'brouillon'::character varying,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    shipping_cost numeric(10,2) DEFAULT 0,
    installation_cost numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0,
    amount_due numeric(10,2) DEFAULT 0,
    payment_terms character varying(100) DEFAULT '30 jours'::character varying,
    payment_method character varying(50),
    payment_reference character varying(100),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.invoices OWNER TO myerp;

--
-- Name: materials; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    code character varying(50),
    description text,
    cost_per_unit numeric(12,2),
    unit_of_measure character varying(20),
    supplier_id uuid,
    stock_quantity numeric(10,2) DEFAULT 0,
    min_stock_level numeric(10,2) DEFAULT 0,
    lead_time_days integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    supplier text,
    CONSTRAINT materials_type_check CHECK (((type)::text = ANY ((ARRAY['bois'::character varying, 'tissu'::character varying, 'cuir'::character varying, 'metal'::character varying, 'mousse'::character varying, 'verre'::character varying, 'plastique'::character varying, 'autre'::character varying])::text[])))
);


ALTER TABLE public.materials OWNER TO myerp;

--
-- Name: product_components; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.product_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_product_id uuid,
    component_product_id uuid,
    component_name character varying(100),
    quantity integer DEFAULT 1,
    is_optional boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.product_components OWNER TO myerp;

--
-- Name: product_customizations; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.product_customizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    customization_type character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_required boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT product_customizations_customization_type_check CHECK (((customization_type)::text = ANY ((ARRAY['materiau'::character varying, 'finition'::character varying, 'dimensions'::character varying, 'couleur'::character varying, 'tissu'::character varying, 'option'::character varying])::text[])))
);


ALTER TABLE public.product_customizations OWNER TO myerp;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.product_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    image_url character varying(500) NOT NULL,
    thumbnail_url character varying(500),
    display_order integer DEFAULT 0,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.product_images OWNER TO myerp;

--
-- Name: product_materials; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.product_materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    material_id uuid NOT NULL,
    finish_id uuid,
    part_name character varying(100) NOT NULL,
    part_description text,
    quantity numeric(10,3),
    unit_of_measure character varying(20),
    "position" integer DEFAULT 0,
    extra_cost numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.product_materials OWNER TO myerp;

--
-- Name: TABLE product_materials; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON TABLE public.product_materials IS 'Junction table linking products with their materials and finishes for each part';


--
-- Name: COLUMN product_materials.part_name; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.product_materials.part_name IS 'Name of the product part (e.g., seat, backrest, frame)';


--
-- Name: COLUMN product_materials.quantity; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.product_materials.quantity IS 'Amount of material used for this part';


--
-- Name: COLUMN product_materials.extra_cost; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.product_materials.extra_cost IS 'Additional cost for this specific material-finish combination';


--
-- Name: products; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sku character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    category_id uuid,
    unit_price numeric(12,2) NOT NULL,
    cost_price numeric(12,2),
    stock_quantity numeric(10,2) DEFAULT 0,
    reserved_quantity numeric(10,2) DEFAULT 0,
    min_stock_level numeric(10,2) DEFAULT 0,
    max_stock_level numeric(10,2),
    unit_of_measure character varying(20) DEFAULT 'piece'::character varying,
    weight numeric(8,3),
    dimensions_length numeric(8,2),
    dimensions_width numeric(8,2),
    dimensions_height numeric(8,2),
    tax_rate numeric(5,2) DEFAULT 0,
    barcode character varying(100),
    supplier_id uuid,
    lead_time_days integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_service boolean DEFAULT false,
    track_inventory boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    allows_custom_materials boolean DEFAULT true,
    images jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.products OWNER TO myerp;

--
-- Name: COLUMN products.images; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.products.images IS 'Array of image objects stored as JSONB. Each object contains: url, filename, originalName, mimeType, size, isMain, uploadedAt';


--
-- Name: quotation_attachments; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.quotation_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid,
    file_name character varying(255) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_size integer,
    mime_type character varying(100),
    uploaded_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quotation_attachments OWNER TO myerp;

--
-- Name: quotation_lines; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.quotation_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid,
    product_id uuid,
    section_id uuid,
    line_number integer NOT NULL,
    product_sku character varying(100),
    product_name character varying(200) NOT NULL,
    description text,
    quantity numeric(10,3) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    line_total numeric(12,2) NOT NULL,
    cost_price numeric(12,2),
    notes text,
    is_optional boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quotation_lines OWNER TO myerp;

--
-- Name: quotation_number_seq; Type: SEQUENCE; Schema: public; Owner: myerp
--

CREATE SEQUENCE public.quotation_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quotation_number_seq OWNER TO myerp;

--
-- Name: quotation_sections; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.quotation_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid,
    name character varying(200) NOT NULL,
    description text,
    display_order integer DEFAULT 0,
    subtotal numeric(12,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quotation_sections OWNER TO myerp;

--
-- Name: quotations; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_number character varying(50) NOT NULL,
    contact_id uuid,
    sales_rep_id uuid,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    expiration_date date,
    delivery_date date,
    payment_terms character varying(200),
    delivery_terms character varying(200),
    shipping_method character varying(100),
    currency character varying(3) DEFAULT 'USD'::character varying,
    exchange_rate numeric(10,6) DEFAULT 1,
    subtotal numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    shipping_cost numeric(12,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    notes text,
    internal_notes text,
    terms_conditions text,
    reference_number character varying(100),
    version integer DEFAULT 1,
    parent_quotation_id uuid,
    sent_at timestamp without time zone,
    viewed_at timestamp without time zone,
    accepted_at timestamp without time zone,
    rejected_at timestamp without time zone,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    delivery_address text,
    installation_cost numeric(12,2) DEFAULT 0,
    installation_included boolean DEFAULT false,
    include_tax boolean DEFAULT true,
    tax_rate numeric(5,2) DEFAULT 20.00,
    sales_order_id uuid,
    converted_to_order_at timestamp without time zone,
    CONSTRAINT quotations_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'expired'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.quotations OWNER TO myerp;

--
-- Name: COLUMN quotations.internal_notes; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.internal_notes IS 'Internal notes not visible to customer';


--
-- Name: COLUMN quotations.delivery_address; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.delivery_address IS 'Delivery address for this specific quotation (can differ from contact address)';


--
-- Name: COLUMN quotations.installation_cost; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.installation_cost IS 'Cost of installation service';


--
-- Name: COLUMN quotations.installation_included; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.installation_included IS 'Whether installation is included in the quotation';


--
-- Name: COLUMN quotations.include_tax; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.include_tax IS 'Whether tax should be included in the total amount (false for individuals, true for companies)';


--
-- Name: COLUMN quotations.tax_rate; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.tax_rate IS 'Global tax rate for the quotation (percentage). Applied to final amount (after discounts + shipping + installation) when include_tax is true.';


--
-- Name: COLUMN quotations.sales_order_id; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.sales_order_id IS 'Reference to the sales order created from this quotation';


--
-- Name: COLUMN quotations.converted_to_order_at; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.quotations.converted_to_order_at IS 'Timestamp when quotation was converted to a sales order';


--
-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.sales_order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sales_order_id uuid NOT NULL,
    product_id uuid,
    product_name character varying(255) NOT NULL,
    product_sku character varying(100),
    description text,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 20,
    tax_amount numeric(10,2) DEFAULT 0,
    line_total numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sales_order_items_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))),
    CONSTRAINT sales_order_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT sales_order_items_tax_rate_check CHECK ((tax_rate >= (0)::numeric))
);


ALTER TABLE public.sales_order_items OWNER TO myerp;

--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.sales_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_number character varying(50) NOT NULL,
    quotation_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    order_date date DEFAULT CURRENT_DATE,
    expected_delivery_date date,
    shipped_date date,
    delivered_date date,
    status character varying(50) DEFAULT 'en_cours'::character varying,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    shipping_cost numeric(10,2) DEFAULT 0,
    installation_cost numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    delivery_address text,
    tracking_number character varying(100),
    invoice_id uuid,
    notes text,
    payment_terms character varying(100) DEFAULT '30 jours'::character varying,
    delivery_terms character varying(255) DEFAULT '2-4 semaines'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    down_payment_amount numeric(10,2) DEFAULT 0,
    down_payment_method character varying(50),
    down_payment_date date,
    down_payment_notes text,
    CONSTRAINT sales_orders_down_payment_amount_check CHECK ((down_payment_amount >= (0)::numeric))
);


ALTER TABLE public.sales_orders OWNER TO myerp;

--
-- Name: COLUMN sales_orders.down_payment_amount; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.sales_orders.down_payment_amount IS 'Montant de l''acompte versé à la commande';


--
-- Name: COLUMN sales_orders.down_payment_method; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.sales_orders.down_payment_method IS 'Mode de paiement de l''acompte: especes, carte, virement, cheque';


--
-- Name: COLUMN sales_orders.down_payment_date; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.sales_orders.down_payment_date IS 'Date de versement de l''acompte';


--
-- Name: COLUMN sales_orders.down_payment_notes; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.sales_orders.down_payment_notes IS 'Notes sur le paiement de l''acompte';


--
-- Name: users; Type: TABLE; Schema: public; Owner: myerp
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    role character varying(20) DEFAULT 'sales'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    phone character varying(20),
    avatar_url character varying(500),
    last_login timestamp without time zone,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    password_reset_token character varying(255),
    password_reset_expires timestamp without time zone,
    email_verified boolean DEFAULT false,
    email_verification_token character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp without time zone,
    suspended boolean DEFAULT false,
    suspended_at timestamp without time zone,
    suspended_by uuid,
    must_change_password boolean DEFAULT false,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'sales'::character varying, 'inventory_manager'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO myerp;

--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.users.role IS 'User role: admin (full access), sales (no params, no delete), inventory_manager (products/stock only)';


--
-- Name: COLUMN users.is_active; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.users.is_active IS 'Soft delete flag - false means user is deleted';


--
-- Name: COLUMN users.suspended; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.users.suspended IS 'Temporary suspension by admin - true means user cannot log in';


--
-- Name: COLUMN users.must_change_password; Type: COMMENT; Schema: public; Owner: myerp
--

COMMENT ON COLUMN public.users.must_change_password IS 'Forces user to change password on next login';


--
-- Name: v_product_availability; Type: VIEW; Schema: public; Owner: myerp
--

CREATE VIEW public.v_product_availability AS
 SELECT p.id,
    p.sku,
    p.name,
    p.stock_quantity,
    p.reserved_quantity,
    (p.stock_quantity - p.reserved_quantity) AS available_quantity,
    p.min_stock_level,
        CASE
            WHEN ((p.stock_quantity - p.reserved_quantity) <= (0)::numeric) THEN 'out_of_stock'::text
            WHEN ((p.stock_quantity - p.reserved_quantity) <= p.min_stock_level) THEN 'low_stock'::text
            ELSE 'in_stock'::text
        END AS stock_status
   FROM public.products p
  WHERE ((p.is_active = true) AND (p.track_inventory = true) AND (p.deleted_at IS NULL));


ALTER TABLE public.v_product_availability OWNER TO myerp;

--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.categories (id, name, slug, parent_id, description, display_order, is_active, created_at, updated_at) FROM stdin;
abdb568d-e6d6-46d0-b422-b23caea8a37c	Services	services	\N	Service items	2	t	2025-10-23 17:14:28.31714	2025-10-23 17:14:28.31714
b163e738-ffed-4b05-9f7e-ef16355679a0	Hardware	hardware	\N	Hardware products	3	t	2025-10-23 17:14:28.31714	2025-10-23 17:14:28.31714
3869bcbb-7cde-46c5-bd21-c9d7beef6f47	Software	software	\N	Software products	4	t	2025-10-23 17:14:28.31714	2025-10-23 17:14:28.31714
4b4eff05-5dae-4bfa-a493-012197855373	Chambre	chambre	\N	Lits, armoires, commodes et tables de chevet	2	t	2025-10-23 17:14:28.379373	2025-10-23 17:14:28.379373
88bf7657-d151-4f3d-a5ec-a05a52c830bb	Salle à manger	salle-a-manger	\N	Tables à manger, chaises et buffets	3	t	2025-10-23 17:14:28.379373	2025-10-23 17:14:28.379373
bd3e25ff-afd6-426a-90bf-066a721aa8c1	Bureau	bureau	\N	Bureaux, fauteuils de bureau et rangements	4	t	2025-10-23 17:14:28.379373	2025-10-23 17:14:28.379373
e646e91f-8110-4d91-b9f3-9e7c70cee480	Rangement	rangement	\N	Armoires, étagères et organisateurs	5	t	2025-10-23 17:14:28.379373	2025-10-23 17:14:28.379373
83137abe-fe9c-4a4f-9a11-a8fbb2ac9661	Extérieur	exterieur	\N	Mobilier de jardin et terrasse	6	t	2025-10-23 17:14:28.379373	2025-10-23 17:14:28.379373
5ba8fe9f-4dbc-4677-a40f-50e4f3136a86	Entrée	entree	\N	Consoles, porte-manteaux et meubles à chaussures	7	t	2025-10-23 17:14:28.379373	2025-10-23 17:14:28.379373
01f1a8ef-89d2-43ec-b842-615cf3047094	Salle de bain	salle-de-bain	\N	Meubles vasques, colonnes et miroirs	8	t	2025-10-23 17:14:28.379373	2025-10-23 17:14:28.379373
5c9111c2-cfc4-4217-99c4-a939ce04f692	Fauteuils	fauteuils	c5779917-6518-4461-b845-bd8bd45d4b44	\N	2	t	2025-10-23 17:14:28.380242	2025-10-23 17:14:28.380242
7fb3efb9-3f71-477f-a36c-0ea81c0606af	Tables basses	tables-basses	c5779917-6518-4461-b845-bd8bd45d4b44	\N	3	t	2025-10-23 17:14:28.380505	2025-10-23 17:14:28.380505
64bb12f7-f2e9-435e-8f63-d8d76c3fca5f	Meubles TV	meubles-tv	c5779917-6518-4461-b845-bd8bd45d4b44	\N	4	t	2025-10-23 17:14:28.380819	2025-10-23 17:14:28.380819
3382583c-0a44-479f-a1be-0a6de5a6bd6b	Armoires	armoires	4b4eff05-5dae-4bfa-a493-012197855373	\N	2	t	2025-10-23 17:14:28.381369	2025-10-23 17:14:28.381369
daaf4a5d-5e11-4555-b511-a27a93a0fc72	Commodes	commodes	4b4eff05-5dae-4bfa-a493-012197855373	\N	3	t	2025-10-23 17:14:28.381666	2025-10-23 17:14:28.381666
e72d0bde-6798-4d89-a9b5-a1407504e6ff	Tables de chevet	tables-de-chevet	4b4eff05-5dae-4bfa-a493-012197855373	\N	4	t	2025-10-23 17:14:28.381898	2025-10-23 17:14:28.381898
122419ea-f26a-4ad1-93d3-0f63e228f6d4	Chaises	chaises	88bf7657-d151-4f3d-a5ec-a05a52c830bb	\N	2	t	2025-10-23 17:14:28.382376	2025-10-23 17:14:28.382376
efe92fb2-1f1e-4414-8c89-ed889cfd72ce	Buffets	buffets	88bf7657-d151-4f3d-a5ec-a05a52c830bb	\N	3	t	2025-10-23 17:14:28.382823	2025-10-23 17:14:28.382823
bb10caa6-a673-4da5-94e7-4a89a384412d	Canapés	canapes	\N	\N	1	t	2025-10-23 17:14:28.37984	2025-10-23 22:03:42.606283
7e735925-e34a-45e6-9f6f-b6dadcec0bd7	General	general	\N	General products	1	t	2025-10-23 17:14:28.31714	2025-10-23 22:03:57.569731
45bbf2ef-086a-4b16-a172-c607b436c124	Lits	lits	\N	dfdfdf	1	t	2025-10-23 17:14:28.381041	2025-10-23 22:04:01.191152
c5779917-6518-4461-b845-bd8bd45d4b44	Salon	salon	\N	Canapés, tables basses, meubles TV et plus	1	t	2025-10-23 17:14:28.379373	2025-10-23 22:04:04.025636
5213ddbc-28a5-45c2-9674-9d891335b19c	Tables à manger	tables-a-manger	\N	\N	1	t	2025-10-23 17:14:28.382142	2025-10-23 22:04:06.664505
\.


--
-- Data for Name: company_settings; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.company_settings (id, name, address, city, postal_code, country, phone, email, website, siret, tva, logo_url, created_at, updated_at) FROM stdin;
be52a0b1-ba02-47b6-9364-cfb0a4c8ff12	Madeco Design	9-11 Bd Voltaire	Asnières-sur-Seine	92600	France	+33 1 23 45 67 89	madecodesign@gmail.fr	www.myerp-furniture.fr	123 456 789 00012	FR 12 345678900	\N	2025-10-24 22:54:09.26836	2025-10-24 22:58:28.802653
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.contacts (id, contact_code, first_name, last_name, email, phone, mobile, company_name, job_title, address_street, address_city, address_state, address_zip, address_country, tax_id, customer_type, credit_limit, payment_terms, notes, tags, assigned_to, created_by, is_active, created_at, updated_at, deleted_at, type, discount_rate) FROM stdin;
10e321b7-9f80-4135-b5dd-26e0b6f39a29	CNT-001008	TEST	TEST	hicham.moudddddddi15@gmail.com	+33652644282				15 RUE DE TOCQUEVILLE	PARIS		75017	France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f	2025-10-26 18:12:52.6452	2025-10-26 20:12:33.554597	\N	client	0.00
21d9c57c-161c-415a-a93f-c2744fbddc75	CNT-001002	ihssane	ihssane hadi	themoods.eth@gmail.com					6, Rue Paul Bert	Courbevoie		92400	France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f	2025-10-24 17:35:17.364707	2025-10-24 19:17:26.227832	\N	client	0.00
74050e5e-abd9-471f-b094-edf6548628bb	CNT-001004	SSSS	SSS	hicham.mouddsdzddi@ubudu.com	+33663886949		HSHHS		Av. Clément Ader	Tarnos		40220	France	877282233	company	10000.00	30		{test}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-24 18:58:42.595359	2025-10-24 19:19:33.424368	\N	supplier	10.00
bc184682-e4b9-4626-ab4a-6baade9e8e43	CNT-001003	Hicham	Hicham MOUDDI	hicham.mouddi@gmaol.com			HEAD OF CUSTOMER SUCCESS		29 boulevard Richard Wallace	92800 - PUTEAUX		92800	France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-24 18:08:50.542042	2025-10-24 19:19:39.551386	\N	client	0.00
65b0d783-b810-4c71-b743-a5fb1df4d5b1	CNT-001001	Lamia	Boussif	lamia.boussif@gmail.com	+33652644282				12 rue de l'abbé carton	75014 - PARIS 14		75014	France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-24 17:24:18.284961	2025-10-25 11:13:40.727822	\N	client	0.00
21eb838f-d20d-4c26-b840-24afd73d05ab	CNT-001010	Hicham	Hicham Mouddi	hicham.mouddi@ubudu.com									France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f	2025-10-26 20:13:19.89285	2025-10-26 20:13:30.629247	\N	client	0.00
11be7729-c0f2-4930-9047-f84d1082cd90	CNT-001011	Lamia	Lamia Boussif	hicham.moudsssssdi15@gmail.com									France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f	2025-10-26 20:13:46.702051	2025-10-26 20:13:54.130827	\N	client	0.00
debee6f7-e682-4599-9fee-a893be9e6a9d	CNT-001006	Salma	Boussif	salma@gmail.com	+33652644282				43 rue saint vincent	Colombes		92700	France		individual	0.00	30	cliente exigente	{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-25 11:53:18.801654	2025-10-25 15:12:49.644991	\N	client	0.00
d3ca30c9-1eec-44aa-bdfe-a5e99b777a27	CNT-001005	Youssef	Mouddi	mouddi.youssef@gmail.com	+3272737823				5 rue georges collon	Bruxelles		82892	Belgique		company	0.00	30	client exigent qui a du gout	{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-25 11:07:23.23817	2025-10-25 15:12:54.721737	\N	client	0.00
0a9a757c-570e-4692-82d1-39b760f79bfd	CNT-001007	dddd	dddd	hicham.mouddi15@gmail.com	+33663886949		Ubudu		6 rue Paul bert	Courbevoie		92400	France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f	2025-10-26 18:10:39.440964	2025-10-26 18:10:57.704535	\N	client	0.00
2366fc2e-f0ff-4b93-b2e4-a33ce60fd6eb	CNT-001009	Gelassi	Amine	amine.gelassi@gmail.com	0686638611				5 rue hotel de ville	Neuilly Sur Seine		92200	France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-26 18:15:31.780224	2025-10-26 20:31:20.214788	\N	client	0.00
fd008f39-1f9c-4b1e-a4da-d5661121c557	CNT-001000	Test	Contact	test@example.com	+33123456789	\N	Test Company	\N	\N	\N	\N	\N	\N	\N	individual	0.00	30	\N	{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f	2025-10-24 17:14:01.324637	2025-10-26 21:11:41.289922	\N	client	0.00
1c57a944-2ed4-441a-8184-435114c45143	CNT-001012	francois 	kruta	hichamfffff.mouddi@ubudu.com									France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f	2025-10-26 21:12:45.92576	2025-10-26 21:12:58.097049	\N	client	0.00
5c2bf6d2-d351-453d-a9c1-2a89769502f3	CNT-001013	Leyla	Mouddi		0663886949	0663886949							France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-29 18:04:06.878973	2025-10-29 18:04:06.878973	\N	client	0.00
2d3dfb30-8cc6-479f-9a07-f30a160c19d1	CNT-001014	Salma	bebeb		0686638611	0686638611							France		individual	0.00	30		{}	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	t	2025-10-29 18:10:08.335032	2025-10-29 18:10:08.335032	\N	client	0.00
\.


--
-- Data for Name: customization_options; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.customization_options (id, customization_id, material_id, finish_id, option_name, option_value, extra_cost, extra_production_days, is_default, is_available, display_order, created_at) FROM stdin;
\.


--
-- Data for Name: finishes; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.finishes (id, name, type, code, hex_color, image_url, extra_cost, is_active, created_at) FROM stdin;
ccb23518-af28-45e0-8322-f822960077d8	Chêne naturel	finition_bois	FIN-CHENE-NAT	#D2691E	\N	0.00	t	2025-10-23 17:14:28.383807
3418be6d-a867-4e4b-a148-032d7a23e46c	Chêne blanchi	finition_bois	FIN-CHENE-BLA	#F5DEB3	\N	50.00	t	2025-10-23 17:14:28.383807
fe5e394c-d572-4b54-8c9a-87396ed0c8e5	Chêne fumé	finition_bois	FIN-CHENE-FUM	#8B4513	\N	75.00	t	2025-10-23 17:14:28.383807
0e3a38cd-9101-4d0e-a8eb-7c3a5230fb84	Noyer foncé	finition_bois	FIN-NOY-FON	#5D4E37	\N	100.00	t	2025-10-23 17:14:28.383807
3dc39571-378a-45ad-8865-000c2d18742f	Laqué blanc	finition_bois	FIN-LAQ-BLA	#FFFFFF	\N	80.00	t	2025-10-23 17:14:28.383807
9a3bdc90-9059-4a7d-9f8b-0d064a69f4f9	Laqué noir	finition_bois	FIN-LAQ-NOI	#000000	\N	80.00	t	2025-10-23 17:14:28.383807
8b04f353-d1ab-42ff-9e37-9d2bbdb65598	Gris anthracite	couleur	COL-ANTH	#36454F	\N	0.00	t	2025-10-23 17:14:28.383807
0c997b4c-7418-47d4-ae01-8360deaae622	Bleu marine	couleur	COL-MARINE	#000080	\N	0.00	t	2025-10-23 17:14:28.383807
63220c4c-6731-421e-a8d0-a390f2467854	Vert olive	couleur	COL-OLIVE	#708238	\N	0.00	t	2025-10-23 17:14:28.383807
0ad7d395-85e4-415e-8885-ca1ebe424537	Terracotta	couleur	COL-TERRA	#E2725B	\N	0.00	t	2025-10-23 17:14:28.383807
2056c5da-e90e-48f2-8a3f-27535cbf577c	Blanc cassé	couleur	COL-BLANC	#FFFDD0	\N	0.00	t	2025-10-23 17:14:28.383807
5b10c8ff-a2f4-4f8b-8fe4-975c83917225	Taupe	couleur	COL-TAUPE	#483C32	\N	0.00	t	2025-10-23 17:14:28.383807
3a318db9-d92b-473c-b7ae-c417c733cd35	Chrome	finition_metal	FIN-CHROME	#C0C0C0	\N	30.00	t	2025-10-23 17:14:28.383807
7856798b-935d-408b-af68-2f21eed5ce22	Noir mat	finition_metal	FIN-NOIR-MAT	#28282B	\N	20.00	t	2025-10-23 17:14:28.383807
0d31b389-31cd-4df5-b28f-81f69f3f8440	Laiton brossé	finition_metal	FIN-LAITON	#B87333	\N	50.00	t	2025-10-23 17:14:28.383807
4d0eb29f-86ec-472a-b840-705e84604720	Cuivre	finition_metal	FIN-CUIVRE	#B87333	\N	60.00	t	2025-10-23 17:14:28.383807
20eab6cc-e9e5-48d5-ba20-9b7eb18d1e14	WA_38354	couleur	WA_38354	#F54927	\N	3.00	t	2025-10-23 20:43:53.286755
217d7927-7af4-4b3c-b2b9-409c8330b22e	Beige	couleur	COL-BEIGE	#F5F5DC	\N	100.00	t	2025-10-23 17:14:28.383807
\.


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.inventory_movements (id, product_id, movement_type, quantity, quantity_before, quantity_after, unit_cost, reference_type, reference_id, reference_number, location_from, location_to, reason, notes, created_by, created_at, material_id) FROM stdin;
c7b104dc-6cad-438b-a4fd-53b98b263148	70ad5d7f-6ff7-424c-8c43-4b3184e71751	in	10.000	10.000	20.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 00:27:03.39511	\N
9ac6663d-0563-442b-bdf4-fbb47f3ad116	ceda19da-5cfd-4ab8-8ece-f1184fbdc1cb	in	5.000	10.000	15.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 10:36:06.569214	\N
2d0a605c-71c5-4323-af83-54186d62de85	0c258572-b2f8-40e0-a615-be10ffc97a42	in	10.000	20.000	30.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 11:05:14.188549	\N
aa7eed2d-9f19-4257-bef9-b7531fa6c602	2c4c36b6-ed21-4567-b6c5-abf181d1a47b	in	20.000	10.000	30.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 11:51:29.348236	\N
9e0a7bb6-f83b-4c66-97be-83e4f93ceee4	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:40:53.701287	42be9623-8f7d-4bc1-8433-72fd84e27d25
92fe3217-965c-456e-ace6-7de031f3707b	\N	in	60.000	0.000	60.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:43:09.593113	d7c45e80-d6c0-4a81-8619-7c2b1ab6cfb2
86d15d5e-eb50-4456-aba7-1014ae24af11	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:43:58.782244	a0fb8bf2-92ac-45ef-9076-44306443ec7e
de5fbd8c-1009-487c-8dc6-deca395fdb00	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:03.556215	fa02e401-4ffa-42bc-a872-7fd729f54368
91f91b83-f579-44e1-b160-10acefc56668	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:07.805425	48c7fe86-a522-4c5c-80ab-1c36c5f18805
7d609ebd-3487-4840-a55c-f0a2192b8828	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:12.36193	d10a2e09-be85-48d8-a3b2-743aedbbc9d5
6d86a1bb-06f5-4e13-bea0-2ffa92b4936c	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:16.910024	20dd9fde-057e-4dc2-89de-a497d6c81611
15639cf7-428c-4996-a1be-aa4fc1d11093	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:23.276378	4e7437bd-3eb0-4a3b-96fa-2efc7e32963d
d2467547-a85b-4426-83a9-1bccfcb90c1e	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:28.397309	9ba3685b-02c1-4f04-a0b9-f4df88570a47
c0634030-1453-43f5-a7b1-3c26d2ee9759	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:32.522632	729db50a-564e-4802-a4f8-05b28d63e884
5d7c232f-2cab-42d0-a7cc-1ed277e972eb	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:39.71616	8535b570-0521-45c8-baa5-881a88e1f3ff
c0e7e1de-9804-4ee6-96ff-de04f0ec31a1	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:43.011663	169ca409-d802-4c6d-af0b-6236a5603456
ad7bdd1c-4ed7-490e-a6eb-88868dd54b0c	\N	in	10.000	0.000	10.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:47.871928	ebdcccdf-ef6e-4aaf-a10a-ec47ea6efb35
32b26285-2945-4912-86a0-678897a8e4d8	\N	in	20.000	0.000	20.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:53.210141	1f9e7d4e-2d44-4ac9-a178-1fe5667d904d
53c7e8ca-06d2-4139-9bfb-5d69b86be35c	\N	in	30.000	0.000	30.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:44:57.241998	37225bce-8638-4044-a26a-fcf9be027370
673ecf19-036b-4cd6-b1ba-356406558120	\N	in	20.000	0.000	20.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:45:01.439166	2dcd6427-a9a8-4f77-99dd-5063ff40567b
4d4ef4a5-129a-4988-baaf-898689b62c5d	\N	in	20.000	0.000	20.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:45:06.457834	78b65edb-23ff-4d0e-a7ce-9fc2a2e020f7
c3941871-9f02-471a-a377-646a23d87817	\N	in	202.000	0.000	202.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:45:12.382621	44ba843b-5cb3-441b-b68f-2118cebff785
d7f490a8-dd95-4c8c-9fa1-aeac20f8cb23	\N	in	20.000	0.000	20.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:45:15.877643	a63f8bef-a05f-4e87-a8e0-b416a920c92f
080df20d-f056-48cd-8577-658b5983d994	2c4c36b6-ed21-4567-b6c5-abf181d1a47b	out	26.000	30.000	4.000	\N	\N	\N	\N	\N	\N	damage	\N	\N	2025-10-25 16:58:48.033803	\N
5c5fba5a-cb7e-4566-b57e-d14beba29a1b	2c4c36b6-ed21-4567-b6c5-abf181d1a47b	in	26.000	4.000	30.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 16:59:13.561181	\N
050c8248-2091-45e6-a17f-889d70ff3aac	9208c040-f472-4d72-9757-704059dd94a7	in	5.000	0.000	5.000	\N	\N	\N	\N	\N	\N	inventory	\N	\N	2025-10-25 17:46:03.055444	\N
c586260b-3e5d-4815-b0d2-f9acdbbc108e	81960025-04b0-447e-b83d-4e3fd04d4166	in	1.000	9.000	10.000	\N	\N	\N	CMD-2025-0002	\N	\N	Sales Order Cancelled	Retour suite annulation commande CMD-2025-0002 - test	\N	2025-10-25 21:06:44.664596	\N
81ffeda6-ec22-45ec-a7c3-88f3224c05a2	81960025-04b0-447e-b83d-4e3fd04d4166	out	1.000	10.000	9.000	\N	\N	\N	CMD-2025-0003	\N	\N	Sales Order	Sortie pour commande CMD-2025-0003 - test	\N	2025-10-25 21:12:48.770022	\N
c1ad86fa-9d4a-496e-8c40-2b38c3821a08	81960025-04b0-447e-b83d-4e3fd04d4166	out	-1.000	9.000	8.000	\N	\N	\N	CMD-2025-0005	\N	\N	Sales Order	Sortie pour commande CMD-2025-0005 - test	\N	2025-10-29 20:00:26.85567	\N
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.invoice_items (id, invoice_id, product_id, product_name, product_sku, description, quantity, unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total, created_at) FROM stdin;
939be578-2647-44bd-bde6-ad147f24acc5	16355cae-21c2-429b-aff0-48478da7e4dd	9208c040-f472-4d72-9757-704059dd94a7	test 232EE	DDDD		1.00	308.00	0.00	0.00	20.00	61.60	308.00	2025-10-25 19:47:16.134533
8c1b2314-3230-4b3f-bd6e-c6cc7db1cfcd	98dd4124-f78e-458a-b5fc-b5628a07abd3	81960025-04b0-447e-b83d-4e3fd04d4166	test	ddddddd		1.00	600.00	0.00	0.00	0.00	0.00	600.00	2025-10-25 21:18:13.838703
fc70d6c3-02d1-44fe-a66e-cd8938783562	be68bce0-76b6-4059-b581-f7853ba04360	\N	Canapé Minotti		- 250cm x 90cm (std)\n- Double accoudoir\n    - Tissus REF : GABRIELLA CREME\n- Grands coussins : forme valise\n     - Tissus : Tiffany 101\n- Petits coussins : 40cm x 40cm\n    - Tissus : Gabriella Aqua	1.00	1500.00	0.00	0.00	20.00	300.00	1500.00	2025-10-26 18:38:58.286989
49bc6245-d82b-43fd-9531-b0ccde7c77ab	910da070-a835-4df6-b805-18cd06967b83	81960025-04b0-447e-b83d-4e3fd04d4166	test	ddddddd		1.00	600.00	0.00	0.00	0.00	0.00	600.00	2025-10-29 20:01:17.394114
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.invoices (id, invoice_number, sales_order_id, quotation_id, contact_id, invoice_date, due_date, payment_date, status, subtotal, discount_amount, tax_amount, shipping_cost, installation_cost, total_amount, amount_paid, amount_due, payment_terms, payment_method, payment_reference, notes, created_at, updated_at) FROM stdin;
16355cae-21c2-429b-aff0-48478da7e4dd	FACT-2025-0001	f92b4caf-fecc-4e5c-a401-ebfe048bda1f	cbc0232b-9e92-4944-be27-15f07435f4d6	d3ca30c9-1eec-44aa-bdfe-a5e99b777a27	2025-10-25	2025-11-24	2025-10-25	payee	308.00	0.00	81.60	100.00	0.00	489.60	489.60	0.00	30	especes	\N		2025-10-25 19:47:16.134533	2025-10-25 19:48:09.974924
98dd4124-f78e-458a-b5fc-b5628a07abd3	FACT-2025-0002	8cb09fab-624a-4010-8801-8a0c6221ba7b	4f1c443f-c511-4487-a941-422fd7635fc3	debee6f7-e682-4599-9fee-a893be9e6a9d	2025-10-25	2025-11-24	2025-10-25	payee	600.00	120.00	0.00	0.00	0.00	480.00	480.00	0.00	30 jours	carte	\N		2025-10-25 21:18:13.838703	2025-10-25 21:24:56.12398
be68bce0-76b6-4059-b581-f7853ba04360	FACT-2025-0003	d9e43121-573a-4e17-8654-05483023c3a4	bb66c1ca-478b-46d6-86fd-0e5cd679a2ae	2366fc2e-f0ff-4b93-b2e4-a33ce60fd6eb	2025-10-26	2025-11-25	2025-10-26	payee	1500.00	0.00	0.00	250.00	0.00	1750.00	1750.00	0.00	30 jours	especes	\N		2025-10-26 18:38:58.286989	2025-10-26 18:40:28.89115
910da070-a835-4df6-b805-18cd06967b83	FACT-2025-0004	01bda4c1-0583-4c14-a166-ed88cf571046	de5fc385-8787-41bd-8359-52b8e6c9ffbf	2366fc2e-f0ff-4b93-b2e4-a33ce60fd6eb	2025-10-29	2025-11-28	2025-10-29	payee	600.00	0.00	0.00	0.00	0.00	600.00	300.00	300.00	30 jours	virement	\N		2025-10-29 20:01:17.394114	2025-10-29 20:06:13.337298
\.


--
-- Data for Name: materials; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.materials (id, name, type, code, description, cost_per_unit, unit_of_measure, supplier_id, stock_quantity, min_stock_level, lead_time_days, is_active, created_at, updated_at, supplier) FROM stdin;
42be9623-8f7d-4bc1-8433-72fd84e27d25	Acier	metal	MET-ACIER	Acier brossé	1.00	kg	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:40:53.701287	\N
d7c45e80-d6c0-4a81-8619-7c2b1ab6cfb2	Chêne massif	bois	BOIS-CHENE	Bois de chêne massif français	\N	m2	\N	60.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:43:09.593113	\N
a0fb8bf2-92ac-45ef-9076-44306443ec7e	Aluminium	metal	MET-ALU	Aluminium anodisé	\N	kg	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:43:58.782244	\N
fa02e401-4ffa-42bc-a872-7fd729f54368	Cuir aniline	cuir	CUIR-ANI-001	Cuir aniline premium	\N	m2	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:03.556215	\N
48c7fe86-a522-4c5c-80ab-1c36c5f18805	Cuir pleine fleur	cuir	CUIR-PF-001	Cuir de vachette pleine fleur	\N	m2	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:07.805425	\N
d10a2e09-be85-48d8-a3b2-743aedbbc9d5	Fer forgé	metal	MET-FER	Fer forgé artisanal	\N	kg	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:12.36193	\N
20dd9fde-057e-4dc2-89de-a497d6c81611	Hêtre massif	bois	BOIS-HETRE	Bois de hêtre massif	\N	m2	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:16.910024	\N
4e7437bd-3eb0-4a3b-96fa-2efc7e32963d	MDF	bois	BOIS-MDF	Panneau de fibres moyenne densité	\N	m2	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:23.276378	\N
9ba3685b-02c1-4f04-a0b9-f4df88570a47	Miroir	verre	VER-MIR	Miroir argenté 5mm	\N	m2	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:28.397309	\N
729db50a-564e-4802-a4f8-05b28d63e884	Mousse HR 35kg/m³	mousse	MOU-HR35	Mousse haute résilience 35kg/m³	\N	m3	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:32.522632	\N
8535b570-0521-45c8-baa5-881a88e1f3ff	Mousse mémoire de forme	mousse	MOU-MEM	Mousse à mémoire de forme	\N	m3	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:39.71616	\N
169ca409-d802-4c6d-af0b-6236a5603456	Noyer	bois	BOIS-NOYER	Bois de noyer	\N	m2	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:43.011663	\N
ebdcccdf-ef6e-4aaf-a10a-ec47ea6efb35	Pin massif	bois	BOIS-PIN	Bois de pin massif	\N	m2	\N	10.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:47.871928	\N
1f9e7d4e-2d44-4ac9-a178-1fe5667d904d	Simili cuir	cuir	CUIR-SIM-001	Simili cuir haute qualité	\N	m2	\N	20.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:53.210141	\N
37225bce-8638-4044-a26a-fcf9be027370	Tissu coton	tissu	TIS-COT-001	100% coton	\N	metre	\N	30.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:44:57.241998	\N
2dcd6427-a9a8-4f77-99dd-5063ff40567b	Tissu lin	tissu	TIS-LIN-001	100% lin français	\N	metre	\N	20.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:45:01.439166	\N
78b65edb-23ff-4d0e-a7ce-9fc2a2e020f7	Tissu polyester	tissu	TIS-POL-001	Tissu polyester résistant	\N	metre	\N	20.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:45:06.457834	\N
44ba843b-5cb3-441b-b68f-2118cebff785	Velours	tissu	TIS-VEL-001	Velours haute qualité	\N	metre	\N	202.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:45:12.382621	\N
a63f8bef-a05f-4e87-a8e0-b416a920c92f	Verre trempé	verre	VER-TREMP	Verre trempé 8mm	\N	m2	\N	20.00	0.00	0	t	2025-10-23 17:14:28.383127	2025-10-25 16:45:15.877643	\N
\.


--
-- Data for Name: product_components; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.product_components (id, parent_product_id, component_product_id, component_name, quantity, is_optional, created_at) FROM stdin;
\.


--
-- Data for Name: product_customizations; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.product_customizations (id, product_id, customization_type, name, description, is_required, display_order, created_at) FROM stdin;
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.product_images (id, product_id, image_url, thumbnail_url, display_order, is_primary, created_at) FROM stdin;
\.


--
-- Data for Name: product_materials; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.product_materials (id, product_id, material_id, finish_id, part_name, part_description, quantity, unit_of_measure, "position", extra_cost, notes, created_at, updated_at) FROM stdin;
8327b065-bdfb-457b-8a71-5cdfea3eb6d3	70ad5d7f-6ff7-424c-8c43-4b3184e71751	8535b570-0521-45c8-baa5-881a88e1f3ff	3a318db9-d92b-473c-b7ae-c417c733cd35	ezfefef	\N	1.000	piece	0	0.00	\N	2025-10-24 07:09:31.264229+00	2025-10-24 07:09:31.264229+00
9e852f51-d4a9-415b-a290-592b50942c87	70ad5d7f-6ff7-424c-8c43-4b3184e71751	d10a2e09-be85-48d8-a3b2-743aedbbc9d5	\N	geege	\N	1.000	piece	0	0.00	\N	2025-10-24 07:09:31.265979+00	2025-10-24 07:09:31.265979+00
8f82deeb-ade0-4437-865b-359f0012ded6	ceda19da-5cfd-4ab8-8ece-f1184fbdc1cb	d7c45e80-d6c0-4a81-8619-7c2b1ab6cfb2	\N	socle	\N	1.000	piece	0	0.00	\N	2025-10-25 10:35:35.716255+00	2025-10-25 10:35:35.716255+00
e817fa18-22f7-46e4-8682-e4421e4e8621	ceda19da-5cfd-4ab8-8ece-f1184fbdc1cb	2dcd6427-a9a8-4f77-99dd-5063ff40567b	\N	assise	\N	1.000	piece	0	0.00	\N	2025-10-25 10:35:35.719252+00	2025-10-25 10:35:35.719252+00
5af005d7-ffb4-4caf-a4c0-ba21ac6e613c	0c258572-b2f8-40e0-a615-be10ffc97a42	42be9623-8f7d-4bc1-8433-72fd84e27d25	\N	pieds	\N	1.000	piece	0	0.00	\N	2025-10-25 11:04:34.493854+00	2025-10-25 11:04:34.493854+00
a146f3b0-d998-43ef-84c9-fbb68d207c9d	0c258572-b2f8-40e0-a615-be10ffc97a42	20dd9fde-057e-4dc2-89de-a497d6c81611	\N	assise	\N	1.000	piece	0	0.00	\N	2025-10-25 11:04:34.496214+00	2025-10-25 11:04:34.496214+00
097b8b51-0dcc-4cbc-a1e7-d46734b79880	0c258572-b2f8-40e0-a615-be10ffc97a42	2dcd6427-a9a8-4f77-99dd-5063ff40567b	\N	couveture	\N	1.000	piece	0	0.00	\N	2025-10-25 11:04:34.497191+00	2025-10-25 11:04:34.497191+00
3c2c21f9-5b21-4f15-840f-6821a2259a66	81960025-04b0-447e-b83d-4e3fd04d4166	a0fb8bf2-92ac-45ef-9076-44306443ec7e	0d31b389-31cd-4df5-b28f-81f69f3f8440	ZEEEE	\N	1.000	piece	0	50.00	\N	2025-10-25 16:18:46.13417+00	2025-10-25 16:18:46.13417+00
778bf2a4-b3ee-4a3c-bb6f-e41ad4af0aa4	2c4c36b6-ed21-4567-b6c5-abf181d1a47b	d7c45e80-d6c0-4a81-8619-7c2b1ab6cfb2	\N	socle	\N	1.000	piece	0	50.00	\N	2025-10-25 16:34:24.023306+00	2025-10-25 16:34:24.023306+00
8246ab89-1e5b-4fb5-a1d0-e234ea837c2e	2c4c36b6-ed21-4567-b6c5-abf181d1a47b	37225bce-8638-4044-a26a-fcf9be027370	\N	tissus	\N	1.000	piece	0	0.00	\N	2025-10-25 16:34:24.0252+00	2025-10-25 16:34:24.0252+00
c79eec94-5106-4aad-aafa-885f934ea70b	9208c040-f472-4d72-9757-704059dd94a7	a0fb8bf2-92ac-45ef-9076-44306443ec7e	\N	DDD	\N	1.000	piece	0	75.00	\N	2025-10-25 17:48:21.092966+00	2025-10-25 17:48:21.092966+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.products (id, sku, name, description, category_id, unit_price, cost_price, stock_quantity, reserved_quantity, min_stock_level, max_stock_level, unit_of_measure, weight, dimensions_length, dimensions_width, dimensions_height, tax_rate, barcode, supplier_id, lead_time_days, is_active, is_service, track_inventory, created_at, updated_at, deleted_at, allows_custom_materials, images) FROM stdin;
7e362979-b114-4394-b439-4d35d90e17dc	TEST001	Test Product	Test Description	\N	100.00	\N	10.00	0.00	0.00	\N	piece	\N	\N	\N	\N	0.00	\N	\N	0	t	f	t	2025-10-23 21:05:17.134018	2025-10-23 21:05:17.134018	\N	t	[]
9b109cd5-96b6-4e6b-ae3a-b22351252bd0	CNP-001	WA_38354	\N	\N	2333.00	\N	0.00	0.00	0.00	\N	piece	\N	\N	\N	\N	0.00	\N	\N	0	t	f	t	2025-10-23 21:09:10.210938	2025-10-23 21:09:10.210938	\N	t	[]
bdcd6075-db52-428e-8a57-3fa98c8d5059	WA_38354	sklum chaise	\N	\N	60900.00	\N	0.00	0.00	0.00	\N	piece	66.000	\N	\N	\N	0.00	\N	\N	0	t	f	t	2025-10-23 21:10:17.840832	2025-10-23 21:10:17.840832	\N	t	[]
0c258572-b2f8-40e0-a615-be10ffc97a42	FAU-HTH	fauteuil Youssef	\N	5c9111c2-cfc4-4217-99c4-a939ce04f692	500.00	\N	30.00	0.00	0.00	\N	piece	20.000	\N	\N	\N	0.00	\N	\N	0	t	f	t	2025-10-25 11:04:34.490823	2025-10-25 11:05:14.188549	\N	t	[]
6e243e73-3ac1-475b-8c78-b946d7e7c34d	TABLE-BASSE-001	TABLE-BASSE-001		\N	222.00	\N	0.00	0.00	0.00	\N	piece	\N	\N	\N	\N	0.00	\N	\N	14	t	f	t	2025-10-23 21:16:22.482463	2025-10-25 12:26:27.036636	\N	t	[]
ceda19da-5cfd-4ab8-8ece-f1184fbdc1cb	MAR-7283	canape marocain	\N	bb10caa6-a673-4da5-94e7-4a89a384412d	4000.00	\N	15.00	0.00	0.00	\N	piece	100.000	\N	\N	\N	0.00	\N	\N	0	t	f	t	2025-10-25 10:35:35.71173	2025-10-25 10:36:06.569214	\N	t	[]
2c4c36b6-ed21-4567-b6c5-abf181d1a47b	FR-62553	canape 3 pieces		bb10caa6-a673-4da5-94e7-4a89a384412d	500.00	\N	30.00	0.00	5.00	50.00	piece	50.000	200.00	200.00	200.00	0.00	\N	\N	14	t	f	t	2025-10-25 11:50:33.676264	2025-10-25 16:59:13.561181	\N	t	[{"url": "http://localhost:9000/myerp-uploads/products/2c4c36b6-ed21-4567-b6c5-abf181d1a47b/20250902_144505_1761289757025_9lcsvmj4n5_1761394726890_nq2jtwt0a1d.jpg", "size": 221780, "isMain": true, "filename": "20250902_144505_1761289757025_9lcsvmj4n5_1761394726890_nq2jtwt0a1d.jpg", "mimeType": "image/jpeg", "uploadedAt": "2025-10-25T12:18:46.911Z", "originalName": "20250902_144505_1761289757025_9lcsvmj4n5.jpg"}, {"url": "http://localhost:9000/myerp-uploads/products/2c4c36b6-ed21-4567-b6c5-abf181d1a47b/att00003_1761394742924_caf29teqrz5.jpeg", "size": 33040, "isMain": false, "filename": "att00003_1761394742924_caf29teqrz5.jpeg", "mimeType": "image/jpeg", "uploadedAt": "2025-10-25T12:19:02.933Z", "originalName": "ATT00003.jpeg"}]
70ad5d7f-6ff7-424c-8c43-4b3184e71751	REST 525	test 232	sdfdsfdsfdsfdsf	45bbf2ef-086a-4b16-a172-c607b436c124	333332.00	\N	20.00	0.00	0.00	\N	piece	\N	\N	\N	\N	0.00	\N	\N	0	t	f	t	2025-10-23 21:19:28.639861	2025-10-25 00:27:03.39511	\N	t	[{"url": "http://localhost:9000/myerp-uploads/products/70ad5d7f-6ff7-424c-8c43-4b3184e71751/20250902_144505_1761289757025_9lcsvmj4n5.jpg", "size": 221780, "isMain": true, "filename": "20250902_144505_1761289757025_9lcsvmj4n5.jpg", "mimeType": "image/jpeg", "uploadedAt": "2025-10-24T07:09:17.035Z", "originalName": "20250902_144505.jpg"}]
9208c040-f472-4d72-9757-704059dd94a7	DDDD	test 232EE	\N	7e735925-e34a-45e6-9f6f-b6dadcec0bd7	233.00	\N	4.00	0.00	2.00	50.00	piece	\N	\N	\N	\N	0.00	\N	\N	14	t	f	t	2025-10-25 12:44:45.818662	2025-10-25 19:39:47.412363	\N	t	[]
81960025-04b0-447e-b83d-4e3fd04d4166	ddddddd	test		7e735925-e34a-45e6-9f6f-b6dadcec0bd7	500.00	\N	8.00	0.00	2.00	20.00	piece	\N	\N	\N	\N	0.00	\N	\N	14	t	f	t	2025-10-25 12:48:41.356899	2025-10-29 20:00:26.85567	\N	t	[]
\.


--
-- Data for Name: quotation_attachments; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.quotation_attachments (id, quotation_id, file_name, file_url, file_size, mime_type, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: quotation_lines; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.quotation_lines (id, quotation_id, product_id, section_id, line_number, product_sku, product_name, description, quantity, unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total, cost_price, notes, is_optional, created_at, updated_at) FROM stdin;
3be65a3b-bfef-4608-a5e5-50100009f99d	cbc0232b-9e92-4944-be27-15f07435f4d6	9208c040-f472-4d72-9757-704059dd94a7	\N	1	DDDD	test 232EE		1.000	308.00	0.00	0.00	20.00	61.60	308.00	\N	\N	f	2025-10-25 20:33:48.65574	2025-10-25 20:33:48.65574
5a6ac22a-0b25-401f-899f-5121fdcb64f0	7b0b694b-c255-4981-a541-e4629d7ce6f1	81960025-04b0-447e-b83d-4e3fd04d4166	\N	1	ddddddd	test		1.000	600.00	0.00	0.00	0.00	0.00	600.00	\N	\N	f	2025-10-25 20:47:07.169865	2025-10-25 20:47:07.169865
ad219d0f-8b90-4e22-a058-87aec6f10be4	7b0b694b-c255-4981-a541-e4629d7ce6f1	\N	\N	2		rzrzer	rzerzrzrzrz	1.000	44.00	0.00	0.00	20.00	8.80	44.00	\N	\N	f	2025-10-25 20:47:07.169865	2025-10-25 20:47:07.169865
f77ee4ec-9fc3-4960-a6b6-5f0cc8daa658	4f1c443f-c511-4487-a941-422fd7635fc3	81960025-04b0-447e-b83d-4e3fd04d4166	\N	1	ddddddd	test		1.000	600.00	0.00	0.00	0.00	0.00	600.00	\N	\N	f	2025-10-25 21:08:22.090752	2025-10-25 21:08:22.090752
41fe6189-780d-4fb9-aeaf-ea3d4b3cf561	bb66c1ca-478b-46d6-86fd-0e5cd679a2ae	\N	\N	1		Canapé Minotti	- 250cm x 90cm (std)\n- Double accoudoir\n    - Tissus REF : GABRIELLA CREME\n- Grands coussins : forme valise\n     - Tissus : Tiffany 101\n- Petits coussins : 40cm x 40cm\n    - Tissus : Gabriella Aqua	1.000	1500.00	0.00	0.00	20.00	300.00	1500.00	\N	\N	f	2025-10-26 18:33:28.091928	2025-10-26 18:33:28.091928
2e0b479b-c538-4335-878e-1377acaf9944	de5fc385-8787-41bd-8359-52b8e6c9ffbf	81960025-04b0-447e-b83d-4e3fd04d4166	\N	1	ddddddd	test		1.000	600.00	0.00	0.00	0.00	0.00	600.00	\N	\N	f	2025-10-26 20:38:19.6736	2025-10-26 20:38:19.6736
\.


--
-- Data for Name: quotation_sections; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.quotation_sections (id, quotation_id, name, description, display_order, subtotal, created_at) FROM stdin;
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.quotations (id, quotation_number, contact_id, sales_rep_id, status, expiration_date, delivery_date, payment_terms, delivery_terms, shipping_method, currency, exchange_rate, subtotal, tax_amount, shipping_cost, discount_percent, discount_amount, total_amount, notes, internal_notes, terms_conditions, reference_number, version, parent_quotation_id, sent_at, viewed_at, accepted_at, rejected_at, rejection_reason, created_at, updated_at, deleted_at, delivery_address, installation_cost, installation_included, include_tax, tax_rate, sales_order_id, converted_to_order_at) FROM stdin;
7b0b694b-c255-4981-a541-e4629d7ce6f1	DEV-202510-001	debee6f7-e682-4599-9fee-a893be9e6a9d	\N	accepted	2025-12-01	\N	30	6-8	installation	EUR	1.000000	644.00	0.00	50.00	20.00	128.80	865.20			Conditions générales de vente:\n• Validité du devis : 30 jours\n• Acompte de 30% à la commande\n• Solde à la livraison\n• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)\n• Garantie 2 ans pièces et main d'œuvre\n• Les délais de livraison sont donnés à titre indicatif\n• Tout devis signé vaut bon de commande	\N	1	\N	\N	\N	\N	\N	\N	2025-10-25 14:05:38.853886	2025-10-25 20:55:11.296337	\N	43 rue saint vincent, Colombes, 92700	300.00	t	f	0.00	58a5ee5c-767d-4dfa-a331-767c0494a9b3	2025-10-25 20:55:11.296337
cbc0232b-9e92-4944-be27-15f07435f4d6	DEV-202510-002	d3ca30c9-1eec-44aa-bdfe-a5e99b777a27	\N	accepted	2025-11-15	\N	30	2-4	standard	EUR	1.000000	308.00	81.60	100.00	0.00	0.00	489.60			Conditions générales de vente:\n• Validité du devis : 30 jours\n• Acompte de 30% à la commande\n• Solde à la livraison\n• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)\n• Garantie 2 ans pièces et main d'œuvre\n• Les délais de livraison sont donnés à titre indicatif\n• Tout devis signé vaut bon de commande	\N	1	\N	\N	\N	\N	\N	\N	2025-10-25 15:13:31.371413	2025-10-25 20:33:48.65574	\N	5 rue georges collon, Bruxelles, 82892	0.00	f	t	20.00	f92b4caf-fecc-4e5c-a401-ebfe048bda1f	2025-10-25 19:39:47.412363
4f1c443f-c511-4487-a941-422fd7635fc3	DEV-202510-003	debee6f7-e682-4599-9fee-a893be9e6a9d	\N	accepted	2025-12-31	\N	\N	\N	\N	EUR	1.000000	600.00	0.00	0.00	20.00	120.00	480.00		\N	Conditions générales de vente:\n• Validité du devis : 30 jours\n• Acompte de 30% à la commande\n• Solde à la livraison\n• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)\n• Garantie 2 ans pièces et main d'œuvre\n• Les délais de livraison sont donnés à titre indicatif\n• Tout devis signé vaut bon de commande	\N	1	\N	\N	\N	\N	\N	\N	2025-10-25 21:08:22.090752	2025-10-25 21:12:48.770022	\N	\N	0.00	f	f	0.00	8cb09fab-624a-4010-8801-8a0c6221ba7b	2025-10-25 21:12:48.770022
bb66c1ca-478b-46d6-86fd-0e5cd679a2ae	DEV-202510-004	2366fc2e-f0ff-4b93-b2e4-a33ce60fd6eb	\N	accepted	2025-11-25	\N	\N	\N	\N	EUR	1.000000	1500.00	0.00	250.00	0.00	0.00	1750.00		\N	Conditions générales de vente:\n• Validité du devis : 30 jours\n• Acompte de 30% à la commande\n• Solde à la livraison\n• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)\n• Les délais de livraison sont donnés à titre indicatif	\N	1	\N	\N	\N	\N	\N	\N	2025-10-26 18:33:28.091928	2025-10-26 18:36:21.5739	\N	\N	0.00	f	f	0.00	d9e43121-573a-4e17-8654-05483023c3a4	2025-10-26 18:36:21.5739
de5fc385-8787-41bd-8359-52b8e6c9ffbf	DEV-202510-005	2366fc2e-f0ff-4b93-b2e4-a33ce60fd6eb	\N	accepted	2025-11-25	\N	\N	\N	\N	EUR	1.000000	600.00	0.00	0.00	0.00	0.00	600.00		\N	Conditions générales de vente:\n• Validité du devis : 30 jours\n• Acompte de 30% à la commande\n• Solde à la livraison\n• Livraison comprise en France métropolitaine (hors Corse et DOM-TOM)\n• Garantie 2 ans pièces et main d'œuvre\n• Les délais de livraison sont donnés à titre indicatif\n• Tout devis signé vaut bon de commande	\N	1	\N	\N	\N	\N	\N	\N	2025-10-26 20:38:19.6736	2025-10-29 20:00:26.85567	\N	\N	0.00	f	f	0.00	01bda4c1-0583-4c14-a166-ed88cf571046	2025-10-29 20:00:26.85567
\.


--
-- Data for Name: sales_order_items; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.sales_order_items (id, sales_order_id, product_id, product_name, product_sku, description, quantity, unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total, created_at) FROM stdin;
5e44cfad-07b3-400c-8f02-6d00fc0a7eb2	f92b4caf-fecc-4e5c-a401-ebfe048bda1f	9208c040-f472-4d72-9757-704059dd94a7	test 232EE	DDDD		1.00	308.00	0.00	0.00	20.00	61.60	308.00	2025-10-25 19:39:47.412363
5344d436-5fec-4277-9260-ce5f25ef1c4a	58a5ee5c-767d-4dfa-a331-767c0494a9b3	81960025-04b0-447e-b83d-4e3fd04d4166	test	ddddddd		1.00	600.00	0.00	0.00	0.00	0.00	600.00	2025-10-25 20:55:11.296337
07ca56e9-bbbc-4639-83a7-94879d7cf64a	58a5ee5c-767d-4dfa-a331-767c0494a9b3	\N	rzrzer		rzerzrzrzrz	1.00	44.00	0.00	0.00	20.00	8.80	44.00	2025-10-25 20:55:11.296337
6e78517c-c2cc-47d4-bea1-fbf884a1d44a	8cb09fab-624a-4010-8801-8a0c6221ba7b	81960025-04b0-447e-b83d-4e3fd04d4166	test	ddddddd		1.00	600.00	0.00	0.00	0.00	0.00	600.00	2025-10-25 21:12:48.770022
ba3610a5-69f8-471b-98b3-2167dacbb557	d9e43121-573a-4e17-8654-05483023c3a4	\N	Canapé Minotti		- 250cm x 90cm (std)\n- Double accoudoir\n    - Tissus REF : GABRIELLA CREME\n- Grands coussins : forme valise\n     - Tissus : Tiffany 101\n- Petits coussins : 40cm x 40cm\n    - Tissus : Gabriella Aqua	1.00	1500.00	0.00	0.00	20.00	300.00	1500.00	2025-10-26 18:36:21.5739
4c2bbcd7-128a-47aa-8a58-61ba3b46a893	01bda4c1-0583-4c14-a166-ed88cf571046	81960025-04b0-447e-b83d-4e3fd04d4166	test	ddddddd		1.00	600.00	0.00	0.00	0.00	0.00	600.00	2025-10-29 20:00:26.85567
\.


--
-- Data for Name: sales_orders; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.sales_orders (id, order_number, quotation_id, contact_id, order_date, expected_delivery_date, shipped_date, delivered_date, status, subtotal, discount_amount, tax_amount, shipping_cost, installation_cost, total_amount, delivery_address, tracking_number, invoice_id, notes, payment_terms, delivery_terms, created_at, updated_at, down_payment_amount, down_payment_method, down_payment_date, down_payment_notes) FROM stdin;
f92b4caf-fecc-4e5c-a401-ebfe048bda1f	CMD-2025-0001	cbc0232b-9e92-4944-be27-15f07435f4d6	d3ca30c9-1eec-44aa-bdfe-a5e99b777a27	2025-10-25	\N	2025-10-25	2025-10-25	termine	308.00	0.00	81.60	100.00	0.00	489.60	12 rue	\N	16355cae-21c2-429b-aff0-48478da7e4dd		30	2-4 semaines	2025-10-25 19:39:47.412363	2025-10-25 19:47:16.134533	0.00	\N	\N	\N
58a5ee5c-767d-4dfa-a331-767c0494a9b3	CMD-2025-0002	7b0b694b-c255-4981-a541-e4629d7ce6f1	debee6f7-e682-4599-9fee-a893be9e6a9d	2025-10-25	2026-01-22	\N	\N	annule	644.00	128.80	0.00	50.00	300.00	865.20	43 rue saint vincent, Colombes, 92700	\N	\N		30	6-8	2025-10-25 20:55:11.296337	2025-10-25 21:06:44.664596	0.00	\N	\N	\N
8cb09fab-624a-4010-8801-8a0c6221ba7b	CMD-2025-0003	4f1c443f-c511-4487-a941-422fd7635fc3	debee6f7-e682-4599-9fee-a893be9e6a9d	2025-10-25	2026-02-12	2025-10-25	2025-10-25	termine	600.00	120.00	0.00	0.00	0.00	480.00	\N	\N	98dd4124-f78e-458a-b5fc-b5628a07abd3		30 jours	2-4 semaines	2025-10-25 21:12:48.770022	2025-10-25 21:18:13.838703	0.00	\N	\N	\N
d9e43121-573a-4e17-8654-05483023c3a4	CMD-2025-0004	bb66c1ca-478b-46d6-86fd-0e5cd679a2ae	2366fc2e-f0ff-4b93-b2e4-a33ce60fd6eb	2025-10-26	2025-11-02	2025-10-26	2025-10-26	termine	1500.00	0.00	0.00	250.00	0.00	1750.00	\N	\N	be68bce0-76b6-4059-b581-f7853ba04360		30 jours	2-4 semaines	2025-10-26 18:36:21.5739	2025-10-26 18:38:58.286989	0.00	\N	\N	\N
01bda4c1-0583-4c14-a166-ed88cf571046	CMD-2025-0005	de5fc385-8787-41bd-8359-52b8e6c9ffbf	2366fc2e-f0ff-4b93-b2e4-a33ce60fd6eb	2025-10-29	2025-11-12	2025-10-29	2025-10-29	termine	600.00	0.00	0.00	0.00	0.00	600.00	\N	\N	910da070-a835-4df6-b805-18cd06967b83		30 jours	2-4 semaines	2025-10-29 20:00:26.85567	2025-10-29 20:01:17.394114	300.00	carte	2025-10-29	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: myerp
--

COPY public.users (id, email, password_hash, first_name, last_name, role, is_active, phone, avatar_url, last_login, failed_login_attempts, locked_until, password_reset_token, password_reset_expires, email_verified, email_verification_token, created_at, updated_at, deleted_at, suspended, suspended_at, suspended_by, must_change_password) FROM stdin;
87e5c050-4024-4b93-99cc-632c15ffe7ca	admin@myerp.com	$2a$10$5kGqKKDlbKE8rPbZ.BzKBOZKjzQzWRqZQhXRqGq6M6P1o5wH.Z8HS	System	Administrator	admin	t	\N	\N	\N	0	\N	\N	\N	t	\N	2025-10-23 17:14:28.172444	2025-10-23 17:14:28.172444	\N	f	\N	\N	f
d5b1375c-6516-4504-b85b-34600e1478c5	hicham@gmail.com	$2a$10$ZCMf.xADeKAs2KS1LSilBujbppAyekw9Yg4Wj2IEeogaBMgG3syf6	ihssane	hadi	sales	t	+33652644282	\N	2025-10-29 17:01:56.98883	0	\N	\N	\N	f	\N	2025-10-29 16:24:42.939691	2025-10-29 17:01:56.98883	\N	f	\N	\N	t
f13843e9-e15a-4aec-ab6e-192e8aa1e2f5	admin@myerp.fr	$2a$10$vvXfev6.k1pvraIn3lol2e8VfbZxL6JKfsT.GqkVgYM/NqA9Lu3ky	Admin	User	admin	t	\N	\N	2025-10-29 20:23:49.211989	0	\N	\N	\N	f	\N	2025-10-24 16:57:07.538256	2025-10-29 20:23:49.211989	\N	f	\N	\N	f
aca8424f-6278-4b45-87e7-7f0975f0a20b	hicham.mouddi@ubudu.com	$2a$10$jLOmFLUEVywzQ0N6PXU2tO6zxfrms5qwsFI6el3ilb/E0S32oAFmu	Hicham	Mouddi	sales	t	+33663886949	\N	2025-10-29 16:11:24.200315	0	\N	\N	\N	f	\N	2025-10-29 16:06:58.223992	2025-10-29 16:14:21.6309	\N	f	\N	\N	f
fe0d19ed-4377-4305-8113-f2e791d3fc66	themood.eth@gmail.com	$2a$10$VeblgNn06clSqLgcrWp/m.NrnQIeOhK0qrW4r6RWV2mSKGlb2ncx.	ihssane	hadi	inventory_manager	f	+44663886949	\N	\N	0	\N	\N	\N	f	\N	2025-10-29 16:13:08.82693	2025-10-29 16:24:18.279758	2025-10-29 16:24:18.279758	f	\N	\N	t
3496e409-6b39-47d4-b254-21788107d0cf	hicham.mouddi15@gmail.com	$2a$10$pE7gJGL7M.7e1WjtNwoH4OgJb46lB/0w450x.9yCvdhMOpEaw3Ag6	Lamia	Boussif	sales	f	+33652644282	\N	\N	0	\N	\N	\N	f	\N	2025-10-29 16:09:08.564638	2025-10-29 16:24:22.015575	2025-10-29 16:24:22.015575	f	\N	\N	t
\.


--
-- Name: contact_code_seq; Type: SEQUENCE SET; Schema: public; Owner: myerp
--

SELECT pg_catalog.setval('public.contact_code_seq', 1014, true);


--
-- Name: quotation_number_seq; Type: SEQUENCE SET; Schema: public; Owner: myerp
--

SELECT pg_catalog.setval('public.quotation_number_seq', 1000, false);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: company_settings company_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.company_settings
    ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_contact_code_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_contact_code_key UNIQUE (contact_code);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: customization_options customization_options_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.customization_options
    ADD CONSTRAINT customization_options_pkey PRIMARY KEY (id);


--
-- Name: finishes finishes_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.finishes
    ADD CONSTRAINT finishes_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: materials materials_code_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_code_key UNIQUE (code);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: product_components product_components_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_components
    ADD CONSTRAINT product_components_pkey PRIMARY KEY (id);


--
-- Name: product_customizations product_customizations_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_customizations
    ADD CONSTRAINT product_customizations_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_materials product_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: quotation_attachments quotation_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_attachments
    ADD CONSTRAINT quotation_attachments_pkey PRIMARY KEY (id);


--
-- Name: quotation_lines quotation_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_lines_pkey PRIMARY KEY (id);


--
-- Name: quotation_sections quotation_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_sections
    ADD CONSTRAINT quotation_sections_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_order_number_key UNIQUE (order_number);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: product_materials unique_product_material_finish_part; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT unique_product_material_finish_part UNIQUE (product_id, material_id, finish_id, part_name);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_categories_active; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_categories_active ON public.categories USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_contacts_active; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_active ON public.contacts USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_contacts_assigned; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_assigned ON public.contacts USING btree (assigned_to);


--
-- Name: idx_contacts_code; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_code ON public.contacts USING btree (contact_code);


--
-- Name: idx_contacts_company; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_company ON public.contacts USING btree (company_name);


--
-- Name: idx_contacts_deleted; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_deleted ON public.contacts USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_tags; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_tags ON public.contacts USING gin (tags);


--
-- Name: idx_contacts_type; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_contacts_type ON public.contacts USING btree (type);


--
-- Name: idx_customization_options_customization; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_customization_options_customization ON public.customization_options USING btree (customization_id);


--
-- Name: idx_finishes_code; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_finishes_code ON public.finishes USING btree (code);


--
-- Name: idx_finishes_type; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_finishes_type ON public.finishes USING btree (type);


--
-- Name: idx_inventory_movements_created; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_inventory_movements_created ON public.inventory_movements USING btree (created_at);


--
-- Name: idx_inventory_movements_material; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_inventory_movements_material ON public.inventory_movements USING btree (material_id);


--
-- Name: idx_inventory_movements_product; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_inventory_movements_product ON public.inventory_movements USING btree (product_id);


--
-- Name: idx_inventory_movements_reference; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_inventory_movements_reference ON public.inventory_movements USING btree (reference_type, reference_id);


--
-- Name: idx_inventory_movements_type; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_inventory_movements_type ON public.inventory_movements USING btree (movement_type);


--
-- Name: idx_invoice_items_invoice_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items USING btree (invoice_id);


--
-- Name: idx_invoice_items_product_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoice_items_product_id ON public.invoice_items USING btree (product_id);


--
-- Name: idx_invoices_contact_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoices_contact_id ON public.invoices USING btree (contact_id);


--
-- Name: idx_invoices_due_date; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoices_due_date ON public.invoices USING btree (due_date);


--
-- Name: idx_invoices_invoice_date; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date);


--
-- Name: idx_invoices_quotation_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoices_quotation_id ON public.invoices USING btree (quotation_id);


--
-- Name: idx_invoices_sales_order_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoices_sales_order_id ON public.invoices USING btree (sales_order_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_materials_code; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_materials_code ON public.materials USING btree (code);


--
-- Name: idx_materials_supplier; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_materials_supplier ON public.materials USING btree (supplier_id);


--
-- Name: idx_materials_type; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_materials_type ON public.materials USING btree (type);


--
-- Name: idx_product_components_parent; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_product_components_parent ON public.product_components USING btree (parent_product_id);


--
-- Name: idx_product_customizations_product; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_product_customizations_product ON public.product_customizations USING btree (product_id);


--
-- Name: idx_product_images_primary; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_product_images_primary ON public.product_images USING btree (product_id, is_primary) WHERE (is_primary = true);


--
-- Name: idx_product_images_product; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_product_images_product ON public.product_images USING btree (product_id);


--
-- Name: idx_product_materials_finish_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_product_materials_finish_id ON public.product_materials USING btree (finish_id);


--
-- Name: idx_product_materials_material_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_product_materials_material_id ON public.product_materials USING btree (material_id);


--
-- Name: idx_product_materials_product_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_product_materials_product_id ON public.product_materials USING btree (product_id);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_deleted; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_deleted ON public.products USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_products_images; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_images ON public.products USING gin (images);


--
-- Name: idx_products_low_stock; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_low_stock ON public.products USING btree (stock_quantity, min_stock_level) WHERE (track_inventory = true);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_products_supplier; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_products_supplier ON public.products USING btree (supplier_id);


--
-- Name: idx_quotation_attachments_quotation; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotation_attachments_quotation ON public.quotation_attachments USING btree (quotation_id);


--
-- Name: idx_quotation_lines_product; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotation_lines_product ON public.quotation_lines USING btree (product_id);


--
-- Name: idx_quotation_lines_quotation; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotation_lines_quotation ON public.quotation_lines USING btree (quotation_id);


--
-- Name: idx_quotation_lines_section; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotation_lines_section ON public.quotation_lines USING btree (section_id);


--
-- Name: idx_quotation_sections_order; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotation_sections_order ON public.quotation_sections USING btree (quotation_id, display_order);


--
-- Name: idx_quotation_sections_quotation; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotation_sections_quotation ON public.quotation_sections USING btree (quotation_id);


--
-- Name: idx_quotations_contact; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_contact ON public.quotations USING btree (contact_id);


--
-- Name: idx_quotations_created; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_created ON public.quotations USING btree (created_at);


--
-- Name: idx_quotations_deleted; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_deleted ON public.quotations USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_quotations_expiration; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_expiration ON public.quotations USING btree (expiration_date);


--
-- Name: idx_quotations_number; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_number ON public.quotations USING btree (quotation_number);


--
-- Name: idx_quotations_parent; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_parent ON public.quotations USING btree (parent_quotation_id);


--
-- Name: idx_quotations_sales_order_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_sales_order_id ON public.quotations USING btree (sales_order_id);


--
-- Name: idx_quotations_sales_rep; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_sales_rep ON public.quotations USING btree (sales_rep_id);


--
-- Name: idx_quotations_status; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_quotations_status ON public.quotations USING btree (status);


--
-- Name: idx_sales_order_items_product_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_sales_order_items_product_id ON public.sales_order_items USING btree (product_id);


--
-- Name: idx_sales_order_items_sales_order_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_sales_order_items_sales_order_id ON public.sales_order_items USING btree (sales_order_id);


--
-- Name: idx_sales_orders_contact_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_sales_orders_contact_id ON public.sales_orders USING btree (contact_id);


--
-- Name: idx_sales_orders_down_payment; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_sales_orders_down_payment ON public.sales_orders USING btree (down_payment_amount) WHERE (down_payment_amount > (0)::numeric);


--
-- Name: idx_sales_orders_order_date; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_sales_orders_order_date ON public.sales_orders USING btree (order_date);


--
-- Name: idx_sales_orders_quotation_id; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_sales_orders_quotation_id ON public.sales_orders USING btree (quotation_id);


--
-- Name: idx_sales_orders_status; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_sales_orders_status ON public.sales_orders USING btree (status);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_users_deleted; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_users_deleted ON public.users USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_suspended; Type: INDEX; Schema: public; Owner: myerp
--

CREATE INDEX idx_users_suspended ON public.users USING btree (suspended) WHERE (suspended = true);


--
-- Name: invoices trigger_calculate_invoice_amount_due; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_calculate_invoice_amount_due BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.calculate_invoice_amount_due();


--
-- Name: quotation_lines trigger_calculate_quotation_totals; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_calculate_quotation_totals AFTER INSERT OR DELETE OR UPDATE ON public.quotation_lines FOR EACH ROW EXECUTE FUNCTION public.calculate_quotation_totals();


--
-- Name: invoices trigger_check_invoice_overdue; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_check_invoice_overdue BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.check_invoice_overdue();


--
-- Name: contacts trigger_set_contact_code; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_set_contact_code BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_contact_code();


--
-- Name: invoices trigger_set_invoice_number; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_set_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();


--
-- Name: sales_orders trigger_set_order_number; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_set_order_number BEFORE INSERT ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.set_order_number();


--
-- Name: quotations trigger_set_quotation_number; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_set_quotation_number BEFORE INSERT ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.set_quotation_number();


--
-- Name: invoices trigger_update_invoice_timestamp; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_update_invoice_timestamp BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_invoice_updated_at();


--
-- Name: sales_orders trigger_update_sales_order_timestamp; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER trigger_update_sales_order_timestamp BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.update_sales_order_updated_at();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: materials update_materials_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_materials update_product_materials_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_product_materials_updated_at BEFORE UPDATE ON public.product_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotation_lines update_quotation_lines_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_quotation_lines_updated_at BEFORE UPDATE ON public.quotation_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotations update_quotations_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: myerp
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: customization_options customization_options_customization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.customization_options
    ADD CONSTRAINT customization_options_customization_id_fkey FOREIGN KEY (customization_id) REFERENCES public.product_customizations(id) ON DELETE CASCADE;


--
-- Name: customization_options customization_options_finish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.customization_options
    ADD CONSTRAINT customization_options_finish_id_fkey FOREIGN KEY (finish_id) REFERENCES public.finishes(id) ON DELETE CASCADE;


--
-- Name: customization_options customization_options_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.customization_options
    ADD CONSTRAINT customization_options_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: sales_orders fk_sales_orders_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT fk_sales_orders_invoice_id FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: inventory_movements inventory_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inventory_movements inventory_movements_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: invoices invoices_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: invoices invoices_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id);


--
-- Name: invoices invoices_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id);


--
-- Name: materials materials_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: product_components product_components_component_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_components
    ADD CONSTRAINT product_components_component_product_id_fkey FOREIGN KEY (component_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_components product_components_parent_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_components
    ADD CONSTRAINT product_components_parent_product_id_fkey FOREIGN KEY (parent_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_customizations product_customizations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_customizations
    ADD CONSTRAINT product_customizations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_materials product_materials_finish_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_finish_id_fkey FOREIGN KEY (finish_id) REFERENCES public.finishes(id) ON DELETE SET NULL;


--
-- Name: product_materials product_materials_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE RESTRICT;


--
-- Name: product_materials product_materials_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.product_materials
    ADD CONSTRAINT product_materials_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: quotation_attachments quotation_attachments_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_attachments
    ADD CONSTRAINT quotation_attachments_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotation_attachments quotation_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_attachments
    ADD CONSTRAINT quotation_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: quotation_lines quotation_lines_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_lines_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: quotation_lines quotation_lines_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_lines_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotation_lines quotation_lines_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_lines
    ADD CONSTRAINT quotation_lines_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.quotation_sections(id) ON DELETE SET NULL;


--
-- Name: quotation_sections quotation_sections_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotation_sections
    ADD CONSTRAINT quotation_sections_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotations quotations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;


--
-- Name: quotations quotations_parent_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_parent_quotation_id_fkey FOREIGN KEY (parent_quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL;


--
-- Name: quotations quotations_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id);


--
-- Name: quotations quotations_sales_rep_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_sales_rep_id_fkey FOREIGN KEY (sales_rep_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales_order_items sales_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sales_order_items sales_order_items_sales_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_sales_order_id_fkey FOREIGN KEY (sales_order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_orders sales_orders_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: sales_orders sales_orders_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id);


--
-- Name: users users_suspended_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: myerp
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_suspended_by_fkey FOREIGN KEY (suspended_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict UnTq4yGcL6qof1V4nUVErV2k8XX9qlHCClrfJGb3FPrWfkGtEoAL5ZjdURujkk8

