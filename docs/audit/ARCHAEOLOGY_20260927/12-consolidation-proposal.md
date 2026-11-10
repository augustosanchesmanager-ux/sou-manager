# Proposta de Consolidação

**Data:** 2026-09-27 | **Modo:** READ-ONLY | **Gate:** PO pendente

---

## 1. Premissa

O roadmap está congelado desde 2026-07-24. O único produto comercialmente ativo é **SMG Barber**. Esta proposta consolida os achados dos 6 repositórios auditados em recomendações de consolidação, sem propor mudanças arquiteturais que não passem por ADR.

---

## 2. Estado Atual do Ecossistema

### 2.1 Repositórios e seu Status

| Repositório | Status | Ação Sugerida |
|---|---|---|
| `sou-manager` | ✅ Produto ativo, produção certificada | **MANTER** como SoT |
| `sanchez-barber-iastudio` | 🔴 Integração quebrada, 120 dias parado | **DESCARTAR** código; **RETER** artefatos de UX |
| `SMG_LOUGE` | 🟠 Split-brain, 4 meses parado | **REESCREVER** sobre SoT; **RETER** UX components |
| `gerador_orcamentos` | 🔴 service_role em produção, 4 meses parado | **DESCARTAR** código; **RETER** padrões de catálogo |
| `smg-core` | 🔴 Duas stacks, 5 meses parado | **DESCARTAR** como base; **RETER** peças de valor |
| `SMG_AUTOCONTROL` | 🟡 Mockup estático, 193 dias parado | **DESCARTAR** código; **RETER** domínio automotivo |
| `SMG_LADINGPAGE` | 🟠 Não-deployada, 156 dias parado | **REESCREVER** sobre SoT; **RETER** copy |

### 2.2 Princípio Geral

> **Nenhum repositório externo é base de código.** O `sou-manager` é a Source of Truth. Todos os outros são fontes de **artefatos** (UX, copy, padrões, domínio) que devem ser extraídos e adaptados ao SoT.

---

## 3. Consolidação por Área

### 3.1 Segurança

| Ação | Prioridade | Origem | Destino |
|---|---|---|---|
| Remover service_role JWT do bundle | **P0** | gerador | — |
| Rotacionar service_role key | **P0** | gerador | — |
| Aplicar RLS em `budgets` e `customers` | **P0** | gerador | — |
| Corrigir mock super_admin com gating | **P1** | LOUGE | LOUGE |
| Adicionar `platform_security_events` ao SoT | **P1** | smg-core | sou-manager |
| Adicionar `count_active_super_admins()` | **P2** | smg-core | sou-manager |
| Corrigir escalão de privilégio | **P1** | smg-core | smg-core |
| Adicionar `set_config('app.tenant_id')` | **P1** | LOUGE | LOUGE |

### 3.2 Integração

| Ação | Prioridade | Origem | Destino |
|---|---|---|---|
| Corrigir endpoint + payload site→SMG | **P0** | sanchez | sanchez |
| Ou abandonar integração oficialmente | **P0** | sanchez | — |
| Adicionar idempotency key ao site | **P1** | sanchez | sanchez |
| Migrar `SupabaseSync` para `lounge.*` | **P1** | LOUGE | LOUGE |
| Corrigir 4 rotas quebradas do admin | **P1** | smg-core | smg-core |
| Adicionar `site-sanchez-appointments` ao site | **P1** | sou-manager | sanchez |

### 3.3 UX/Componentes

| Ação | Prioridade | Origem | Destino | Classificação |
|---|---|---|---|---|
| Extrair brand kit (tokens + classes) | **P1** | LADINGPAGE | sou-manager | 🟢 COPIAR |
| Adaptar CommandPalette | **P2** | LOUGE | sou-manager | 🟡 ADAPTAR |
| Adaptar KpiCard/EventKpiCard | **P2** | LOUGE | sou-manager | 🟢 COPIAR |
| Adaptar DoorCheckin/Stock | **P2** | LOUGE | sou-manager | 🟡 ADAPTAR |
| Adaptar booking wizard | **P2** | sanchez | sou-manager | 🟡 ADAPTAR |
| Adaptar grade de 4 KPIs | **P2** | AUTOCONTROL | sou-manager `auto` | 🟡 ADAPTAR |
| Adaptar funil de OS em 4 cards | **P2** | AUTOCONTROL | sou-manager `auto` | 🟡 ADAPTAR |
| Adaptar 3 cards financeiros | **P2** | AUTOCONTROL | sou-manager `auto` | 🟡 ADAPTAR |
| Reutilizar copy PainPoints | **P1** | LADINGPAGE | sou-manager | 🟢 COPIAR |
| Reutilizar Differentiators | **P1** | LADINGPAGE | sou-manager | 🟢 COPIAR |

### 3.4 Dados/Arquitetura

| Ação | Prioridade | Origem | Destino | Classificação |
|---|---|---|---|---|
| Adicionar `smg_client_apps` ao SoT | **P1** | smg-core | sou-manager | ⭐ GAP |
| Adicionar `app_health_checks` ao SoT | **P2** | smg-core | sou-manager | ⭐ GAP |
| Adicionar `app_incidents` ao SoT | **P2** | smg-core | sou-manager | ⭐ GAP |
| Adicionar `platform_security_events` ao SoT | **P1** | smg-core | sou-manager | ⭐ GAP |
| Replicar padrão de catálogo | **P2** | gerador | sou-manager | 🟡 REFERÊNCIA |
| Replicar pipeline PDF | **P3** | gerador | sou-manager | 🟡 REFERÊNCIA |
| Corrigir split-brain schema | **P1** | LOUGE | LOUGE | 🔴 REESCREVER |
| Rejeitar `company_id` → `tenant_id` | **P0** | AUTOCONTROL | AUTOCONTROL | 🔴 REESCREVER |

### 3.5 Marketing

| Ação | Prioridade | Origem | Destino | Classificação |
|---|---|---|---|---|
| Reconstruir funil de captura | **P0** | LADINGPAGE | LADINGPAGE | 🔴 REESCREVER |
| Reutilizar copy PainPoints | **P1** | LADINGPAGE | LADINGPAGE | 🟢 COPIAR |
| Reutilizar Differentiators | **P1** | LADINGPAGE | LADINGPAGE | 🟢 COPIAR |
| Reutilizar design tokens | **P1** | LADINGPAGE | LADINGPAGE | 🟢 COPIAR |
| Recuperar catálogo de produtos do git | **P2** | LADINGPAGE | LADINGPAGE | 🟡 ADAPTAR |
| Corrigir nomenclatura de marca | **P1** | LADINGPAGE | LADINGPAGE | 🟡 ADAPTAR |
| Adicionar analytics | **P2** | LADINGPAGE | LADINGPAGE | 🟡 ADAPTAR |
| Adicionar `vercel.json` | **P2** | LADINGPAGE | LADINGPAGE | 🟡 ADAPTAR |

### 3.6 Governança

| Ação | Prioridade | Origem | Destino |
|---|---|---|---|
| Atualizar `AGENTS.md` para incluir `estetica` | **P0** | sou-manager | sou-manager |
| Atualizar `docs/TAXONOMY.md` para incluir `estetica` | **P0** | sou-manager | sou-manager |
| Definir módulos de `auto` em `APP_ENABLED_MODULES` | **P1** | sou-manager | sou-manager |
| Confirmar se `club` e `estetica` são produtos ou módulos | **P1** | sou-manager | sou-manager |
| Remover dead code dos repositórios | **P2** | Todos | Todos |
| Adicionar `.gitignore` para `*.err`, `fetch_results.txt` | **P2** | sanchez | sanchez |

---

## 4. Decisões do PO Necessárias

| # | Decisão | Motivo | Urgência |
|---|---|---|---|
| D-1 | Autorizar SMG Auto Control como 2º produto comercial? | Roadmap congelado; só Barber é ativo | Alta |
| D-2 | "Mão de obra" → como mapeia no domínio `commission/`? | ADR-001 exige separação | Alta |
| D-3 | Definir módulos de `auto` em `APP_ENABLED_MODULES` | Hoje `[]` — tudo bloqueado | Alta |
| D-4 | Atualizar `AGENTS.md` + `TAXONOMY.md` para incluir `estetica` | Divergência documental existente | **Máxima** |
| D-5 | Confirmar se `club` e `estetica` são produtos, módulos ou slots | Inconsistência de nomenclatura | Média |
| D-6 | Preço público ou formulário de qualification? | Sem preço, toda conversão depende de WhatsApp fake | Alta |
| D-7 | A integração site→SMG está abandonada ou pivô temporário? | Evidência sugere pivô, mas não documentado | Alta |
| D-8 | A Sanchez Barber é tenant do SMG? Qual o `tenant_id`? | Edge Function exige `SANCHEZ_TENANT_ID` | Alta |
| D-9 | Restaurar barra de métricas (500+/R$12M/99.9%)? | Risco de propaganda enganosa | Média |
| D-10 | Billing via smg-core draft ou nativo? | Draft existe mas nunca aplicado | Média |

---

## 5. Decisões do OpenCode (dentro da alçada)

| # | Decisão | Motivo | Aprovação PO necessária? |
|---|---|---|---|
| O-1 | Rejeitar `company_id` → `tenant_id` | Taxonomia de infraestrutura | ❌ Não |
| O-2 | Não portar o AutoControl | Reclassificar como material de pesquisa | ❌ Não |
| O-3 | Não criar schema `auto.*` sem `tenant_id NOT NULL` + RLS | Segurança multi-tenant | ❌ Não |
| O-4 | Não tratar sanchez como base de código | Integração fiction + shadow DB | ❌ Não |
| O-5 | Não adotar smg-core como base | Duas stacks + RBAC morto | ❌ Não |
| O-6 | Extrair brand kit do LADINGPAGE | Reuso de design system | ❌ Não |
| O-7 | Remover dead code dos repositórios | Qualidade | ❌ Não |

---

## 6. Sequência de Execução Sugerida

```
Fase 1 (P0 — Imediato):
  ├── Corrigir service_role JWT (gerador)
  ├── Atualizar AGENTS.md + TAXONOMY.md (estetica)
  ├── Rejeitar company_id → tenant_id (AUTOCONTROL)
  └── Reconstruir funil de captura (LADINGPAGE)

Fase 2 (P1 — Curto Prazo):
  ├── Corrigir integração site→SMG OU abandonar
  ├── Corrigir mock super_admin (LOUGE)
  ├── Corrigir split-brain schema (LOUGE)
  ├── Corrigir 4 rotas quebradas (smg-core)
  ├── Adicionar security_events ao SoT (smg-core)
  ├── Extrair brand kit (LADINGPAGE → sou-manager)
  └── Definir módulos de auto (APP_ENABLED_MODULES)

Fase 3 (P2 — Médio Prazo):
  ├── Adaptar UX components (LOUGE, sanchez, AUTOCONTROL)
  ├── Adicionar app_health_checks + app_incidents
  ├── Replicar padrão de catálogo + PDF
  ├── Recuperar catálogo de produtos do git
  └── Adicionar analytics + vercel.json

Fase 4 (P3 — Longo Prazo):
  ├── Replicar pipeline PDF
  ├── Definir modelo de planos
  ├── Adaptar promoter commissions
  └── Remover dead code de todos os repositórios
```

---

## 7. Riscos da Consolidação

| # | Risco | Mitigação |
|---|---|---|
| CR-1 | Tentar portar código de repo abandonado | Manter princípio: artefatos, não código |
| CR-2 | Introduzir vulnerabilidades ao adaptar | Seguir padrões de segurança do SoT |
| CR-3 | Criar segunda taxonomia de tenancy | Rejeitar `company_id` desde o início |
| CR-4 | Perder tempo com repositórios sem valor | Priorizar P0/P1; arquivar P3 |
| CR-5 | Ignorar o roadmap congelado | Toda mudança passa por ADR |

---

## 8. Veredito da Proposta

**O `sou-manager` é a Source of Truth.** Os 6 repositórios externos são fontes de artefatos (UX, copy, padrões, domínio) que devem ser extraídos e adaptados — nunca portados como base de código.

**Ação imediata do PO:**
1. Corrigir service_role JWT (risco crítico de segurança)
2. Atualizar documentação para incluir `estetica` (divergência documental)
3. Decidir sobre integração site→SMG

**Nenhuma implementação foi autorizada.** Esta proposta é um mapa de evidências para decisão do PO.

---

Gerado por frente SMG Repository Archaeology — AUDIT → EVIDENCE → REPORT → STOP. Nenhuma implementação autorizada. Gate PO pendente.
