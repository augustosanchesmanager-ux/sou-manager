# P1.1 — Central de Relatórios (`/reports`) Design Gate

> **Status:** `AUDIT ✅ · CLASSIFY ▶ · DESIGN ⏸ PO STOP`
> **Date:** 2026-09-06
> **Parent:** P1 — Gestão e Inteligência do Sistema
> **Predecessor:** P1.3 — KPIs Canônicos via RPC `get_dashboard_kpis` (IMPLEMENTADO, migration não aplicada)
> **Referência arquitetural:** `src/modules/dashboard/{kpiTypes.ts,rpc.ts}` + `docs/audit/P1_3_MATRIZ_DEFINICAO_KPIS_PROPOSAL.md` §6

---

## 1. Problem Statement

A página `/reports` (Central de Relatórios) tem duas abas:

- **Clube dos Chefs** — funcional; agrega `customer_subscriptions`/`customer_credits`/`customer_plans` diretamente (fonte própria, fora do escopo KPI por decisão da matriz §6).
- **Vendas** — placeholder "Em breve"; `fetchSales` é um stub que apenas zera estado (`setStats`, `setSales([])`) e encerra. A interface `SaleRecord` existe, mas não há consulta.

Em paralelo, a lógica dos KPIs financeiros está **duplicada em 3 pontos do frontend** — `useStrategicDashboard` (revenue, growth, avgTicket, clients, occupation), `useBusinessInsights`/BI (FinancialKPIs, ClientKPIs, OperationalKPIs) e `selectors.buildDashboardMetrics` (Dashboard) — todos calculando os mesmos números com queries diretas. O RPC canônico `get_dashboard_kpis` (P1.3) já é a fonte única, provada por equivalência SQL-vs-selector (|Δ| ≤ 0.01).

**P1.1 deve resolver a aba Vendas sem criar uma quarta implementação de KPI.**

## 2. Arquitetura de Dados (Regra Central)

```
Cards KPI
   ↓
getDashboardKpis(period)
   ↓
preset canônico

Detalhamento
   ↓
query local (por tabela)
   ↓
dateFrom/dateTo livre
```

> **Regra arquitetural:** intervalo livre pode existir para exploração/detalhamento, mas **não deve provocar uma segunda implementação dos KPIs canônicos**.

## 3. Escopo

### In Scope
- `/reports` permanece o hub.
- Aba **Vendas** deixa de ser placeholder.
- Cards financeiros da aba Vendas usam **exclusivamente `getDashboardKpis()`**.
- Detalhamentos de vendas (listagem por comanda, top serviços/profissionais quando aplicável) como consultas locais por tabela.
- Tradução dos presets do filtro para períodos canônicos.
- Tratamento explícito de `custom` e presets sem equivalente canônico (UX anti-misleading).

### Out of Scope (Explicit)
- Aba **ChefClub** — permanece intocada (fonte própria).
- **StrategicDashboard** — migração para `get_dashboard_kpis` é entrega posterior (matriz §6: "após P1.1").
- **Dashboard** (`selectors.ts`) e **BI** (`useBusinessInsights`) — migração para o RPC também é entrega posterior da matriz §6; P1.1 não os toca.
- **P1.2 (Metas)** — fase subsequente.
- **Aplicar a migration P1.3 em produção** — P1.1 não depende disso (o RPC já está implementado e testado na branch; integração da aba Vendas usa o cliente TS, não exige migration aplicada).

## 4. Decisões Propostas

| # | Decisão |
|---|---------|
| 1 | `/reports` permanece o hub da Central de Relatórios. |
| 2 | Aba **ChefClub** permanece fora do escopo P1.1. |
| 3 | Aba **Vendas** deixa de ser placeholder. |
| 4 | Cards financeiros usam **exclusivamente `getDashboardKpis()`**. |
| 5 | Nenhum KPI será recalculado localmente para substituir o RPC. |
| 6 | Detalhamentos de vendas continuam consultas locais por tabela. |
| 7 | Presets do filtro são traduzidos para os períodos canônicos quando há correspondência semântica. |
| 8 | `custom` não altera os cards canônicos. |
| 9 | `StrategicDashboard` fica explicitamente **fora desta entrega** (migração posterior). |
| 10 | P1.1 não depende de aplicar a migration P1.3 em produção. |

## 5. Períodos: Mapeamento Preset → Canônico

Presets do `DateRangeFilter` (`components/ui/DateRangeFilter.tsx`): `today | yesterday | last_7_days | this_month | last_month | this_year | custom`.

| Preset | Período canônico (cards) | Detalhamento (tabelas) |
|--------|--------------------------|------------------------|
| `today` | `today` | hoje |
| `yesterday` | `yesterday` | ontem |
| `this_month` | `month` | mês corrente |
| `this_year` | `year` | ano corrente |
| `last_7_days` | **ancorado** no último canônico renderizado (ex.: `month`) | janela móvel 7 dias |
| `last_month` | **ancorado** no último canônico renderizado (ex.: `month`) | mês anterior |
| `custom` | **ancorado** no último canônico renderizado (ex.: `month`) | intervalo `dateFrom`/`dateTo` livre |

**Justificativa:** o contrato P1.3 suporta apenas períodos de calendário (`today|yesterday|week|month|quarter|year`); `last_7_days` (janela móvel) e `last_month` não têm equivalente semântico — `week` é semana de calendário e `month` é o mês corrente. Nessas situações os cards permanecem ancorados no último canônico renderizado, nunca em um intervalo sem fonte RPC.

## 6. UX do `custom` (Anti-Misleading)

O filtro customizado **não desaparece** — permanece ativo para tabelas/detalhamentos. Se os cards canônicos não representarem o intervalo customizado, isso fica **visualmente explícito**:

```
Período dos KPIs: Este mês
Detalhamento: 01/08/2026 → 17/08/2026
```

Alternativa aceita (a escolher na implementação): desabilitar `custom` somente enquanto a aba estiver na visualização de cards, habilitando na camada de detalhamento.

**Motivação:** o risco de o usuário escolher `custom` e assumir que "Faturamento" reflete aquele intervalo (quando o RPC mostra o mês inteiro) é pior do que manter o filtro visível com rótulo explícito.

## 7. Componentes / Regras de Implementação (referência)

| Camada | Regra |
|--------|-------|
| Cards KPI (abas Vendas) | `getDashboardKpis(periodCanonico)` → `result.financial` (revenue, expenses, result, average_ticket, growth). Nunca `sum()` de transações no cliente. |
| Label "Período dos KPIs" | Derivado do preset canônico ativo (tabela §5), independente do `custom`. |
| Detalhamento de vendas | Query local por schema (`getScopedClient('barber')`), filtrada por `dateFrom`/`dateTo` e `tenant_id`. |
| Sem nova lógica KPI | Zero recálculo de revenue/growth/avgTicket/retenção no frontend desta entrega. |

## 8. Governança

| Regra | Status |
|-------|--------|
| Auditoria P1.1 (estado atual `/reports`, mapa de duplicação KPI, contrato P1.3) | ✅ |
| Classificação (escopo in/out, decisões) | ▶ em andamento neste gate |
| Implementação somente após aprovação do PO | ⏸ BLOCKED |
| Sem aplicação de migration em produção | ✅ (P1.1 não depende; P1.3 continua aguardando STOP gate) |
| Sem tocar ChefClub / StrategicDashboard / Dashboard / BI | ✅ |
| Sem misturar frente M4 ou outras fases | ✅ |

## 9. Critérios de Verificação (pós-implementação)

| Critério | Como verificar |
|----------|----------------|
| Vendas deixa de ser placeholder | Aba renderiza cards + listagem real |
| Cards vêm do RPC | `network` mostra 1 chamada `get_dashboard_kpis`; zero queries de `transactions` por card no cliente |
| Preset → canônico | `this_month` → `month`, `today` → `today`, etc. (tabela §5) |
| Custom não move cards | Selecionar `custom` mantém label "Período dos KPIs: Este mês" e cards inalterados |
| Detalhamento segue custom | Tabela reflete `dateFrom`/`dateTo` escolhidos |
| Sem KPI duplicado | `grep` por `sum(amount)`/`avgTicket`/`growth` em código novo da aba: 0 ocorrências |
| ChefClub intacto | Diff da tab ChefClub: vazio |

## 10. Decisões Pendentes do PO

1. **Escopo da aba Vendas** — cards + listagem de comandas no `v1`? Ou também top serviços/profissionais na mesma entrega?
2. **Regra de período** — validar a tabela §5, inclusive o comportamento "ancorado" para `last_7_days`/`last_month` (sem equivalente canônico).
3. **Comportamento de `custom`** — label explícito "Período dos KPIs: Este mês" vs. desabilitar `custom` na camada de cards (escolha da seção §6).
4. **Dimensões locais** — confirmar que top serviços/profissionais/métodos de pagamento permanecem consultas locais (sem migração para RPC nesta fase).
5. **ChefClub intocado** — confirmação formal.
6. **StrategicDashboard outra entrega** — confirmação formal.

---

**Aguardando aprovação do PO para prosseguir.**

```
PO APPROVAL
    ↓
ISOLATE
    ↓
IMPLEMENT
    ↓
staging
    ↓
PR
```

---

## 11. Fechamento (2026-09-06)

**P1.1 ENCERRADA.** Merge autorizado pelo PO.

- **PR #26 merged** (`feature/p1-1-central-de-relatorios` → `feature/p1-3-canonical-kpis`, merge `cea99c9`, 2026-09-06T06:50:02Z).
- **Homologação staging:** migration P1.3 `20260905000000_get_dashboard_kpis.sql` aplicada **exclusivamente no staging** (`tjcvuhynckocmvtqykxp`, autorização explícita do PO) + registro em `supabase_migrations.schema_migrations`. RPC confirmado (`to_regprocedure` OK; `authenticated` EXECUTE). E2E estrito contra staging PASS — card "Faturamento" renderizado via RPC real, banner de degradação ausente.
- **Validação pós-merge:** typecheck 72 = 72 pré-existentes (zero novos); build PASS (14.06s, EXIT 0).
- **Produção NÃO tocada** — migration P1.3 não aplicada em produção; qualquer ação em produção permanece sujeita a autorização explícita do PO.

STATUS: CONTINUE (aguardando decisão do PO para avanço em produção).