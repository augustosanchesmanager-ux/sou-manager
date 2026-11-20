# ADR-052: Venda de Produtos por Profissional & Metas Flexíveis de Produtos

**Status:** Accepted (2026-11-20 — plano aprovado pelo PO via `/grill-me`)  
**Date:** 2026-11-20  
**Deciders:** PO + Antigravity (`project-planner`)  
**References:**
- [`docs/adr/ADR-001-Commission-vs-Settlement.md`](./ADR-001-Commission-vs-Settlement.md) — Separação entre comissão teórica (D7/D8) e fechamento/repasse
- [`docs/adr/ADR-047-unified-commission-product-and-vales-rules.md`](./ADR-047-unified-commission-product-and-vales-rules.md) — Comissão de produtos via `staff.product_commission_rate`
- [`AGENTS.md`](../../AGENTS.md) — Regras multi-tenant, RLS e imutabilidade do core D7/D8

---

## Context

1. O relatório `Relatórios > Vendas e Faturamento > Produtos` (`components/reports/ReportsProductsTab.tsx`) exibe apenas a visão consolidada por produto (`Desempenho de Vendas`) e `Posição Atual de Estoque`, sem visibilidade de **quanto cada profissional vendeu**.
2. Recepcionistas e barbeiros participam ativamente da venda de produtos no balcão e na bancada, porém não havia estrutura para:
   - Atribuir metas em `R$` para **recepcionistas** com múltiplas faixas progressivas;
   - Configurar **bonificação adicional** para **barbeiros** (além da comissão padrão `product_commission_rate`) por atingir `%` da meta ou `R$` vendido;
   - Reutilizar modelos de metas por cargo (`role`) ou personalizar individualmente por colaborador (`staff_id`) com periodicidade flexível (`monthly`, `biweekly`, `weekly`).

## Problem

Como introduzir apuração de vendas de produtos por profissional e metas flexíveis com premiação em `R$` ou `%` sem violar:
1. O **ADR-001** e a certificação **D7/D8** (motor de comissão em `domain/commission/` é imutável em D8);
2. O isolamento estrito **multi-tenant** com RLS;
3. A auditabilidade da **Folha de Pagamento (`pages/Payroll.tsx`)**.

## Decision

1. **Atribuição de Vendedor (`comanda_items.staff_id`):**
   - Utilizar `comanda_items.staff_id` (com fallback para `comandas.staff_id`) como fonte canônica do vendedor do produto, permitindo selecionar qualquer colaborador ativo (`barber`, `receptionist`, `manager`, `owner`, `admin`) no lançamento do item.
2. **Novas Tabelas Multi-Tenant (`product_goal_templates` e `staff_product_goals`):**
   - `product_goal_templates`: modelos reutilizáveis por cargo (`receptionist`, `barber`, `all`) com periodicidade (`monthly`, `biweekly`, `weekly`) e array estruturado de faixas (`tiers`).
   - `staff_product_goals`: atribuição por colaborador (`staff_id`), podendo herdar um modelo (`template_id`) ou definir `custom_tiers` e `base_goal_amount` individualmente.
3. **Motor Puro de Avaliação (`domain/productGoals/`):**
   - Regras progressivas onde prevalece a **maior faixa atingida**, suportando gatilho por `amount_brl` (R$ vendido) ou `goal_percent` (% da meta base), e prêmio em `fixed_brl` (R$) ou `percent` (`%` sobre `total_sold` ou `tier_target`).
   - Totalmente desacoplado de `domain/commission/`.
4. **Integração Controlada com a Folha (`pages/Payroll.tsx`):**
   - O relatório `Por Profissional` calcula e exibe a premiação estimada separadamente da comissão padrão, oferecendo ação para **sugerir o valor como bônus** (`bonuses_added`) na Folha sob confirmação explícita do gestor.

## Consequences

- **Positivas:** Zero risco de regressão no cálculo D7/D8; flexibilidade total para recepção e barbeiros; rastreabilidade completa entre venda → faixa atingida → bônus sugerido.
- **Trade-offs:** A bonificação não entra automaticamente no líquido do repasse sem ação do gestor (garante conferência antes do pagamento).
