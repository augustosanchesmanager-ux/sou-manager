# F-02 — Guard de sessão e circuit breaker no polling do outbox

- **Data:** 2026-11-23
- **Frente:** F-02 (bugfix de infraestrutura de eventos)
- **Risco:** RED — pipeline de eventos financeiros (`outbox`) + arquivo canônico D8
- **Escopo autorizado:** `domain/events/outbox/supabaseOutbox.ts` + testes. Sem RLS, RPC, schema,
  migration ou regra de negócio.
- **Autorização:** PO (2026-11-23), plano de 5 itens (ver §4).

---

## 1. Sintoma

Loop de `401` contínuo no dispatcher de outbox: ~5 requisições a cada 5 s (≈60/min) contra a API
enquanto a sessão existia no cliente mas era **rejeitada** pelo servidor (JWT inválido ou policy
divergente). O F-01 cortou o loop no caminho do `AuthContext`; o polling do outbox permanecia
independente e sem proteção.

## 2. Evidências (EVIDENCE)

| # | Evidência | Origem |
|---|---|---|
| E-1 | O guard validava **presença**, não validade: `return Boolean(data?.session)` — sem `access_token`, sem `expires_at`, sem estado de falha. Usado por 10 métodos. | `domain/events/outbox/supabaseOutbox.ts:155-163` (antes) |
| E-2 | Cada ciclo de 5 s emite ~5 requisições: `recoverStaleProcessing` (1 select) + `dispatchAll`→`findNext` (1 select + 1 update) + `count` × 3 (HEAD). | `src/bootstrap/eventInfrastructure.ts:230` |
| E-3 | Não havia circuit breaker nem backoff: em erro cada método apenas logava e devolvia `null`/`0`/`[]`; o tick seguinte repetia. | `supabaseOutbox.ts:218-221, 403-405, 486-497` (antes) |
| E-4 | O F-01 mitiga apenas o caminho da RPC de auth. Se o token é válido e `outbox_items` falha por drift de policy (`42501`/`403`), o loop persistia indefinidamente. | F-01 (`docs/audit/F01_AUTH_401_LOOP_20261122.md`) |
| E-5 | Editar `supabaseOutbox.ts` **não** altera o artefato do worker D8: o core exportado é `shared/numbers/normalize.ts` + `domain/commission/{types,calculate,participants}.ts`; o worker usa RPCs e não importa este arquivo. | `scripts/d8/export-core.mjs:38-43`, `supabase/functions/worker-dispatcher/index.ts:31-34` |
| E-6 | Restrição de compatibilidade: o mock de chaos injeta sessão `{}` (sem `access_token`, sem `expires_at`). Um guard estrito quebraria os 9 cenários, e alterar teste para passar é proibido. | `domain/events/outbox/supabaseOutbox.chaos.test.ts:192-200` |
| E-7 | Erros de auth chegam como `code` do PostgREST: `PGRST301` (JWT inválido) e `42501` (permission denied). Confirmado nas sondas REST do F-01. | F-01 §2 E-5 |

## 3. Interpretação

O loop **não perde entrega**: os itens permanecem `pending`/`processing` no banco; o breaker apenas
pausa o polling. Repetir a query a cada 5 s não corrige token inválido nem policy divergente — só
amplifica o `401`. A correção de menor risco é parar o polling na origem, com retomada automática
quando a causa desaparecer (token novo ou janela de backoff vencida).

## 4. Correção aplicada

Arquivo: `domain/events/outbox/supabaseOutbox.ts` (+ `supabaseOutbox.authGuard.test.ts`).

1. **Validade aditiva no guard (`isOutboxSessionUsable`)** — mantém a presença de sessão como
   requisito mínimo e passa a bloquear quando `expires_at` é numérico e está dentro da folga de
   30 s (`OUTBOX_SESSION_EXPIRY_SKEW_SECONDS`). Sessão sem `expires_at` continua permitida
   (compatibilidade com sessões legadas e com o mock de chaos).
2. **Circuit breaker por token** — `classifyOutboxAuthFailure` separa `401`/`PGRST301`
   (`unauthenticated`) de `403`/`42501` (`forbidden`); ambos abrem o circuito, com backoff
   exponencial 30 s → 5 min (`OUTBOX_AUTH_BREAKER_BASE_MS` / `OUTBOX_AUTH_BREAKER_MAX_MS`).
   Enquanto aberto, `hasActiveSession()` retorna `false` e nenhuma query é emitida.
3. **Reset explícito** — token diferente (login, refresh, troca de usuário) ou query
   bem-sucedida fecham o circuito e zeram o backoff.
4. **Instrumentação restrita aos caminhos do loop** — `findNext` (select + claim),
   `recoverStaleProcessing` (select + reset), `count` (com e sem status) e os terminais
   `markPublished` / `markFailed` (read, dead-letter, schedule retry) / `moveToDeadLetter`.
   Nenhuma mudança em claim, retry, dead-letter, idempotência ou cálculo de comissão.
5. **Testes novos** em `domain/events/outbox/supabaseOutbox.authGuard.test.ts` (22 casos):
   classificador puro, validade da sessão, bloqueio sem sessão/token expirado, compatibilidade com
   sessão sem `expires_at`, abertura do circuito em `401` e `42501`, não-abertura em erro não
   autenticado, backoff exponencial, teto de 5 min, reset por sucesso e por troca de token.
   **Nenhum teste existente foi alterado.**

## 5. Validação (EVIDENCE)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | OK |
| `npx vitest run domain/events/outbox/` | 11 files · 199 passed |
| `npx vitest run domain/events/outbox/supabaseOutbox.authGuard.test.ts` | 22/22 passed |
| `npx vitest run tests/d8/equivalence.test.ts` | 7/7 passed |
| `npm run test` | 207 files · 2894 passed · 5 skipped |
| `npm run build` | OK (20.35 s) |
| `npm run architecture:ci` | 0 violações, baseline 0/0/0 |
| `npm run d8:verify` | OK — Core canônico == artefato do worker (byte-identical) |
| `git diff --check` | limpo |

**Comportamento esperado no ciclo de 5 s (derivado dos testes):**

| Estado | Requisições por ciclo |
|---|---|
| Sem sessão | 0 |
| Token expirado (dentro da folga) | 0 |
| Sessão válida | 5 (inalterado) |
| `401`/`403` na 1ª query | 1 (abre o circuito), depois 0 por 30 s → 60 s → … → 5 min |
| Token renovado (refresh/login) | circuito fecha e o ciclo volta a rodar |

## 6. GAP

1. A validação do breaker é unitária (fake timers + cliente mockado). Não houve nova reprodução ao
   vivo porque a sessão atual não tem ferramenta de browser disponível; o loop original foi
   reproduzido no F-01 e a causa é a mesma.
2. O guard cobre apenas os caminhos do loop aprovados. `enqueue`, `find`, `findById` e
   `findByEventId` mantêm o comportamento anterior (não abrem o circuito).
3. O breaker é por instância de `SupabaseOutbox`. Como o bootstrap usa singleton por sessão de
   página, o efeito é equivalente a um breaker global do polling; um novo mount rearma.
4. `F-03` (drift de schema exposto), `F-04` (dry-run do workflow de deploy prendendo a fila serial)
   e `E-7` (`refreshAccessContext` sem memoização) permanecem abertos.

## 7. Decisão

Correção aplicada e validada localmente. Commit/push/merge dependem do gate de autorização do PO.
Deploy de produção permanece fora desta frente (`MERGE ≠ DEPLOY`, ADR-026).
