# STAGING GATE — FASE 4 · Relatório de Auditoria Pós-Teste (Estado Persistido)

> **Gate:** STAGING GATE · **Fase:** 4 (auditoria read-only do estado persistido após FASE 3 + ADR-021 + GATE1/2 + F1.1/F3.1)
> **Status:** ✅ **APROVADO** — estado persistido íntegro e consistente com os relatórios de homologação; **1 finding de rastreabilidade** (schema-drift da migration `20260901120000`, sem impacto funcional/security). Próxima etapa: FASE 5 (teardown) — requer aprovação do PO.
> **Data:** 02/09/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Staging:** `tjcvuhynckocmvtqykxp` · **Produção:** `ushsnmlbeurfvlkieiln` — **INTOCADA** (0 escritas)
> **Commit/Push:** da branch de trabalho · **Merge/Deploy:** NENHUM executado

---

## 1. Resumo Executivo

A FASE 4 foi aprovada pelo PO ("Abrir FASE 4 auditoria pós-teste") como continuação do plano STAGING GATE, após o encerramento do capítulo F1.1/F3.1 (25/25 E2E PASS). A auditoria foi **100% read-only** no staging `tjcvuhynckocmvtqykxp`:

- **Guard de ambiente:** a CLI Supabase linka por padrão à **PRODUÇÃO** (`supabase/.temp/project-ref` = `ushsnmlbeurfvlkieiln`). Toda query usou `--linked --project-ref tjcvuhynckocmvtqykxp` com token de `.env.local`; **nunca** `--linked` puro. Nenhuma escrita, nenhuma migration, nenhuma alteração.
- **Migrations de fix:** 3 registradas no `schema_migrations` (`20260831120000` admin, `20260901150000` P4/P7, `20260901160100` P5). A `20260901120000` (with_credits) **não está registrada**, porém a função no banco **já está hardenada** — *FINDING F4-1* (rastreabilidade, sem impacto de segurança).
- **Dados sintéticos FASE 2/3:** íntegros — 2 tenants, 5 auth users `@soumanager.test`, 5 profiles, 5 user_tenants, 4 staff.
- **Tabelas financeiras:** comandas A/B intactas (`open`); 1 pagamento válido na comanda A (R$20 `homolog-p7-2`), 0 na comanda B; artefatos cross-tenant da FASE 3 revertidos (incl. `homolog-p7-x` R$30 pix revertido); `transactions` = 0; correções append-only A=4/B=3 (confere com ADR-021 §8).
- **Isolamento cross-tenant:** 0 pagamentos órfãos, 0 appointments órfãos, comanda B `open` (fixture) — **zero vazamento** persistente.
- **RPCs fixadas:** as 5 RPCs críticas verificadas **no banco** com guards tenant-scoped (`current_tenant_id_from_auth_uid()` + `v_membership_role` + superadmin bypass) — nenhuma global-first.
- **Inventário residual (escopo da FASE 5):** 23 tenants sintéticos, 42 users `e2e-*@gmail.com` + 5 `@soumanager.test`, 6 profiles, 6 user_tenants, 6 staff — **todos os tenants E2E com 0 dados**.

## 2. Autorização do PO (FASE 4)

O PO decidiu abrir a FASE 4 auditoria pós-teste a partir do plano geral do STAGING GATE. Escopo autorizado: **leitura exclusiva** no staging; produção intocada; nenhuma migration; nenhum teardown (FASE 5 será proposta à parte e depende de nova aprovação).

## 3. Método e Guard de Ambiente

**Comando padrão usado em todas as verificações:**

```powershell
$token = (Select-String -Path ".env.local" -Pattern '^SUPABASE_ACCESS_TOKEN=(.*)$').Matches.Groups[1].Value.Trim()
$env:SUPABASE_ACCESS_TOKEN = $token
supabase db query --linked --project-ref tjcvuhynckocmvtqykxp "<sql somente SELECT>"
```

- `--linked --project-ref` explícito redireciona a query ao staging mesmo com o CLI linkado à produção.
- `--project-ref` **sem** `--linked` falha (`LegacyDbQueryMutuallyExclusiveFlagsError`) — guard estrutural do próprio CLI.
- 100% SELECT (catálogo `pg_proc`/`pg_namespace` + tabelas de dados). Nenhuma instrução DML/DDL executada.

## 4. Verificação de Migrations (staging)

Migrações registradas em `supabase_migrations.schema_migrations` (14):

| Version | Nome |
|---|---|
| `20260827120000` | `d8_worker_rpc_surface` |
| `20260827210000` | `d8_worker_schedule` |
| `20260828000000` | `d8_worker_retry_dead_letter` |
| `20260829000000` | `attended_at` |
| `20260829010000` | `payment_type_enum` |
| `20260829020000` | `comanda_payments` |
| `20260830000000` | `m4_p1_reverse_comanda_payment` |
| `20260830010000` | `m4_p4_p5_attendance_rpcs` |
| `20260830020000` | `m4_p6_unblock_comanda` |
| `20260830030000` | `m4_p7_register_comanda_payment` |
| `20260830040000` | `m4_p8_tenant_refund_method` |
| `20260831120000` | `seguranca_fix_bulk_close_comandas_admin` |
| `20260901150000` | `fix_rpc_tenant_scoped_authorization` |
| `20260901160100` | `fix_confirm_appointment_attendance_tenant_scoped` |

### FINDING F4-1 — semantic drift: migration `20260901120000` fora do registry

- `supabase/migrations/20260901120000_seguranca_fix_bulk_close_comandas_with_credits.sql` **existe e está commitada** (`df6d877` / `683bf82` — "fix(security): harden bulk close with credits authorization (F1.4)").
- **Não consta** no `schema_migrations` do staging (query `>= '20260901000000'` retorna apenas `20260901150000` e `20260901160100`).
- Porém o `pg_get_functiondef` de `bulk_close_comandas_with_credits` no staging **contém os guards tenant-scoped** (auth.uid obrigatório, `current_tenant_id_from_auth_uid`, `current_is_super_admin_from_auth_uid`, checagem de membership, validação IDOR fail-closed §7b e consumo de créditos filtrado por tenant) — ou seja, **a função foi transplantada no banco sem registro de migration** (padrão do workstream F1.1/F3.1 nos outros fixes, mas sem o `migration repair`).
- **Impacto:** zero funcional/security (função hardenada presente e verificada). **Risco rastreado:** baseline de migrations do staging não reproduz a função de forma rastreável a partir do histórico; e o E2E h6-6 (13/13 PASS) já validou essa função hardenada.
- **Recomendação (decisão PO, não executada):** registrar a migration como aplicada no staging (`supabase migration repair --status applied --version 20260901120000`, com o link correto do projeto) **antes** do teardown da FASE 5, para que o baseline pós-gate seja fiel ao código.

## 5. Dados Sintéticos Pós-Teste (seeds FASE 2/3)

| Objeto | Contagem | Observação |
|---|---|---|
| Tenants homolog | 2 | A (`aaaa...001`), B (`bbbb...002`) — íntegros |
| Auth users `@soumanager.test` | 5 | 4 da FASE 3 + 1 superadmin de auditoria |
| Profiles | 5 | 1 por user |
| User_tenants | 5 | 1 por user |
| Staff | 4 | equipe de homologação |

Nenhum seed removido ou alterado durante as fases de homologação — **0 órfãos**.

## 6. Tabelas Financeiras Pós-Teste

| Verificação | Resultado | Confere com |
|---|---|---|
| Comanda A `aaaa...c001` | `open`, total 120 | FASE 3 §4 |
| Comanda B `bbbb...c001` | `open`, total 70 | FASE 3 §4 |
| Pagamentos **válidos** comanda A | **1**: R$20 `dinheiro`/`antecipado`, idempotency `homolog-p7-2` (`23a68fb6-...`) | ADR-021 (§7: total_paid=20/remaining=100) |
| Pagamentos **válidos** comanda B | **0** (todas as linhas `reversed_at` preenchido) | ADR-021 / GATE2 |
| Artefato do finding P7.7 | `homolog-p7-x` R$30 pix (`4233fdb1-...`) **revertido** em 2026-09-01T19:51:25 | FASE 3 §7.7 cleanup |
| Artefatos re-homologação | `rehomolog-p7-*` / `rehomolog-sa1-*` — todos `reversed_at` setados | ADR-021 §7 |
| `transactions` (tenants homolog) | **0** | não há resíduo financeiro de reversões |
| `appointment_attendance_corrections` | tenant A = **4**, tenant B = **3** (append-only) | ADR-021 §8 |

## 7. Isolamento Cross-Tenant Pós-Teste

| Verificação | Resultado |
|---|---|
| `orphan_payments` (pagamento p/ comanda inexistente ou tenant divergente) | 0 |
| `appts_orphan_tenant` (appointment órfão) | 0 |
| Comanda aberta no tenant B | 1 (fixture `bbbb...c001`) |
| Tenants E2E (F1.1/F3.1) com dados (`E2E F14/SEC A/B/OPS *`) | **todos 0** (appts/comandas/clients/pays) |
| Correção cross-tenant persistente | **nenhuma** — artefatos P4/P7 da FASE 3 foram revertidos/restaurados (append-only preservado) |

**Conclusão: zero vazamento cross-tenant persistente após o ciclo completo.**

## 8. RPCs Fixadas — Verificação no Banco

`pg_get_functiondef` das 5 RPCs críticas (padrão `v_membership_role` + `current_tenant_id_from_auth_uid()`):

| RPC | Guard no banco | Nota |
|---|---|---|
| `bulk_close_comandas_admin` | ✅ TENANT-SCOPED | fix `20260831120000` |
| `bulk_close_comandas_with_credits` | ✅ TENANT-SCOPED (IDOR fail-closed §7b) | função hardenada presente — ver F4-1 |
| `confirm_appointment_attendance` | ✅ TENANT-SCOPED | fix `20260901160100` |
| `correct_appointment_attendance` | ✅ TENANT-SCOPED | fix `20260901150000` |
| `register_comanda_payment` | ✅ TENANT-SCOPED | fix `20260901150000` |

Nenhuma RPC global-first. Confere com a matriz F1.1/F3.1 (25/25 E2E PASS) e ADR-021.

## 9. Inventário Residual — Escopo da FASE 5 (Teardown)

| Objeto | Contagem | Fonte |
|---|---|---|
| Tenants sintéticos (`E2E%` / `Homolog%`) | **23** (2 homolog + 21 E2E de ~7 runs) | `tenants` |
| Auth users `e2e-*@gmail.com` | **42** | `auth.users` |
| Auth users `@soumanager.test` | **5** | `auth.users` |
| Profiles (E2E) | 6 | `profiles` |
| User_tenants (E2E) | 6 | `user_tenants` |
| Staff (E2E) | 6 | `staff` |
| Dados de negócio nos tenants E2E | **0** em todos | appts/comandas/clients/pays |

> Os users/profiles E2E residuais são os que sobraram de runs interrompidos ou cujo teardown do spec falhou ("left for operator cleanup" — `test.afterAll` do h6-5). A FASE 5 deve remover tenants sintéticos + users `e2e-*` + objectos associados.

## 10. Riscos

- **R1 (F4-1):** baseline de migrations do staging não reflete a função `bulk_close_comandas_with_credits` hardenada no histórico registrado — mitigado pelo `migration repair` proposto na FASE 5.
- **R2:** teardown é **destrutivo** — será executado somente com autorização formal do PO, em ordem reversa de dependências (user_tenants → staff/profiles → users → tenants → payments/appointments/comandas → transactions/event_store se aplicável).
- **R3:** qualquer escrita acidental em produção invalida o gate — toda FASE 5 operará com o mesmo guard `--linked --project-ref` e token de `.env.local`.

## 11. Critérios de Saída — FASE 4

- [x] Auditoria documental dos relatórios GATE1/GATE2/ADR-021/FASE3 (pré-auditoria)
- [x] Estado financeiro consistente pós-teste (comandas, pagamentos, reversões, `transactions`=0)
- [x] Isolamento cross-tenant verificado (0 órfãos, 0 vazamento persistente, tenants E2E vazios)
- [x] RPCs fixadas com guards tenant-scoped confirmados no banco (5/5)
- [x] Inventário residual mapeado e dimensionado para a FASE 5
- [x] Produção intocada (0 escritas)
- [ ] (F4-1) Decisão PO sobre `migration repair` da `20260901120000` no staging — **recomendado antes do teardown**

## GATE FINAL

**FASE 4 APROVADA.** O estado persistido pós-teste está íntegro e consistente: correção de isolamento multi-tenant instalada em todas as RPCs críticas, artefatos de homologação revertidos com evidência append-only, e zero vazamento cross-tenant remanescente. O único ponto aberto é de rastreabilidade (`F4-1`), com recomendação de `migration repair` antes do teardown.

**Próxima etapa — FASE 5 (teardown):** remover os 23 tenants sintéticos, 42 users E2E + 5 de homologação, e objetos associados, restaurando o staging ao estado pré-homologação. **Requer aprovação explícita do PO** (operação destrutiva). Após o teardown, FASE 6 com o relatório consolidado do STAGING GATE.