# ADR-011 — Phase 6.0.3 Scope: Team Onboarding & Invitations

**Status:** Accepted
**Date:** 2026-08-05
**Author:** Augusto (PO) + SMG Engineering

---

## Context

The Fase 6.0.3 was originally planned in `ROADMAP.md` as **"Tenant Lifecycle"** — Migration `tenants.status` (enum 7 estados), transições e verificação em `ProtectedRoute`.

During the certification audit of Fase 6.0.2 (2026-08-05), the PO identified that the Tenant Lifecycle was **already substantially implemented and in production** since the Sprint 1 / Fase 6.0.1:

| Item | Evidência |
|------|-----------|
| Enum `tenant_status` (7 estados) | `supabase/migrations/20260728000000_sprint1_tenant_lifecycle.sql` |
| Coluna `tenants.status` substituindo `active` | mesma migration |
| Transição `draft → active` via RPC `complete_onboarding` | `application/onboarding.ts` |
| Verificação de `tenant.status` em `ProtectedRoute` | `App.tsx:157-162` (bloqueia `cancelled`/`archived`/`suspended`; redireciona `draft` para onboarding) |
| Tipos `TenantStatus` / `Tenant` | `domain/tenant/types.ts` |

## Problem

Reabrir o "Tenant Lifecycle" como uma fase própria seria **retrabalho** sobre uma área estabilizada e em uso. A única lacuna real de lifecycle está ligada ao billing (transições `active ↔ past_due ↔ suspended`), que depende da Fase 6.0.4 (Subscription/Billing).

Enquanto isso, o maior gap de produto **não implementado** é o onboarding da equipe: convidar profissionais, eles aceitarem, criarem credenciais e acessarem o tenant com permissões iniciais.

## Decision

**A Fase 6.0.3 é renomeada para "Team Onboarding & Invitations".**

O Tenant Lifecycle deixa de ser fase própria. Gaps residuais de lifecycle dependentes de billing (transições `past_due`/`suspended`) passam a ser pendências do escopo 6.0.4, não de uma fase dedicada.

### Escopo da 6.0.3

- Convite de profissionais (convite por email do gestor/owner)
- Aceite de convite (fluxo do convidado)
- Criação de credenciais (criação de conta do profissional)
- Associação ao `tenant` (`staff` + `user_tenants`)
- Conclusão do perfil do profissional
- Permissões iniciais (papel baseado em `role_permissions`)
- E2E do fluxo completo de convite → acesso

### Não é escopo (já implementado)

- Enum `tenant_status`, `tenants.status`, transição `draft → active`, verificação em `ProtectedRoute`

## Alternatives Considered

### Alternative 1: Manter "Tenant Lifecycle" como fase 6.0.3

**Rejected** pelo PO — área já implementada e em uso desde a Sprint 1/6.0.1. Reabri-la consumiria a fase sem gerar valor de produto.

### Alternative 2: Inverter — 6.0.4 (Team) antes de 6.0.3 (Billing)

**Rejected** — a sequência comercial do PO permanece: Team (6.0.3) → Billing (6.0.4). A 6.0.3 renomeada mantém o número para não reorganizar o roadmap além do necessário.

## Consequences

- **Positive:** Foco na maior lacuna de produto — ativação da equipe no tenant.
- **Positive:** Evita retrabalho em área estabilizada e já coberta por E2E (flow6/flow7).
- **Positive:** O onboarding de equipe alimenta métricas de ativação (profissionais ativos por tenant).
- **Negative:** Transições de lifecycle dependentes de billing ficam implícitas até a 6.0.4.
- **Mitigation:** Pendências de lifecycle registradas como dependência da 6.0.4 no `ROADMAP.md`.

## References

- `ROADMAP.md` — seção 6.0.3 (decisão PO 2026-08-05)
- `supabase/migrations/20260728000000_sprint1_tenant_lifecycle.sql` — tenant lifecycle já implementado
- `domain/tenant/types.ts` — `TenantStatus` / `Tenant`
- `App.tsx:157-162` — verificação de status em `ProtectedRoute`
- Branch `feature/phase-6.0.3-team-onboarding` (criada na certificação 6.0.2)
