# Runbook de Deploy — Fase 6.0.5 (Feature Flags / Plans Catalog)

> **Documento de procedimento — NÃO EXECUTAR NADA SEM APROVAÇÃO EXPLÍCITA DO PO.**
>
> Gerado em 2026-08-07 por decisão do Tech Lead operacional (OpenCode), sob a
> política oficial de versionamento (PO, 2026-08-06): aplicação de migrations
> em banco remoto de produção exige **aprovação explícita do PO**.
>
> **Escopo do documento:** preparar uma **única janela de operação** para as
> 3 migrations pendentes (`06030000`, `06090000`, `07000000`) e o smoke
> pós-deploy. Este documento **não autoriza** execução — é o procedimento
> completo para revisão e aprovação do PO.

---

## 1. Objetivo e Decisão

### 1.1 Contexto (estado verificado em 2026-08-07)

Executado `supabase migration list --linked` (project ref **`ushsnmlbeurfvlkieiln`**,
projeto **sou-manager**). Estado atual:

| Status | Migrations |
|---|---|
| Aplicadas no remoto | Todas até `20260806020000` **e** `06040000`, `06050000`, `06070000`, `06080000` |
| **Pendentes no remoto** | `20260806030000`, `20260806090000`, `20260807000000` |

> **Irregularidade topológica:** `20260806030000` (timestamp anterior) foi
> **pulada** no remoto — as migrations posteriores `06040000/06050000/06070000/
> 06080000` já estão aplicadas. Por isso o procedimento padrão `db push` NÃO é
> aplicável: ele tentaria aplicar a `06030000` por cima de um histórico onde ela
> seria "reordenada", gerando conflito de versão no `schema_migrations`. É exatamente
> o cenário do **`MIGRATION_EXCEPTION`** aprovado no **D-6.0.5.3-3**.

### 1.2 Decisões vigentes (D-6.0.5.3)

- **D-6.0.5.3-1** — Escopo da subfase: somente enforcement de Feature Flags + resolução de planos.
- **D-6.0.5.3-3** — Deploy via `MIGRATION_EXCEPTION`: `supabase db query --linked -f <migration>` + `supabase migration repair --status applied <versão>`, aplicando `06030000`, `06090000` e a 6.0.5.3 na **janela de operação**.
- **D-6.0.5.3-4** — RPCs protegidos = cash_closing, commissions, receivables, expenses (checkout FORA). Guarda aplicada nas 3 RPCs de receivables + `invite_team_member` via `plans.limits`.
- **D-6.0.5.3-6** — Leitura de flags **somente** via RPC `tenant_has_feature`.

### 1.3 Recomendação de janela única (Tech Lead)

Não aplicar as migrations em lotes parciais durante a implementação. Aguardar o
fechamento da **6.0.5.4** (e avaliar **6.0.5.5** caso introduza schema novo) e
executar **uma única janela operacional** com:

1. Todas as migrations pendentes da fase 6.0.5 aplicadas em sequência;
2. Um único conjunto de verificações pós-deploy;
3. Um único smoke E2E;
4. Baseline final `v1.5.0-feature-flags-6.0.5` (após certificação).

Isso reduz: downtime, necessidade de múltiplos rollbacks, sincronizações de
ambiente e janelas de manutenção. **Se a 6.0.5.4/6.0.5.5 adicionarem migrations,
apendá-las à seção correspondente deste runbook (§3.3) ANTES de executar.**

---

## 2. Pré-requisitos (checklist operacional)

- [ ] **Aprovação explícita do PO** para abrir a janela de operação.
- [ ] Branch `feature/phase-6.0.4-billing` atualizada (`git fetch` + `git status` limpo ou consistente).
- [ ] CLI Supabase instalado (`supabase --version`) e projeto vinculado (`supabase/.temp/linked-project.json` existe — confirmado).
- [ ] **Backup confirmado**: `Settings > Database > Backups` com backup automático + PITR ativo. **Abrir aborta se não confirmado.**
- [ ] **Janela de baixo tráfego** (ex.: domingo de madrugada / pós-horário). Notificar equipe comercial — flags podem esconder módulos da UI (D-6.0.5.3-5).
- [ ] **Sem deploys concorrentes** do time durante a janela (sem `db push` manual, sem alterações no SQL Editor por terceiros).
- [ ] Todos os membros da equipe cientes: nenhuma operação de banco além deste runbook.
- [ ] `supabase migration list --linked` mostrando **exatamente** 3 pendentes (06030000, 06090000, 07000000) — **qualquer diferença → abortar e investigar antes**.

### 2.1 Pré-flight de dados (verificar ANTES da primeira migration)

```sql
-- Nenhum tenant com plano fora do catálogo (free/pro/premium) — exigência da FK additiva (06090000)
SELECT t.plan, count(*)
FROM public.tenants t
GROUP BY t.plan
ORDER BY t.plan;
```

```sql
-- O mesmo para subscriptions
SELECT s.plan, count(*)
FROM public.subscriptions s
GROUP BY s.plan
ORDER BY s.plan;
```

> Esperado: apenas `free`, `pro`, `premium` (o CHECK de `20260806020000` já
> impõe esse domínio). **Qualquer outro valor → abortar** (a FK aditiva de
> `06090000` falharia).

```sql
-- Seed pré-existente? (caso alguém tenha criado as tabelas manualmente)
SELECT to_regclass('public.plans') AS plans,
       to_regclass('public.features') AS features,
       to_regclass('public.plan_features') AS plan_features,
       to_regclass('public.feature_flags') AS feature_flags;
```

---

## 3. Ordem Exata de Aplicação

> **Ordem obrigatória** (dependências):
> 1. `06030000` — autorização (sem dependência das demais; base do `current_is_tenant_manager_from_auth_uid`).
> 2. `06090000` — catálogo `plans`/`features`/`plan_features` (a 6.0.5.3 depende das tabelas).
> 3. `07000000` — `feature_flags` + `tenant_has_feature` + guarda nos RPCs.

### 3.1 MIGRATION 1 — `20260806030000_fix_auth_staff_id_to_profiles.sql`

Aplicar o SQL (via Management API, sem tocar no histórico):

```powershell
supabase db query --linked -f supabase/migrations/20260806030000_fix_auth_staff_id_to_profiles.sql
```

Registrar a versão como aplicada (reconcilia o histórico):

```powershell
supabase migration repair --status applied 20260806030000 --linked
```

> **Nota de idempotência:** o arquivo é `DROP IF EXISTS / CREATE OR REPLACE` —
> em caso de erro de rede/parcial, pode ser reaplicado sem duplicar objetos.

### 3.2 MIGRATION 2 — `20260806090000_phase_6_0_5_2_plans_catalog.sql`

```powershell
supabase db query --linked -f supabase/migrations/20260806090000_phase_6_0_5_2_plans_catalog.sql
```

```powershell
supabase migration repair --status applied 20260806090000 --linked
```

> **Dependência crítica:** a `07000000` referencia `public.features(key)` via FK.
> `06090000` **precisa** estar aplicada antes.

### 3.3 MIGRATION 3 — `20260807000000_phase_6_0_5_3_feature_flags.sql`

```powershell
supabase db query --linked -f supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql
```

```powershell
supabase migration repair --status applied 20260807000000 --linked
```

> A migration termina com `NOTIFY pgrst, 'reload schema';` (recarrega o cache de
> schema do PostgREST).

### 3.4 Extensão (SE 6.0.5.4 / 6.0.5.5 adicionarem migrations)

- [ ] Listar os novos arquivos `supabase/migrations/` da fase.
- [ ] Repetir o padrão: `supabase db query --linked -f <arquivo>` → verificação → `supabase migration repair --status applied <versão> --linked`.
- [ ] Atualizar este runbook com a ordem exata antes de executar.

---

## 4. Verificações Pós-Deploy

### 4.1 Histórico de migrations

```powershell
supabase migration list --linked
```

> Esperado: as 3 versões `06030000`, `06090000`, `07000000` com status **aplicadas**
> (coluna Remote preenchida). Sem "Local" pendente remanescente (exceto arquivos
> não-migration como `MANIFEST.md`, que são ignorados).

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version >= '20260806030000'
ORDER BY version;
```

### 4.2 Verificação da MIGRATION 1 (autorização)

```sql
-- Helpers e RPCs do contrato 6.0.4.3
SELECT proname
FROM pg_proc
WHERE proname IN (
  'current_is_tenant_manager_from_auth_uid', 'record_billing_event',
  'start_trial', 'activate_subscription', 'cancel_subscription',
  'upsert_role_permissions', 'reset_role_permissions_to_default',
  'invite_team_member', 'revoke_invite', 'resend_invite', 'list_team_invitations'
)
ORDER BY proname;
```

```sql
-- Policies de tenant manager
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('subscriptions', 'invoices', 'billing_events',
                    'payment_attempts', 'role_permissions', 'team_invitations')
ORDER BY tablename, policyname;
```

> Esperado: 6 policies com `current_is_tenant_manager_from_auth_uid(tenant_id)`.

```sql
-- anon NÃO deve ter EXECUTE em start_trial (hardening)
SELECT g.grantee
FROM information_schema.routine_privileges g
WHERE g.routine_name = 'start_trial' AND g.privilege_type = 'EXECUTE'
ORDER BY g.grantee;
```

> Esperado: `authenticated` (e possivelmente `service_role`). **`anon` presente → falha de hardening → abortar.**

### 4.3 Verificação da MIGRATION 2 (plans catalog)

```sql
SELECT to_regclass('public.plans')    AS plans,
       to_regclass('public.features') AS features,
       to_regclass('public.plan_features') AS plan_features;
```

```sql
-- Seed: 3 planos, 20 features, matriz free=14 / pro=15 / premium=20
SELECT slug, name, (limits ->> 'max_staff') AS max_staff
FROM public.plans
ORDER BY slug;

SELECT count(*) AS total_features FROM public.features;

SELECT plan_slug, count(*) AS qtd_features
FROM public.plan_features
GROUP BY plan_slug
ORDER BY plan_slug;
```

```sql
-- FK aditiva
SELECT conname
FROM pg_constraint
WHERE conname IN ('tenants_plan_fkey', 'subscriptions_plan_fkey');
```

```sql
-- RLS catálogo
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('plans', 'features', 'plan_features');
```

### 4.4 Verificação da MIGRATION 3 (feature flags)

```sql
SELECT to_regclass('public.feature_flags') AS feature_flags;
SELECT proname
FROM pg_proc
WHERE proname IN ('tenant_has_feature',
                  'generate_club_receivables',
                  'refresh_club_receivable_statuses',
                  'pay_club_receivable')
ORDER BY proname;
```

```sql
-- RLS + policies da tabela runtime
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'feature_flags';

SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'feature_flags';
```

> Esperado: RLS habilitado; **exatamente 1 policy** (`feature_flags_superadmin_all`,
> escrita superadmin). **Sem policy de SELECT para authenticated** (D-6.0.5.3-6).

### 4.5 Validação de RLS (funcional)

Executar via SQL Editor com **um usuário authenticated de um tenant free** (não
superadmin), com `select current_user;` retornando `authenticated`:

```sql
-- 1) Leitura direta de feature_flags DEVE falhar (sem policy SELECT p/ autenticado)
SELECT * FROM public.feature_flags LIMIT 1;
-- Esperado: 0 rows (RLS bloqueia) — NUNCA erro de permissão de GRANT
```

```sql
-- 2) Leitura direta do catálogo é permitida (catalog SELECT global)
SELECT slug FROM public.plans ORDER BY slug;
-- Esperado: free, pro, premium
```

```sql
-- 3) Escrita em feature_flags como tenant DEVE falhar (só superadmin)
INSERT INTO public.feature_flags (tenant_id, feature_key, override)
VALUES ('00000000-0000-0000-0000-000000000000', 'chef_club', true);
-- Esperado: "new row violates row-level security policy" (erro controlado)
```

### 4.6 Validação das RPCs (funcional)

Com um tenant de teste **free** e **premium** (ou via `tenant_has_feature` em
um tenant real de cada plano), executar como authenticated:

```sql
SELECT public.tenant_has_feature('<tenant_id>', 'receivables');  -- free: true
SELECT public.tenant_has_feature('<tenant_id>', 'cash_closing'); -- free: true
SELECT public.tenant_has_feature('<tenant_id>', 'chef_club');    -- free: false / premium: true
SELECT public.tenant_has_feature('<tenant_id>', 'bi');           -- free: false / premium: true
```

> Esperado — matriz (espelho de `plan_features`):
> | Feature | free | pro | premium |
> |---|---|---|---|
> | `receivables` | ✅ | ✅ | ✅ |
> | `chef_club` | ❌ | ✅ | ✅ |
> | `bi` | ❌ | ❌ | ✅ |

**Override (superadmin, janela de suporte):**

```sql
-- Concede chef_club a um tenant free (exceção comercial)
INSERT INTO public.feature_flags (tenant_id, feature_key, override, reason, created_by)
VALUES ('<tenant_id>', 'chef_club', true, 'degustacao', auth.uid())
ON CONFLICT (tenant_id, feature_key) DO UPDATE SET override = true, updated_at = now();
```

```sql
-- Resolução deve retornar true agora
SELECT public.tenant_has_feature('<tenant_id>', 'chef_club');
```

**Suspensão (derivada, sem rows):**

```sql
-- Com tenant de teste em status 'suspended':
SELECT public.tenant_has_feature('<tenant_suspended_id>', 'receivables');
-- Esperado: false (D-6.0.5.3 — suspensão derruba tudo, T4)
```

**Limite de equipe via `plans.limits` (T8):**

```sql
-- tenant free com 1 staff ativo + 0 invites pendentes → próximo invite deve falhar
SELECT public.invite_team_member('<tenant_free_id>', 'novo@exemplo.com', 'barber');
-- Esperado: "Team limit reached: the current plan allows 1 professionals..."
```

### 4.7 Guarda nos RPCs protegidos (T10)

> Guarda aditiva: rejeita **somente** quando a flag está ausente. Regra de
> negócio preservada. Validar em tenant sem a flag `receivables` (free NÃO tem
> a flag desabilitada — `receivables` é free=true; usar uma feature ausente ou
> um tenant sem o módulo). Cenário de rejeição realista: tenant **sem** a flag
> executar `generate_club_receivables`.

```sql
-- Exemplo (com tenant de teste cujo plano NÃO habilita a feature usada na guarda):
SELECT public.generate_club_receivables('<tenant_id>');
-- Se a flag estiver desabilitada: erro "Modulo Contas a Receber nao disponivel no plano atual..."
-- Se habilitada: executa a lógica normal (sem erro de guarda)
```

---

## 5. Smoke Pós-Deploy

Rodar o smoke E2E completo contra o ambiente real (requer `.env.local` com
Supabase configurado — já existe):

```powershell
npm run test:e2e:smoke
```

**Critério de aceite:** **10/10 PASS** (login, schedule, clients, cash closing,
commissions, chef club, dashboard + ausência de erros de console). Referência:
46.7s na rodada de 2026-08-07 (pré-deploy).

Verificações manuais complementares (UI real pós-deploy):

- [ ] Login como tenant **free**: menu **não** exibe Chef Club; rota direta `/#/chef-club-plans` → `FeatureUnavailablePage` (não 403 genérico).
- [ ] Login como tenant **premium**: Chef Club e BI visíveis.
- [ ] `/bi` de um tenant sem a flag → `FeatureUnavailablePage`.
- [ ] Não há erros de console relacionados a `tenant_has_feature` (RPC resolvida; o hook é fail-open, mas pós-deploy deve resolver autoritativamente).

---

## 6. Plano de Rollback

> **Princípio:** migrations aditivas/idempotentes. Rollback **sempre em conjunto
> DB + frontend** (Vercel) — nunca apenas um dos lados. O frontend pós-6.0.5.3
> chama `tenant_has_feature`; reverter o banco sem reverter o frontend quebra a
> resolução de flags.

### 6.1 Rollback da 07000000 (feature flags)

```sql
-- Reverter RPCs para as versões pré-6.0.5.3 (fonte: arquivos de origem):
--   generate_club_receivables / refresh_club_receivable_statuses / pay_club_receivable
--     → versões originais (migrations 20260510160817 / 20260510160818 / etc.)
--   invite_team_member → versão com literais (20260806030000 §5.1)

DROP TABLE IF EXISTS public.feature_flags;
-- (CASCADE é desnecessário: feature_flags não é referenciado por outras tabelas)
```

```powershell
supabase migration repair --status reverted 20260807000000 --linked
```

### 6.2 Rollback da 06090000 (plans catalog)

```sql
-- Remover FKs aditivas e recriar CHECKs
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_fkey;
ALTER TABLE public.tenants       DROP CONSTRAINT IF EXISTS tenants_plan_fkey;

ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free', 'pro', 'premium'));
ALTER TABLE public.tenants ADD CONSTRAINT tenants_plan_check
  CHECK (plan IN ('free', 'pro', 'premium'));

-- Remover catálogo (após FKs)
DROP TABLE IF EXISTS public.plan_features;
DROP TABLE IF EXISTS public.features;
DROP TABLE IF EXISTS public.plans;
```

```powershell
supabase migration repair --status reverted 20260806090000 --linked
```

> **Atenção:** reverter a 06090000 inviabiliza a 07000000 (`feature_flags`
> referencia `features`). Reverter sempre em ordem reversa (07000000 → 06090000).
> **Se a 06030000 precisar de rollback**, as RPCs de billing/invite retornam às
> versões da `20260806020000`/`20260806000000` (não há tabelas para dropar —
> é só recriar funções/policies das versões anteriores).

### 6.3 Rollback do frontend (Vercel)

```powershell
# Dashboard: Deployments → último deployment estável → "Promote to Production"
vercel rollback
```

### 6.4 Checklist de rollback rápido

- [ ] 1. Identificar a migration que causou o problema (logs de erro + verificação).
- [ ] 2. Reverter DB em ordem reversa (07000000 → 06090000 → 06030000) com `migration repair --status reverted`.
- [ ] 3. Reverter frontend via `vercel rollback` (para o deployment pré-6.0.5.3).
- [ ] 4. Validar login → schedule → dashboard → checkout (fluxo P0).
- [ ] 5. Confirmar `supabase migration list --linked` coerente com o estado revertido.
- [ ] 6. Investigar root cause antes de relançar.

---

## 7. Tempo Estimado

| Etapa | Tempo |
|---|---|
| Pré-flight + backup + coordenação | 10 min |
| MIGRATION 1 (06030000) | ~1–2 min (apply + repair) |
| MIGRATION 2 (06090000) | ~1–2 min (apply + repair) |
| MIGRATION 3 (07000000) | ~1–2 min (apply + repair) |
| Verificações pós-deploy (§4) | ~10 min |
| Smoke E2E (§5) | ~2–3 min |
| Buffer / rollback improviso | ~15 min |
| **Total da janela** | **~40–45 min** (sem imprevistos) |

---

## 8. Riscos Conhecidos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| `06090000` falhar na FK aditiva se houver tenant `elite` | Baixa | Alta | Pré-flight §2.1 (CHECK de 06020000 já impede `elite`) |
| `db query --linked` aplicar arquivo parcialmente (falha de rede) | Baixa | Média | Arquivos idempotentes — reaplicar; verificar antes do `repair` |
| Guarda de RPC quebrar fluxo real (ex.: receivables) | Média | Média | Guarda aditiva (rejeita só sem flag); `receivables` é true nos 3 planos; smoke + T10 |
| Override desabilitar flag essencial e travar tenant | Baixa | Alta | Escrita só superadmin; `tenant_has_feature` fail-closed `false`; auditoria via `feature_flags.reason` |
| Regressão de `invite_team_member` (literal → `plans.limits`) | Baixa | Média | Mesmos valores free=1/pro=5/∞; T8; smoke |
| Mudança visual de UI (módulos escondidos) surpreender usuários | Média | Baixa | Híbrido D-6.0.5.3-5 + `FeatureUnavailablePage` com convite de upgrade; comunicar equipe |
| `feature_flags` sem dados (override vazio) → resolução via matriz | — | — | Comportamento esperado (D-6.0.5.3-6); sem rows = plano decide |
| Cache de resolução `useFeatureFlags` (uma chamada por sessão) não refletir override novo | Baixa | Baixa | Cache por sessão/plano/status; refresh de sessão recarrega |

---

## 9. Critérios para Abortar a Janela

Abortar **imediatamente** (pausar operações de banco e acionar rollback se já
iniciado) quando ocorrer **qualquer um**:

1. Backup/PITR não confirmado antes de iniciar.
2. Pré-flight §2.1 aponta plano fora do catálogo (`free/pro/premium`).
3. `supabase migration list --linked` mostrar pendências diferentes das 3 esperadas.
4. Qualquer `supabase db query --linked` retornar erro **não** coberto por idempotência (sem reaplicar às cegas).
5. `supabase migration repair` falhar (histórico inconsistente) — **não** forçar.
6. Verificação §4.2: `anon` com EXECUTE em RPCs de billing (falha de hardening).
7. Verificação §4.4/§4.5: RLS de `feature_flags` com policy de SELECT para authenticated, ou leitura direta retornando rows.
8. Verificação §4.6: matriz `tenant_has_feature` divergente da esperada (free/premium).
9. Smoke E2E < 10/10, ou erro de console crítico em login/dashboard/checkout.
10. Qualquer operação concorrente detectada no banco durante a janela (parar e re-agendar).

---

## 10. Checklist Final de Encerramento

Após o smoke verde e aprovação do PO:

- [ ] `supabase migration list --linked` 100% coerente (3 versões aplicadas; nada pendente).
- [ ] Entry Audit 6.0.5.3 — critério de saída "Deploy ao remoto" **marcado**.
- [ ] ROADMAP / PROJECT_STATUS / changelog atualizados com a janela concluída.
- [ ] Baseline `v1.5.0-feature-flags-6.0.5` criada (commit semântico + tag anotada + push) — após certificação do PO.
- [ ] Comunicação de encerramento à equipe.

---

## 11. Comandos Resumo (copiar/colar na janela)

```powershell
# 1) Autorização (6.0.4.3)
supabase db query --linked -f supabase/migrations/20260806030000_fix_auth_staff_id_to_profiles.sql
supabase migration repair --status applied 20260806030000 --linked

# 2) Plans Catalog (6.0.5.2)
supabase db query --linked -f supabase/migrations/20260806090000_phase_6_0_5_2_plans_catalog.sql
supabase migration repair --status applied 20260806090000 --linked

# 3) Feature Flags (6.0.5.3)
supabase db query --linked -f supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql
supabase migration repair --status applied 20260807000000 --linked

# 4) Verificação do histórico
supabase migration list --linked

# 5) Smoke
npm run test:e2e:smoke
```
