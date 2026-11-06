# PHASE 8 — ENTRY AUDIT (Commercial Scalability)

> **Fase:** Fase 8 — Commercial Scalability  
> **Data:** 2026-11-05  
> **Auditor / Responsável:** Antigravity (Platform Architect) + Augusto (PO)  
> **Status:** `GATE_ACCEPTED` (Aprovado formalmente pelo PO em 2026-11-05)  
> **Modo:** **EXCLUSIVAMENTE DOCUMENTAL / GOVERNANÇA** — nenhum arquivo de código executável (`.ts`/`.tsx`/`.sql`) ou migration criado/alterado nesta etapa; nenhum deploy; validação de conformidade normativa pré-implementação.  
> **Baseline de Referência:** Fase 7 (Product Maturity) 100% concluída e certificada; release `v1.8.0` commitada (`chore(release): bump to v1.8.0 and publish Phase 7 changelog`).  
> **Fonte de Autoridade:** `ROADMAP.md` (Fase 8) · `AGENTS.md` · `docs/TAXONOMY.md` · `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` · `docs/adr/ADR-028-smg-gate-formal-contract.md`.

---

## 1. Resumo Executivo & Escopo da Fase 8

A **Fase 8 (Commercial Scalability)** representa a transição da SMG Platform de um SaaS maduro e homologado para um ecossistema aberto e escalável comercialmente, focado exclusivamente no produto ativo **SMG Barber** (*The Barbershop Intelligence*).

Conforme a **Diretriz Estratégica D1 (2026-07-24)**, o conceito de *White Label (Subfase 8.1)* permanece **formalmente CANCELADO**: o foco absoluto é o isolamento multi-tenant de alto desempenho e segurança.

### Subfases Previstas no Roadmap
- **8.1 ~~White Label~~:** CANCELADO (D1).
- **8.2 Public API:** Exposição controlada de recursos operacionais para integrações de terceiros e barbearias via API REST, autenticação por API Keys e quotas por plano.
- **8.3 Webhooks Públicos:** Disparo assíncrono de eventos de negócio para endpoints de parceiros, com assinatura criptográfica, retries com backoff e outbox resiliente.
- **8.4 Marketplace:** Catálogo de extensões e parceiros integrados.
- **8.5 Integrações:** Conectores diretos com ecossistemas externos (ERPs, gateways).
- **8.6 Billing da Plataforma:** Cobrança corporativa multi-unidade.
- **8.7 / 8.8 / 8.9 Internacionalização:** Multi-idioma, multi-moeda e i18n.
- **8.10 Enterprise Features:** Auditoria avançada, SSO corporativo e SLAs customizados.
- **8.11 Certificação SaaS Final:** Atesto de escala e encerramento do roadmap oficial.

---

## 2. Auditoria Documental

| Documento Auditado | Estado Atual | Verificação de Conformidade |
|--------------------|--------------|-----------------------------|
| `ROADMAP.md` | Estabilizado na versão 9.04, Fase 7 100% concluída (7.1 a 7.10) e Fase 8 declarada como "Não iniciada". | ✅ Conforme. Restrição explícita de "sem ADR, nenhuma mudança estrutural poderá ser feita" rigorosamente respeitada. |
| `PROJECT_STATUS.md` | Atualizado refletindo a certificação master da Fase 7 e release v1.8.0. | ✅ Conforme. Indicadores de migrações e Repository Guard (baseline 222) preservados. |
| `src/lib/changelog.ts` | Versão `1.8.0` ativa com os 7 itens canônicos de novidades da semana. | ✅ Conforme. Testes unitários de persistência e conteúdo 100% PASS. |
| `docs/release-notes/RELEASE_NOTES_v1.8.0.md` | Publicado cobrindo o fechamento integral da Fase 7. | ✅ Conforme. Documento estruturado seguindo o template oficial da governança. |

---

## 3. Auditoria Arquitetural (Subfases 8.2 e 8.3)

A abertura de uma Public API e Webhooks impõe restrições invioláveis de segurança e isolamento para que integrações externas jamais comprometam a integridade dos dados da barbearia.

### 3.1 Vedação de `service_role` no Data Path (Invariante Crítico)
- **Regra:** Nenhuma requisição externa poderá executar queries ou mutações utilizando a credencial `service_role` irrestrita.
- **Arquitetura Homologada:** A autenticação de API Keys deve ocorrer via Edge Function (`public-api-gateway`). Uma vez autenticada a chave, a conexão com o banco deve injetar a sessão do tenant correspondente via RPC `set_config('request.jwt.claims', ..., true)` ou role intermediária restrita (`api_consumer`), garantindo que o PostgreSQL RLS (`current_tenant_id_from_auth_uid()`) continue aplicando o isolamento obrigatório por `tenant_id`.

### 3.2 Estrutura e Hashing de API Keys
- **Formato:** Prefixos semânticos e identificáveis:
  - Produção: `smg_live_<32_bytes_hex_ou_base62>`
  - Sandbox/Teste: `smg_test_<32_bytes_hex_ou_base62>`
- **Armazenamento:** Nunca armazenar a API Key em texto plano. O banco armazenará apenas:
  - `key_hash`: Digest criptográfico SHA-256 da chave.
  - `key_prefix`: Primeiros 8 caracteres visíveis para identificação no dashboard (ex: `smg_live_a1b2...`).
  - `tenant_id`: Vínculo obrigatório e imutável ao tenant proprietário.
  - `scopes`: Array de permissões granulares (`appointments:read`, `appointments:write`, `comandas:read`, `comandas:write`, `customers:read`).
  - `status`: `active`, `revoked`, `expired`.
  - `rate_limit_rpm`: Limite de requisições por minuto customizado ou herdado do plano.

### 3.3 Mensageria de Webhooks & Outbox Pattern
- **Padrão Outbox Assíncrono:** Mutações no core publicam eventos internos no Event Bus / Event Store existente (`domain/events/`). Um subscriber dedicado transaciona registros na tabela `webhook_deliveries`.
- **Garantia de Entrega:** O dispatcher de webhooks operará em background (Edge Function disparada por pg_cron/pg_net), com retry exponencial (1m, 5m, 15m, 1h, 6h) e circuit breaker para endpoints que retornem 410 (Gone) ou timeouts sucessivos.
- **Assinatura HMAC-SHA256:** Cada payload enviado conterá o header `X-SMG-Signature = t=<timestamp>,v1=<hmac_sha256(payload, webhook_secret)>` para validação criptográfica do lado do cliente.

---

## 4. Auditoria de Nomenclatura (Taxonomia Oficial)

Conforme as diretrizes de `docs/TAXONOMY.md` e os padrões de banco PostgreSQL do projeto:

| Entidade / Recurso | Nomenclatura Oficial Sancionada | Padrão Rejeitado (Proibido) |
|--------------------|----------------------------------|------------------------------|
| Tabela de Chaves de API | `public.api_keys` | `public.apikeys`, `public.user_tokens`, `auth_keys` |
| Tabela de Assinaturas Webhook | `public.webhook_subscriptions` | `public.webhooks`, `public.client_hooks` |
| Tabela de Entregas Webhook | `public.webhook_deliveries` | `public.webhook_logs`, `public.hook_history` |
| Header de Assinatura | `X-SMG-Signature` | `X-Signature`, `X-Webhook-Sign`, `Signature` |
| Header de Evento | `X-SMG-Event` | `X-Event-Type`, `Webhook-Event` |
| Prefixo de Chaves | `smg_live_` / `smg_test_` | `sk_live_`, `api_key_`, `token_` |
| Edge Function Gateway | `functions/v1/public-api` | `functions/v1/api`, `functions/v1/external` |
| Edge Function Webhooks | `functions/v1/webhook-dispatcher` | `functions/v1/send-webhooks` |

---

## 5. Auditoria de Consistência & Limites Comerciais

- **Vínculo com Planos de Assinatura (`tenants.plan`):**
  - Plano **Free/Trial:** Acesso à Public API e Webhooks bloqueado ou restrito a ambiente `test` com limite estrito (ex: 60 RPM).
  - Plano **Pro:** Acesso à Public API liberado com quota base (ex: 300 RPM) e até 3 webhooks ativos.
  - Plano **Enterprise/Custom:** Quotas customizadas e concorrência dedicada.
- **Preservação de Regras Contábeis:**
  - Nenhuma API externa pode contornar a validação do ADR-001 (comissão teórica vs fechamento de caixa), ADR-018 (reconhecimento de caixa) ou criar lançamentos financeiros com resíduo ($\Delta \neq \text{R\$} 0,00$).

---

## 6. Parecer de Entrada & Próximos Passos

| Requisito de Entrada | Status | Observação |
|----------------------|:------:|------------|
| Fase 7 integralmente concluída | ✅ PASS | Certificação master homologada e release notes v1.8.0 publicado. |
| working tree higienizado de código de produto | ✅ PASS | Sem pendências funcionais não commitadas. |
| Alinhamento arquitetural prévio | ✅ PASS | Princípio do isolamento RLS e não uso de `service_role` garantidos. |
| Minuta de ADR correspondente | ✅ ACCEPTED | ADR-032 aprovado formalmente pelo PO Augusto em 2026-11-05. |

**Veredito:** Autorizada a abertura formal e modelagem da Fase 8 através do **ADR-032 (ACCEPTED)**. Fase de modelagem SQL local e implementação de Edge Functions concluídas com sucesso.

---

## 7. Evidências de Execução e Homologação Técnica (Subfases 8.2 e 8.3)

### 7.1 Subfase 8.2 — Public API (`supabase/functions/api-gateway/`)
- **Modelagem SQL Canônica:** Tabela `public.api_keys` com isolamento multi-tenant obrigatório por `tenant_id`, RLS estrito, chave hasheada em SHA-256 (`key_hash`), prefixo semântico visível (`key_prefix`), escopos em `TEXT[]` e quotas configuráveis (`rate_limit_rpm`). Migration local `20261105183000_phase_8_public_api_and_webhooks.sql`.
- **Roteador e Endpoints Implementados:**
  - `GET /v1/health`: Checagem operacional do gateway.
  - `GET /v1/auth/verify`: Verificação de credencial, expiração e escopos atribuídos.
  - `GET /v1/appointments` & `POST /v1/appointments`: Listagem filtrada por data e criação atômica com validação de double-booking de cadeira e cliente no mesmo tenant.
  - `GET /v1/comandas` & `POST /v1/comandas`: Consulta detalhada com itens e abertura de comanda com derivação autoritativa de preços de catálogo (`services` e `products`) do tenant, garantindo resíduo zero contábil ($\Delta = \text{R\$} 0,00$).
  - `GET /v1/services` & `GET /v1/products`: Descoberta de catálogo com suporte a escopos granulares (`services:read`, `products:read`) ou agrupados (`catalog:read`).
- **Segurança e RBAC:** Validador `hasRequiredScope` com suporte a escopo único ou array alternativo; isolamento rigoroso por `tenant_id` injetado deterministicamente pelo contexto da API Key autenticada.

### 7.2 Subfase 8.3 — Webhooks Outbox & Dispatcher (`supabase/functions/webhook-dispatcher/`)
- **Modelagem SQL Canônica:** Tabelas `public.webhook_subscriptions` (assinaturas com segredo HMAC e lista de eventos) e `public.webhook_deliveries` (fila outbox com status, tentativas, timestamp de retry e payload JSONB), ambas sob políticas RLS estritas de tenant.
- **Assinatura Criptográfica HMAC-SHA256:**
  - Header canônico: `X-SMG-Signature: t={timestamp},v1={digestHex}` sobre a string `${timestamp}.${rawPayload}`.
  - Geração via Web Crypto API nativa (`crypto.subtle`) compatível com Deno e Node.js 18+.
  - Comparação em tempo constante (`constantTimeCompare`) para prevenção de timing attacks.
  - Validador `verifyWebhookSignature` com janela de tolerância temporal (padrão 300s) mitigando replay attacks.
- **Política de Retries com Backoff Exponencial Escalonado:**
  - 1ª falha (attempts = 1): $+1\text{ minuto}$ ($+60\text{s}$)
  - 2ª falha (attempts = 2): $+5\text{ minutos}$ ($+300\text{s}$)
  - 3ª falha (attempts = 3): $+15\text{ minutos}$ ($+900\text{s}$)
  - 4ª falha (attempts = 4): $+1\text{ hora}$ ($+3600\text{s}$)
  - 5ª falha (attempts = 5): $+6\text{ horas}$ ($+21600\text{s}$)
  - $\ge 6$ falhas: sem novos agendamentos (`next_retry_at = null`), transição definitiva para `status: 'failed'`.
- **Garantias Operacionais de Despacho:**
  - Timeout defensivo estrito de 8.000 ms via `AbortController` (retornando status 504 em caso de aborto).
  - Truncamento seguro de `response_body` (máximo 1.024 caracteres).
  - Header de identificação e rastreio: `X-SMG-Delivery-Id`, `X-SMG-Event`, `User-Agent: SMG-Webhook-Dispatcher/1.0`.

### 7.3 Subfase 8.4 — Marketplace & Extensões (`services/marketplaceService.ts`)
- **Modelagem SQL Canônica:** Tabelas `public.marketplace_extensions` (catálogo geral com status, categorias e escopos requeridos), `public.tenant_extensions` (instalações por barbearia com consentimento explícito e configurações isoladas em JSONB) e `public.extension_reviews` (avaliações de reputação 1 a 5 estrelas vinculadas a `auth.uid()`), sob políticas RLS estritas (migration local `20261106012000_phase_8_marketplace_and_extensions.sql`).
- **Camada de Aplicação:** Serviço `services/marketplaceService.ts` implementando descoberta com filtros por categoria e busca textual, busca por slug, RPC canônica de instalação atômica `install_marketplace_extension` com fallback defensivo, desinstalação segura, atualização de configurações e sistema de avaliações.

### 7.4 Subfase 8.5 — Integrações Core & Conectores (`services/integrationService.ts`)
- **Modelagem SQL Canônica:** Tabelas `public.integration_providers` (catálogo de provedores nativos homologados em gateways de pagamento, ERPs fiscais e CRMs), `public.tenant_integrations` (conexões ativas por barbearia com credenciais sensíveis isoladas) e `public.integration_sync_logs` (trilho de auditoria com direção, status, latência e external_ref_id), sob políticas RLS estritas e seed nativo (Mercado Pago, Asaas, ContaAzul, Omie, RD Station) na migration local `20261106020000_phase_8_core_integrations_and_connectors.sql`.
- **Camada de Aplicação:** Serviço `services/integrationService.ts` com RPC atômica `record_integration_sync_event` para registro de auditoria e atualização de timestamps/erros da integração, configuração segura por tenant, desativação de conectores e listagem filtrada de histórico de sincronização.

### 7.5 Subfase 8.6 — Billing da Plataforma SMG & Métricas de SaaS (`services/platformBillingService.ts`)
- **Modelagem SQL Canônica:** Tabelas `public.platform_plans` (catálogo oficial de planos comerciais SaaS: Starter R$ 149, Pro R$ 299, Enterprise R$ 699), `public.platform_subscriptions` (assinaturas corporativas por barbearia com controle de ciclo, carência e cancelamento agendado) e `public.platform_invoices` (faturas emitidas pela SMG com numeração única, vencimentos, rastreio de pagamento Pix/Boleto e RPC idempotente de liquidação `settle_platform_invoice`), todas sob RLS rigoroso por `tenant_id` e privilégios restritos a Super-Admin (migration local `20261106030000_phase_8_platform_billing_and_subscriptions.sql`).
- **RPC Executiva de SaaS:** `public.get_saas_executive_metrics()` com cálculo determinístico em tempo real de MRR normalizado, ARR ($\text{MRR} \times 12$), contagem e distribuição de assinantes por plano (`Starter`, `Pro`, `Enterprise`), montante de faturas em atraso e taxa de churn, protegido por checagem estrita de Super-Admin (`public.current_is_super_admin_from_auth_uid()`).
- **Camada de Aplicação:** Serviço `services/platformBillingService.ts` provendo abstrações limpas para catálogo de planos, consulta de assinatura ativa do estabelecimento, criação e atualização atômica de contratos, cancelamento imediato ou no encerramento do período, faturamento corporativo e liquidação idempotente de faturas.

### 7.6 Matriz de Testes Unitários da Fase 8 (148 testes dedicados em `tests/unit/`)
| Módulo Testado | Arquivo de Teste | Qtd Testes | Status |
|----------------|------------------|:----------:|:------:|
| Autenticação & Gateway | `tests/unit/api-gateway-auth.test.ts` | 20 | ✅ 100% PASS |
| Agendamentos API | `tests/unit/api-gateway-appointments.test.ts` | 13 | ✅ 100% PASS |
| Comandas API | `tests/unit/api-gateway-comandas.test.ts` | 16 | ✅ 100% PASS |
| Catálogo (Serviços e Produtos) | `tests/unit/api-gateway-catalog.test.ts` | 15 | ✅ 100% PASS |
| Webhook Dispatcher & HMAC | `tests/unit/webhook-dispatcher.test.ts` | 21 | ✅ 100% PASS |
| Contrato OpenAPI 3.1 & Docs | `tests/unit/openapi-spec.test.ts` | 9 | ✅ 100% PASS |
| Marketplace & Extensões | `tests/unit/marketplace-service.test.ts` | 16 | ✅ 100% PASS |
| Conectores & Integrações Core | `tests/unit/integration-service.test.ts` | 13 | ✅ 100% PASS |
| Billing Plataforma & SaaS Metrics | `tests/unit/platform-billing-service.test.ts` | 25 | ✅ 100% PASS |
| Enterprise Features & Audit Logs | `tests/unit/enterprise-service.test.ts` | 25 | ✅ 100% PASS |
| SaaS Certification Master | `tests/certification/fase8_11_saas_certification.test.ts` | 14 | ✅ 100% PASS |
| **Total Dedicado Fase 8** | **11 suítes** | **187** | **✅ 100% PASS** |

### 7.7 Matriz Consolidada Master (`npm run smg:verify`)
- **Typecheck (`tsc --noEmit`):** 0 erros.
- **Architecture Guard:** Baseline 222 rigorosamente preservada.
- **Unit Tests:** 152 arquivos de teste executados com sucesso (0 falhas).
- **Secrets Audit:** 0 credenciais expostas.
- **Migration Security:** 197 migrações auditadas sem desativação ou regressão de RLS.
- **Multi-Tenant Invariant:** Rigorosamente assegurado em todas as rotas, tabelas, conectores, planos, assinaturas, faturas, logs corporativos e RPCs.

### 7.8 Deliberação Estratégica do PO Augusto — Congelamento de Internacionalização (Subfases 8.7, 8.8 e 8.9)
Em 2026-11-06, o PO Augusto deliberou formalmente o **congelamento até segunda ordem / postergação para versão futura** das subfases 8.7 (Multi Idioma), 8.8 (Multi Moeda) e 8.9 (Internacionalização). A decisão visa focar 100% da tração comercial e maturação operacional do **SMG Barber** no mercado nacional brasileiro (pt-BR e moeda BRL R$), evitando dispersão de esforço em múltiplos idiomas antes da expansão internacional consolidada. O **ADR-042** foi registrado com status **`DEFERRED`**.

### 7.9 Subfase 8.10 — Enterprise Features: Trilho Forense & Portabilidade LGPD (`services/enterpriseService.ts`)
- **Modelagem SQL Canônica:** Tabelas `public.enterprise_audit_logs` (trilho forense corporativo com imutabilidade absoluta — append-only estrito sem permissão de UPDATE ou DELETE) e `public.enterprise_data_exports` (gestão transacional de ordens de exportação e conformidade LGPD Art. 18 com TTL configurável e expiração defensiva) na migration canônica `supabase/migrations/20261106040000_phase_8_enterprise_features_and_audit_logs.sql`.
- **RPCs Seguras e Transacionais:**
  - `public.record_enterprise_audit_event`: Registro corporativo com validação de multi-tenant contextual, separação por severidade (`info`, `warning`, `critical`) e categorias de governança (`security`, `financial`, `compliance_lgpd`, `operational`, `system`).
  - `public.request_enterprise_data_export`: Abertura de ordem de exportação LGPD com auto-auditoria imediata no log corporativo sob categoria `compliance_lgpd` e TTL padrão de 7 dias.
- **Camada de Aplicação:** Serviço `services/enterpriseService.ts` com paginação, filtros multidimensionais por severidade/categoria/data/ação, consulta de exportações e atualização de status/checksum de arquivos exportados.
- **Cobertura de Testes:** 25 testes unitários dedicados em `tests/unit/enterprise-service.test.ts` (100% PASS).

### 7.10 Subfase 8.11 — Certificação SaaS & Conclusão Integral da Fase 8 (`docs/certification/SAAS_CERTIFICATION.md`)
- **Dossiê Master:** Certificado oficial de escalabilidade e prontidão comercial da plataforma nos 7 pilares oficiais: Arquitetura, UX/Valor Percebido, Segurança/RLS/Trilho Forense, Performance/Baseline, Treinamento (SMG Academy), Onboarding Ágil e Billing da Plataforma SaaS.
- **Suíte de Testes:** `tests/certification/fase8_11_saas_certification.test.ts` com 14 testes cobrindo os 7 pilares (100% PASS).
- **Declaração Formal:** Fase 8 (Commercial Scalability) 100% concluída localmente. Deploy em produção permanece condicionado ao gate físico desacoplado (`MERGE ≠ DEPLOY PROD`).

