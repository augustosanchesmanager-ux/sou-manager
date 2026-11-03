# P.02 — SMG-APPROVE TRUST BOUNDARY

> **Status:** Design ✅ aprovado pelo PO (2026-09-25) · **Implementação ✅ autorizada em gate próprio** · Fronteira atual: `contents: write` 🔒 bloqueado.
> **Natureza:** correção de 1 linha (escopo mínimo) no workflow `smg-approve`.
> **Pré-condição de:** qualquer concessão de `contents: write` / job `consume` / FASE 3A (T15).
> **Gate cycle obrigatório:** P.02 DESIGN ✅ → **STOP** → P.02 IMPLEMENTAÇÃO (1 linha → testes → readback) → **STOP** → somente então `contents: write` (ainda 🔒).
> **Regra de separação:** P.02 e T15 **nunca** no mesmo conjunto de alterações.

---

## 1. EVIDENCE (achado, com evidência de linha)

Arquivo: `.github/workflows/smg-approve.yml` (workflow atual — inalterado até aqui):

| Linha | Conteúdo | Problema |
|---|---|---|
| 40 | `ref: refs/pull/${{ github.event.issue.number }}/head` | checkout do código do PR — **zona não confiável** |
| 48 | executa `run.mjs` do working directory | ou seja, **a versão do PR**, não a do repositório |
| 53 | env `SMG_TOKEN: ${{ secrets.REVIEW_BOT_TOKEN }}` | PAT fine-grained ("Pull requests: Write") exposto ao código do PR |

Fato complementar (leitura integral, mesma data):

- `scripts/smg-pr-approve/run.mjs` consome **apenas** a GitHub API + `GITHUB_EVENT_PATH` (linhas 86–93). **Nenhum byte do checkout é usado pela lógica** — o checkout existe exclusivamente para obter o próprio script.
- Ordem de confiança do workflow: o arquivo `.yml` executado vem da **default branch** (comportamento do GitHub), mas o script `run.mjs` que ele invoca vem do **PR** — a lógica de negócio é o elo não confiável.
- Disparo: qualquer usuário pode comentar `/approve` em repositório público → executa a correção acima automaticamente.

## 2. INTERPRETATION (impacto)

- O autor de um PR controla o código executado com o `SMG_TOKEN` do bot ⇒ pode forjar a review `APPROVED` do `review-bot-smg`.
- Essa review é exatamente o **gate obrigatório de merge de `main`** (1 review) — logo o achado é **integridade de governança do próprio gate**, não execução em produção.
- A correção é barata justamente porque `run.mjs` não precisa do checkout do PR.

## 3. TRUST BOUNDARY (regra)

```text
ZONA CONFIÁVEL   = código da default branch + GITHUB_EVENT_PATH + dados brutos da API (sempre re-validados)
ZONA NÃO CONFIÁVEL = refs/pull/N/head, arquivos/artifacts/outputs do PR — nunca executados, nunca lidos como verdade
```

## 4. CORREÇÃO AUTORIZADA — Opção A (escolhida pelo PO)

```diff
 jobs:
   approve:
     steps:
-      - uses: actions/checkout@v4
-        with:
-          ref: refs/pull/${{ github.event.issue.number }}/head
+      - uses: actions/checkout@v4
+        with:
+          ref: ${{ github.event.repository.default_branch }}
```

- **Tamanho:** 1 linha (`ref:`).
- **Efeito:** `run.mjs` passa a vir da default branch (código confiável); `SMG_TOKEN` deixa de ser exposto a código do PR.
- **Sem efeito colateral:** lógica de `guards.mjs`/`run.mjs` intocada (provado: consomem só API+evento).

## 5. ACCEPTANCE / TEST STRATEGY

1. **Teste estático (novo, no suíte):** parse do `smg-approve.yml` → nenhum job referencia `refs/pull/*` em `checkout`; nenhum passo com `SMG_TOKEN` roda código fora da default branch.
2. **Teste estrutural de permissões:** `approve` = `contents: read`; job futuro `consume` = `contents: write` + `pull-requests: read`, sem `SMG_TOKEN`.
3. **Regressão:** `guards.test.mjs` + `run` verde (baseline 1421) — sem mudança semântica.
4. **Readback:** diff do commit contém **apenas** a linha `ref:` (escopo mínimo); `git diff --check` limpo; permissões do repo inalteradas.

## 6. OUT OF SCOPE (neste gate)

- ❌ `contents: write` · ❌ job `consume`/T15 · ❌ alterar `guards.mjs`/`run.mjs` · ❌ `SMG_GATE_RECORD_REQUIRED` · ❌ Authorization/Consumption Records · ❌ qualquer coisa fora da 1 linha + teste estático.

## 7. DEPENDÊNCIAS

```text
P.02 ✅ design → STOP → P.02 implementação (1 linha → testes → readback) → STOP
    → revisão do design final do consume
    → [PO] contents: write → T15 🔒 → FASE 3A 🔒
```

## 8. NOTA DE CORREÇÃO DOCUMENTAL

Uma intermediação deste documento citou por engano o caminho
`scripts/smg-pr-approve/smg-approve.yml`. O caminho correto — único, usado em todo
o restante da documentação — é:

```text
.github/workflows/smg-approve.yml
```

---

*Documento criado no gate documental autorizado pelo PO (2026-09-25). Sem alteração de código neste commit.*
