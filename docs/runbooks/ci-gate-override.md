# Runbook: CI Gate Override Procedure

> **Operational documentation for ADR-022 §72-82 + ADR-024**
> **Status:** PROPOSED (awaiting PO approval via PR alongside ADR-024)
> **Date:** 2026-09-21
> **Authored by:** OpenCode (Tech Lead operacional)
> **Reference:** [ADR-024](../adr/ADR-024-ci-workflow-regularization.md) §4 · [ADR-022 §72-82](../adr/ADR-022-ci-policy-quality-gates.md)

---

## 1. Propósito

Este runbook operacionaliza a **política conceitual de override** definida em ADR-022 §72-82 e regularizada em ADR-024. Define **quando**, **quem**, **como** e **como NÃO** autorizar overrides de gates de CI, garantindo audit trail e prevenindo bypass informal.

---

## 2. Quando um override PODE acontecer

Um override de gate CI falha-laranja é **permitido** quando **TODAS** as condições abaixo forem satisfeitas:

| # | Condição | Como verificar |
|---|----------|---------------|
| 1 | A falha é **infraestrutura**, não lógica | O log do job mostra erro de rede, registry, runner, etc. — não assertion/test failure |
| 2 | A falha **NÃO é em gate mandatório** (gate mandatório = `typecheck`, `build`, `unit`, `architecture:ci`) | O nome do check falha-do não é um dos 4 gates mandatórios |
| 3 | O PR é estruturalmente válido | Gates G0–G5 de `guards.mjs` (autor, comando, PR state, base ref) passam |

Se qualquer das 3 condições falhar, **o override NÃO é permitido** — ver §4.

---

## 3. Quando um override NÃO PODE acontecer

Um override é **explicitamente proibido** quando:

| # | Caso | Por quê |
|---|------|---------|
| 1 | Falha em gate mandatório (`typecheck`, `build`, `unit`, `architecture:ci`) | Esses gates verificam correção real de código/teste; bypass compromete a qualidade |
| 2 | Falha de assertion em test (vitest) ou E2E (Playwright) | É uma falha lógica, não infraestrutura |
| 3 | PR viola governança (ex: bypass do `smg-pr-approve`) | Toda cadeia de merge deve ser fail-closed |
| 4 | PO não autorizou explicitamente (informal) | "Não será adotado override silencioso" (ADR-022 §82) |

Em qualquer destes casos: **STOP e exigir fix real antes de merge.**

---

## 4. Quem pode autorizar

**Exclusivamente o PO** (Augusto, conta GitHub `augustosanchesmanager-ux`).

Nenhuma outra pessoa, organização ou conta (incluindo `review-bot-smg`) pode autorizar override.

---

## 5. Como registrar o override

Sequência obrigatória:

1. **Comentário do PO no PR** com texto explícito incluindo:
   - **Qual gate** está sendo overridden
   - **Justificativa** técnica (root cause: transient infrastructure, etc.)
   - **Timestamp** da autorização
   - **Plano de mitigação** (ex: "retry CI após runner reset")

2. **Commit adicional** no PR (se aplicável) para corrigir o problema — ou justificativa explícita de "aceitar risco".

3. **(Opcional mas recomendado)** Entrada de audit em `docs/audit/` referenciando o override.

### Template de comentário do PO

```
Override gate: <nome-do-gate>
Justificativa: <root cause, ex: "GitHub Actions runner teve timeout durante npm install">
Plano de mitigação: <próximos passos>
Autorizado por: @augustosanchesmanager-ux em <timestamp ISO 8601>
```

---

## 6. Como prevenir bypass informal

Os seguintes padrões são **PROIBIDOS** e caracterizam **violação de governança**:

| Padrão | Por quê proibido | Como detectar |
|--------|------------------|---------------|
| `[skip ci]` ou `[no ci]` em commit message | GitHub **não honra** strings em commit messages | Não há como — depende de disciplina |
| Disabilitar workflow via UI click sem trace | Sem audit trail | Não há como detectar pós-fato sem log |
| Force-merge via `gh pr merge --admin` apesar de CI vermelho | Viola branch protection intent; log existe mas desencorajado | GitHub Actions logs registram, mas evento é reversível |
| "Trust me" commits por maintainer sem autorização do PO | Sem autorização capturada | Não há como detectar sem disciplina |

Em qualquer destes casos:
1. **STOP** imediato
2. **Documentar** o caso em `docs/audit/` com contexto completo
3. **Reverter** o bypass
4. **Implementar** o procedimento formal

---

## 7. Exemplos

### Exemplo 1: Override VÁLIDO (infraestrutura transient)

```
PR #42: feat(new-widget)
CI falha: 'lint advisory' (vermelho, mas continue-on-error: true)
Override request por @augustosanchesmanager-ux:
  "Override lint advisory — pre-existing baseline (ROADMAP 8.50).
   Este PR não modifica arquivos lintados. CI falha por timeout
   no runner durante npm install. Aprovo."

Validação:
- ✓ Falha é infraestrutura (timeout no install)
- ✗ lint advisory NÃO é gate mandatório (está no allowlist de guards.mjs)
- ✓ PR estruturalmente válido

Resultado: smg-pr-approve → Aprovação PROSSEGUE (lint advisory é allowlist)
```

### Exemplo 2: Override INVÁLIDO (falha lógica)

```
PR #43: feat(complex-feature)
CI falha: vitest unit test 'payment.test.ts' falhou com assertion error
  "Expected amount 50 but received 25"

Override request: "Vamos dar merge mesmo assim, é só um test"

Validação:
- ✗ Falha é lógica (assertion error em test)
- ✗ vitest unit é gate mandatório

Resultado: smg-pr-approve → BLOQUEADO (Gate 6 fail)
Ação requerida: corrigir o test, depois re-trigger CI
```

### Exemplo 3: Override INVÁLIDO (PR inválido)

```
PR #44: feat(quick-fix)
PR state: draft=true
CI falha: 'lint advisory' por timeout no install

Tentativa: /approve no PR draft

Validação:
- ✗ Gate G4 (Draft) do guards.mjs falha — PR está em draft
- ✗ Falha é infraestrutura (passível), mas PR não está pronto

Resultado: smg-pr-approve → BLOQUEADO (Gate G4 fail)
Ação requerida: marcar PR como ready-for-review, depois /approve
```

---

## 8. Escalation

Em caso de dúvida sobre override:

1. **STOP** imediato
2. **Documentar** o caso em `docs/audit/` com contexto completo (logs, tentativas, hipóteses)
3. **Aguardar** próximo gate do PO para decisão

**Não improvisar.** O override tem procedimento formal para preservar audit trail.

---

## 9. Referências

- **ADR-022** §72-82: política conceitual de override ("Um gate vermelho deverá bloquear o merge. Exceções não são comportamento normal e exigem obrigatoriamente: 1. decisão explícita do PO; 2. justificativa; 3. identificação do gate ignorado; 4. registro da exceção; 5. avaliação posterior da necessidade de correção.")
- **ADR-024**: regularização dos CI workflows + este runbook operacional
- `scripts/smg-pr-approve/guards.mjs`: lógica fail-closed executada em runtime
- `.github/workflows/smg-approve.yml`: workflow que consome este runbook
