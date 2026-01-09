--
-- PostgreSQL database dump
--

\restrict 41aMSMugsEGZNrxEah1fUFgfwLVzG4Ao8ys41g5sw8fHqOajgzQABlVHW434Eqh

-- Dumped from database version 14.19 (Homebrew)
-- Dumped by pg_dump version 14.19 (Homebrew)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: link_transaction_to_line(integer, integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_transaction_to_line(p_transaction_id integer, p_line_id integer, p_user character varying DEFAULT 'system'::character varying) RETURNS TABLE(status text, message text, transaction_id integer, line_id integer, amount numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_transaction_type VARCHAR(20);
    v_project_id INTEGER;
    v_line_project_id INTEGER;
    v_line_exists INTEGER;
    v_amount NUMERIC;
    v_old_line_id INTEGER;
BEGIN
    -- Récupérer infos transaction
    SELECT type, project_id, amount, project_line_id
    INTO v_transaction_type, v_project_id, v_amount, v_old_line_id
    FROM transactions
    WHERE id = p_transaction_id;

    IF v_transaction_type IS NULL THEN
        RAISE EXCEPTION 'Transaction introuvable';
    END IF;

    -- Vérifier que la ligne existe et correspond au projet
    IF v_transaction_type = 'expense' THEN
        SELECT COUNT(*), MAX(project_id)
        INTO v_line_exists, v_line_project_id
        FROM project_expense_lines
        WHERE id = p_line_id;
    ELSE
        SELECT COUNT(*), MAX(project_id)
        INTO v_line_exists, v_line_project_id
        FROM project_revenue_lines
        WHERE id = p_line_id;
    END IF;

    IF v_line_exists = 0 THEN
        RAISE EXCEPTION 'Ligne de projet introuvable';
    END IF;

    IF v_line_project_id != v_project_id THEN
        RAISE EXCEPTION 'La ligne ne correspond pas au projet de la transaction';
    END IF;

    -- Si déjà lié à une autre ligne, défaire l'ancienne liaison
    IF v_old_line_id IS NOT NULL AND v_old_line_id != p_line_id THEN
        IF v_transaction_type = 'expense' THEN
            UPDATE project_expense_lines
            SET actual_amount = COALESCE(actual_amount, 0) - v_amount,
                is_paid = CASE 
                    WHEN COALESCE(actual_amount, 0) - v_amount <= 0 THEN FALSE
                    ELSE is_paid
                END,
                last_synced_at = NOW()
            WHERE id = v_old_line_id;
        ELSE
            UPDATE project_revenue_lines
            SET actual_amount = COALESCE(actual_amount, 0) - v_amount,
                is_received = CASE 
                    WHEN COALESCE(actual_amount, 0) - v_amount <= 0 THEN FALSE
                    ELSE is_received
                END,
                last_synced_at = NOW()
            WHERE id = v_old_line_id;
        END IF;

        -- Logger l'ancienne liaison supprimée
        INSERT INTO transaction_linking_log 
            (transaction_id, project_line_id, line_type, action, performed_by, notes)
        VALUES 
            (p_transaction_id, v_old_line_id, v_transaction_type, 'unlinked', p_user, 
             'Délié automatiquement pour nouvelle liaison');
    END IF;

    -- Lier la transaction à la nouvelle ligne
    UPDATE transactions
    SET project_line_id = p_line_id,
        linked_at = NOW(),
        linked_by = p_user
    WHERE id = p_transaction_id;

    -- Mettre à jour la ligne
    IF v_transaction_type = 'expense' THEN
        UPDATE project_expense_lines
        SET is_paid = TRUE,
            actual_amount = COALESCE(actual_amount, 0) + v_amount,
            last_synced_at = NOW()
        WHERE id = p_line_id;
    ELSE
        UPDATE project_revenue_lines
        SET is_received = TRUE,
            actual_amount = COALESCE(actual_amount, 0) + v_amount,
            last_synced_at = NOW()
        WHERE id = p_line_id;
    END IF;

    -- Logger la nouvelle liaison
    INSERT INTO transaction_linking_log 
        (transaction_id, project_line_id, line_type, action, performed_by, notes)
    VALUES 
        (p_transaction_id, p_line_id, v_transaction_type, 'linked', p_user,
         CONCAT('Montant: ', v_amount::TEXT, ' Ar'));

    -- Retourner le résultat
    RETURN QUERY
    SELECT 
        'success'::TEXT,
        'Transaction liée avec succès'::TEXT,
        p_transaction_id,
        p_line_id,
        v_amount;
END;
$$;


--
-- Name: unlink_transaction(integer, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unlink_transaction(p_transaction_id integer, p_user character varying DEFAULT 'system'::character varying) RETURNS TABLE(status text, message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_transaction_type VARCHAR(20);
    v_line_id INTEGER;
    v_amount NUMERIC;
BEGIN
    SELECT type, project_line_id, amount
    INTO v_transaction_type, v_line_id, v_amount
    FROM transactions
    WHERE id = p_transaction_id;

    IF v_line_id IS NULL THEN
        RAISE EXCEPTION 'Transaction non liée';
    END IF;

    -- Mettre à jour la ligne
    IF v_transaction_type = 'expense' THEN
        UPDATE project_expense_lines
        SET actual_amount = COALESCE(actual_amount, 0) - v_amount,
            is_paid = CASE 
                WHEN COALESCE(actual_amount, 0) - v_amount <= 0 THEN FALSE
                ELSE is_paid
            END,
            last_synced_at = NOW()
        WHERE id = v_line_id;
    ELSE
        UPDATE project_revenue_lines
        SET actual_amount = COALESCE(actual_amount, 0) - v_amount,
            is_received = CASE 
                WHEN COALESCE(actual_amount, 0) - v_amount <= 0 THEN FALSE
                ELSE is_received
            END,
            last_synced_at = NOW()
        WHERE id = v_line_id;
    END IF;

    -- Délier la transaction
    UPDATE transactions
    SET project_line_id = NULL,
        linked_at = NULL,
        linked_by = NULL
    WHERE id = p_transaction_id;

    -- Logger
    INSERT INTO transaction_linking_log 
        (transaction_id, project_line_id, line_type, action, performed_by)
    VALUES 
        (p_transaction_id, v_line_id, v_transaction_type, 'unlinked', p_user);

    RETURN QUERY
    SELECT 'success'::TEXT, 'Transaction déliée'::TEXT;
END;
$$;


--
-- Name: update_receivables_account_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_receivables_account_balance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE accounts
  SET balance = (
    SELECT COALESCE(SUM(amount), 0)
    FROM receivables
    WHERE status = 'open'
  ),
  updated_at = NOW()
  WHERE type = 'receivables' OR name ILIKE '%receivable%';
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    balance numeric(15,2) DEFAULT 0,
    type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer DEFAULT 1,
    last_import_date date
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    pin_hash character varying(255) NOT NULL,
    is_masked boolean DEFAULT false,
    auto_lock_minutes integer DEFAULT 5,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(7) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer DEFAULT 1,
    CONSTRAINT categories_type_check CHECK (((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


--
-- Name: TABLE categories; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.categories IS 'Catégories pour classer les transactions (ex: Quotidienne, VINA, Recettes).';


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: content_derivatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_derivatives (
    id integer NOT NULL,
    master_id integer,
    platform character varying(50),
    type character varying(50),
    status character varying(50) DEFAULT 'draft'::character varying,
    reach integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: content_derivatives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.content_derivatives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: content_derivatives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.content_derivatives_id_seq OWNED BY public.content_derivatives.id;


--
-- Name: content_master; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_master (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    type character varying(50),
    duration character varying(50),
    reach integer DEFAULT 0,
    engagement numeric(5,2) DEFAULT 0,
    created_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: content_master_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.content_master_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: content_master_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.content_master_id_seq OWNED BY public.content_master.id;


--
-- Name: derivatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.derivatives (
    id integer NOT NULL,
    master_id integer NOT NULL,
    platform character varying(50) NOT NULL,
    adapted_content text NOT NULL,
    format character varying(50),
    status character varying(50) DEFAULT 'pending'::character varying,
    published_at timestamp without time zone,
    engagement_metrics jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: derivatives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.derivatives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: derivatives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.derivatives_id_seq OWNED BY public.derivatives.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    photo text,
    "position" character varying(150) NOT NULL,
    department character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    facebook text,
    linkedin text,
    location character varying(100),
    salary numeric(12,2) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    contract_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    skills jsonb,
    projects jsonb,
    emergency_contact jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT employees_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'leave'::character varying])::text[])))
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: master_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_content (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    original_content text,
    target_audience character varying(100),
    tone character varying(50),
    keywords text[],
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: master_content_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.master_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: master_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.master_content_id_seq OWNED BY public.master_content.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objectives (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(50),
    deadline date,
    budget numeric(15,2),
    progress integer DEFAULT 0,
    completed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: objectives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objectives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objectives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objectives_id_seq OWNED BY public.objectives.id;


--
-- Name: operator_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operator_tasks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'todo'::character varying,
    due_date date,
    assigned_to character varying(100),
    sop_id integer,
    project_id integer,
    category character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: operator_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operator_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operator_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operator_tasks_id_seq OWNED BY public.operator_tasks.id;


--
-- Name: partner_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.partner_payments (
    id integer NOT NULL,
    distribution_id integer NOT NULL,
    partner_id integer NOT NULL,
    partner_name character varying(255) NOT NULL,
    amount_allocated numeric(15,2) NOT NULL,
    percentage_applied numeric(5,2) NOT NULL,
    is_paid boolean DEFAULT false,
    payment_date date,
    payment_account_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: partner_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.partner_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: partner_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.partner_payments_id_seq OWNED BY public.partner_payments.id;


--
-- Name: profit_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profit_distributions (
    id integer NOT NULL,
    project_id integer NOT NULL,
    distribution_period character varying(50) NOT NULL,
    period_start_date date NOT NULL,
    period_end_date date NOT NULL,
    total_revenue numeric(15,2) NOT NULL,
    total_costs numeric(15,2) NOT NULL,
    profit_to_distribute numeric(15,2) NOT NULL,
    distribution_phase character varying(50) NOT NULL,
    capital_reimbursed_cumulative numeric(15,2) DEFAULT 0,
    reimbursement_percentage numeric(5,2) DEFAULT 0,
    is_distributed boolean DEFAULT false,
    distribution_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: profit_distributions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profit_distributions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profit_distributions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profit_distributions_id_seq OWNED BY public.profit_distributions.id;


--
-- Name: project_expense_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_expense_lines (
    id integer NOT NULL,
    project_id integer,
    description text,
    category character varying(150),
    projected_amount numeric(15,2) DEFAULT 0,
    actual_amount numeric(15,2) DEFAULT 0,
    transaction_date date,
    is_paid boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    last_synced_at timestamp without time zone,
    transaction_id integer
);


--
-- Name: project_expense_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_expense_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_expense_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_expense_lines_id_seq OWNED BY public.project_expense_lines.id;


--
-- Name: project_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_partners (
    id integer NOT NULL,
    project_id integer NOT NULL,
    partner_name character varying(255) NOT NULL,
    partner_role character varying(100),
    capital_contribution numeric(15,2) DEFAULT 0,
    contribution_percentage numeric(5,2) DEFAULT 0,
    phase1_percentage numeric(5,2) NOT NULL,
    phase2_percentage numeric(5,2) NOT NULL,
    is_capital_investor boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: project_partners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_partners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_partners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_partners_id_seq OWNED BY public.project_partners.id;


--
-- Name: project_revenue_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_revenue_lines (
    id integer NOT NULL,
    project_id integer,
    description text,
    category character varying(150),
    projected_amount numeric(15,2) DEFAULT 0,
    actual_amount numeric(15,2) DEFAULT 0,
    transaction_date date,
    is_received boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    last_synced_at timestamp without time zone,
    transaction_id integer
);


--
-- Name: project_revenue_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_revenue_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_revenue_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_revenue_lines_id_seq OWNED BY public.project_revenue_lines.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'ponctuel'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    frequency character varying(50),
    occurrences_count integer DEFAULT 1,
    unit_volume numeric(10,2),
    unit_label character varying(20),
    price_per_unit numeric(15,2),
    cost_per_unit numeric(15,2),
    start_date date,
    end_date date,
    total_cost numeric(15,2) DEFAULT 0,
    total_revenues numeric(15,2) DEFAULT 0,
    net_profit numeric(15,2) DEFAULT 0,
    roi numeric(10,2) DEFAULT 0,
    profit_per_occurrence numeric(15,2),
    margin_percent numeric(10,2),
    break_even_units integer,
    feasible boolean DEFAULT true,
    remaining_budget numeric(15,2),
    total_available numeric(15,2),
    expenses jsonb DEFAULT '[]'::jsonb,
    revenues jsonb DEFAULT '[]'::jsonb,
    allocation jsonb DEFAULT '{}'::jsonb,
    revenue_allocation jsonb DEFAULT '{}'::jsonb,
    accounts_snapshot jsonb DEFAULT '{}'::jsonb,
    activated_at timestamp without time zone,
    activated_transactions integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id integer DEFAULT 1,
    metadata jsonb DEFAULT '{}'::jsonb,
    distribution_model character varying(50) DEFAULT 'weighted'::character varying,
    total_capital_investment numeric(15,2) DEFAULT 0,
    capital_fully_reimbursed boolean DEFAULT false,
    reimbursement_target_date date
);


--
-- Name: COLUMN projects.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.metadata IS 'Données spécifiques au type de projet (CARRIERE, EXPORT, PRODUCTFLIP, LIVESTOCK)';


--
-- Name: COLUMN projects.distribution_model; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.distribution_model IS 'Type de distribution: weighted, equal, custom';


--
-- Name: COLUMN projects.total_capital_investment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.total_capital_investment IS 'Montant total investi à rembourser';


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: receivables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receivables (
    id integer NOT NULL,
    account_id integer NOT NULL,
    person text NOT NULL,
    description text,
    amount numeric(14,2) NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_account_id integer,
    target_account_id integer,
    user_id integer DEFAULT 1
);


--
-- Name: receivables_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.receivables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: receivables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.receivables_id_seq OWNED BY public.receivables.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    token character varying(500) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer DEFAULT 1
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: sops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sops (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    owner character varying(100),
    steps jsonb,
    avg_time integer,
    status character varying(50) DEFAULT 'draft'::character varying,
    category character varying(100),
    checklist jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    project_id integer,
    last_review timestamp without time zone
);


--
-- Name: sops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sops_id_seq OWNED BY public.sops.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    priority character varying(50) DEFAULT 'medium'::character varying,
    due_date timestamp without time zone,
    assignee character varying(100),
    status character varying(50) DEFAULT 'todo'::character varying,
    sop_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    project_id integer
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: transaction_linking_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_linking_log (
    id integer NOT NULL,
    transaction_id integer NOT NULL,
    project_line_id integer NOT NULL,
    line_type character varying(20) NOT NULL,
    action character varying(20) NOT NULL,
    performed_by character varying(100),
    performed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    CONSTRAINT transaction_linking_log_action_check CHECK (((action)::text = ANY ((ARRAY['linked'::character varying, 'unlinked'::character varying, 'updated'::character varying])::text[]))),
    CONSTRAINT transaction_linking_log_line_type_check CHECK (((line_type)::text = ANY ((ARRAY['expense'::character varying, 'revenue'::character varying])::text[])))
);


--
-- Name: transaction_linking_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transaction_linking_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transaction_linking_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transaction_linking_log_id_seq OWNED BY public.transaction_linking_log.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    account_id integer NOT NULL,
    type character varying(20) NOT NULL,
    amount numeric(15,2) NOT NULL,
    category character varying(100) NOT NULL,
    description text,
    transaction_date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_planned boolean DEFAULT false,
    project_id integer,
    is_posted boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    project_line_id text,
    linked_at timestamp without time zone,
    linked_by character varying(100) DEFAULT NULL::character varying,
    user_id integer DEFAULT 1,
    remarks text,
    CONSTRAINT transactions_type_check CHECK (((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying, 'transfer'::character varying])::text[])))
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: v_project_progress; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_project_progress AS
 SELECT p.id,
    p.name,
    p.status,
    p.total_cost,
    p.total_revenues,
    p.net_profit,
    ( SELECT count(*) AS count
           FROM public.project_expense_lines
          WHERE (project_expense_lines.project_id = p.id)) AS total_expense_lines,
    ( SELECT count(*) AS count
           FROM public.project_expense_lines
          WHERE ((project_expense_lines.project_id = p.id) AND (project_expense_lines.is_paid = true))) AS paid_expense_lines,
    ( SELECT COALESCE(sum(project_expense_lines.projected_amount), (0)::numeric) AS "coalesce"
           FROM public.project_expense_lines
          WHERE (project_expense_lines.project_id = p.id)) AS total_projected_expenses,
    ( SELECT COALESCE(sum(project_expense_lines.actual_amount), (0)::numeric) AS "coalesce"
           FROM public.project_expense_lines
          WHERE ((project_expense_lines.project_id = p.id) AND (project_expense_lines.is_paid = true))) AS total_paid_expenses,
    ( SELECT count(*) AS count
           FROM public.project_revenue_lines
          WHERE (project_revenue_lines.project_id = p.id)) AS total_revenue_lines,
    ( SELECT count(*) AS count
           FROM public.project_revenue_lines
          WHERE ((project_revenue_lines.project_id = p.id) AND (project_revenue_lines.is_received = true))) AS received_revenue_lines,
    ( SELECT COALESCE(sum(project_revenue_lines.projected_amount), (0)::numeric) AS "coalesce"
           FROM public.project_revenue_lines
          WHERE (project_revenue_lines.project_id = p.id)) AS total_projected_revenues,
    ( SELECT COALESCE(sum(project_revenue_lines.actual_amount), (0)::numeric) AS "coalesce"
           FROM public.project_revenue_lines
          WHERE ((project_revenue_lines.project_id = p.id) AND (project_revenue_lines.is_received = true))) AS total_received_revenues,
    ( SELECT COALESCE(sum(transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.transactions
          WHERE ((transactions.project_id = p.id) AND ((transactions.type)::text = 'expense'::text))) AS real_expenses,
    ( SELECT COALESCE(sum(transactions.amount), (0)::numeric) AS "coalesce"
           FROM public.transactions
          WHERE ((transactions.project_id = p.id) AND ((transactions.type)::text = 'income'::text))) AS real_revenues,
        CASE
            WHEN (p.total_cost > (0)::numeric) THEN round(((( SELECT COALESCE(sum(project_expense_lines.actual_amount), (0)::numeric) AS "coalesce"
               FROM public.project_expense_lines
              WHERE ((project_expense_lines.project_id = p.id) AND (project_expense_lines.is_paid = true))) / p.total_cost) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS expense_progress_pct,
        CASE
            WHEN (p.total_revenues > (0)::numeric) THEN round(((( SELECT COALESCE(sum(project_revenue_lines.actual_amount), (0)::numeric) AS "coalesce"
               FROM public.project_revenue_lines
              WHERE ((project_revenue_lines.project_id = p.id) AND (project_revenue_lines.is_received = true))) / p.total_revenues) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS revenue_progress_pct
   FROM public.projects p;


--
-- Name: v_transactions; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_transactions AS
 SELECT transactions.id,
    transactions.account_id,
    transactions.type,
    transactions.amount,
    transactions.category,
    transactions.description,
    transactions.transaction_date AS date,
    transactions.created_at,
    transactions.is_planned,
    transactions.project_id,
    transactions.is_posted,
    transactions.updated_at,
    transactions.project_line_id,
    transactions.linked_at,
    transactions.linked_by,
    transactions.user_id
   FROM public.transactions;


--
-- Name: visions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visions (
    id integer NOT NULL,
    content text,
    mission text,
    "values" jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: visions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visions_id_seq OWNED BY public.visions.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: content_derivatives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_derivatives ALTER COLUMN id SET DEFAULT nextval('public.content_derivatives_id_seq'::regclass);


--
-- Name: content_master id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_master ALTER COLUMN id SET DEFAULT nextval('public.content_master_id_seq'::regclass);


--
-- Name: derivatives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.derivatives ALTER COLUMN id SET DEFAULT nextval('public.derivatives_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: master_content id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_content ALTER COLUMN id SET DEFAULT nextval('public.master_content_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: objectives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives ALTER COLUMN id SET DEFAULT nextval('public.objectives_id_seq'::regclass);


--
-- Name: operator_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_tasks ALTER COLUMN id SET DEFAULT nextval('public.operator_tasks_id_seq'::regclass);


--
-- Name: partner_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payments ALTER COLUMN id SET DEFAULT nextval('public.partner_payments_id_seq'::regclass);


--
-- Name: profit_distributions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_distributions ALTER COLUMN id SET DEFAULT nextval('public.profit_distributions_id_seq'::regclass);


--
-- Name: project_expense_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expense_lines ALTER COLUMN id SET DEFAULT nextval('public.project_expense_lines_id_seq'::regclass);


--
-- Name: project_partners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_partners ALTER COLUMN id SET DEFAULT nextval('public.project_partners_id_seq'::regclass);


--
-- Name: project_revenue_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_revenue_lines ALTER COLUMN id SET DEFAULT nextval('public.project_revenue_lines_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: receivables id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables ALTER COLUMN id SET DEFAULT nextval('public.receivables_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: sops id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sops ALTER COLUMN id SET DEFAULT nextval('public.sops_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: transaction_linking_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_linking_log ALTER COLUMN id SET DEFAULT nextval('public.transaction_linking_log_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: visions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visions ALTER COLUMN id SET DEFAULT nextval('public.visions_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.accounts (id, name, balance, type, created_at, updated_at, user_id, last_import_date) FROM stdin;
1	Argent Liquide	229492.00	cash	2025-12-14 16:48:13.456	2026-01-06 20:39:54.027845	1	\N
2	MVola	5275.00	mobile	2025-12-14 16:48:13.463	2026-01-06 20:39:54.029935	1	\N
3	Orange Money	6541.00	mobile	2025-12-14 16:48:13.473	2026-01-06 20:39:54.044106	1	\N
4	Compte BOA	3502.00	bank	2025-12-14 16:48:13.482	2026-01-06 20:39:54.046572	1	\N
5	Coffre	40000000.00	cash	2025-12-14 16:48:13.49	2026-01-06 20:39:54.049143	1	\N
6	Redotpay	0.00	digital	2025-12-14 16:48:13.498	2026-01-06 20:39:54.05206	1	\N
7	Receivables	10921300.00	receivables	2025-12-14 16:48:13.504	2026-01-06 20:39:54.054126	1	\N
\.


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_settings (id, pin_hash, is_masked, auto_lock_minutes, created_at, updated_at) FROM stdin;
1	$2a$10$NKVAn1mURafGP55zRFyvW.KPTkVRc3HoJL5gf8lN/gWBfLlg5tB8.	f	5	2025-12-04 05:04:30.542137	2025-12-04 05:04:30.542137
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, type, created_at, user_id) FROM stdin;
1	Recettes	income	2025-11-13 19:52:32.766771-08	1
2	Encaissement	income	2025-11-13 19:52:32.766771-08	1
3	Transfer (Inward)	income	2025-11-13 19:52:32.766771-08	1
4	Bonus Mvola	income	2025-11-13 19:52:32.766771-08	1
5	Apport Pour Différence	income	2025-11-13 19:52:32.766771-08	1
6	Quotidienne	expense	2025-11-13 19:52:32.766771-08	1
7	Transport	expense	2025-11-13 19:52:32.766771-08	1
8	Afterwork	expense	2025-11-13 19:52:32.766771-08	1
9	Goûters	expense	2025-11-13 19:52:32.766771-08	1
10	Hébergement	expense	2025-11-13 19:52:32.766771-08	1
11	Soins personnels	expense	2025-11-13 19:52:32.766771-08	1
12	Habillements	expense	2025-11-13 19:52:32.766771-08	1
13	Accessoires	expense	2025-11-13 19:52:32.766771-08	1
14	Crédits Phone	expense	2025-11-13 19:52:32.766771-08	1
15	Cadeaux - offerts	expense	2025-11-13 19:52:32.766771-08	1
16	Faire les courses	expense	2025-11-13 19:52:32.766771-08	1
17	HOME MJG	expense	2025-11-13 19:52:32.766771-08	1
18	Automobile	expense	2025-11-13 19:52:32.766771-08	1
19	Utilitaires	expense	2025-11-13 19:52:32.766771-08	1
20	Provision N&P	expense	2025-11-13 19:52:32.766771-08	1
21	VINA	expense	2025-11-13 19:52:32.766771-08	1
22	Commission	expense	2025-11-13 19:52:32.766771-08	1
23	Frais	expense	2025-11-13 19:52:32.766771-08	1
24	Réparation TECHNO	expense	2025-11-13 19:52:32.766771-08	1
25	Facebook AD	expense	2025-11-13 19:52:32.766771-08	1
26	Frais DOM	expense	2025-11-13 19:52:32.766771-08	1
27	Transfer (Outward)	expense	2025-11-13 19:52:32.766771-08	1
28	DOIT	expense	2025-11-13 19:52:32.766771-08	1
29	Aide	expense	2025-11-13 19:52:32.766771-08	1
30	Dons	expense	2025-11-13 19:52:32.766771-08	1
31	Transfert	expense	2025-11-13 19:52:32.766771-08	1
32	INVEST	expense	2025-11-13 19:52:32.766771-08	1
33	Allocation Familiale	expense	2025-11-13 19:52:32.766771-08	1
34	Retrait OM	expense	2025-11-13 19:52:32.766771-08	1
35	Retrait DAB MJG	expense	2025-11-13 19:52:32.766771-08	1
36	Frais Pack MID (BOA)	expense	2025-11-13 19:52:32.766771-08	1
37	SAROBIDY	expense	2025-11-13 19:52:32.766771-08	1
38	Autres	expense	2025-11-13 19:52:32.766771-08	1
39	Extra NON SUIVI ❎	expense	2025-11-13 19:52:32.766771-08	1
\.


--
-- Data for Name: content_derivatives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.content_derivatives (id, master_id, platform, type, status, reach, created_at) FROM stdin;
\.


--
-- Data for Name: content_master; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.content_master (id, title, type, duration, reach, engagement, created_date) FROM stdin;
\.


--
-- Data for Name: derivatives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.derivatives (id, master_id, platform, adapted_content, format, status, published_at, engagement_metrics, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, first_name, last_name, photo, "position", department, email, phone, facebook, linkedin, location, salary, start_date, end_date, contract_type, status, skills, projects, emergency_contact, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: master_content; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.master_content (id, title, type, original_content, target_audience, tone, keywords, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notes (id, content, created_at, updated_at) FROM stdin;
1	@DELAH:\n-arrivée des plongeurs Dimanche\n-départ MARDI\n-trano hipetrahany: 50.000ar (bandy 03 lahy)\n-@RAFILY: samia mitady trano\n-Bandy 03: 500.000f x 04 pers (DELAH y compris).\n-TSIKIVY, TONY, NAIVO...\nTOTAL: 2.000.000 + 250.000 = 2.250.000fmg\n+ EXTRA: 250.000fmg\n= BAZAR: 250.000fmg\nTOTAL: 3.250.000fmg (650.000ar) - 08/12/25\n\n\n	2025-12-07 21:21:00.548933	2025-12-16 01:05:07.356
5	Carrière: 70M ar\nMode de paiement: 10M ar + 25M ar (avant 31/12) + 35M ar (fin JAN 2026)\nPermis: PRE\nLieu: MAROVOAY - MAHAJANGA\nSubstances: AGATE, JASPE, CRISTAL, AMETHYSTE, QUARTZ ROSE\nLP1: demande de LP1 dans 48H, OV à payer: regler par le client (LP1 AGATE: 300ar/kg) \nProduction en substances: mains d'oeuvre à employer \nFA: HETRA HALOHA ISAN-TAONA (à expliquer par le proprio)\n------\n	2025-12-13 02:41:17.700592	2025-12-18 02:35:29.955
8	NATIORA\n\nCAPEX NON PAYEES:\nIDs 280-283 - NON PAYÉS ❌ (22,472,800 Ar):\n\n280: Achat 500 poussins poulets de chair: 2,100,000 Ar ❌\n281: Aliment poulets de chair (cycle complet): 5,062,800 Ar ❌\n282: Achat 200 oisons: 5,000,000 Ar ❌\n283: Aliment + vitamines oies (cycle complet): 4,710,000 Ar ❌\n\n\n| Catégorie         | Nombre | Montant Total  | Statut    |\n| ----------------- | ------ | -------------- | --------- |\n| Cycles Poulets    | 8      | 57,302,400 Ar  | ❌ À payer |\n| Cycles Oies       | 4      | 38,840,000 Ar  | ❌ À payer |\n| Salaires mensuels | 12     | 3,600,000 Ar   | ❌ À payer |\n| Loyer mensuels    | 12     | 2,000,004 Ar   | ❌ À payer |\n| CAPEX payés       | 6      | 8,535,000 Ar   | ✅ Payé    |\n| CAPEX non payés   | 4      | 22,472,800 Ar  | ❌ À payer |\n| TOTAL GÉNÉRAL     | 46     | 132,750,204 Ar | ✅         |\n\nAliment + vitamines oies (cycle complet)\n01/03/2026\n4 710 000 Ar	2026-01-01 20:02:44.681122	2026-01-06 21:21:48.687519
7	## Système de Partage des Bénéfices - Projet Natiora 2026\n\nJ'ai établi un système complet de distribution des bénéfices selon les cycles réels de votre business plan avec une approche bi-mestrielle (tous les 2 mois). Le modèle intègre vos 100% d'apport en capital (25 407 800 Ar) et la répartition entre 3 associés avec remboursement prioritaire.[1]\n\n### Calendrier de Production et Revenus\n\nVotre projet génère des revenus selon ces cycles opérationnels:[1]\n\n- **Poulets de chair**: 8 cycles/an (45 jours/cycle) = 96 000 000 Ar/an\n- **Oies**: 4 cycles/an (12 semaines/cycle) = 58 900 000 Ar/an  \n- **Kuroiler**: Production continue = 3 195 000 Ar/an\n\nLe calendrier bi-mestriel montre une alternance de périodes à haute et basse productivité, avec des profits variant de 4 436 366 Ar à 14 288 566 Ar par bimestre .\n\n### Mécanisme de Distribution en Deux Phases\n\n**Phase 1 - Remboursement (Bimestres 1-3)**\n\nDurant les 5 premiers mois, la distribution prioritise le remboursement de votre investissement initial :\n\n| Bimestre | Profit | Vous (80%) | Associé 2 (10%) | Associé 3 (10%) | Remboursement Cumulé |\n|----------|--------|------------|-----------------|-----------------|----------------------|\n| 1 (Jan-Fév) | 14 288 566 Ar | 11 430 853 Ar | 1 428 857 Ar | 1 428 857 Ar | 44.99% |\n| 2 (Mar-Avr) | 9 273 566 Ar | 7 418 853 Ar | 927 357 Ar | 927 357 Ar | 74.19% |\n| 3 (Mai-Juin) | 9 451 366 Ar | 7 561 093 Ar | 945 137 Ar | 945 137 Ar | **100%** ✅ |\n\nVotre capital est entièrement remboursé dès le **Bimestre 3 (fin Mai-Juin 2026)** .\n\n**Phase 2 - Distribution Normale (Bimestres 4-6)**\n\nAprès remboursement complet, la répartition bascule vers la distribution normale selon l'apport et le travail :\n\n| Bimestre | Profit | Vous (70%) | Associé 2 (18%) | Associé 3 (12%) |\n|----------|--------|------------|-----------------|-----------------|\n| 4 (Juil-Août) | 4 436 366 Ar | 3 105 456 Ar | 798 546 Ar | 532 364 Ar |\n| 5 (Sept-Oct) | 9 451 366 Ar | 6 615 956 Ar | 1 701 246 Ar | 1 134 164 Ar |\n| 6 (Nov-Déc) | 4 436 366 Ar | 3 105 456 Ar | 798 546 Ar | 532 364 Ar |\n\n### Résumé Annuel 2026\n\nLe système génère une distribution totale équilibrée sur l'année :\n\n- **Total à distribuer**: 51 337 596 Ar (profit net opérationnel)\n- **Vous**: 39 237 667 Ar (76.4% de l'année - moyenne pondérée)\n- **Associé 2**: 6 599 687 Ar (12.9%)\n- **Associé 3**: 5 500 242 Ar (10.7%)\n\nVotre investissement de 25 407 800 Ar est remboursé à 100% avant la fin du premier semestre, puis vous continuez à percevoir 70% des profits pour reconnaître votre risque financier initial .\n\n### Avantages du Modèle\n\nCette structure bi-mestrielle synchronise les distributions avec les cycles réels de vente des poulets et oies, assurant une liquidité suffisante pour chaque paiement. La phase de remboursement accélérée (6 mois) réduit votre exposition au risque tout en maintenant une rémunération équitable pour les associés opérationnels dès le démarrage .[1]\n	2025-12-14 09:38:02.433154	2026-01-05 20:00:10.651
\.


--
-- Data for Name: objectives; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.objectives (id, title, description, category, deadline, budget, progress, completed, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: operator_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operator_tasks (id, title, description, priority, status, due_date, assigned_to, sop_id, project_id, category, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: partner_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.partner_payments (id, distribution_id, partner_id, partner_name, amount_allocated, percentage_applied, is_paid, payment_date, payment_account_id, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: profit_distributions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profit_distributions (id, project_id, distribution_period, period_start_date, period_end_date, total_revenue, total_costs, profit_to_distribute, distribution_phase, capital_reimbursed_cumulative, reimbursement_percentage, is_distributed, distribution_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_expense_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_expense_lines (id, project_id, description, category, projected_amount, actual_amount, transaction_date, is_paid, created_at, last_synced_at, transaction_id) FROM stdin;
367	22	Courroie 12.5x1900 Comp	Investissement	30000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
368	22	Huile 20W50 5L Comp	Investissement	70000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
369	22	Huile 15W50 4L Comp	Investissement	130000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
370	22	T/port + Logistique Flpt	Investissement	25000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
371	22	Commission @HIROKO	Investissement	859000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
372	22	DOIT @DELAH	Investissement	805000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
373	22	@DELAH (2025-11-13)	Dépense Réelle	72000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
374	22	Frais M/va -> T/ve @DELAH @ZOKINY (2025-11-24)	Dépense Réelle	143600.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
375	22	@TSIKIVY @DELAH (2025-11-29)	Dépense Réelle	178600.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
376	22	@DELAH (2025-12-01)	Dépense Réelle	2150.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
377	22	DEPART @DELAH (2025-12-02)	Dépense Réelle	608200.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
378	27	Avance @FENO	Commissions	400000.00	0.00	2025-12-24	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
379	27	Commission @ANDRY Syndicat Mines	Commissions	200000.00	0.00	2025-12-28	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
380	27	NEMO EXPORT - Création NIF/STAT/RCS/Sièges	Administratif	2000000.00	0.00	2025-12-28	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
381	27	Avance #2 FENO	Autre	200000.00	0.00	2026-01-02	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
382	27	CIN @FENO	Administratif	100000.00	0.00	2026-01-05	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
383	27	AVANCE DEPOT	Administratif	400000.00	0.00	2026-01-05	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
384	27	RESTE DEPOT	Administratif	400000.00	0.00	2026-01-15	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
385	27	Bulletin N°3 @FENO	Administratif	50000.00	0.00	2026-01-05	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
386	28	AVANCE #1	Permis & Admin	10000000.00	0.00	2025-12-19	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
344	22	Sondeur	Investissement	160000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
345	22	Compresseur	Investissement	9000000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
346	22	Moteur YAMAHA 25CV 4T	Investissement	7000000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
387	28	AVANCE #2	Permis & Admin	25000000.00	0.00	2025-12-28	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
388	28	RESTE TOTAL	Permis & Admin	35000000.00	0.00	2026-01-31	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
389	32	Préparation création de la société	Administratif	250000.00	0.00	2025-12-29	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
390	32	CIN + Casier @NAYA	Administratif	150000.00	0.00	2026-01-05	t	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
347	22	Poire	Investissement	50000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
348	22	Sakafo @DELAH TMV	Investissement	10000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
349	22	Chambre + sakafo + frais @DELAH TMV	Investissement	95000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
350	22	Logistique TMV-FLPT	Investissement	25000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
351	22	Fatana	Investissement	5500.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
352	22	Essai essence 5L + huile 5L + Tport moteur	Investissement	42000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
353	22	Huille moteur	Investissement	70000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
354	22	Scotch	Investissement	6500.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
355	22	Calle moteur	Investissement	10000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
356	22	Clés/Outils	Investissement	34500.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
357	22	T/port TNR-TMV (mercredi/lun)	Investissement	80000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
358	22	Sakafo an-dalana (aller-retour)	Investissement	20000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
359	22	Hebergement TMV (jeu/ven/sam/dim)	Investissement	247500.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
360	22	Sakafo TMV (matin/midi/soir) jeu,ven,sam, dim, lun	Investissement	35000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
361	22	Déplacement TMV (bajaj)	Investissement	20000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
322	\N	CIN @FENO	Administratif	100000.00	0.00	2026-01-03	f	2026-01-04 19:59:19.740184	\N	\N
362	22	T/port TMV-FLPT (aller-retour)	Investissement	20000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
363	22	Sakafo FLPT (ven)	Investissement	11000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
364	22	Déplacement FLTP (essence)	Investissement	15000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
365	22	Ecart	Investissement	403000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
366	22	Batterie 80A SSOYDD	Investissement	230000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
231	\N	Préparation et Création papiers SARLU (EDBM/MINES MAJUNGA)	Administratif	250000.00	0.00	2025-12-29	f	2025-12-28 23:37:27.162428	\N	\N
324	\N	CIN @FENO	Administratif	100000.00	0.00	2026-01-03	f	2026-01-04 19:59:36.721512	\N	\N
333	24	Bâtiment Oies (60 m²)	CAPEX	2750000.00	0.00	2025-12-11	t	2026-01-06 20:51:12.503093	2026-01-06 20:56:34.493434	\N
334	24	Bâtiment Kuroiler (40 m²)	CAPEX	2000000.00	0.00	2025-12-12	t	2026-01-06 20:51:12.503093	2026-01-06 20:56:34.493434	\N
335	24	Bâtiment Poulets locaux (40 m²)	CAPEX	1785000.00	0.00	2025-12-12	t	2026-01-06 20:51:12.503093	2026-01-06 20:56:34.493434	\N
336	24	Équipements durables (mangeoires, abreuvoirs, ventilation)	Équipements	1200000.00	0.00	2026-01-02	t	2026-01-06 20:51:12.503093	2026-01-06 20:56:34.493434	\N
337	24	Clôture et sécurité site Bypass	Clôture	300000.00	0.00	2025-12-12	t	2026-01-06 20:51:12.503093	2026-01-06 20:56:34.493434	\N
338	24	Fonds de roulement initial	Fonds de roulement	500000.00	0.00	2025-12-12	t	2026-01-06 20:51:12.503093	2026-01-06 20:56:34.493434	\N
339	24	Achat 500 poussins poulets de chair	Poussins	2100000.00	0.00	2026-02-05	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
340	24	Aliment poulets de chair (cycle complet)	Provende	5062800.00	0.00	2026-02-05	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
341	24	Achat 200 oisons	Oisons	5000000.00	0.00	2026-03-01	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
225	\N	Commission @ANDRY Syndicat Mines	Commissions	200000.00	0.00	2025-12-21	f	2025-12-27 21:17:29.408364	\N	\N
342	24	Aliment + vitamines oies (cycle complet)	Provende	4710000.00	0.00	2026-03-01	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
224	\N	Commission @ANDRY Syndicat	Commissions	200000.00	0.00	2025-12-21	f	2025-12-27 21:08:33.374364	\N	\N
343	22	GPS	Investissement	980000.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
\.


--
-- Data for Name: project_partners; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_partners (id, project_id, partner_name, partner_role, capital_contribution, contribution_percentage, phase1_percentage, phase2_percentage, is_capital_investor, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_revenue_lines; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_revenue_lines (id, project_id, description, category, projected_amount, actual_amount, transaction_date, is_received, created_at, last_synced_at, transaction_id) FROM stdin;
137	22		Autre	0.00	0.00	2025-12-19	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
134	24	Vente poulets de chair (8 cycles / an)	Ventes Poulets	96000000.00	0.00	2026-12-31	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
135	24	Vente oies (4 cycles / an)	Ventes Oies	58900000.00	0.00	2026-12-31	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
136	24	Marge nette annuelle Kuroiler	Ventes Kuroiler	3195000.00	0.00	2026-12-31	f	2026-01-06 20:51:12.503093	2026-01-06 20:54:58.007199	\N
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, name, description, type, status, frequency, occurrences_count, unit_volume, unit_label, price_per_unit, cost_per_unit, start_date, end_date, total_cost, total_revenues, net_profit, roi, profit_per_occurrence, margin_percent, break_even_units, feasible, remaining_budget, total_available, expenses, revenues, allocation, revenue_allocation, accounts_snapshot, activated_at, activated_transactions, created_at, updated_at, user_id, metadata, distribution_model, total_capital_investment, capital_fully_reimbursed, reimbursement_target_date) FROM stdin;
24	Natiora – Élevage mixte 2026	Projet d’élevage mixte combinant trois activités principales : Poulets de chair (déjà en activité), Oies, Kuroiler (déjà en activité).	LIVESTOCK	active	\N	1	\N	\N	\N	\N	2025-12-13	2026-12-30	25407800.00	158095000.00	132687200.00	522.20	\N	\N	\N	t	0.00	0.00	[{"id": "684562d8-12b7-419e-a60b-96770a785199", "date": "2025-12-11T21:00:00.000Z", "phase": "CAPEX & Préparation", "amount": 2750000, "account": "Coffre", "category": "CAPEX", "dbLineId": "333", "description": "Bâtiment Oies (60 m²)", "plannedDate": "2025-12-11"}, {"id": "6d4b1247-58fc-4b1d-bdda-ea444425e6c4", "date": "2025-12-12T00:00:00.000Z", "phase": "CAPEX & Préparation", "amount": 2000000, "account": "Coffre", "category": "CAPEX", "dbLineId": "334", "description": "Bâtiment Kuroiler (40 m²)", "plannedDate": "2025-12-12"}, {"id": "2e31b89e-63cd-4c82-b659-596e96d445bc", "date": "2025-12-12T00:00:00.000Z", "phase": "CAPEX & Préparation", "amount": 1785000, "account": "Coffre", "category": "CAPEX", "dbLineId": "335", "description": "Bâtiment Poulets locaux (40 m²)", "plannedDate": "2025-12-12"}, {"id": "275a6f0f-36af-4a1d-b444-669708aca883", "date": "2026-01-02T04:11:39.081Z", "phase": "CAPEX & Préparation", "amount": 1200000, "account": "Coffre", "category": "Équipements", "dbLineId": "336", "description": "Équipements durables (mangeoires, abreuvoirs, ventilation)", "plannedDate": "2026-01-02"}, {"id": "72c6676c-f1dc-4c90-96c0-5bed5c38b723", "date": "2025-12-12T00:00:00.000Z", "phase": "CAPEX & Préparation", "amount": 300000, "account": "Coffre", "category": "Clôture", "dbLineId": "337", "description": "Clôture et sécurité site Bypass", "plannedDate": "2025-12-12"}, {"id": "cbcf8782-07cc-44ea-be54-c7f26c0ec35c", "date": "2025-12-12T00:00:00.000Z", "phase": "CAPEX & Préparation", "amount": 500000, "account": "Coffre", "category": "Fonds de roulement", "dbLineId": "338", "description": "Fonds de roulement initial", "plannedDate": "2025-12-12"}, {"id": "883492ed-c4a9-4d31-b691-c22b4fa928ca", "date": "2026-02-05T00:00:00.000Z", "phase": "Cycle 1 Poulets", "amount": 2100000, "account": "", "category": "Poussins", "dbLineId": "339", "description": "Achat 500 poussins poulets de chair", "plannedDate": "2026-02-05"}, {"id": "1ad143b6-fff4-45a5-8fcc-90fa5d07c3a0", "date": "2026-02-05T00:00:00.000Z", "phase": "Cycle 1 Poulets", "amount": 5062800, "account": "", "category": "Provende", "dbLineId": "340", "description": "Aliment poulets de chair (cycle complet)", "plannedDate": "2026-02-05"}, {"id": "fdc1a7d1-ce27-4f2c-a73b-b3164259b038", "date": "2026-03-01T00:00:00.000Z", "phase": "Cycle 1 Oies", "amount": 5000000, "account": "", "category": "Oisons", "dbLineId": "341", "description": "Achat 200 oisons", "plannedDate": "2026-03-01"}, {"id": "77a7073d-eda2-4005-87f4-bd84dfd666c9", "date": "2026-03-01T00:00:00.000Z", "phase": "Cycle 1 Oies", "amount": 4710000, "account": "", "category": "Provende", "dbLineId": "342", "description": "Aliment + vitamines oies (cycle complet)", "plannedDate": "2026-03-01"}]	[{"id": "913fd76f-efe9-4e3f-bd26-d5bc72cbf1a0", "date": "2026-12-31T00:00:00.000Z", "phase": "Cycles Poulets A1", "amount": 96000000, "account": "", "category": "Ventes Poulets", "dbLineId": "134", "description": "Vente poulets de chair (8 cycles / an)", "plannedDate": ["2026-12-31", "00:00:00.000Z"]}, {"id": "2b1e88ba-984d-4eec-a18d-49f71f24b187", "date": "2026-12-31T00:00:00.000Z", "phase": "Cycles Oies A1", "amount": 58900000, "account": "", "category": "Ventes Oies", "dbLineId": "135", "description": "Vente oies (4 cycles / an)", "plannedDate": ["2026-12-31", "00:00:00.000Z"]}, {"id": "cdb5636f-ae13-46b7-a531-7adb8405bb54", "date": "2026-12-31T00:00:00.000Z", "phase": "Kuroiler", "amount": 3195000, "account": "", "category": "Ventes Kuroiler", "dbLineId": "136", "description": "Marge nette annuelle Kuroiler", "plannedDate": ["2026-12-31", "00:00:00.000Z"]}]	{}	{}	{}	\N	0	2025-12-07 03:22:43.193	2026-01-06 20:59:10.099401	1	{}	weighted	0.00	f	\N
22	PLG FLPT - Campagne Pêche Complete	Investissements déjà réalisés + logistique future + ventes prévues.	ponctuel	active	\N	1	\N	\N	\N	\N	2025-11-24	2025-12-20	21493550.00	0.00	-21493550.00	-100.00	\N	\N	\N	t	\N	\N	[{"id": "e00adff4-b4d9-451b-aa52-78a5d60e4a1d", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 980000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "172", "description": "GPS", "isRecurring": false}, {"id": "bd15e1c6-dbf4-4e75-824c-9eb1c6765f38", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 160000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "173", "description": "Sondeur", "isRecurring": false}, {"id": "de3761a2-d9fd-41e7-a1fa-ca4786d686bb", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 9000000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "174", "description": "Compresseur", "isRecurring": false}, {"id": "d776e6ca-6de5-4b86-bdae-0bee9668b6c2", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 7000000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "175", "description": "Moteur YAMAHA 25CV 4T", "isRecurring": false}, {"id": "fefc68c1-ac96-4d48-a146-c9873e3f9268", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 50000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "176", "description": "Poire", "isRecurring": false}, {"id": "80362337-8eff-4ed6-8ad7-ffb222a61c32", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 10000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "177", "description": "Sakafo @DELAH TMV", "isRecurring": false}, {"id": "8910bcac-566e-4934-9ad6-bfd652d5c06f", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 95000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "178", "description": "Chambre + sakafo + frais @DELAH TMV", "isRecurring": false}, {"id": "d56070a2-2810-44a9-bfd0-f99980076758", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 25000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "179", "description": "Logistique TMV-FLPT", "isRecurring": false}, {"id": "ad233a61-7955-4eb6-9710-58bd73ec595d", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 5500, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "180", "description": "Fatana", "isRecurring": false}, {"id": "015aa8dc-40a2-4ea6-9f3a-52419aff787d", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 42000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "181", "description": "Essai essence 5L + huile 5L + Tport moteur", "isRecurring": false}, {"id": "cb7c288c-e9ec-4147-80ed-0a90c3ef2f7a", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 70000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "182", "description": "Huille moteur", "isRecurring": false}, {"id": "9fa1b957-64a7-4628-9db4-30f9bd606a7d", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 6500, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "183", "description": "Scotch", "isRecurring": false}, {"id": "5c7b1d63-c220-48ab-afca-0b0586b099f7", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 10000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "184", "description": "Calle moteur", "isRecurring": false}, {"id": "4d81689b-2edd-43eb-a5ed-c6d7ad7b432a", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 34500, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "185", "description": "Clés/Outils", "isRecurring": false}, {"id": "ac437343-a14d-4189-8aae-552500f71949", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 80000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "186", "description": "T/port TNR-TMV (mercredi/lun)", "isRecurring": false}, {"id": "09d152a0-253e-4fc9-bdae-c4f05974ded4", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 20000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "187", "description": "Sakafo an-dalana (aller-retour)", "isRecurring": false}, {"id": "9f95b32b-be77-49da-9bd3-6315ae3ad44e", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 247500, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "188", "description": "Hebergement TMV (jeu/ven/sam/dim)", "isRecurring": false}, {"id": "411e197d-fef9-4ed3-b502-58659f68ac26", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 35000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "189", "description": "Sakafo TMV (matin/midi/soir) jeu,ven,sam, dim, lun", "isRecurring": false}, {"id": "e5f63079-83f7-4ced-9d36-da3d9c7975ad", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 20000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "190", "description": "Déplacement TMV (bajaj)", "isRecurring": false}, {"id": "0ba664dd-b81d-4db0-91ec-b150052e2df8", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 20000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "191", "description": "T/port TMV-FLPT (aller-retour)", "isRecurring": false}, {"id": "16eb4e76-e7c9-4acd-8f38-fa941c25fb1f", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 11000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "192", "description": "Sakafo FLPT (ven)", "isRecurring": false}, {"id": "976e2a0a-8ed6-4d41-8f09-b34e4c3c5d9d", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 15000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "193", "description": "Déplacement FLTP (essence)", "isRecurring": false}, {"id": "e6f60152-c625-471b-a694-d1fb70361979", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 403000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "194", "description": "Ecart", "isRecurring": false}, {"id": "e174709e-9da2-4849-9377-c59cd11712b4", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 230000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "195", "description": "Batterie 80A SSOYDD", "isRecurring": false}, {"id": "fe54025e-cd16-4782-a2b7-ac218b64a098", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 30000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "196", "description": "Courroie 12.5x1900 Comp", "isRecurring": false}, {"id": "355f77ae-ab76-4f86-840b-b5a5da541da9", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 70000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "197", "description": "Huile 20W50 5L Comp", "isRecurring": false}, {"id": "eb1e4f91-2ce0-4308-a707-fc2b515a5a59", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 130000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "198", "description": "Huile 15W50 4L Comp", "isRecurring": false}, {"id": "60e6b7a8-7221-4d10-a4a8-460f252065c7", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 25000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "199", "description": "T/port + Logistique Flpt", "isRecurring": false}, {"id": "7fc0ff69-d9d3-4848-89bc-f256710139bc", "date": "2025-12-19T08:19:54.214Z", "amount": 859000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "200", "description": "Commission @HIROKO", "isRecurring": false}, {"id": "22752fda-cfa4-4be8-979e-70823130e41a", "date": "2025-12-19T08:19:54.214Z", "amount": 805000, "account": "Déjà Payé", "category": "Investissement", "dbLineId": "201", "description": "DOIT @DELAH", "isRecurring": false}, {"id": "3d8b0f3c-d85d-43c6-a810-e08ac6d7e4bc", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 72000, "account": "Déjà Payé", "category": "Dépense Réelle", "dbLineId": "202", "description": "@DELAH (2025-11-13)", "isRecurring": false}, {"id": "8556020a-decb-46cb-a544-5b3fde87ad56", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 143600, "account": "Déjà Payé", "category": "Dépense Réelle", "dbLineId": "203", "description": "Frais M/va -> T/ve @DELAH @ZOKINY (2025-11-24)", "isRecurring": false}, {"id": "5fed133a-2430-49dd-945f-d886b3743ad0", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 178600, "account": "Déjà Payé", "category": "Dépense Réelle", "dbLineId": "204", "description": "@TSIKIVY @DELAH (2025-11-29)", "isRecurring": false}, {"id": "83c5b958-745c-4441-9dbb-36f787ade5a7", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 2150, "account": "Déjà Payé", "category": "Dépense Réelle", "dbLineId": "205", "description": "@DELAH (2025-12-01)", "isRecurring": false}, {"id": "16d13342-74c5-4353-8277-cff4ee621922", "date": "2025-12-19T08:19:54.214Z", "phase": "investissement", "amount": 608200, "account": "Déjà Payé", "category": "Dépense Réelle", "dbLineId": "206", "description": "DEPART @DELAH (2025-12-02)", "isRecurring": false}]	[{"id": "1c7de7b1-f01e-45bb-82f8-077869650e72", "date": "2025-12-19T08:19:54.214Z", "amount": 0, "volume": 0, "account": "", "dbLineId": "90", "description": ""}]	[]	{}	{}	\N	0	2025-12-02 23:14:26.918	2025-12-18 06:20:37.763	1	{}	weighted	0.00	f	\N
27	NEMO EXPORT #001	ENVOI N°001	EXPORT	active	\N	1	\N	\N	\N	\N	2025-12-24	2026-12-30	3750000.00	0.00	-3750000.00	-100.00	\N	\N	\N	t	\N	\N	[{"id": "51788139-9906-4f2a-80c0-2f303a9ea9f5", "date": "2025-12-24T09:34:59.000Z", "amount": 400000, "isPaid": true, "account": "Coffre", "category": "Commissions", "dbLineId": "223", "realDate": "2025-12-23T21:00:00.000Z", "description": "Avance @FENO", "isRecurring": false, "plannedDate": "2025-12-24"}, {"id": "226", "date": "2025-12-28T05:32:35.475Z", "amount": 200000, "isPaid": true, "account": "Coffre", "category": "Commissions", "dbLineId": 226, "realDate": "2025-12-19T21:00:00.000Z", "description": "Commission @ANDRY Syndicat Mines", "isRecurring": false, "plannedDate": "2025-12-28"}, {"id": "222", "date": "2025-12-28T05:39:37.183Z", "amount": 2000000, "isPaid": true, "account": "Coffre", "category": "Administratif", "dbLineId": 222, "realDate": "2025-12-02T21:00:00.000Z", "description": "NEMO EXPORT - Création NIF/STAT/RCS/Sièges", "isRecurring": false, "plannedDate": "2025-12-28"}, {"id": "234", "date": "2026-01-02T04:11:07.553Z", "amount": 200000, "isPaid": true, "account": "Argent Liquide", "category": "Autre", "dbLineId": 234, "realDate": "2025-12-30T21:00:00.000Z", "description": "Avance #2 FENO", "isRecurring": false, "plannedDate": "2026-01-02", "actualAmount": 0, "transactionDate": "2025-12-22T21:00:00.000Z"}, {"id": "326", "date": "2026-01-05T04:11:33.266Z", "amount": 100000, "isPaid": true, "account": "Argent Liquide", "category": "Administratif", "dbLineId": 326, "realDate": "2026-01-01T21:00:00.000Z", "description": "CIN @FENO", "isRecurring": false, "plannedDate": "2026-01-05", "actualAmount": 0, "transactionDate": "2025-12-26T21:00:00.000Z"}, {"id": "328", "date": "2026-01-05T04:12:35.554Z", "amount": 400000, "isPaid": true, "account": "Argent Liquide", "category": "Administratif", "dbLineId": 328, "realDate": "2025-12-31T21:00:00.000Z", "description": "AVANCE DEPOT", "isRecurring": false, "plannedDate": "2026-01-05", "actualAmount": 0, "transactionDate": "2025-12-30T21:00:00.000Z"}, {"id": "00c6375d-dd9b-42bf-97b7-206dd323418e", "date": "2026-01-15T04:12:41.000Z", "amount": 400000, "isPaid": false, "account": "Coffre", "category": "Administratif", "dbLineId": "329", "realDate": "2026-01-14T21:00:00.000Z", "description": "RESTE DEPOT", "isRecurring": false, "plannedDate": "2026-01-15", "actualAmount": 0, "transactionDate": "2026-01-06T21:00:00.000Z"}, {"id": "332", "date": "2026-01-05T13:43:37.842Z", "amount": 50000, "isPaid": true, "account": "Argent Liquide", "category": "Administratif", "dbLineId": 332, "realDate": "2026-01-03T21:00:00.000Z", "description": "Bulletin N°3 @FENO", "isRecurring": false, "plannedDate": "2026-01-05", "actualAmount": 0, "transactionDate": "2026-01-04T21:00:00.000Z"}]	[]	{}	{}	{}	\N	0	2025-12-12 17:54:44.782	2026-01-05 19:35:25.162	1	{}	weighted	0.00	f	\N
28	CARRIERE MAROVOAY	Carrière se trouvant à Marovaoay appartenant à Mme EVA et Mr Sibon Guy	CARRIERE	active	\N	1	\N	\N	\N	\N	2025-12-15	2026-12-27	70000000.00	0.00	-70000000.00	-100.00	\N	\N	\N	t	\N	\N	[{"id": "89b36830-e8e7-4153-84cb-dfb27f4837e2", "date": "2025-12-19T08:25:49.000Z", "amount": 10000000, "isPaid": true, "account": "Coffre", "category": "Permis & Admin", "dbLineId": 235, "description": "AVANCE #1", "isRecurring": false, "plannedDate": "2025-12-19"}, {"id": "84c96b5c-504c-49fd-b1b2-a07fe1dbeb10", "date": "2025-12-28T08:35:22.000Z", "amount": 25000000, "isPaid": true, "account": "Coffre", "category": "Permis & Admin", "dbLineId": 236, "description": "AVANCE #2", "isRecurring": false, "plannedDate": "2025-12-28"}, {"id": "e8f86b0a-d6bf-425f-a2ee-2f4b96060b20", "date": "2026-01-31T08:35:58.000Z", "amount": 35000000, "isPaid": false, "account": "Coffre", "category": "Permis & Admin", "dbLineId": 237, "description": "RESTE TOTAL", "isRecurring": false, "plannedDate": "2026-01-31"}]	[]	{}	{}	{}	\N	0	2025-12-19 12:26:33.455	2025-12-31 18:48:16.302	1	{}	weighted	0.00	f	\N
30	CAPITAL INVESTING	Investissement de capital avec @HUGUES dans un business de cigarettes	PRODUCTFLIP	paused	\N	1	\N	\N	\N	\N	2025-12-15	2026-01-27	7000000.00	30000000.00	23000000.00	328.60	\N	\N	\N	t	\N	\N	[{"id": "596e69fb-e34b-41ba-8671-28cec0237276", "date": "2025-12-19T04:49:47.000Z", "amount": 7000000, "isPaid": true, "account": "Coffre", "category": "Fonds de roulement", "dbLineId": "219", "realDate": "2025-12-17T21:00:00.000Z", "description": "Capital investi", "isRecurring": false, "plannedDate": "2025-12-19"}]	[{"id": "ede4bbbf-65b8-48cc-a2c1-2a237550ae97", "date": "2026-01-15T04:50:15.000Z", "amount": 30000000, "isPaid": false, "account": "Coffre", "category": "Vente", "dbLineId": "94", "realDate": "2026-01-14T21:00:00.000Z", "description": "PART DE BENEFICE", "isRecurring": false, "plannedDate": "2026-01-15"}]	{}	{}	{}	\N	0	2025-12-20 08:50:46.687	2026-01-05 15:46:04.15	1	{}	weighted	0.00	f	\N
32	OREOS EXPORT	Société d'exportation sise à Majunga\nGérante: Haingo Naya	EXPORT	active	\N	1	\N	\N	\N	\N	2026-01-04	2026-06-29	400000.00	0.00	-400000.00	-100.00	\N	\N	\N	t	\N	\N	[{"id": "6ce50a08-8389-4840-a8cb-17eed1dd7bb9", "date": "2025-12-29T04:15:53.000Z", "amount": 250000, "isPaid": true, "account": "Argent Liquide", "category": "Administratif", "dbLineId": 330, "realDate": "2025-12-27T21:00:00.000Z", "description": "Préparation création de la société", "isRecurring": false, "plannedDate": "2025-12-29", "actualAmount": 0, "transactionDate": "2026-01-04T21:00:00.000Z"}, {"id": "331", "date": "2026-01-05T11:29:42.067Z", "amount": 150000, "isPaid": true, "account": "Argent Liquide", "category": "Administratif", "dbLineId": 331, "realDate": "2025-12-28T21:00:00.000Z", "description": "CIN + Casier @NAYA", "isRecurring": false, "plannedDate": "2026-01-05", "actualAmount": 0, "transactionDate": "2026-01-04T21:00:00.000Z"}]	[]	{}	{}	{}	\N	0	2026-01-04 17:21:53.155	2026-01-05 00:30:03.241	1	{}	weighted	0.00	f	\N
\.


--
-- Data for Name: receivables; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.receivables (id, account_id, person, description, amount, status, created_at, updated_at, source_account_id, target_account_id, user_id) FROM stdin;
1	7	RANDOU	Migration AVOIR initial	2812800.00	open	2025-12-05 23:36:21.279-08	2025-12-05 23:36:21.279-08	\N	\N	1
2	7	LALAINA_MJG	AVOIR initial - Débourse depuis Argent Liquide	2000000.00	open	2025-12-05 23:36:21.279-08	2025-12-05 23:36:21.279-08	1	\N	1
3	7	TAHIANA	Migration AVOIR initial	3500000.00	open	2025-12-05 23:36:21.279-08	2025-12-05 23:36:21.279-08	\N	\N	1
4	7	NAIVO	Migration AVOIR initial	500000.00	open	2025-12-05 23:36:21.279-08	2025-12-05 23:36:21.279-08	\N	\N	1
5	7	HIROKO	Migration AVOIR initial	1008500.00	open	2025-12-05 23:36:21.279-08	2025-12-05 23:36:21.279-08	\N	\N	1
6	7	HUGUES	DOIT / AVANCE KIA PRIDE	12000000.00	closed	2025-12-06 22:45:10.646-08	2025-12-14 08:54:50.422-08	5	\N	1
7	7	HUGUES	RETOUR/KIA PRIDE	42000000.00	closed	2025-12-17 23:42:18.063-08	2025-12-20 00:23:27.718-08	5	\N	1
8	7	NAIVO	Doit	1100000.00	open	2026-01-04 19:56:04.629-08	2026-01-04 19:56:04.629-08	1	\N	1
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, token, expires_at, created_at, user_id) FROM stdin;
128	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc5MzE4MjcsImV4cCI6MTc2ODUzNjYyN30._9NtIf5clGxyQhxF5wJxCH887bkKqjrs7b1LFhxbz60	2026-01-16 07:10:27.141	2026-01-08 20:10:27.141889	1
112	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3NjczMjQ3MzUsImV4cCI6MTc2NzkyOTUzNX0.6FsozzyAwpc-5cU0Jcc67kHcvmxnoSyjt7DjjYTZ394	2026-01-09 06:32:15.252	2026-01-01 19:32:15.25308	1
113	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc0MDg3NzYsImV4cCI6MTc2ODAxMzU3Nn0.2W9CF2XLBhW25KU2kodK6AZoLSZLrEvK7GsdrCksufo	2026-01-10 05:52:56.316	2026-01-02 18:52:56.316853	1
114	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc0MTY2MTEsImV4cCI6MTc2ODAyMTQxMX0.zOoPybXz9pXU9NOoWPNc28HG3kuk7OV9vpis1R2YGEA	2026-01-10 08:03:31.483	2026-01-02 21:03:31.483981	1
115	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc0OTUwOTIsImV4cCI6MTc2ODA5OTg5Mn0.4qahvXe_dcyeBnjHyYFcmdDH3EK_XcN2VQYbMibAkS8	2026-01-11 05:51:32.402	2026-01-03 18:51:32.402724	1
116	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc1ODUzMzUsImV4cCI6MTc2ODE5MDEzNX0.FHRxZYx3ymT17wE3qVBsNrYafCF8i0mnCJyVSyx79LI	2026-01-12 06:55:35.76	2026-01-04 19:55:35.76034	1
117	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc2MTk1MzEsImV4cCI6MTc2ODIyNDMzMX0.o1z02F4RV8In3liS3HwkNSZ4RR1Ns7bxNTyIqk7U__Y	2026-01-12 16:25:31.663	2026-01-05 05:25:31.664321	1
118	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc2NjY2NTUsImV4cCI6MTc2ODI3MTQ1NX0.78lCCyApCnUEBlXJx801PI2mRL62XK4sXIzIjrAzzbc	2026-01-13 05:30:55.365	2026-01-05 18:30:55.365841	1
119	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc2NzE3MDUsImV4cCI6MTc2ODI3NjUwNX0.V9hWigEgizV6IkfnGcMGEchecj6iwU-MIfD20G16tjY	2026-01-13 06:55:05.698	2026-01-05 19:55:05.698484	1
120	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc2NzE3NjQsImV4cCI6MTc2ODI3NjU2NH0.so66JmMYBqeBdDrPXNrx4jvGx_j-Hkr6DrLoztGxC-Q	2026-01-13 06:56:04.199	2026-01-05 19:56:04.20008	1
121	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc2ODM1NTgsImV4cCI6MTc2ODI4ODM1OH0.iqycZCuf-eyYYcz8AYBI6jAvkmqOMJY4RxUoYT2JotI	2026-01-13 10:12:38.148	2026-01-05 23:12:38.148947	1
122	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc2ODQzNzMsImV4cCI6MTc2ODI4OTE3M30.KwrznnHJNzloJeENSyRIGwGPO_IdzUs-lE3At-4f2mg	2026-01-13 10:26:13.996	2026-01-05 23:26:13.997759	1
123	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc3NjA0NTQsImV4cCI6MTc2ODM2NTI1NH0.gmfO8YuL0IIBVwKcQ-cnHttmyk4U9C1hqLTV0MIZZGc	2026-01-14 07:34:14.069	2026-01-06 20:34:14.069717	1
124	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc3NjE4NzgsImV4cCI6MTc2ODM2NjY3OH0.43c9PcsUY_wq8ANGfvs0lcOs41aztJvYNm6WyMO1SsA	2026-01-14 07:57:58.801	2026-01-06 20:57:58.801481	1
125	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc3NjQ1OTEsImV4cCI6MTc2ODM2OTM5MX0.Zue9_nBosyM1s6RGyxDmE1s_vOK7QVTo2XnVhK_0JGA	2026-01-14 08:43:11.871	2026-01-06 21:43:11.871743	1
126	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc4NDE5MzMsImV4cCI6MTc2ODQ0NjczM30.Vp8rZymeeoYqk3jGkYdkEmTOQT3JEffhLg6FKgQBnNs	2026-01-15 06:12:13.222	2026-01-07 19:12:13.222487	1
127	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc4NDQ5NTAsImV4cCI6MTc2ODQ0OTc1MH0.krp2mQU5HsxU9JBYygwgKOETyupB9r3j4MImQJ1MazM	2026-01-15 07:02:30.288	2026-01-07 20:02:30.288842	1
129	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJhdXRoZW50aWNhdGVkIjp0cnVlLCJpYXQiOjE3Njc5MzU1MDEsImV4cCI6MTc2ODU0MDMwMX0.gV_L01s23RsdWBDte4vTnUhU3J0_TuODv1uWdE3OmEo	2026-01-16 08:11:41.557	2026-01-08 21:11:41.557461	1
\.


--
-- Data for Name: sops; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sops (id, title, description, owner, steps, avg_time, status, category, checklist, created_at, updated_at, project_id, last_review) FROM stdin;
4	SOP - Cycle Poulets de Chair (500 têtes)	Cycle de 45 jours. Objectif 2.5kg. Mortalité max 4%.	Responsable Élevage	[{"order": 1, "title": "Démarrage (J1-J15)", "duration": "15 jours", "description": "Provende Démarrage (3.4M Ar). Semoule 495kg, Soja 370kg, CCT 75kg."}, {"order": 2, "title": "Croissance (J16-J30)", "duration": "15 jours", "description": "Provende Croissance (847k Ar). Semoule 132kg, Soja 85kg, CCT 20kg."}, {"order": 3, "title": "Finition (J31-J45)", "duration": "15 jours", "description": "Provende Finition (801k Ar). Semoule 150kg, Soja 78kg, CCT 12kg."}]	45	active	Élevage	[{"item": "Poussins installés (500 têtes)", "checked": false, "required": true}, {"item": "Pesée J35 (Cible 2.5kg)", "checked": false, "required": true}, {"item": "Stock provende Démarrage OK", "checked": false, "required": true}]	2025-12-10 20:52:45.876206	2025-12-10 20:52:45.876206	\N	\N
5	SOP - Cycle Oies (200 têtes)	Cycle 12 semaines Bypass. Poids cible 4.5kg.	Responsable Élevage	[{"order": 1, "title": "Réception", "duration": "1 jour", "description": "Installation oisons (25k Ar/u)."}, {"order": 2, "title": "Engraissement", "duration": "12 semaines", "description": "Alim + Vitamines (Budget 4.7M Ar)."}]	84	active	Élevage	[{"item": "200 Oisons réceptionnés", "checked": false, "required": true}, {"item": "Budget Alim Oies engagé", "checked": false, "required": true}, {"item": "Poids final 4.5kg atteint", "checked": false, "required": true}]	2025-12-10 20:52:45.876206	2025-12-10 20:52:45.876206	\N	\N
6	SOP - Fabrication Provende Standard	Formule optimisée Natiora.	Aide Opérationnel	[{"order": 1, "title": "Dosage", "duration": "2 heures", "description": "Respecter ratios Semoule/Soja/CCT/Son/Coquillage."}, {"order": 2, "title": "Mélange & Stockage", "duration": "3 heures", "description": "Homogénéisation et stockage sur palettes."}]	1	active	Logistique	[{"item": "Ingrédients pesés", "checked": false, "required": true}, {"item": "Mélange homogène", "checked": false, "required": true}]	2025-12-10 20:52:45.876206	2025-12-10 20:52:45.876206	\N	\N
7	SOP - Vente et Livraison	Commercialisation Boucheries & Particuliers.	Promoteur	[{"order": 1, "title": "Commande", "duration": "1 heure", "description": "Validation prix (10-11k Ar/kg)."}, {"order": 2, "title": "Livraison", "duration": "4 heures", "description": "Livraison et encaissement."}]	2	active	Vente	[{"item": "Prix de vente validé", "checked": false, "required": true}, {"item": "Encaissement réalisé", "checked": false, "required": true}]	2025-12-10 20:52:45.876206	2025-12-10 20:52:45.876206	\N	\N
1	SOP - Construction Bâtiment Oies (60m²)	Construction site Bypass. Budget CAPEX: 2 750 000 Ar.	Chef de Chantier	[{"order": 1, "title": "Achat Matériaux", "duration": "5 jours", "description": "5000 briques, 20 sacs ciment, Sable, Fer."}, {"order": 2, "title": "Gros Œuvre", "duration": "20 jours", "description": "Fondations, murs, toiture."}, {"order": 3, "title": "Clôture", "duration": "5 jours", "description": "Sécurisation périmétrique (Budget 300k inclus)."}]	30	active	Infrastructure	[{"item": "Budget Oies validé: 2 750 000 Ar", "checked": true, "required": true}, {"item": "5000 Briques livrées", "checked": false, "required": true}, {"item": "Bâtiment 60m² achevé", "checked": false, "required": true}]	2025-12-10 20:52:45.876206	2025-12-12 21:15:43.559273	\N	\N
2	SOP - Construction Bâtiment Kuroiler (40m²)	Construction site Sabotsy. Budget CAPEX: 2 000 000 Ar.	Chef de Chantier	[{"order": 1, "title": "Achat Matériaux", "duration": "3 jours", "description": "3000 briques, 15 sacs ciment, Sable, Fer."}, {"order": 2, "title": "Construction", "duration": "20 jours", "description": "Élévation murs et toiture."}]	25	active	Infrastructure	[{"item": "Budget Kuroiler validé: 2 000 000 Ar", "checked": true, "required": true}, {"item": "3000 Briques livrées", "checked": false, "required": true}, {"item": "Bâtiment 40m² achevé", "checked": false, "required": true}]	2025-12-10 20:52:45.876206	2025-12-12 21:15:46.255461	\N	\N
3	SOP - Construction Bâtiment Poulets Locaux (40m²)	Extension site Bypass (3ème bâtiment). Budget CAPEX ajusté: 1 785 000 Ar.	Chef de Chantier	[{"order": 1, "title": "Achat Matériaux", "duration": "3 jours", "description": "Matériaux ajustés (briques, ciment) pour 3ème bâtiment."}, {"order": 2, "title": "Construction", "duration": "20 jours", "description": "Élévation murs et toiture."}]	25	active	Infrastructure	[{"item": "Budget Locaux validé: 1 785 000 Ar", "checked": true, "required": true}, {"item": "Matériaux livrés sur site", "checked": false, "required": true}, {"item": "Bâtiment 40m² (Locaux) achevé", "checked": false, "required": true}]	2025-12-10 20:52:45.876206	2025-12-12 21:15:54.422503	\N	\N
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, title, priority, due_date, assignee, status, sop_id, created_at, project_id) FROM stdin;
\.


--
-- Data for Name: transaction_linking_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transaction_linking_log (id, transaction_id, project_line_id, line_type, action, performed_by, performed_at, notes) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, account_id, type, amount, category, description, transaction_date, created_at, is_planned, project_id, is_posted, updated_at, project_line_id, linked_at, linked_by, user_id, remarks) FROM stdin;
223	5	expense	1970000.00	Automobile	MOTO G5	2025-11-26	2025-12-14 16:48:17.186	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
224	5	expense	441400.00	Autres	A DETAILLER	2025-11-26	2025-12-14 16:48:17.221	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
315	1	expense	300000.00	Autre	Transfert vers MVOLA	2025-11-26	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
413	2	income	300000.00	Autre	Transfert de Argent liquide	2025-11-26	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
414	2	expense	102500.00	Autre	@CIN @FENO	2025-11-26	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
415	2	expense	178600.00	Autre	@TSIKIVY @DELAH	2025-11-26	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
416	2	expense	10000.00	Autre	First Premium 10.000ar	2025-11-26	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
417	2	expense	500.00	Autre	Frais	2025-11-26	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
474	3	income	5782.00	Extra Solde	SI OM	2025-11-26	2025-12-18 16:13:26.74	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
561	1	expense	5500.00	Autre	Bajaj	2025-11-26	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
562	1	expense	12000.00	Autre	Queens	2025-11-26	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
563	1	expense	36600.00	Autre	@LALAINA	2025-11-26	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
564	1	expense	975000.00	Autre	Transfert vers MVOLA	2025-11-26	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
565	1	expense	72000.00	Autre	Aigle D'or	2025-11-26	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
566	1	expense	5000.00	Autre	News	2025-11-26	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
225	5	income	1227200.00	Extra Solde	BALANCE SOLDE COFFRE	2025-11-27	2025-12-14 16:48:17.237	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
567	1	expense	1000.00	Autre	News (4)	2025-11-27	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
568	1	expense	300.00	Autre	Café	2025-11-27	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
569	1	expense	120000.00	Autre	Transfert vers MVOLA	2025-11-27	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
226	1	income	1900600.00	Autre	Transfert de COFFRE	2025-11-28	2025-12-14 16:48:17.248	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
227	5	expense	1900600.00	Autre	Transfert vers Argent liquide	2025-11-28	2025-12-14 16:48:17.258	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
316	1	expense	4000.00	Autre	@FENO frais	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
317	1	expense	9600.00	Autre	Taxibe Alakamisy, Taxi-moto	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
318	1	expense	32000.00	Autre	Goûtés Tacos (4)	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
319	1	income	100000.00	Autre	Transfert de BOA	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
320	1	expense	66900.00	Autre	Alakamisy	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
321	1	expense	5000.00	Autre	News	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
322	1	expense	3900.00	Autre	Atody (5), Café (1)	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
323	1	expense	10000.00	Autre	Cantine, Goûtés	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
324	1	expense	5000.00	Autre	Duru (1), Crédit_Rabebe 1000ar	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
325	1	income	765900.00	Autre	Apport	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
326	1	expense	160000.00	Autre	Parfum INVICTUS (1), SO SCANDAL (1)	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
327	1	expense	35000.00	Autre	Taxi Rentrée_hopital @papa	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
328	1	expense	5000.00	Autre	Sakafo (Atoandro_Hotely)	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
418	2	expense	2150.00	Autre	@DELAH	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
470	4	expense	100000.00	Autre	Transfert vers Argent liquide	2025-11-28	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
229	5	expense	2750000.00	CAPEX	Natiora – Élevage mixte 2026 - Bâtiment Oies (60 m²)	2025-11-29	2025-12-14 16:48:17.28	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
230	5	expense	2000000.00	CAPEX	Natiora – Élevage mixte 2026 - Bâtiment Kuroiler (40 m²)	2025-11-29	2025-12-14 16:48:17.314	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
231	5	expense	1785000.00	CAPEX	Natiora – Élevage mixte 2026 - Bâtiment Poulets locaux (40 m²)	2025-11-29	2025-12-14 16:48:17.323	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
232	5	expense	1200000.00	Équipements	Natiora – Élevage mixte 2026 - Équipements durables (mangeoires, abreuvoirs, ventilation)	2025-11-29	2025-12-14 16:48:17.336	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
233	5	expense	300000.00	Clôture	Natiora – Élevage mixte 2026 - Clôture et sécurité site Bypass	2025-11-29	2025-12-14 16:48:17.344	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
234	5	expense	500000.00	Fonds de roulement	Natiora – Élevage mixte 2026 - Fonds de roulement initial	2025-11-29	2025-12-14 16:48:17.353	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
235	1	expense	15500.00	Autre	TMV (12>14)	2025-11-29	2025-12-14 16:48:17.362	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
236	2	expense	4000.00	Autre	Crédits Phone	2025-11-29	2025-12-14 16:48:17.372	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
237	3	expense	250.00	Autre	Crédits Phone	2025-11-29	2025-12-14 16:48:17.381	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
329	1	expense	5000.00	Autre	News	2025-11-29	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
330	1	expense	800.00	Autre	Café	2025-11-29	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
331	1	expense	620000.00	Autre	Transfert vers MVOLA	2025-11-29	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
332	1	expense	10000.00	Autre	Cantine, Goûtés	2025-11-29	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
419	2	income	620000.00	Autre	Transfert de Argent liquide	2025-11-29	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
420	2	expense	608200.00	Autre	DEPART @DELAH	2025-11-29	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
238	2	income	630.00	Autre	Bonus Mvola	2025-11-30	2025-12-14 16:48:17.426	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
333	1	expense	7000.00	Autre	Cantine, Goûtés	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
334	1	expense	5000.00	Autre	News	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
335	1	expense	120000.00	Autre	Transfert vers MVOLA	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
336	1	expense	7000.00	Autre	Sakafo (Atoandro_Hotely avec  @Feno)	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
337	1	expense	52000.00	Autre	Taxi-moto T/maty-A/bao-Ville-A/misy	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
338	1	expense	1100.00	Autre	Taxibe T/Maty/A/misy-A/bao	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
339	1	income	100000.00	Autre	Transfert de COFFRE	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
340	1	expense	100000.00	Autre	@FENO	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
341	1	expense	25600.00	Autre	Afterwork	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
421	2	income	120000.00	Autre	Transfert de Argent liquide	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
656	1	expense	6708.00	Test Stress	Transaction stress test 1767937038895	2026-01-09	2026-01-08 21:37:18.913236	f	\N	t	2026-01-08 21:37:18.913236	\N	\N	\N	1	\N
477	2	income	5337125.00	Extra Solde	SI MVOLA	2025-08-26	2025-12-18 16:22:43.35	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
478	1	expense	991800.00	Autres	SI ARGENT LIQUIDE	2025-08-27	2025-12-18 16:28:58.162	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
246	5	income	84000000.00	Extra Solde	SOLDE INITIAL COFFRE - 10M + 30M = 40M	2025-09-25	2025-12-17 05:40:33.979	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
1	1	expense	25000.00	Quotidienne	News (5jrs)	2025-10-09	2025-12-14 16:48:13.551	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
2	1	expense	4500.00	VINA	Photocopie/Impression	2025-10-10	2025-12-14 16:48:13.559	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
3	1	income	200000.00	Transfer (Inward)	Transfert de MVOLA	2025-10-11	2025-12-14 16:48:13.568	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
4	1	expense	4000.00	Transport	Bajaj	2025-10-11	2025-12-14 16:48:13.595	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
5	2	expense	200000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-11	2025-12-14 16:48:13.602	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
6	2	expense	11000.00	Crédits Phone	Crédits Phone	2025-10-11	2025-12-14 16:48:13.608	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
7	2	expense	505200.00	VINA	RAPATR @DOVIC	2025-10-11	2025-12-14 16:48:13.616	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
8	2	expense	2600.00	Retrait	Retrait 200.000ar	2025-10-11	2025-12-14 16:48:13.621	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
9	1	expense	3000.00	Quotidienne	Saucisse	2025-10-12	2025-12-14 16:48:13.628	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
10	1	expense	157100.00	Extra NON SUIVI ❎	Extra NON SUIVI ❎	2025-10-12	2025-12-14 16:48:13.655	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
11	2	expense	257600.00	VINA	Comptable Octobre_25	2025-10-12	2025-12-14 16:48:13.66	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
12	2	expense	72000.00	PLG FLPT	@DELAH	2025-10-12	2025-12-14 16:48:13.668	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
13	2	expense	72000.00	VINA	@FENO	2025-10-12	2025-12-14 16:48:13.675	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
14	2	income	3600.00	Bonus Mvola	Bonus Mvola	2025-10-12	2025-12-14 16:48:13.688	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
15	1	expense	5500.00	Quotidienne	Sakafo, News	2025-10-13	2025-12-14 16:48:13.695	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
16	1	expense	6100.00	Quotidienne	News, Café, Extra-propre	2025-10-13	2025-12-14 16:48:13.702	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
17	2	expense	405750.00	Afterwork	Afterwork	2025-10-13	2025-12-14 16:48:13.71	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
18	1	expense	30000.00	Afterwork	Afterwork	2025-10-14	2025-12-14 16:48:13.719	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
19	1	expense	10000.00	Quotidienne	News	2025-10-14	2025-12-14 16:48:13.726	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
20	1	expense	4400.00	Quotidienne	Patte (2), Laoka	2025-10-14	2025-12-14 16:48:13.735	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
21	1	income	60000.00	Transfer (Inward)	Transfert de MVOLA	2025-10-14	2025-12-14 16:48:13.758	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
22	1	expense	5000.00	Quotidienne	News	2025-10-14	2025-12-14 16:48:13.769	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
23	1	expense	9500.00	Quotidienne	Sakafo Atoandro (Tsaradia)	2025-10-14	2025-12-14 16:48:13.775	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
24	2	expense	1500.00	Retrait	Retrait 60.000ar	2025-10-14	2025-12-14 16:48:13.786	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
25	2	expense	60000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-14	2025-12-14 16:48:13.792	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
26	2	expense	2150.00	Crédits Phone	Mora 2000 @Lalaina	2025-10-14	2025-12-14 16:48:13.801	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
27	2	expense	10150.00	Crédits Phone	First Premium 10.000ar @Volana_Mines	2025-10-14	2025-12-14 16:48:13.807	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
28	1	expense	900.00	Quotidienne	Café, Extra-propre	2025-10-15	2025-12-14 16:48:13.812	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
29	1	expense	13200.00	Afterwork	Afterwork	2025-10-15	2025-12-14 16:48:13.835	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
30	1	income	40000.00	Transfer (Inward)	Transfert de MVOLA	2025-10-15	2025-12-14 16:48:13.841	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
31	1	expense	6000.00	Quotidienne	News	2025-10-15	2025-12-14 16:48:13.851	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
32	1	expense	5000.00	Quotidienne	Sakafo (Atoandro_Hotely)	2025-10-15	2025-12-14 16:48:13.856	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
33	2	expense	1008500.00	Aide	@HIROKO	2025-10-15	2025-12-14 16:48:13.869	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
34	2	expense	1150.00	Crédits Phone	Mora 1000 @Lalaina	2025-10-15	2025-12-14 16:48:13.874	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
35	2	expense	40000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-15	2025-12-14 16:48:13.882	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
36	2	expense	1000.00	Retrait	Retrait 40k Ar	2025-10-15	2025-12-14 16:48:13.886	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
37	2	expense	2150.00	Crédits Phone	Yellow 2000 @Sarobidy	2025-10-15	2025-12-14 16:48:13.892	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
38	7	income	1008500.00	Aide	@HIROKO	2025-10-15	2025-12-14 16:48:13.9	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
473	4	income	630332.00	Extra Solde	SI BOA 	2025-10-15	2025-12-18 16:08:40.497	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
39	1	income	100000.00	Transfer (Inward)	Transfert de COFFRE	2025-10-16	2025-12-14 16:48:13.906	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
40	1	income	1000000.00	Transfer (Inward)	Transfert de COFFRE	2025-10-16	2025-12-14 16:48:13.914	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
41	1	expense	60000.00	Afterwork	Afterwork	2025-10-16	2025-12-14 16:48:13.92	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
42	1	expense	4000.00	Transport	Bajaj	2025-10-16	2025-12-14 16:48:13.926	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
43	1	expense	800.00	VINA	Photocopie/Impression	2025-10-16	2025-12-14 16:48:13.959	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
44	1	expense	11000.00	Quotidienne	Sakafo, Duru, Extra-propre, Café GM	2025-10-16	2025-12-14 16:48:13.966	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
45	1	expense	4600.00	Quotidienne	News	2025-10-16	2025-12-14 16:48:13.973	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
46	3	expense	869400.00	VINA	Commission @Hiroko PLG_FLPT	2025-10-16	2025-12-14 16:48:13.982	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
47	3	income	900000.00	Transfer (Inward)	Transfert de COFFRE	2025-10-16	2025-12-14 16:48:13.99	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
48	5	expense	100000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-16	2025-12-14 16:48:13.997	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
49	5	expense	1000000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-16	2025-12-14 16:48:14.004	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
50	5	expense	900000.00	Transfer (Outward)	Transfert vers ORANGE MONEY	2025-10-16	2025-12-14 16:48:14.01	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
51	1	expense	20000.00	Aide	@SAROBIDY	2025-10-17	2025-12-14 16:48:14.018	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
52	1	expense	13000.00	Automobile	Carburant @lalaina	2025-10-17	2025-12-14 16:48:14.025	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
53	1	expense	26000.00	Afterwork	Afterwork	2025-10-17	2025-12-14 16:48:14.032	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
54	1	expense	900000.00	Transfer (Outward)	Transfert vers ORANGE MONEY	2025-10-17	2025-12-14 16:48:14.06	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
55	1	expense	70000.00	Transfer (Outward)	Transfert vers ORANGE MONEY	2025-10-17	2025-12-14 16:48:14.07	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
56	3	income	900000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-17	2025-12-14 16:48:14.078	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
57	3	income	70000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-17	2025-12-14 16:48:14.088	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
58	3	expense	869400.00	Aide	@HIROKO	2025-10-17	2025-12-14 16:48:14.103	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
59	3	expense	500.00	Crédits Phone	Bé 500	2025-10-17	2025-12-14 16:48:14.116	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
60	1	expense	200000.00	Goûters	@SAROBIDY	2025-10-18	2025-12-14 16:48:14.125	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
61	1	income	1000000.00	Transfer (Inward)	Transfert de COFFRE	2025-10-18	2025-12-14 16:48:14.135	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
62	1	expense	100000.00	Transfer (Outward)	Transfert vers MVOLA	2025-10-18	2025-12-14 16:48:14.174	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
63	1	expense	200000.00	VINA	@FENO	2025-10-18	2025-12-14 16:48:14.187	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
64	1	expense	100000.00	Frais	Hébergement @FENO @LALAINA	2025-10-18	2025-12-14 16:48:14.205	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
65	1	expense	60000.00	Transport	MJG > TNR	2025-10-18	2025-12-14 16:48:14.226	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
66	1	expense	15000.00	Transport	Bajaj	2025-10-18	2025-12-14 16:48:14.262	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
67	1	expense	32500.00	Cadeaux - offerts	Voan-dalana MJG	2025-10-18	2025-12-14 16:48:14.275	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
68	1	expense	32000.00	Afterwork	Avant Départ TNR	2025-10-18	2025-12-14 16:48:14.299	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
69	2	expense	2150.00	Aide	@SAROBIDY	2025-10-18	2025-12-14 16:48:14.337	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
70	2	income	100000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-18	2025-12-14 16:48:14.389	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
71	2	expense	101500.00	Aide	@WILLY_FLPT	2025-10-18	2025-12-14 16:48:14.434	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
72	2	expense	13950.00	Frais	À Verifier ❎⌛	2025-10-18	2025-12-14 16:48:14.491	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
73	3	expense	51800.00	Afterwork	@NAINA	2025-10-18	2025-12-14 16:48:14.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
74	3	expense	83032.26	Frais	Connexion Orange OCT/25	2025-10-18	2025-12-14 16:48:14.646	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
75	5	expense	1000000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-18	2025-12-14 16:48:14.745	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
76	1	expense	268100.00	Extra NON SUIVI ❎	Extra NON SUIVI ❎	2025-10-19	2025-12-14 16:48:14.757	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
77	1	income	1000000.00	Transfer (Inward)	Transfert de COFFRE	2025-10-20	2025-12-14 16:48:14.79	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
78	1	expense	159900.00	Quotidienne	Fête A/BAO	2025-10-20	2025-12-14 16:48:14.803	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
79	2	expense	5000.00	Crédits Phone	Mora +5000	2025-10-20	2025-12-14 16:48:14.813	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
80	5	expense	1000000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-20	2025-12-14 16:48:14.826	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
81	7	expense	191730.00	Quotidienne	Fêtes A/Bao	2025-10-20	2025-12-14 16:48:14.838	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
82	1	expense	200000.00	Transfer (Outward)	Transfert vers MVOLA	2025-10-21	2025-12-14 16:48:14.856	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
83	1	expense	510000.00	Transfer (Outward)	Transfert vers ORANGE MONEY	2025-10-21	2025-12-14 16:48:14.878	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
84	1	expense	85000.00	Habillements	T-shirt (4)	2025-10-21	2025-12-14 16:48:14.889	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
85	1	income	20000.00	Transfer (Inward)	Transfert de MVOLA	2025-10-21	2025-12-14 16:48:14.902	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
86	1	expense	12000.00	Transport	Moto A/vona Cotisse	2025-10-21	2025-12-14 16:48:14.911	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
87	1	expense	12000.00	Quotidienne	Sakafo + Coca	2025-10-21	2025-12-14 16:48:14.923	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
88	1	expense	5000.00	Quotidienne	News	2025-10-21	2025-12-14 16:48:14.934	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
89	1	expense	27200.00	Afterwork	@TAHIANA	2025-10-21	2025-12-14 16:48:14.943	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
90	2	income	200000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-21	2025-12-14 16:48:14.953	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
91	2	expense	43400.00	Transport	TNR 🚐 TVE	2025-10-21	2025-12-14 16:48:14.962	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
92	2	expense	20000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-21	2025-12-14 16:48:15.005	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
93	2	expense	410.00	Retrait	Retrait 20.000ar	2025-10-21	2025-12-14 16:48:15.018	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
94	2	expense	10000.00	Crédits Phone	First Premium 10.000ar	2025-10-21	2025-12-14 16:48:15.03	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
95	3	income	510000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-21	2025-12-14 16:48:15.043	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
96	3	expense	506300.00	DOIT	@NAIVO	2025-10-21	2025-12-14 16:48:15.062	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
97	3	expense	499.74	Frais	Frais	2025-10-21	2025-12-14 16:48:15.107	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
98	7	income	500000.00	DOIT	@NAIVO	2025-10-21	2025-12-14 16:48:15.124	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
99	1	income	300000.00	Transfer (Inward)	Transfert de BOA	2025-10-22	2025-12-14 16:48:15.138	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
100	1	expense	136700.00	Afterwork	T/ve @ZO @LALAINA @HIROKO	2025-10-22	2025-12-14 16:48:15.149	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
101	1	expense	150000.00	Transfer (Outward)	Transfert vers ORANGE MONEY	2025-10-22	2025-12-14 16:48:15.162	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
102	1	expense	1500.00	Transport	Bajaj	2025-10-22	2025-12-14 16:48:15.202	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
103	2	expense	9150.00	Crédits Phone	Crédits Phone	2025-10-22	2025-12-14 16:48:15.213	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
104	3	income	150000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-22	2025-12-14 16:48:15.226	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
105	3	expense	154350.00	Frais	Divorce @TANTELY	2025-10-22	2025-12-14 16:48:15.234	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
106	7	expense	300000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-22	2025-12-14 16:48:15.244	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
107	1	expense	12000.00	Transport	Bajaj	2025-10-23	2025-12-14 16:48:15.275	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
108	1	expense	1000.00	Crédits Phone	Carte Telma	2025-10-23	2025-12-14 16:48:15.285	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
109	1	expense	123500.00	Aide	@HIROKO MIAMI/LONGO	2025-10-23	2025-12-14 16:48:15.303	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
110	1	income	2000000.00	Transfer (Inward)	Transfert de COFFRE	2025-10-23	2025-12-14 16:48:15.316	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
111	1	expense	5000.00	Quotidienne	News	2025-10-23	2025-12-14 16:48:15.326	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
112	1	expense	10000.00	Transfer (Outward)	Transfert vers MVOLA	2025-10-23	2025-12-14 16:48:15.337	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
113	2	income	10000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-23	2025-12-14 16:48:15.346	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
114	2	income	210.00	Bonus Mvola	Bonus Mvola	2025-10-23	2025-12-14 16:48:15.356	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
115	2	expense	143600.00	PLG FLPT	@frais M/va ➡️ T/ve @DELAH @ZOKINY	2025-10-23	2025-12-14 16:48:15.365	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
116	2	expense	5000.00	Crédits Phone	Netweek 5000	2025-10-23	2025-12-14 16:48:15.396	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
117	2	income	1000.00	Bonus Mvola	Bonus Mvola	2025-10-23	2025-12-14 16:48:15.406	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
118	2	expense	2500.00	Frais	Frais	2025-10-23	2025-12-14 16:48:15.425	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
119	3	expense	250.00	Crédits Phone	Bé 500	2025-10-23	2025-12-14 16:48:15.434	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
120	5	expense	2000000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-23	2025-12-14 16:48:15.444	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
121	1	expense	5500.00	Transport	Bajaj	2025-10-24	2025-12-14 16:48:15.465	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
122	1	expense	12000.00	Afterwork	Queens	2025-10-24	2025-12-14 16:48:15.504	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
123	1	expense	36600.00	Crédits Phone	@LALAINA	2025-10-24	2025-12-14 16:48:15.516	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
124	1	expense	975000.00	Transfer (Outward)	Transfert vers MVOLA	2025-10-24	2025-12-14 16:48:15.532	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
125	1	expense	72000.00	Habillements	Aigle D'or	2025-10-24	2025-12-14 16:48:15.543	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
126	1	expense	5000.00	Quotidienne	News	2025-10-24	2025-12-14 16:48:15.571	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
127	2	expense	126100.00	Frais	Doit @LALAINA + Frais @FENO	2025-10-24	2025-12-14 16:48:15.588	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
128	2	income	1600.00	Bonus Mvola	Bonus Mvola	2025-10-24	2025-12-14 16:48:15.597	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
129	2	income	975000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-24	2025-12-14 16:48:15.608	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
130	2	expense	848200.00	Transfert	@RANDOU	2025-10-24	2025-12-14 16:48:15.622	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
131	7	income	848200.00	DOIT	@RANDOU	2025-10-24	2025-12-14 16:48:15.632	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
132	1	expense	1000.00	Quotidienne	News (4)	2025-10-25	2025-12-14 16:48:15.643	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
133	1	expense	300.00	Quotidienne	Café	2025-10-25	2025-12-14 16:48:15.654	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
134	1	expense	120000.00	Transfer (Outward)	Transfert vers MVOLA	2025-10-25	2025-12-14 16:48:15.664	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
135	2	income	120000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-25	2025-12-14 16:48:15.698	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
136	2	expense	57000.00	Frais	Perplexity 12mois	2025-10-25	2025-12-14 16:48:15.71	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
137	2	expense	62000.00	Aide	Dentiste @SAROBIDY	2025-10-25	2025-12-14 16:48:15.724	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
138	2	income	500.00	Bonus Mvola	Bonus Mvola	2025-10-25	2025-12-14 16:48:15.735	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
139	1	expense	300000.00	Transfer (Outward)	Transfert vers MVOLA	2025-10-28	2025-12-14 16:48:15.746	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
140	2	income	300000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-28	2025-12-14 16:48:15.757	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
141	2	expense	102500.00	VINA	@CIN @FENO	2025-10-28	2025-12-14 16:48:15.768	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
142	2	expense	178600.00	PLG FLPT	@TSIKIVY @DELAH	2025-10-28	2025-12-14 16:48:15.802	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
143	2	expense	10000.00	Crédits Phone	First Premium 10.000ar	2025-10-28	2025-12-14 16:48:15.812	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
144	2	expense	500.00	Frais	Frais	2025-10-28	2025-12-14 16:48:15.833	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
145	1	expense	4000.00	VINA	@FENO frais	2025-10-30	2025-12-14 16:48:15.843	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
146	1	expense	9600.00	Transport	Taxibe Alakamisy, Taxi-moto	2025-10-30	2025-12-14 16:48:15.886	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
147	1	expense	32000.00	STAN&ETHAN	Goûtés Tacos (4)	2025-10-30	2025-12-14 16:48:15.895	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
148	1	income	100000.00	Transfer (Inward)	Transfert de BOA	2025-10-30	2025-12-14 16:48:15.909	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
149	1	expense	66900.00	Afterwork	Alakamisy	2025-10-30	2025-12-14 16:48:15.927	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
150	1	expense	5000.00	Quotidienne	News	2025-10-30	2025-12-14 16:48:15.945	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
151	1	expense	3900.00	Quotidienne	Atody (5), Café (1)	2025-10-30	2025-12-14 16:48:15.955	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
152	1	expense	10000.00	STAN&ETHAN	Cantine, Goûtés	2025-10-30	2025-12-14 16:48:15.966	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
153	1	expense	5000.00	Quotidienne	Duru (1), Crédit_Rabebe 1000ar	2025-10-30	2025-12-14 16:48:16	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
155	1	expense	160000.00	Soins personnels	Parfum INVICTUS (1), SO SCANDAL (1)	2025-10-30	2025-12-14 16:48:16.023	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
156	1	expense	35000.00	Soins personnels	Taxi Rentrée_hopital @papa	2025-10-30	2025-12-14 16:48:16.033	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
157	1	expense	5000.00	Quotidienne	Sakafo (Atoandro_Hotely)	2025-10-30	2025-12-14 16:48:16.041	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
158	2	expense	2150.00	PLG FLPT	@DELAH	2025-10-30	2025-12-14 16:48:16.051	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
159	5	expense	13000000.00	À VERIFIER 🎯💯🛑🚧	À VERIFIER 🎯💯🛑🚧	2025-10-30	2025-12-14 16:48:16.065	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
160	7	expense	100000.00	Transfer (Outward)	Transfert vers Argent liquide	2025-10-30	2025-12-14 16:48:16.101	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
161	1	expense	620000.00	Transfer (Outward)	Transfert vers MVOLA	2025-10-31	2025-12-14 16:48:16.112	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
162	1	expense	10000.00	STAN&ETHAN	Cantine, Goûtés	2025-10-31	2025-12-14 16:48:16.127	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
163	2	income	620000.00	Transfer (Inward)	Transfert de Argent liquide	2025-10-31	2025-12-14 16:48:16.138	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
164	2	expense	608200.00	PLG FLPT	DEPART @DELAH	2025-10-31	2025-12-14 16:48:16.147	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
167	3	income	12323.00	Extra Solde	AJUSTEMENT AUTO (Solde Initial)	2025-10-31	2025-12-14 16:48:16.203	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
170	7	income	7464600.00	Extra Solde	AJUSTEMENT AUTO (Solde Initial)	2025-10-31	2025-12-14 16:48:16.264	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
171	7	income	591730.00	Extra Solde	AJUSTEMENT AUTO (Solde Initial)	2025-10-31	2025-12-14 16:48:16.311	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
172	1	expense	7000.00	Autre	Cantine, Goûtés	2025-11-03	2025-12-14 16:48:16.325	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
173	1	expense	5000.00	Autre	News	2025-11-03	2025-12-14 16:48:16.341	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
174	1	expense	120000.00	Autre	Transfert vers MVOLA	2025-11-03	2025-12-14 16:48:16.356	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
175	1	expense	7000.00	Autre	Sakafo (Atoandro_Hotely avec  @Feno)	2025-11-03	2025-12-14 16:48:16.375	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
176	1	expense	52000.00	Autre	Taxi-moto T/maty-A/bao-Ville-A/misy	2025-11-03	2025-12-14 16:48:16.434	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
177	1	expense	1100.00	Autre	Taxibe T/Maty/A/misy-A/bao	2025-11-03	2025-12-14 16:48:16.468	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
178	1	income	100000.00	Autre	Transfert de COFFRE	2025-11-03	2025-12-14 16:48:16.516	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
179	1	expense	100000.00	Autre	@FENO	2025-11-03	2025-12-14 16:48:16.526	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
180	1	expense	25600.00	Autre	Afterwork	2025-11-03	2025-12-14 16:48:16.542	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
181	5	expense	100000.00	Autre	Transfert vers Argent liquide	2025-11-03	2025-12-14 16:48:16.553	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
182	2	income	120000.00	Autre	Transfert de Argent liquide	2025-11-03	2025-12-14 16:48:16.565	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
183	2	expense	130600.00	Autre	Loyer + eau DEC	2025-11-03	2025-12-14 16:48:16.576	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
184	2	expense	1150.00	Autre	@FENO	2025-11-03	2025-12-14 16:48:16.587	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
185	1	expense	15800.00	Autres	NON SUIVI	2025-11-03	2025-12-14 16:48:16.633	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
247	1	expense	25000.00	Autre	News (5jrs)	2025-11-07	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
186	5	expense	100000.00	DOIT	Règlement DOIT spontan& @NENY	2025-11-08	2025-12-14 16:48:16.646	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
248	1	expense	4500.00	Autre	Photocopie/Impression	2025-11-08	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
249	1	income	200000.00	Autre	Transfert de MVOLA	2025-11-09	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
250	1	expense	4000.00	Autre	Bajaj	2025-11-09	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
370	2	expense	200000.00	Autre	Transfert vers Argent liquide	2025-11-09	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
371	2	expense	11000.00	Autre	Crédits Phone	2025-11-09	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
372	2	expense	505200.00	Autre	RAPATR @DOVIC	2025-11-09	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
373	2	expense	2600.00	Autre	Retrait 200.000ar	2025-11-09	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
251	1	expense	3000.00	Autre	Saucisse	2025-11-10	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
252	1	expense	157100.00	Autre	Extra NON SUIVI ❎	2025-11-10	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
374	2	expense	257600.00	Autre	Comptable Octobre_25	2025-11-10	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
375	2	expense	72000.00	Autre	@DELAH	2025-11-10	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
376	2	expense	72000.00	Autre	@FENO	2025-11-10	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
377	2	income	3600.00	Autre	Bonus Mvola	2025-11-10	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
253	1	expense	5500.00	Autre	Sakafo, News	2025-11-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
254	1	expense	6100.00	Autre	News, Café, Extra-propre	2025-11-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
378	2	expense	405750.00	Autre	Afterwork	2025-11-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
503	1	expense	25000.00	Autre	News (5jrs)	2025-11-11	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
255	1	expense	30000.00	Autre	Afterwork	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
256	1	expense	10000.00	Autre	News	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
257	1	expense	4400.00	Autre	Patte (2), Laoka	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
258	1	income	60000.00	Autre	Transfert de MVOLA	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
259	1	expense	5000.00	Autre	News	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
260	1	expense	9500.00	Autre	Sakafo Atoandro (Tsaradia)	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
379	2	expense	1500.00	Autre	Retrait 60.000ar	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
380	2	expense	60000.00	Autre	Transfert vers Argent liquide	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
381	2	expense	2150.00	Autre	Mora 2000 @Lalaina	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
382	2	expense	10150.00	Autre	First Premium 10.000ar @Volana_Mines	2025-11-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
504	1	expense	4500.00	Autre	Photocopie/Impression	2025-11-12	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
261	1	expense	900.00	Autre	Café, Extra-propre	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
262	1	expense	13200.00	Autre	Afterwork	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
263	1	income	40000.00	Autre	Transfert de MVOLA	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
264	1	expense	6000.00	Autre	News	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
265	1	expense	5000.00	Autre	Sakafo (Atoandro_Hotely)	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
383	2	expense	1008500.00	Autre	@HIROKO	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
384	2	expense	1150.00	Autre	Mora 1000 @Lalaina	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
385	2	expense	40000.00	Autre	Transfert vers Argent liquide	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
386	2	expense	1000.00	Autre	Retrait 40k Ar	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
387	2	expense	2150.00	Autre	Yellow 2000 @Sarobidy	2025-11-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
505	1	income	200000.00	Autre	Transfert de MVOLA	2025-11-13	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
506	1	expense	4000.00	Autre	Bajaj	2025-11-13	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
188	1	income	100000.00	Autre	Transfert de COFFRE	2025-11-14	2025-12-14 16:48:16.672	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
189	1	expense	100000.00	Autre	Piscine Flot Bleu	2025-11-14	2025-12-14 16:48:16.682	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
190	1	expense	5000.00	Autre	News	2025-11-14	2025-12-14 16:48:16.717	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
191	1	expense	7500.00	Autre	Barber S&E Me	2025-11-14	2025-12-14 16:48:16.727	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
192	5	expense	100000.00	Autre	Transfert vers Argent liquide	2025-11-14	2025-12-14 16:48:16.739	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
193	2	expense	10000.00	Autre	First Premium 10.000ar	2025-11-14	2025-12-14 16:48:16.749	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
195	2	income	1950.00	Autres	BONUS	2025-11-14	2025-12-14 16:48:16.768	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
266	1	income	1000000.00	Autre	Transfert de COFFRE	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
267	1	expense	60000.00	Autre	Afterwork	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
268	1	expense	4000.00	Autre	Bajaj	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
269	1	expense	800.00	Autre	Photocopie/Impression	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
270	1	expense	11000.00	Autre	Sakafo, Duru, Extra-propre, Café GM	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
271	1	expense	4600.00	Autre	News	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
453	3	expense	869400.00	Autre	Commission @Hiroko PLG_FLPT	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
454	3	income	900000.00	Autre	Transfert de COFFRE	2025-11-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
507	1	expense	3000.00	Autre	Saucisse	2025-11-14	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
508	1	expense	157100.00	Autre	Extra NON SUIVI ❎	2025-11-14	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
272	1	expense	20000.00	Autre	@SAROBIDY	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
273	1	expense	13000.00	Autre	Carburant @lalaina	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
274	1	expense	26000.00	Autre	Afterwork	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
275	1	expense	900000.00	Autre	Transfert vers ORANGE MONEY	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
276	1	expense	70000.00	Autre	Transfert vers ORANGE MONEY	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
455	3	income	900000.00	Autre	Transfert de Argent liquide	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
456	3	income	70000.00	Autre	Transfert de Argent liquide	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
457	3	expense	869400.00	Autre	@HIROKO	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
458	3	expense	500.00	Autre	Bé 500	2025-11-15	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
509	1	expense	5500.00	Autre	Sakafo, News	2025-11-15	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
510	1	expense	6100.00	Autre	News, Café, Extra-propre	2025-11-15	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
198	1	expense	80000.00	Autre	@TAHIANA @STAN/ETHAN @KEVIN/SEHENO	2025-11-16	2025-12-14 16:48:16.825	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
199	1	expense	5000.00	Autre	News	2025-11-16	2025-12-14 16:48:16.84	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
200	1	income	84700.00	Autre	Transfert de COFFRE	2025-11-16	2025-12-14 16:48:16.851	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
201	1	income	10000.00	Autre	Transfert de BOA	2025-11-16	2025-12-14 16:48:16.862	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
203	5	expense	84700.00	Autre	Transfert vers Argent liquide	2025-11-16	2025-12-14 16:48:16.887	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
204	2	expense	2000.00	Autre	Yellow 2000	2025-11-16	2025-12-14 16:48:16.927	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
277	1	expense	200000.00	Autre	@SAROBIDY	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
278	1	income	1000000.00	Autre	Transfert de COFFRE	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
279	1	expense	100000.00	Autre	Transfert vers MVOLA	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
280	1	expense	200000.00	Autre	@FENO	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
281	1	expense	100000.00	Autre	Hébergement @FENO @LALAINA	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
282	1	expense	60000.00	Autre	MJG > TNR	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
283	1	expense	15000.00	Autre	Bajaj	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
284	1	expense	32500.00	Autre	Voan-dalana MJG	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
285	1	expense	32000.00	Autre	Avant Départ TNR	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
388	2	expense	2150.00	Autre	@SAROBIDY	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
389	2	income	100000.00	Autre	Transfert de Argent liquide	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
390	2	expense	101500.00	Autre	@WILLY_FLPT	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
391	2	expense	13950.00	Autre	À Verifier ❎⌛	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
459	3	expense	51800.00	Autre	@NAINA	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
460	3	expense	83032.26	Autre	Connexion Orange OCT/25	2025-11-16	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
511	1	expense	30000.00	Autre	Afterwork	2025-11-16	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
512	1	expense	10000.00	Autre	News	2025-11-16	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
513	1	expense	4400.00	Autre	Patte (2), Laoka	2025-11-16	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
514	1	income	60000.00	Autre	Transfert de MVOLA	2025-11-16	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
515	1	expense	9500.00	Autre	Sakafo Atoandro (Tsaradia)	2025-11-16	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
286	1	expense	268100.00	Autre	Extra NON SUIVI ❎	2025-11-17	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
516	1	expense	900.00	Autre	Café, Extra-propre	2025-11-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
517	1	expense	13200.00	Autre	Afterwork	2025-11-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
518	1	income	40000.00	Autre	Transfert de MVOLA	2025-11-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
519	1	expense	6000.00	Autre	News	2025-11-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
520	1	expense	5000.00	Autre	Sakafo (Atoandro_Hotely)	2025-11-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
287	1	income	1000000.00	Autre	Transfert de COFFRE	2025-11-18	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
288	1	expense	159900.00	Autre	Fête A/BAO	2025-11-18	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
392	2	expense	5000.00	Autre	Mora +5000	2025-11-18	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
468	4	expense	191730.00	Autre	Fêtes A/Bao	2025-11-18	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
521	1	income	100000.00	Autre	Transfert de COFFRE	2025-11-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
522	1	expense	60000.00	Autre	Afterwork	2025-11-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
523	1	expense	4000.00	Autre	Bajaj	2025-11-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
524	1	expense	800.00	Autre	Photocopie/Impression	2025-11-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
525	1	expense	11000.00	Autre	Sakafo, Duru, Extra-propre, Café GM	2025-11-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
526	1	expense	4600.00	Autre	News	2025-11-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
289	1	expense	200000.00	Autre	Transfert vers MVOLA	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
290	1	expense	510000.00	Autre	Transfert vers ORANGE MONEY	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
291	1	expense	85000.00	Autre	T-shirt (4)	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
292	1	income	20000.00	Autre	Transfert de MVOLA	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
293	1	expense	12000.00	Autre	Moto A/vona Cotisse	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
294	1	expense	12000.00	Autre	Sakafo + Coca	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
295	1	expense	5000.00	Autre	News	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
296	1	expense	27200.00	Autre	@TAHIANA	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
393	2	income	200000.00	Autre	Transfert de Argent liquide	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
394	2	expense	43400.00	Autre	TNR 🚐 TVE	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
395	2	expense	20000.00	Autre	Transfert vers Argent liquide	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
396	2	expense	410.00	Autre	Retrait 20.000ar	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
397	2	expense	10000.00	Autre	First Premium 10.000ar	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
461	3	income	510000.00	Autre	Transfert de Argent liquide	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
462	3	expense	506300.00	Autre	@NAIVO	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
463	3	expense	499.74	Autre	Frais	2025-11-19	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
527	1	expense	20000.00	Autre	@SAROBIDY	2025-11-19	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
528	1	expense	13000.00	Autre	Carburant @lalaina	2025-11-19	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
529	1	expense	26000.00	Autre	Afterwork	2025-11-19	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
530	1	expense	900000.00	Autre	Transfert vers ORANGE MONEY	2025-11-19	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
531	1	expense	70000.00	Autre	Transfert vers ORANGE MONEY	2025-11-19	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
297	1	income	300000.00	Autre	Transfert de BOA	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
298	1	expense	136700.00	Autre	T/ve @ZO @LALAINA @HIROKO	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
299	1	expense	150000.00	Autre	Transfert vers ORANGE MONEY	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
300	1	expense	1500.00	Autre	Bajaj	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
398	2	expense	9150.00	Autre	Crédits Phone	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
464	3	income	150000.00	Autre	Transfert de Argent liquide	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
465	3	expense	154350.00	Autre	Divorce @TANTELY	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
469	4	expense	300000.00	Autre	Transfert vers Argent liquide	2025-11-20	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
532	1	expense	200000.00	Autre	@SAROBIDY	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
533	1	income	1000000.00	Autre	Transfert de COFFRE	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
534	1	expense	100000.00	Autre	Transfert vers MVOLA	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
535	1	expense	200000.00	Autre	@FENO	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
536	1	expense	100000.00	Autre	Hébergement @FENO @LALAINA	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
537	1	expense	60000.00	Autre	MJG > TNR	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
538	1	expense	15000.00	Autre	Bajaj	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
539	1	expense	32500.00	Autre	Voan-dalana MJG	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
540	1	expense	32000.00	Autre	Avant Départ TNR	2025-11-20	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
301	1	expense	12000.00	Autre	Bajaj	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
302	1	expense	1000.00	Autre	Carte Telma	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
303	1	expense	123500.00	Autre	@HIROKO MIAMI/LONGO	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
304	1	income	2000000.00	Autre	Transfert de COFFRE	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
305	1	expense	5000.00	Autre	News	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
306	1	expense	10000.00	Autre	Transfert vers MVOLA	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
399	2	income	10000.00	Autre	Transfert de Argent liquide	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
400	2	income	210.00	Autre	Bonus Mvola	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
401	2	expense	143600.00	Autre	@frais M/va ➡️ T/ve @DELAH @ZOKINY	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
402	2	expense	5000.00	Autre	Netweek 5000	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
403	2	income	1000.00	Autre	Bonus Mvola	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
404	2	expense	2500.00	Autre	Frais	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
466	3	expense	250.00	Autre	Bé 500	2025-11-21	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
541	1	expense	268100.00	Autre	Extra NON SUIVI ❎	2025-11-21	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
205	1	expense	10000.00	Autre	Cantine, Goûtés	2025-11-22	2025-12-14 16:48:16.943	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
206	1	expense	27000.00	Autre	Odikankana (S&E, Me)	2025-11-22	2025-12-14 16:48:16.953	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
207	1	expense	30000.00	Autre	Taxi-moto @Mines	2025-11-22	2025-12-14 16:48:16.963	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
208	1	expense	5000.00	Autre	News	2025-11-22	2025-12-14 16:48:16.976	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
209	1	expense	10000.00	Autre	Brosse	2025-11-22	2025-12-14 16:48:16.986	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
210	1	expense	3000000.00	Autre	Règlement FINEX	2025-11-22	2025-12-14 16:48:17.016	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
211	1	income	3575500.00	Autre	Transfert de COFFRE	2025-11-22	2025-12-14 16:48:17.025	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
212	5	expense	420000.00	Autre	Transfert vers MVOLA	2025-11-22	2025-12-14 16:48:17.039	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
213	5	expense	3575500.00	Autre	Transfert vers Argent liquide	2025-11-22	2025-12-14 16:48:17.049	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
214	2	income	420000.00	Autre	Transfert de COFFRE	2025-11-22	2025-12-14 16:48:17.059	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
215	2	expense	405700.00	Autre	Envoi Mvola @DELAH	2025-11-22	2025-12-14 16:48:17.071	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
216	2	expense	1150.00	Autre	@SAROBIDY	2025-11-22	2025-12-14 16:48:17.083	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
217	2	expense	7355.00	Autre	Loisirs	2025-11-22	2025-12-14 16:48:17.121	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
218	2	income	1000.00	Autre	Bonus Mvola	2025-11-22	2025-12-14 16:48:17.129	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
307	1	expense	5500.00	Autre	Bajaj	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
308	1	expense	12000.00	Autre	Queens	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
309	1	expense	36600.00	Autre	@LALAINA	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
310	1	expense	975000.00	Autre	Transfert vers MVOLA	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
311	1	expense	72000.00	Autre	Aigle D'or	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
405	2	expense	126100.00	Autre	Doit @LALAINA + Frais @FENO	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
406	2	income	1600.00	Autre	Bonus Mvola	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
407	2	income	975000.00	Autre	Transfert de Argent liquide	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
408	2	expense	848200.00	Autre	@RANDOU	2025-11-22	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
542	1	income	1000000.00	Autre	Transfert de COFFRE	2025-11-22	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
543	1	expense	159900.00	Autre	Fête A/BAO	2025-11-22	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
219	1	expense	10000.00	Autre	Cantine, Goûtés	2025-11-23	2025-12-14 16:48:17.141	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
220	1	expense	28500.00	Autre	Médicament FOIE	2025-11-23	2025-12-14 16:48:17.15	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
221	1	expense	460000.00	Autre	Étagères (02)	2025-11-23	2025-12-14 16:48:17.159	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
222	1	expense	5000.00	Autre	News	2025-11-23	2025-12-14 16:48:17.173	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
312	1	expense	1000.00	Autre	News (4)	2025-11-23	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
313	1	expense	300.00	Autre	Café	2025-11-23	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
314	1	expense	120000.00	Autre	Transfert vers MVOLA	2025-11-23	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
409	2	income	120000.00	Autre	Transfert de Argent liquide	2025-11-23	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
410	2	expense	57000.00	Autre	Perplexity 12mois	2025-11-23	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
411	2	expense	62000.00	Autre	Dentiste @SAROBIDY	2025-11-23	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
412	2	income	500.00	Autre	Bonus Mvola	2025-11-23	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
544	1	expense	200000.00	Autre	Transfert vers MVOLA	2025-11-23	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
545	1	expense	510000.00	Autre	Transfert vers ORANGE MONEY	2025-11-23	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
546	1	expense	85000.00	Autre	T-shirt (4)	2025-11-23	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
547	1	income	20000.00	Autre	Transfert de MVOLA	2025-11-23	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
548	1	expense	12000.00	Autre	Moto A/vona Cotisse	2025-11-23	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
549	1	expense	12000.00	Autre	Sakafo + Coca	2025-11-23	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
550	1	expense	27200.00	Autre	@TAHIANA	2025-11-23	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
551	1	income	300000.00	Autre	Transfert de BOA	2025-11-24	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
552	1	expense	136700.00	Autre	T/ve @ZO @LALAINA @HIROKO	2025-11-24	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
553	1	expense	150000.00	Autre	Transfert vers ORANGE MONEY	2025-11-24	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
554	1	expense	1500.00	Autre	Bajaj	2025-11-24	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
555	1	expense	12000.00	Autre	Bajaj	2025-11-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
556	1	expense	1000.00	Autre	Carte Telma	2025-11-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
557	1	expense	123500.00	Autre	@HIROKO MIAMI/LONGO	2025-11-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
558	1	income	2000000.00	Autre	Transfert de COFFRE	2025-11-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
559	1	expense	5000.00	Autre	News	2025-11-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
560	1	expense	10000.00	Autre	Transfert vers MVOLA	2025-11-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
422	2	expense	130600.00	Autre	Loyer + eau DEC	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
423	2	expense	1150.00	Autre	@FENO	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
424	2	income	1950.00	Autre	Bonus Mvola	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
471	4	expense	25100.00	Autre	Frais Pack MID (BOA)	2025-11-30	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
570	1	expense	300000.00	Autre	Transfert vers MVOLA	2025-11-30	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
239	5	expense	2000000.00	Administratif	NEMO EXPORT - Création NIF/STAT/RCS/Sièges	2025-12-01	2025-12-14 16:48:17.441	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
342	1	income	100000.00	Autre	Transfert de COFFRE	2025-12-01	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
343	1	expense	100000.00	Autre	Piscine Flot Bleu	2025-12-01	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
344	1	expense	5000.00	Autre	News	2025-12-01	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
345	1	expense	7500.00	Autre	Barber S&E Me	2025-12-01	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
425	2	expense	10000.00	Autre	First Premium 10.000ar	2025-12-01	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
346	1	expense	80000.00	Autre	@TAHIANA @STAN/ETHAN @KEVIN/SEHENO	2025-12-02	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
347	1	expense	5000.00	Autre	News	2025-12-02	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
348	1	income	84700.00	Autre	Transfert de COFFRE	2025-12-02	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
349	1	income	10000.00	Autre	Transfert de BOA	2025-12-02	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
426	2	expense	2000.00	Autre	Yellow 2000	2025-12-02	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
472	4	expense	10000.00	Autre	Transfert vers Argent liquide	2025-12-02	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
571	1	expense	4000.00	Autre	@FENO frais	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
572	1	expense	9600.00	Autre	Taxibe Alakamisy, Taxi-moto	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
573	1	expense	32000.00	Autre	Goûtés Tacos (4)	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
574	1	income	100000.00	Autre	Transfert de BOA	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
575	1	expense	66900.00	Autre	Alakamisy	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
576	1	expense	3900.00	Autre	Atody (5), Café (1)	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
577	1	expense	10000.00	Autre	Cantine, Goûtés	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
578	1	expense	5000.00	Autre	Duru (1), Crédit_Rabebe 1000ar	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
579	1	income	765900.00	Autre	Apport	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
580	1	expense	160000.00	Autre	Parfum INVICTUS (1), SO SCANDAL (1)	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
581	1	expense	35000.00	Autre	Taxi Rentrée_hopital @papa	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
582	1	expense	5000.00	Autre	Sakafo (Atoandro_Hotely)	2025-12-02	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
350	1	expense	10000.00	Autre	Cantine, Goûtés	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
351	1	expense	27000.00	Autre	Odikankana (S&E, Me)	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
352	1	expense	30000.00	Autre	Taxi-moto @Mines	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
353	1	expense	5000.00	Autre	News	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
354	1	expense	10000.00	Autre	Brosse	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
355	1	expense	3000000.00	Autre	Règlement FINEX	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
356	1	income	3575500.00	Autre	Transfert de COFFRE	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
427	2	income	420000.00	Autre	Transfert de COFFRE	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
428	2	expense	405700.00	Autre	Envoi Mvola @DELAH	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
429	2	expense	1150.00	Autre	@SAROBIDY	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
430	2	expense	7355.00	Autre	Loisirs	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
431	2	income	1000.00	Autre	Bonus Mvola	2025-12-03	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
583	1	expense	800.00	Autre	Café	2025-12-03	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
584	1	expense	620000.00	Autre	Transfert vers MVOLA	2025-12-03	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
242	1	expense	60000.00	Autre	Transfert vers MVOLA	2025-12-04	2025-12-14 16:48:17.478	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
243	2	income	60000.00	Autre	Transfert de Argent liquide	2025-12-04	2025-12-14 16:48:17.487	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
357	1	expense	10000.00	Autre	Cantine, Goûtés	2025-12-04	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
358	1	expense	28500.00	Autre	Médicament FOIE	2025-12-04	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
359	1	expense	460000.00	Autre	Étagères (02)	2025-12-04	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
360	1	expense	5000.00	Autre	News	2025-12-04	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
585	1	expense	7000.00	Autre	Cantine, Goûtés	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
586	1	expense	120000.00	Autre	Transfert vers MVOLA	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
587	1	expense	7000.00	Autre	Sakafo (Atoandro_Hotely avec  @Feno)	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
588	1	expense	52000.00	Autre	Taxi-moto T/maty-A/bao-Ville-A/misy	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
589	1	expense	1100.00	Autre	Taxibe T/Maty/A/misy-A/bao	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
590	1	income	100000.00	Autre	Transfert de COFFRE	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
591	1	expense	100000.00	Autre	@FENO	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
592	1	expense	25600.00	Autre	Afterwork	2025-12-04	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
244	1	expense	10000.00	Autre	Sakafo (RN2)	2025-12-05	2025-12-14 16:48:17.523	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
245	2	expense	41600.00	Autre	TNR>TMV	2025-12-05	2025-12-14 16:48:17.533	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
593	1	income	100000.00	Autre	Transfert de COFFRE	2025-12-05	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
594	1	expense	100000.00	Autre	Piscine Flot Bleu	2025-12-05	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
595	1	expense	5000.00	Autre	News	2025-12-05	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
596	1	expense	7500.00	Autre	Barber S&E Me	2025-12-05	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
361	1	income	1900600.00	Autre	Transfert de COFFRE	2025-12-06	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
597	1	expense	80000.00	Autre	@TAHIANA @STAN/ETHAN @KEVIN/SEHENO	2025-12-06	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
598	1	expense	5000.00	Autre	News	2025-12-06	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
599	1	income	84700.00	Autre	Transfert de COFFRE	2025-12-06	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
600	1	income	10000.00	Autre	Transfert de BOA	2025-12-06	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
362	1	expense	15500.00	Autre	TMV (12>14)	2025-12-07	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
432	2	expense	4000.00	Autre	Crédits Phone	2025-12-07	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
467	3	expense	250.00	Autre	Crédits Phone	2025-12-07	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
601	1	expense	10000.00	Autre	Cantine, Goûtés	2025-12-07	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
602	1	expense	27000.00	Autre	Odikankana (S&E, Me)	2025-12-07	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
603	1	expense	30000.00	Autre	Taxi-moto @Mines	2025-12-07	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
604	1	expense	5000.00	Autre	News	2025-12-07	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
605	1	expense	10000.00	Autre	Brosse	2025-12-07	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
606	1	expense	3000000.00	Autre	Règlement FINEX	2025-12-07	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
607	1	income	3575500.00	Autre	Transfert de COFFRE	2025-12-07	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
433	2	income	630.00	Autre	Bonus Mvola	2025-12-08	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
608	1	expense	10000.00	Autre	Cantine, Goûtés	2025-12-08	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
609	1	expense	28500.00	Autre	Médicament FOIE	2025-12-08	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
610	1	expense	460000.00	Autre	Étagères (02)	2025-12-08	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
611	1	expense	5000.00	Autre	News	2025-12-08	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
434	2	expense	5000.00	Autre	Crédits Phone	2025-12-10	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
612	1	income	1900600.00	Autre	Transfert de COFFRE	2025-12-10	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
363	1	expense	300000.00	Autre	Transfert vers MVOLA	2025-12-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
435	2	income	300000.00	Autre	Transfert de Argent liquide	2025-12-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
436	2	expense	254400.00	Autre	Commission @Comptable_DEC/2025	2025-12-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
437	2	expense	10405.00	Autre	@Felicia	2025-12-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
438	2	income	130.00	Autre	Bonus Mvola	2025-12-11	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
613	1	expense	15500.00	Autre	TMV (12>14)	2025-12-11	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
364	1	expense	60000.00	Autre	Transfert vers MVOLA	2025-12-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
365	1	expense	96000.00	Autre	Dépenses >17/12	2025-12-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
439	2	income	60000.00	Autre	Transfert de Argent liquide	2025-12-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
440	2	expense	10000.00	Autre	First Premium 10.000ar	2025-12-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
441	2	expense	11275.00	Autre	@VAL	2025-12-12	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
366	1	expense	10000.00	Autre	Sakafo (RN2)	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
367	1	expense	50000.00	Autre	Transfert vers MVOLA	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
368	1	expense	12500.00	Autre	17-18/12	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
442	2	expense	41600.00	Autre	TNR>TMV	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
443	2	income	1000.00	Autre	Bonus Mvola	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
444	2	income	50000.00	Autre	Transfert de Argent liquide	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
445	2	expense	51800.00	Autre	Envoi @DELAH	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
446	2	expense	15000.00	Autre	First Premium 15.000ar	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
447	2	expense	650.00	Autre	Mvola	2025-12-13	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
369	1	expense	300000.00	Autre	Transfert vers MVOLA	2025-12-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
448	2	expense	1000.00	Autre	Yellow One	2025-12-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
449	2	income	300000.00	Autre	Transfert de Argent liquide	2025-12-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
450	2	expense	51800.00	Autre	@NENY ECHO	2025-12-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
451	2	expense	174400.00	Autre	@SAROBIDY MJG>TNR>MJG	2025-12-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
452	2	expense	51800.00	Autre	@volana_mines #Noel	2025-12-14	2025-12-18 15:59:42.557	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
479	5	income	42000000.00	Remboursement Receivables	Remboursement HUGUES - RETOUR/KIA PRIDE	2025-12-14	2025-12-19 12:23:27.718	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
487	5	expense	7000000.00	Fonds de roulement	CAPITAL INVESTING - Capital investi	2025-12-14	2025-12-20 08:59:20.342	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
614	1	expense	300000.00	Autre	Transfert vers MVOLA	2025-12-15	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
495	5	expense	10000000.00	Permis & Admin	CARRIERE MAROVOAY - AVANCE #1 (Dépense)	2025-12-16	2025-12-21 13:10:51.61	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
615	1	expense	60000.00	Autre	Transfert vers MVOLA	2025-12-16	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
616	1	expense	96000.00	Autre	Dépenses >17/12	2025-12-16	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
617	1	expense	10000.00	Autre	Sakafo (RN2)	2025-12-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
618	1	expense	50000.00	Autre	Transfert vers MVOLA	2025-12-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
619	1	expense	12500.00	Autre	17-18/12	2025-12-17	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
502	5	expense	200000.00	Commissions	Commission @ANDRY Syndicat Mines	2025-12-18	2025-12-27 15:28:17.716	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
620	1	expense	300000.00	Autre	Transfert vers MVOLA	2025-12-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
621	1	expense	50000.00	Autre	Transfert vers MVOLA	2025-12-18	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
622	1	expense	50000.00	Autre	Earbeards Remax	2025-12-21	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
623	1	expense	20000.00	Autre	Transfert vers MVOLA	2025-12-21	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
624	1	expense	200000.00	Autre	NEMO EXPORT	2025-12-21	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
625	1	expense	168600.00	Autre	Dépenses 18>24/12/25 (À Détailler 📌)	2025-12-21	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
626	1	expense	400000.00	Autre	Avance #1 FENO	2025-12-22	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
627	1	expense	494500.00	Autre	TMV>TNR	2025-12-22	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
628	1	income	7000000.00	Autre	Transfert de COFFRE	2025-12-24	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
629	1	expense	554000.00	Autre	Noël STAN, ETHAN, MITIA	2025-12-24	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
630	1	expense	240000.00	Autre	@NENY	2025-12-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
631	1	expense	140000.00	Autre	MJG>TNR>MJG	2025-12-25	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
501	5	expense	25000000.00	Permis & Admin	CARRIERE MAROVOAY - AVANCE #2 (Dépense)	2025-12-26	2025-12-27 15:00:12.617	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
642	1	expense	250000.00	Administratif	Préparation création de la société	2025-12-27	2026-01-04 17:22:09.331	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
643	1	expense	150000.00	Administratif	CIN + Casier @NAYA	2025-12-28	2026-01-05 00:29:39.81	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
632	1	expense	200000.00	Autre	Avance #2 FENO	2025-12-30	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
633	1	expense	2373800.00	Autre	À VERIFIER 🎯💯🛑🚧	2025-12-30	2025-12-31 17:28:12.678	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
634	1	expense	40400.00	Autres	BALANCE #NCE 	2025-12-30	2025-12-31 17:35:41.913	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
635	5	expense	6800000.00	Ajustement Balance	Ajustement pour rétablir le solde à 40,000,000 Ar	2025-12-31	2025-12-31 18:50:11.881	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
647	1	expense	400000.00	Administratif	AVANCE DEPOT	2025-12-31	2026-01-05 02:40:59.95	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
639	1	expense	100000.00	Administratif	CIN @FENO	2026-01-01	2026-01-04 17:10:46.953	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
644	1	expense	100000.00	Aide	Soins @HIROKO	2026-01-02	2026-01-05 00:31:09.926	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
651	1	expense	40000.00	Moto	Carburant(s)	2026-01-02	2026-01-05 02:53:56.551	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
636	1	expense	1100000.00	Receivables	Receivable NAIVO - Doit	2026-01-03	2026-01-04 16:56:04.629	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
637	1	expense	379500.00	Loisirs	Sortie avec les cousines et enfants (Aero Pizza)	2026-01-03	2026-01-04 16:57:12.963	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
648	1	expense	50000.00	Administratif	Bulletin N°3 @FENO	2026-01-03	2026-01-05 02:43:36.363	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
638	1	expense	50000.00	Aide	@Tou Zha	2026-01-04	2026-01-04 16:57:49.724	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
645	1	expense	235000.00	Aide	Bonne année + Frais TANA @SORIBIDY	2026-01-04	2026-01-05 00:31:48.756	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
649	1	expense	20000.00	Goûters	Stan & Ethan	2026-01-04	2026-01-05 02:49:45.197	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
650	1	expense	30000.00	Afterwork	wth @TAHIANA	2026-01-04	2026-01-05 02:52:07.154	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
652	1	expense	25000.00	Afterwork	wth @GOUM	2026-01-04	2026-01-05 15:31:35.912	f	\N	t	2026-01-06 20:39:53.816728	\N	\N	\N	1	\N
\.


--
-- Data for Name: visions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.visions (id, content, mission, "values", created_at, updated_at) FROM stdin;
\.


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.accounts_id_seq', 7, true);


--
-- Name: app_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_settings_id_seq', 1, true);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 39, true);


--
-- Name: content_derivatives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.content_derivatives_id_seq', 1, false);


--
-- Name: content_master_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.content_master_id_seq', 1, false);


--
-- Name: derivatives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.derivatives_id_seq', 1, false);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 1, false);


--
-- Name: master_content_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.master_content_id_seq', 1, false);


--
-- Name: notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notes_id_seq', 8, true);


--
-- Name: objectives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.objectives_id_seq', 1, false);


--
-- Name: operator_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.operator_tasks_id_seq', 1, false);


--
-- Name: partner_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.partner_payments_id_seq', 1, false);


--
-- Name: profit_distributions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.profit_distributions_id_seq', 1, false);


--
-- Name: project_expense_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_expense_lines_id_seq', 390, true);


--
-- Name: project_partners_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_partners_id_seq', 1, false);


--
-- Name: project_revenue_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.project_revenue_lines_id_seq', 137, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_id_seq', 32, true);


--
-- Name: receivables_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.receivables_id_seq', 8, true);


--
-- Name: sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sessions_id_seq', 129, true);


--
-- Name: sops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sops_id_seq', 7, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tasks_id_seq', 1, false);


--
-- Name: transaction_linking_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transaction_linking_log_id_seq', 1, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 67995, true);


--
-- Name: visions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.visions_id_seq', 4, true);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: content_derivatives content_derivatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_derivatives
    ADD CONSTRAINT content_derivatives_pkey PRIMARY KEY (id);


--
-- Name: content_master content_master_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_master
    ADD CONSTRAINT content_master_pkey PRIMARY KEY (id);


--
-- Name: derivatives derivatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.derivatives
    ADD CONSTRAINT derivatives_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: master_content master_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_content
    ADD CONSTRAINT master_content_pkey PRIMARY KEY (id);


--
-- Name: transactions no_duplicates; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT no_duplicates UNIQUE (account_id, transaction_date, amount, description, type);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: objectives objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_pkey PRIMARY KEY (id);


--
-- Name: operator_tasks operator_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_tasks
    ADD CONSTRAINT operator_tasks_pkey PRIMARY KEY (id);


--
-- Name: partner_payments partner_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payments
    ADD CONSTRAINT partner_payments_pkey PRIMARY KEY (id);


--
-- Name: profit_distributions profit_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_distributions
    ADD CONSTRAINT profit_distributions_pkey PRIMARY KEY (id);


--
-- Name: project_expense_lines project_expense_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expense_lines
    ADD CONSTRAINT project_expense_lines_pkey PRIMARY KEY (id);


--
-- Name: project_partners project_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_partners
    ADD CONSTRAINT project_partners_pkey PRIMARY KEY (id);


--
-- Name: project_revenue_lines project_revenue_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_revenue_lines
    ADD CONSTRAINT project_revenue_lines_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: receivables receivables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: sops sops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sops
    ADD CONSTRAINT sops_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: transaction_linking_log transaction_linking_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_linking_log
    ADD CONSTRAINT transaction_linking_log_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: project_expense_lines unique_expense_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expense_lines
    ADD CONSTRAINT unique_expense_line UNIQUE (project_id, description, projected_amount);


--
-- Name: transactions unique_transaction; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT unique_transaction UNIQUE (account_id, transaction_date, amount, type, description);


--
-- Name: visions visions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visions
    ADD CONSTRAINT visions_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_type_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_type_balance ON public.accounts USING btree (type, balance DESC);


--
-- Name: idx_accounts_type_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_type_name ON public.accounts USING btree (type, name);


--
-- Name: idx_accounts_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_userid ON public.accounts USING btree (user_id);


--
-- Name: idx_categories_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_name ON public.categories USING btree (name text_pattern_ops);


--
-- Name: idx_categories_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_userid ON public.categories USING btree (user_id);


--
-- Name: idx_derivatives_master_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_derivatives_master_id ON public.derivatives USING btree (master_id);


--
-- Name: idx_derivatives_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_derivatives_platform ON public.derivatives USING btree (platform);


--
-- Name: idx_derivatives_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_derivatives_status ON public.derivatives USING btree (status);


--
-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_department ON public.employees USING btree (department);


--
-- Name: idx_employees_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_dept ON public.employees USING btree (department);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_position ON public.employees USING btree ("position");


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_expense_lines_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_lines_category ON public.project_expense_lines USING btree (category);


--
-- Name: idx_expense_lines_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_lines_date ON public.project_expense_lines USING btree (transaction_date DESC) WHERE (transaction_date IS NOT NULL);


--
-- Name: idx_expense_lines_is_paid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_lines_is_paid ON public.project_expense_lines USING btree (is_paid);


--
-- Name: idx_expense_lines_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_lines_project_id ON public.project_expense_lines USING btree (project_id);


--
-- Name: idx_expense_lines_synced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_lines_synced ON public.project_expense_lines USING btree (last_synced_at DESC) WHERE (last_synced_at IS NOT NULL);


--
-- Name: idx_expense_lines_unpaid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_lines_unpaid ON public.project_expense_lines USING btree (project_id, is_paid, projected_amount) WHERE (is_paid = false);


--
-- Name: idx_linking_log_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linking_log_date ON public.transaction_linking_log USING btree (performed_at);


--
-- Name: idx_linking_log_line; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linking_log_line ON public.transaction_linking_log USING btree (project_line_id);


--
-- Name: idx_linking_log_line_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linking_log_line_action ON public.transaction_linking_log USING btree (project_line_id, line_type, performed_at DESC);


--
-- Name: idx_linking_log_performer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linking_log_performer ON public.transaction_linking_log USING btree (performed_by);


--
-- Name: idx_linking_log_transaction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linking_log_transaction ON public.transaction_linking_log USING btree (transaction_id);


--
-- Name: idx_master_content_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_content_status ON public.master_content USING btree (status);


--
-- Name: idx_notes_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notes_created ON public.notes USING btree (created_at DESC);


--
-- Name: idx_objectives_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objectives_category ON public.objectives USING btree (category);


--
-- Name: idx_objectives_category_obj; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objectives_category_obj ON public.objectives USING btree (category);


--
-- Name: idx_objectives_completed_obj; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objectives_completed_obj ON public.objectives USING btree (completed);


--
-- Name: idx_objectives_progress; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_objectives_progress ON public.objectives USING btree (progress DESC);


--
-- Name: idx_operator_tasks_assigned_op; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operator_tasks_assigned_op ON public.operator_tasks USING btree (assigned_to);


--
-- Name: idx_operator_tasks_duedate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operator_tasks_duedate ON public.operator_tasks USING btree (due_date DESC) WHERE (due_date IS NOT NULL);


--
-- Name: idx_operator_tasks_priority_op; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operator_tasks_priority_op ON public.operator_tasks USING btree (priority, status);


--
-- Name: idx_operator_tasks_project_op; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_operator_tasks_project_op ON public.operator_tasks USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_partner_payments_distribution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_payments_distribution ON public.partner_payments USING btree (distribution_id);


--
-- Name: idx_partner_payments_partner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_partner_payments_partner ON public.partner_payments USING btree (partner_id);


--
-- Name: idx_profit_distributions_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profit_distributions_project ON public.profit_distributions USING btree (project_id);


--
-- Name: idx_proj_exp_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proj_exp_project_id ON public.project_expense_lines USING btree (project_id);


--
-- Name: idx_proj_rev_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_proj_rev_project_id ON public.project_revenue_lines USING btree (project_id);


--
-- Name: idx_project_expense_lines_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_expense_lines_transaction_id ON public.project_expense_lines USING btree (transaction_id);


--
-- Name: idx_project_partners_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_partners_project ON public.project_partners USING btree (project_id);


--
-- Name: idx_project_revenue_lines_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_revenue_lines_transaction_id ON public.project_revenue_lines USING btree (transaction_id);


--
-- Name: idx_projects_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_active ON public.projects USING btree (status, start_date) WHERE ((status)::text = ANY ((ARRAY['active'::character varying, 'draft'::character varying])::text[]));


--
-- Name: idx_projects_feasible_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_feasible_status ON public.projects USING btree (feasible, status) WHERE (feasible = true);


--
-- Name: idx_projects_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_metadata ON public.projects USING gin (metadata);


--
-- Name: idx_projects_roi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_roi ON public.projects USING btree (roi DESC) WHERE (roi IS NOT NULL);


--
-- Name: idx_projects_status_startdate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_status_startdate ON public.projects USING btree (status, start_date DESC);


--
-- Name: idx_projects_type_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_type_status ON public.projects USING btree (type, status);


--
-- Name: idx_projects_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_userid ON public.projects USING btree (user_id);


--
-- Name: idx_receivables_account_amount_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_account_amount_status ON public.receivables USING btree (account_id, amount, status);


--
-- Name: idx_receivables_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_created ON public.receivables USING btree (created_at DESC);


--
-- Name: idx_receivables_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_open ON public.receivables USING btree (status, amount) WHERE (status = 'open'::text);


--
-- Name: idx_receivables_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_person ON public.receivables USING btree (person text_pattern_ops);


--
-- Name: idx_receivables_source_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_source_account ON public.receivables USING btree (source_account_id) WHERE (source_account_id IS NOT NULL);


--
-- Name: idx_receivables_target_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_target_account ON public.receivables USING btree (target_account_id) WHERE (target_account_id IS NOT NULL);


--
-- Name: idx_receivables_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_receivables_userid ON public.receivables USING btree (user_id);


--
-- Name: idx_revenue_lines_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_lines_category ON public.project_revenue_lines USING btree (category);


--
-- Name: idx_revenue_lines_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_lines_date ON public.project_revenue_lines USING btree (transaction_date DESC) WHERE (transaction_date IS NOT NULL);


--
-- Name: idx_revenue_lines_is_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_lines_is_received ON public.project_revenue_lines USING btree (is_received);


--
-- Name: idx_revenue_lines_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_lines_project_id ON public.project_revenue_lines USING btree (project_id);


--
-- Name: idx_revenue_lines_synced; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_lines_synced ON public.project_revenue_lines USING btree (last_synced_at DESC) WHERE (last_synced_at IS NOT NULL);


--
-- Name: idx_revenue_lines_unreceived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revenue_lines_unreceived ON public.project_revenue_lines USING btree (project_id, is_received, projected_amount) WHERE (is_received = false);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_sessions_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_userid ON public.sessions USING btree (user_id);


--
-- Name: idx_sops_category_sops; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sops_category_sops ON public.sops USING btree (category);


--
-- Name: idx_sops_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sops_owner ON public.sops USING btree (owner);


--
-- Name: idx_sops_status_sops; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sops_status_sops ON public.sops USING btree (status);


--
-- Name: idx_tasks_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (assignee);


--
-- Name: idx_tasks_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_priority ON public.tasks USING btree (priority, status);


--
-- Name: idx_tasks_projectid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_projectid ON public.tasks USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_tasks_sop_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_sop_id ON public.tasks USING btree (sop_id);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_transactions_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_account ON public.transactions USING btree (account_id);


--
-- Name: idx_transactions_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_account_id ON public.transactions USING btree (account_id);


--
-- Name: idx_transactions_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_category ON public.transactions USING btree (category);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (transaction_date);


--
-- Name: idx_transactions_date_type_amount; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_date_type_amount ON public.transactions USING btree (transaction_date, type, amount);


--
-- Name: idx_transactions_description_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_description_gin ON public.transactions USING gin (to_tsvector('french'::regconfig, COALESCE(description, ''::text)));


--
-- Name: idx_transactions_is_planned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_is_planned ON public.transactions USING btree (is_planned);


--
-- Name: idx_transactions_posted_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_posted_date ON public.transactions USING btree (is_posted, transaction_date DESC);


--
-- Name: idx_transactions_project_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_project_date ON public.transactions USING btree (project_id, transaction_date DESC) WHERE (project_id IS NOT NULL);


--
-- Name: idx_transactions_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_project_id ON public.transactions USING btree (project_id);


--
-- Name: idx_transactions_project_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_project_line_id ON public.transactions USING btree (project_line_id);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: idx_transactions_userid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_userid ON public.transactions USING btree (user_id);


--
-- Name: receivables trg_receivables_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receivables_delete AFTER DELETE ON public.receivables FOR EACH STATEMENT EXECUTE FUNCTION public.update_receivables_account_balance();


--
-- Name: receivables trg_receivables_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receivables_insert AFTER INSERT ON public.receivables FOR EACH STATEMENT EXECUTE FUNCTION public.update_receivables_account_balance();


--
-- Name: receivables trg_receivables_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_receivables_update AFTER UPDATE ON public.receivables FOR EACH STATEMENT EXECUTE FUNCTION public.update_receivables_account_balance();


--
-- Name: transactions update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: content_derivatives content_derivatives_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_derivatives
    ADD CONSTRAINT content_derivatives_master_id_fkey FOREIGN KEY (master_id) REFERENCES public.content_master(id) ON DELETE CASCADE;


--
-- Name: derivatives derivatives_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.derivatives
    ADD CONSTRAINT derivatives_master_id_fkey FOREIGN KEY (master_id) REFERENCES public.master_content(id) ON DELETE CASCADE;


--
-- Name: operator_tasks operator_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_tasks
    ADD CONSTRAINT operator_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: operator_tasks operator_tasks_sop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_tasks
    ADD CONSTRAINT operator_tasks_sop_id_fkey FOREIGN KEY (sop_id) REFERENCES public.sops(id) ON DELETE SET NULL;


--
-- Name: partner_payments partner_payments_distribution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payments
    ADD CONSTRAINT partner_payments_distribution_id_fkey FOREIGN KEY (distribution_id) REFERENCES public.profit_distributions(id) ON DELETE CASCADE;


--
-- Name: partner_payments partner_payments_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payments
    ADD CONSTRAINT partner_payments_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.project_partners(id) ON DELETE CASCADE;


--
-- Name: partner_payments partner_payments_payment_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.partner_payments
    ADD CONSTRAINT partner_payments_payment_account_id_fkey FOREIGN KEY (payment_account_id) REFERENCES public.accounts(id);


--
-- Name: profit_distributions profit_distributions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profit_distributions
    ADD CONSTRAINT profit_distributions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_expense_lines project_expense_lines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expense_lines
    ADD CONSTRAINT project_expense_lines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_expense_lines project_expense_lines_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expense_lines
    ADD CONSTRAINT project_expense_lines_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: project_partners project_partners_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_partners
    ADD CONSTRAINT project_partners_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_revenue_lines project_revenue_lines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_revenue_lines
    ADD CONSTRAINT project_revenue_lines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_revenue_lines project_revenue_lines_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_revenue_lines
    ADD CONSTRAINT project_revenue_lines_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: receivables receivables_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: receivables receivables_source_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.accounts(id);


--
-- Name: receivables receivables_target_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_target_account_id_fkey FOREIGN KEY (target_account_id) REFERENCES public.accounts(id);


--
-- Name: sops sops_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sops
    ADD CONSTRAINT sops_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 41aMSMugsEGZNrxEah1fUFgfwLVzG4Ao8ys41g5sw8fHqOajgzQABlVHW434Eqh

