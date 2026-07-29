# Performance Baseline — Fase 3.6

## Status

Established: 2026-07-23
Method: Static analysis of query patterns + code review
Next step: Runtime measurement via observability metrics

---

## Baseline das Operações Críticas

| Operação | p50 (meta) | p95 (meta) | Fonte |
|----------|-----------|-----------|-------|
| Checkout.finish | < 500ms | < 2s | `application/checkout.ts` |
| Appointment.create | < 300ms | < 1s | `application/appointment/lifecycle.ts` |
| CashClosing.close | < 2s | < 5s | `application/cashClosing/operations.ts` |
| ChefClub.resolveSubscription | < 200ms | < 500ms | `application/chefClub/credits.ts` |
| Commission.loadLines | < 800ms | < 3s | `application/commission.ts` |

---

## Índices Existentes (~70+)

### Performance Indexes (migration 20260424000000)
- `idx_appointments_client_start` — (client_id, start_time DESC)
- `idx_appointments_staff_start` — (staff_id, start_time DESC)
- `idx_appointments_status_start` — (status, start_time DESC)
- `idx_comandas_client_status` — (client_id, status)
- `idx_comanda_items_service` — (service_id)
- `idx_transactions_tenant_type_date` — (tenant_id, type, date DESC)
- `idx_clients_tenant_status` — (tenant_id, status)
- `idx_staff_tenant_status` — (tenant_id, status)
- `idx_services_tenant_active` — (tenant_id, active)

### ChefClub Indexes
- `idx_customer_plans_tenant`, `idx_customer_plans_active`
- `idx_customer_subscriptions_tenant`, `idx_customer_subscriptions_client`, `idx_customer_subscriptions_plan`, `idx_customer_subscriptions_status`
- `idx_customer_credits_tenant`, `idx_customer_credits_client`, `idx_customer_credits_subscription`
- Composite: `idx_customer_subscriptions_tenant_client_status`, `idx_customer_credits_tenant_client_subscription`

### Cash Closing Indexes
- `idx_comandas_tenant_settled_at`, `idx_comandas_tenant_payment_date_real`

### Financial Reversals
- `idx_financial_reversals_original`, `idx_financial_reversals_reversal`, `idx_financial_reversals_source`, `idx_financial_reversals_created_at`

---

## Index Gaps (Recomendados)

### P0 — Crítico
| Tabela | Índice Ausente | Query Pattern |
|--------|---------------|---------------|
| `comandas` | `tenant_id, created_at` | `.eq('tenant_id').order('created_at')` |
| `comandas` | `tenant_id, appointment_id` | `.eq('tenant_id').eq('appointment_id')` |

### P1 — Alto
| Tabela | Índice Ausente | Query Pattern |
|--------|---------------|---------------|
| `comandas` | `tenant_id, staff_id` | `.eq('tenant_id').eq('staff_id')` |
| `customer_plans` | `tenant_id, name` | `.eq('tenant_id').order('name')` |
| `customer_subscriptions` | `client_id, status` | `.eq('client_id').eq('status', 'active')` |

### P2 — Moderado
| Tabela | Índice Ausente | Query Pattern |
|--------|---------------|---------------|
| `transactions` | `tenant_id, source_type` | `.eq('source_type')` |
| `profiles` | `tenant_id` | `.eq('tenant_id')` |
| `products` | `tenant_id, active` | `.eq('tenant_id').or('active.is.null,active.eq.true')` |
| `promotions` | `tenant_id, active` | `.eq('tenant_id').eq('active', true)` |

---

## N+1 Issues Encontrados

### CRITICAL
- **Admin.tsx fetchShops** — 3N queries per shop (N tenants = 3N+ queries)

### HIGH
- **OnboardingChecklist** — 4 sequential awaits (could be parallel)
- **Checkout deductChefClubCredits** — N+1 RPC calls in for...of loop
- **Appointment comanda sync** — sequential updates (could be parallel)

### MEDIUM
- **select('*')** — 72 occurrences (21% of all queries)
- **Dashboard** — 14 parallel queries (could be ~8 with consolidation)
- **cashClosing** — double fetch of same data
- **Commissions.tsx** — duplicates application/commission.ts logic
- **loadSubscriptionWithDetails** — sequential where parallel possible

---

## Anti-Patterns

| Pattern | Occurrences | Impact |
|---------|-------------|--------|
| `select('*')` | 72 | Over-fetching data |
| N+1 loops | 4 critical | Exponential queries |
| Sequential awaits | 8+ | Unnecessary latency |
| Duplicate queries | 3 | Wasted resources |

---

## Métricas de Bundle (Atuais)

| Metric | Value |
|--------|-------|
| Total JS | ~2.8 MB |
| Vendor React | ~194 KB |
| Vendor Recharts | ~398 KB |
| Vendor Supabase | ~173 KB |
| CashClosingPage | ~504 KB (largest page) |

---

## Referências

- `docs/security/SECURITY_AUDIT_RLS.md` — 47 tables inventoried
- `supabase/migrations/20260424000000_performance_indexes.sql` — Existing indexes
- `src/lib/observability/metrics.ts` — Runtime metrics collection
