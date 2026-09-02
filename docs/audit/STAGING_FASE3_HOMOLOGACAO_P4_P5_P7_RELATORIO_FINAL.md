# STAGING GATE — FASE 3 · Relatório de Homologação P4/P5/P7 (Isolamento Multi-Tenant)

> **Gate:** STAGING GATE · **Fase:** 3 (matriz E2E P4/P5/P7 com validação transversal do estado persistido)
> **Status:** ⛔ **STOP — FINDING CRÍTICO DE ISOLAMENTO MULTI-TENANT.** Duas RPCs `SECURITY DEFINER` autorizam pelo `profiles.role` **global** e permitem **escrita cross-tenant real** (não apenas retorno de RPC — confirmado no banco). Aguarda decisão do PO: fix via ADR+migration ou documentar e seguir.
> **Data:** 01/09/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Staging:** `tjcvuhynckocmvtqykxp` · **Produção:** `ushsnmlbeurfvlkieiln` — **INTOCADA** (0 escritas)
> **Commit/Push/Merge/Deploy:** NENHUM executado

---

## 1. Resumo Executivo

A FASE 3 foi autorizada pelo PO ("LIBERADO") com a diretriz explícita: *"Após cada operação, verificar o estado persistido no banco, e não somente o retorno da RPC."* E foi executada integralmente no staging:

- **Provisionamento de tier auth:** 4 usuários sintéticos (manager A, barber A, receptionist A, manager B) com `auth.users` + `profiles` + `user_tenants` + `staff` — **validado 4/4 no banco, 0 órfãos**.
- **Dados de teste:** appointments (A01 pending, A02 cancelled, A03 completed/attended, B pending) e comandas abertas (A: total R$120 = 65+55; B: total R$70), criados **via sessão real** (os triggers de `comandas` exigem `auth.uid()` — service role é rejeitado com "Usuario nao autenticado"; isso também foi validado).
- **Matriz P4/P5/P7:** 16/18 cenários-asserts **PASS**; **2 FAIL — ambos da mesma classe de vulnerabilidade** (escrita cross-tenant). Causa-raiz identificada nas fontes das funções.
- **Cleanup:** artefatos cross-tenant revertidos/restaurados no banco (evidência append-only preservada).

## 2. Autorização do PO (FASE 3)

PO liberou a execução da FASE 3 (matriz P4/P5/P7) **somente no staging** `tjcvuhynckocmvtqykxp`, com produção intocável, dados sintéticos, idempotência nos seeds, validação transversal do estado persistido, e **sem** commit/push/merge/deploy/migration. Credenciais: service role staging fornecida via backup (renomeada para `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` — staging validado por host: `IS_STAGING=true`, `CONTAINS_PROD=false`).

## 3. Provisionamento — validado 4/4 no banco

| Email | Tenant | Role | User ID (auth.users) |
|---|---|---|---|
| `homolog.manager.a@soumanager.test` | A (`aaaa...001`) | manager | `0fe6e110-243a-433a-b952-67dbaf0e98c8` |
| `homolog.barber.a@soumanager.test` | A | barber | `b5b37a61-1b2f-431a-800f-c6c8493e3e35` |
| `homolog.recept.a@soumanager.test` | A | receptionist | `b7ef2a92-8f86-4e7a-b25c-cd3e437492e7` |
| `homolog.manager.b@soumanager.test` | B (`bbbb...002`) | manager | `2e597041-ecda-4c1d-bb10-599d0ee47f64` |

Validação transversal pós-provisionamento (`db query --linked`): `auth_users=4`, `profiles=4`, `user_tenants=4`, `staff=4`, `profiles_sem_tenant=0`. Senha sintética: `Homolog-2026!` (só staging).

## 4. Dados de Teste (via sessão real — não service role)

| Objeto | ID | Tenant | Estado |
|---|---|---|---|
| Appointment A01 | `aaaa...a001` | A | `pending`, client Carlos A, service Corte (65), staff barber A |
| Appointment A02 | `aaaa...a002` | A | `cancelled` (rejeição P5) |
| Appointment A03 | `aaaa...a003` | A | `completed`, `attended_at` 31/08 (base p/ P4) |
| Appointment B | `bbbb...a001` | B | `pending` (cross-tenant) |
| Comanda A | `aaaa...c001` | A | `open`, total 120 (item1 65 + item2 55) |
| Comanda B | `bbbb...c001` | B | `open`, total 70 (item 70) |

> **Descoberta lateral (schema):** `INSERT` em `comandas` via service role **falha** com `Usuario nao autenticado` — triggers `audit_trigger_row_comandas` / `notify_comanda_open` exigem sessão. O caminho real (e o usado na homologação) é criar comandas na **sessão autenticada** do usuário do tenant. `appointments` não tem esse bloqueio.

## 5. Matriz de Homologação — Resultados

### P5 — `confirm_appointment_attendance` (4/4 PASS)

| # | Cenário | Sessão | Resultado RPC | Estado persistido (banco) |
|---|---|---|---|---|
| P5.1 | Confirmar A01 `pending` (próprio) | barber A | ✅ `success:true, attended_at` setado | A01 → `completed`, `attended_at` gravado |
| P5.2 | Confirmar A02 `cancelled` | barber A | ✅ Rejeitado: *"Nao e possivel confirmar atendimento de agendamento cancelled"* | A02 intacto |
| P5.3 | Re-confirmar A01 (já confirmado) | barber A | ✅ Rejeitado: *"Atendimento ja foi confirmado"* | A01 inalterado |
| P5.4 | Confirmar appointment do **tenant B** | barber A | ✅ Rejeitado: *"Usuario sem permissao para confirmar atendimento"* | Appt B intacto (teste limpo com appt B real) |

### P4 — `correct_appointment_attendance` (3/4 PASS, 1 FINDING)

| # | Cenário | Sessão | Resultado RPC | Estado persistido (banco) |
|---|---|---|---|---|
| P4.1 | Corrigir A03 retroativamente (motivo) | manager A | ✅ `success:true`, before/after no retorno | A03 → `attended_at = 30/08`, `source=management_correction`; **linha append-only em `appointment_attendance_corrections`** (before `31/08`, after `30/08`, motivo, `corrected_by`=manager A) |
| P4.2 | Corrigir **sem motivo** | manager A | ✅ Rejeitado: *"Motivo obrigatorio"* | Nada gravado |
| P4.3 | Corrigir como barbeiro | barber A | ✅ Rejeitado: *"Somente gestao pode corrigir attended_at retroativamente"* | Nada gravado |
| **P4.x** | 🔴 Corrigir **appointment do tenant B** | manager A | ❌ **NÃO rejeitou** — retornou sucesso | **ESCREVEU no tenant B**: appt B → `completed` + `attended_at`; linha nova em `appointment_attendance_corrections` (tenant B, `corrected_by`=manager A) |

### P7 — `register_comanda_payment` / summary / reversal (8/9 PASS, 1 FINDING)

| # | Cenário | Sessão | Resultado RPC | Estado persistido (banco) |
|---|---|---|---|---|
| P7.1 | Pagamento **parcial** R$50 (pix) | reception A | ✅ `success:true`, `remaining=70` | `comanda_payments` R$50 `parcial/pix` (tenant A) |
| P7.2 | **Idempotência**: mesma `idempotency_key` | reception A | ✅ `idempotent:true`, mesmo `comanda_payment_id` | **0 duplicata** |
| P7.3 | Pagamento **antecipado** R$20 (dinheiro) | manager A | ✅ `success:true`, `remaining=50` | 2º pagamento (tenant A) |
| P7.4 | `get_comanda_payment_summary` | reception A | ✅ `total_paid=70`, `remaining=50`, `payment_count=2` | consistente com `comanda_payments` |
| P7.5 | `reverse_comanda_payment` R$50 | manager A | ✅ `success:true` com `reversed_at` | **`reversed_at` persistido** na linha; summary → `total_paid=20`, `remaining=100` |
| P7.6 | `check_comanda_has_valid_payments` | reception A | ✅ `has_valid_payments=true, total_paid=70` (pré-reversal) | consistente |
| P7.7 | 🔴 Pagamento na **comanda do tenant B** | reception A | ❌ **NÃO rejeitou** — retornou sucesso | **ESCREVEU R$30 em `comanda_payments` (tenant B)** |
| P7.8 | Overpay R$200 (> total 120) | reception A | ✅ Rejeitado: *"excede o total da comanda"* | Nada gravado |

## 6. 🔴 FINDING CRÍTICO — Causa-raiz (fontes verificadas no banco)

Todas as 3 RPCs são `SECURITY DEFINER`, `SET search_path TO 'public'`. O padrão defeituoso é **idêntico** em `correct_appointment_attendance` e `register_comanda_payment`:

```sql
-- 1) Role GLOBAL (sem escopo de tenant):
SELECT LOWER(BTRIM(COALESCE(p2.role,''))) INTO v_access_role
FROM public.profiles p2 WHERE p2.id = v_auth_uid;            -- ← auth.uid() SEM tenant_id

-- 2) Membership tenant-scoped (somente consultado):
SELECT ... INTO v_membership_role FROM public.user_tenants ut
WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id;

-- 3) Gate usa o role GLOBAL como autorizador:
v_normalized_role := COALESCE(NULLIF(v_access_role,''), v_membership_role, '');
```

**Consequência:** qualquer usuário com `profiles.role` global = `manager`/`receptionist`/etc. pode passar um `p_tenant_id` **arbitrário** e as funções autorizam pela `profiles.role` global — o `user_tenants.role` (verdadeiro escopo de tenant) é ignorado quando o role global existe. O lookup do registro alvo (`appointments`/`comandas` por `id AND tenant_id = p_tenant_id`) encontra o objeto do tenant alvo e **escreve**. Não há verificação de que `auth.uid()` pertence ao tenant alvo (o helper RLS `current_tenant_id_from_auth_uid()` **não é usado** nesses gates).

**Por que P5.4 passou:** o gate *barber* de `confirm_appointment_attendance` é o único tenant-scoped (`staff WHERE id=auth_uid AND tenant_id=p_tenant_id` + `appointment.staff_id = auth_uid`) — por isso rejeitou. Porém **os gates de gestão/recepção da própria `confirm_appointment_attendance` têm a mesma falha latente** (usam `v_normalized_role` global) — não exercitados no teste porque o ator era barbeiro.

**Evidência no banco (writes cross-tenant reais):**
- `appointment_attendance_corrections` tenant B: `motivo='homolog: x-tenant'`, `corrected_by=0fe6e110` (manager A), `attended_after=2026-09-01T19:47:02`.
- `comanda_payments` tenant B: pagamento `parcial` R$30 (`idempotency_key='homolog-p7-x'`).

## 7. Cleanup executado (staging)

| Artefato cross-tenant | Ação | Resultado |
|---|---|---|
| Pagamento R$30 na comanda B (P7.7) | `reverse_comanda_payment` via **session legítima manager B** | ✅ `reversed_at` persistido |
| Appointment B alterado (status/attended_at) | `UPDATE` via service role (restauração) | ✅ `pending`, `attended_at=null`, `source=null` |
| Linha de correção append-only no tenant B | **Preservada** (append-only; evidência de auditoria — não se apaga) | ✅ mantida como trilha |

## 8. Validação transversal final (Admin API + db query)

| Verificação | Resultado |
|---|---|
| A01: `completed` + `attended_at` | ✅ (P5.1) |
| A02: `cancelled`, `attended_at=null` | ✅ (intacto) |
| A03: `completed`, `attended_at=30/08`, `source=management_correction` + linha de correção com before/after/motivo | ✅ (P4.1) |
| Correção tenant B: linha `7e8df420...` com `corrected_by`=manager A | ⚠️ evidência do finding preservada |
| Pagamentos válidos comanda A: 1 (antecipado R$20) | ✅ (parcial revertido) |
| Pagamento revertido comanda A: 1 (parcial R$50, `reversed_at` setado) | ✅ (P7.5) |
| Pagamentos comanda B: 1 (R$30) — **revertido** | ✅ (cleanup; tenant B volta a `has_valid_payments=false` de fato) |
| Appt B restaurado: `pending`, `attended_at=null` | ✅ (cleanup) |
| Comandas A (open/120) e B (open/70) | ✅ ambos `open` — pagamentos não alteram status de comanda (distinção pagamento ≠ atendimento/comissão, conforme diretriz do PO) |

## 9. Dados Sintéticos Criados (rastreabilidade)

| Tipo | IDs | Obs |
|---|---|---|
| Tenants | `aaaaaaaa-0000-0000-0000-000000000001` (A), `bbbbbbbb-0000-0000-0000-000000000002` (B) | FASE 2 |
| Clients | `...011` Carlos A, `...012` Fernanda A, `bbbb...011` Joana B | FASE 2 |
| Services | `aaaa...021` Corte A, `aaaa...022` Barba A, `bbbb...021` Corte B | FASE 2 |
| Appointments | `aaaa...a001/a002/a003`, `bbbb...a001` | FASE 3 |
| Comandas / Itens | `aaaa...c001`/`e001,e002`, `bbbb...c001`/`e001` | FASE 3 |
| Pagamentos | `66e1690e...` (parcial, revertido), `23a68fb6...` (antecipado, válido), `4233fdb1...` (tenant B, revertido) | FASE 3 |

Tudo em staging; nada em produção.

## 10. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | **Escrita cross-tenant em RPCs financeiras/de agendamento** (`correct_appointment_attendance`, `register_comanda_payment`; gates gestão/recepção de `confirm_appointment_attendance` latentes) | **CRÍTICO** | Finding documentado (§6); fix proposto exige ADR+migration + aprovação do PO; **não corrigido automaticamente** |
| 2 | Se levar o fix às pressas, introduzir regressão nos gates legítimos | **ALTO** | Re-homologar P4/P5/P7 afetados após fix, com a mesma matriz |
| 3 | Staging reutilizado para E2E futuro com dados residuais de homologação | BAIXO | Teardown planejado (FASE 5) remove objetos sintéticos |

## 11. Critérios de Saída da FASE 3

- [x] Provisionamento de auth users (4) + profiles + user_tenants + staff — **OK (4/4)**
- [x] Dados de teste (appointments + comandas A/B) — **OK**
- [x] Matriz P5 — **OK (4/4)**
- [x] Matriz P4 — **PARCIAL (3/4 + 1 FINDING crítico)**
- [x] Matriz P7 — **PARCIAL (8/9 + 1 FINDING crítico)**
- [x] Validação transversal do estado persistido em cada cenário — **OK** (inclui confirmação dos 2 findings no banco)
- [x] Cleanup de artefatos cross-tenant — **OK**
- [x] Documentação (este relatório) — **OK**
- [x] Produção intocada; sem commit/push/merge/tag/deploy — **OK**

---

## GATE FINAL

```text
STAGING GATE — FASE 3

Produção:
    INTACTA (ushsnmlbeurfvlkieiln — 0 escritas)

Staging:
    tjcvuhynckocmvtqykxp

Provisionamento auth (4 users):
    PASS  (auth.users + profiles + user_tenants + staff; 0 orfaos)

P5 confirm_appointment_attendance:
    PASS  4/4 (happy, cancelled, double-confirm, cross-tenant)

P4 correct_appointment_attendance:
    FAIL  1/4 cenários cross-tenant ESCREVEU no tenant B
          (gate usa profiles.role global; sem check de membership no tenant alvo)

P7 register_comanda_payment:
    FAIL  1/9 cenários cross-tenant ESCREVEU R$30 no tenant B
          (mesma causa-raiz; idempotência/reversal/overpay PASS)

Isolamento multi-tenant (RLS/RPC):
    ❌  QUEBRADO nas RPCs SECURITY DEFINER financeiras/de agendamento
        (confirm_appointment_attendance tem gates gestão/recepção latentes)

Causa-raiz:
    v_normalized_role := COALESCE(profiles.role GLOBAL, user_tenants.role)
    + lookup registro alvo so por p_tenant_id (sem auth.uid() no tenant alvo)
    + helper RLS current_tenant_id_from_auth_uid() NAO usado nos gates

Cleanup:
    OK  (pagamento B revertido via manager B; appt B restaurado;
         evidência append-only preservada)

Commit:
    NÃO

Push:
    NÃO

Deploy:
    NÃO

STATUS:
    STOP — FINDING CRÍTICO DE ISOLAMENTO MULTI-TENANT.
    AGUARDANDO DECISÃO DO PO.
```

---

## Decisão necessária do PO

**Bloqueio:** as RPCs `correct_appointment_attendance` e `register_comanda_payment` (ambas `SECURITY DEFINER`) autorizam pelo `profiles.role` **global** e permitem **escrita cross-tenant real**, confirmada no banco (não apenas retorno de RPC). O mesmo padrão defeituoso está latente nos gates gestão/recepção de `confirm_appointment_attendance`.

**Não foi feito (por mandato — alteração de RPC = ADR + migration + aprovação do PO):**
- ❌ Nenhuma migration criada.
- ❌ Nenhuma função alterada.
- ❌ Nenhum commit/push/merge/deploy.
- ❌ Nada em produção.

**Caminhos possíveis para o PO decidir:**
- **A)** **Autorizar o fix via ADR + migration** (recomendado): nos gates das 3 RPCs, autorizar **somente via membership no tenant alvo** (`user_tenants.role WHERE user_id=auth.uid() AND tenant_id=p_tenant_id`), eliminando `profiles.role` global do gate (exceto superadmin canônico), alinhado ao helper RLS `current_tenant_id_from_auth_uid()` já existente. Depois: re-homologar P4/P7 (e exercitar gates gestão/recepção do P5).
- **B)** Documentar o finding como risco conhecido e **seguir o fluxo** (FASE 4 auditoria pós-teste → FASE 5 teardown → FASE 6 relatório), com o risco aberto para produção.

**Recomendação técnica:** **A**, porque o risco toca fluxo financeiro (pagamento) e de atendimento em arquitetura multi-tenant — exatamente o cerne da plataforma. A correção é localizada (3 funções) e re-homologável com a mesma matriz desta FASE 3.

**Nenhuma operação adicional executada após o STOP. Produção intacta.**