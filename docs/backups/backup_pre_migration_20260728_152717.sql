


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


CREATE SCHEMA IF NOT EXISTS "auto";


ALTER SCHEMA "auto" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "barber";


ALTER SCHEMA "barber" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "club";


ALTER SCHEMA "club" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "control";


ALTER SCHEMA "control" OWNER TO "postgres";


COMMENT ON SCHEMA "control" IS 'Schema for administrative and control operations (import/export, jobs, templates, audit)';



CREATE SCHEMA IF NOT EXISTS "platform";


ALTER SCHEMA "platform" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "varejo";


ALTER SCHEMA "varejo" OWNER TO "postgres";


COMMENT ON SCHEMA "varejo" IS 'Varejo MVP domain schema: orders, order_items, inventory_movements.';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "platform"."PlatformJobStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);


ALTER TYPE "platform"."PlatformJobStatus" OWNER TO "postgres";


CREATE TYPE "platform"."PlatformTenantStatus" AS ENUM (
    'ACTIVE',
    'BLOCKED',
    'INACTIVE'
);


ALTER TYPE "platform"."PlatformTenantStatus" OWNER TO "postgres";


CREATE TYPE "platform"."PlatformUserStatus" AS ENUM (
    'ACTIVE',
    'BLOCKED',
    'INVITED'
);


ALTER TYPE "platform"."PlatformUserStatus" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."accept_commercial_signature_public_token"("p_token_hash" "text", "p_ip" "text", "p_user_agent" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE v_token control.commercial_signature_public_tokens%ROWTYPE; v_signer control.commercial_signers%ROWTYPE; v_request control.commercial_signature_requests%ROWTYPE; v_all_signed boolean;
BEGIN
  SELECT * INTO v_token FROM control.commercial_signature_public_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_token.status <> 'active' OR v_token.expires_at <= now() THEN RAISE EXCEPTION 'Invalid or expired signature token'; END IF;
  SELECT * INTO v_signer FROM control.commercial_signers WHERE id = v_token.signer_id FOR UPDATE;
  SELECT * INTO v_request FROM control.commercial_signature_requests WHERE id = v_token.signature_request_id FOR UPDATE;
  IF v_request.status NOT IN ('pending','viewed') OR v_signer.status NOT IN ('pending','viewed') THEN RAISE EXCEPTION 'Signature request is not available'; END IF;
  UPDATE control.commercial_signers SET status = 'signed', signed_at = now(), accepted_at = now(), acceptance_ip = p_ip, acceptance_user_agent = p_user_agent WHERE id = v_signer.id;
  UPDATE control.commercial_signature_public_tokens SET status = 'used', used_at = now() WHERE id = v_token.id;
  SELECT bool_and(status = 'signed') INTO v_all_signed FROM control.commercial_signers WHERE signature_request_id = v_request.id;
  IF COALESCE(v_all_signed, false) THEN UPDATE control.commercial_signature_requests SET status = 'signed', signed_at = now() WHERE id = v_request.id; END IF;
  INSERT INTO control.commercial_signature_events(signature_request_id, signer_id, event_type, event_payload, ip_address, user_agent) VALUES (v_request.id, v_signer.id, 'signer_signed', '{}'::jsonb, p_ip, p_user_agent);
  INSERT INTO control.commercial_audit_logs(entity_type, entity_id, action, after_data, metadata) VALUES ('commercial_signer', v_signer.id, 'commercial_signer_signed', jsonb_build_object('status','signed'), jsonb_build_object('signature_request_id', v_request.id));
  IF COALESCE(v_all_signed, false) THEN
    INSERT INTO control.commercial_signature_events(signature_request_id, event_type, event_payload, ip_address, user_agent) VALUES (v_request.id, 'signature_request_signed', '{}'::jsonb, p_ip, p_user_agent);
    INSERT INTO control.commercial_audit_logs(entity_type, entity_id, action, after_data) VALUES ('commercial_signature_request', v_request.id, 'commercial_signature_request_signed', jsonb_build_object('status','signed'));
  END IF;
END; $$;


ALTER FUNCTION "control"."accept_commercial_signature_public_token"("p_token_hash" "text", "p_ip" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."archive_commercial_signature_message_template"("p_template_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE v_old control.commercial_signature_message_templates%ROWTYPE;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN RAISE EXCEPTION 'Insufficient permission to archive signature message template'; END IF;
  SELECT * INTO v_old FROM control.commercial_signature_message_templates WHERE id = p_template_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signature message template not found: %', p_template_id; END IF;
  UPDATE control.commercial_signature_message_templates SET status = 'archived', updated_by = auth.uid() WHERE id = p_template_id;
  INSERT INTO control.commercial_audit_logs(entity_type, entity_id, action, before_data, after_data) VALUES ('commercial_signature_message_template', p_template_id, 'commercial_signature_message_template.archived', to_jsonb(v_old), jsonb_build_object('status','archived'));
END; $$;


ALTER FUNCTION "control"."archive_commercial_signature_message_template"("p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."count_active_super_admins"() RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
  SELECT count(*)::integer
  FROM control.admin_profiles
  WHERE role = 'super_admin' AND status = 'active';
$$;


ALTER FUNCTION "control"."count_active_super_admins"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "control"."commercial_signature_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "contract_id" "uuid",
    "quote_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "provider" "text" DEFAULT 'internal'::"text" NOT NULL,
    "provider_request_id" "text",
    "public_token_hash" "text",
    "expires_at" timestamp with time zone,
    "requested_by" "uuid",
    "requested_at" timestamp with time zone,
    "signed_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_signature_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'viewed'::"text", 'signed'::"text", 'rejected'::"text", 'canceled'::"text", 'expired'::"text"])))
);


ALTER TABLE "control"."commercial_signature_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."create_commercial_signature_request"("p_document_id" "uuid") RETURNS "control"."commercial_signature_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_document control.commercial_documents%ROWTYPE;
  v_request control.commercial_signature_requests%ROWTYPE;
  v_contract control.commercial_contracts%ROWTYPE;
  v_quote control.commercial_quotes%ROWTYPE;
  v_client jsonb;
  v_settings control.commercial_settings%ROWTYPE;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to create commercial signature request';
  END IF;

  SELECT * INTO v_document
  FROM control.commercial_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial document not found: %', p_document_id;
  END IF;
  IF v_document.status <> 'generated' THEN
    RAISE EXCEPTION 'Only generated commercial documents can be prepared for signature';
  END IF;

  SELECT * INTO v_request
  FROM control.commercial_signature_requests
  WHERE document_id = p_document_id AND status IN ('draft','pending','viewed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_request;
  END IF;

  IF v_document.contract_id IS NOT NULL THEN
    SELECT * INTO v_contract FROM control.commercial_contracts WHERE id = v_document.contract_id;
    v_client := v_contract.client_snapshot;
  ELSIF v_document.quote_id IS NOT NULL THEN
    SELECT * INTO v_quote FROM control.commercial_quotes WHERE id = v_document.quote_id;
    v_client := v_quote.client_snapshot;
  END IF;

  SELECT * INTO v_settings FROM control.commercial_settings WHERE id = true;

  INSERT INTO control.commercial_signature_requests (
    document_id, contract_id, quote_id, status, provider, requested_by, requested_at, metadata
  )
  VALUES (
    v_document.id, v_document.contract_id, v_document.quote_id, 'draft', 'internal', auth.uid(), now(),
    jsonb_build_object('document_number', v_document.document_number, 'document_version', v_document.version)
  )
  RETURNING * INTO v_request;

  INSERT INTO control.commercial_signers (
    signature_request_id, signer_type, name, email, phone, document, role_title
  )
  VALUES (
    v_request.id,
    'contractor',
    COALESCE(NULLIF(v_settings.legal_representative, ''), v_settings.company_name, 'SMG - Sou.Manager'),
    NULLIF(v_settings.email, ''),
    NULLIF(v_settings.phone, ''),
    NULLIF(v_settings.document, ''),
    'Representante da Contratada'
  );

  IF COALESCE(v_client->>'name', '') <> '' THEN
    INSERT INTO control.commercial_signers (
      signature_request_id, signer_type, name, email, phone, document, role_title
    )
    VALUES (
      v_request.id,
      'client',
      v_client->>'name',
      NULLIF(v_client->>'email', ''),
      NULLIF(v_client->>'phone', ''),
      NULLIF(v_client->>'document', ''),
      'Representante do Contratante'
    );
  END IF;

  INSERT INTO control.commercial_signature_events (
    signature_request_id, event_type, event_payload, actor_user_id, actor_role
  )
  VALUES (v_request.id, 'created', to_jsonb(v_request), auth.uid(), control.current_admin_role());

  INSERT INTO control.commercial_audit_logs (
    entity_type, entity_id, action, after_data, metadata
  )
  VALUES (
    'commercial_signature_request',
    v_request.id,
    'commercial_signature_request.created',
    to_jsonb(v_request),
    jsonb_build_object('document_id', v_document.id)
  );

  RETURN v_request;
END;
$$;


ALTER FUNCTION "control"."create_commercial_signature_request"("p_document_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_signature_public_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signer_id" "uuid" NOT NULL,
    "signature_request_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "commercial_signature_public_tokens_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "control"."commercial_signature_public_tokens" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."create_commercial_signer_public_token"("p_signer_id" "uuid", "p_token_hash" "text", "p_expires_at" timestamp with time zone) RETURNS "control"."commercial_signature_public_tokens"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_signer control.commercial_signers%ROWTYPE;
  v_request control.commercial_signature_requests%ROWTYPE;
  v_token control.commercial_signature_public_tokens%ROWTYPE;
  v_revoked_token control.commercial_signature_public_tokens%ROWTYPE;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN RAISE EXCEPTION 'Insufficient permission to create public token'; END IF;
  IF p_expires_at <= now() THEN RAISE EXCEPTION 'Public token expiration must be in the future'; END IF;
  IF length(COALESCE(p_token_hash, '')) < 64 THEN RAISE EXCEPTION 'Invalid public token hash'; END IF;

  SELECT * INTO v_signer FROM control.commercial_signers WHERE id = p_signer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commercial signer not found: %', p_signer_id; END IF;
  SELECT * INTO v_request FROM control.commercial_signature_requests WHERE id = v_signer.signature_request_id FOR UPDATE;
  IF v_request.status NOT IN ('pending','viewed') THEN RAISE EXCEPTION 'Public token can only be created for pending/viewed signature requests'; END IF;
  IF v_signer.status NOT IN ('pending','viewed') THEN RAISE EXCEPTION 'Public token can only be created for pending/viewed signers'; END IF;

  FOR v_revoked_token IN
    UPDATE control.commercial_signature_public_tokens
    SET status = 'revoked', revoked_at = now()
    WHERE signer_id = p_signer_id AND status = 'active'
    RETURNING *
  LOOP
    INSERT INTO control.commercial_signature_events (signature_request_id, signer_id, event_type, event_payload, actor_user_id, actor_role)
    VALUES (
      v_request.id, p_signer_id, 'public_link_revoked',
      jsonb_build_object('token_id', v_revoked_token.id, 'reason', 'auto_revoked_by_new_token'),
      auth.uid(), control.current_admin_role()
    );
    INSERT INTO control.commercial_audit_logs (entity_type, entity_id, action, before_data, metadata)
    VALUES (
      'commercial_signer', p_signer_id, 'commercial_public_link_revoked',
      jsonb_build_object('token_id', v_revoked_token.id, 'status', 'revoked'),
      jsonb_build_object('signature_request_id', v_request.id, 'reason', 'auto_revoked_by_new_token')
    );
  END LOOP;

  INSERT INTO control.commercial_signature_public_tokens (signer_id, signature_request_id, token_hash, expires_at, created_by)
  VALUES (p_signer_id, v_request.id, p_token_hash, p_expires_at, auth.uid())
  RETURNING * INTO v_token;

  INSERT INTO control.commercial_signature_events (signature_request_id, signer_id, event_type, event_payload, actor_user_id, actor_role)
  VALUES (v_request.id, p_signer_id, 'public_link_created', jsonb_build_object('token_id', v_token.id, 'expires_at', p_expires_at), auth.uid(), control.current_admin_role());
  INSERT INTO control.commercial_audit_logs (entity_type, entity_id, action, after_data, metadata)
  VALUES ('commercial_signer', p_signer_id, 'commercial_public_link_created', to_jsonb(v_token) - 'token_hash', jsonb_build_object('signature_request_id', v_request.id));

  RETURN v_token;
END;
$$;


ALTER FUNCTION "control"."create_commercial_signer_public_token"("p_signer_id" "uuid", "p_token_hash" "text", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."current_admin_role"() RETURNS character varying
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
  SELECT role
  FROM control.admin_profiles
  WHERE id = auth.uid()
    AND status = 'active'
    AND role IN ('super_admin', 'admin', 'finance', 'support', 'viewer')
  LIMIT 1;
$$;


ALTER FUNCTION "control"."current_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."delete_commercial_signer"("p_signer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_signer control.commercial_signers%ROWTYPE;
  v_request control.commercial_signature_requests%ROWTYPE;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to remove commercial signer';
  END IF;

  SELECT * INTO v_signer FROM control.commercial_signers WHERE id = p_signer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commercial signer not found: %', p_signer_id; END IF;
  SELECT * INTO v_request FROM control.commercial_signature_requests WHERE id = v_signer.signature_request_id FOR UPDATE;
  IF v_request.status <> 'draft' THEN RAISE EXCEPTION 'Only draft signature requests can remove signers'; END IF;

  DELETE FROM control.commercial_signers WHERE id = p_signer_id;
  INSERT INTO control.commercial_signature_events (signature_request_id, signer_id, event_type, event_payload, actor_user_id, actor_role)
  VALUES (v_request.id, NULL, 'signer_removed', to_jsonb(v_signer), auth.uid(), control.current_admin_role());
  INSERT INTO control.commercial_audit_logs (entity_type, entity_id, action, before_data)
  VALUES ('commercial_signer', v_signer.id, 'commercial_signature_request.signer_removed', to_jsonb(v_signer));
END;
$$;


ALTER FUNCTION "control"."delete_commercial_signer"("p_signer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."ensure_commercial_contract_quote_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM control.commercial_quotes
    WHERE id = NEW.quote_id
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Commercial quote must be approved before contract generation';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "control"."ensure_commercial_contract_quote_approved"() OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "control"."commercial_contract_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "control"."commercial_contract_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_number" character varying(30) DEFAULT ('CTR-'::"text" || "lpad"(("nextval"('"control"."commercial_contract_number_seq"'::"regclass"))::"text", 4, '0'::"text")) NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "quote_number" character varying(30) NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "product_snapshot" "jsonb" NOT NULL,
    "client_snapshot" "jsonb" NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "monthly_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "billing_model" character varying(30) DEFAULT 'fixed_phases'::character varying NOT NULL,
    "payment_method" character varying(20) DEFAULT 'pix'::character varying NOT NULL,
    "estimated_timeline" character varying(120) DEFAULT ''::character varying NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_contracts_billing_model_check" CHECK ((("billing_model")::"text" = ANY ((ARRAY['fixed_phases'::character varying, 'setup_recurring'::character varying, 'saas_license'::character varying])::"text"[]))),
    CONSTRAINT "commercial_contracts_monthly_amount_check" CHECK (("monthly_amount" >= (0)::numeric)),
    CONSTRAINT "commercial_contracts_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['pix'::character varying, 'boleto'::character varying, 'card'::character varying, 'mixed'::character varying])::"text"[]))),
    CONSTRAINT "commercial_contracts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'signed'::character varying, 'canceled'::character varying, 'expired'::character varying])::"text"[]))),
    CONSTRAINT "commercial_contracts_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "commercial_contracts_version_check" CHECK (("version" > 0))
);


ALTER TABLE "control"."commercial_contracts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."generate_commercial_contract"("p_quote_id" "uuid") RETURNS "control"."commercial_contracts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $_$
DECLARE
  v_quote control.commercial_quotes%ROWTYPE;
  v_contract control.commercial_contracts%ROWTYPE;
  v_phase_summary text;
  v_product_name text;
  v_scope_in text;
  v_scope_out text;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to generate commercial contract';
  END IF;

  SELECT * INTO v_quote
  FROM control.commercial_quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial quote not found: %', p_quote_id;
  END IF;

  SELECT * INTO v_contract
  FROM control.commercial_contracts
  WHERE quote_id = p_quote_id;

  IF FOUND THEN
    RETURN v_contract;
  END IF;

  IF v_quote.status <> 'approved' THEN
    RAISE EXCEPTION 'Commercial quote must be approved before contract generation';
  END IF;

  v_product_name := COALESCE(v_quote.product_snapshot->>'name', 'software');
  v_scope_in := COALESCE(NULLIF(replace(v_quote.scope_in, E'\n', '; '), ''), 'conforme Proposta Comercial aprovada');
  v_scope_out := COALESCE(NULLIF(replace(v_quote.scope_out, E'\n', '; '), ''), 'itens nao especificados na proposta');

  SELECT COALESCE(string_agg(format(
    'Fase %s - %s: R$ %s (%s%% do projeto)%s.',
    sort_order + 1,
    name,
    trim(to_char(amount, 'FM999999999990D00')),
    trim(to_char(percentage, 'FM999999990D00')),
    CASE WHEN estimated_duration <> '' THEN ' - Duracao estimada: ' || estimated_duration ELSE '' END
  ), ' ' ORDER BY sort_order), 'Conforme proposta aprovada.')
  INTO v_phase_summary
  FROM control.commercial_quote_phases
  WHERE quote_id = p_quote_id;

  INSERT INTO control.commercial_contracts (
    quote_id, quote_number, status, product_snapshot, client_snapshot,
    total_amount, monthly_amount, billing_model, payment_method,
    estimated_timeline, created_by, updated_by
  )
  VALUES (
    v_quote.id, v_quote.quote_number, 'active', v_quote.product_snapshot,
    v_quote.client_snapshot, v_quote.total_amount, v_quote.monthly_amount,
    v_quote.billing_model, v_quote.payment_method, v_quote.estimated_timeline,
    auth.uid(), auth.uid()
  )
  RETURNING * INTO v_contract;

  INSERT INTO control.commercial_contract_clauses (
    contract_id, clause_number, title, body, sort_order
  )
  VALUES
    (v_contract.id, 'CLAUSULA 1', 'DO OBJETO',
      'O presente instrumento tem por objeto a prestacao de servicos de tecnologia da informacao, consistente na implantacao do ' || v_product_name || ' para o Contratante, conforme especificacoes tecnicas e comerciais aprovadas na Proposta Comercial ' || v_quote.quote_number || ', que integra este instrumento como Anexo I.', 1),
    (v_contract.id, 'CLAUSULA 2', 'DO ESCOPO DO PROJETO',
      'Os servicos contratados abrangem as seguintes entregas: ' || v_scope_in || '. Estao expressamente excluidos do escopo: ' || v_scope_out || '. Qualquer demanda adicional ou alteracao de escopo sera objeto de aditivo contratual especifico, com precificacao negociada entre as partes.', 2),
    (v_contract.id, 'CLAUSULA 3', 'DO PRAZO DE EXECUCAO',
      'O prazo estimado para execucao do objeto deste contrato e de ' || COALESCE(NULLIF(v_quote.estimated_timeline, ''), '30 a 60 dias uteis') || ', contado a partir do recebimento do pagamento da primeira fase e da entrega das informacoes necessarias pelo Contratante.', 3),
    (v_contract.id, 'CLAUSULA 4', 'DO VALOR E FORMA DE PAGAMENTO',
      'O valor total contratado e de R$ ' || trim(to_char(v_quote.total_amount, 'FM999999999990D00')) || CASE WHEN v_quote.monthly_amount > 0 THEN '. Apos a conclusao da implantacao, fica estabelecida mensalidade de R$ ' || trim(to_char(v_quote.monthly_amount, 'FM999999999990D00')) || '.' ELSE '.' END || ' Os pagamentos seguirao as condicoes aprovadas na proposta comercial.', 4),
    (v_contract.id, 'CLAUSULA 5', 'DAS FASES DE EXECUCAO', v_phase_summary, 5),
    (v_contract.id, 'CLAUSULA 6', 'DOS TESTES, HOMOLOGACAO E CRITERIOS DE ACEITE',
      'A fase de testes compreende validacao interna, testes de integracao, testes de usabilidade e homologacao com o Contratante. Itens nao sinalizados por escrito dentro do prazo de homologacao serao considerados aprovados tacitamente.', 6),
    (v_contract.id, 'CLAUSULA 7', 'DA PROPRIEDADE INTELECTUAL E LICENCA DE USO',
      COALESCE(NULLIF(v_quote.product_snapshot->>'specificContractClause', ''), 'O software objeto deste contrato permanece como propriedade intelectual exclusiva da Contratada, salvo disposicao expressa em aditivo contratual.'), 7),
    (v_contract.id, 'CLAUSULA 8', 'DO FORO',
      'As partes elegem o foro indicado nas configuracoes comerciais da SMG para dirimir controversias oriundas deste instrumento.', 8);

  INSERT INTO control.commercial_audit_logs (
    entity_type, entity_id, action, after_data, metadata
  )
  VALUES (
    'commercial_contract',
    v_contract.id,
    'commercial_contract.generated',
    to_jsonb(v_contract),
    jsonb_build_object('quote_id', v_quote.id)
  );

  RETURN v_contract;
END;
$_$;


ALTER FUNCTION "control"."generate_commercial_contract"("p_quote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."has_role"("required_roles" character varying[]) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM control.admin_profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role = ANY(required_roles)
  );
$$;


ALTER FUNCTION "control"."has_role"("required_roles" character varying[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."increment_template_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.version = old.version + 1;
    new.updated_at = now();
    new.created_by = coalesce(new.created_by, old.created_by);
    return new;
end;
$$;


ALTER FUNCTION "control"."increment_template_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."is_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM control.admin_profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND role IN ('super_admin', 'admin', 'finance', 'support', 'viewer')
  );
$$;


ALTER FUNCTION "control"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."mark_commercial_signer_public_viewed"("p_token_hash" "text", "p_ip" "text", "p_user_agent" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_token control.commercial_signature_public_tokens%ROWTYPE;
  v_signer control.commercial_signers%ROWTYPE;
  v_request control.commercial_signature_requests%ROWTYPE;
  v_should_insert_event boolean;
BEGIN
  SELECT * INTO v_token
  FROM control.commercial_signature_public_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_token.status <> 'active' OR v_token.expires_at <= now() THEN
    RAISE EXCEPTION 'Invalid or expired signature token';
  END IF;

  SELECT * INTO v_signer FROM control.commercial_signers WHERE id = v_token.signer_id FOR UPDATE;
  SELECT * INTO v_request FROM control.commercial_signature_requests WHERE id = v_token.signature_request_id FOR UPDATE;

  IF v_request.status NOT IN ('pending','viewed') OR v_signer.status NOT IN ('pending','viewed') THEN
    RAISE EXCEPTION 'Signature request is not available';
  END IF;

  v_should_insert_event := v_signer.viewed_at IS NULL AND v_signer.last_viewed_at IS NULL;

  UPDATE control.commercial_signers
  SET status = CASE WHEN status = 'pending' THEN 'viewed' ELSE status END,
      viewed_at = COALESCE(viewed_at, now()),
      last_viewed_at = now()
  WHERE id = v_signer.id;

  UPDATE control.commercial_signature_requests
  SET status = CASE WHEN status = 'pending' THEN 'viewed' ELSE status END
  WHERE id = v_request.id;

  IF v_should_insert_event THEN
    INSERT INTO control.commercial_signature_events(
      signature_request_id, signer_id, event_type, event_payload, ip_address, user_agent
    )
    VALUES (v_request.id, v_signer.id, 'signer_viewed', '{}'::jsonb, p_ip, p_user_agent);
  END IF;
END;
$$;


ALTER FUNCTION "control"."mark_commercial_signer_public_viewed"("p_token_hash" "text", "p_ip" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_type" "text" NOT NULL,
    "quote_id" "uuid",
    "contract_id" "uuid",
    "document_number" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'generated'::"text" NOT NULL,
    "file_path" "text",
    "file_url" "text",
    "storage_bucket" "text",
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "file_size" bigint,
    "sha256_hash" "text",
    "generated_by" "uuid",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_documents_check" CHECK (((("quote_id" IS NOT NULL) AND ("contract_id" IS NULL)) OR (("quote_id" IS NULL) AND ("contract_id" IS NOT NULL)))),
    CONSTRAINT "commercial_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['quote_pdf'::"text", 'contract_pdf'::"text"]))),
    CONSTRAINT "commercial_documents_file_size_check" CHECK ((("file_size" IS NULL) OR ("file_size" >= 0))),
    CONSTRAINT "commercial_documents_status_check" CHECK (("status" = ANY (ARRAY['generated'::"text", 'superseded'::"text", 'canceled'::"text"]))),
    CONSTRAINT "commercial_documents_version_check" CHECK (("version" > 0))
);


ALTER TABLE "control"."commercial_documents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."register_commercial_document"("p_document_type" "text", "p_quote_id" "uuid", "p_contract_id" "uuid", "p_document_number" "text", "p_version" integer, "p_file_path" "text", "p_storage_bucket" "text", "p_mime_type" "text", "p_file_size" bigint, "p_sha256_hash" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "control"."commercial_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_document control.commercial_documents%ROWTYPE;
  v_superseded_ids uuid[];
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to register commercial document';
  END IF;

  IF p_document_type NOT IN ('quote_pdf', 'contract_pdf') THEN
    RAISE EXCEPTION 'Invalid commercial document type: %', p_document_type;
  END IF;

  IF p_version IS NULL OR p_version < 1 THEN
    RAISE EXCEPTION 'Invalid commercial document version: %', p_version;
  END IF;

  IF (p_quote_id IS NULL AND p_contract_id IS NULL)
    OR (p_quote_id IS NOT NULL AND p_contract_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Commercial document must reference exactly one quote or contract';
  END IF;

  IF p_document_type = 'quote_pdf' AND p_quote_id IS NULL THEN
    RAISE EXCEPTION 'quote_pdf requires quote_id';
  END IF;

  IF p_document_type = 'contract_pdf' AND p_contract_id IS NULL THEN
    RAISE EXCEPTION 'contract_pdf requires contract_id';
  END IF;

  INSERT INTO control.commercial_documents (
    document_type,
    quote_id,
    contract_id,
    document_number,
    version,
    status,
    file_path,
    storage_bucket,
    mime_type,
    file_size,
    sha256_hash,
    generated_by,
    metadata
  )
  VALUES (
    p_document_type,
    p_quote_id,
    p_contract_id,
    p_document_number,
    p_version,
    'generated',
    p_file_path,
    p_storage_bucket,
    COALESCE(NULLIF(p_mime_type, ''), 'application/pdf'),
    p_file_size,
    p_sha256_hash,
    auth.uid(),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_document;

  WITH updated AS (
    UPDATE control.commercial_documents
    SET status = 'superseded'
    WHERE id <> v_document.id
      AND document_type = p_document_type
      AND status = 'generated'
      AND (
        (p_quote_id IS NOT NULL AND quote_id = p_quote_id)
        OR (p_contract_id IS NOT NULL AND contract_id = p_contract_id)
      )
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_superseded_ids
  FROM updated;

  INSERT INTO control.commercial_audit_logs (
    entity_type,
    entity_id,
    action,
    after_data,
    metadata
  )
  VALUES (
    'commercial_document',
    v_document.id,
    CASE WHEN p_document_type = 'quote_pdf' THEN 'quote_pdf_generated' ELSE 'contract_pdf_generated' END,
    to_jsonb(v_document),
    jsonb_build_object(
      'file_path', p_file_path,
      'sha256_hash', p_sha256_hash,
      'version', p_version,
      'superseded_document_ids', COALESCE(v_superseded_ids, ARRAY[]::uuid[])
    )
  );

  IF COALESCE(array_length(v_superseded_ids, 1), 0) > 0 THEN
    INSERT INTO control.commercial_audit_logs (
      entity_type,
      entity_id,
      action,
      metadata
    )
    VALUES (
      'commercial_document',
      v_document.id,
      'commercial_document_superseded',
      jsonb_build_object('superseded_document_ids', v_superseded_ids)
    );
  END IF;

  RETURN v_document;
END;
$$;


ALTER FUNCTION "control"."register_commercial_document"("p_document_type" "text", "p_quote_id" "uuid", "p_contract_id" "uuid", "p_document_number" "text", "p_version" integer, "p_file_path" "text", "p_storage_bucket" "text", "p_mime_type" "text", "p_file_size" bigint, "p_sha256_hash" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."register_commercial_signature_delivery_event"("p_signer_id" "uuid", "p_event_type" "text", "p_channel" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_signer control.commercial_signers%ROWTYPE;
  v_request control.commercial_signature_requests%ROWTYPE;
  v_safe_metadata jsonb;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN RAISE EXCEPTION 'Insufficient permission to register signature delivery event'; END IF;
  IF p_event_type NOT IN ('signature_link_copied','signature_message_copied','signature_link_sent_manual','signature_whatsapp_prepared','signature_email_prepared','signature_email_sent','signature_email_failed') THEN RAISE EXCEPTION 'Invalid signature delivery event: %', p_event_type; END IF;
  IF p_channel NOT IN ('link','manual','whatsapp','email') THEN RAISE EXCEPTION 'Invalid signature delivery channel: %', p_channel; END IF;

  SELECT * INTO v_signer FROM control.commercial_signers WHERE id = p_signer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commercial signer not found: %', p_signer_id; END IF;
  SELECT * INTO v_request FROM control.commercial_signature_requests WHERE id = v_signer.signature_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commercial signature request not found: %', v_signer.signature_request_id; END IF;
  IF v_request.status NOT IN ('pending','viewed') THEN RAISE EXCEPTION 'Signature request is not available for delivery'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM control.commercial_signature_public_tokens
    WHERE signer_id = p_signer_id AND status = 'active' AND expires_at > now() AND revoked_at IS NULL AND used_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Active signature public token is required for delivery events';
  END IF;

  v_safe_metadata := COALESCE(p_metadata, '{}'::jsonb) - 'token' - 'public_url' - 'link' - 'message' - 'url' - 'body' - 'subject';
  INSERT INTO control.commercial_signature_events(signature_request_id, signer_id, event_type, event_payload, actor_user_id, actor_role)
  VALUES (v_request.id, p_signer_id, p_event_type, jsonb_build_object('channel', p_channel, 'metadata', v_safe_metadata), auth.uid(), control.current_admin_role());

  INSERT INTO control.commercial_audit_logs(entity_type, entity_id, action, before_data, after_data)
  VALUES ('commercial_signer', p_signer_id, 'commercial_signature_delivery.' || p_event_type, jsonb_build_object('channel', p_channel, 'metadata', v_safe_metadata), jsonb_build_object('signature_request_id', v_request.id));
END;
$$;


ALTER FUNCTION "control"."register_commercial_signature_delivery_event"("p_signer_id" "uuid", "p_event_type" "text", "p_channel" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."reject_commercial_signature_public_token"("p_token_hash" "text", "p_reason" "text", "p_ip" "text", "p_user_agent" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE v_token control.commercial_signature_public_tokens%ROWTYPE; v_signer control.commercial_signers%ROWTYPE; v_request control.commercial_signature_requests%ROWTYPE; v_reason text;
BEGIN
  SELECT * INTO v_token FROM control.commercial_signature_public_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_token.status <> 'active' OR v_token.expires_at <= now() THEN RAISE EXCEPTION 'Invalid or expired signature token'; END IF;
  SELECT * INTO v_signer FROM control.commercial_signers WHERE id = v_token.signer_id FOR UPDATE;
  SELECT * INTO v_request FROM control.commercial_signature_requests WHERE id = v_token.signature_request_id FOR UPDATE;
  IF v_request.status NOT IN ('pending','viewed') OR v_signer.status NOT IN ('pending','viewed') THEN RAISE EXCEPTION 'Signature request is not available'; END IF;
  v_reason := left(btrim(COALESCE(p_reason, '')), 1000);
  UPDATE control.commercial_signers SET status = 'rejected', rejected_at = now(), rejection_reason = NULLIF(v_reason, ''), acceptance_ip = p_ip, acceptance_user_agent = p_user_agent WHERE id = v_signer.id;
  UPDATE control.commercial_signature_requests SET status = 'rejected', rejected_at = now() WHERE id = v_request.id;
  UPDATE control.commercial_signature_public_tokens SET status = 'used', used_at = now() WHERE id = v_token.id;
  INSERT INTO control.commercial_signature_events(signature_request_id, signer_id, event_type, event_payload, ip_address, user_agent) VALUES (v_request.id, v_signer.id, 'signer_rejected', jsonb_build_object('reason', v_reason), p_ip, p_user_agent);
  INSERT INTO control.commercial_signature_events(signature_request_id, event_type, event_payload, ip_address, user_agent) VALUES (v_request.id, 'signature_request_rejected', jsonb_build_object('reason', v_reason), p_ip, p_user_agent);
  INSERT INTO control.commercial_audit_logs(entity_type, entity_id, action, after_data, metadata) VALUES ('commercial_signer', v_signer.id, 'commercial_signer_rejected', jsonb_build_object('status','rejected'), jsonb_build_object('signature_request_id', v_request.id));
  INSERT INTO control.commercial_audit_logs(entity_type, entity_id, action, after_data) VALUES ('commercial_signature_request', v_request.id, 'commercial_signature_request_rejected', jsonb_build_object('status','rejected'));
END; $$;


ALTER FUNCTION "control"."reject_commercial_signature_public_token"("p_token_hash" "text", "p_reason" "text", "p_ip" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."revoke_commercial_signer_public_token"("p_signer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_signer control.commercial_signers%ROWTYPE;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN RAISE EXCEPTION 'Insufficient permission to revoke public token'; END IF;
  SELECT * INTO v_signer FROM control.commercial_signers WHERE id = p_signer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Commercial signer not found: %', p_signer_id; END IF;
  UPDATE control.commercial_signature_public_tokens SET status = 'revoked', revoked_at = now() WHERE signer_id = p_signer_id AND status = 'active';
  INSERT INTO control.commercial_signature_events (signature_request_id, signer_id, event_type, event_payload, actor_user_id, actor_role)
  VALUES (v_signer.signature_request_id, p_signer_id, 'public_link_revoked', '{}'::jsonb, auth.uid(), control.current_admin_role());
  INSERT INTO control.commercial_audit_logs (entity_type, entity_id, action, before_data)
  VALUES ('commercial_signer', p_signer_id, 'commercial_public_link_revoked', to_jsonb(v_signer));
END;
$$;


ALTER FUNCTION "control"."revoke_commercial_signer_public_token"("p_signer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."set_commercial_audit_actor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
BEGIN
  NEW.actor_user_id := auth.uid();
  NEW.actor_role := control.current_admin_role();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "control"."set_commercial_audit_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "control"."set_updated_at"() OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "control"."commercial_quote_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "control"."commercial_quote_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_number" character varying(30) DEFAULT ('ORC-'::"text" || "lpad"(("nextval"('"control"."commercial_quote_number_seq"'::"regclass"))::"text", 4, '0'::"text")) NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    "commercial_product_id" "uuid" NOT NULL,
    "commercial_client_id" "uuid" NOT NULL,
    "product_snapshot" "jsonb" NOT NULL,
    "client_snapshot" "jsonb" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "scope_in" "text" DEFAULT ''::"text" NOT NULL,
    "scope_out" "text" DEFAULT ''::"text" NOT NULL,
    "estimated_timeline" character varying(120) DEFAULT ''::character varying NOT NULL,
    "commercial_terms" "text" DEFAULT ''::"text" NOT NULL,
    "internal_notes" "text" DEFAULT ''::"text" NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "monthly_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "billing_model" character varying(30) DEFAULT 'fixed_phases'::character varying NOT NULL,
    "payment_method" character varying(20) DEFAULT 'pix'::character varying NOT NULL,
    "issued_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date" NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_quotes_billing_model_check" CHECK ((("billing_model")::"text" = ANY ((ARRAY['fixed_phases'::character varying, 'setup_recurring'::character varying, 'saas_license'::character varying])::"text"[]))),
    CONSTRAINT "commercial_quotes_check" CHECK (("valid_until" >= "issued_at")),
    CONSTRAINT "commercial_quotes_monthly_amount_check" CHECK (("monthly_amount" >= (0)::numeric)),
    CONSTRAINT "commercial_quotes_payment_method_check" CHECK ((("payment_method")::"text" = ANY ((ARRAY['pix'::character varying, 'boleto'::character varying, 'card'::character varying, 'mixed'::character varying])::"text"[]))),
    CONSTRAINT "commercial_quotes_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'in_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying])::"text"[]))),
    CONSTRAINT "commercial_quotes_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "commercial_quotes_version_check" CHECK (("version" > 0))
);


ALTER TABLE "control"."commercial_quotes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."update_commercial_quote_status"("p_quote_id" "uuid", "p_status" "text", "p_approved_by_name" "text" DEFAULT NULL::"text") RETURNS "control"."commercial_quotes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_before control.commercial_quotes%ROWTYPE;
  v_after control.commercial_quotes%ROWTYPE;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to update commercial quote status';
  END IF;

  IF p_status NOT IN ('draft', 'sent', 'in_review', 'approved', 'rejected', 'expired') THEN
    RAISE EXCEPTION 'Invalid commercial quote status: %', p_status;
  END IF;

  SELECT *
  INTO v_before
  FROM control.commercial_quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial quote not found: %', p_quote_id;
  END IF;

  UPDATE control.commercial_quotes
  SET
    status = p_status,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
    rejected_at = CASE WHEN p_status = 'rejected' THEN now() ELSE rejected_at END,
    rejected_by = CASE WHEN p_status = 'rejected' THEN auth.uid() ELSE rejected_by END,
    updated_by = auth.uid()
  WHERE id = p_quote_id
  RETURNING * INTO v_after;

  INSERT INTO control.commercial_audit_logs (
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  VALUES (
    'commercial_quote',
    p_quote_id,
    CASE
      WHEN p_status = 'approved'
      THEN 'commercial_quote.approved'
      ELSE 'commercial_quote.status_updated'
    END,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_after.status),
    jsonb_build_object('approved_by_name', p_approved_by_name)
  );

  RETURN v_after;
END;
$$;


ALTER FUNCTION "control"."update_commercial_quote_status"("p_quote_id" "uuid", "p_status" "text", "p_approved_by_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."update_commercial_signature_request"("p_signature_request_id" "uuid", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "control"."commercial_signature_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_before control.commercial_signature_requests%ROWTYPE;
  v_after control.commercial_signature_requests%ROWTYPE;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to update commercial signature request';
  END IF;

  SELECT * INTO v_before
  FROM control.commercial_signature_requests
  WHERE id = p_signature_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial signature request not found: %', p_signature_request_id;
  END IF;
  IF v_before.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft signature requests can be edited';
  END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at < now() THEN RAISE EXCEPTION 'Signature expiration cannot be in the past'; END IF;

  UPDATE control.commercial_signature_requests
  SET expires_at = p_expires_at
  WHERE id = p_signature_request_id
  RETURNING * INTO v_after;

  INSERT INTO control.commercial_signature_events (
    signature_request_id, event_type, event_payload, actor_user_id, actor_role
  )
  VALUES (
    v_after.id, 'expires_at_updated',
    jsonb_build_object('before', v_before.expires_at, 'after', v_after.expires_at),
    auth.uid(), control.current_admin_role()
  );

  INSERT INTO control.commercial_audit_logs (
    entity_type, entity_id, action, before_data, after_data
  )
  VALUES (
    'commercial_signature_request', v_after.id, 'commercial_signature_request.expires_at_updated',
    jsonb_build_object('expires_at', v_before.expires_at),
    jsonb_build_object('expires_at', v_after.expires_at)
  );

  RETURN v_after;
END;
$$;


ALTER FUNCTION "control"."update_commercial_signature_request"("p_signature_request_id" "uuid", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."update_commercial_signature_status"("p_signature_request_id" "uuid", "p_status" "text") RETURNS "control"."commercial_signature_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_before control.commercial_signature_requests%ROWTYPE;
  v_after control.commercial_signature_requests%ROWTYPE;
  v_event_type text;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to update commercial signature status';
  END IF;
  IF p_status NOT IN ('draft','pending','viewed','signed','rejected','canceled','expired') THEN
    RAISE EXCEPTION 'Invalid commercial signature status: %', p_status;
  END IF;

  SELECT * INTO v_before
  FROM control.commercial_signature_requests
  WHERE id = p_signature_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial signature request not found: %', p_signature_request_id;
  END IF;
  IF p_status = v_before.status THEN
    RETURN v_before;
  END IF;
  IF NOT (
    (v_before.status = 'draft' AND p_status IN ('pending','canceled')) OR
    (v_before.status = 'pending' AND p_status IN ('viewed','signed','rejected','canceled','expired')) OR
    (v_before.status = 'viewed' AND p_status IN ('signed','rejected','canceled','expired'))
  ) THEN
    RAISE EXCEPTION 'Invalid commercial signature transition: % -> %', v_before.status, p_status;
  END IF;
  IF p_status = 'pending' AND v_before.expires_at IS NOT NULL AND v_before.expires_at < now() THEN
    RAISE EXCEPTION 'Expired signature requests cannot be sent';
  END IF;
  IF p_status = 'pending' AND NOT EXISTS (
    SELECT 1 FROM control.commercial_signers WHERE signature_request_id = v_before.id
  ) THEN
    RAISE EXCEPTION 'Signature request needs at least one signer';
  END IF;

  UPDATE control.commercial_signature_requests
  SET status = p_status,
      requested_at = CASE WHEN p_status = 'pending' THEN COALESCE(requested_at, now()) ELSE requested_at END,
      signed_at = CASE WHEN p_status = 'signed' THEN now() ELSE signed_at END,
      rejected_at = CASE WHEN p_status = 'rejected' THEN now() ELSE rejected_at END,
      canceled_at = CASE WHEN p_status = 'canceled' THEN now() ELSE canceled_at END
  WHERE id = p_signature_request_id
  RETURNING * INTO v_after;

  v_event_type := CASE WHEN p_status = 'pending' THEN 'sent_internal' ELSE p_status END;
  INSERT INTO control.commercial_signature_events (
    signature_request_id, event_type, event_payload, actor_user_id, actor_role
  )
  VALUES (
    v_after.id, v_event_type, jsonb_build_object('from', v_before.status, 'to', v_after.status),
    auth.uid(), control.current_admin_role()
  );

  INSERT INTO control.commercial_audit_logs (entity_type, entity_id, action, before_data, after_data)
  VALUES (
    'commercial_signature_request', v_after.id, 'commercial_signature_request.status_updated',
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_after.status)
  );

  RETURN v_after;
END;
$$;


ALTER FUNCTION "control"."update_commercial_signature_status"("p_signature_request_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."update_import_job_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = now();
    return new;
end;
$$;


ALTER FUNCTION "control"."update_import_job_timestamp"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_signature_message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel" "text" NOT NULL,
    "template_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "allowed_variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_signature_message_templates_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text"]))),
    CONSTRAINT "commercial_signature_message_templates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "control"."commercial_signature_message_templates" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."upsert_commercial_signature_message_template"("p_template_id" "uuid", "p_channel" "text", "p_template_key" "text", "p_name" "text", "p_subject" "text", "p_body" "text", "p_status" "text" DEFAULT 'active'::"text") RETURNS "control"."commercial_signature_message_templates"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_old control.commercial_signature_message_templates%ROWTYPE;
  v_new control.commercial_signature_message_templates%ROWTYPE;
  v_version integer;
  v_template_text text;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to manage signature message templates';
  END IF;
  IF p_channel NOT IN ('whatsapp','email') THEN RAISE EXCEPTION 'Invalid template channel: %', p_channel; END IF;
  IF p_status NOT IN ('draft','active','archived') THEN RAISE EXCEPTION 'Invalid template status: %', p_status; END IF;
  IF btrim(COALESCE(p_template_key, '')) = '' THEN RAISE EXCEPTION 'Template key is required'; END IF;
  IF btrim(COALESCE(p_name, '')) = '' THEN RAISE EXCEPTION 'Template name is required'; END IF;
  IF btrim(COALESCE(p_body, '')) = '' THEN RAISE EXCEPTION 'Template body is required'; END IF;

  v_template_text := COALESCE(p_subject, '') || E'\n' || p_body;
  PERFORM control.validate_commercial_signature_template_variables(v_template_text);
  IF v_template_text ~* '(^|[[:space:]])(https?://[^[:space:]]+)?/?sign/[^[:space:]]+' THEN
    RAISE EXCEPTION 'Templates must use {{public_link}} instead of a real signature link';
  END IF;

  IF p_template_id IS NOT NULL THEN
    SELECT * INTO v_old FROM control.commercial_signature_message_templates WHERE id = p_template_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Signature message template not found: %', p_template_id; END IF;
    UPDATE control.commercial_signature_message_templates SET status = 'archived', updated_by = auth.uid() WHERE id = v_old.id;
    v_version := v_old.version + 1;
  ELSE
    SELECT COALESCE(max(version), 0) + 1 INTO v_version
    FROM control.commercial_signature_message_templates
    WHERE channel = p_channel AND template_key = p_template_key;
  END IF;

  IF p_status = 'active' THEN
    UPDATE control.commercial_signature_message_templates
    SET status = 'archived', updated_by = auth.uid()
    WHERE channel = p_channel AND template_key = p_template_key AND status = 'active';
  END IF;

  INSERT INTO control.commercial_signature_message_templates(
    channel, template_key, name, subject, body, version, status, allowed_variables, created_by, updated_by
  )
  VALUES (
    p_channel, p_template_key, btrim(p_name), NULLIF(p_subject, ''), p_body, v_version, p_status,
    '["signer_name","contract_number","document_number","company_name","public_link","expires_at","responsible_name"]'::jsonb,
    auth.uid(), auth.uid()
  )
  RETURNING * INTO v_new;

  INSERT INTO control.commercial_audit_logs(entity_type, entity_id, action, before_data, after_data)
  VALUES (
    'commercial_signature_message_template',
    v_new.id,
    CASE WHEN p_template_id IS NULL THEN 'commercial_signature_message_template.created' ELSE 'commercial_signature_message_template.versioned' END,
    to_jsonb(v_old),
    to_jsonb(v_new)
  );
  RETURN v_new;
END;
$$;


ALTER FUNCTION "control"."upsert_commercial_signature_message_template"("p_template_id" "uuid", "p_channel" "text", "p_template_key" "text", "p_name" "text", "p_subject" "text", "p_body" "text", "p_status" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_signers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signature_request_id" "uuid" NOT NULL,
    "signer_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "document" "text",
    "role_title" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "signed_at" timestamp with time zone,
    "viewed_at" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_viewed_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "acceptance_ip" "text",
    "acceptance_user_agent" "text",
    "rejection_reason" "text",
    CONSTRAINT "commercial_signers_signer_type_check" CHECK (("signer_type" = ANY (ARRAY['contractor'::"text", 'client'::"text", 'witness'::"text"]))),
    CONSTRAINT "commercial_signers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'viewed'::"text", 'signed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "control"."commercial_signers" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."upsert_commercial_signer"("p_signature_request_id" "uuid", "p_signer_id" "uuid" DEFAULT NULL::"uuid", "p_signer_type" "text" DEFAULT 'client'::"text", "p_name" "text" DEFAULT ''::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_document" "text" DEFAULT NULL::"text", "p_role_title" "text" DEFAULT NULL::"text") RETURNS "control"."commercial_signers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE
  v_request control.commercial_signature_requests%ROWTYPE;
  v_before control.commercial_signers%ROWTYPE;
  v_after control.commercial_signers%ROWTYPE;
  v_action text;
BEGIN
  IF NOT control.has_role(ARRAY['super_admin','admin','finance']) THEN
    RAISE EXCEPTION 'Insufficient permission to manage commercial signer';
  END IF;
  IF p_signer_type NOT IN ('contractor','client','witness') THEN
    RAISE EXCEPTION 'Invalid commercial signer type: %', p_signer_type;
  END IF;
  IF btrim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Commercial signer name is required';
  END IF;

  SELECT * INTO v_request
  FROM control.commercial_signature_requests
  WHERE id = p_signature_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial signature request not found: %', p_signature_request_id;
  END IF;
  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft signature requests can manage signers';
  END IF;

  IF p_signer_id IS NULL THEN
    INSERT INTO control.commercial_signers (
      signature_request_id, signer_type, name, email, phone, document, role_title
    )
    VALUES (
      p_signature_request_id, p_signer_type, btrim(p_name), NULLIF(btrim(COALESCE(p_email, '')), ''),
      NULLIF(btrim(COALESCE(p_phone, '')), ''), NULLIF(btrim(COALESCE(p_document, '')), ''),
      NULLIF(btrim(COALESCE(p_role_title, '')), '')
    )
    RETURNING * INTO v_after;
    v_action := 'signer_added';
  ELSE
    SELECT * INTO v_before
    FROM control.commercial_signers
    WHERE id = p_signer_id AND signature_request_id = p_signature_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Commercial signer not found: %', p_signer_id;
    END IF;

    UPDATE control.commercial_signers
    SET signer_type = p_signer_type,
        name = btrim(p_name),
        email = NULLIF(btrim(COALESCE(p_email, '')), ''),
        phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
        document = NULLIF(btrim(COALESCE(p_document, '')), ''),
        role_title = NULLIF(btrim(COALESCE(p_role_title, '')), '')
    WHERE id = p_signer_id
    RETURNING * INTO v_after;
    v_action := 'signer_updated';
  END IF;

  INSERT INTO control.commercial_signature_events (signature_request_id, signer_id, event_type, event_payload, actor_user_id, actor_role)
  VALUES (v_request.id, v_after.id, v_action, to_jsonb(v_after), auth.uid(), control.current_admin_role());

  INSERT INTO control.commercial_audit_logs (entity_type, entity_id, action, before_data, after_data)
  VALUES ('commercial_signer', v_after.id, 'commercial_signature_request.' || v_action, to_jsonb(v_before), to_jsonb(v_after));

  RETURN v_after;
END;
$$;


ALTER FUNCTION "control"."upsert_commercial_signer"("p_signature_request_id" "uuid", "p_signer_id" "uuid", "p_signer_type" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_document" "text", "p_role_title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "control"."validate_commercial_signature_template_variables"("p_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'control', 'public'
    AS $$
DECLARE v_match text[]; v_name text;
BEGIN
  FOR v_match IN SELECT regexp_matches(COALESCE(p_text, ''), '\{\{\s*([a-zA-Z0-9_]+)\s*\}\}', 'g') LOOP
    v_name := v_match[1];
    IF v_name NOT IN ('signer_name','contract_number','document_number','company_name','public_link','expires_at','responsible_name') THEN
      RAISE EXCEPTION 'Invalid template variable: %', v_name;
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION "control"."validate_commercial_signature_template_variables"("p_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_plan_credit_to_comanda_item"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_comanda_item_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_professional_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_comanda public.comandas%ROWTYPE;
    v_item public.comanda_items%ROWTYPE;
    v_sub_id UUID; v_plan_id UUID;
    v_cycle_start TIMESTAMPTZ;
    v_credit_rec public.customer_credits%ROWTYPE;
    v_svc_entry JSONB; v_balance JSONB;
    v_bal_idx INTEGER; v_available INTEGER := 0; v_used INTEGER := 0;
    v_orig_price NUMERIC(10,2); v_svc_name TEXT; v_plan_name TEXT;
    v_credit_key TEXT; v_usage_id UUID;
BEGIN
    SELECT * INTO v_comanda FROM public.comandas
    WHERE id = p_comanda_id AND tenant_id = p_tenant_id AND status = 'open'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Comanda nao encontrada ou ja fechada'; END IF;

    SELECT * INTO v_item FROM public.comanda_items
    WHERE id = p_comanda_item_id AND comanda_id = p_comanda_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item nao encontrado'; END IF;
    IF v_item.paid_with_plan_credit = true THEN RAISE EXCEPTION 'Item ja pago com credito'; END IF;

    SELECT cs.id, cs.plan_id, cs.cycle_start INTO v_sub_id, v_plan_id, v_cycle_start
    FROM public.customer_subscriptions cs
    WHERE cs.client_id = p_client_id AND cs.tenant_id = p_tenant_id
      AND cs.status = 'active' AND cs.cycle_end >= now()
    ORDER BY cs.created_at DESC LIMIT 1;
    IF v_sub_id IS NULL THEN RAISE EXCEPTION 'Cliente sem assinatura ativa'; END IF;

    SELECT name INTO v_plan_name FROM public.customer_plans WHERE id = v_plan_id;
    SELECT name INTO v_svc_name FROM public.services WHERE id = p_service_id;

    SELECT entry INTO v_svc_entry
    FROM jsonb_array_elements(COALESCE((SELECT service_credit_map FROM public.customer_plans WHERE id = v_plan_id), '[]'::jsonb))
    WHERE entry->>'service_id' = p_service_id::text LIMIT 1;
    IF v_svc_entry IS NULL THEN RAISE EXCEPTION 'Servico fora do plano'; END IF;

    SELECT * INTO v_credit_rec FROM public.customer_credits
    WHERE subscription_id = v_sub_id AND period_start = v_cycle_start FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Creditos nao encontrados para este ciclo'; END IF;

    SELECT ordinality-1, value INTO v_bal_idx, v_balance
    FROM jsonb_array_elements(COALESCE(v_credit_rec.service_balance_map, '[]'::jsonb)) WITH ORDINALITY
    WHERE value->>'service_id' = p_service_id::text LIMIT 1;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Credito nao configurado para este servico'; END IF;

    v_available := COALESCE((v_balance->>'available')::INTEGER, 0);
    v_used := COALESCE((v_balance->>'used')::INTEGER, 0);
    IF v_available <= 0 THEN RAISE EXCEPTION 'Creditos esgotados'; END IF;

    v_orig_price := v_item.unit_price;
    v_credit_key := COALESCE(v_svc_entry->>'service_name', v_svc_name);

    v_balance := jsonb_set(v_balance, '{available}', to_jsonb(v_available-1));
    v_balance := jsonb_set(v_balance, '{used}', to_jsonb(v_used+1));

    UPDATE public.customer_credits
    SET available_credits = GREATEST(0, available_credits-1), used_credits = used_credits+1,
        service_balance_map = jsonb_set(COALESCE(service_balance_map,'[]'::jsonb), ARRAY[v_bal_idx::text], v_balance, false),
        updated_at = now()
    WHERE id = v_credit_rec.id;

    INSERT INTO public.customer_plan_credit_usages (
        tenant_id, client_id, subscription_id, plan_id, service_id, comanda_id, comanda_item_id,
        professional_id, credit_key, quantity_used, original_price, credit_effect, used_at, created_by
    ) VALUES (
        p_tenant_id, p_client_id, v_sub_id, v_plan_id, p_service_id, p_comanda_id, p_comanda_item_id,
        p_professional_id, v_credit_key, 1, v_orig_price, v_orig_price, now(), auth.uid()
    ) RETURNING id INTO v_usage_id;

    UPDATE public.comanda_items
    SET unit_price = 0, paid_with_plan_credit = true, subscription_id = v_sub_id, plan_id = v_plan_id,
        credit_usage_id = v_usage_id, original_price = v_orig_price, final_price = 0, plan_credit_key = v_credit_key
    WHERE id = p_comanda_item_id;

    RETURN jsonb_build_object('success',true,'credit_usage_id',v_usage_id,'original_price',v_orig_price,
        'credit_key',v_credit_key,'service_name',v_svc_name,'plan_name',v_plan_name);
END;
$$;


ALTER FUNCTION "public"."apply_plan_credit_to_comanda_item"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_comanda_item_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_professional_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_access_request"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_request RECORD;
  v_tenant_id UUID;
BEGIN
  -- Get request details
  SELECT * FROM public.access_requests INTO v_request WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_request.status = 'approved' THEN
    RAISE EXCEPTION 'Pedido já aprovado';
  END IF;

  -- 1. Create Tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (v_request.tenant_name, lower(regexp_replace(v_request.tenant_name, '[^a-zA-Z0-9]+', '-', 'g')))
  RETURNING id INTO v_tenant_id;

  -- 2. Create Profile (Admin for the new shop)
  -- Note: This assumes the user already exists in auth.users or will be created via inviting.
  -- For now, we link by email or placeholder. In a real scenario, we'd trigger an invite.
  -- Here we just ensure the request is marked and tenant is ready.
  
  UPDATE public.access_requests 
  SET status = 'approved',
      updated_at = now()
  WHERE id = p_request_id;

  -- 3. Create initial notification for the new tenant
  INSERT INTO public.notifications (tenant_id, type, title, description)
  VALUES (v_tenant_id, 'system_alert', 'Bem-vindo!', 'Sua barbearia foi ativada com sucesso. Comece configurando seu time e serviços.');

END;
$$;


ALTER FUNCTION "public"."approve_access_request"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_notification"("p_notification_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  UPDATE public.notifications
  SET status = 'archived', read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND tenant_id = v_tenant_id
    AND (user_id IS NULL OR user_id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."archive_notification"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_role_permissions_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.enabled = true THEN
    INSERT INTO public.role_permissions_audit (tenant_id, role, permission_key, old_enabled, new_enabled, changed_by)
    VALUES (NEW.tenant_id, NEW.role, NEW.permission_key, false, NEW.enabled, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.enabled != NEW.enabled THEN
    INSERT INTO public.role_permissions_audit (tenant_id, role, permission_key, old_enabled, new_enabled, changed_by)
    VALUES (NEW.tenant_id, NEW.role, NEW.permission_key, OLD.enabled, NEW.enabled, COALESCE(NEW.created_by, auth.uid()));
  ELSIF TG_OP = 'DELETE' AND OLD.enabled = true THEN
    INSERT INTO public.role_permissions_audit (tenant_id, role, permission_key, old_enabled, new_enabled, changed_by)
    VALUES (OLD.tenant_id, OLD.role, OLD.permission_key, OLD.enabled, false, auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."audit_role_permissions_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_chef_club_service_balance_map"("p_plan_id" "uuid") RETURNS TABLE("service_balance_map" "jsonb", "total_credits" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_plan public.customer_plans%ROWTYPE;
BEGIN
  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'service_id', service_id,
          'service_name', service_name,
          'available', credits,
          'used', 0
        )
        ORDER BY ordinality
      ),
      '[]'::jsonb
    ) AS service_balance_map,
    COALESCE(SUM(credits), 0)::INTEGER AS total_credits
  FROM (
    SELECT
      NULLIF(BTRIM(entry.value ->> 'service_id'), '') AS service_id,
      NULLIF(BTRIM(entry.value ->> 'service_name'), '') AS service_name,
      GREATEST(0, COALESCE((entry.value ->> 'credits')::INTEGER, 0)) AS credits,
      entry.ordinality
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(v_plan.service_credit_map, '[]'::jsonb)) = 'array'
          THEN COALESCE(v_plan.service_credit_map, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS entry(value, ordinality)
  ) normalized
  WHERE service_id IS NOT NULL
    AND service_name IS NOT NULL
    AND credits > 0;
END;
$$;


ALTER FUNCTION "public"."build_chef_club_service_balance_map"("p_plan_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_close_comandas_admin"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_closure_note" "text" DEFAULT NULL::"text", "p_legacy_reference_month" "date" DEFAULT NULL::"date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_ids UUID[];
  v_updated_count INTEGER := 0;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
  INTO v_ids
  FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Selecione ao menos uma comanda para baixa administrativa';
  END IF;

  UPDATE public.comandas
  SET
    status = 'paid',
    closure_mode = 'legacy_membership',
    closure_note = NULLIF(BTRIM(p_closure_note), ''),
    financial_effect = false,
    membership_credit_effect = false,
    legacy_reference_month = p_legacy_reference_month,
    closed_at = now()
  WHERE id = ANY(v_ids)
    AND status = 'open'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  UPDATE public.appointments
  SET status = 'completed'
  WHERE id IN (
    SELECT appointment_id
    FROM public.comandas
    WHERE id = ANY(v_ids)
      AND appointment_id IS NOT NULL
      AND status = 'paid'
      AND closure_mode = 'legacy_membership'
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  )
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    AND status <> 'completed';

  RETURN jsonb_build_object(
    'updated_count', v_updated_count,
    'closure_mode', 'legacy_membership',
    'financial_effect', false,
    'membership_credit_effect', false
  );
END;
$$;


ALTER FUNCTION "public"."bulk_close_comandas_admin"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_legacy_reference_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_close_comandas_normal"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text" DEFAULT NULL::"text", "p_payment_method" "text" DEFAULT 'Dinheiro'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
    v_ids UUID[];
    v_updated_count INTEGER := 0;
BEGIN
    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::UUID[])
    INTO v_ids
    FROM unnest(COALESCE(p_comanda_ids, ARRAY[]::UUID[])) AS id;

    IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Selecione ao menos uma comanda';
    END IF;

    UPDATE barber.comandas
    SET
        status = 'paid',
        closure_mode = 'standard',
        closure_note = NULLIF(BTRIM(p_closure_note), ''),
        financial_effect = true,
        membership_credit_effect = true,
        payment_method = p_payment_method,
        closed_at = NOW()
    WHERE id = ANY(v_ids)
        AND status = 'open'
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    UPDATE barber.appointments
    SET status = 'completed'
    WHERE id IN (
        SELECT appointment_id
        FROM barber.comandas
        WHERE id = ANY(v_ids)
            AND appointment_id IS NOT NULL
            AND status = 'paid'
            AND closure_mode = 'standard'
    );

    RETURN jsonb_build_object(
        'updated_count', v_updated_count,
        'closure_mode', 'standard',
        'financial_effect', true,
        'membership_credit_effect', true
    );
END;
$$;


ALTER FUNCTION "public"."bulk_close_comandas_normal"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_close_comandas_with_credits"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_closure_note" "text" DEFAULT NULL::"text", "p_payment_method" "text" DEFAULT 'Dinheiro'::"text", "p_apply_credits" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_ids UUID[]; v_updated_count INTEGER := 0;
    v_comanda_id UUID; v_item_id UUID; v_client_id UUID; v_service_id UUID; v_staff_id UUID;
    v_subscription_id UUID; v_credit_result JSONB;
    v_credits_applied INTEGER := 0; v_items_paid_normal INTEGER := 0;
    v_comanda_results JSONB := '[]'::jsonb; v_comanda_result JSONB;
BEGIN
    SELECT COALESCE(array_agg(DISTINCT id),ARRAY[]::UUID[]) INTO v_ids
    FROM unnest(COALESCE(p_comanda_ids,ARRAY[]::UUID[])) AS id;
    IF COALESCE(array_length(v_ids,1),0) = 0 THEN RAISE EXCEPTION 'Selecione ao menos uma comanda'; END IF;
    FOR v_comanda_id IN SELECT unnest(v_ids) LOOP
        BEGIN
            v_credits_applied := 0; v_items_paid_normal := 0;
            SELECT c.client_id, c.staff_id INTO v_client_id, v_staff_id
            FROM public.comandas c WHERE c.id=v_comanda_id AND c.status='open'
              AND (p_tenant_id IS NULL OR c.tenant_id=p_tenant_id) FOR UPDATE;
            IF NOT FOUND THEN
                v_comanda_results := v_comanda_results || jsonb_build_object('comanda_id',v_comanda_id,'success',false,'message','Ja fechada');
                CONTINUE;
            END IF;
            SELECT id INTO v_subscription_id FROM public.customer_subscriptions
            WHERE client_id=v_client_id AND tenant_id=COALESCE(p_tenant_id,tenant_id)
              AND status='active' AND cycle_end>=now() ORDER BY created_at DESC LIMIT 1;
            FOR v_item_id, v_service_id IN SELECT ci.id, ci.service_id FROM public.comanda_items ci WHERE ci.comanda_id=v_comanda_id LOOP
                IF EXISTS (SELECT 1 FROM public.comanda_items WHERE id=v_item_id AND paid_with_plan_credit=true) THEN CONTINUE; END IF;
                IF v_service_id IS NULL THEN v_items_paid_normal := v_items_paid_normal+1; CONTINUE; END IF;
                IF p_apply_credits AND v_subscription_id IS NOT NULL THEN
                    BEGIN v_credit_result := public.apply_plan_credit_to_comanda_item(
                        COALESCE(p_tenant_id,(SELECT tenant_id FROM public.comandas WHERE id=v_comanda_id)),
                        v_comanda_id, v_item_id, v_client_id, v_service_id, v_staff_id);
                        IF (v_credit_result->>'success')::boolean THEN v_credits_applied := v_credits_applied+1;
                        ELSE v_items_paid_normal := v_items_paid_normal+1; END IF;
                    EXCEPTION WHEN OTHERS THEN v_items_paid_normal := v_items_paid_normal+1; END;
                ELSE v_items_paid_normal := v_items_paid_normal+1; END IF;
            END LOOP;
            UPDATE public.comandas SET status='paid', closure_mode='standard', closure_note=NULLIF(BTRIM(p_closure_note),''),
                financial_effect=true, membership_credit_effect=p_apply_credits, payment_method=p_payment_method, closed_at=NOW()
            WHERE id=v_comanda_id; GET DIAGNOSTICS v_updated_count = ROW_COUNT;
            v_comanda_results := v_comanda_results || jsonb_build_object('comanda_id',v_comanda_id,'success',true,
                'credits_applied',v_credits_applied,'items_paid_normal',v_items_paid_normal,'message','Fechada');
        EXCEPTION WHEN OTHERS THEN v_comanda_results := v_comanda_results || jsonb_build_object(
            'comanda_id',v_comanda_id,'success',false,'message','Erro: '||SQLERRM); END;
    END LOOP;
    UPDATE public.appointments SET status='completed' WHERE id IN (
        SELECT appointment_id FROM public.comandas WHERE id=ANY(v_ids)
          AND appointment_id IS NOT NULL AND status='paid' AND closure_mode='standard');
    RETURN jsonb_build_object('updated_count',v_updated_count,'closure_mode','standard','financial_effect',true,
        'membership_credit_effect',p_apply_credits,'comandas',v_comanda_results);
END;
$$;


ALTER FUNCTION "public"."bulk_close_comandas_with_credits"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text", "p_apply_credits" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_sub RECORD;
BEGIN
    IF p_tenant_id IS NULL OR p_subscription_id IS NULL THEN
        RAISE EXCEPTION 'Tenant e assinatura são obrigatórios';
    END IF;
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    SELECT id, status, client_id INTO v_sub
    FROM public.customer_subscriptions
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    IF v_sub IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Assinatura não encontrada neste tenant');
    END IF;
    IF v_sub.status = 'canceled' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Assinatura já está cancelada');
    END IF;
    UPDATE public.customer_subscriptions
    SET status = 'canceled', canceled_at = now(), updated_at = now()
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Assinatura cancelada.',
        'subscription_id', p_subscription_id
    );
END;
$$;


ALTER FUNCTION "public"."cancel_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_minimum_stock"("p_product_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_stock INTEGER;
  v_min_stock INTEGER;
  v_auto_order BOOLEAN;
  v_tenant_id UUID;
  v_name TEXT;
BEGIN
  SELECT stock_quantity, minimum_stock, auto_generate_purchase_order, tenant_id, name
  INTO v_current_stock, v_min_stock, v_auto_order, v_tenant_id, v_name
  FROM public.products
  WHERE id = p_product_id;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(v_current_stock, 0) <= COALESCE(v_min_stock, 0) THEN
    PERFORM public.create_internal_notification(
      v_tenant_id,
      NULL,
      'estoque_baixo',
      'Estoque baixo',
      'O produto ' || COALESCE(v_name, 'sem nome') || ' está com estoque abaixo do mínimo.',
      'products',
      p_product_id,
      CASE WHEN COALESCE(v_current_stock, 0) <= 0 THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('stock_quantity', v_current_stock, 'minimum_stock', v_min_stock)
    );

    IF COALESCE(v_auto_order, false) = true THEN
      INSERT INTO public.purchase_orders (tenant_id, product_id, quantity, status)
      VALUES (v_tenant_id, p_product_id, GREATEST(COALESCE(v_min_stock, 0) * 2, 1), 'pending');
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION "public"."check_minimum_stock"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_order"("p_comanda_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_schema text;
  v_tenant_id uuid;
  v_item record;
  v_item_select_sql text;
  v_product_update_sql text;
  v_comanda_update_sql text;
BEGIN
  SELECT resolved.schema_name, resolved.tenant_id
  INTO v_schema, v_tenant_id
  FROM public.resolve_comanda_runtime_schema(p_comanda_id) AS resolved;

  IF v_schema IS NULL THEN
    RETURN;
  END IF;

  v_product_update_sql := CASE
    WHEN v_schema = 'public' AND v_tenant_id IS NULL AND public.table_has_column(v_schema, 'products', 'updated_at') THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1,
             updated_at = now()
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND v_tenant_id IS NULL THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND public.table_has_column(v_schema, 'products', 'updated_at') THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1,
             updated_at = now()
         WHERE id = $2
           AND (tenant_id = $3 OR tenant_id IS NULL)',
        v_schema
      )
    WHEN public.table_has_column(v_schema, 'products', 'updated_at') THEN
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1,
             updated_at = now()
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
    ELSE
      format(
        'UPDATE %I.products
         SET stock_quantity = stock_quantity - $1
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
  END;

  v_item_select_sql := CASE
    WHEN v_schema = 'public' AND v_tenant_id IS NULL THEN
      format(
        'SELECT product_id, quantity
         FROM %I.comanda_items
         WHERE comanda_id = $1
           AND product_id IS NOT NULL',
        v_schema
      )
    WHEN v_schema = 'public' THEN
      format(
        'SELECT product_id, quantity
         FROM %I.comanda_items
         WHERE comanda_id = $1
           AND (tenant_id = $2 OR tenant_id IS NULL)
           AND product_id IS NOT NULL',
        v_schema
      )
    ELSE
      format(
        'SELECT product_id, quantity
         FROM %I.comanda_items
         WHERE comanda_id = $1
           AND tenant_id = $2
           AND product_id IS NOT NULL',
        v_schema
      )
  END;

  IF v_schema = 'public' AND v_tenant_id IS NULL THEN
    FOR v_item IN
      EXECUTE v_item_select_sql
      USING p_comanda_id
    LOOP
      EXECUTE v_product_update_sql
      USING v_item.quantity, v_item.product_id;

      PERFORM public.check_minimum_stock(v_item.product_id);
    END LOOP;
  ELSE
    FOR v_item IN
      EXECUTE v_item_select_sql
      USING p_comanda_id, v_tenant_id
    LOOP
      EXECUTE v_product_update_sql
      USING v_item.quantity, v_item.product_id, v_tenant_id;

      PERFORM public.check_minimum_stock(v_item.product_id);
    END LOOP;
  END IF;

  v_comanda_update_sql := CASE
    WHEN v_schema = 'public' AND v_tenant_id IS NULL AND public.table_has_column(v_schema, 'comandas', 'updated_at') THEN
      format(
        'UPDATE %I.comandas
         SET status = $1,
             updated_at = now()
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND v_tenant_id IS NULL THEN
      format(
        'UPDATE %I.comandas
         SET status = $1
         WHERE id = $2',
        v_schema
      )
    WHEN v_schema = 'public' AND public.table_has_column(v_schema, 'comandas', 'updated_at') THEN
      format(
        'UPDATE %I.comandas
         SET status = $1,
             updated_at = now()
         WHERE id = $2
           AND (tenant_id = $3 OR tenant_id IS NULL)',
        v_schema
      )
    WHEN public.table_has_column(v_schema, 'comandas', 'updated_at') THEN
      format(
        'UPDATE %I.comandas
         SET status = $1,
             updated_at = now()
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
    ELSE
      format(
        'UPDATE %I.comandas
         SET status = $1
         WHERE id = $2
           AND tenant_id = $3',
        v_schema
      )
  END;

  IF v_schema = 'public' AND v_tenant_id IS NULL THEN
    EXECUTE v_comanda_update_sql
    USING 'paid', p_comanda_id;
  ELSE
    EXECUTE v_comanda_update_sql
    USING 'paid', p_comanda_id, v_tenant_id;
  END IF;
END;
$_$;


ALTER FUNCTION "public"."close_order"("p_comanda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_order_with_chef_club"("p_comanda_id" "uuid", "p_tenant_id" "uuid", "p_consumptions" "jsonb" DEFAULT '[]'::"jsonb", "p_actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.close_order(p_comanda_id);

  IF p_consumptions IS NOT NULL AND jsonb_typeof(p_consumptions) = 'array' AND jsonb_array_length(p_consumptions) > 0 THEN
    PERFORM public.consume_chef_club_benefits(p_tenant_id, p_consumptions, p_actor_id);
  END IF;
END;
$$;


ALTER FUNCTION "public"."close_order_with_chef_club"("p_comanda_id" "uuid", "p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_chef_club_benefits"("p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rec RECORD;
  v_balance_after INTEGER;
  v_balance_before INTEGER;
BEGIN
  IF p_consumptions IS NULL OR jsonb_typeof(p_consumptions) <> 'array' THEN
    RAISE EXCEPTION 'Consumptions payload must be a JSON array';
  END IF;

  FOR rec IN
    SELECT *
    FROM jsonb_to_recordset(p_consumptions) AS payload(
      subscription_id UUID,
      client_id UUID,
      comanda_id UUID,
      comanda_item_id UUID,
      plan_benefit_id UUID,
      benefit_code TEXT,
      benefit_label TEXT,
      quantity_used INTEGER,
      original_unit_price NUMERIC,
      final_unit_price NUMERIC,
      override_mode TEXT,
      override_reason TEXT,
      balance_id UUID,
      metadata JSONB
    )
  LOOP
    IF rec.quantity_used IS NULL OR rec.quantity_used <= 0 THEN
      RAISE EXCEPTION 'Quantity used must be greater than zero';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.customer_benefit_consumptions c
      WHERE c.comanda_item_id = rec.comanda_item_id
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.customer_credits
    SET
      available_credits = available_credits - rec.quantity_used,
      used_credits = used_credits + rec.quantity_used,
      last_consumed_at = now(),
      updated_at = now()
    WHERE tenant_id = p_tenant_id
      AND subscription_id = rec.subscription_id
      AND benefit_code = rec.benefit_code
      AND available_credits >= rec.quantity_used
    RETURNING available_credits INTO v_balance_after;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance for benefit %', rec.benefit_code;
    END IF;

    v_balance_before := v_balance_after + rec.quantity_used;

    INSERT INTO public.customer_benefit_consumptions (
      tenant_id,
      client_id,
      subscription_id,
      plan_benefit_id,
      comanda_id,
      comanda_item_id,
      benefit_code,
      benefit_label,
      quantity_used,
      balance_before,
      balance_after,
      original_unit_price,
      final_unit_price,
      override_mode,
      override_reason,
      consumed_by,
      metadata
    ) VALUES (
      p_tenant_id,
      rec.client_id,
      rec.subscription_id,
      rec.plan_benefit_id,
      rec.comanda_id,
      rec.comanda_item_id,
      rec.benefit_code,
      rec.benefit_label,
      rec.quantity_used,
      v_balance_before,
      v_balance_after,
      COALESCE(rec.original_unit_price, 0),
      COALESCE(rec.final_unit_price, 0),
      COALESCE(rec.override_mode, 'auto'),
      COALESCE(rec.override_reason, ''),
      p_actor_id,
      COALESCE(rec.metadata, '{}'::jsonb)
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."consume_chef_club_benefits"("p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_unread_notifications"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  SELECT COUNT(*)::integer INTO v_count
  FROM public.notifications n
  WHERE n.tenant_id = v_tenant_id
    AND (n.user_id IS NULL OR n.user_id = auth.uid())
    AND n.status = 'unread';

  RETURN COALESCE(v_count, 0);
END;
$$;


ALTER FUNCTION "public"."count_unread_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_appointment_with_comanda"("p_tenant_id" "uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_client_name" "text" DEFAULT NULL::"text", "p_client_phone" "text" DEFAULT NULL::"text", "p_service_id" "uuid" DEFAULT NULL::"uuid", "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_start_time" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_price" numeric DEFAULT NULL::numeric, "p_notes" "text" DEFAULT NULL::"text", "p_idempotency_key" "text" DEFAULT NULL::"text", "p_is_overbooked" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_client_name TEXT;
  v_service_name TEXT;
  v_staff_name TEXT;
  v_service_price NUMERIC(10, 2) := 0;
  v_service_duration_minutes NUMERIC := 30;
  v_duration_hours NUMERIC(3, 1) := 1;
  v_appointment_id UUID;
  v_comanda_id UUID;
  v_comanda_item_id UUID;
  v_existing_appointment JSONB;
  v_comanda_status TEXT := 'open';
  v_sub_id UUID;
  v_eligible BOOLEAN := false;
  v_reason TEXT;
  v_avail_credits INTEGER := 0;
  v_plan_preview JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido para criar agendamento';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido para criar agendamento';
  END IF;

  IF p_service_id IS NULL OR p_staff_id IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatorios';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object(
      'appointment_id', a.id,
      'comanda_id', c.id,
      'comanda_item_id', ci.id,
      'service_price', COALESCE(NULLIF(to_jsonb(a)->>'price', '')::numeric, 0),
      'appointment_status', a.status
    ) INTO v_existing_appointment
    FROM public.appointments a
    LEFT JOIN public.comandas c ON c.appointment_id = a.id AND c.tenant_id = a.tenant_id
    LEFT JOIN public.comanda_items ci ON ci.comanda_id = c.id AND ci.tenant_id = a.tenant_id
    WHERE a.idempotency_key = p_idempotency_key AND a.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_existing_appointment IS NOT NULL THEN
      RETURN v_existing_appointment;
    END IF;
  END IF;

  SELECT
    s.name,
    COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0),
    COALESCE(
      NULLIF(to_jsonb(s)->>'duration', '')::numeric,
      NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
      30
    )
  INTO v_service_name, v_service_price, v_service_duration_minutes
  FROM public.services s
  WHERE s.id = p_service_id AND s.tenant_id = p_tenant_id
    AND COALESCE(
      NULLIF(to_jsonb(s)->>'active', '')::boolean,
      NULLIF(to_jsonb(s)->>'is_active', '')::boolean,
      true
    ) = true
  LIMIT 1;

  IF v_service_name IS NULL THEN
    RAISE EXCEPTION 'Servico invalido para este tenant';
  END IF;

  SELECT st.name INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_staff_id AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido para este tenant';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT c.name INTO v_client_name
    FROM public.clients c
    WHERE c.id = p_client_id AND c.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_client_name IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido para este tenant';
    END IF;
  END IF;

  v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente e obrigatorio';
  END IF;

  IF p_price IS NOT NULL AND p_price >= 0 THEN
    v_service_price := p_price;
  END IF;

  v_duration_hours := ROUND((GREATEST(COALESCE(v_service_duration_minutes, 30), 1) / 60.0)::numeric, 1);

  IF p_start_time::date > current_date THEN
    v_comanda_status := 'blocked';
  END IF;

  IF p_client_id IS NOT NULL AND to_regprocedure('public.preview_plan_credit_for_service(uuid,uuid,uuid,timestamp with time zone)') IS NOT NULL THEN
    SELECT eligible, reason, available_credits, subscription_id
    INTO v_eligible, v_reason, v_avail_credits, v_sub_id
    FROM public.preview_plan_credit_for_service(p_tenant_id, p_client_id, p_service_id, p_start_time)
    LIMIT 1;

    v_plan_preview := jsonb_build_object(
      'service_id', p_service_id,
      'service_name', v_service_name,
      'subscription_id', v_sub_id,
      'eligible', v_eligible,
      'reason', v_reason,
      'available_credits', v_avail_credits,
      'checked_at', now()
    );
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    staff_id,
    client_name,
    client_phone,
    service_name,
    staff_name,
    start_time,
    end_time,
    duration,
    price,
    notes,
    status,
    idempotency_key,
    is_overbooked,
    subscription_id,
    eligible_for_plan_credit,
    expected_plan_service,
    plan_credit_preview
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    p_service_id,
    p_staff_id,
    v_client_name,
    NULLIF(BTRIM(p_client_phone), ''),
    v_service_name,
    v_staff_name,
    p_start_time,
    p_start_time + (v_duration_hours * interval '1 hour'),
    v_duration_hours,
    v_service_price,
    NULLIF(BTRIM(p_notes), ''),
    'confirmed',
    p_idempotency_key,
    COALESCE(p_is_overbooked, false),
    v_sub_id,
    v_eligible,
    CASE WHEN v_eligible THEN v_service_name ELSE NULL END,
    v_plan_preview
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key)
  VALUES (p_tenant_id, v_appointment_id, p_client_id, p_staff_id, v_comanda_status, v_service_price, p_idempotency_key)
  RETURNING id INTO v_comanda_id;

  INSERT INTO public.comanda_items (tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id)
  VALUES (p_tenant_id, v_comanda_id, p_service_id, v_service_name, 1, v_service_price, p_staff_id)
  RETURNING id INTO v_comanda_item_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'comanda_item_id', v_comanda_item_id,
    'service_price', v_service_price,
    'appointment_status', 'confirmed',
    'chef_club_eligible', v_eligible,
    'subscription_id', v_sub_id,
    'plan_credit_preview', v_plan_preview
  );
END;
$$;


ALTER FUNCTION "public"."create_appointment_with_comanda"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_price" numeric, "p_notes" "text", "p_idempotency_key" "text", "p_is_overbooked" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_appointment_with_services"("p_tenant_id" "uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_client_name" "text" DEFAULT NULL::"text", "p_client_phone" "text" DEFAULT NULL::"text", "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_start_time" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text", "p_idempotency_key" "text" DEFAULT NULL::"text", "p_services" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_client_name TEXT;
  v_staff_name TEXT;
  v_services JSONB;
  v_service_ids UUID[];
  v_first_service_id UUID;
  v_first_service_name TEXT;
  v_total_price NUMERIC(10, 2) := 0;
  v_total_duration_minutes INTEGER := 0;
  v_duration_hours NUMERIC(3, 1) := 1;
  v_appointment_id UUID;
  v_comanda_id UUID;
  v_comanda_item_id UUID;
  v_service_row RECORD;
  v_sort_order INTEGER := 0;
  v_existing_result JSONB;
  v_comanda_status TEXT := 'open';
  v_services_text TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  IF p_services IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um servico';
  END IF;

  IF jsonb_typeof(p_services) = 'array' THEN
    v_services := p_services;
  ELSIF jsonb_typeof(p_services) = 'object' THEN
    v_services := jsonb_build_array(p_services);
  ELSIF jsonb_typeof(p_services) = 'string' THEN
    v_services_text := NULLIF(BTRIM(p_services #>> '{}'), '');

    IF v_services_text IS NULL THEN
      v_services := NULL;
    ELSIF left(v_services_text, 1) IN ('[', '{') THEN
      BEGIN
        v_services := v_services_text::jsonb;
        IF jsonb_typeof(v_services) = 'object' THEN
          v_services := jsonb_build_array(v_services);
        END IF;
      EXCEPTION WHEN others THEN
        v_services := jsonb_build_array(jsonb_build_object('service_name', v_services_text));
      END;
    ELSE
      v_services := jsonb_build_array(jsonb_build_object('service_name', v_services_text));
    END IF;
  ELSE
    v_services := NULL;
  END IF;

  IF v_services IS NULL OR jsonb_array_length(v_services) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um servico';
  END IF;

  IF p_staff_id IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Profissional e horario sao obrigatorios';
  END IF;

  SELECT st.name INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_staff_id
    AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT c.name INTO v_client_name
    FROM public.clients c
    WHERE c.id = p_client_id AND c.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_client_name IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido';
    END IF;
  END IF;

  v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente obrigatorio';
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT jsonb_build_object(
      'appointment_id', a.id,
      'comanda_id', c.id,
      'total_price', COALESCE(c.total, COALESCE(a.price, 0)),
      'total_duration_minutes', GREATEST(ROUND(COALESCE(a.duration, 0) * 60)::integer, 0),
      'idempotent', true
    )
    INTO v_existing_result
    FROM public.appointments a
    LEFT JOIN public.comandas c ON c.appointment_id = a.id AND c.tenant_id = a.tenant_id
    WHERE a.tenant_id = p_tenant_id
      AND a.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_result IS NOT NULL THEN
      RETURN v_existing_result;
    END IF;
  END IF;

  WITH requested AS (
    SELECT
      ordinality::integer AS sort_order,
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN NULLIF(elem->>'service_id', '')
        WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' from elem::text)
        ELSE NULL
      END AS service_key,
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN NULLIF(BTRIM(COALESCE(elem->>'service_name', elem->>'name')), '')
        WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' from elem::text)
        ELSE NULL
      END AS service_name
    FROM jsonb_array_elements(v_services) WITH ORDINALITY AS e(elem, ordinality)
  )
  SELECT array_agg(s.id ORDER BY requested.sort_order)
  INTO v_service_ids
  FROM requested
  JOIN public.services s
    ON s.tenant_id = p_tenant_id
   AND (
      (requested.service_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND s.id = requested.service_key::uuid)
      OR lower(s.name) = lower(COALESCE(requested.service_name, requested.service_key))
    )
   AND COALESCE(
      NULLIF(to_jsonb(s)->>'active', '')::boolean,
      NULLIF(to_jsonb(s)->>'is_active', '')::boolean,
      true
    ) = true;

  IF array_length(v_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum servico valido encontrado para este tenant';
  END IF;

  v_total_price := 0;
  v_total_duration_minutes := 0;
  v_sort_order := 0;

  FOR v_service_row IN
    SELECT
      s.id,
      s.name,
      COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) AS unit_price,
      COALESCE(
        NULLIF(to_jsonb(s)->>'duration', '')::numeric,
        NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
        30
      )::integer AS duration_minutes,
      COALESCE(NULLIF(to_jsonb(s)->>'buffer', '')::numeric, 0)::integer AS buffer_minutes
    FROM unnest(v_service_ids) WITH ORDINALITY AS ids(service_id, ordinality)
    JOIN public.services s ON s.id = ids.service_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY ids.ordinality
  LOOP
    IF v_sort_order = 0 THEN
      v_first_service_id := v_service_row.id;
      v_first_service_name := v_service_row.name;
    END IF;

    v_total_price := v_total_price + COALESCE(v_service_row.unit_price, 0);
    v_total_duration_minutes := v_total_duration_minutes
      + COALESCE(v_service_row.duration_minutes, 30)
      + COALESCE(v_service_row.buffer_minutes, 0);
    v_sort_order := v_sort_order + 1;
  END LOOP;

  IF v_first_service_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum servico valido encontrado';
  END IF;

  v_duration_hours := ROUND((GREATEST(v_total_duration_minutes, 15)::numeric / 60.0), 1);

  IF p_start_time::date > current_date THEN
    v_comanda_status := 'blocked';
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    client_id,
    service_id,
    staff_id,
    client_name,
    client_phone,
    service_name,
    staff_name,
    start_time,
    end_time,
    duration,
    price,
    status,
    notes,
    idempotency_key
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    v_first_service_id,
    p_staff_id,
    v_client_name,
    NULLIF(BTRIM(p_client_phone), ''),
    v_first_service_name,
    v_staff_name,
    p_start_time,
    p_start_time + (v_duration_hours * interval '1 hour'),
    v_duration_hours,
    v_total_price,
    'confirmed',
    NULLIF(BTRIM(p_notes), ''),
    p_idempotency_key
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key)
  VALUES (p_tenant_id, v_appointment_id, p_client_id, p_staff_id, v_comanda_status, v_total_price, p_idempotency_key)
  RETURNING id INTO v_comanda_id;

  v_sort_order := 0;
  FOR v_service_row IN
    SELECT
      s.id,
      s.name,
      COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) AS unit_price,
      COALESCE(
        NULLIF(to_jsonb(s)->>'duration', '')::numeric,
        NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
        30
      )::integer AS duration_minutes,
      COALESCE(NULLIF(to_jsonb(s)->>'buffer', '')::numeric, 0)::integer AS buffer_minutes
    FROM unnest(v_service_ids) WITH ORDINALITY AS ids(service_id, ordinality)
    JOIN public.services s ON s.id = ids.service_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY ids.ordinality
  LOOP
    INSERT INTO public.appointment_services (
      tenant_id,
      appointment_id,
      service_id,
      unit_price,
      duration_minutes,
      quantity,
      sort_order
    )
    VALUES (
      p_tenant_id,
      v_appointment_id,
      v_service_row.id,
      COALESCE(v_service_row.unit_price, 0),
      COALESCE(v_service_row.duration_minutes, 30) + COALESCE(v_service_row.buffer_minutes, 0),
      1,
      v_sort_order
    );

    INSERT INTO public.comanda_items (tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id)
    VALUES (p_tenant_id, v_comanda_id, v_service_row.id, v_service_row.name, 1, COALESCE(v_service_row.unit_price, 0), p_staff_id)
    RETURNING id INTO v_comanda_item_id;

    v_sort_order := v_sort_order + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'comanda_item_id', v_comanda_item_id,
    'total_price', v_total_price,
    'service_price', v_total_price,
    'total_duration_minutes', v_total_duration_minutes,
    'appointment_status', 'confirmed',
    'idempotent', false
  );
END;
$_$;


ALTER FUNCTION "public"."create_appointment_with_services"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_notes" "text", "p_idempotency_key" "text", "p_services" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_chef_club_subscription"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_next_billing_date" "date", "p_replace_existing" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_plan public.customer_plans%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_existing_subscription public.customer_subscriptions%ROWTYPE;
  v_cycle_start TIMESTAMPTZ := now();
  v_cycle_end TIMESTAMPTZ;
  v_service_balance_map JSONB;
  v_total_credits INTEGER;
  v_receivable_id UUID;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'Cliente obrigatório';
  END IF;

  IF p_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano obrigatório';
  END IF;

  IF p_next_billing_date IS NULL THEN
    RAISE EXCEPTION 'Próxima cobrança obrigatória';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = p_client_id
      AND c.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Cliente não encontrado para este tenant';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans cp
  WHERE cp.id = p_plan_id
    AND cp.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado para este tenant';
  END IF;

  IF NOT COALESCE(v_plan.active, false) THEN
    RAISE EXCEPTION 'Plano inativo';
  END IF;

  SELECT service_balance_map, total_credits
  INTO v_service_balance_map, v_total_credits
  FROM public.build_chef_club_service_balance_map(p_plan_id);

  IF v_total_credits <= 0 OR jsonb_array_length(COALESCE(v_service_balance_map, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Plano sem créditos por serviço configurados';
  END IF;

  SELECT COALESCE(
    jsonb_agg(jsonb_set(entry.value, '{available}', to_jsonb(0)) ORDER BY entry.ordinality),
    '[]'::jsonb
  )
  INTO v_service_balance_map
  FROM jsonb_array_elements(COALESCE(v_service_balance_map, '[]'::jsonb)) WITH ORDINALITY AS entry(value, ordinality);

  v_cycle_end := (p_next_billing_date::TIMESTAMP + time '12:00')::TIMESTAMPTZ;

  SELECT *
  INTO v_existing_subscription
  FROM public.customer_subscriptions cs
  WHERE cs.tenant_id = p_tenant_id
    AND cs.client_id = p_client_id
    AND cs.status = 'active'
  ORDER BY cs.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF NOT p_replace_existing THEN
      RAISE EXCEPTION 'Cliente já possui assinatura ativa';
    END IF;

    UPDATE public.customer_subscriptions
    SET
      plan_id = p_plan_id,
      status = 'active',
      cycle_start = v_cycle_start,
      cycle_end = v_cycle_end,
      next_billing_date = p_next_billing_date,
      canceled_at = NULL,
      updated_at = now()
    WHERE id = v_existing_subscription.id
    RETURNING * INTO v_subscription;
  ELSE
    INSERT INTO public.customer_subscriptions (
      tenant_id,
      client_id,
      plan_id,
      status,
      started_at,
      cycle_start,
      cycle_end,
      next_billing_date
    )
    VALUES (
      p_tenant_id,
      p_client_id,
      p_plan_id,
      'active',
      v_cycle_start,
      v_cycle_start,
      v_cycle_end,
      p_next_billing_date
    )
    RETURNING * INTO v_subscription;
  END IF;

  INSERT INTO public.customer_credits (
    tenant_id,
    client_id,
    subscription_id,
    available_credits,
    used_credits,
    service_balance_map,
    period_start,
    period_end
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    v_subscription.id,
    0,
    0,
    v_service_balance_map,
    v_subscription.cycle_start,
    v_subscription.cycle_end
  )
  ON CONFLICT (subscription_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    client_id = EXCLUDED.client_id,
    available_credits = 0,
    used_credits = 0,
    service_balance_map = EXCLUDED.service_balance_map,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = now();

  v_receivable_id := public.ensure_club_receivable_for_cycle(
    v_subscription.id,
    v_subscription.cycle_start,
    v_subscription.cycle_end,
    v_subscription.cycle_start::DATE
  );

  RETURN jsonb_build_object(
    'subscription', to_jsonb(v_subscription),
    'receivable_id', v_receivable_id,
    'credits', (
      SELECT to_jsonb(cc)
      FROM public.customer_credits cc
      WHERE cc.subscription_id = v_subscription.id
      LIMIT 1
    )
  );
END;
$$;


ALTER FUNCTION "public"."create_chef_club_subscription"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_next_billing_date" "date", "p_replace_existing" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_customer_subscription_with_credits"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_client_exists BOOLEAN;
    v_plan_record RECORD;
    v_existing_sub BOOLEAN;
    v_sub_id UUID;
    v_credits_id UUID;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_days INTEGER;
BEGIN
    IF p_tenant_id IS NULL OR p_client_id IS NULL OR p_plan_id IS NULL THEN
        RAISE EXCEPTION 'Tenant, cliente e plano são obrigatórios';
    END IF;
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    SELECT EXISTS(SELECT 1 FROM public.clients WHERE id = p_client_id AND tenant_id = p_tenant_id) INTO v_client_exists;
    IF NOT v_client_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cliente não encontrado neste tenant');
    END IF;
    SELECT id, name, monthly_price, service_credits, service_credit_map, credit_validity_days, active
    INTO v_plan_record
    FROM public.customer_plans
    WHERE id = p_plan_id AND tenant_id = p_tenant_id;
    IF v_plan_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Plano não encontrado neste tenant');
    END IF;
    IF NOT COALESCE(v_plan_record.active, false) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Plano não está ativo');
    END IF;
    SELECT EXISTS(
        SELECT 1 FROM public.customer_subscriptions
        WHERE client_id = p_client_id AND tenant_id = p_tenant_id
        AND status IN ('active', 'paused', 'past_due')
    ) INTO v_existing_sub;
    IF v_existing_sub THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cliente já possui uma assinatura ativa ou pausada');
    END IF;
    v_start := COALESCE(p_start_date, now());
    v_days := COALESCE(v_plan_record.credit_validity_days, 30);
    v_end := v_start + (v_days || ' days')::interval;
    INSERT INTO public.customer_subscriptions (
        tenant_id, client_id, plan_id, status,
        started_at, cycle_start, cycle_end, next_billing_date,
        created_at, updated_at
    ) VALUES (
        p_tenant_id, p_client_id, p_plan_id, 'active',
        v_start, v_start, v_end, v_end::date,
        now(), now()
    ) RETURNING id INTO v_sub_id;
    INSERT INTO public.customer_credits (
        tenant_id, subscription_id, client_id,
        available_credits, used_credits,
        period_start, period_end,
        created_at, updated_at
    ) VALUES (
        p_tenant_id, v_sub_id, p_client_id,
        COALESCE(v_plan_record.service_credits, 0), 0,
        v_start, v_end,
        now(), now()
    ) RETURNING id INTO v_credits_id;
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Assinatura criada com sucesso!',
        'subscription_id', v_sub_id,
        'credits_id', v_credits_id,
        'plan_id', p_plan_id,
        'client_id', p_client_id,
        'cycle_start', v_start,
        'cycle_end', v_end
    );
END;
$$;


ALTER FUNCTION "public"."create_customer_subscription_with_credits"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_start_date" timestamp with time zone, "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_internal_notification"("p_tenant_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_type" "text" DEFAULT NULL::"text", "p_title" "text" DEFAULT NULL::"text", "p_message" "text" DEFAULT NULL::"text", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_severity" "text" DEFAULT 'info'::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_user_id UUID;
  v_inserted_id UUID;
  v_first_id UUID;
  v_metadata JSONB := COALESCE(p_metadata, '{}'::jsonb);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL OR p_type IS NULL OR NULLIF(BTRIM(p_title), '') IS NULL OR NULLIF(BTRIM(p_message), '') IS NULL THEN
    RAISE EXCEPTION 'Dados obrigatorios de notificacao ausentes';
  END IF;

  IF p_type NOT IN (
    'comanda_aberta',
    'estoque_baixo',
    'pagamento_a_realizar',
    'cobranca_clube_chefes',
    'proximo_cliente',
    'cliente_atrasado'
  ) THEN
    RAISE EXCEPTION 'Tipo de notificacao invalido: %', p_type;
  END IF;

  IF COALESCE(p_severity, 'info') NOT IN ('info', 'warning', 'critical') THEN
    RAISE EXCEPTION 'Severidade invalida: %', p_severity;
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido para notificacao';
  END IF;

  FOR v_user_id IN
    SELECT DISTINCT candidate.user_id
    FROM (
      SELECT p.id AS user_id
      FROM public.profiles p
      WHERE p.tenant_id = p_tenant_id
        AND COALESCE(lower(p.status), 'active') = 'active'
    ) candidate
    WHERE (p_user_id IS NULL OR candidate.user_id = p_user_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.notification_preferences pref
        WHERE pref.tenant_id = p_tenant_id
          AND pref.user_id = candidate.user_id
          AND pref.type = p_type
          AND pref.enabled = false
      )
  LOOP
    INSERT INTO public.notifications (
      tenant_id,
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      severity,
      status,
      metadata,
      created_at
    )
    VALUES (
      p_tenant_id,
      v_user_id,
      p_type,
      BTRIM(p_title),
      BTRIM(p_message),
      NULLIF(BTRIM(p_entity_type), ''),
      p_entity_id,
      COALESCE(p_severity, 'info'),
      'unread',
      v_metadata,
      now()
    )
    ON CONFLICT (
      tenant_id,
      type,
      (COALESCE(entity_type, '')),
      (COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid)),
      (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
    WHERE status = 'unread'
    DO UPDATE SET
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      severity = EXCLUDED.severity,
      metadata = EXCLUDED.metadata,
      created_at = now()
    RETURNING id INTO v_inserted_id;

    v_first_id := COALESCE(v_first_id, v_inserted_id);
  END LOOP;

  RETURN v_first_id;
END;
$$;


ALTER FUNCTION "public"."create_internal_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_severity" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_is_super_admin_from_auth_uid"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.role, '')) IN ('super admin', 'superadmin')
  );
$$;


ALTER FUNCTION "public"."current_is_super_admin_from_auth_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id_from_auth_uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1),
    (SELECT s.tenant_id FROM public.staff s WHERE s.id = auth.uid() LIMIT 1)
  );
$$;


ALTER FUNCTION "public"."current_tenant_id_from_auth_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_tenant_id_managers"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;


ALTER FUNCTION "public"."current_tenant_id_managers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_amount" integer, "p_reference" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_rows integer;
  v_schema text;
  v_tenant_id uuid;
  v_credit_update_sql text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT resolved.schema_name, resolved.tenant_id
  INTO v_schema, v_tenant_id
  FROM public.resolve_credit_runtime_schema(p_subscription_id) AS resolved;

  IF v_schema IS NULL OR v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Insufficient credits or subscription not found';
  END IF;

  v_credit_update_sql := CASE
    WHEN public.table_has_column(v_schema, 'customer_credits', 'updated_at') THEN
      format(
        'UPDATE %I.customer_credits
         SET available_credits = available_credits - $1,
             used_credits = used_credits + $1,
             updated_at = now()
         WHERE subscription_id = $2
           AND tenant_id = $3
           AND available_credits >= $1',
        v_schema
      )
    ELSE
      format(
        'UPDATE %I.customer_credits
         SET available_credits = available_credits - $1,
             used_credits = used_credits + $1
         WHERE subscription_id = $2
           AND tenant_id = $3
           AND available_credits >= $1',
        v_schema
      )
  END;

  EXECUTE v_credit_update_sql
  USING p_amount, p_subscription_id, v_tenant_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Insufficient credits or subscription not found';
  END IF;
END;
$_$;


ALTER FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_amount" integer, "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_service_id" "uuid" DEFAULT NULL::"uuid", "p_amount" integer DEFAULT 1, "p_reference" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_credit_record public.customer_credits%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_rows INTEGER;
  v_balance_index INTEGER;
  v_balance JSONB;
  v_available INTEGER;
  v_used INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_subscription.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_subscriptions cs
    JOIN public.customer_subscription_receivables csr
      ON csr.subscription_id = cs.id
     AND csr.tenant_id = cs.tenant_id
    WHERE cs.id = p_subscription_id
      AND cs.tenant_id = v_subscription.tenant_id
      AND cs.status = 'active'
      AND csr.status = 'paid'
      AND csr.transaction_id IS NOT NULL
      AND now() >= csr.billing_cycle_start
      AND now() <= csr.billing_cycle_end
  ) THEN
    RAISE EXCEPTION 'Clube sem ciclo pago vigente';
  END IF;

  IF p_service_id IS NULL THEN
    UPDATE public.customer_credits
    SET
      available_credits = available_credits - p_amount,
      used_credits = used_credits + p_amount,
      updated_at = now()
    WHERE subscription_id = p_subscription_id
      AND tenant_id = v_subscription.tenant_id
      AND available_credits >= p_amount;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Insufficient credits or subscription not found';
    END IF;

    RETURN;
  END IF;

  SELECT *
  INTO v_credit_record
  FROM public.customer_credits
  WHERE subscription_id = p_subscription_id
    AND tenant_id = v_subscription.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription credits not found';
  END IF;

  SELECT ordinality - 1, value
  INTO v_balance_index, v_balance
  FROM jsonb_array_elements(COALESCE(v_credit_record.service_balance_map, '[]'::jsonb)) WITH ORDINALITY AS entries(value, ordinality)
  WHERE value ->> 'service_id' = p_service_id::text
  LIMIT 1;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No credits configured for this service';
  END IF;

  v_available := COALESCE((v_balance ->> 'available')::INTEGER, 0);
  v_used := COALESCE((v_balance ->> 'used')::INTEGER, 0);

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits for this service';
  END IF;

  v_balance := jsonb_set(v_balance, '{available}', to_jsonb(v_available - p_amount));
  v_balance := jsonb_set(v_balance, '{used}', to_jsonb(v_used + p_amount));

  UPDATE public.customer_credits
  SET
    available_credits = GREATEST(0, available_credits - p_amount),
    used_credits = used_credits + p_amount,
    service_balance_map = jsonb_set(
      COALESCE(service_balance_map, '[]'::jsonb),
      ARRAY[v_balance_index::text],
      v_balance,
      false
    ),
    updated_at = now()
  WHERE id = v_credit_record.id;
END;
$$;


ALTER FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_service_id" "uuid", "p_amount" integer, "p_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_no_show_appointments"("p_tenant_id" "uuid", "p_grace_minutes" integer DEFAULT 15) RETURNS TABLE("appointment_id" "uuid", "client_name" "text", "start_time" timestamp with time zone, "minutes_late" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_threshold TIMESTAMPTZ;
BEGIN
  v_now := NOW();
  v_threshold := v_now - (p_grace_minutes || ' minutes')::INTERVAL;
  
  -- Update appointments that are past the grace period
  UPDATE public.appointments
  SET 
    status = 'no_show',
    cancellation_reason = 'no_show',
    cancelled_at = v_now
  WHERE 
    tenant_id = p_tenant_id
    AND status IN ('pending', 'confirmed')
    AND start_time < v_threshold
    AND cancelled_at IS NULL;
  
  -- Return the updated appointments
  RETURN QUERY
  SELECT 
    apt.id,
    apt.client_name,
    apt.start_time,
    EXTRACT(EPOCH FROM (v_now - apt.start_time)) / 60 AS minutes_late
  FROM public.appointments apt
  WHERE 
    apt.tenant_id = p_tenant_id
    AND apt.status = 'no_show'
    AND apt.cancelled_at >= v_now - INTERVAL '1 minute';
END;
$$;


ALTER FUNCTION "public"."detect_no_show_appointments"("p_tenant_id" "uuid", "p_grace_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_no_show_appointments"("p_tenant_id" "uuid", "p_grace_minutes" integer) IS 'Detects appointments that have passed the grace period without check-in and marks them as no_show.
Parameters:
  p_tenant_id: UUID - The tenant ID to filter appointments
  p_grace_minutes: INTEGER - Minutes after start_time to consider as no_show (default 15)
Returns: Table with detected no-show appointments';



CREATE OR REPLACE FUNCTION "public"."ensure_club_receivable_for_cycle"("p_subscription_id" "uuid", "p_billing_cycle_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_billing_cycle_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_due_date" "date" DEFAULT NULL::"date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_plan public.customer_plans%ROWTYPE;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_due_date DATE;
  v_receivable_id UUID;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_subscription.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = v_subscription.plan_id
    AND tenant_id = v_subscription.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano da assinatura não encontrado';
  END IF;

  v_cycle_start := COALESCE(p_billing_cycle_start, v_subscription.cycle_start);
  v_cycle_end := COALESCE(
    p_billing_cycle_end,
    CASE
      WHEN v_subscription.cycle_end > v_cycle_start THEN v_subscription.cycle_end
      ELSE v_cycle_start + interval '1 month'
    END
  );
  v_due_date := COALESCE(p_due_date, v_cycle_start::DATE);

  INSERT INTO public.customer_subscription_receivables (
    tenant_id,
    customer_id,
    subscription_id,
    plan_id,
    billing_cycle_start,
    billing_cycle_end,
    due_date,
    amount,
    status
  )
  VALUES (
    v_subscription.tenant_id,
    v_subscription.client_id,
    v_subscription.id,
    v_subscription.plan_id,
    v_cycle_start,
    v_cycle_end,
    v_due_date,
    COALESCE(v_plan.monthly_price, 0),
    CASE WHEN v_due_date < current_date THEN 'overdue' ELSE 'pending' END
  )
  ON CONFLICT (subscription_id, billing_cycle_start, billing_cycle_end) DO UPDATE
  SET
    plan_id = EXCLUDED.plan_id,
    amount = EXCLUDED.amount,
    due_date = EXCLUDED.due_date,
    status = CASE
      WHEN public.customer_subscription_receivables.status = 'pending'
        AND EXCLUDED.due_date < current_date THEN 'overdue'
      ELSE public.customer_subscription_receivables.status
    END,
    updated_at = now()
  RETURNING id INTO v_receivable_id;

  RETURN v_receivable_id;
END;
$$;


ALTER FUNCTION "public"."ensure_club_receivable_for_cycle"("p_subscription_id" "uuid", "p_billing_cycle_start" timestamp with time zone, "p_billing_cycle_end" timestamp with time zone, "p_due_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_reverse_transaction"("p_tenant_id" "uuid", "p_original_transaction_id" "uuid", "p_reversal_type" "text", "p_amount" numeric, "p_reason_type" "text", "p_reason_note" "text", "p_refund_method" "text" DEFAULT NULL::"text", "p_reversal_date" timestamp with time zone DEFAULT "now"(), "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_access_role TEXT;
  v_membership_role TEXT;
  v_has_authorized_membership BOOLEAN := false;
  v_original public.transactions%ROWTYPE;
  v_reversal_id UUID;
  v_reversal_transaction_id UUID;
  v_existing_original_transaction_id UUID;
  v_reversed_amount NUMERIC := 0;
  v_available_amount NUMERIC := 0;
  v_reversal_date TIMESTAMPTZ := COALESCE(p_reversal_date, now());
  v_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_reversal_type TEXT := NULLIF(BTRIM(COALESCE(p_reversal_type, '')), '');
  v_reason_type TEXT := NULLIF(BTRIM(COALESCE(p_reason_type, '')), '');
  v_reason_note TEXT := NULLIF(BTRIM(COALESCE(p_reason_note, '')), '');
  v_refund_method TEXT := NULLIF(BTRIM(COALESCE(p_refund_method, '')), '');
  v_category TEXT;
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_original_transaction_id IS NULL THEN RAISE EXCEPTION 'transaction original obrigatoria'; END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor de reversao deve ser maior que zero'; END IF;
  IF v_reversal_type IS NULL THEN RAISE EXCEPTION 'Tipo de reversao obrigatorio'; END IF;
  IF v_reason_type IS NULL THEN RAISE EXCEPTION 'Motivo obrigatorio'; END IF;
  IF v_reason_note IS NULL THEN RAISE EXCEPTION 'Observacao obrigatoria'; END IF;
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;
  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p WHERE p.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;
  v_has_authorized_membership := COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'), false);
  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT v_has_authorized_membership THEN
    RAISE EXCEPTION 'Usuario sem permissao para reversao financeira';
  END IF;
  IF NOT COALESCE(v_is_super_admin, false) AND NOT v_has_authorized_membership
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant nao autorizado';
  END IF;
  IF v_key IS NOT NULL THEN
    SELECT fr.id, fr.reversal_transaction_id, fr.original_transaction_id
    INTO v_reversal_id, v_reversal_transaction_id, v_existing_original_transaction_id
    FROM public.financial_reversals fr
    WHERE fr.tenant_id = p_tenant_id AND fr.idempotency_key = v_key LIMIT 1;
    IF FOUND THEN
      IF v_existing_original_transaction_id IS DISTINCT FROM p_original_transaction_id THEN
        RAISE EXCEPTION 'Chave de idempotencia ja utilizada em outra reversao';
      END IF;
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'financial_reversal_id', v_reversal_id, 'reversal_transaction_id', v_reversal_transaction_id, 'message', 'Reversao ja processada anteriormente.');
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('finance_reverse_transaction:' || p_tenant_id::text || ':' || p_original_transaction_id::text));
  SELECT * INTO v_original FROM public.transactions t
  WHERE t.id = p_original_transaction_id AND t.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transacao original nao encontrada para este tenant'; END IF;
  IF v_original.type IS DISTINCT FROM 'income' THEN RAISE EXCEPTION 'Somente receitas podem ser revertidas nesta versao'; END IF;
  IF COALESCE(v_original.status, 'paid') <> 'paid' THEN RAISE EXCEPTION 'Transacao original nao esta paga'; END IF;
  SELECT COALESCE(SUM(fr.amount), 0) INTO v_reversed_amount
  FROM public.financial_reversals fr
  WHERE fr.tenant_id = p_tenant_id AND fr.original_transaction_id = p_original_transaction_id;
  v_available_amount := COALESCE(v_original.amount, 0) - v_reversed_amount;
  IF p_amount > v_available_amount THEN RAISE EXCEPTION 'Valor de reversao excede saldo disponivel'; END IF;
  v_category := CASE
    WHEN v_original.source_type = 'comanda' AND v_reversal_type IN ('full_refund', 'partial_refund') THEN 'Devolucao de Comanda'
    WHEN v_original.source_type = 'comanda' THEN 'Estorno de Comanda'
    ELSE 'Estorno Financeiro'
  END;
  INSERT INTO public.transactions (tenant_id, user_id, type, category, description, amount, payment_method, date, status, notes, source_type, source_id, idempotency_key, metadata)
  VALUES (p_tenant_id, v_auth_uid, 'expense', v_category, 'Reversao da transacao ' || p_original_transaction_id::text, p_amount, COALESCE(v_refund_method, v_original.payment_method), v_reversal_date, 'paid', v_reason_note, v_original.source_type, v_original.source_id, v_key,
    jsonb_build_object('original_transaction_id', p_original_transaction_id, 'reversal_type', v_reversal_type, 'reason_type', v_reason_type, 'reason_note', v_reason_note, 'amount', p_amount, 'reversal_date', v_reversal_date, 'idempotency_key', v_key, 'available_before', v_available_amount))
  RETURNING id INTO v_reversal_transaction_id;
  INSERT INTO public.financial_reversals (tenant_id, original_transaction_id, reversal_transaction_id, source_type, source_id, reversal_type, amount, reason_type, reason_note, refund_method, idempotency_key, created_by_user_id, metadata)
  VALUES (p_tenant_id, p_original_transaction_id, v_reversal_transaction_id, v_original.source_type, v_original.source_id, v_reversal_type, p_amount, v_reason_type, v_reason_note, v_refund_method, v_key, v_auth_uid,
    jsonb_build_object('original_amount', v_original.amount, 'available_before', v_available_amount, 'reversal_date', v_reversal_date))
  RETURNING id INTO v_reversal_id;
  IF v_original.source_type = 'comanda' AND v_reversal_type = 'wrong_settlement' AND p_amount >= COALESCE(v_original.amount, 0) THEN
    UPDATE public.comandas SET status = 'open', payment_method = NULL, payment_date_real = NULL, settled_at = NULL, settled_by_user_id = NULL, closed_at = NULL, financial_effect = false
    WHERE id = v_original.source_id AND tenant_id = p_tenant_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'financial_reversal_id', v_reversal_id, 'original_transaction_id', p_original_transaction_id, 'reversal_transaction_id', v_reversal_transaction_id, 'message', 'Reversao financeira registrada com sucesso.');
END;
$$;


ALTER FUNCTION "public"."finance_reverse_transaction"("p_tenant_id" "uuid", "p_original_transaction_id" "uuid", "p_reversal_type" "text", "p_amount" numeric, "p_reason_type" "text", "p_reason_note" "text", "p_refund_method" "text", "p_reversal_date" timestamp with time zone, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finance_settle_comanda"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_payment_method" "text", "p_paid_amount" numeric, "p_payment_date_real" timestamp with time zone DEFAULT "now"(), "p_source" "text" DEFAULT 'checkout'::"text", "p_notes" "text" DEFAULT NULL::"text", "p_idempotency_key" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_access_role TEXT;
  v_membership_role TEXT;
  v_has_authorized_membership BOOLEAN := false;
  v_comanda public.comandas%ROWTYPE;
  v_existing_transaction public.transactions%ROWTYPE;
  v_transaction_id UUID;
  v_payment_date_real TIMESTAMPTZ := COALESCE(p_payment_date_real, now());
  v_settled_at TIMESTAMPTZ := now();
  v_source TEXT := NULLIF(BTRIM(COALESCE(p_source, '')), '');
  v_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_idempotency_key TEXT := NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '');
  v_payment_method TEXT := NULLIF(BTRIM(COALESCE(p_payment_method, '')), '');
BEGIN
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuário autenticado obrigatório'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatório'; END IF;
  IF v_payment_method IS NULL THEN RAISE EXCEPTION 'Forma de pagamento obrigatória'; END IF;
  IF COALESCE(p_paid_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor pago deve ser maior que zero'; END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;
  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p WHERE p.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;
  v_has_authorized_membership := COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin'), false);

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     AND NOT COALESCE(v_has_authorized_membership, false) THEN
    RAISE EXCEPTION 'Usuário sem permissão para baixa financeira central';
  END IF;
  IF NOT COALESCE(v_is_super_admin, false)
     AND NOT COALESCE(v_has_authorized_membership, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.idempotency_key = v_idempotency_key LIMIT 1;
    IF FOUND THEN
      IF v_existing_transaction.source_type IS DISTINCT FROM 'comanda'
         OR v_existing_transaction.source_id IS DISTINCT FROM p_comanda_id THEN
        RAISE EXCEPTION 'Chave de idempotência já utilizada em outro lançamento';
      END IF;
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'comanda_id', v_existing_transaction.source_id, 'transaction_id', v_existing_transaction.id, 'status', 'paid', 'message', 'Baixa já processada anteriormente. Transação original retornada.');
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('finance_settle_comanda:' || p_tenant_id::text || ':' || p_comanda_id::text));
  SELECT * INTO v_comanda FROM public.comandas c
  WHERE c.id = p_comanda_id AND c.tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada para este tenant'; END IF;

  IF v_comanda.status = 'paid' THEN
    SELECT * INTO v_existing_transaction FROM public.transactions t
    WHERE t.tenant_id = p_tenant_id AND t.source_type = 'comanda' AND t.source_id = p_comanda_id
      AND t.idempotency_key = v_idempotency_key AND t.type = 'income' AND COALESCE(t.status, 'paid') = 'paid'
    ORDER BY t.date DESC, t.id DESC LIMIT 1;
    IF FOUND AND v_idempotency_key IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'comanda_id', p_comanda_id, 'transaction_id', v_existing_transaction.id, 'status', 'paid', 'message', 'Comanda já estava baixada. Transação existente retornada.');
    END IF;
    RAISE EXCEPTION 'Comanda já está baixada';
  END IF;
  IF v_comanda.status NOT IN ('open', 'blocked') THEN RAISE EXCEPTION 'Comanda não pode ser baixada no status atual: %', v_comanda.status; END IF;

  UPDATE public.comandas SET status = 'paid', payment_method = v_payment_method,
    closure_mode = COALESCE(NULLIF(closure_mode, ''), 'standard'), financial_effect = true,
    payment_date_real = v_payment_date_real, settled_at = v_settled_at,
    settled_by_user_id = v_auth_uid, closed_at = v_payment_date_real
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id;

  INSERT INTO public.transactions (tenant_id, user_id, type, category, description, amount, payment_method, date, status, notes, source_type, source_id, idempotency_key, metadata)
  VALUES (p_tenant_id, v_auth_uid, 'income', 'Receita de Comanda',
    'Baixa financeira de comanda ' || p_comanda_id::text || ' via ' || COALESCE(v_source, 'financeiro'),
    p_paid_amount, v_payment_method, v_payment_date_real, 'paid', v_notes, 'comanda', p_comanda_id, v_idempotency_key,
    jsonb_build_object('source', COALESCE(v_source, 'financeiro'), 'comanda_id', p_comanda_id, 'tenant_id', p_tenant_id, 'comanda_total', COALESCE(v_comanda.total, 0), 'paid_amount', p_paid_amount, 'amount_difference', p_paid_amount - COALESCE(v_comanda.total, 0), 'payment_date_real', v_payment_date_real, 'settled_at', v_settled_at, 'settled_by_user_id', v_auth_uid, 'notes', v_notes, 'idempotency_key', v_idempotency_key))
  RETURNING id INTO v_transaction_id;

  IF v_comanda.appointment_id IS NOT NULL THEN
    UPDATE public.appointments SET status = 'completed'
    WHERE id = v_comanda.appointment_id AND tenant_id = p_tenant_id AND status <> 'completed';
  END IF;
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'comanda_id', p_comanda_id, 'transaction_id', v_transaction_id, 'status', 'paid', 'message', 'Baixa financeira registrada com sucesso.');
END;
$$;


ALTER FUNCTION "public"."finance_settle_comanda"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_payment_method" "text", "p_paid_amount" numeric, "p_payment_date_real" timestamp with time zone, "p_source" "text", "p_notes" "text", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_club_receivables"("p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_target_tenant_id UUID;
  v_subscription RECORD;
  v_count INTEGER := 0;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  v_target_tenant_id := COALESCE(p_tenant_id, v_auth_tenant_id);

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  FOR v_subscription IN
    SELECT cs.id
    FROM public.customer_subscriptions cs
    WHERE cs.tenant_id = v_target_tenant_id
      AND cs.status IN ('active', 'past_due')
  LOOP
    PERFORM public.ensure_club_receivable_for_cycle(v_subscription.id);
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.customer_subscription_receivables
  SET status = 'overdue', updated_at = now()
  WHERE tenant_id = v_target_tenant_id
    AND status = 'pending'
    AND due_date < current_date;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."generate_club_receivables"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_system_notifications"("p_tenant_id" "uuid" DEFAULT NULL::"uuid", "p_upcoming_minutes" integer DEFAULT 60, "p_billing_days" integer DEFAULT 3) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_count INTEGER := 0;
  v_row RECORD;
  v_due_date DATE;
  v_due_day INTEGER;
  v_generated_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_tenant_id, v_is_super_admin;

  v_tenant_id := COALESCE(p_tenant_id, v_tenant_id);

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false) AND v_tenant_id <> public.current_tenant_id_from_auth_uid() THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  FOR v_row IN
    SELECT id, name, stock_quantity, minimum_stock
    FROM public.products
    WHERE tenant_id = v_tenant_id
      AND COALESCE(active, true) = true
      AND COALESCE(stock_quantity, 0) <= COALESCE(minimum_stock, 0)
      AND COALESCE(minimum_stock, 0) >= 0
  LOOP
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'estoque_baixo',
      'Estoque baixo',
      'O produto ' || v_row.name || ' está com estoque abaixo do mínimo.',
      'products',
      v_row.id,
      CASE WHEN COALESCE(v_row.stock_quantity, 0) <= 0 THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('stock_quantity', v_row.stock_quantity, 'minimum_stock', v_row.minimum_stock)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;

  FOR v_row IN
    SELECT id, description, amount, date, status, to_jsonb(t) AS payload
    FROM public.transactions t
    WHERE tenant_id = v_tenant_id
      AND type IN ('expense', 'recurring')
      AND lower(COALESCE(status, 'pending')) IN ('pending', 'overdue')
  LOOP
    v_due_date := NULL;
    v_due_day := NULLIF(v_row.payload->>'due_day', '')::integer;

    IF v_row.date IS NOT NULL THEN
      v_due_date := v_row.date::date;
    ELSIF v_due_day IS NOT NULL THEN
      v_due_date := make_date(EXTRACT(YEAR FROM current_date)::integer, EXTRACT(MONTH FROM current_date)::integer, LEAST(GREATEST(v_due_day, 1), 28));
    END IF;

    IF v_due_date IS NOT NULL AND v_due_date <= current_date + GREATEST(COALESCE(p_billing_days, 3), 0) THEN
      SELECT public.create_internal_notification(
        v_tenant_id,
        NULL,
        'pagamento_a_realizar',
        CASE WHEN v_due_date < current_date THEN 'Pagamento vencido' ELSE 'Pagamento a realizar' END,
        'Existe um pagamento de R$ ' || to_char(COALESCE(v_row.amount, 0), 'FM999G999G990D00') || ' com vencimento em ' || to_char(v_due_date, 'DD/MM/YYYY') || '.',
        'transactions',
        v_row.id,
        CASE WHEN v_due_date < current_date OR lower(COALESCE(v_row.status, '')) = 'overdue' THEN 'critical' ELSE 'warning' END,
        jsonb_build_object('due_date', v_due_date, 'amount', v_row.amount, 'status', v_row.status)
      ) INTO v_generated_id;
      IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT
      cs.id,
      cs.status,
      cs.next_billing_date,
      c.name AS client_name,
      cp.monthly_price
    FROM public.customer_subscriptions cs
    JOIN public.clients c ON c.id = cs.client_id AND c.tenant_id = cs.tenant_id
    LEFT JOIN public.customer_plans cp ON cp.id = cs.plan_id AND cp.tenant_id = cs.tenant_id
    WHERE cs.tenant_id = v_tenant_id
      AND (
        cs.status = 'past_due'
        OR (
          cs.status = 'active'
          AND cs.next_billing_date <= current_date + GREATEST(COALESCE(p_billing_days, 3), 0)
        )
      )
  LOOP
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'cobranca_clube_chefes',
      'Cobrança do Clube dos Chefes',
      'O cliente ' || COALESCE(v_row.client_name, 'sem nome') || ' possui uma cobrança ' ||
        CASE
          WHEN v_row.status = 'past_due' OR v_row.next_billing_date < current_date THEN 'vencida'
          WHEN v_row.next_billing_date = current_date THEN 'vencendo hoje'
          ELSE 'pendente'
        END || ' no Clube dos Chefes.',
      'customer_subscriptions',
      v_row.id,
      CASE WHEN v_row.status = 'past_due' OR v_row.next_billing_date < current_date THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('next_billing_date', v_row.next_billing_date, 'status', v_row.status, 'monthly_price', v_row.monthly_price)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;

  SELECT a.*
  INTO v_row
  FROM public.appointments a
  WHERE a.tenant_id = v_tenant_id
    AND lower(COALESCE(a.status, 'pending')) IN ('pending', 'confirmed')
    AND COALESCE(a.hidden_from_schedule, false) = false
    AND a.start_time >= now()
    AND a.start_time <= now() + (GREATEST(COALESCE(p_upcoming_minutes, 60), 1) || ' minutes')::interval
  ORDER BY a.start_time ASC
  LIMIT 1;

  IF FOUND THEN
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'proximo_cliente',
      'Próximo cliente',
      'O próximo cliente a ser atendido é ' || COALESCE(v_row.client_name, 'sem nome') || ', às ' || to_char(v_row.start_time AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.',
      'appointments',
      v_row.id,
      'info',
      jsonb_build_object('start_time', v_row.start_time, 'status', v_row.status)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END IF;

  FOR v_row IN
    SELECT id, client_name, start_time, status
    FROM public.appointments
    WHERE tenant_id = v_tenant_id
      AND lower(COALESCE(status, 'pending')) IN ('pending', 'confirmed')
      AND COALESCE(hidden_from_schedule, false) = false
      AND start_time < now()
      AND start_time >= now() - interval '1 day'
    ORDER BY start_time ASC
  LOOP
    SELECT public.create_internal_notification(
      v_tenant_id,
      NULL,
      'cliente_atrasado',
      'Cliente atrasado',
      'O cliente ' || COALESCE(v_row.client_name, 'sem nome') || ' está atrasado para o atendimento das ' || to_char(v_row.start_time AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.',
      'appointments',
      v_row.id,
      CASE WHEN v_row.start_time < now() - interval '30 minutes' THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('start_time', v_row.start_time, 'status', v_row.status)
    ) INTO v_generated_id;
    IF v_generated_id IS NOT NULL THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('generated', v_count, 'tenant_id', v_tenant_id);
END;
$_$;


ALTER FUNCTION "public"."generate_system_notifications"("p_tenant_id" "uuid", "p_upcoming_minutes" integer, "p_billing_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_auth_access_context"() RETURNS TABLE("tenant_id" "uuid", "access_role" "text", "profile_status" "text", "is_super_admin" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  profile_row RECORD;
  staff_row RECORD;
  normalized_role text;
BEGIN
  SELECT p.tenant_id, p.role, p.status
  INTO profile_row
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  SELECT s.tenant_id, s.role, s.status
  INTO staff_row
  FROM public.staff s
  WHERE s.id = auth.uid()
  LIMIT 1;

  tenant_id := COALESCE(profile_row.tenant_id, staff_row.tenant_id);
  normalized_role := lower(coalesce(profile_row.role, staff_row.role, ''));
  is_super_admin := normalized_role IN ('super admin', 'superadmin');

  IF is_super_admin THEN
    access_role := 'superadmin';
  ELSIF normalized_role IN ('manager', 'gerente', 'owner', 'admin') THEN
    access_role := 'manager';
  ELSIF normalized_role = 'receptionist' THEN
    access_role := 'receptionist';
  ELSIF normalized_role = 'barber' THEN
    access_role := 'barber';
  ELSE
    access_role := 'unknown';
  END IF;

  profile_status := COALESCE(profile_row.status, staff_row.status);
  IF profile_status IS NULL AND is_super_admin THEN
    profile_status := 'active';
  END IF;
  IF profile_status IS NULL AND access_role IN ('manager', 'barber', 'receptionist') THEN
    profile_status := 'active';
  END IF;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_auth_access_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_usage_history"("p_tenant_id" "uuid", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_subscription_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "client_id" "uuid", "subscription_id" "uuid", "plan_id" "uuid", "service_id" "uuid", "service_name" "text", "comanda_id" "uuid", "comanda_item_id" "uuid", "professional_id" "uuid", "professional_name" "text", "credit_key" "text", "quantity_used" integer, "original_price" numeric, "credit_effect" numeric, "used_at" timestamp with time zone, "created_by" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.client_id, u.subscription_id, u.plan_id, u.service_id,
        COALESCE(s.name, u.credit_key), u.comanda_id, u.comanda_item_id, u.professional_id,
        COALESCE(st.name, 'N/A'), u.credit_key, u.quantity_used, u.original_price,
        u.credit_effect, u.used_at, u.created_by
    FROM public.customer_plan_credit_usages u
    LEFT JOIN public.services s ON s.id = u.service_id
    LEFT JOIN public.staff st ON st.id = u.professional_id
    WHERE u.tenant_id = p_tenant_id
      AND (p_client_id IS NULL OR u.client_id = p_client_id)
      AND (p_subscription_id IS NULL OR u.subscription_id = p_subscription_id)
    ORDER BY u.used_at DESC LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_credit_usage_history"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_subscription_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_subscription_credits"("p_subscription_id" "uuid", "p_tenant_id" "uuid") RETURNS TABLE("id" "uuid", "available_credits" numeric, "used_credits" numeric, "service_balance_map" "jsonb", "period_start" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT cc.id, cc.available_credits, cc.used_credits, cc.service_balance_map, cc.period_start
  FROM public.customer_credits cc
  WHERE cc.subscription_id = p_subscription_id AND cc.tenant_id = p_tenant_id
  ORDER BY cc.period_start DESC LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_current_subscription_credits"("p_subscription_id" "uuid", "p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_current_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_plan_status"("p_tenant_id" "uuid", "p_client_id" "uuid") RETURNS TABLE("has_active_subscription" boolean, "subscription_id" "uuid", "plan_id" "uuid", "plan_name" "text", "plan_monthly_price" numeric, "status" "text", "cycle_start" timestamp with time zone, "cycle_end" timestamp with time zone, "total_credits" integer, "used_credits" integer, "available_credits" integer, "service_credits" "jsonb", "services_eligible" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH active_sub AS (
        SELECT cs.id, cs.plan_id, cs.status, cs.cycle_start, cs.cycle_end,
               cp.service_credit_map
        FROM public.customer_subscriptions cs
        JOIN public.customer_plans cp ON cp.id = cs.plan_id
        WHERE cs.client_id = p_client_id
          AND cs.tenant_id = p_tenant_id
          AND cs.status = 'active'
          AND cs.cycle_end >= now()
        ORDER BY cs.created_at DESC LIMIT 1
    ),
    plan_data AS (
        SELECT cp.id, cp.name, cp.monthly_price, cp.service_credit_map
        FROM public.customer_plans cp
        JOIN active_sub ac ON ac.plan_id = cp.id
        WHERE cp.active = true
    ),
    credits_data AS (
        SELECT cc.available_credits, cc.used_credits, cc.period_start, cc.period_end, cc.service_balance_map
        FROM public.customer_credits cc
        JOIN active_sub ac ON cc.subscription_id = ac.id
        WHERE cc.period_start = (SELECT cycle_start FROM active_sub LIMIT 1)
           OR cc.period_start = (SELECT MIN(period_start) FROM public.customer_credits
                                 WHERE subscription_id = (SELECT id FROM active_sub LIMIT 1))
        ORDER BY cc.period_start DESC LIMIT 1
    )
    SELECT
        CASE WHEN EXISTS (SELECT 1 FROM active_sub) THEN true ELSE false END,
        (SELECT id FROM active_sub),
        (SELECT id FROM plan_data),
        (SELECT name FROM plan_data),
        (SELECT monthly_price FROM plan_data),
        (SELECT status FROM active_sub),
        (SELECT cycle_start FROM active_sub),
        (SELECT cycle_end FROM active_sub),
        COALESCE((SELECT available_credits + used_credits FROM credits_data), 0)::INTEGER,
        COALESCE((SELECT used_credits FROM credits_data), 0)::INTEGER,
        COALESCE((SELECT available_credits FROM credits_data), 0)::INTEGER,
        COALESCE((SELECT service_credit_map FROM plan_data), '[]'::jsonb),
        COALESCE(
            (SELECT array_agg(value->>'service_name') FROM jsonb_array_elements(COALESCE((SELECT service_credit_map FROM plan_data), '[]'::jsonb)) WHERE (value->>'credits')::int > 0),
            ARRAY[]::TEXT[]
        );
END;
$$;


ALTER FUNCTION "public"."get_customer_plan_status"("p_tenant_id" "uuid", "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notification_preferences"() RETURNS TABLE("type" "text", "label" "text", "description" "text", "enabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  RETURN QUERY
  SELECT
    catalog.type,
    catalog.label,
    catalog.description,
    COALESCE(pref.enabled, true) AS enabled
  FROM public.notification_type_catalog() catalog
  LEFT JOIN public.notification_preferences pref
    ON pref.tenant_id = v_tenant_id
   AND pref.user_id = auth.uid()
   AND pref.type = catalog.type
  ORDER BY array_position(ARRAY[
    'comanda_aberta',
    'estoque_baixo',
    'pagamento_a_realizar',
    'cobranca_clube_chefes',
    'proximo_cliente',
    'cliente_atrasado'
  ], catalog.type);
END;
$$;


ALTER FUNCTION "public"."get_notification_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_role_permissions"("p_tenant_id" "uuid", "p_role" "text") RETURNS TABLE("permission_key" "text", "enabled" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT rp.permission_key, rp.enabled
  FROM public.role_permissions rp
  WHERE rp.tenant_id = p_tenant_id
    AND rp.role = p_role;
END;
$$;


ALTER FUNCTION "public"."get_role_permissions"("p_tenant_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_barber_closings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."handle_barber_closings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_manager_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
BEGIN
  -- Process only manager and superadmin profiles (account creators)
  IF NEW.role NOT IN ('manager', 'superadmin') THEN
    RETURN NEW;
  END IF;

  -- Skip if tenant_id is null
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get name and email from auth.users
  SELECT 
    COALESCE(
      NULLIF(TRIM(
        COALESCE(raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(raw_user_meta_data->>'last_name', '')
      ), ''),
      raw_user_meta_data->>'full_name',
      NEW.full_name,
      split_part(email, '@', 1)
    ),
    email
  INTO v_full_name, v_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Insert into staff only if no Manager already exists for this email+tenant
  INSERT INTO public.staff (
    name,
    email,
    phone,
    role,
    avatar,
    commission_rate,
    status,
    tenant_id
  )
  SELECT
    COALESCE(v_full_name, 'Gestor'),
    COALESCE(v_email, ''),
    '',
    'Manager',
    'https://ui-avatars.com/api/?name=' || REPLACE(COALESCE(v_full_name, 'Gestor'), ' ', '+') || '&background=0066ff&color=fff',
    0,
    'active',
    NEW.tenant_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE tenant_id = NEW.tenant_id 
    AND email = COALESCE(v_email, '')
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_manager_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT COALESCE((auth.jwt() ->> 'role') = 'super_admin', FALSE)
      OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin', FALSE);
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_internal_notifications"("p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "tenant_id" "uuid", "user_id" "uuid", "type" "text", "title" "text", "message" "text", "entity_type" "text", "entity_id" "uuid", "severity" "text", "status" "text", "read_at" timestamp with time zone, "metadata" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  RETURN QUERY
  SELECT
    n.id,
    n.tenant_id,
    n.user_id,
    n.type,
    n.title,
    n.message,
    n.entity_type,
    n.entity_id,
    n.severity,
    n.status,
    n.read_at,
    n.metadata,
    n.created_at
  FROM public.notifications n
  WHERE n.tenant_id = v_tenant_id
    AND (n.user_id IS NULL OR n.user_id = auth.uid())
    AND (p_status IS NULL OR n.status = p_status)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;


ALTER FUNCTION "public"."list_internal_notifications"("p_status" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  UPDATE public.notifications
  SET status = 'read', read_at = COALESCE(read_at, now())
  WHERE tenant_id = v_tenant_id
    AND (user_id IS NULL OR user_id = auth.uid())
    AND status = 'unread';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN COALESCE(v_count, 0);
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  UPDATE public.notifications
  SET status = 'read', read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND tenant_id = v_tenant_id
    AND (user_id IS NULL OR user_id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notification_type_catalog"() RETURNS TABLE("type" "text", "label" "text", "description" "text")
    LANGUAGE "sql" STABLE
    AS $$
  VALUES
    ('comanda_aberta', 'Comandas abertas', 'Avisar quando uma nova comanda for aberta.'),
    ('estoque_baixo', 'Estoque baixo', 'Avisar quando um produto atingir o estoque minimo.'),
    ('pagamento_a_realizar', 'Pagamentos a realizar', 'Avisar sobre contas pendentes, vencendo ou vencidas.'),
    ('cobranca_clube_chefes', 'Cobrancas do Clube dos Chefes', 'Avisar sobre mensalidades pendentes ou vencidas.'),
    ('proximo_cliente', 'Proximo cliente', 'Avisar sobre o proximo atendimento da agenda.'),
    ('cliente_atrasado', 'Cliente atrasado', 'Avisar quando o horario do atendimento ja passou.')
$$;


ALTER FUNCTION "public"."notification_type_catalog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_comanda_open"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_client_name TEXT;
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.status <> 'open' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = COALESCE(NEW.status, '') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_client_name
  FROM public.clients
  WHERE id = NEW.client_id AND tenant_id = NEW.tenant_id
  LIMIT 1;

  PERFORM public.create_internal_notification(
    NEW.tenant_id,
    NULL,
    'comanda_aberta',
    'Nova comanda aberta',
    'Uma nova comanda foi aberta para ' || COALESCE(v_client_name, 'comanda #' || substring(NEW.id::text from 1 for 8)) || '.',
    'comandas',
    NEW.id,
    'info',
    jsonb_build_object('comanda_id', NEW.id, 'client_id', NEW.client_id)
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_comanda_open"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_low_stock_product"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.active, true) = true
    AND COALESCE(NEW.stock_quantity, 0) <= COALESCE(NEW.minimum_stock, 0)
    AND COALESCE(NEW.minimum_stock, 0) >= 0
  THEN
    PERFORM public.create_internal_notification(
      NEW.tenant_id,
      NULL,
      'estoque_baixo',
      'Estoque baixo',
      'O produto ' || NEW.name || ' está com estoque abaixo do mínimo.',
      'products',
      NEW.id,
      CASE WHEN COALESCE(NEW.stock_quantity, 0) <= 0 THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('stock_quantity', NEW.stock_quantity, 'minimum_stock', NEW.minimum_stock)
    );
  ELSE
    UPDATE public.notifications
    SET status = 'archived', read_at = COALESCE(read_at, now())
    WHERE tenant_id = NEW.tenant_id
      AND type = 'estoque_baixo'
      AND entity_type = 'products'
      AND entity_id = NEW.id
      AND status = 'unread';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_low_stock_product"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pause_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_sub RECORD;
BEGIN
    IF p_tenant_id IS NULL OR p_subscription_id IS NULL THEN
        RAISE EXCEPTION 'Tenant e assinatura são obrigatórios';
    END IF;
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    SELECT id, status INTO v_sub
    FROM public.customer_subscriptions
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    IF v_sub IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Assinatura não encontrada neste tenant');
    END IF;
    IF v_sub.status NOT IN ('active', 'past_due') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Apenas assinaturas ativas ou vencidas podem ser pausadas');
    END IF;
    UPDATE public.customer_subscriptions
    SET status = 'paused', updated_at = now()
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Assinatura pausada.',
        'subscription_id', p_subscription_id
    );
END;
$$;


ALTER FUNCTION "public"."pause_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pay_club_receivable"("p_receivable_id" "uuid", "p_payment_method" "text", "p_paid_at" timestamp with time zone, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_receivable public.customer_subscription_receivables%ROWTYPE;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_customer public.clients%ROWTYPE;
  v_plan public.customer_plans%ROWTYPE;
  v_transaction public.transactions%ROWTYPE;
  v_service_balance_map JSONB;
  v_total_credits INTEGER;
  v_next_cycle_start TIMESTAMPTZ;
  v_next_cycle_end TIMESTAMPTZ;
BEGIN
  IF p_receivable_id IS NULL THEN
    RAISE EXCEPTION 'Recebimento obrigatório';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_payment_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Forma de pagamento obrigatória';
  END IF;

  IF p_paid_at IS NULL THEN
    RAISE EXCEPTION 'Data de pagamento obrigatória';
  END IF;

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  SELECT *
  INTO v_receivable
  FROM public.customer_subscription_receivables
  WHERE id = p_receivable_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento não encontrado';
  END IF;

  IF NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_receivable.tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  IF v_receivable.status NOT IN ('pending', 'overdue') THEN
    RAISE EXCEPTION 'Recebimento não está pendente ou atrasado';
  END IF;

  IF v_receivable.transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Recebimento já possui lançamento financeiro';
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions
  WHERE id = v_receivable.subscription_id
    AND tenant_id = v_receivable.tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada para o recebimento';
  END IF;

  IF v_subscription.client_id IS DISTINCT FROM v_receivable.customer_id THEN
    RAISE EXCEPTION 'Cliente do recebimento não confere com a assinatura';
  END IF;

  IF v_subscription.plan_id IS DISTINCT FROM v_receivable.plan_id THEN
    RAISE EXCEPTION 'Plano do recebimento não confere com a assinatura';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.clients
  WHERE id = v_receivable.customer_id
    AND tenant_id = v_receivable.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado para o recebimento';
  END IF;

  SELECT *
  INTO v_plan
  FROM public.customer_plans
  WHERE id = v_receivable.plan_id
    AND tenant_id = v_receivable.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado para o recebimento';
  END IF;

  SELECT service_balance_map, total_credits
  INTO v_service_balance_map, v_total_credits
  FROM public.build_chef_club_service_balance_map(v_receivable.plan_id);

  IF v_total_credits <= 0 OR jsonb_array_length(COALESCE(v_service_balance_map, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Plano sem créditos por serviço configurados';
  END IF;

  INSERT INTO public.transactions (
    tenant_id,
    user_id,
    type,
    category,
    description,
    amount,
    payment_method,
    date,
    status,
    notes
  )
  VALUES (
    v_receivable.tenant_id,
    v_auth_uid,
    'income',
    'Receita recorrente Clube do Chefe',
    'Mensalidade Clube do Chefe - ' || COALESCE(v_plan.name, 'Plano') || ' - Cliente: ' || COALESCE(v_customer.name, 'Cliente'),
    v_receivable.amount,
    p_payment_method,
    p_paid_at,
    'paid',
    p_notes
  )
  RETURNING * INTO v_transaction;

  INSERT INTO public.customer_credits (
    tenant_id,
    client_id,
    subscription_id,
    available_credits,
    used_credits,
    service_balance_map,
    period_start,
    period_end
  )
  VALUES (
    v_receivable.tenant_id,
    v_receivable.customer_id,
    v_receivable.subscription_id,
    v_total_credits,
    0,
    v_service_balance_map,
    v_receivable.billing_cycle_start,
    v_receivable.billing_cycle_end
  )
  ON CONFLICT (subscription_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    client_id = EXCLUDED.client_id,
    available_credits = EXCLUDED.available_credits,
    used_credits = EXCLUDED.used_credits,
    service_balance_map = EXCLUDED.service_balance_map,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    updated_at = now();

  UPDATE public.customer_subscription_receivables
  SET
    status = 'paid',
    payment_method = p_payment_method,
    paid_at = p_paid_at,
    paid_by = v_auth_uid,
    transaction_id = v_transaction.id,
    notes = NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    updated_at = now()
  WHERE id = v_receivable.id
    AND transaction_id IS NULL
    AND status IN ('pending', 'overdue')
  RETURNING * INTO v_receivable;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento já foi baixado por outra operação';
  END IF;

  UPDATE public.customer_subscriptions
  SET
    status = 'active',
    cycle_start = v_receivable.billing_cycle_start,
    cycle_end = v_receivable.billing_cycle_end,
    next_billing_date = v_receivable.billing_cycle_end::DATE,
    updated_at = now()
  WHERE id = v_receivable.subscription_id;

  v_next_cycle_start := v_receivable.billing_cycle_end;
  v_next_cycle_end := v_receivable.billing_cycle_end + interval '1 month';

  PERFORM public.ensure_club_receivable_for_cycle(
    v_receivable.subscription_id,
    v_next_cycle_start,
    v_next_cycle_end,
    v_next_cycle_start::DATE
  );

  RETURN jsonb_build_object(
    'receivable', to_jsonb(v_receivable),
    'transaction', to_jsonb(v_transaction),
    'credits', (
      SELECT to_jsonb(cc)
      FROM public.customer_credits cc
      WHERE cc.subscription_id = v_receivable.subscription_id
      LIMIT 1
    )
  );
END;
$$;


ALTER FUNCTION "public"."pay_club_receivable"("p_receivable_id" "uuid", "p_payment_method" "text", "p_paid_at" timestamp with time zone, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pick_barber_runtime_schema"("p_public_exists" boolean, "p_public_freshness" timestamp with time zone, "p_barber_exists" boolean, "p_barber_freshness" timestamp with time zone) RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'barber'
    AS $$
BEGIN
  IF p_public_exists AND NOT p_barber_exists THEN
    RETURN 'public';
  END IF;

  IF p_barber_exists AND NOT p_public_exists THEN
    RETURN 'barber';
  END IF;

  IF NOT p_public_exists AND NOT p_barber_exists THEN
    RETURN NULL;
  END IF;

  IF p_public_freshness IS NOT NULL AND p_barber_freshness IS NOT NULL THEN
    IF p_barber_freshness > p_public_freshness THEN
      RETURN 'barber';
    END IF;

    RETURN 'public';
  END IF;

  IF p_public_freshness IS NULL AND p_barber_freshness IS NOT NULL THEN
    RETURN 'barber';
  END IF;

  RETURN 'public';
END;
$$;


ALTER FUNCTION "public"."pick_barber_runtime_schema"("p_public_exists" boolean, "p_public_freshness" timestamp with time zone, "p_barber_exists" boolean, "p_barber_freshness" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_plan_credit_for_service"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_start_time" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("eligible" boolean, "reason" "text", "available_credits" integer, "subscription_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_subscription public.customer_subscriptions%ROWTYPE;
  v_credit_record public.customer_credits%ROWTYPE;
  v_balance JSONB;
  v_available INTEGER := 0;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  IF p_tenant_id IS NULL THEN
    RETURN QUERY SELECT false, 'Tenant obrigatório', 0, NULL::UUID;
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN QUERY SELECT false, 'Tenant não autorizado', 0, NULL::UUID;
    RETURN;
  END IF;

  IF p_client_id IS NULL THEN
    RETURN QUERY SELECT false, 'Cliente obrigatório', 0, NULL::UUID;
    RETURN;
  END IF;

  IF p_service_id IS NULL THEN
    RETURN QUERY SELECT false, 'Serviço obrigatório', 0, NULL::UUID;
    RETURN;
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.customer_subscriptions cs
  WHERE cs.tenant_id = p_tenant_id
    AND cs.client_id = p_client_id
    AND cs.status = 'active'
    AND (
      p_start_time IS NULL
      OR (
        p_start_time >= cs.cycle_start
        AND p_start_time <= cs.cycle_end
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.customer_subscription_receivables csr
      WHERE csr.subscription_id = cs.id
        AND csr.tenant_id = cs.tenant_id
        AND csr.status = 'paid'
        AND csr.transaction_id IS NOT NULL
        AND COALESCE(p_start_time, now()) >= csr.billing_cycle_start
        AND COALESCE(p_start_time, now()) <= csr.billing_cycle_end
    )
  ORDER BY cs.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Cliente sem ciclo do Clube pago', 0, NULL::UUID;
    RETURN;
  END IF;

  SELECT *
  INTO v_credit_record
  FROM public.customer_credits cc
  WHERE cc.tenant_id = p_tenant_id
    AND cc.subscription_id = v_subscription.id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Assinatura sem créditos lançados', 0, v_subscription.id;
    RETURN;
  END IF;

  SELECT entry.value
  INTO v_balance
  FROM jsonb_array_elements(COALESCE(v_credit_record.service_balance_map, '[]'::jsonb)) AS entry(value)
  WHERE entry.value ->> 'service_id' = p_service_id::TEXT
  LIMIT 1;

  IF v_balance IS NOT NULL THEN
    v_available := GREATEST(0, COALESCE((v_balance ->> 'available')::INTEGER, 0));
  ELSE
    v_available := 0;
  END IF;

  IF v_available > 0 THEN
    RETURN QUERY SELECT true, 'Crédito disponível para ciclo pago', v_available, v_subscription.id;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'Sem créditos disponíveis para este serviço', 0, v_subscription.id;
END;
$$;


ALTER FUNCTION "public"."preview_plan_credit_for_service"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_start_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_audit_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
    v_record_id TEXT;
    v_tenant_id UUID;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        
        -- Try to extract common ID formats
        BEGIN v_record_id := NEW.id::text; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
        -- Try to extract tenant_id if present
        BEGIN v_tenant_id := NEW.tenant_id; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        
        -- Optimization: Don't log if data didn't actually change
        IF v_old_data = v_new_data THEN
            RETURN NEW;
        END IF;

        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME::text, COALESCE(v_record_id, 'UNKNOWN'), TG_OP, v_old_data, v_new_data, auth.uid(), v_tenant_id);
        
        RETURN NEW;
        
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        BEGIN v_record_id := OLD.id::text; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
        BEGIN v_tenant_id := OLD.tenant_id; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME::text, COALESCE(v_record_id, 'UNKNOWN'), TG_OP, v_old_data, auth.uid(), v_tenant_id);
        
        RETURN OLD;
        
    ELSIF (TG_OP = 'INSERT') THEN
        v_new_data := to_jsonb(NEW);
        BEGIN v_record_id := NEW.id::text; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
        BEGIN v_tenant_id := NEW.tenant_id; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        
        INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by, tenant_id)
        VALUES (TG_TABLE_NAME::text, COALESCE(v_record_id, 'UNKNOWN'), TG_OP, v_new_data, auth.uid(), v_tenant_id);
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."process_audit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reactivate_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_sub RECORD;
    v_has_other_active BOOLEAN;
BEGIN
    IF p_tenant_id IS NULL OR p_subscription_id IS NULL THEN
        RAISE EXCEPTION 'Tenant e assinatura são obrigatórios';
    END IF;
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    SELECT id, status, client_id, cycle_end INTO v_sub
    FROM public.customer_subscriptions
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    IF v_sub IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Assinatura não encontrada neste tenant');
    END IF;
    IF v_sub.status NOT IN ('paused', 'canceled', 'past_due') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Apenas assinaturas pausadas, canceladas ou vencidas podem ser reativadas');
    END IF;
    SELECT EXISTS(
        SELECT 1 FROM public.customer_subscriptions
        WHERE client_id = v_sub.client_id AND tenant_id = p_tenant_id
        AND status = 'active' AND id != p_subscription_id
    ) INTO v_has_other_active;
    IF v_has_other_active THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cliente já possui outra assinatura ativa');
    END IF;
    IF v_sub.cycle_end < now() AND v_sub.status = 'canceled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ciclo vencido. Renove o ciclo antes de reativar a assinatura.',
            'requires_renewal', true
        );
    END IF;
    UPDATE public.customer_subscriptions
    SET status = 'active', canceled_at = NULL, updated_at = now()
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Assinatura reativada!',
        'subscription_id', p_subscription_id
    );
END;
$$;


ALTER FUNCTION "public"."reactivate_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_club_receivable_statuses"("p_tenant_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_auth_tenant_id UUID;
  v_is_super_admin BOOLEAN;
  v_target_tenant_id UUID;
  v_count INTEGER;
BEGIN
  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_auth_tenant_id, v_is_super_admin;

  v_target_tenant_id := COALESCE(p_tenant_id, v_auth_tenant_id);

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant obrigatório';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT COALESCE(v_is_super_admin, false)
     AND v_auth_tenant_id IS DISTINCT FROM v_target_tenant_id THEN
    RAISE EXCEPTION 'Tenant não autorizado';
  END IF;

  UPDATE public.customer_subscription_receivables
  SET status = 'overdue', updated_at = now()
  WHERE tenant_id = v_target_tenant_id
    AND status = 'pending'
    AND due_date < current_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."refresh_club_receivable_statuses"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."renew_subscription_cycle"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_new_cycle_start" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_sub RECORD;
    v_plan RECORD;
    v_new_start TIMESTAMPTZ;
    v_new_end TIMESTAMPTZ;
    v_days INTEGER;
    v_new_credits_id UUID;
BEGIN
    IF p_tenant_id IS NULL OR p_subscription_id IS NULL THEN
        RAISE EXCEPTION 'Tenant e assinatura são obrigatórios';
    END IF;
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    SELECT id, plan_id, client_id, status INTO v_sub
    FROM public.customer_subscriptions
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    IF v_sub IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Assinatura não encontrada neste tenant');
    END IF;
    SELECT id, service_credits, service_credit_map, credit_validity_days
    INTO v_plan
    FROM public.customer_plans
    WHERE id = v_sub.plan_id AND tenant_id = p_tenant_id;
    IF v_plan IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Plano não encontrado');
    END IF;
    v_new_start := COALESCE(p_new_cycle_start, now());
    v_days := COALESCE(v_plan.credit_validity_days, 30);
    v_new_end := v_new_start + (v_days || ' days')::interval;
    UPDATE public.customer_subscriptions
    SET status = 'active',
        cycle_start = v_new_start,
        cycle_end = v_new_end,
        next_billing_date = v_new_end::date,
        updated_at = now()
    WHERE id = p_subscription_id AND tenant_id = p_tenant_id;
    INSERT INTO public.customer_credits (
        tenant_id, subscription_id, client_id,
        available_credits, used_credits,
        period_start, period_end,
        created_at, updated_at
    ) VALUES (
        p_tenant_id, p_subscription_id, v_sub.client_id,
        COALESCE(v_plan.service_credits, 0), 0,
        v_new_start, v_new_end,
        now(), now()
    ) RETURNING id INTO v_new_credits_id;
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Ciclo renovado com novos créditos!',
        'subscription_id', p_subscription_id,
        'credits_id', v_new_credits_id,
        'cycle_start', v_new_start,
        'cycle_end', v_new_end
    );
END;
$$;


ALTER FUNCTION "public"."renew_subscription_cycle"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_new_cycle_start" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_role_permissions_to_default"("p_tenant_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_created_by UUID;
BEGIN
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.role IN ('Manager', 'AdminManager')
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to reset role_permissions';
  END IF;

  v_created_by := auth.uid();

  -- Delete existing permissions for this role/tenant
  DELETE FROM public.role_permissions
  WHERE tenant_id = p_tenant_id AND role = p_role;

  -- Insert default permissions based on role
  IF p_role = 'Barber' THEN
    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES
      (p_tenant_id, 'Barber', 'schedule.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'Barber', 'schedule.confirm_arrival', true, v_created_by),
      (p_tenant_id, 'Barber', 'schedule.view_available_times', true, v_created_by),
      (p_tenant_id, 'Barber', 'services.view_catalog', true, v_created_by),
      (p_tenant_id, 'Barber', 'services.view_prices', true, v_created_by),
      (p_tenant_id, 'Barber', 'services.register_services', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.view_basic', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.view_own_history', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.add_notes', true, v_created_by),
      (p_tenant_id, 'Barber', 'clients.view_preferences', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.edit_own_profile', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.change_own_password', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.view_own_commission', true, v_created_by),
      (p_tenant_id, 'Barber', 'team.view_own_goals', true, v_created_by),
      (p_tenant_id, 'Barber', 'reports.view_daily_attendance', true, v_created_by),
      (p_tenant_id, 'Barber', 'reports.view_schedule_overview', true, v_created_by),
      (p_tenant_id, 'Barber', 'reports.view_personal_productivity', true, v_created_by),
      (p_tenant_id, 'Barber', 'communication.view_notifications', true, v_created_by);
  ELSIF p_role = 'Receptionist' THEN
    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES
      (p_tenant_id, 'Receptionist', 'schedule.view_general_schedule', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.create_appointments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.edit_appointments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.cancel_appointments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.view_available_times', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.manage_waitlist', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'schedule.confirm_arrival', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.create', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_basic', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_full_history', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.edit', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.add_notes', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_preferences', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_documents', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'clients.view_payment_history', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.view_catalog', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.view_prices', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.sell_services', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.view_stock', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.sell_products', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.apply_discounts', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'services.register_additions', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.open_close_cash', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.register_payments', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.register_basic_expenses', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.issue_receipts', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'financial.view_daily_movement', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.request_time_off', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.view_team_schedules', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.internal_communication', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.edit_own_profile', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'team.change_own_password', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_daily_attendance', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_schedule_overview', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_busy_free_times', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'reports.view_service_revenue', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.send_reminders', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.view_notifications', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.respond_to_messages', true, v_created_by),
      (p_tenant_id, 'Receptionist', 'communication.view_communication_history', true, v_created_by);
  END IF;
END;
$$;


ALTER FUNCTION "public"."reset_role_permissions_to_default"("p_tenant_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_comanda_runtime_schema"("p_comanda_id" "uuid") RETURNS TABLE("schema_name" "text", "tenant_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_public_exists boolean := false;
  v_barber_exists boolean := false;
  v_public_tenant_id uuid;
  v_barber_tenant_id uuid;
  v_public_row_ts timestamptz;
  v_barber_row_ts timestamptz;
  v_public_items_ts timestamptz;
  v_barber_items_ts timestamptz;
  v_public_freshness timestamptz;
  v_barber_freshness timestamptz;
BEGIN
  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_public_tenant_id, v_public_row_ts
  FROM public.comandas c
  WHERE c.id = p_comanda_id
  LIMIT 1;
  v_public_exists := FOUND;

  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_barber_tenant_id, v_barber_row_ts
  FROM barber.comandas c
  WHERE c.id = p_comanda_id
  LIMIT 1;
  v_barber_exists := FOUND;

  IF v_public_exists THEN
    SELECT max(
      COALESCE((to_jsonb(ci) ->> 'updated_at')::timestamptz, (to_jsonb(ci) ->> 'created_at')::timestamptz)
    )
    INTO v_public_items_ts
    FROM public.comanda_items ci
    WHERE ci.comanda_id = p_comanda_id
      AND (v_public_tenant_id IS NULL OR ci.tenant_id = v_public_tenant_id);

    v_public_freshness := CASE
      WHEN v_public_row_ts IS NULL THEN v_public_items_ts
      WHEN v_public_items_ts IS NULL THEN v_public_row_ts
      ELSE GREATEST(v_public_row_ts, v_public_items_ts)
    END;
  END IF;

  IF v_barber_exists THEN
    SELECT max(
      COALESCE((to_jsonb(ci) ->> 'updated_at')::timestamptz, (to_jsonb(ci) ->> 'created_at')::timestamptz)
    )
    INTO v_barber_items_ts
    FROM barber.comanda_items ci
    WHERE ci.comanda_id = p_comanda_id
      AND (v_barber_tenant_id IS NULL OR ci.tenant_id = v_barber_tenant_id);

    v_barber_freshness := CASE
      WHEN v_barber_row_ts IS NULL THEN v_barber_items_ts
      WHEN v_barber_items_ts IS NULL THEN v_barber_row_ts
      ELSE GREATEST(v_barber_row_ts, v_barber_items_ts)
    END;
  END IF;

  schema_name := public.pick_barber_runtime_schema(
    v_public_exists,
    v_public_freshness,
    v_barber_exists,
    v_barber_freshness
  );

  tenant_id := CASE schema_name
    WHEN 'barber' THEN v_barber_tenant_id
    WHEN 'public' THEN v_public_tenant_id
    ELSE NULL
  END;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."resolve_comanda_runtime_schema"("p_comanda_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_credit_runtime_schema"("p_subscription_id" "uuid") RETURNS TABLE("schema_name" "text", "tenant_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_public_exists boolean := false;
  v_barber_exists boolean := false;
  v_public_tenant_id uuid;
  v_barber_tenant_id uuid;
  v_public_freshness timestamptz;
  v_barber_freshness timestamptz;
BEGIN
  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_public_tenant_id, v_public_freshness
  FROM public.customer_credits c
  WHERE c.subscription_id = p_subscription_id
  LIMIT 1;
  v_public_exists := FOUND;

  SELECT
    c.tenant_id,
    COALESCE((to_jsonb(c) ->> 'updated_at')::timestamptz, (to_jsonb(c) ->> 'created_at')::timestamptz)
  INTO v_barber_tenant_id, v_barber_freshness
  FROM barber.customer_credits c
  WHERE c.subscription_id = p_subscription_id
  LIMIT 1;
  v_barber_exists := FOUND;

  schema_name := public.pick_barber_runtime_schema(
    v_public_exists,
    v_public_freshness,
    v_barber_exists,
    v_barber_freshness
  );

  tenant_id := CASE schema_name
    WHEN 'barber' THEN v_barber_tenant_id
    WHEN 'public' THEN v_public_tenant_id
    ELSE NULL
  END;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."resolve_credit_runtime_schema"("p_subscription_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_product_runtime_schema"("p_product_id" "uuid") RETURNS TABLE("schema_name" "text", "tenant_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_public_exists boolean := false;
  v_barber_exists boolean := false;
  v_public_tenant_id uuid;
  v_barber_tenant_id uuid;
  v_public_freshness timestamptz;
  v_barber_freshness timestamptz;
BEGIN
  SELECT
    p.tenant_id,
    COALESCE((to_jsonb(p) ->> 'updated_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz)
  INTO v_public_tenant_id, v_public_freshness
  FROM public.products p
  WHERE p.id = p_product_id
  LIMIT 1;
  v_public_exists := FOUND;

  SELECT
    p.tenant_id,
    COALESCE((to_jsonb(p) ->> 'updated_at')::timestamptz, (to_jsonb(p) ->> 'created_at')::timestamptz)
  INTO v_barber_tenant_id, v_barber_freshness
  FROM barber.products p
  WHERE p.id = p_product_id
  LIMIT 1;
  v_barber_exists := FOUND;

  schema_name := public.pick_barber_runtime_schema(
    v_public_exists,
    v_public_freshness,
    v_barber_exists,
    v_barber_freshness
  );

  tenant_id := CASE schema_name
    WHEN 'barber' THEN v_barber_tenant_id
    WHEN 'public' THEN v_public_tenant_id
    ELSE NULL
  END;

  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."resolve_product_runtime_schema"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_notification_preferences"("p_preferences" "jsonb") RETURNS TABLE("type" "text", "label" "text", "description" "text", "enabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tenant_id UUID;
  v_item JSONB;
  v_type TEXT;
  v_enabled BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_preferences IS NULL OR jsonb_typeof(p_preferences) <> 'array' THEN
    RAISE EXCEPTION 'Preferencias invalidas';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_preferences)
  LOOP
    v_type := v_item->>'type';
    v_enabled := COALESCE((v_item->>'enabled')::boolean, true);

    IF v_type IN (
      'comanda_aberta',
      'estoque_baixo',
      'pagamento_a_realizar',
      'cobranca_clube_chefes',
      'proximo_cliente',
      'cliente_atrasado'
    ) THEN
      INSERT INTO public.notification_preferences (tenant_id, user_id, type, enabled)
      VALUES (v_tenant_id, auth.uid(), v_type, v_enabled)
      ON CONFLICT (tenant_id, user_id, type)
      DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
    END IF;
  END LOOP;

  RETURN QUERY SELECT * FROM public.get_notification_preferences();
END;
$$;


ALTER FUNCTION "public"."set_notification_preferences"("p_preferences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM profiles
    WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tenant_id_from_context"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  NEW.tenant_id := COALESCE(NEW.tenant_id, public.get_current_tenant_id());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tenant_id_from_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tenant_id_from_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id_from_auth_uid();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_tenant_id_from_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_managers"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_managers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_new_account"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_shop_name TEXT;
  v_tenant_id UUID;
BEGIN
  -- We fetch the shop_name that was passed during supabase.auth.signUp()
  SELECT raw_user_meta_data->>'shop_name' INTO v_shop_name
  FROM auth.users WHERE id = NEW.id;

  -- If it's a new registration from the frontend with a shop_name and no tenant assigned yet
  IF v_shop_name IS NOT NULL AND v_shop_name <> '' AND NEW.tenant_id IS NULL THEN
    
    -- Automatically create the barbershop (tenant)
    INSERT INTO public.tenants (name, slug)
    VALUES (v_shop_name, lower(regexp_replace(v_shop_name, '[^a-zA-Z0-9]+', '-', 'g')))
    RETURNING id INTO v_tenant_id;

    -- Assign the new tenant and the manager role to the user's profile
    NEW.tenant_id := v_tenant_id;
    NEW.role := 'manager';
    
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."setup_new_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_to_user_tenants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  VALUES (
    NEW.id,
    NEW.tenant_id,
    lower(coalesce(NEW.role, 'manager')),
    true
  )
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    is_primary = true,
    updated_at = now();

  UPDATE public.tenants
  SET app_slug = coalesce(app_slug, 'barber')
  WHERE id = NEW.tenant_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_profile_to_user_tenants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."table_has_column"("p_schema_name" "text", "p_table_name" "text", "p_column_name" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema_name
      AND table_name = p_table_name
      AND column_name = p_column_name
  );
$$;


ALTER FUNCTION "public"."table_has_column"("p_schema_name" "text", "p_table_name" "text", "p_column_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_user_tenants_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_user_tenants_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_cash_closing_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_cash_closing_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_role_permissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_role_permissions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_role_permissions"("p_tenant_id" "uuid", "p_role" "text", "p_permissions" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  item JSONB;
  v_permission_key TEXT;
  v_enabled BOOLEAN;
  v_created_by UUID;
BEGIN
  -- Verify caller is a manager or superadmin for this tenant
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.role IN ('Manager', 'AdminManager')
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to modify role_permissions';
  END IF;

  v_created_by := auth.uid();

  FOR item IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    v_permission_key := item->>'permission_key';
    v_enabled := (item->>'enabled')::boolean;

    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES (p_tenant_id, p_role, v_permission_key, v_enabled, v_created_by)
    ON CONFLICT (tenant_id, role, permission_key)
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      updated_at = now(),
      created_by = EXCLUDED.created_by;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."upsert_role_permissions"("p_tenant_id" "uuid", "p_role" "text", "p_permissions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_and_fix_comandas"("p_tenant_id" "uuid") RETURNS TABLE("fix_type" "text", "comanda_id" "uuid", "description" "text", "fixed" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
BEGIN
  -- 1. Find orphaned comanda_items
  RETURN QUERY
  SELECT 
    'orphaned_items'::TEXT AS fix_type,
    ci.id AS comanda_id,
    ('Item references missing comanda_id: ' || ci.comanda_id::TEXT)::TEXT AS description,
    false AS fixed
  FROM public.comanda_items ci
  WHERE ci.comanda_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.comandas c WHERE c.id = ci.comanda_id)
  LIMIT 100;
  
  -- 2. Find comandas with negative totals
  RETURN QUERY
  SELECT 'negative_total'::TEXT AS fix_type, c.id,
    ('Comanda has negative total: ' || c.total::TEXT)::TEXT AS description,
    false AS fixed
  FROM public.comandas c WHERE c.total < 0;
  
  -- 3. Find stale open comandas
  RETURN QUERY
  SELECT 'stale_comanda'::TEXT AS fix_type, c.id,
    ('Open comanda older than 24h')::TEXT AS description,
    false AS fixed
  FROM public.comandas c
  WHERE c.status = 'open' AND c.created_at < NOW() - INTERVAL '24 hours';

  -- 4. Auto-cancel stale open comandas
  UPDATE public.comandas
  SET status = 'cancelled'
  WHERE status = 'open' AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;


ALTER FUNCTION "public"."validate_and_fix_comandas"("p_tenant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "varejo"."create_order_varejo"("p_tenant_id" "uuid", "p_seller_id" "uuid", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_order_id UUID;
    v_item RECORD;
    v_total DECIMAL(12,2) := 0;
BEGIN
    -- A. Cria o pedido base (começa com total 0)
    INSERT INTO varejo.orders (tenant_id, seller_id, total_amount, payment_status)
    VALUES (p_tenant_id, p_seller_id, 0, 'paid')
    RETURNING id INTO v_order_id;

    -- B. Processa cada item enviado no JSON
    -- O JSON esperado é: [{"product_id": "...", "quantity": 2, "price": 10.00}, ...]
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INT, price DECIMAL)
    LOOP
        -- TRAVA DE SEGURANÇA: Tenta subtrair do estoque apenas se houver quantidade suficiente
        UPDATE public.products 
        SET stock_quantity = stock_quantity - v_item.quantity 
        WHERE id = v_item.product_id 
          AND tenant_id = p_tenant_id 
          AND stock_quantity >= v_item.quantity;

        -- Se o UPDATE não encontrou linha (estoque insuficiente), dispara erro e cancela TUDO
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto ID %', v_item.product_id;
        END IF;

        -- Registra o item no pedido
        INSERT INTO varejo.order_items (order_id, product_id, quantity, unit_price, subtotal)
        VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.price, v_item.quantity * v_item.price);

        -- Registra a saída no histórico de inventário
        INSERT INTO varejo.inventory_movements (tenant_id, product_id, type, quantity, order_id, created_by)
        VALUES (p_tenant_id, v_item.product_id, 'sale', v_item.quantity, v_order_id, p_seller_id);

        -- Soma ao total da venda
        v_total := v_total + (v_item.quantity * v_item.price);
    END LOOP;

    -- C. Atualiza o valor total final do pedido
    UPDATE varejo.orders SET total_amount = v_total WHERE id = v_order_id;

    RETURN v_order_id;
END;
$$;


ALTER FUNCTION "varejo"."create_order_varejo"("p_tenant_id" "uuid", "p_seller_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "service_id" "uuid",
    "staff_id" "uuid",
    "client_name" "text" DEFAULT ''::"text",
    "service_name" "text" DEFAULT ''::"text",
    "staff_name" "text" DEFAULT ''::"text",
    "start_time" timestamp with time zone NOT NULL,
    "duration" numeric(3,1) DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "source" "text" DEFAULT 'app'::"text",
    "channel" "text",
    "client_phone" "text",
    "end_time" timestamp with time zone,
    "price" numeric(10,2) DEFAULT 0,
    "notes" "text",
    "idempotency_key" "text",
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by_user_id" "uuid",
    "cancellation_type" "text",
    "hidden_from_schedule" boolean DEFAULT false NOT NULL,
    "is_overbooked" boolean DEFAULT false NOT NULL,
    "subscription_id" "uuid",
    "eligible_for_plan_credit" boolean DEFAULT false,
    "expected_plan_service" "text",
    "plan_credit_preview" "jsonb",
    "user_id" "uuid",
    "user_email" "text",
    "customer_name" "text",
    "service" "text",
    "barber" "text",
    "barber_id" "text",
    "appointment_at" timestamp with time zone,
    "source_system" "text" DEFAULT 'local'::"text",
    "external_id" "text",
    "sync_status" "text" DEFAULT 'not_applicable'::"text",
    "last_sync_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "date" "text",
    "month" "text",
    "time" "text",
    CONSTRAINT "_l_appointments_channel_check" CHECK (("channel" = ANY (ARRAY['totem'::"text", 'qr'::"text", 'whatsapp'::"text", 'admin'::"text"]))),
    CONSTRAINT "_l_appointments_source_check" CHECK (("source" = ANY (ARRAY['app'::"text", 'kiosk'::"text"]))),
    CONSTRAINT "_l_appointments_source_system_check" CHECK (("source_system" = ANY (ARRAY['local'::"text", 'smg'::"text"]))),
    CONSTRAINT "_l_appointments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'no_show'::"text"]))),
    CONSTRAINT "_l_appointments_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['not_applicable'::"text", 'pending'::"text", 'synced'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON TABLE "public"."appointments" IS 'DEPRECATED: Barber appointments. Replaced by varejo.orders. Kept for historical data.';



COMMENT ON COLUMN "public"."appointments"."cancellation_reason" IS 'Motivo do cancelamento do agendamento. Usado para diferenciar erro de cadastro de cancelamentos operacionais.';



COMMENT ON COLUMN "public"."appointments"."cancelled_at" IS 'Timestamp when the appointment was cancelled';



COMMENT ON COLUMN "public"."appointments"."cancelled_by_user_id" IS 'User who cancelled the appointment (for audit)';



CREATE OR REPLACE VIEW "barber"."appointments" WITH ("security_invoker"='true') AS
 SELECT "id",
    "client_id",
    "service_id",
    "staff_id" AS "professional_id",
    "client_name",
    "service_name",
    "staff_name",
    "start_time",
    "duration",
    "status",
    "created_at",
    "tenant_id",
    "source",
    "channel",
    "client_phone",
    "end_time",
    "price",
    "notes",
    "idempotency_key",
    "cancellation_reason",
    "cancelled_at",
    "cancelled_by_user_id",
    "cancellation_type",
    "hidden_from_schedule",
    "is_overbooked",
    "subscription_id",
    "eligible_for_plan_credit",
    "expected_plan_service",
    "plan_credit_preview",
    "user_id",
    "user_email",
    "customer_name",
    "service",
    "barber",
    "barber_id",
    "appointment_at",
    "source_system",
    "external_id",
    "sync_status",
    "last_sync_at",
    "updated_at",
    "date",
    "month",
    "time"
   FROM "public"."appointments";


ALTER VIEW "barber"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "birthday" "text" DEFAULT ''::"text",
    "avatar" "text" DEFAULT ''::"text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_visit" timestamp with time zone DEFAULT "now"(),
    "last_service" "text" DEFAULT '-'::"text",
    "total_spent" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "idempotency_key" "text",
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."clients" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "email",
    "phone",
    "birthday",
    "avatar",
    "status",
    "last_visit",
    "last_service",
    "total_spent",
    "created_at",
    "tenant_id",
    "idempotency_key"
   FROM "public"."clients";


ALTER VIEW "barber"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comanda_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comanda_id" "uuid",
    "service_id" "uuid",
    "product_name" "text",
    "quantity" integer DEFAULT 1,
    "unit_price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "product_id" "uuid",
    "tenant_id" "uuid",
    "staff_id" "uuid",
    "chef_club_benefit_code" "text",
    "chef_club_benefit_label" "text",
    "chef_club_applied_quantity" integer DEFAULT 0 NOT NULL,
    "chef_club_original_unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "chef_club_final_unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "chef_club_override_mode" "text" DEFAULT 'none'::"text" NOT NULL,
    "chef_club_override_reason" "text" DEFAULT ''::"text" NOT NULL,
    "chef_club_plan_benefit_id" "uuid",
    "is_primary_revenue" boolean DEFAULT true,
    "paid_with_plan_credit" boolean DEFAULT false,
    "subscription_id" "uuid",
    "plan_id" "uuid",
    "credit_usage_id" "uuid",
    "original_price" numeric(10,2),
    "final_price" numeric(10,2),
    "plan_credit_key" "text"
);


ALTER TABLE "public"."comanda_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."comanda_items" IS 'DEPRECATED: Barber comanda items. Replaced by varejo.order_items. Kept for historical data.';



CREATE OR REPLACE VIEW "barber"."comanda_items" WITH ("security_invoker"='true') AS
 SELECT "id",
    "comanda_id",
    "service_id",
    "product_name",
    "quantity",
    "unit_price",
    "created_at",
    "product_id",
    "tenant_id",
    "staff_id",
    "chef_club_benefit_code",
    "chef_club_benefit_label",
    "chef_club_applied_quantity",
    "chef_club_original_unit_price",
    "chef_club_final_unit_price",
    "chef_club_override_mode",
    "chef_club_override_reason",
    "chef_club_plan_benefit_id",
    "is_primary_revenue",
    "paid_with_plan_credit",
    "subscription_id",
    "plan_id",
    "credit_usage_id",
    "original_price",
    "final_price",
    "plan_credit_key"
   FROM "public"."comanda_items";


ALTER VIEW "barber"."comanda_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comandas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "appointment_id" "uuid",
    "client_id" "uuid",
    "staff_id" "uuid",
    "status" "text" DEFAULT 'open'::"text",
    "total" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "subtotal" numeric(10,2) DEFAULT 0,
    "discount" numeric(10,2) DEFAULT 0,
    "payment_method" "text",
    "idempotency_key" "text",
    "chef_club_original_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "chef_club_savings_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "chef_club_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "closure_mode" "text" DEFAULT 'standard'::"text" NOT NULL,
    "closure_note" "text",
    "financial_effect" boolean DEFAULT true NOT NULL,
    "membership_credit_effect" boolean DEFAULT true NOT NULL,
    "legacy_reference_month" "date",
    "closed_at" timestamp with time zone,
    "cancellation_type" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by_user_id" "uuid",
    "hidden_from_financial" boolean DEFAULT false NOT NULL,
    "payment_date_real" timestamp with time zone,
    "settled_at" timestamp with time zone,
    "settled_by_user_id" "uuid",
    CONSTRAINT "_l_comandas_closure_mode_check" CHECK (("closure_mode" = ANY (ARRAY['standard'::"text", 'legacy_membership'::"text"]))),
    CONSTRAINT "_l_comandas_status_check" CHECK (("status" = ANY (ARRAY['blocked'::"text", 'open'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."comandas" OWNER TO "postgres";


COMMENT ON TABLE "public"."comandas" IS 'DEPRECATED: Barber comandas. Replaced by varejo.orders. Kept for historical data.';



CREATE OR REPLACE VIEW "barber"."comandas" WITH ("security_invoker"='true') AS
 SELECT "id",
    "appointment_id",
    "client_id",
    "staff_id",
    "status",
    "total",
    "created_at",
    "tenant_id",
    "updated_at",
    "subtotal",
    "discount",
    "payment_method",
    "idempotency_key",
    "chef_club_original_total",
    "chef_club_savings_total",
    "chef_club_summary",
    "closure_mode",
    "closure_note",
    "financial_effect",
    "membership_credit_effect",
    "legacy_reference_month",
    "closed_at",
    "cancellation_type",
    "cancelled_at",
    "cancelled_by_user_id",
    "hidden_from_financial",
    "payment_date_real",
    "settled_at",
    "settled_by_user_id"
   FROM "public"."comandas";


ALTER VIEW "barber"."comandas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "monthly_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "service_credits" integer DEFAULT 0 NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "priority_booking" boolean DEFAULT false NOT NULL,
    "product_discount" numeric(5,2) DEFAULT 0 NOT NULL,
    "max_rollover_credits" integer DEFAULT 0 NOT NULL,
    "credit_validity_days" integer DEFAULT 30 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "service_credit_map" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "customer_plans_credit_validity_days_check" CHECK (("credit_validity_days" > 0)),
    CONSTRAINT "customer_plans_product_discount_check" CHECK ((("product_discount" >= (0)::numeric) AND ("product_discount" <= (100)::numeric)))
);


ALTER TABLE "public"."customer_plans" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."customer_plans" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "name",
    "monthly_price",
    "service_credits",
    "description",
    "priority_booking",
    "product_discount",
    "max_rollover_credits",
    "credit_validity_days",
    "active",
    "created_at",
    "updated_at",
    "service_credit_map"
   FROM "public"."customer_plans";


ALTER VIEW "barber"."customer_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cycle_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cycle_end" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "next_billing_date" "date" DEFAULT (("now"() + '30 days'::interval))::"date" NOT NULL,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'past_due'::"text", 'canceled'::"text", 'paused'::"text"])))
);


ALTER TABLE "public"."customer_subscriptions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."customer_subscriptions" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "client_id",
    "plan_id",
    "status",
    "started_at",
    "cycle_start",
    "cycle_end",
    "next_billing_date",
    "canceled_at",
    "created_at",
    "updated_at"
   FROM "public"."customer_subscriptions";


ALTER VIEW "barber"."customer_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_barber" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "barber_id" "uuid",
    "session_id" "uuid",
    "rating" integer,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "comment" "text",
    "source_channel" "text" DEFAULT 'totem'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_barber_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "feedback_barber_source_channel_check" CHECK (("source_channel" = ANY (ARRAY['totem'::"text", 'qr'::"text", 'app'::"text"])))
);


ALTER TABLE "public"."feedback_barber" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."feedback_barber" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "client_id",
    "barber_id",
    "session_id",
    "rating",
    "tags",
    "comment",
    "source_channel",
    "created_at"
   FROM "public"."feedback_barber";


ALTER VIEW "barber"."feedback_barber" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_shop" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "session_id" "uuid",
    "nps" integer,
    "reasons" "text"[] DEFAULT '{}'::"text"[],
    "comment" "text",
    "marketing_opt_in" boolean DEFAULT false,
    "source_channel" "text" DEFAULT 'totem'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "feedback_shop_nps_check" CHECK ((("nps" >= 0) AND ("nps" <= 10))),
    CONSTRAINT "feedback_shop_source_channel_check" CHECK (("source_channel" = ANY (ARRAY['totem'::"text", 'qr'::"text", 'app'::"text"])))
);


ALTER TABLE "public"."feedback_shop" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."feedback_shop" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "client_id",
    "session_id",
    "nps",
    "reasons",
    "comment",
    "marketing_opt_in",
    "source_channel",
    "created_at"
   FROM "public"."feedback_shop";


ALTER VIEW "barber"."feedback_shop" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kiosk_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "theme" "text" DEFAULT 'default'::"text",
    "timeout_seconds" integer DEFAULT 30,
    "visible_services" "uuid"[] DEFAULT '{}'::"uuid"[],
    "visible_barbers" "uuid"[] DEFAULT '{}'::"uuid"[],
    "last_seen_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "kiosk_devices_theme_check" CHECK (("theme" = ANY (ARRAY['default'::"text", 'sanchez'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."kiosk_devices" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."kiosk_devices" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "name",
    "is_active",
    "theme",
    "timeout_seconds",
    "visible_services",
    "visible_barbers",
    "last_seen_at",
    "created_at",
    "updated_at"
   FROM "public"."kiosk_devices";


ALTER VIEW "barber"."kiosk_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kiosk_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "device_id" "uuid",
    "channel" "text" DEFAULT 'totem'::"text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "client_id" "uuid",
    "status" "text" DEFAULT 'initiated'::"text",
    "ip_address" "text",
    "user_agent" "text",
    "action_log" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "kiosk_sessions_channel_check" CHECK (("channel" = ANY (ARRAY['totem'::"text", 'qr'::"text"]))),
    CONSTRAINT "kiosk_sessions_status_check" CHECK (("status" = ANY (ARRAY['initiated'::"text", 'identified'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."kiosk_sessions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."kiosk_sessions" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "device_id",
    "channel",
    "started_at",
    "ended_at",
    "client_id",
    "status",
    "ip_address",
    "user_agent",
    "action_log"
   FROM "public"."kiosk_sessions";


ALTER VIEW "barber"."kiosk_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "cost_price" numeric,
    "sale_price" numeric,
    "stock_quantity" integer DEFAULT 0,
    "minimum_stock" integer DEFAULT 0,
    "auto_generate_purchase_order" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location_code" "text",
    "commercial_name" "text",
    "sku" "text",
    "category" "text",
    "min_stock_alert" integer DEFAULT 0 NOT NULL,
    "image_url" "text",
    "barcode" "text",
    "unit" "text" DEFAULT 'un'::"text" NOT NULL,
    "price" numeric(12,2) DEFAULT 0
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."sku" IS 'Varejo MVP: Stock Keeping Unit, unique per tenant.';



COMMENT ON COLUMN "public"."products"."category" IS 'Varejo MVP: Product category (e.g. Bebidas, Limpeza, Padaria).';



COMMENT ON COLUMN "public"."products"."min_stock_alert" IS 'Varejo MVP: Alert threshold. When stock_quantity <= min_stock_alert, dashboard surfaces a low-stock warning.';



COMMENT ON COLUMN "public"."products"."image_url" IS 'Varejo MVP: Optional product image URL.';



COMMENT ON COLUMN "public"."products"."barcode" IS 'Varejo MVP: Optional EAN/barcode for fast checkout.';



COMMENT ON COLUMN "public"."products"."unit" IS 'Varejo MVP: Unit of measure (un, kg, L, cx, pct).';



CREATE OR REPLACE VIEW "barber"."products" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "name",
    "description",
    "cost_price",
    "sale_price",
    "stock_quantity",
    "minimum_stock",
    "auto_generate_purchase_order",
    "active",
    "created_at",
    "updated_at",
    "location_code",
    "commercial_name",
    "sku",
    "category",
    "min_stock_alert",
    "image_url",
    "barcode",
    "unit",
    "price"
   FROM "public"."products";


ALTER VIEW "barber"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "title" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "discount_type" "text" NOT NULL,
    "discount_value" numeric NOT NULL,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "promotions_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "promotions_target_type_check" CHECK (("target_type" = ANY (ARRAY['service'::"text", 'product'::"text", 'all'::"text"])))
);


ALTER TABLE "public"."promotions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."promotions" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "title",
    "target_type",
    "target_id",
    "discount_type",
    "discount_value",
    "start_date",
    "end_date",
    "active",
    "created_at"
   FROM "public"."promotions";


ALTER VIEW "barber"."promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "supplier_id" "uuid",
    CONSTRAINT "purchase_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'ordered'::"text", 'received'::"text"])))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."purchase_orders" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "product_id",
    "quantity",
    "status",
    "created_at",
    "supplier_id"
   FROM "public"."purchase_orders";


ALTER VIEW "barber"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "professional_id" "uuid",
    "block_type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "reason" "text" NOT NULL,
    "notes" "text",
    "recurrence_type" "text" DEFAULT 'none'::"text" NOT NULL,
    "recurrence_until" "date",
    "existing_appointments_action" "text" DEFAULT 'keep'::"text" NOT NULL,
    "created_by" "uuid",
    "removed_by" "uuid",
    "removed_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "_l_schedule_blocks_block_type_check" CHECK (("block_type" = ANY (ARRAY['full_day'::"text", 'time_range'::"text"]))),
    CONSTRAINT "_l_schedule_blocks_date_range_check" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "_l_schedule_blocks_existing_appointments_action_check" CHECK (("existing_appointments_action" = ANY (ARRAY['keep'::"text", 'review'::"text", 'cancel'::"text"]))),
    CONSTRAINT "_l_schedule_blocks_full_day_time_null_check" CHECK ((("block_type" <> 'full_day'::"text") OR (("start_time" IS NULL) AND ("end_time" IS NULL)))),
    CONSTRAINT "_l_schedule_blocks_recurrence_type_check" CHECK (("recurrence_type" = ANY (ARRAY['none'::"text", 'weekly'::"text"]))),
    CONSTRAINT "_l_schedule_blocks_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "_l_schedule_blocks_time_order_check" CHECK ((("block_type" = 'full_day'::"text") OR (("start_time" IS NOT NULL) AND ("end_time" IS NOT NULL) AND ("end_time" > "start_time")))),
    CONSTRAINT "_l_schedule_blocks_weekly_single_day_check" CHECK ((("recurrence_type" <> 'weekly'::"text") OR ("start_date" = "end_date")))
);


ALTER TABLE "public"."schedule_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."schedule_blocks" IS 'DEPRECATED: Barber schedule blocks. No varejo MVP equivalent. Kept for historical data.';



CREATE OR REPLACE VIEW "barber"."schedule_blocks" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "professional_id",
    "block_type",
    "start_date",
    "end_date",
    "start_time",
    "end_time",
    "reason",
    "notes",
    "recurrence_type",
    "recurrence_until",
    "existing_appointments_action",
    "created_by",
    "removed_by",
    "removed_at",
    "status",
    "created_at",
    "updated_at"
   FROM "public"."schedule_blocks";


ALTER VIEW "barber"."schedule_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'Cabelo'::"text" NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "duration" integer DEFAULT 30 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "buffer" integer DEFAULT 0,
    "location_code" "text",
    "commercial_name" "text",
    "description" "text"
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON TABLE "public"."services" IS 'DEPRECATED: Barber services catalog. Replaced by public.products (varejo). Kept for historical data.';



CREATE OR REPLACE VIEW "barber"."services" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "category",
    "price",
    "duration",
    "active",
    "created_at",
    "tenant_id",
    "buffer",
    "location_code",
    "commercial_name",
    "description"
   FROM "public"."services";


ALTER VIEW "barber"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" DEFAULT ''::"text",
    "phone" "text" DEFAULT ''::"text",
    "role" "text" DEFAULT 'Barber'::"text" NOT NULL,
    "avatar" "text" DEFAULT ''::"text",
    "commission_rate" integer DEFAULT 40 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    "specialties" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "staff_role_check" CHECK (("role" = ANY (ARRAY['Manager'::"text", 'AdminManager'::"text", 'Barber'::"text", 'Receptionist'::"text"]))),
    CONSTRAINT "staff_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."staff" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "email",
    "phone",
    "role",
    "avatar",
    "commission_rate",
    "status",
    "created_at",
    "tenant_id",
    "specialties"
   FROM "public"."staff";


ALTER VIEW "barber"."staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "document" "text",
    "address" "text"
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."suppliers" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "name",
    "email",
    "phone",
    "category",
    "created_at",
    "document",
    "address"
   FROM "public"."suppliers";


ALTER VIEW "barber"."suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "description" "text",
    "payment_method" "text",
    "date" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "status" "text" DEFAULT 'completed'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "method" character varying(50),
    "notes" "text",
    "due_day" integer,
    "source_type" "text",
    "source_id" "uuid",
    "idempotency_key" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "barber"."transactions" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "user_id",
    "type",
    "category",
    "amount",
    "description",
    "payment_method",
    "date",
    "status",
    "created_at",
    "updated_at",
    "method",
    "notes",
    "due_day",
    "source_type",
    "source_id",
    "idempotency_key",
    "metadata"
   FROM "public"."transactions";


ALTER VIEW "barber"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "club"."customer_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "available_credits" integer DEFAULT 0 NOT NULL,
    "used_credits" integer DEFAULT 0 NOT NULL,
    "service_balance_map" "jsonb" DEFAULT '[]'::"jsonb",
    "period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "club"."customer_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "club"."customer_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "monthly_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "service_credits" integer DEFAULT 0 NOT NULL,
    "service_credit_map" "jsonb" DEFAULT '[]'::"jsonb",
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "priority_booking" boolean DEFAULT false NOT NULL,
    "product_discount" numeric(5,2) DEFAULT 0 NOT NULL,
    "max_rollover_credits" integer DEFAULT 0 NOT NULL,
    "credit_validity_days" integer DEFAULT 30 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "club"."customer_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "club"."customer_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cycle_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cycle_end" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "next_billing_date" "date" DEFAULT (("now"() + '30 days'::interval))::"date" NOT NULL,
    "canceled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "club"."customer_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."admin_profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "role" character varying(50) DEFAULT 'viewer'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    CONSTRAINT "admin_profiles_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying])::"text"[])))
);


ALTER TABLE "control"."admin_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."app_health_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_app_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    "check_type" character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    "response_time_ms" integer,
    "message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "app_health_checks_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['healthy'::character varying, 'warning'::character varying, 'critical'::character varying, 'unknown'::character varying])::"text"[])))
);


ALTER TABLE "control"."app_health_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."app_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_app_id" "uuid" NOT NULL,
    "severity" character varying(20) DEFAULT 'low'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'open'::character varying NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "app_incidents_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::"text"[]))),
    CONSTRAINT "app_incidents_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['open'::character varying, 'investigating'::character varying, 'resolved'::character varying, 'ignored'::character varying])::"text"[])))
);


ALTER TABLE "control"."app_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid" DEFAULT "auth"."uid"(),
    "actor_role" character varying(50),
    "entity_type" character varying(80) NOT NULL,
    "entity_id" "uuid",
    "action" character varying(120) NOT NULL,
    "before_data" "jsonb",
    "after_data" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "control"."commercial_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "legal_name" character varying(255) DEFAULT ''::character varying NOT NULL,
    "document" character varying(50) DEFAULT ''::character varying NOT NULL,
    "email" character varying(255) DEFAULT ''::character varying NOT NULL,
    "phone" character varying(50) DEFAULT ''::character varying NOT NULL,
    "address" "text" DEFAULT ''::"text" NOT NULL,
    "contact_name" character varying(180) DEFAULT ''::character varying NOT NULL,
    "segment" character varying(120) DEFAULT ''::character varying NOT NULL,
    "company_name" character varying(180) DEFAULT ''::character varying NOT NULL,
    "needs" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "control"."commercial_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_contract_clauses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "clause_number" character varying(50) NOT NULL,
    "title" character varying(180) NOT NULL,
    "body" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "control"."commercial_contract_clauses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_product_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commercial_product_id" "uuid" NOT NULL,
    "feature_type" character varying(20) NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_product_features_feature_type_check" CHECK ((("feature_type")::"text" = ANY ((ARRAY['feature'::character varying, 'technology'::character varying, 'benefit'::character varying, 'addon'::character varying])::"text"[])))
);


ALTER TABLE "control"."commercial_product_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_product_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commercial_product_id" "uuid" NOT NULL,
    "name" character varying(180) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "estimated_duration" character varying(120) DEFAULT ''::character varying NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_product_phases_percentage_check" CHECK (("percentage" >= (0)::numeric))
);


ALTER TABLE "control"."commercial_product_phases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_product_test_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commercial_product_id" "uuid" NOT NULL,
    "name" character varying(180) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "owner" character varying(120) DEFAULT ''::character varying NOT NULL,
    "timeline" character varying(120) DEFAULT ''::character varying NOT NULL,
    "acceptance_criteria" "text" DEFAULT ''::"text" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_product_test_phases_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "control"."commercial_product_test_phases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "technical_description" "text" DEFAULT ''::"text" NOT NULL,
    "complexity" character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    "product_model" character varying(30) DEFAULT 'saas'::character varying NOT NULL,
    "base_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "monthly_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "estimated_timeline" character varying(120) DEFAULT ''::character varying NOT NULL,
    "commercial_notes" "text" DEFAULT ''::"text" NOT NULL,
    "support_terms" "text" DEFAULT ''::"text" NOT NULL,
    "specific_contract_clause" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_products_base_price_check" CHECK (("base_price" >= (0)::numeric)),
    CONSTRAINT "commercial_products_complexity_check" CHECK ((("complexity")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'enterprise'::character varying])::"text"[]))),
    CONSTRAINT "commercial_products_monthly_price_check" CHECK (("monthly_price" >= (0)::numeric)),
    CONSTRAINT "commercial_products_product_model_check" CHECK ((("product_model")::"text" = ANY ((ARRAY['one_time'::character varying, 'monthly'::character varying, 'saas'::character varying, 'licensing'::character varying, 'customization'::character varying, 'hybrid'::character varying])::"text"[])))
);


ALTER TABLE "control"."commercial_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_quote_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "name" character varying(180) NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "estimated_duration" character varying(120) DEFAULT ''::character varying NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_quote_phases_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "commercial_quote_phases_percentage_check" CHECK (("percentage" >= (0)::numeric))
);


ALTER TABLE "control"."commercial_quote_phases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "company_name" character varying(255) DEFAULT ''::character varying NOT NULL,
    "document" character varying(50) DEFAULT ''::character varying NOT NULL,
    "email" character varying(255) DEFAULT ''::character varying NOT NULL,
    "phone" character varying(50) DEFAULT ''::character varying NOT NULL,
    "website" character varying(255) DEFAULT ''::character varying NOT NULL,
    "city" character varying(120) DEFAULT ''::character varying NOT NULL,
    "legal_representative" character varying(180) DEFAULT ''::character varying NOT NULL,
    "pix_key" character varying(255) DEFAULT ''::character varying NOT NULL,
    "bank_info" "text" DEFAULT ''::"text" NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_settings_singleton" CHECK ("id")
);


ALTER TABLE "control"."commercial_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_signature_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "signature_request_id" "uuid" NOT NULL,
    "signer_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "control"."commercial_signature_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."commercial_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_key" character varying(60) NOT NULL,
    "template_type" character varying(40) NOT NULL,
    "content" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commercial_templates_template_type_check" CHECK ((("template_type")::"text" = ANY ((ARRAY['quote_terms'::character varying, 'contract_preamble'::character varying])::"text"[]))),
    CONSTRAINT "commercial_templates_version_check" CHECK (("version" > 0))
);


ALTER TABLE "control"."commercial_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."import_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "app_slug" "text" NOT NULL,
    "entity" "text" NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_ip" "inet",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "control"."import_audit_logs" OWNER TO "postgres";


COMMENT ON TABLE "control"."import_audit_logs" IS 'Logs de auditoria de operações de importação/exportação';



COMMENT ON COLUMN "control"."import_audit_logs"."action" IS 'template_applied, validation_failed, row_committed, export_generated, job_started, job_completed, etc.';



COMMENT ON COLUMN "control"."import_audit_logs"."details" IS '{"key": "value"} metadata about the action';



CREATE TABLE IF NOT EXISTS "control"."import_export_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "app_slug" "text" DEFAULT 'barber'::"text" NOT NULL,
    "entity" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "direction" "text" NOT NULL,
    "formats" "text"[] DEFAULT ARRAY['csv'::"text", 'xlsx'::"text"] NOT NULL,
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "version" integer DEFAULT 1 NOT NULL,
    "column_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "required_columns" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "optional_columns" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "validation_rules" "jsonb",
    "normalization_rules" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "import_export_templates_direction_check" CHECK (("direction" = ANY (ARRAY['import'::"text", 'export'::"text", 'both'::"text"])))
);


ALTER TABLE "control"."import_export_templates" OWNER TO "postgres";


COMMENT ON TABLE "control"."import_export_templates" IS 'Templates de importação/exportação por entidade e tenant';



COMMENT ON COLUMN "control"."import_export_templates"."column_mapping" IS '{"CSV Column Name": "entity_field_name"}';



COMMENT ON COLUMN "control"."import_export_templates"."validation_rules" IS '{"field_name": {"type": "string", "min": 1, "pattern": "regex"}}';



COMMENT ON COLUMN "control"."import_export_templates"."normalization_rules" IS '{"field_name": {"phone_br": true, "date_br": true, "currency": true}}';



CREATE TABLE IF NOT EXISTS "control"."import_job_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "action_taken" "text",
    "original_data" "jsonb" NOT NULL,
    "normalized_data" "jsonb",
    "errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "warnings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "result_id" "uuid",
    "processed_at" timestamp with time zone,
    CONSTRAINT "import_job_rows_action_taken_check" CHECK (("action_taken" = ANY (ARRAY['create'::"text", 'update'::"text", 'skip'::"text", 'error'::"text"]))),
    CONSTRAINT "import_job_rows_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'valid'::"text", 'invalid'::"text", 'skipped'::"text"])))
);


ALTER TABLE "control"."import_job_rows" OWNER TO "postgres";


COMMENT ON TABLE "control"."import_job_rows" IS 'Linhas processadas por job de importação';



COMMENT ON COLUMN "control"."import_job_rows"."errors" IS '[{"field": "error message", ...}]';



COMMENT ON COLUMN "control"."import_job_rows"."warnings" IS '[{"field": "warning message", ...}]';



CREATE TABLE IF NOT EXISTS "control"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "app_slug" "text" DEFAULT 'barber'::"text" NOT NULL,
    "entity" "text" NOT NULL,
    "template_id" "uuid",
    "direction" "text" NOT NULL,
    "format" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "file_name" "text",
    "file_size" bigint,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "valid_rows" integer DEFAULT 0 NOT NULL,
    "invalid_rows" integer DEFAULT 0 NOT NULL,
    "error_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_count" integer DEFAULT 0 NOT NULL,
    "updated_count" integer DEFAULT 0 NOT NULL,
    "skipped_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "import_jobs_direction_check" CHECK (("direction" = ANY (ARRAY['import'::"text", 'export'::"text"]))),
    CONSTRAINT "import_jobs_format_check" CHECK (("format" = ANY (ARRAY['csv'::"text", 'xlsx'::"text"]))),
    CONSTRAINT "import_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'validating'::"text", 'validated'::"text", 'committing'::"text", 'completed'::"text", 'partial_completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "control"."import_jobs" OWNER TO "postgres";


COMMENT ON TABLE "control"."import_jobs" IS 'Jobs de importação/exportação do sistema SMG';



COMMENT ON COLUMN "control"."import_jobs"."error_summary" IS '{"field": ["error messages"]}';



CREATE TABLE IF NOT EXISTS "control"."integration_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_app_id" "uuid" NOT NULL,
    "source" character varying(100) NOT NULL,
    "action" character varying(100) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "request_id" character varying(100),
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "integration_logs_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['success'::character varying, 'failed'::character varying, 'pending'::character varying, 'warning'::character varying])::"text"[])))
);


ALTER TABLE "control"."integration_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "import_job_id" "uuid",
    "movement_type" "text" NOT NULL,
    "quantity_change" integer NOT NULL,
    "quantity_before" integer NOT NULL,
    "quantity_after" integer NOT NULL,
    "reason" "text",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_movements_movement_type_check" CHECK (("movement_type" = ANY (ARRAY['import_initial'::"text", 'import_adjustment'::"text", 'sale'::"text", 'purchase_order_received'::"text", 'manual_adjustment'::"text", 'stock_count'::"text", 'return'::"text"])))
);


ALTER TABLE "control"."inventory_movements" OWNER TO "postgres";


COMMENT ON TABLE "control"."inventory_movements" IS 'Histórico de movimentações de estoque por produto';



COMMENT ON COLUMN "control"."inventory_movements"."import_job_id" IS 'Quando a movimentação veio de uma importação';



COMMENT ON COLUMN "control"."inventory_movements"."movement_type" IS 'Tipo: import_initial, import_adjustment, sale, purchase_order_received, manual_adjustment, stock_count, return';



COMMENT ON COLUMN "control"."inventory_movements"."quantity_change" IS 'Positivo para entrada, negativo para saída';



CREATE TABLE IF NOT EXISTS "control"."smg_client_apps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "smg_client_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "app_slug" character varying(50) NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "schema_name" character varying(50) NOT NULL,
    "environment" character varying(50) DEFAULT 'production'::character varying,
    "status" character varying(50) DEFAULT 'active'::character varying,
    "health_status" character varying(50) DEFAULT 'unknown'::character varying,
    "last_seen_at" timestamp with time zone,
    "supabase_project_ref" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "control"."smg_client_apps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."smg_clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "document" character varying(50) NOT NULL,
    "email" character varying(255),
    "phone" character varying(50),
    "status" character varying(50) DEFAULT 'active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "control"."smg_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "control"."smg_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(50) NOT NULL,
    "description" "text",
    "status" character varying(50) DEFAULT 'active'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "control"."smg_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_api_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "request_id" "text" NOT NULL,
    "route" "text" NOT NULL,
    "method" "text" NOT NULL,
    "status_code" integer NOT NULL,
    "duration_ms" integer NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "platform"."platform_api_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "actor_user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "request_id" "text",
    "metadata" "jsonb",
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "platform"."platform_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "request_id" "text",
    "route" "text",
    "method" "text",
    "error_code" "text" NOT NULL,
    "message" "text" NOT NULL,
    "stack" "text",
    "details" "jsonb",
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "platform"."platform_error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_enabled" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "key" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "status" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "key" "text" NOT NULL,
    "payload" "jsonb",
    "status" "platform"."PlatformJobStatus" DEFAULT 'PENDING'::"platform"."PlatformJobStatus" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "scheduled_at" timestamp(6) with time zone,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "module" "text" NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "platform"."platform_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT true NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "actor_user_id" "uuid",
    "event_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "request_id" "text",
    "ip_address" "text",
    "details" "jsonb",
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE "platform"."platform_security_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid",
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "platform"."PlatformTenantStatus" DEFAULT 'ACTIVE'::"platform"."PlatformTenantStatus" NOT NULL,
    "is_blocked" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb",
    "blocked_at" timestamp(6) with time zone,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_user_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_user_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "platform"."platform_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "refresh_token_hash" "text",
    "refresh_token_until" timestamp(6) with time zone,
    "status" "platform"."PlatformUserStatus" DEFAULT 'ACTIVE'::"platform"."PlatformUserStatus" NOT NULL,
    "is_platform_admin" boolean DEFAULT false NOT NULL,
    "last_login_at" timestamp(6) with time zone,
    "created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp(6) with time zone NOT NULL
);


ALTER TABLE "platform"."platform_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."_prisma_migrations" (
    "id" character varying(36) NOT NULL,
    "checksum" character varying(64) NOT NULL,
    "finished_at" timestamp with time zone,
    "migration_name" character varying(255) NOT NULL,
    "logs" "text",
    "rolled_back_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_steps_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."_prisma_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_name" "text",
    "owner_name" "text",
    "email" "text",
    "phone" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resource_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "level" "text" NOT NULL,
    "current_value" numeric,
    "limit_value" numeric,
    "usage_pct" numeric,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alerts_level_check" CHECK (("level" = ANY (ARRAY['warning'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."appointment_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "appointment_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."appointment_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tenant_id" "uuid",
    CONSTRAINT "audit_logs_action_check" CHECK (("action" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."barber_closings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "cash_closing_id" "uuid" NOT NULL,
    "business_date" "date" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "total_produced" numeric DEFAULT 0 NOT NULL,
    "total_received" numeric DEFAULT 0 NOT NULL,
    "commission_total" numeric DEFAULT 0 NOT NULL,
    "repasse_total" numeric DEFAULT 0 NOT NULL,
    "discounts_total" numeric DEFAULT 0 NOT NULL,
    "advances_total" numeric DEFAULT 0 NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "payment_methods" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "counted_cash" numeric DEFAULT 0 NOT NULL,
    "expected_cash" numeric DEFAULT 0 NOT NULL,
    "cash_difference" numeric DEFAULT 0 NOT NULL,
    "conference_justification" "text",
    "checklist" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "comandas_count" integer DEFAULT 0 NOT NULL,
    "clients_served_count" integer DEFAULT 0 NOT NULL,
    "products_sold_count" integer DEFAULT 0 NOT NULL,
    "closed_by_user_id" "uuid",
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "barber_closings_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'discrepancy'::"text"])))
);


ALTER TABLE "public"."barber_closings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_closing_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "cash_closing_id" "uuid",
    "barber_closing_id" "uuid",
    "business_date" "date" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "label" "text" NOT NULL,
    "detail" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cash_closing_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['opening'::"text", 'service'::"text", 'sangria'::"text", 'suprimento'::"text", 'reversal'::"text", 'closing'::"text", 'barber_closing'::"text", 'audit'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."cash_closing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_closings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "business_date" "date" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by_user_id" "uuid",
    "confirmed_by_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "confirmed_at" timestamp with time zone,
    "notes" "text",
    "expected_income" numeric DEFAULT 0 NOT NULL,
    "expected_expense" numeric DEFAULT 0 NOT NULL,
    "expected_balance" numeric DEFAULT 0 NOT NULL,
    "total_counted" numeric DEFAULT 0 NOT NULL,
    "total_difference" numeric DEFAULT 0 NOT NULL,
    "appointments_scheduled_count" integer DEFAULT 0 NOT NULL,
    "appointments_completed_count" integer DEFAULT 0 NOT NULL,
    "appointments_received_count" integer DEFAULT 0 NOT NULL,
    "appointments_cancelled_count" integer DEFAULT 0 NOT NULL,
    "appointments_pending_count" integer DEFAULT 0 NOT NULL,
    "appointments_no_show_count" integer DEFAULT 0 NOT NULL,
    "appointments_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "financial_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "opening_time" timestamp with time zone,
    "closing_time" timestamp with time zone,
    "ip_address" "text",
    "user_agent" "text",
    "total_sangrias" numeric DEFAULT 0 NOT NULL,
    "total_suprimentos" numeric DEFAULT 0 NOT NULL,
    "barber_closings_count" integer DEFAULT 0 NOT NULL,
    "barber_closings_complete" boolean DEFAULT false NOT NULL,
    CONSTRAINT "cash_closings_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'confirmed'::"text", 'adjusted'::"text"])))
);


ALTER TABLE "public"."cash_closings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cash_closings"."opening_time" IS 'When the cash register was opened for the day';



COMMENT ON COLUMN "public"."cash_closings"."closing_time" IS 'When the cash register was officially closed';



COMMENT ON COLUMN "public"."cash_closings"."total_sangrias" IS 'Sum of all sangria amounts for the day';



COMMENT ON COLUMN "public"."cash_closings"."total_suprimentos" IS 'Sum of all suprimento amounts for the day';



COMMENT ON COLUMN "public"."cash_closings"."barber_closings_count" IS 'Number of individual barber closings completed';



COMMENT ON COLUMN "public"."cash_closings"."barber_closings_complete" IS 'True when all frontline barbers have closed';



CREATE OR REPLACE VIEW "public"."comandas_health" WITH ("security_invoker"='true') AS
 SELECT "status",
    "count"(*) AS "total",
    "count"(*) FILTER (WHERE ("status" = 'open'::"text")) AS "open_comandas",
    "count"(*) FILTER (WHERE ("status" = 'paid'::"text")) AS "paid_comandas",
    "count"(*) FILTER (WHERE ("status" = 'cancelled'::"text")) AS "cancelled_comandas",
    "count"(*) FILTER (WHERE (("created_at" < ("now"() - '24:00:00'::interval)) AND ("status" = 'open'::"text"))) AS "stale_open",
    "sum"("total") FILTER (WHERE ("status" = 'paid'::"text")) AS "total_paid"
   FROM "public"."comandas" "c"
  GROUP BY "status";


ALTER VIEW "public"."comandas_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_benefit_consumptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "plan_benefit_id" "uuid",
    "comanda_id" "uuid" NOT NULL,
    "comanda_item_id" "uuid" NOT NULL,
    "benefit_code" "text" NOT NULL,
    "benefit_label" "text" NOT NULL,
    "quantity_used" integer DEFAULT 1 NOT NULL,
    "balance_before" integer DEFAULT 0 NOT NULL,
    "balance_after" integer DEFAULT 0 NOT NULL,
    "original_unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "final_unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "override_mode" "text" DEFAULT 'auto'::"text" NOT NULL,
    "override_reason" "text" DEFAULT ''::"text" NOT NULL,
    "consumed_by" "uuid",
    "consumed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "customer_benefit_consumptions_override_mode_check" CHECK (("override_mode" = ANY (ARRAY['auto'::"text", 'manual'::"text", 'none'::"text"]))),
    CONSTRAINT "customer_benefit_consumptions_quantity_used_check" CHECK (("quantity_used" > 0))
);


ALTER TABLE "public"."customer_benefit_consumptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "available_credits" integer DEFAULT 0 NOT NULL,
    "used_credits" integer DEFAULT 0 NOT NULL,
    "period_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "period_end" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "benefit_code" "text" DEFAULT 'generic_service'::"text" NOT NULL,
    "benefit_label" "text" DEFAULT 'Creditos de Servico'::"text" NOT NULL,
    "source_plan_benefit_id" "uuid",
    "last_consumed_at" timestamp with time zone,
    "service_balance_map" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);


ALTER TABLE "public"."customer_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_plan_benefits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "benefit_code" "text" NOT NULL,
    "benefit_label" "text" NOT NULL,
    "monthly_quantity" integer DEFAULT 0 NOT NULL,
    "benefit_scope" "text" DEFAULT 'service'::"text" NOT NULL,
    "eligible_service_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "eligible_service_names" "text"[] DEFAULT '{}'::"text"[],
    "eligible_service_categories" "text"[] DEFAULT '{}'::"text"[],
    "active" boolean DEFAULT true NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_plan_benefits_benefit_scope_check" CHECK (("benefit_scope" = ANY (ARRAY['service'::"text", 'product'::"text", 'combo'::"text", 'manual'::"text"]))),
    CONSTRAINT "customer_plan_benefits_monthly_quantity_check" CHECK (("monthly_quantity" >= 0))
);


ALTER TABLE "public"."customer_plan_benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_plan_credit_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "comanda_id" "uuid",
    "comanda_item_id" "uuid",
    "appointment_id" "uuid",
    "professional_id" "uuid",
    "credit_key" "text" DEFAULT 'default'::"text" NOT NULL,
    "quantity_used" integer DEFAULT 1 NOT NULL,
    "original_price" numeric(10,2),
    "credit_effect" numeric(10,2) DEFAULT 0,
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_plan_credit_usages_quantity_used_check" CHECK (("quantity_used" > 0))
);


ALTER TABLE "public"."customer_plan_credit_usages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_subscription_receivables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "billing_cycle_start" timestamp with time zone NOT NULL,
    "billing_cycle_end" timestamp with time zone NOT NULL,
    "due_date" "date" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_method" "text",
    "paid_at" timestamp with time zone,
    "paid_by" "uuid",
    "transaction_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_subscription_receivables_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "customer_subscription_receivables_check" CHECK (("billing_cycle_end" > "billing_cycle_start")),
    CONSTRAINT "customer_subscription_receivables_check1" CHECK (((("status" = 'paid'::"text") AND ("paid_at" IS NOT NULL)) OR ("status" <> 'paid'::"text"))),
    CONSTRAINT "customer_subscription_receivables_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'overdue'::"text", 'cancelled'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."customer_subscription_receivables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_reversals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "original_transaction_id" "uuid" NOT NULL,
    "reversal_transaction_id" "uuid",
    "source_type" "text",
    "source_id" "uuid",
    "reversal_type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "reason_type" "text" NOT NULL,
    "reason_note" "text" NOT NULL,
    "refund_method" "text",
    "idempotency_key" "text",
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "financial_reversals_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "financial_reversals_reversal_type_check" CHECK (("reversal_type" = ANY (ARRAY['wrong_settlement'::"text", 'full_refund'::"text", 'partial_refund'::"text", 'duplicate_charge'::"text", 'administrative_cancellation'::"text", 'financial_review'::"text"])))
);


ALTER TABLE "public"."financial_reversals" OWNER TO "postgres";


COMMENT ON TABLE "public"."financial_reversals" IS 'Auditoria de estornos, reversoes e devolucoes financeiras. A aplicacao real depende de RPC transacional.';



CREATE TABLE IF NOT EXISTS "public"."kiosk_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'disabled'::"text" NOT NULL,
    "activated_at" timestamp with time zone,
    "max_devices" integer DEFAULT 1,
    "kiosk_theme" "text" DEFAULT 'default'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "kiosk_addons_kiosk_theme_check" CHECK (("kiosk_theme" = ANY (ARRAY['default'::"text", 'sanchez'::"text", 'custom'::"text"]))),
    CONSTRAINT "kiosk_addons_status_check" CHECK (("status" = ANY (ARRAY['enabled'::"text", 'disabled'::"text"])))
);


ALTER TABLE "public"."kiosk_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."managers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."managers" OWNER TO "postgres";


COMMENT ON TABLE "public"."managers" IS 'Varejo MVP: Store managers. Distinct from staff (sellers/cashiers).';



CREATE TABLE IF NOT EXISTS "public"."notification_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_type" "text" NOT NULL,
    "target" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "last_triggered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_channels_channel_type_check" CHECK (("channel_type" = ANY (ARRAY['email'::"text", 'webhook'::"text", 'internal'::"text"])))
);


ALTER TABLE "public"."notification_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_preferences_type_check" CHECK (("type" = ANY (ARRAY['comanda_aberta'::"text", 'estoque_baixo'::"text", 'pagamento_a_realizar'::"text", 'cobranca_clube_chefes'::"text", 'proximo_cliente'::"text", 'cliente_atrasado'::"text"])))
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "entity_type" "text",
    "entity_id" "uuid",
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "notifications_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"]))),
    CONSTRAINT "notifications_status_check" CHECK (("status" = ANY (ARRAY['unread'::"text", 'read'::"text", 'archived'::"text"]))),
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['comanda_aberta'::"text", 'estoque_baixo'::"text", 'pagamento_a_realizar'::"text", 'cobranca_clube_chefes'::"text", 'proximo_cliente'::"text", 'cliente_atrasado'::"text", 'appointment_reminder'::"text", 'stock_low'::"text", 'purchase_request'::"text", 'transaction'::"text", 'system_alert'::"text", 'admin_message'::"text", 'STOCK_LOW'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otp_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "phone" character varying(20) NOT NULL,
    "code_hash" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0,
    "last_sent_at" timestamp with time zone,
    "status" character varying(20) DEFAULT 'pending'::character varying
);


ALTER TABLE "public"."otp_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_plan" "text",
    "requested_plan" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "plan_change_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."plan_change_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portal_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "token_hash" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"(),
    "device_fingerprint" character varying(255)
);


ALTER TABLE "public"."portal_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "tenant_id" "uuid",
    "full_name" "text",
    "role" "text" DEFAULT 'staff'::"text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_completed" boolean DEFAULT false,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['superadmin'::"text", 'manager'::"text", 'staff'::"text", 'barber'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "permission_key" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "role_permissions_role_check" CHECK (("role" = ANY (ARRAY['Barber'::"text", 'Receptionist'::"text"])))
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "permission_key" "text" NOT NULL,
    "old_enabled" boolean,
    "new_enabled" boolean NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "role_permissions_audit_role_check" CHECK (("role" = ANY (ARRAY['Barber'::"text", 'Receptionist'::"text"])))
);


ALTER TABLE "public"."role_permissions_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_execution_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comanda_item_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'assistant'::"text" NOT NULL,
    "payout_type" "text" DEFAULT 'percentage'::"text" NOT NULL,
    "payout_value" numeric(10,2) DEFAULT 0 NOT NULL,
    "payout_amount_calculated" numeric(10,2),
    "affects_revenue" boolean DEFAULT true NOT NULL,
    "affects_commission" boolean DEFAULT true NOT NULL,
    "tenant_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "service_execution_participants_payout_type_check" CHECK (("payout_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "service_execution_participants_role_check" CHECK (("role" = ANY (ARRAY['primary'::"text", 'assistant'::"text", 'co_executor'::"text"])))
);


ALTER TABLE "public"."service_execution_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid",
    CONSTRAINT "support_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'responded'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "addon_key" "text",
    "status" "text",
    "limits" "jsonb"
);


ALTER TABLE "public"."tenant_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "period" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "revenue_goal" numeric(12,2) DEFAULT 0 NOT NULL,
    "appointments_goal" integer DEFAULT 0 NOT NULL,
    "clients_goal" integer DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenant_goals_period_check" CHECK (("period" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."tenant_goals" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_goals" IS 'Configurable business goals per tenant for dashboard KPIs';



COMMENT ON COLUMN "public"."tenant_goals"."period" IS 'Goal period: weekly, monthly, or yearly';



COMMENT ON COLUMN "public"."tenant_goals"."revenue_goal" IS 'Revenue target for the period';



COMMENT ON COLUMN "public"."tenant_goals"."appointments_goal" IS 'Number of appointments target for the period';



COMMENT ON COLUMN "public"."tenant_goals"."clients_goal" IS 'New clients target for the period';



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "app_slug" "text" DEFAULT 'barber'::"text" NOT NULL,
    CONSTRAINT "tenants_app_slug_check" CHECK (("app_slug" = ANY (ARRAY['barber'::"text", 'auto'::"text", 'club'::"text", 'estetica'::"text"])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid",
    "sender_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resource_type" "text" NOT NULL,
    "value" numeric NOT NULL,
    "limit_value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'manager'::"text" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "varejo"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "type" "text",
    "quantity" integer NOT NULL,
    "reason" "text",
    "order_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_movements_type_check" CHECK (("type" = ANY (ARRAY['in'::"text", 'out'::"text", 'adjust'::"text", 'sale'::"text"])))
);


ALTER TABLE "varejo"."inventory_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "varejo"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "subtotal" numeric(12,2) NOT NULL,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "varejo"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "varejo"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "seller_id" "uuid",
    "manager_id" "uuid",
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_status" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['paid'::"text", 'pending'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "varejo"."orders" OWNER TO "postgres";


ALTER TABLE ONLY "club"."customer_credits"
    ADD CONSTRAINT "customer_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "club"."customer_credits"
    ADD CONSTRAINT "customer_credits_subscription_id_key" UNIQUE ("subscription_id");



ALTER TABLE ONLY "club"."customer_plans"
    ADD CONSTRAINT "customer_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "club"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."app_health_checks"
    ADD CONSTRAINT "app_health_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."app_incidents"
    ADD CONSTRAINT "app_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_audit_logs"
    ADD CONSTRAINT "commercial_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_clients"
    ADD CONSTRAINT "commercial_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_contract_clauses"
    ADD CONSTRAINT "commercial_contract_clauses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_contracts"
    ADD CONSTRAINT "commercial_contracts_contract_number_key" UNIQUE ("contract_number");



ALTER TABLE ONLY "control"."commercial_contracts"
    ADD CONSTRAINT "commercial_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_contracts"
    ADD CONSTRAINT "commercial_contracts_quote_id_key" UNIQUE ("quote_id");



ALTER TABLE ONLY "control"."commercial_documents"
    ADD CONSTRAINT "commercial_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_product_features"
    ADD CONSTRAINT "commercial_product_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_product_phases"
    ADD CONSTRAINT "commercial_product_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_product_test_phases"
    ADD CONSTRAINT "commercial_product_test_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_products"
    ADD CONSTRAINT "commercial_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_products"
    ADD CONSTRAINT "commercial_products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "control"."commercial_quote_phases"
    ADD CONSTRAINT "commercial_quote_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_quote_number_key" UNIQUE ("quote_number");



ALTER TABLE ONLY "control"."commercial_settings"
    ADD CONSTRAINT "commercial_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_signature_events"
    ADD CONSTRAINT "commercial_signature_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_signature_message_templates"
    ADD CONSTRAINT "commercial_signature_message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_signature_public_tokens"
    ADD CONSTRAINT "commercial_signature_public_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_signature_public_tokens"
    ADD CONSTRAINT "commercial_signature_public_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "control"."commercial_signature_requests"
    ADD CONSTRAINT "commercial_signature_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_signers"
    ADD CONSTRAINT "commercial_signers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_templates"
    ADD CONSTRAINT "commercial_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."commercial_templates"
    ADD CONSTRAINT "commercial_templates_template_key_key" UNIQUE ("template_key");



ALTER TABLE ONLY "control"."import_audit_logs"
    ADD CONSTRAINT "import_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."import_export_templates"
    ADD CONSTRAINT "import_export_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_job_row_unique" UNIQUE ("job_id", "row_number");



ALTER TABLE ONLY "control"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."integration_logs"
    ADD CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."smg_client_apps"
    ADD CONSTRAINT "smg_client_apps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."smg_clients"
    ADD CONSTRAINT "smg_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."smg_products"
    ADD CONSTRAINT "smg_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "control"."smg_products"
    ADD CONSTRAINT "smg_products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "platform"."platform_api_logs"
    ADD CONSTRAINT "platform_api_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_audit_logs"
    ADD CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_error_logs"
    ADD CONSTRAINT "platform_error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_feature_flags"
    ADD CONSTRAINT "platform_feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_integrations"
    ADD CONSTRAINT "platform_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_jobs"
    ADD CONSTRAINT "platform_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_permissions"
    ADD CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_plans"
    ADD CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_role_permissions"
    ADD CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_roles"
    ADD CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_security_events"
    ADD CONSTRAINT "platform_security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_tenants"
    ADD CONSTRAINT "platform_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_user_tenants"
    ADD CONSTRAINT "platform_user_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "platform"."platform_users"
    ADD CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "_l_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "_l_comanda_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "_l_comandas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_blocks"
    ADD CONSTRAINT "_l_schedule_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "_l_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_prisma_migrations"
    ADD CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."access_requests"
    ADD CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barber_closings"
    ADD CONSTRAINT "barber_closings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."barber_closings"
    ADD CONSTRAINT "barber_closings_tenant_id_cash_closing_id_staff_id_key" UNIQUE ("tenant_id", "cash_closing_id", "staff_id");



ALTER TABLE ONLY "public"."cash_closing_events"
    ADD CONSTRAINT "cash_closing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_closings"
    ADD CONSTRAINT "cash_closings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_closings"
    ADD CONSTRAINT "cash_closings_tenant_id_business_date_key" UNIQUE ("tenant_id", "business_date");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_comanda_item_id_key" UNIQUE ("comanda_item_id");



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_credits"
    ADD CONSTRAINT "customer_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_credits"
    ADD CONSTRAINT "customer_credits_subscription_id_key" UNIQUE ("subscription_id");



ALTER TABLE ONLY "public"."customer_plan_benefits"
    ADD CONSTRAINT "customer_plan_benefits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_plan_benefits"
    ADD CONSTRAINT "customer_plan_benefits_plan_id_benefit_code_key" UNIQUE ("plan_id", "benefit_code");



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_plans"
    ADD CONSTRAINT "customer_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_plans"
    ADD CONSTRAINT "customer_plans_tenant_id_name_key" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."customer_subscription_receivables"
    ADD CONSTRAINT "customer_subscription_receiva_subscription_id_billing_cycle_key" UNIQUE ("subscription_id", "billing_cycle_start", "billing_cycle_end");



ALTER TABLE ONLY "public"."customer_subscription_receivables"
    ADD CONSTRAINT "customer_subscription_receivables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_barber"
    ADD CONSTRAINT "feedback_barber_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_shop"
    ADD CONSTRAINT "feedback_shop_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_reversals"
    ADD CONSTRAINT "financial_reversals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_addons"
    ADD CONSTRAINT "kiosk_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_addons"
    ADD CONSTRAINT "kiosk_addons_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."kiosk_devices"
    ADD CONSTRAINT "kiosk_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_sessions"
    ADD CONSTRAINT "kiosk_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_channels"
    ADD CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_tenant_id_user_id_type_key" UNIQUE ("tenant_id", "user_id", "type");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otp_requests"
    ADD CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_change_requests"
    ADD CONSTRAINT "plan_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portal_sessions"
    ADD CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions_audit"
    ADD CONSTRAINT "role_permissions_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_tenant_id_role_permission_key_key" UNIQUE ("tenant_id", "role", "permission_key");



ALTER TABLE ONLY "public"."service_execution_participants"
    ADD CONSTRAINT "service_execution_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_addons"
    ADD CONSTRAINT "tenant_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_goals"
    ADD CONSTRAINT "tenant_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_logs"
    ADD CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "varejo"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "varejo"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "varejo"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_commercial_audit_logs_entity" ON "control"."commercial_audit_logs" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "idx_commercial_contract_clauses_contract" ON "control"."commercial_contract_clauses" USING "btree" ("contract_id", "sort_order");



CREATE INDEX "idx_commercial_documents_contract" ON "control"."commercial_documents" USING "btree" ("contract_id", "version" DESC) WHERE ("contract_id" IS NOT NULL);



CREATE INDEX "idx_commercial_documents_quote" ON "control"."commercial_documents" USING "btree" ("quote_id", "version" DESC) WHERE ("quote_id" IS NOT NULL);



CREATE INDEX "idx_commercial_documents_type" ON "control"."commercial_documents" USING "btree" ("document_type", "status", "created_at" DESC);



CREATE INDEX "idx_commercial_product_features_product" ON "control"."commercial_product_features" USING "btree" ("commercial_product_id", "sort_order");



CREATE INDEX "idx_commercial_product_phases_product" ON "control"."commercial_product_phases" USING "btree" ("commercial_product_id", "sort_order");



CREATE INDEX "idx_commercial_product_test_phases_product" ON "control"."commercial_product_test_phases" USING "btree" ("commercial_product_id", "sort_order");



CREATE INDEX "idx_commercial_quote_phases_quote" ON "control"."commercial_quote_phases" USING "btree" ("quote_id", "sort_order");



CREATE INDEX "idx_commercial_quotes_client" ON "control"."commercial_quotes" USING "btree" ("commercial_client_id");



CREATE INDEX "idx_commercial_quotes_product" ON "control"."commercial_quotes" USING "btree" ("commercial_product_id");



CREATE INDEX "idx_commercial_quotes_status" ON "control"."commercial_quotes" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_commercial_signature_events_request" ON "control"."commercial_signature_events" USING "btree" ("signature_request_id", "created_at" DESC);



CREATE INDEX "idx_commercial_signature_message_templates_lookup" ON "control"."commercial_signature_message_templates" USING "btree" ("channel", "template_key", "version" DESC);



CREATE INDEX "idx_commercial_signature_public_tokens_request" ON "control"."commercial_signature_public_tokens" USING "btree" ("signature_request_id", "created_at" DESC);



CREATE INDEX "idx_commercial_signature_public_tokens_signer" ON "control"."commercial_signature_public_tokens" USING "btree" ("signer_id", "created_at" DESC);



CREATE INDEX "idx_commercial_signature_requests_contract" ON "control"."commercial_signature_requests" USING "btree" ("contract_id", "created_at" DESC);



CREATE INDEX "idx_commercial_signature_requests_document" ON "control"."commercial_signature_requests" USING "btree" ("document_id", "created_at" DESC);



CREATE INDEX "idx_commercial_signature_requests_quote" ON "control"."commercial_signature_requests" USING "btree" ("quote_id", "created_at" DESC);



CREATE INDEX "idx_commercial_signers_request" ON "control"."commercial_signers" USING "btree" ("signature_request_id", "signer_type");



CREATE INDEX "idx_health_checks_client_app" ON "control"."app_health_checks" USING "btree" ("client_app_id", "checked_at" DESC);



CREATE INDEX "idx_import_audit_logs_action" ON "control"."import_audit_logs" USING "btree" ("action");



CREATE INDEX "idx_import_audit_logs_actor_id" ON "control"."import_audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_import_audit_logs_created_at" ON "control"."import_audit_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_import_audit_logs_entity" ON "control"."import_audit_logs" USING "btree" ("entity");



CREATE INDEX "idx_import_audit_logs_job_id" ON "control"."import_audit_logs" USING "btree" ("job_id");



CREATE INDEX "idx_import_audit_logs_tenant_id" ON "control"."import_audit_logs" USING "btree" ("tenant_id");



CREATE INDEX "idx_import_export_templates_active" ON "control"."import_export_templates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_import_export_templates_app_slug" ON "control"."import_export_templates" USING "btree" ("app_slug");



CREATE INDEX "idx_import_export_templates_entity" ON "control"."import_export_templates" USING "btree" ("entity");



CREATE INDEX "idx_import_export_templates_tenant_id" ON "control"."import_export_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_import_job_rows_action_taken" ON "control"."import_job_rows" USING "btree" ("action_taken") WHERE ("action_taken" IS NOT NULL);



CREATE INDEX "idx_import_job_rows_job_id" ON "control"."import_job_rows" USING "btree" ("job_id");



CREATE INDEX "idx_import_job_rows_status" ON "control"."import_job_rows" USING "btree" ("status") WHERE ("status" <> 'pending'::"text");



CREATE INDEX "idx_import_jobs_created_at" ON "control"."import_jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_import_jobs_created_by" ON "control"."import_jobs" USING "btree" ("created_by");



CREATE INDEX "idx_import_jobs_entity" ON "control"."import_jobs" USING "btree" ("entity");



CREATE INDEX "idx_import_jobs_status" ON "control"."import_jobs" USING "btree" ("status");



CREATE INDEX "idx_import_jobs_tenant_entity_status" ON "control"."import_jobs" USING "btree" ("tenant_id", "entity", "status");



CREATE INDEX "idx_import_jobs_tenant_id" ON "control"."import_jobs" USING "btree" ("tenant_id");



CREATE INDEX "idx_incidents_client_app" ON "control"."app_incidents" USING "btree" ("client_app_id", "detected_at" DESC);



CREATE INDEX "idx_incidents_status" ON "control"."app_incidents" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['open'::character varying, 'investigating'::character varying])::"text"[]));



CREATE INDEX "idx_integration_logs_client_app" ON "control"."integration_logs" USING "btree" ("client_app_id", "created_at" DESC);



CREATE INDEX "idx_inventory_movements_created_at" ON "control"."inventory_movements" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_inventory_movements_import_job_id" ON "control"."inventory_movements" USING "btree" ("import_job_id");



CREATE INDEX "idx_inventory_movements_product_id" ON "control"."inventory_movements" USING "btree" ("product_id");



CREATE INDEX "idx_inventory_movements_tenant_id" ON "control"."inventory_movements" USING "btree" ("tenant_id");



CREATE INDEX "idx_inventory_movements_type" ON "control"."inventory_movements" USING "btree" ("movement_type");



CREATE UNIQUE INDEX "import_export_templates_default_global" ON "control"."import_export_templates" USING "btree" ("entity", "direction") WHERE (("is_default" = true) AND ("tenant_id" IS NULL));



CREATE UNIQUE INDEX "import_export_templates_default_tenant" ON "control"."import_export_templates" USING "btree" ("entity", "direction") WHERE (("is_default" = true) AND ("tenant_id" IS NOT NULL));



CREATE UNIQUE INDEX "import_export_templates_global_unique" ON "control"."import_export_templates" USING "btree" ("app_slug", "entity", "name") WHERE ("tenant_id" IS NULL);



CREATE UNIQUE INDEX "import_export_templates_tenant_unique" ON "control"."import_export_templates" USING "btree" ("tenant_id", "app_slug", "entity", "name") WHERE ("tenant_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_commercial_clients_document" ON "control"."commercial_clients" USING "btree" ("document") WHERE (("document")::"text" <> ''::"text");



CREATE UNIQUE INDEX "ux_commercial_documents_contract_version" ON "control"."commercial_documents" USING "btree" ("contract_id", "document_type", "version") WHERE ("contract_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_commercial_documents_quote_version" ON "control"."commercial_documents" USING "btree" ("quote_id", "document_type", "version") WHERE ("quote_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_commercial_signature_message_templates_active" ON "control"."commercial_signature_message_templates" USING "btree" ("channel", "template_key") WHERE ("status" = 'active'::"text");



CREATE UNIQUE INDEX "ux_commercial_signature_requests_active_document" ON "control"."commercial_signature_requests" USING "btree" ("document_id") WHERE ("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'viewed'::"text"]));



CREATE INDEX "platform_api_logs_request_id_idx" ON "platform"."platform_api_logs" USING "btree" ("request_id");



CREATE INDEX "platform_api_logs_tenant_id_idx" ON "platform"."platform_api_logs" USING "btree" ("tenant_id");



CREATE INDEX "platform_api_logs_user_id_idx" ON "platform"."platform_api_logs" USING "btree" ("user_id");



CREATE INDEX "platform_audit_logs_actor_user_id_idx" ON "platform"."platform_audit_logs" USING "btree" ("actor_user_id");



CREATE INDEX "platform_audit_logs_request_id_idx" ON "platform"."platform_audit_logs" USING "btree" ("request_id");



CREATE INDEX "platform_audit_logs_tenant_id_idx" ON "platform"."platform_audit_logs" USING "btree" ("tenant_id");



CREATE INDEX "platform_error_logs_request_id_idx" ON "platform"."platform_error_logs" USING "btree" ("request_id");



CREATE INDEX "platform_error_logs_tenant_id_idx" ON "platform"."platform_error_logs" USING "btree" ("tenant_id");



CREATE INDEX "platform_error_logs_user_id_idx" ON "platform"."platform_error_logs" USING "btree" ("user_id");



CREATE UNIQUE INDEX "platform_feature_flags_tenant_id_key_key" ON "platform"."platform_feature_flags" USING "btree" ("tenant_id", "key");



CREATE UNIQUE INDEX "platform_permissions_code_key" ON "platform"."platform_permissions" USING "btree" ("code");



CREATE UNIQUE INDEX "platform_plans_code_key" ON "platform"."platform_plans" USING "btree" ("code");



CREATE UNIQUE INDEX "platform_role_permissions_role_id_permission_id_key" ON "platform"."platform_role_permissions" USING "btree" ("role_id", "permission_id");



CREATE UNIQUE INDEX "platform_roles_code_key" ON "platform"."platform_roles" USING "btree" ("code");



CREATE INDEX "platform_security_events_actor_user_id_idx" ON "platform"."platform_security_events" USING "btree" ("actor_user_id");



CREATE INDEX "platform_security_events_request_id_idx" ON "platform"."platform_security_events" USING "btree" ("request_id");



CREATE INDEX "platform_security_events_tenant_id_idx" ON "platform"."platform_security_events" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "platform_tenants_slug_key" ON "platform"."platform_tenants" USING "btree" ("slug");



CREATE UNIQUE INDEX "platform_user_tenants_tenant_id_user_id_key" ON "platform"."platform_user_tenants" USING "btree" ("tenant_id", "user_id");



CREATE UNIQUE INDEX "platform_users_email_key" ON "platform"."platform_users" USING "btree" ("email");



CREATE INDEX "_l_idx_appointments_appointment_at" ON "public"."appointments" USING "btree" ("appointment_at");



CREATE INDEX "_l_idx_appointments_cancellation_reason" ON "public"."appointments" USING "btree" ("cancellation_reason") WHERE ("cancellation_reason" IS NOT NULL);



CREATE INDEX "_l_idx_appointments_cancellation_type" ON "public"."appointments" USING "btree" ("cancellation_type") WHERE ("cancellation_type" IS NOT NULL);



CREATE INDEX "_l_idx_appointments_cancelled_at" ON "public"."appointments" USING "btree" ("cancelled_at") WHERE ("cancelled_at" IS NOT NULL);



CREATE INDEX "_l_idx_appointments_channel" ON "public"."appointments" USING "btree" ("channel");



CREATE INDEX "_l_idx_appointments_client_start" ON "public"."appointments" USING "btree" ("client_id", "start_time" DESC);



CREATE INDEX "_l_idx_appointments_hidden_from_schedule" ON "public"."appointments" USING "btree" ("hidden_from_schedule") WHERE ("hidden_from_schedule" = true);



CREATE INDEX "_l_idx_appointments_idempotency_key" ON "public"."appointments" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "_l_idx_appointments_source" ON "public"."appointments" USING "btree" ("source");



CREATE INDEX "_l_idx_appointments_staff_start" ON "public"."appointments" USING "btree" ("staff_id", "start_time" DESC);



CREATE INDEX "_l_idx_appointments_status" ON "public"."appointments" USING "btree" ("status");



CREATE INDEX "_l_idx_appointments_status_start" ON "public"."appointments" USING "btree" ("status", "start_time" DESC);



CREATE INDEX "_l_idx_appointments_subscription" ON "public"."appointments" USING "btree" ("subscription_id") WHERE ("subscription_id" IS NOT NULL);



CREATE INDEX "_l_idx_appointments_user_email" ON "public"."appointments" USING "btree" ("user_email");



CREATE INDEX "_l_idx_comanda_items_credit_usage" ON "public"."comanda_items" USING "btree" ("comanda_id") WHERE ("paid_with_plan_credit" = true);



CREATE INDEX "_l_idx_comanda_items_service" ON "public"."comanda_items" USING "btree" ("service_id");



CREATE INDEX "_l_idx_comandas_cancellation_type" ON "public"."comandas" USING "btree" ("cancellation_type") WHERE ("cancellation_type" IS NOT NULL);



CREATE INDEX "_l_idx_comandas_client_status" ON "public"."comandas" USING "btree" ("client_id", "status");



CREATE INDEX "_l_idx_comandas_hidden_from_financial" ON "public"."comandas" USING "btree" ("hidden_from_financial") WHERE ("hidden_from_financial" = true);



CREATE INDEX "_l_idx_comandas_idempotency_key" ON "public"."comandas" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "_l_idx_comandas_tenant_payment_date_real" ON "public"."comandas" USING "btree" ("tenant_id", "payment_date_real" DESC) WHERE ("payment_date_real" IS NOT NULL);



CREATE INDEX "_l_idx_comandas_tenant_settled_at" ON "public"."comandas" USING "btree" ("tenant_id", "settled_at" DESC) WHERE ("settled_at" IS NOT NULL);



CREATE INDEX "_l_idx_comandas_tenant_status" ON "public"."comandas" USING "btree" ("tenant_id", "status");



CREATE INDEX "_l_idx_schedule_blocks_professional" ON "public"."schedule_blocks" USING "btree" ("tenant_id", "professional_id", "status");



CREATE INDEX "_l_idx_schedule_blocks_tenant_dates" ON "public"."schedule_blocks" USING "btree" ("tenant_id", "start_date", "end_date");



CREATE INDEX "_l_idx_services_tenant_active" ON "public"."services" USING "btree" ("tenant_id", "active");



CREATE INDEX "alerts_resource_type_created_at_idx" ON "public"."alerts" USING "btree" ("resource_type", "created_at" DESC);



CREATE UNIQUE INDEX "appointments_tenant_idempotency_key_idx" ON "public"."appointments" USING "btree" ("tenant_id", "idempotency_key") WHERE (("tenant_id" IS NOT NULL) AND ("idempotency_key" IS NOT NULL));



CREATE UNIQUE INDEX "clients_tenant_idempotency_key_idx" ON "public"."clients" USING "btree" ("tenant_id", "idempotency_key") WHERE (("tenant_id" IS NOT NULL) AND ("idempotency_key" IS NOT NULL));



CREATE UNIQUE INDEX "comandas_tenant_idempotency_key_idx" ON "public"."comandas" USING "btree" ("tenant_id", "idempotency_key") WHERE (("tenant_id" IS NOT NULL) AND ("idempotency_key" IS NOT NULL));



CREATE INDEX "idx_appointment_services_appointment_id" ON "public"."appointment_services" USING "btree" ("appointment_id");



CREATE INDEX "idx_appointment_services_service_id" ON "public"."appointment_services" USING "btree" ("service_id");



CREATE INDEX "idx_appointment_services_tenant_id" ON "public"."appointment_services" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "idx_appointment_services_unique" ON "public"."appointment_services" USING "btree" ("appointment_id", "service_id") WHERE ("quantity" = 1);



CREATE INDEX "idx_appointments_idempotency_key" ON "public"."appointments" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_barber_closings_cash_closing" ON "public"."barber_closings" USING "btree" ("cash_closing_id");



CREATE INDEX "idx_barber_closings_staff" ON "public"."barber_closings" USING "btree" ("staff_id");



CREATE INDEX "idx_barber_closings_tenant_date" ON "public"."barber_closings" USING "btree" ("tenant_id", "business_date");



CREATE INDEX "idx_cash_closing_events_barber_closing" ON "public"."cash_closing_events" USING "btree" ("barber_closing_id");



CREATE INDEX "idx_cash_closing_events_cash_closing" ON "public"."cash_closing_events" USING "btree" ("cash_closing_id");



CREATE INDEX "idx_cash_closing_events_tenant_date" ON "public"."cash_closing_events" USING "btree" ("tenant_id", "business_date");



CREATE INDEX "idx_cash_closing_events_time" ON "public"."cash_closing_events" USING "btree" ("tenant_id", "business_date", "event_time");



CREATE INDEX "idx_cash_closings_tenant_date_status" ON "public"."cash_closings" USING "btree" ("tenant_id", "business_date", "status");



CREATE INDEX "idx_clients_tenant_status" ON "public"."clients" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_club_receivables_customer" ON "public"."customer_subscription_receivables" USING "btree" ("tenant_id", "customer_id");



CREATE INDEX "idx_club_receivables_subscription" ON "public"."customer_subscription_receivables" USING "btree" ("subscription_id");



CREATE INDEX "idx_club_receivables_tenant_status_due" ON "public"."customer_subscription_receivables" USING "btree" ("tenant_id", "status", "due_date");



CREATE UNIQUE INDEX "idx_club_receivables_transaction_id" ON "public"."customer_subscription_receivables" USING "btree" ("transaction_id") WHERE ("transaction_id" IS NOT NULL);



CREATE INDEX "idx_comandas_cancellation_type" ON "public"."comandas" USING "btree" ("cancellation_type") WHERE ("cancellation_type" IS NOT NULL);



CREATE INDEX "idx_comandas_hidden_from_financial" ON "public"."comandas" USING "btree" ("hidden_from_financial") WHERE ("hidden_from_financial" = true);



CREATE INDEX "idx_comandas_idempotency_key" ON "public"."comandas" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_credit_usages_client" ON "public"."customer_plan_credit_usages" USING "btree" ("client_id");



CREATE INDEX "idx_credit_usages_comanda" ON "public"."customer_plan_credit_usages" USING "btree" ("comanda_id");



CREATE INDEX "idx_credit_usages_comanda_item" ON "public"."customer_plan_credit_usages" USING "btree" ("comanda_item_id");



CREATE INDEX "idx_credit_usages_period" ON "public"."customer_plan_credit_usages" USING "btree" ("used_at");



CREATE INDEX "idx_credit_usages_professional" ON "public"."customer_plan_credit_usages" USING "btree" ("professional_id");



CREATE INDEX "idx_credit_usages_service" ON "public"."customer_plan_credit_usages" USING "btree" ("service_id");



CREATE INDEX "idx_credit_usages_subscription" ON "public"."customer_plan_credit_usages" USING "btree" ("subscription_id");



CREATE INDEX "idx_credit_usages_tenant" ON "public"."customer_plan_credit_usages" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_benefit_consumptions_comanda" ON "public"."customer_benefit_consumptions" USING "btree" ("comanda_id");



CREATE INDEX "idx_customer_benefit_consumptions_subscription" ON "public"."customer_benefit_consumptions" USING "btree" ("subscription_id");



CREATE INDEX "idx_customer_benefit_consumptions_tenant" ON "public"."customer_benefit_consumptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_credits_benefit_code" ON "public"."customer_credits" USING "btree" ("benefit_code");



CREATE INDEX "idx_customer_credits_client" ON "public"."customer_credits" USING "btree" ("client_id");



CREATE INDEX "idx_customer_credits_subscription" ON "public"."customer_credits" USING "btree" ("subscription_id");



CREATE UNIQUE INDEX "idx_customer_credits_subscription_benefit" ON "public"."customer_credits" USING "btree" ("subscription_id", "benefit_code");



CREATE UNIQUE INDEX "idx_customer_credits_subscription_period" ON "public"."customer_credits" USING "btree" ("tenant_id", "subscription_id", "period_start");



CREATE INDEX "idx_customer_credits_tenant" ON "public"."customer_credits" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_credits_tenant_client_subscription" ON "public"."customer_credits" USING "btree" ("tenant_id", "client_id", "subscription_id");



CREATE INDEX "idx_customer_plan_benefits_plan" ON "public"."customer_plan_benefits" USING "btree" ("plan_id");



CREATE INDEX "idx_customer_plan_benefits_tenant" ON "public"."customer_plan_benefits" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_plans_active" ON "public"."customer_plans" USING "btree" ("active");



CREATE INDEX "idx_customer_plans_tenant" ON "public"."customer_plans" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_plans_tenant_active" ON "public"."customer_plans" USING "btree" ("tenant_id", "active");



CREATE INDEX "idx_customer_subscriptions_client" ON "public"."customer_subscriptions" USING "btree" ("client_id");



CREATE UNIQUE INDEX "idx_customer_subscriptions_one_open_per_client" ON "public"."customer_subscriptions" USING "btree" ("tenant_id", "client_id") WHERE ("status" = ANY (ARRAY['active'::"text", 'past_due'::"text", 'paused'::"text"]));



CREATE INDEX "idx_customer_subscriptions_plan" ON "public"."customer_subscriptions" USING "btree" ("plan_id");



CREATE INDEX "idx_customer_subscriptions_status" ON "public"."customer_subscriptions" USING "btree" ("status");



CREATE INDEX "idx_customer_subscriptions_tenant" ON "public"."customer_subscriptions" USING "btree" ("tenant_id");



CREATE INDEX "idx_customer_subscriptions_tenant_client_status" ON "public"."customer_subscriptions" USING "btree" ("tenant_id", "client_id", "status");



CREATE INDEX "idx_feedback_barber_barber" ON "public"."feedback_barber" USING "btree" ("barber_id");



CREATE INDEX "idx_feedback_barber_tenant" ON "public"."feedback_barber" USING "btree" ("tenant_id");



CREATE INDEX "idx_feedback_barber_tenant_created" ON "public"."feedback_barber" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_feedback_shop_tenant" ON "public"."feedback_shop" USING "btree" ("tenant_id");



CREATE INDEX "idx_financial_reversals_created_at" ON "public"."financial_reversals" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_financial_reversals_original" ON "public"."financial_reversals" USING "btree" ("tenant_id", "original_transaction_id");



CREATE INDEX "idx_financial_reversals_reversal" ON "public"."financial_reversals" USING "btree" ("tenant_id", "reversal_transaction_id") WHERE ("reversal_transaction_id" IS NOT NULL);



CREATE INDEX "idx_financial_reversals_source" ON "public"."financial_reversals" USING "btree" ("tenant_id", "source_type", "source_id");



CREATE UNIQUE INDEX "idx_financial_reversals_tenant_idempotency" ON "public"."financial_reversals" USING "btree" ("tenant_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_kiosk_addons_tenant" ON "public"."kiosk_addons" USING "btree" ("tenant_id");



CREATE INDEX "idx_kiosk_devices_tenant" ON "public"."kiosk_devices" USING "btree" ("tenant_id");



CREATE INDEX "idx_kiosk_sessions_device" ON "public"."kiosk_sessions" USING "btree" ("device_id");



CREATE INDEX "idx_kiosk_sessions_tenant" ON "public"."kiosk_sessions" USING "btree" ("tenant_id");



CREATE INDEX "idx_managers_profile" ON "public"."managers" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "idx_managers_tenant_active" ON "public"."managers" USING "btree" ("tenant_id", "active");



CREATE INDEX "idx_notification_preferences_tenant_user" ON "public"."notification_preferences" USING "btree" ("tenant_id", "user_id");



CREATE INDEX "idx_notification_preferences_type" ON "public"."notification_preferences" USING "btree" ("type");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_status" ON "public"."notifications" USING "btree" ("status");



CREATE INDEX "idx_notifications_tenant_id" ON "public"."notifications" USING "btree" ("tenant_id");



CREATE INDEX "idx_notifications_tenant_status_created" ON "public"."notifications" USING "btree" ("tenant_id", "status", "created_at" DESC);



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE UNIQUE INDEX "idx_notifications_unread_dedupe" ON "public"."notifications" USING "btree" ("tenant_id", "type", COALESCE("entity_type", ''::"text"), COALESCE("entity_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::"uuid")) WHERE ("status" = 'unread'::"text");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_otp_phone" ON "public"."otp_requests" USING "btree" ("phone");



CREATE INDEX "idx_portal_sessions_client" ON "public"."portal_sessions" USING "btree" ("client_id");



CREATE INDEX "idx_portal_sessions_token" ON "public"."portal_sessions" USING "btree" ("token_hash");



CREATE INDEX "idx_products_tenant_active_stock" ON "public"."products" USING "btree" ("tenant_id", "active", "stock_quantity");



CREATE INDEX "idx_products_tenant_barcode" ON "public"."products" USING "btree" ("tenant_id", "barcode") WHERE ("barcode" IS NOT NULL);



CREATE INDEX "idx_products_tenant_category" ON "public"."products" USING "btree" ("tenant_id", "category") WHERE ("category" IS NOT NULL);



CREATE UNIQUE INDEX "idx_products_tenant_sku_unique" ON "public"."products" USING "btree" ("tenant_id", "sku") WHERE ("sku" IS NOT NULL);



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("status");



CREATE INDEX "idx_role_permissions_audit_tenant" ON "public"."role_permissions_audit" USING "btree" ("tenant_id", "changed_at" DESC);



CREATE INDEX "idx_role_permissions_key" ON "public"."role_permissions" USING "btree" ("tenant_id", "role", "permission_key");



CREATE INDEX "idx_role_permissions_tenant_role" ON "public"."role_permissions" USING "btree" ("tenant_id", "role");



CREATE INDEX "idx_service_execution_participants_comanda_item" ON "public"."service_execution_participants" USING "btree" ("comanda_item_id");



CREATE INDEX "idx_service_execution_participants_staff" ON "public"."service_execution_participants" USING "btree" ("staff_id");



CREATE INDEX "idx_service_execution_participants_tenant" ON "public"."service_execution_participants" USING "btree" ("tenant_id");



CREATE INDEX "idx_staff_tenant_status" ON "public"."staff" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_tenant_addons_tenant_key" ON "public"."tenant_addons" USING "btree" ("tenant_id", "addon_key");



CREATE INDEX "idx_tenants_app_slug" ON "public"."tenants" USING "btree" ("app_slug");



CREATE INDEX "idx_transactions_tenant_date" ON "public"."transactions" USING "btree" ("tenant_id", "date" DESC);



CREATE UNIQUE INDEX "idx_transactions_tenant_idempotency_key" ON "public"."transactions" USING "btree" ("tenant_id", "idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_transactions_tenant_source" ON "public"."transactions" USING "btree" ("tenant_id", "source_type", "source_id");



CREATE INDEX "idx_transactions_tenant_type" ON "public"."transactions" USING "btree" ("tenant_id", "type");



CREATE INDEX "idx_transactions_tenant_type_date" ON "public"."transactions" USING "btree" ("tenant_id", "type", "date" DESC);



CREATE INDEX "idx_user_tenants_tenant_id" ON "public"."user_tenants" USING "btree" ("tenant_id");



CREATE INDEX "idx_user_tenants_user_id" ON "public"."user_tenants" USING "btree" ("user_id");



CREATE UNIQUE INDEX "products_tenant_location_code_key" ON "public"."products" USING "btree" ("tenant_id", "location_code") WHERE ("location_code" IS NOT NULL);



CREATE UNIQUE INDEX "services_tenant_location_code_key" ON "public"."services" USING "btree" ("tenant_id", "location_code") WHERE ("location_code" IS NOT NULL);



CREATE INDEX "tenant_goals_tenant_id_idx" ON "public"."tenant_goals" USING "btree" ("tenant_id");



CREATE UNIQUE INDEX "tenant_goals_tenant_period_active_idx" ON "public"."tenant_goals" USING "btree" ("tenant_id", "period") WHERE ("active" = true);



CREATE UNIQUE INDEX "uq_schedule_blocks_unique_active" ON "public"."schedule_blocks" USING "btree" ("tenant_id", COALESCE("professional_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "block_type", "start_date", "end_date", COALESCE("start_time", '00:00:00'::time without time zone), COALESCE("end_time", '00:00:00'::time without time zone), COALESCE("recurrence_type", 'none'::"text"), COALESCE("recurrence_until", "start_date")) WHERE ("status" = 'active'::"text");



CREATE INDEX "usage_logs_resource_type_created_at_idx" ON "public"."usage_logs" USING "btree" ("resource_type", "created_at" DESC);



CREATE OR REPLACE TRIGGER "import_export_templates_versioning" BEFORE UPDATE ON "control"."import_export_templates" FOR EACH ROW EXECUTE FUNCTION "control"."increment_template_version"();



CREATE OR REPLACE TRIGGER "import_jobs_updated_at" BEFORE UPDATE ON "control"."import_jobs" FOR EACH ROW EXECUTE FUNCTION "control"."update_import_job_timestamp"();



CREATE OR REPLACE TRIGGER "tr_admin_profiles_updated_at" BEFORE UPDATE ON "control"."admin_profiles" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_app_incidents_updated_at" BEFORE UPDATE ON "control"."app_incidents" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_audit_actor" BEFORE INSERT ON "control"."commercial_audit_logs" FOR EACH ROW EXECUTE FUNCTION "control"."set_commercial_audit_actor"();



CREATE OR REPLACE TRIGGER "tr_commercial_clients_updated_at" BEFORE UPDATE ON "control"."commercial_clients" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_contract_clauses_updated_at" BEFORE UPDATE ON "control"."commercial_contract_clauses" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_contract_requires_approved_quote" BEFORE INSERT ON "control"."commercial_contracts" FOR EACH ROW EXECUTE FUNCTION "control"."ensure_commercial_contract_quote_approved"();



CREATE OR REPLACE TRIGGER "tr_commercial_contracts_updated_at" BEFORE UPDATE ON "control"."commercial_contracts" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_documents_updated_at" BEFORE UPDATE ON "control"."commercial_documents" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_product_features_updated_at" BEFORE UPDATE ON "control"."commercial_product_features" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_product_phases_updated_at" BEFORE UPDATE ON "control"."commercial_product_phases" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_product_test_phases_updated_at" BEFORE UPDATE ON "control"."commercial_product_test_phases" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_products_updated_at" BEFORE UPDATE ON "control"."commercial_products" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_quote_phases_updated_at" BEFORE UPDATE ON "control"."commercial_quote_phases" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_quotes_updated_at" BEFORE UPDATE ON "control"."commercial_quotes" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_settings_updated_at" BEFORE UPDATE ON "control"."commercial_settings" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_signature_message_templates_updated_at" BEFORE UPDATE ON "control"."commercial_signature_message_templates" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_signature_requests_updated_at" BEFORE UPDATE ON "control"."commercial_signature_requests" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_signers_updated_at" BEFORE UPDATE ON "control"."commercial_signers" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_commercial_templates_updated_at" BEFORE UPDATE ON "control"."commercial_templates" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_smg_client_apps_updated_at" BEFORE UPDATE ON "control"."smg_client_apps" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_smg_clients_updated_at" BEFORE UPDATE ON "control"."smg_clients" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_smg_products_updated_at" BEFORE UPDATE ON "control"."smg_products" FOR EACH ROW EXECUTE FUNCTION "control"."set_updated_at"();



CREATE OR REPLACE TRIGGER "audit_trigger_row_appointments" AFTER INSERT OR DELETE OR UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."process_audit_log"();



CREATE OR REPLACE TRIGGER "audit_trigger_row_clients" AFTER INSERT OR DELETE OR UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."process_audit_log"();



CREATE OR REPLACE TRIGGER "audit_trigger_row_comandas" AFTER INSERT OR DELETE OR UPDATE ON "public"."comandas" FOR EACH ROW EXECUTE FUNCTION "public"."process_audit_log"();



CREATE OR REPLACE TRIGGER "audit_trigger_row_products" AFTER INSERT OR DELETE OR UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."process_audit_log"();



CREATE OR REPLACE TRIGGER "audit_trigger_row_services" AFTER INSERT OR DELETE OR UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."process_audit_log"();



CREATE OR REPLACE TRIGGER "barber_closings_updated_at" BEFORE UPDATE ON "public"."barber_closings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_barber_closings_updated_at"();



CREATE OR REPLACE TRIGGER "cash_closings_updated_at" BEFORE UPDATE ON "public"."cash_closings" FOR EACH ROW EXECUTE FUNCTION "public"."update_cash_closing_updated_at"();



CREATE OR REPLACE TRIGGER "set_tenant_id_service_execution_participants" BEFORE INSERT OR UPDATE ON "public"."service_execution_participants" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_context"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."tenant_goals" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_auto_insert_manager_to_staff" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_manager_profile"();



CREATE OR REPLACE TRIGGER "trg_customer_credits_updated_at" BEFORE UPDATE ON "public"."customer_credits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_customer_plan_benefits_updated_at" BEFORE UPDATE ON "public"."customer_plan_benefits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_customer_plans_updated_at" BEFORE UPDATE ON "public"."customer_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_customer_subscription_receivables_updated_at" BEFORE UPDATE ON "public"."customer_subscription_receivables" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_customer_subscriptions_updated_at" BEFORE UPDATE ON "public"."customer_subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_managers_updated_at" BEFORE UPDATE ON "public"."managers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_managers"();



CREATE OR REPLACE TRIGGER "trg_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_notify_comanda_open_insert" AFTER INSERT ON "public"."comandas" FOR EACH ROW WHEN (("new"."status" = 'open'::"text")) EXECUTE FUNCTION "public"."notify_comanda_open"();



CREATE OR REPLACE TRIGGER "trg_notify_comanda_open_update" AFTER UPDATE OF "status" ON "public"."comandas" FOR EACH ROW WHEN ((("new"."status" = 'open'::"text") AND ("old"."status" IS DISTINCT FROM "new"."status"))) EXECUTE FUNCTION "public"."notify_comanda_open"();



CREATE OR REPLACE TRIGGER "trg_notify_low_stock_product" AFTER INSERT OR UPDATE OF "stock_quantity", "minimum_stock", "active" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."notify_low_stock_product"();



CREATE OR REPLACE TRIGGER "trg_schedule_blocks_updated_at" BEFORE UPDATE ON "public"."schedule_blocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_timestamp"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."comanda_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."comandas" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."promotions" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id" BEFORE INSERT ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id_from_profile"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_appointments" BEFORE INSERT ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_clients" BEFORE INSERT ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_comanda_items" BEFORE INSERT ON "public"."comanda_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_comandas" BEFORE INSERT ON "public"."comandas" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_products" BEFORE INSERT ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_promotions" BEFORE INSERT ON "public"."promotions" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_purchase_orders" BEFORE INSERT ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_services" BEFORE INSERT ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_staff" BEFORE INSERT ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_set_tenant_id_suppliers" BEFORE INSERT ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."set_tenant_id"();



CREATE OR REPLACE TRIGGER "trg_setup_new_account" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."setup_new_account"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_to_user_tenants" AFTER INSERT OR UPDATE OF "tenant_id", "role" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_to_user_tenants"();



CREATE OR REPLACE TRIGGER "trg_touch_user_tenants_updated_at" BEFORE UPDATE ON "public"."user_tenants" FOR EACH ROW EXECUTE FUNCTION "public"."touch_user_tenants_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_audit_role_permissions_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_role_permissions_changes"();



CREATE OR REPLACE TRIGGER "trigger_update_role_permissions_updated_at" BEFORE UPDATE ON "public"."role_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_role_permissions_updated_at"();



ALTER TABLE ONLY "club"."customer_credits"
    ADD CONSTRAINT "customer_credits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "club"."customer_credits"
    ADD CONSTRAINT "customer_credits_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "club"."customer_subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "club"."customer_credits"
    ADD CONSTRAINT "customer_credits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "club"."customer_plans"
    ADD CONSTRAINT "customer_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "club"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "club"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "club"."customer_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "club"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."app_health_checks"
    ADD CONSTRAINT "app_health_checks_client_app_id_fkey" FOREIGN KEY ("client_app_id") REFERENCES "control"."smg_client_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."app_incidents"
    ADD CONSTRAINT "app_incidents_client_app_id_fkey" FOREIGN KEY ("client_app_id") REFERENCES "control"."smg_client_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_audit_logs"
    ADD CONSTRAINT "commercial_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_clients"
    ADD CONSTRAINT "commercial_clients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_clients"
    ADD CONSTRAINT "commercial_clients_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_contract_clauses"
    ADD CONSTRAINT "commercial_contract_clauses_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "control"."commercial_contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_contracts"
    ADD CONSTRAINT "commercial_contracts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_contracts"
    ADD CONSTRAINT "commercial_contracts_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "control"."commercial_quotes"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "control"."commercial_contracts"
    ADD CONSTRAINT "commercial_contracts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_documents"
    ADD CONSTRAINT "commercial_documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "control"."commercial_contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_documents"
    ADD CONSTRAINT "commercial_documents_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_documents"
    ADD CONSTRAINT "commercial_documents_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "control"."commercial_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_product_features"
    ADD CONSTRAINT "commercial_product_features_commercial_product_id_fkey" FOREIGN KEY ("commercial_product_id") REFERENCES "control"."commercial_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_product_phases"
    ADD CONSTRAINT "commercial_product_phases_commercial_product_id_fkey" FOREIGN KEY ("commercial_product_id") REFERENCES "control"."commercial_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_product_test_phases"
    ADD CONSTRAINT "commercial_product_test_phases_commercial_product_id_fkey" FOREIGN KEY ("commercial_product_id") REFERENCES "control"."commercial_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_products"
    ADD CONSTRAINT "commercial_products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_products"
    ADD CONSTRAINT "commercial_products_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_quote_phases"
    ADD CONSTRAINT "commercial_quote_phases_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "control"."commercial_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_commercial_client_id_fkey" FOREIGN KEY ("commercial_client_id") REFERENCES "control"."commercial_clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_commercial_product_id_fkey" FOREIGN KEY ("commercial_product_id") REFERENCES "control"."commercial_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_quotes"
    ADD CONSTRAINT "commercial_quotes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_settings"
    ADD CONSTRAINT "commercial_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_settings"
    ADD CONSTRAINT "commercial_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_events"
    ADD CONSTRAINT "commercial_signature_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_events"
    ADD CONSTRAINT "commercial_signature_events_signature_request_id_fkey" FOREIGN KEY ("signature_request_id") REFERENCES "control"."commercial_signature_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_signature_events"
    ADD CONSTRAINT "commercial_signature_events_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "control"."commercial_signers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_message_templates"
    ADD CONSTRAINT "commercial_signature_message_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_message_templates"
    ADD CONSTRAINT "commercial_signature_message_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_public_tokens"
    ADD CONSTRAINT "commercial_signature_public_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_public_tokens"
    ADD CONSTRAINT "commercial_signature_public_tokens_signature_request_id_fkey" FOREIGN KEY ("signature_request_id") REFERENCES "control"."commercial_signature_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_signature_public_tokens"
    ADD CONSTRAINT "commercial_signature_public_tokens_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "control"."commercial_signers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_signature_requests"
    ADD CONSTRAINT "commercial_signature_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "control"."commercial_contracts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_requests"
    ADD CONSTRAINT "commercial_signature_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "control"."commercial_documents"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "control"."commercial_signature_requests"
    ADD CONSTRAINT "commercial_signature_requests_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "control"."commercial_quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signature_requests"
    ADD CONSTRAINT "commercial_signature_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_signers"
    ADD CONSTRAINT "commercial_signers_signature_request_id_fkey" FOREIGN KEY ("signature_request_id") REFERENCES "control"."commercial_signature_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."commercial_templates"
    ADD CONSTRAINT "commercial_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."commercial_templates"
    ADD CONSTRAINT "commercial_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."import_audit_logs"
    ADD CONSTRAINT "import_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "control"."import_audit_logs"
    ADD CONSTRAINT "import_audit_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "control"."import_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."import_export_templates"
    ADD CONSTRAINT "import_export_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "control"."import_export_templates"
    ADD CONSTRAINT "import_export_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "control"."import_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "control"."import_jobs"
    ADD CONSTRAINT "import_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "control"."import_export_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."import_jobs"
    ADD CONSTRAINT "import_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."integration_logs"
    ADD CONSTRAINT "integration_logs_client_app_id_fkey" FOREIGN KEY ("client_app_id") REFERENCES "control"."smg_client_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "control"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "control"."import_jobs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "control"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "control"."smg_client_apps"
    ADD CONSTRAINT "smg_client_apps_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "control"."smg_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "control"."smg_client_apps"
    ADD CONSTRAINT "smg_client_apps_smg_client_id_fkey" FOREIGN KEY ("smg_client_id") REFERENCES "control"."smg_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "platform"."platform_api_logs"
    ADD CONSTRAINT "platform_api_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_api_logs"
    ADD CONSTRAINT "platform_api_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."platform_users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_audit_logs"
    ADD CONSTRAINT "platform_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "platform"."platform_users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_audit_logs"
    ADD CONSTRAINT "platform_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_error_logs"
    ADD CONSTRAINT "platform_error_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_error_logs"
    ADD CONSTRAINT "platform_error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."platform_users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_feature_flags"
    ADD CONSTRAINT "platform_feature_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_integrations"
    ADD CONSTRAINT "platform_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_jobs"
    ADD CONSTRAINT "platform_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_role_permissions"
    ADD CONSTRAINT "platform_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "platform"."platform_permissions"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."platform_role_permissions"
    ADD CONSTRAINT "platform_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform"."platform_roles"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."platform_security_events"
    ADD CONSTRAINT "platform_security_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "platform"."platform_users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_security_events"
    ADD CONSTRAINT "platform_security_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_tenants"
    ADD CONSTRAINT "platform_tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "platform"."platform_plans"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "platform"."platform_user_tenants"
    ADD CONSTRAINT "platform_user_tenants_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform"."platform_roles"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."platform_user_tenants"
    ADD CONSTRAINT "platform_user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "platform"."platform_tenants"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "platform"."platform_user_tenants"
    ADD CONSTRAINT "platform_user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform"."platform_users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "_l_appointments_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "_l_appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "_l_appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "_l_appointments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "_l_appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "_l_appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "_l_comanda_items_chef_club_plan_benefit_id_fkey" FOREIGN KEY ("chef_club_plan_benefit_id") REFERENCES "public"."customer_plan_benefits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "_l_comanda_items_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comandas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "_l_comanda_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "_l_comanda_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "_l_comanda_items_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "_l_comanda_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "_l_comandas_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "_l_comandas_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "_l_comandas_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comandas"
    ADD CONSTRAINT "_l_comandas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_blocks"
    ADD CONSTRAINT "_l_schedule_blocks_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."schedule_blocks"
    ADD CONSTRAINT "_l_schedule_blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "_l_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."appointment_services"
    ADD CONSTRAINT "appointment_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."barber_closings"
    ADD CONSTRAINT "barber_closings_cash_closing_id_fkey" FOREIGN KEY ("cash_closing_id") REFERENCES "public"."cash_closings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."barber_closings"
    ADD CONSTRAINT "barber_closings_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."barber_closings"
    ADD CONSTRAINT "barber_closings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."barber_closings"
    ADD CONSTRAINT "barber_closings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_closing_events"
    ADD CONSTRAINT "cash_closing_events_barber_closing_id_fkey" FOREIGN KEY ("barber_closing_id") REFERENCES "public"."barber_closings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cash_closing_events"
    ADD CONSTRAINT "cash_closing_events_cash_closing_id_fkey" FOREIGN KEY ("cash_closing_id") REFERENCES "public"."cash_closings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_closing_events"
    ADD CONSTRAINT "cash_closing_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cash_closing_events"
    ADD CONSTRAINT "cash_closing_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_closings"
    ADD CONSTRAINT "cash_closings_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cash_closings"
    ADD CONSTRAINT "cash_closings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cash_closings"
    ADD CONSTRAINT "cash_closings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comandas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_comanda_item_id_fkey" FOREIGN KEY ("comanda_item_id") REFERENCES "public"."comanda_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_consumed_by_fkey" FOREIGN KEY ("consumed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_plan_benefit_id_fkey" FOREIGN KEY ("plan_benefit_id") REFERENCES "public"."customer_plan_benefits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_benefit_consumptions"
    ADD CONSTRAINT "customer_benefit_consumptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_credits"
    ADD CONSTRAINT "customer_credits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_credits"
    ADD CONSTRAINT "customer_credits_source_plan_benefit_id_fkey" FOREIGN KEY ("source_plan_benefit_id") REFERENCES "public"."customer_plan_benefits"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_credits"
    ADD CONSTRAINT "customer_credits_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_credits"
    ADD CONSTRAINT "customer_credits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_plan_benefits"
    ADD CONSTRAINT "customer_plan_benefits_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."customer_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_plan_benefits"
    ADD CONSTRAINT "customer_plan_benefits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_comanda_id_fkey" FOREIGN KEY ("comanda_id") REFERENCES "public"."comandas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_comanda_item_id_fkey" FOREIGN KEY ("comanda_item_id") REFERENCES "public"."comanda_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."customer_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_plans"
    ADD CONSTRAINT "customer_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_subscription_receivables"
    ADD CONSTRAINT "customer_subscription_receivables_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_subscription_receivables"
    ADD CONSTRAINT "customer_subscription_receivables_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."customer_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_subscription_receivables"
    ADD CONSTRAINT "customer_subscription_receivables_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_subscription_receivables"
    ADD CONSTRAINT "customer_subscription_receivables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_subscription_receivables"
    ADD CONSTRAINT "customer_subscription_receivables_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."customer_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customer_subscriptions"
    ADD CONSTRAINT "customer_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_barber"
    ADD CONSTRAINT "feedback_barber_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."kiosk_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_shop"
    ADD CONSTRAINT "feedback_shop_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."kiosk_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_reversals"
    ADD CONSTRAINT "financial_reversals_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."financial_reversals"
    ADD CONSTRAINT "financial_reversals_original_transaction_id_fkey" FOREIGN KEY ("original_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."financial_reversals"
    ADD CONSTRAINT "financial_reversals_reversal_transaction_id_fkey" FOREIGN KEY ("reversal_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."financial_reversals"
    ADD CONSTRAINT "financial_reversals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "fk_comanda_items_credit_usage" FOREIGN KEY ("credit_usage_id") REFERENCES "public"."customer_plan_credit_usages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiosk_sessions"
    ADD CONSTRAINT "kiosk_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."kiosk_devices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."managers"
    ADD CONSTRAINT "managers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."otp_requests"
    ADD CONSTRAINT "otp_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_sessions"
    ADD CONSTRAINT "portal_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portal_sessions"
    ADD CONSTRAINT "portal_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."role_permissions_audit"
    ADD CONSTRAINT "role_permissions_audit_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_permissions_audit"
    ADD CONSTRAINT "role_permissions_audit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_execution_participants"
    ADD CONSTRAINT "service_execution_participants_comanda_item_id_fkey" FOREIGN KEY ("comanda_item_id") REFERENCES "public"."comanda_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_execution_participants"
    ADD CONSTRAINT "service_execution_participants_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."service_execution_participants"
    ADD CONSTRAINT "service_execution_participants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."tenant_addons"
    ADD CONSTRAINT "tenant_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."tenant_goals"
    ADD CONSTRAINT "tenant_goals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tenants"
    ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "varejo"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "varejo"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "varejo"."orders"("id");



ALTER TABLE ONLY "varejo"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "varejo"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "varejo"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "varejo"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "varejo"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "varejo"."orders"
    ADD CONSTRAINT "orders_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("id");



ALTER TABLE ONLY "varejo"."orders"
    ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."staff"("id");



ALTER TABLE "club"."customer_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_plans_tenant_isolation" ON "club"."customer_plans" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "Admins have full access to client apps" ON "control"."smg_client_apps" TO "authenticated" USING ("control"."is_admin"()) WITH CHECK ("control"."is_admin"());



CREATE POLICY "Admins have full access to clients" ON "control"."smg_clients" TO "authenticated" USING ("control"."is_admin"()) WITH CHECK ("control"."is_admin"());



CREATE POLICY "Admins have full access to health checks" ON "control"."app_health_checks" TO "authenticated" USING ("control"."is_admin"());



CREATE POLICY "Admins have full access to incidents" ON "control"."app_incidents" TO "authenticated" USING ("control"."is_admin"());



CREATE POLICY "Admins have full access to integration logs" ON "control"."integration_logs" TO "authenticated" USING ("control"."is_admin"());



CREATE POLICY "Admins have full access to products" ON "control"."smg_products" TO "authenticated" USING ("control"."is_admin"()) WITH CHECK ("control"."is_admin"());



CREATE POLICY "Admins have full access to profiles" ON "control"."admin_profiles" TO "authenticated" USING ("control"."is_admin"()) WITH CHECK ("control"."is_admin"());



CREATE POLICY "Commercial role can insert audit" ON "control"."commercial_audit_logs" FOR INSERT TO "authenticated" WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can insert signature events" ON "control"."commercial_signature_events" FOR INSERT TO "authenticated" WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_clients" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_contract_clauses" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_contracts" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_product_features" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_product_phases" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_product_test_phases" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_products" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_quote_phases" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_quotes" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_settings" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage" ON "control"."commercial_templates" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can manage documents" ON "control"."commercial_documents" TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[])) WITH CHECK ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can read signature events" ON "control"."commercial_signature_events" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can read signature message templates" ON "control"."commercial_signature_message_templates" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can read signature public tokens" ON "control"."commercial_signature_public_tokens" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can read signature requests" ON "control"."commercial_signature_requests" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can read signers" ON "control"."commercial_signers" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_audit_logs" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_clients" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_contract_clauses" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_contracts" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_product_features" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_product_phases" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_product_test_phases" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_products" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_quote_phases" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_quotes" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_settings" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select" ON "control"."commercial_templates" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



CREATE POLICY "Commercial role can select documents" ON "control"."commercial_documents" FOR SELECT TO "authenticated" USING ("control"."has_role"((ARRAY['super_admin'::"text", 'admin'::"text", 'finance'::"text"])::character varying[]));



ALTER TABLE "control"."admin_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."app_health_checks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."app_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_contract_clauses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_product_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_product_phases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_product_test_phases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_quote_phases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_signature_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_signature_message_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_signature_public_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_signature_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_signers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."commercial_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."import_audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_audit_logs_insert" ON "control"."import_audit_logs" FOR INSERT WITH CHECK (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "import_audit_logs_read" ON "control"."import_audit_logs" FOR SELECT USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "control"."import_export_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_export_templates_delete" ON "control"."import_export_templates" FOR DELETE USING ((("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (("tenant_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'superadmin'::"text")))))));



CREATE POLICY "import_export_templates_insert" ON "control"."import_export_templates" FOR INSERT WITH CHECK ((("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (("tenant_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'superadmin'::"text")))))));



CREATE POLICY "import_export_templates_read" ON "control"."import_export_templates" FOR SELECT USING ((("tenant_id" IS NULL) OR ("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "import_export_templates_update" ON "control"."import_export_templates" FOR UPDATE USING ((("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR (("tenant_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'superadmin'::"text")))))));



ALTER TABLE "control"."import_job_rows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_job_rows_tenant_isolation" ON "control"."import_job_rows" USING ((EXISTS ( SELECT 1
   FROM "control"."import_jobs" "ij"
  WHERE (("ij"."id" = "import_job_rows"."job_id") AND ("ij"."tenant_id" = ( SELECT "profiles"."tenant_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



ALTER TABLE "control"."import_jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "import_jobs_tenant_isolation" ON "control"."import_jobs" USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "control"."integration_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_movements_tenant_isolation" ON "control"."inventory_movements" USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "control"."smg_client_apps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."smg_clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "control"."smg_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins can view plan requests" ON "public"."plan_change_requests" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert plan requests" ON "public"."plan_change_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Managers can manage role_permissions" ON "public"."role_permissions" USING (((("tenant_id" = "public"."get_current_tenant_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "auth"."uid"()) AND ("s"."role" = ANY (ARRAY['Manager'::"text", 'AdminManager'::"text"])) AND ("s"."tenant_id" = "public"."get_current_tenant_id"()) AND ("s"."status" = 'active'::"text"))))) OR "public"."current_is_super_admin_from_auth_uid"()));



CREATE POLICY "Managers can view role_permissions" ON "public"."role_permissions" FOR SELECT USING ((("tenant_id" = "public"."get_current_tenant_id"()) OR "public"."current_is_super_admin_from_auth_uid"()));



CREATE POLICY "Managers can view tenant audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "Public can insert OTP requests" ON "public"."otp_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can insert portal sessions upon auth" ON "public"."portal_sessions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can select portal sessions for validation" ON "public"."portal_sessions" FOR SELECT USING (true);



CREATE POLICY "Public can update active portal sessions" ON "public"."portal_sessions" FOR UPDATE USING (true);



CREATE POLICY "Public can update open OTP requests" ON "public"."otp_requests" FOR UPDATE USING ((("status")::"text" = 'pending'::"text"));



CREATE POLICY "Service role can manage all" ON "public"."appointments" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "SuperAdmins can view role_permissions_audit" ON "public"."role_permissions_audit" FOR SELECT USING ("public"."current_is_super_admin_from_auth_uid"());



CREATE POLICY "Superadmins can view all audit logs" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "px"
  WHERE (("px"."id" = "auth"."uid"()) AND ("px"."role" = ANY (ARRAY['Super Admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Superadmins can view all profiles" ON "public"."profiles" FOR SELECT USING ((("role" = ANY (ARRAY['Super Admin'::"text", 'superadmin'::"text"])) OR ("id" = "auth"."uid"())));



CREATE POLICY "System can insert role_permissions_audit" ON "public"."role_permissions_audit" FOR INSERT WITH CHECK (true);



CREATE POLICY "Tenants can manage their specific addons" ON "public"."tenant_addons" USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Tenants can view and manage portal sessions" ON "public"."portal_sessions" USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Tenants can view their otp_requests" ON "public"."otp_requests" FOR SELECT USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can insert messages" ON "public"."ticket_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert own appointments" ON "public"."appointments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can manage own tenant cash closings" ON "public"."cash_closings" USING (("tenant_id" = "public"."current_tenant_id_from_auth_uid"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()));



CREATE POLICY "Users can see messages for their tickets" ON "public"."ticket_messages" FOR SELECT USING (true);



CREATE POLICY "Users can update own appointments" ON "public"."appointments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own appointments" ON "public"."appointments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their tenant" ON "public"."tenants" FOR SELECT TO "authenticated" USING ((("id" = "public"."current_tenant_id_from_auth_uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."user_tenants" "ut"
  WHERE (("ut"."user_id" = "auth"."uid"()) AND ("ut"."tenant_id" = "tenants"."id")))) OR "public"."current_is_super_admin_from_auth_uid"()));



ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."access_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointment_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."barber_closings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "barber_closings_tenant_isolation" ON "public"."barber_closings" USING (("tenant_id" = "public"."current_tenant_id_from_auth_uid"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()));



ALTER TABLE "public"."cash_closing_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cash_closing_events_tenant_isolation" ON "public"."cash_closing_events" USING (("tenant_id" = "public"."current_tenant_id_from_auth_uid"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()));



ALTER TABLE "public"."cash_closings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comanda_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comandas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_benefit_consumptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_benefit_consumptions_tenant_isolation" ON "public"."customer_benefit_consumptions" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."customer_credits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_credits_tenant_isolation" ON "public"."customer_credits" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "customer_credits_tenant_isolation_v2" ON "public"."customer_credits" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."customer_plan_benefits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_plan_benefits_tenant_isolation" ON "public"."customer_plan_benefits" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."customer_plan_credit_usages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_plan_credit_usages_tenant" ON "public"."customer_plan_credit_usages" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."customer_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_plans_tenant_access" ON "public"."customer_plans" USING (("tenant_id" = (NULLIF("current_setting"('app.current_tenant_id'::"text", true), ''::"text"))::"uuid"));



CREATE POLICY "customer_plans_tenant_isolation" ON "public"."customer_plans" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."customer_subscription_receivables" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_subscription_receivables_tenant_isolation" ON "public"."customer_subscription_receivables" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."customer_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_subscriptions_tenant_isolation" ON "public"."customer_subscriptions" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."feedback_barber" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_barber_tenant_isolation" ON "public"."feedback_barber" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."feedback_shop" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feedback_shop_tenant_isolation" ON "public"."feedback_shop" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."financial_reversals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_reversals_select_by_tenant_or_superadmin" ON "public"."financial_reversals" FOR SELECT TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."kiosk_addons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_addons_insert" ON "public"."kiosk_addons" FOR INSERT WITH CHECK (true);



CREATE POLICY "kiosk_addons_select" ON "public"."kiosk_addons" FOR SELECT USING (true);



CREATE POLICY "kiosk_addons_update" ON "public"."kiosk_addons" FOR UPDATE USING (true);



ALTER TABLE "public"."kiosk_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_devices_tenant_isolation" ON "public"."kiosk_devices" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."kiosk_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_sessions_tenant_isolation" ON "public"."kiosk_sessions" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."managers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_preferences_insert" ON "public"."notification_preferences" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND ("user_id" = "auth"."uid"()))));



CREATE POLICY "notification_preferences_select" ON "public"."notification_preferences" FOR SELECT TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND ("user_id" = "auth"."uid"()))));



CREATE POLICY "notification_preferences_update" ON "public"."notification_preferences" FOR UPDATE TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND ("user_id" = "auth"."uid"())))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND ("user_id" = "auth"."uid"()))));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_insert" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"())))));



CREATE POLICY "notifications_select" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"())))));



CREATE POLICY "notifications_update" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()))))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR (("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"())))));



ALTER TABLE "public"."otp_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_change_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portal_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public insert access_requests" ON "public"."access_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "public_select_schedule_blocks" ON "public"."schedule_blocks" FOR SELECT TO "anon" USING (("status" = 'active'::"text"));



CREATE POLICY "public_select_services" ON "public"."services" FOR SELECT USING (true);



CREATE POLICY "public_select_tenants" ON "public"."tenants" FOR SELECT USING (true);



CREATE POLICY "public_view_enabled_tenant_addons" ON "public"."tenant_addons" FOR SELECT TO "authenticated", "anon" USING (("status" = 'enabled'::"text"));



ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_execution_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super admins can manage alerts" ON "public"."alerts" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super admins can manage notification channels" ON "public"."notification_channels" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super admins can manage usage logs" ON "public"."usage_logs" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super admins can read alerts" ON "public"."alerts" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super admins can read notification channels" ON "public"."notification_channels" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super admins can read usage logs" ON "public"."usage_logs" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "superadmin full access access_requests" ON "public"."access_requests" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'superadmin'::"text")))));



CREATE POLICY "superadmin_global_visibility" ON "public"."support_tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "px"
  WHERE (("px"."id" = "auth"."uid"()) AND ("px"."role" = ANY (ARRAY['Super Admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "superadmin_requests_visibility" ON "public"."access_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "px"
  WHERE (("px"."id" = "auth"."uid"()) AND ("px"."role" = ANY (ARRAY['Super Admin'::"text", 'superadmin'::"text"]))))));



ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_goals_delete" ON "public"."tenant_goals" FOR DELETE USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_goals_insert" ON "public"."tenant_goals" FOR INSERT WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_goals_select" ON "public"."tenant_goals" FOR SELECT USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_goals_update" ON "public"."tenant_goals" FOR UPDATE USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_appointment_services" ON "public"."appointment_services" FOR SELECT USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_appointment_services_delete" ON "public"."appointment_services" FOR DELETE USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_appointment_services_insert" ON "public"."appointment_services" FOR INSERT WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_appointment_services_select" ON "public"."appointment_services" FOR SELECT TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_appointment_services_update" ON "public"."appointment_services" FOR UPDATE USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_appointments" ON "public"."appointments" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_clients" ON "public"."clients" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_comanda_items" ON "public"."comanda_items" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_comandas" ON "public"."comandas" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_managers" ON "public"."managers" USING (("tenant_id" = "public"."current_tenant_id_managers"())) WITH CHECK (("tenant_id" = "public"."current_tenant_id_managers"()));



CREATE POLICY "tenant_isolation_products_insert_v2" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_products_v2" ON "public"."products" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_profiles_insert_v2" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_profiles_select_v2" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("id" = "auth"."uid"()) OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_profiles_update_v2" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("id" = "auth"."uid"()) OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("id" = "auth"."uid"()) OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_promotions_insert_v2" ON "public"."promotions" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_promotions_v2" ON "public"."promotions" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_purchase_orders_v2" ON "public"."purchase_orders" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_schedule_blocks" ON "public"."schedule_blocks" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_service_execution_participants_delete_v2" ON "public"."service_execution_participants" FOR DELETE TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_service_execution_participants_insert_v2" ON "public"."service_execution_participants" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_service_execution_participants_update_v2" ON "public"."service_execution_participants" FOR UPDATE TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_service_execution_participants_v2" ON "public"."service_execution_participants" FOR SELECT TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_services_insert_v2" ON "public"."services" FOR INSERT TO "authenticated" WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_services_v2" ON "public"."services" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_staff" ON "public"."staff" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_suppliers_v2" ON "public"."suppliers" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_isolation_transactions_v2" ON "public"."transactions" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



CREATE POLICY "tenant_ticket_isolation_v2" ON "public"."support_tickets" TO "authenticated" USING (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"()) OR ("user_id" = "auth"."uid"()))) WITH CHECK (("public"."current_is_super_admin_from_auth_uid"() OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_tenants_select_own" ON "public"."user_tenants" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."current_is_super_admin_from_auth_uid"()));



CREATE POLICY "Tenant Isolation - Inventory" ON "varejo"."inventory_movements" USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Tenant Isolation - Order Items" ON "varejo"."order_items" USING ((EXISTS ( SELECT 1
   FROM "varejo"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."tenant_id" = ( SELECT "profiles"."tenant_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))));



CREATE POLICY "Tenant Isolation - Orders" ON "varejo"."orders" USING (("tenant_id" = ( SELECT "profiles"."tenant_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "varejo"."inventory_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "varejo"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "varejo"."orders" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "barber" TO "authenticated";
GRANT USAGE ON SCHEMA "barber" TO "service_role";



GRANT USAGE ON SCHEMA "control" TO "authenticated";
GRANT ALL ON SCHEMA "control" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "authenticator";



GRANT USAGE ON SCHEMA "varejo" TO "authenticated";



GRANT ALL ON FUNCTION "control"."accept_commercial_signature_public_token"("p_token_hash" "text", "p_ip" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "control"."archive_commercial_signature_message_template"("p_template_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "control"."count_active_super_admins"() FROM PUBLIC;
GRANT ALL ON FUNCTION "control"."count_active_super_admins"() TO "authenticated";



GRANT SELECT ON TABLE "control"."commercial_signature_requests" TO "authenticated";



GRANT ALL ON FUNCTION "control"."create_commercial_signature_request"("p_document_id" "uuid") TO "authenticated";



GRANT SELECT ON TABLE "control"."commercial_signature_public_tokens" TO "authenticated";



GRANT ALL ON FUNCTION "control"."create_commercial_signer_public_token"("p_signer_id" "uuid", "p_token_hash" "text", "p_expires_at" timestamp with time zone) TO "authenticated";



GRANT ALL ON FUNCTION "control"."current_admin_role"() TO "authenticated";



GRANT ALL ON FUNCTION "control"."delete_commercial_signer"("p_signer_id" "uuid") TO "authenticated";



GRANT SELECT,USAGE ON SEQUENCE "control"."commercial_contract_number_seq" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_contracts" TO "authenticated";



GRANT ALL ON FUNCTION "control"."generate_commercial_contract"("p_quote_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "control"."has_role"("required_roles" character varying[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "control"."has_role"("required_roles" character varying[]) TO "authenticated";



REVOKE ALL ON FUNCTION "control"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "control"."is_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "control"."mark_commercial_signer_public_viewed"("p_token_hash" "text", "p_ip" "text", "p_user_agent" "text") TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_documents" TO "authenticated";



GRANT ALL ON FUNCTION "control"."register_commercial_document"("p_document_type" "text", "p_quote_id" "uuid", "p_contract_id" "uuid", "p_document_number" "text", "p_version" integer, "p_file_path" "text", "p_storage_bucket" "text", "p_mime_type" "text", "p_file_size" bigint, "p_sha256_hash" "text", "p_metadata" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "control"."register_commercial_signature_delivery_event"("p_signer_id" "uuid", "p_event_type" "text", "p_channel" "text", "p_metadata" "jsonb") TO "authenticated";



GRANT ALL ON FUNCTION "control"."reject_commercial_signature_public_token"("p_token_hash" "text", "p_reason" "text", "p_ip" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "control"."revoke_commercial_signer_public_token"("p_signer_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "control"."set_updated_at"() TO "authenticated";



GRANT SELECT,USAGE ON SEQUENCE "control"."commercial_quote_number_seq" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_quotes" TO "authenticated";



GRANT ALL ON FUNCTION "control"."update_commercial_quote_status"("p_quote_id" "uuid", "p_status" "text", "p_approved_by_name" "text") TO "authenticated";



GRANT ALL ON FUNCTION "control"."update_commercial_signature_request"("p_signature_request_id" "uuid", "p_expires_at" timestamp with time zone) TO "authenticated";



GRANT ALL ON FUNCTION "control"."update_commercial_signature_status"("p_signature_request_id" "uuid", "p_status" "text") TO "authenticated";



GRANT SELECT ON TABLE "control"."commercial_signature_message_templates" TO "authenticated";



GRANT ALL ON FUNCTION "control"."upsert_commercial_signature_message_template"("p_template_id" "uuid", "p_channel" "text", "p_template_key" "text", "p_name" "text", "p_subject" "text", "p_body" "text", "p_status" "text") TO "authenticated";



GRANT SELECT ON TABLE "control"."commercial_signers" TO "authenticated";



GRANT ALL ON FUNCTION "control"."upsert_commercial_signer"("p_signature_request_id" "uuid", "p_signer_id" "uuid", "p_signer_type" "text", "p_name" "text", "p_email" "text", "p_phone" "text", "p_document" "text", "p_role_title" "text") TO "authenticated";






















































































































































GRANT ALL ON FUNCTION "public"."apply_plan_credit_to_comanda_item"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_comanda_item_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_professional_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_plan_credit_to_comanda_item"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_comanda_item_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_professional_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_plan_credit_to_comanda_item"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_comanda_item_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_professional_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_access_request"("p_request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_access_request"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_access_request"("p_request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_notification"("p_notification_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_notification"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_notification"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_notification"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_role_permissions_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_role_permissions_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_role_permissions_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."build_chef_club_service_balance_map"("p_plan_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."build_chef_club_service_balance_map"("p_plan_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bulk_close_comandas_admin"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_legacy_reference_month" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bulk_close_comandas_admin"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_legacy_reference_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_close_comandas_admin"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_legacy_reference_month" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bulk_close_comandas_normal"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bulk_close_comandas_normal"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_close_comandas_normal"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bulk_close_comandas_with_credits"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text", "p_apply_credits" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bulk_close_comandas_with_credits"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text", "p_apply_credits" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_close_comandas_with_credits"("p_comanda_ids" "uuid"[], "p_tenant_id" "uuid", "p_closure_note" "text", "p_payment_method" "text", "p_apply_credits" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_minimum_stock"("p_product_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_minimum_stock"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_minimum_stock"("p_product_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_order"("p_comanda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_order"("p_comanda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_order"("p_comanda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."close_order_with_chef_club"("p_comanda_id" "uuid", "p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_order_with_chef_club"("p_comanda_id" "uuid", "p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_order_with_chef_club"("p_comanda_id" "uuid", "p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_chef_club_benefits"("p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_chef_club_benefits"("p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_chef_club_benefits"("p_tenant_id" "uuid", "p_consumptions" "jsonb", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."count_unread_notifications"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."count_unread_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."count_unread_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_unread_notifications"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_appointment_with_comanda"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_price" numeric, "p_notes" "text", "p_idempotency_key" "text", "p_is_overbooked" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_appointment_with_comanda"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_price" numeric, "p_notes" "text", "p_idempotency_key" "text", "p_is_overbooked" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_appointment_with_comanda"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_price" numeric, "p_notes" "text", "p_idempotency_key" "text", "p_is_overbooked" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_appointment_with_comanda"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_price" numeric, "p_notes" "text", "p_idempotency_key" "text", "p_is_overbooked" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_appointment_with_services"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_notes" "text", "p_idempotency_key" "text", "p_services" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_appointment_with_services"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_notes" "text", "p_idempotency_key" "text", "p_services" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_appointment_with_services"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_notes" "text", "p_idempotency_key" "text", "p_services" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_appointment_with_services"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_staff_id" "uuid", "p_start_time" timestamp with time zone, "p_notes" "text", "p_idempotency_key" "text", "p_services" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_chef_club_subscription"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_next_billing_date" "date", "p_replace_existing" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_chef_club_subscription"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_next_billing_date" "date", "p_replace_existing" boolean) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_chef_club_subscription"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_next_billing_date" "date", "p_replace_existing" boolean) TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_customer_subscription_with_credits"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_start_date" timestamp with time zone, "p_created_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_customer_subscription_with_credits"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_start_date" timestamp with time zone, "p_created_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_customer_subscription_with_credits"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_plan_id" "uuid", "p_start_date" timestamp with time zone, "p_created_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_internal_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_severity" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_internal_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_severity" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_internal_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_severity" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_internal_notification"("p_tenant_id" "uuid", "p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_severity" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_is_super_admin_from_auth_uid"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_is_super_admin_from_auth_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_is_super_admin_from_auth_uid"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_tenant_id_from_auth_uid"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_tenant_id_from_auth_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id_from_auth_uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_tenant_id_managers"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_tenant_id_managers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_tenant_id_managers"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_amount" integer, "p_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_amount" integer, "p_reference" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_amount" integer, "p_reference" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_service_id" "uuid", "p_amount" integer, "p_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_service_id" "uuid", "p_amount" integer, "p_reference" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."deduct_chef_club_credits"("p_subscription_id" "uuid", "p_service_id" "uuid", "p_amount" integer, "p_reference" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."detect_no_show_appointments"("p_tenant_id" "uuid", "p_grace_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detect_no_show_appointments"("p_tenant_id" "uuid", "p_grace_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_no_show_appointments"("p_tenant_id" "uuid", "p_grace_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_club_receivable_for_cycle"("p_subscription_id" "uuid", "p_billing_cycle_start" timestamp with time zone, "p_billing_cycle_end" timestamp with time zone, "p_due_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_club_receivable_for_cycle"("p_subscription_id" "uuid", "p_billing_cycle_start" timestamp with time zone, "p_billing_cycle_end" timestamp with time zone, "p_due_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finance_reverse_transaction"("p_tenant_id" "uuid", "p_original_transaction_id" "uuid", "p_reversal_type" "text", "p_amount" numeric, "p_reason_type" "text", "p_reason_note" "text", "p_refund_method" "text", "p_reversal_date" timestamp with time zone, "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finance_reverse_transaction"("p_tenant_id" "uuid", "p_original_transaction_id" "uuid", "p_reversal_type" "text", "p_amount" numeric, "p_reason_type" "text", "p_reason_note" "text", "p_refund_method" "text", "p_reversal_date" timestamp with time zone, "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finance_reverse_transaction"("p_tenant_id" "uuid", "p_original_transaction_id" "uuid", "p_reversal_type" "text", "p_amount" numeric, "p_reason_type" "text", "p_reason_note" "text", "p_refund_method" "text", "p_reversal_date" timestamp with time zone, "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_reverse_transaction"("p_tenant_id" "uuid", "p_original_transaction_id" "uuid", "p_reversal_type" "text", "p_amount" numeric, "p_reason_type" "text", "p_reason_note" "text", "p_refund_method" "text", "p_reversal_date" timestamp with time zone, "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finance_settle_comanda"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_payment_method" "text", "p_paid_amount" numeric, "p_payment_date_real" timestamp with time zone, "p_source" "text", "p_notes" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finance_settle_comanda"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_payment_method" "text", "p_paid_amount" numeric, "p_payment_date_real" timestamp with time zone, "p_source" "text", "p_notes" "text", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finance_settle_comanda"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_payment_method" "text", "p_paid_amount" numeric, "p_payment_date_real" timestamp with time zone, "p_source" "text", "p_notes" "text", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finance_settle_comanda"("p_tenant_id" "uuid", "p_comanda_id" "uuid", "p_payment_method" "text", "p_paid_amount" numeric, "p_payment_date_real" timestamp with time zone, "p_source" "text", "p_notes" "text", "p_idempotency_key" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_club_receivables"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_club_receivables"("p_tenant_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."generate_club_receivables"("p_tenant_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."generate_system_notifications"("p_tenant_id" "uuid", "p_upcoming_minutes" integer, "p_billing_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_system_notifications"("p_tenant_id" "uuid", "p_upcoming_minutes" integer, "p_billing_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_system_notifications"("p_tenant_id" "uuid", "p_upcoming_minutes" integer, "p_billing_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_system_notifications"("p_tenant_id" "uuid", "p_upcoming_minutes" integer, "p_billing_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_auth_access_context"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_auth_access_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_auth_access_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_credit_usage_history"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_subscription_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_credit_usage_history"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_subscription_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_credit_usage_history"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_subscription_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_subscription_credits"("p_subscription_id" "uuid", "p_tenant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_subscription_credits"("p_subscription_id" "uuid", "p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_subscription_credits"("p_subscription_id" "uuid", "p_tenant_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_current_tenant_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_current_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_customer_plan_status"("p_tenant_id" "uuid", "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_plan_status"("p_tenant_id" "uuid", "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_plan_status"("p_tenant_id" "uuid", "p_client_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_notification_preferences"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_notification_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_notification_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_notification_preferences"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_role_permissions"("p_tenant_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_role_permissions"("p_tenant_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_role_permissions"("p_tenant_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_barber_closings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_barber_closings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_barber_closings_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_manager_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_manager_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_manager_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_super_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_internal_notifications"("p_status" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_internal_notifications"("p_status" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_internal_notifications"("p_status" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_internal_notifications"("p_status" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_all_notifications_read"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notification_type_catalog"() TO "anon";
GRANT ALL ON FUNCTION "public"."notification_type_catalog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notification_type_catalog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_comanda_open"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_comanda_open"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_comanda_open"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_low_stock_product"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_low_stock_product"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_low_stock_product"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pause_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pause_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pause_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pay_club_receivable"("p_receivable_id" "uuid", "p_payment_method" "text", "p_paid_at" timestamp with time zone, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pay_club_receivable"("p_receivable_id" "uuid", "p_payment_method" "text", "p_paid_at" timestamp with time zone, "p_notes" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."pay_club_receivable"("p_receivable_id" "uuid", "p_payment_method" "text", "p_paid_at" timestamp with time zone, "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."pick_barber_runtime_schema"("p_public_exists" boolean, "p_public_freshness" timestamp with time zone, "p_barber_exists" boolean, "p_barber_freshness" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pick_barber_runtime_schema"("p_public_exists" boolean, "p_public_freshness" timestamp with time zone, "p_barber_exists" boolean, "p_barber_freshness" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."pick_barber_runtime_schema"("p_public_exists" boolean, "p_public_freshness" timestamp with time zone, "p_barber_exists" boolean, "p_barber_freshness" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pick_barber_runtime_schema"("p_public_exists" boolean, "p_public_freshness" timestamp with time zone, "p_barber_exists" boolean, "p_barber_freshness" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."preview_plan_credit_for_service"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_start_time" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preview_plan_credit_for_service"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_start_time" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."preview_plan_credit_for_service"("p_tenant_id" "uuid", "p_client_id" "uuid", "p_service_id" "uuid", "p_start_time" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."process_audit_log"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_audit_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_audit_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reactivate_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reactivate_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reactivate_customer_subscription"("p_tenant_id" "uuid", "p_subscription_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_club_receivable_statuses"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_club_receivable_statuses"("p_tenant_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."refresh_club_receivable_statuses"("p_tenant_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."renew_subscription_cycle"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_new_cycle_start" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."renew_subscription_cycle"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_new_cycle_start" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."renew_subscription_cycle"("p_tenant_id" "uuid", "p_subscription_id" "uuid", "p_new_cycle_start" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_role_permissions_to_default"("p_tenant_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_role_permissions_to_default"("p_tenant_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_role_permissions_to_default"("p_tenant_id" "uuid", "p_role" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_comanda_runtime_schema"("p_comanda_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_comanda_runtime_schema"("p_comanda_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_comanda_runtime_schema"("p_comanda_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_credit_runtime_schema"("p_subscription_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_credit_runtime_schema"("p_subscription_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_credit_runtime_schema"("p_subscription_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_product_runtime_schema"("p_product_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_product_runtime_schema"("p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_product_runtime_schema"("p_product_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_notification_preferences"("p_preferences" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_notification_preferences"("p_preferences" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."set_notification_preferences"("p_preferences" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_notification_preferences"("p_preferences" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tenant_id_from_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tenant_id_from_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tenant_id_from_context"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_tenant_id_from_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_tenant_id_from_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tenant_id_from_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_managers"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_managers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_managers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_timestamp"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."setup_new_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."setup_new_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_new_account"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_profile_to_user_tenants"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_profile_to_user_tenants"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_to_user_tenants"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."table_has_column"("p_schema_name" "text", "p_table_name" "text", "p_column_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."table_has_column"("p_schema_name" "text", "p_table_name" "text", "p_column_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."table_has_column"("p_schema_name" "text", "p_table_name" "text", "p_column_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_user_tenants_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_user_tenants_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_user_tenants_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_cash_closing_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_cash_closing_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_cash_closing_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_role_permissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_role_permissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_role_permissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_role_permissions"("p_tenant_id" "uuid", "p_role" "text", "p_permissions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_role_permissions"("p_tenant_id" "uuid", "p_role" "text", "p_permissions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_role_permissions"("p_tenant_id" "uuid", "p_role" "text", "p_permissions" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_and_fix_comandas"("p_tenant_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_and_fix_comandas"("p_tenant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_and_fix_comandas"("p_tenant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "varejo"."create_order_varejo"("p_tenant_id" "uuid", "p_seller_id" "uuid", "p_items" "jsonb") TO "authenticated";












GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."appointments" TO "authenticated";
GRANT ALL ON TABLE "barber"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."clients" TO "authenticated";
GRANT ALL ON TABLE "barber"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."comanda_items" TO "anon";
GRANT ALL ON TABLE "public"."comanda_items" TO "authenticated";
GRANT ALL ON TABLE "public"."comanda_items" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."comanda_items" TO "authenticated";
GRANT ALL ON TABLE "barber"."comanda_items" TO "service_role";



GRANT ALL ON TABLE "public"."comandas" TO "anon";
GRANT ALL ON TABLE "public"."comandas" TO "authenticated";
GRANT ALL ON TABLE "public"."comandas" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."comandas" TO "authenticated";
GRANT ALL ON TABLE "barber"."comandas" TO "service_role";



GRANT ALL ON TABLE "public"."customer_plans" TO "anon";
GRANT ALL ON TABLE "public"."customer_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_plans" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."customer_plans" TO "authenticated";
GRANT ALL ON TABLE "barber"."customer_plans" TO "service_role";



GRANT ALL ON TABLE "public"."customer_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."customer_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_subscriptions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."customer_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "barber"."customer_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_barber" TO "anon";
GRANT ALL ON TABLE "public"."feedback_barber" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_barber" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."feedback_barber" TO "authenticated";
GRANT ALL ON TABLE "barber"."feedback_barber" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_shop" TO "anon";
GRANT ALL ON TABLE "public"."feedback_shop" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_shop" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."feedback_shop" TO "authenticated";
GRANT ALL ON TABLE "barber"."feedback_shop" TO "service_role";



GRANT ALL ON TABLE "public"."kiosk_devices" TO "anon";
GRANT ALL ON TABLE "public"."kiosk_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."kiosk_devices" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."kiosk_devices" TO "authenticated";
GRANT ALL ON TABLE "barber"."kiosk_devices" TO "service_role";



GRANT ALL ON TABLE "public"."kiosk_sessions" TO "anon";
GRANT ALL ON TABLE "public"."kiosk_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."kiosk_sessions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."kiosk_sessions" TO "authenticated";
GRANT ALL ON TABLE "barber"."kiosk_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."products" TO "authenticated";
GRANT ALL ON TABLE "barber"."products" TO "service_role";



GRANT ALL ON TABLE "public"."promotions" TO "anon";
GRANT ALL ON TABLE "public"."promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."promotions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."promotions" TO "authenticated";
GRANT ALL ON TABLE "barber"."promotions" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "barber"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_blocks" TO "anon";
GRANT ALL ON TABLE "public"."schedule_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_blocks" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."schedule_blocks" TO "authenticated";
GRANT ALL ON TABLE "barber"."schedule_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."services" TO "authenticated";
GRANT ALL ON TABLE "barber"."services" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."staff" TO "authenticated";
GRANT ALL ON TABLE "barber"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "barber"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "barber"."transactions" TO "authenticated";
GRANT ALL ON TABLE "barber"."transactions" TO "service_role";



GRANT ALL ON TABLE "control"."admin_profiles" TO "authenticated";



GRANT ALL ON TABLE "control"."app_health_checks" TO "authenticated";



GRANT ALL ON TABLE "control"."app_incidents" TO "authenticated";



GRANT SELECT,INSERT ON TABLE "control"."commercial_audit_logs" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_clients" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_contract_clauses" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_product_features" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_product_phases" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_product_test_phases" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_products" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_quote_phases" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_settings" TO "authenticated";



GRANT SELECT,INSERT ON TABLE "control"."commercial_signature_events" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "control"."commercial_templates" TO "authenticated";



GRANT ALL ON TABLE "control"."integration_logs" TO "authenticated";



GRANT ALL ON TABLE "control"."smg_client_apps" TO "authenticated";



GRANT ALL ON TABLE "control"."smg_clients" TO "authenticated";



GRANT ALL ON TABLE "control"."smg_products" TO "authenticated";









GRANT ALL ON TABLE "public"."_prisma_migrations" TO "anon";
GRANT ALL ON TABLE "public"."_prisma_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."_prisma_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."access_requests" TO "anon";
GRANT ALL ON TABLE "public"."access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."alerts" TO "anon";
GRANT ALL ON TABLE "public"."alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts" TO "service_role";



GRANT ALL ON TABLE "public"."appointment_services" TO "anon";
GRANT ALL ON TABLE "public"."appointment_services" TO "authenticated";
GRANT ALL ON TABLE "public"."appointment_services" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."barber_closings" TO "anon";
GRANT ALL ON TABLE "public"."barber_closings" TO "authenticated";
GRANT ALL ON TABLE "public"."barber_closings" TO "service_role";



GRANT ALL ON TABLE "public"."cash_closing_events" TO "anon";
GRANT ALL ON TABLE "public"."cash_closing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_closing_events" TO "service_role";



GRANT ALL ON TABLE "public"."cash_closings" TO "anon";
GRANT ALL ON TABLE "public"."cash_closings" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_closings" TO "service_role";



GRANT ALL ON TABLE "public"."comandas_health" TO "anon";
GRANT ALL ON TABLE "public"."comandas_health" TO "authenticated";
GRANT ALL ON TABLE "public"."comandas_health" TO "service_role";



GRANT ALL ON TABLE "public"."customer_benefit_consumptions" TO "anon";
GRANT ALL ON TABLE "public"."customer_benefit_consumptions" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_benefit_consumptions" TO "service_role";



GRANT ALL ON TABLE "public"."customer_credits" TO "anon";
GRANT ALL ON TABLE "public"."customer_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_credits" TO "service_role";



GRANT ALL ON TABLE "public"."customer_plan_benefits" TO "anon";
GRANT ALL ON TABLE "public"."customer_plan_benefits" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_plan_benefits" TO "service_role";



GRANT ALL ON TABLE "public"."customer_plan_credit_usages" TO "anon";
GRANT ALL ON TABLE "public"."customer_plan_credit_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_plan_credit_usages" TO "service_role";



GRANT ALL ON TABLE "public"."customer_subscription_receivables" TO "service_role";
GRANT SELECT ON TABLE "public"."customer_subscription_receivables" TO "authenticated";



GRANT ALL ON TABLE "public"."financial_reversals" TO "anon";
GRANT ALL ON TABLE "public"."financial_reversals" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_reversals" TO "service_role";



GRANT ALL ON TABLE "public"."kiosk_addons" TO "anon";
GRANT ALL ON TABLE "public"."kiosk_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."kiosk_addons" TO "service_role";



GRANT ALL ON TABLE "public"."managers" TO "anon";
GRANT ALL ON TABLE "public"."managers" TO "authenticated";
GRANT ALL ON TABLE "public"."managers" TO "service_role";



GRANT ALL ON TABLE "public"."notification_channels" TO "anon";
GRANT ALL ON TABLE "public"."notification_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_channels" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."otp_requests" TO "anon";
GRANT ALL ON TABLE "public"."otp_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."otp_requests" TO "service_role";



GRANT ALL ON TABLE "public"."plan_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."plan_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."portal_sessions" TO "anon";
GRANT ALL ON TABLE "public"."portal_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."portal_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions_audit" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions_audit" TO "service_role";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."service_execution_participants" TO "anon";
GRANT ALL ON TABLE "public"."service_execution_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."service_execution_participants" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_addons" TO "anon";
GRANT ALL ON TABLE "public"."tenant_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_addons" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_goals" TO "anon";
GRANT ALL ON TABLE "public"."tenant_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_goals" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_messages" TO "anon";
GRANT ALL ON TABLE "public"."ticket_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_messages" TO "service_role";



GRANT ALL ON TABLE "public"."usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."user_tenants" TO "anon";
GRANT ALL ON TABLE "public"."user_tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tenants" TO "service_role";



GRANT ALL ON TABLE "varejo"."inventory_movements" TO "authenticated";



GRANT ALL ON TABLE "varejo"."order_items" TO "authenticated";



GRANT ALL ON TABLE "varejo"."orders" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "barber" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "barber" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "barber" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "barber" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































