# H-7 — PREPARAÇÃO DA JANELA ACOMPANHADA (GATE B.1)

> **Status:** 🟡 AGUARDANDO AGENDA DO PO — **retomada da janela pausada desde 2026-09-02** (não é primeira execução)
> **Criado:** 2026-09-22 (GATE B.1 — resolução read-only dos bloqueiros da v1.5) · **fixup:** 2026-09-22 (S3-1 = FECHADO; status H-7 corrigido)
> **Natureza:** documental — nenhuma execução, escrita em banco ou alteração de produção.
> **Referências:** `HOMOLOGATION_PLAN_SANCHEZ_BARBER.md` (gates H-1..H-8) · `H7_OPERACAO_REAL_ROTEIRO.md` (roteiro D-HOM-27; **janela iniciou 09-02, em pausa controlada**) · `H7_BASELINE_READONLY.md` (**baseline oficial = snapshot 09-02 08:24**) · `H7_1_INVESTIGACAO_S3_READONLY_20260816.md` (**S3-1 FECHADO**, §8 S3-4) · `BUSINESS_DECISIONS.md` **D-HOM-27b** (decisões 2026-09-02)

---

## 1. Objetivo

**Retomar** a janela H-7 acompanhada (iniciada 2026-09-02, em pausa controlada) e concluir o **ciclo H7-1** — agendamento → atendimento → comanda → pagamento → comissão → fechamentos → conferência — com evidências, para concluir o gate **H-7** da homologação da v1.5. Inclui a **reabertura de reversões comissionáveis** sob observação (D-HOM-27b, Decisão C) e a **reconciliação pós-operação**.

## 1.1 Decisões do PO já vigentes (D-HOM-27b, 2026-09-02) — não decidir de novo

1. **`6bd5cbe4` (Penteado R$15): PRESERVAR** — sem correção manual/reconciliação no banco; manter como histórico de teste conhecido; reconciliação futura exige decisão específica.
2. **Reversões comissionáveis: JANELA CONTROLADA** — reabertura somente em operação real acompanhada, com observação de comissão + reconciliação pós-operação; qualquer anomalia interrompe a janela e gera novo finding (sem workaround em produção).
3. **H2-8: CLOSED** — não reabrir (fix `523192a` + proof canônico em staging).

## 2. Pré-condições (devem estar CONFIRMADAS antes de agendar)

| # | Pré-condição | Estado |
|---|---|---|
| 1 | Janela de **retomada** (data, horário, duração) definida pelo PO | ⏳ **PO** |
| 2 | Equipe ciente (Rubens/equipe conforme roteiro) — janela acompanhada, sem execução espontânea | ⏳ **PO** |
| 3 | Baseline read-only **recontado no início da retomada** (baseline oficial = snapshot **09-02 08:24**; operação vive desde então) | ⏳ executar na retomada |
| 4 | **S3-1 = FECHADO** (cancelado 2026-08-16, S3-4; decisão PO 09-02: não reabrir, não modificar `d561a4c3`) — se aparecer na conferência, é histórico `cancelled`, não nova divergência | ✅ fechado — **não tocar** |
| 5 | H-8 esclarecido o suficiente (decisão PO sobre CD automático/legado) — pré-requisito do próprio PO antes de homologar | ⏳ **PO** (ver auditoria B.1) |
| 6 | Homologação account (`homolog.sanchez@…`) disponível; login validado (D-HOM-12) | ✅ histórico |
| 7 | Ambiente/entry point definido pelo PO (produção serve `7b69cf4` via CD automático) | ⏳ **PO** (depende H-8) |
| 8 | Este documento revisado/aprovado como roteiro de evidências complementar ao `H7_OPERACAO_REAL_ROTEIRO.md` | ⏳ **PO** |

## 3. Escopo

- **Retomada do ciclo H7-1** (iniciado em 02/09, pausado) — concluir agendamento → atendimento → comanda → pagamento → comissão → fechamento → conferência.
- **Reabertura de reversões comissionáveis** sob observação direta (D-HOM-27b Decisão C) + reconciliação pós-operação.
- Dados reais do tenant Sanchez Barber; registros da homologação **identificáveis**; **sem manipular dados existentes**; **`6bd5cbe4` preservado** (D-HOM-27b).
- Saldos contagens **antes e depois** (clients, services, appointments, comandas, transactions, credits, receivables, cash_closings — espelhar baseline oficial 09-02).

## 4. Critérios de evidência (capturar durante a janela)

1. Prints/registros de cada etapa do ciclo (agendamento, check-in/atendimento, comanda, pagamento, comissão gerada, fechamento).
2. Contagens antes/depois de cada tabela afetada (baseline do item 3 das pré-condições).
3. Valores financeiros esperados × observados (comanda, comissão, caixa).
4. Confirmação de que nenhum dado pré-existente foi alterado.
5. Console/erros HTTP durante o percurso (0 erros esperados).

## 5. Critérios de PARADA imediata (verbatim do gate)

> Qualquer **divergência financeira · duplicidade · perda de crédito · comissão incorreta · queixa de fechamento** → **PARAR imediatamente, sem corrigir no banco.**

- **S3-1:** o registro `d561a4c3` deve aparecer como `cancelled` — é histórico reconciliado (S3-4/2026-08-16); **não é nova divergência; não modificar**.
- **`6bd5cbe4`:** preservado por decisão PO (D-HOM-27b) — não reconciliar manualmente durante a janela.
- M7 (`20260813120500`) permanece bloqueada (dívida P3) — fora do escopo.

## 6. Fora do escopo (proibido nesta janela)

Reabrir/modificar S3-1 (`d561a4c3`) · reconciliar `6bd5cbe4` · qualquer migration/DDL/DML não prevista · toque em produção fora do ciclo · correção espontânea de banco · merge/tag/deploy · alteração de RLS/RPC · reabertura de frentes fechadas · dependabot.

## 7. Pós-janela (STOP obrigatório)

1. Relatório H-7 com evidências item a item → `docs/audit/H7_*`.
2. Veredito H-7: 🟢 / 🟡 / 🔴 apresentado **ao PO** (nunca autodeclarado).
3. Novo STOP — só depois: fechamento de H-1/H-3/H-8 e demais pendências D-HOM.

---

**Responsável:** OpenCode (execução do roteiro) · Augusto PO (agenda, acompanhamento, veredito)
**Próxima ação:** 🟡 **PO define data/hora/equipe da RETOMADA + confirma H-8 (CD automático/legado)** → recontar baseline 09-02 → retomar janela.
