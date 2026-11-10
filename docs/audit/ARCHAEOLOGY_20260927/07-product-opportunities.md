# Oportunidades de Produto

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. Visão Geral

O mapeamento de oportunidades de produto identifica onde ativos de outros repositórios podem acelerar o desenvolvimento do SMG Barber, respeitando o roadmap congelado e a decisão do PO.

---

## 2. Oportunidades por Repositório

### 2.1 `sanchez-barber-iastudio`

| # | Oportunidade | Evidência | Classificação | Complexidade | Risco |
|---|---|---|---|---|---|
| P-01 | Reutilizar wizard de booking | `SchedulingFlow.tsx` — motion por step, validação, tratamento de conflito | 🟡 ADAPTAR | Média | Baixo |
| P-02 | Usar catálogo de serviços como seed | `scheduling/data.ts` — 8 serviços com nome/preço/duração | 🟡 REFERÊNCIA | Baixa | Baixo |
| P-03 | Adaptar design system dark/gold | `index.css` + 10 componentes | 🟡 REFERÊNCIA | Baixa | Baixo |
| P-04 | Implementar idempotência no site | SMG já tem `idx_appointments_external_site` | 🟠 REESCREVER | Média | Médio |
| P-05 | Corrigir integração site→SMG | URL + 7 campos + 2 UUIDs | 🟠 REESCREVER | Alta | Alto |

**Perguntas para o PO:**
1. A integração com SMG está oficialmente abandonada ou foi pivô temporário?
2. A Sanchez Barber é tenant do SMG? Qual o `tenant_id`?
3. O site público deve escrever direto no SMG ou só consultar disponibilidade?
4. Os 8 serviços de `data.ts` devem virar `services` reais na SMG?

### 2.2 `SMG_LOUGE`

| # | Oportunidade | Evidência | Classificação | Complexidade | Risco |
|---|---|---|---|---|---|
| P-06 | Adaptar CommandPalette | `CommandPalette.tsx` — Ctrl/Cmd+K, navegação por React Router | 🟡 ADAPTAR | Média | Baixo |
| P-07 | Adaptar KpiCard e EventKpiCard | `KpiCard.tsx`, `EventKpiCard.tsx` | 🟢 COPIAR | Baixa | Baixo |
| P-08 | Adaptar OperationalAlerts | `OperationalAlerts.tsx` | 🟡 ADAPTAR | Baixa | Baixo |
| P-09 | Adaptar rankings | `ProductRanking.tsx`, `PromoterRanking.tsx` | 🟡 ADAPTAR | Média | Baixo |
| P-10 | Adaptar drawer/modal de comissões | `CommissionDetailsDrawer.tsx`, `CommissionAdjustmentModal.tsx` | 🟡 ADAPTAR | Média | Médio |
| P-11 | Adaptar DoorCheckin | `DoorCheckinPage.tsx`, `useDoorCheckin.ts` | 🟡 ADAPTAR | Média | Médio |
| P-12 | Adaptar Stock | `StockPage.tsx`, `useStock.ts` | 🟡 ADAPTAR | Média | Médio |
| P-13 | Corrigir split-brain schema | `SupabaseSync.tsx` assina `public.*` | 🔴 REESCREVER | Alta | Alto |
| P-14 | Corrigir mock super_admin | `AuthContext` sem gating de localhost | 🔴 REESCREVER | Média | Alto |

### 2.3 `gerador_orcamentos`

| # | Oportunidade | Evidência | Classificação | Complexidade | Risco |
|---|---|---|---|---|---|
| P-15 | Replicar padrão de catálogo | `tenant_id` + `ativo` + partial unique index | 🟡 REFERÊNCIA | Baixa | Baixo |
| P-16 | Replicar pipeline PDF | `api/process.ts` — Puppeteer + Handlebars | 🟡 REFERÊNCIA | Alta | Médio |
| P-17 | Corrigir service_role JWT | `index.html` — comprometimento total | 🔴 REESCREVER | Alta | **CRÍTICO** |
| P-18 | Implementar tenant isolation | `x-tenant-id` confiado sem validação | 🔴 REESCREVER | Alta | Alto |
| P-19 | Corrigir RLS `USING(true)` | `budgets` — totalmente aberto | 🔴 REESCREVER | Média | Alto |

### 2.4 `smg-core`

| # | Oportunidade | Evidência | Classificação | Complexidade | Risco |
|---|---|---|---|---|---|
| P-20 | Adicionar `smg_client_apps` ao SoT | `control.smg_client_apps` — registry client→app→tenant→schema | ⭐ GAP | Alta | Médio |
| P-21 | Adicionar `app_health_checks` ao SoT | `control.app_health_checks` — fleet monitoring | ⭐ GAP | Alta | Médio |
| P-22 | Adicionar `app_incidents` ao SoT | `control.app_incidents` — incident tracking | ⭐ GAP | Alta | Médio |
| P-23 | Adicionar `platform_security_events` ao SoT | `platform_security_events` — login events | ⭐ GAP | Média | Médio |
| P-24 | Adicionar `count_active_super_admins()` | Proteção contra lock-out | ⭐ GAP | Baixa | Baixo |
| P-25 | Corrigir RBAC morto | `auth.service.ts:64`, `permissions.guard.ts:39` | 🔴 REESCREVER | Alta | Alto |
| P-26 | Corrigir escalão de privilégio | `is_admin()` inclui viewer, policy `FOR ALL` | 🔴 REESCREVER | Média | Alto |
| P-27 | Corrigir 4 rotas quebradas | `/audit-logs`, `/api-logs`, `/error-logs`, `/system-health` | 🔴 REESCREVER | Média | Alto |

### 2.5 `SMG_AUTOCONTROL`

| # | Oportunidade | Evidência | Classificação | Complexidade | Risco |
|---|---|---|---|---|---|
| P-28 | Usar domínio automotivo como seed | OS, vehicles, PF/PJ, "aguardando peça" | 🟡 REFERÊNCIA | Média | Baixo |
| P-29 | Adaptar grade de 4 KPIs | `Dashboard.tsx:38-63` | 🟡 ADAPTAR | Baixa | Baixo |
| P-30 | Adaptar funil de OS em 4 cards | `ServiceOrders.tsx:30-67` | 🟡 ADAPTAR | Baixa | Baixo |
| P-31 | Adaptar 3 cards financeiros | `Financial.tsx:44-74` | 🟡 ADAPTAR | Baixa | Baixo |
| P-32 | Rejeitar `company_id` → `tenant_id` | `types/index.ts` — divergência taxonômica | 🔴 REESCREVER | Baixa | Baixo |
| P-33 | Definir módulos de `auto` | `APP_ENABLED_MODULES[auto]` = `[]` | 🟡 REFERÊNCIA | Média | Médio |

**Decisão do PO necessária:**
- D-1: Autorizar SMG Auto Control como 2º produto comercial?
- D-2: "Mão de obra" → como mapeia no domínio `commission/`? (ADR-001)
- D-3: Definir módulos de `auto` em `APP_ENABLED_MODULES`

### 2.6 `SMG_LADINGPAGE`

| # | Oportunidade | Evidência | Classificação | Complexidade | Risco |
|---|---|---|---|---|---|
| P-34 | Reconstruir funil de captura | 7 âncoras quebradas, WhatsApp fake | 🔴 REESCREVER | Média | **CRÍTICO** |
| P-35 | Reutilizar copy PainPoints | `PainPoints.tsx` — 5 dores validadas | 🟢 COPIAR | Baixa | Baixo |
| P-36 | Reutilizar tabela Differentiators | `Differentiators.tsx` — 4 eixos | 🟢 COPIAR | Baixa | Baixo |
| P-37 | Reutilizar design tokens | `index.css:4-55` — 6 tokens + 6 classes | 🟢 COPIAR | Baixa | Baixo |
| P-38 | Recuperar catálogo de produtos do git | `OLD_App.tsx:570-693` — Smart Booking, Split de Pagamento | 🟡 ADAPTAR | Média | Baixo |
| P-39 | Recuperar system prompt do chatbot | `OLD_App.tsx:66-79` — voz da marca | 🟡 ADAPTAR | Baixa | Baixo |
| P-40 | Corrigir nomenclatura de marca | "SMG Pop Lounge" vs "SMG Club" vs "Club dos Chefes" | 🟡 ADAPTAR | Baixa | Baixo |
| P-41 | Adicionar analytics/tracking | Zero instrumentação | 🟡 ADAPTAR | Baixa | Baixo |
| P-42 | Adicionar `vercel.json` | Sem config de deploy | 🟡 ADAPTAR | Baixa | Baixo |

---

## 3. Oportunidades Cruzadas

| # | Oportunidade | Origem | Destino | Classificação |
|---|---|---|---|---|
| O-1 | Security events table | smg-core | sou-manager | ⭐ GAP |
| O-2 | Fleet health/incidents | smg-core | sou-manager | ⭐ GAP |
| O-3 | Last-admin protection | smg-core | sou-manager | ⭐ GAP |
| O-4 | Client→app→tenant registry | smg-core | sou-manager | ⭐ GAP |
| O-5 | PDF generation pattern | gerador | sou-manager | 🟡 REFERÊNCIA |
| O-6 | Catalog pattern (tenant_id+ativo+unique) | gerador | sou-manager | 🟡 REFERÊNCIA |
| O-7 | Booking wizard UX | sanchez | sou-manager | 🟡 ADAPTAR |
| O-8 | Service catalog seed | sanchez | sou-manager | 🟡 REFERÊNCIA |
| O-9 | Dark/gold design system | sanchez | sou-manager | 🟡 REFERÊNCIA |
| O-10 | CommandPalette | LOUGE | sou-manager | 🟡 ADAPTAR |
| O-11 | KpiCard/EventKpiCard | LOUGE | sou-manager | 🟢 COPIAR |
| O-12 | DoorCheckin/Stock | LOUGE | sou-manager | 🟡 ADAPTAR |
| O-13 | PainPoints/Differentiators copy | LADINGPAGE | sou-manager | 🟢 COPIAR |
| O-14 | Brand tokens | LADINGPAGE | sou-manager | 🟢 COPIAR |
| O-15 | OS domain vocabulary | AUTOCONTROL | sou-manager `auto` | 🟡 REFERÊNCIA |
| O-16 | Vehicle entity | AUTOCONTROL | sou-manager `auto` | 🟡 REFERÊNCIA |
| O-17 | PF/PJ/Premium classification | AUTOCONTROL | sou-manager `auto` | 🟡 REFERÊNCIA |

---

## 4. Priorização Sugerida

| Prioridade | # | Ação | Depende de |
|---|---|---|---|
| **P0** | P-17 | Corrigir service_role JWT em gerador | Ação imediata |
| **P0** | P-34 | Reconstruir funil de captura LADINGPAGE | PO decision |
| **P0** | P-05 | Corrigir integração site→SMG | PO decision |
| **P1** | P-13 | Corrigir split-brain schema LOUGE | P-05 |
| **P1** | P-14 | Corrigir mock super_admin LOUGE | P-13 |
| **P1** | P-25 | Corrigir RBAC morto smg-core | PO decision |
| **P1** | P-26 | Corrigir escalão de privilégio | P-25 |
| **P2** | P-01 | Adaptar booking wizard | P-05 |
| **P2** | P-06 | Adaptar CommandPalette | P-14 |
| **P2** | P-20 | Adicionar smg_client_apps ao SoT | P-25 |
| **P3** | P-35 | Reutilizar copy PainPoints | — |
| **P3** | P-36 | Reutilizar Differentiators | — |
| **P3** | P-37 | Reutilizar design tokens | — |
| **P3** | P-38 | Recuperar catálogo do git | — |
