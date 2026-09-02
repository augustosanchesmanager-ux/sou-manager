# GATE 1 — Auditoria Read-Only: `confirm_appointment_attendance` (P5)

> **Gate:** GATE 1 (PO) · **Tipo:** auditoria **read-only** — nenhuma alteração de código, migration, RPC, escrita no staging, seed, UPDATE/INSERT/DELETE, commit, push, merge, deploy
> **Data:** 01/09/2026 · **Responsável:** OpenCode (Tech Lead)
> **Base:** ADR-021 (padrão definitivo de autorização tenant-scoped) · FASE 3 (finding P4/P7, classe provada)
> **Ambiente auditado:** staging `tjcvuhynckocmvtqykxp` (definição **live** via `pg_get_functiondef`); produção intacta

---

## GATE 1 — confirm_appointment_attendance

```text
GATE 1 — confirm_appointment_attendance
STATUS: AUDITADO

Fonte de autorização:
  PAPEL GLOBAL (profiles.role, fallback staff.role) — SEM filtro de tenant
  Superadmin: helper canônico (bypass preservado) — OK
  Gestão:  v_normalized_role := COALESCE(NULLIF(v_access_role,''), v_membership_role, '')
           → papel GLOBAL é a primeira escolha (OR com membership no gate)
  Recepção: v_normalized_role = 'receptionist'  → papel GLOBAL
  Barbeiro: staff WHERE id = auth.uid() AND tenant_id = p_tenant_id
           + appointment.staff_id = auth.uid() → TENANT-SCOPED (único gate seguro)
  current_tenant_id_from_auth_uid() NÃO é usada no gate

Conformidade com ADR-021:
  FAIL
  (padrão pré-fix verbatim: COALESCE(global, membership) — global vence;
   sem fallback só-no-tenant-canônico; sem alinhamento aos helpers)

Gestão:
  VULNERÁVEL — ator com papel GLOBAL owner/admin/manager/gerente/superadmin
  confirma atendimento em QUALQUER p_tenant_id (sem membership exigida)

Recepção:
  VULNERÁVEL — ator com papel GLOBAL receptionist confirma atendimento
  em QUALQUER p_tenant_id (sem membership exigida)

Risco cross-tenant:
  REAL
  (caminho completo: gate aprova por papel global → appointment carregado por
   id AND tenant_id = p_tenant_id → UPDATE attended_at/status='completed'
   na linha do tenant alvo; classe idêntica ao finding FASE 3 comprovado)

Risco de escrita cross-tenant:
  IDENTIFICADO
  (UPDATE em public.appointments do tenant alvo — attended_at now(),
   attended_at_source NULL, status 'completed'; alcançável com p_tenant_id
   arbitrário + UUID do agendamento alvo; não re-executado: mandato read-only)

Evidências:
  - LIVE (staging): pg_get_functiondef confirm_appointment_attendance
    — idêntica à migration 20260830010000 (snapshot desta auditoria)
  - supabase/migrations/20260830010000_m4_p4_p5_attendance_rpcs.sql (linhas 57–159)
  - Grep repo: ÚNICA definição da função (nenhuma redefinição posterior;
    20260901150000 reescreve somente correct_appointment_attendance e
    register_comanda_payment)
  - ADR-021 D-4 (observação latente registrada em 01/09 — agora confirmada live)
  - FASE 3 P5: 4/4 PASS com ator BARBEIRO (gates gestão/recepção nunca exercitados)
  - src/lib/finance/attendance.ts: caller legítimo passa tenantId do contexto

VERDICT:
  CRITICAL
  (capacidade de escrita cross-tenant real, padrão idêntico ao finding já
   fechado em P4/P7; estabelecida por análise de código + snapshot live —
   NÃO re-executada por mandato read-only)

ALTERAÇÕES EXECUTADAS:
  NENHUMA
```

---

## 1. O que a auditoria verificou

### 1.1 Fonte da definição auditada

| Origem | Conteúdo | Veredito |
|---|---|---|
| Migration `20260830010000_m4_p4_p5_attendance_rpcs.sql` | Definição canônica | = fonte da auditoria |
| `pg_get_functiondef` (staging, consulta read-only desta auditoria) | Definição **live** | **idêntica à migration** (teste textual) |
| Grep do repositório | Ocorrências da função | Só a migration define; frontend chama via `src/lib/finance/attendance.ts` e `pages/Schedule.tsx`; docs relatam (FASE 3, ADR-021) |

**Conclusão:** a definição que roda no staging é exatamente a auditada. Nenhuma migration posterior (incluindo o fix ADR-021 `20260901150000`) alterou `confirm_appointment_attendance`.

### 1.2 O padrão encontrado (verbatim live)

```sql
-- 1) Papel GLOBAL (sem escopo de tenant):
SELECT LOWER(BTRIM(COALESCE(p2.role, ''))) INTO v_access_role
FROM public.profiles p2 WHERE p2.id = v_auth_uid LIMIT 1;          -- ← global
IF v_access_role IS NULL THEN ... staff.role ...;                  -- ← global (fallback)

-- 2) Membership tenant-scoped (somente consultada):
SELECT ... INTO v_membership_role FROM public.user_tenants ut
WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id;      -- ← correta, mas rebaixada

-- 3) Gate usa o papel GLOBAL como autorizador:
v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');   -- ← global vence

-- Gestão:
IF COALESCE(v_is_super_admin, false)
   OR v_normalized_role IN ('owner','admin','manager','gerente','superadmin','super admin')  -- ← global
   OR v_membership_role IN ('owner','admin','manager','gerente','superadmin')
THEN v_can_confirm := true; END IF;

-- Recepção:
IF NOT v_can_confirm AND v_normalized_role = 'receptionist' THEN    -- ← global
  v_can_confirm := true;
END IF;
```

**Este é o padrão pré-ADR-021, idêntico (verbatim) ao que causou o finding P4/P7** — a única diferença funcional é o gate de barbeiro, que é tenant-scoped (`staff ... tenant_id = p_tenant_id` + `appointment.staff_id = auth.uid`).

## 2. Cenários por papel

| Papel | Fonte de autorização | Cross-tenant? | Veredito |
|---|---|---|---|
| Superadmin | `current_is_super_admin_from_auth_uid()` | Sim (bypass canônico) | **OK** (exceção ADR-021 D-2, invariável) |
| Manager/admin/owner/gerente **global** | `profiles.role` (sem tenant) | **SIM → ESCRITA** | **VULNERÁVEL** |
| Receptionist **global** | `profiles.role` (sem tenant) | **SIM → ESCRITA** | **VULNERÁVEL** |
| Barbeiro | `staff` (tenant + próprio agendamento) | Não | **OK** (único gate tenant-scoped) |
| Papel via membership (sem global) | `user_tenants` (tenant alvo) | Não | **OK por construção** (mas irrelevante: global vence quando existe) |

## 3. Caminho de escrita cross-tenant (por que é REAL, não teórico)

1. Ator com sessão válida e `profiles.role` global `manager`/`receptionist` (ex.: `mgrA` = `0fe6e110...`, global `manager` — mesmas credenciais que **escreveram cross-tenant na FASE 3** para P4/P7).
2. Chama `confirm_appointment_attendance(p_tenant_id = <tenant B>, p_appointment_id = <uuid de agendamento B>)`.
3. Gate de gestão ou recepção aprova **por papel global** — nenhuma verificação de pertencimento a B.
4. `SELECT * FROM appointments WHERE id = ... AND tenant_id = B` → encontrado.
5. `UPDATE appointments SET attended_at = now(), attended_at_source = NULL, status = 'completed' WHERE id = ... AND tenant_id = B` → **escrita real no tenant B**.

Pré-requisitos de exploração equivalentes aos já demonstrados: papel global de gestão/recepção + conhecimento do UUID do agendamento alvo (leituras cross-tenant via RLS continuam bloqueadas para não-superadmin, mas o RPC `SECURITY DEFINER` não verifica permissão de leitura do alvo). O impacto toca **comissão/dashboard** (attended_at + completed alimentam fluxos financeiros/operacionais do tenant alvo) — mesma severidade da classe fechada.

## 4. Por que a FASE 3 registrou P5 como 4/4 PASS

A matriz P5 foi executada **com ator barbeiro** (`b5b37a61...`). O gate de barbeiro é o único tenant-scoped — por isso P5.4 (barber A × appt B) foi rejeitado corretamente. **Os gates de gestão e recepção jamais foram exercitados na matriz** (não havia cenário com ator manager/receptionist × tenant B em P5), exatamente como documentado na FASE 3 (§6) e no ADR-021 (D-4): "não exercitados no teste porque o ator era barbeiro".

## 5. Nada foi alterado

- Nenhuma escrita no staging (0 `UPDATE`/`INSERT`/`DELETE` da auditoria).
- Nenhuma migration, nenhuma RPC alterada, nenhum seed.
- Única operação de dados: **uma leitura** (`pg_get_functiondef` via `supabase db query --linked`) — conforme escopo autorizado ("consultas" listadas como evidência na decisão do PO).
- Sem commit/push/merge/deploy. Produção `ushsnmlbeurfvlkieiln` intocada.

---

## Decisão (gate posterior, NÃO executada aqui)

O padrão é o mesmo da classe já corrigida (ADR-021) e já provada crítica. Recomenda-se tratar `confirm_appointment_attendance` como **novo finding** e, num gate separado, decidir a correção aplicando a mesma técnica do ADR-021 (membership do tenant alvo como fonte primária; papel global apenas no tenant canônico; superadmin preservado; gates gestão/recepção/barbeiro a serem atrelados ao gated tenant-scoped). **Esta auditoria parou na constatação — nenhuma correção automática.**

```text
STATUS FINAL DO GATE 1:
  AUDITADO — CRITICAL — ALTERAÇÕES EXECUTADAS: NENHUMA
  PRODUÇÃO: INTACTA · STAGING: APENAS LEITURA
  PRÓXIMO PASSO: DECISÃO DO PO (novo gate de correção, se aprovado)
```