# P1.3 — Production Gate: Canonical KPIs via RPC `get_dashboard_kpis`

> **Data:** 2026-09-06
> **Branch:** `feature/p1-3-canonical-kpis` (`8bed19a`)
> **Ambientes auditados:** staging `tjcvuhynckocmvtqykxp` (read+write históricos), produção `ushsnmlbeurfvlkieiln` (somente leitura)
> **Veredito:** **HOLD — NÃO aplicar a migration em produção como está** (achado bloqueante de schema drift no K9)

---

## 1. Critérios do Gate (Pedido do PO)

| # | Critério | Status |
|---|----------|--------|
| 1 | Migration P1.3 pronta para produção | ❌ **NÃO** (K9 referencia coluna inexistente em produção) |
| 2 | Evidências de staging | ✅ Válidas para staging, **não representativas de produção** nesse ponto |
| 3 | Segurança / RLS / SECURITY DEFINER / grants | ⚠️ OK funcional + **achado de grant hygiene** (anon/service_role EXECUTE) |
| 4 | Equivalência dos KPIs | ✅ 27/27 testes (13 equivalência + 14 segurança), |Δ| ≤ 0.01 |
| 5 | Impacto e rollback | ✅ Impacto zero-dados, rollback `DROP FUNCTION` imediato |
| 6 | Somente migration ou integração adicional | ⚠️ Migration sim; integração frontend já existe (P1.1) — correção K9 necessária |
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

## 5. Evidências de Staging (válidas, porém insuficientes)

| Check | Resultado |
|-------|-----------|
| Migration `20260905000000` registrada em `schema_migrations` | ✅ |
| RPC existe + GATE 1 presente no `prosrc` | ✅ |
| `authenticated` EXECUTE | ✅ |
| Testes unitários (estado fundido `cea99c9`) | ✅ 27/27 (13 equivalência + 14 segurança) |
| E2E estrito contra staging (card "Faturamento" via RPC real) | ✅ PASS |
| Homologação P1.1 (PR #26, merge `cea99c9`) | ✅ CLOSED |

**Limitação:** staging foi aplicado contra um schema que **não espelha produção** em `service_execution_participants`. A homologação estrita provou o K9 contra `professional_id`; em produção o K9 usa `staff_id`.

**Ação:** replicar a correção do schema em staging **antes** de qualquer validação de produção.

---

## 6. Equivalência dos KPIs

- ✅ **13/13 equivalência** (K1–K6 vs old selector, |Δ| ≤ 0.01) + **14/14 segurança** re-executados no estado fundido (`cea99c9`) — 2026-09-06.
- Diferenças intencionais documentadas (D-EST-01 reversões, D-RET-01 retenção `completed`, crescimento fração vs %).
- **Risco residual:** a correção do K9 (troca `professional_id` → `staff_id`) **não altera semântica** (mesma FK `public.staff(id)`), mas exige re-execução dos testes de equivalência para manter o certificado.

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

## 9. Correção Proposta (próximo passo, aguarda decisão do PO)

**Opção A (recomendada) — corregir a migration P1.3 + alinhar staging:**
1. Substituir `sep.professional_id` por `sep.staff_id` nas 2 posições do K9 (mesma FK, semântica idêntica).
2. Adicionar `REVOKE EXECUTE ... FROM anon, service_role;` ao bloco de grants.
3. Re-aplicar a migration corrigida em staging e validar novamente (re-execução 27/27 testes + E2E estrito).
4. Só então apresentar novo pedido de aplicação em produção.

**Opção B — investigar/registrar primeiro o drift:**
- Auditar como `staff_id`/`payout_amount_calculated` entrou em produção sem migration (hotfix manual?).
- Recomendado: registrar ADR ou almeno documento de drift antes de qualquer aplicação (a coluna `payout_amount_calculated` também só existe em produção — outro sinal de alteração fora do fluxo).

**Opção C — não aplicar agora:** manter P1.3 produção = STOP até decisão.

---

## 10. Decisão

| Estado | Valor |
|--------|-------|
| P1.1 | **CLOSED** (merge `cea99c9`, fechamento documental `8bed19a`) |
| P1.3 staging | **VALIDATED** (schema divergente — revalidar após correção) |
| P1.3 produção | **STOP — HOLD por schema drift bloqueante** |

---

**Aguardando decisão do PO sobre a Opção de correção (A/B/C). Nenhuma alteração será aplicada em produção sem autorização explícita.**