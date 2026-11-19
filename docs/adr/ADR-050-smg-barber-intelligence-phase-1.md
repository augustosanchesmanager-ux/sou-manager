# ADR-050: SMG Barber Intelligence — Fase 1 (Diagnóstico Inteligente de Gestão)

**Status:** Accepted (2026-11-19 — aprovado pelo PO para execução da Fase 1)  
**Date:** 2026-11-19  
**Deciders:** PO (Augusto) + Antigravity (`project-planner`)  
**References:**
- [`docs/PLAN-smg-barber-intelligence.md`](../PLAN-smg-barber-intelligence.md) — Plano detalhado da Fase 1
- [`AGENTS.md`](../../AGENTS.md) — Regras multi-tenant, RLS, governança de ADRs e migrations
- [`supabase/functions/gemini-assistant/index.ts`](../../supabase/functions/gemini-assistant/index.ts) — Protótipo legado mantido intacto para o `SupportWidget.tsx`
- [`pages/StrategicDashboard.tsx`](../../pages/StrategicDashboard.tsx) — Alvo de integração UI (rota `/strategic-dashboard`)

---

## Context

1. O SMG já possui um protótipo inicial de chamada ao Gemini em `supabase/functions/gemini-assistant/index.ts` consumido por `components/SupportWidget.tsx`, porém sem:
   - verificação server-side de `tenant_id` e `role` (`owner`/`manager`);
   - coleta determinística de métricas via PostgreSQL RPC;
   - cache persistido por tenant/dia ou auditoria de consumo de tokens;
   - saída estruturada por JSON Schema estrito.
2. O produto precisa evoluir para **IA Invisível e Orientada a Ação (Embedded AI)** sem gerar custo imprevisível, risco de vazamento cross-tenant ou alucinação matemática.
3. Auditoria de rotas realizada em `App.tsx` e `components/Sidebar.tsx` confirmou dois pontos estratégicos:
   - `/strategic-dashboard` (`pages/StrategicDashboard.tsx`, `"Visão Estratégica"`): protegida por `ManagerRoute` (sem `FeatureRoute` adicional), funcionando como cockpit diário de KPIs e alertas do gestor.
   - `/bi` (`pages/BusinessIntelligence.tsx`, `"Inteligência (BI)"`): protegida por `ManagerRoute` + `FeatureRoute feature="bi"`, voltada para exploração analítica profunda.

## Problem

Como introduzir o **Diagnóstico Inteligente de Gestão (Fase 1)** na stack do SMG garantindo:
1. **Isolamento estrito multi-tenant** (`tenant_id` + RLS + validação de role no backend);
2. **Zero alucinação matemática** sobre faturamento, ticket médio, ocupação ou no-show;
3. **Previsibilidade de custos** (evitar chamadas duplicadas ou em loop e custo zero para tenants sem histórico);
4. **Zero regressão** no `SupportWidget.tsx` / `gemini-assistant` existente.

## Decision

1. **Nova Edge Function dedicada (`supabase/functions/ai-analyst/index.ts`):**
   - Valida JWT do usuário via Supabase Auth (`getUser(token)`).
   - Resolve `tenant_id` e `role` no servidor, exigindo `owner` ou `manager` (retorna `403` para demais perfis).
   - Mantém `gemini-assistant` intacta para o `SupportWidget.tsx`.

2. **Coleta determinística via PostgreSQL RPC (`public.get_tenant_weekly_metrics(p_tenant_id uuid)`):**
   - Calcula no PostgreSQL (`SUM`, `AVG`, `COUNT`) as métricas consolidadas dos últimos 7 dias vs. 7 dias anteriores, incluindo `appointment_count`.
   - Valida autorização tenant-scoped via `auth.uid()` / helpers centrais (`current_tenant_id_from_auth_uid()`), retornando um JSON enxuto (~1 KB).

3. **Tratamento de Cold Start (custo zero):**
   - Se `appointment_count = 0`, a Edge Function **não** chama a API do Gemini: retorna um payload estático de boas-vindas orientando o preenchimento inicial da agenda/comandas (0 tokens consumidos).

4. **Provedor e Structured Output:**
   - **Google Gemini 2.5 Flash** com `GEMINI_API_KEY` armazenada exclusivamente como secret da Edge Function.
   - Chamada *stateless* com `responseSchema` estrito retornando exatamente 3 cards (`title`, `alertLevel`, `diagnosis`, `recommendedAction`).

5. **Persistência, Cache Diário e Auditoria (`ai_insights` e `ai_usage_logs`):**
   - **`public.ai_insights`:** armazena o diagnóstico gerado com restrição **`UNIQUE (tenant_id, reference_date)`** (evita condições de corrida caso dois gestores abram o painel simultaneamente). Limite na Fase 1: máximo **1 geração/dia por tenant**.
   - **`public.ai_usage_logs`:** registra `tenant_id`, `user_id`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens` e `created_at` para observabilidade de unit economics.
   - Ambas as tabelas terão RLS habilitada usando `current_tenant_id_from_auth_uid()` e `current_is_super_admin_from_auth_uid()`.
   - *Nota de escopo:* Hard cap mensal por plano/assinatura (`tenants.monthly_ai_credits`) fica explicitamente adiado para a Fase 2.

6. **Integração no Front-end (`pages/StrategicDashboard.tsx`):**
   - O componente de 3 cards no padrão *Atelier Tech* será integrado em `pages/StrategicDashboard.tsx` (ponto focal diário de `owner`/`manager`), consumindo a Edge Function via serviço tipado dedicado (`services/aiAnalystService.ts`).

## Alternatives Considered

- **A — Evoluir `gemini-assistant` in-place:** Rejeitada para evitar risco de regressão no `SupportWidget.tsx` e manter a nova arquitetura isolada.
- **B — Integrar primeiro em `pages/BusinessIntelligence.tsx` (`/bi`):** Rejeitada porque `/bi` é restrita por `FeatureRoute("bi")` e tem perfil de exploração periódica, enquanto `/strategic-dashboard` é o painel diário de decisão do dono/gerente.
- **C — Enviar transações brutas para o LLM calcular métricas:** Rejeitada por alto custo de tokens e risco de alucinação matemática.
- **D — Implementar hard cap mensal (`monthly_ai_credits`) já na Fase 1:** Adiada para a Fase 2 por decisão do PO, mantendo a Fase 1 enxuta com trava diária (`1 geração/dia`).

## Consequences

### Positivas
- Zero risco de alucinação numérica (PostgreSQL calcula, Gemini interpreta).
- Custo estritamente limitado por `UNIQUE (tenant_id, reference_date)` e bypass em cold start (`appointment_count = 0`).
- Isolamento total de falhas em relação ao `SupportWidget.tsx`.

### Negativas / Trade-offs
- Na Fase 1, o gestor visualiza no máximo 1 diagnóstico atualizado por dia (sem botão de regeneração múltipla no mesmo dia até a Fase 2).
- Requer criação de 2 tabelas novas (`ai_insights`, `ai_usage_logs`), 1 RPC e 1 Edge Function, demandando aprovação do PO para este ADR e para a futura migration remota.
