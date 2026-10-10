# ADR-032: Agendamento Online Público — Booking Web Anônimo (P.02-BOOKING-PUBLIC)

**Status:** Proposed
**Date:** 2026-10-09
**Deciders:** PO (Augusto) + OpenCode
**Front:** P.02-BOOKING-PUBLIC (INTAKE → AUDIT → CLASSIFY → STOP concluídos; autorização A do PO)

## Context

O produto já possui duas superfícies anônimas de agendamento: o Kiosk (totem/QR) e o Portal do Cliente. Ambas inserem diretamente em `appointments` com `status = 'pending'`, sem idempotência e sem proteção contra duplo clique (`docs/FASE_3_RPC_AGENDAMENTOS_TRANSACIONAIS.md`, seção "Fluxos Não Migrados"). Nenhuma delas é um link público de reserva na web.

A integração Site Sanchez provou o padrão de RPC `SECURITY DEFINER` com `pg_advisory_xact_lock` + probe de conflito `tstzrange(...) && tstzrange(...)` com `ERRCODE '23P01'` (`supabase/migrations/20260426000001_site_sanchez_appointments_correction.sql:166-168, 282-291`). Esse é o único mecanismo de anti-sobreposição existente no banco: não há constraint `EXCLUDE` em `appointments` (evidência F).

O papel `anon` tem **zero políticas RLS** sobre `clients` e `appointments` desde `20260308_multitenant_hotfix.sql` (todas dropadas e recriadas `FOR ALL TO authenticated`; confirmado em `20260813130000_h6_fix_f6_a_public_select_tenants_services.sql:23-24`). Qualquer superfície pública de reserva precisa, portanto, passar por RPCs `SECURITY DEFINER` com projeção estrita, nunca por acesso direto a tabela.

O ADR-012 estabelece que o Supabase **auto-concede `EXECUTE` a `anon`** em funções novas; toda migration que cria/redefine RPC deve executar `REVOKE EXECUTE ... FROM PUBLIC` e `REVOKE EXECUTE ... FROM anon`, e só então conceder explicitamente (`docs/security/SECURITY_AUDIT_RPC.md`, seção "Padrão obrigatório (ADR-012)"). Hoje existem apenas duas funções públicas sancionadas: `kiosk_get_staff` (`20260806000000_phase_6_0_3_team_invitations_and_role_normalization.sql:910-956`) e `get_invite_by_token` (backlog do `SECURITY_AUDIT_RPC.md`).

O backlog P0-3/P0-4 (`docs/audit/ARCHAEOLOGY_20260927/13-next-fronts.md`) registra a frente de agendamento público. O roadmap está congelado (`ROADMAP.md:5-6, 32-34`): o ADR é o único caminho de evolução estrutural.

## Problem

Barbearias precisam de um link público de reserva (`/booking/:tenantSlug`, rota pública sem auth, como `/kiosk/:tenantSlug` e `/c/:tenantSlug`) onde um visitante anônimo vê o perfil do tenant, escolhe serviços, consulta horários livres e reserva sem login. As superfícies anônimas atuais (kiosk/portal) inserem direto em `appointments` com `status = 'pending'`, sem idempotência, sem anti-dupla-reserva e sem token para gestão posterior. Uma superfície web pública não pode vazar dados de tenant/cliente e não pode permitir dupla reserva no mesmo horário.

## Decision

1. Introduzir uma superfície pública anônima de agendamento online por meio de **4 RPCs `SECURITY DEFINER`** (4ª incluída por emenda do rascunho — decisão do PO, 2026-10-09):
   - `get_public_tenant_profile` — perfil público do tenant (allowlist estrita).
   - `get_public_available_slots` — horários livres (nunca quem ocupou).
   - `create_public_booking` — criação atômica da reserva anônima.
   - `cancel_public_booking` — cancelamento via public token dentro da janela homologada (120 min), revogação single-use.
2. As 4 seguem as regras de grant do ADR-012: `REVOKE EXECUTE ... FROM PUBLIC`, `REVOKE EXECUTE ... FROM anon`, e `GRANT EXECUTE ... TO anon, authenticated` nas 4 públicas. Qualquer outra função criada na mesma migration recebe `REVOKE FROM anon`.
3. Reutilizar o schema existente (`appointments`, `appointment_services`, `services`, `staff`, `schedule_blocks`, `tenant_settings`, `tenants`). **Não** criar camadas novas de Repository/Application Service (exigiria ADR próprio; fora do escopo).
4. **Zero vazamento de dados:** como `anon` não tem RLS sobre `clients`/`appointments`, toda leitura/escrita passa pelas 4 RPCs com projeção estrita. Nenhuma resposta contém dados de terceiros, financeiro, faturamento ou configuração interna.
5. **Anti-dupla-reserva:** `pg_advisory_xact_lock(hashtextextended(tenant_id || ':' || staff_id, 0))` + probe `tstzrange(...) && tstzrange(...)` com `RAISE EXCEPTION ... USING ERRCODE = '23P01'`, exatamente o padrão de `create_site_sanchez_appointment` (`20260426000001:166-168, 282-291`).
6. **Captura de cliente sem fricção:** nome + WhatsApp (telefone), com dedup por telefone normalizado por tenant (`regexp_replace(phone, '\D', '', 'g')`, padrão `20260426000001:266`).
7. **Multi-tenant por slug:** resolução por `tenants.slug` (`UNIQUE`, `20260220145436_setup_multi_tenant_and_products_v2.sql:6`), com fallback por id como em `kiosk_get_staff` (`20260806000000:933-940`).
8. **Token público** para gestão posterior da reserva (cancelamento), armazenado **hashado** (precedente `portal_sessions.token_hash`, `20260305100000_unified_addons_and_portal.sql:159-168`), retornado em texto puro uma única vez. Consumido por `cancel_public_booking` (janela de 120 min; revogação single-use).

## Alternatives Considered

- **Edge Function com `service_role` chamando RPC interna** (padrão Site Sanchez). Rejeitada para a superfície pública: adiciona um salto de rede e um segredo a gerenciar para um fluxo que é lógica pura de banco. As 4 RPCs são chamáveis diretamente por `anon` com menor privilégio.
- **Acesso direto a tabela com novas políticas RLS para `anon`.** Rejeitada: contradiz a postura de zero políticas sobre `clients`/`appointments` (`20260308_multitenant_hotfix.sql`) e exigiria grants por coluna em tabelas sensíveis.
- **RPC única gigante.** Rejeitada: perfil e horários são leituras `STABLE` e cacheáveis; a reserva é escrita. A separação mantém as funções de leitura baratas e a superfície de escrita mínima.

## Consequences

- As 4 funções passam a ser as funções públicas sancionadas nº 3, 4, 5 e 6 (após `kiosk_get_staff` e `get_invite_by_token`). O drift audit de Function ACLs (decisão formal do PO, 2026-09-09, `SECURITY_AUDIT_RPC.md`) deve incluí-las.
- Dependências de migration: novas colunas em `tenant_settings` (`booking_enabled`, `min_booking_notice_minutes`, `auto_confirm_online_bookings`, `public_cancel_window_minutes`, `work_start_time`, `work_end_time`), extensão do CHECK de `appointments.source` com `'booking_web'`, versionamento de `appointment_services` (existe no banco sem migration de criação), tabela nova `public_booking_tokens`, e colunas opcionais de perfil em `tenants`. Detalhado na SPEC.
- Decisões de negócio 1-7 **homologadas pelo PO em 2026-10-09**: status `confirmed` condicionado a `tenant_settings.auto_confirm_online_bookings`; antecedência mínima 30 min; janela de cancelamento público 120 min; validade do token 90 dias; inclusão da 4ª RPC `cancel_public_booking` (emenda do rascunho); expediente via `tenant_settings` com fallback em cascata; rate-limit anti-spam aprovado. Detalhes na SPEC, seção "Decisões de negócio homologadas (PO)".
- Frentes futuras (mencionadas apenas como escopo posterior, não especificadas aqui): frontend React do fluxo (5 passos), tela de configuração `/configuracoes/reserva`, badge 🌐 na agenda interna, QR Code.
- Downstream (listados, não especificados aqui): badge/config UI interna e WhatsApp deep-link no voucher.

## References

- **SPEC técnica:** `docs/SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md` v1.1 (contrato completo das 4 RPCs; decisões 1-7 homologadas pelo PO em 2026-10-09).
- **ADR-012:** `docs/adr/ADR-012-rpc-execute-grants.md` (grants de EXECUTE, least-privilege).
- **Auditoria RPC:** `docs/security/SECURITY_AUDIT_RPC.md` (seção "Padrão obrigatório (ADR-012)").
- **Precedente de spec:** `docs/FASE_3_RPC_AGENDAMENTOS_TRANSACIONAIS.md`.
- **Precedente de contrato público:** `docs/integrations/SITE-SANCHEZ-CONTRACT.md`.
- **Backlog:** `docs/audit/ARCHAEOLOGY_20260927/13-next-fronts.md` (P0-3/P0-4).
- **Nota de drift de numeração:** os arquivos `ADR-028-smg-gate-formal-contract.md` e `ADR-029-smg-repair-documental-coordinator.md` existem em `docs/adr/` mas estão **ausentes do índice** `docs/adr/README.md`. A reparação do índice é **frente separada** e não é feita neste ADR.

---

**STATUS:** Rascunho v1.1 — decisões do PO homologadas (2026-10-09); emenda do rascunho: 4ª RPC `cancel_public_booking` incluída. Aguarda aprovação formal ( Accepted ) e frente isolada de implementação.