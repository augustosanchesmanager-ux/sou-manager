# HOMOLOG ACCOUNT PROVISIONING — Sanchez Barber (ETAPA B, §8.1#3)

> **Data da execução:** 2026-08-08 (noite)
> **Autorização:** D-HOM-11 (PO, 2026-08-08) — ETAPA B autorizada com **conta de homologação** no tenant Sanchez Barber (validação local, sem deploy de produção).
> **Ambiente:** banco real `ushsnmlbeurfvlkieiln` (Sanchez Barber), via `supabase db query --linked`.
> **Natureza:** provisionamento de **dados operacionais** (usuário de homologação) — **não** é migration de schema. Regra do plano: nenhuma migration nova fora do já deployado; este procedimento não altera schema/RLS/RPCs.
> **Relacionado:** `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` §8.1#3 + §8.2 · `docs/audit/SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` §9/S8.

---

## 1. Resultado

Conta de homologação **criada e validada de ponta a ponta** no tenant produtivo da Sanchez Barber:

| Campo | Valor |
|-------|-------|
| User ID (`auth.users`) | `189053ab-f76b-4e91-90fc-998bb693711d` |
| E-mail | `homolog.sanchez@barber.soumanager.com` |
| Tenant | `b716e290-f7f6-4449-b790-5ae9dcdadcab` (Barbearia Principal / `sanchez`, plano `pro`, `active`) |
| Perfil (`public.profiles`) | `manager` / `active` / `onboarding_completed=true` |
| Membership (`public.user_tenants`) | `manager` / `is_primary=true` |
| Staff (trigger automático) | `36f1705b-02c2-4309-ae55-b92de6f87549` — "Conta Homologacao v1.5", Manager, `active`, e-mail vinculado |
| E-mail confirmado | ✅ (`email_confirmed_at` + `confirmed_at` preenchidos) |
| Login GoTrue (`grant_type=password`) | ✅ 200 OK (token de acesso emitido) |
| RLS (`GET /rest/v1/profiles`) | ✅ lê o próprio profile |
| RPC `get_auth_access_context` | ✅ `tenant_id=b716e290…`, `access_role=manager`, `profile_status=active`, `is_super_admin=false` |

> **Credenciais:** a senha foi definida com hash bcrypt e **não é registrada em texto em nenhum documento versionado**. A custódia da senha segue com o OpenCode/PO (fora do repositório).

---

## 2. Procedimento executado

### 2.1 Passo 1 — Criação do usuário + vínculo (uma transação CTE)

```sql
WITH nova_conta AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    'homolog.sanchez@barber.soumanager.com',
    extensions.crypt('<SENHA>', extensions.gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Conta Homologacao v1.5"}',
    now(), now()
  )
  RETURNING id, email
),
nova_conta_profile AS (
  INSERT INTO public.profiles (id, tenant_id, full_name, role, status, onboarding_completed)
  SELECT id, 'b716e290-f7f6-4449-b790-5ae9dcdadcab', 'Conta Homologacao v1.5', 'manager', 'active', true
  FROM nova_conta
  RETURNING id, role, status
),
nova_conta_membership AS (
  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  SELECT id, 'b716e290-f7f6-4449-b790-5ae9dcdadcab', 'manager', true
  FROM nova_conta
  RETURNING user_id
)
SELECT u.id, u.email, p.role, p.status, m.user_id AS membership_user_id
FROM nova_conta u
JOIN nova_conta_profile p ON p.id = u.id
JOIN nova_conta_membership m ON m.user_id = u.id;
```

> O **trigger de backfill de staff** (`20260226052610_fix_manager_trigger_and_backfill_staff.sql`) criou automaticamente a linha em `public.staff` (Manager) a partir do profile manager primário — verificado na validação.

### 2.2 Passo 2 — Correção: linha ausente em `auth.identities`

O login falhava porque o usuário inserido via SQL **não possuía** a identidade `email` em `auth.identities` (0 identidades vs. 1 nos usuários criados pela Admin API). Inserida a identity no mesmo shape usado pelo GoTrue:

```sql
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  '189053ab-f76b-4e91-90fc-998bb693711d',
  '189053ab-f76b-4e91-90fc-998bb693711d',
  'email',
  jsonb_build_object(
    'email','homolog.sanchez@barber.soumanager.com',
    'email_verified',false, 'phone_verified',false,
    'sub','189053ab-f76b-4e91-90fc-998bb693711d'
  ),
  now(), now(), now()
)
ON CONFLICT DO NOTHING;
```

> ⚠️ `auth.identities.email` é **coluna gerada** — não pode ser informada no INSERT (erro `428C9`).

### 2.3 Passo 3 — Correção: colunas de token com `NULL` (causa raiz do 500)

O login seguia com erro GoTrue `500 "Database error querying schema"` / `unexpected_failure`. Causa raiz (documentada no Supabase troubleshooting): **colunas de token do `auth.users` devem conter string (`''`), não `NULL`** — `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current` (e demais `*_token`). Inserções diretas em `auth.users` deixam essas colunas `NULL` por padrão.

```sql
UPDATE auth.users
SET confirmation_token     = coalesce(confirmation_token, ''),
    recovery_token         = coalesce(recovery_token, ''),
    email_change           = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change_token     = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
WHERE id = '189053ab-f76b-4e91-90fc-998bb693711d';
```

> A senha foi também regenerada com custo bcrypt **10** (padrão GoTrue; o `gen_salt('bf')` sem argumento gera custo 6):
> `UPDATE auth.users SET encrypted_password = extensions.crypt('<SENHA>', extensions.gen_salt('bf', 10)) WHERE id = '…';`

---

## 3. Validação (evidência)

| # | Verificação | Comando | Resultado |
|---|-------------|---------|-----------|
| V-1 | Linha de auth + profile + membership + staff | `SELECT` de conferência (ver §4) | 4/4 com valores esperados |
| V-2 | Login GoTrue | `POST /auth/v1/token?grant_type=password` (apikey anon) | `200 OK`, `user.id=189053ab…`, token emitido |
| V-3 | RLS — leitura do próprio profile | `GET /rest/v1/profiles?select=id,role,status&id=eq.<uid>` (Bearer access token) | `[{id, role:"manager", status:"active"}]` |
| V-4 | Resolução de tenant | `POST /rest/v1/rpc/get_auth_access_context` (Bearer access token) | `tenant_id=b716e290…`, `access_role=manager`, `profile_status=active`, `is_super_admin=false` |

---

## 4. Queries de conferência (read-only)

```sql
-- auth + profile + membership + staff
select 'auth_user' as q, id::text, email, email_confirmed_at::text
from auth.users where id = '189053ab-f76b-4e91-90fc-998bb693711d'
union all
select 'profile', id::text, role || '/' || status, tenant_id::text
from public.profiles where id = '189053ab-f76b-4e91-90fc-998bb693711d'
union all
select 'membership', user_id::text, role || '/' || is_primary::text, tenant_id::text
from public.user_tenants where user_id = '189053ab-f76b-4e91-90fc-998bb693711d'
union all
select 'staff_trigger', s.id::text, s.role || '/' || s.status, s.email
from public.staff s where s.email = 'homolog.sanchez@barber.soumanager.com';

-- diagnóstico de colunas de token (deve retornar 0 linhas com NULL)
select confirmation_token, recovery_token, email_change, email_change_token_new
from auth.users where id = '189053ab-f76b-4e91-90fc-998bb693711d'
and (confirmation_token is null or recovery_token is null
  or email_change is null or email_change_token_new is null);
```

---

## 5. Pitfalls / lições para reprodução

1. **NUNCA inserir usuários em `auth.users` sem as colunas de token em `''`** → GoTrue responde `500 Database error querying schema` no login (Scan error: converting NULL to string is unsupported). Correção: `coalesce(..., '')` nas colunas `*_token`, `email_change`.
2. **Todo usuário de login precisa de linha em `auth.identities`** (provider `email`, `provider_id` = user id, `identity_data` com `sub`/`email`). Usuários via SQL nascem sem identity; usuários via Admin API ganham automaticamente.
3. **`auth.identities.email` é generated column** — não inserir (erro `428C9`).
4. **Custo bcrypt:** usar `extensions.gen_salt('bf', 10)` para alinhar ao padrão GoTrue (default do `gen_salt('bf')` = 6).
5. **Caminho oficial alternativo:** a Admin API (`admin.auth.admin.createUser` com `email_confirm: true`) gera o usuário com todas as colunas e identities corretas — preferida para usuários novos (padrão E2E `tests/e2e/helpers/supabaseAdmin.ts`). O SQL direto foi usado para **vincular a conta a um tenant existente** com role/status específicos.

---

## 6. Cleanup

- Usuário descartável criado durante o diagnóstico (`throwaway-*@example.com`) **removido** via Admin API (`deleteUser`) após a validação.
- Nenhuma outra alteração em `auth.*`/`public.*` além das linhas documentadas acima.
- Evidências brutas das queries: diretório temporário do OpenCode (`snapshot_sanchez`), **fora** do repositório.

---

## 7. ETAPA B — execução (validação local no frontend, 2026-08-08)

> **Escopo (§8.1#3):** repro `Invalid Refresh Token` → logout/login → conferir `auth.uid()`, resolução de tenant (`get_auth_access_context`), Dashboard e Comissões.
> **Como:** app local (`npm run dev`, porta 3000) com `.env.local` apontando para o Supabase real `ushsnmlbeurfvlkieiln`; navegação automatizada via Playwright (headless Chromium). **Validação local autorizada (D-HOM-11), sem deploy de produção.**

### 7.1 Resultados

| Verificação | Resultado | Evidência |
|-------------|-----------|-----------|
| Demo mode ativo? | **NÃO** (`VITE_SUPABASE_URL` presente → Supabase real) | UI sem caixa "Acesso de teste local" |
| Login UI (`/#/login`, e-mail/senha) | ✅ redirecionou para `/#/dashboard` | URL pós-login |
| Redirect indevido (`pending-approval`/`onboarding`/`Invalid Refresh Token`) | ✅ **Nenhum** | URL + console |
| Resolução de tenant | ✅ Comissões exibiu **dados reais da Sanchez** (HERON, valores do período) | conteúdo da página |
| Dashboard | ✅ carregou (navegação + KPIs) | screenshot |
| Comissões (`/#/commissions`) | ✅ **renderizou com dados reais** — "COMISSÃO CONFIRMADA R$ 305,00", "PENDENTE R$ 215,00", "VENDAS VÁLIDAS R$ 1.040,00", destaque HERON R$ 520,00 (20 lançamentos), taxa média 50.0% | screenshot + dump de texto |
| Erros de console (React) | ✅ **0** | Playwright |
| Erros HTTP Supabase (4xx/5xx, incl. PostgREST 400 do bug de comissões) | ✅ **0** | Playwright |

### 7.2 Achado (não bloqueante — P3, cosmético)

| ID | Severidade | Descrição | Origem | Impacto | Ação |
|----|-----------|-----------|--------|---------|------|
| EB-1 | **P3** | Header/sidebar exibem **"Minha Barbearia"** e **"PLANO FREE"** para a conta de homologação, embora o tenant seja `pro` | `components/Layout.tsx:26-27` deriva `displayName` e `displayPlan` de **`user.user_metadata`** (`shop_name`/`first_name`/`plan`) em vez do registro `tenants`. A conta via SQL tem `user_metadata` mínimo (`{"full_name": ...}`) → fallbacks | **Nenhum funcional**: autorização/feature flags usam a RPC `tenant_has_feature` (ADR-013) sobre `tenants.plan` — as comissões (feature `pro`) renderizaram corretamente. Afeta apenas contas com metadata não preenchido (ex.: criadas via SQL) ou metadata desatualizado | Registrado para o PO (regra de homologação: achado P0/P1/P2/P3 → **registrar, não corrigir automaticamente**). Correção proposta futura: derivar plano/nome de `tenants` via `TenantContext` |

> **Interpretação:** o achado **EB-1 não invalida a resolução de tenant** — as comissões exibidas são da Sanchez (HERON e valores reais), comprovando `get_auth_access_context` → `b716e290...`. "PLANO FREE" é apenas rótulo cosmético do header.

### 7.3 Achado (bloqueante do fluxo de Caixa — P1, CORRIGIDO)

| ID | Severidade | Descrição | Origem | Impacto | Ação |
|----|-----------|-----------|--------|---------|------|
| EB-2 | **P1** → ✅ corrigido | Erro **`column comandas.client_name does not exist`** no fluxo de Caixa | `COMANDA_COLUMNS` em `domain/comanda/repository.ts` selecionava `client_name`, `paid_amount` e `notes` — **3 colunas que não existem** na tabela `comandas` do banco real (comprovado via REST: `42703` nas 3). Introduzido no baseline `v1.0.0` (`4c92c91`, 2026-07-28) e presente também na produção `718f6f9` (via `src/hooks/useCashClosing.ts`) | `comandaRepository.list()` lança `RepositoryError` contra o banco real → afeta CashClosingPage, `syncComanda` do checkout (comanda sem `comandaId`), reschedule e lifecycle de agendamento. **Comissões NÃO afetadas** (resolvem nome via `clients`). Demo mode e E2E mascaram o bug | **✅ CORRIGIDO (2026-08-09, D-HOM-13, aprovado PO):** 3 colunas-fantasma removidas de `COMANDA_COLUMNS`/`toComanda`; tipo `Comanda` ajustado (`client_name`/`paid_amount`/`notes` opcionais — não são colunas); `UpdateComandaInput` sem `paid_amount`/`notes`; regression guard `domain/comanda/repository.test.ts` (5 testes: `list`/`get`/`getByAppointment`/`getByClient` sem colunas-fantasma + erro mapeado). Consumidores mantêm fallbacks (`loaders.ts` via `clientMap`; `summary.ts` via `'Cliente'`; `Commissions.tsx` via `amount_paid ?? total`). Unit **888/888**, typecheck sem novos erros (125 baseline), build OK, `architecture:ci` sem novos erros (3 baseline). **Sem migration.** Validação funcional no preview oficial (CashClosingPage, conta Sanchez) pendente — gate H-2 |
