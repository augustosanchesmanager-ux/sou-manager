# ADR-043 — Arquitetura de Funcionalidades Enterprise, Auditoria Avançada e Portabilidade LGPD

> **Status:** `ACCEPTED` (Aprovado formalmente pelo PO Augusto em 2026-11-06)  
> **Data:** 2026-11-06  
> **Decisores:** Augusto (PO) · Antigravity (Platform Architect)  
> **Fase do Roadmap:** Fase 8 (Commercial Scalability) — Subfase 8.10 (Enterprise Features)  
> **Contexto Técnico:** SMG Platform (SMG Barber) · Supabase PostgreSQL RLS · Compliance LGPD (Lei 13.709/2018) · SOC2 / SOX Audit Trails  

---

## 1. Contexto

Com a expansão da SMG Platform para atender redes de barbearias, franquias e operações de grande porte (plano **Enterprise / Atelier Multi-Unidade**), a **Subfase 8.10 (Enterprise Features)** estabelece os trilhos corporativos de governança de dados, conformidade regulatória e auditoria forense.

Operações enterprise exigem rastreabilidade irrefutável de ações sensíveis (alterações contábeis, reabertura de turnos de caixa, trocas de papéis de acesso, geração de chaves de API e extrações de dados), além de conformidade estrita com o Art. 18 da LGPD (Direito à Portabilidade de Dados e Prestação de Contas).

---

## 2. Problema

1. **Insuficiência de Triggers de Banco Puros (`public.audit_logs` legado):**
   - A tabela legada `public.audit_logs` atua em nível de DML de banco (INSERT/UPDATE/DELETE genéricos), sem contexto semântico de negócio (ex: motivo da sangria, protocolo de exportação LGPD, tentativas de autenticação ou contexto de sessão do usuário);
2. **Imutabilidade e Não-Repúdio:**
   - Registros de auditoria corporativa nunca podem ser alterados ou apagados por gerentes ou administradores de tenants (`append-only`);
3. **Portabilidade de Dados em Lote (LGPD Art. 18):**
   - Franquias e clientes necessitam de exportação auditável de suas bases completas (clientes, histórico financeiro, comissões e atendimentos) com integridade criptográfica (checksum SHA-256) e janela de expiração de link (TTL de segurança);
4. **Isolamento Multi-Tenant Estrito:**
   - Uma franquia ou barbearia enterprise jamais pode ter visibilidade sobre os trilhos de auditoria ou arquivos de exportação de outra unidade.

---

## 3. Decisão Arquitetural

Fica estabelecida a arquitetura corporativa da Subfase 8.10 baseada em 3 pilares:

### 3.1 Trilho Unificado de Auditoria Corporativa (`public.enterprise_audit_logs`)
Tabela append-only com retenção contínua para eventos corporativos e de compliance:
- **Categorias Canônicas (`category`):**
  - `security`: Autenticação, recuperação de senha, login suspeito, sessões;
  - `financial`: Reabertura de caixa, alteração de comissão, renegociação de recebível;
  - `compliance_lgpd`: Consentimentos, exportação de dados pessoais, exclusão de cadastro;
  - `operational`: Alterações em massa de agendamentos, cancelamentos de comanda;
  - `system`: Configuração de webhooks, criação e revogação de API Keys.
- **Níveis de Severidade (`severity`):** `info`, `warning`, `critical`.
- **Rastreabilidade Completa:** `actor_id` (UUID), `actor_email`, `actor_role`, `ip_address`, `user_agent`, `details` (JSONB imutável) e `created_at`.
- **Segurança RLS:**
  - `SELECT`: Restrito a gerentes do próprio tenant (`tenant_id = current_effective_tenant_id()`) e Super-Admin;
  - `INSERT`: Via RPC autorizada `record_enterprise_audit_event`;
  - `UPDATE / DELETE`: **Expressamente vedados** (sem políticas; append-only irreversível).

### 3.2 Portabilidade Corporativa e Exportação de Dados (`public.enterprise_data_exports`)
Gestão de solicitações de exportação em lote para portabilidade e conciliação:
- **Tipos de Exportação (`export_type`):**
  - `customers_lgpd`: Base completa de clientes com dados de contato e consentimentos;
  - `financial_ledger`: Extrato contábil analítico de caixa, comissões e faturamento;
  - `appointments_history`: Histórico consolidado de atendimentos e ocupação de cadeiras;
  - `full_backup`: Backup estruturado consolidado do tenant.
- **Ciclo de Vida do Arquivo (`status`):** `pending` $\rightarrow$ `processing` $\rightarrow$ `completed` $\rightarrow$ `expired`.
- **Governança de Segurança:**
  - Prazo de expiração (`expires_at` padrão de 7 dias);
  - Checksum criptográfico (`file_checksum_sha256`) para garantia de não-adulteração;
  - Registro de auditoria disparado no momento da solicitação e no download.

### 3.3 RPCs de Governança
1. **`public.record_enterprise_audit_event(...)`**:
   - `SECURITY DEFINER` com `search_path = public, pg_temp`;
   - Injeta o `tenant_id` autoritativo do contexto do usuário logado;
   - Impede falsificação de `actor_id` e `tenant_id`.
2. **`public.request_enterprise_data_export(...)`**:
   - Cria a ordem de exportação, valida permissão de papel gerencial/proprietário e gera evento de auditoria automática.

---

## 4. Modelagem de Dados Proposta (PostgreSQL)

```sql
-- 1. Logs de Auditoria Corporativa
CREATE TABLE IF NOT EXISTS public.enterprise_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id      UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   TEXT NULL,
  actor_role    TEXT NULL,
  action        TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN ('security', 'financial', 'compliance_lgpd', 'operational', 'system')),
  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  resource_type TEXT NOT NULL,
  resource_id   TEXT NULL,
  details       JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    TEXT NULL,
  user_agent    TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Solicitações de Exportação em Lote
CREATE TABLE IF NOT EXISTS public.enterprise_data_exports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  export_type          TEXT NOT NULL CHECK (export_type IN ('customers_lgpd', 'financial_ledger', 'appointments_history', 'full_backup')),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  record_count         INT NOT NULL DEFAULT 0,
  file_url             TEXT NULL,
  file_checksum_sha256 TEXT NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ NULL
);
```

---

## 5. RLS & Segurança

1. **`enterprise_audit_logs`:**
   - `SELECT`: `tenant_id = public.current_effective_tenant_id() OR public.current_is_super_admin_from_auth_uid()`;
   - `INSERT`: Apenas através da RPC `record_enterprise_audit_event` ou Super-Admin;
   - `UPDATE / DELETE`: Bloqueados fisicamente (tabela append-only).
2. **`enterprise_data_exports`:**
   - `SELECT`: Usuários com papel de gestão no tenant (`manager`, `admin`, `owner`) ou Super-Admin;
   - `INSERT`: Criado via RPC `request_enterprise_data_export` com registro no log de auditoria.

---

## 6. Consequências & Trade-offs

### Positivas:
- **Conformidade Regulatória Plena:** Atendimento antecipado aos requisitos da LGPD e governança corporativa;
- **Trilho Forense Imutável:** Impossibilidade de adulteração de eventos críticos de caixa e segurança por usuários da barbearia;
- **Prontidão Enterprise:** Estrutura pronta para suportar redes e franquias com dezenas de unidades;
- **Zero Impacto no Hot Path:** Gravação assíncrona ou pontual de eventos sensíveis, sem impacto no tempo de checkout ou abertura de agenda.

---

## 7. Próximos Passos (Após Aprovação do PO)

1. Aprovação formal do ADR-043 pelo PO Augusto (`PROPOSED` $\rightarrow$ `ACCEPTED`);
2. Atualização do índice `docs/adr/README.md`;
3. Criação da migration SQL canônica local `supabase/migrations/20261106040000_phase_8_enterprise_features_and_audit_logs.sql`;
4. Implementação de tipos em `src/types/enterprise.ts`;
5. Implementação de serviço em `services/enterpriseService.ts`;
6. Criação da suíte de testes unitários dedicada `tests/unit/enterprise-service.test.ts`;
7. Execução da validação master `npm run smg:verify` e atualização de governança.
