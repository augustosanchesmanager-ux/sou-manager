# ADR-010: Architecture Guards

**Status:** Accepted  
**Date:** 2026-07-24  
**Deciders:** SMG Engineering

## Context

Architecture rules documented in ADRs can be forgotten or violated accidentally as the codebase grows.

## Decision

Automated architecture guards prevent regressions.

### Guards

| Guard | Purpose | Command |
|-------|---------|---------|
| Repository Guard | No `.from('table')` in UI layers | `guard-repository.mjs` |
| Forbidden Imports | No Component→Supabase, Domain→UI | `guard-imports.mjs` |
| Circular Imports | No circular dependencies | `guard-circular.mjs` |

### Baseline Mode

```bash
npm run architecture:baseline    # Compare against baseline
npm run architecture:strict      # Fail on any violation
npm run architecture:ci          # CI mode with baseline
```

### Baseline File

```json
{
  "repositoryViolations": 233,
  "forbiddenImports": 0,
  "circularImports": 0
}
```

Violations must not increase. Improvements decrease the baseline.

### CI Integration

```yaml
# In CI pipeline
- run: npm run architecture:ci
```

## Consequences

- **Positive:** Architecture rules are enforced automatically
- **Positive:** Baseline tracks technical debt over time
- **Positive:** New code cannot introduce new violations
- **Negative:** Guards add CI execution time (~2s)
- **Negative:** False positives possible for edge cases (e.g., `Array.from()`)

---

## Amendment-01 — Architecture Gate fail-closed (HARDENING-01, 2026-10-01)

**Status:** Accepted (autorização explícita do PO, frente `hardening-01-ci-architecture-gate`)
**Supersede:** o bloco "Baseline File" acima (valores `233 / 0 / 0` — medição incorreta, ver Finding).

O texto original deste ADR permanece acima como registro da decisão de 2026-07-24; esta
emenda corrige o **comportamento** do gate, não o contexto.

### Finding

O gate `architecture:ci` operava **fail-open**. Evidência medida em `origin/main @ cded131`:

| Guard | exit | Saída real | Contagem aceita pelo runner antigo | Baseline | Veredito |
|-------|------|-----------|------------------------------------|----------|----------|
| `guard-repository.mjs` | 1 | `Total: 227 violation(s).` | 227 | 233 | PASS (legítimo) |
| `guard-imports.mjs` | 1 | `Total: 1 error(s), 0 warning(s).` | **0** | 0 | PASS (**mascarado**) |
| `guard-circular.mjs` | 1 | `× Found 1 circular dependency!` | **0** | 0 | PASS (**mascarado**) |

Causas:

1. O runner extraía a contagem com **uma única regex genérica** (`/Total:\s*(\d+)\s*violation/`),
   que só casa com a saída do `guard-repository`. Todo guard com formato diferente era
   contado como **0** — e, com baseline `0`, virava `PASS (baseline)`.
2. Existia atenuação artificial `Math.max(0, totalErrors - 1)`, que rebaixava uma regressão
   real a warning para o job passar.
3. `exit 2` (ferramenta indisponível) virava `⚠️ SKIP` silencioso.
4. A captura usava `err.stdout || err.stderr` — os guards escrevem **tudo em stderr** e
   `stdout` é vazio, então qualquer escrita futura em stdout descartaria a contagem.

### Decision

1. **Fail-closed.** `exit != 0` nunca pode ser convertido em `0 violações`. Se a contagem não
   puder ser obtida com segurança, o resultado é **FATAL** e o gate falha.
2. **Parsing específico por guard.** Cada guard tem o seu parser, casado com o formato emitido
   por aquela ferramenta (`Total: <n> violation(s)`, `Total: <n> error(s)`, `Found <n> circular
   dependency`). Não existe regex genérica compartilhada.
3. **Contradição é FATAL.** Guard que termina com `exit != 0` e reporta `0` violações é
   tratado como inconsistente e reprovado — nunca como "limpo".
4. **Sem atenuação.** Regressão acima do baseline é sempre bloqueante, inclusive no modo CI.
   Nenhum mecanismo converte falha real em warning.
5. **stdout + stderr são lidos.** A captura concatena os dois streams.
6. **Falta de baseline é FATAL.** `--baseline` sem o arquivo, ou sem a chave do guard, reprova.
7. **Baseline pode conter débito técnico conhecido**, desde que seja **medido**, não estimado.
8. **Ratchet progressivo.** Cada valor do baseline só pode **descer**. Se a contagem medida ficar
   abaixo do baseline, o runner imprime a sugestão de redução — mas **nunca** a aplica sozinho.

### Baseline medido em `origin/main @ cded131`

```json
{
  "repositoryViolations": 227,
  "forbiddenImports": 1,
  "circularImports": 1
}
```

O snippet "Baseline File" no topo deste ADR (`233 / 0 / 0`) está **superado**: os valores `0`
para `forbiddenImports` e `circularImports` eram falsos — havia 1 de cada em `origin/main`.

### Débito técnico registrado (não corrigido aqui)

| Chave | Violação | Frente |
|-------|----------|--------|
| `repositoryViolations` | 227 chamadas `.from()` em camadas de UI (`pages/`, `components/`, `hooks/`) | saneamento legado |
| `forbiddenImports` | `components/billing/StatusBanner.tsx` → `src/lib/supabase/tenant` | **Billing** (frente separada) |
| `circularImports` | `domain/billing/repository.ts` ↔ `domain/billing/supabaseBillingRepository.ts` | **Billing** (frente separada) |

As duas violações de Billing são **débito conhecido e aceito** neste baseline. Corrigi-las é
frente própria, com testes próprios — **fora** do escopo do gate.

### Consequências

- **Positivo:** `architecture:ci` volta a ter poder real de bloquear; `validate` (que depende
  dele) deixa de ser verde por acidente.
- **Positivo:** parser incompatível com a versão da ferramenta passa a falhar alto, em vez de
  liberar o gate em silêncio.
- **Negativo:** endurecimento de baseline passa a ser **bloqueante** — reduzir `0` para `1`
  quebra o CI até o baseline ser atualizado junto. É o comportamento pretendido.
- **Negativo:** `exit != 0` com saída irreconhecível reprova o gate, inclusive em falha de
  infraestrutura. Exige override via `docs/runbooks/ci-gate-override.md`.

### Referências

- `scripts/architecture/check.mjs` — runner (implementa esta emenda)
- `architecture-baseline.json` — baseline medido + mapa de débito
- ADR-022 / ADR-024 — política de CI e quality gates
