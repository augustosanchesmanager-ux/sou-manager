# SMG Platform — Status do Projeto

> Visão instantânea da evolução do projeto. Última atualização: 2026-08-06.
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
6.0.5  Feature Flags      ░░░░░░░░░░░░░░░░░░░░   0%
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

103 arquivos SQL
97 migrations timestamped
6 utilitários / migrações legadas (sem timestamp)
0 arquivo vazio (0 bytes)
0 quebradas
0 pendentes
0 divergentes
0 issues críticos
4 issues médios documentados
4 issues baixos documentados

Última auditoria: 06/08/2026 (Fase 6.0.3)
```

---

## Métricas do Projeto

| Métrica | Valor |
|---------|-------|
| Total de testes | 659 |
| Testes E2E | 31 |
| Arquivos de teste | 24 |
| Migrações SQL | 97 |
| Tabelas com RLS | 47 |
| Eventos de domínio | 16 |
| Subscribers | 8 |
| Application Services | 5 |
| Repositories | 14 |
| ADRs | 12 |

---

## Próximos Marcos

| Marco | Fase | Status |
|-------|------|--------|
| Event Driven Certificado | 4.10 | ✅ |
| Business Architecture | 5 | ✅ |
| SaaS Core Architecture | 5.5 | ✅ |
| Platform Certification | 5.6 | ✅ (com ressalvas) |
| SaaS Core Implementation | 6.0 | 🔵 6.0.1 + 6.0.2 + 6.0.3 concluídas — 6.0.4.1 + 6.0.4.2 + 6.0.4.3 concluídas (hardening RPC + lifecycle) — **6.0.4.4 Billing Engine CONCLUÍDA (baseline v1.4.2, E2E flow9/flow12 verdes)** |
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
