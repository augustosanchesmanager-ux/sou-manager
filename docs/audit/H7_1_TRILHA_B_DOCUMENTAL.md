# H-7.1 — Trilha B: Auditoria Documental da Fase 4 (Event Driven) — Gate B-3

> **Status:** ✅ **AUDITORIA DOCUMENTAL REGISTRADA (read-only)** — confirma divergência entre **certificação documental** e **comportamento real** da Fase 4 (Event Driven): infraestrutura implementada em código e testada, porém **não integrada/inicializada no runtime da aplicação de produção**.
> **Escopo:** somente documentação. **Nenhum código, banco, migration, Event Store, subscriber, dispatcher/outbox ou replay foi alterado ou inicializado.**
> **Referência:** `docs/audit/H7_1_AUDITORIA_TECNICA.md` (Trilha B §8, §9) · `docs/audit/H7_1_TRILHA_A_REPRODUCAO.md` (causa raiz do incidente original) · `ROADMAP.md` (Fase 4, linhas 432-706) · `PROJECT_STATUS.md` · `docs/ROADMAP.md` · `docs/PROJECT_MATURITY.md` · `docs/ARCHITECTURE_DECISIONS.md` (ADRs 1, 2, 13, 14) · `AGENTS.md`
> **Data da auditoria:** 2026-08-16 · **Responsável:** OpenCode · **PO:** Augusto
> **Método:** leitura documental + evidências de banco **read-only** previamente coletadas (`event_store` = 0 rows, `processed_operations` = 0 rows) + inspeção de código (`git grep` — zero chamadas de inicialização em runtime). **Nenhuma escrita, DDL, DML ou mutação remota.**

---

# Relatório Formal de Auditoria — Trilha B (Gate B-3)

**Projeto:** SMG — Sou.Manager
**Produto:** SMG Barber
**Banco auditado:** `ushsnmlbeurfvlkieiln`
**Trilha:** B — Auditoria arquitetural (Event Driven / idempotência financeira)
**Gate:** B-3 — Registrar auditoria documental (read-only)
**Natureza:** auditoria documental read-only
**Status operacional:** **SEM CORREÇÕES — nenhuma alteração aplicada**

---

## 1. Objetivo

Registrar formalmente, como artefato auditável, o resultado da **auditoria documental da Fase 4 (Event Driven)**, consolidando:

1. o escopo da auditoria;
2. os documentos examinados;
3. a matriz **Documentado × Realidade × Divergência**;
4. as divergências identificadas **D1–D7**;
5. a conclusão formal da auditoria;
6. a confirmação explícita de que **isso não é a causa raiz do incidente de Comissões**;
7. o impacto da descoberta;
8. a lacuna identificada na certificação 4.10;
9. a inconsistência documental `docs/ROADMAP.md` × `ROADMAP.md`;
10. a recomendação de **não alterar implementação neste gate**.

A auditoria foi realizada **sem alterações no banco, na aplicação ou na infraestrutura de eventos**.

---

## 2. Cadeia de evidências (contexto da Trilha B)

A Trilha B foi aberta a partir dos achados da auditoria técnica do H7-1 (`docs/audit/H7_1_AUDITORIA_TECNICA.md`, §8 e §9):

| Evidência | Resultado verificado |
|---|---|
| `event_store` (tenant Sanchez Barber) | **0 eventos persistidos** |
| `CheckoutCompleted` | **Não persistido** no Event Store de produção |
| `processed_operations` | **0 rows** (idempotência persistente nunca exercitada) |
| Idempotência financeira do H7-1 | **Segura** — sem duplicidade, sem perda financeira |
| `idempotency_key` divergente | **Comportamento esperado por design** (chave composta `finance-settle-${comandaId}-${idempotencyKey}` em `application/checkout.ts:568`; sufixo `comanda-${requestKey}` da página) |
| Causa raiz do incidente original | **Trilha A confirmada** — frontend de produção `718f6f9` consulta `tenants.active` → `42703` → `[TenantContext] Failed to resolve tenant context` → Comissões falham |

### Conclusões intermediárias já confirmadas (mantidas)

- **Trilha A:** causa raiz do incidente original confirmada (produção defasada + coluna `tenants.active` removida).
- **Trilha B:** idempotência financeira confirmada como segura.
- **Trilha B:** Event Driven existe em código/testes, mas **não operacionalizado no runtime**.

---

## 3. Documentos examinados

| # | Documento | Trecho relevante |
|---|---|---|
| 1 | `ROADMAP.md:432-706` | Fase 4 — Event Driven: "✅ Concluída e Certificada", "Arquitetura declarada ESTÁVEL", 631 testes + E2E, certificação 4.10 (12/12 checklist + 9/9 Marco de Aceite) |
| 2 | `ROADMAP.md:1199-1216` | Gate de release e janela única de deploy (contexto de produção) |
| 3 | `PROJECT_STATUS.md:84-110` | Fase 4 = 100% em todas as subfases 4.1-4.10; marco "Event Driven Certificado" ✅ |
| 4 | `PROJECT_STATUS.md:238-251` | Métricas: "Eventos de domínio 16, Subscribers 8" |
| 5 | `docs/ROADMAP.md` (linhas 1-232) | Status geral: "Fase 4 — Event Driven ✅ Concluída e Certificada"; seção própria "🔄 Em andamento" + 4.8/4.9 "(futuro)" |
| 6 | `docs/PROJECT_MATURITY.md` | Arquitetura 10.0/10; "Event Driven com Event Bus, Store, Subscribers, Outbox, Finance Provider" |
| 7 | `docs/ARCHITECTURE_DECISIONS.md:48-84, 278-312` | ADR-1 (Event Driven), ADR-2 (Outbox), ADR-13 (Domain Only Events), ADR-14 (Finance Provider) |
| 8 | `AGENTS.md` (seção Fase 4) | Descreve Event Bus, Event Store, Subscribers, Outbox, FinanceProvider, ReplayEngine como componentes existentes |

### Inspeção complementar (código)

| Verificação | Resultado |
|---|---|
| `git grep` por `appEventBus.subscribe` / `SubscriberRegistry` / `createOutbox` / `createDispatcher` / `createEventStore` (fora de testes e doc-comments) | **Zero chamadas de inicialização em runtime** — apenas definições em `domain/events/**` |
| Entry point (`index.tsx` → `App.tsx`) | **Sem inicialização de eventos** — única infraestrutura inicializada é Observability via `useObservability()` (`App.tsx:326`) |
| `CheckoutCompleted` | Publicado best-effort em `application/checkout.ts:696-725` → descartado (bus in-memory) |
| Tabelas de produção | `event_store` = 0 rows · `processed_operations` = 0 rows |

---

## 4. Matriz Documentado × Realidade × Divergência

| # | Item | Documentado | Realidade | Divergência |
|---|---|---|---|---|
| D1 | Status da Fase 4 | "Concluída e Certificada" / 100% | Implementada em código + testes, **não integrada ao runtime** | **Divergência material** — certificação 4.10 não incluiu runtime bootstrapping |
| D2 | "Pronta para produção" (objetivo da 4.10) | ✅ | `event_store` / `processed_operations` zerados em produção | **Divergência material** — não é possível estar "pronta para produção" sem inicialização |
| D3 | Eventos de domínio fluindo | 11 tipos publicados em 5 serviços (7 call sites) | Publicados apenas em memória; nunca persistidos no Store | **Divergência material** — persistência ausente |
| D4 | ADR-14 (Finance Provider) | "Base para operações financeiras assíncronas" | Sem executor em produção | **Divergência material** — decisão aprovada, não operacionalizada |
| D5 | `docs/ROADMAP.md:131-133` | Seção "🔄 Em andamento" + 4.8/4.9 "(futuro)" | ROADMAP raiz diz concluídas (4.8/4.9 ✅) | **Inconsistência interna entre docs** (duplicado desatualizado) |
| D6 | `PROJECT_STATUS.md` métricas | "Eventos de domínio 16, Subscribers 8" | 16/8 = **definições**, não runtime ativo | Divergência de semântica (contagem de código vs uso real) |
| D7 | Certificação "12/12 + Marco 9/9" | Checklist aprovado | Checklist não cobre bootstrap/runtime integration | Lacuna no **escopo da certificação** |

---

## 5. Conclusão formal

> **Fase 4 — Event Driven: implementada em código e testes, certificada como arquitetura estável, porém NÃO integrada/inicializada no runtime da aplicação de produção.**

A certificação 4.10 validou a infraestrutura de eventos isoladamente (unit tests), **não o seu acoplamento ao ciclo de vida da aplicação**. A única infraestrutura inicializada em runtime é a **Observability** (Fase 3.5, via `useObservability()` em `App.tsx:326`).

### Componentes da Fase 4 e seu estado real

| Componente | Estado real |
|---|---|
| Event Bus (`appEventBus` in-memory) | Existe; publish best-effort em `checkout.ts:696-725` → eventos descartados |
| Event Store (`event_store`) | **0 rows** em produção — nunca escrita |
| Subscribers (6 read-only + Commission + Finance) | Definidos; **zero registrados** no runtime |
| Outbox (`InMemoryOutbox`) | Definido; **nunca instanciado** fora de testes |
| Dispatcher | Definido; **nunca instanciado** fora de testes |
| FinanceProvider | Definido; **nunca registrado** |
| ReplayEngine | Definido; **nunca usado** |
| `processed_operations` | **0 rows** — idempotência persistente nunca exercitada |

---

## 6. Confirmação: NÃO é causa raiz do incidente de Comissões

> **Este achado NÃO é a causa raiz do incidente de Comissões.**

A causa raiz do incidente original foi confirmada na **Trilha A** (`docs/audit/H7_1_TRILHA_A_REPRODUCAO.md`): o frontend de produção `718f6f9` consulta a coluna `tenants.active`, removida pela migration `20260728000000` aplicada no remoto → `42703` → `[TenantContext] Failed to resolve tenant context` → a tela de Comissões falha.

A ausência de inicialização da Fase 4 é um **achado arquitetural independente**, registrado na Trilha B, e **não deve ser misturado** com a correção do incidente H7-1.

---

## 7. Impacto da descoberta

A Fase 4 **não operacionalizada** deixa sem efeito em produção os mecanismos que ela documenta:

- **Auditoria de eventos** — nenhum evento de domínio persistido (`event_store` vazio);
- **Replay / reconstrução de estado** — ReplayEngine nunca usado, sem eventos para reconstruir;
- **Subscribers** — nenhum subscriber ativo (Analytics, Audit, Notification, Reminder, Marketing, BI, Commission, Finance);
- **Outbox / Dispatcher** — nenhuma fila com retry/dead-letter operando;
- **FinanceProvider** — operações financeiras via Outbox (`create_transaction`, `create_receivable`, `create_commission_record`, `reverse_revenue`, `deduct_credits`, `close_daily_cash`) **não executadas** por essa via em produção;
- **Idempotência persistente** — `processed_operations` zerado (a idempotência financeira real do H7-1 é garantida pela RPC `finance_settle_comanda`, independente desta infraestrutura);
- **Observabilidade de eventos** — a observabilidade atual (Fase 3.5) cobre instrumentação declarativa de serviços, não o fluxo de eventos da Fase 4.

**Não há impacto financeiro ou de integridade de dados conhecido** decorrente deste achado. Os fluxos financeiros operam por caminho síncrono (RPC `finance_settle_comanda` com idempotência robusta), independente da Fase 4.

---

## 8. Lacuna identificada na certificação 4.10

A certificação 4.10 (`ROADMAP.md:675-679`, "12/12 checklist aprovados + 9/9 Marco de Aceite") **validou a infraestrutura isoladamente** (testes unitários de Event Bus, Event Store, Subscribers, Outbox, Finance Provider, Replay Engine), mas **não contemplou o bootstrap/runtime integration**:

- não verificou a inicialização dos subscribers no ciclo de vida da aplicação;
- não verificou a persistência real de eventos em produção;
- não verificou a operação do Outbox/Dispatcher em produção;
- não verificou o acoplamento da Fase 4 ao entry point da aplicação (`index.tsx` → `App.tsx`);
- não verificou a existência de runtime bootstrapping como critério de saída.

**Resultado:** a certificação atesta a existência e o comportamento da infraestrutura sob teste, **não a sua operacionalização** em runtime.

---

## 9. Inconsistência documental: `docs/ROADMAP.md` × `ROADMAP.md`

Existe **duplicidade de ROADMAP com conteúdo divergente**:

| Aspecto | `ROADMAP.md` (raiz) | `docs/ROADMAP.md` |
|---|---|---|
| Status da Fase 4 | ✅ Concluída e Certificada (4.1-4.10, 631 testes) | Status geral "✅"; seção própria "🔄 Em andamento" |
| Subfases 4.8 / 4.9 | ✅ Concluídas (Event Versioning, Chaos Testing) | "(futuro)" |
| Certificação 4.10 | ✅ 12/12 + Marco 9/9 | Não mencionada |
| Architecture Freeze Gate | ✅ Declarado | Não mencionado |
| 5 serviços publicando (7 call sites) | ✅ Documentado | Não mencionado |

O arquivo `docs/ROADMAP.md` está **desatualizado** em relação ao ROADMAP raiz (referência oficial). A inconsistência é **documental** e **não afeta o código**, mas precisa ser registrada para reconciliação futura.

---

## 10. Recomendação deste gate

> **Não alterar implementação neste gate.**

- **Nenhum código alterado** — infraestrutura da Fase 4 permanece como está;
- **Nenhuma inicialização** — Event Store, subscribers, dispatcher/outbox e replay **não foram e não serão inicializados** neste gate;
- **Nenhuma migration** — nenhum DDL aplicado;
- **Nenhuma alteração de banco** — nenhuma escrita, DML ou mutação remota;
- **Nenhum merge/tag/deploy** — sem merge para `main`, sem tag, sem deploy.

Este gate registra **evidência auditável**. A **classificação da dívida arquitetural** e a **decisão arquitetural** são gates posteriores (B-4 e seguintes) e **não pré-julgam a solução** (integração como está, remodelação parcial ou substituição).

---

## 11. Veredito da auditoria documental

**Status: AUDITORIA DOCUMENTAL CONCLUÍDA — DIVERGÊNCIA CONFIRMADA (D1-D7).**

**Fase 4:** ⚠️ implementada e certificada, **não operacionalizada** no runtime
**Idempotência financeira:** ✅ segura (independe da Fase 4)
**Incidente de Comissões:** ❌ **não relacionado** a este achado (causa raiz: Trilha A)
**Certificação 4.10:** ⚠️ lacuna de escopo (sem bootstrap/runtime integration)
**Docs:** ⚠️ `docs/ROADMAP.md` × `ROADMAP.md` inconsistentes (D5)
**Correções aplicadas:** ✅ nenhuma

### Cadeia preservada

```
Trilha A      → causa raiz do incidente confirmada (produção defasada + tenants.active)
Trilha B      → idempotência financeira confirmada como segura
Trilha B      → Event Driven existente em código/testes, mas não operacionalizado no runtime
Auditoria doc → certificação 4.10 não contemplava bootstrap/runtime integration
Sem correções ainda
```

### Próximo gate

**B-4 — Classificar formalmente o achado como dívida arquitetural**
("Runtime Integration / Bootstrap da Fase 4"), **sem criar ADR de decisão de implementação** e **sem pré-julgar a solução** — a dívida é registrada independente da decisão arquitetural futura.
