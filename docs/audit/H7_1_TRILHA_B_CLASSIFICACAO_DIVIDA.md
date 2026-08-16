# H-7.1 — Trilha B: Classificação Formal da Dívida Arquitetural — Gate B-4

> **Status:** ✅ **DÍVIDA ARQUITETURAL CLASSIFICADA (somente documentação)** — achado da Trilha B formalmente registrado como **Dívida arquitetural — Runtime Integration / Bootstrap da Fase 4 (Event Driven)**, sem escolha de solução técnica e sem ADR de decisão de implementação.
> **Escopo:** somente documentação. **Nenhum código, banco, migration, Event Store, subscriber, dispatcher/outbox, replay, merge, tag ou deploy foi alterado ou inicializado.**
> **Referência:** `docs/audit/H7_1_TRILHA_B_DOCUMENTAL.md` (gate B-3 — matriz D1–D7 + conclusão) · `docs/audit/H7_1_AUDITORIA_TECNICA.md` (Trilha B §8, §9) · `docs/audit/H7_1_TRILHA_A_REPRODUCAO.md` (causa raiz do incidente original) · `ROADMAP.md` (Fase 4; Dívida Técnica Registrada D1–D5) · `docs/ARCHITECTURE_DECISIONS.md` (ADRs 1, 2, 13, 14) · `AGENTS.md`
> **Data da classificação:** 2026-08-16 · **Responsável:** OpenCode · **PO:** Augusto
> **Método:** análise documental das evidências do B-3 (matriz D1–D7, conclusão formal, evidências read-only de banco e código). **Nenhuma escrita, DDL, DML ou mutação remota.**

---

# Relatório Formal de Classificação — Trilha B (Gate B-4)

**Projeto:** SMG — Sou.Manager
**Produto:** SMG Barber
**Banco auditado:** `ushsnmlbeurfvlkieiln`
**Trilha:** B — Auditoria arquitetural (Event Driven / idempotência financeira)
**Gate:** B-4 — Classificação formal da dívida arquitetural
**Natureza:** classificação documental read-only
**Status operacional:** **SEM CORREÇÕES — nenhuma alteração aplicada**

---

## 1. Objetivo

Classificar formalmente o achado da Trilha B como dívida arquitetural e registrar:

1. o nome e o escopo da dívida;
2. o que está implementado × o que não está integrado;
3. as divergências D1–D7 preservadas do gate B-3;
4. a conclusão formal do B-3 preservada;
5. as confirmações explícitas (não-causa raiz, idempotência validada, sem solução escolhida, sem ADR);
6. as implicações da classificação;
7. as restrições respeitadas neste gate;
8. o veredito e o próximo passo.

A classificação **não escolhe nenhuma solução técnica** e **não cria ADR de decisão de implementação**.

---

## 2. Classificação formal

> **Dívida arquitetural — Runtime Integration / Bootstrap da Fase 4 (Event Driven)**

**Escopo da dívida:** a Fase 4 (Event Driven) possui **implementação completa** e **cobertura de testes** (Event Bus, Event Store, Subscribers, Outbox, Dispatcher, FinanceProvider, ReplayEngine, versionamento e persistência de idempotência), porém seus componentes **não estão inicializados/integrados ao runtime da aplicação de produção**.

**Componentes afetados:**

| Componente | Implementado | Testado | Integrado ao runtime |
|---|---|---|---|
| Event Bus (`appEventBus`, in-memory) | ✅ | ✅ | ⚠️ publish best-effort → eventos descartados |
| Event Store (`event_store`) | ✅ | ✅ | ❌ 0 rows em produção — nunca escrita |
| Subscribers (6 read-only + Commission + Finance) | ✅ | ✅ | ❌ zero registrados no runtime |
| Outbox (`InMemoryOutbox`) | ✅ | ✅ | ❌ nunca instanciado fora de testes |
| Dispatcher | ✅ | ✅ | ❌ nunca instanciado fora de testes |
| FinanceProvider | ✅ | ✅ | ❌ nunca registrado |
| ReplayEngine | ✅ | ✅ | ❌ nunca usado |
| Idempotência persistente (`processed_operations`) | ✅ | ✅ | ❌ 0 rows — nunca exercitada em produção |

**Natureza da dívida:** dívida de **integração/bootstrapping** (o componente de infraestrutura existe e funciona isoladamente, mas não foi acoplado ao ciclo de vida da aplicação). **Não é** dívida de funcionalidade, corrupção de dados ou falha de implementação dos componentes em si.

---

## 3. O que existe × o que não existe

### 3.1 Existe (evidência do B-3)

- Código completo em `domain/events/` (bus, store, subscribers, outbox, dispatcher, providers, replay engine);
- Migrations `20260723100000_event_store.sql` e `20260723110000_processed_operations.sql` (tabelas presentes no banco, RLS habilitado);
- Publicação de `CheckoutCompleted` best-effort em `application/checkout.ts:696-725`;
- Certificação 4.10 (12/12 checklist + 9/9 Marco de Aceite) validando a infraestrutura **isoladamente**;
- Testes unitários completos (631 testes da Fase 4).

### 3.2 Não existe

- **Bootstrap runtime** — nenhuma inicialização no entry point (`index.tsx` → `App.tsx`): zero chamadas de `SubscriberRegistry.register`/`initialize`, `createOutbox`, `createDispatcher`, `createEventStore`, `createReplayEngine` fora de testes (`git grep` confirmado no B-3);
- **Persistência real de eventos** — `event_store` zerado em produção;
- **Execução de operações via Outbox/FinanceProvider** — `processed_operations` zerado;
- **Subscribers ativos** — nenhum subscriber escutando eventos em produção;
- **Replay operacional** — ReplayEngine nunca usado.

**Única infraestrutura inicializada em runtime:** Observability (Fase 3.5) via `useObservability()` em `App.tsx:326`.

---

## 4. Divergências preservadas do gate B-3 (D1–D7)

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

## 5. Conclusão do B-3 preservada

> **Fase 4 — Event Driven: implementada em código e testes, certificada como arquitetura estável, porém NÃO integrada/inicializada no runtime da aplicação de produção.**

A certificação 4.10 validou a infraestrutura de eventos isoladamente (unit tests), **não o seu acoplamento ao ciclo de vida da aplicação**.

---

## 6. Confirmações explícitas

### 6.1 Não é causa raiz do incidente de Comissões

> **Este achado NÃO é a causa raiz do incidente original de Comissões.**

A causa raiz foi confirmada na **Trilha A** (`docs/audit/H7_1_TRILHA_A_REPRODUCAO.md`): frontend de produção `718f6f9` consulta a coluna `tenants.active` (removida pela migration `20260728000000` aplicada no remoto) → `42703` → `[TenantContext] Failed to resolve tenant context` → Comissões falham. A dívida da Fase 4 é **independente** desse incidente.

### 6.2 Idempotência financeira do fluxo H7-1 permanece validada

> A idempotência financeira do fluxo H7-1 **permanece validada e segura**.

O fluxo financeiro H7-1 é garantido pelo caminho síncrono (RPC `finance_settle_comanda` com guarda robusta de idempotência — lookup por `idempotency_key`, advisory lock, `FOR UPDATE`, verificação de status `paid`), **independente** da infraestrutura da Fase 4. Comanda `18ccc171` → transaction `9a55f575`, R$ 35,00, sem duplicidade.

### 6.3 Nenhuma solução técnica escolhida

> **Nenhuma solução técnica foi escolhida neste gate.**

As opções de tratamento da dívida (integrar a Fase 4 como está, integrar parcialmente, remodelar ou substituir) **não foram pré-julgadas**. A decisão arquitetural pertence a gate posterior, com envolvimento do PO.

### 6.4 Nenhum ADR de decisão de implementação criado

> **Nenhum ADR de decisão de implementação foi criado neste gate.**

A classificação registra a dívida **sem pré-julgar a solução**. Um eventual ADR só será considerado quando houver decisão arquitetural fundamentada.

---

## 7. Implicações da classificação

| Área | Implicação |
|---|---|
| **Auditoria/rastreabilidade** | Eventos de domínio não persistidos; auditoria de eventos indisponível em produção |
| **Replay/recuperação** | Reconstrução de estado via eventos indisponível (sem eventos + ReplayEngine inerte) |
| **Financeiro assíncrono** | Operações documentadas no Outbox/FinanceProvider não executadas por essa via em produção (o caminho síncrono continua válido e auditado) |
| **Observabilidade de eventos** | Observability cobre instrumentação declarativa (3.5); o fluxo de eventos da Fase 4 não é observado |
| **Documental** | Certificação 4.10 superestima o estado "pronto para produção"; `docs/ROADMAP.md` × `ROADMAP.md` divergem (D5) |
| **Risco** | **Sem impacto financeiro ou de integridade de dados conhecido** — o fluxo financeiro real não depende da Fase 4 |
| **Custo de correção futura** | Baixo (bootstrapping e wiring), mas decisão arquitetural deve anteceder qualquer implementação |

---

## 8. Restrições respeitadas neste gate

- [x] Nenhum código alterado
- [x] Nenhum banco alterado
- [x] Nenhuma migration executada
- [x] Nenhum componente inicializado em produção (Event Store, subscribers, dispatcher/outbox, replay)
- [x] Nenhum merge, tag ou deploy
- [x] Nenhum ADR de decisão de implementação criado
- [x] Nenhuma solução técnica assumida
- [x] Somente documentação (relatório + registro de dívida)

---

## 9. Veredito da classificação

**Status: DÍVIDA ARQUITETURAL CLASSIFICADA — SEM CORREÇÕES.**

**Classificação:** Dívida arquitetural — Runtime Integration / Bootstrap da Fase 4 (Event Driven)
**Divergências registradas:** D1–D7 (preservadas do B-3)
**Conclusão do B-3:** preservada
**Causa raiz do incidente original:** ❌ não relacionada (Trilha A)
**Idempotência financeira H7-1:** ✅ validada e segura
**Solução técnica:** ⬜ não escolhida
**ADR de implementação:** ⬜ não criado
**Correções aplicadas:** ✅ nenhuma

### Próximo passo

**Gate B-5 — Decisão arquitetural** (futuro, requer decisão do PO/arquiteto). A classificação da dívida **não exige** uma solução técnica para ser válida. Quando o PO decidir tratar a dívida, a decisão de como integrar (como está, parcialmente, remodelar ou substituir) **não pode ser tomada exclusivamente com as evidências atuais** — exigirá análise de trade-offs, proposta e aprovação formal, nos termos do roadmap congelado (mudanças estruturais via ADR).

> **Regra:** se, ao avaliar a dívida, uma decisão arquitetural não puder ser tomada exclusivamente com as evidências existentes, **parar e reportar** — sem assumir uma solução.
