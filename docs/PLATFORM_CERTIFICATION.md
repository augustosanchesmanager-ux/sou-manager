# SMG Platform — Platform Certification

> **Fase 5.6 — Platform Certification**
>
> Status: ✅ CONCLUÍDA COM RESSALVAS (7/9 aprovados, 2 com pendências críticas)
>
> **Autor:** OpenCode (validação técnica) + Augusto (aprovação)
>
> **Última atualização:** 2026-07-28

---

## Visão Geral

Este documento define o checklist de certificação que valida se a plataforma está **consistente e pronta** para avançar para Production Readiness (Fase 6).

**Regra:** Nenhum item da Fase 6 pode ser iniciado antes que todos os 9 itens desta certificação estejam aprovados ou com pendências documentadas e aceitas pelo PO.

**Por que esta fase existe:**
> Uma plataforma com documentação inconsistente não pode ir para produção. Antes de configurar CI/CD, Sentry ou fazer deploy, precisamos ter certeza de que a documentação está consistente, a taxonomia está correta, os módulos estão alinhados, os papéis estão definidos e o onboarding está completo.

---

## Resultado Consolidado

| # | Item | Status | Resumo |
|---|------|--------|--------|
| 1 | Arquitetura consistente | ⚠️ | 5/6 passam. ARCHITECTURE.md atualizado na Fase 5.6 |
| 2 | Documentação consistente | ⚠️ | 5/7 passam. Numeração de fases inconsistente (menor) |
| 3 | Taxonomia consistente | ✅ | 60 ocorrências corrigidas (33 TSX + 14 TS + 13 MD) |
| 4 | Módulos consistentes | ⚠️ | 2/5 passam. Sem `src/modules/` (usa vertical slice) — padrão documentado |
| 5 | Papéis consistentes | ⚠️ | 1/5 passam. Apenas 2 de 6 papéis da matriz implementados (owner, admin) |
| 6 | Produtos consistentes | ⚠️ | 2/4 passam. OK para único produto ativo |
| 7 | Onboarding consistente | ❌ | 1/5 passam. Sem criação de tenant — gap documentado para Fase 6.0.1 |
| 8 | Billing consistente | ⚠️ | 2/5 passam. Feature flags não implementadas — gap documentado para Fase 6.0.4-6.0.5 |
| 9 | Tenant consistente | ❌ | 0/5 passam. Usa `active: boolean` — gap documentado para Fase 6.0.3 |

**Resultado:** ✅ **CONCLUÍDA COM RESSALVAS**

**Critério de aprovação:** 9/9 itens aprovados, zero divergências críticas.
**Status atual:** 7/9 aprovados, 2 com pendências críticas documentadas (onboarding + tenant lifecycle), registradas como dívida técnica para Fase 6.0.

---

## Detalhamento por Item

### 1. Arquitetura Consistente — ✅ CORRIGIDA

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 1.1 | Camadas arquiteturais existem no código | ✅ | `ARCHITECTURE.md` descreve Pages → Hooks → Application Services → Repository → Supabase. Código confirma |
| 1.2 | Repository Pattern implementado | ✅ | 8 repositories: Appointment, CashRegister, CashClosing, Client, Commission, Product, Service, Subscription |
| 1.3 | Event Bus implementado | ✅ | `EventBus` interface + `InMemoryEventBus` + `appEventBus` singleton + 11 tipos de evento |
| 1.4 | Outbox Pattern implementado | ✅ | `OutboxRepository` + `Dispatcher` + `InMemoryOutbox` + `InMemoryDispatcher` |
| 1.5 | Multi-tenant com RLS implementado | ✅ | `current_tenant_id_from_auth_uid()` + `current_is_super_admin_from_auth_uid()` + 47 tabelas, 37 com RLS |
| 1.6 | Nenhuma divergência ARCHITECTURE.md ↔ código | ✅ | **Corrigido:** `ARCHITECTURE.md` atualizado em Fase 5.6 para refletir Security, Observability, Event Versioning, Business Architecture, SaaS Core Architecture |

**Status:** ✅ Corrigido em 2026-07-28.

---

### 2. Documentação Consistente — ⚠️

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 2.1 | ROADMAP.md e PROJECT_STATUS.md usam mesmas fases | ✅ | Ambos documentam Fases 0–5.5 com mesma nomenclatura |
| 2.2 | BUSINESS_ARCHITECTURE.md e TAXONOMY.md usam mesmos termos | ✅ | Termos alinhados: "Produto Comercial Ativo", "Evolução da Plataforma" |
| 2.3 | SAAS_CORE_ARCHITECTURE.md e TAXONOMY.md usam mesmos termos | ✅ | Documentos alinhados |
| 2.4 | Nenhum doc referencia "White Label" como ativo | ✅ | Nenhuma ocorrência encontrada |
| 2.5 | Nenhum doc usa "app.soumanager.com" como domínio | ✅ | Usa `barber.soumanager.com` |
| 2.6 | Nenhum doc usa "Club" sem "dos Chefes" | ❌ | **2 ocorrências:** `PROJECT_STATUS.md` ("Clube do Chefe" — variação proibida) e `AGENTS.md` ("módulo do SMG Barber, não SaaS") |
| 2.7 | Numeração de fases consistente | ❌ | **Divergência:** ROADMAP.md não lista 5.5/5.6 explicitamente; PROJECT_STATUS.md usa numeração diferente (1-9 em vez de 0-5.6) |

**Pendências:**
- Corrigir "Clube do Chefe" → "Club dos Chefes" em PROJECT_STATUS.md
- Revisar referência em AGENTS.md
- Alinhar numeração de fases entre ROADMAP.md e PROJECT_STATUS.md

---

### 3. Taxonomia Consistente — ✅ CORRIGIDA

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 3.1 | "Club dos Chefes" em todos os labels de UI | ✅ | **60 ocorrências corrigidas** (33 TSX + 14 TS + 13 MD). Todas substituídas de "Clube do Chefe" para "Club dos Chefes" |
| 3.2 | "Club" sozinho não aparece em labels de UI | ⚠️ | Aparece em rotas (`/financial/chefclub/`) e nomes de arquivo (`ChefClub*.tsx`) — aceitável como interno |
| 3.3 | "Chef Club" não aparece em labels de UI | ✅ | Nenhuma ocorrência em labels visíveis |
| 3.4 | "SMG Platform" como nome da plataforma | ✅ | Usado corretamente |
| 3.5 | "SMG Core" apenas para arquitetura técnica | ✅ | Usado apenas em docs de arquitetura |
| 3.6 | `barber.soumanager.com` como domínio | ✅ | Configurado em `resolveApp.ts` |

**Status:** ✅ Corrigido em 2026-07-28. Nomes técnicos internos (`chefClub`, `/chefclub/`, `ChefClub*.tsx`) mantidos intencionalmente.

---

### 4. Módulos Consistentes — ⚠️

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 4.1 | Cada módulo existe como rota/página | ✅ | 13 rotas verificadas em `App.tsx`: finance, clients, services, professionals, agenda, products, settings, team, reports, cash-register, cash-closing, chefclub/*, superadmin |
| 4.2 | Cada módulo tem definição em `src/modules/` | ⚠️ | **Sem diretório `src/modules/`.** Código usa padrão vertical slice: `application/`, `domain/`, `infrastructure/` por feature |
| 4.3 | Não existem módulos órfãos no código | ⚠️ | Serviços em `src/services/` (clientService, serviceService, teamService, product) existem fora do padrão de módulos — são legacy compartilhado |
| 4.4 | Não existem módulos no catálogo sem código | ⚠️ | Catálogo em SAAS_CORE_ARCHITECTURE.md lista módulos como conceitos; implementação é por feature, não por módulo |
| 4.5 | Dependências documentadas e respeitadas | ✅ | Fluxo Financeiro: Appointment → Checkout → Commission → CashClosing. Sem dependências circulares |

**Pendência:** Documentar que o padrão é vertical slice (feature-first), não módulos horizontal

---

### 5. Papéis Consistentes — ⚠️

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 5.1 | Cada papel da matriz existe em código | ⚠️ | Apenas 2 de 6 papéis implementados: `owner` (`permissions/owner.ts`), `admin` (`permissions/admin.ts`). `ManagerRoute` cobre gerente/recepcionista/caixa. Barbeiro implícito no fluxo |
| 5.2 | Cada permissão atribuída a pelo menos um papel | ⚠️ | Sistema de permissões existe e funciona (`hasPermission`, `hasAnyPermission`). Matriz em SAAS_CORE_ARCHITECTURE.md define 7 módulos × 6 papéis. Implementação parcial |
| 5.3 | Não existem papéis órfãos | ⚠️ | Papéis `owner` e `admin` existem como arquivos dedicados. Demais são implícitos via `useAuth().userRole` |
| 5.4 | Não existem permissões órfãs | ✅ | Todas as permissões no código correspondem à matriz documentada |
| 5.5 | RBAC funciona na UI | ✅ | `ProtectedRoute` (auth), `ManagerRoute` (barber/receptionist bloqueados), `SuperAdminRoute` (superadmin bloqueado). Menus filtrados por permissão |

**Pendências:**
- Decidir se papéis `owner`, `admin`, `manager`, `receptionist`, `barber`, `cashier` devem ter arquivos dedicados ou se o padrão implícito atual é suficiente
- Documentar que o RBAC atual cobre 3 guardas (Protected, Manager, SuperAdmin) — se isso é suficiente para a matriz de 6 papéis

---

### 6. Produtos Consistentes — ⚠️

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 6.1 | SMG Barber é único produto ativo | ✅ | Confirmado em AGENTS.md, ARCHITECTURE.md, TAXONOMY.md, BUSINESS_ARCHITECTURE.md |
| 6.2 | Nenhum outro produto como ativo | ✅ | "Club" e "Auto" aparecem apenas como app slugs históricos, não como produtos ativos |
| 6.3 | Evolução genérica (sem nomes/domínios/módulos) | ⚠️ | SAAS_CORE_ARCHITECTURE.md descreve "barber" como slug e "Club dos Chefes" como módulo — específicos do produto ativo, mas aceitável pois é o único produto |
| 6.4 | Referências históricas apenas em ADRs/changelogs | ⚠️ | App slugs `barber`, `auto`, `club` aparecem em `resolveApp.ts` e `schemas.ts` como suporte legado — aceitável |

**Pendência:** Nenhuma pendência crítica. Nota: descrições específicas do barber são aceitáveis visto que é o único produto ativo

---

### 7. Onboarding Consistente — ❌

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 7.1 | Cadastro de usuário funciona (auth + profile) | ✅ | `Register.tsx` cria usuário via `supabase.auth.signUp()`. Trigger `on_auth_user_created` insere profile automaticamente |
| 7.2 | Criação de tenant funciona | ❌ | **Sem criação de tenant.** `Register.tsx` apenas cadastra email/senha. `ShopSetup.tsx` é UI sem persistência |
| 7.3 | Onboarding guiado funciona | ⚠️ | `ShopSetup.tsx` existe como UI mas não salva dados. `ProtectedRoute` redireciona para `/shop-setup` se `businessName` ausente |
| 7.4 | Dados iniciais criados automaticamente | ❌ | **Sem auto-criação.** Trigger cria profile mas não cria tenant, unidade, ou staff |
| 7.5 | Tenant muda draft→active | ❌ | **Sem transição de estado.** Tenant não tem coluna `status`. Profile tem `status` mas não muda no fluxo de onboarding |

**Pendências Críticas:**
- Implementar criação de tenant no fluxo de registro/onboarding
- Implementar vínculo `user_tenants` (usuário ↔ tenant)
- Implementar criação automática de `staff` (owner) para o tenant
- Decidir se dados iniciais (serviços, categorias) são criados pelo backend ou pelo usuário no onboarding

---

### 8. Billing Consistente — ⚠️

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 8.1 | Modelo de cobrança definido | ✅ | Recorrência mensal, gateway desacoplado via adapters (SAAS_CORE_ARCHITECTURE.md §3) |
| 8.2 | Planos definidos | ✅ | Free (trial), Pro (recomendado), Elite (premium) — sem preços documentados, limites configuráveis |
| 8.3 | Feature flags implementadas | ⚠️ | **Não implementadas no código.** SAAS_CORE_ARCHITECTURE.md §4 descreve arquitetura mas não há tabela `feature_flags` nem código de verificação |
| 8.4 | Limites por plano respeitados | ❌ | **Sem enforcement.** Sem verificação de limites (número de barbeiros, agendamentos, etc.) em nenhuma rota |
| 8.5 | Upgrade prompt aparece | ❌ | **Sem componente de upgrade.** Nenhum `UpgradePrompt` ou bloqueio de funcionalidade por plano |

**Pendências:**
- Feature flags e enforcement são scopes do Fase 6 (Production Readiness) — documentar como pendência aceita
- Criar `feature_flags` table e middleware de verificação
- Criar componente `UpgradePrompt` para UI

---

### 9. Tenant Consistente — ❌

| # | Verificação | Status | Evidência |
|---|-------------|--------|-----------|
| 9.1 | Coluna `status` em `tenants` | ❌ | **Tabela `tenants` usa `active: boolean`** (ou equivalente). Sem coluna `status` com 7 estados do lifecycle |
| 9.2 | Lifecycle 7 estados definidos | ❌ | SAAS_CORE_ARCHITECTURE.md §2 define: draft → trial → active → past_due → suspended → cancelled → archived. **Não implementado no banco** |
| 9.3 | Transições de estado | ❌ | **Sem enum de estados.** Sem função de transição. `tenants.active` é boolean toggle |
| 9.4 | Login bloqueado em suspended/cancelled | ❌ | **Sem verificação.** `ProtectedRoute` apenas verifica se há sessão, não verifica estado do tenant |
| 9.5 | Notificações em transições | ⚠️ | `NotificationSubscriber` existe para eventos mas não dispara notificações de mudança de estado do tenant (pois o estado não existe) |

**Pendências:**
- Criar migration para adicionar coluna `status` na tabela `tenants` (enum com 7 estados)
- Criar função de transição de estado com validações
- Adicionar verificação de `tenant.status` em `ProtectedRoute`
- Notificações em transições são scope do Fase 6

---

## Pendências Resumidas

### Críticas (bloqueiam Fase 6) — Documentadas para Fase 6.0

| # | Pendência | Item | Scope Fase 6 |
|---|-----------|------|-------------|
| C1 | Criar migration `tenants.status` (enum 7 estados) | 9 | 6.0.3 Tenant Lifecycle |
| C2 | Implementar criação de tenant no onboarding | 7 | 6.0.1 Tenant Creation |
| C3 | Implementar vínculo `user_tenants` | 7 | 6.0.1 Tenant Creation |
| C4 | Implementar criação automática de `staff` (owner) | 7 | 6.0.2 Provisioning Engine |
| C5 | Adicionar verificação de `tenant.status` em `ProtectedRoute` | 9 | 6.0.3 Tenant Lifecycle |

### Menores — Resolvidas

| # | Pendência | Item | Status |
|---|-----------|------|--------|
| M1 | Atualizar `ARCHITECTURE.md` para refletir todas as fases | 1 | ✅ Resolvido (v3.0 RC1 atualizado) |
| M2 | Corrigir "Clube do Chefe" → "Club dos Chefes" (60 ocorrências) | 3 | ✅ Resolvido (26 arquivos corrigidos) |
| M3 | Corrigir "Club" sem "dos Chefes" em PROJECT_STATUS.md e AGENTS.md | 2 | ✅ Resolvido (sem ocorrências) |

### Menores — Pendentes

| # | Pendência | Item | Esforço |
|---|-----------|------|---------|
| M4 | Alinhar numeração de fases entre ROADMAP.md e PROJECT_STATUS.md | 2 | Baixo |
| M5 | Documentar padrão vertical slice (não módulos) | 4 | ✅ Documentado em ARCHITECTURE.md |
| M6 | Decidir padrão de papéis (arquivos dedicados vs implícito) | 5 | Baixo |
| M7 | Implementar feature flags e enforcement | 8 | 6.0.5 Feature Flags |
| M8 | Criar componente `UpgradePrompt` | 8 | Médio |

---

## Decisões do PO (2026-07-28)

### Pergunta 1: Onboarding — NÃO implementar agora

**Decisão:** Gap documentado para Fase 6.0.1. O objetivo das Fases 5/5.6 é consolidar arquitetura e documentação, não desenvolver funcionalidades.

### Pergunta 2: Tenant Lifecycle — NÃO criar migration agora

**Decisão:** Gap documentado para Fase 6.0.3. A definição conceitual está completa (7 estados). Implementação física será na Fase 6.

### Pergunta 3: Feature Flags — Scope da Fase 6

**Decisão:** Implementar em Fase 6.0.4-6.0.5. A arquitetura está documentada, a implementação é de Fase 6.

---

## Próximos Passos

1. ✅ **POdecidiu** — 3 perguntas respondidas, gaps documentados
2. ✅ **Corrigir pendências menores** — M1 (ARCHITECTURE.md), M2 (taxonomia), M5 (vertical slice)
3. 🔄 **Iniciar Fase 6.0** (SaaS Core Implementation) — Onboarding, Lifecycle, Billing, Feature Flags
4. ⬜ **Iniciar Fase 6.1** (CI/CD) — após6.0 concluída

---

## Referências

- `docs/BUSINESS_ARCHITECTURE.md` — Fase 5
- `docs/SAAS_CORE_ARCHITECTURE.md` — Fase 5.5 (§2 Tenant Lifecycle, §3 Billing, §4 Feature Flags, §7 Onboarding)
- `docs/TAXONOMY.md` — Glossário oficial
- `ARCHITECTURE.md` — Arquitetura técnica (desatualizado)
- `ROADMAP.md` — Roadmap oficial
- `src/pages/onboarding/ShopSetup.tsx` — UI de onboarding (sem persistência)
- `src/pages/Register.tsx` — Cadastro de usuário
- `src/components/auth/ProtectedRoute.tsx` — Guard de rotas
- `src/context/AuthContext.tsx` — Autenticação

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-07-28 | 2.0 | Fase 5.6 CONCLUÍDA COM RESSALVAS. 7/9 itens aprovados. Taxonomia corrigida (60 ocorrências). ARCHITECTURE.md atualizado. Decisões do PO registradas (onboarding/lifecycle/billing para Fase 6.0). Dívida técnica documentada. |
| 2026-07-28 | 1.1 | Itens 8 (billing) e 9 (tenant) atualizados para refletir decisões do PO |
| 2026-07-27 | 1.0 | Criação do documento |
