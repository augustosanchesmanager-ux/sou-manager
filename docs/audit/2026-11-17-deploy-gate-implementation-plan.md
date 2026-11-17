# Plano cirúrgico — Gate de Deploy Pré-Atribuição

**Data:** 2026-11-17
**Status:** 📋 **Plano aprovado para revisão — NÃO EXECUTADO**
**Decisão que origina este plano:** [ADR-049](../adr/ADR-049-deploy-gate-pre-atribuicao.md) (Accepted, 2026-11-17)
**Alvo:** `.github/workflows/deploy-production.yml`
**Natureza da mudança:** **CI** — exige autorização explícita do PO antes de qualquer edição. Nenhum byte do workflow foi alterado por este documento.

---

## 1. Estado atual (verificado no arquivo, não presumido)

Três jobs encadeados (`deploy-production.yml`, 301 linhas):

| Job | Linhas | `needs` | Gate | O que faz |
|---|---|---|---|---|
| `resolve-validate` | 51–112 | — | — | Guardrails de entrada, resolve `project`/`domain`, decide `promote` |
| `promote` | 114–190 | `resolve-validate` | `environment: Production` | Guard anti-regressão + **`vercel promote`** — **move os aliases públicos** |
| `post-validate` | 192–301 | `resolve-validate`, `promote` | `environment: Production` | Health check + E2E smoke **contra o domínio** |

O defeito, em uma frase: **a linha 188 (`vercel promote`) executa antes de qualquer validação de fumaça.** O smoke da linha 258 roda contra `needs.resolve-validate.outputs.domain` (linha 253) — ou seja, contra `https://barber.soumanager.com`, já servindo o candidato.

Consequência medida: `65a13d4` e `8686463` serviram produção com `post-validate` em `cancelled`/`waiting`. Cancelar o run **não** desfaz o alias.

## 2. Fatos descobertos que moldam o desenho

Verificados em 2026-11-17, read-only:

| # | Fato | Como foi verificado | Impacto no desenho |
|---|---|---|---|
| F1 | O Environment `Production` tem `required_reviewers`, e **os dois jobs** (`promote` L120–122 e `post-validate` L198) declaram esse environment | `gh api .../environments` → `Production: ["required_reviewers"]` | **São duas aprovações humanas por promoção.** A segunda é justamente a que ficou em `waiting`/`cancelled` |
| F2 | Todos os secrets do workflow são **de repositório** (`VERCEL_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) | `gh api .../actions/secrets` | `post-validate` pode **perder** o `environment: Production` sem perder acesso a secret |
| F3 | O candidato é **publicamente acessível**: HTTP `200` sem autenticação | `Invoke-WebRequest https://smg-barber-3yekwqdhd-….vercel.app` → `200`, `server: Vercel` | Deployment Protection **não** bloqueia `target=production`. O smoke pré-atribuição é viável |
| F4 | O smoke **não** tem domínio hardcoded | grep em `tests/e2e/smoke/core.spec.ts` → zero ocorrências de `soumanager.com`/`vercel.app`/`http(s)://` | `PLAYWRIGHT_BASE_URL` aponta para o deployment sem editar teste |
| F5 | `playwright.config.ts` já suporta URL publicada | `playwright.config.ts:4` → `isDeployedUrl` desliga o `webServer` | Nenhuma alteração de config necessária |
| F6 | `VERCEL_TEAM_SCOPE` **não existe** como secret | ausente em repo e em `Production` | Hoje o promote roda **sem** `--scope` e funciona (token já é do time). Ver GAP-2 |
| F7 | A API v13 responde **sem** `teamId` com token de time | `GET /v13/deployments/dpl_JDdQ…` sem `teamId` → `200`, `sha=3ea41c5…` | Checagem de convergência é viável sem infra nova |

## 3. Desenho alvo

```
resolve-validate            (inalterado — guardrails + resolve project/domain/promote)
        │
        ▼
pre-validate                NOVO — só quando promote == 'true'
   ├─ resolve deployment_url → id, url, readyState, sha   (API v13)
   ├─ espera readyState == READY                          (poll, timeout)
   ├─ health check HTTP 200 na URL do CANDIDATO
   ├─ checkout + node + npm ci + playwright
   └─ E2E smoke com PLAYWRIGHT_BASE_URL = URL do CANDIDATO
        │
        ▼  (só com pre-validate == success)
promote                     Environment: Production  ← ÚNICA aprovação humana
   ├─ guard anti-regressão (GITHUB_SHA == HEAD de main)
   ├─ aviso de deployment defasado (não bloqueante, rollback)
   └─ vercel promote <id>   ← primeiro momento em que o alias se move
        │
        ▼
post-validate               needs: [resolve-validate, promote] · if: always()
   ├─ health check no DOMÍNIO público
   └─ convergência: alias → deploymentId → meta.githubCommitSha == esperado
```

Ganho de governança além da ordem: **o PO aprova depois de ver a validação verde.** Hoje ele aprova (`promote`) sem que nenhum smoke tenha rodado; o smoke vem depois e pode nem acontecer.

## 4. Mudanças cirúrgicas, job por job

### 4.1 `resolve-validate` (L51–112) — **sem alteração**

Mantém guardrails, `authorization_ref` obrigatório, `dry_run=true` por padrão, `confirm` idêntico ao projeto e `deployment_url` obrigatório quando `dry_run=false`.

Adicionar em `outputs` (L55–59), para uso do novo job:

```yaml
      deployment_url: ${{ steps.guard.outputs.deployment_url }}
```

e no bloco `Guardrails` (após L95):

```bash
          echo "deployment_url=$DEPLOYMENT_URL" >> "$GITHUB_OUTPUT"
```

### 4.2 `pre-validate` — **novo job**, inserido entre `resolve-validate` e `promote`

```yaml
  pre-validate:
    name: pre-validate (candidato isolado, sem alias)
    needs: resolve-validate
    if: needs.resolve-validate.outputs.promote == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    outputs:
      deployment_id: ${{ steps.resolve.outputs.deployment_id }}
      candidate_url: ${{ steps.resolve.outputs.candidate_url }}
      candidate_sha: ${{ steps.resolve.outputs.candidate_sha }}
    steps:
      - name: Resolver candidato (id, url, sha) e esperar READY
        id: resolve
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          DEPLOYMENT_URL: ${{ needs.resolve-validate.outputs.deployment_url }}
        run: |
          set -euo pipefail
          for i in $(seq 1 60); do
            BODY=$(curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
              "https://api.vercel.com/v13/deployments/${DEPLOYMENT_URL}")
            STATE=$(echo "$BODY" | jq -r '.readyState // "unknown"')
            if [ "$STATE" = "READY" ]; then break; fi
            if [ "$STATE" = "ERROR" ] || [ "$STATE" = "CANCELED" ]; then
              echo "::error::Candidato em estado $STATE — promocao abortada."
              exit 1
            fi
            echo "readyState=$STATE — tentativa $i/60, retry em 10s..."
            sleep 10
            [ "$i" = "60" ] && { echo "::error::Timeout aguardando READY."; exit 1; }
          done
          ID=$(echo "$BODY" | jq -r '.id')
          URL=$(echo "$BODY" | jq -r '.url')
          SHA=$(echo "$BODY" | jq -r '.meta.githubCommitSha // empty')
          TARGET=$(echo "$BODY" | jq -r '.target // "null"')
          echo "Candidato: id=$ID url=$URL sha=$SHA target=$TARGET"
          if [ "$TARGET" != "production" ]; then
            echo "::warning::Candidato nao e target=production ($TARGET). Promocao de preview pode carregar env de preview."
          fi
          echo "deployment_id=$ID" >> "$GITHUB_OUTPUT"
          echo "candidate_url=https://$URL" >> "$GITHUB_OUTPUT"
          echo "candidate_sha=$SHA" >> "$GITHUB_OUTPUT"

      - name: Health check no CANDIDATO (nao no dominio)
        env:
          CANDIDATE: ${{ steps.resolve.outputs.candidate_url }}
        run: |
          set -euo pipefail
          for i in $(seq 1 30); do
            CODE=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 15 "$CANDIDATE" || echo "000")
            if [ "$CODE" = "200" ]; then echo "Health check PASSED (HTTP 200) em $CANDIDATE"; exit 0; fi
            echo "Tentativa $i/30 — HTTP $CODE, retry em 10s..."
            sleep 10
          done
          echo "::error::Health check FALHOU no candidato $CANDIDATE"
          exit 1

      - name: Checkout (smoke)
        uses: actions/checkout@v4
      - name: Setup Node (smoke)
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Write .env.local for E2E helpers
        run: |
          printf 'VITE_SUPABASE_URL=%s\n' "$VITE_SUPABASE_URL" > .env.local
          printf 'VITE_SUPABASE_ANON_KEY=%s\n' "$VITE_SUPABASE_ANON_KEY" >> .env.local
          printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$SUPABASE_SERVICE_ROLE_KEY" >> .env.local
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Smoke E2E contra o CANDIDATO (antes do alias)
        env:
          CI: "true"
          PLAYWRIGHT_BASE_URL: ${{ steps.resolve.outputs.candidate_url }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: npm run test:e2e:smoke

      - name: Publicar artefatos do Playwright em falha
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-prevalidate-artifacts
          path: |
            test-results/
            playwright-report/
          retention-days: 7
          if-no-files-found: ignore
```

**Sem `environment:`** de propósito: validação é read-only, não deve consumir aprovação humana.

### 4.3 `promote` (L114–190) — **uma linha alterada**

```yaml
  promote:
    name: promote (requer aprovacao do Environment)
    needs: [resolve-validate, pre-validate]          # ← era: resolve-validate
    if: needs.resolve-validate.outputs.promote == 'true' && needs.pre-validate.result == 'success'
```

O `if` passa a ser **explícito**. Sem `needs.pre-validate.result == 'success'`, o GitHub aplica `success()` implicitamente — funciona, mas a intenção fica invisível para quem lê.

**Nada mais muda** neste job: `environment: Production` (L120–122), guard anti-regressão (L134–145), aviso defasado (L147–174) e `vercel promote` (L176–190) permanecem byte a byte. O `deployment_url` pode ser trocado por `needs.pre-validate.outputs.deployment_id` — **recomendado**, para promover exatamente o artefato validado em vez de reprocessar a string do input:

```yaml
          DEPLOYMENT_URL: ${{ needs.pre-validate.outputs.deployment_id }}
```

### 4.4 `post-validate` (L192–301) — perde a aprovação, ganha convergência

1. **Remover** `environment: Production` (L198). Fundamentado em F2 (todos os secrets são de repositório). **Requer confirmação do PO** — é redução da superfície de aprovação (D1).
2. **`needs`** passa a `[resolve-validate, promote, pre-validate]` (para a convergência saber o SHA validado).
3. Health check e smoke existentes: **smoke é removido daqui** (já rodou em `pre-validate` contra o candidato). Health check permanece.
4. **Novo step de convergência**, após o health check:

```yaml
      - name: Convergencia — alias serve o SHA promovido
        if: needs.promote.result == 'success'
        continue-on-error: true
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          DOMAIN_HOST: ${{ needs.resolve-validate.outputs.domain }}
          EXPECTED_SHA: ${{ needs.pre-validate.outputs.candidate_sha }}
        run: |
          set -uo pipefail
          HOST="${DOMAIN_HOST#https://}"
          DEPID=$(curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
            "https://api.vercel.com/v4/aliases/$HOST" | jq -r '.deploymentId // empty')
          if [ -z "$DEPID" ]; then echo "::warning::Nao foi possivel resolver o alias $HOST."; exit 0; fi
          SERVED=$(curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
            "https://api.vercel.com/v13/deployments/$DEPID" | jq -r '.meta.githubCommitSha // empty')
          echo "alias $HOST -> $DEPID -> sha=$SERVED (esperado=$EXPECTED_SHA)"
          if [ -n "$EXPECTED_SHA" ] && [ "$SERVED" != "$EXPECTED_SHA" ]; then
            echo "::warning::Alias serve sha diferente do candidato validado. Investigar propagacao."
          fi
```

`continue-on-error: true` porque a resolução do alias depende de permissão de API (**GAP-2**). O gate duro continua sendo `pre-validate`; convergência é observabilidade, não contenção.

5. `Trilha de auditoria` (L260–290): acrescentar `pre-validate` e o SHA do candidato ao `$GITHUB_STEP_SUMMARY`.

## 5. Decisões que precisam do PO antes de implementar

| ID | Decisão | Recomendação |
|---|---|---|
| **D1** | Remover `environment: Production` do `post-validate`? | **Sim.** Elimina a 2ª aprovação que produziu o buraco `waiting`/`cancelled`; F2 garante que não há perda de secret |
| **D2** | `pre-validate` roda em `dry_run=true`? | **Não.** Dry-run continua auditoria pura (custo de CI + smoke sem propósito) |
| **D3** | `deployment_url` continua obrigatório no input? | **Sim.** O alvo explícito é trilha de auditoria; o job apenas normaliza e valida |
| **D4** | Candidato com `target != production`: bloqueia ou avisa? | **Avisa** (`::warning::`). Bloquear quebraria o rollback documentado (promover deployment anterior é `target=production`, então o aviso cobre o caso real) |
| **D5** | Smoke sai do `post-validate`? | **Sim.** Rodar duas vezes só duplica custo; a URL do candidato é o alvo fiel |

## 6. Riscos e direção da falha

| Risco | Severidade | Mitigação |
|---|---|---|
| Smoke falha no candidato por diferença cookie/CORS/redirect vs domínio → **falso negativo** | Média | Executar `pre-validate` em **dry-run de ensaio** antes do primeiro promote real (ver §7). A falha **bloqueia o deploy** — produção fica no SHA anterior. Falha na direção segura |
| Deployment Protection ativada no futuro bloqueia o candidato | Média | F3 prova o estado atual (`200`). Adicionar o health check do candidato como **detector**: passará a falhar o job, sinalizando a mudança de configuração |
| Resolução de alias exige `teamId` que não existe como secret | Baixa | Convergência é `continue-on-error` (GAP-2) |
| Aprovação humana passa a ocorrer **depois** do smoke → mais tempo entre dispatch e publicação | Baixa | Custo aceito; o objetivo é justamente decidir com evidência |
| `timeout-minutes: 15` insuficiente com smoke + poll de build | Média | `pre-validate` declara `20`; `promote` e `post-validate` ficam em `15` |

## 7. Plano de validação antes do primeiro promote real

1. **YAML válido:** `npx --yes yaml-lint` ou parse por `ruby -ryaml`; conferir que `needs`/`outputs` referenciam nomes existentes.
2. **Ensaio com `dry_run=true`:** `pre-validate` não roda (D2) — confirma apenas que `resolve-validate` continua idêntico em comportamento.
3. **Ensaio real controlado:** dispatch com `dry_run=false` e `deployment_url` de um deployment **já em produção** (rollback documentado). O `promote` reposiciona o alias no mesmo SHA que já está lá (efeito nulo) e o `pre-validate` roda o smoke de verdade contra a URL do candidato. **É a prova de F3/F4/F5 sem risco de trocar o código em produção.**
   - Requer aprovação do PO + reviewer no Environment `Production` (2 gates humanos: dispatch e aprovação).
   - Requer `authorization_ref` preenchido com a referência desta frente.
4. **Rollback do ensaio:** se algo divergir, `vercel promote` no deployment anterior (mesmo procedimento documentado em `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md`).
5. **Primeira promoção real** só depois do ensaio 3 verde.

## 8. GAP

1. **Não há prova de que o smoke passe contra uma URL de deployment.** F3/F4/F5 tornam provável, não demonstrado. O ensaio do §7.3 é o teste.
2. **`VERCEL_TEAM_SCOPE` não existe** (F6) e o workflow o referencia em L152/L179 — hoje resolve para string vazia e o promote funciona porque o token já é do time. Isso é dívida pré-existente, **não** introduzida por este plano. A checagem de convergência depende do mesmo caminho de auth.
3. **Credenciais do smoke em CI contra produção:** o smoke faz login real no Supabase de produção (`SUPABASE_SERVICE_ROLE_KEY`). Já é o comportamento atual (L249–258); o plano não altera essa superfície, apenas antecipa o momento.
4. **Custo de CI:** o smoke passa a rodar 1× por promoção em vez de 1× — mas em ~2 min mais cedo. Se `pre-validate` e `post-validate` rodarem ambos, o custo **dobra**; D5 elimina isso.

## 9. Fora de escopo (explícito)

- Alterar `commandForIgnoringBuildStep` — **proibido** por ADR-049 R2.
- Qualquer `vercel --prod` / `deploy --prod` por CLI — proibido por `AGENTS.md` (D).
- Alterar `ci.yml`, `playwright.config.ts`, specs de smoke ou Page Objects.
- Alterar o Environment `Production`, reviewers ou branch protection.
- Aplicar qualquer coisa em produção durante a implementação.

---

**Nenhuma alteração executada.** Aguarda autorização do PO para a frente de implementação de CI.
