# H-7.1 — Trilha A: Reprodução do Incidente Original — Causa Raiz Confirmada

> **Status:** ✅ **CAUSA RAIZ CONFIRMADA** — frontend de produção defasado em relação ao schema vigente do banco.
> **Referência:** `docs/audit/H7_1_AUDITORIA_TECNICA.md` (auditoria formal, 2026-08-16) · `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` (D-HOM-27) · `docs/audit/H7_BASELINE_READONLY.md` (2026-08-16) · `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`
> **Data:** 2026-08-16 · **Responsável:** OpenCode · **PO:** Augusto
> **Método:** consultas **read-only** (`supabase db query --linked -o json`) + API REST Vercel (read-only) + `git show`/`git diff` (read-only). **Nenhuma escrita, DDL, DML, deploy ou mutação remota.**

---

## 1. Objetivo da Trilha A

Reproduzir a condição que causou o incidente original do ciclo H7-1:

> `[TenantContext] Failed to resolve tenant context`

seguido de falha na tela de Comissões ("Não foi possível carregar as comissões. Nenhum dado financeiro foi alterado." / "Falha ao carregar comissões").

A Trilha A foi definida no relatório `H7_1_AUDITORIA_TECNICA.md` (§15) como a investigação dedicada a descobrir por que, **no contexto original**, esse erro ocorreu — usando o mesmo usuário, deployment, configuração e fluxo operacional do incidente, na medida do possível.

**Resultado:** a causa raiz foi **confirmada** e é de natureza **deployment/schema**, não de dados, banco ou lógica financeira.

---

## 2. Cadeia causal confirmada

```
produção 718f6f9 (deploy Vercel smg-barber, 2026-07-17)
→ frontend consulta tenants.active
→ migration 20260728000000_sprint1_tenant_lifecycle REMOVEU active e introduziu status
→ PostgreSQL retorna 42703: column "active" does not exist
→ fetchTenantsByIds falha
→ resolveTenantForUser não resolve o tenant
→ TenantContext faz catch → console.warn('[TenantContext] Failed to resolve tenant context')
→ tenant fica null
→ Comissões falham ao carregar (tenentId null → tela vazia/erro)
```

A cadeia é **linear e reproduzível por inspeção de código + evidência de schema**.

---

## 3. Evidência 1 — Produção `718f6f9` consulta `tenants.active`

### Deploy de produção

API REST Vercel (`https://api.vercel.com/v6/deployments?projectId=prj_M3cJ2cZosLONAt9IzumF2LwJZTSj&target=production`):

| Campo | Valor |
|-------|-------|
| `readyState` | `READY` |
| `created` | `1784339030432` (2026-07-17 22:43 BRT) |
| `meta.githubCommitSha` | `718f6f971e61e7bf1d9a83ac5c15344855a8d5be` |

**A produção `smg-barber` / `barber.soumanager.com` nunca foi redeployada desde 17/07/2026.** É o deploy production mais recente do projeto.

### Código em `718f6f9`

`src/lib/supabase/tenant.ts`:

```typescript
active: boolean | null;

const fetchTenantsByIds = async (tenantIds: string[]): Promise<Record<string, TenantRecord>> => {
    ...
    .from('tenants')
    .select('id, name, slug, app_slug, active, created_at')   // ← seleciona active
    .in('id', tenantIds);
    ...
    active: tenant.active ?? null,
```

- `resolveTenantForUser` (mesmo arquivo) chama `fetchTenantsByIds([tenantId])` → herda o select com `active`.

`src/context/TenantContext.tsx` (mesmo commit):

```typescript
try {
    const resolved = await resolveTenantForUser(authSession.user, appSlug);
    setTenant(resolved.tenant);
    setRole(resolved.role);
} catch (err) {
    console.warn('[TenantContext] Failed to resolve tenant context', { error: err });
    setTenant(null);
    setRole('unknown');
    setMemberships([]);
    setError(getTenantErrorMessage(err, appSlug));
} finally { ... }
```

`pages/Commissions.tsx` (mesmo commit):

```typescript
const { tenantId } = useAuth();          // tenant vira null quando TenantContext falha
...
setLoadError('Não foi possível carregar as comissões. Nenhum dado financeiro foi alterado.');
setToast({ message: 'Erro ao carregar dados de comissões.', type: 'error' });
```

> A mensagem de erro e o `console.warn` do incidente original existem **literalmente** em `718f6f9` — o código de produção reproduz o sintoma observado assim que o schema deixa de expor `active`.

---

## 4. Evidência 2 — Migration `20260728000000_sprint1_tenant_lifecycle` aplicada no remoto

`supabase_migrations.schema_migrations` (banco `ushsnmlbeurfvlkieiln`, query read-only):

```
{
  "name": "sprint1_tenant_lifecycle",
  "version": "20260728000000"
}
```

- A migration está **aplicada** no banco de produção.
- Origem: commit `4c92c91` — `chore(release): certify platform baseline v1.0.0` (2026-07-28).
- A migration **não existe** no commit `718f6f9` (deploy de produção de 17/07): `git show 718f6f9:supabase/migrations/20260728000000_sprint1_tenant_lifecycle.sql` → arquivo ausente.

**Intervalo de exposição:** entre a aplicação da migration (janela única de deploy ~2026-08-08) e o deploy de produção da release v1.5 (ainda não realizado — gate H-8 🔴), **toda sessão no frontend de produção `718f6f9` é afetada**.

---

## 5. Evidência 3 — `tenants` não possui mais a coluna `active`

`information_schema.columns` para `public.tenants` (query read-only):

| column_name | data_type | udt_name |
|-------------|-----------|----------|
| id | uuid | uuid |
| name | text | text |
| slug | text | text |
| created_at | timestamp with time zone | timestamptz |
| updated_at | timestamp with time zone | timestamptz |
| app_slug | text | text |
| plan | text | text |
| **status** | **USER-DEFINED** | **tenant_status** |
| first_appointment_at | timestamp with time zone | timestamptz |

**`active` NÃO existe.** O novo campo é `status` (enum `tenant_status`).

### Reprodução direta do erro (read-only)

```sql
SELECT id, name, slug, app_slug, active, created_at FROM tenants LIMIT 1;
```

Resultado:

```
ERROR: 42703: column "active" does not exist
```

Esse é exatamente o SQL emitido pelo `fetchTenantsByIds` de `718f6f9`. O `42703` é o erro que, propagado por `resolveTenantForUser` → `TenantContext`, produz o sintoma do incidente.

---

## 6. Diferenças de código entre produção e branch (contexto)

`git diff 718f6f9..4c92c91 -- src/lib/supabase/tenant.ts`:

```diff
-  active: boolean | null;
+  status: TenantStatus;
...
-    .select('id, name, slug, app_slug, active, created_at')
+    .select('id, name, slug, app_slug, plan, status, created_at')
...
-      active: tenant.active ?? null,
+      status: (tenant.status as TenantStatus) ?? 'draft',
```

- O commit `4c92c91` (baseline v1.0.0, 28/07) já usa `status`.
- O preview `ec4cf6c` (14/08) e o HEAD atual (`0a2cc75`, 16/08) também usam `status`.
- Ou seja: **o código novo é compatível com o schema vigente**; apenas a produção `718f6f9` ficou para trás.

---

## 7. Reconciliação com o H7-1 — por que o ciclo deu certo

O aparente paradoxo "o erro reportado é `[TenantContext]`, mas o ciclo H7-1 produziu dados íntegros" é resolvido:

| Item | Ambiente | Código | Resultado |
|------|----------|--------|-----------|
| **Incidente original** (erro `[TenantContext]` + Comissões) | Produção `barber.soumanager.com` (`718f6f9`) | Antigo (`active`) | ❌ falha esperada |
| **Operação do ciclo H7-1** (comanda → transaction) | **Preview da branch** — `78604c6` (`smg-barber-7546bqlm3-….vercel.app`), deploy 16/08 17:29 BRT | Novo (`status`) | ✅ funciona |

Timeline confirmada (API REST Vercel):

| Commit | Preview / produção | Criado (BRT) |
|--------|--------------------|--------------|
| `718f6f9` | **produção** (quebrada) | 2026-07-17 22:43 |
| `78604c6` | preview `smg-barber-7546bqlm3-…` | 2026-08-16 17:29 |
| `0a2cc75` | preview `smg-barber-rngcm95ut-…` | 2026-08-16 18:24 |

O ciclo H7-1 foi operado às **17:32 BRT** — **3 minutos após** o deploy do preview `78604c6` (código novo). O owner (`828175b0`) operou sobre o preview saudável, por isso:

- comanda `18ccc171` criada e `paid`;
- transaction `9a55f575` (R$ 35,00) íntegra;
- comissão legitimamente inexistente (manager, `commission_rate = 0`);
- **nenhuma duplicidade, perda ou corrupção financeira**.

> A descoberta reforça o diagnóstico da auditoria formal: **o financeiro do H7-1 sempre esteve íntegro**. O problema original era de *frontend/ambiente*, não de dados.

---

## 8. Impacto no estado dos gates

- **Causa raiz do incidente original:** ✅ **CONFIRMADA** (frontend de produção defasado × schema vigente).
- **H-8 (Infraestrutura Vercel / Deployment Topology):** 🔴 **BLOQUEADOR confirmado com causa concreta** — a produção `718f6f9` não é apenas "defasada"; ela é **incompatível** com o schema vigente e falha na resolução de tenant para qualquer sessão.
- **Trilha B (integridade de eventos/idempotência):** 🔎 **PENDENTE** — não é encerrada por este relatório (ver §10).

---

## 9. Nenhuma correção nesta etapa

> **Nenhuma correção deve ser aplicada nesta etapa.**

Explicitamente **NÃO** executar agora:

- ❌ redeploy/manual de produção;
- ❌ alteração de código frontend;
- ❌ alteração de banco/RLS/RPC;
- ❌ criação de migration ou workaround de schema;
- ❌ recálculo financeiro;
- ❌ modificação de dados históricos;
- ❌ merge para `main`, tag ou deploy de produção.

A decisão de corrigir a produção (deploy da release v1.5) é **exclusivamente do PO**, e o gate **H-8** já define esse deploy como etapa explícita após decisão formal. A operação permanece **PARADA**.

---

## 10. Status da Trilha B (não encerrada)

Os achados da Trilha B são **independentes** e permanecem abertos para auditoria própria:

| Achado | Status | Natureza |
|--------|--------|----------|
| `event_store` do tenant vazio (0 eventos; `CheckoutCompleted` não persistido) | 🔎 pendente | Gap de infraestrutura/event-driven |
| `idempotency_key` com UUID divergente (`finance-settle-18ccc171-…-comanda-3e749943-…`) | 🔎 pendente | Anomalia de rastreabilidade |

Nenhum dos dois impacta o veredito financeiro do H7-1; ambos merecem investigação dedicada (Trilha B), sem misturar com este relatório.

---

## 11. Veredito final da Trilha A

| Item | Veredito |
|------|----------|
| Causa raiz do incidente original (`[TenantContext]` + Comissões) | ✅ **CONFIRMADA** — frontend de produção `718f6f9` consulta `tenants.active`, coluna removida pela migration `20260728000000` aplicada no remoto → `42703` → `fetchTenantsByIds`/`resolveTenantForUser` falham → `TenantContext` com tenant `null` |
| Reconstituição do incidente | ✅ reproduzida por inspeção + `42703` direto no banco |
| Ciclo H7-1 (dados reais) | ✅ íntegro — operado no preview `78604c6` (código novo) |
| Integridade financeira H7-1 | ✅ confirmada (comanda R$ 35,00 → transaction R$ 35,00, sem duplicidade) |
| Comissão ausente | ✅ comportamento esperado (staff manager, `commission_rate = 0`) |
| Correção em produção | ⛔ **AINDA NÃO EXECUTAR** — decisão do PO |
| Merge/deploy/tag | ⛔ **AGUARDAR aprovação do PO** |

**Conclusão executiva:** o incidente original foi um problema de **desalinhamento entre o frontend de produção e o schema vigente do banco**, não um defeito de dados, de lógica financeira ou do ciclo H7-1. A evidência está documentada; a correção (deploy da release v1.5) fica condicionada à decisão do PO e ao gate H-8.

---

## 12. Anexo — comandos/consultas de evidência

| Evidência | Comando |
|-----------|---------|
| Deploy production `718f6f9` | `GET api.vercel.com/v6/deployments?projectId=prj_M3cJ2cZosLONAt9IzumF2LwJZTSj&limit=5&target=production` → `meta.githubCommitSha=718f6f9…`, `READY`, created `1784339030432` |
| Previews `78604c6` / `0a2cc75` | `GET api.vercel.com/v6/deployments?projectId=prj_M3cJ2cZosLONAt9IzumF2LwJZTSj&limit=3&target=preview` |
| Migration aplicada | `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version LIKE '2026072%' OR version LIKE '202608%' ORDER BY version;` |
| Colunas `tenants` | `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tenants' ORDER BY ordinal_position;` |
| Reprodução do `42703` | `SELECT id, name, slug, app_slug, active, created_at FROM tenants LIMIT 1;` → `ERROR: 42703: column "active" does not exist` |
| Código produção | `git show 718f6f9:src/lib/supabase/tenant.ts`, `git show 718f6f9:src/context/TenantContext.tsx`, `git show 718f6f9:pages/Commissions.tsx` |
| Diff produção→baseline | `git diff 718f6f9..4c92c91 -- src/lib/supabase/tenant.ts` |
