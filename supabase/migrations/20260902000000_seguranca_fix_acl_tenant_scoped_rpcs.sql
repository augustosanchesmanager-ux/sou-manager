-- ============================================================
-- 20260902000000_seguranca_fix_acl_tenant_scoped_rpcs.sql
-- H-8 RETROFIT (PASS COM CONDIÇÃO): ACL das 3 RPCs tenant-scoped
--
-- Contexto: revalidação read-only de produção (2026-09-02, decisão PO
--   H-8 PASS COM CONDIÇÃO) identificou que as migrations corretivas
--   `20260901150000` e `20260901160100` revogam EXECUTE apenas de
--   `PUBLIC`, deixando grants explícitos pré-existentes de
--   `anon` e `service_role` intactos nas 3 RPCs tenant-scoped:
--     - correct_appointment_attendance(UUID, UUID, TIMESTAMPTZ, TEXT)
--     - register_comanda_payment(UUID, UUID, payment_type, NUMERIC, TEXT, TEXT, TEXT)
--     - confirm_appointment_attendance(UUID, UUID)
--   As duas bulk_close (`20260831120000`/`20260901120000`) já fazem o
--   revoke completo (`FROM PUBLIC, anon, service_role`) — este retrofit
--   alinha as 3 RPCs residuais ao mesmo contrato de mínimo privilégio.
--
-- Mitigação existente: as 3 funções possuem guarda interna
--   `auth.uid() IS NULL → RAISE`, portanto anon/service_role sem claims
--   são rejeitados em runtime. O retrofit fecha o principle of least
--   privilege no nível de ACL (defesa em profundidade).
--
-- Escopo: SOMENTE ACL (REVOKE/GRANT) das 3 RPCs acima. Nenhuma regra de
--   negócio, corpo de função, migração legada ou frontend alterados.
--   `get_comanda_payment_summary` também apresenta grants a
--   anon/service_role em produção — FORA do escopo aprovado pelo PO
--   (3 RPCs); registrado para trilha própria futura.
--
-- TRILHA PRÓPRIA (homologação antes de produção). PRODUÇÃO NÃO TOCADA.
-- Aplicação em produção depende de decisão explícita do PO após
-- homologação do retrofit.
-- ============================================================

BEGIN;

-- ── correct_appointment_attendance (P4) ──────────────────────
REVOKE ALL ON FUNCTION public.correct_appointment_attendance(UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.correct_appointment_attendance(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- ── register_comanda_payment (P7) ────────────────────────────
REVOKE ALL ON FUNCTION public.register_comanda_payment(UUID, UUID, public.payment_type, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_comanda_payment(UUID, UUID, public.payment_type, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;

-- ── confirm_appointment_attendance (P5) ──────────────────────
REVOKE ALL ON FUNCTION public.confirm_appointment_attendance(UUID, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_appointment_attendance(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;