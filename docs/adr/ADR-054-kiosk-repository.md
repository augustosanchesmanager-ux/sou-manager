# ADR-054: Kiosk Repository (`domain/kiosk/repository.ts`)

- **Status:** Accepted
- **Date:** 2026-11-22
- **Deciders:** Augusto (PO), Antigravity
- **Scope:** Batch 8 — última frente de eliminação de dívida de acesso direto ao Supabase nas camadas de UI (`Repository Guard: 24 → 0`)

---

## Contexto

Após a conclusão dos Lotes 1–7 (PRs #357–#366), o `Repository Guard` (`scripts/arch/guard-repository.mjs`) reportava exatamente **24 violações** remanescentes, todas concentradas no módulo Kiosk (`pages/KioskAdmin.tsx`, `pages/kiosk/KioskPage.tsx`, `pages/kiosk/KioskClientPage.tsx`, `pages/kiosk/components/KioskSchedule.tsx`, `pages/kiosk/components/KioskBarberFeedback.tsx` e `pages/kiosk/components/KioskShopFeedback.tsx`).

Por decisão explícita do PO, o módulo Kiosk permanece ativo e deve ser migrado para o padrão `domain/*/repository.ts` em vez de ser removido ou desativado.

## Decisão

1. Criar `domain/kiosk/repository.ts` expondo o singleton `kioskRepository`, encapsulando todas as 24 operações de tabela (`.from(...)`) do módulo Kiosk nas tabelas `tenants`, `tenant_addons`, `kiosk_devices`, `kiosk_sessions`, `services`, `appointments`, `feedback_barber` e `feedback_shop` via `createSupabaseClient(table, 'barber')`.
2. Migrar os 6 arquivos do módulo Kiosk para consumir `kioskRepository` em vez de chamar `supabase.from(...)` diretamente.
3. Atualizar `architecture-baseline.json` de `repositoryViolations: 24` para `0` (zerando `Repository Guard`, `Forbidden Imports` e `Circular Imports`).

## Consequências

- **Positivas:**
  - Zero violações de arquitetura (`0 / 0 / 0`) nos três guards (`Repository Guard`, `Forbidden Imports`, `Circular Imports`).
  - Isolamento completo do acesso a dados do módulo Kiosk em `domain/kiosk/repository.ts`, respeitando `getClientForTable` (multi-schema ready).
- **Negativas / Trade-offs:**
  - Chamadas RPC públicas do Kiosk (`kiosk_get_staff`) permanecem via `supabase.rpc` nos componentes que já as utilizam, podendo ser movidas posteriormente sem impacto no `Repository Guard`.
