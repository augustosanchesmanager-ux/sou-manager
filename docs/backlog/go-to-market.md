# Frente: Go-To-Market & Produto

- **Domínio:** Onboarding Self-Serve, Billing SaaS (Stripe), Remoção de Dados Hardcoded/Mock (Zero Mock) e Novas Capacidades (SMG Barber Intelligence)
- **Stack:** React 19 · TypeScript 5.8 · Supabase (PG + RLS + Edge Functions) · Stripe · Google Gemini 2.5 Flash
- **Referências obrigatórias:** `docs/audit-go-to-market/SMG_AUDITORIA_COMPLETA.md`, `docs/PLAN-smg-barber-intelligence.md`, `AGENTS.md`

---

## Índice da Frente

| ID | Título | Prioridade | Status |
|---|---|---|---|
| `GTM-001` | Billing Self-Serve (Stripe Checkout) + destravar plano inicial (`maxStaff: 1`) | `P0` | `TODO` |
| `GTM-002` | Remover strings hardcoded de cliente único (`"Sanchez Barber"`, `"Rubens, Heron, Lucas"`) do BI | `P0` | `TODO` |
| `GTM-003` | Substituir ou desativar Central de Automações (`/automations`) simulada em `localStorage` | `P0` | `TODO` |
| `GTM-004` | SMG Barber Intelligence — Fase 1 (`ai-analyst` + `ai_insights` + `ADR-050`) | `P2` | `BLOCKED` |

---

## `GTM-001` — Billing Self-Serve (Stripe) & Onboarding Comercial

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Feature`
- **Dependências:** Definição comercial do PO sobre preços, trial e limites de planos

### Problema / Objetivo
A auditoria Go-To-Market apontou que `pages/Landing.tsx:871` redireciona planos para WhatsApp (`wa.me/...`), `domain/billing/planCatalog.ts:51-55` possui `priceCents: 0` e o cadastro inicial cria o tenant no plano `free` com `maxStaff: 1`, bloqueando o fluxo self-serve para tráfego pago.

### Escopo Técnico
- `domain/billing/planCatalog.ts`, criação de checkout session Stripe (Edge Function + integração `stripe-webhook`) e fluxo `pages/Landing.tsx` → `pages/Register.tsx`.

### Critérios de Aceite
- [ ] Novo tenant consegue assinar/iniciar trial self-serve sem atendimento manual por WhatsApp.
- [ ] Catálogo de planos com preços e limites reais aprovados pelo PO.
- [ ] Isolamento multi-tenant (`tenant_id` / RLS) e idempotência de webhook validados.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —

---

## `GTM-002` — Remoção de Strings Hardcoded de Cliente Único no BI

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix`
- **Dependências:** Nenhuma

### Problema / Objetivo
Telas de BI Executivo vazam dados hardcoded da barbearia piloto (`"Sanchez Barber"`, `"Rubens, Heron, Lucas"`, `"augusto@sanchezbarber.com.br"`) em `components/bi/BiExecutiveCockpit.tsx:338` e `StaffProfitabilityTable.tsx:50`.

### Escopo Técnico
- `components/bi/BiExecutiveCockpit.tsx`, `StaffProfitabilityTable.tsx` e varredura complementar em `components/` e `pages/` por referências literais a `sanchez` / `Rubens` / `Heron`.

### Critérios de Aceite
- [ ] Zero menções hardcoded a `"Sanchez Barber"` ou equipe fixa em telas de BI e produto.
- [ ] Dados exibidos vêm exclusivamente do contexto do `tenant_id` autenticado.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —

---

## `GTM-003` — Central de Automações (`/automations`) sem Mock em `localStorage`

- **Status:** `TODO`
- **Prioridade:** `P0`
- **Tipo:** `Bugfix`
- **Dependências:** Decisão do PO (implementar backend real vs ocultar rota por feature flag pré-GTM)

### Problema / Objetivo
`pages/Automations.tsx:48-67` + `services/automationHubService.ts:161-229` operam 100% simulados em `localStorage` com fila fictícia e contatos hardcoded.

### Escopo Técnico
- `pages/Automations.tsx`, `services/automationHubService.ts` e `App.tsx` (rota `/automations`).

### Critérios de Aceite
- [ ] Nenhuma tela acessível em produção simula envio de mensagens ou grava fila falsa em `localStorage`.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** —

---

## `GTM-004` — SMG Barber Intelligence (Fase 1)

- **Status:** `BLOCKED`
- **Prioridade:** `P2`
- **Tipo:** `Feature`
- **Dependências:** Autorização explícita do PO para criação do `ADR-050` (roadmap congelado)

### Problema / Objetivo
Implementar Diagnóstico Inteligente de Gestão (3 cards estruturados via Gemini 2.5 Flash) para `owner`/`manager`, com cache diário em `ai_insights` e zero alucinação matemática via RPC `get_tenant_weekly_metrics`.

### Escopo Técnico
- Plano detalhado em `docs/PLAN-smg-barber-intelligence.md` (Edge Function `ai-analyst`, tabelas `ai_insights` e `ai_usage_logs`, serviço e UI *Atelier Tech*).

### Critérios de Aceite
- [ ] `ADR-050` aprovado pelo PO antes de qualquer código ou migration.
- [ ] RLS estrita por `tenant_id`, bypass de cold start (`appointment_count = 0`) e cache diário único.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` e `npm run build` passando.

### Evidência de Validação
- **Branch / PR:** —
- **Testes / Build:** —
- **Observações:** Aguardando liberação do PO após estabilização e bloqueadores P0 de Go-To-Market.
