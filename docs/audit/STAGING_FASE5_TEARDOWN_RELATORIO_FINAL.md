# STAGING GATE — FASE 5 · Relatório de Teardown (Restauração Pré-Homologação)

> **Gate:** STAGING GATE · **Fase:** 5 (teardown destrutivo dos dados sintéticos + repair F4-1)
> **Status:** ✅ **CONCLUÍDO** — staging restaurado ao estado pré-homologação (22 tabelas verificadas = 0); F4-1 resolvido (migration `20260901120000` registrada); produção intocada. Próxima etapa: FASE 6 (relatório consolidado).
> **Data:** 02/09/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Staging:** `tjcvuhynckocmvtqykxp` · **Produção:** `ushsnmlbeurfvlkieiln` — **INTOCADA** (0 escritas)
> **Commit/Push:** da branch de trabalho · **Merge/Deploy:** NENHUM executado

---

## 1. Resumo Executivo

A FASE 5 foi aprovada pelo PO ("Abrir FASE 5 com F4-1 primeiro (Recomendado)") após a aprovação da FASE 4. Executou, **somente no staging** `tjcvuhynckocmvtqykxp`:

1. **F4-1 (repair rastreável):** a migration `20260901120000_seguranca_fix_bulk_close_comandas_with_credits` foi registrada em `supabase_migrations.schema_migrations` via INSERT no banco do staging (mesmo efeito do `supabase migration repair --status applied`, aplicado diretamente com o guard do projeto). Verificado: as 3 migrations `>= 20260901000000` presentes na tabela.
2. **Inventário real do escopo:** 25 tenants sintéticos (2 Homolog + 21 E2E + **2 GATE F11** que o inventário F4 não contabilizou) e 49 auth users sintéticos (42 `e2e-*@gmail.com` + 5 `@soumanager.test` + **2 `gate-f11-*@gmail.com`**). **Nenhum tenant/user real existia no staging.**
3. **Teardown em ordem reversa de dependências** (56 tabelas com `tenant_id` + tabelas user-scope): dependentes → tenants → `auth.users`, incluindo os usuários `gate-f11-*` residuais não cobertos pelos predicados da FASE 4.
4. **Resíduo de `audit_logs`:** 122 linhas órfãs (tenant_id referenciando tenants já inexistentes — a tabela não possui FK para `tenants`) foram removidas após o teardown.
5. **Verificação final:** **22 contadores = 0** (tenants, users, profiles, user_tenants, staff, clients, services, comandas, comanda_items, comanda_payments, appointments, corrections, comanda_unblock_audit, transactions, event_store, outbox_items, processed_operations, audit_logs, plan_change_requests, auth.identities, auth.sessions, storage.objects).

## 2. Autorização do PO (FASE 5)

O PO aprovou a abertura da FASE 5 com a prioridade **F4-1 primeiro** (operação destrutiva → aprovação formal registrada via question tool). Escopo autorizado: repair da migration `20260901120000` no staging + remoção completa dos dados sintéticos de homologação/E2E/GATE. Produção permanece **fora de escopo** — nenhuma escrita direcionada a `ushsnmlbeurfvlkieiln`.

## 3. Método e Guard de Ambiente

Todas as operações usaram o mesmo padrão validado na FASE 4:

```powershell
$token = (Select-String -Path ".env.local" -Pattern '^SUPABASE_ACCESS_TOKEN=(.*)$').Matches.Groups[1].Value.Trim()
$env:SUPABASE_ACCESS_TOKEN = $token
supabase db query --linked --project-ref tjcvuhynckocmvtqykxp "<sql>"
```

- A CLI está linkada à **produção** (`supabase/.temp/project-ref` = `ushsnmlbeurfvlkieiln`); o `--linked --project-ref` explícito direciona cada operação ao staging.
- `--project-ref` sem `--linked` falha estruturalmente (`LegacyDbQueryMutuallyExclusiveFlagsError`).
- Scripts executados via `--file` (evita quebra de argumentos multilinha no PowerShell).
- **Nenhuma** query/comando foi executado sem o guard do staging; produção inacessível por construção.

## 4. F4-1 — Migration Repair (rastreabilidade)

**Sql executado (staging):**

```sql
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20260901120000', 'seguranca_fix_bulk_close_comandas_with_credits', '{}');
```

**Verificação pós-insert** (`version >= '20260901000000'`):

| Version | Name |
|---|---|
| `20260901120000` | `seguranca_fix_bulk_close_comandas_with_credits` ✅ (registrada) |
| `20260901150000` | `fix_rpc_tenant_scoped_authorization` |
| `20260901160100` | `fix_confirm_appointment_attendance_tenant_scoped` |

O baseline de migrations do staging agora reproduz a função hardenada de forma rastreável, fechando o risk R1 da FASE 4. Nota: a `20260831120000` e as migrations M4 (`20260830xxxx`) já estavam registradas; nenhuma outra alteração de registry foi feita.

## 5. Inventário Real — Escopo Deletado

Levantamento direto no staging antes da deleção:

| Objeto | F4 (subcontado) | Real (F5) | Predicado |
|---|---|---|---|
| Tenants sintéticos | 23 | **25** | `name LIKE 'E2E%' / 'Homolog%' / 'GATE%'` |
| Auth users `e2e-*@gmail.com` | 42 | 42 | `email LIKE 'e2e-%@gmail.com'` |
| Auth users `@soumanager.test` | 5 | 5 | `email LIKE '%@soumanager.test'` |
| Auth users `gate-f11-*@gmail.com` | não listado | **2** | `email LIKE 'gate-f11-%@gmail.com'` |
| Tenants reais | — | **0** | nenhum nome fora dos padrões sintéticos |

> Os 2 tenants `GATE F11 A/B` (criados em 2026-09-02 06:28) e os 2 users `gate-f11-*` correspondentes foram gerados pelo run do gate (GATE F11) e não constavam no inventário residual da FASE 4 (predicado `E2E%`/`Homolog%`). Foram incluídos para não deixar resíduo.

## 6. Ordem de Deleção (grafo de dependências)

Mapeado via `pg_constraint` (FKs para `tenants`, `auth.users`, `profiles`, `clients`, `staff`, `comandas`, `appointments`) + `information_schema.columns` (56 tabelas com `tenant_id`):

1. **Filhos tenant/user-scope** (ordem reversa de FK): `comanda_items`, `comanda_payments`, `comanda_unblock_audit`, `appointment_attendance_corrections`, `service_execution_participants`, `customer_*` (plan_credit_usages, receivables, vouchers, credits, subscriptions, plans), `financial_reversals`, `inventory_movements`, `commission_records`, `transactions`, `cash_closing_events`, `cash_closings`, `barber_closings`, `billing_events`, `invoices`, `payment_attempts`, `subscriptions`, `kiosk_*`, `otp_requests`, `feedback_*`, `notifications`, `notification_preferences`, `portal_sessions`, `schedule_blocks`, `event_store`, `processed_operations`, `outbox_items`, `audit_logs`, `role_permissions*`, `support_tickets`, `team_invitations`, `tenant_addons/goals/settings`, `feature_flags`, `promotions`, `products`, `purchase_orders`, `suppliers`, `services`, `appointments`, `comandas`, `staff`, `clients`, `user_tenants`, `profiles`.
2. **User-scope sem tenant:** `plan_change_requests`.
3. **Tenants sintéticos** (25).
4. **Auth users sintéticos** (49 — cascade em `auth.identities`, `auth.sessions`, etc.).

**Ajuste de tipo:** `event_store`, `outbox_items` e `processed_operations` possuem `tenant_id` **text** (não uuid) — o delete usou `id::text` para casar com `tenants.id`. Demais tabelas comparam uuid nativo.

**Confirmação de não-bloqueio:** um DELETE-teste em `appointment_attendance_corrections` (tenant Homolog A) executou sem erro — nenhuma trigger de DELETE exige `auth.uid()` (diferente das triggers de INSERT mapeadas na FASE 3).

## 7. Resíduo `audit_logs` (122 linhas órfãs)

Após o teardown das 25 tenants, restaram **122 linhas** em `audit_logs` com `tenant_id` **não nulo** apontando para tenants que **não existem** (a tabela não tem FK para `tenants`; as linhas eram de runs de fases anteriores cujos tenants já haviam sido removidos). Como o estado-alvo é pré-homologação e não existe tenant legítimo no staging, o resíduo órfão foi removido (`delete from public.audit_logs`). **`audit_logs` final = 0.**

## 8. Verificação Final Pós-Teardown

Query consolidada (22 contadores, staging):

| Tabela | Contagem | Tabela | Contagem |
|---|---|---|---|
| tenants | **0** | transactions | **0** |
| auth.users | **0** | event_store | **0** |
| profiles | **0** | outbox_items | **0** |
| user_tenants | **0** | processed_operations | **0** |
| staff | **0** | audit_logs | **0** |
| clients | **0** | plan_change_requests | **0** |
| services | **0** | auth.identities | **0** |
| comandas | **0** | auth.sessions | **0** |
| comanda_items | **0** | storage.objects | **0** |
| comanda_payments | **0** | correction_appointments | **0** |
| appointments | **0** | comanda_unblock_audit | **0** |

**Resultado: staging no estado pré-homologação** — nenhum tenant, nenhum user, nenhum dado de negócio residual. Produção `ushsnmlbeurfvlkieiln` intocada (nenhuma operação sem guard; 0 escritas).

## 9. Riscos e Mitigações

- **R1 (F4-1):** **resolvido** — migration `20260901120000` registrada e verificada (seção 4).
- **R2 (destrutivo):** teardown autorizado formalmente pelo PO; ordem reversa de dependências; verificação all-zero pós-operação.
- **R3 (produção):** todos os comandos com `--linked --project-ref tjcvuhynckocmvtqykxp`; nenhum `--linked` puro; nenhum comando sem o token do `.env.local`.
- **R4 (escopo residual):** predicado ampliado em relação ao F4 (`GATE F11` incluso) para evitar resíduo não inventariado — 0 restante.

## 10. Critérios de Saída — FASE 5

- [x] F4-1: `20260901120000` registrada no `schema_migrations` do staging (verificado)
- [x] Grafo de FKs mapeado (56 tabelas tenant-scope + user-scope) e ordem de deleção respeitada
- [x] Dependências deletadas em ordem reversa (0 órfãos em qualquer tabela)
- [x] 25 tenants sintéticos removidos (0 restantes; nenhum tenant real existia)
- [x] 49 auth users sintéticos removidos (`e2e-*` + `@soumanager.test` + `gate-f11-*`; 0 restantes)
- [x] Resíduo órfão `audit_logs` removido (0)
- [x] Verificação all-zero (22 tabelas) — staging pré-homologação
- [x] Produção intocada

## GATE FINAL

**FASE 5 CONCLUÍDA.** O staging `tjcvuhynckocmvtqykxp` foi restaurado ao estado pré-homologação: 22/22 tabelas verificadas zeradas, F4-1 fechado com a migration registrada, e nenhuma alteração em produção. O gate está pronto para a **FASE 6** (relatório consolidado do STAGING GATE: F1.1/F3.1 25/25 PASS + FASE 3 homologação + GATE1/2 + ADR-021 + FASE 4 auditoria + FASE 5 teardown) para apresentação ao PO.