# ADR-057: BI Estratégico Explicativo & Copiloto IA Interativo (SMG Barber Intelligence — Fase 2)

**Status:** Accepted (2026-11-26 — aprovação explícita do PO para implementação dos Lotes 1 e 2)
**Date:** 2026-11-26
**Deciders:** PO (Augusto) + Antigravity
**References:**
- `docs/adr/ADR-001-Commission-vs-Settlement.md` (separação inviolável entre comissão teórica e fechamento de caixa)
- `docs/adr/ADR-050-smg-barber-intelligence-phase-1.md` (base `ai-analyst`, `ai_insights`, `ai_usage_logs`, `get_tenant_weekly_metrics`)
- `AGENTS.md` (roadmap congelado: evolução estrutural de BI/IA exige ADR aprovado pelo PO)

---

## Context

Com a Fase 1 do **SMG Barber Intelligence** (`ADR-050`) promovida em produção (`Run #45609827004`), o painel `/bi` já entrega 3 cards diários de diagnóstico via `ai-analyst`. Entretanto, na revisão de produto conduzida pelo PO (2026-11-26), ficaram evidentes lacunas que impedem o painel de atuar como ferramenta real de decisão para donos de barbearias:

1. **Gráficos e números sem contexto explicativo:** a Previsão Estratégica (`StrategicForecastCard.tsx`) usa multiplicadores fixos opacos (`0.5` comissão, `0.025` taxa, `0.4` walk-in) sem explicar a memória de cálculo nem orientar ação; o DRE/Liquidez (`BiExecutiveCockpit.tsx`, `LiquidityWaterfallCard.tsx`) exibe números sem tradução prática para gestores iniciantes.
2. **Visualizações pouco acionáveis:** produtividade e lucratividade por barbeiro (`StaffProfitabilityTable.tsx`) usam barras horizontais pouco legíveis; o gráfico atual de "Serviços Mais Vendidos" não orienta decisão de mix/preço; a "Evolução do Faturamento" apresenta inconsistência de cálculo.
3. **IA passiva (somente 3 dicas estáticas):** o gestor precisa de um **Copiloto Estratégico** calibrado para a realidade das barbearias modernas (automação, tráfego pago, recorrência/Club dos Chefes, presença digital) que não apenas aponte gargalos, mas ajude interativamente a **construir a estratégia** (campanhas, criativos/ofertas para horários ociosos, metas por barbeiro).

---

## Problem

Como evoluir o `/bi` e o `ai-analyst` para a Fase 2 mantendo:
1. **Zero gráfico decorativo (Diretriz do PO):** todo gráfico deve ter cálculo auditável, legenda explicativa clara e pergunta de negócio respondida;
2. **Zero alucinação matemática:** toda agregação continua 100% determinística via SQL/RPC (o LLM nunca soma ou estima números do banco);
3. **Isolamento multi-tenant estrito e controle de custo:** RLS por `tenant_id`, restrição a `owner`/`manager`/`superadmin`, limite diário de interações por tenant e registro em `ai_usage_logs`;
4. **Conformidade com ADR-001:** nunca misturar comissão teórica com liquidação efetiva de caixa.

---

## Decision

Aprovar a arquitetura da **Fase 2 do BI Estratégico e Copiloto IA** em 2 pilares:

### Pilar 1 — Reformulação Funcional e Explicativa dos Gráficos do `/bi`
1. **Evolução do Faturamento (`pages/BusinessIntelligence.tsx` / `useBusinessInsights.ts`):**
   - Corrigir o cálculo da série temporal para consolidar estritamente comandas pagas/fechadas no fuso `America/Sao_Paulo` (`closed_at`/`settled_at`), eliminando distorções de período.
2. **Previsão Estratégica (`StrategicForecastCard.tsx`):**
   - Substituir percentuais fixos por taxas reais históricas do próprio tenant (com fallback explícito e rotulado quando não houver histórico suficiente).
   - Incluir bloco **"Como calculamos + O que fazer agora"** traduzindo a projeção em ação prática (ex.: quantos agendamentos/dia faltam para bater a meta).
3. **Liquidez & DRE (`BiExecutiveCockpit.tsx`, `LiquidityWaterfallCard.tsx`):**
   - Adicionar explicação direta em português claro em cada etapa (*Faturamento Bruto → Comissões → Taxas de Maquininha → Despesas → Caixa Real*) com leitura guiada para gestores iniciantes.
4. **Produtividade & Lucratividade por Barbeiro (`StaffProfitabilityTable.tsx`):**
   - Substituir barras horizontais por **gráfico de barras verticais** comparando Faturamento Bruto vs Margem/Retorno da Casa por profissional, acompanhado de nota explicativa.
5. **Serviços Mais Vendidos → Matriz 2×2 (Volume × Ticket):**
   - Substituir o gráfico atual por uma **Matriz 2×2 acionável** (eixo X = Volume de vendas; eixo Y = Ticket médio do serviço), classificando automaticamente cada serviço em **Estrelas** (alto volume + alto ticket), **Oportunidades** (baixo volume + alto ticket), **Motor de Giro** (alto volume + ticket baixo) e **Revisar** (baixo volume + ticket baixo), com orientação explícita de ação por quadrante.

### Pilar 2 — Copiloto Estratégico Interativo no `/bi` (`ai-analyst` Fase 2)
1. **Contrato da Edge Function `supabase/functions/ai-analyst/index.ts` (extensão retrocompatível):**
   - Mantém o modo `mode: "daily_diagnosis"` (Fase 1, cache diário 0 tokens).
   - Adiciona o modo interativo `mode: "strategy_copilot"` aceitando:
     - `actionType`: `'campaign' | 'paid_traffic' | 'goals' | 'free_chat'`
     - `prompt` (opcional para `free_chat`) + histórico curto da sessão (máx. 6 turnos, sem persistir dados sensíveis de clientes).
   - Injeta contexto determinístico real do tenant (faturamento, ticket médio, horários ociosos do heatmap, taxa de retorno/churn, Club dos Chefes, top/bottom serviços da Matriz 2×2 e performance por barbeiro) via RPC `SECURITY DEFINER` com isolamento `tenant_id`.
   - Prompt de sistema calibrado com playbook prático de barbearias modernas (**automação de WhatsApp/retorno, tráfego pago local, ofertas para horários ociosos, upsell de produtos e recorrência**), devolvendo plano estruturado passo a passo (objetivo, público, oferta, mensagem/roteiro pronto e meta de acompanhamento).
2. **Controle de Custo & Segurança:**
   - Rate limit server-side por `tenant_id` (ex.: 20 interações/dia no plano Pro/Premium, contabilizado via `ai_usage_logs`).
   - Exclusivamente **read-only** (não altera preços, agenda ou financeiro automaticamente).
   - Acesso restrito a `owner`, `manager` e `superadmin` (`verify_jwt = true`).
3. **UI Interativa (`components/bi/AiIntelligencePanel.tsx`):**
   - Mantém os 3 cards de diagnóstico automático no topo.
   - Adiciona **botões de ação rápida** (*Montar campanha*, *Criar plano de tráfego pago*, *Ajustar metas*) e **chat livre contextualizado** diretamente no painel `/bi`, 100% compatível com Light/Dark Mode.

---

## Alternatives Considered

- **A — Apenas texto estático sem chat/ações:** rejeitada pelo PO por não gerar impacto prático no dia a dia do gestor.
- **B — Permitir que a IA execute campanhas ou altere preços diretamente:** rejeitada por risco operacional e financeiro sem validação humana.

---

## Consequences

- **Positivas:** transforma o `/bi` de um painel passivo em um copiloto executivo real, com gráficos 100% explicativos e planos práticos gerados sobre dados reais da barbearia.
- **Requisitos de entrega (após aprovação deste ADR pelo PO):**
  - **Lote 1 (Front-end BI):** correção do cálculo de Evolução do Faturamento, textos explicativos de Previsão/DRE, barras verticais de produtividade e Matriz 2×2 de serviços (branch isolada `feat/bi-explanatory-charts`).
  - **Lote 2 (Copiloto IA Fase 2):** extensão da RPC de contexto, modo `strategy_copilot` no `ai-analyst` com rate limit e UI interativa (botões + chat) no `AiIntelligencePanel.tsx` (branch isolada `feat/bi-ai-copilot-phase2`).
