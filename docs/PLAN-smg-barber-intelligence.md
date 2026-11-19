# Plano de Implementação — SMG Barber Intelligence (Fase 1)

> **Status:** Planejamento concluído (aguardando autorização do PO para criação do ADR e execução da Fase 1)  
> **Escopo:** Pilar 1 — Diagnóstico Inteligente de Gestão (Embedded AI)  
> **Stack:** React 19 · Vite 6 · TypeScript 5.8 · Supabase (PostgreSQL + RLS + Edge Functions) · Google Gemini 2.5 Flash  

---

## 1. Decisões Alinhadas (Design Tree)

1. **Caso de Uso da Fase 1:** Diagnóstico Inteligente de Gestão (somente leitura sobre métricas consolidadas, sem escrita financeira/operacional autônoma).
2. **Provedor de IA:** **Google Gemini 2.5 Flash** via API server-side com **JSON Schema estrito** (`responseSchema`) e segredo `GEMINI_API_KEY` no Supabase.
3. **Edge Function Dedicada:** Nova função [`supabase/functions/ai-analyst/index.ts`](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/supabase/functions/ai-analyst/index.ts), mantendo [`supabase/functions/gemini-assistant/index.ts`](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/supabase/functions/gemini-assistant/index.ts) e [`components/SupportWidget.tsx`](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/components/SupportWidget.tsx) intactos.
4. **Cache e Controle de Custo (Fase 1):** Cache diário na tabela `ai_insights` (máximo **1 geração por dia por tenant**) + registro de tokens em `ai_usage_logs`. Hard cap mensal por assinatura (`monthly_ai_credits`) fica postergado para a Fase 2.
5. **Localização no Front-end e Permissão:** Exibição na área estratégica/BI ([`pages/BusinessIntelligence.tsx`](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/BusinessIntelligence.tsx) ou [`pages/StrategicDashboard.tsx`](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/pages/StrategicDashboard.tsx), a confirmar na auditoria de rotas), restrito às roles `owner` e `manager` (UI + validação server-side na Edge Function).

---

## 2. Pré-requisito de Governança (SMG Change Control & ADR)

Conforme [`AGENTS.md`](file:///c:/SMG/04_PRODUTOS/SMG_BARBER/sou-manager/AGENTS.md):
- **Roadmap congelado (D1–D9):** A criação de novas tabelas (`ai_insights`, `ai_usage_logs`), nova RPC (`get_tenant_weekly_metrics`) e nova Edge Function (`ai-analyst`) configura mudança estrutural e **exige ADR aprovado pelo PO antes de qualquer código**.
- **Fluxo obrigatório:** `INTAKE → AUDIT → CLASSIFY → STOP/GATE` (aprovação do ADR) → `ISOLATE → IMPLEMENT → VALIDATE → STOP/GATE` → gates de commit/push/PR/deploy.
- **Migrations remotas:** Aplicação no banco remoto de produção exige aprovação explícita do PO (`MERGE ≠ DEPLOY PROD`).

---

## 3. Arquitetura Técnica da Fase 1

```
React (owner/manager)
  │  POST /functions/v1/ai-analyst (Bearer JWT)
  ▼
Supabase Edge Function: ai-analyst
  ├─ 1. Valida JWT + resolve tenant_id e role (apenas owner | manager)
  ├─ 2. Consulta ai_insights (cache do dia para tenant_id) -> se existir, retorna (0 tokens)
  ├─ 3. Chama RPC get_tenant_weekly_metrics(p_tenant_id) -> JSON determinístico (~1 KB)
  ├─ 4. Chama Gemini 2.5 Flash (System Prompt + JSON Schema estrito)
  ├─ 5. Persiste em ai_insights + registra tokens em ai_usage_logs
  └─ 6. Retorna cards estruturados ao React
```

### Contrato JSON de Saída (Structured Output)

```typescript
export interface AiInsightCard {
  title: string;
  alertLevel: 'info' | 'warning' | 'critical' | 'positive';
  diagnosis: string;
  recommendedAction: string;
}

export interface AiAnalystResponse {
  generatedAt: string;
  cached: boolean;
  cards: AiInsightCard[]; // exatamente 3 cards na Fase 1
}
```

### Blindagens Obrigatórias

- **Zero alucinação matemática:** O PostgreSQL calcula `SUM`, `AVG`, `COUNT`, taxas de ocupação e no-show na RPC; o LLM apenas interpreta o JSON exato.
- **Cold Start (custo zero):** Se `appointment_count = 0` na RPC, a Edge Function intercepta antes de chamar o Gemini e retorna um card estático de boas-vindas/instrução de preenchimento (0 tokens gastos).
- **Idempotência de Cache:** Restrição `UNIQUE(tenant_id, reference_date)` na tabela `ai_insights` (com `ON CONFLICT` / upsert seguro) para evitar chamadas duplicadas em aberturas simultâneas do painel.
- **Isolamento Multi-Tenant (RLS):** `ai_insights` e `ai_usage_logs` com coluna `tenant_id NOT NULL`, RLS usando `current_tenant_id_from_auth_uid()` e `current_is_super_admin_from_auth_uid()`.
- **Stateless:** Nenhum histórico compartilhado entre tenants nas chamadas ao Gemini.
- **Sem SQL livre:** A IA não recebe credencial nem ferramenta para executar queries arbitrárias.

---

## 4. Quebra de Tarefas (Task Breakdown)

| Ordem | Tarefa | Agente Responsável | Entregável | Critério de Verificação |
|---|---|---|---|---|
| **T0** | Auditoria de rotas (priorizando verificar se `StrategicDashboard.tsx` é o ponto focal diário vs `BusinessIntelligence.tsx`) e redação do **ADR-050** | `orchestrator` / `project-planner` | `docs/adr/ADR-050-smg-barber-intelligence-phase-1.md` | ADR revisado e **aprovado pelo PO** (STOP/GATE) |
| **T1** | Migration SQL: tabelas `ai_insights` (com `UNIQUE(tenant_id, reference_date)`) e `ai_usage_logs` + índices + políticas RLS multi-tenant | `backend-specialist` | `supabase/migrations/<timestamp>_ai_intelligence_phase_1.sql` | Migration idempotente, RLS validada por `tenant_id` |
| **T2** | RPC determinística `get_tenant_weekly_metrics(p_tenant_id uuid)` (métricas consolidadas da semana + comparativo semana anterior + `appointment_count`) | `backend-specialist` | Mesmo arquivo de migration ou migration dedicada + validação de `auth.uid()`/`tenant_id` | Retorno JSON enxuto (~1 KB), payload explícito em cold start, sem vazamento cross-tenant |
| **T3** | Edge Function `ai-analyst` (auth JWT, check `owner`/`manager`, cache diário em `ai_insights`, bypass em `appointment_count = 0`, chamada Gemini 2.5 Flash com JSON Schema, log em `ai_usage_logs`) | `backend-specialist` | `supabase/functions/ai-analyst/index.ts` | Testes unitários/contrato da função + tratamento 401/403/429/503 |
| **T4** | Serviço client-side tipado para consumir `ai-analyst` | `frontend-specialist` | `services/aiAnalystService.ts` (ou em `src/services/` após checar duplicatas) | Tipagem estrita, tratamento de erro/loading sem `createClient` cru |
| **T5** | Componente UI *Atelier Tech* com os 3 cards de diagnóstico + botão de atualização/estado em cache na página estratégica | `frontend-specialist` | Componente em `components/` + integração na página escolhida | Renderização fiel ao design system, restrito a `owner`/`manager` |
| **T6** | Testes unitários (serviço + componente + validação de contrato) e verificação dos gates | `test-engineer` | `*.test.ts(x)` seguindo `tests/README.md` | `npm run test`, `npm run typecheck`, `npm run build`, `npm run architecture:ci` |

---

## 5. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
|Divergência de schema entre `BusinessIntelligence.tsx` e `StrategicDashboard.tsx`| Confirmar rota ativa na tarefa **T0** antes de implementar **T5**. |
| Consumo indevido ou loop de chamadas à API Gemini | Cache diário único em `ai_insights` por `(tenant_id, reference_date)` (máx. 1 geração/dia). |
| Acesso por barbeiro/recepcionista sem permissão | Guard de rota no front (`ManagerRoute`) **e** validação de role (`owner`/`manager`) na Edge Function + RLS. |
| Violação de regras arquiteturais no CI | Rodar `npm run architecture:ci` e `git diff --check` antes de qualquer gate de commit. |

---

## 6. Checklist de Verificação (Phase X)

- [ ] ADR-050 criado e aprovado pelo PO antes da implementação
- [ ] `npm run typecheck` passa sem erros
- [ ] `npm run build` passa sem erros
- [ ] `npm run test` passa (incluindo novos testes unitários em AAA, sem alterar testes existentes para forçar aprovação)
- [ ] `npm run architecture:ci` passa dentro do baseline
- [ ] `git diff --check` limpo
- [ ] Aprovação explícita do PO obtida antes de commit, push, merge em `main` e aplicação da migration/deploy em produção
