# P1.3 — Entry Audit: Canonical KPIs via RPC `get_dashboard_kpis`

> **Data:** 2026-09-05
> **Branch:** `feature/p1-3-canonical-kpis`
> **Commit:** `d10d9bb`
> **Status:** IMPLEMENTADO (migration NÃO aplicada em produção)

---

## 1. Escopo

| Item | Arquivo | Status |
|------|---------|--------|
| Migration SQL | `supabase/migrations/20260905000000_p1_3_get_dashboard_kpis.sql` | Criado |
| Tipos TypeScript | `src/modules/dashboard/kpiTypes.ts` | Criado |
| Cliente RPC | `src/modules/dashboard/rpc.ts` | Criado |
| Testes de equivalência | `tests/equivalence/p1_3_kpi_equivalence.test.ts` | 13/13 PASS |
| Testes de segurança | `tests/security/p1_3_kpi_security.test.ts` | 14/14 PASS |
| Builders de teste | `tests/builders/financialReversal.builder.ts` | Criado |
| Proposta KPI | `docs/audit/P1_3_MATRIZ_DEFINICAO_KPIS_PROPOSAL.md` | Pré-existente |
| Proposta SQL | `docs/audit/P1_3_MIGRATION_PROPOSAL_get_dashboard_kpis.sql` | Pré-existente |

---

## 2. GATES de Segurança (Migration SQL)

| Gate | Descrição | Implementação |
|------|-----------|---------------|
| GATE 1 | `auth.uid() NOT NULL` | RAISE EXCEPTION `'Usuario autenticado obrigatorio'` |
| GATE 2 | `tenant_id` resolvido via `get_auth_access_context` | RAISE EXCEPTION `'Tenant nao resolvido'` |
| GATE 3 | Role em `(manager, owner, superadmin)` | RAISE EXCEPTION `'Permissao insuficiente'` |
| GATE 4 | `staff_id` pertence ao tenant (quando fornecido) | RAISE EXCEPTION `'Profissional nao pertence ao tenant'` |
| GATE 5 | Período em `('today','week','month','quarter','year')` | RAISE EXCEPTION `'Periodo invalido'` |
| GATE 6 | Superadmin bypass | `IF p_role = 'superadmin' THEN RETURN ...` |

---

## 3. KPIs Implementados

| ID | KPI | Seção | Decisão |
|----|-----|-------|---------|
| K1 | Receita | `financial.revenue` | D-EST-01 (reversões deduzem) |
| K2 | Despesas | `financial.expenses` | Soma de transações expense |
| K3 | Resultado | `financial.result` | revenue - expenses |
| K4 | Ticket Médio | `financial.avgTicket` | revenue / completed appointments |
| K5 | Crescimento | `financial.revenueGrowth` | Fração (0.25 = 25%), não percentual |
| K6 | Retenção | `clients.retentionRate` | Fração, `status='completed'` (D-RET-01) |
| K7 | Clientes Ativos | `clients.activeClients` | Distinct client_id em completed |
| K8 | Atendimentos | `operations.completed/appointments/total` | Contagem por status |

---

## 4. Decisões de Design

| ID | Decisão | Justificativa |
|----|---------|---------------|
| D-EST-01 | Reversões deduzem de receita/despesa no período | RPC é fonte canônica; old selector ignora reversões |
| D-PERF-01 | SECURITY DEFINER + IRRF + REVOKE/GRANT | Performance server-side, segurança em 1 call |
| D-RET-01 | Retenção por `status='completed'` (não `!=cancelled`) | Apenas atendimentos completados contam como retenção |

---

## 5. Equivalência vs Old Selector

| Cenário | Resultado |
|---------|-----------|
| Sem reversões | K1-K6 idênticos, \|Δ\| = 0 |
| Com reversões | D-EST-01: RPC deduz, old selector não — diferença **intencional** |
| Crescimento | Old selector retorna % (×100), RPC retorna fração — conversão documentada |
| Retenção | D-RET-01: old usa `!=cancelled`, RPC usa `=completed` — diferença **intencional** |

---

## 6. Validação

| Check | Resultado |
|-------|-----------|
| Tests: equivalence | 13/13 PASS |
| Tests: security | 14/14 PASS |
| Full test suite | 59/62 arquivos (3 falhas pré-existentes em staging reversal) |
| Typecheck | 72 erros pré-existentes, 0 novos |
| Build | Não aplicável (front-end não alterado) |

---

## 7. Pendências

| Item | Responsável | Status |
|------|-------------|--------|
| Aplicar migration em staging | PO | **PENDENTE** — exige STOP gate separado |
| Aplicar migration em produção | PO | **PENDENTE** — exige STOP gate separado |
| Integrar `getDashboardKpis` no Dashboard.tsx | P1.1/P1.2 | **PENDENTE** — depende de P1.1 (Central de Relatórios) |
| M4 finance operations (feature/m4-finance-operations) | PO | Branch separada, sem conflito |

---

## 8. Critérios de Saída

- [x] Migration SQL criada e validada
- [x] Tipos TypeScript definidos
- [x] Cliente RPC tipado
- [x] Testes de equivalência (K1-K6, |Δ| ≤ 0.01)
- [x] Testes de segurança (5 gates)
- [x] Commit semântico
- [x] Push da branch
- [x] Entry audit criado
- [ ] Migration aplicada em staging (exige PO)
- [ ] Migration aplicada em produção (exige PO)
