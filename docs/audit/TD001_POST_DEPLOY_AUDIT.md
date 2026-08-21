# TD-001 — Pós-Deploy Audit (B1+B2)

> **Gate:** Pós-deploy production
> **Data:** 2026-08-20
> **Commit:** `fb5403a` (feat(events): add outbox infrastructure with dispatch loop)
> **Deploy:** `barber.soumanager.com`
> **Responsável:** OpenCode (Tech Lead operacional)

---

## 1. Deploy Status

| Item | Status |
|------|--------|
| Commit em `main` | `fb5403a` ✅ |
| Push para `origin/main` | ✅ |
| Vercel auto-deploy triggered | ✅ |
| Build no Vercel | `success` (12s, Washington D.C.) |
| Deploy status | `Ready` ✅ |
| Branch | `main` |

---

## 2. Build & Testes (local)

| Check | Resultado |
|-------|-----------|
| `npm test` | 994/994 passed ✅ |
| `npm run build` | 12.76s ✅ |
| `npx tsc --noEmit` | 126 errors (pre-existing, **0 em código B1/B2**) ✅ |

**Detalhe TS errors:**
- `domain/events/outbox/outbox.test.ts` — erros de tipo em testes (B3 futuros)
- `domain/events/outbox/providers/financeProvider.test.ts` — erros de tipo em testes (B3 futuros)
- `domain/events/outbox/providers/persistentIdempotencyStore.test.ts` — imports errados (B3 futuros)
- `domain/events/chaos.test.ts` — erros de tipo em testes
- `tests/e2e/`, `tests/factories/`, `src/lib/` — erros pre-existentes não-B1/B2

**Nenhum erro TS em código de produção B1/B2** (`eventInfrastructure.ts`, `useEventInfrastructure.ts`, `memory-bus.ts`, `inMemoryOutbox.ts`, `inMemoryDispatcher.ts`, `app-bus.ts`).

---

## 3. Produção — Site

| Check | Resultado |
|-------|-----------|
| HTML carrega | ✅ (`barber.soumanager.com`) |
| Title correto | ✅ (`SMG | Sou.Manager | Barber`) |
| Assets carregam | ✅ |
| JS bundle principal | `index-5TJKr2Pu.js` (220 KB) ✅ |

---

## 4. Produção — B1/B2 no bundle

| Componente | No bundle? |
|------------|-----------|
| `createEventBus` / `InMemoryEventBus` | ✅ |
| `SubscriberRegistry` | ✅ |
| `InMemoryOutbox` / `InMemoryDispatcher` | ✅ |
| `CheckoutCompleted` (evento) | ✅ |
| `resolveMembershipContext` (Checkout chunk) | ✅ (lazy-loaded) |

---

## 5. Produção — Chunks

| Chunk | Status |
|-------|--------|
| `Layout-DPC96stV.js` | 200 ✅ |
| `Sidebar-D9992Uon.js` | 200 ✅ |
| `Admin-9mmNgOlz.js` | 200 ✅ |
| `Checkout-8EglItuN.js` | 200 ✅ |
| `CashClosingPage-m0q5HjK4.js` | 200 ✅ |
| `Schedule-DjDv4Fu8.js` | 200 ✅ |

---

## 6. Validação funcional (produção) — PO

> Executada pelo PO em 2026-08-20 via console do browser.

| # | Item | Status | Observação |
|---|------|--------|-----------|
| 1 | Comanda fechou corretamente | ✅ PASS | Status `paid`, valor correto |
| 2 | Valor correto | ✅ PASS | `total: 45` |
| 3 | `CheckoutCompleted` publicado | ✅ PASS | Evento registrado no console |
| 4 | AuditSubscriber executou | ✅ PASS | `AUDIT — Domain event` |
| 5 | AnalyticsSubscriber executou | ✅ PASS | Métricas registradas |
| 6 | NotificationSubscriber executou | ✅ PASS | `NOTIFICATION — Checkout confirmation` |
| 7 | Proteção de concorrência | ✅ Funcionou | `CONCURRENCY` detectou comanda já `paid`, abortou sync duplicado |
| 8 | Operações financeiras novas | ✅ Nenhuma | B1/B2 sem handlers financeiros |

### Observações (não bloqueantes)

| # | Log | Classificação | Ação |
|---|-----|---------------|------|
| O1 | `CONCURRENCY` + `Save error` | 🟡 Corrida interna benigna | Backlog: investigar se `syncComanda` pode evitar tentativa após `paid` |
| O2 | `Invalid Refresh Token` | 🟡 Sessão/token antigo | Backlog: investigar se afeta usuários reais |
| O3 | HTTP 406 | 🟡 Endpoint desconhecido | Backlog: identificar origem |

### Classificação final

> **PASS COM OBSERVAÇÕES.** Deploy funcionalmente aprovado. 3 observações técnicas registradas para backlog.

---

## 7. Garantias B1+B2

| Garantia | Verificação |
|----------|-------------|
| Sem `FinanceSubscriber` no bundle | ✅ (confirmado) |
| Sem `FinanceProvider` executando | ✅ (confirmado) |
| Sem `FinanceStrategy` | ✅ (confirmado) |
| Sem operações financeiras novas | ✅ (nenhum handler registrado) |
| ConsoleProvider é único dispatcher | ✅ (apenas log no console) |
| Read-only subscribers: Analytics, Audit, Notification, Reminder, Marketing, BI | ✅ |
| Singleton guard no `eventInfrastructure` | ✅ |
| Lifecycle: initialize/get/dispose | ✅ |

---

## 8. Conclusão técnica

**TD-001 B1+B2 — ENTREGUE EM PRODUÇÃO ✅**

- Deploy automático via Vercel executado com sucesso
- Bundle contém código do event infrastructure
- 994 testes passando
- Nenhum erro TS novo em código de produção
- Site carrega normalmente
- Garantias de segurança (sem finance handlers) confirmadas
- **Validação funcional do PO: PASS COM OBSERVAÇÕES**
  - Checkout fecha corretamente
  - Eventos read-only disparam (Audit, Analytics, Notification)
  - Proteção de concorrência funciona
  - 3 observações técnicas para backlog (não bloqueantes)

---

## 9. Próximos passos

1. ~~PO executa validação funcional~~ → **EXECUTADA, PASS COM OBSERVAÇÕES**
2. ~~TD-001 B1+B2 considerado ENTREGUE~~ → **ENTREGUE ✅**
3. Backlog: 3 observações técnicas (O1-O3)
4. Abrir gate do **B3 — Finance Wiring** (requer seu próprio audit)
5. B4 — EventStore/Replay (deferred)
