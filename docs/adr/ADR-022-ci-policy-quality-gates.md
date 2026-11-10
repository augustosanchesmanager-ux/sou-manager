# ADR-022: Política de CI/CD e Quality Gates — FASE 6 (Item 6.1)

**Status:** Accepted (2026-09-03)
**Date:** 2026-09-03
**Deciders:** PO (Augusto) + OpenCode
**G0:** FASE 6 — Production Readiness, item 6.1 (CI/CD)
**References:** ADR-010 (architecture guards); `docs/audit/FASE_6_GAP_ANALYSIS.md` (linha 6.1); `docs/PROJECT_MATURITY.md`; `docs/ROADMAP.md` (congelado); `AGENTS.md` (regra de ADR para mudanças estruturais)

---

## Context

A FASE 6 (Production Readiness) identificou, na linha 6.1 da análise de gap, a necessidade de definir uma política formal de CI/CD para o projeto. Esta é uma mudança estrutural/operacional de grande porte no fluxo de promoção de código, portanto exige registro via ADR — conforme a regra do AGENTS.md ("Sem ADR, nenhuma mudança estrutural poderá ser feita") e o congelamento do ROADMAP (que permite apenas evoluções documentadas por ADR).

### Estado atual do CI (evidência levantada na análise preparatória)

| Fato | Estado |
|---|---|
| Host remoto | `github.com/augustosanchesmanager-ux/sou-manager` → GitHub Actions |
| Workflows GitHub Actions | **Não existem** (sem diretório `.github/`) |
| Deploy automático | Existe via **Vercel** (`vercel.json`, git link `smg-barber`) |
| `PROJECT_MATURITY.md` | Registra "CI/CD configurado (Vercel)" — refere-se apenas ao deploy, não a quality gates |
| `typecheck` | Existe como script local; **não automatizado** em pipeline |
| `build` | Existe; roda no deploy Vercel; **não é gate** de PR/qualidade |
| Testes unitários | Existem (59 arquivos `*.test.ts`); script local; **não automatizado** |
| `architecture:ci` | Existe (ADR-010, guards: repository/imports/circular, baseline 233/0/0); script local; **não automatizado** |
| E2E (Playwright) | Existe (`playwright.config.ts` + suite `tests/e2e/`); **não integrado** a pipeline |
| Branch protection em `main` | **Não verificada** (config server-side do GitHub, não refletida no repo local) |

## Problem

A formulação oficial do gap, aprovada pelo PO, é:

> **"O Vercel possui automação de build/deploy vinculada ao repositório, mas não há evidência de um pipeline de CI dedicado que execute e imponha os quality gates do projeto antes do merge."**

Essa formulação distingue rigorosamente:

- automação de build/deploy;
- execução de testes;
- quality gates;
- proteção server-side da branch;
- política de merge.

### Distinção de evidência

- **Gap de CI dedicado com quality gates:** **evidenciado**.
- **Estado de branch protection server-side em `main`:** **ainda não verificado/certificado**. A ausência de evidência local **não** deve ser convertida automaticamente em afirmação de ausência da configuração no GitHub.

## Decision

O PO aprova a adoção de uma política formal de CI para o projeto, **mantendo a implementação técnica separada desta decisão**. A política aprovada estabelece:

| Ponto | Decisão |
|---|---|
| **1. Gates obrigatórios** | `typecheck` + `build` + `unit` + `architecture:ci` |
| **2. E2E** | Obrigatório quando houver alteração de fluxo crítico/P0/P1 e antes de promoção final; não obrigatório para todo PR comum inicialmente |
| **3. Preview** | Obrigatório para PRs que alterem UI, páginas ou fluxos visuais |
| **4. Promoção** | Merge em `main` somente via PR, com aprovação humana obrigatória |
| **5. Branch protegida** | `main` |
| **6. Falha de gate** | Gate vermelho bloqueia merge; override excepcional somente mediante decisão explícita do PO, com justificativa e registro |
| **7. Workflow** | Jobs separados em paralelo + job agregado; execução em `pull_request` + `push` em `main` |

### Núcleo obrigatório do CI

Os quatro gates obrigatórios formam o conjunto mínimo para o fluxo normal de PR:

- **`typecheck`** — verificação TypeScript do projeto.
- **`build`** — confirma que a aplicação pode ser construída corretamente.
- **`unit`** — executa a suíte de testes unitários.
- **`architecture:ci`** — executa os guards arquiteturais definidos (ADR-010), preservando os controles existentes.

### Política de exceção (falha de gate)

Um gate vermelho deverá bloquear o merge. Exceções não são comportamento normal e exigem obrigatoriamente:

1. decisão explícita do PO;
2. justificativa;
3. identificação do gate ignorado;
4. registro da exceção;
5. avaliação posterior da necessidade de correção.

**Não será adotado override silencioso.**

### Concessões deliberadas

- **E2E** não será inicialmente transformado em bloqueio universal para todos os PRs — o objetivo é evitar um CI excessivamente pesado antes de existir evidência operacional que justifique ampliar a obrigatoriedade.
- **Preview** é mecanismo de validação, não substituto dos quality gates automatizados.

## Alternatives Considered

- **Pipeline agregado em um único job:** rejeitado — não permite identificação clara de qual gate falhou nem execução paralela dos gates independentes.
- **Sem CI automatizado (status quo, apenas deploy Vercel):** rejeitado — não impõe quality gates antes do merge, mantendo o gap evidenciado na FASE 6.0.
- **E2E obrigatório em todo PR desde o início:** adiado — decisão conservadora para evitar sobrecarga prematura; será ampliado quando houver evidência operacional.

## Consequences

### O que muda

1. A promoção para `main` passa a exigir pull request com aprovação humana obrigatória.
2. O CI dedicado passa a executar e impor `typecheck`, `build`, `unit` e `architecture:ci` nos eventos `pull_request` e `push` em `main`.
3. Jobs separados em paralelo + job agregado permitem identificar qual gate falhou.
4. Gate vermelho bloqueia o merge; override exige decisão explícita e registrada do PO.
5. Mudanças de UI/páginas/fluxos visuais exigem Preview para validação.
6. E2E passa a ser obrigatório em alterações de fluxo crítico/P0/P1 e antes da promoção final.

### O que NÃO muda (nesta decisão)

- Nenhuma alteração de código, banco, migration, RPC, RLS ou regra de negócio é autorizada por este ADR.
- Nenhuma alteração server-side no GitHub (branch protection) é autorizada por este ADR.
- Nenhuma alteração na Vercel é autorizada por este ADR.
- A certificação da 6.1 **não** é declarada por este ADR.
- O estado de branch protection server-side permanece **não verificado** até validação direta no GitHub.

### O que este ADR NÃO constitui (limite explícito)

Este ADR **não** autoriza:

- criação de `.github/workflows`;
- alteração de arquivos de CI;
- configuração de branch protection;
- alteração de regras do GitHub;
- alteração de configurações da Vercel;
- alteração de variáveis de ambiente;
- alteração de banco;
- criação ou alteração de migrations;
- alteração de código de aplicação;
- alteração da suíte de testes;
- push de implementação;
- deploy de qualquer natureza;
- certificação da 6.1.

Este ADR é uma **aprovação de política**, não uma autorização de execução.

## Implementation Plan (sequência aprovada)

A implementação deverá ocorrer somente após autorização específica para execução, na sequência:

```text
DECISÃO
   ↓
ADR
   ↓
IMPLEMENTAÇÃO LOCAL
   ↓
VALIDAÇÃO LOCAL
   ↓
COMMIT
   ↓
AUTORIZAÇÃO PARA PUSH
   ↓
CONFIGURAÇÃO SERVER-SIDE DO GITHUB
   ↓
TESTE DOS GATES
   ↓
VALIDAÇÃO DO MERGE BLOCK
   ↓
CERTIFICAÇÃO DA 6.1
```

Cada etapa preserva a possibilidade de STOP caso seja identificado risco não previsto.

### Critério para considerar a 6.1 executada

A 6.1 não será considerada concluída apenas porque o workflow foi criado. A execução deverá demonstrar, no mínimo:

- gates configurados;
- `typecheck` executando;
- `build` executando;
- `unit` executando;
- `architecture:ci` executando;
- condição agregada funcionando;
- PR executando o pipeline;
- `main` protegida server-side;
- gate vermelho efetivamente impedindo merge;
- aprovação humana exigida;
- Preview funcionando quando aplicável;
- comportamento de `push` em `main` validado;
- documentação atualizada com evidências.

Somente após essas validações o PO poderá decidir pela certificação da 6.1.

## References

- ADR-010: Architecture Guards (`docs/adr/ADR-010-architecture-guards.md`)
- Gap Analysis FASE 6, linha 6.1 (`docs/audit/FASE_6_GAP_ANALYSIS.md`)
- `docs/PROJECT_MATURITY.md` (termo "CI/CD configurado (Vercel)")
- `docs/ROADMAP.md` (congelado — mudança estrutural requer ADR)
- `AGENTS.md` (regra de ADR; política oficial de versionamento)
