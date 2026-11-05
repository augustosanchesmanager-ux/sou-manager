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

**Veredito:** Autorizada a abertura formal e modelagem da Fase 8 através do **ADR-032 (ACCEPTED)**. Fase de modelagem SQL local iniciada.
