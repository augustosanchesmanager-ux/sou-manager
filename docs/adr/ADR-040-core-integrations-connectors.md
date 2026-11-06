# ADR-040 — Arquitetura de Conectores e Integrações Core

> **Status:** `ACCEPTED` (Aprovado formalmente pelo PO Augusto em 2026-11-06)  
> **Data:** 2026-11-06  
> **Decisores:** Augusto (PO) · Antigravity (Platform Architect)  
> **Fase do Roadmap:** Fase 8 (Commercial Scalability) — Subfase 8.5 (Integrações)  
> **Contexto Técnico:** SMG Platform (SMG Barber) · Supabase PostgreSQL RLS · Edge Functions · Event Bus  

---

## 1. Contexto

Após a consolidação da **Public API (Subfase 8.2)**, **Webhooks (Subfase 8.3)** e **Marketplace (Subfase 8.4)**, a **Subfase 8.5 (Integrações Core)** estabelece o arcabouço técnico para conectar o SMG Barber aos ecossistemas corporativos externos essenciais para a operação contábil, fiscal e financeira das barbearias.

Diferente do Marketplace (que foca em extensões de terceiros via API pública), as **Integrações Core** são conectores nativos gerenciados pela própria plataforma para viabilizar:
1. **Gateways de Pagamento & Cobrança Pix:** Provedores de checkout online e conciliação de recebíveis (ex: Mercado Pago, Asaas, Stone/Pagar.me), com suporte a split de pagamento e Pix com QR Code dinâmico;
2. **Sistemas Fiscais & Contábeis (ERPs):** Exportação diária e em lote dos fechamentos de caixa, vendas de produtos e emissão de NFS-e (ex: ContaAzul, Omie, Bling);
3. **CRMs & Automação de Marketing:** Exportação de eventos de ciclo de vida de clientes (agendamento concluído, cliente inativo há 30 dias) para ferramentas de engajamento (ex: RD Station, ActiveCampaign).

---

## 2. Problema

A integração com sistemas externos impõe desafios críticos de segurança, resiliência e integridade contábil:
1. **Preservação dos Invariantes Financeiros (ADR-001, ADR-017, ADR-018):** Um evento de pagamento originado em gateway externo (ex: Pix recebido) não pode criar divergência no caixa diário, nem quebrar a distinção canônica entre comissão teórica do barbeiro e liquidação efetiva no fechamento de caixa;
2. **Armazenamento Seguro de Segredos de Terceiros:** Tokens OAuth, Client Secrets e API Keys de fornecedores externos configurados pela barbearia não podem trafegar em texto plano ou ficar expostos a acessos indevidos;
3. **Idempotência de Sincronização:** Webhooks de gateways ou confirmações de ERPs contábeis sofrem retries e podem chegar duplicados, exigindo controle estrito de duplicidade por chave de idempotência (`external_reference_id` / `idempotency_key`);
4. **Isolamento Multi-Tenant Inviolável:** Barbearia A jamais pode disparar eventos ou sincronizar faturas utilizando as credenciais ou endpoints da Barbearia B.

---

## 3. Decisão Arquitetural

Fica estabelecido o padrão de **Conectores de Integração Core** estruturado em 4 pilares:

### 3.1 Catálogo Canônico de Provedores (`public.integration_providers`)
Tabela gerenciada centralmente com os provedores nativos homologados:
- **Categorias:** `payment_gateway` (Pix/Cartão online), `fiscal_erp` (Contabilidade/NFS-e), `crm_marketing` (Marketing/Mensageria).
- **Tipos de Autenticação (`auth_type`):** `api_key`, `oauth2`, `webhook_secret`.
- **Esquema de Configuração (`settings_schema` JSONB):** Validação dos campos obrigatórios exigidos pelo conector.

### 3.2 Vínculo e Credenciais por Barbearia (`public.tenant_integrations`)
Cada barbearia configura seus próprios conectores:
- **Status:** `active`, `error`, `disabled`.
- **Segredos Isolados (`encrypted_credentials` JSONB):** Credenciais sensíveis armazenadas e acessíveis apenas via backend / Edge Functions de integração (nunca expostas em queries de listagem).
- **Parâmetros Operacionais (`settings` JSONB):** Regras de negócio do conector (ex: `auto_issue_nfse: true`, `split_enabled: false`, `webhook_url`).
- **Isolamento RLS:** Regra estrita por `tenant_id = current_effective_tenant_id()`.

### 3.3 Log de Eventos e Auditoria de Sincronização (`public.integration_sync_logs`)
Trilho de auditoria transparente para cada tentativa de sincronização:
- Registra `tenant_id`, `integration_id`, `event_type`, `direction` ('inbound' | 'outbound'), `status` ('success' | 'failed' | 'ignored'), `payload_summary`, `error_message` e `duration_ms`.
- Permite ao gestor da barbearia inspecionar no Cockpit se as notas fiscais foram emitidas ou se houve falha de comunicação com o ERP.

### 3.4 Conector de Pagamento com Split & Resíduo Zero
- Quando uma cobrança externa é confirmada, o conector gera o registro em `comanda_payments` utilizando o contrato do **ADR-018** (`payment_type = 'pix'` ou `'credit'`), garantindo que o rateio contábil feche com tolerância zero ($\Delta = \text{R\$} 0,00$).

---

## 4. Modelagem Proposta (PostgreSQL)

```sql
-- 1. Catálogo de Provedores Nativos
CREATE TABLE IF NOT EXISTS public.integration_providers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('payment_gateway', 'fiscal_erp', 'crm_marketing')),
  auth_type        TEXT NOT NULL CHECK (auth_type IN ('api_key', 'oauth2', 'webhook_secret')),
  logo_url         TEXT NULL,
  description      TEXT NOT NULL,
  settings_schema  JSONB NOT NULL DEFAULT '{}'::jsonb,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Conexões Ativas por Barbearia (Tenant)
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_id           UUID NOT NULL REFERENCES public.integration_providers(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'disabled')),
  encrypted_credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings              JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at        TIMESTAMPTZ NULL,
  last_error_message    TEXT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_integration UNIQUE (tenant_id, provider_id)
);

-- 3. Histórico de Sincronizações e Auditoria
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id   UUID NOT NULL REFERENCES public.tenant_integrations(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL,
  direction        TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status           TEXT NOT NULL CHECK (status IN ('success', 'failed', 'ignored')),
  external_ref_id  TEXT NULL,
  duration_ms      INT NOT NULL DEFAULT 0,
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message    TEXT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. RLS & Segurança

1. **`integration_providers`:**
   - `SELECT`: Liberado para usuários autenticados quando `active = true` (ou Super-Admin irrestrito);
   - Mutações (`INSERT / UPDATE / DELETE`): Exclusivas de Super-Admin.
2. **`tenant_integrations`:**
   - RLS estrito: `tenant_id = public.current_effective_tenant_id() OR public.current_is_super_admin_from_auth_uid()`.
   - As credenciais em `encrypted_credentials` devem ser omitidas ou mascaradas nas queries do front-end (`SELECT id, tenant_id, provider_id, status, settings, last_synced_at...`).
3. **`integration_sync_logs`:**
   - RLS estrito: Somente o tenant proprietário pode consultar seus registros de auditoria.

---

## 6. Consequências & Trade-offs

### Positivas:
- **Autonomia Operacional:** O dono da barbearia conecta seu próprio ERP ou conta de recebimento Pix sem intervenção manual do suporte;
- **Conformidade Fiscal:** Automação da emissão de NFS-e reduz passivo fiscal e elimina digitação duplicada de comandas;
- **Auditoria Transparente:** Falhas de conectores externos ficam visíveis no cockpit com diagnóstico claro e possibilidade de re-sincronização manual.

### Mitigações:
- **Retries com Jitter:** Chamadas externas a APIs de ERPs sujeitas a rate limits devem respeitar política de retry com jitter exponencial;
- **Isolamento de Credenciais:** As chaves de API externas residem isoladas por tenant e nunca são compartilhadas.

---

## 7. Próximos Passos (Após Aprovação do PO)

1. Aprovação formal do ADR-040 pelo PO Augusto (`PROPOSED` $\rightarrow$ `ACCEPTED`);
2. Atualização do índice `docs/adr/README.md`;
3. Criação da migration SQL canônica local com as tabelas, índices e RLS;
4. Implementação do serviço `services/integrationService.ts` e suíte de testes unitários dedicada.
