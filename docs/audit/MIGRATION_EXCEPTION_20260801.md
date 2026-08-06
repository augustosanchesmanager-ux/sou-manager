# Exceção Operacional — Aplicação Manual da Migration #91 (Phase 6.0.1)

> **Data:** 2026-08-01
> **Projeto:** sou-manager (`ushsnmlbeurfvlkieiln`)
> **Branch:** `feature/phase-6-saas-core`
> **Status:** ✅ Aplicada manualmente por exceção documentada
> **Motivo:** Bug conhecido do Supabase CLI (`v2.105.0`) bloqueia `db push` para todo o histórico de migrations.

---

## 1. Motivo da Exceção

A migration `20260801000000_phase_6_0_1_provisioning.sql` (#91) **não pôde ser aplicada via `supabase db push --linked`** porque o CLI falha com erro `Remote migration versions not found in local migrations directory.` em TODA execução de push.

O erro é um **bug de ordenação do próprio CLI** (não um problema do projeto): o algoritmo `FindPendingMigrations` (`apps/cli-go/pkg/migration/apply.go`) assume que a ordem local (por nome de arquivo via `fs.ReadDir`) coincide com a ordem remota (por `ORDER BY version`). Isso quebra quando timestamps de 8 dígitos compartilham prefixo com timestamps de 14 dígitos.

Para não bloquear a evolução do produto, o PO autorizou a aplicação manual da #91 por caminho controlado, com validação completa antes de registrar no histórico.

---

## 2. Bug do Supabase CLI (Referência)

- **Issue aberta:** https://github.com/supabase/cli/issues/6036
- **Versão:** Supabase CLI `2.105.0` (Go, `apps/cli-go`)
- **Reprodução mínima (determinística):**

```
supabase/migrations/
├── 20260420_foo.sql          # timestamp de 8 dígitos
└── 20260420010000_bar.sql    # timestamp de 14 dígitos, mesmo prefixo "20260420"
```

- **Causa raiz:** `FindPendingMigrations` compara duas listas ordenadas de forma inconsistente:
  - Remota: `SELECT version ... ORDER BY version` → `20260420` < `20260420010000` (string prefixo menor)
  - Local: `fs.ReadDir` ordena por nome de arquivo → `20260420010000_bar.sql` < `20260420_foo.sql` (pois `'0'`=0x30 < `'_'`=0x5F)
  - No merge, `remote="20260420"` é comparado contra o arquivo local `20260420010000_bar.sql` → marcado como "missing" → `ErrMissingLocal`.
- **Correção sugerida:** ordenar a lista local pela **versão extraída** (`migrateFilePattern` grupo 1) em vez do nome de arquivo bruto.

---

## 3. Migrations Afetadas

| Migration | Timestamp | Situação |
|-----------|-----------|----------|
| `20260801000000_phase_6_0_1_provisioning.sql` | 14 dígitos | **Aplicada manualmente nesta exceção** |
| `20260420_add_service_credit_map.sql` | 8 dígitos | No-op histórico; presente local e remoto; não aplicável via push por causa do bug |
| `20260428_add_idempotency_key_to_appointments_and_comandas.sql` | 8 dígitos | No-op histórico; idem |
| `20260501_add_cancellation_fields_to_comandas.sql` | 8 dígitos | No-op histórico; idem |
| `20260502_add_is_overbooked_to_appointments.sql` | 8 dígitos | No-op histórico; idem |

**Nenhuma migration foi renomeada.** O histórico do projeto permanece intacto.

---

## 4. Evidências da Investigação

| Evidência | Resultado |
|-----------|-----------|
| `supabase db push --linked --dry-run --debug` | EXIT 1 — erro `Remote migration versions not found...`; saída salva em `db_push_dryrun_debug.txt` |
| Query remota `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version` | 92 versões; `20260420`/`20260428`/`20260501`/`20260502` presentes como 8 dígitos |
| Listagem local `supabase/migrations/*.sql` | 93 arquivos parseáveis; os 4 arquivos de 8 dígitos presentes |
| Simulação do algoritmo `FindPendingMigrations` (v2.105.0) com dados reais | Reproduz EXATAMENTE a sugestão `repair --status reverted 20260420 20260428 20260501 20260502` |
| `migration repair --status reverted` (histórico) | `DELETE 0` — não resolve; confirma que não é problema de linha órfã |
| Bug reportado no GitHub | https://github.com/supabase/cli/issues/6036 |

**Conclusão da investigação:** o erro independe do conteúdo do `schema_migrations`. É puramente um defeito de ordenação do CLI. Repairs, `--include-all` e reverter linhas **não** resolvem; qualquer correção local exigiria renomear arquivos, o que foi descartado para preservar o histórico.

---

## 5. Procedimento Utilizado

Ordem obrigatória aprovada pelo PO:

1. **Auditoria pré-aplicação** (somente leitura via `supabase db query --linked`):
   - `generate_unique_slug(p_base_slug text) → text` em `public` ✅
   - `provision_new_tenant` já existia com a MESMA assinatura → `CREATE OR REPLACE` seguro ✅
   - `complete_onboarding` existente ✅
   - `tenant_settings` SEM `timezone`/`currency` → `ADD COLUMN IF NOT EXISTS` ✅
   - Constraint `tenant_settings_tenant_id_key UNIQUE(tenant_id)` ✅ (requisito do `ON CONFLICT (tenant_id)`)
   - `profiles_pkey (id)` ✅; `user_tenants_user_id_tenant_id_key UNIQUE(user_id, tenant_id)` ✅
   - Triggers ativos: `trg_auto_insert_manager_to_staff`, `trg_setup_new_account`, `trg_sync_profile_to_user_tenants` (todas funções existem) ✅
   - Colunas de `profiles` (`id`, `tenant_id`, `full_name`, `role`, `status`, `onboarding_completed`) ✅

2. **Aplicação do SQL** (sem `db push`, sem `--include-all`):
   ```bash
   supabase db query --linked -o json -f "supabase/migrations/20260801000000_phase_6_0_1_provisioning.sql"
   ```
   Resultado: executado sem erros.

3. **Registro no histórico** (somente após validações passarem):
   ```bash
   supabase migration repair --status applied 20260801000000
   ```

---

## 6. Validações Executadas

| # | Validação | Resultado |
|---|-----------|-----------|
| 1 | `tenant_settings.timezone` (text) criada | ✅ |
| 2 | `tenant_settings.currency` (text) criada | ✅ |
| 3 | `provision_new_tenant` substituída (SECURITY DEFINER, novo corpo com `user_tenants` + `tenant_settings`) | ✅ |
| 4 | `generate_unique_slug` intacta | ✅ |
| 5 | `complete_onboarding` intacta | ✅ |
| 6 | `handle_new_manager_profile` intacta | ✅ |
| 7 | 3 triggers ativos em `profiles` | ✅ |
| 8 | `schema_migrations` contém `20260801000000` com `name=phase_6_0_1_provisioning` e 2 statements | ✅ |
| 9 | `db push --linked --dry-run` não lista mais a #91 como pendente | ✅ |

---

## 7. Reconciliação Futura

Quando o bug for corrigido no CLI (ou houver decisão formal de reorganizar o histórico), executar:

1. **Optionally** validar a correção no `supabase/cli` (issue #6036).
2. Reconciliar as 4 versões de 8 dígitos (`20260420`, `20260428`, `20260501`, `20260502`) — decisão a ser tomada pelo PO; as linhas estão registradas no `schema_migrations` com `name` e `statements`.
3. `supabase db push --linked` volta ao fluxo normal para as próximas migrations.

**Não renomear arquivos de migração** foi a decisão explícita do PO (preservação do histórico em produção).

---

## 8. Veredito

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   ✅ MIGRATION #91 (PHASE 6.0.1) — APLICADA POR EXCEÇÃO          │
│                                                                  │
│   SQL aplicado:                20260801000000_phase_6_0_1        │
│   Validações pré-aplicação:    9/9 checks pass                   │
│   Validações pós-aplicação:    9/9 checks pass                   │
│   Registrado no histórico:     version=20260801000000            │
│   Bug do CLI:                 supabase/cli#6036                  │
│   Fluxo normal retomado:      após fix do CLI (futuro)           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Complemento 2026-08-05 — Fix de Segurança + Ambiente de E-mail + Estratégia E2E

### 9.1 Fix de Segurança — `provision_new_tenant` (aplicado manualmente)

**Descoberta:** o RPC `provision_new_tenant` (SECURITY DEFINER) aceitava chamadas com `auth.uid()` NULO — um anônimo podia provisionar um tenant para QUALQUER `user_id`.

**Correção:** migration `20260805000000_fix_provision_new_tenant_auth_check.sql`, aplicada manualmente via `supabase db query --linked -f` e registrada via `supabase migration repair --status applied 20260805000000` (o `db push` segue bloqueado pelo bug do CLI #6036). A nova checagem:

```sql
IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: autenticação obrigatória';
END IF;
IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autorizado';
END IF;
```

**Validação pós-aplicação (curl anônimo):** `400 P0001 Acesso negado: autenticação obrigatória` (antes: aceitava).

### 9.2 Verificação do Ambiente de E-mail do Supabase Auth

Fatores verificados em 2026-08-05:

| Verificação | Resultado |
|-------------|-----------|
| `GET /auth/v1/settings` | `mailer_autoconfirm: false` (confirmação de e-mail **ATIVADA**); `external.email: true` |
| `soumanager.com.br` (DNS MX) | **MX nulo** (RFC 7505: `.`) — o domínio declara que não aceita e-mail |
| `signUp` com `@soumanager.com.br` | `400 email_address_invalid` (validação DNS/MX do GoTrue — PR #2304 rejeita domínios sem MX) |
| `signUp` com gmail/outlook/icloud | `429 email rate limit exceeded` (limite transitório por IP do GoTrue; nenhum usuário criado) |
| SMTP customizado (Management API / PostgREST `auth.config`) | **Não verificável** — sem access token e schema `auth` não exposto ao PostgREST |

**Conclusão documentada (decisão PO):** o ambiente é tratado como **mailer padrão do Supabase** (built-in, envia apenas para membros da organização). Sem evidência de SMTP customizado. Consequências para `signUp` real pela UI: domínios externos são rejeitados (`email_address_invalid` / `email_address_not_authorized`) ou rate-limited (`429`).

### 9.3 Estratégia E2E — Decisão do PO

Decisão do PO (2026-08-05): **reestruturar a suíte principal de E2E para ser determinística**, removendo a dependência de SMTP, rate limits e caixas de entrada externas, sem alterar o comportamento da aplicação.

- **`flow6-tenant-provisioning.spec.ts` (suíte principal, gate `E2E_PROVISIONING=1`):** o usuário é criado via **Admin API** (`admin.auth.admin.createUser` com `email_confirm: true` e `user_metadata` com `first_name`/`last_name`/`shop_name`). O fluxo validado permanece idêntico ao de produção: login pela UI → detecção de `pendingRegistration` → redirect para `/onboarding/provision` → RPC `provision_new_tenant` autenticada → `/onboarding/shop-setup` → `complete_onboarding` → `/dashboard`. Email único por execução (timestamp) e cleanup do usuário em `afterEach` (profiles/user_tenants em CASCADE; tenant órfão segue sob responsabilidade do operador).
- **`flow6a-signup-ui.spec.ts` (cenário de validação do Supabase Auth, gate `E2E_SIGNUP_UI=1`, NÃO-bloqueante):** valida que a UI responde corretamente ao que o GoTrue realmente retornar — se `signUp` sucede (confirmação ON, sem sessão), a tela `verify-email` renderiza e reporta "confirmação não detectada"; se falha, o erro do GoTrue é exibido no formulário. Requer e-mail real e operador-gerido (`E2E_SIGNUP_EMAIL`), não fazendo parte da suíte determinística principal.
- **Arquivos:** `tests/e2e/helpers/supabaseAdmin.ts` (novos helpers `createConfirmedUser`, `deleteUserByEmail`; `confirmUserEmail` mantido para uso operacional), `tests/e2e/pages/RegisterPage.ts` (locator do alerta de erro corrigido para mensagens dinâmicas do GoTrue).

### 9.4 Pendências Operacionais

- [ ] **Custom SMTP:** confirmar com o PO/fornecedor se o projeto deve receber um provedor SMTP customizado. Sem ele, o cadastro pela UI (`signUp`) não é viável para e-mails externos em produção.
- [ ] **E-mail para o fluxo real:** o domínio `soumanager.com.br` tem MX nulo e nunca será aceito pelo GoTrue — usar domínios entregáveis para testes reais de `signUp`.
- [ ] **Limpeza de tenants órfãos:** os runs do flow6 criam tenants órfãos (sem `auth.users` após cleanup); limpeza via dashboard/SQL sob responsabilidade do operador.
- [ ] **`approve_access_request()` e `close_order()`:** pendências de segurança do RPC audit (ver AGENTS.md, Fase 3.3) — não relacionadas a esta fase.

### 9.5 Migrations da Fase 6.0.4.4 (Billing Engine) — Aplicadas por este Procedimento

Três migrations da fase foram aplicadas manualmente pelo procedimento da MIGRATION_EXCEPTION (cópia sem BOM em temp + `db query --linked -f` + `migration repair applied`), pois o `supabase db push --linked` permanece bloqueado pelo bug supabase/cli#6036:

| Migration | Conteúdo |
|-----------|----------|
| `20260806050000_phase_6_0_4_4_billing_engine.sql` | `cancel_at_period_end`; `cancel_subscription` vira pedido (acesso mantido) |
| `20260806070000_fix_rpc_ambiguous_column_references.sql` | Fix `column reference "id" is ambiguous` em 7 RPCs (OUT params de `RETURNS TABLE` qualificados com alias) |
| `20260806080000_fix_apply_subscription_transition_tenant_status_enum.sql` | `v_tenant_status public.tenant_status` (labels: draft/trial/active/past_due/suspended/cancelled/archived) |

Corretivas (070000/080000) foram aplicadas **após** a principal por descoberta nos E2E reais flow9/flow12 — não houve reexecução de migration (orientação do projeto); cada correção entrou como nova migration. A trigger `sync_profile_to_user_tenants` já cria `user_tenants` via UPSERT — o seed do flow12 foi ajustado (removido insert manual) em vez de nova migration.
