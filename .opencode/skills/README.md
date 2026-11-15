# SMG Engineering Skills — Governança Baseada em Risco

Este diretório contém as skills oficiais de engenharia do **SMG (Sou.Manager)** configuradas sob o modelo de **Governança Baseada em Risco** (Trilhas Verde, Amarela e Vermelha).

---

## Trilhas de Risco e Barreiras (`smg-gate`)

| Trilha | Escopo | Pontos de Parada (PO Auth) |
| --- | --- | --- |
| `GREEN` (Trilha Verde) | Alterações de UI (React/CSS/Tailwind), textos, refatorações isoladas no front-end sem impacto em estado global ou banco de dados. | Apenas no **PR Review** (avança automaticamente para `smg-sync`). |
| `YELLOW` (Trilha Amarela) | Novas features de front-end consumindo APIs/Edge Functions já existentes, lógicas de negócios não críticas. | Após `smg-builder` / antes de `smg-sync` (**Sync Auth**) e **PR Review**. |
| `RED` (Trilha Vermelha) | Migrations PostgreSQL, alterações em Supabase RPCs/RLS, autenticação, infraestrutura Vercel ou mudanças na arquitetura multi-tenant. | Antes de `smg-builder` (**Plan Auth**), antes de `smg-sync` (**Sync Auth**) e antes do merge (**Merge Auth**). |

---

## Estrutura e Catálogo de Skills

```text
.opencode/skills/
├── MANIFEST.json
├── README.md
├── smg-change-control/SKILL.md
├── smg-discovery/SKILL.md
├── smg-builder/SKILL.md
├── smg-sync/SKILL.md
├── smg-gate/SKILL.md
├── smg-release/SKILL.md
└── smg-documentation/SKILL.md
```

| Skill | Papel | Substitui (Legado) | Descrição |
| --- | --- | --- | --- |
| `smg-change-control` | Orquestrador | — | Coordena dinamicamente a máquina de estados baseada em risco. |
| `smg-discovery` | Diagnóstico e Risco | `smg-audit`, `smg-classify` | Audita impacto no SMG e emite JSON estrito com `risk_track` e `impact_summary`. |
| `smg-builder` | Execução e Validação | `smg-isolate`, `smg-implement`, `smg-validate`, `smg-evidence` | Isola branch, implementa código, valida build/tipos e emite relatório obrigatório de evidências. |
| `smg-sync` | Versionamento em Lote | `smg-commit`, `smg-push`, `smg-pr` | Executa `git add`, `commit`, `push` e abertura de PR via `gh`. |
| `smg-gate` | Barreira Inteligente | `smg-stop-gate` | Interrompe ou libera o orquestrador conforme a trilha de risco (`GREEN`, `YELLOW`, `RED`). |
| `smg-release` | Merge e Deploy | `smg-merge`, `smg-deploy`, `smg-postdeploy`, `smg-e2e` | Valida checks de CI/CD, executa merge após Merge Auth e monitora deploy na Vercel. |
| `smg-documentation` | Governança Documental | — | Auditoria, classificação, reconciliação, organização e atualização da documentação do SMG. |

---

## Fluxo de Orquestração (`smg-change-control`)

1. `smg-discovery` → define `risk_track` (`GREEN` \| `YELLOW` \| `RED`).
2. `smg-gate(Plan Auth)` → obrigatório se `RED`.
3. `smg-builder` → implementação, validação local e emissão de evidências (`EVIDENCE`, `INTERPRETATION`, `GAP`, `DECISION`).
4. `smg-gate(Sync Auth)` → obrigatório se `YELLOW` ou `RED` (automático se `GREEN`).
5. `smg-sync` → `git add`, commit semântico, push e criação do PR.
6. **STOP obrigatório** → aguarda checks do Vercel CI / GitHub Actions e code review do PO no PR.
7. `smg-release` → invocado explicitamente pelo PO após aprovação do PR para merge e monitoramento de produção.
