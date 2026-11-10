# Próximos Fronts — Backlog P0..P3

**Data:** 2026-09-27 | **Modo:** READ-ONLY | **Gate:** PO pendente

---

## 1. Legenda

| Campo | Significado |
|---|---|
| problema | O que está errado ou ausente |
| oportunidade | O que pode ser aproveitado |
| origem | Repositório de onde o achado vem |
| evidência | Caminho:linha ou descrição |
| impacto | Consequência da ação/não-ação |
| complexidade | Baixa / Média / Alta |
| risco | Risco associado |
| dependências | O que precisa estar resolvido antes |
| recomendação | Ação sugerida |

---

## 2. P0 — Urgente (Risco Crítico ou Bloqueio)

| # | Problema | Oportunidade | Origem | Evidência | Impacto | Complexidade | Risco | Dependências | Recomendação |
|---|---|---|---|---|---|---|---|---|---|
| P0-1 | `service_role` JWT no bundle do navegador | Remover chave, rotacionar | gerador_orcamentos | `index.html` — JWT com `"role":"service_role"`, válido até 2036 | Comprometimento total do banco de dados de clientes reais | Alta | **CRÍTICO** | — | Remover imediatamente do bundle. Rotacionar a chave via Supabase Dashboard. Aplicar RLS adequado. |
| P0-2 | `estetica` ativo e não documentado | Atualizar `AGENTS.md` + `TAXONOMY.md` | sou-manager | `moduleRegistry.ts:30-47` vs `AGENTS.md` | Produto ativo invisível; risco de governança | Baixa | **MÉDIO** | — | Adicionar `estetica` à documentação oficial. 16 módulos habilitados não aparecem no glossário. |
| P0-3 | Integração site→SMG inoperante | Corrigir ou abandonar | sanchez-barber-iastudio | Endpoint `/appointments` vs `/site-sanchez-appointments`; 7 campos errados; 2 UUIDs ausentes | Perda de receita de agendamento | Alta | **CRÍTICO** | P0-4 | Decisão do PO: corrigir integração ou abandonar oficialmente. |
| P0-4 | Site público não chama SMG | Implementar booking público | sanchez-barber-iastudio | `LandingPage` = `AppointmentPortal` (WhatsApp-only); `SchedulingFlow` atrás de `ProtectedRoute` | Visitantes anônimos não podem agendar via SMG | Média | **CRÍTICO** | P0-3 | Se integração for mantida, mover `SchedulingFlow` para rota pública ou criar novo fluxo. |
| P0-5 | 7 âncoras de conversão quebradas | Reconstruir funil | SMG_LADINGPAGE | 5× `#contato` + 2× `#solucoes` sem alvo; WhatsApp `551140000000` fictício | Zero captura de leads | Média | **CRÍTICO** | — | Reconstruir seções `#contato` e `#solucoes` com backend real ou corrigir âncoras. |
| P0-6 | `company_id` vs `tenant_id` | Rejeitar vocabulario | SMG_AUTOCONTROL | `types/index.ts` usa `company_id`; SoT usa `tenant_id` | Divergência taxonômica | Baixa | **MÉDIO** | — | Rejeitar `company_id`. Usar `tenant_id`. Taxonomia de infraestrutura. |
| P0-7 | 4 rotas do admin quebradas (401) | Corrigir auth | smg-core | `/audit-logs`, `/api-logs`, `/error-logs`, `/system-health` apontam para NestJS sem sessão | Dead code no admin | Média | **ALTO** | — | Corrigir auth do NestJS ou remover rotas. |
| P0-8 | Escalão de privilégio viewer→super_admin | Restringir `is_admin()` | smg-core | `is_admin()` inclui viewer; policy `FOR ALL` com `WITH CHECK(is_admin())` | Tomada de controle do control-plane | Média | **CRÍTICO** | — | Restringir `is_admin()` a `super_admin`/`admin`. Adicionar `count_active_super_admins()`. |

---

## 3. P1 — Alto (Risco Alto ou Lacuna Significativa)

| # | Problema | Oportunidade | Origem | Evidência | Impacto | Complexidade | Risco | Dependências | Recomendação |
|---|---|---|---|---|---|---|---|---|---|
| P1-1 | Mock super_admin sem gating | Adicionar gating de localhost | SMG_LOUGE | `AuthContext` boota como `super_admin` sem env vars | Elevação de privilégio em deploy | Média | **ALTO** | — | Adicionar gating como no sou-manager. Remover mock de produção. |
| P1-2 | Split-brain schema (public vs lounge) | Migrar `SupabaseSync` | SMG_LOUGE | `SupabaseSync.tsx` assina `public.*`; `schema.sql` desabilita RLS | Leitura de dados inconsistente | Alta | **ALTO** | P1-1 | Migrar `SupabaseSync` para `lounge.*`. Habilitar RLS em `public.*` ou remover. |
| P1-3 | `log_audit_action` com GUC não setado | Configurar `set_config` | SMG_LOUGE | `013_audit_logs.sql` — `current_setting('app.tenant_id')` sem `set_config` | RPCs falham em runtime | Média | **ALTO** | — | Adicionar `set_config('app.tenant_id', ...)` nos migrations ou usar `missing_ok`. |
| P1-4 | `x-tenant-id` confiado sem validação | Validar contra sessão | gerador_orcamentos | `api/*.ts` — header do cliente como tenant | Cross-tenant data leak | Média | **ALTO** | — | Validar tenant contra sessão do usuário. |
| P1-5 | RLS `USING(true)` em `budgets` | Aplicar RLS adequado | gerador_orcamentos | `009_budgets.sql` | Tabela de orçamentos totalmente aberta | Média | **ALTO** | — | Aplicar RLS com `tenant_id`. |
| P1-6 | `customers` RLS desabilitado | Habilitar RLS | gerador_orcamentos | `011_customers.sql` | Tabela de clientes sem isolamento | Baixa | **ALTO** | — | Habilitar RLS. |
| P1-7 | 4 chamadas de método inexistentes | Corrigir exports | gerador_orcamentos | `budgetRepo.createBudget`, `deleteBudget`, `updateBudget` não existem | TypeError em runtime | Média | **ALTO** | — | Corrigir exports ou remover chamadas. |
| P1-8 | RBAC morto no smg-core | Reativar ou remover | smg-core | `auth.service.ts:64` — só `isPlatformAdmin`; `permissions.guard.ts:39` — bypass | Roles/permissions nunca consultados | Alta | **ALTO** | P0-8 | Reativar RBAC ou remover código. |
| P1-9 | `smg_client_apps` ausente no SoT | Adicionar registry | smg-core | `control.smg_client_apps` — mapeamento client→app→tenant→schema | Falta de registry cross-tenant | Alta | **MÉDIO** | P1-8 | Adicionar `smg_client_apps` ao SoT. |
| P1-10 | `platform_security_events` ausente no SoT | Adicionar tabela | smg-core | `platform_security_events` — login events | Falta de log de eventos de segurança | Média | **MÉDIO** | — | Adicionar `platform_security_events` ao SoT. |
| P1-11 | `count_active_super_admins()` ausente | Adicionar proteção | smg-core | `smg-core` tem; SoT não | Risco de lock-out de último super admin | Baixa | **BAIXO** | — | Adicionar `count_active_super_admins()` ao SoT. |
| P1-12 | `app_health_checks` + `app_incidents` ausentes | Adicionar fleet monitoring | smg-core | `control.app_health_checks`, `control.app_incidents` | Falta de monitoring cross-tenant | Alta | **MÉDIO** | P1-9 | Adicionar ao SoT. |
| P1-13 | Brand kit não extraído | Extrair tokens + classes | SMG_LADINGPAGE | `index.css:4-55` — 6 tokens + 6 classes | Design system não reutilizável | Baixa | **BAIXO** | — | Extrair como brand kit reutilizável. |
| P1-14 | Copy PainPoints/Differentiators não reutilizada | Reutilizar copy | SMG_LADINGPAGE | `PainPoints.tsx`, `Differentiators.tsx` | Copy de alta qualidade não aproveitada | Baixa | **BAIXO** | — | Reutilizar no SoT. |
| P1-15 | `estetica` módulos não documentados | Documentar módulos | sou-manager | `moduleRegistry.ts:30-47` — 16 módulos habilitados | Produto ativo invisível | Baixa | **MÉDIO** | P0-2 | Documentar cada módulo de `estetica`. |
| P1-16 | `auto` módulos todos bloqueados | Definir módulos | sou-manager | `APP_ENABLED_MODULES['auto']` = `[]` | Slot reservado sem conteúdo | Média | **MÉDIO** | D-3 | Definir quais módulos de `auto` serão habilitados. |
| P1-17 | `BrowserRouter` sem `vercel.json` | Adicionar config | SMG_LADINGPAGE | `App.tsx` usa `BrowserRouter`; sem `vercel.json` | Deep-links 404 em Vercel | Baixa | **ALTO** | — | Adicionar `vercel.json` com catch-all rewrite. |
| P1-18 | 6 dependências mortas (40%) | Remover deps | SMG_AUTOCONTROL | `express`, `dotenv`, `tsx`, `@google/genai`, `autoprefixer`, `@types/node` | Bundle inchado | Baixa | **BAIXO** | — | Remover dependências mortas. |
| P1-19 | `password` em plaintext | Implementar hash | gerador_orcamentos | `api/register.ts:43` | Comprometimento de credenciais | Média | **ALTO** | — | Implementar hash bcrypt. |
| P1-20 | `exec_sql` RPC | Verificar/remover | gerador_orcamentos | `api/*.ts` — RPC `exec_sql` | SQL arbitrário se existir | Média | **MÉDIO** | — | Verificar se RPC existe; remover se não. |

---

## 4. P2 — Médio (Oportunidade ou Melhoria)

| # | Problema | Oportunidade | Origem | Evidência | Impacto | Complexidade | Risco | Dependências | Recomendação |
|---|---|---|---|---|---|---|---|---|---|
| P2-1 | Booking wizard não adaptado | Adaptar UX | sanchez-barber-iastudio | `SchedulingFlow.tsx` — motion por step, validação | Melhor UX do ecossistema | Média | **BAIXO** | P0-3 | Adaptar como `src/modules/publicBooking/`. |
| P2-2 | Catálogo de serviços não usado como seed | Usar como seed | sanchez-barber-iastudio | `scheduling/data.ts` — 8 serviços | Seed de `services` por tenant | Baixa | **BAIXO** | — | Validar com PO → seed de `services`. |
| P2-3 | CommandPalette não adaptado | Adaptar | SMG_LOUGE | `CommandPalette.tsx` — Ctrl/Cmd+K | Navegação rápida | Média | **BAIXO** | P1-1 | Adaptar para SoT. |
| P2-4 | KpiCard/EventKpiCard não copiados | Copiar | SMG_LOUGE | `KpiCard.tsx`, `EventKpiCard.tsx` | Padrão de cards | Baixa | **BAIXO** | — | Copiar para SoT. |
| P2-5 | DoorCheckin/Stock não adaptados | Adaptar | SMG_LOUGE | `DoorCheckinPage.tsx`, `StockPage.tsx` | Módulos operacionais | Média | **MÉDIO** | P1-2 | Adaptar para SoT. |
| P2-6 | Grade de 4 KPIs não adaptada | Adaptar | SMG_AUTOCONTROL | `Dashboard.tsx:38-63` | Padrão de cards | Baixa | **BAIXO** | — | Adaptar para dashboard `auto`. |
| P2-7 | Funil de OS em 4 cards não adaptado | Adaptar | SMG_AUTOCONTROL | `ServiceOrders.tsx:30-67` | Métrica de operação | Baixa | **BAIXO** | — | Adaptar para dashboard `auto`. |
| P2-8 | 3 cards financeiros não adaptados | Adaptar | SMG_AUTOCONTROL | `Financial.tsx:44-74` | Padrão de cards | Baixa | **BAIXO** | — | Adaptar para financeiro `auto`. |
| P2-9 | Domínio automotivo não documentado | Documentar | SMG_AUTOCONTROL | OS, vehicles, PF/PJ, "aguardando peça" | Seed do módulo `auto` | Média | **MÉDIO** | P1-16 | Documentar como material de pesquisa. |
| P2-10 | Catálogo de produtos não recuperado | Recuperar do git | SMG_LADINGPAGE | `OLD_App.tsx:570-693` — Smart Booking, Split de Pagamento | Material de venda substancial | Média | **BAIXO** | — | Recuperar do histórico git. |
| P2-11 | System prompt do chatbot não recuperado | Recuperar | SMG_LADINGPAGE | `OLD_App.tsx:66-79` — voz da marca | Guia de tom de voz | Baixa | **BAIXO** | — | Recuperar como guia de tom. |
| P2-12 | Analytics não adicionados | Adicionar tracking | SMG_LADINGPAGE | Zero instrumentação | Otimização às cegas | Baixa | **BAIXO** | — | Adicionar analytics. |
| P2-13 | `vercel.json` não adicionado | Adicionar config | SMG_LADINGPAGE | Sem config de deploy | Deploy não reprodutível | Baixa | **BAIXO** | — | Adicionar `vercel.json`. |
| P2-14 | Padrão de catálogo não replicado | Replicar | gerador_orcamentos | `tenant_id + ativo + partial unique index` | Padrão multi-tenant | Baixa | **BAIXO** | — | Replicar para novos catálogos. |
| P2-15 | Pipeline PDF não replicado | Replicar | gerador_orcamentos | `api/process.ts` — Puppeteer + Handlebars | Geração de documentos | Alta | **MÉDIO** | — | Replicar para relatórios/contratos. |
| P2-16 | `smg_invoices`/`billing_events` não aplicados | Aplicar billing | smg-core | `control-schema-draft.sql` | Faturamento não funcional | Alta | **MÉDIO** | P1-8 | Aplicar migrations de billing. |
| P2-17 | `platform_feature_flags` não ativado | Ativar feature flags | smg-core | `platform_feature_flags` — schema-only | Gated features não funcional | Média | **MÉDIO** | P1-8 | Ativar feature flags em produção. |
| P2-18 | `platform_plans` não funcional | Ativar planos | smg-core | `platform_plans` + seed 'starter' | Planos não funcionais | Média | **MÉDIO** | P1-8 | Ativar planos em produção. |
| P2-19 | `types/index.ts` não utilizado | Usar como semente | SMG_AUTOCONTROL | 7 interfaces órfãs | Seed de `domain/auto/` | Média | **MÉDIO** | P1-16 | Usar como semente do modelo `auto`. |
| P2-20 | `app.tenant_id` GUC não setado | Configurar GUC | SMG_LOUGE | Nenhum `set_config` encontrado | RPCs falham | Média | **ALTO** | P1-3 | Adicionar `set_config` nos migrations. |

---

## 5. P3 — Baixo (Melhoria ou Limpeza)

| # | Problema | Oportunidade | Origem | Evidência | Impacto | Complexidade | Risco | Dependências | Recomendação |
|---|---|---|---|---|---|---|---|---|---|
| P3-1 | `fetch_results.txt` commitado | Remover | sanchez | Dump de bundle minificado | Ruído de repo | Baixa | **BAIXO** | — | Remover do repo. |
| P3-2 | `.err` files commitados | Remover | sanchez | `vite-dev.err`, `vite-dev-smg.err` | Ruído de repo | Baixa | **BAIXO** | — | Adicionar ao `.gitignore`. |
| P3-3 | 3 cópias do `impeccable` skill | Remover | sanchez | `.agents/`, `.claude/`, `skills/` | Ruído de repo | Baixa | **BAIXO** | — | Remover duplicatas. |
| P3-4 | `source_icon.png` 756KB | Substituir | SMG_LADINGPAGE | `public/source_icon.png` | Ícone como imagem de OG | Baixa | **BAIXO** | — | Substituir por `favicon.svg`. |
| P3-5 | Sem `hreflang` | Adicionar | SMG_LADINGPAGE | `index.html` | Loss de rich results | Baixa | **BAIXO** | — | Adicionar `hreflang`. |
| P3-6 | `ProductExperience` mockups falsos | Substituir | SMG_LADINGPAGE | `ProductExperience.tsx:52` | Promessa visual não cumprida | Baixa | **BAIXO** | — | Substituir por screenshots reais. |
| P3-7 | `RoleGuard` não importado | Remover | LOUGE | `App.tsx` | Dead code | Baixa | **BAIXO** | — | Remover ou integrar. |
| P3-8 | `identity` variável nunca usada | Remover | sanchez | `appointmentsStorage.ts:295` | Dead code | Baixa | **BAIXO** | — | Remover. |
| P3-9 | `useGoogleReviews` nunca importado | Remover | sanchez | `useGoogleReviews.ts` | Dead code | Baixa | **BAIXO** | — | Remover. |
| P3-10 | `appointmentConfig.ts` duplicado | Remover | sanchez | `appointmentConfig.ts` vs `scheduling/data.ts` | Catálogo inconsistente | Baixa | **BAIXO** | — | Remover ou unificar. |
| P3-11 | `metadata.json` com mojibake | Remover | gerador, LADINGPAGE | `"The Architectural Ledger"` | Artefato de template AI Studio | Baixa | **BAIXO** | — | Remover. |
| P3-12 | `GEMINI_API_KEY` no bundle | Remover | LADINGPAGE, AUTOCONTROL | `vite.config.ts:11` | Vazamento de configuração | Baixa | **MÉDIO** | — | Remover do bundle. |
| P3-13 | `tsconfig` sem `strict` | Adicionar | sanchez, AUTOCONTROL | `tsconfig.json` | Código não typecheckado | Baixa | **BAIXO** | — | Adicionar `strict: true`. |
| P3-14 | `src/test` excluído do typecheck | Remover exclusão | sanchez | `tsconfig.json:26-28` | Testes não typecheckados | Baixa | **BAIXO** | — | Remover exclusão. |
| P3-15 | `quote.hbs` órfão | Remover | gerador | Template EN, mojibake, nunca carregado | Ruído de repo | Baixa | **BAIXO** | — | Remover. |
| P3-16 | `outputs/` PDFs com PII | Remover | gerador | 8 PDFs reais de clientes | LGPD risk | Baixa | **ALTO** | — | Remover do repo. |
| P3-17 | `xlsx@0.18.5` com CVEs | Atualizar | gerador | `package.json` | Vulnerabilidades conhecidas | Baixa | **MÉDIO** | — | Atualizar versão. |
| P3-18 | `node server.ts` falha | Corrigir | gerador | `package.json:scripts` | Script de dev quebrado | Baixa | **BAIXO** | — | Usar `tsx` ou `ts-node`. |
| P3-19 | `checkin_count` vs `checked_in_count` | Padronizar | LOUGE | `public.reservations` vs `lounge.reservations` | Inconsistência de nomenclatura | Baixa | **BAIXO** | — | Padronizar. |
| P3-20 | `comission_rate` typo | Corrigir | LOUGE | `public.promoters` | Nomenclatura incorreta | Baixa | **BAIXO** | — | Corrigir typo. |

---

## 6. Backlog Consolidado — Visão Geral

| Prioridade | Quantidade | Críticos | Altos | Médios | Baixos |
|---|---|---|---|---|---|
| **P0** | 8 | 5 | 0 | 2 | 1 |
| **P1** | 20 | 0 | 8 | 8 | 4 |
| **P2** | 20 | 0 | 0 | 12 | 8 |
| **P3** | 20 | 0 | 1 | 2 | 17 |
| **Total** | **68** | **5** | **9** | **24** | **30** |

---

## 7. Dependências Críticas

```
P0-1 (service_role) ──→ P0-3 (integração) ──→ P2-1 (booking wizard)
P0-2 (estetica doc) ──→ P1-15 (módulos estetica) ──→ P1-16 (módulos auto)
P0-5 (âncoras) ──→ P1-13 (brand kit) ──→ P1-14 (copy)
P0-7 (rotas quebradas) ──→ P1-8 (RBAC) ──→ P1-9 (smg_client_apps)
P0-8 (escalão) ──→ P1-8 (RBAC) ──→ P2-16 (billing)
P1-1 (super_admin) ──→ P1-2 (split-brain) ──→ P2-5 (DoorCheckin/Stock)
P1-3 (GUC) ──→ P2-20 (app.tenant_id)
```

---

## 8. Perguntas Bloqueantes para o PO

1. **A integração site→SMG está oficialmente abandonada ou foi pivô temporário?** (P0-3)
2. **A Sanchez Barber é tenant do SMG? Qual o `tenant_id`?** (P0-3, P0-4)
3. **O site público deve escrever direto no SMG ou só consultar disponibilidade?** (P0-4)
4. **Os 8 serviços de `data.ts` devem virar `services` reais na SMG?** (P2-2)
5. **Autorizar SMG Auto Control como 2º produto comercial?** (P1-16, D-1)
6. **"Mão de obra" → como mapeia no domínio `commission/`?** (D-2)
7. **Definir módulos de `auto` em `APP_ENABLED_MODULES`?** (D-3)
8. **Preço público ou formulário de qualification?** (D-6)
9. **Restaurar barra de métricas (500+/R$12M/99.9%)?** (D-9)
10. **Billing via smg-core draft ou nativo?** (D-10)

---

Gerado por frente SMG Repository Archaeology — AUDIT → EVIDENCE → REPORT → STOP. Nenhuma implementação autorizada. Gate PO pendente.
