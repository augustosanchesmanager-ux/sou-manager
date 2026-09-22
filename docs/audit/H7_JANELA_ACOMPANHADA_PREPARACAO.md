# H-7 — PREPARAÇÃO DA JANELA ACOMPANHADA (GATE B.1)

> **Status:** 🟡 AGUARDANDO AGENDA DO PO
> **Criado:** 2026-09-22 (GATE B.1 — resolução read-only dos bloqueios da v1.5)
> **Natureza:** documental — nenhuma execução, escrita em banco ou alteração de produção.
> **Referências:** `HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (gates H-1..H-8) · `H7_OPERACAO_REAL_ROTEIRO.md` (roteiro D-HOM-27) · `H7_BASELINE_READONLY.md` (baseline 2026-08-16) · `H7_1_INVESTIGACAO_S3_READONLY_20260816.md` (achado S3-1)

---

## 1. Objetivo

Executar o **ciclo H7-1 completo acompanhado** no tenant real Sanchez Barber — agendamento → atendimento → comanda → pagamento → comissão → fechamentos → conferência — com evidências, para concluir o gate **H-7** da homologação da v1.5.

## 2. Pré-condições (devem estar CONFIRMADAS antes de agendar)

| # | Pré-condição | Estado |
|---|---|---|
| 1 | Janela de data/hora definida pelo PO (dia, horário, duração) | ⏳ **PO** |
| 2 | Equipe ciente (Rubens/equipe conforme roteiro) — janela acompanhada, sem execução espontânea | ⏳ **PO** |
| 3 | Baseline read-only atualizado (recontagem antes da janela — o baseline de 2026-08-16 pode estar desatualizado por P0.4/M4/segurança) | ⏳ executar no início da janela |
| 4 | S3-1 (duplicidade RIOS R$ 260) **registrado e NÃO corrigido** — referência para a conferência não confundir achado histórico com nova divergência | ✅ registrado; correção **proibida** neste gate |
| 5 | Homologação account (`homolog.sanchez@…`) disponível; login validado (D-HOM-12) | ✅ histórico |
| 6 | Preview/produção servindo build conferido pelo PO (H-8 pendente de decisão — definir em qual ambiente o ciclo roda) | ⏳ **PO** (depende do destino H-8) |
| 7 | Este documento revisado/aprovado como roteiro de evidências complementar ao `H7_OPERACAO_REAL_ROTEIRO.md` | ⏳ **PO** |

## 3. Escopo

- **Único ciclo H7-1** — 1 agendamento → 1 atendimento → 1 comanda → pagamento → comissão → fechamento → conferência.
- Dados reais do tenant Sanchez Barber; registros da homologação **identificáveis**; **sem manipular dados existentes**.
- Saldos contagens **antes e depois** (clients, services, appointments, comandas, transactions, credits, receivables, cash_closings — espelhar baseline).

## 4. Critérios de evidência (capturar durante a janela)

1. Prints/registros de cada etapa do ciclo (agendamento, check-in/atendimento, comanda, pagamento, comissão gerada, fechamento).
2. Contagens antes/depois de cada tabela afetada (baseline do item 3 das pré-condições).
3. Valores financeiros esperados × observados (comanda, comissão, caixa).
4. Confirmação de que nenhum dado pré-existente foi alterado.
5. Console/erros HTTP durante o percurso (0 erros esperados).

## 5. Critérios de PARADA imediata (verbatim do gate)

> Qualquer **divergência financeira · duplicidade · perda de crédito · comissão incorreta · queixa de fechamento** → **PARAR imediatamente, sem corrigir no banco.**

- **S3-1:** se a duplicidade R$ 260 aparecer na conferência, **não é nova** — referenciar `H7_1_INVESTIGACAO_S3_READONLY_20260816.md`; não corrigir; registrar ocorrência.
- M7 (`20260813120500`) permanece bloqueada (dívida P3) — fora do escopo.

## 6. Fora do escopo (proibido nesta janela)

Correção de S3-1 · qualquer migration/DDL/DML não prevista · toque em produção fora do ciclo · correção espontânea de banco · merge/tag/deploy · alteração de RLS/RPC · reabertura de frentes fechadas · dependabot.

## 7. Pós-janela (STOP obrigatório)

1. Relatório H-7 com evidências item a item → `docs/audit/H7_*`.
2. Veredito H-7: 🟢 / 🟡 / 🔴 apresentado **ao PO** (nunca autodeclarado).
3. Novo STOP — só depois: fechamento de H-1/H-3/H-8 e demais pendências D-HOM.

---

**Responsável:** OpenCode (execução do roteiro) · Augusto PO (agenda, acompanhamento, veredito)
**Próxima ação:** 🟡 **PO define data/hora/equipe e confirma o ambiente (H-8)** → executar pré-condições → janela.
