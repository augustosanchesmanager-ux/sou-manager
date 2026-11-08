# Relatório Formal — Blindagem da Governança de Deploy de Produção

> **Data de Conclusão:** 2026-11-08<br />
> **Status:** 🟢 **IMPLEMENTADO, VALIDADO E MERGEADO EM `main`** (PRs #269 e #271)<br />
> **Responsável Formal:** Augusto (PO)<br />
> **Produto Comercial Ativo:** SMG Barber (*The Barbershop Intelligence*)<br />
> **Precedência Normativa:** `AGENTS.md` (Fonte Única da Verdade) · SMG Change Control Protocol<br />
> **Invariantes:** `MERGE ≠ DEPLOY PROD` (ADR-026) · Deploy de produção apenas pelo workflow controlado · `MERGE ≠ DEPLOY PROD` verificado por evidência, não por documentação

---

## 1. Sumário Executivo

A documentação de governança afirmava que `MERGE ≠ DEPLOY PROD` era "assegurado fisicamente na infraestrutura (Vercel com auto-deploy de produção desacoplado da branch `main`)". A auditoria read-only provou o contrário: o projeto Vercel `smg-barber` tinha `productionBranch = main`, `createDeployments = enabled` e **nenhum Ignored Build Step**, ou seja, todo merge em `main` publicava produção em ~2 minutos, em paralelo ao workflow de promoção controlada.

Esta frente corrigiu a divergência em três camadas:

1. **Infraestrutura (ação do PO):** Ignored Build Step aplicado na Vercel, abortando apenas builds de produção e preservando previews.
2. **Workflow (PR #269):** `timeout-minutes: 15` em todos os jobs, guard anti-regressão bloqueante antes do `vercel promote` e aviso não bloqueante de deployment defasado.
3. **Documentação (PRs #269 e #271):** `AGENTS.md` passa a descrever a mecânica real, a verificação do bloqueio e a proibição de deploy por CLI.

O controle foi **comprovado empiricamente duas vezes** após a aplicação: os deployments Git dos merges `577237a` e `69d2011` terminaram em `CANCELED`, sem tocar produção.

---

## 2. Escopo e Método

- **Read-only na investigação:** apenas `GET` na API Vercel (v6/v9/v13), `gh api`, `git log`/`git show`. Nenhuma migration, nenhuma variável de ambiente, nenhuma regra de negócio alterada.
- **Escopo de código:** `.github/workflows/deploy-production.yml` e `AGENTS.md` — nada além.
- **Fora de escopo:** banco de dados, RLS/RPC, produto, frontend.

---

## 3. Evidências

### 3.1 Configuração do projeto `smg-barber` antes da correção

| Campo | Valor observado |
|---|---|
| `link.productionBranch` | `main` |
| `gitProviderOptions.createDeployments` | `enabled` |
| `commandForIgnoringBuildStep` | **ausente** (nenhum Ignored Build Step) |
| `ignoreCommand` (`vercel.json`) | ausente — `vercel.json` contém apenas `rewrites` |
| `requireVerifiedCommits` | `true` |
| `ssoProtection` | `all_except_custom_domains` |
| Domínios do projeto | `smg-barber.vercel.app` · `barber.soumanager.com` |

### 3.2 Produção publicada automaticamente a cada merge

| Criado (UTC) | SHA | Ref |
|---|---|---|
| 2026-11-06T10:15Z | `39122a7` | `feat/landing-barber-intelligence` ⚠️ branch de feature |
| 2026-11-06T10:53Z | `228b2b0` | `main` |
| 2026-11-06T13:03Z | `c22d4b8` | `main` |
| 2026-11-07T16:01Z | `001d265` | `main` |
| 2026-11-08T04:30Z | `e4cfa51` | `main` |
| 2026-11-08T04:37Z | `8a1240d` | `main` |
| 2026-11-08T05:00Z | `db6fbb7` | `main` |

### 3.3 Job travado por ~48h

Run `42207840032` (`Deploy Production (Promote Controlado)`):

| Job | Início | Fim |
|---|---|---|
| `resolve & validate` | 2026-11-06T11:10:06Z | 11:10:10Z |
| `promote` (aprovado) | 2026-11-06T11:12:13Z | 11:12:35Z |
| `post-validate` | 2026-11-06T11:12:35Z | **2026-11-08T04:29:42Z** |

Sem `timeout-minutes`, o job permaneceu pendurado até falhar dois dias depois.

### 3.4 Prova de eficácia após a correção

| Momento (UTC) | Evento | Estado |
|---|---|---|
| 2026-11-08T09:08:26Z | Merge do PR #269 → `577237a` | — |
| 2026-11-08T09:08:29Z | Deployment Git do merge (`target: production`, `verified`) | **`CANCELED`** |
| 2026-11-08T09:08:52Z | Deployment **CLI** (`source: cli`, actor `antigravity`, SHA `46144ec`) | `READY` ⚠️ |
| 2026-11-08T10:30:49Z | Merge do PR #271 → `69d2011` | — |
| 2026-11-08T10:30:52Z | Deployment Git do merge (`target: production`, `verified`) | **`CANCELED`** |

O Ignored Build Step configurado:

```bash
if [ "$VERCEL_ENV" = "production" ]; then echo "production: only via promote controlado"; exit 0; fi; exit 1
```

Semântica confirmada na documentação oficial da Vercel: `exit 0` **cancela** o build; `exit 1` o mantém.

---

## 4. Mudanças Entregues

### PR #269 — `577237a` (merge 2026-11-08T09:08:26Z)

`.github/workflows/deploy-production.yml`:

- `timeout-minutes: 15` em `resolve-validate`, `promote` e `post-validate`.
- Guard bloqueante antes de `vercel promote`: resolve o HEAD de `main` via `gh api repos/${GITHUB_REPOSITORY}/git/ref/heads/main`, compara com `$GITHUB_SHA` e aborta com `exit 1` e a mensagem `🚨 Regressão evitada: O commit que você está tentando promover não é o mais recente da main`.
- Aviso não bloqueante (`continue-on-error: true`): compara `meta.githubCommitSha` do deployment alvo com o HEAD de `main` e emite `::warning::` — preserva o rollback documentado em `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md`.

`AGENTS.md`:

- Corrigida a afirmação de desacoplamento físico.
- Documentada a mecânica real (A) produção = `main`, (B) bloqueio por Ignored Build Step com verificação de `commandForIgnoringBuildStep`, (C) caminho único via workflow com aprovação.
- Registrado que previews de commit não assinado ficam `BLOCKED` por `requireVerifiedCommits = true`.

### PR #271 — `69d2011` (merge 2026-11-08T10:30:49Z)

`AGENTS.md` (+3 linhas):

- Regra explícita proibindo `vercel --prod` / `vercel deploy --prod` por CLI.
- Item (D) da mecânica: assinatura de detecção do bypass (`source: "cli"`, `meta.actor` preenchido, `meta.githubCommitVerification` ausente) e registro do incidente de 2026-11-08.

---

## 5. Validação

| Verificação | Resultado |
|---|---|
| `git diff --check` (ambos os PRs) | exit 0 |
| Parse YAML (`js-yaml`) | OK — 3 jobs, todos com `timeout-minutes: 15` |
| Ordem dos steps do `promote` | `Verificar VERCEL_TOKEN` → `Guard anti-regressao` → `Aviso deployment alvo` → `vercel promote` |
| Mensagem exata do guard em `main` | presente (verificada lendo o objeto git, sem passar pelo shell) |
| Endpoint do guard contra o repositório real | HEAD da `main` igual a `origin/main` — passaria |
| CI dos PRs | `validate` pass · `unit` pass · `build` pass · `typecheck` pass · `architecture:ci` pass |
| Eficácia do bloqueio | 2 merges → 2 deployments `CANCELED` |

**Nota sobre o CI:** as primeiras tentativas de ambos os PRs falharam em `npm ci` por `504 Gateway Time-out` no CDN de releases do GitHub ao baixar o CLI Supabase (`v2.95.6`, erro `Z_DATA_ERROR: incorrect header check`). Falha de infraestrutura, não de lógica — o upstream foi confirmado indisponível por requisição externa. **Nenhum override foi aplicado**: `docs/runbooks/ci-gate-override.md` §3 veda override em gate mandatório (`unit`), e o merge aguardou o gate verde.

---

## 6. Achados

| # | Achado | Severidade | Estado |
|---|---|---|---|
| 1 | `AGENTS.md` descrevia desacoplamento físico inexistente (drift documental) | Alto | Corrigido (#269) |
| 2 | Todo merge em `main` publicava produção automaticamente | Alto | Corrigido (Ignored Build Step) |
| 3 | Workflow aceitava promoção de SHA antigo (risco de regressão) | Alto | Corrigido (#269, guard bloqueante) |
| 4 | `post-validate` sem timeout ficou ~48h pendurado | Médio | Corrigido (#269) |
| 5 | Deploy por CLI (`vercel --prod`) ignora o Ignored Build Step | Alto | **Documentado (#271); não fechado tecnicamente** |
| 6 | `requireVerifiedCommits = true` mantém todo preview de commit não assinado em `BLOCKED` | Médio | Documentado (#269) |
| 7 | Deployment de produção a partir de branch de feature (`39122a7`, 06/11) | Alto | Registrado; causa raiz não determinada |

---

## 7. Riscos Residuais e GAP

1. **Bypass por CLI permanece tecnicamente aberto.** A proibição é normativa. Fechar exige restringir permissões de deploy na Vercel (decisão de infraestrutura do PO).
2. **Produção está um commit atrás de `main` por SHA** (`46144ec` vs `69d2011`). Delta funcional zero: as mudanças são apenas `AGENTS.md` e `.github/workflows/`, que não entram no bundle Vite.
3. **Previews não são publicados** para commits sem assinatura verificada pelo GitHub.
4. **`timeout-minutes: 15` no `post-validate`** pode ser apertado em cenário de health check lento (até 300s) somado a `npm ci` + Playwright + smoke.
5. **O guard bloqueia a run se `main` avançar durante a espera de aprovação** do Environment — comportamento anti-regressão desejado, com atrito operacional conhecido.
6. **`docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md`** ainda não menciona o guard anti-regressão (fora do escopo autorizado).

---

## 8. Decisões e Rastreabilidade

| Data | Decisão | Registro |
|---|---|---|
| 2026-11-08 | Alinhar documentação à infra real e blindar o workflow (Opção B, com corte por Ignored Build Step) | PR #269 |
| 2026-11-08 | Aplicar Ignored Build Step na Vercel (produção bloqueada, previews preservados) | Ação do PO, confirmada via API |
| 2026-11-08 | Documentar proibição de deploy por CLI e registrar o bypass | PR #271 |

**Authorization Records:** presentes nos corpos dos PRs #269 e #271 (`authorized_by: Augusto (PO)`, `target_env: ci`, `deploy_approved: false`).

---

## 9. Rollback

- **Workflow/docs:** reverter os merges `577237a` e `69d2011` restaura o comportamento anterior.
- **Infraestrutura:** limpar o campo `commandForIgnoringBuildStep` na Vercel reativa o auto-deploy de produção (reversível em um campo).
- Nenhum estado de produção foi alterado por esta frente.

---

## 10. Próximos Passos Recomendados

1. Auditar permissões da Vercel (quem consegue deployar) e restringir o caminho CLI.
2. Atualizar `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md` com o guard anti-regressão.
3. Alinhar produção ao HEAD de `main` via promoção controlada, quando houver mudança funcional (hoje o delta é nulo).
4. Investigar a origem do deployment de produção a partir de branch de feature (`39122a7`).
