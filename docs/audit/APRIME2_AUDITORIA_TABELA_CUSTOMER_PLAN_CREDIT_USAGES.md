# A'' — Auditoria da Tabela Histórica `customer_plan_credit_usages`

> **Fase:** A'' (decorrente do STOP do PO sobre o A')
> **Data:** 2026-08-31
> **Escopo:** Investigação **read-only** — definição histórica completa da tabela `customer_plan_credit_usages`, seus consumidores, o gap vs migration chain, e evidência para decisão de restauração.
> **Status:** AUDITORIA CONCLUÍDA — **decisão de escrita pendente do PO** (nenhuma escrita executada).

---

## 1. Contexto e Gate

A auditoria B' mapeou 50 funções ausentes do histórico de migrations; 14 foram identificadas como bloqueadoras da chain a partir de `20260808110000` (set de REVOKE). O PO autorizou **A'** (restaurar somente as 14 no staging `tjcvuhynckocmvtqykxp`).

Durante a análise de dependências **antes** da escrita, foi descoberto que **2 das 14 funções** referenciam em *runtime* a tabela **`customer_plan_credit_usages`**, que:
- **NÃO existe** no staging (verificado via `db query --linked`);
- **NÃO é criada por nenhuma migration** (139 migrations, 0 menções).

O PO decidiu **STOP antes de qualquer escrita** e autorizou **A'' — auditoria read-only** da tabela histórica, sem restaurar as 14 funções, sem criar a tabela "no chute", sem alterar migrations, sem workaround, sem retomar db push, **sem tocar produção.**

---

## 2. Fonte de Verdade

- **Backup histórico:** `docs/backups/backup_pre_migration_20260728_152717.sql` (13.242 linhas).
- **Migrations:** `supabase/migrations/` (139 arquivos) — **0 menções** a `customer_plan_credit_usages`.
- **Staging:** `tjcvuhynckocmvtqykxp` (link atual do projeto) — tabela **ausente** (verificado read-only).

---

## 3. Definição Histórica Completa (verbatim do backup)

### 3.1 CREATE TABLE (linhas 7816–7835)

```sql
CREATE TABLE IF NOT EXISTS "public"."customer_plan_credit_usages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "service_id" "uuid",
    "comanda_id" "uuid",
    "comanda_item_id" "uuid",
    "appointment_id" "uuid",
    "professional_id" "uuid",
    "credit_key" "text" DEFAULT 'default'::"text" NOT NULL,
    "quantity_used" integer DEFAULT 1 NOT NULL,
    "original_price" numeric(10,2),
    "credit_effect" numeric(10,2) DEFAULT 0,
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_plan_credit_usages_quantity_used_check" CHECK (("quantity_used" > 0))
);
```

### 3.2 Owner

```sql
ALTER TABLE "public"."customer_plan_credit_usages" OWNER TO "postgres";  -- linha 7838
```

### 3.3 Primary Key (linhas 8663–8664)

```sql
ALTER TABLE ONLY "public"."customer_plan_credit_usages"
    ADD CONSTRAINT "customer_plan_credit_usages_pkey" PRIMARY KEY ("id");
```

### 3.4 Índices (8 BTREE, linhas 9395–9423)

| Índice | Coluna |
|--------|--------|
| `idx_credit_usages_client` | `client_id` |
| `idx_credit_usages_comanda` | `comanda_id` |
| `idx_credit_usages_comanda_item` | `comanda_item_id` |
| `idx_credit_usages_period` | `used_at` |
| `idx_credit_usages_professional` | `professional_id` |
| `idx_credit_usages_service` | `service_id` |
| `idx_credit_usages_subscription` | `subscription_id` |
| `idx_credit_usages_tenant` | `tenant_id` |

### 3.5 Foreign Keys (10, linhas 10656–10702)

| FK | Coluna → Referência | ON DELETE |
|----|--------------------|-----------|
| `..._appointment_id_fkey` | `appointment_id` → `appointments(id)` | SET NULL |
| `..._client_id_fkey` | `client_id` → `clients(id)` | CASCADE |
| `..._comanda_id_fkey` | `comanda_id` → `comandas(id)` | SET NULL |
| `..._comanda_item_id_fkey` | `comanda_item_id` → `comanda_items(id)` | SET NULL |
| `..._created_by_fkey` | `created_by` → `auth.users(id)` | SET NULL |
| `..._plan_id_fkey` | `plan_id` → `customer_plans(id)` | RESTRICT |
| `..._professional_id_fkey` | `professional_id` → `staff(id)` | SET NULL |
| `..._service_id_fkey` | `service_id` → `services(id)` | SET NULL |
| `..._subscription_id_fkey` | `subscription_id` → `customer_subscriptions(id)` | CASCADE |
| `..._tenant_id_fkey` | `tenant_id` → `tenants(id)` | CASCADE |

### 3.6 FK reversa (linha 10782) — em `comanda_items`

```sql
ALTER TABLE ONLY "public"."comanda_items"
    ADD CONSTRAINT "fk_comanda_items_credit_usage"
    FOREIGN KEY ("credit_usage_id") REFERENCES "public"."customer_plan_credit_usages"("id") ON DELETE SET NULL;
```

> **Implicação:** `comanda_items.credit_usage_id` aponta para esta tabela. A coluna `credit_usage_id` de `comanda_items` existe no backup (linhas 6013/6050).

### 3.7 RLS (linhas 11490–11493)

```sql
ALTER TABLE "public"."customer_plan_credit_usages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_plan_credit_usages_tenant"
ON "public"."customer_plan_credit_usages" TO "authenticated"
USING (("public"."current_is_super_admin_from_auth_uid"()
        OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())))
WITH CHECK (("public"."current_is_super_admin_from_auth_uid"()
             OR ("tenant_id" = "public"."current_tenant_id_from_auth_uid"())));
```

> Apenas **1 policy**; mesma convenção de isolamento por tenant + bypass superadmin usada nas tabelas críticas (padrão da Fase 3.3).

### 3.8 Grants (linhas 13025–13027)

```sql
GRANT ALL ON TABLE "public"."customer_plan_credit_usages" TO "anon";
GRANT ALL ON TABLE "public"."customer_plan_credit_usages" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_plan_credit_usages" TO "service_role";
```

### 3.9 Triggers / Dados

- **Triggers:** **nenhum** (0 `CREATE TRIGGER` sobre a tabela).
- **Dados históricos:** **nenhum COPY** para a tabela → **tabela vazia no backup**, infraestrutura de *runtime* (não há payload a preservar).

### 3.10 Comentários

- **Nenhum `COMMENT ON`** (tabela ou colunas) no backup. Sem comentários a reproduzir.

---

## 4. Consumidores Históricos (de todos os 13242 linhas do backup)

Referências a `customer_plan_credit_usages` no backup:

| Linha | Tipo | Onde |
|-------|------|------|
| 1522 | INSERT | `apply_plan_credit_to_comanda_item` ⚠ (1 das 14) |
| 4035 | SELECT | `get_credit_usage_history` ⚠ (1 das 14) |
| 1532 | UPDATE | `apply_plan_credit_to_comanda_item` seta `comanda_items.credit_usage_id` |
| 6013 / 6050 | DDL | coluna `credit_usage_id` em `comanda_items` |
| 7816–13027 | DDL | CREATE + PK + 8 índices + 10 FKs + reverse FK + RLS/policy + grants (Seção 3) |

**Conclusão de consumo:** exatamente **2** das 14 funções autorizadas dependem desta tabela em *runtime* (`apply_plan_credit_to_comanda_item` — INSERT, e `get_credit_usage_history` — SELECT), mais a coluna `comanda_items.credit_usage_id` com FK reversa. **Nenhum outro objeto histórico** (função/trigger/view) consome a tabela.

---

## 5. Dependências da Tabela vs Staging (read-only)

Para o `CREATE TABLE` histórico ser aplicado com sucesso, as tabelas-pai referenciadas por FK precisam existir no staging. Verifiquei read-only em `tjcvuhynckocmvtqykxp`:

| Tabela-pai | Existe no staging? | Migration de origem |
|-----------|--------------------|---------------------|
| `appointments` | ✅ | `20260219183612_create_initial_schema.sql` |
| `clients` | ✅ | — |
| `comandas` | ✅ | — |
| `comanda_items` | ✅ | — |
| `staff` | ✅ | — |
| `services` | ✅ | — |
| `customer_plans` | ✅ | `20260311_chef_club_tables.sql` |
| `customer_subscriptions` | ✅ | `20260311_chef_club_tables.sql` |
| `tenants` | ✅ | — |
| `auth.users` | ✅ | system |

**Todas as dependências da tabela existem no staging.** A definição histórica é **completa e autoconsistente**.

> **Nota de CREATE-time:** as 14 funções são PL/pgSQL com compilação *lazy* — o CREATE OR REPLACE delas **não** falha pela ausência da tabela (a referência só quebraria em *runtime*). O `%ROWTYPE` de `apply_plan_credit_to_comanda_item` recai sobre `comandas`, `comanda_items`, `customer_credits` — todos presentes ✅.

---

## 6. O Gap (três pernas solicitadas pelo PO)

| Pergunta | Resultado |
|----------|-----------|
| **139 migrations → menções?** | **0 menções.** A tabela não é criada por nenhuma migration da chain. ❌ |
| **Backup → definição?** | **Definição completa e única** (Seção 3). Sem múltiplas versões/inconsistências. ✅ |
| **Produção → tabela existe?** | **NÃO VERIFICÁVEL aqui.** O projeto está `--linked` apenas ao staging (`tjcvuhynckocmvtqykxp`); `.env.local` ausente. Consultar produção (`ushsnmlbeurfvlkieiln`) exigiria credenciais read-only de produção (estritamente proibidas de usar neste ambiente). Requer acesso read-only provido pelo PO (ex.: consulta no Supabase Dashboard de produção ou connection string read-only). |

---

## 7. Necessidade na Cadeia D8 → M1 → M2 → M3 → M4

Verificado read-only nas migrations:

- **Nenhuma migration de `202608*` referencia** `customer_plan_credit_usages` (incluindo D8: `20260827*`/`20260828*`, e M4: `20260830*`).
- Extensão ao scan total: **0 de 139 migrations** mencionam a tabela.
- **Conclusão:** a tabela **não é exigida pelo SQL da cadeia**. A necessidade é **indireta e em runtime** — apenas as **2 funções** (`apply_plan_credit_to_comanda_item`, `get_credit_usage_history`) que a consomem, e que por sua vez são bloqueadoras do `20260808110000` (set de REVOKE).

> **Implicação:** se a tabela não for (re)criada, as 14 funções **compilam** (PL/pgSQL lazy), a migration `20260808110000` pode passar, mas **2 funções ficam funcionalmente quebradas em runtime**. A restauração da tabela é condição para o comportamento histórico completo, ainda que não seja gate sintático da chain.

---

## 8. Avaliação e Risco

- A tabela é **infraestrutura de runtime do Chef Club Credits**, **vazia** no backup, com definição **completa**, **única** e **autoconsistente** — não é um objeto com histórico de dados a preservar.
- O gap é **similar ao das 50 funções**: parte do mesmo problema de histórico de migrations incompleto (objeto existia no dump pré-migration mas nunca foi migrado).
- **Riscos de criar a tabela "no chute" (rejeitados pelo PO):** produzir um staging que "passa" mas não reproduz fielmente o comportamento histórico. Por isso **nenhuma escrita foi feita**.
- As 14 funções **compilam mesmo sem a tabela**, mas 2 delas ficariam **quebradas em runtime** até a tabela existir → por isso o PO mandou **não restaurar as 14 ainda**.

---

## 9. O que FOI / NÃO FOI feito

### FEITO (read-only + artefato de proposta)
- ✅ Definição completa extraída do backup (CREATE, PK, 8 índices, 10 FKs, reverse FK, RLS+policy, grants, owner).
- ✅ Inventário total de consumidores (somente 2 das 14 + coluna `credit_usage_id`).
- ✅ Confirmação de 0 menções em 139 migrations.
- ✅ Verificação read-only das dependências da tabela no staging (todas presentes).
- ✅ Confirmação de que a tabela é vazia (sem triggers, sem dados, sem comentários).
- ✅ Necessidade na cadeia D8→M1–M4 avaliada (runtime-only, não gate sintático).
- ✅ **Proposta de restauração mínima gerada** (NÃO aplicada): `test-results/aprime2_proposal_create_table.sql` (verbatim do backup).

### NÃO FEITO (fora do escopo autorizado)
- ❌ Não criou a tabela.
- ❌ Não restaurou as 14 funções (script `test-results/aprime_restore_14.sql` pronto, **não aplicado**).
- ❌ Não alterou/renomeou/apagou qualquer migration.
- ❌ Nenhum workaround.
- ❌ Não retomou o db push.
- ❌ **Não tocou produção.**
- ❌ Não verificou a existência da tabela em produção (sem credenciais read-only).

---

## 10. Decisão Pendente do PO

Duas alternativas (exclusão mútua):

### Opção 1 — A'' de restauração mínima (staging)
Autorizar a criação de `customer_plan_credit_usages` **exclusivamente no staging**, reproduzindo a definição histórica verbatim (proposta em `test-results/aprime2_proposal_create_table.sql`), seguida da restauração das 14 funções (`test-results/aprime_restore_14.sql`) e retomada do db push de `20260808110000` com STOP em qualquer erro. Isso exigiria, idealmente, a confirmação read-only de produção (perna da Seção 6) para aumentar a confiança de fidelidade.

### Opção 2 — STOP para reconstrução via documentação formal
Não criar nada; registrar o gap como parte do histórico de migrations incompleto e tratar a reconstrução de forma formal (ADR / migration oficial), fora da lógica de "restauração de staging".

**Recomendação da auditoria:** a definição é completa, única e autoconsistente, sem payload histórico nem comentários — forte candidata à **Opção 1** (restauração mínima verbatim no staging), desde que o PO confirme a perna de produção ou autorize explicitamente prosseguir sem ela. Em caso de qualquer inconsistência na definição, aplicar **STOP**.

**Aguardando aprovação formal do PO. Nenhuma escrita foi executada nesta fase A''.**

---

## 11. Execução da Opção 1a (autorizada pelo PO) + R1 + Opção A — RESUMO

Execução realizada **exclusivamente no staging `tjcvuhynckocmvtqykxp`**. Produção `ushsnmlbeurfvlkieiln` intacta. Nenhum seed/E2E executado.

### 11.1 Restauração mínima do conjunto autorizado (todos validados read-only)
- `customer_plan_credit_usages` criada verbatim: 17 colunas, PK, CHECK `quantity_used>0`, 10 FKs, 8 índices, RLS+1 policy, grants anon/authenticated/service_role.
- `comanda_items.credit_usage_id uuid` adicionada (byte/lógica = backup linha 6013; nula, sem default).
- reverse FK `fk_comanda_items_credit_usage` (`FK(credit_usage_id) → customer_plan_credit_usages(id) ON DELETE SET NULL`) — idêntica ao backup.
- 14 funções restauradas verbatim (`test-results/aprime_restore_14.sql`): 10 SECURITY DEFINER + 4 INVOKER (fiel ao dump); owner `postgres`; search_path fiel; grants anon/authenticated/service_role.

### 11.2 Desbloqueio do histórico (R1 + Opção A)
- **R1:** `supabase migration repair --linked --status reverted 20260420 20260428 20260501 20260502` — removeu 4 entradas remotas orfãs do histórico (objetos preservados; verificado).
- **Opção A:** `supabase db push --linked --include-all --yes` — aplicou a cadeia de `20260808110000` até `20260831120000` (exit 0; NOTICEs benignos de idempotência/pg_cron ausente).

### 11.3 Estado final validado (read-only)
- Migration `20260808110000` **desbloqueada e aplicada**.
- Cadeia **D8** (RPCs: `claim_next_outbox_item`, `get_financial_operation_context`, `exists_commission_record`, `mark_outbox_item_processed`, `handle_processing_failure`, `recover_stale_processing`, `upsert_worker_heartbeat`; tabela `outbox_items`) ✅
- Cadeia **M1–M4** (tabelas `commission_records`, `comanda_payments`, etc.) ✅
- Conjunto autorizado íntegro após o push (tabela + coluna + reverse FK + 14 funções re-confirmadas). ✅
- **Seeds/E2E: NÃO executados** — aguardando novo gate do PO. ✅

---

*Documento gerado em 2026-08-31 durante a sessão A''. Execução da Opção 1a/R1/Opção A registrada na Seção 11. Nenhuma escrita fora de `docs/audit/`, `test-results/` e do staging autorizado foi realizada.*
