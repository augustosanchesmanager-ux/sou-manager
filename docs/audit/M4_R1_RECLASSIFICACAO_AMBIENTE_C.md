-- ============================================================
-- M4 — R1 · Reclassificação de Ambiente (D → C)
-- STAGING como homolog isolado
-- ============================================================
>
> **Fase:** M4 — Implementação pós-G1.3 · **Subfase:** R1 do preflight M4
> **Status:** ✅ **RECLASSIFICAÇÃO D → C APROVADA** com base em evidências objetivas coletadas nesta sessão
> **Data:** 2026-09-21 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Base normativa:** `M4_FASE4_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md` (classificação D original) · ADR-015..021 · Política Oficial PG
> **Regra da etapa:** Reclassificação read-only do ambiente com base em nova evidência objetiva. Nenhuma alteração funcional em código, branches, RLS, migrations ou PROD.
> **Próxima etapa autorizada:** R2 (reexecução da FASE 4 contra STAGING após reclassificação). NÃO AUTORIZADAS: R3, R4, R5, R6.

---

## 1. Objetivo

Reclassificar o ambiente de homologação M4 de **D (produção com dados reais, sem isolamento seguro)** para **C (STAGING isolado disponível)**, com base em nova evidência objetiva coletada nesta sessão (2026-09-21).

A classificação original D foi feita em `M4_FASE4_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md` (data 2026-08-31) com base em:
- `.env.local` AUSENTE
- Supabase CLI linkado em PROD (`ushsnmlbeurfvlkieiln`)
- Sem base de homolog isolada

**Esta reclassificação NÃO contradiz a FASE 4** — ela atualiza a classificação à luz de mudanças no ambiente ocorridas entre 2026-08-31 e 2026-09-21 (STAGING project criado, migrations M4 aplicadas em STAGING, UI alinhada com main via promoção de `2beb9cc`).

---

## 2. Nova evidência objetiva (coletada nesta sessão)

### E1 — VITE_SUPABASE_URL aponta para STAGING

```
$LAST VITE_SUPABASE_URL line: VITE_SUPABASE_URL=https://tjcvuhynckocmvtqykxp.supabase.co
host: tjcvuhynckocmvtqykxp.supabase.co
```

**Confirmação**: a aplicação (buildada do commit `2beb9cc`) **NÃO aponta** para o banco PROD (`ushsnmlbeurfvlkieiln`). O backend configurado no app é o STAGING.

### E2 — supabase/.temp/linked-project.json (cache local do CLI)

```
{"ref":"ushsnmlbeurfvlkieiln","name":"sou-manager","organization_id":"eacrvldjisvgkiuamesq","organization_slug":"eacrvldjisvgkiuamesq"}
```

**Leitura crítica**: o **link do Supabase CLI** aponta para PROD, mas isso é apenas **cache local do CLI no diretório**. **NÃO afeta** o comportamento da aplicação — o app usa `VITE_SUPABASE_URL` injetado no build (ver E1), não o `linked-project.json`.

A divergência CLI↔app é **documentada** mas não é bloqueante: o `supabase db push`/`migration repair`/`db query` usariam o `linked-project.json` (PROD), portanto **qualquer operação `supabase` está PROIBIDA nesta sessão** (escopo do gate: read-only + audit doc).

### E3 — STAGING DB tem as migrations M4 aplicadas

| Migration | Conteúdo | Aplicada em STAGING? |
|-----------|----------|----------------------|
| `20260830000000_m4_p1_reverse_comanda_payment.sql` | `reverse_comanda_payment` | ✅ (per docs/audit/6.1.3) |
| `20260830010000_m4_p4_p5_attendance_rpcs.sql` | `confirm_appointment_attendance`, `correct_appointment_attendance`, `appointment_attendance_corrections` | ✅ (per docs/audit/6.1.3) |
| `20260830020000_m4_p6_unblock_comanda.sql` | `unblock_comanda`, `batch_unblock_comandas`, `comanda_unblock_audit` | ✅ + probe confirma `batch_unblock_comandas` (responde "permission denied") |
| `20260830030000_m4_p7_register_comanda_payment.sql` | `register_comanda_payment`, `get_comanda_payment_summary`, `comanda_payments` | ✅ + probe confirma `register_comanda_payment` + tabela `comanda_payments` |
| `20260830040000_m4_p8_tenant_refund_method.sql` | `get_tenant_refund_method`, `upsert_tenant_refund_method`, `tenants.settings` | ✅ + probe confirma coluna `tenants.settings` |

### E4 — STAGING DB tem dados sintéticos (não reais)

Per `M4_FASE1_READONLY_RELATORIO_FINAL` e probe `preflight-m4-artifacts.cjs` (anterior):

- **100+ users no schema `auth.users`**, com predominância de:
  - ~64 `h7-*@test.com` (criados por `scripts/h7-*`)
  - ~33 `e2e-*@gmail.com` (criados por `tests/e2e/setup/globalSetup.ts`)
  - 2-3 `gat-*@gmail.com` (origem desconhecida)
  - Outros (1-2 cada)
- **Tenants `e2e-suite-{runId}`**: 70+ tenants ativos, criados via Admin API + service_role
- **Domínio `@test.com`** predominante — padrão de teste (não clientes reais)

**Caracterização**: STAGING contém dados de fixture E2E + investigations `h7-*`. **Não há evidência de dados de produção real (clientes Sanchez Barber, comandas reais) em STAGING**.

### E5 — STAGING é projeto Supabase separado de PROD

| Aspecto | PROD | STAGING |
|---------|------|---------|
| Project ref | `ushsnmlbeurfvlkieiln` | `tjcvuhynckocmvtqykxp` |
| API URL | `https://ushsnmlbeurfvlkieiln.supabase.co` | `https://tjcvuhynckocmvtqykxp.supabase.co` |
| Hosting | supabase.com | supabase.com (projeto distinto) |
| Banco | isolado | isolado |
| Auth users | produção real | sintético (E2E + h7) |

**Conclusão**: STAGING é um **projeto Supabase dedicado** sem nenhuma conexão de dados com PROD.

### E6 — Vercel STAGING project é separado de PROD

Per `smg-homologacao-source-audit v2` (gate anterior) e probe atual:

- Vercel project: `smg-barber-staging` (ID `prj_5qoCiw7lwSZnKgB6UcS7kSNQqRAk`)
- Production deployment atual: `dpl_9YMxWZtHMp1msFKHmaMh2Fuj6xwL` (commit `2beb9cc`)
- URL: `https://smg-barber-staging.vercel.app` + `https://staging.barber.soumanager.com` (DNS em parking)
- **Owner separado** de PROD (`smg-barber` é outro Vercel project)

**Conclusão**: o app STAGING serve de **Vercel project dedicado**, não compartilhado com PROD.

---

## 3. Comparação das classificações

| Critério | FASE 4 (2026-08-31) — D | R1 (2026-09-21) — C |
|----------|--------------------------|---------------------|
| `.env.local` | AUSENTE | PRESENTE (apontando para STAGING) |
| Supabase CLI link | PROD | PROD (mas irrelevante — app usa VITE_) |
| Backend da app | localhost (demo mode) | STAGING `tjcvuhynckocmvtqykxp` |
| Banco acessível | nenhum Supabase real | STAGING Supabase (M4 migrations aplicadas) |
| Usuários | 0 (demo mode) | 100+ sintéticos |
| Migrations M4 | não aplicadas | aplicadas (5 arquivos) |
| Migrations UI | demo mode | UI alinhada com main (`2beb9cc`) |
| Vercel project | nenhum | `smg-barber-staging` (dedicado) |
| Write seguro de dados | não (PROD-only) | **sim (STAGING isolado)** |

**Conclusão comparativa**: a maioria dos critérios que fundamentaram a classificação D original **mudou de estado** entre 2026-08-31 e 2026-09-21. A classificação C é **correta para o estado atual**.

---

## 4. Decisão R1

**RECLASSIFICAÇÃO APROVADA**: ambiente M4 passa de **D** para **C** (STAGING isolado disponível).

### Implicações

1. **Validações FASE 4 read-only** (estática + financeira isolada): podem ser executadas.
2. **Validações FASE 4 write-based** (smoke P5/P4/P7 + tenant isolation): podem ser executadas em STAGING com usuários sintéticos — **desde que não excedam escopo de R2** (smoke específico, sem provisioning extenso).
3. **PROD permanece intocado** — sem alterações aplicadas, sem mudanças de schema, sem smoke real contra dados de produção.
4. **Migrations M4 permanecem em STAGING apenas** — promoção para PROD é gate **R4** (NÃO AUTORIZADO nesta autorização).

### Limites da reclassificação

A reclassificação **D → C** é estritamente sobre a disponibilidade de ambiente isolado para homologação M4. **Não é**:

- ❌ Liberação para aplicar M4 em PROD (gate R4)
- ❌ Liberação para alterar `d8:verify` (gate R3)
- ❌ Liberação para implementar CI workflow (gate R5)
- ❌ Liberação para sincronizar `homologacao` (gate R6)

---

## 5. R1 — Verificações executadas (read-only, no escopo)

| Verificação | Método | Resultado |
|--------------|--------|-----------|
| VITE_SUPABASE_URL last-wins | `Get-Content .env.local \| Select-String -Pattern '^VITE_SUPABASE_URL=' \| Select-Object -Last 1` | ✅ `https://tjcvuhynckocmvtqykxp.supabase.co` |
| supabase/.temp/linked-project.json | `Get-Content supabase/.temp/linked-project.json` | ⚠️ Aponta para PROD (cache CLI local) — irrelevante para o app |
| git status (working tree clean) | `git status --short` | ✅ Apenas arquivos untracked pré-existentes (sem mudanças por R1) |
| STAGING DB migrations M4 | `preflight-m4-rpcs.cjs` (probe service_role) | ✅ `batch_unblock_comandas`, `register_comanda_payment`, `tenants.settings`, tabelas confirmadas |
| STAGING DB users sintéticos | `preflight-m4-artifacts.cjs` (probe anterior) | ✅ 100+ users com domínio `@test.com` / `@gmail.com` (e2e-* / h7-*) |
| STAGING Supabase project | conf. ref `tjcvuhynckocmvtqykxp` via VITE_ | ✅ Projeto dedicado, isolado de PROD |
| Vercel STAGING project | `vercel project inspect smg-barber-staging` (anterior) | ✅ Project dedicado, deploy `dpl_9YMxWZtHMp1msFKHmaMh2Fuj6xwL` @ `2beb9cc` |

---

## 6. Não-autorizados nesta etapa (R1)

Conforme autorização do PO:

- ❌ Nenhuma migration aplicada em PROD
- ❌ Nenhuma alteração em migrations M4
- ❌ Nenhuma alteração em RLS
- ❌ Nenhuma alteração em código funcional fora do escopo
- ❌ Nenhuma alteração em Production Branch / Auto Deploy da Vercel
- ❌ R3 (d8:verify) NÃO EXECUTADO
- ❌ R4 (aplicar M4 em PROD) NÃO EXECUTADO
- ❌ R5 (ADR CI workflow) NÃO EXECUTADO
- ❌ R6 (sync homologacao) NÃO EXECUTADO
- ❌ Nenhuma escrita em branches, commits, pushes, merges, deploys adicionais
- ❌ Único efeito colateral: **criação deste audit doc** em `docs/audit/M4_R1_RECLASSIFICACAO_AMBIENTE_C.md` (documentação de evidência, não funcional)

---

## 7. Próxima etapa (R2) — autorizada

Após R1 concluído com sucesso, R2 pode ser executado conforme autorização do PO:

> **R2 — Reexecutar a FASE 4 em STAGING**
> - Utilizar STAGING após reclassificação R1
> - Executar integralmente as validações previstas para FASE 4
> - Registrar evidências objetivas dos resultados
> - Não interpretar resultado parcial como aprovação
> - Qualquer blocker → STOP

**STOP registrado. Aguardando confirmação de R1 antes de prosseguir para R2.**