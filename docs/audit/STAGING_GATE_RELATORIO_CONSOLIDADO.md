# STAGING GATE — Relatório Consolidado (FASE 6)

> **Gate:** STAGING GATE · **Fase:** 6 (Relatório Consolidado de Evidências)
> **Status:** ✅ **CONCLUÍDO** — consolidação das evidências das FASES 1–5 pronta para a decisão formal do PO (Sim/Não para a promoção).
> **Data:** 02/09/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Staging:** `tjcvuhynckocmvtqykxp` (`sou-manager-staging`) · **Produção:** `ushsnmlbeurfvlkieiln` — **INTOCADA** (0 escritas em todo o ciclo)
> **Commit/Push:** branch de trabalho `chore/seguranca-bulk-close-comandas-admin` · **Merge/Deploy em produção:** NENHUM executado

---

> ## ⚠ Aviso do PO (verbatim)
>
> **FASE 6 não é uma nova homologação. É a consolidação das evidências já produzidas pelas FASES 1–5.**
>
> FASE 6 é exclusivamente documental/auditiva — sem novas mutações no staging e sem tocar em produção. O entregável é este relatório, com o qual o PO responde, de forma binária:
>
> - **"Sim, as evidências são suficientes para aprovar a promoção."**
> - **"Não, existe esta pendência específica."**

---

## 1. Sumário Executivo

O STAGING GATE homologou, em ambiente Supabase **isolado** (`tjcvuhynckocmvtqykxp`), o fechamento da classe de vulnerabilidade **CRÍTICA de isolamento multi-tenant** nas RPCs `SECURITY DEFINER` do fluxo financeiro/de agendamento, com todas as correções **instaladas no banco do staging, re-homologadas com prova zero-write cross-tenant e auditoria pós-teste do estado persistido**. O ciclo terminou com o **teardown completo**: staging restaurado ao estado pré-homologação (22/22 contadores = 0) e **produção intocada**.

**Números do ciclo:**

| Fase | Resultado-chave |
|---|---|
| **F1.1/F3.1** (capítulo encerrado) | Fix de `bulk_close_comandas_admin`/`with_credits` + **matriz E2E 25/25 PASS** (h6-5: 12 cenários SEC; h6-6: 13/13) |
| **FASE 1** (read-only) | Auditoria de ambiente: **nenhum staging existia**; produção identificada e mapeada; plano de provisionamento documentado |
| **FASE 2** (provisionamento) | Staging `tjcvuhynckocmvtqykxp` criado (região isolada `us-west-1`) · 3 bloqueios históricos de migrations documentados (BOM, versões órfãs, **14 funções de produção fora do controle de migrations**) |
| **FASE 3** (homologação P4/P5/P7) | Matriz **16/18 PASS · 2 FAIL** — escrita cross-tenant real comprovada no banco (P4.x, P7.7) → **FINDING CRÍTICO** |
| **ADR-021** (fix P4/P7) | Migration `20260901150000` + **re-homologação 20/20 PASS** (P4 5/5 · P7 7/7 · superadmin 4/4) — zero-write provado |
| **GATE 1/GATE 2** (fix P5) | Auditoria CRITICAL de `confirm_appointment_attendance` → migration `20260901160100` + **matriz 15/15 PASS** — zero-write byte a byte |
| **FASE 4** (auditoria pós-teste) | 100% read-only · **APROVADA** — 5/5 RPCs tenant-scoped confirmadas no banco · zero vazamento · 1 finding de rastreabilidade (F4-1) |
| **FASE 5** (teardown) | Repair F4-1 + deleção de **25 tenants / 49 users** sintéticos + 122 órfãos de `audit_logs` · **22/22 contadores = 0** |

**Veredito das evidências:** a classe de vulnerabilidade que motivou o gate (autorização global-first → escrita cross-tenant) foi **provada, corrigida e re-homologada com prova de ausência de efeito persistente**, em todas as 5 RPCs críticas. Nenhum dado real existia no staging (0 tenants reais, 0 users reais). Nenhuma escrita ocorreu em produção em nenhuma fase.

---

## 2. F1.1/F3.1 — Hardening de `bulk_close_comandas_admin` + Matriz E2E (capítulo ENCERRADO)

> Fonte: `docs/security/SECURITY_AUDIT_RPC.md` (§ F1.1/F3.1) · `docs/audit/STAGING_FASE4_AUDITORIA_POS_TESTE_RELATORIO_FINAL.md` (§4, §7, §8) · SECURITY_AUDIT RLS/RPC

### 2.1 Achado e correção no código

- **Achado CRÍTICO (Security Audit):** `bulk_close_comandas_admin()` autorizava usando a função legada `get_current_tenant_id()` — quebra de isolamento multi-tenant em operação de fechamento em lote.
- **Fix no código (branch `chore/seguranca-bulk-close-comandas-admin`, commit `983c5bc`):** substituição do legado por resolução explícita `auth.uid()` → tenant/superadmin/role/membership + **validação de pertencimento de ID** (barreira fail-closed de lote misto A+B). IPCA da função `bulk_close_comandas_with_credits` (F1.4, commits `df6d877`/`683bf82`) recebeu os mesmos guards, com **IDOR fail-closed §7b** e consumo de créditos filtrado por tenant.

### 2.2 Migrations (registradas no staging)

| Migration | Função-alvo | Registro no staging |
|---|---|---|
| `20260831120000_seguranca_fix_bulk_close_comandas_admin.sql` | `bulk_close_comandas_admin` | ✅ desde a FASE 4 |
| `20260901120000_seguranca_fix_bulk_close_comandas_with_credits.sql` | `bulk_close_comandas_with_credits` | ✅ **registrada na FASE 5** (repair F4-1) — função hardenada já presente no banco |

### 2.3 Matriz E2E (25/25 PASS)

- `tests/e2e/homologation/h6-5-bulk-close-comandas-admin.spec.ts` — **12 cenários SEC-1..SEC-12** + demais cenários da matriz de segurança E2E (**25/25 PASS** no total do capítulo).
- `tests/e2e/...h6-6` — **13/13 PASS** validando `bulk_close_comandas_with_credits` hardenada.
- Tenants E2E do capítulo (`E2E F14/SEC A/B/OPS *`) verificados na FASE 4: **todos com 0 dados** (appts/comandas/clients/pays).

### 2.4 Status

✅ **Capítulo F1.1/F3.1 formalmente encerrado pelo PO** antes da FASE 4. Produção intocada.

---

## 3. FASE 1 — Auditoria READ-ONLY (ambiente)

> Fonte: `docs/audit/STAGING_FASE1_READONLY_RELATORIO_FINAL.md`

| Questão | Resposta com evidência |
|---|---|
| Q1/Q2 — Existe staging isolado? | **NÃO.** Projetos acessíveis: produção `ushsnmlbeurfvlkieiln` (único linkado, dados reais), `rvpmaqoqrorcbxxnqpjo` (sanchez-barber, tenant real) e `krcerrmflfeetlbrwnxd` (supabase-beige-flame, org Vercel autônoma). Nenhum é staging deste repo. |
| Q3 — Permissão de provisionamento? | Leitura ✅ (CLI autenticada na org); criação **não** testada (exigiria escrita, proibida na fase). |
| Q4/Q5 — Migrations | 131 arquivos versionados + 7 utilitários; `config.toml`/`seed.sql`/`env.example` **ausentes**; cadeias D8→M1→M2→M3→M4 mapeadas como a sequência integral necessária para reproduzir o schema. |
| Q6 — Env vars | Mapeadas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` p/ E2E); regra: **nunca** copiar credenciais de produção; worker D8 fora do escopo inicial (bloqueador `EDGE_JWT_SECRET` documentado). |
| Q7 — Plano de dados sintéticos | 2 tenants + manager/receptionist/barber + appointments completed/in_progress + comanda open — para provar isolamento. |
| FASE 1.5 — Estratégia de isolamento | 7 requisitos documentados (frontend→staging, sem credencial de produção, guard de ref, nomes claros, teardown, impedir mistura de tenants, descarte). |

**GATE FINAL FASE 1:** `STOP — AGUARDANDO APROVAÇÃO DO PO`. Nenhuma escrita executada.

---

## 4. FASE 2 — Provisionamento do Staging (3 bloqueios históricos)

> Fonte: `docs/audit/STAGING_FASE2_PROVISIONAMENTO_RELATORIO_FINAL.md` (+ ADENDO 2.3)

| Item | Resultado |
|---|---|
| Staging criado | `sou-manager-staging` / `tjcvuhynckocmvtqykxp`, **região `us-west-1`** (isolamento físico do cluster de produção `us-west-2` — defesa em profundidade) |
| Staging antigo | `uvohhixqnwxkfwvwgpjy` **removido** |
| Separação | `linked-project.json` = staging novo; produção **nunca linkada**; 0 escritas em produção |
| Migrations | Aplicadas desde o início em projeto vazio |

**Bloqueios encontrados (todos documentados, nenhum contornado automaticamente):**
1. **UTF-8 BOM** em `20260806050000` — única alteração autorizada (BOM removido, sem lógica alterada); aplicado sem erro na recriação.
2. **Versões órfãs** `20260420/28`, `20260501/02` — eliminadas via recriação (Opção C do PO).
3. **14 funções de produção fora do controle de migrations** (`20260808110000_revoke_anon_rpc_execute.sql` referencia 14 funções que **nenhuma migration cria**; existem em produção por implantação pré-história, capturadas no dump `docs/backups/backup_pre_migration_20260728_152717.sql`). **Lacuna histórica documentada** como dívida de migrations; restauração exigiu **novo gate do PO** (escopo 2.3).

**Status:** schema do staging destravado e reproduzido integralmente (evidenciado pelas FASE 3/4 com as RPCs M4 e D8 presentes). Nenhum commit/push/merge/deploy; produção intocada.

---

## 5. FASE 3 — Homologação P4/P5/P7 (encontrou o FINDING CRÍTICO)

> Fonte: `docs/audit/STAGING_FASE3_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md`

### 5.1 Provisionamento (validado 4/4 no banco)

4 usuários sintéticos `@soumanager.test` (senha `Homolog-2026!`, só staging): manager A, barber A, receptionist A (tenant A `aaaa...001`) e manager B (tenant B `bbbb...002`) — `auth.users`/`profiles`/`user_tenants`/`staff` = 4/4, **0 órfãos**. Dados de teste criados **via sessão real** (comprovou-se que `INSERT` em `comandas` exige `auth.uid()`; service role é rejeitado).

### 5.2 Matriz

| Bloco | Resultado |
|---|---|
| **P5** `confirm_appointment_attendance` | **4/4 PASS** (happy · cancelled rejeitado · dupla confirmação rejeitada · cross-tenant com ator **barbeiro** rejeitado) |
| **P4** `correct_appointment_attendance` | **3/4 PASS + 1 FINDING** — P4.x: corrigir appointment do **tenant B** como manager A **ESCREVEU** no tenant B (appt B → completed + attended_at + linha append-only) |
| **P7** `register_comanda_payment` | **8/9 PASS + 1 FINDING** — P7.7: pagamento na comanda do **tenant B** como reception A **ESCREVEU R$30** em `comanda_payments` (tenant B) |

### 5.3 Causa-raiz (idêntica nas RPCs afetadas)

```sql
v_access_role     := (SELECT LOWER(BTRIM(COALESCE(role,''))) FROM public.profiles WHERE id = v_auth_uid); -- GLOBAL
v_membership_role := (SELECT role FROM public.user_tenants WHERE user_id = v_auth_uid AND tenant_id = p_tenant_id);
v_normalized_role := COALESCE(NULLIF(v_access_role,''), v_membership_role, '');
-- → papel GLOBAL vence; p_tenant_id arbitrário autoriza escrita cross-tenant
-- → o helper RLS current_tenant_id_from_auth_uid() NÃO é usado nos gates
```

### 5.4 Cleanup e evidência

Artefatos cross-tenant revertidos/restaurados via sessões legítimas (pagamento B revertido por manager B; appt B restaurado); **linhas append-only preservadas como trilha de auditoria**.

**GATE FINAL FASE 3:** `STOP — FINDING CRÍTICO DE ISOLAMENTO MULTI-TENANT. AGUARDANDO DECISÃO DO PO.` → PO escolheu **Opção A** (fix via ADR + migration, publicada como ADR-021).

---

## 6. ADR-021 — Fix P4/P7 + Re-Homologação 20/20 (FINDING FECHADO)

> Fonte: `docs/adr/ADR-021-rpc-tenant-scoped-authorization.md` · `docs/audit/STAGING_ADR021_REHOMOLOGACAO_P4_P7_RELATORIO_FINAL.md`

### 6.1 Artefatos

- **ADR-021** `docs/adr/ADR-021-rpc-tenant-scoped-authorization.md` (decisões D-1..D-5; registrado no índice `docs/adr/README.md`).
- **Migration** `20260901150000_fix_rpc_tenant_scoped_authorization.sql` — aplicada **somente no staging** (Management API + registro `applied`; **nunca** `db push`).

### 6.2 Padrão definitivo (aplicado)

```sql
v_normalized_role := COALESCE(
  NULLIF(v_membership_role, ''),                                   -- membership do tenant ALVO é a fonte primária
  CASE WHEN public.current_tenant_id_from_auth_uid() = p_tenant_id -- papel global SÓ no tenant canônico
       THEN NULLIF(v_access_role, '') ELSE NULL END,
  ''
);
```

- `correct_appointment_attendance` e `register_comanda_payment` corrigidas; exceção canônica **superadmin** (`current_is_super_admin_from_auth_uid()`) **preservada**; assinaturas/definer/search_path/grants/NOTIFY intactos (verificados via `pg_get_functiondef`).
- Perigo `NULL NOT IN (...)` eliminado (remoção da cláusula adicional de membership).

### 6.3 Re-homologação — 20/20 PASS (`test-results/rehomolog-adr-021-evidence.json`, run `2026-09-01T21:41:12Z`)

| Bloco | Resultado |
|---|---|
| **P4** | **5/5** — P4.x cross-tenant agora **DENY + ZERO-WRITE PROVADO** (appt B `before==after`; correções tenant B 2→2) |
| **P7** | **7/7** — P7.x DENY + zero-write provado; idempotência (0 duplicata); summary; reversal; overpay DENY |
| **SA superadmin** | **4/4** — bypass canônico **PRESERVADO** (SA-1 correção cross-tenant, SA-2 pagamento cross-tenant, SA-3 reversal) |

### 6.4 Testes técnicos

`vitest run src/lib/finance/attendance.test.ts payment.test.ts` → **17/17 PASS** · typecheck do escopo limpo · `git diff --check` limpo · erros `tsc` pré-existentes fora do escopo documentados (outros workstreams, nada em `src/lib/finance/`).

**GATE FINAL ADR-021:** *FINDING (classe P4/P7) FECHADO com evidência completa. Produção intocada; nada commitado/pusheado/mergeado/deployado.*

---

## 7. GATE 1 / GATE 2 — `confirm_appointment_attendance` (P5 · classe latente fechada)

> Fonte: `docs/audit/GATE1_AUDITORIA_CONFIRM_APPOINTMENT_ATTENDANCE.md` · `docs/audit/GATE2_CORRECAO_CONFIRM_APPOINTMENT_ATTENDANCE_RELATORIO_FINAL.md`

### 7.1 GATE 1 — Auditoria read-only (VERDICT: CRITICAL)

- `confirm_appointment_attendance` usava o padrão global-first **verbatim** da classe já corrigida: gates de **gestão** e **recepção** autorizavam por `profiles/staff.role` global → escrita cross-tenant possível (`UPDATE appointments` em `tenant_id = p_tenant_id` arbitrário). Único gate seguro: **barbeiro** (tenant-scoped por construção — por isso a FASE 3 registrou P5 4/4 com ator barbeiro).
- Confirmado **live** no staging via `pg_get_functiondef` (idêntica à migration `20260830010000`); nenhuma alteração executada (mandato read-only); risco documentado no ADR-021 D-4.

### 7.2 GATE 2 — Correção + Re-Homologação 15/15 PASS

- **Migration** `20260901160100_fix_confirm_appointment_attendance_tenant_scoped.sql` (nova, aditiva) — aplicada **staging-only**; gates gestão/recepção → fórmula ADR-021 (membership-first, global só no tenant canônico) · gate **barbeiro preservado intacto** · **superadmin preservado** · regras funcionais inalteradas.
- Verificação live pós-aplicação: `pg_get_functiondef` — padrão global-first **não existe mais**.
- **Matriz 15/15 PASS** (`test-results/rehomolog-confirm-evidence.json`): barbeiro próprio/alheio/cross-tenant, gestão same-tenant ALLOW, **gestão cross-tenant DENY + ZERO-WRITE**, recepção same-tenant ALLOW, **recepção cross-tenant DENY + ZERO-WRITE**, sem autorização DENY, duplicado/cancelled erros intactos, **SA-1 superadmin cross-tenant ALLOW (bypass preservado)**, appt B restaurado byte a byte.
- Testes: 17/17 unit · build PASS · typecheck do escopo limpo · `git diff --check` limpo.
- **Fechou a pendência D-4 do ADR-021** (latente → RESOLVIDO).

**Status:** ✅ CORRIGIDO E RE-HOMOLOGADO (staging). Produção intocada.

---

## 8. FASE 4 — Auditoria Pós-Teste (estado persistido)

> Fonte: `docs/audit/STAGING_FASE4_AUDITORIA_POS_TESTE_RELATORIO_FINAL.md`

- **100% read-only** com guard de ambiente (token de `.env.local` + `--linked --project-ref tjcvuhynckocmvtqykxp`; `--linked` puro nunca — CLI linkada à produção).
- **RPCs fixadas confirmadas no banco (5/5)**: `bulk_close_comandas_admin` ✅ · `bulk_close_comandas_with_credits` ✅ (IDOR fail-closed §7b) · `confirm_appointment_attendance` ✅ · `correct_appointment_attendance` ✅ · `register_comanda_payment` ✅ — **nenhuma global-first**. Confere com a matriz F1.1/F3.1 (25/25) e ADR-021.
- **Estado financeiro íntegro**: comandas A/B `open`; 1 pagamento válido na comanda A (R$20), 0 na comanda B; artefatos cross-tenant da FASE 3 revertidos; `transactions` = 0; correções append-only A=4/B=3 (confere com ADR-021 §8).
- **Isolamento**: 0 pagamentos órfãos · 0 appointments órfãos · 0 correções cross-tenant persistentes · tenants E2E com 0 dados — **zero vazamento**.
- **Finding F4-1 (rastreabilidade, sem impacto funcional/security):** migration `20260901120000` fora do `schema_migrations` (função transplantada sem repair). Resolvido na FASE 5.
- **Inventário residual real do escopo de teardown:** 25 tenants sintéticos e 49 auth users sintéticos — **nenhum tenant/user real existia no staging**.

**GATE FINAL FASE 4:** ✅ **APROVADA** — estado persistido íntegro e consistente com os relatórios de homologação.

---

## 9. FASE 5 — Teardown (restauração pré-homologação)

> Fonte: `docs/audit/STAGING_FASE5_TEARDOWN_RELATORIO_FINAL.md`

### 9.1 F4-1 resolvido

`20260901120000_seguranca_fix_bulk_close_comandas_with_credits` registrada em `supabase_migrations.schema_migrations` (INSERT, mesmo efeito do `migration repair`; verificado: 3 migrations `>= 20260901000000` presentes: `120000`, `150000`, `160100`).

### 9.2 Inventário deletado (predicados ampliados vs F4)

| Objeto | Quantidade | Predicado |
|---|---|---|
| Tenants sintéticos | **25** (2 Homolog + 21 E2E + **2 GATE F11** não contabilizados no F4) | `name LIKE 'E2E%' / 'Homolog%' / 'GATE%'` |
| Auth users `e2e-*@gmail.com` | **42** | `email LIKE 'e2e-%@gmail.com'` |
| Auth users `@soumanager.test` | **5** | `email LIKE '%@soumanager.test'` |
| Auth users `gate-f11-*@gmail.com` | **2** | `email LIKE 'gate-f11-%@gmail.com'` |
| Tenants/users **reais** | **0** | nenhum fora dos padrões sintéticos |

### 9.3 Execução

- Ordem reversa de dependências: 56 tabelas tenant-scope + user-scope (`plan_change_requests`), depois tenants (25), depois `auth.users` (49, cascade em `auth.identities`/`auth.sessions`/etc.).
- Ajuste de tipo: `event_store`, `outbox_items`, `processed_operations` têm `tenant_id` **text** → delete com `id::text`.
- Trigger check: DELETE não exige `auth.uid()` (teste em `appointment_attendance_corrections` passou).
- Resíduo: **122 linhas órfãs** em `audit_logs` (tenant inexistente; tabela sem FK p/ tenants) removidas → `audit_logs` = 0.

### 9.4 Verificação final — 22 contadores = 0

`tenants` 0 · `auth.users` 0 · `profiles` 0 · `user_tenants` 0 · `staff` 0 · `clients` 0 · `services` 0 · `comandas` 0 · `comanda_items` 0 · `comanda_payments` 0 · `appointments` 0 · `appointment_attendance_corrections` 0 · `comanda_unblock_audit` 0 · `transactions` 0 · `event_store` 0 · `outbox_items` 0 · `processed_operations` 0 · `audit_logs` 0 · `plan_change_requests` 0 · `auth.identities` 0 · `auth.sessions` 0 · `storage.objects` 0.

**GATE FINAL FASE 5:** ✅ **CONCLUÍDO** — staging restaurado ao estado pré-homologação; produção intocada.

---

## 10. Estado Final do Staging (evidência consolidada)

**Ambiente:** `sou-manager-staging` / `tjcvuhynckocmvtqykxp` (região `us-west-1`)

### 10.1 Dados

| Verificação | Resultado |
|---|---|
| 22 contadores de tabelas de dados | **0 / 0** (tabela §9.4) |
| Tenants reais | **0** (nunca existiu dado real no staging) |
| Auth users reais | **0** |
| Dados de negócio residuais | **0** |

### 10.2 Schema (migrations registradas — 15)

| Migration | Objeto |
|---|---|
| `20260827120000` → `20260828000000` | D8 worker surface/schedule/retry-dead-letter |
| `20260829000000` → `20260829020000` | M1 `attended_at` · M2 `payment_type` · M3 `comanda_payments` |
| `20260830000000` → `20260830040000` | M4 P1/P4/P5/P6/P7/P8 (RPCs + tabelas) |
| `20260831120000` | `seguranca_fix_bulk_close_comandas_admin` (F1.1) |
| `20260901120000` | `seguranca_fix_bulk_close_comandas_with_credits` (F1.4 — reparo F4-1 na FASE 5) |
| `20260901150000` | `fix_rpc_tenant_scoped_authorization` (ADR-021 — P4/P7) |
| `20260901160100` | `fix_confirm_appointment_attendance_tenant_scoped` (GATE 2 — P5) |

### 10.3 RPCs críticas (verificadas no banco, pg_get_functiondef)

**5/5 tenant-scoped** — `bulk_close_comandas_admin`, `bulk_close_comandas_with_credits`, `confirm_appointment_attendance`, `correct_appointment_attendance`, `register_comanda_payment` — nenhuma global-first; superadmin bypass canônico preservado em todas.

### 10.4 Produção

`ushsnmlbeurfvlkieiln` — **INTOCADA durante todo o ciclo** (0 escritas, 0 migrations aplicadas, 0 acesso com finalidade de escrita). CLIs nunca executadas com `--linked` puro (guard obrigatório); credenciais de produção nunca carregadas no ambiente de homologação.

---

## 11. Evidências (documentos-fonte)

| Fase | Documento |
|---|---|
| F1.1/F3.1 | `docs/security/SECURITY_AUDIT_RPC.md` + `tests/e2e/homologation/h6-5-bulk-close-comandas-admin.spec.ts` (12 cenários SEC) + h6-6 (13/13) |
| FASE 1 | `docs/audit/STAGING_FASE1_READONLY_RELATORIO_FINAL.md` |
| FASE 2 | `docs/audit/STAGING_FASE2_PROVISIONAMENTO_RELATORIO_FINAL.md` (+ ADENDO 2.3) |
| FASE 3 | `docs/audit/STAGING_FASE3_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md` |
| ADR-021 | `docs/adr/ADR-021-rpc-tenant-scoped-authorization.md` + `docs/audit/STAGING_ADR021_REHOMOLOGACAO_P4_P7_RELATORIO_FINAL.md` + `test-results/rehomolog-adr-021-evidence.json` (20/20) |
| GATE 1/2 | `docs/audit/GATE1_AUDITORIA_CONFIRM_APPOINTMENT_ATTENDANCE.md` + `docs/audit/GATE2_CORRECAO_CONFIRM_APPOINTMENT_ATTENDANCE_RELATORIO_FINAL.md` + `test-results/rehomolog-confirm-evidence.json` (15/15) |
| FASE 4 | `docs/audit/STAGING_FASE4_AUDITORIA_POS_TESTE_RELATORIO_FINAL.md` |
| FASE 5 | `docs/audit/STAGING_FASE5_TEARDOWN_RELATORIO_FINAL.md` |
| Execução | `teardown_staging.sql` / `verify_staging.sql` (evidência executável, staging-only) |

---

## 12. Riscos Residuais e Pendências (fora do escopo de evidência deste gate)

| # | Item | Severidade | Natureza |
|---|---|---|---|
| 1 | **Aplicação das migrations corretivas em PRODUÇÃO** (`20260831120000`, `20260901120000`, `20260901150000`, `20260901160100`) | — | **Decisão formal do PO.** Aplicação em produção exigirá reteste pós-migration e segue a política de versionamento. Nenhuma foi aplicada fora do staging. |
| 2 | RPCs legadas `approve_access_request()` / `close_order()` sem `auth.uid()` | MÉDIO | Pendência do Security Audit RLS/RPC (documentada em `docs/security/`) — **fora do escopo do STAGING GATE**; aguarda gate próprio do PO. |
| 3 | Gap histórico de migrations (14 funções de produção fora do controle de migrations) | ALTO (histórico) | Documentado na FASE 2/2.3; o staging foi destravado sem alterar histórico; saneamento formal do histórico é decisão separada do PO. |
| 4 | `detect_no_show_appointments()` / `validate_and_fix_comandas()` sem `auth.uid()` (MEDIUM do Security Audit) | MÉDIO | Fora do escopo do gate; listadas na SECURITY_AUDIT_RPC. |
| 5 | Dados residuais em outros ambientes (produção: dados reais legítimos; nenhum sintético do gate) | — | Verificado: inventário ≥ datas do gate = 0 em staging. |
| 6 | Versionamento/commit/merge/deploy da branch | — | Merge para `main` e deploy exigem aprovação explícita do PO (política oficial). Nada foi mergeado/deployado. |

---

## 13. Decisão do PO (formato binário)

**Evidências apresentadas (FASES 1–5 + F1.1/F3.1):** fix de isolamento multi-tenant provado, corrigido e re-homologado nas 5 RPCs críticas (25/25 E2E + 20/20 ADR-021 + 15/15 GATE 2 + auditoria pós-teste aprovada + teardown 22/22 a zero); produção intocada; staging em estado pré-homologação; documentos-fonte e evidências executáveis versionados.

**Decisão do PO (2026-09-02):**

```text
☑ Sim, as evidências são suficientes para aprovar a promoção.
☐ Não, existe esta pendência específica:
    ______________________________________________________
```

> **💬 Veredito formal do PO (verbatim):** *"SIM — as evidências são suficientes para prosseguir."* — **FASE 6: 🟢 APROVADA / ENCERRADA.**
>
> **Escopo da aprovação:** autoriza o avanço para o próximo fluxo de decisão — **promoção/versionamento**. **NÃO autoriza automaticamente** a aplicação em produção. As pendências operacionais (§12: migrations em produção, RPCs legadas, saneamento do gap histórico) permanecem **explicitamente separadas** das evidências de segurança aprovadas e seguem como decisões próprias do PO.

**Recomendação técnica do OpenCode (Tech Lead):** **SIM** — as evidências cobrem integralmente a classe de vulnerabilidade que motivou o gate, com prova de não-persistência de efeitos cross-tenant e produção intocada. As pendências listadas em §12 são **operacionais** (promoção para produção, RPCs legadas, saneamento histórico), não lacunas de evidência da homologação, e seguem para decisão própria do PO no fluxo de versionamento.

**Nenhuma operação adicional executada após a FASE 5. Produção intocada. STAGING GATE ENCERRADO (2026-09-02).**