# P-AUTO — ISOLATE / CHECKPOINT DE ISOLAMENTO

> **Frente:** P-AUTO (dívida change-control: `MERGE ≠ DEPLOY PROD` — arquitetura **A + C**)  
> **Gate:** `smg-change-control P-AUTO → ISOLATE` (autorizado pelo PO em 2026-09-24)  
> **Data:** 2026-09-24  
> **Modo:** isolamento local + artefatos documentais (untracked). **IMPLEMENT NÃO autorizado.**  
> **Manifest de entrada:** `docs/audit/P_AUTO_CLASSIFY_SCOPE_20260924.md`

---

## 1. Checkpoint PRÉ-isolamento (EVIDENCE)

| Item | Valor |
|------|-------|
| Branch | `docs/h3-h35-ressalva-resolvida` |
| HEAD | `3c0ed61` (docs encerramento H3-5+P1-01 — frente anterior) |
| `origin/main` | `5a28456` (fetch confirmado antes do isolamento) |
| Tracked (modified/staged) | **0 / 0** |
| Untracked | **354** (`git ls-files --others --exclude-standard`) |
| Relação `origin/main...HEAD` | 0 \| 1 (HEAD 1 commit à frente — docs da frente anterior, preservados na branch) |
| Risco de checkout | Diff `5a28456..3c0ed61` = 6 tracked modificados (M), **0 added / 0 deleted** → nenhum untracked em colisão |

---

## 2. Ação de isolamento

```bash
git checkout -b feature/p-auto-deploy-gate-a-c 5a28456
```

**Nome da branch de implementação:** `feature/p-auto-deploy-gate-a-c`  
**Origem:** `origin/main` = `5a28456` (e não a branch da frente anterior).

---

## 3. Checkpoint PÓS-isolamento (EVIDENCE)

| Item | Valor | Esperado |
|------|-------|----------|
| Branch atual | `feature/p-auto-deploy-gate-a-c` | ✅ |
| HEAD | `5a2845690dcee121e68427217249c0762d1c56f6` = `origin/main` | ✅ |
| Tracked modified/staged | **0 / 0** (`git status --porcelain --untracked-files=no`) | ✅ árvore limpa |
| `git diff --check` | sem saída (sem conflitos/espaços) | ✅ |
| Untracked | **354 → 354** (nenhum incorporado, nenhum perdido) | ✅ |
| Branch anterior preservada | `docs/h3-h35-ressalva-resolvida` → `3c0ed61` intacta | ✅ |
| Artefatos P-AUTO | 3 relatórios + ADR-026 permanecem **untracked** | ✅ |

**INTERPRETATION:** o isolamento não alterou nenhum tracked, não incorporou nenhum untracked alheio e não descartou trabalho existente.

---

## 4. As 7 exigências do PO — confirmação objetiva

| # | Exigência | Status | Evidência |
|---|-----------|--------|-----------|
| 1 | Branch nova criada a partir de `origin/main = 5a28456` | ✅ | `feature/p-auto-deploy-gate-a-c` @ `5a28456` (pós-`git fetch origin main`) |
| 2 | Working tree preservada, sem incorporar qualquer outro untracked | ✅ | untracked 354 = 354; tracked 0/0; nenhum `git add` executado |
| 3 | Nome definitivo da branch de produção registrado | ✅ | **`production`** — registrado no ADR-026 §Decision (A) |
| 4 | Proteção da branch de produção **definida** antes de qualquer implementação | ✅ (definida) / ⏳ (aplicada) | Especificação na §5 abaixo + ADR-026; **aplicação remota é mutação — pendente pós-validação** |
| 5 | Deploy Hook/secret **somente preparado** conforme escopo aprovado | ✅ (escopo preparado) / ⏳ (criação) | Escopo na §6 — 1 hook + 1 secret, nada além; **criação é mutação — pendente pós-validação** |
| 6 | ADR proposta **antes** da implementação, para decisão/registro | ✅ | `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` (**Status: Proposed**) |
| 7 | Nenhuma alteração em PROD, migrations, RPC, RLS ou código funcional | ✅ | tracked 0/0; `vercel.json` e `.github/workflows/` intocados; migrations untracked intocadas; nenhum PATCH/POST remoto; zero commits |

---

## 5. Branch de produção — nome e proteção (DEFINIDOS, não aplicados)

**Nome definitivo:** `production`  
*(Registro do PO: `production` ou alternativa — adotado `production` como default canônico; o PO pode substituir na validação deste gate.)*

**Especificação de branch protection (a aplicar IMEDIATAMENTE após autorização, ANTES de qualquer workflow/hook):**

| Regra | Valor |
|-------|-------|
| Required status checks | `validate` (strict: branch atualizada com `main`) |
| Required approving reviews | 1 (PO) |
| Dismiss stale reviews | true |
| Prevent force pushes | true |
| Prevent deletions | true |
| Enforce admins | true |
| Branch source | criada a partir de `5a28456` |

**Sequência de mutações futuras (somente após validação do ISOLATE + autorização):**
1. Push da branch `production` (remote) a partir de `5a28456`;
2. Aplicar a protection acima;
3. IMPLEMENT (workflow + secret + hook + PATCH Production Branch no Vercel).

---

## 6. Deploy Hook / secret — escopo PREPARADO (nada criado)

| Artefato | Escopo aprovado | Estado |
|----------|-----------------|--------|
| Deploy Hook Vercel | exatamente **1** hook no projeto `smg-barber`, branch `production` | não criado |
| Repo secret | exatamente **1** (`VERCEL_DEPLOY_HOOK_URL` — nome previsto; valor nunca em log/relatório) | não criado |
| Workflow GitHub | exatamente **1** novo (`workflow_dispatch` + environment approval) | não criado |
| Fora de escopo | outros hooks, environments, secrets, variáveis, `vercel.json`, mudanças em workflows existentes | proibido |

---

## 7. Artefatos desta frente (todos untracked)

| Arquivo | Papel |
|---------|-------|
| `docs/audit/P_AUTO_AUDIT_READONLY_20260924.md` | AUDIT |
| `docs/audit/P_AUTO_DESIGN_VALIDATION_20260924.md` | DESIGN VALIDATION |
| `docs/audit/P_AUTO_CLASSIFY_SCOPE_20260924.md` | CLASSIFY manifest |
| `docs/audit/P_AUTO_ISOLATE_20260924.md` | este checkpoint |
| `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` | ADR **Proposed** (decisão/registro do PO) |

Índice do `docs/adr/README.md` (linha do ADR-026) será atualizado na etapa de documentação/commit — manter árvore rastreada limpa durante os gates.

---

## 8. Exclusões reafirmadas (do CLASSIFY)

- **P-MIG**: 3 migrations untracked — intocadas, fora do escopo;
- **P-DV**: `.github/workflows/deploy-validate.yml` — intocado;
- ~110 untracked de outras frentes + tooling (`.opencode/`, `.omo/`, `.claude/`, `.agents/`) — não incorporados;
- `.env.local.bak_bom` — nunca commitar.

---

## 9. EVIDENCE / INTERPRETATION / GAP / DECISION / STATUS

**EVIDENCE:** branch `feature/p-auto-deploy-gate-a-c` @ `5a28456` = `origin/main` pós-fetch; tracked 0/0; `git diff --check` limpo; untracked 354→354; branch anterior `3c0ed61` intacta; ADR-026 Proposed; 0 commits, 0 mutações remotas, `vercel.json`/workflows intocados.

**INTERPRETATION:** frente isolada sem perda de trabalho alheio; as 7 exigências do PO estão cumpridas no nível local/documental; protection e hook estão **definidos/preparados**, com criação remota explicitamente adiada.

**GAP:** mutações remotas (push `production`, protection, secret, hook, PATCH Vercel) **não executadas** — exigem validação do PO + autorização de IMPLEMENT.

**DECISION:** aguardando validação do PO sobre este isolamento (e confirmação do nome `production`).

**STATUS: STOP — P-AUTO ISOLATE VALIDATION**

**Mutações:** 0 · **Commits P-AUTO:** 0 · **`origin/main`:** `5a28456` intacto · **IMPLEMENT:** não iniciado.
