# SMG Platform — Status do Projeto

> Visão instantânea da evolução do projeto. Última atualização: 2026-08-08.
>
> **Produto Comercial Ativo:** SMG Barber (único)
> **Arquitetura:** SMG Platform (multi-tenant, genérica, permanente)

---

## Progresso Geral

```
Foundation        ████████████████████ 100%
Hardening         ████████████████████ 100%
Architecture      ████████████████████ 100%
Quality           ████████████████████ 100%
Event Driven      ████████████████████ 100%
Biz Architecture  ████████████████████ 100%
SaaS Core Arch    ████████████████████ 100%
Platform Cert.    ████████████████████ 100%
Production        ░░░░░░░░░░░░░░░░░░░░   0%
Product           ░░░░░░░░░░░░░░░░░░░░   0%
Scalability       ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## Architecture Guard (Repository Violations)

> Indicador acompanhado a cada subfase (`npm run architecture:ci`). Meta: 0.

```
6.0.5.2 → 233
6.0.5.3 → 230   (adapters DB movidos p/ domain/billing/ — reduziu dívida)
6.0.5.4 → 230   (TenantLifecycleService + engine suspend — sem novas violações)
Meta   → 0
```

---

## Detalhamento por Fase

### Fase 0 — Foundation ✅

```
0.1 Visão          ████████████████████ 100%
0.2 ADRs           ████████████████████ 100%
0.3 Convenções     ████████████████████ 100%
0.4 Estrutura      ████████████████████ 100%
0.5 Arquitetura    ████████████████████ 100%
0.6 Stack          ████████████████████ 100%
0.7 Guidelines     ████████████████████ 100%
```

### Fase 1 — Hardening ✅

```
1.1 Camadas        ████████████████████ 100%
1.2 Repository     ████████████████████ 100%
1.3 Domain         ████████████████████ 100%
1.4 Application    ████████████████████ 100%
1.5 Shared Kernel  ████████████████████ 100%
1.6 ADR-001        ████████████████████ 100%
1.7 Vitest         ████████████████████ 100%
```

### Fase 2 — Repository + Application Services ❄️ FROZEN

```
Congelada. Nenhuma alteração estrutural aceita.
```

### Fase 3 — Quality Engineering ✅

```
3.1 Domain Tests       ████████████████████ 100%
3.2 Application Tests  ████████████████████ 100%
3.3 Security Audit     ████████████████████ 100%
3.4 E2E Testing        ████████████████████ 100%
3.5 Observability      ████████████████████ 100%
3.6 Performance        ████████████████████ 100%
```

### Fase 4 — Event Driven ✅

```
4.1  Event Bus              ████████████████████ 100%
4.2  Event Publishing       ████████████████████ 100%
4.3  Event Store            ████████████████████ 100%
4.4  Subscribers            ████████████████████ 100%
4.5  Outbox Pattern         ████████████████████ 100%
4.6  Financial Subscribers  ████████████████████ 100%
4.6.1 Finance Provider      ████████████████████ 100%
4.6.2 Persistent Idemp.     ████████████████████ 100%
4.7  Replay Engine          ████████████████████ 100%
4.7.1 Migration Consistency  ████████████████████ 100%
4.7.2 Schema Consistency     ████████████████████ 100%
4.7.3 Resolve tenants.plan   ████████████████████ 100%
4.7.4 Infrastructure Decoup. ████████████████████ 100%
4.7.5 Repository Standard.    ████████████████████ 100%
4.7.6 Codebase Hygiene          ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.7.7 Architecture Verification ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.7.8 Architecture Freeze      ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.8.1 Event Versioning Design  ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.8.2 Event Versioning Infra   ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.8.3 Event Versioning Migrate ✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.8  Event Versioning        ✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.9  Chaos Testing          ✅✅✅✅✅✅✅✅✅✅✅✅ 100%
4.10 Event Driven Cert.     ✅✅✅✅✅✅✅✅✅✅✅✅ 100%
```

### Fase 5 — Business Architecture ✅

```
5.1  Catálogo Produtos    ████████████████████ 100%
5.2  Catálogo Módulos     ████████████████████ 100%
5.3  Taxonomia            ████████████████████ 100%
5.4  Onboarding           ████████████████████ 100%
5.5  Criação Tenant       ████████████████████ 100%
5.6  Assinatura           ████████████████████ 100%
5.7  Papéis/Permissões    ████████████████████ 100%
5.8  Planos Comerciais    ████████████████████ 100%
5.9  Ciclo Vida Tenant    ████████████████████ 100%
5.10 Estratégia Domínios  ████████████████████ 100%
```

### Fase 5.5 — SaaS Core Architecture ✅

```
5.5.1 Customer Onboarding   ████████████████████ 100%
5.5.2 Tenant Lifecycle       ████████████████████ 100%
5.5.3 Billing Architecture   ████████████████████ 100%
5.5.4 Feature Flags          ████████████████████ 100%
5.5.5 Provisionamento        ████████████████████ 100%
5.5.6 Official Catalog       ████████████████████ 100%
5.5.7 Module Architecture    ████████████████████ 100%
5.5.8 Roles & Permissions    ████████████████████ 100%
5.5.9 Data Structure         ████████████████████ 100%
```

### Fase 5.6 — Platform Certification ✅

```
1. Arquitetura consistente   ████████████████████ 100%  ⚠️
2. Documentação consistente  ████████████████████ 100%  ⚠️
3. Taxonomia consistente     ████████████████████ 100%  ✅ (corrigida)
4. Módulos consistentes      ████████████████████ 100%  ⚠️
5. Papéis consistentes       ████████████████████ 100%  ⚠️
6. Produtos consistentes     ████████████████████ 100%  ⚠️
7. Onboarding consistente    ████████████████████ 100%  ❌ (gap documentado)
8. Billing consistente       ████████████████████ 100%  ⚠️ (gap documentado)
9. Tenant consistente        ████████████████████ 100%  ❌ (gap documentado)
```

> ⚠️ Concluída com ressalvas. 6/9 itens OK, 3 com gaps documentados para Fase 6.0.

### Fase 6 — Production Readiness 🔵

```
6.0  SaaS Core Impl.    ██████████████████░░░░  72%
6.0.1  Tenant Creation  ████████████████████ 100%  ✅ CERTIFICADA E2E
6.0.2  Onboarding Comp. ████████████████████ 100%  ✅ CERTIFICADA E2E
6.0.3  Team Onboarding  ████████████████████ 100%  ✅ CERTIFICADA E2E (baseline v1.3.0)
6.0.4  Billing Foundation ████████████████░░░░░░  80%  ✅ 6.0.4.1 + 6.0.4.2 + 6.0.4.3 + 6.0.4.4 Billing Engine (baseline v1.4.2)
6.0.5  Feature Flags      ████████████████████░░  80%  ✅ 6.0.5.1 + 6.0.5.2 CERTIFICADAS (smoke 10/10; deploy deferido) + 6.0.5.3 implementada (unit 847/847, smoke 10/10) + 6.0.5.4 implementada (unit 874/874, migration T1–T7 OK) + 6.0.5.5 IMPLEMENTADA (unit 883/883, migration `20260807020000` T1–T12 OK em docker, **SCHEMA FREEZE = YES**) + **Hardening RPCs irmãs ✅ (migration `20260808000000` — S1–S16 + G1 PASS)** + **6.0.5.6 PCA ✅ READY (gate liberado)** + **JANELA ÚNICA DE DEPLOY ✅ EXECUTADA (2026-08-08): 6 migrations aplicadas (`06090000`, `07000000`, `07010000`, `07020000`, `08000000`, `20260808110000`), pós-deploy 7/7 verdes, E2E Flow14 1/1 + Flow13 8/8 + Smoke 10/10 — ver `docs/DEPLOY_LOG_FASE_6_0_5.md`**
6.0.6  Compliance & Legal ░░░░░░░░░░░░░░░░░░░░   0%  ⏳ PLANNED (2026-08-07) — gate obrigatório de certificação da release v1.5 (somente documentação; entry audit criada)
6.1  CI/CD                ░░░░░░░░░░░░░░░░░░░░   0%
6.2  Observabilidade      ░░░░░░░░░░░░░░░░░░░░   0%
6.3  Ambientes            ░░░░░░░░░░░░░░░░░░░░   0%
6.4  Hardening            ░░░░░░░░░░░░░░░░░░░░   0%
6.5  E2E Críticos         ░░░░░░░░░░░░░░░░░░░░   0%
6.6  Deploy Produção      ░░░░░░░░░░░░░░░░░░░░   0%
6.7  Release Notes        ░░░░░░░░░░░░░░░░░░░░   0%
6.8  Docs Operacionais    ░░░░░░░░░░░░░░░░░░░░   0%
6.9  Health Checks        ░░░░░░░░░░░░░░░░░░░░   0%
6.10 Backup               ░░░░░░░░░░░░░░░░░░░░   0%
6.11 Disaster Recovery    ░░░░░░░░░░░░░░░░░░░░   0%
6.12 Deploy Validation    ░░░░░░░░░░░░░░░░░░░░   0%
6.13 Production Cert.     ░░░░░░░░░░░░░░░░░░░░   0%
```

### Fase 7 — Product Maturity ⬜

```
7.1  UX Review             ░░░░░░░░░░░░░░░░░░░░   0%
7.2  Business Rules Audit  ░░░░░░░░░░░░░░░░░░░░   0%
7.3  Functional Audit      ░░░░░░░░░░░░░░░░░░░░   0%
7.4  UI Standardization    ░░░░░░░░░░░░░░░░░░░░   0%
7.5  Internal Docs         ████░░░░░░░░░░░░░░░░  20%
7.6  Training Docs         ███░░░░░░░░░░░░░░░░░  15%
7.7  SMG Academy           ░░░░░░░░░░░░░░░░░░░░   0%
7.8  Help Center           ░░░░░░░░░░░░░░░░░░░░   0%
7.9  Business Flow Cert.   ░░░░░░░░░░░░░░░░░░░░   0%
7.10 Product Cert.         ░░░░░░░░░░░░░░░░░░░░   0%
```

### Fase 8 — Commercial Scalability ⬜

```
8.1  ~~White Label~~        CANCELADO
8.2  Public API            ░░░░░░░░░░░░░░░░░░░░   0%
8.3  Webhooks Públicos     ░░░░░░░░░░░░░░░░░░░░   0%
8.4  Marketplace           ░░░░░░░░░░░░░░░░░░░░   0%
8.5  Integrações           ░░░░░░░░░░░░░░░░░░░░   0%
8.6  Billing (Plataforma)  ░░░░░░░░░░░░░░░░░░░░   0%
8.7  Multi Idioma          ░░░░░░░░░░░░░░░░░░░░   0%
8.8  Multi Moeda           ░░░░░░░░░░░░░░░░░░░░   0%
8.9  Internacionalização   ░░░░░░░░░░░░░░░░░░░░   0%
8.10 Enterprise Features   ░░░░░░░░░░░░░░░░░░░░   0%
8.11 SaaS Certification    ░░░░░░░░░░░░░░░░░░░░   0%
```

---

## Migration Health

```
Migration Health

██████████ 100%

104 arquivos SQL
98 migrations timestamped
6 utilitários / migrações legadas (sem timestamp)
0 arquivo vazio (0 bytes)
0 quebradas
0 pendentes
0 divergentes
0 issues críticos
4 issues médios documentados
4 issues baixos documentados

Última auditoria: 08/08/2026 (6.0.5.5 — IMPLEMENTADA: migration `20260807020000` validada em docker T1–T12, unit 883/883, SCHEMA FREEZE = YES; **Hardening de RPCs irmãs CONCLUÍDO: `create_invoice`/`record_payment_attempt` quebradas foram corrigidas na migration `20260808000000` — suite S1–S16 + G1 PASS, decisão PO D-6.0.5.5-6..8**; **6.0.5.6 PCA EXECUTADA → ✅ `READY`: BLOCKED inicial (migration `20260806030000` pulada + 3 excedências de limite) → correções PO D-6.0.5.6-5/6 (`migration repair --status applied 20260806030000` + upgrade `free→pro` dos 3 tenants) → re-auditoria OK → janela única de deploy LIBERADA — ver `PRODUCTION_COMPATIBILITY_AUDIT.md`**; **JANELA ÚNICA DE DEPLOY ✅ EXECUTADA COM SUCESSO: backup lógico D-6.0.5.7 + restore test, 6 migrations aplicadas (`06090000`, `07000000`, `07010000`, `07020000`, `08000000`, `20260808110000` REVOKE anon D-6.0.5.8), pós-deploy 7/7 verdes, E2E Flow14 1/1 + Flow13 8/8 + Smoke 10/10 — ver `DEPLOY_LOG_FASE_6_0_5.md`**)
```

---

## Métricas do Projeto

| Métrica | Valor |
|---------|-------|
| Total de testes | 874 |
| Testes E2E | 31 |
| Arquivos de teste | 37 |
| Migrações SQL | 98 |
| Tabelas com RLS | 47 |
| Eventos de domínio | 16 |
| Subscribers | 8 |
| Application Services | 5 |
| Repositories | 14 |
| ADRs | 13 |

---

## Próximos Marcos

| Marco | Fase | Status |
|-------|------|--------|
| Event Driven Certificado | 4.10 | ✅ |
| Business Architecture | 5 | ✅ |
| SaaS Core Architecture | 5.5 | ✅ |
| Platform Certification | 5.6 | ✅ (com ressalvas) |
| SaaS Core Implementation | 6.0 | 🔵 6.0.1 + 6.0.2 + 6.0.3 concluídas — 6.0.4.1 + 6.0.4.2 + 6.0.4.3 concluídas (hardening RPC + lifecycle) — **6.0.4.4 Billing Engine CONCLUÍDA (baseline v1.4.2, E2E flow9/flow12 verdes)** — **6.0.5.1 CERTIFICADA (baseline v1.4.3, E2E flow13 8/8)** — **6.0.5.2 CERTIFICADA (smoke 10/10, 819 testes, deploy deferido pelo PO)** — **6.0.5.3 implementada (commit `b383222`, smoke 10/10, deploy deferido)** — **6.0.5.4 implementada (unit 874/874, migration `20260807010000` T1–T7 OK em docker)** — **6.0.5.5 IMPLEMENTADA (unit 883/883, migration `20260807020000` T1–T12 OK em docker — RPC `change_tenant_plan` superadmin + espelho `tenants.plan` + `changePlan`/`TenantSubscriptionUpdated` + `Admin.tsx` sem escrita direta + `UpgradePrompt` + `StatusBanner` + depreciação `featureAvailability.ts`; **SCHEMA FREEZE = YES**; **Hardening de RPCs irmãs ✅** — `create_invoice`/`record_payment_attempt` corrigidas na migration `20260808000000` (S1–S16 + G1 PASS; D-6.0.5.5-6..8))** — **6.0.5.6 PCA EXECUTADA → ✅ `READY` (auditoria somente leitura do banco real — ver `PRODUCTION_COMPATIBILITY_AUDIT.md`; BLOCKED inicial → correções PO D-6.0.5.6-5/6 → re-auditoria OK → **janela única de deploy LIBERADA**)** — **JANELA ÚNICA DE DEPLOY ✅ EXECUTADA COM SUCESSO (2026-08-08): backup lógico D-6.0.5.7 + restore test, 6 migrations aplicadas (`06090000`, `07000000`, `07010000`, `07020000`, `08000000`, `20260808110000` REVOKE anon D-6.0.5.8), pós-deploy 7/7 verdes, E2E Flow14 1/1 + Flow13 8/8 + Smoke 10/10 — ver `docs/DEPLOY_LOG_FASE_6_0_5.md`; sem merge, sem deploy frontend, sem baseline — aguarda homologação → 6.0.6 → certificação v1.5)** — **6.0.6 Compliance & Legal registrada (gate obrigatório de certificação da release v1.5 — decisão PO 2026-08-07; entry audit `PHASE_6_0_6_ENTRY_AUDIT.md` criada)** |
| Production Ready | 6.13 | ⬜ |
| Product Mature | 7.10 | ⬜ |
| SaaS Certified | 8.11 | ⬜ |

---

## Estimativas do PO (2026-08-06)

> Registradas por decisão do PO após a certificação da 6.0.3. Refletem a visão de negócio do progresso da plataforma.

| Área | Status |
|-------|--------|
| Arquitetura | ✅ 100% |
| Segurança Base | ✅ 97% |
| Multi-tenant | ✅ 98% |
| Onboarding Owner | ✅ |
| Team Onboarding | ✅ |
| Convites | ✅ |
| SaaS Core | ✅ |
| E2E | ✅ Muito madura |

**Visão geral do PO:** SMG Barber entre **90% e 92%** do caminho para um SaaS completo. A fundação do SaaS está encerrada; o que resta são capacidades de negócio (Billing, Feature Flags e Hardening final).

**Próximas etapas (estimativa do PO):** 6.0.4 Billing (~maior fase restante — planos, trial, invoices, cobrança, suspensão, grace period) → 6.0.5 Feature Flags → Observabilidade/Produção/Deploy definitivo/Monitoramento.

---

## Referências

- `ROADMAP.md` — Roadmap oficial do projeto
- `docs/BUSINESS_ARCHITECTURE.md` — Arquitetura de negócio (Fase 5)
- `docs/SAAS_CORE_ARCHITECTURE.md` — Arquitetura SaaS Core (Fase 5.5)
- `docs/PLATFORM_CERTIFICATION.md` — Certificação da plataforma (Fase 5.6)
- `docs/TAXONOMY.md` — Glossário oficial
- `AGENTS.md` — Instruções para sessões de código

---

## Mudanças

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-08-08 | 6.0 | **Destino do legado `sou-manager` — git link DESCONECTADO (executado, decisão PO D-HOM-11).** Com aprovação explícita do PO, o **git link do projeto Vercel `sou-manager` foi desconectado** (`vercel git disconnect`; `sou-manager` → `link: NULL` confirmado via API). **Double-deploy eliminado**: um merge para `main` agora dispara deploy de produção apenas no `smg-barber` (oficial). **Nada deletado** — projeto, domínios, env (25 vars) e histórico preservados; **reversível** (`vercel git connect`). Projeto oficial `smg-barber` verificado intacto (link `github/sou-manager`). Registro: `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §8 + `BUSINESS_DECISIONS.md` (D-HOM-11). **ETAPA B: ADIADA (PO, 2026-08-08)** — validação local aguardando **conta de homologação** no tenant Sanchez Barber (verificação read-only: `profiles` só tem o superadmin; `user_tenants` vazio). Proteção de preview da Vercel mantida (decisão PO). **Sem deploy de produção.** |
| 2026-08-08 | 6.0 | **Homologação NÃO encerrada — H-8 formalizado como BLOQUEADOR (decisão PO D-HOM-10, 2026-08-08).** Após a auditoria Vercel: a produção atende o frontend `718f6f9` (~2026-07-17), **sem 6.0.1–6.0.5 e sem o fix de comissões `68acda4`** → homologar contra o frontend de produção **não valida a release v1.5**. Criado o **bloco "Hardening da Homologação / Vercel"** no plano de homologação (§8.1) com 8 etapas: (1) `smg-barber` como única origem oficial ✅; (2) destino do legado `sou-manager` — **aguardando decisão do PO**; (3) **ETAPA B** — repro `Invalid Refresh Token` → logout/login → validar `auth.uid()`, resolução de tenant, Dashboard e Comissões (tratado isoladamente do bug 400, já corrigido); (4) preview oficial com `68acda4` ✅ verificado (build real, `buildSkipped=false`); (5) re-teste de Comissões na Sanchez Barber sobre o preview oficial; (6) continuidade dos ~45 testes H-1..H-7; (7) registro de achados P0/P1/P2; (8) fechamento H-1…H-8 + veredito. **Proibido até nova ordem do PO:** merge `main`, deploy v1.5, abertura 6.0.6, alterações remotas na Vercel. Registros: `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md`, `RELEASE_CHECKLIST_v1.5.md`, `BUSINESS_DECISIONS.md` (D-HOM-10). |
| 2026-08-08 | 6.0 | **H-8 Infraestrutura Vercel / Deployment Topology adicionado à homologação (decisão PO D-HOM-9).** Detecção: o mesmo commit `68acda4` (fix de comissões) foi implantado em **dois projetos Vercel** (`smg-barber` e `sou-manager`). **Auditoria SOMENTE LEITURA executada** (API Vercel GET + bundles HTTP): ambos servem o mesmo app e mesmo Supabase (`ushsnmlbeurfvlkieiln`); **oficial = `smg-barber`/`barber.soumanager.com`** (TAXONOMY); **legado = `sou-manager`** (`soumanager.com`/`club.soumanager.com`, env 25 vars com credenciais legadas, `MULTI_SCHEMA_ENABLED=true`). **Achado crítico: produção defasada `718f6f9` (~2026-07-17)** — sem 6.0.1–6.0.5 e sem o fix de comissões; builds validados estão em previews da branch. Riscos: double-deploy em merge para `main`; divergência de schema routing. Relatório: `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`. **Nenhuma alteração remota na Vercel** — reconciliação e destino do legado aguardam decisão do PO. |
| 2026-08-08 | 6.0 | **Fix da página de Comissões (`pages/Commissions.tsx`).** Correção P1+P2 do crash "Não foi possível carregar as comissões" (PostgREST `400` em URL ~38KB: `.in('id', 994 ids)` > `urlLengthLimit` 8000 chars do postgrest-js). P1: pré-consulta de appointments no período (`start_time gte/lte` ISO) + comandas via superset SQL (`created_at` OU `closed_at` no range OU `appointment_id` em lotes ≤120) — filtro JS autoritativo (`getProductionDate`) inalterado. P2: paginação (`fetchAllPages`, pageSize 1000) + chunking (`fetchInChunks`, batch 120) para todas as `.in()` com muitos ids. Verificado end-to-end no tenant real (Barbearia Principal): 102 comandas no range de 08/2026 (idêntico ao filtro JS), sem `400`; comanda_items/clients/participants chunked. Unit commission 92/92, build OK, typecheck sem novos erros (baseline pré-existente em arquivos não relacionados). |
| 2026-08-08 | 6.0 | **Gate formal de homologação da Sanchez Barber criado (decisão PO 2026-08-08, D-HOM-1..8).** A homologação vira **gate formal da release v1.5** (não lista informal): 7 gates (H-1 Integridade operacional, H-2 Fluxo financeiro P0, H-3 Chef Club, H-4 Billing/Lifecycle, H-5 Feature Flags, H-6 Segurança, H-7 Operação real) + vereditos 🟢 HOMOLOGADO / 🟡 HOMOLOGADO COM RESSALVAS / 🔴 BLOQUEADO + evidência obrigatória por teste (responsável, data, resultado, observação). **Regra: 6.0.6 não começa sem homologação formalmente aprovada pelo PO.** Plano **exclusivamente documental** em `docs/audit/HOMOLOGATION_PLAN_SANCHEZ_BARBER.md`; registros em `BUSINESS_DECISIONS.md` (D-HOM) e `RELEASE_CHECKLIST_v1.5.md` (§10.1 + §13). **Nenhuma execução de teste / alteração de código / banco até aprovação formal do PO.** |
| 2026-08-08 | 6.0 | **JANELA ÚNICA DE DEPLOY ✅ EXECUTADA COM SUCESSO (2026-08-08).** Sequência completa contra o remoto real `ushsnmlbeurfvlkieiln` (Sanchez Barber): (1) **Backup lógico (D-6.0.5.7 — plano Free, sem PITR):** `supabase db dump --linked --role-only`/`--schema`/`--data-only --use-copy` + `data_app.sql` (exclui `auth.*`/`storage.*`), hashes SHA-256 registrados, cópia de custódia em `C:\Users\admsm\Backups\SMG_BARBER\20260808_20260808-093350\`; **restore test validado em Docker** `public.ecr.aws/supabase/postgres:17.6.1.106` (PG 17.6 = remoto; container `smg-restore-test`): `roles → schema → data_app` OK com contagens 100% idênticas (45/42/8/1/2/15/42/4901). (2) **6 migrations aplicadas** via `MIGRATION_EXCEPTION` (`db query --linked -f` + `migration repair --status applied`) na ordem: `06090000` (plans 3/features 20/plan_features 49), `07000000` (feature_flags + `tenant_has_feature`), `07010000` (suspend/reactivate + fail-fast + `grace_ends_at`), `07020000` (`change_tenant_plan`), `08000000` (fix RPCs irmãs), `20260808110000` (**fix hardening D-6.0.5.8 — 55× `REVOKE EXECUTE FROM anon`**, débito pré-existente 6.0.4.2; exceções públicas preservadas). (3) **Pós-deploy 7/7 verdes:** histórico zero pendentes, FKs, RLS, grants pós-fix (`anon_restantes=0`), 11 RPCs de contrato, matriz free=14/pro=15/premium=20, contagens idênticas ao snapshot pré-deploy. (4) **E2E:** Flow14 1/1 (16.4s — `past_due → suspended → active`), Flow13 8/8, Smoke 10/10 (42.0s). Sem merge, sem deploy frontend, sem baseline. Log completo: `docs/DEPLOY_LOG_FASE_6_0_5.md`. Próximo gate: homologação Sanchez Barber → 6.0.6 → certificação v1.5. |
| 2026-08-08 | 6.0 | **6.0.5.6 — Production Compatibility Audit (PCA) EXECUTADA → ✅ `READY` (2026-08-08).** Auditoria somente leitura do banco real (project ref `ushsnmlbeurfvlkieiln` — Sanchez Barber) concluída. Veredito inicial **❌ `BLOCKED`**: **1 incompatibilidade crítica** — migration `20260806030000` **pulada no remoto**, `cancel_subscription` atual (11 colunas, `06050000`/`06070000` aplicadas) × `CREATE OR REPLACE` de 5 colunas da pendente → erro garantido (`cannot change return type`); a autorização que ela adiciona já estava no remoto via `06070000`. **3 excedências de limite** — Barbearia Principal (produtivo, `free`, 4 staff), Loja Demo Varejo (3), SMG Estética (2) > `max_staff=1`. **Correções aprovadas pelo PO (D-6.0.5.6-5/6) e executadas:** (1) `supabase migration repair --status applied 20260806030000` (confirmado em `migration list`); (2) upgrade `free→pro` dos 3 tenants (UPDATE direto em `tenants.plan`; o RPC `change_tenant_plan` ainda não está aplicado no remoto). **Re-auditoria parcial: `limit_check = OK` em 100% dos 45 tenants + topologia OK → `READY` → janela única de deploy LIBERADA** (pendentes: `06090000`, `07000000`, `07010000`, `07020000`, `08000000`). Compatível: tenants 0 sem plano / 0 inválidos; 1 subscription (0 órfãs); invoices 0/billing_events 2/payment_attempts 0; 15 Chef Club + 42 receivables; 16 RPCs compatíveis; FKs íntegras. Veredito: `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md`. |
| 2026-08-08 | 6.0 | **Hardening de RPCs irmãs concluído (decisão PO 2026-08-08, D-6.0.5.5-6..8).** Auditoria de estado efetivo (matriz por "última definição") + **validação empírica em Postgres 16 docker (suite S1–S16 + G1)** executando as 13 RPCs do ciclo de billing → confirmou que a `20260806070000` já corrigiu 7 RPCs irmãs, mas **2 permaneciam quebradas**: `create_invoice` (`ON CONFLICT (tenant_id, idempotency_key)` colidindo com OUT param `tenant_id`) e `record_payment_attempt` (`RETURNING id` colidindo com OUT param `id`) — declaradas "limpas" incorretamente. **Fix aditivo na migration `20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql`:** `ON CONFLICT DO NOTHING` + alias `a`/`RETURNING a.id`; grants ADR-012 reafirmados. **Sem alteração de regra/contrato/escopo.** **Validação pós-fix: S1–S16 + G1 TODOS PASS + idempotência 2×.** Runbook atualizado (§3.6 + §4.9 + §6.4); aplicação na janela única de deploy. |
| 2026-08-08 | 6.0 | **6.0.5.5 — Transições RPCs IMPLEMENTAÇÃO CONCLUÍDA (2026-08-08).** Migration `20260807020000_phase_6_0_5_5_transitions.sql`: RPC **`change_tenant_plan`** (SECURITY DEFINER superadmin, grants ADR-012) upgrade/downgrade transacional gravando `subscriptions.plan` **e espelho `tenants.plan`** (Single Writer ADR-013 §3.1) + evento `TenantPlanChanged` via `record_billing_event`. **Validada em Postgres 16 docker: idempotente (2×) + cenários T1–T12 OK** (grants; upgrade/downgrade free↔pro↔premium; espelho transacional; payload do evento; plano inválido; idempotência same-plan; não-superadmin; sem subscription; tenant inexistente; sem sessão; ordem fail-fast). **Bug real encontrado e corrigido na validação:** referência de coluna não qualificada conflitando com OUT params de `RETURNS TABLE` → `column reference "id" is ambiguous` (reproduzido PG15 e PG16) — todas as referências qualificadas. Application: `changePlan(tenantId, plan, reason?)` + evento `TenantSubscriptionUpdated` (idempotente). `pages/Admin.tsx`: escrita direta de `tenants.plan` **removida** (grep zero). UI: `UpgradePrompt` (fallback do `FeatureGuard`) + `StatusBanner` (trial/past_due/suspended/cancelled). `featureAvailability.ts` deprecada; `planCatalog.ts` + `getUpgradeTarget`/`isDowngrade`. **Unit 883/883 (+9)**, typecheck sem novos erros, build OK. **GATE Schema Freeze REEXECUTADO → `SCHEMA FREEZE = YES`** (delta real = só a RPC prevista; registrado no `RELEASE_CHECKLIST_v1.5.md`). E2E flow11/flow14 adiados à janela única (decisão PO). Nenhuma migration aplicada ao remoto. |
| 2026-08-07 | 6.0 | **6.0.5.5 — Transições RPCs entry audit submetida (somente documentação, decisão PO 2026-08-07).** Última implementação funcional da série 6.0.5: RPC `change_tenant_plan` upgrade/downgrade transacional (grava `subscriptions.plan` + espelho `tenants.plan` — fim da dual source of truth, Single Writer ADR-013 §3.1; grants ADR-012; migration planejada `20260807020000`); `changePlan` em `application/tenantLifecycle.ts` + evento `TenantSubscriptionUpdated`; correção `pages/Admin.tsx:856`; `UpgradePrompt` (fallback do `FeatureGuard`, D-6.0.5.3-5) + banner de estado; depreciação de `featureAvailability.ts`. **Gate "Schema Freeze Candidate" (PO 2026-08-07): veredito preliminar `SCHEMA FREEZE = NO` — somente a RPC `change_tenant_plan` como novo objeto de schema; reexecutado no fechamento → `SCHEMA FREEZE = YES` antes da PCA (6.0.5.6).** Hardening opcional M7/M11/M12 + E2E flow11 (D-6.0.5.5-4) aguardando decisão do PO. Criado `docs/audit/PHASE_6_0_5_5_ENTRY_AUDIT.md`. **Nenhum código, migration, tabela, SQL, RPC, API ou componente React foi alterado — somente documentação.** |
| 2026-08-07 | 6.0 | **6.0.6 — Compliance & Legal registrada como fase oficial (gate obrigatório de certificação da release v1.5, decisão PO 2026-08-07).** Fase **exclusivamente documental** posicionada **após a conclusão da 6.0.5.x** (incluindo PCA 6.0.5.6 + janela única de deploy) e **antes da certificação final da Release v1.5**. Escopo registrado: gestão de documentos legais versionados (Termos de Uso, Política de Privacidade, LGPD, Contrato SaaS, Consentimentos, Cookies); versionamento (versão/hash/data/obrigatoriedade/histórico — sem substituição de antigos); aceite eletrônico (usuário/tenant/data/hora/IP/User-Agent/versão — histórico imutável); reaceite obrigatório em documento alterado (nova versão → login → reaceite → acesso); Centro Jurídico administrativo; objetivos LGPD (exportação, retenção, exclusão, consentimentos, auditoria); modelo de dados proposto `legal_documents`/`document_versions`/`accepted_documents` (**apenas arquitetura — nenhuma migration**); fluxo oficial com Aceite Jurídico entre Onboarding e Criação do Tenant; **gate da release: v1.5 só concluída com documentos jurídicos existentes + aceite eletrônico + versionamento + auditoria de aceite + Centro Jurídico + checklist de compliance aprovado**. Criado `docs/audit/PHASE_6_0_6_ENTRY_AUDIT.md` e atualizados `ROADMAP.md`, `RELEASE_CHECKLIST_v1.5.md` e `BUSINESS_DECISIONS.md` (D-6.0.6). **Nenhum código, migration, tabela, SQL, RPC, API ou componente React foi alterado — somente documentação.** |
| 2026-08-07 | 6.0 | **6.0.5.4 — TenantLifecycleService + `suspended` aditivo IMPLEMENTAÇÃO CONCLUÍDA.** Migration `20260807010000_phase_6_0_5_4_tenant_lifecycle.sql`: CHECK aditivo `suspended` (sem `archived` — D-6.0.5-7); coluna `grace_ends_at` + backfill de `past_due` legadas (R6/D-6.0.5.4-5); `apply_subscription_transition` reescrita com map explícito completo + **`ELSE RAISE EXCEPTION`** (fim do bug latente `ELSE→active`, DIV-1) + `p_grace_ends_at`; `get_due_subscriptions` devolve `grace_ends_at` e inclui candidatas com grace expirado; RPCs **`suspend_subscription`/`reactivate_subscription`** (superadmin, D-6.0.5-4, grants ADR-012). **Migration validada em Postgres 16 docker: aplica 2× (idempotente) + cenários T1–T7 OK.** Domain: `SubscriptionStatus += 'suspended'`, `BillingSubscription += graceEndsAt`, ação `suspend` no engine (`_graceDays` ativado) + **`TenantLifecycleService`** (`domain/tenant/` — writer único de `tenants.status`, ADR-013 §3.1, matriz congelada §5.2) + `TenantRepository.updateStatus`. Application: `runCycle` aplica `suspend` + publica `TenantSubscriptionSuspended`; `markPaid` reativa `suspended→active` + publica `TenantSubscriptionReactivated`. **Unit 874/874 (+27)**, typecheck 125 baseline, build OK, `architecture:ci` verde. **E2E flow14 (spec) escrito + typecheck OK; EXECUÇÃO ADIADA pelo PO para a janela única de deploy** — nenhuma migration aplicada ao remoto; flow14 rodará no runbook junto a `06030000`/`06090000`/`07000000` + smoke pós-deploy. |
| 2026-08-07 | 6.0 | **6.0.5.6 — Production Compatibility Audit (PCA) registrada como etapa oficial da release v1.5 (somente documentação, decisão PO 2026-08-07).** Nova subfase **6.0.5.6** (⏳ PLANNED) posicionada entre 6.0.5.5 e o Deploy Runbook na janela única. **Objetivo:** auditoria **somente leitura** do banco real dos tenants produtivos antes da primeira aplicação das migrations SaaS da release (planos, Feature Flags, Tenant Lifecycle, Billing, limites, regras de acesso, novas relações). **Regras:** não altera dados, não aplica migrations, não corrige automaticamente, não cria registros, não executa repair — somente analisa e gera relatório. **Critérios de entrada:** 6.0.5.1–6.0.5.3 ✅; 6.0.5.4/6.0.5.5 ⬜; schema congelado ⬜; runbook aprovado ⬜. **Critério de saída:** `docs/audit/PRODUCTION_COMPATIBILITY_AUDIT.md` = **READY** ou **BLOCKED**. **Gate de release: nenhuma migration de produção sem PCA = READY.** Escopo futuro registrado (Tenants, Plans, Subscriptions, Billing, Feature Flags, Limites, Chef Club, Segurança, Integridade). Também criado `docs/RELEASE_CHECKLIST_v1.5.md` (checklist vivo com gate PCA). **Nenhum código/migration/teste/query foi executado.** |
| 2026-08-07 | 6.0 | **6.0.5.3 — Implementação em andamento (PO aprovou início em 2026-08-07).** Backend: `domain/billing/featureFlagService.ts` (writer único) + `planCatalogDb.ts` (PlanCatalog DB-backed, `CATALOG_FINGERPRINT`) + `featureOverrideStoreDb.ts` + fim de `limits.ts`. **Decisão PO: adapters DB em `domain/billing/`** (padrão `supabaseBillingRepository.ts`) — guard intacto, **repositoryViolations 233 → 230** (redução de dívida); entry audit atualizada. Frontend: `useFeatureFlags` + `FeatureGuard` + `FeatureUnavailablePage` + gates no `App.tsx`/`Sidebar.tsx`/`moduleRegistry.ts`. Migration `20260807000000` **validada em Postgres 16 docker** (aplica 2×; T1–T7 OK; bug de `COMMENT \|\|` corrigido na validação). Unit 847/847, build OK, `architecture:ci` verde. Pendente: smoke E2E + docs finais + commit/push. |
| 2026-08-07 | 6.0 | **6.0.5.3 — Revisão documental da entry audit concluída (somente documentação, decisão PO 2026-08-07).** Ajustes do PO incorporados a `PHASE_6_0_5_3_ENTRY_AUDIT.md`: escopo delimitado (D-6.0.5.3-1 — enforcement de flags + resolução de planos apenas); `change_tenant_plan`/`TenantSubscriptionUpdated`/`Admin.tsx:856` → 6.0.5.5 (D-6.0.5.3-2); deploy via `MIGRATION_EXCEPTION` (D-6.0.5.3-3); RPCs protegidas = cash_closing, commissions, receivables, expenses (D-6.0.5.3-4); UI híbrida com `FeatureUnavailablePage` reutilizável (D-6.0.5.3-5); leitura só via RPC `tenant_has_feature` (D-6.0.5.3-6). **API do `FeatureFlagService` congelada** (§2.5) + legado/depreciação (§2.6) + testes ampliados (matriz Free/Pro/Premium + upgrade/downgrade + doc×código, T1–T10) + critérios de saída atualizados (zero decisões diretas por plano, uso exclusivo do service, `limits.ts` fora do runtime, matriz sincronizada, smoke verde). Decisões D-6.0.5.3-1..6 em `BUSINESS_DECISIONS.md`; `FEATURE_FLAGS_MODEL.md` §4/§5/§6 alinhados. **Nenhum arquivo de código/migration/teste alterado. Relatório final aguardando aprovação do PO para implementação.** |
| 2026-08-07 | 6.0 | **6.0.5.2 CERTIFICADA PELO PO (2026-08-06) — smoke E2E 10/10 PASS (48.4s, Supabase real)** + **entry audit 6.0.5.3 SUBMETIDA (2026-08-07)**. Smoke `core.spec.ts` (@smoke) com chaves reais validadas (auditoria de prontidão derrubou o diagnóstico "chaves inválidas" — anon==publishable e service role válidas, REST/admin 200); seed+teardown limpos (tenant removido, 4 users desta run deletados); 6 usuários `e2e-suite-*` órfãos são acúmulo de runs de 05/08 (housekeeping em janela separada). Achados de segurança **pré-existentes** registrados como **backlog** (não são regressões e NÃO corrigidos nesta etapa): anon lê perfis superadmin via REST (policy `Superadmins can view all profiles` sem `TO authenticated`) e `public_select_tenants` (kiosk legacy, `USING (true)`) — `SECURITY_AUDIT_RLS.md` marca `profiles` ✅ Seguro (gap não capturado). **Entry audit `PHASE_6_0_5_3_ENTRY_AUDIT.md` submetida ao PO** — escopo: `feature_flags` runtime (override tenant×flag + suspensão derivada) + RPC `tenant_has_feature` (grants ADR-012) + `FeatureFlagService` (writer único ADR-013 §3.1) + `PlanCatalog` DB-backed (contrato preservado) + fim de `limits.ts`/SQL hardcoded (`invite_team_member`) + `change_tenant_plan` + evento `TenantSubscriptionUpdated` + correção `Admin.tsx:856` (bypass Single Writer) + unificação do gate `App.tsx` (profile→tenant→flag). **4 aprovações solicitadas ao PO (A1 deploy/migração tolerante, A2 lista de RPCs com guarda, A3 comportamento UI, A4 grants).** Sem código 6.0.5.3 até aprovação explícita do PO. |
| 2026-08-06 | 6.0 | Fase 6.0.5.2 (BillingService + Modelagem de Plans) **IMPLEMENTAÇÃO CONCLUÍDA + REVIEW PO**. Migration `20260806090000_phase_6_0_5_2_plans_catalog.sql` (`plans`/`features`/`plan_features`, seed idempotente free 14 / pro 15 / premium 20, FK TEXT `tenants.plan`/`subscriptions.plan` → `plans(slug)`, drop CHECKs, RLS) + contrato único **`PlanCatalog`** (`domain/billing/planCatalog.ts` — acréscimo obrigatório do PO) + `FEATURE_KEYS` 1:1 BD (`domain/billing/featureKey.ts`, 20) + `PLAN_CATALOG_VERSION`/`CATALOG_FINGERPRINT` (checksum determinístico, acréscimo do review) + cobertura total (igualdade bidirecional 100% BD↔TS) + resolver 6.0.5.1 passa a resolver via catálogo (zero SQL) + `limits.ts` marcado legacy. Unit **819/819 (+24)**, typecheck sem novos erros (125 baseline), build OK, migration validada em Postgres 16 docker (aplica 2× sem duplicar; FK rejeita `elite`). **Deploy ao remoto DEFERIDO pelo PO** (janela apropriada — não empurrar junto a `20260806030000` pendente; chaves validadas posteriormente — smoke real 10/10). Entry audit `PHASE_6_0_5_2_ENTRY_AUDIT.md` ✅ APROVADA/IMPLEMENTADA. Sem nova baseline (próxima `v1.5.0-feature-flags-6.0.5`). |
| 2026-08-06 | 6.0 | Fase 6.0.5.1 (Estado Efetivo / camada de autorização) **CERTIFICADA** (baseline `v1.4.3-effective-state-6.0.5.1`, E2E real flow13 8/8). `AuthorizationService`/`EffectiveAccessService`/`effectiveState.ts` como fonte única; migration `20260806060000` (profile_status enum + coluna `staff.tenant_id`). Unit 795/795. |
| 2026-08-06 | 6.0 | Fase 6.0.4.4 (Billing Engine) **CONCLUÍDA e CERTIFICADA (E2E real flow9 + flow12 verdes)**. Migration `20260806050000` aplicada (cancel_at_period_end; `cancel_subscription` vira pedido) + corretivas `20260806070000` (fix 7 RPCs com `column reference "id" is ambiguous` — OUT params de `RETURNS TABLE` colidindo com colunas) e `20260806080000` (enum `tenant_status`). `domain/billing/` engine TS puro (fonte da verdade, sem cron); `application/billing.ts` BillingService (runCycle/markPaid/handleFailure/issueInvoice). FinanceSubscriber/Provider estendidos (`create_receivable`). Flow9 onboarding→trial→active e flow12 cancelamento→efetivação passam no banco real. Unit 749/749, build OK, typecheck da fase zerado. Baseline `v1.4.2-billing-engine-6.0.4.4`. 6.0.5 Feature Flags PRÓXIMA. |
| 2026-08-06 | 6.0 | Fase 6.0.4.3 (Billing Lifecycle) concluída: migration `20260806040000` — `complete_onboarding` passa a `draft → trial` invocando `start_trial` (F10/D5), guard alinhado a `current_is_tenant_manager_from_auth_uid` e grants conforme ADR-012. `application/tenantLifecycle.ts` — `TenantLifecycleService` (startTrial/activate/cancel/getStatus) centraliza a emissão dos eventos de billing; `onboarding.ts` delega os eventos de billing ao service. Docs: `TENANT_LIFECYCLE.md` (estado implementado) + `TAXONOMY.md` (8.1 Termos de Billing). Unit 699/699, build OK. Migration aplicada ao banco real via procedimento da `MIGRATION_EXCEPTION` (db query --linked + repair applied; grants anon/PUBLIC removidos). 6.0.4.4 Billing Engine PRÓXIMA. |
| 2026-08-06 | 6.0 | Fase 6.0.4.2 (Billing Foundation) + hardening de autorização: migration `20260806030000` corrige ambiguidades do `start_trial`, adiciona guard `auth.uid()` no `record_billing_event` e aplica `REVOKE anon` em RPCs privilegiadas. **ADR-012** registra o contrato permanente de grants (REVOKE anon / GRANT authenticated). Backlog "Security Hardening — RPC Permission Audit" registrado. Baseline `v1.4.0-billing-foundation-6.0.4.2`. 6.0.4.3 Lifecycle PRÓXIMA. |
| 2026-08-06 | 6.0 | Fase 6.0.3 (Team Onboarding & Invitations) ENCERRADA e CERTIFICADA. Edge Function `invite-team-member` deployada + SMTP/APP_URL/allowlist validados. E2E real 30/30 + 1 gated, unit 659/659, build OK. Bug `tenant_id is ambiguous` no `accept_invite` corrigido via migration `20260806010000`. Baseline `v1.3.0-team-onboarding-certified`. Branch `feature/phase-6.0.4-billing` criada. |
| 2026-08-05 | 6.0 | Estimativas do PO registradas (82–88% SaaS completo). Início do planejamento da Fase 6.0.3 Team Onboarding. |
| 2026-08-05 | 6.0 | Fase 6.0.3 renomeada para "Team Onboarding & Invitations" (decisão PO). Tenant Lifecycle considerado já implementado (Sprint 1/6.0.1) e removido como fase. Branch `feature/phase-6.0.3-team-onboarding` criada. |
| 2026-08-05 | 6.0 | Fase 6.0.2 (Onboarding Completo) ENCERRADA e CERTIFICADA. Migration #93 aplicada (db real). E2E gated flow6/flow6a/flow7 verdes + suíte completa 29/29. Baseline `v1.2.0-onboarding-certified`. |
| 2026-08-05 | 6.0 | Fase 6.0.1 (Tenant Creation) ENCERRADA e CERTIFICADA. Suite E2E real (28 testes) verde em 2 execuções consecutivas. Baseline congelada `v1.1.0-e2e-certified`. Fase 6.0.2 renomeada para "Onboarding Completo" (decisão PO). |
| 2026-07-28 | 6.0 | Fase 5.6 CONCLUÍDA com ressalvas. Taxonomia corrigida (60 ocorrências). Dívida técnica registrada. Fase 6 reestruturada com 6.0 SaaS Core Implementation. |
| 2026-07-28 | 5.0 | Fase 5 e 5.5 CONCLUÍDAS. 5 definições finais incorporadas: Grace Period, Retenção, Gateway, Notificações, Auditoria. Architecture Freeze v1.0 recomendado. |
| 2026-07-28 | 4.0 | Decisões do PO incorporadas: onboarding (8 etapas), lifecycle (7 estados), billing (mensal, gateway desacoplado), planos (Free/Pro/Elite, limites configuráveis), hierarquia de papéis |
| 2026-07-25 | 3.0 | Fase 5.5 renomeada para "SaaS Core Architecture" (9 blocos), Fase 5.6 "Platform Certification" adicionada |
| 2026-07-25 | 2.0 | Fase 5.5 (Tenant & Billing) adicionada, métricas atualizadas |
| 2026-07-23 | 1.0 | Criação do documento de status |
