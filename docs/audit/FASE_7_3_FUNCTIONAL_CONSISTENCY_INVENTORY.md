# FASE 7.3 — INVENTÁRIO E AUDITORIA DE CONSISTÊNCIA FUNCIONAL (FUNCTIONAL CONSISTENCY AUDIT)

> **SMG Barber — SOU MANA.GER (SMG Platform)**<br />
> **Data de Criação:** 2026-11-04<br />
> **Status:** AUDITADO E MAPEADO<br />
> **Responsável Formal:** Augusto (PO)<br />
> **Governança:** Precedência `AGENTS.md` · SMG Change Control Protocol<br />
> **Decisões PO:** 1-A (Auditoria 360° em 5 Fluxos Centrais) · 2-A (Dicionário Canônico de Mensagens de Negócio em pt-BR) · 3-A (Correção Imediata de Inconsistências Puras)

---

## 1. Visão Geral e Objetivo

A **Fase 7.3 (Functional Consistency Audit)** visa certificar que a experiência de uso do **SMG Barber** seja perfeitamente consistente, eliminando qualquer atrito cognitivo, discrepância de formato de dados ou vazamento de mensagens técnicas e códigos de erro de baixo nível (`23505`, `23P01`, `42501`, `P0001`, `42703`) para o operador da barbearia.

---

## 2. Matriz dos 5 Fluxos Operacionais Centrais

### 2.1 Fluxo 1: Agenda & Agendamentos (Grade, Bloqueios e Cadeira Cativa)
- **Superfície:** `pages/Schedule.tsx`, `components/schedule/*`, `src/modules/schedule/*`.
- **Regra de Consistência:**
  - Durações devem ser exibidas em minutos nominais amigáveis (ex: `30m`, `45m`, `1h 15m`) e traduzidas de/para decimais de hora de forma determinística (`0.5h` = 30min).
  - Slots ocupados e tentativas de colisão não devem lançar erro SQL `23P01`, mas sim Toast explicativo: *"Horário indisponível para este profissional. Deseja realizar um encaixe consciente?"*.
  - A Cadeira Cativa Semanal projeta datas no timezone local `America/Sao_Paulo` e exige confirmação prévia para conversão em agendamento confirmado da semana.

### 2.2 Fluxo 2: Comandas & Balcão PDV (Abertura Rápida e Sincronização)
- **Superfície:** `pages/Comandas.tsx`, `components/comandas/*`, `src/utils/comandaScheduleSync.ts`.
- **Regra de Consistência:**
  - Abertura rápida de comanda por atalho `N` aceita "Consumidor Final" quando o cliente não estiver cadastrado.
  - Produtos adicionados no balcão físico (`service_id IS NULL`) são estritamente preservados em qualquer edição da agenda.
  - Comandas liquidadas (`paid`, `closed`, `billed`) exibem bloqueio visual e impedem mutações via agenda.

### 2.3 Fluxo 3: Checkout & Meios de Pagamento (PDV & Fechamento)
- **Superfície:** `pages/Checkout.tsx`, `application/checkout.ts`, `src/utils/checkoutQuickPay.ts`.
- **Regra de Consistência:**
  - Calculadora de troco impede finalização com valor recebido inferior ao total devido.
  - Moedas e cédulas rápidas BRL (R$ 20, R$ 50, R$ 100) operam com arredondamento contábil estrito em centavos (`roundCents`).
  - Pagamentos múltiplos acumulam com tolerância contábil ≤ R$ 0,05, rejeitando tentativas de submissão parcial incompleta.

### 2.4 Fluxo 4: Fechamento de Caixa & Comissões (Conciliação e Extrato)
- **Superfície:** `pages/CashClosingPage.tsx`, `pages/Commissions.tsx`, `application/cashClosing/*`, `src/utils/barberStatement.ts`.
- **Regra de Consistência:**
  - Separação estrita conforme ADR-001: Comissões teóricas individuais calculadas em `domain/commission/` e rateio de fechamento de caixa diário apurado em `application/cashClosing/`.
  - Extrato do barbeiro segrega comissão confirmada (comandas pagas) de comissão prevista (comandas abertas/bloqueadas), com total transparência de deduções de taxas de maquininha e rateio de combos.

### 2.5 Fluxo 5: Clientes & Club dos Chefes (Fidelização e Créditos)
- **Superfície:** `pages/Clients.tsx`, `components/customers/*`, `domain/chefClub/*`.
- **Regra de Consistência:**
  - Telefones celulares brasileiros são sanitizados para o formato internacional `+55 (DDD) 9XXXX-XXXX` e links de WhatsApp `https://wa.me/55...`.
  - Consumo de créditos do Club dos Chefes em comanda zera o valor a cobrar do cliente (R$ 0,00) mantendo a base de remuneração do profissional.
  - Métricas de inatividade classificadas em 4 faixas canônicas (Ativo, Ausente, Crítico, Sem Visitas).

---

## 3. Catálogo Canônico de Mensagens de Negócio em pt-BR

| Código / Origem | Mensagem Técnica PostgREST / Banco | Mensagem Canônica em pt-BR (Amigável) |
|---|---|---|
| **23505** | `duplicate key value violates unique constraint` | *"Já existe um registro com estes mesmos dados no sistema."* |
| **23503** | `violates foreign key constraint` | *"Esta operação depende de um registro que não foi encontrado ou já foi removido."* |
| **23P01** | `exclusion_violation / overlap` | *"Este horário já está ocupado por outro atendimento para este profissional."* |
| **42501** | `insufficient_privilege / permission denied` | *"Você não possui permissão para executar esta operação. Contate o administrador."* |
| **P0001 (RPC)** | `insufficient_credits` | *"O cliente não possui créditos disponíveis para este serviço no plano contratado."* |
| **P0002 (RPC)** | `comanda_already_settled` | *"Esta comanda já foi finalizada ou liquidada e não admite novas alterações."* |
| **P0003 (RPC)** | `appointment_concurrency_lock` | *"O agendamento está sendo atualizado por outro operador. Tente novamente em instantes."* |
| **P0004 (RPC)** | `invalid_reversal_reason` | *"É obrigatório informar uma justificativa válida para estornar este lançamento."* |
| **42703** | `undefined_column` | *"Falha de sincronização de dados internos. Por favor, recarregue a página."* |
| **400 / 422** | `Bad Request / Unprocessable` | *"Dados da requisição inválidos ou incompletos. Verifique os campos informados."* |
| **401 / 403** | `Unauthorized / Forbidden` | *"Sessão expirada ou acesso não autorizado. Por favor, faça login novamente."* |
| **NETWORK** | `Failed to fetch / NetworkError` | *"Sem conexão com a internet ou servidor indisponível. Verifique sua rede."* |

---

## 4. Padrões de Validação e Formatação (Contratos Puros)

1. **Celular WhatsApp:**
   - 11 dígitos numéricos com DDD brasileiro (ex: `11999998888`).
   - Máscara de exibição: `(11) 99999-8888`.
   - Formato URL: `https://wa.me/5511999998888?text=...`.

2. **Valores Monetários BRL:**
   - Entrada e manipulação sempre em Reais com arredondamento estrito em 2 casas decimais.
   - Formatação visual: `R$ 50,00` (utilizando separador decimal `,` e milhar `.`).
   - Rejeição de valores negativos em preços de produtos e serviços.

3. **Duração na Grade de Horários:**
   - Minutos múltiplos de 5 (15m, 30m, 45m, 60m...).
   - Conversão segura entre minutos e horas decimais: `minutos = Math.round(horasDecimais * 60)`.
   - Buffer de higienização/preparação adicionado sem sobrescrever a duração nominal do serviço.
