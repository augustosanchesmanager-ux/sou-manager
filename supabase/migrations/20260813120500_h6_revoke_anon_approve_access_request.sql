-- ==============================================================================
-- H6 F6-1: approve_access_request — revoke EXECUTE de anon/PUBLIC (hardening)
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md), observação F6-1.
--   RPC legada SECURITY DEFINER (20260220150238) sem guarda auth.uid()/tenant no
--   corpo; NÃO estava na revoke list anon (20260808110000). Não explorável na
--   prática hoje (criação de tenant falha), mas exposta sem revoke.
-- Decisão do PO (2026-08-13): REVOGAR apenas EXECUTE de anon AGORA (hardening de
--   custo zero), SEM alterar a lógica da RPC nesta etapa. Revisão da guarda
--   auth.uid()/tenant fica registrada como dívida P3 (etapa posterior).
-- Uso legítimo: pages/SuperAdmin.tsx (superadmin = authenticated) — preservado.
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.approve_access_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_access_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_access_request(uuid) TO authenticated;

-- NOTIFY pgrst, 'reload schema';
