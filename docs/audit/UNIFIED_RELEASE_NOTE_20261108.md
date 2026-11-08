# Auditoria de Liberação de Produção — Lote Unificado

> **Data:** 2026-11-08  
> **Autorizador:** Augusto (PO)  
> **Objetivo:** Registro consolidado para promoção controlada para produção (`https://barber.soumanager.com`) via workflow `deploy-production.yml` (ADR-026 / ADR-028).

---

## 1. Escopo Consolidado do Lote

1. **Conta do Cliente & Limite Fiado (PR #273):**
   - Gestão de saldo devedor individual e controle manual de limites.
   - Autorização por PIN do gestor para concessão de crédito excedente.
   - Histórico de débitos e liquidações parciais por comanda.

2. **Central Financeira Unificada (PR #274):**
   - Abas integradas: Contas a Pagar, Contas a Receber, Sub-aba de Fiados e Adiantamentos/Vales de Barbeiros.
   - Liquidação em lote e rastreamento completo de competência e vencimento.

3. **Estoque 360 & Bancada (PR #275):**
   - Registro de consumo interno pelos colaboradores na bancada.
   - Conferência e balanço periódico de estoque protegido por PIN gerencial.
   - Entrada de compras com Custo Médio Ponderado (CMP) e atualização patrimonial.

4. **Rateio Inteligente de Taxas de Maquininha (PR #276):**
   - Três políticas: Bruto (100% Casa), Dividido (Proporcional) ou Descontado (Barbeiro).
   - Configuração individual por colaborador com fallback para a política padrão da barbearia.
   - Selo transparente no extrato: *"Isento de taxa administrativa da máquina"* com destaque do valor absorvido pela casa.

5. **Cockpit Executivo & Agenda Atelier Tech (`d83d382`):**
   - KPI cards com margem real, ticket médio e ocupação de cadeiras em tempo real.
   - Gráfico de área dourada com liquidez e despesas operacionais.
   - Radar de performance e progresso de metas do tenant.

---

## 2. Invariantes de Governança e Qualidade

- **Canônicos Preservados:** `domain/commission/` mantido intocado conforme ADR-001.
- **Isolamento Multi-tenant:** RLS estrito respeitado em todas as tabelas.
- **Zero Regressões Arquiteturais:** `architecture:ci` aprovado com 0 violações além da baseline.
- **Typecheck & Build:** 0 erros no TypeScript 5.8 e build Vite 6 concluído em ~11s.

```yaml
authorization_record:
  ticket: "UNIFIED-RELEASE-20261108"
  authorized_by: "Augusto (PO)"
  date: "2026-11-08"
  target_env: "prod"
  merge_approved: true
  deploy_approved: true
```
