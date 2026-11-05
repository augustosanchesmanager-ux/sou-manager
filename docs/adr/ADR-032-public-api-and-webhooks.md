# ADR-032: Arquitetura da Public API e Webhooks Externos (Fase 8)

- **Status:** ACCEPTED
- **Data:** 2026-11-05
- **Decisor:** Augusto (PO/Arquiteto) + Antigravity (Software & Platform Architecture)
- **Fase Relacionada:** Fase 8 — Commercial Scalability (Subfases 8.2 e 8.3)
- **Referências:**
  - `ROADMAP.md` (Fase 8 — Commercial Scalability)
  - `docs/audit/PHASE_8_ENTRY_AUDIT.md` (Dossiê de Entrada)
  - `docs/adr/ADR-001-Commission-vs-Settlement.md` (Invariante financeiro permanente)
  - `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` (Governança de deploy)
  - `docs/TAXONOMY.md` (Vocabulário canônico do ecossistema)

---

## 1. Contexto e Motivação

Com a conclusão e certificação da **Fase 7 (Product Maturity)**, o **SMG Barber** atingiu maturidade funcional e operacional completa. Para viabilizar a expansão comercial (Subfases 8.2 e 8.3 do ROADMAP), faz-se necessária a abertura controlada da plataforma para integrações com terceiros:
- Sistemas de automação de marketing e CRM externos;
- Dispositivos de hardware proprietários de barbearias (totens, catracas, leitores biométricos);
- Plataformas de contabilidade e ERP externos;
- Bots customizados de agendamento e atendimento.

Para isso, o sistema deve fornecer uma **Public API RESTful** de alta performance e um ecossistema de **Webhooks Confiáveis**, sem comprometer sob nenhuma circunstância os pilares invioláveis da plataforma: **isolamento multi-tenant estrito**, **políticas RLS em banco** e **consistência contábil de caixa e comissões**.

---

## 2. Problema

1. **Risco de Vazamento Multi-Tenant:** Clientes externos chamando a API com credenciais de aplicação não podem, em hipótese alguma, visualizar ou alterar dados de outros estabelecimentos (`tenant_id`). O uso ingênuo de `service_role` (bypass RLS) no data path traria risco crítico de segurança.
2. **Armazenamento Seguro de Credenciais:** Tokens de API expostos na internet são alvos primários de vazamento. O banco de dados nunca deve armazenar segredos em texto puro.
3. **Resiliência e Ordem de Eventos (Webhooks):** Servidores de parceiros podem sofrer instabilidade, indisponibilidade ou latência elevada. O disparo de webhooks não pode travar as transações operacionais do balcão da barbearia nem perder eventos em caso de falha de rede.

---

## 3. Decisão de Arquitetura

Adota-se uma arquitetura baseada em **Gateway Serverless (Edge Functions) + PostgreSQL RLS Contextualizado + Outbox Pattern Assíncrono**:

### 3.1 Formato e Segurança de API Keys
1. **Padrão de Nomenclatura:** As chaves utilizam identificadores semanticamente legíveis:
   - `smg_live_<token>` para ambientes de produção.
   - `smg_test_<token>` para ambientes de sandbox/homologação.
2. **Digest Criptográfico (One-Way):**
   - O segredo completo (`smg_live_...`) é gerado no momento da criação e apresentado **uma única vez** ao usuário na interface administrativa.
   - O banco de dados em `public.api_keys` armazena unicamente o hash criptográfico `key_hash = encode(digest(key, 'sha256'), 'hex')` e os primeiros 8 caracteres em `key_prefix` (ex: `smg_live_a1b2...`) para exibição visual no painel.
3. **Escopos Granulares (RBAC para APIs):**
   - Cada chave possui uma lista explícita de capacidades permitidas (ex: `['appointments:read', 'comandas:write', 'customers:read']`).
   - Requisições para rotas fora dos escopos contratados da chave são imediatamente rejeitadas com HTTP `403 Forbidden` no Gateway.

### 3.2 Autenticação e Data Path Seguro (Vedação a `service_role`)
1. **Edge Function `public-api` (Gateway de Entrada):**
   - Intercepta a requisição e extrai o header `Authorization: Bearer smg_live_...`.
   - Calcula o SHA-256 da chave fornecida e valida sua existência, vigência (`status = 'active'`) e expiração via RPC de segurança dedicada (`auth_validate_api_key`).
   - Aplica controle de taxa de requisições (*Rate Limiting*) via Redis/Postgres com headers canônicos `RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset`.
2. **Contexto de Tenant na Sessão PostgreSQL:**
   - **É terminantemente proibido utilizar `service_role` irrestrito para executar queries de negócio.**
   - O Gateway executa as operações com role restrita (`api_consumer` sem permissão de superadmin), injetando o contexto seguro da sessão PostgreSQL com o `tenant_id` autenticado:
     ```sql
     SELECT set_config('request.jwt.claims', json_build_object('sub', api_key_owner_id, 'tenant_id', resolved_tenant_id)::text, true);
     ```
   - Dessa forma, todas as consultas e comandos SQL passam obrigatoriamente pelas políticas de Row Level Security (RLS) já consolidadas na plataforma.

### 3.3 Mensageria de Webhooks com Outbox Pattern & Assinatura Criptográfica
1. **Publicação Desacoplada:**
   - Quando ocorrem ações de domínio (ex: `appointment.created`, `comanda.paid`, `client.created`), o Event Bus grava os registros na tabela `public.webhook_deliveries` em estado `pending`, dentro da mesma transação ou via subscriber assíncrono.
2. **Dispatcher com Exponential Backoff:**
   - Um worker dispatcher (`functions/v1/webhook-dispatcher`) busca lotes de entregas pendentes com lock pessimista (`SKIP LOCKED`).
   - Tentativas com retry automático seguindo escala exponencial: 1 min, 5 min, 15 min, 1 hora, 6 horas (máximo de 5 tentativas).
   - Endpoints retornando `410 Gone` têm a assinatura desativada automaticamente.
3. **Assinatura HMAC-SHA256 (`X-SMG-Signature`):**
   - Para validação de integridade e autenticidade pelo receptor, cada requisição de webhook inclui:
     - Header `X-SMG-Event`: Tipo do evento (ex: `comanda.paid`).
     - Header `X-SMG-Delivery`: ID único da tentativa (`delivery_id` UUID) para garantir idempotência do lado do parceiro.
     - Header `X-SMG-Signature`: Assinatura no formato `t=<timestamp>,v1=<hmac_sha256(timestamp + "." + payload, webhook_secret)>`.

---

## 4. Consequências e Mitigações de Riscos

### 4.1 Positivas
- **Blindagem Multi-Tenant:** Impossibilidade de vazamento de dados entre barbearias por contorno de RLS.
- **Segurança de Segredos:** Vazamento de banco de dados não expõe as API keys reais dos clientes devido ao hash unidirecional SHA-256.
- **Estabilidade do Core:** Falhas na infraestrutura de terceiros não impactam a velocidade do balcão nem o processamento de comandas.
- **Auditoria Transparente:** Cada disparo e requisição de API conta com rastreabilidade formal via logs e `delivery_id`.

### 4.2 Riscos e Mitigações

| Risco | Severidade | Mitigação Arquitetural |
|-------|:----------:|------------------------|
| Sobrecarga da API por cliente abusivo | Alta | Rate limiting obrigatório por API Key + quotas mensais vinculadas ao plano de assinatura (`tenants.plan`). |
| Falso-positivo de payload de webhook forjado | Média | Header `X-SMG-Signature` assinado com chave secreta por subscrição e janela de expiração de timestamp (tolerância máxima de 5 minutos contra replay attacks). |
| Concorrência de atualização em comandas via API | Alta | Uso exclusivo de RPCs de negócio com locks `FOR UPDATE` e validações estritas de estado (`canModifyLinkedComanda`). |

---

## 5. Próximos Passos (Plano de Evolução)

1. **Submissão do ADR-032 para deliberação do PO Augusto.**
2. **Após aprovação formal do ADR:**
   - Elaboração das migrations estruturais timestampadas em `supabase/migrations/` para as tabelas `api_keys`, `webhook_subscriptions` e `webhook_deliveries`.
   - Implementação das RPCs de autenticação segura e dos contratos OpenAPI (Swagger) da API Pública.
   - Criação da Edge Function de despacho de webhooks.
