# Front Manifest — Fase 6.9 Health Checks

> Protocolo: SMG Change Control v1.0.0 (INTAKE → AUDIT → CLASSIFY → ISOLATE → IMPLEMENT → VALIDATE → STOP/GATE → COMMIT → PUSH → PR → CI → MERGE)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-23
> Autor: Sisyphus (OpenCode)

## Identificação

| Campo | Valor |
|-------|-------|
| Front ID | FASE-6.9-HEALTH-CHECKS |
| Fase | Fase 6 — Production Readiness |
| Subfase | 6.9 Health Checks |
| Base | `main` @ `cbdb33e` (merge do PR #173) |
| Branch | `feat/fase6-6-9-health-checks` |
| Worktree | `C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager-fase6-6-9-health-checks` |
| Escopo | Sonda padronizada de saúde (conectividade Supabase, latência, status estruturado) + documentação operacional + testes |
| Escopo excluído | Banco/migrations/RPC/RLS; deploy; novos vendors; endpoints públicos autenticados |
| Estado atual | **PR_OPEN — CI em monitoramento** |

> **Nota de divergência de premissa (2026-10-23):** o briefing informou que os PRs #173 e #174 estavam mergeados. Verificação via `gh`: **#173 MERGED** (`cbdb33e`), **#174 OPEN** (`mergeCommit: null`). A 6.9 foi baseada na `main` real (`cbdb33e`); a entrega de 6.3 permanece isolada aguardando MERGE AUTHORIZATION e não bloqueia esta subfase.

## Objetivo da subfase

Fornecer uma sonda única e barata para responder "o serviço está saudável?" — conectividade com Supabase, latência da requisição e classificação `healthy | degraded | down` — sem vazar dados de tenant, sem expor segredos/stack traces e sem acoplar a telemetria ao banco transacional.

## Critérios de entrada

- [x] `main` sincronizada (`cbdb33e`)
- [x] Worktree isolada criada a partir de `origin/main`
- [x] Dependências instaladas (`npm ci`)
- [x] Auditoria de utilitários existentes concluída

## Critérios de saída

- [x] Sonda pura, testável, com timeout e classificação por limiar de latência
- [x] Retorno `{ status, latencyMs, timestamp }` sanitizado (sem detalhes internos)
- [x] Falha de conexão logada via `redact.ts` (fail-open)
- [x] Documentação operacional em `docs/health-checks.md`
- [x] Testes unitários co-localizados (11 casos)
- [x] `typecheck` + `build` + `unit` + `git diff --check` verdes
- [x] Zero alteração de banco, migration, RPC ou RLS

## Regras aplicáveis

- Nunca registrar senhas, JWTs, tokens, payloads de cartão ou PII desnecessária.
- Falha da sonda nunca pode travar a aplicação (fail-open).
- Sonda básica não acessa dados de tenant nem exige sessão autenticada.
- Nunca commit/push/PR/merge sem o gate correspondente.
- Sempre `git diff --check` antes de commit.
- Distinguir EVIDENCE / INTERPRETATION / GAP / DECISION / STATUS.

---

## AUDIT

### EVIDENCE — inventário do que já existe (varredura de `src/`, `pages/`, `hooks/`, `domain/`, `application/`, `supabase/functions/`)

| Ativo | Localização | O que faz | Serve para health check? |
|---|---|---|---|
| `useOnlineStatus` | `src/hooks/useOnlineStatus.ts` | `navigator.onLine` + eventos `online`/`offline` | Não — só conectividade do browser, sem backend nem latência |
| `OfflineStatusBanner` | `src/components/offline/OfflineStatusBanner.tsx` | Banner de UI baseado no hook acima | Não — apresentação |
| `Observability` | `pages/Observability.tsx` + `src/lib/observability/*` | Dashboard de eventos, outbox, alertas, replay | Não — telemetria de domínio, não disponibilidade |
| `redact` | `src/lib/observability/redact.ts` | Sanitização fail-open de PII/segredos | **Sim** — reutilizado no log de falha |
| `logSupabaseError` | `src/lib/supabase/errors.ts` | Log estruturado de erro já redigido | **Sim** — reutilizado como `onFailure` padrão |
| `getSharedClient` | `src/lib/supabase/client.ts` | Client do schema `public` | **Sim** — base da leitura HEAD |
| `hasSupabaseEnv` | `src/lib/supabase/client.ts` (linha 15) | Detecta env do Supabase | **Sim** — porém era `const` privado |
| `isLocalDemoEnabled` | `src/lib/supabase/client.ts` | Exige hostname `localhost`; decide demo | Não — depende de `window`, não serve em teste/SSR |
| `supabase-usage-monitor` | `supabase/functions/supabase-usage-monitor/` | Edge Function de uso/quotas com JWT | Não — exige autenticação e secret; fora do escopo |
| Timeout compartilhado | — | **Não existe** | Implementado local e minimalmente |
| Endpoint `/health` | — | **Não existe** (nenhuma rota) | Fora do escopo autorizado |
| Tipo `healthy \| degraded \| down` | — | **Não existe** | Criado na sonda |

### INTERPRETATION

- Não há sobreposição funcional: nada no repositório mede latência de backend nem classifica disponibilidade. Não se trata de duplicação.
- `hasSupabaseEnv` é a única fonte confiável para "existe backend configurado?" e estava privado. Duplicar a checagem de env criaria divergência; por isso foi **exportado** (mudança de 1 token, sem alteração de comportamento).
- `isLocalDemoEnabled()` só é avaliável no browser; a sonda usa `!hasSupabaseEnv`, que cobre demo e ambiente sem configuração de forma determinística e testável.
- `logSupabaseError` já aplica `redact.ts`; usá-lo evita segunda regra de sanitização.

### GAP

- Não há ambiente de staging para medir latência real nesta subfase; os limiares (1000 ms saudável / 3000 ms timeout) são heurísticos e documentados como configuráveis.
- A leitura HEAD em `tenants` depende da política RLS existente; se a política for removida, a sonda continua provando conectividade (HTTP 200 sem linhas), mas deixa de provar acesso autenticado — comportamento intencional e documentado.
- `npm ci` reporta aviso de install-scripts não cobertos (core-js, esbuild, supabase postinstall); build e testes não são afetados.

---

## CLASSIFY

| Dimensão | Classificação |
|---|---|
| Tipo | Feature de confiabilidade (observabilidade operacional) |
| Risco | Baixo — módulo puro, sem rede obrigatória, fail-open |
| Superfície | 1 arquivo novo de código + 1 teste + 1 doc + 1 export |
| Banco | Nenhuma alteração (sem migration/RPC/RLS/schema) |
| Multi-tenant | Agnóstico: não recebe nem filtra `tenant_id`; HEAD não retorna linhas |
| Segurança | Sem `service_role`, sem tokens, retorno sem stack/erro; log redigido |
| Dependências | Nenhuma nova |
| ADR | Não requerido — utilitário dentro de `src/lib`, sem Repository/Service/camada/abstração nova |
| Gate | Commit/PR exigem autorização do PO |

---

## IMPLEMENT

### Arquivos

| Arquivo | Ação | Linhas |
|---|---|---|
| `src/lib/health/healthCheck.ts` | criado | 104 |
| `src/lib/health/healthCheck.test.ts` | criado | 159 |
| `docs/health-checks.md` | criado | 99 |
| `src/lib/supabase/client.ts` | modificado (`export const hasSupabaseEnv`) | +1/−1 |
| `docs/audit/FRONT_MANIFEST_FASE_6_9_HEALTH_CHECKS.md` | criado | este arquivo |

### Contrato implementado

```ts
checkHealth(options?): Promise<{ status: 'healthy' | 'degraded' | 'down'; latencyMs: number; timestamp: string }>
```

- `healthy`: resposta sem erro com latência ≤ `HEALTH_HEALTHY_MAX_MS` (1000 ms).
- `degraded`: resposta sem erro acima do limiar **ou** sem backend configurado (demo).
- `down`: erro no payload, rejeição, throw síncrono ou timeout (`HEALTH_TIMEOUT_MS` = 3000 ms).
- Sonda padrão: `getSharedClient().from('tenants').select('id', { head: true })`.
- Fail-open em três camadas: `onFailure` protegido por try/catch; `checkHealth` inteiro protegido; retorno sempre sanitizado.
- Injeção de `probe`/`now`/`timeoutMs`/`onFailure` para teste, sem mock de funções puras.

---

## VALIDATE

| Comando | Resultado | Exit |
|---|---|---|
| `npx vitest run src/lib/health/healthCheck.test.ts` | 1 arquivo / **11 testes** passed | 0 |
| `npm run test` | **103 arquivos / 1824 testes** passed | 0 |
| `npx tsc --noEmit --pretty false` | sem saída | 0 |
| `npm run build` | 3113 módulos, `dist/` gerado | 0 |
| `git diff --check` | sem saída | 0 |
| `npx biome check src/lib/health src/lib/supabase/client.ts` | 0 diagnósticos nos arquivos novos; 2 erros + 26 warnings **pré-existentes** em `client.ts` (`noThenProperty` demos, `noExplicitAny`, `noNonNullAssertion`) | advisory |

### Diff isolado

```
 M src/lib/supabase/client.ts   (1 insertion, 1 deletion)
?? docs/health-checks.md
?? docs/audit/FRONT_MANIFEST_FASE_6_9_HEALTH_CHECKS.md
?? src/lib/health/
```

Nenhuma alteração em `supabase/`, `domain/commission/`, `application/cashClosing/`, workflows ou `ROADMAP.md`.

---

## Log de transições

| Data | Transição | Ator | Observação |
|------|-----------|------|------------|
| 2026-10-23 | INTAKE | Sisyphus | Subfase 6.9 selecionada pelo PO |
| 2026-10-23 | ISOLATE | Sisyphus | Worktree `feat/fase6-6-9-health-checks` criada de `origin/main` (`cbdb33e`); `npm ci` concluído |
| 2026-10-23 | AUDIT | Sisyphus | Inventário de health/status, cliente Supabase e padrões de teste; nenhuma sobreposição encontrada |
| 2026-10-23 | CLASSIFY | Sisyphus | Risco baixo; sem ADR; sem banco; gate de commit obrigatório |
| 2026-10-23 | IMPLEMENT | Sisyphus | Sonda, testes, doc e export de `hasSupabaseEnv` |
| 2026-10-23 | VALIDATE | Sisyphus | typecheck 0 · unit 1824/1824 · build 0 · diff-check 0 · biome sem achados novos |
| 2026-10-23 | COMMIT | Sisyphus | `723dd5b` feat(health): sonda + testes + doc + export de `hasSupabaseEnv` |
| 2026-10-23 | PUSH / PR_OPEN | Sisyphus | Autorizados pelo PO; execução imediata após este commit |

**STATUS:** PR_OPEN — CI em monitoramento; merge aguarda autorização
