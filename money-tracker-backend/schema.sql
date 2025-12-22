--
-- PostgreSQL database dump
--

\restrict hFvUfZgvcbyMJIASOsfenacUPT2rRNpAKaaaTFHI6xp53EKwTATha9dYazJlqwH

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
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: link_transaction_to_line(integer, integer, character varying); Type: FUNCTION; Schema: public; Owner: m1
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


ALTER FUNCTION public.link_transaction_to_line(p_transaction_id integer, p_line_id integer, p_user character varying) OWNER TO m1;

--
-- Name: unlink_transaction(integer, character varying); Type: FUNCTION; Schema: public; Owner: m1
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


ALTER FUNCTION public.unlink_transaction(p_transaction_id integer, p_user character varying) OWNER TO m1;

--
-- Name: update_receivables_account_balance(); Type: FUNCTION; Schema: public; Owner: m1
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


ALTER FUNCTION public.update_receivables_account_balance() OWNER TO m1;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: m1
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO m1;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.accounts OWNER TO m1;

--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.accounts_id_seq OWNER TO m1;

--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: m1
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    pin_hash character varying(255) NOT NULL,
    is_masked boolean DEFAULT false,
    auto_lock_minutes integer DEFAULT 5,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.app_settings OWNER TO m1;

--
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.app_settings_id_seq OWNER TO m1;

--
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: m1
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(7) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer DEFAULT 1,
    CONSTRAINT categories_type_check CHECK (((type)::text = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::text[])))
);


ALTER TABLE public.categories OWNER TO m1;

--
-- Name: TABLE categories; Type: COMMENT; Schema: public; Owner: m1
--

COMMENT ON TABLE public.categories IS 'Catégories pour classer les transactions (ex: Quotidienne, VINA, Recettes).';


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.categories_id_seq OWNER TO m1;

--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: content_derivatives; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.content_derivatives OWNER TO m1;

--
-- Name: content_derivatives_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.content_derivatives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.content_derivatives_id_seq OWNER TO m1;

--
-- Name: content_derivatives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.content_derivatives_id_seq OWNED BY public.content_derivatives.id;


--
-- Name: content_master; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.content_master OWNER TO m1;

--
-- Name: content_master_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.content_master_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.content_master_id_seq OWNER TO m1;

--
-- Name: content_master_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.content_master_id_seq OWNED BY public.content_master.id;


--
-- Name: derivatives; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.derivatives OWNER TO m1;

--
-- Name: derivatives_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.derivatives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.derivatives_id_seq OWNER TO m1;

--
-- Name: derivatives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.derivatives_id_seq OWNED BY public.derivatives.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.employees OWNER TO m1;

--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.employees_id_seq OWNER TO m1;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: master_content; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.master_content OWNER TO m1;

--
-- Name: master_content_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.master_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.master_content_id_seq OWNER TO m1;

--
-- Name: master_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.master_content_id_seq OWNED BY public.master_content.id;


--
-- Name: notes; Type: TABLE; Schema: public; Owner: m1
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notes OWNER TO m1;

--
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notes_id_seq OWNER TO m1;

--
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- Name: objectives; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.objectives OWNER TO m1;

--
-- Name: objectives_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.objectives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.objectives_id_seq OWNER TO m1;

--
-- Name: objectives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.objectives_id_seq OWNED BY public.objectives.id;


--
-- Name: operator_sops; Type: TABLE; Schema: public; Owner: m1
--

CREATE TABLE public.operator_sops (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    owner character varying(100),
    avg_time integer,
    status character varying(50) DEFAULT 'draft'::character varying,
    category character varying(100),
    steps jsonb,
    checklist jsonb,
    lastreview date,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.operator_sops OWNER TO m1;

--
-- Name: operator_sops_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.operator_sops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.operator_sops_id_seq OWNER TO m1;

--
-- Name: operator_sops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.operator_sops_id_seq OWNED BY public.operator_sops.id;


--
-- Name: operator_tasks; Type: TABLE; Schema: public; Owner: m1
--

CREATE TABLE public.operator_tasks (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'todo'::character varying,
    duedate date,
    assignedto character varying(100),
    sopid integer,
    projectid integer,
    category character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.operator_tasks OWNER TO m1;

--
-- Name: operator_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.operator_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.operator_tasks_id_seq OWNER TO m1;

--
-- Name: operator_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.operator_tasks_id_seq OWNED BY public.operator_tasks.id;


--
-- Name: project_expense_lines; Type: TABLE; Schema: public; Owner: m1
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
    last_synced_at timestamp without time zone
);


ALTER TABLE public.project_expense_lines OWNER TO m1;

--
-- Name: project_expense_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.project_expense_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.project_expense_lines_id_seq OWNER TO m1;

--
-- Name: project_expense_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.project_expense_lines_id_seq OWNED BY public.project_expense_lines.id;


--
-- Name: project_revenue_lines; Type: TABLE; Schema: public; Owner: m1
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
    last_synced_at timestamp without time zone
);


ALTER TABLE public.project_revenue_lines OWNER TO m1;

--
-- Name: project_revenue_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.project_revenue_lines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.project_revenue_lines_id_seq OWNER TO m1;

--
-- Name: project_revenue_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.project_revenue_lines_id_seq OWNED BY public.project_revenue_lines.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: m1
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
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.projects OWNER TO m1;

--
-- Name: COLUMN projects.metadata; Type: COMMENT; Schema: public; Owner: m1
--

COMMENT ON COLUMN public.projects.metadata IS 'Données spécifiques au type de projet (CARRIERE, EXPORT, PRODUCTFLIP, LIVESTOCK)';


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.projects_id_seq OWNER TO m1;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: receivables; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.receivables OWNER TO m1;

--
-- Name: receivables_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.receivables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.receivables_id_seq OWNER TO m1;

--
-- Name: receivables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.receivables_id_seq OWNED BY public.receivables.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: m1
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    token character varying(500) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer DEFAULT 1
);


ALTER TABLE public.sessions OWNER TO m1;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sessions_id_seq OWNER TO m1;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: sops; Type: TABLE; Schema: public; Owner: m1
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
    project_id integer
);


ALTER TABLE public.sops OWNER TO m1;

--
-- Name: sops_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.sops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sops_id_seq OWNER TO m1;

--
-- Name: sops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.sops_id_seq OWNED BY public.sops.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.tasks OWNER TO m1;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tasks_id_seq OWNER TO m1;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: transaction_linking_log; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.transaction_linking_log OWNER TO m1;

--
-- Name: transaction_linking_log_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.transaction_linking_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transaction_linking_log_id_seq OWNER TO m1;

--
-- Name: transaction_linking_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.transaction_linking_log_id_seq OWNED BY public.transaction_linking_log.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: m1
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


ALTER TABLE public.transactions OWNER TO m1;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.transactions_id_seq OWNER TO m1;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: v_project_progress; Type: VIEW; Schema: public; Owner: m1
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


ALTER TABLE public.v_project_progress OWNER TO m1;

--
-- Name: v_transactions; Type: VIEW; Schema: public; Owner: m1
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


ALTER TABLE public.v_transactions OWNER TO m1;

--
-- Name: visions; Type: TABLE; Schema: public; Owner: m1
--

CREATE TABLE public.visions (
    id integer NOT NULL,
    content text,
    mission text,
    "values" jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.visions OWNER TO m1;

--
-- Name: visions_id_seq; Type: SEQUENCE; Schema: public; Owner: m1
--

CREATE SEQUENCE public.visions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.visions_id_seq OWNER TO m1;

--
-- Name: visions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: m1
--

ALTER SEQUENCE public.visions_id_seq OWNED BY public.visions.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: content_derivatives id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.content_derivatives ALTER COLUMN id SET DEFAULT nextval('public.content_derivatives_id_seq'::regclass);


--
-- Name: content_master id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.content_master ALTER COLUMN id SET DEFAULT nextval('public.content_master_id_seq'::regclass);


--
-- Name: derivatives id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.derivatives ALTER COLUMN id SET DEFAULT nextval('public.derivatives_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: master_content id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.master_content ALTER COLUMN id SET DEFAULT nextval('public.master_content_id_seq'::regclass);


--
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- Name: objectives id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.objectives ALTER COLUMN id SET DEFAULT nextval('public.objectives_id_seq'::regclass);


--
-- Name: operator_sops id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.operator_sops ALTER COLUMN id SET DEFAULT nextval('public.operator_sops_id_seq'::regclass);


--
-- Name: operator_tasks id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.operator_tasks ALTER COLUMN id SET DEFAULT nextval('public.operator_tasks_id_seq'::regclass);


--
-- Name: project_expense_lines id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.project_expense_lines ALTER COLUMN id SET DEFAULT nextval('public.project_expense_lines_id_seq'::regclass);


--
-- Name: project_revenue_lines id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.project_revenue_lines ALTER COLUMN id SET DEFAULT nextval('public.project_revenue_lines_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: receivables id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.receivables ALTER COLUMN id SET DEFAULT nextval('public.receivables_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: sops id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.sops ALTER COLUMN id SET DEFAULT nextval('public.sops_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: transaction_linking_log id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transaction_linking_log ALTER COLUMN id SET DEFAULT nextval('public.transaction_linking_log_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: visions id; Type: DEFAULT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.visions ALTER COLUMN id SET DEFAULT nextval('public.visions_id_seq'::regclass);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: content_derivatives content_derivatives_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.content_derivatives
    ADD CONSTRAINT content_derivatives_pkey PRIMARY KEY (id);


--
-- Name: content_master content_master_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.content_master
    ADD CONSTRAINT content_master_pkey PRIMARY KEY (id);


--
-- Name: derivatives derivatives_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.derivatives
    ADD CONSTRAINT derivatives_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: master_content master_content_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.master_content
    ADD CONSTRAINT master_content_pkey PRIMARY KEY (id);


--
-- Name: transactions no_duplicates; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT no_duplicates UNIQUE (account_id, transaction_date, amount, description, type);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: objectives objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.objectives
    ADD CONSTRAINT objectives_pkey PRIMARY KEY (id);


--
-- Name: operator_sops operator_sops_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.operator_sops
    ADD CONSTRAINT operator_sops_pkey PRIMARY KEY (id);


--
-- Name: operator_tasks operator_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.operator_tasks
    ADD CONSTRAINT operator_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_expense_lines project_expense_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.project_expense_lines
    ADD CONSTRAINT project_expense_lines_pkey PRIMARY KEY (id);


--
-- Name: project_revenue_lines project_revenue_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.project_revenue_lines
    ADD CONSTRAINT project_revenue_lines_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: receivables receivables_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_key UNIQUE (token);


--
-- Name: sops sops_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.sops
    ADD CONSTRAINT sops_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: transaction_linking_log transaction_linking_log_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transaction_linking_log
    ADD CONSTRAINT transaction_linking_log_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions unique_transaction; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT unique_transaction UNIQUE (account_id, transaction_date, amount, type, description);


--
-- Name: visions visions_pkey; Type: CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.visions
    ADD CONSTRAINT visions_pkey PRIMARY KEY (id);


--
-- Name: idx_derivatives_master_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_derivatives_master_id ON public.derivatives USING btree (master_id);


--
-- Name: idx_derivatives_platform; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_derivatives_platform ON public.derivatives USING btree (platform);


--
-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_employees_department ON public.employees USING btree (department);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_expense_lines_is_paid; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_expense_lines_is_paid ON public.project_expense_lines USING btree (is_paid);


--
-- Name: idx_expense_lines_project_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_expense_lines_project_id ON public.project_expense_lines USING btree (project_id);


--
-- Name: idx_linking_log_date; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_linking_log_date ON public.transaction_linking_log USING btree (performed_at);


--
-- Name: idx_linking_log_line; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_linking_log_line ON public.transaction_linking_log USING btree (project_line_id);


--
-- Name: idx_linking_log_transaction; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_linking_log_transaction ON public.transaction_linking_log USING btree (transaction_id);


--
-- Name: idx_master_content_status; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_master_content_status ON public.master_content USING btree (status);


--
-- Name: idx_objectives_category; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_objectives_category ON public.objectives USING btree (category);


--
-- Name: idx_proj_exp_project_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_proj_exp_project_id ON public.project_expense_lines USING btree (project_id);


--
-- Name: idx_proj_rev_project_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_proj_rev_project_id ON public.project_revenue_lines USING btree (project_id);


--
-- Name: idx_projects_metadata; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_projects_metadata ON public.projects USING gin (metadata);


--
-- Name: idx_revenue_lines_is_received; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_revenue_lines_is_received ON public.project_revenue_lines USING btree (is_received);


--
-- Name: idx_revenue_lines_project_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_revenue_lines_project_id ON public.project_revenue_lines USING btree (project_id);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token);


--
-- Name: idx_sops_category; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_sops_category ON public.operator_sops USING btree (category);


--
-- Name: idx_sops_status; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_sops_status ON public.operator_sops USING btree (status);


--
-- Name: idx_tasks_sop_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_tasks_sop_id ON public.tasks USING btree (sop_id);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_transactions_account; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_transactions_account ON public.transactions USING btree (account_id);


--
-- Name: idx_transactions_account_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_transactions_account_id ON public.transactions USING btree (account_id);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (transaction_date);


--
-- Name: idx_transactions_is_planned; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_transactions_is_planned ON public.transactions USING btree (is_planned);


--
-- Name: idx_transactions_project_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_transactions_project_id ON public.transactions USING btree (project_id);


--
-- Name: idx_transactions_project_line_id; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_transactions_project_line_id ON public.transactions USING btree (project_line_id);


--
-- Name: idx_transactions_type; Type: INDEX; Schema: public; Owner: m1
--

CREATE INDEX idx_transactions_type ON public.transactions USING btree (type);


--
-- Name: receivables trg_receivables_delete; Type: TRIGGER; Schema: public; Owner: m1
--

CREATE TRIGGER trg_receivables_delete AFTER DELETE ON public.receivables FOR EACH STATEMENT EXECUTE FUNCTION public.update_receivables_account_balance();


--
-- Name: receivables trg_receivables_insert; Type: TRIGGER; Schema: public; Owner: m1
--

CREATE TRIGGER trg_receivables_insert AFTER INSERT ON public.receivables FOR EACH STATEMENT EXECUTE FUNCTION public.update_receivables_account_balance();


--
-- Name: receivables trg_receivables_update; Type: TRIGGER; Schema: public; Owner: m1
--

CREATE TRIGGER trg_receivables_update AFTER UPDATE ON public.receivables FOR EACH STATEMENT EXECUTE FUNCTION public.update_receivables_account_balance();


--
-- Name: transactions update_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: m1
--

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: content_derivatives content_derivatives_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.content_derivatives
    ADD CONSTRAINT content_derivatives_master_id_fkey FOREIGN KEY (master_id) REFERENCES public.content_master(id) ON DELETE CASCADE;


--
-- Name: derivatives derivatives_master_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.derivatives
    ADD CONSTRAINT derivatives_master_id_fkey FOREIGN KEY (master_id) REFERENCES public.master_content(id) ON DELETE CASCADE;


--
-- Name: operator_tasks operator_tasks_projectid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.operator_tasks
    ADD CONSTRAINT operator_tasks_projectid_fkey FOREIGN KEY (projectid) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_expense_lines project_expense_lines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.project_expense_lines
    ADD CONSTRAINT project_expense_lines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_revenue_lines project_revenue_lines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.project_revenue_lines
    ADD CONSTRAINT project_revenue_lines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: receivables receivables_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: receivables receivables_source_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.accounts(id);


--
-- Name: receivables receivables_target_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_target_account_id_fkey FOREIGN KEY (target_account_id) REFERENCES public.accounts(id);


--
-- Name: sops sops_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.sops
    ADD CONSTRAINT sops_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: m1
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict hFvUfZgvcbyMJIASOsfenacUPT2rRNpAKaaaTFHI6xp53EKwTATha9dYazJlqwH

