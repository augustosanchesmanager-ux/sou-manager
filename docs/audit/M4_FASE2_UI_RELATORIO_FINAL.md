# M4 — FASE 2 · Relatório Final de Implementação (UI P4/P5/P7)

> **Fase:** M4 — Implementação pós-G1.3 · **Subfase:** FASE 2 (Frontend UI)
> **Status:** ✅ CONCLUÍDA (código/testes/validações) — aguardando revisão do PO
> **Data:** 31/08/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Base normativa:** ADR-016..020 · G1.1/G1.2 (29/08/2026) · M4_FASE2_MAPA_ESTADO_ATUAL.md · **M4_RELATORIO_FINAL.md** (30/08/2026 — backend/banco, frontend P4/P5/P7 marcado PARCIAL)
> **Regra da etapa:** Implementação → Testes → Build → Typecheck → Auditoria → Documentação. Nenhuma migration aplicada em produção (aguarda PO explicitamente). **Sem commit/push/deploy nesta subfase (parada para revisão do PO).**

---

## 1. Objetivo

Fechar as pendências de UI declaradas no §8 do `M4_RELATORIO_FINAL.md` (itens 2, 3 e 4), implementando exclusivamente a camada de frontend que consome as RPCs e client libs já certificadas na FASE 1:

- **P4 — Correção retroativa de `attended_at`** com motivo obrigatório, restrita à gestão (`correct_appointment_attendance`);
- **P5 — Confirmação de atendimento** (`confirm_appointment_attendance`) substituindo o caminho legado `changeStatus('completed')` que não preenchia `attended_at`;
- **P7 — Registro de pagamento parcial/antecipado** (`register_comanda_payment`) + resumo financeiro (`get_comanda_payment_summary`) no painel lateral da comanda, com idempotência estável por operação.

**Nenhuma regra de negócio foi reimplementada no frontend** — o frontend apenas chama as RPCs SECURITY DEFINER já validadas (mandato: "Não reimplemente regras de negócio que já pertencem às RPCs").

## 2. Escopo

| Escopo | Conteúdo |
|---|---|
| **Frontend (2 arquivos)** | `pages/Schedule.tsx` (P4/P5) e `components/ComandaSidebar.tsx` (P7) — 497 inserções / 7 remoções |
| **Banco** | Nenhuma migration nova nesta subfase; RPCs usadas: `confirm_appointment_attendance`, `correct_appointment_attendance`, `register_comanda_payment`, `get_comanda_payment_summary` |
| **Testes** | Nenhum teste novo nesta subfase (wrappers já testados na FASE 1); suítes de regressão re-executadas |
| **Fora do escopo** | Aplicação das migrations em produção (PO); `eventInfrastructure.test.ts` (falha pré-existente, provada); 8 erros tsc pré-existentes em `Comandas.tsx`; emulação de RPCs M4 no demo mode; commit/push/deploy |

## 3. Critérios de Entrada

- [x] RPCs P4/P5/P7 e client libs (`src/lib/finance/attendance.ts`, `payment.ts`) implementadas e testadas na FASE 1 (54 testes PASS)
- [x] `M4_RELATORIO_FINAL.md` declara pendências de UI nos itens 2/3/4 do §8
- [x] Baseline de validação anterior: build OK, tsc sem erros novos, testes 1203 PASS / 1 FAIL pré-existente
- [x] Restrições ativas do mandato: não corrigir os 11 erros tsc pré-existentes; não usar `any`/`@ts-ignore`; não gerar nova chave de idempotência em retry da MESMA operação; não expandir escopo; parar e entregar relatório

## 4. Critérios de Saída

- [x] **P5**: `executeAppointmentStatusChange` roteia `nextStatus === 'completed'` para `confirmAppointmentAttendance` (gate barbeiro-próprio/recepção/gestão é da RPC), atualiza `status` + `attendedAt` + `attendedAtSource: null` no estado local e exibe toast com `result.message`; `changeStatus` fica restrito a `confirmed`/`in_progress`
- [x] **P4**: botão "Corrigir Atendimento" visível apenas para gestão (`manager`/`superadmin`) em atendimentos `completed`; motivo obrigatório (validação client-side antes da RPC); usa `toLocalDatetimeInput` para preencher o input `datetime-local` com o `attended_at` atual; modal exibe "Atendido em" atual; sucesso atualiza estado local com `attendedAtSource: 'management_correction'`
- [x] **P7 summary**: seção "Pagamentos" no `ComandaSidebar` com Total/Pago/Saldo + lista de pagamentos (`getComandaPaymentSummary`); carregada via `useEffect` em `comanda`/`tenantId`
- [x] **P7 registro**: modal "Registrar pagamento" com tipo `parcial`/`anticipado`, valor > 0, forma de pagamento, motivo opcional; botão visível apenas para `receptionist`/`manager`/`superadmin` e comanda `open`/`blocked`; **idempotency key gerada no 1º submit e reutilizada em retries da MESMA operação** (`paymentIdempotencyKeyRef`, resetada apenas após sucesso/fechamento); duplo submit bloqueado via `paymentBusy`; resumo re-carregado após sucesso
- [x] Validações: `npm run build` OK · tsc sem erros novos nos arquivos tocados · testes finance 54/54 · `git diff --check` OK

## 5. Dependências

| Dependência | Status |
|---|---|
| Migrations M4 P4/P5/P7 (`20260830010000`, `20260830030000`) | ✔ existentes (aplicação em produção ⛔ depende do PO) |
| Client libs `src/lib/finance/attendance.ts` (`confirmAppointmentAttendance`, `correctAppointmentAttendance`) | ✔ FASE 1 |
| Client lib `src/lib/finance/payment.ts` (`registerComandaPayment`, `getComandaPaymentSummary`) | ✔ FASE 1 |
| `generateIdempotencyKey` (`src/utils/idempotency.ts`) | ✔ pré-existente |
| `Modal`/`Button` (`components/ui/`) | ✔ pré-existentes |
| Demo mode (`isLocalDemoEnabled`) | ⛔ não emulado para M4 — RPCs falham no localhost sem Supabase |

## 6. Arquivos Alterados

### `pages/Schedule.tsx` (+238 linhas)

| Âncora | Mudança |
|---|---|
| linha 36 | import `confirmAppointmentAttendance`, `correctAppointmentAttendance` |
| ~linha 79 | `CalendarAppointment` estendido com `attendedAt?`/`attendedAtSource?`; map da API preenche ambos |
| linha 211 | helper módulo `toLocalDatetimeInput(iso)` (ISO → `YYYY-MM-DDTHH:mm` para `datetime-local`) |
| linha 368 | `isManagementRole` (manager/superadmin) + estado P4 (`correctionAppointment`, `correctionDatetime`, `correctionMotivo`, `correctionBusy`, `correctionError`) |
| linha 1122 | `openCorrectionModal`-equivalente: preenche `correctionDatetime` a partir de `attendedAt` (fallback `startTime`) |
| linhas 1127-1166 | `submitAttendanceCorrection`: motivo obrigatório → `new Date(correctionDatetime)` válido → `correctAppointmentAttendance({ newAttendedAt: toISOString, motivo })` → atualiza estado local (`attendedAtSource: 'management_correction'`) + toast; erro exibido no modal |
| linhas 1907-1941 | `executeAppointmentStatusChange`: branch `completed` → `confirmAppointmentAttendance` (comentário justifica desvio da migration M4); `changeStatus` apenas p/ `confirmed`/`in_progress` |
| linhas 3458-3465 | botão "Corrigir Atendimento" (gestão + `completed`) no drawer de detalhes |
| linha 3497 | exibição "Atendido em <pt-BR>" no bloco "Status do Atendimento" |
| linhas 3522-3555 | Modal de correção (título, input `datetime-local`, motivo, erro, "Atendido em" atual, footer Voltar/Confirmar) |

### `components/ComandaSidebar.tsx` (+266 / −7 vs HEAD; 664 linhas no total final)

| Âncora | Mudança |
|---|---|
| linhas 1-11 | imports: `useEffect/useRef/useState`, `Modal`, `getComandaPaymentSummary`/`registerComandaPayment`, tipos `ComandaPaymentSummary`/`ComandaPaymentType`, `supabase`, `generateIdempotencyKey` |
| linhas 136-148 | `PAYMENT_TYPE_LABELS` (anticipado/parcial/total) e `PAYMENT_METHOD_LABELS` (credit/debit/pix/cash/other) |
| linhas 165-175 | estado P7 (`paymentSummary`, `showPaymentModal`, `paymentBusy`, `paymentError`, `paymentType='parcial'`, `paymentAmount`, `paymentMethod='credit'`, `paymentMotivo`) + `paymentIdempotencyKeyRef` (comentário de regra de idempotência financeira) |
| linhas 177-193 | `useEffect`: carrega resumo ao mudar `comanda`/`tenantId`; falha → `setPaymentSummary(null)` + `console.error` (demo mode: seção ocultada silenciosamente, nunca dados falsos) |
| linhas 220-225 | `canRegisterPayment`: `tenantId` + papel `receptionist`/`manager`/`superadmin` + status `open`/`blocked` (espelha gate da RPC) |
| linhas 227-242 | `openPaymentModal` (reset campos + chave) / `closePaymentModal` (bloqueada quando `paymentBusy`; reset chave) |
| linhas 244-282 | `submitPayment`: valida valor > 0 → gera chave **só no 1º submit** → `registerComandaPayment` → sucesso: fecha modal, reseta chave, re-busca resumo; erro: mensagem exibida no modal; `finally` libera `paymentBusy` |
| seção Pagamentos | card entre histórico financeiro e cartão Total: Total/Pago/Saldo (grid 3 colunas) + lista de pagamentos + botão "Registrar pagamento" |
| Modal final | `Modal` (maxWidth md, footer Voltar/Confirmar) com tipo (parcial/anticipado), valor, forma, motivo opcional e erro |

## 7. Testes

| Suíte | Resultado |
|---|---|
| `npx vitest run src/lib/finance/` | **54/54 PASS** (6 arquivos — wrappers P4/P5/P6/P7/P8, FASE 1) |
| Suíte completa `npx vitest run` | **1203 PASS / 1 FAIL** — `src/bootstrap/eventInfrastructure.test.ts` **pré-existente e fora do escopo**: última modificação no commit `83e867e` (2026-08-23, Fase 4 TD-001 B3.4-G); `git diff` não mostra mudanças em `bootstrap/`/`domain/events/`; nenhum arquivo tocado pela FASE 2 está no grafo de imports dessa suíte; falha estável (não-flaky) reproduzida isoladamente |
| `npm run build` | ✔ built in 11.56s (Vite, todos os chunks gerados, incl. Schedule e Comandas) |
| `npx tsc --noEmit --pretty false` | **ZERO erros novos** nos arquivos tocados (`Schedule.tsx`, `ComandaSidebar.tsx`, `src/lib/finance/*`); erros remanescentes são baseline pré-existente (8 em `pages/Comandas.tsx` em linhas não editadas 218/447/466/476/486/518/531, fora das áreas alteradas pela P6, + test files de domain/events) |
| `git diff --check` | ✔ OK (sem whitespace errors) |

## 8. Riscos e Pendências

| # | Item | Status | Ação |
|---|---|---|---|
| 1 | **Aplicação das migrations M4 em produção** | 🔴 BLOQUEADO (PO) | Exige aprovação explícita do PO; `npm run d8:verify` antes de qualquer deploy |
| 2 | **Demo mode (localhost sem Supabase)** | 🟡 degradação conhecida | RPCs M4 não emuladas → confirmação/correção exibem toast de erro da RPC (transparente); seção de pagamentos P7 é ocultada quando o resumo falha (nunca dados falsos) |
| 3 | `eventInfrastructure.test.ts` (1 falha) | 🟡 pré-existente | Não corrigir (baseline conhecida, provada fora do grafo de imports da FASE 2) |
| 4 | 8 erros tsc em `Comandas.tsx` | 🟡 baseline | Não corrigir (fora do escopo; linhas não editadas pela M4) |
| 5 | **E2E / validação visual da nova UI** | 🟡 pendente | Suites E2E e smoke para P4/P5/P7 recomendadas antes da baseline (próxima etapa) |
| 6 | **Commit/push/tag** | ⏸ não executado | Parada deliberada para revisão do PO (política oficial: merge só no encerramento da fase completa) |

## 9. Responsável

- **OpenCode (Tech Lead):** implementação da UI P4/P5/P7, validações (build/typecheck/testes/diff), documentação técnica.
- **Augusto (PO):** revisão desta subfase, aprovação da aplicação das migrations em produção, decisão de merge/deploy.

## 10. Próxima Etapa

1. **Apresentar ao PO** este relatório + demonstração das 3 telas (confirmação P5, correção P4, registro de pagamento P7).
2. **PO aprovar** a aplicação das migrations M4 em produção (gate nunca automático).
3. Opcional (recomendado): suites **E2E/smoke** para os fluxos P4/P5/P7 e validação visual com `npm run dev`.
4. Após aprovação: `npm run d8:verify` + suíte completa + `git diff --check` como gate pré-baseline.
5. Baseline/tag somente via commit semântico + push da branch + push da tag (política oficial da PO de 2026-08-06).

## 11. Conformidade com o Fluxo Operacional & Ponto de Parada

| Etapa do fluxo | Status |
|---|---|
| Implementação (Schedule.tsx, ComandaSidebar.tsx) | ✅ |
| Testes unitários (finance 54/54; suíte 1203/1204 com 1 pré-existente) | ✅ |
| Build (`vite build`) | ✅ 11.56s |
| Typecheck (zero erros novos nos arquivos tocados) | ✅ |
| Auditoria (gate de comentários atendido: 1 removido por desnecessário, 2 justificados como necessários — desvio M4 e regra de idempotência) | ✅ |
| Documentação (este relatório + pendências atualizadas) | ✅ |
| Commit semântico / push / tag | ⏸ **NÃO EXECUTADO** — STOP conforme mandato |

**PONTO DE PARADA:** a FASE 2 (UI P4/P5/P7) está implementada e validada localmente. Nenhum commit, push, tag, merge ou deploy foi executado. O relatório fica à disposição do PO para revisão antes de qualquer movimento de versionamento.