# Phase 6.0.3 — Team Onboarding & Invitations: Execution Plan

> **Documento de planejamento oficial da Fase 6.0.3.**
> Aprovado pelo PO (Augusto) em 2026-08-05. ADR-011 define o escopo; este documento detalha a execução, decisões, riscos e critérios.

---

## 1. Objetivo

Onboarding de profissionais convidados, da criação do convite pelo gestor/owner até o acesso operacional do profissional ao tenant, com permissões iniciais aplicadas.

## 2. Decisões do PO (2026-08-05)

| # | Decisão | Valor |
|---|---------|-------|
| D1 | Primeiro acesso | **Link de convite + definir senha** (self-service, padrão de mercado) |
| D2 | Papéis convidáveis | **Barber + Receptionist** (únicos governados por `role_permissions`). Manager/AdminManager seguem pelo fluxo atual (`admin-create-user`) |
| D3 | Limite por plano | **Bloquear no convite** — RPC `invite_staff` valida limite de profissionais ativos do plano (1/5/∞ de `BUSINESS_DECISIONS`) |
| D4 | Canal de envio | **Supabase Auth invite** (`supabase.auth.admin.inviteUserByEmail`) — verificar SMTP do projeto antes |
| D5 | Kiosk RLS | **Corrigir na 6.0.3**: remover `public_select_staff` `USING (true)`; criar camada segura para kiosk expondo apenas nome, cargo e status necessário; não expor email/user_id/dados internos (menor privilégio) |

## 3. Regra de Entrada — Resultado das Auditorias (2026-08-05)

### 3.1 Auditoria Documental
- **Conflito:** 3 versões de fluxo de senha em docs de treino (`manager/README.md:639`, `faq/README.md:785`, `exercises/README.md:1429`) — **resolvido pela D1**.
- **Divergência:** papel "Caixa" ensinado no FAQ mas inexistente como role — manter fora do escopo.
- **Gaps:** nenhuma documentação de convite/aceite/onboarding individual do profissional existe.

### 3.2 Auditoria Arquitetural
- **Reutilizável:** `user_tenants` + `resolveTenantForUser` + `get_auth_access_context` (fallback staff→profiles); Edge Function `admin-create-user`; padrão RPC transacional + Application Service; seeds de `role_permissions` (Barber=19, Receptionist=41); triggers `handle_new_manager_profile` e `trg_set_tenant_id`.
- **Lacunas:** sem tabela de convite, sem RPC `accept_invite`, sem rota/página de aceite, profissionais sem row em `profiles`, `user_tenants` sem policy de INSERT (escritas só via RPC SECURITY DEFINER — padrão a manter).
- **Risco estrutural:** `role_permissions` é **apenas editorável, nunca aplicada** no frontend (nenhum `can()`). A 6.0.3 deve decidir se aplica permissões na UI — ver §5 R3.

### 3.3 Auditoria de Nomenclatura
- **Termos dominantes:** `staff` (técnico/banco), `team`/`equipe` (UI), `professional`/`profissional` (financeiro), `barbeiro` (label SMG Barber).
- **Divergência crítica:** 4 vocabulários de role — `staff.role` (PascalCase), `profiles.role` (minúsculo, inclui `staff`), `role_permissions.role` (só Barber/Receptionist), `user_tenants.role` (`member`).
- **Decisão:** seguir a linguagem do ADR-011 (`team`, `convite`, `profissionais`); manter `staff` como termo técnico; **não** criar `people`/`professionals` como rota/pasta; novos artefatos de convite nomeados `invitation`/`convite`.

### 3.4 Auditoria de Consistência (verificação no código)
- `20260305050000_kiosk_rls_fix.sql:15-16` — confirmado `public_select_staff USING (true)`.
- `src/lib/permissions/types.ts:1` — confirmado `PermissionRole = 'Barber' | 'Receptionist'` apenas.
- `supabase/functions/admin-create-user/index.ts:13-31` — confirmado mapeamento de roles PT/EN e criação via service role.
- `App.tsx:245-263` — confirmado: `RoleSelection`/`ProfessionalSetup` **sem rota raiz**; apenas `/team` e `/access-control`.

## 4. Escopo de Implementação

### 4.1 Banco (migration `2026080X_phase_6_0_3_team_invitations.sql`)
- [ ] Tabela `team_invitations` (ou `invitations`): `id`, `tenant_id`, `email`, `role` CHECK (`Barber`,`Receptionist`), `token` (uuid único), `status` (`pending`/`accepted`/`expired`/`revoked`), `expires_at`, `invited_by` (auth.uid), `created_at`, `accepted_at`. RLS tenant + superadmin bypass.
- [ ] RPC `invite_team_member(tenant_id, email, role)` SECURITY DEFINER:
  - valida chamador (staff.role IN Manager/AdminManager + active)
  - valida limite de profissionais ativos por plano (D3)
  - upsert `team_invitations` + gera token
- [ ] RPC `accept_invite(token, first_name, last_name)` SECURITY DEFINER:
  - valida token ativo/não expirado
  - cria `profiles` (role lowercase correspondente) + `staff` (role PascalCase, status active, id=auth.uid) + `user_tenants` (role + is_primary=false)
  - marca convite `accepted`
- [ ] RPC `revoke_invite(invitation_id)` + `resend_invite(invitation_id)` (padrão `provision_new_tenant`)
- [ ] Trigger `handle_new_user` → profiles (se não existir) para completar identidade do convidado
- [ ] **Kiosk RLS fix (D5):** remover `public_select_staff`; criar view segura `public.kiosk_staff_view` (id, name, role, status apenas) com RLS que exponha somente o necessário; política RLS de `staff` restrita a tenant/autenticado
- [ ] Eventos de domínio: `StaffInvited`, `StaffAccepted` (outbox)

### 4.2 Domínio/Application (TypeScript)
- [ ] `domain/invitation/` — `Invitation` types + `InvitationRepository` (get by token, list by tenant, update status)
- [ ] `application/teamInvitation.ts` — `TeamInvitationService` (invite, accept, revoke, resend, list) espelhando `tenantProvisioning.ts`
- [ ] `domain/staff/repository.ts` — adicionar `create` (ou delegar à Edge Function/RPC)
- [ ] `domain/userTenant/` (ou `domain/membership/`) — repositório de user_tenants
- [ ] Eventos `StaffInvited`/`StaffAccepted` no `domain/events/types.ts`

### 4.3 Frontend
- [ ] `pages/Team.tsx` — substituir criação direta por fluxo de convite (envio via service)
- [ ] Página/rota de aceite: `/#/accept-invite/:token` (público, sem auth prévia)
- [ ] Fluxo: token → define senha (Supabase Auth invite) → completa perfil → redireciona para dashboard
- [ ] Lista de convites pendentes no `Team.tsx` (status, expiração, revogar, reenviar)
- [ ] Aplicação de permissões: decisão §5 R3

### 4.4 Testes
- [ ] Unit: `application/teamInvitation.test.ts` (invite/accept/revoke/resend, limites, expiração, validação)
- [ ] E2E flow8: manager convida → profissional aceita (via Admin API para criar o convidado) → login → acesso ao tenant com permissões
- [ ] E2E: convite expirado, convite revogado, limite de plano excedido
- [ ] Atualizar `globalSetup`/fixtures com usuário "convidado"

## 5. Riscos e Mitigações

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| R1 | Divergência de identidade (staff/profiles/user_tenants) | Alto — vínculo incorreto | Sincronizar em RPC `accept_invite` transacional; definir `staff.id=auth.uid` como padrão (align com `admin-create-user`) |
| R2 | SMTP do projeto não verificado | Médio — convite não chega | Check antecipado; fallback "link manual copiado" (D4) |
| R3 | `role_permissions` não é aplicada na UI | Médio — permissões sem efeito | Escopo 6.0.3 = criar papéis + seeds; **enforcement real fica para decisão** (ver abaixo) |
| R4 | `approve_access_request()` legado sem auth check | Médio — vetor de acesso | Não é caminho da 6.0.3; registrar pendência (R6) |
| R5 | Kiosk quebrado após restringir staff | Médio — totem/QR | View segura `kiosk_staff_view` mantém dados mínimos |
| R6 | `profiles.role` CHECK não tem `receptionist`/`admin` | Médio — policy inalcançável | Ajustar CHECK em migration para incluir `receptionist` (decisão de normalização de roles — consultar PO) |

### Decisão pendente R3 (permissões)
`role_permissions` hoje é apenas editorável (UI `/access-control`), nunca aplicada. Opções:
- (a) **6.0.3 aplica permissões na UI** — criar hook `can('permission_key')` e guardar rotas/ações; escopo maior.
- (b) **6.0.3 só garante papéis+seeds corretos**; enforcement fica para a 6.0.5 (Feature Flags).

Recomendação do time: (b) — manter a 6.0.3 focada em convite/aceite/vínculo; o enforcement de permissões pertence ao sistema de permissões (6.0.5), evitando retrabalho. Decisão final do PO necessária.

## 6. Critérios de Saída

- [ ] Profissional convidado (Barber/Receptionist) consegue aceitar convite, definir senha e acessar o tenant
- [ ] Papel + `user_tenants` + `staff` + `profiles` criados consistentemente no aceite
- [ ] Limite de equipe por plano bloqueia convite excedente
- [ ] Kiosk continua funcional com menor privilégio (sem email/user_id expostos)
- [ ] E2E do fluxo convite → acesso verde
- [ ] Unit + E2E completos verdes; build pass; tsc sem novos erros

## 7. Dependências

- Supabase SMTP/email configurado (D4)
- `BUSINESS_DECISIONS.md` — limites por plano (1/5/∞)
- ADR-011 (escopo) — aprovado
- Decisão PO sobre R3 (enforcement de permissões) — pendente
- Decisão PO sobre normalização de `profiles.role` (R6) — pendente

## 8. Arquivos Alvo (estimativa)

- Migração: `supabase/migrations/2026080X_phase_6_0_3_team_invitations.sql`
- `domain/invitation/*`, `application/teamInvitation.ts`, `domain/events/types.ts` (+subscribers)
- `domain/staff/repository.ts`, `domain/staff/types.ts`
- `pages/Team.tsx`, nova página de aceite, `App.tsx` (rota)
- `tests/e2e/flows/flow8-*.spec.ts`, fixtures

## 9. Sequência de Execução (proposta)

1. Verificar SMTP (D4) e definir normalização de roles (R6) com PO
2. Migration: `team_invitations` + RPCs + kiosk view + eventos
3. Aplicar migration (estratégia READ/REPAIR — MIGRATION_EXCEPTION_20260801.md)
4. Domain + Application Service + unit tests
5. Frontend: convite no Team + página de aceite
6. E2E flow8 + fixtures + gated
7. Docs (PROJECT_STATUS, ROADMAP → Certified) + tag `v1.3.0-team-onboarding-certified`
