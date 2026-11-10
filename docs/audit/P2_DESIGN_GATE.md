# P2 — Importação / Exportação / Performance — Design Gate

> **Status:** `AUDIT ✅ · DESIGN ✅ · PO APPROVED (2026-09-06) · ISOLATE ⏭`
> **Date:** 2026-09-06
> **Parent:** P2 — Importação, Exportação e Performance
> **Predecessor:** P1.3 — KPIs Canônicos (CLOSED, push `9747a72..49a4828`, docs 8.48/7.9)
> **Escopo:** Auditoria documental + proposta de arquitetura. **NÃO IMPLEMENTAR NADA. Não fazer commit.**
> **Executado por:** agente big-pickle (auditoria direta, sem subagentes)
> **Baselines:** `npm run build` PASS 15.57s EXIT 0 · `npx tsc --noEmit` 72 erros pré-existentes (zero novos) · `git diff --check` exit 0

---

## 1. Problem Statement

A SMG Barber hoje **importa** e **exporta** dados de forma pontual, sem estrutura comum:

- **Importação** existe apenas para **Clientes** (`pages/Clients.tsx`) e é um fluxo ingênuo: `Papa.parse` tolerante → modal → `clientRepository.import(parsedData, tenantId)` — **INSERT direto em lote**, sem preview por linha, sem validação de domínio, sem detecção de duplicidade, sem idempotência, sem limites, sem trilha de auditoria.
- **Exportação** está **espalhada em 8+ pontos** com implementações divergentes (Papa.unparse, CSV com BOM, jsPDF+autotable, JSON), sem contrato comum, sem paginação e sem definição canônica de colunas.
- **Google Sheets**: zero integração no código-fonte (apenas falsos positivos de `fonts.googleapis.com` e QR `chart.googleapis.com`).
- **Contas a pagar** já existem (P0.4: `recurring_bills` + `accounts_payable` + 5 RPCs idempotentes) e são o alvo natural do import financeiro (P2.4 na divisão proposta).

**Regra central do P2 (PO):** *"arquivo externo é entrada não confiável"* — nenhum caminho `CSV → INSERT direto` pode existir no produto final.

## 2. Arquitetura de Dados (Regra Central)

```
arquivo externo
   ↓
Parser (Papa.parse normalizado — nunca confiar em MIME/header)
   ↓
Normalização (encoding, BOM, colunas tolerantes, datas pt-BR, números)
   ↓
Validação estrutural (tipo/obrigatoriedade/limites por coluna)
   ↓
Validação de domínio (regras do tenant/DOMÍNIO)
   ↓
Detecção de duplicidades (estratégia por entidade — decisão de negócio)
   ↓
PREVIEW (linhas válidas / inválidas / duplicadas — nada é gravado)
   ↓
CONFIRMAÇÃO (usuário decide)
   ↓
Persistência segura (RPC transacional + idempotência import_job_id/import_row_id)
   ↓
RESULTADO (resumo gravado + trilha de auditoria)
```

> **Nunca:** `CSV → INSERT direto`.

## 3. Escopo

### In Scope (deste gate)
- Inventário documental das 10 áreas (arquivos, imports, exports, Sheets, riscos, dívidas, arquitetura, gates, arquivos alterados, não-alterados).
- Proposta de arquitetura do **Import Engine** e do **Export Engine**.
- Divisão do P2 em subgates com dependências.
- 10 decisões de negócio **apresentadas ao PO — não decididas pelo gate**.

### Out of Scope (Explicit)
- **Qualquer implementação** (PO: "NÃO IMPLEMENTAR NADA").
- **Qualquer commit** (working tree permanece como está).
- Migrations, RPCs, regras financeiras, banco de produção.
- Performance: **identificar gargalos, não otimizar** ("medir antes de otimizar").
- Arquiteturas de terceiros (ex.: Sheets via API direta) — tudo passa pelo mesmo Import/Export Engine.

## 4. Inventário — Arquivos Relevantes

### 4.1 Dependências (`package.json`)

| Dep | Versão | Papel no P2 |
|-----|--------|-------------|
| `papaparse` + `@types/papaparse` | ^5.5.3 | Parser/stringifier CSV — **base do Import/Export Engine** |
| `jspdf` + `jspdf-autotable` | ^4.2.1 / ^5.0.8 | PDF de exportação (usado em CashClosingPage) |
| `recharts` | ^3.7.0 | Gráficos (não afeta P2) |
| `dexie` | ^4.4.3 | IndexedDB (offline/demo — fora do escopo) |
| `@supabase/supabase-js` | ^2.97.0 | Cliente Supabase (persistência via RPC) |
| — | — | **Sem libs de XLSX/Sheets/exceljs** (P2.5 exigirá decisão de lib) |

Build: `vite.config.ts:54,58` já cria chunks dedicados `papaparse` e `jspdf` (`vendor-pdf` 422 kB, `html2canvas.esm` 202 kB — medido no build do gate).

### 4.2 Camadas

| Camada | Diretórios | Relevância P2 |
|--------|-----------|---------------|
| Application | `application/{appointment,authorization,cashClosing,checkout,chefClub}` | Orquestração (padrão de referência p/ serviços de import) |
| Domain | `domain/{accountsPayable,appointment,authorization,billing,cashClosing,chefClub,client,comanda,commission,events,financial,invitation,receivable,service,shared,staff,tenant,tenantSettings,transaction,userTenant}` | Regras de negócio + repositories (contratos de persistência) |
| Modules | `src/modules/{auto,barber,club,dashboard,estetica,reports}` | Lógica de UI por produto (reports: `presetMapping.ts`) |
| Pages | `pages/*` | Telas (onde estão os imports/exports atuais) |

### 4.3 Financeiro existente (alvo do P2.4)

- `domain/accountsPayable/repository.ts` (199 linhas) — 9 métodos: CRUD `recurring_bills`/`accounts_payable` + RPCs `pay_account_payable`, `cancel_account_payable`, `create_accounts_payable_from_recurring`; criação com `idempotency_key`.
- `src/hooks/useRecurringBills.ts` + `pages/Expenses.tsx` — UI de contas a pagar (única página financeira com recorrência).
- `domain/receivable/{types,repository,index}.ts` — `CustomerSubscriptionReceivable` (recebimentos do Clube: `tenant_id`, `subscription_id`, `billing_cycle_start/end`, `due_date`, `amount NUMERIC(12,2)`, `status pending|paid|overdue|cancelled|refunded`, `UNIQUE(subscription_id, billing_cycle_start, billing_cycle_end)`).
- `domain/billing/` — billing engine + feature flags + plan catalog (P0.4/6.0.4).
- `domain/financial/reversal-repository.ts` — reversão de transações.
- Regra ADR-001: **Commission ≠ Settlement** — import financeiro nunca recalcula comissão.

### 4.4 Migrations financeiras mapeadas (contexto, não serão alteradas)

`20260510000000_create_transactions_table` · `20260510160816..20_club_receivables_*` · `20260514000000/0001_finance_settle_comanda_*` · `20260515210804_finance_reverse_transaction_rpc` · `20260531161849_finance_zero_close_comanda_rpc` · `20260715000000_fix_rls_transactions_and_standardize_comandas` · `20260723110000_processed_operations` · `20260806020000_phase_6_0_4_billing` + `20260806050000_phase_6_0_4_4_billing_engine` · `20260820120000_create_commission_records` · `20260826000000_create_outbox_items` + `20260827000000_transactional_outbox_composite_rpc` · `20260903xxxx_p0_3_cancel_*` · `20260905044639_p0_4_accounts_payable` · `20260905150000_p0_4_a8_recurring_idempotency`.

**Padrão de idempotência P0.4 (a replicar no import):** coluna `idempotency_key UUID` + `UNIQUE(tenant_id, idempotency_key)` + RPC que **lança exceção se a key vier NULL** (`RAISE EXCEPTION 'idempotency_key e obrigatorio'`) — `20260905150000_p0_4_a8_recurring_idempotency.sql`.

### 4.5 Helpers RLS multi-tenant

- `current_tenant_id_from_auth_uid()` (SECURITY DEFINER) — isolamento por tenant em todas as políticas.
- `current_is_super_admin_from_auth_uid()` (SECURITY DEFINER) — bypass de superadmin.
- Toda persistência do Import Engine **deve respeitar tenant_id via RPC**, nunca confiar apenas no frontend.

## 5. Imports Existentes (análise)

| Ponto | Arquivo | Mecânica | Gaps |
|-------|---------|----------|------|
| Clientes | `pages/Clients.tsx` L30 (`ParsedClient`), L483 (`clientRepository.import`) | Papa.parse `header:true, skipEmptyLines`, mapeamento tolerante de colunas (`Nome/nome/Name`, `Telefone/phone`), datas pt-BR, modal de confirmação, INSERT em lote | Sem preview por linha; **sem validação de domínio** (client_id/telefone duplicado); **sem duplicidade**; **sem idempotência**; sem limites de arquivo/linhas; sem auditoria; all-or-nothing batch; sem relatório de erros por linha |
| Contrato | `domain/client/repository.ts:133` — `import(inputs: CreateClientInput[], tenantId): Promise<void>` (`ClientRepositoryImpl extends SupabaseRepository`) | INSERT direto | Persistência fora de RPC transacional → viola a regra central do P2 |

**Conclusão:** o import de clientes é o protótipo daquilo que o P2 precisa **substituir** — é o candidato natural de primeira entidade do novo Import Engine (P2.1), reaproveitando o mapeamento tolerante já validado pelo PO em uso real.

## 6. Exports Existentes (análise)

| Ponto | Arquivo | Formato | Observação |
|-------|---------|---------|------------|
| Comissões | `application/commission.ts:567` (`downloadCsv`) | CSV | Serviço de domínio |
| Fechamento de caixa | `components/financial/cashCloseUtils.ts:508` (`downloadCSV`) | CSV (com BOM) | Utilidade de componente |
| Agenda | `pages/Schedule.tsx:1743` | CSV | Página |
| Fluxo de caixa | `pages/Cashflow.tsx:521` | CSV | Página |
| Fechamento de caixa (PDF) | `pages/CashClosingPage.tsx` | PDF (jsPDF+autotable) + CSV | Página |
| Comandas | `pages/Comandas.tsx` | CSV | Página |
| Comissões (tela) | `pages/Commissions.tsx` | CSV | Página |
| SuperAdmin | `pages/SuperAdmin.tsx:356` | JSON | Export técnico |

**Inconsistências:** formatos de data/número variam, BOM presente em alguns e ausente em outros, sem colunas canônicas, sem paginação, sem `ExportDefinition` comum. `pages/Reports.tsx` (Central de Relatórios, abas `chefclub|sales`, KPIs via `getDashboardKpis`) **não possui botão de exportação** — lacuna de produto relevante para o P2.5.

## 7. Google Sheets

- **Zero integração** no `src/`/`pages/`/`services/`/`application/`/`domain/`.
- Os únicos matches de "googleapis" no repositório são `fonts.googleapis.com` (CSS Inter/Material Symbols em kiosk/portal) e `chart.googleapis.com` (QR code do kiosk) — **falsos positivos**.
- Consequência: P2.3 (Sheets) é **novo território** — exigirá decisão de lib (Google Sheets API v4 com OAuth, ou exportação bidirecional via mesmo Import/Export Engine), e **compartilhará o mesmo Import Engine** (PO: Sheets é só mais uma origem de arquivo).

## 8. Riscos

| # | Risco | Mitigação proposta |
|---|-------|--------------------|
| 1 | Import financeiro gravar `status='paid'` direto do CSV (pagar obrigação sem passar pela regra financeira) | **Importar obrigação ≠ pagar obrigação.** CSV financeiro só cria obrigações `pending`; pagamento apenas via RPC `pay_account_payable` existente |
| 2 | Duplicidade: usar `UNIQUE(tenant_id, name, amount, due_date)` geral | Duplicidade é **decisão de negócio por entidade** (ex.: cliente por telefone/CPF; conta por nome+vencimento) — nunca uma constraint ad hoc |
| 3 | Double-click/replay quebra o job e grava duas vezes | Idempotência `import_job_id`/`import_row_id` + UNIQUE (padrão P0.4) |
| 4 | Arquivo malicioso/malformado (MIME fake, script embedding, colunas excessivas) | **Nunca confiar em MIME**; validar conteúdo; limites de tamanho/linhas/campos; sanitização de strings |
| 5 | Cross-tenant via import | Todo insert via RPC com `current_tenant_id_from_auth_uid()` (ou `tenant_id` do job verificado no servidor); RLS mantida |
| 6 | Import all-or-nothing deixa o usuário sem feedback | Preview granular (válidas/inválidas/duplicadas) + política de falha (all-or-nothing vs parcial) **a decidir pelo PO** |
| 7 | PDF via `window.print()` (HTML→print) cria layouts não reproduzíveis | PDF gerado por **jsPDF+autotable** (já em produção no CashClosingPage) — nunca HTML→print |
| 8 | Export gigante sem paginação derruba a UI | ExportDefinition com paginação/streaming e limites por tenant |

## 9. Dívidas Técnicas (pré-existentes, inventariadas — não corrigir no gate)

| # | Dívida | Local |
|---|--------|-------|
| 1 | 72 erros de tipo em `tsc` (37 `flow-p0-3-c-cancel-subscription`, 25 `seed-chefclub-p03c`, 7 `flow-p0-4-accounts-payable`, 2 `EventVersioningAdmin`, 1 `globalSetup`) — **pré-existentes, zero novos** | branches/testes/scripts antigos |
| 2 | Import de clientes sem idempotência nem validação (INSERT direto) | `pages/Clients.tsx` + `domain/client/repository.ts:133` |
| 3 | 8+ implementações de export divergentes | ver §6 |
| 4 | `Reports.tsx` sem exportação | `pages/Reports.tsx` |
| 5 | `approve_access_request()` / `close_order()` sem auth checks (legado, apontado na auditoria de segurança Fase 3.3) | RPCs legados |

## 10. Proposta de Arquitetura

### 10.1 Import Engine (contrato central)

```typescript
// Contrato por entidade importável — templates versionados (ex.: clientes_v1.csv)
interface ImportDefinition {
  entity: string;            // 'client' | 'account_payable' | ...
  version: string;           // 'v1' — template versionado, imutável
  columns: ImportColumn[];   // nome, required, type, parser, validators
  duplicateStrategy: DuplicateStrategy;      // (decisão por entidade)
  persistenceStrategy: PersistenceStrategy;  // RPC transacional + idempotência
  limits: { maxRows: number; maxFileBytes: number; maxColumns: number };
  audit: boolean;            // sempre true — trilha import_jobs/import_rows
}
```

Pipeline (obrigatório, ver §2): **Parser → Normalização → Validação estrutural → Validação de domínio → Duplicidade → PREVIEW → CONFIRMA → Persistência → Resultado**.

Princípios:
1. **Nunca confiar em MIME**: validar conteúdo (header CSV real, colunas esperadas).
2. **Limites**: linhas, bytes, colunas, taxa por tenant — padrão configurável.
3. **Idempotência**: `import_job_id` por arquivo + `import_row_id` por linha, com UNIQUE `(tenant_id, import_job_id, import_row_id)` — replicando o padrão P0.4 (`RAISE EXCEPTION` quando ausente).
4. **Preview**: nada é gravado antes da confirmação; a tela mostra válidas/inválidas/duplicadas com motivos.
5. **Auditoria**: cada job registra origem, usuário, tamanho, resumo, resultado; linhas rejeitadas com motivo.
6. **Erros**: relatório por linha (linha N, coluna, motivo), nunca uma mensagem genérica de lote.
7. **Persistência**: sempre via RPC transacional (nunca `insert` direto do cliente), com tenant do job verificado no servidor.
8. **Template versionado**: `clientes_v1.csv` muda de contrato só via `v2` — nunca mutação.
9. **Regra de duplicidade (PO, 2026-09-06):** *"Nenhuma política de duplicidade poderá transformar um detector heurístico em restrição de unicidade do domínio sem decisão específica e evidência de que a regra representa uma identidade real da entidade."* — detector heurístico (ex.: mesmo nome+telefone) **nunca** vira constraint `UNIQUE` no banco sem decisão do PO e prova de identidade real; no máximo sinaliza duplicata candidata no preview.

### 10.2 Export Engine

```typescript
interface ExportDefinition {
  key: string;              // 'reports.sales' | 'cashflow' | 'commissions' | ...
  columns: ExportColumn[];  // colunas canônicas (labels + formatadores)
  format: 'csv' | 'xlsx' | 'pdf';
  query: SafeQuery;         // query com tenant isolation obrigatória
  pagination: { pageSize: number; maxRows: number };
  permission: Role[];       // roles autorizadas (decisão PO)
}
```

Princípios:
1. **Uma definição, múltiplos formatos**: CSV (com BOM — Excel pt-BR), XLSX (decisão de lib pendente), PDF (jsPDF+autotable).
2. **Queries seguras**: sempre filtro `tenant_id` + RLS; nunca exportar além do tenant.
3. **Paginação**: export gigante nunca trava a UI; limite por tenant.
4. **Consolidação**: os 8 pontos atuais (§6) migram para chamar o mesmo engine (dívida técnica eliminada gradualmente, **fora deste gate**).

### 10.3 Performance (P2.6 — por último)

- **"Medir antes de otimizar"** (PO): identificar gargalos com dados reais antes de qualquer mudança.
- Candidatos a medição (inventário, sem otimizar): queries de relatório sem paginação, `vendor-pdf` 422 kB em chunk estático, re-render de tabelas grandes (Comandas/Cashflow), loadtime da Central de Relatórios.

## 11. Decisões do PO (10 — apresentar, **não decidir**)

| # | Decisão | Recomendação do gate | Decisão PO (2026-09-06) |
|---|---------|----------------------|--------------------------|
| 1 | Primeiras entidades importáveis | Clientes (P2.1) | ✅ **Autorizada** — "começando pelo Import Engine/CSV de Clientes" |
| 2 | Limite de linhas/bytes por import | 5.000 linhas / 5 MB (configurável) | 📌 Recomendação vigente — decisão específica no gate P2.1 |
| 3 | All-or-nothing vs parcial | Parcial por padrão (inválidas relatadas) | 📌 Recomendação vigente — decisão específica no gate P2.1 |
| 4 | Política de duplicidade por entidade | Por entidade (cliente: telefone; conta: nome+vencimento) | ✅ **Autorizada** + **regra adicional do PO** (abaixo, §10.1 princípio 9) |
| 5 | UPDATE de registros via import | Não na v1 — somente INSERT | ✅ **NÃO autorizado** — "UPDATE/reconciliação via import" fora do escopo |
| 6 | Import financeiro: obrigações somente (`paid` proibido no CSV) | Sim — importar ≠ pagar (ADR-001) | ✅ **Confirmado** — "alteração do domínio de contas a pagar/receber" não autorizada |
| 7 | Módulos de export canônico primeiro | Reports + Cashflow + Comissões | 📌 Recomendação vigente — decisão específica no gate P2.5 |
| 8 | Roles autorizadas a importar/exportar | `manager` e `superadmin` | 📌 Recomendação vigente — decisão específica no gate P2.1 |
| 9 | Sheets: RO ou bidirecional | RO na v1 (mesmo Import/Export Engine) | ✅ **NÃO autorizado bidirecional** — RO vigente |
| 10 | Retenção de histórico de jobs | 90 dias + resumo imutável | 📌 Recomendação vigente — decisão específica no gate P2.1 |

### 11.1 Autorização do PO (2026-09-06, verbatim)

- "AUTORIZO O DESIGN GATE P2, com as decisões acima incorporadas ao P2_DESIGN_GATE.md."
- "AUTORIZO o avanço para P2.0/P2.1 somente em branch isolada, começando pelo Import Engine/CSV de Clientes."
- "A implementação deve permanecer restrita ao escopo aprovado."
- **NÃO autoriza ainda:** migrations de produção; alterações em RPCs financeiros; alterações de RLS; alteração do domínio de contas a pagar/receber; Google Sheets bidirecional; UPDATE/reconciliação via import; otimizações de performance não medidas.
- "Staging, PR, merge e produção continuam sendo gates separados."
- Fluxo aprovado: `P2 DESIGN GATE 🟢 APPROVED → ISOLATE → feature/p2-1-csv-clientes → IMPLEMENT → STAGING → PR`.
- **Regra adicionada ao gate (verbatim):** *"Nenhuma política de duplicidade poderá transformar um detector heurístico em restrição de unicidade do domínio sem decisão específica e evidência de que a regra representa uma identidade real da entidade."*

## 12. Divisão em Gates (dependências)

```
P2.0 Arquitetura (ESTE documento — auditoria + proposta, sem código)
   ↓
P2.1 Import Engine + CSV core (entidade: Clientes) — AUTORIZADO (branch isolada)
   ↓
P2.2 Templates versionados (clientes_v1.csv + contrato ImportDefinition)
   ↓
P2.3 Google Sheets (mesmo Import Engine — Sheets como origem/export; RO, bidirecional NÃO autorizado)
   ↓
P2.4 Financeiro (contas a pagar/receber) — GATE PRÓPRIO (regras financeiras; domínio AP/AR intacto até lá)
   ↓
P2.5 Export Engine (CSV → XLSX → PDF) + consolidação dos 8 pontos
   ↓
P2.6 Performance (medir antes de otimizar)
```

**Autorização vigente (PO, 2026-09-06):** apenas P2.0/P2.1 em branch isolada `feature/p2-1-csv-clientes`. Staging, PR, merge e produção são gates separados.

**Dependências críticas:** P2.4 depende de P2.1+P2.2 (engine) e do `accounts_payable` P0.4 (já existente); P2.3 pode entrar em paralelo após P2.1; P2.5 é independente do import (pode começar cedo); P2.6 é sempre o último.

## 13. Arquivos Provavelmente Alterados (por gate — previsão, nada implementado)

| Gate | Arquivos previstos |
|------|--------------------|
| P2.0 | `docs/audit/P2_DESIGN_GATE.md` (este doc) |
| P2.1 | `src/modules/import-engine/*` (novo), `pages/Clients.tsx` (substituição do fluxo ingênuo), `domain/client/repository.ts` (persistência via RPC), migration de `import_jobs`/`import_rows`, RPC transacional de import (novo), testes |
| P2.2 | `src/modules/import-engine/templates/*` (clientes_v1), testes de contrato |
| P2.3 | integração Sheets (lib nova), `src/modules/import-engine/providers/sheets*` |
| P2.4 | `domain/accountsPayable/*` (novas operações via engine), `domain/receivable/*`, RPC financeiro de import, **gate próprio com auditoria financeira** |
| P2.5 | `src/modules/export-engine/*` (novo), `pages/Reports.tsx` (+export), `pages/Cashflow.tsx`, `application/commission.ts`, `components/financial/cashCloseUtils.ts`, `pages/Schedule.tsx`, `pages/Comandas.tsx`, `pages/Commissions.tsx`, `pages/CashClosingPage.tsx`, `pages/SuperAdmin.tsx` (consolidação) |
| P2.6 | medições/perf (sem otimização neste gate) |

## 14. O que NÃO será alterado

- **Migrations existentes** (P0.3 cancel, P0.4 accounts_payable, IDP, outbox, processed_operations, commission_records, billing engine, RLS security fixes — nenhuma será modificada).
- **RPCs financeiros existentes** (`pay_account_payable`, `cancel_account_payable`, `create_accounts_payable_from_recurring`, settle/reverse/zero_close, outbox composite).
- **Regras de negócio financeiras** (ADR-001 Commission vs Settlement; status `paid` só via RPC de pagamento).
- **Regras não relacionadas** do P1 (KPIs canônicos, relatórios hub).
- **Multi-tenancy/RLS** — helpers `current_tenant_id_from_auth_uid` / `current_is_super_admin_from_auth_uid` permanecem a base de toda política.
- **Dados de produção** — nenhum dado fake/real é criado pelo gate.
- **Nada será commitado** neste gate.

## 15. Critérios de Aceitação (do gate)

- [x] Baselines executados e documentados: build PASS (15.57s EXIT 0), `tsc` 72 pré-existentes / zero novos, `git diff --check` exit 0.
- [x] Inventário das 10 áreas (§4–§9) completo e verificado contra o código (não por suposição).
- [x] Proposta de Import Engine com pipeline completo (§2, §10.1) e contrato `ImportDefinition`.
- [x] Proposta de Export Engine com `ExportDefinition`, tenant isolation e paginação (§10.2).
- [x] Divisão em subgates com dependências (§12).
- [x] 10 decisões de negócio **apresentadas e respondidas pelo PO** (§11 + §11.1) — autorizações e não-autorizações registradas verbatim.
- [x] Regra de duplicidade do PO incorporada como princípio 9 do Import Engine (§10.1).
- [x] Zero implementação, zero commit, zero migration, zero alteração de banco/RPC/regras financeiras.

---

*Status do gate: `AUDIT ✅ · DESIGN ✅ · PO APPROVED (2026-09-06) · ISOLATE ⏭`*

**Próximo passo:** ISOLATE — criar branch isolada `feature/p2-1-csv-clientes` a partir de `main` (base limpa; P1.3 aguarda merge) para implementação do P2.0/P2.1 (Import Engine + CSV de Clientes), restrita ao escopo aprovado. Staging/PR/merge/produção permanecem gates separados.*