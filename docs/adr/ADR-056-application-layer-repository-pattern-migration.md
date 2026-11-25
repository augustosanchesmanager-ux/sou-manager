# ADR-056: Migração Incremental da Camada `application/` para o Padrão Repository (`UXQ-008`)

**Status:** Accepted (2026-11-25 — aprovação explícita do PO para ADR-056 + execução fatiada em 3 lotes)
**Date:** 2026-11-25
**Deciders:** PO (Augusto) + Antigravity
**References:**
- Issue [#398](https://github.com/augustosanchesmanager-ux/sou-manager/issues/398) (`UXQ-008`)
- `docs/backlog/ux-qualidade.md`
- `docs/adr/ADR-053-batch-7-domain-repositories.md`
- `AGENTS.md` (roadmap congelado: nova abstração/repositório exige ADR)

---

## Context

A arquitetura da plataforma SMG separa a camada de orquestração (`application/`) da camada de persistência (`domain/*/repository.ts`). Entretanto, auditoria identificou 10 arquivos em `application/` que ainda importavam `createSupabaseClient` ou consultavam o Supabase diretamente em vez de delegar a um repositório de domínio:

- **Lote 1 — Tenant & Onboarding (4 arquivos):** `application/onboarding.ts`, `application/teamInvitation.ts`, `application/tenantLifecycle.ts`, `application/tenantProvisioning.ts`
- **Lote 2 — Chef Club (4 arquivos):** `application/chefClub/{credits,operations,receivables,subscriptions}.ts`
- **Lote 3 — Agendamento & Checkout (2 arquivos):** `application/appointment/lifecycle.ts`, `application/checkout.ts`

## Problem

O acesso direto ao Supabase dentro de `application/` mistura regras de negócio/eventos com detalhes de persistência (nomes de RPC, tratamento de erro de transporte, seleção de schema), dificultando testes unitários isolados e criando exceções ao padrão consolidado em `ADR-053`.

## Decision

Autorizar a migração incremental dos 10 serviços de `application/` para o padrão Repository em **3 lotes isolados (1 PR por lote)**, sem qualquer alteração de banco de dados, migration ou regra de negócio:

1. **Lote 1 (Tenant & Onboarding):** criar `domain/tenant/lifecycleRepository.ts` (`tenantLifecycleRepository`) encapsulando as RPCs de provisionamento, onboarding e ciclo de vida de assinatura (`provision_new_tenant`, `save_onboarding_step`, `complete_onboarding`, `start_trial`, `activate_subscription`, `cancel_subscription`, `get_subscription`, `change_tenant_plan`), removendo `createSupabaseClient` dos 4 arquivos de `application/`.
2. **Lote 2 (Chef Club):** encapsular queries/RPCs residuais de `application/chefClub/*` em `domain/chefClub/repository.ts`.
3. **Lote 3 (Agendamento & Checkout):** encapsular chamadas residuais de `application/appointment/lifecycle.ts` e `application/checkout.ts` nos repositórios de domínio correspondentes (`appointment`, `comanda`/`checkout`).

### Invariantes obrigatórios

- Zero alteração em migrations, RPCs ou políticas RLS.
- Zero alteração em testes unitários existentes para fazê-los passar (`AGENTS.md`).
- Injeção de dependência suportada nos construtores dos serviços e repositórios para facilitar testes determinísticos.

## Alternatives Considered

- **A — Migrar todos os 10 arquivos em um único PR:** rejeitada pelo alto risco de regressão e dificuldade de revisão.
- **B — Manter `createSupabaseClient` em `application/`:** rejeitada por perpetuar inconsistência arquitetural com `ADR-053`.

## Consequences

- **Positivas:** camada `application/` fica 100% desacoplada do cliente Supabase, preservando fronteira clara entre orquestração de domínio/eventos e persistência.
- **Custos:** pequeno acréscimo de arquivos/métodos na camada `domain/*/repository.ts`, compensado por testabilidade e previsibilidade.
