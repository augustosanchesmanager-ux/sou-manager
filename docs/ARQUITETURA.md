# Arquitetura do Sistema — SMG Platform & SMG Barber
## Documentação Técnica Canônica e Arquitetural (v2.0)

> **SMG Barber — SOU MANA.GER (SMG Platform)**<br />
> **Data de Atualização:** 2026-11-04<br />
> **Status:** RATIFICADO E CANÔNICO<br />
> **Responsável Formal:** Augusto (PO)<br />
> **Governança:** Precedência `AGENTS.md` · SMG Change Control Protocol<br />
> **Invariantes:** `MERGE ≠ DEPLOY PROD` (ADR-026) · Separação Canônica (ADR-001) · Multi-Tenant RLS · Baseline Repository Guard (222)

---

## 1. Identidade e Filosofia Arquitetural

O ecossistema opera sob a Arquitetura de Marca Híbrida Endossada ratificada pelo Product Owner (`docs/BRAND_ARCHITECTURE.md`):

1. **Masterbrand Tecnológica / Holding (`SMG Intelligence`):** A entidade central que detém a inteligência preditiva, os algoritmos, a segurança e a infraestrutura do SMG Core.
2. **Produtos Comerciais de Linha de Frente:**
   - **`SMG Barber`** (Tagline: *The Barbershop Intelligence*): O produto comercial em escala ativa.
   - **`SMG Auto`** (Tagline: *Automotive Business Intelligence*): Vertical de gestão e ticket médio para estética automotiva e oficinas.
3. **Módulos Integrados:** Subsistemas de alto valor (como o "Club dos Chefes") são módulos nativos do SMG Barber, e não produtos autônomos.
4. **Arquitetura 85/15:** Toda vertical reaproveita 85% do SMG Core (multi-tenancy, RLS, outbox worker, faturamento, auth) e customiza 15% de regras específicas de negócio.

> **Princípio Orientador:** *"Arquitetura pensa no futuro (modular, genérica e multi-tenant). Negócio pensa no presente (SMG Barber)."*

---

## 2. Stack Tecnológica Atual

| Camada | Tecnologia | Versão / Padrão | Responsabilidade |
|---|---|---|---|
| **Frontend Framework** | React | 19.x | Componentização reativa e renderização de interface |
| **Bundler & Tooling** | Vite | 6.x | Compilação ultra-rápida, HMR e otimização de bundle |
| **Linguagem** | TypeScript | 5.8.x | Tipagem estática rigorosa e segurança em tempo de compilação |
| **Estilização** | Tailwind CSS | v4.x (CSS-First) | Tokens no `@theme` de `index.css` sem `tailwind.config` |
| **Backend & Banco** | Supabase | PostgreSQL 15+ | Banco relacional, Auth (JWT), Realtime e Storage |
| **Inteligência Artificial**| Google Gemini | `@google/generative-ai` | Assistente executivo e geração de insights de negócio |
| **Roteamento** | `react-router-dom` | `HashRouter` | Roteamento SPA compatível com rewrite de produção |
| **Visualização de Dados** | Recharts | 2.x | Gráficos financeiros, faturamento e métricas de retenção |
| **Deploy** | Vercel | SPA Estático | CDN global com distribuição em `dist/` |

---

## 3. Topologia de Diretórios e Código

O projeto possui uma estrutura particular de imports e árvores de arquivos que deve ser estritamente observada:

### 3.1 O Alias `@/`
No `vite.config.ts`, o alias **`@/` aponta para a RAIZ do repositório**, e não para a pasta `src/`.

### 3.2 As Duas Árvores de Código
O repositório possui duas árvores de código que coexistem de forma complementar:
1. **Árvore Raiz:**
   - `components/`: Componentes React da aplicação (`components/ui/`, `schedule/`, `checkout/`, `customers/`, etc.).
   - `context/`: Provedores de estado globais fundamentais (`AuthContext.tsx`, `ThemeContext.tsx`).
   - `pages/`: Telas e views de rotas (`Schedule.tsx`, `Checkout.tsx`, `Comandas.tsx`, `Clients.tsx`, etc.).
   - `domain/`: Domínios puros de negócio (`commission/`, `events/`, `billing/`, `accountsPayable/`, `payout/`).
   - `application/`: Serviços orquestradores de aplicação (`cashClosing/`, `authorization/`, `appointment/`).
   - `services/`: Barrel de clientes externos (`services/supabaseClient.ts` re-exporta `src/lib/supabase/`).
2. **Árvore `src/`:**
   - `src/lib/`: Módulos de infraestrutura (`supabase/`, `permissions/`, `observability/`, `staff/`).
   - `src/context/`: Contextos complementares (`TenantContext.tsx`, `AppContext.tsx`).
   - `src/modules/`: Módulos de domínio ricos (`schedule/`, `reports/`).
   - `src/utils/`: Utilitários puros de mensageria, validação e formatação (`businessErrorMessages.ts`, `functionalValidation.ts`).

---

## 4. Gerenciamento de Estado

O sistema rejeita bibliotecas complexas como Redux ou Zustand, operando com **React Context puro** estruturado em cascata determinística:

```
AuthContext (Sessão & Auth UID)
  └── TenantProvider (Resolução de tenant_id e permissões da unidade)
        └── AppProvider (Domínio da aplicação / subdomínio)
              └── ThemeProvider (Dark-First / Light Cream)
```

- **`AuthContext`:** Ouve mudanças na sessão Supabase (`onAuthStateChange`), carrega o perfil autenticado e resolve o contexto de acesso via RPC `get_auth_access_context`.
- **`TenantContext`:** Carrega as configurações operacionais da unidade ativa através de `resolveTenantForUser()`.
- **`ThemeContext`:** Alterna entre os modos escuro (Dark-First padrão) e claro (`cream`), persistindo a preferência em `localStorage`.

---

## 5. Multi-Tenancy e Isolamento de Dados (RLS)

A segurança e o isolamento entre barbearias clientes são garantidos a nível de banco de dados via **Row Level Security (RLS)** do PostgreSQL:

### 5.1 Helpers Centrais de Segurança
- `public.current_tenant_id_from_auth_uid()` (`SECURITY DEFINER`): Resolve o `tenant_id` do usuário conectado sem depender de parâmetros do cliente HTTP.
- `public.current_is_super_admin_from_auth_uid()` (`SECURITY DEFINER`): Identifica usuários com privilégios de plataforma para bypass administrativo auditado.

### 5.2 Roteamento de Schemas (Multi-Schema)
- Quando `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true`, tabelas de domínio são roteadas para schemas dedicados (`barber`, `club`), enquanto tabelas centrais (`profiles`, `tenants`, `staff`, `audit_logs`) permanecem em `public`.
- No cliente Supabase, `getClientForTable(tableName, tenantId)` resolve automaticamente o cliente adequado.

---

## 6. Arquitetura Orientada a Eventos & Worker de Outbox (D8)

Para garantir consistência eventual e evitar bloqueios na experiência do usuário, transações críticas utilizam o **Padrão Outbox**:

```
[Operação de Negócio]
       ↓ (Transação Atômica)
[Tabela de Negócio] + [event_store] + [outbox_items]
       ↓ (Assíncrono)
[pg_cron] ➔ [pg_net] ➔ [Edge Function: worker-dispatcher]
       ↓ (Role: worker_dispatcher)
[RPCs Idempotentes / Webhooks Externos / Provedores Financeiros]
```

- **Idempotência (ADR-018):** Operações são registradas em `processed_operations` com chave única, prevenindo processamento duplicado.
- **Worker D8:** Executa sob a role restrita `worker_dispatcher` (NOLOGIN, sem bypass de RLS). O data path do worker **nunca** utiliza a chave `service_role`.
- **Dead-Letter Queue (DLQ):** Itens com falhas repetidas são movidos para `dead_letter` após o limite de tentativas (`maxAttempts`), preservando a trilha para inspeção no dashboard em `/#/observability`.

---

## 7. Separação Canônica Financeira (ADR-001)

Existe uma separação rigorosa e permanente entre dois domínios financeiros do SMG Barber:

1. **`domain/commission/` (Comissão Teórica):**
   - Responsável pelo cálculo prévio e nominal de comissão do profissional por item ou serviço (`calculateCommission`, regras de participantes).
2. **`application/cashClosing/` (Rateio Efetivo de Caixa):**
   - Responsável pela distribuição monetária real de valores arrecadados no encerramento de turno/dia, deduzindo taxas de cartão, rateios de produtos e despesas.

> [!WARNING]
> Nunca substitua um domínio pelo outro. Eles possuem propósitos contábeis e operacionais distintos (ADR-001).

---

## 8. Guardas de Arquitetura e CI Quality Gates

A integridade estrutural do repositório é verificada automaticamente por scripts nativos:

- **Repository Guard (`architecture:ci`):** Limita o acoplamento arquitetural e verifica a baseline histórica (222 violações). Nenhuma alteração pode elevar esse número.
- **Forbidden & Circular Imports Guard:** Garante 0 dependências circulares e 0 imports que violem os limites de camadas.
- **Bateria Integrada (`npm run smg:verify`):** Executa em lote a checagem de tipos (`tsc`), guarda de arquitetura, testes unitários (`vitest`), auditoria de segredos e checagem de segurança de migrações RLS.
