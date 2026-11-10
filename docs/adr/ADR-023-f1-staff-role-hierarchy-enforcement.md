# ADR-023: F1 — Enforce Hierarquia de Papéis de Staff no Banco (Role Hierarchy)

**Status:** Accepted (2026-09-14)
**Date:** 2026-09-14
**Deciders:** PO (Augusto) + OpenCode
**G0:** F1 — Staff Role Hierarchy Enforcement
**References:** `AGENTS.md` (hierarquia de papéis); migration `supabase/migrations/20260914130000_f1_staff_role_hierarchy_enforcement.sql`; `tests/security/f1/` (harness, 15 vetores/18 fluxos); `docs/security/SECURITY_AUDIT_RLS.md`

---

## Context

A equipe (`staff`) possui papéis hierárquicos — **owner > manager > barber/receptionist** — com privilégios progressivos sobre operações financeiras e operacionais. Sem enforcement no nível do banco, a hierarquia dependia de checks no frontend/app, que são **contornáveis** por qualquer cliente autenticado que invoque RPCs diretamente (RLS/PostgREST são a superfície de autorização real).

Esta decisão estabelece que a **hierarquia de papéis é imposta pelo banco**, com o banco como autoridade final de autorização.

## Problem

Um usuário com papel inferior (`barber`/`receptionist`) poderia teoricamente executar operações reservadas a `manager`/`owner` (fechamentos, aprovações, comissões) se contornasse o frontend e chamasse as RPCs diretamente. A hierarquia precisava ser codificada **no esquema**, não na camada de UI.

## Decision

Aplicar a migration `supabase/migrations/20260914130000_f1_staff_role_hierarchy_enforcement.sql` em **PRODUÇÃO (2026-09-14)**:

- Enforcement centralizado em helper `SECURITY DEFINER` que resolve o papel efetivo do usuário autenticado e valida a hierarquia (`owner` pode tudo; `manager` tudo exceto ações de owner; `barber`/`receptionist` restritos ao próprio escopo).
- Guards `auth.uid()` + `search_path` explícito; preservação de `SECURITY DEFINER` e do corpo de negócio.
- Diagnóstico de segurança: Categoria 2 (autorização em RPCs/RLS).

**Aplicação PROD (verificada):** `supabase db push` real via CLI **exit=0** (`Applying migration 20260914130000_f1_staff_role_hierarchy_enforcement.sql...` + `Finished supabase db push.`), seguido de dry-run read-only `{"upToDate":true,...}` → remoto em dia. **Nenhuma migration F1 marcada via repair** (somente push real).

**Validação técnica:** harness `tests/security/f1/` — 15 vetores / 18 fluxos PASS; suíte security **77/77 PASS**; `npm run typecheck` exit 0; build OK; `git diff --check` limpo.

## Alternatives Considered

- **Enforcement apenas no frontend:** rejeitado — qualquer cliente pode chamar RPCs diretamente, contornando a UI. Segurança não pode residir no cliente.
- **Check por application service em cada chamada:** rejeitado — multiplica pontos de verificação e duplica a lógica; o banco é a única superfície de autorização confiável.
- **Helper RLS por-papel em cada policy:** rejeitado — verboso e propenso a drift; um helper central de hierarquia é mais coeso e auditável.

## Consequences

**A favor:**
- Hierarquia de papéis é uma fonte única de verdade no banco; RPCs e policies delegam a ela.
- Contornar a UI não contorna a autorização.
- Base para os próximos itens da Categoria 2 (approve/usage monitor já seguem o mesmo padrão de guarda).

**Contra / riscos:**
- Novas operações precisam chamar o helper de hierarquia ou estarão sob-protégidas (risco de regressão futura).
- RLS e grants precisam permanecer coerentes com a hierarquia (sem `anon`/`PUBLIC` em operações sensíveis).

**NÃO autorizado por este ADR:** merge para `main`, tags e baseline formal da fase — exigem a frase explícita do PO "**Pode aplicar o baseline.**". O gate permanece intacto até autorização explícita.
