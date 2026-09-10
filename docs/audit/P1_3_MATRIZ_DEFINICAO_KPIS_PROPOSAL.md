# P1.3 — Matriz de Definição de KPIs Canônicos (ISOLATE)

**Data:** 2026-09-05
**Fase:** P1 — Gestão e Inteligência do Sistema
**Gate:** P1.3 DESIGN GATE — PASS COM CONDIÇÕES → ISOLATE
**Status:** MATRIZ FECHADA — 3 decisões confirmadas pelo PO em 2026-09-05 (D-EST-01, D-PERF-01, D-RET-01)

---

## 1. Evidência de schema (staging `tjcvuhynckocmvtqykxp`, read-only)

### 1.1 `transactions` (colunas relevantes)

| Coluna | Tipo | Nullable | Observação |
|---|---|---|---|
| `id` | uuid | NO | |
| `tenant_id` | uuid | YES | multitenancy |
| `user_id` | uuid | YES | |
| `type` | text | NO | **SEM CHECK constraint** — valores observados: `income`, `expense` |
| `category` | text | NO | |
| `amount` | numeric | NO | |
| `payment_method` | text | YES | |
| `date` | timestamptz | YES | data-base do KPI |
| `status` | text | YES | **SEM CHECK constraint** — valor observado: `paid` |
| `source_type` | text | YES | `comanda` observado; `null` para manuais |
| `source_id` | uuid | YES | vínculo à comanda |
| `metadata` | jsonb | NO | reversão seta `original_transaction_id` aqui |
| `idempotency_key` | text | YES | |

**Implicação:** como não há CHECK, o RPC deve **validar os valores** (`type IN ('income','expense')`, `status IN ('paid')`) e nunca assumir integridade garantida pelo banco.

### 1.2 Modelo de reversão — DOIS caminhos coexistem

| Modelo | Tabela | Como identifica estorno | Evidência |
|---|---|---|---|
| **Legado** | `transactions` + `financial_reversals` | `finance_reverse_transaction` cria **nova transação** `expense`/`paid` com `metadata.original_transaction_id` + registra `financial_reversals` (`original_transaction_id` **e** `reversal_transaction_id`). **Original permanece `income`/`paid` intacto.** | `20260515210804_finance_reverse_transaction_rpc.sql` |
| **Moderno (M4)** | `comanda_payments` | `reversed_at` append-only. **Nenhuma transação de reversão é criada.** | `20260830000000_m4_p1_reverse_comanda_payment.sql` |

`financial_reversals` CHECK constraints (confirmados em staging):
- `amount > 0` (nunca negativo)
- `reversal_type IN ('wrong_settlement','full_refund','partial_refund','duplicate_charge','administrative_cancellation','financial_review')`
- **`partial_refund` existe → excluir o original inteiro da receita seria ERRADO** para estorno parcial.

`comanda_payments` (confirmado em staging): `payment_type` (USER-DEFINED enum), `amount`, `reversed_at` nullable, `motivo`, `idempotency_key`.

### 1.3 Autoridade de execução de serviços

`service_execution_participants` (confirmado em staging): `comanda_item_id`, `professional_id`, `role` (`primary`/`assistant`/`co_executor`), `payout_type`, `payout_value`, `affects_revenue`, `affects_commission`. — É a fonte usada pelo domínio de comissão (ADR-001, shared Financial Core / D8). **Para Performance, esta é a tabela de autoridade para "quem executou", não `comandas.staff_id`.**

### 1.4 Volume do staging

0 comandas, 0 appointments, 8 transactions (7 expense/paid + 1 income/paid), 0 financial_reversals, 55 clients, 44 tenants.
**Implicação:** equivalência exige seed determinístico (builders de teste), não dados reais do staging.

---

## 2. Matriz de definição (v1 — 10 KPIs)

| # | KPI | Fonte | Inclusão | Exclusão | Data-base | Regra | Equivalência (fonte antiga) |
|---|-----|-------|----------|----------|-----------|-------|------------------------------|
| K1 | **Receita** | `transactions` | `type='income'`, `status='paid'`, período | originais estornados via compensação (ver regra) | `date` | `Σ amount − Σ reversals(financial_reversals.amount)` para originais do período | `buildDashboardMetrics.currentIncome` (Dashboard) |
| K2 | **Despesas** | `transactions` | `type='expense'`, `status='paid'`, período | **transações de reversão** (as com `metadata.original_transaction_id` ou vinculadas em `financial_reversals.reversal_transaction_id`) — já compensadas em K1 | `date` | `Σ amount` (sem reversões) | `currentExpenses` (Dashboard) |
| K3 | **Resultado** | derivado (K1−K2) | — | — | período | `income − expenses` | `netRevenue` (Dashboard) |
| K4 | **Ticket médio** | derivado | — | — | período | `Receita / nº transactions income paid` (não estornadas) — preserva denominador atual | `currentAvgTicket` (Dashboard/BI) |
| K5 | **Crescimento** | derivado | — | — | período anterior | `(K1_atual − K1_anterior) / K1_anterior` | `revenueGrowth` |
| K6 | **Retenção** ✅ | `appointments` | clientes com appointment **elegível** (`completed`) no período atual **e** no anterior | `cancelled`, `no_show`, antecipados sem atendimento | `start_time` | `retornou(período atual) / base(período anterior)` | `retentionRate` |
| K7 | **Clientes ativos** | `appointments` | clientes com appointment elegível no período | `cancelled`/`no_show` | `start_time` | `COUNT(DISTINCT client_id)` | `currentVisitorIds.size` (BI) |
| K8 | **Atendimentos** | `appointments` | período | — | `start_time` | `total`, `completed`, `cancelled`, `no_show` (+ taxas) | `operations` (BI) |
| K9 | **Performance profissionais** ✅ | `service_execution_participants` + comandas | execução efetiva (comanda `paid` + `financial_effect` + `affects_revenue`) | antecipação, cancelamento, no-show | fechamento (`closed_at`/`settled_at`/`created_at`) | Σ base por participante (percentage/fixed), `COUNT(DISTINCT item)` | divergente hoje (BI usa comandas paid) |
| K10 | **Novos clientes** | `clients` | `created_at` no período | — | `created_at` | `COUNT(*)` | `newClients` (BI) |

⚠️ = antigas regras com decisão aberta — **fechadas pelo PO em 2026-09-05** (seção 4).

---

## 3. Tratamento de estorno — a regra que muda tudo

**Problema com a fórmula ingênua:** somar `income` e excluir o original estornado funciona para `full_refund`, mas **quebra para `partial_refund`** (partial existe no CHECK e a RPC suporta `p_amount <= available`).

**Regra proposta (D-EST-01):**

```
Receita  = Σ income(período, paid) − Σ financial_reversals.amount
           onde original_transaction_id pertence ao período
Despesas = Σ expense(período, paid) − expense de reversão
           (metadata.original_transaction_id IS NOT NULL OU
            id ∈ financial_reversals.reversal_transaction_id)
```

- **Sem dupla contagem:** a transação de reversão (legado) NÃO entra em Despesas; a compensação acontece na Receita.
- **Estorno moderno (M4):** `comanda_payments.reversed_at IS NOT NULL` → o `income` correspondente (se existir) também deve ser compensado. **GAP:** o RPC v1 lê `transactions`; o vínculo moderno exige decisão sobre como o M4 liga `comanda_payments` a `transactions` — **fora do escopo v1, registrado como dependência da F5/M4.**
- Data-base da compensação: **`date` da transação original** (a receita do período é o que foi efetivamente recebido e permaneceu).

---

## 4. Decisões confirmadas do PO (2026-09-05)

| ID | Regra | Decisão do PO |
|----|-------|---------------|
| **D-EST-01** | Tratamento de estorno | **Receita líquida por reversões, preservando o original** — compensação proporcional via `financial_reversals.amount` (original permanece `income/paid`; expense de reversão não entra nas despesas). Única correta com `partial_refund`. |
| **D-PERF-01** | Performance profissional | **`service_execution_participants` como autoridade de execução** — Σ base por participante para itens de comandas com execução efetiva (`paid` + `financial_effect` + `affects_revenue`). |
| **D-RET-01** | "Retornou" na retenção | **Atendimento elegível no período atual** — excluir no mínimo `cancelled`, `no_show` e pagamentos antecipados sem atendimento. Janela: clientes-base (elegíveis no período anterior) → quantos retornaram no atual → retenção %. "Criar agendamento não conta como retenção." |

**Consequência operacional (D-RET-01):** "atendimento elegível" = appointment `completed` (efetivado). Antecipados sem atendimento permanecem `confirmed`/`scheduled` — nunca `completed` — e, portanto, ficam fora do numerador, do denominador-base e de K7/K8 automaticamente.

---

## 5. Contrato do RPC (proposta escrita em `docs/audit/P1_3_MIGRATION_PROPOSAL_get_dashboard_kpis.sql`)

```
get_dashboard_kpis(p_period text, p_staff_id uuid DEFAULT NULL) → JSONB
```

- **Retorno:** somente KPIs canônicos (seções 2). Dimensões analíticas (top services, top clients, revenue by method) **ficam fora** — consultas específicas continuam existindo (regra do design gate: "mega-RPC Deus" proibido).
- **Segurança (condições aprovadas):**
  - `SET search_path = public`
  - `SECURITY DEFINER` + gate interno obrigatório:
    `auth.uid() → current_tenant_id_from_auth_uid() → papel permitido (profiles → staff → user_tenants.membership, espelha finance_reverse_transaction) → escopo de staff → agregação`
  - `p_tenant_id` **nunca** aceito do frontend (derivado do contexto); `p_staff_id` opcional apenas com validação de pertencimento ao tenant.
  - Grants: `REVOKE ALL ... FROM PUBLIC/anon` + `GRANT EXECUTE TO authenticated` (ADR-012).
- **Timezone:** `America/Sao_Paulo` fixo (constante documentada como decisão de domínio v1) — janela calculada com `AT TIME ZONE 'America/Sao_Paulo'`.
- **Períodos:** `today | yesterday | week | month | quarter | year`; janela `[início, fim)` inclusivo-exclusivo.
- **K9 data-base:** `COALESCE(closed_at, settled_at, created_at)` da comanda (fechamento) — a validar nos testes de equivalência.
- **GAP registrado:** estorno moderno (M4 `comanda_payments.reversed_at`) não cria transação; o vínculo com `transactions` é dependência da F5/M4, fora do escopo v1.

---

## 6. Mapa de migração das páginas

```
Dashboard (selectors.ts)          → get_dashboard_kpis
BI financial/clients/operations   → get_dashboard_kpis (dimensões analíticas continuam locais)
Performance                       → get_dashboard_kpis.staff
Reports (tabs ChefClub/Sales)     → fora do escopo KPI (ChefClub tem fonte própria)
StrategicDashboard                → get_dashboard_kpis (após P1.1)
```

## 7. Critério de equivalência (destravado — decisões confirmadas)

1. Seed determinístico com builders (`tests/builders/*`) cobrindo: pagamento normal, full refund, **partial refund**, antecipação, cancelamento, no-show, multi-profissional (comanda 2 profissionais), duplicidade idempotency.
2. Rodar seletor antigo (TS) e RPC (SQL) sobre os mesmos dados.
3. Comparar com tolerância `|Δ| ≤ 0.01` (inteiros: igualdade exata).
4. Registrar `equivalence.test.ts` no PR como evidência.

---

## STATUS

- **Evidência de schema:** COMPLETA (staging, read-only).
- **Matriz:** FECHADA — D-EST-01, D-PERF-01, D-RET-01 confirmados pelo PO (2026-09-05).
- **Migration proposal:** ESCRITA (artefato de branch, NÃO aplicada) — `docs/audit/P1_3_MIGRATION_PROPOSAL_get_dashboard_kpis.sql`.
- **Próximo:** IMPLEMENT do RPC + testes de equivalência, após autorização do PO para avançar a subfase.
- **Produção:** intocada. STOP de banco ativo.