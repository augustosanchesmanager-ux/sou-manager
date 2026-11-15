---
name: smg-discovery
description: Diagnosticar a solicitação, auditar o impacto no SMG e classificar o risco para definir a trilha de governança.
autoinvoke: false
---

# SMG Discovery Skill

**Objetivo:** Diagnosticar a solicitação, auditar o impacto no SMG e classificar o risco para definir a trilha de governança.

**Regras de Classificação de Risco:**
- `GREEN` (Trilha Verde): Alterações de UI (React/CSS/Tailwind), textos, refatorações isoladas no front-end sem impacto em estado global ou banco de dados.
- `YELLOW` (Trilha Amarela): Novas features de front-end consumindo APIs/Edge Functions já existentes, lógicas de negócios não críticas.
- `RED` (Trilha Vermelha): Migrations PostgreSQL, alterações em Supabase RPCs/RLS, autenticação, infraestrutura Vercel, ou mudanças na arquitetura multi-tenant.

**Output Obrigatório:**
A skill deve finalizar emitindo um bloco JSON estrito:
`{"risk_track": "GREEN|YELLOW|RED", "impact_summary": "..."}`
