# Frente: Financeiro & Comissões

- **Domínio:** Regime de Caixa, Fechamento de Caixa, Comandas/PDV, Comissões Teóricas (ADR-001), Outbox Financeiro (D8), Fiscal e Estoque
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PostgreSQL + RLS + Edge Functions) · Vitest
- **Referências obrigatórias:** `docs/adr/ADR-001-Commission-vs-Settlement.md`, `AGENTS.md` (regras financeiras e D8)

---

## Índice da Frente

| ID | Título | Prioridade | Status |
|---|---|---|---|
| `FIN-001` | **F-02:** Guard de sessão e circuit breaker no polling do outbox | `P0` | `REVIEW` |
| `FIN-002` | Corrigir virada de data `UTC` vs `BRT` (`toISOString().split('T')[0]`) em telas financeiras/BI | `P1` | `TODO` |
| `FIN-003` | Corrigir timeouts em `fiscalService.test.ts` e `stockRepository.test.ts` + definir escopo Fiscal | `P1` | `TODO` |
| `FIN-004` | Aplicar migration/Edge Function `import-export` (bucket `exports`) em Staging e registrar em `config.toml` | `P2` | `TODO` |

---

## `FIN-001` — F-02: Guard de sessão e circuit breaker no polling do outbox

- **Status:** `REVIEW`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix`
- **Dependências:** PR + merge em `main` + deploy

### Problema / Objetivo
O dispatcher de outbox emitia ~5 requisições a cada 5 s mesmo com sessão rejeitada (`401`/`PGRST301` ou `42501`), pois `hasActiveSession()` validava apenas presença da sessão.

### Escopo Técnico
- `domain/events/outbox/supabaseOutbox.ts` + `domain/events/outbox/supabaseOutbox.authGuard.test.ts` (commit `70c40cc` na branch `fix/f02-outbox-auth-guard`).
- Sem alteração em canônicos D8 (`npm run d8:verify` byte-identical).

### Critérios de Aceite
- [x] `isOutboxSessionUsable` bloqueia token expirado preservando compatibilidade com chaos tests.
- [x] Circuit breaker por token com backoff exponencial (30 s → 5 min) e reset em sucesso/troca de token.
- [x] `npm run typecheck`, `npm run test` (207 files / 2.894 passed), `npm run build`, `npm run architecture:ci` e `npm run d8:verify` verdes.
- [ ] PR aberto, mergeado em `main` e promovido em produção.

### Evidência de Validação
- **Branch / PR:** `fix/f02-outbox-auth-guard` (`70c40cc`) — registro em `docs/audit/F02_OUTBOX_AUTH_GUARD_20261123.md`
- **Testes / Build:** `typecheck` OK · `supabaseOutbox.authGuard.test.ts` 22/22 passed · `vitest` 207 files / 2.894 passed · `d8:verify` OK · `build` OK
- **Observações:** Aguardando abertura de PR e autorização de merge.

---

## `FIN-002` — Corrigir virada de data `UTC` vs `BRT` em telas financeiras e BI

- **Status:** `TODO`
- **Prioridade:** `P1`
- **Tipo:** `Bugfix`
- **Dependências:** Nenhuma

### Problema / Objetivo
A auditoria Go-To-Market identificou 16+ ocorrências de `new Date().toISOString().split('T')[0]` em telas financeiras, BI e comissões (`Commissions.tsx`, `BusinessIntelligence.tsx`, `DailySummary.tsx`, `Expenses.tsx`), causando virada prematura do dia após 21h no fuso de Brasília (`America/Sao_Paulo`).

### Escopo Técnico
- Substituir formatação UTC por helper canônico em fuso `America/Sao_Paulo` nos módulos financeiros, BI e resumo diário.

### Critérios de Aceite
- [ ] Zero ocorrências de `toISOString().split('T')[0]` para cálculo de data local de operação nos arquivos auditados.
- [ ] Testes unitários cobrindo fronteira de horário (ex.: 22:30 BRT = mesmo dia local).
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —

---

## `FIN-003` — Estabilizar testes de Fiscal/Estoque e definir escopo NFS-e

- **Status:** `TODO`
- **Prioridade:** `P1`
- **Tipo:** `Tech Debt`
- **Dependências:** Decisão do PO sobre emissão fiscal no lançamento GTM

### Problema / Objetivo
`pages/Fiscal.tsx:86-87` utiliza apenas `mockFiscalProvider.ts` (`mock_sandbox`), e a auditoria Go-To-Market registrou 8 timeouts em `domain/fiscal/fiscalService.test.ts` e `domain/stock/stockRepository.test.ts`.

### Escopo Técnico
- Investigar e corrigir a causa raiz dos timeouts nos testes unitários sem alterar asserções para forçar passagem.
- Alinhar com o PO se o módulo Fiscal fica oculto por feature flag até integração real.

### Critérios de Aceite
- [ ] `domain/fiscal/fiscalService.test.ts` e `domain/stock/stockRepository.test.ts` passando sem timeouts.
- [ ] Zero provider mock exposto como funcionalidade ativa em produção.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —

---

## `FIN-004` — Alinhar Staging e `config.toml` da Exportação Excel (`import-export`)

- **Status:** `TODO`
- **Prioridade:** `P2`
- **Tipo:** `Hardening`
- **Dependências:** Nenhuma

### Problema / Objetivo
Conforme retificação no item `7.78` do `PROJECT_STATUS.md`, o bucket `exports`, o job `purge-expired-exports` e a Edge Function `import-export` já estão ativos em Produção (`ushsnmlbeurfvlkieiln`), mas seguem pendentes em Staging (`tjcvuhynckocmvtqykxp`) e sem seção em `supabase/config.toml`.

### Escopo Técnico
- `supabase/config.toml` e aplicação controlada em Staging mediante validação.

### Critérios de Aceite
- [ ] Seção `[functions.import-export]` documentada em `supabase/config.toml`.
- [ ] Staging sincronizado com Produção (`20261113094500_storage_exports_bucket.sql` + `import-export`).

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —
