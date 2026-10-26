# ADR-037: Conciliação Bancária Automática via Importação de Extratos OFX/CSV

**Status:** Proposed  
**Date:** 2026-10-26  
**Deciders:** PO (Augusto) + Antigravity  
**Front:** Frente 4 — Conciliação Bancária Inteligente (P.04-BANK-RECONCILIATION)  

---

## Context

O SMG Barber dispõe de um módulo financeiro estruturado com fechamento diário de caixa (`CashClosingPage.tsx`), contas a pagar e a receber (`Expenses.tsx`, `AccountsReceivable.tsx`), fluxo de caixa cronológico (`Cashflow.tsx`) e controle de taxas de adquirentes (ADR-036).

Contudo, o documento de melhorias de produto (`docs/training/IMPROVEMENTS.md`, item 3.1) classifica como **lacuna crítica P1** a ausência de conciliação bancária:
- O gestor da barbearia recebe receitas via PIX e maquininhas e efetua pagamentos de boletos, tributos e fornecedores pela conta bancária;
- O extrato bancário oficial (emitido em formato OFX ou CSV) frequentemente contém lançamentos não previstos (tarifas de conta, estornos, juros, antecipações ou transferências entre contas) ou liquidações de cartão com diferenças de dias úteis;
- Sem uma ferramenta de conciliação integrada, a conferência de saldos é realizada manualmente em planilhas ou delegada a sistemas externos, gerando retrabalho e risco de erros no fechamento contábil.

O roadmap do projeto encontra-se formalmente congelado (`ROADMAP.md`). Qualquer nova estrutura no banco ou novo módulo financeiro exige aprovação e documentação formal via ADR antes da criação de migrations ou código.

---

## Problem

1. **Risco de Duplicidade de Extrato (Falta de Chave Única Bancária):**
   Se o gestor importar o extrato bancário de outubro hoje e importar novamente amanhã para atualizar os lançamentos do dia, transações já existentes podem ser registradas em dobro se o sistema não possuir controle de unicidade por transação bancária.
2. **Segurança e Privacidade de Dados Financeiros:**
   O processamento de extratos bancários não deve depender de gateways ou microsserviços de terceiros para parsing que transmitam dados financeiros sigilosos para fora da infraestrutura da plataforma.
3. **Descompasso Temporal de Liquidação (D+1, D+2):**
   Um pagamento de cartão registrado no Checkout em uma sexta-feira só é creditado no banco na segunda ou terça-feira seguinte. O motor de conciliação não pode exigir igualdade estrita de timestamps para sugerir o vínculo.
4. **Isolamento Multi-Tenant Estrito:**
   Contas bancárias e extratos importados são dados altamente sensíveis de cada barbearia e precisam de segregação física no banco via RLS v2 (`tenant_id = public.current_tenant_id_from_auth_uid()`).
5. **Conformidade com ADR-001:**
   A conciliação bancária trata da conferência da conta bancária física da empresa e não deve, sob nenhuma hipótese, interferir nas regras de comissão teórica dos profissionais.

---

## Decision

Adotaremos uma **Arquitetura de Conciliação Bancária Inteligente e Idempotente**, operando em três pilares:

### 1. Modelo de Dados e Isolamento RLS v2

Serão criadas três tabelas relacionais em `public` (com suporte a multi-schema se ativado):

1. **`public.bank_accounts`**:
   - `id (UUID PRIMARY KEY)`
   - `tenant_id (UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE)`
   - `bank_code (TEXT NOT NULL)` (código de compensação Febraban, ex: "001", "260", "341")
   - `bank_name (TEXT NOT NULL)` (nome do banco, ex: Nubank, Itaú, Bradesco, Inter, Stone)
   - `agency (TEXT NULL)`
   - `account_number (TEXT NOT NULL)`
   - `account_type (TEXT NOT NULL CHECK IN ('checking', 'savings', 'payment'))`
   - `initial_balance (NUMERIC NOT NULL DEFAULT 0.00)`
   - `current_balance (NUMERIC NOT NULL DEFAULT 0.00)`
   - `color (TEXT NULL)`
   - `is_active (BOOLEAN NOT NULL DEFAULT true)`
   - `created_at (TIMESTAMPTZ DEFAULT now())`
   - RLS v2 estrito via `current_tenant_id_from_auth_uid()`.

2. **`public.bank_statements`**:
   - `id (UUID PRIMARY KEY)`
   - `tenant_id (UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE)`
   - `bank_account_id (UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE)`
   - `filename (TEXT NOT NULL)`
   - `period_start (DATE NOT NULL)`
   - `period_end (DATE NOT NULL)`
   - `imported_by (UUID REFERENCES auth.users(id) ON DELETE SET NULL)`
   - `created_at (TIMESTAMPTZ DEFAULT now())`
   - RLS v2 estrito via `current_tenant_id_from_auth_uid()`.

3. **`public.bank_statement_transactions`**:
   - `id (UUID PRIMARY KEY)`
   - `tenant_id (UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE)`
   - `statement_id (UUID REFERENCES public.bank_statements(id) ON DELETE CASCADE)`
   - `bank_account_id (UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE)`
   - `fitid (TEXT NOT NULL)` (Financial Institution Transaction ID — identificador universal OFX)
   - `posted_at (DATE NOT NULL)` (data de lançamento no banco)
   - `amount (NUMERIC NOT NULL)` (positivo = crédito/entrada, negativo = débito/saída)
   - `memo (TEXT NOT NULL)` (descrição original fornecida pelo banco)
   - `status (TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending', 'reconciled', 'ignored'))`
   - `matched_transaction_id (UUID NULL REFERENCES public.transactions(id) ON DELETE SET NULL)`
   - `reconciled_at (TIMESTAMPTZ NULL)`
   - `created_at (TIMESTAMPTZ DEFAULT now())`
   - **Garantia de Idempotência:** `CONSTRAINT uq_bank_statement_tx_fitid UNIQUE (tenant_id, bank_account_id, fitid)`.

### 2. Parser OFX / CSV Puro Client-Side

- O processamento dos arquivos OFX e CSV será executado **diretamente no navegador** através de um módulo TypeScript puro e leve (`src/lib/banking/ofxParser.ts`).
- **Benefícios:**
  - Zero dependências de pacotes externos volumosos ou não auditados;
  - Zero tráfego de extratos brutos para servidores intermediários;
  - Extração de metadados: `<BANKID>`, `<ACCTID>`, `<DTSTART>`, `<DTEND>`, e blocos de transação `<STMTTRN>` (`<TRNTYPE>`, `<DTPOSTED>`, `<TRNAMT>`, `<FITID>`, `<MEMO>`);
  - Tratamento resiliente de encodings (UTF-8 e ISO-8859-1 comumente emitidos por bancos brasileiros).

### 3. Motor de Matching Inteligente (Sugestão de Conciliação)

O sistema cruzará as transações pendentes do extrato com os lançamentos da tabela `transactions`:
1. **Regra de Polaridade:**
   - Transação bancária positiva (`amount > 0`) busca `transactions` com `type = 'income'`.
   - Transação bancária negativa (`amount < 0`) busca `transactions` com `type = 'expense'`.
2. **Regra de Valor:**
   - O valor absoluto deve coincidir exatamente: `ABS(bank_tx.amount) == transaction.amount`.
3. **Janela de Tolerância de Compensação:**
   - A data da transação interna deve estar entre `posted_at - 1 dia` e `posted_at + 2 dias` (para acomodar finais de semana e prazos D+1/D+2).
4. **Correspondência Score-Based:**
   - 100% (Match Perfeito): mesmo valor + mesma data;
   - 80% (Match Provável): mesmo valor + data dentro da tolerância (+/- 2 dias);
   - Transações sem correspondência interna aparecem com a opção imediata: **"Criar Lançamento"** (ex: criar despesa de tarifa bancária já conciliada).

### 4. Ações Operacionais do Gestor

Na interface de Conciliação (`/financial/reconciliation`):
1. **Conciliar com Sugestão (1 Clique):** Vincula a transação bancária ao lançamento interno encontrado, atualizando `status = 'reconciled'`.
2. **Criar Lançamento a partir do Extrato:** Abre modal pré-preenchido com valor, data e descrição do extrato para registrar uma despesa/receita na tabela `transactions`, marcando-a automaticamente como conciliada.
3. **Ignorar Transação:** Para movimentações internas entre contas do mesmo titular ou estornos pontuais.
4. **Desconciliar:** Permite reverter um vínculo caso o operador tenha associado o lançamento errado.

---

## Alternatives Considered

- **Integração com agregadores Open Finance (Pluggy / Belvo):** Rejeitada para o escopo inicial: introduz custo mensal por conexão bancária, burocracia regulatória e dependência de APIs externas de alta volatilidade. A importação de arquivos OFX/CSV é suportada por 100% dos bancos brasileiros e é custo zero para o tenant.
- **Inserção de extrato sem FITID único:** Rejeitada: geraria duplicações crônicas caso o usuário importasse extratos com períodos sobrepostos.
- **Alteração do cálculo de comissões:** Rejeitada: violaria o ADR-001. A conciliação é restrita ao fechamento contábil e de caixa.

---

## Consequences

- **Positivo:** O gestor passa a ter controle total sobre o saldo real da conta corrente e da maquininha versus o faturamento registrado no sistema.
- **Positivo:** Tarifas bancárias e sangrias não documentadas são descobertas e regularizadas em segundos.
- **Isolamento Garantido:** RLS v2 garante que nenhuma barbearia veja contas bancárias ou extratos de outro tenant.
- **Próximos Passos:**
  1. Criação da migration com as tabelas `bank_accounts`, `bank_statements` e `bank_statement_transactions`;
  2. Implementação do parser OFX/CSV client-side puro;
  3. Desenvolvimento do repositório/service de conciliação;
  4. Desenvolvimento da tela de conciliação bancária (`pages/BankReconciliation.tsx`).

---

## References

- **ADR-001:** Segregação entre Comissão Teórica e Liquidação de Caixa (`docs/adr/ADR-001-Commission-vs-Settlement.md`).
- **ADR-003:** Isolamento Multi-Tenant Estrito (`docs/adr/ADR-003-multi-tenant-isolation.md`).
- **ADR-018:** Contrato de Pagamento e Liquidação (`docs/adr/ADR-018-payment-contract.md`).
- **ADR-036:** Terminais de Pagamento e Taxas (`docs/adr/ADR-036-payment-terminals-and-fee-snapshots.md`).
- **Catálogo de Melhorias P1:** `docs/training/IMPROVEMENTS.md` (Item 3.1: *Conciliação bancária automática*).
