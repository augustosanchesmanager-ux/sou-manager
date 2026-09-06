# P1.3 — Production Gate: Canonical KPIs via RPC `get_dashboard_kpis`

> **Data:** 2026-09-06
> **Branch:** `feature/p1-3-canonical-kpis` (`f7fde2d` → correção aplicada)
> **Ambientes auditados:** staging `tjcvuhynckocmvtqykxp` (read+write), produção `ushsnmlbeurfvlkieiln` (somente leitura)
> **Veredito:** **REVALIDATED — Opção A executada exclusivamente em staging. Aguarda decisão do PO sobre produção.**

---

## 1. Critérios do Gate (Pedido do PO)

| # | Critério | Status |
|---|----------|--------|
| 1 | Migration P1.3 pronta para produção | ✅ **SIM** (K9 corrigido: `sep.staff_id`, REVOKE anon/sr) |
| 2 | Evidências de staging | ✅ Revalidadas — schema alinhado, RPC funcional, E2E estrito PASS |
| 3 | Segurança / RLS / SECURITY DEFINER / grants | ✅ OK — REVOKE anon/service_role aplicado |
| 4 | Equivalência dos KPIs | ✅ 27/27 testes (13 equivalência + 14 segurança), |Δ| ≤ 0.01 |
| 5 | Impacto e rollback | ✅ Impacto zero-dados, rollback `DROP FUNCTION` imediato |
| 6 | Somente migration ou integração adicional | ✅ Migration corrigida; integração frontend já existe (P1.1) |
| 7 | Autorização explícita do PO | ⏳ **NÃO DADA** — produção permanece STOP |

---

## 2. Evidências de Produção (read-only, Management API)

| Check | Resultado |
|-------|-----------|
| Migration `20260905000000` em `schema_migrations` | ❌ Ausente (mais recente 20260903) |
| `to_regprocedure('public.get_dashboard_kpis(text,uuid)')` | `null` — função não existe |
| Helpers `current_tenant_id_from_auth_uid` / `current_is_super_admin_from_auth_uid` | ✅ Presentes (SECURITY DEFINER) |
| 10/10 tabelas dependentes | ✅ Presentes |
| RLS habilitada (8/8 tabelas financeiras/operacionais) | ✅ `relrowsecurity=true` |
| Colunas da migration vs schema real | ❌ **1 divergência bloqueante** |

## 3. 🚨 ACHADO BLOQUEANTE — Schema Drift `service_execution_participants`

| Ambiente | Coluna profissional | Coluna `payout_amount_calculated` | Índice |
|----------|---------------------|-----------------------------------|--------|
| **Produção** (`ushsn...`) | `staff_id` | ✅ presente | `idx_service_execution_participants_staff` |
| **Staging** (`tjcv...`) | `professional_id` | ❌ ausente | `idx_service_execution_participants_professional` |
| **Repo** (migration `20260418100000`) | `professional_id` | ❌ ausente | `idx_service_execution_participants_professional` |

### Impacto

A migration P1.3 usa `sep.professional_id` em **duas posições** do K9 (Performance por profissional):

```sql
JOIN public.staff s ON s.id = sep.professional_id
...
AND (p_staff_id IS NULL OR sep.professional_id = p_staff_id)
```

Em produção essa coluna **não existe** → `ERROR: column sep.professional_id does not exist` a **cada execução do K9** → o RPC falha → o frontend P1.1 degrada silenciosamente (banner "KPIs indisponíveis") e **os cards canônicos nunca renderizam em produção**, mesmo com a migration aplicada.

### Corroboração (3 fontes independentes)

1. `information_schema.columns` em produção vs staging (Management API, 2026-09-06).
2. **D8 RPC surface** (`20260827120000_d8_worker_rpc_surface.sql:183`): *"service_execution_participants (P1-P5) — only REAL columns. No professional_id column; staff_id is the source (matches handler)."* — escrito contra o schema real de produção, PRODUCTION CERTIFIED.
3. **Financial Core canônico** (`supabase/functions/_shared/financial-core/index.ts`): lê/escreve DEFENSIVAMENTE `p.staff_id || p.professional_id` e `staff_id, professional_id` — reconhece a divergência entre ambientes.

### Causa raiz

Nenhuma migration no repo (`supabase/migrations/`) renomeia/add `staff_id` ou `payout_amount_calculated` em `service_execution_participants`. A produção foi alterada **fora do fluxo de migrations** (suposição: hotfix direto no dashboard/CLI em algum momento). Consequência: o repositório e o staging **não refletem o schema real de produção** — a migration P1.3 foi escrita e testada contra o schema errado.

---

## 4. Segurança / RLS / SECURITY DEFINER / Grants

### Pontos fortes (verificados)

- **GATE 1:** `auth.uid() IS NULL` → RAISE (obrigatório). `anon`/`service_role` têm `auth.uid() = NULL` → a função **rejeita** chamadas sem sessão real, mesmo com EXECUTE concedido.
- **GATE 2:** tenant derivado via `current_tenant_id_from_auth_uid()` (SECURITY DEFINER) — **nunca aceito do frontend**. Helper confirmado presente em produção.
- **GATE 3:** papel restrito (owner/admin/manager/gerente + membership `user_tenants` + superadmin bypass).
- **GATE 4:** `p_staff_id` validado contra o tenant.
- **GATE 5:** período validado; janela `America/Sao_Paulo` fixa.
- `SET search_path = public` (padrão Supabase para SECURITY DEFINER).
- Nenhum `CREATE` em `public` para `anon`/`authenticated` em staging (`has_schema_privilege=false`) — sem risco de hijack via search_path (PG 17).
- RLS ativa em 8/8 tabelas acessadas.

### Achado de grants (não bloqueante, mas corrigir junto)

| Role | Staging `get_dashboard_kpis` | Produção `get_auth_access_context` (benchmark) |
|------|------------------------------|------------------------------------------------|
| `authenticated` | X (esperado) | X |
| `anon` | **X (inesperado)** | ausente |
| `service_role` | **X (inesperado)** | X |

**Causa:** `REVOKE ALL ... FROM PUBLIC` não remove grants **explícitos por role** que o Supabase concede por default no momento do `CREATE FUNCTION` (default privileges). Padrão do repo (`get_auth_access_context`) não tem `anon`.

**Segurança efetiva:** o GATE 1 torna o EXECUTE de `anon`/`service_role` inócuo (`auth.uid()=NULL` → RAISE). **Não é vulnerabilidade**, é higiene de grants + exposição no schema OpenAPI do PostgREST (RPC aparece para `anon`, retorna erro ao chamar).

**Correção recomendada:** adicionar à migration (ou à correção do K9):
```sql
REVOKE EXECUTE ON FUNCTION public.get_dashboard_kpis(TEXT, UUID) FROM anon, service_role;
```

---

## 5. Evidências de Staging — PRÉ correção (referência histórica)

| Check | Resultado |
|-------|-----------|
| Migration `20260905000000` registrada em `schema_migrations` | ✅ |
| RPC existe + GATE 1 presente no `prosrc` | ✅ |
| `authenticated` EXECUTE | ✅ |
| Testes unitários (estado fundido `cea99c9`) | ✅ 27/27 (13 equivalência + 14 segurança) |
| E2E estrito contra staging (card "Faturamento" via RPC real) | ✅ PASS |
| Homologação P1.1 (PR #26, merge `cea99c9`) | ✅ CLOSED |

**Limitação (então vigente):** staging tinha schema **divergente** de produção em `service_execution_participants` — homologação provou o K9 contra `professional_id`, produção usa `staff_id`.

---

## 5.1 Evidências de Staging — PÓS correção (Opção A, 2026-09-06)

| Check | Resultado |
|-------|-----------|
| Migration P1.3 corrigida (`sep.staff_id` nas 2 posições do K9 + `REVOKE ... FROM anon, service_role`) aplicada em staging | ✅ HTTP 201, re-aplicável (`CREATE OR REPLACE`) |
| Alignment migration `20260906000000` (`ADD COLUMN staff_id` + backfill guardado + índice) aplicada em staging | ✅ HTTP 201 |
| `service_execution_participants` pós-alinhamento | ✅ 11 colunas (originais + `staff_id`), índice `idx_service_execution_participants_staff` presente, 0 linhas (backfill trivially consistente) |
| ACL da função em staging | ✅ `anon` EXECUTE = **false**, `service_role` EXECUTE = **false**, `authenticated` EXECUTE = **true** |
| `prosrc` da função em staging | ✅ contém `sep.staff_id` (pos. 10450); **zero** referências a `sep.professional_id` |
| Alias de saída `professional_id` (contrato `kpiTypes.ts`) | ✅ preservado — sem mudança de contrato RPC |
| Testes unitários no código corrigido | ✅ **27/27 PASS** (13 equivalência + 14 segurança, 376ms) |
| E2E estrito contra staging (card "Faturamento" via RPC real, banner degradação ausente) | ✅ **PASS** (8.6s) |
| Produção | 🚫 **INTOCADA** — nenhuma alteração aplicada (`ushsn...`) |

**Nota sobre o drift:** o alinhamento em staging espelha produção (`staff_id` como fonte). O migration `20260418100000` (repo) continua histórico-imutável com `professional_id`; a alignment migration registra o drift para ambientes futuros. Em produção a migration P1.3 corrigida é **no-op-compatível** (`CREATE OR REPLACE` + coluna `staff_id` já existente).

---

## 6. Equivalência dos KPIs

- ✅ **13/13 equivalência** (K1–K6 vs old selector, |Δ| ≤ 0.01) + **14/14 segurança** re-executados no estado fundido (`cea99c9`) — 2026-09-06.
- ✅ **Re-executados no código corrigido** (K9 `sep.staff_id`) — **27/27 PASS** (376ms), certificado de equivalência mantido após a correção.
- Diferenças intencionais documentadas (D-EST-01 reversões, D-RET-01 retenção `completed`, crescimento fração vs %).
- **Risco residual:** nenhum — a troca `professional_id` → `staff_id` é a **mesma FK** `public.staff(id)`, semântica idêntica, e o certificado foi re-executado.

---

## 7. Impacto e Rollback

| Item | Avaliação |
|------|-----------|
| Impacto DDL | Apenas `CREATE OR REPLACE FUNCTION` + grants + comment — **nenhuma tabela/coluna/dado alterado** |
| Impacto runtime (com K9 corrigido) | Leitura agnóstica por tenancy; sem locks longos (agregações sobre índices existentes) |
| Rollback | `DROP FUNCTION public.get_dashboard_kpis(TEXT, UUID);` — instantâneo, sem perda de dados, sem dependentes (frontend degrada graciosamente) |
| Idempotência | `CREATE OR REPLACE` — re-aplicável |

---

## 8. Necessário: Somente Migration ou Integração Adicional?

1. **Migration** — sim, necessária (o RPC é o coração dos KPIs canônicos).
2. **Integração frontend** — **já entregue via P1.1** (PR #26 merge `cea99c9`): `Reports.tsx` consome `getDashboardKpis` com degradação graciosa; nenhuma integração adicional é necessária para os cards renderizarem **uma vez que a migration esteja correta**.
3. **Correção da migration** — **obrigatória antes de produção**: alinhar `professional_id` → `staff_id` no K9 e adicionar `REVOKE ... FROM anon, service_role`.

---

## 9. Correção Executada (Opção A — autorizada pelo PO, 2026-09-06)

**Opção A — corregir a migration P1.3 + alinhar staging:**
1. ✅ Substituído `sep.professional_id` por `sep.staff_id` nas 2 posições do K9 (mesma FK, semântica idêntica).
2. ✅ Adicionado `REVOKE EXECUTE ... FROM anon, service_role;` ao bloco de grants.
3. ✅ Re-aplicada a migration corrigida em staging + **alignment migration** `20260906000000` (espelha produção: `staff_id` + índice).
4. ✅ Revalidado: **27/27 testes PASS + E2E estrito PASS contra staging** (card "Faturamento" via RPC real, banner de degradação ausente).

**Opção B (registro do drift):** a alignment migration documenta o drift (`staff_id`/`payout_amount_calculated` só em produção); auditoria de como entrou sem migration permanece como item de segurança (fora do escopo desta decisão).

**Opção C (não aplicar):** descartada — PO autorizou explicitamente a Opção A para staging.

---

## 10. Decisão

| Estado | Valor |
|--------|-------|
| P1.1 | **CLOSED** (merge `cea99c9`, fechamento documental `8bed19a`) |
| P1.3 staging | **REVALIDATED** (schema alinhado, RPC corrigido, 27/27 testes + E2E estrito PASS) |
| P1.3 produção | **STOP — aguarda decisão do PO** (migration corrigida pronta; aplicação exige autorização explícita) |

---

**Opção A concluída e revalidada em staging. Produção permanece STOP — aguardando decisão explícita do PO sobre a aplicação da migration P1.3 corrigida em `ushsnmlbeurfvlkieiln`.**