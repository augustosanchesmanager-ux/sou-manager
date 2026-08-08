# SNAPSHOT PRÉ-HOMOLOGAÇÃO — SANCHEZ BARBER — v1.5.0

> **Baseline registrado em:** 2026-08-08 (sábado), janela de coleta ~21:15–21:40 (horário local).
> **Ambiente:** Supabase produção `ushsnmlbeurfvlkieiln` (projeto `smg-barber`), schema `public`.
> **Método:** consultas **read-only** via `supabase db query --linked -o json` (Management API). Nenhuma escrita, DDL, DML ou mutação remota.
> **Referência:** serve de base para os gates H-1 a H-7 do plano de homologação (`docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md`) — conferência "igual ao snapshot" de H1-6..H1-9, H3-6, H2-5/H2-7.

---

## 1. Identificação do tenant alvo

| Campo | Valor |
|-------|-------|
| `tenants.id` | `b716e290-f7f6-4449-b790-5ae9dcdadcab` |
| `tenants.name` | Barbearia Principal |
| `tenants.slug` | `sanchez` |
| `tenants.app_slug` | `barber` |
| `tenants.plan` | `pro` |
| `tenants.status` | `active` |
| `tenants.first_appointment_at` | 2026-08-06 13:43:12+00 |
| `tenants.created_at` | 2026-02-22 17:23:17+00 |
| `tenants.updated_at` | **2026-08-08 12:07:52+00 (hoje — atividade no tenant)** |

**Observações:**
- O tenant é **LIVE**: comandas com `created_at` 2026-08-08 21:20 e `closed_at` 2026-08-08 21:21 (durante a coleta). Contagens são instantâneas e podem variar entre consultas.
- Billing é via `tenants.plan`; a tabela `subscriptions` tem **0 linhas** para o tenant (billing por `tenant_has_feature`/flags).

---

## 2. Panorama de tenants (global)

- **3 tenants reais:** Barbearia Principal (`sanchez`, pro, active), SMG Estética Demo (`smg-estetica-demo`, pro, active), Loja Demo Varejo (`varejo-demo`, pro, active).
- **50+ tenants E2E** (2026-08-05 a 2026-08-08, incluindo hoje 14:44–14:45 Flow13/Flow14): `free`/`pro`, maioria `active`, alguns `draft`/`cancelled`/`trial`/`past_due`/`suspended`/`archived`. **Higiene de tenants E2E = item P2/P3 (fora do escopo desta homologação).**

---

## 3. Contagens por tabela — tenant Sanchez Barber

Coletadas em 2 instantes (Q1 ~21:15, Q5 ~21:22). Onde divergirem, é atividade em curso.

| Tabela | Contagem | Nota |
|--------|---------:|------|
| appointments | 1.360 → 1.361 | 1 appointment de 1998 (ver §11) |
| appointment_services | 54 | |
| clients | 293 | |
| comandas | 1.293 → 1.294 | +1 durante coleta (live) |
| comanda_items | 1.375 → 1.376 | |
| service_execution_participants | 349 → 350 | |
| staff | 5 | |
| services | 17 | |
| products | 18 | |
| transactions | 699 → 705 | |
| cash_closings | 3 | todos `draft`, nenhum confirmado |
| barber_closings | 0 | fluxo novo (6.0.4) sem dados |
| financial_reversals | 2 | full_refund |
| customer_plans | 6 | planos Chef Club |
| customer_subscriptions | 16 | 13 ativas, 3 canceladas |
| customer_credits | 15 | |
| customer_subscription_receivables | 43 | 27 paid, 10 overdue, 6 pending |
| customer_plan_benefits | 0 | |
| customer_plan_credit_usages | 0 | |
| customer_benefit_consumptions | 0 | |
| feature_flags (tenant) | 0 | sem overrides |
| billing_events | 0 | |
| invoices | 0 | |
| payment_attempts | 0 | |
| subscriptions (tenant billing) | 0 | billing via `tenants.plan` |
| event_store | 0 | |
| processed_operations | 0 | |
| notifications | 2.204 | |
| audit_logs | 6.591 → 6.936 (global) | |
| kiosk_devices | 1 | TOTEM_QR habilitado |
| kiosk_sessions | 4 | `initiated` |
| suppliers | 1 | |
| promotions | 2 | 1 ativa, 1 inativa |
| plan_change_requests | 0 (global) | |

---

## 4. Comandas e itens (H-2, H-7)

| Dimensão | Distribuição | Soma total |
|----------|--------------|-----------:|
| Status | `paid` 765; `open` 418; `cancelled` 107; `blocked` 4 | 40.656 / 21.930 / 5.350 / 180 |
| `financial_effect` | `true` 1.276; `false` 18 (legacy) | 67.331 / 785 |
| `closure_mode` | `standard` 1.276; `legacy_membership` 18 | |
| Pagamento | `pix` 411 (21.740); `Dinheiro` 86 (4.160); `Clube do Chefe` 21 (625); `credit` 18; `cash` 23; `debit` 6; `other` 18; `(null)` 711 (37.590) | |
| Range created | 2026-02-28 → 2026-08-08 21:20 | 68.116 (1.294) |
| Range closed | 2026-04-29 → 2026-08-08 21:21 | 31.186 (599 fechadas) |
| Por mês (created) | 2026-02:3 · 03:215 · 04:109 · 05:379 · 06:250 · 07:248 · 08:90 | |

| Itens | Distribuição | Soma |
|-------|--------------|-----:|
| Por tipo | serviço 1.365; produto 11 | 68.350 / 545 |
| `is_primary_revenue` | `true` 1.376 | 68.895 |
| Chef Club aplicado | nenhum item com `chef_club_benefit_code` | 0 |

**Comandas sem `client_id`:** 9 (todas nulas; **0 órfãs**).

---

## 5. Appointments (H-1, H-7)

| Dimensão | Distribuição |
|----------|--------------|
| Status | `completed` 657; `confirmed` 561; `cancelled` 97; `in_progress` 29; `no_show` 17 |
| Range | 1998-11-06 (1 anomalia) → 2026-12-31 (3 futuros) |
| Por mês | 2026-02:5 · 03:281 · 04:82 · 05:397 · 06:254 · 07:227 · 08:111 · 12:3 · 1998-11:1 |
| Source | `app` 1.355; `kiosk` 6 |
| `eligible_for_plan_credit` | `true` 41; `false` 1.320 |

---

## 6. Chef Club (H-3)

**Assinaturas (16):** `active` 13, `canceled` 3. Range: 2026-04-30 → 2026-08-08 19:51.

**Por plano:** PLANO DOS CHEFES 8; CHEFE EXECUTIVO 5; EXECUTIVO C/ BOTOX 1; EXECUTIVO C/ BARBA 1; PLANO DOS CHEFES C BARBA 1.

**Créditos (15):** por assinatura `active` → 69 disponíveis; `canceled` → 12.

**Receivables (43):**
- Status: `paid` 27 (R$ 5.820); `overdue` 10 (R$ 2.340); `pending` 6 (R$ 1.200).
- Método: Pix 27 (R$ 5.820); `(null)` 16 (R$ 3.540).
- Por mês (due): 2026-04:1 · 05:14 · 06:10 · 07:9 · 08:8 · 09:1.
- **10 receivables `overdue` + 6 `pending` para assinaturas ativas — conferir em H-3.**

**Planos Chef Club (6, todos ativos):** CHEFE EXECUTIVO 160; PLANO DOS CHEFES 260; EXECUTIVO C/ BOTOX 200; EXECUTIVO C/ BARBA 200; CHEFINHO 100; PLANO DOS CHEFES C BARBA 260.

---

## 7. Comissões — dados-fonte (H-2-5, ADR-001)

Não há tabela persistente de comissões (comissão é domínio teórico; calculada em tempo real).

| Dimensão | Distribuição |
|----------|--------------|
| Participantes (350) por role | `primary` 329; `assistant` 21 |
| Por payout_type | `percentage` 329; `fixed` 21 |
| `affects_commission` | `true` 350 |
| `affects_revenue` | `true` 329; `false` 21 (assistentes) |
| Por staff | RUBENS SANCHEZ 171; HERON FERREIRA 156; LUCAS (inativo) 21; AUGUSTO 2 |
| `commission_rate` staff | 50% (HERON, LUCAS); 0% (RUBENS, AUGUSTO, HEBERTON) |

> **Observação:** `payout_amount_calculated` = **0/NULL em todas as 350 linhas** (nunca materializado). Conferir no re-teste de Comissões (ETAPA B §8.1#5) se o cálculo em tela diverge do esperado.

---

## 8. Catálogo de planos/flags (H-5)

| Item | Dados |
|------|-------|
| `plans` | `free`, `pro`, `premium` — todos `active`; `price_cents` = 0 nos 3 (precificação não configurada no catálogo) |
| `plan_features` | pro 15; free 14; premium 20 |
| `features` (20) | core 7; admin 2; integration 3; engagement 3; financial 5 |
| `feature_flags` | 0 linhas (nenhum override) |
| `tenant_addons` | TOTEM_QR `enabled` (1) |
| `tenant_settings` | **nenhuma linha** para Sanchez (defaults) |
| Billing real | `subscriptions` 0 (Sanchez); global 1 (`f6961fd7-...`, plano `free` — tenant E2E); `billing_events` 2 (ambas E2E: TenantTrialStarted, TenantSubscriptionActivated); `invoices` 0; `payment_attempts` 0 |

---

## 9. Acesso e usuários (H-1-4/H-1-5, ETAPA B)

- `profiles` (8 global): **Sanchez tem apenas 1** — `828175b0-ac50-444f-bd90-51b9a399c28c` = **"Administrador"** (superadmin). Demais 7 são E2E (E2E Manager/Barber/Cashier) + Demo Estética.
- `user_tenants`: Sanchez → somente `828175b0...`.
- **Os 5 staff do tenant (RUBENS, HERON, HEBERTON, AUGUSTO, LUCAS) NÃO possuem `profiles`/usuários de app** (confirmado: 5/5 sem vínculo). **Não existe conta de homologação** → ETAPA B permanece adiada.

---

## 10. Integridade referencial, RLS e segurança (H-6)

**FKs — 0 órfãs em:** comanda_items, participantes (comanda_item/staff), comandas (staff), customer_credits, receivables (subscription/cliente), appointments, transactions (comanda). Única exceção: 9 comandas com `client_id` NULL (não órfãs; sem cliente vinculado — venda avulsa/produto).

**RLS:** as **63 tabelas** do schema `public` estão com `relrowsecurity = true` e possuem policies. Tabelas de catálogo novas (`plans`, `features`, `plan_features`, `feature_flags`) com RLS + policies presentes.

**Cash closings:** 3 registros, todos `draft` (2026-05-11, 2026-05-12, 2026-08-06), **nenhum confirmado**; `cash_closing_events` 2 (`opening`); `barber_closings` 0. A operação não formaliza fechamentos — relevante para H-2-3/H-2-4/H-7.

---

## 11. Achados registrados (sem correção — regra PO)

| # | Severidade | Achado |
|---|-----------|--------|
| S1 | P3 | 1 appointment com `start_time` 1998-11-06 (`3fffe242-2513-4386-bb18-44ad721bddcf`, cliente "Guilherme Santana") |
| S2 | P2 | `payout_amount_calculated` = 0/NULL em todas as 350 participações (nunca materializado) — validar impacto no re-teste de Comissões |
| S3 | P2 | 10 receivables `overdue` + 6 `pending` com assinaturas ativas — quadratura Chef Club a conferir em H-3/H-2-7 |
| S4 | P2 | 50+ tenants E2E acumulados (alguns `active`) — higiene de tenants fora do escopo; recomendar limpeza futura |
| S5 | P3 | 9 comandas sem `client_id` (não órfãs) |
| S6 | P3 | `price_cents = 0` no catálogo `plans` (precificação não configurada) + `tenant_settings` ausente para Sanchez |
| S7 | Info | `tenants.updated_at` = hoje 12:07 (atividade) + comandas criadas 21:20/21:21 durante coleta → **tenant LIVE**; contagens são instantâneas |
| S8 | Info | Nenhum usuário de app além do superadmin → **ETAPA B continua adiada** (depende de conta de homologação) |

---

## 12. Critérios de conferência pós-homologação (H-1..H-7)

- H1-6: `clients` ≈ 293 · H1-7: `appointments` ≈ 1.361 · H1-8: `services` 17 / `products` 18 · H1-9: `comandas` ≈ 1.294 · `transactions` ≈ 705.
- H2-5/H2-7: quadratura comissões × caixa × comandas; baseline financeira §4.
- H3-6: `customer_subscriptions` = **16** (não 15 — corrigido em relação ao plano).
- H4: Sanchez `active`/`pro` — referência `tenants.plan`/`tenants.status`.
- H5: matriz pro = 15 features (plan_features pro).
