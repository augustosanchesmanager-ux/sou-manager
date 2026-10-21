# ADR-036: Cadastro de Maquininhas de Cartão e Snapshot Contábil de Taxas no Checkout (PDV Avançado)

**Status:** Accepted
**Date:** 2026-10-21
**Deciders:** PO (Augusto) + OpenCode
**References:** ADR-001 (Commission vs Settlement), ADR-017 (Ciclo Operacional vs Financeiro), ADR-018 (Contrato de Pagamento e comanda_payments), ADR-030 (Ciclos de Repasse e Regime de Caixa)

---

## 1. Context

Atualmente, o PDV do SMG Barber registra formas de pagamento de maneira genérica (`credit`, `debit`, `cash`, `pix`, `other`) sem discriminação do canal físico de captura (maquininhas/terminais como Stone, PagBank, InfinitePay, Cielo, Rede, Mercado Pago) e sem cálculo das taxas cobradas pelas operadoras/adquirentes de cartão.

No dia a dia das barbearias:
1. Uma venda de R$ 100,00 no crédito não representa R$ 100,00 em conta bancária; a operadora desconta entre 1,5% e 4,5% a depender do plano e prazo.
2. Os estabelecimentos frequentemente renegociam suas taxas com as adquirentes ou trocam de maquininha ao longo do tempo.
3. Se as taxas forem calculadas dinamicamente com base nas configurações atuais do sistema, relatórios passados e conciliações contábeis seriam retroativamente distorcidos toda vez que o gestor atualizasse sua tabela de taxas.
4. Por outro lado, o operador de balcão necessita de agilidade máxima: um fluxo de checkout burocrático com múltiplos cliques e seletores complexos inviabiliza a operação em horários de pico.

---

## 2. Problem & Requirements

1. **Rastreabilidade de Custos Financeiros:** Falta de visibilidade da margem líquida real das transações de cartão e do prazo de liquidação em conta (`settlement_days`).
2. **Imutabilidade Contábil:** O valor da taxa percentual, o montante em reais descontado e o líquido a receber de cada transação precisam ser congelados no momento exato da liquidação no PDV (**Snapshot Contábil Imutável**).
3. **Agilidade no Balcão:** O Checkout deve permitir confirmação em 1 clique quando houver terminal padrão, pré-selecionando a maquininha ativa e calculando a taxa automaticamente de acordo com o método escolhido (débito, crédito à vista ou parcelado).
4. **Resiliência e Fallback (PDV Simples):** O sistema deve continuar funcionando perfeitamente em modo simplificado para barbearias que ainda não cadastraram maquininhas ou preferem operar sem controle avançado de taxas.

---

## 3. Decision

Fica aprovada a criação da infraestrutura de **Maquininhas de Cartão e Snapshot Contábil de Taxas**:

### 3.1. Modelo de Dados (`public.payment_terminals` e `public.payment_terminal_rates`)

1. **`public.payment_terminals`:**
   - Cadastra os equipamentos físicos/virtuais de captura (`id`, `tenant_id`, `name`, `acquirer`, `is_default`, `is_active`).
   - Índice único parcial garante no máximo 1 terminal padrão ativo por tenant:
     ```sql
     CREATE UNIQUE INDEX idx_payment_terminals_default
       ON public.payment_terminals(tenant_id)
       WHERE is_default = true AND is_active = true;
     ```

2. **`public.payment_terminal_rates`:**
   - Define as taxas configuradas para cada modalidade do terminal (`terminal_id`, `method`, `installments_min`, `installments_max`, `rate_percentage`, `fixed_fee`, `settlement_days`).
   - Métodos suportados: `debit`, `credit_sight`, `credit_installment`, `pix`.

3. **Snapshot Contábil em `public.comanda_payments`:**
   - Adicionadas as colunas de snapshot à tabela canônica de pagamentos:
     - `terminal_id UUID REFERENCES public.payment_terminals(id) ON DELETE SET NULL`
     - `fee_percentage NUMERIC(6,3) NULL`
     - `fee_amount NUMERIC(10,2) NULL`
     - `net_amount NUMERIC(10,2) NULL`
     - `estimated_settlement_date DATE NULL`
   - O preenchimento dessas colunas ocorre estritamente no momento da gravação do pagamento, tornando a linha autossuficiente e imutável.

### 3.2. Fórmulas Canônicas de Snapshot

Dado o valor bruto do pagamento $V_{\text{bruto}}$, a taxa percentual $T_{\%}$, a taxa fixa $F_{\text{fixa}}$ e o prazo em dias de liquidação $D$:

$$\text{fee\_amount} = \text{roundCents}\left( V_{\text{bruto}} \times \frac{T_{\%}}{100} + F_{\text{fixa}} \right)$$

$$\text{net\_amount} = V_{\text{bruto}} - \text{fee\_amount}$$

$$\text{estimated\_settlement\_date} = \text{addBusinessDays}(\text{payment\_date}, D)$$

### 3.3. UX de Balcão (Default Inteligente)

1. No Checkout, ao escolher **Cartão (Débito ou Crédito)**:
   - Se houver terminal padrão, ele é pré-selecionado automaticamente.
   - O operador visualiza chips largos e objetivos com as maquininhas ativas.
   - Um badge discreto informa em tempo real: `Taxa: X% (-R$ Y,YY) · Líquido: R$ Z,ZZ (D+N)`.
2. Se o tenant não tiver maquininhas cadastradas, o seletor não é exibido e o pagamento é gravado com taxas nulas, mantendo compatibilidade 100% com o PDV Simples.

---

## 4. Consequences

### Positivas
- Permite controle gerencial exato do faturamento bruto versus líquido que entrará no banco.
- Prepara a base para a futura **Conciliação Bancária (F-04.2)**, cruzando o `estimated_settlement_date` e `net_amount` com o extrato bancário.
- Preserva a verdade histórica: alterações contratuais de taxas nunca recalcularão pagamentos passados.
- Zero impacto no tempo de checkout com o mecanismo de pré-seleção inteligente.

### Restrições
- Não altera as regras de remuneração de profissionais (D8 Core): comissões de parceiros continuam sendo calculadas sobre o valor de comanda acordado conforme o ADR-001, salvo decisão comercial futura do tenant de rateio de taxa de maquininha.
