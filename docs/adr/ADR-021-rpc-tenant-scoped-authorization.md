# ADR-021: Autorização Tenant-Scoped em RPCs — Correção do Finding Crítico FASE 3 (P4/P7)

**Status:** Accepted (2026-09-01)
**Date:** 2026-09-01
**Deciders:** PO (Augusto) + OpenCode
**G0:** FASE 3 Homologação — finding crítico de isolamento multi-tenant (P4/P7)
**References:** ADR-003 (isolamento multi-tenant); ADR-012 (grants RPC); ADR-019 (autorização por papel); ADR-020 (attended_at); `docs/audit/STAGING_FASE3_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md`

---

## Context

Durante a homologação FASE 3 (staging `tjcvuhynckocmvtqykxp`), foi descoberto um **finding crítico**:

- Usuário do tenant **A** (`mgrA`, papel global `manager`) conseguiu **corrigir `attended_at` de um agendamento do tenant B** chamando `correct_appointment_attendance(p_tenant_id=B, ...)` — o registro de correção `7e8df420...` foi gravado em `appointment_attendance_corrections` (append-only, preservado como evidência).
- O mesmo padrão afeta `register_comanda_payment`: qualquer papel global autorizado (`manager`/`receptionist`) habilita registro de pagamento em **qualquer tenant** informado no argumento `p_tenant_id`, sem exigir pertencimento.

As duas RPCs são `SECURITY DEFINER` e realizam o gate de papel usando **`profiles.role` global** (sem filtro de tenant):

```sql
v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');
```

Como `v_access_role` é lido de `profiles.role` (e fallback `staff.role`) **sem** restrição `tenant_id`, o papel global vence o `COALESCE` e o gate de gestão/recepção passa mesmo quando o usuário **não pertence** ao tenant alvo (`p_tenant_id`).

## Problem

1. `v_access_role` (papel global) é usado como **primeira escolha** de autorização nos RPCs `correct_appointment_attendance` e `register_comanda_payment`.
2. A relação `user_tenants` já é consultada com `tenant_id = p_tenant_id` (correta), mas é **rebaixada a fallback** pelo `COALESCE` — um usuário com papel global `manager`/`receptionist` nunca é barrado.
3. Em `correct_appointment_attendance`, a cláusula `v_membership_role NOT IN (...)` com `v_membership_role = NULL` avalia para `NULL` (unknown) e, em PL/pgSQL, `IF NULL` é tratado como falso — usuário **sem membership** com papel global não-gestão também escaparia do `RAISE` (latente, mesmo ambiente do finding).
4. Os helpers canônicos de tenant existem (`current_tenant_id_from_auth_uid()`, `current_is_super_admin_from_auth_uid()`) e são usados em RLS, mas **não** no gate de autorização dessas RPCs.
5. Violação do princípio de isolamento multi-tenant (ADR-003 / ADR-019): autorização por papel não é suficiente sem escopo de tenant.

## Decision

### D-1. Fonte de autorização = `user_tenants` do tenant ALVO

Para as RPCs corretas, o papel efetivo é calculado **tenant-scoped**:

- **Fonte primária:** `user_tenants.role` onde `user_id = auth.uid() AND tenant_id = p_tenant_id` (já existente; agora promovido a autorizador).
- **Fallback (legado):** `profiles/staff.role` (global) **somente quando** `current_tenant_id_from_auth_uid() = p_tenant_id` — ou seja, o papel global só autoriza no tenant canônico do próprio usuário (alinhamento com o helper, preservando instalações legadas sem linha em `user_tenants`).
- **Fora disso, papel efetivo = vazio** → negação.

```sql
v_normalized_role := COALESCE(
  NULLIF(v_membership_role, ''),
  CASE
    WHEN public.current_tenant_id_from_auth_uid() = p_tenant_id THEN NULLIF(v_access_role, '')
    ELSE NULL
  END,
  ''
);
```

### D-2. Exceção superadmin preservada (invariável)

`current_is_super_admin_from_auth_uid()` continua sendo o bypass canônico, idêntico aos demais RPCs e políticas RLS da plataforma. Nenhuma alteração.

### D-3. Escopo do fix

Correção aplicada **somente em staging** (`tjcvuhynckocmvtqykxp`) via **nova migration corretiva** `20260901150000_fix_rpc_tenant_scoped_authorization.sql` (timestamp posterior a `20260901120000`), **sem alterar migrations históricas**. Produção (`ushsnmlbeurfvlkieiln`) **não foi tocada**. RPCs corrigidas:

- `correct_appointment_attendance(p_tenant_id, p_appointment_id, p_new_attended_at, p_motivo)` — assinatura idêntica.
- `register_comanda_payment(p_tenant_id, p_comanda_id, p_payment_type, p_amount, p_payment_method, p_motivo, p_idempotency_key)` — assinatura idêntica.

Comportamento funcional same-tenant preservado: gates de gestão/recepção, motivo obrigatório (P4), regras de idempotência/parcial/antecipado/overpay (P7) e mensagens de erro inalterados.

### D-4. `confirm_appointment_attendance` — fora do escopo original (documentado)

A RPC `confirm_appointment_attendance` (P5) possui gate com o **mesmo padrão** (`v_normalized_role` global-first + cláusulas `v_membership_role IN/NOT IN`). **Não foi corrigida na 20260901150000** — decisão explícita do PO limitou o escopo ao finding P4/P7. Ficou registrada como **observação latente** para decisão futura do PO.

> **RESOLVIDO em 01/09/2026 (GATE 1 — Correção autorizada pelo PO).** A auditoria read-only do GATE 1 confirmou o padrão global-first na definição live do staging e classificou o finding como **CRITICAL** (escrita cross-tenant real para papel global de gestão/recepção). O PO autorizou a correção aplicando **o mesmo padrão D-1** desta ADR. Implementado em `20260901160100_fix_confirm_appointment_attendance_tenant_scoped.sql` (migration aditiva, staging somente, timestamp posterior à fix original). Ver `docs/audit/GATE2_CORRECAO_CONFIRM_APPOINTMENT_ATTENDANCE_RELATORIO_FINAL.md`.

### D-5. Fechamento do finding exige evidência completa

O finding só é declarado fechado após a re-homologação com **prova de zero-write no banco** (nenhum pagamento/correção inserido no tenant alvo indevido; saldos e `total_paid` inalterados; nenhum artefato financeiro secundário) para cada cenário cross-tenant negado.

## Alternatives Considered

### Alternative 1: Corrigir também em produção (Opção B)
**Rejected (PO).** Execução limitada ao staging; produção intocada por decisão de política da etapa de homologação.

### Alternative 2: Autorizar exclusivamente por `user_tenants`, removendo o papel global
**Not rejected, não adotado agora.** Eliminaria completamente o fallback global, porém quebraria instalações legadas sem linhas em `user_tenants` que ainda dependem de `profiles.role` dentro do próprio tenant. O alinhamento com `current_tenant_id_from_auth_uid()` (D-1) alcança o mesmo objetivo de isolamento com compatibilidade.

### Alternative 3: Aceitar o risco e documentar
**Rejected.** Finding crítico: qualquer usuário com papel global gestão/recepção poderia operar em qualquer tenant — viola ADR-003/ADR-019 e o contrato multi-tenant da plataforma.

## Consequences

- **Positive:** negação cross-tenant ocorre antes de qualquer escrita (zero-write garantido pelo `RAISE` anterior ao `INSERT`/`UPDATE`).
- **Positive:** comportamento same-tenant idêntico ao homologado (membership e legado preservados); mensagens de erro inalteradas.
- **Positive:** apenas 2 funções alteradas, 1 migration aditiva, sem tocar histórico; reutiliza os helpers canônicos já validados em RLS.
- **Negative:** usuários sem linha em `user_tenants` que dependiam do papel global **fora** do próprio tenant canônico perdem autorização — comportamento correto sob isolamento multi-tenant (ADR-003); aceito.
- **Mitigation:** matriz de re-homologação P4/P7 completa (same-tenant PASS, cross-tenant DENY + zero-write, superadmin bypass exercitado) **e** matriz do GATE 1 confirm (15 cenários, zero-write junto ao tenant B, superadmin preservado); testes `src/lib/finance/{attendance,payment}.test.ts`, typecheck, `git diff --check`.

## References

- ADR-003 (isolamento multi-tenant) — princípio violado pelo finding
- ADR-019 (autorização por papel) — matriz de papéis e gates de gestão/recepção
- ADR-012 (grants RPC) — `REVOKE ALL ... GRANT EXECUTE TO authenticated` preservados
- ADR-020 (`attended_at`) — RPCs P4/P5 e tabela append-only de correções
- Helper canônico: `public.current_tenant_id_from_auth_uid()` / `public.current_is_super_admin_from_auth_uid()` (`20260308_multitenant_hotfix.sql`)
- Evidência do finding: `docs/audit/STAGING_FASE3_HOMOLOGACAO_P4_P5_P7_RELATORIO_FINAL.md` (P4.7, `7e8df420...`)