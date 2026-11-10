# Registro de Riscos

**Data:** 2026-09-27 | **Modo:** READ-ONLY

---

## 1. Legenda

| Campo | Significado |
|---|---|
| risco | Nome do risco |
| origem | Repositório/componente |
| evidência | Caminho:linha ou descrição |
| impacto | Consequência se o risco se materializar |
| probabilidade | ALTA / MÉDIA / BAIXA |
| área | Segurança, Integração, Dados, UX, Governança, etc. |
| recomendação | Ação sugerida |
| investigação | Status da investigação |

---

## 2. Riscos Críticos (🔴)

| risco | origem | evidência | impacto | probabilidade | área | recomendação | investigação |
|---|---|---|---|---|---|---|---|
| R1 — service_role JWT em produção | gerador_orcamentos | `index.html` contém JWT com `"role":"service_role"`, válido até 2036, publicado em `geradororcamentos1.vercel.app` | Comprometimento total do banco de dados — qualquer visitante tem acesso total de leitura/escrita | **ALTA** (já publicado) | Segurança | Remover imediatamente do bundle. Rotacionar a chave. Aplicar RLS adequado. | Confirmado via decodificação do JWT |
| R2 — Integração site→SMG inoperante | sanchez-barber-iastudio | Endpoint `/appointments` vs `/site-sanchez-appointments`; 7 campos errados; 2 UUIDs ausentes; teste codifica contrato errado | Perda de receita de agendamento; site não converte | **ALTA** | Integração | Corrigir URL, payload e UUIDs. Ou abandonar integração oficialmente. | Confirmado via comparação de contratos |
| R3 — Mock super_admin sem gating | SMG_LOUGE | `AuthContext` boota como `super_admin` sem env vars; sem gating de localhost | Elevação de privilégio em qualquer deploy sem env vars | **MÉDIA** | Segurança | Adicionar gating de localhost como no sou-manager. Remover mock de produção. | Confirmado via leitura de `AuthContext.tsx` |
| R4 — Zero RLS no schema `platform` | smg-core | `migration.sql` — apenas `CREATE SCHEMA`/`CREATE TABLE`, zero `ROW LEVEL SECURITY` | Exposição de dados cross-tenant; qualquer query acessa todos os tenants | **MÉDIA** | Segurança | Aplicar RLS com `current_tenant_id_from_auth_uid()` em todas as tabelas | Confirmado via leitura de migration |
| R5 — Escalão de privilégio viewer→super_admin | smg-core | `is_admin()` inclui `viewer`/`finance`/`support`; policy `FOR ALL` com `WITH CHECK(is_admin())` | Tomada de controle do control-plane; acesso a todos os clientes, produtos, apps | **MÉDIA** | Segurança | Restringir `is_admin()` a `super_admin`/`admin`; adicionar `count_active_super_admins()` | Confirmado via análise de policies |
| R6 — 7 âncoras de conversão quebradas | SMG_LADINGPAGE | 5× `#contato` + 2× `#solucoes` sem alvo; CTA "Agendar demonstração" inoperante | Zero captura de leads; perda de receita direta | **ALTA** | UX/Marketing | Reconstruir seções `#contato` e `#solucoes` ou corrigir âncoras | Confirmado via grep exaustivo |
| R7 — Split-brain schema (public vs lounge) | SMG_LOUGE | `SupabaseSync.tsx` assina `public.*`; `schema.sql` desabilita RLS em `public.*`; serviços falam `lounge.*` | Leitura de dados inconsistente; realtime em tabelas sem RLS | **ALTA** | Dados | Migrar `SupabaseSync` para `lounge.*`; habilitar RLS em `public.*` ou remover | Confirmado via análise de `SupabaseSync.tsx` e `schema.sql` |
| R8 — `company_id` vs `tenant_id` | SMG_AUTOCONTROL | `types/index.ts` usa `company_id`; SoT usa `tenant_id` | Divergência taxonômica; risco de criar segunda taxonomia de tenancy | **ALTA** | Governança | Rejeitar `company_id`; usar `tenant_id` | Confirmado via `domain/shared/app.ts` |
| R9 — `estetica` ativo e não documentado | sou-manager | `moduleRegistry.ts:30-47` — 16 módulos habilitados; `AGENTS.md` não menciona | Risco de governança; produto ativo invisível na documentação | **MÉDIA** | Governança | Atualizar `AGENTS.md` + `docs/TAXONOMY.md` | Confirmado via `moduleRegistry.ts` |
| R10 — 4 rotas quebradas + 4 páginas órfãs | smg-core | `/audit-logs`, `/api-logs`, `/error-logs`, `/system-health` → 401; `TenantsListPage`, `UsersListPage` não no router | Dead code no admin; confusão de navegação | **ALTA** | Arquitetura | Corrigir auth do NestJS ou remover rotas; adicionar páginas ao router ou remover | Confirmado via análise de `router/index.tsx` |

---

## 3. Riscos Altos (🟠)

| risco | origem | evidência | impacto | probabilidade | área | recomendação | investigação |
|---|---|---|---|---|---|---|---|
| R11 — RLS permissiva por `user_email` | sanchez-barber-iastudio | `schema.sql:169-177` — `OR` de 3 condições; `auth.uid() = user_id` permite `user_email` de terceiro | Injeção de agendamento falso na agenda SMG | **MÉDIA** | Segurança | Reescrever policy com `auth.uid() = user_id AND lower(auth.jwt() ->> 'email') = lower(user_email)` | Confirmado via análise de policy |
| R12 — Password em plaintext | gerador_orcamentos | `api/register.ts:43` | Comprometimento de credenciais de clientes | **ALTA** | Segurança | Implementar hash bcrypt; nunca armazenar plaintext | Confirmado via leitura de `api/register.ts` |
| R13 — `x-tenant-id` confiado sem validação | gerador_orcamentos | `api/*.ts` — header do cliente usado como tenant | Cross-tenant data leak; qualquer usuário acessa qualquer tenant | **ALTA** | Segurança | Validar tenant contra sessão do usuário; usar `current_tenant_id_from_auth_uid()` | Confirmado via análise de `api/login.ts` |
| R14 — `budgets` RLS `USING(true)` | gerador_orcamentos | `009_budgets.sql` | Tabela de orçamentos totalmente aberta | **ALTA** | Segurança | Aplicar RLS com tenant_id | Confirmado via leitura de migration |
| R15 — `customers` RLS desabilitado | gerador_orcamentos | `011_customers.sql` | Tabela de clientes sem isolamento | **ALTA** | Segurança | Habilitar RLS | Confirmado via leitura de migration |
| R16 — 4 chamadas de método inexistentes | gerador_orcamentos | `budgetRepo.createBudget`, `deleteBudget`, `updateBudget` não existem; `createBudgetRecord` nunca chamado | TypeError em runtime ao clicar em criar/deletar/atualizar | **ALTA** | Arquitetura | Corrigir exports ou remover chamadas | Confirmado via análise de `budgetRepository.ts` |
| R17 — `log_audit_action` com GUC não setado | SMG_LOUGE | `013_audit_logs.sql` — `current_setting('app.tenant_id')` sem `set_config` | RPCs que chamam `log_audit_action` falham em runtime | **ALTA** | Dados | Configurar `set_config('app.tenant_id', ...)` ou usar `missing_ok` | Confirmado via análise de migration |
| R18 — `app.tenant_id` GUC não setado | SMG_LOUGE | Nenhum `set_config` encontrado em migrations | Todas as RPCs que usam `current_setting('app.tenant_id')` falham | **ALTA** | Dados | Adicionar `set_config` nos migrations ou usar `missing_ok => true` | Confirmado via grep |
| R19 — `BrowserRouter` sem `vercel.json` | SMG_LADINGPAGE | `App.tsx` usa `BrowserRouter`; sem `vercel.json` | Deep-links retornam 404 em Vercel | **ALTA** | Deploy | Adicionar `vercel.json` com catch-all rewrite | Confirmado via `Test-Path vercel.json` |
| R20 — 6 dependências mortas (40%) | SMG_AUTOCONTROL | `express`, `dotenv`, `tsx`, `@google/genai`, `autoprefixer`, `@types/node` — nunca importadas | Bundle inchado; confusão de dependências | **ALTA** | Arquitetura | Remover dependências mortas | Confirmado via grep de imports |
| R21 — Dados mock congelados em 2023 | SMG_AUTOCONTROL | `ServiceOrders.tsx:7`, `Financial.tsx:17`, `Vehicles.tsx:6` — datas de 2023 | Dados enganosos em demonstração | **MÉDIA** | UX | Atualizar dados ou remover | Confirmado via leitura de arquivos |

---

## 4. Riscos Médios (🟡)

| risco | origem | evidência | impacto | probabilidade | área | recomendação | investigação |
|---|---|---|---|---|---|---|---|
| R22 — `estetica` não documentado | sou-manager | `moduleRegistry.ts` vs `AGENTS.md` | Produto ativo invisível; risco de governança | **MÉDIA** | Governança | Atualizar documentação | Confirmado |
| R23 — Zero testes no smg-core admin | smg-core | `SMG_ADMIN/package.json` — sem script de teste | Nenhuma garantia de qualidade no admin | **MÉDIA** | Qualidade | Adicionar vitest + playwright | Confirmado |
| R24 — 1 e2e test na API do smg-core | smg-core | `test/e2e/health.e2e-spec.ts` | Cobertura mínima | **MÉDIA** | Qualidade | Expandir cobertura | Confirmado |
| R25 — Sem CI no smg-core | smg-core | `.github/` inexistente | Nenhum gate automático | **MÉDIA** | Qualidade | Adicionar GitHub Actions | Confirmado |
| R26 — `tsconfig` sem `strict` | sanchez, AUTOCONTROL | `tsconfig.json` | Código não typecheckado rigorosamente | **MÉDIA** | Qualidade | Adicionar `strict: true` | Confirmado |
| R27 — `src/test` excluído do typecheck | sanchez | `tsconfig.json:26-28` | Testes não são typecheckados | **MÉDIA** | Qualidade | Remover exclusão | Confirmado |
| R28 — `log_audit_action` signature mismatch | SMG_LOUGE | `013_audit_logs.sql` — 5 args vs `020/028` — 7 args | RPCs podem falhar se signature mismatch | **MÉDIA** | Dados | Verificar e corrigir signatures | Confirmado |
| R29 — `checkin_count` vs `checked_in_count` | SMG_LOUGE | `public.reservations` vs `lounge.reservations` | Inconsistência de nomenclatura | **MÉDIA** | Dados | Padronizar nomenclatura | Confirmado |
| R30 — `comission_rate` typo | SMG_LOUGE | `public.promoters` | Nomenclatura incorreta | **MÉDIA** | Dados | Corrigir typo | Confirmado |
| R31 — `GEMINI_API_KEY` no bundle | LADINGPAGE, AUTOCONTROL | `vite.config.ts:11` | Vazamento de configuração | **MÉDIA** | Segurança | Remover do bundle | Confirmado |
| R32 — Sem analytics | LADINGPAGE | Grep → 0 resultados | Otimização às cegas | **MÉDIA** | Marketing | Adicionar analytics | Confirmado |
| R33 — `service_role` + guest opcional | sanchez | `sync.js:326-355` | Superfície de escrita anônima | **MÉDIA** | Segurança | Remover guest; exigir auth | Confirmado |
| R34 — Sem idempotência no site | sanchez | Nenhum `idempotency_key` enviado | Duplicidade de agendamentos | **MÉDIA** | Integração | Adicionar idempotency key | Confirmado |
| R35 — `previousActive` consultado antes do insert | sanchez | `sync.js:187` | Duplicidade silenciosa se email errado | **MÉDIA** | Integração | Reordenar lógica | Confirmado |
| R36 — `exec_sql` RPC | gerador_orcamentos | `api/*.ts` — RPC `exec_sql` | SQL arbitrário se existir | **MÉDIA** | Segurança | Verificar se RPC existe; remover se não | Confirmado |
| R37 — `xlsx@0.18.5` com CVEs | gerador_orcamentos | `package.json` | Vulnerabilidades conhecidas | **MÉDIA** | Segurança | Atualizar versão | Confirmado |
| R38 — `node server.ts` falha | gerador_orcamentos | `package.json:scripts` — `node server.ts` em `.ts` | Script de dev quebrado | **MÉDIA** | Arquitetura | Usar `tsx` ou `ts-node` | Confirmado |
| R39 — `metadata.json` com mojibake | gerador_orcamentos, LADINGPAGE | `"The Architectural Ledger"` | Artefato de template AI Studio | **BAIXA** | Qualidade | Remover | Confirmado |
| R40 — `APP_SLUGS` divergence | sou-manager | `domain/shared/app.ts` vs `AGENTS.md` | Documentação divergente do código | **MÉDIA** | Governança | Atualizar `AGENTS.md` | Confirmado |

---

## 5. Riscos Baixos (⚪)

| risco | origem | evidência | impacto | probabilidade | área | recomendação | investigação |
|---|---|---|---|---|---|---|---|
| R41 — `fetch_results.txt` commitado | sanchez | Dump de bundle minificado | Ruído de repo | **BAIXA** | Qualidade | Remover do `.gitignore` | Confirmado |
| R42 — `.err` files commitados | sanchez | `vite-dev.err`, `vite-dev-smg.err` | Ruído de repo | **BAIXA** | Qualidade | Adicionar ao `.gitignore` | Confirmado |
| R43 — 3 cópias do `impeccable` skill | sanchez | `.agents/`, `.claude/`, `skills/` | Ruído de repo | **BAIXA** | Qualidade | Remover duplicatas | Confirmado |
| R44 — `source_icon.png` 756KB | LADINGPAGE | `public/source_icon.png` | Ícone como imagem de OG | **BAIXA** | SEO | Substituir por `favicon.svg` | Confirmado |
| R45 — Sem `hreflang` | LADINGPAGE | `index.html` | Loss de rich results | **BAIXA** | SEO | Adicionar `hreflang` | Confirmado |
| R46 — `ProductExperience` mockups falsos | LADINGPAGE | `ProductExperience.tsx:52` | Promessa visual não cumprida | **BAIXA** | UX | Substituir por screenshots reais | Confirmado |
| R47 — `RoleGuard` não importado | LOUGE | `App.tsx` | Dead code | **BAIXA** | Arquitetura | Remover ou integrar | Confirmado |
| R48 — `identity` variável nunca usada | sanchez | `appointmentsStorage.ts:295` | Dead code | **BAIXA** | Qualidade | Remover | Confirmado |
| R49 — `useGoogleReviews` nunca importado | sanchez | `useGoogleReviews.ts` | Dead code | **BAIXA** | Qualidade | Remover | Confirmado |
| R50 — `appointmentConfig.ts` duplicado | sanchez | `appointmentConfig.ts` vs `scheduling/data.ts` | Catálogo inconsistente | **BAIXA** | Qualidade | Remover ou unificar | Confirmado |

---

## 6. Riscos de Segurança — Resumo

| Severidade | Quantidade | Riscos |
|---|---|---|
| 🔴 Crítico | 10 | R1-R10 |
| 🟠 Alto | 10 | R11-R21 |
| 🟡 Médio | 19 | R22-R40 |
| ⚪ Baixo | 10 | R41-R50 |
| **Total** | **49** | — |

---

## 7. Riscos que Requerem Ação Imediata do PO

| # | Risco | Motivo |
|---|---|---|
| 1 | R1 — service_role JWT | Comprometimento total de dados de clientes reais |
| 2 | R6 — 7 âncoras quebradas | Zero conversão de leads |
| 3 | R2 — Integração site→SMG | Perda de receita de agendamento |
| 4 | R9 — `estetica` não documentado | Produto ativo invisível |
| 5 | R5 — Escalão de privilégio | Tomada de controle do control-plane |
