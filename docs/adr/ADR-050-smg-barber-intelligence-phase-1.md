# ADR-050: SMG Barber Intelligence — Fase 1 (Diagnóstico Executivo com IA Embarcada)

**Status:** Accepted (2026-11-25 — aprovação explícita do PO para criação do ADR-050 e implementação da Fase 1 / `#403`)
**Date:** 2026-11-25
**Deciders:** PO (Augusto) + Antigravity
**References:**
- Issue [#403](https://github.com/augustosanchesmanager-ux/sou-manager/issues/403) (`GTM-004`)
- `docs/PLAN-smg-barber-intelligence.md`
- `docs/backlog/go-to-market.md`
- `AGENTS.md` (roadmap congelado: novas tabelas, RPC e Edge Function exigem ADR aprovado pelo PO)

---

## Context

O módulo de Business Intelligence (`/bi`, unificado em `UXQ-001` / PR `#423`) exibe métricas operacionais e financeiras consolidadas para donos e gestores de barbearias, mas ainda exige leitura manual de múltiplos gráficos para identificar gargalos semanais (queda de faturamento, aumento de cancelamentos/no-show, ociosidade).

## Problem

Como entregar diagnósticos executivos acionáveis com IA embarcada **sem**:
1. alucinação matemática (LLM nunca calcula `SUM`/`AVG`/`COUNT`);
2. vazamento cross-tenant (isolamento estrito por `tenant_id` via RLS e validação server-side);
3. explosão de custo de API (cache diário obrigatório + bypass de custo zero para cold start);
4. exposição de escrita autônoma em dados financeiros ou de agenda.

## Decision

Aprovar a implementação da **Fase 1 do SMG Barber Intelligence** com arquitetura 100% somente-leitura:

1. **Persistência & Isolamento (`supabase/migrations/20261125070000_gtm004_ai_intelligence_phase1.sql`):**
   - Tabela `public.ai_insights` com `tenant_id NOT NULL`, `reference_date date NOT NULL`, `UNIQUE(tenant_id, reference_date)` (cache diário idempotente) e RLS via `current_tenant_id_from_auth_uid()` / `current_is_super_admin_from_auth_uid()`.
   - Tabela `public.ai_usage_logs` com `tenant_id NOT NULL`, modelo, `prompt_tokens`, `completion_tokens`, `total_tokens`, latência e RLS multi-tenant.
   - RPC determinística `public.get_tenant_weekly_metrics(p_tenant_id uuid)` (`SECURITY DEFINER`, `SET search_path = public`), validando `auth.uid()` + pertencimento ao tenant (ou superadmin) e retornando JSON enxuto (~1 KB) com métricas da semana atual vs semana anterior e `appointment_count`.
2. **Edge Function dedicada (`supabase/functions/ai-analyst/index.ts`, `verify_jwt = true` em `supabase/config.toml`):**
   - Valida JWT e restringe acesso a `owner`, `manager` e `superadmin` (demais roles recebem `403`).
   - Verifica cache diário em `ai_insights` antes de qualquer chamada externa (0 tokens em cache hit).
   - Executa `get_tenant_weekly_metrics`; se `appointment_count = 0`, retorna diagnóstico de cold start estático (0 tokens).
   - Invoca **Google Gemini 2.5 Flash** (`GEMINI_API_KEY`) com `responseMimeType: "application/json"` e `responseSchema` estrito retornando exatamente 3 cards (`title`, `alertLevel`, `diagnosis`, `recommendedAction`).
   - Persiste cache (`upsert` em `ai_insights`) e auditoria de consumo (`ai_usage_logs`).
3. **Front-end (`/bi`):**
   - Serviço tipado `src/modules/intelligence/aiAnalystService.ts` (via `getSharedClient()` — nunca `createClient` cru).
   - Painel *Atelier Tech* `components/bi/AiIntelligencePanel.tsx` integrado ao `pages/BusinessIntelligence.tsx` (restrito a `manager`/`owner`/`superadmin`, respeitando a paleta SMG sem violeta/roxo).

## Alternatives Considered

- **A — Chamar Gemini diretamente do browser com `VITE_GEMINI_API_KEY`:** rejeitada por expor chave, impedir controle de custo centralizado e burlar cache diário/auditoria.
- **B — Permitir que a IA consulte SQL livre:** rejeitada por risco de segurança multi-tenant e alucinação.

## Consequences

- **Positivas:** diagnóstico diário acionável com custo previsível (máx. 1 chamada/dia/tenant), zero alucinação numérica e isolamento multi-tenant garantido no banco.
- **Requisitos operacionais de deploy (governança separada):**
  - Aplicar a migration no banco remoto de produção exige autorização explícita do PO.
  - Deploy da Edge Function `ai-analyst` e verificação do secret `GEMINI_API_KEY` no Supabase de produção.
