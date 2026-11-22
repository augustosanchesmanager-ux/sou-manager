# ADR-053: Repositórios e Serviços para Zerar Dívida do Repository Guard (Lote 7)

- **Status:** Accepted (aprovado pelo PO em 2026-11-22)
- **Contexto:** Após os Lotes 1–6 (PRs #360–#365), a baseline do `Repository Guard` caiu de `222` para `108` violações. Das `108` restantes, `24` pertencem ao módulo Kiosk (tratado em frente separada) e `84` estão em páginas, hooks e widgets que ainda acessam `.from(...)` diretamente por falta de repositório ou serviço dedicado.

## Decisão

Criar os seguintes repositórios e serviços de domínio seguindo o padrão `SupabaseRepository` (`domain/shared/supabase-repository.ts`) e as fronteiras de `guard-imports.mjs`:

1. `domain/promotion/repository.ts` (`promotionRepository`) — tabela `promotions`.
2. `domain/supply/repository.ts` (`supplyRepository`) — tabelas `suppliers`, `purchase_orders` e catálogo de `products` para compras/PDV.
3. `domain/tenantGoals/repository.ts` (`tenantGoalsRepository`) — tabela `tenant_goals`.
4. `domain/profile/repository.ts` (`profileRepository`) — tabelas `profiles`, `access_requests`, `audit_logs` e leituras administrativas/cross-tenant de `Admin` e `SuperAdmin`.
5. `domain/support/repository.ts` (`supportRepository`) — tabelas `support_tickets` e `ticket_messages`.
6. `services/biService.ts` — consultas agregadas de `useStrategicDashboard.ts`, `BusinessIntelligence.tsx` e `SupabaseMonitoring.tsx`.
7. `services/chefClubWidgetService.ts` — consultas dos widgets `ChefClubSummaryWidget.tsx` e `ClubReceivablesWidget.tsx` (respeitando a proibição `Components → Supabase`).

## Consequências

- Elimina as `84` violações restantes fora do módulo Kiosk (`108 → 24`).
- Isola o módulo Kiosk (`24` violações) para decisão dedicada em frente separada.
- Mantém `Forbidden Imports = 0` e `Circular Imports = 0`.
