# STAGING GATE — FASE 2 · Relatório de Provisionamento Controlado

> **Gate:** STAGING GATE · **Fase:** 2.3 (Restauração mínima + retomada controlada)
> **Status:** ⛔ **STOP — NOVO BLOCKER / DEPENDÊNCIA HISTÓRICA.** Auditoria read-only (§6) provou que a migration `20260808110000_revoke_anon_rpc_execute.sql` revoga **14 funções ausentes** no staging (não apenas 1). A autorização cobria somente `apply_plan_credit_to_comanda_item`; per **§7** (outras dependências históricas ⇒ **não restaurar automaticamente**), a restauração **NÃO foi executada** e **STOP** foi acionado para novo gate do PO.
> **Data:** 31/08/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Produção intocável:** `ushsnmlbeurfvlkieiln` — `sou-manager` (0 escritas)

---

## 1. Autorização do PO (recriação controlada — Opção C)

PO autorizou **recriar o ambiente de staging do zero** (eliminar versões órfãs `20260420/28`, `20260501/02`), com: produção intocável; remover o staging atual; criar novo projeto; preferir região adequada documentada; capturar ref e confirmar ≠ produção; link exclusivo ao novo staging; aplicar migrations desde o início; **sem** `migration repair`/rename/apagar/alterar SQL; BOM já removido permanece única alteração (`EF BB BF` removido de `20260806050000_phase_6_0_4_4_billing_engine.sql`, sem lógica alterada); validar schema (D8, M1–M4); depois `.env.local` só-staging, seeds, isolamento; **E2E adiado**; **sem commit/push/merge/tag/deploy**. Em qualquer nova falha: **STOP imediato**, sem workaround, documentar e retornar ao PO.

## 2. Projeto Criado (novo)

| Campo | Valor |
|---|---|
| **Nome** | `sou-manager-staging` |
| **Project ref (novo)** | `tjcvuhynckocmvtqykxp` |
| **Region** | West US (North California) — `us-west-1` |
| **Org** | `eacrvldjisvgkiuamesq` |
| **Criado em (UTC)** | 2026-08-31 14:53:11 |
| **Staging antigo (removido)** | `uvohhixqnwxkfwvwgpjy` |

> **Escolha de região (documentada):** `us-west-1` (West US North California) — isolamento físico do cluster de produção (West US Oregon, `us-west-2`), como defesa em profundidade para que operações de staging nunca possam colidir com o banco de produção. O staging não serve tráfego real; a diferença de região é irrelevante funcionalmente e reduz o risco de efeito-cruzado.

## 3. Project Ref (conferência)

- **Novo staging:** `tjcvuhynckocmvtqykxp`
- **Produção:** `ushsnmlbeurfvlkieiln`
- **Staging antigo:** `uvohhixqnwxkfwvwgpjy` — **REMOVIDO** (não está mais em `projects list`)
- **Separação:** refs distintos; produção **não linkada**; nenhuma escrita em produção.

## 4. Região

Ver §2 (`us-west-1`, documentada).

## 5. Confirmação de Separação da Produção

- `supabase projects list` após recriação: produção `ushsnmlbeurfvlkieiln` (não linkada) · novo staging `tjcvuhynckocmvtqykxp` (linkada, marcada `●`) · `rvpmaqoqrorcbxxnqpjo` (sanchez-barber) · `krcerrmflfeetlbrwnxd` (vercel). Staging antigo `uvohhixqnwxkfwvwgpjy` ausente.
- `linked-project.json` = `{"ref":"tjcvuhynckocmvtqykxp","name":"sou-manager-staging",...}`.
- `supabase migration list --linked` conecta ao **novo staging**, que nasceu **vazio** (nenhuma migration remote no início).
- **Produção: 0 escritas, 0 migrations aplicadas, ref nunca alterado.**

## 6. Migrations Aplicadas (STATUS: PARCIAL — 3º BLOQUEIO)

### 6.1 Recriação (Opção C) — executada
1. Removido o staging antigo `uvohhixqnwxkfwvwgpjy` (`supabase projects delete ... --yes`) — projeto sem dados de negócio (só schema parcial).
2. Criado novo staging `tjcvuhynckocmvtqykxp` (`projects create ... --region us-west-1`).
3. Link CLI ao novo staging (`supabase link --project-ref tjcvuhynckocmvtqykxp`).
4. Novo staging confirmado **vazio** (`migration list` sem remote).
5. Aplicadas **todas as 131 migrations locais desde o início** (BOM já removido permanece única alteração autorizada).

### 6.2 O que foi aplicado
O `supabase db push --linked` aplicou **até `20260808000000_fix_create_invoice_record_payment_attempt_ambiguity.sql`** com sucesso. **Não** houve mais o erro de "Remote migration versions not found" (o staging recriado, vazio, aplicou limpo), e o **BOM foi processado sem erro** (`20260806050000_phase_6_0_4_4_billing_engine.sql` aplicada com sucesso — confirmando a correção).

### 6.3 FALHA (3º BLOQUEIO — STOP)
A aplicação **falhou** em **`20260808110000_revoke_anon_rpc_execute.sql`**:

```
ERROR: function apply_plan_credit_to_comanda_item(uuid, uuid, uuid, uuid, uuid, uuid) does not exist (SQLSTATE 42883)
At statement: 0
...
REVOKE EXECUTE ON FUNCTION apply_plan_credit_to_comanda_item(uuid,uuid,uuid,uuid,uuid,uuid) FROM anon
```

**Causa raiz (evidência read-only, grep):** a função `apply_plan_credit_to_comanda_item` **NÃO é criada por nenhuma migration** em `supabase/migrations/`. Ela existe em **produção** porque foi implantada por caminho/manual pré-história, capturado apenas em:
- `docs/backups/backup_pre_migration_20260728_152717.sql` (dump de banco — `CREATE OR REPLACE FUNCTION "public"."apply_plan_credit_to_comanda_item"`).
- `20260808110000_revoke_anon_rpc_execute.sql` (a migration que falha) — **apenas `REVOKE`**, não cria a função.

O comentário da própria migration afirma "Idempotente: REVOKE de privilegio inexistente gera NOTICE (sem erro)" — **incorreto**: `REVOKE ... ON FUNCTION <inexistente>` gera **ERROR 42883** (undefined_function), não NOTICE. A migration assumiu que a função existiria no schema (como ocorre em produção), mas **não há migration que a crie**, rompendo a reprodução limpa do schema.

**Conclusão:** é uma **lacuna no histórico de migrations** (função de produção não coberta por migration). Não é defeito introduzido nesta sessão; impede a reprodução do schema de produção a partir das migrations puras.

### 6.4 Por que é um STOP (mandato)
PO: *"Se qualquer nova migration falhar: STOP imediatamente. Não criar workaround sem nova autorização."* E: *"Nenhuma decisão adicional deve ser tomada automaticamente caso surja outro blocker. Nesse caso, documentar a evidência e retornar ao PO para novo gate."*
- ❌ **NÃO** criei migration para criar a função (workaround — proibido).
- ❌ **NÃO** editei `20260808110000_revoke_anon_rpc_execute.sql`.
- ❌ **NÃO** usei `migration repair`.
- ❌ **NÃO** toquei produção.

### 6.5 Estado atual do novo staging (parcial — recoverable)
- Aplicadas: até `20260808000000` (Remote presente no `migration list`).
- **Falhou/pendente:** `20260808110000` (Remote em branco) e **todas as posteriores** — incluindo as correções `h6` (`2026081312*`), **D8** (`20260820120000_create_commission_records.sql`, `20260826/27/28_d8_*`), **M1** (`20260829000000_attended_at.sql`), **M2** (`20260829010000_payment_type_enum.sql`), **M3** (`20260829020000_comanda_payments.sql`), e **M4** (`2026083000*_m4_*.sql`).
- **Consequência:** o novo staging **NÃO possui** as estruturas de P4/P5/P7 nem as tabelas D8 (mesma situação funcional do anterior, agora num projeto limpo).
- A falha foi **não destrutiva** (parou antes de aplicar a migration que falhou e as posteriores).

## 7. Validações do Schema (STATUS: INCOMPLETO — 3º BLOQUEIO)

- **Base e Phase 6 (parcial):** aplicadas até `20260808000000`.
- **Migrations: NÃO completas** — `D8`, `M1`, `M2`, `M3`, `M4` **não aplicadas** (bloqueadas por `20260808110000`).
- **`migration list --linked`:** `20260808000000` remote ok; `20260808110000` em branco (falha).
- **Objetos críticos de P4/P5/P7:** **NÃO presentes** (migrations M não aplicadas).

**Schema do novo staging: NÃO está pronto para P4/P5/P7.**

## 8. Configuração do Ambiente (STATUS: NÃO CONFIGURADO — bloqueado)

- `.env.local` **NÃO foi criado** — aguarda schema completo (migrations de produção falham antes de D8/M1-M4).
- `.env.local.val-bak` / `.vercel-temp.env` **NÃO ativados**; `.gitignore` já ignora `*.local`.
- Proteções em vigor; nenhum segredo de produção carregado.

## 9. Confirmação de Ausência de Credenciais Produtivas

- **Nenhuma credencial de produção utilizada.**
- Nova senha do banco de staging gerada aleatoriamente (24 chars), só em `test-results/.staging-db-password` (gitignored); **não** neste relatório.
- `VITE_SUPABASE_URL`/anon/SERVICE_ROLE de produção **não lidos/usados**; `.env.local.val-bak`/`.vercel-temp.env` fechados.

## 10. Seeds Criados (STATUS: NÃO CRIADOS — bloqueado)

Nenhum seed criado. Bloqueado pelo schema incompleto (§6).

## 11. Tenants Sintéticos (STATUS: NÃO CRIADOS)

Nenhum Tenant A/B. Bloqueado.

## 12. Usuários/Roles (STATUS: NÃO CRIADOS)

Nenhum usuário/role. Bloqueado.

## 13. Validação de Isolamento (STATUS: PARCIAL)

| Requisito | Status |
|---|---|
| produção ≠ staging | ✅ **CONFIRMADO** — `ushsnmlbeurfvlkieiln` ≠ `tjcvuhynckocmvtqykxp`; linked = novo staging |
| Tenant A ≠ Tenant B | ⚠️ NÃO TESTÁVEL (nenhum tenant) |
| Usuário A ≠ Usuário B | ⚠️ NÃO TESTÁVEL (nenhum usuário) |
| Dados só do staging | ⚠️ NÃO TESTÁVEL (nenhum dado de negócio criado) |
| Nenhuma credencial produtiva ativa | ✅ CONFIRMADO (§9) |

**Sem evidência de mistura com produção.**

## 14. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | **Staging com schema incompleto** (parado em `20260808000000`; D8/M4 não aplicadas) | **ALTO** | Resolver 3º bloqueio (função ausente) e retomar |
| 2 | **Criar workaround** (ex.: migration nova p/ criar a função) | **CRÍTICO (proibido)** | **NÃO feito**; aguarda gate do PO |
| 3 | Confundir stub de staging (`tjcvuhynckocmvtqykxp`) com produção (`ushsnmlbeurfvlkieiln`) | **CRÍTICO** | Ref documentado; guard antes de `db push` |
| 4 | O 3º bloqueio pode retornar nos NEXT staging (schema não reproduzível só por migrations) | **ALTO** | Documentar lacuna; decidir no gate: corrigir histórico OU aplicar função via caminho autorizado pelo PO |

## 15. Problemas Encontrados

| # | Problema | Local | Status / Resolução |
|---|---|---|---|
| 1 | **UTF-8 BOM** em `20260806050000` | `supabase/migrations/20260806050000_phase_6_0_4_4_billing_engine.sql` | ✅ **RESOLVIDO** (§6.2 — aplicado sem erro na recriação) |
| 2 | Versões órfãs `20260420/28`, `20260501/02` | staging antigo | ✅ **ELIMINADO** via recriação (Opção C) |
| 3 | **Função inexistente** `apply_plan_credit_to_comanda_item` referenciada por REVOKE | `supabase/migrations/20260808110000_revoke_anon_rpc_execute.sql` → `ERROR 42883` | ⛔ **NOVO STOP.** Função criada só em `docs/backups/backup_pre_migration_20260728_152717.sql` (dump), **não** por migration |

**Evidência da lacuna (§15/#3):** grep por `apply_plan_credit_to_comanda_item` em `*.sql` → presente **apenas** em `docs/backups/backup_pre_migration_20260728_152717.sql` (create) e na própria `20260808110000...` (revoke). **Nenhuma migration a cria.**

## 16. Evidências

| Evidência | Resultado |
|---|---|
| `supabase projects delete uvohhixqnwxkfwvwgpjy --yes` | `Deleted project: sou-manager-staging` (antigo) |
| `supabase projects create ... --region us-west-1` | Novo `tjcvuhynckocmvtqykxp` |
| `supabase link --project-ref tjcvuhynckocmvtqykxp` | `Finished supabase link.` |
| `supabase/.temp/linked-project.json` | `{"ref":"tjcvuhynckocmvtqykxp","name":"sou-manager-staging",...}` |
| `supabase migration list --linked` (novo staging) | Vazio no início; aplicou até `20260808000000`; `20260808110000` falhou |
| `supabase db push --linked` (recriação) | Aplicou até `20260808000000`; **FALHOU** em `20260808110000` (`42883`) |
| grep `apply_plan_credit_to_comanda_item` (todos os `.sql`) | Só em backup dump (create) + `20260808110000` (revoke) — **nenhuma migration cria a função** |
| `supabase projects list` (pós-recriação) | Produção não linkada; novo staging linkado; antigo ausente |
| `git status` (migrations) | Única modificação = BOM de `20260806050000` (autorizada) |

## 17. Critérios de Saída

- [x] Recriação executada (Opção C): antigo removido, novo criado e linkado (§6.1)
- [x] Separação da produção confirmada (§5) e staging recriado ≠ produção
- [x] BOM continuamente resolvido (aplicado sem erro na recriação; §6.2)
- ⚠️ **Migrations — PARCIAL** (3º bloqueio em `20260808110000`; §6.3) — **NÃO OK**
- ⚠️ **Validações do schema — NÃO concluídas** (D8/M4 pendentes; §7) — **NÃO OK**
- ⚠️ **Ambiente — NÃO configurado** (§8) — **NÃO OK**
- [x] Ausência de credenciais produtivas (§9)
- ⚠️ **Seeds/tenants/usuários — NÃO criados** (§10–12) — **NÃO OK**
- ⚠️ **Isolamento — PARCIAL** (§13)
- [x] E2E P4/P5/P7 **NÃO executados**
- [x] Produção intocada; sem commit/push/merge/tag/deploy

---

## GATE FINAL

```text
STAGING GATE — FASE 2

Produção:
    INTACTA

Staging antigo:
    REMOVIDO

Novo staging:
    sou-manager-staging

Novo project ref:
    tjcvuhynckocmvtqykxp

Produção ref:
    ushsnmlbeurfvlkieiln

Staging separado:
    SIM

Migrations:
    FAIL  (parou em 20260808110000_revoke_anon_rpc_execute.sql — função
           apply_plan_credit_to_comanda_item inexistente, SQLSTATE 42883)

schema_migrations:
    FAIL  (parcial: até 20260808000000; 20260808110000 pendente)

D8:
    FAIL  (pendente — bloqueado por 20260808110000)

M1:
    FAIL  (pendente)

M2:
    FAIL  (pendente)

M3:
    FAIL  (pendente)

M4:
    FAIL  (pendente)

.env.local:
    NÃO CONFIGURADO (aguarda schema)

Seeds:
    NÃO CRIADOS

Tenant isolation:
    PARCIAL (produção≠staging OK; tenants não criados)

E2E P4/P5/P7:
    NÃO EXECUTADO

Commit:
    NÃO

Push:
    NÃO

Deploy:
    NÃO

STATUS:
    STOP — 3º BLOQUEIO (função inexistente referenciada por REVOKE).
    AGUARDANDO NOVO GATE DO PO.
```

---

## Evidência do 3º bloqueio / decisão necessária do PO

**Bloqueio:** `20260808110000_revoke_anon_rpc_execute.sql` faz `REVOKE EXECUTE ON FUNCTION apply_plan_credit_to_comanda_item(...)` mas a função **não existe** no staging recriado, pois **nenhuma migration a cria** — ela existe em produção apenas via implantação pré-história (capturada em `docs/backups/backup_pre_migration_20260728_152717.sql`).

**Não foi feito (sem workaround, por mandato):**
- ❌ Nenhuma migration de correção criada.
- ❌ Nenhuma alteração em `20260808110000`.
- ❌ Nenhum `migration repair`.
- ❌ Nada em produção.

**Caminhos possíveis para o PO decidir (próximo gate):**
- **A)** Autorizar a recriação de `apply_plan_credit_to_comanda_item` (e funções/objetos ausentes do mesmo dump) via um seed/script de restauração **só-staging** antes de retomar o push — respeitando "não criar migration nova" (poderia ser um DDL executado diretamente no staging, não como migration) — **exige autorização**.
- **B)** Autorizar, se já existir, uma migration pendente/adicional que cria a função (verificar se há gap a corrigir formalmente no histórico) — **exige autorização** e revisão.
- **C)** Executar manualmente o `CREATE OR REPLACE FUNCTION` (do backup) diretamente no staging para destravar, **sem migration** — **exige autorização**.
- **D)** Reavaliar se a reprodução do schema de produção via CLI é o caminho correto para o staging, dado o histórico incompleto de migrations em produção.

**Recomendação técnica:** discutir com o PO **o gap de histório em produção** (funções de produção fora do controle de migrations). Para destravar o staging rapidamente, **A ou C** (restaurar o objeto ausente diretamente no staging, sem criar migration) é o caminho de menor impacto; ambas exigem autorização explícita.

**Nenhuma operação adicional foi executada após a falha. Produção intocada.**

---

# ADENDO — STAGING GATE 2.3 (Restauração Mínima + Retomada Controlada)

> **Gate:** FASE 2.3 (autorizada A+C pelo PO) · **Status:** ⛔ **STOP — NOVO BLOCKER / DEPENDÊNCIA HISTÓRICA**
> **Data:** 31/08/2026 · **Staging:** `tjcvuhynckocmvtqykxp` · **Produção:** `ushsnmlbeurfvlkieiln` (intocada)

## Escopo autorizado (A + C)

- **A)** Restaurar exclusivamente `apply_plan_credit_to_comanda_item(...)` (única dependência assumida) no staging, usando o backup como fonte.
- **C)** Documentar formalmente a lacuna do histórico de migrations.

Limites absolutos: **produção intocável; sem alterar migrations; sem repair; sem trabalho em produção; sem restauração automática de outras funções; sem cascata; sem novo gate = sem ampliação de escopo.**

## §4 Auditoria read-only — definição histórica da função (fonte: backup)

Obtida de `docs/backups/backup_pre_migration_20260728_152717.sql` (linhas 1456–1541):

```sql
CREATE OR REPLACE FUNCTION "public"."apply_plan_credit_to_comanda_item"(
  "p_tenant_id" uuid, "p_comanda_id" uuid, "p_comanda_item_id" uuid,
  "p_client_id" uuid, "p_service_id" uuid, "p_professional_id" uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public'
AS $$ ... $$;
ALTER FUNCTION ... OWNER TO "postgres";
```

| Atributo | Valor |
|---|---|
| **Assinatura** | `apply_plan_credit_to_comanda_item(uuid,uuid,uuid,uuid,uuid,uuid DEFAULT NULL) RETURNS jsonb` |
| **Parâmetros** | `p_tenant_id, p_comanda_id, p_comanda_item_id, p_client_id, p_service_id` (uuid) + `p_professional_id uuid DEFAULT NULL` |
| **Retorno** | `jsonb` (`jsonb_build_object` com `success`, `credit_usage_id`, `original_price`, `credit_key`, `service_name`, `plan_name`) |
| **Security** | `SECURITY DEFINER` |
| **LANGUAGE / search_path** | `plpgsql` / `SET search_path TO 'public'` (somente `public`, sem `auth`) |
| **Owner** | `postgres` |
| **Grants (backup, linhas 12202–12204)** | `GRANT ALL ... TO "anon"`, `"authenticated"`, `"service_role"` |
| **Tabelas usadas** | `comandas`, `comanda_items`, `customer_subscriptions`, `customer_plans`, `services`, `customer_credits`, `customer_plan_credit_usages` |
| **Funções utilitárias** | `jsonb_array_elements`, `jsonb_set`, `to_jsonb`, `auth.uid()` |
| **Lógica (resumo)** | valida comanda aberta → item não pago com crédito → assinatura ativa → serviço no plano → crédito do ciclo; decrementa `available`/incrementa `used` em `customer_credits`; insere `customer_plan_credit_usages`; zera `comanda_items.unit_price` e marca `paid_with_plan_credit` |

> A função é usada em produção, mas **não há migration que a crie** — é dívida histórica pré-migration, capturada apenas no dump acima.

## §5 Verificação da lacuna (read-only)

- `grep apply_plan_credit_to_comanda_item supabase/migrations/*.sql` → **1 única ocorrência**: `20260808110000_revoke_anon_rpc_execute.sql:14` (somente `REVOKE EXECUTE ... FROM anon`). **Nenhuma migration cria a função.**
- A migration que falha referencia a função diretamente na linha 14 (primeira de 60 `REVOKE`), via `REVOKE EXECUTE ON FUNCTION apply_plan_credit_to_comanda_item(uuid,uuid,uuid,uuid,uuid,uuid) FROM anon;` contra função inexistente → `ERROR 42883`.
- **Lacuna confirmada: SIM.**

## §6 Verificação no staging (read-only) — DESCOBERTA CRÍTICA

Consultas via `supabase db query --linked` (Management API) no staging `tjcvuhynckocmvtqykxp`:

1. `to_regprocedure('public.apply_plan_credit_to_comanda_item(uuid,uuid,uuid,uuid,uuid,uuid)')` → **`NULL`** (função NÃO existe) ✅ (base da autorização A).
2. Porém, verificação ampliada das **demais funções revogadas pela mesma migration** (`20260808110000`) mostrou que **13 funções adicionais TAMBÉM estão AUSENTES** do schema `public` do staging:

| # | Função ausente no staging (`public`) |
|---|---|
| 2 | `cancel_customer_subscription` |
| 3 | `create_customer_subscription_with_credits` |
| 4 | `current_tenant_id_managers` |
| 5 | `get_credit_usage_history` |
| 6 | `get_current_subscription_credits` |
| 7 | `get_customer_plan_status` |
| 8 | `pause_customer_subscription` |
| 9 | `pick_barber_runtime_schema` |
| 10 | `reactivate_customer_subscription` |
| 11 | `renew_subscription_cycle` |
| 12 | `set_tenant_id_from_context` |
| 13 | `set_updated_at_managers` |
| 14 | `touch_user_tenants_updated_at` |

> **Total:** a migration `20260808110000` referencia **14 funções ausentes** no staging (1 autorizada + 13 descobertas). Mesmo restaurando apenas `apply_plan_credit_to_comanda_item`, a migration **falharia imediatamente em seguida** na próxima função ausente (ex.: `cancel_customer_subscription`, linha 18). Funções de referência (`apply_subscription_transition`, `cancel_subscription`) **existem** — confirmando que a lacuna é seletiva, não total.

## §7 Decisão de escopo — NOVO BLOCKER / DEPENDÊNCIA HISTÓRICA

A autorização cobria **somente** `apply_plan_credit_to_comanda_item`. A auditoria provou **13 dependências históricas adicionais** ausentes. Per §7 do gate:

> "Se forem descobertas outras dependências históricas: **NÃO restaurá-las automaticamente**. Documentar `NOVO BLOCKER / DEPENDÊNCIA HISTÓRICA` e executar **STOP**. Nesse caso, será necessário **novo gate do PO** para ampliar o escopo."

**Condução:** **restauração NÃO executada** (sem `$8`), **migrations NÃO retomadas** (sem `$10`), **STOP imediato**. Nenhum objeto foi restaurado automaticamente; nenhuma cascata executada. Produção intacta. Nenhuma migration alterada. Nenhum repair.

## Impacto

- O schema do staging permanece **incompleto** (parado em `20260808000000`; `20260808110000`+ pendentes), sem estruturas D8/M1–M4.
- Evidência reforçada de **dívida de migrations**: múltiplas funções históricas de produção (não apenas uma) estão fora do controle de migrations e impedem a reprodução limpa do schema.
- Reconciliação administrativa (marcar migrations como aplicadas) permanece **proibida** (`§13`).

## Preciso de novo gate do PO

Para destravar a reprodução do schema, o PO precisa decidir **ampliar o escopo** de restauração mínima. Opções (todas exigem autorização e permanecem **sem alteração de migration**):

- **A'** — Autorizar a restauração **das 14 funções ausentes** (a partir do mesmo dump de backup) diretamente no staging, como passo SÓ-staging antes de retomar o push.
- **B'** — Autorizar auditoria de todas as funções/objetos do dump que não têm correspondência em migrations, para mapear a lacuna completa antes de decidir.
- **C'** — Autorizar um saneamento formal do histórico (aligning migrations ↔ produção), em gate separado, antes de prosseguir com o staging.

**Recomendação técnica:** **B'** primeiro (mapear a lacuna completa de funções/objetos fora de migrations), pois a descoberta de 14 funções ausentes sugere que pode haver **outras lacunas ainda não visíveis** até o `db push` alcançá-las. Em seguida **A'** (restaurar o conjunto mínimo mapeado) ou **C'** (saneamento do histórico), conforme decisão do PO.

**Nenhuma operação adicional executada após o STOP. Produção intacta; nenhuma migration alterada; nenhum repair; nenhum commit/push/deploy.**
