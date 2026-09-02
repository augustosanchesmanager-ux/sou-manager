# STAGING GATE — ADR-021 · Relatório de Implementação do Fix + Re-Homologação P4/P7 (Isolamento Multi-Tenant)

> **Gate:** STAGING GATE · **Escopo:** Opção A do PO — fix dos RPCs `correct_appointment_attendance` (P4) e `register_comanda_payment` (P7) com autorização tenant-scoped via `user_tenants`
> **Status:** ✅ **FIX IMPLEMENTADO + RE-HOMOLOGAÇÃO 20/20 PASS — FINDING FECHADO (classe P4/P7). AGUARDANDO homologação formal do PO (commit/push/merge/deploy sob decisão do PO).**
> **Data:** 01/09/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Staging:** `tjcvuhynckocmvtqykxp` (único ambiente alterado) · **Produção:** `ushsnmlbeurfvlkieiln` — **INTOCADA (0 escritas)**
> **Commit/Push/Merge/Deploy:** NENHUM executado (mandato da Opção A)

---

## 1. Resumo Executivo

O PO autorizou a **Opção A** (corrigir o finding crítico de isolamento multi-tenant da FASE 3) com aplicação **somente no staging** `tjcvuhynckocmvtqykxp`, via **nova ADR + nova migration corretiva**, sem tocar migrations históricas e sem commit/push/merge/deploy. Tudo foi executado conforme o mandato:

- **ADR-021** criado (`docs/adr/ADR-021-rpc-tenant-scoped-authorization.md`) e registrado no índice (`docs/adr/README.md`).
- **Migration corretiva** `20260901150000_fix_rpc_tenant_scoped_authorization.sql` criada, **aplicada no staging via Management API** (`supabase db query --linked -f`, nunca `db push`) e **registrada no histórico** (`supabase migration repair --linked --status applied`) como `applied`.
- **Fix verificado no banco:** `pg_get_functiondef` confirma o novo gate tenant-scoped nas 2 RPCs, com assinaturas, `SECURITY DEFINER`, `SET search_path TO 'public'`, grants (`authenticated`) e `NOTIFY pgrst` preservados.
- **Re-homologação completa** (`test-results/rehomolog-adr-021.cjs` + `-evidence.json`): **20/20 PASS** — matriz P4 e P7 com **prova zero-write** nas negações cross-tenant (verificação direta no banco, não só retorno de RPC), mais a **exceção canônica de superadmin exercitada** e comprovada (bypass preservado).
- **Estado final do staging restaurado:** comanda A `total_paid=20/remaining=100` (1 pagamento válido), comanda B sem pagamentos válidos novos, appt B de volta a `pending/attended_at=null`. Evidências append-only preservadas como trilha de auditoria.

## 2. Autorização do PO (Opção A — verbatim)

- "executar **somente no staging**"; "**É PROIBIDO:** executar migration em produção; executar SQL de correção em produção; fazer writes em produção; usar credenciais de produção para homologação; fazer deploy; fazer merge; fazer push; alterar migrations históricas; alterar qualquer coisa fora do escopo deste finding."
- "Confirmar explicitamente: `linked project = tjcvuhynckocmvtqykxp` … Se houver qualquer dúvida sobre o projeto vinculado: **STOP.**"
- "Não editar histórico. Não altere migrations antigas. Crie uma **nova migration corretiva**."
- "A correção deve utilizar como fonte de autorização a relação `user_tenants` considerando `tenant_id = p_tenant_id` … Alinhar a lógica ao helper existente `current_tenant_id_from_auth_uid()` quando aplicável. A exceção canônica de **superadmin** deve ser preservada conforme a arquitetura existente."
- "Não basta a RPC retornar erro. Verificar diretamente no banco que: nenhum pagamento foi inserido; saldo da comanda B não mudou; total pago não mudou; nenhuma transação financeira indevida foi criada; nenhum efeito secundário ocorreu."
- "**NÃO fazer:** commit; push; merge; deploy." / "**Não improvisar. Não contornar o gate. Não continuar parcialmente.**" / "Não declarar o finding fechado sem a evidência completa da re-homologação."

**Guarda executada:** ambiente validado por URL (contém `tjcvuhynckocmvtqykxp`), aborta se não for o staging. Produção fora de qualquer caminho de execução.

## 3. Artefatos (novos/alterados neste trabalho)

| Artefato | Tipo | Estado |
|---|---|---|
| `docs/adr/ADR-021-rpc-tenant-scoped-authorization.md` | ADR (novo) | Criado — decisões D-1 a D-5, alternativas, consequências |
| `docs/adr/README.md` | Índice | Linha do ADR-021 adicionada |
| `supabase/migrations/20260901150000_fix_rpc_tenant_scoped_authorization.sql` | Migration (nova) | **Aplicada + registrada como `applied` no staging** (via Management API; `db push` NÃO usado) |
| `test-results/rehomolog-adr-021.cjs` | Script de re-homologação | Criado — Admin API (sem pooler) + sessões reais |
| `test-results/rehomolog-adr-021-evidence.json` | Evidência (novo) | **20/20 PASS**, run `2026-09-01T21:41:12Z` |

**Fora do escopo (NÃO tocado):** `supabase/migrations/20260901120000_seguranca_fix_bulk_close_comandas_with_credits.sql` (workstream paralelo, local-only), migrations históricas, produção.

## 4. O que foi corrigido (causa-raiz da FASE 3)

Ambas as RPCs são `SECURITY DEFINER`, `SET search_path TO 'public'`. O padrão defeituoso era:

```sql
-- ANTES (FASE 3 — finding): role GLOBAL autoriza sem escopo de tenant
v_access_role     := (SELECT LOWER(BTRIM(COALESCE(role,''))) FROM public.profiles WHERE id = v_auth_uid);
v_membership_role := (SELECT role FROM public.user_tenants WHERE user_id = v_auth_uid AND tenant_id = p_tenant_id);
v_normalized_role := COALESCE(NULLIF(v_access_role,''), v_membership_role, '');
-- → profiles.role global vencia; p_tenant_id arbitrário autorizava escrita cross-tenant
```

```sql
-- DEPOIS (ADR-021): membership do tenant ALVO é a fonte primária; global só como
-- fallback no tenant canônico do próprio usuário (alinhado a current_tenant_id_from_auth_uid())
v_normalized_role := COALESCE(
  NULLIF(v_membership_role, ''),
  CASE WHEN public.current_tenant_id_from_auth_uid() = p_tenant_id
       THEN NULLIF(v_access_role, '') ELSE NULL END,
  ''
);
```

- Em `correct_appointment_attendance`, o perigo `NULL NOT IN (...)` da cláusula adicional de membership foi eliminado (remoção da cláusula) — usuário sem membership não escapa mais do `RAISE`.
- A exceção canônica **superadmin** (`current_is_super_admin_from_auth_uid()`) foi **preservada** em ambos os gates, conforme arquitetura existente.
- Assinaturas, `prosecdef=true`, grants `{postgres,anon,authenticated,service_role:X/postgres}` e `NOTIFY pgrst` conferidos via `pg_get_functiondef` após o apply.
- `confirm_appointment_attendance` (gates gestão/recepção latentes) e `close_order`/`approve_access_request` (auditoria RPC) **fora do escopo** — documentado como latente no ADR-021 (D-4) e listado em Riscos (§12).

## 5. Matriz P4 — `correct_appointment_attendance` (re-homologação)

| # | Cenário | Sessão | Resultado RPC | Estado persistido (banco) |
|---|---|---|---|---|
| P4.1 | Corrigir A03 retroativamente (motivo) | manager A | ✅ `success:true` | A03 → `attended_at=29/08`; **nova linha append-only** em `appointment_attendance_corrections` (tenant A, `corrected_by`=manager A) |
| P4.2 | Corrigir **sem motivo** | manager A | ✅ Rejeitado: *"Motivo obrigatorio para correcao retroativa de attended_at"* | **zero-write** (contagem de correções inalterada: 4→4) |
| P4.3 | Corrigir como **barbeiro** | barber A | ✅ Rejeitado: *"Somente gestao pode corrigir attended_at retroativamente"* | **zero-write** (4→4) |
| **P4.x** | 🟢 **Corrigir appointment do tenant B** (era o FINDING) | manager A | ✅ **REJEITADO** | **ZERO-WRITE PROVADO**: appt B `before==after` (`pending/attended_at=null`); correções tenant B `before==after` (2→2) |

**P4.x era o cenário que ESCREVEU no tenant B na FASE 3 — agora negado e com o banco verificado inalterado.**

## 6. Matriz P7 — `register_comanda_payment` + summary + reversal (re-homologação)

| # | Cenário | Sessão | Resultado RPC | Estado persistido (banco) |
|---|---|---|---|---|
| P7.1 | **Parcial** R$30 (pix) na comanda A | reception A | ✅ `success:true`, `total_paid=50`, `remaining=70` | Linha criada (tenant A, `parcial/pix`, key `rehomolog-p7-1-*`) |
| P7.2 | **Idempotência** (mesma key) | reception A | ✅ `idempotent:true`, mesmo payment | **0 duplicata** (1 linha para a key) |
| P7.3 | **Antecipado** R$20 (dinheiro) | manager A | ✅ `success:true`, `total_paid=70`, `remaining=50` | 2º pagamento do run (tenant A) |
| P7.4 | `get_comanda_payment_summary` | reception A | ✅ `total_paid=70`, `remaining=50`, `payment_count=3` | Consistente com `comanda_payments` |
| P7.5 | `reverse_comanda_payment` (limpeza dos 2 novos) | manager A | ✅ ambos com `reversed_at` | **Comanda A restaurada**: `total_paid=20`, `remaining=100`, `payment_count=1` válido (`23a68fb6...`) |
| **P7.x** | 🟢 **Pagar comanda do tenant B** (era o FINDING) | reception A | ✅ **REJEITADO**: *"Usuario sem permissao para registrar pagamento"* | **ZERO-WRITE PROVADO**: linhas tenant B `before==after` (mesmos IDs/reversões); nenhuma linha nova |
| P7.8 | **Overpay** R$200 (> total 120) | reception A | ✅ Rejeitado: *"Total de pagamentos (R$ 270.00) excede o total da comanda (R$ 120)"* | **zero-write** (8→8) |

## 7. Exceção superadmin (bypass canônico preservado)

| # | Cenário | Sessão | Resultado | Estado persistido |
|---|---|---|---|---|
| SA-0 | Provisionar superadmin sintético (tenant A, `profiles.role='superadmin'` + `user_tenants`) | Admin API | ✅ | `auth.users` + `profiles` + `user_tenants` (staging) |
| SA-1 | **Cross-tenant**: corrigir appt do tenant B | superadmin | ✅ `success:true` — **bypass PRESERVADO** | appt B → `completed/attended_at=29/08/management_correction` + linha append-only tenant B; **depois restaurado** para `pending/null` via service role (mirror FASE 3) |
| SA-2 | **Cross-tenant**: pagamento R$5 na comanda B | superadmin | ✅ `success:true` — **bypass PRESERVADO** | Linha criada (tenant B, key `rehomolog-sa1-*`) |
| SA-3 | Reversal do SA-2 | superadmin | ✅ `reversed_at` | Comanda B sem pagamentos válidos novos (`FINAL-2` PASS) |

Superadmin: `8506c9fa-10d1-4e4e-b395-7a5d590c895a` · `homolog.superadmin.1788298726892@soumanager.test` · senha sintética `Homolog-2026!` (só staging).

## 8. Validação transversal final (estado persistido — Admin API, sem pooler)

| Verificação | Resultado |
|---|---|
| Comanda A: `total_paid=20`, `remaining=100`, 1 pagamento válido (`23a68fb6...` antecipado R$20) | ✅ restaurada ao estado FASE 3 |
| Comanda B: **0 pagamentos válidos** (3 linhas todas `reversed=true`: `homolog-p7-x`, 2× `rehomolog-sa1-*`) | ✅ `has_valid_payments=false` de fato |
| Appt B: `pending`, `attended_at=null` (pré-homologação) | ✅ restaurado |
| Appt A03: `completed`, `attended_at=29/08`, `source=management_correction` | ✅ (P4.1) |
| Correções append-only: tenant A → **4** linhas (1 FASE 3 + 3 re-homologação); tenant B → **3** linhas (1 finding + 2 SA-1) | ✅ trilha de auditoria íntegra (append-only — não se apaga) |
| Comandas A (open/120) e B (open/70) | ✅ ambos `open` — pagamento não altera status de comanda (diretriz do PO) |

> **Nota de execução:** o script foi executado 3×; as 2 primeiras execuções tiveram **falhas de assert do próprio script** (comparação literal de timestamp `Z` vs `+00:00` e contagem misturando tenants — correções aplicadas, produto não envolvido) e **nenhuma falha de produto**. A run final (evidência anexa) é a certificada: **20/20 PASS**.

## 9. Testes Técnicos

| Verificação | Resultado |
|---|---|
| `vitest run src/lib/finance/attendance.test.ts payment.test.ts` | ✅ **17/17 PASS** (8 + 9) |
| `tsc --noEmit` — arquivos do escopo (`src/lib/finance/attendance.ts`, `payment.ts`, `paymentDecision.ts`, `refundConfig.ts`, `unblock.ts`) | ✅ **sem erros** |
| `tsc --noEmit` — repositório completo | ⚠️ erros **pré-existentes** de outros workstreams não commitados (application/, domain/events, pages/, tests/) — **nenhum no escopo ADR-021**; documentado, não corrigido (fora do mandato) |
| `git diff --check` | ✅ limpo |

## 10. Dados Sintéticos Criados (rastreabilidade — todos em staging)

| Tipo | IDs |
|---|---|
| Superadmin (novo) | `8506c9fa-10d1-4e4e-b395-7a5d590c895a` / `homolog.superadmin.1788298726892@soumanager.test` |
| Pagamentos re-homologação (revertidos) | tenant A: `b6532cf2...`, `dd0a22d5...`; tenant B: `6c5d306c...`, `398460d0...` |
| Correções append-only re-homologação | tenant A: 3 novas (P4.1 reruns); tenant B: 2 novas (SA-1 reruns) |

Nada em produção.

## 11. Cleanup executado (staging)

| Artefato | Ação | Resultado |
|---|---|---|
| Pagamentos novos das matrizes (P7.1/P7.3) | `reverse_comanda_payment` via sessão legítima manager A | ✅ revertidos; comanda A no estado FASE 3 |
| Appt B alterado por SA-1 | `UPDATE` via service role (restauração) | ✅ `pending`, `attended_at=null`, `source=null` |
| Pagamento SA-2 na comanda B | `reverse_comanda_payment` via sessão superadmin | ✅ revertido |
| Linhas de correção append-only (P4.1/SA-1) | **Preservadas** (append-only; trilha de auditoria) | ✅ mantidas |

## 12. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | Gates gestão/recepção de `confirm_appointment_attendance` com padrão latente semelhante (mesma família do finding) | **ALTO (latente)** | Documentado no ADR-021 (D-4) e neste relatório; **fora do escopo da Opção A** — requer nova autorização do PO para tratar |
| 2 | RPCs legadas `approve_access_request()` / `close_order()` sem `auth.uid()` (Security Audit RLS/RPC) | MÉDIO | Já listado em `docs/security/SECURITY_AUDIT_RPC.md`; pendente de decisão |
| 3 | Erros `tsc --noEmit` pré-existentes em workstreams não commitados na branch | BAIXO p/ este fix | Fora do escopo; nítido que não são do ADR-021 (nada em `src/lib/finance/`) |
| 4 | Staging reutilizado com dados residuais de homologação | BAIXO | Teardown planejado remove objetos sintéticos (inclui superadmin SA-0) |

## 13. Critérios de Saída da Re-Homologação (Opção A)

- [x] Nova ADR (ADR-021) criada e registrada no índice
- [x] Nova migration corretiva criada (timestamp > `20260901120000`) e aplicada **somente no staging** (Management API), registrada como `applied`
- [x] Fix verificado no banco (`pg_get_functiondef`: gate tenant-scoped + superadmin preservado + grants/definer/search_path intactos)
- [x] Re-homologação P4 — **5/5 PASS** (inclui P4.x cross-tenant DENY + zero-write no banco)
- [x] Re-homologação P7 — **7/7 PASS** (inclui P7.x cross-tenant DENY + zero-write no banco; idempotência; overpay; reversal)
- [x] Exceção superadmin exercitada e comprovada (SA-1/SA-2 bypass preservado, SA-3 reversal)
- [x] Validação transversal do estado persistido (comandas, appts, correções, pagamentos)
- [x] Cleanup + restauração do estado FASE 3; evidências append-only preservadas
- [x] Testes unitários 17/17; typecheck do escopo limpo; `git diff --check` limpo
- [x] Produção `ushsnmlbeurfvlkieiln` **INTOCADA**; sem commit/push/merge/tag/deploy

---

## GATE FINAL

```text
STAGING GATE — ADR-021 · FIX + RE-HOMOLOGAÇÃO P4/P7

Produção:
    INTACTA (ushsnmlbeurfvlkieiln — 0 escritas, 0 migrações, 0 acesso)

Staging:
    tjcvuhynckocmvtqykxp — única alteração deste trabalho:
    migration 20260901150000_fix_rpc_tenant_scoped_authorization.sql
    status = applied (registrada; aplicada via Management API, sem db push)

Fix (verificado via pg_get_functiondef):
    PASS  correct_appointment_attendance + register_comanda_payment
          gate: user_tenants(tenant_id = p_tenant_id) primário
          fallback global somente no tenant canônico do usuário
          superadmin canônico preservado (current_is_super_admin_from_auth_uid)
          signatures/definer/search_path/grants/NOTIFY preservados

Re-homologação (test-results/rehomolog-adr-021-evidence.json):
    PASS  20/20
    P4    5/5  (same-tenant PASS; sem-motivo DENY; barbeiro DENY;
                CROSS-TENANT DENY + ZERO-WRITE provado no banco)
    P7    7/7  (parcial/antecipado PASS; idempotência; summary;
                reversal; CROSS-TENANT DENY + ZERO-WRITE provado;
                overpay DENY)
    SA    4/4  (superadmin: cross-tenant correction PASS, payment PASS,
                reversal PASS — bypass canônico preservado)

Estado persistido final:
    Comanda A  total_paid=20 remaining=100 (1 válido)  — restaurado FASE 3
    Comanda B  0 válidos (3 linhas reversed)            — sem efeitos indevidos
    Appt B     pending / attended_at=null               — restaurado
    Correções  append-only preservadas (trilha íntegra)

Testes técnicos:
    PASS  17/17 unit (attendance 8 + payment 9)
    PASS  typecheck do escopo limpo; git diff --check limpo
    INFO  erros tsc pré-existentes fora do escopo (outros workstreams)

Commit:  NÃO
Push:    NÃO
Merge:   NÃO
Tag:     NÃO
Deploy:  NÃO
Produção: INTACTA

STATUS:
    FINDING (classe P4/P7) FECHADO com evidência completa.
    AGUARDANDO HOMOLOGAÇÃO FORMAL DO PO para:
      (a) decidir sobre tratar confirm_appointment_attendance (D-4, latente);
      (b) fluxo de commit/push/merge conforme política de versionamento.
```

---

## Decisão necessária do PO

**Concluído (mandato Opção A, 100%):** ADR-021 + migration `20260901150000` (aplicada/registrada no staging) + re-homologação 20/20 com prova zero-write + exceção superadmin comprovada. Produção intocada, nada commitado/pusheado/mergeado/deployado.

**Aguardando decisão do PO (fora do escopo):**
1. **`confirm_appointment_attendance`** — gates gestão/recepção com padrão latente da mesma família (documentado ADR-021 D-4; não exercido como finding pois a matriz atacou com ator barbeiro, cujo gate já era tenant-scoped).
2. RPCs legadas da auditoria de segurança (`approve_access_request`, `close_order`) — pendente item da Security Audit.
3. Fluxo de versionamento (commit semântico → push → tag/baseline → merge) — somente após homologação formal do PO.

**Nenhuma operação adicional executada após o GATE. Produção intacta.**