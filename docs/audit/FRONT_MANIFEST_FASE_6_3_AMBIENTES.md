# Front Manifest — Fase 6.3 Ambientes

> Protocolo: SMG Change Control v1.0.0 (INTAKE → AUDIT → CLASSIFY → ISOLATE → IMPLEMENT → VALIDATE → COMMIT → PUSH → PR → CI → STOP/GATE)
> Conforme `docs/adr/ADR-028-smg-gate-formal-contract.md` e `.opencode/SMG_CHANGE_CONTROL.md`
> Data: 2026-10-23
> Autor: Sisyphus (OpenCode)

## Identificação

| Campo | Valor |
|-------|-------|
| Front ID | FASE-6.3-AMBIENTES |
| Fase | Fase 6 — Production Readiness |
| Subfase | 6.3 Ambientes |
| Base | `main` @ `cbdb33e` (após merge do PR #173) |
| Branch | `feat/fase6-6-3-ambientes` |
| Worktree | `C:\SMG\04_PRODUTOS\SMG_BARBER\sou-manager-fase6-ambientes` |
| Escopo | Documentação: matriz única de ambientes (dev, preview, demo, staging, produção) |
| Escopo excluído | Código, banco/migrations/RPC/RLS, deploy, alteração de infraestrutura |
| Commit | `docs(environments): document matrix of staging and production environments` |
| Validação | revisão de referências + `git diff --check` (docs-only; sem código) |
| PR | aberto apontando para `main` |
| Deploy | não autorizado (MERGE ≠ DEPLOY PROD — ADR-026) |
| Estado atual | **PR_OPEN — aguarda inspeção final e MERGE AUTHORIZATION** |

## Objetivo da subfase

Consolidar em um único artefato canônico a matriz de ambientes da plataforma (domínios, projetos Supabase, projetos Vercel, dados e responsáveis) e o fluxo de promoção `Merge ≠ Deploy`, eliminando a dispersão entre `TAXONOMY.md`, auditoria de topologia Vercel, runbooks e status do projeto.

## Critérios de entrada

- [x] Base sincronizada com `main` pós-merge do PR #173 (`cbdb33e`)
- [x] Documento redigido e isolado na worktree da 6.3 (não misturado com a 6.2)
- [x] Referências verificadas: `docs/TAXONOMY.md` (§4, §5), `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`, `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md`, `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md`, `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` — todos existentes
- [x] Autorização do PO para commit, push e PR exclusivo

## Critérios de saída

- [x] `docs/ambientes.md` versionado
- [x] Matriz cobre os 5 ambientes com domínio, Supabase, Vercel, dados e responsável
- [x] Fluxo de promoção documentado conforme ADR-026
- [x] Nenhum segredo, token ou PII no documento
- [x] Nenhuma alteração de código, banco ou infraestrutura

## EVIDENCE

| # | Evidência |
|---|-----------|
| E1 | `docs/ambientes.md` (120 linhas): matriz de 5 ambientes, domínios oficiais, projetos Vercel, projetos Supabase, fluxo de promoção e critérios de uso |
| E2 | Todas as 6 referências citadas existem no repositório (verificado por `Test-Path`) |
| E3 | `TAXONOMY.md` possui §4 (Estrutura de Domínios) e §5 (Ambientes) — referências corretas |
| E4 | `git status` na worktree: apenas `docs/ambientes.md`; nenhum arquivo de código |
| E5 | Correção de typo ("matiz" → "matriz") aplicada na revisão |

## INTERPRETATION

O documento é puramente operacional e não cria obrigação nova: descreve o estado vigente de ambientes e reafirma ADR-026. Não há risco de comportamento em runtime — o risco é documental (divergência), mitigado pelas referências cruzadas verificadas.

## GAP

- Os identificadores de projeto Supabase/Vercel documentados são públicos por natureza (aparecem em URLs), mas a exposição deve ser reavaliada se o documento for publicado externamente.
- O documento não substitui `docs/TAXONOMY.md`: em caso de divergência futura, a taxonomia prevalece.

## DECISION

Documentação aprovada para integração isolada, sem qualquer alteração de código, banco ou infraestrutura.

## Log de transições

| Data | Transição | Ator | Observação |
|------|-----------|------|------------|
| 2026-10-23 | INTAKE | Sisyphus | Resgate isolado de `docs/ambientes.md` (entrega órfã da 6.3) |
| 2026-10-23 | AUDIT | Sisyphus | Conteúdo e referências verificados; typo corrigido |
| 2026-10-23 | CLASSIFY | Sisyphus | Documentação pura; risco baixo; reversível |
| 2026-10-23 | ISOLATE | Sisyphus | Worktree `sou-manager-fase6-ambientes`, branch `feat/fase6-6-3-ambientes`, base `cbdb33e` |
| 2026-10-23 | IMPLEMENT | Sisyphus | `docs/ambientes.md` finalizado na worktree |
| 2026-10-23 | VALIDATE | Sisyphus | Referências íntegras; `git diff --check` limpo |
| 2026-10-23 | COMMIT AUTHORIZATION | Augusto (PO) | Autorizado commit, push e PR exclusivo |
| 2026-10-23 | COMMIT | Sisyphus | Commit atômico de documentação |
| 2026-10-23 | PUSH | Sisyphus | Branch publicada em `origin` |
| 2026-10-23 | PR | Sisyphus | PR exclusivo aberto para `main` |
| 2026-10-23 | STOP/GATE | Sisyphus | **PARADO no gate de merge** |

## Próxima transição permitida

**MERGE AUTHORIZATION** — após inspeção final do PR e CI verde.

**Bloqueado por:** MERGE AUTHORIZATION (PO).

**STATUS:** PR_OPEN
