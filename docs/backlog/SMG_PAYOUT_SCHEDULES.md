# SMG-PAYOUT-SCHEDULES — Backlog de Produto

> **Status:** CATALOGADO — **não implementado**.
> **Decisão de Governança (PO):** registro em `docs/backlog/`, sem impacto em `ROADMAP.md` (congelado desde 2026-07-24) e sem ocupação de `docs/audit/` (reservada a evidências e fechamentos de incidentes).
> **Origem:** Faixa levantada durante a Fase C do fechamento de caixa (adequação visual da apuração diária e do comprovante em PDF).

---

## 1. Motivação

O fechamento de caixa passou a apurar **produção bruta, base liquidada e fiado retido** separadamente (Fases A/B/C). A operação passou a exibir que **valores a prazo não geram repasse imediato** e que a **comissão retida só é liberada na liquidação**.

Isso expôs uma lacuna de produto: **o ciclo de repasse é assumido, não configurável**. Hoje o profissional tem um valor apurado, mas não há onde registrar *quando* esse valor deve ser efetivamente pago, nem onde controlar **vales e adiantamentos** que o profissional possa ter recebido antes do repasse.

---

## 2. Escopo da frente futura

### 2.1 Periodicidade de pagamento por profissional

Configuração no perfil do profissional com as opções previstas no rodapé do comprovante em PDF:

| Opção | Descrição |
|---|---|
| Diário | repasse apurado no mesmo dia |
| Semanal | apuração consolidada por semana |
| Quinzenal | apuração consolidada a cada 15 dias |
| Mensal | apuração consolidada por mês |

**Requisito de rastreabilidade:** o PDF da Fase C já declara o ciclo vigente no rodapé. Este módulo deve ser a **fonte única** desse texto — o comprovante deve ler o ciclo do cadastro, não uma constante.

### 2.2 Controle de vales e adiantamentos

- Registro de vale/adiantamento concedido ao profissional, com data e valor.
- Desconto automático do valor apurado no próximo repasse.
- Visibilidade do saldo devedor do profissional.
- Registro de quitação (baixa) quando o repasse é efetivado.

---

## 3. Fora de escopo

- Não altera a segregação do **ADR-001** (comissão teórica em `domain/commission/` vs. rateio efetivo em `application/cashClosing/`).
- Não altera a fórmula de apuração entregue nas Fases A/B/C.
- Não altera a fronteira **fail-closed** de `comanda_payments` (PR #119).
- Não mexe em `ROADMAP.md`.

---

## 4. Dependências e pré-requisitos para implementação

1. **Decisão de negócio do PO** sobre a periodicidade padrão para profissionais novos e sobre a regra de retrocesso quando a periodicidade muda com valores já apurados.
2. **Diagnóstico de dados de `comanda_payments` em produção** — pendente de execução pelo PO no SQL Editor. Define se a base liquidada já é populada em PROD ou se ainda opera no fallback legado.
3. **Modelagem de onde o saldo devedor vive** (novo domínio vs. extensão de `domain/cashClosing/`). Exige **ADR** antes de implementar, conforme a regra de mudança estrutural do projeto.

---

## 5. Registro de decisões

| Data | Decisor | Decisão |
|---|---|---|
| 2026-10-02 | PO (Augusto) | Catalogar em `docs/backlog/SMG_PAYOUT_SCHEDULES.md`; não implementar na Fase C; `ROADMAP.md` permanece congelado. |