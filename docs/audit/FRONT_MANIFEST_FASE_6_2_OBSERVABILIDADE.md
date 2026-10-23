# Front Manifest — Fase 6.2 Observabilidade

> Protocolo: SMG Change Control v1.0.0 (INTAKE → AUDIT → CLASSIFY → STOP → ISOLATE → IMPLEMENT → VALIDATE → ...)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-23
> Autor: Sisyphus (OpenCode)
> Base: `main` (commit `42f34bc`)

## Identificação

| Campo | Valor |
|-------|-------|
| Front ID | FASE-6.2-OBSERVABILIDADE |
| Fase | Fase 6 — Production Readiness |
| Subfase | 6.2 Observabilidade |
| Base | `main` (commit `42f34bc`) |
| Branch | `feat/fase6-6-2-observabilidade` |
| Worktree | `C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager-fase6-6-2-observabilidade` |
| Escopo desta etapa | INTAKE → AUDIT → CLASSIFY → ISOLATE → IMPLEMENT → VALIDATE (Fase 1 P0) |
| Escopo excluído | Banco/migrations/RPC/RLS; deploy; alteração de regra de negócio; adoção de vendor externo sem decisão do PO; transporte remoto |
| Checkpoint | **STOP/GATE após VALIDATE** (aguarda autorização de commit) |
| Commit de implementação | `feat(observability): add root error boundary, global handlers and pii redaction` |
| Validação | `typecheck` 0 · `unit` 102 arquivos / 1813 testes · `build` 0 · `git diff --check` 0 |
| PR | não criado |
| Merge SHA | não aplicável |
| Deploy | não autorizado (MERGE ≠ DEPLOY PROD — ADR-026) |
| Estado atual | **PR_OPEN — aguarda inspeção final e MERGE AUTHORIZATION** |

## Objetivo da subfase

Estruturar telemetria, tratamento de exceções no React e monitoramento de falhas de RPC/Supabase **sem expor dados sensíveis**, preservando isolamento multi-tenant e fail-open seguro.

## Critérios de entrada

- [x] `main` sincronizada (`42f34bc`)
- [x] Worktree isolada criada a partir de `origin/main`
- [x] Estado atual auditado (7 arquivos de `src/lib/observability/`, wiring em `App.tsx`, tratamento de erros Supabase)
- [x] Lacunas catalogadas com evidência (arquivo:linha)
- [x] Decisão do PO: observabilidade própria, Fase 1 sem nova abstração autorizada
- [x] Autorização para implementar a Fase 1 (P0)

## Critérios de saída (quando autorizado)

- [x] ErrorBoundary global com fallback e log estruturado
- [x] Handler global de `error` e `unhandledrejection` (fail-open)
- [x] Camada única de redação de PII/segredos aplicada no `logger` e nos erros Supabase
- [x] Testes unitários das três frentes acima
- [x] `typecheck` + `build` + `unit` verdes; `git diff --check` limpo
- [x] Nenhuma alteração de banco, migration, RPC ou RLS

## Regras aplicáveis

- Nunca alterar produção durante investigação.
- Nunca aplicar migration, mudar RLS/RPC/policy ou mutar dados sem autorização explícita do PO.
- Nunca registrar senhas, JWTs, tokens, payloads de cartão ou PII desnecessária.
- Falha do serviço de observabilidade nunca pode travar a aplicação (fail-open).
- Nunca logar dados de tenant sem contexto explícito de tenant.
- Nunca commit/push/PR/merge sem o gate correspondente.
- Sempre `git diff --check` antes de commit.
- Distinguir EVIDENCE / INTERPRETATION / GAP / DECISION / STATUS.

## Log de transições

| Data | Transição | Ator | Observação |
|------|-----------|------|------------|
| 2026-10-23 | INTAKE | Sisyphus | Subfase 6.2 selecionada pelo PO |
| 2026-10-23 | AUDIT | Sisyphus | Código de observabilidade, wiring, ErrorBoundary, handlers globais e tratamento Supabase mapeados |
| 2026-10-23 | CLASSIFY | Sisyphus | Risco médio; mudanças aditivas e reversíveis; sem toque em dados/segurança |
| 2026-10-23 | ISOLATE | Sisyphus | Worktree `feat/fase6-6-2-observabilidade` criada de `origin/main` (`42f34bc`) |
| 2026-10-23 | STOP/GATE | Sisyphus | **PARADO — decisão de escopo (Sentry × própria) e autorização de implementação** |
| 2026-10-23 | IMPLEMENT | Sisyphus | Fase 1 P0: `redact.ts`, `globalHandlers.ts`, `ErrorBoundary.tsx` + integrações |
| 2026-10-23 | VALIDATE | Sisyphus | `typecheck` 0 · `unit` 102/1813 · `build` 0 · `git diff --check` 0 |
| 2026-10-23 | STOP/GATE | Sisyphus | **PARADO — aguarda autorização de commit** |
| 2026-10-23 | COMMIT AUTHORIZATION | Augusto (PO) | Autorizado commit, push e abertura de PR; merge permanece bloqueado |
| 2026-10-23 | COMMIT | Sisyphus | Commit atômico na branch `feat/fase6-6-2-observabilidade` |
| 2026-10-23 | PUSH | Sisyphus | Branch publicada em `origin` |
| 2026-10-23 | PR | Sisyphus | PR aberto apontando para `main` |

## Evidência da Fase 1

| Arquivo | Papel |
|---------|-------|
| `src/lib/observability/redact.ts` (novo) | Redação central: chaves sensíveis, Bearer/JWT, query secrets, email/CPF/telefone; `tenantId` preservado; profundidade 4; circular; fail-open |
| `src/lib/observability/globalHandlers.ts` (novo) | `installGlobalErrorHandlers()` idempotente + cleanup + guarda de reentrância |
| `src/components/ErrorBoundary.tsx` (novo) | Fallback `role="alert"`, reset, log redigido; stack só em `import.meta.env.DEV` |
| `src/lib/observability/logger.ts` | `log()` sanitiza `context` e `data` (fail-open) |
| `src/lib/supabase/errors.ts` | `logSupabaseError` redige `details`/`hint`/`extra`/`stack` |
| `src/lib/supabase/client.ts` | logs demo de `params`/`rpcResult` redigidos |
| `index.tsx` | `installGlobalErrorHandlers()` + `<ErrorBoundary>` envolvendo `<App />` |
| `src/lib/observability/redact.test.ts` (novo) | 12 testes |
| `src/components/ErrorBoundary.test.ts` (novo) | 8 testes |

## Próxima transição permitida

**MERGE AUTHORIZATION** — somente após inspeção final do PR e CI verde.

**Bloqueado por:** MERGE AUTHORIZATION (PO).

**STATUS:** PR_OPEN
