# P-AUTO — Registro de Certificação do Production Gate (Release A)

> **Tipo:** registro de certificação (docs-only) · **Data:** 2026-09-28
> **Frente:** P-AUTO / ADR-026 Amendment-01 (Staged Production)
> **Plano:** `docs/audit/P_AUTO_STAGED_CHANGE_PLAN_20260927.md` · **Runbook:** `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md`
> **Auditoria:** P-AUTO-02 (read-only, 2026-09-28)
> **Natureza deste PR:** conteúdo da **Release A** — mudança mínima, não-funcional, exclusivamente destinada a certificar o Production Gate. Não entrega produto.

---

## 1. Objetivo da Release A

Provar experimentalmente a cadeia:

```text
PR → merge → deployment criado (Staged) → domínio NÃO promove automaticamente
  → dispatch → promote WAITING (Environment Production, reviewer = PO)
  → aprovação PO → promote → RE-OFF (autoAssignCustomDomains=false)
  → assert read-only → gate rearmado
```

Critérios objetivos (plano §6): alias permanece no deployment anterior ao candidato; candidato `target=production` com SHA do dispatch; promote SUCCESS sem 409; alias move somente após promote; Health check e Smoke E2E `success` (nunca skipped); trilha completa no step summary.

## 2. Baseline confirmado (pré-merge)

| Sinal | Valor | Fonte |
|---|---|---|
| `autoAssignCustomDomains` | `false` | `GET /v9/projects/smg-barber` |
| `autoAssignCustomDomainsUpdatedBy` | `s1wnjigtgoDZc1oz19GEkufh` (ator humano) | idem |
| Alias `barber.soumanager.com` | `dpl_Do4fd3ufrR7kNjEDyKJ9L1U6XGjs` (desde 2026-09-28 03:41:56Z, imóvel) | `vercel inspect` |
| Domínio | `gitBranch=null`, sem override | `GET /v9/projects/{id}/domains` |
| Environment `Production` | required reviewer = PO (`augustosanchesmanager-ux`, id 259449180) | GitHub Environments API |
| Promote sob o regime atual | nenhum | GitHub Actions API |

## 3. Achado P-AUTO-02 (condição obrigatória do ciclo)

**`vercel promote` re-arma `autoAssignCustomDomains → true`** (server-side, na própria chamada de promote; sem parâmetro conhecido de supressão — spec local com 0 flags; CLI envia `body: {}`; bug aberto vercel/vercel#15095; comportamento documentado em vercel.com/docs/instant-rollback).

Consequências adotadas como regra deste ciclo:

1. **RE-OFF obrigatório** imediatamente após o promote (procedimento operacional manual; automação/workflow = frente futura separada, não autorizada aqui).
2. **Assert read-only obrigatório** após o re-OFF: `GET autoAssignCustomDomains == false` + `vercel inspect` do domínio.
3. **Freeze de merges** durante a janela `promote → re-OFF → assert` (nenhum merge em `main` até o gate rearmar — nenhum mecanismo automático bloqueia esse caminho; a proteção é processual).
4. **Ciclo só se encerra** quando: `promote sucesso AND autoAssign=false AND alias = deployment esperado AND validações passam`. Nunca `promote sucesso` isolado.
5. Se o re-OFF falhar: gate = **DEGRADED**, fluxo permanece em STOP, nenhum merge autorizado até assert verde.

## 4. Invariantes verificáveis (G1–G7)

| # | Invariante | Verificação |
|---|---|---|
| G1 | `autoAssign=false` antes de qualquer merge autorizado | `GET /v9/projects/smg-barber` |
| G2 | Merge não autorizado não substitui o domínio | garantido enquanto `autoAssign=false`; auditável via `vercel ls` + alias |
| G3 | Promote exige aprovação explícita do Environment `Production` | waiting state + reviewer PO |
| G4 | Após promote, `autoAssign` volta a `false` | assert read-only pós-re-OFF |
| G5 | Falha no re-OFF mantém STOP | regra operacional §3.5 |
| G6 | Nenhum merge com estado indefinido | freeze processual |
| G7 | Domínio aponta para o deployment esperado ao fim do ciclo | `vercel inspect` + GitHub Deployments API |

## 5. Escopo deste PR

**IN:** este registro (docs-only). **OUT:** código de produto · migrations/Supabase/RLS/RPC · checkout/comandas/financeiro · autenticação · dados reais · nova funcionalidade · refactor · correção não relacionada · alteração de workflow (`deploy-production.yml`/`deploy-validate.yml`) · automação de re-OFF · branch protection.

## 6. Evidências do gate (preenchidas pós-ciclo)

| Campo | Valor |
|---|---|
| Merge SHA (Release A) | _(a preencher)_ |
| Deployment candidato (Staged) | _(a preencher)_ |
| §6.1 — alias imóvel pós-merge | _(a preencher)_ |
| Dispatch dry-run (run id) | _(a preencher)_ |
| Dispatch real (run id) | _(a preencher)_ |
| Promote waiting → aprovação PO | _(a preencher)_ |
| autoAssign pós-promote (observação empírica) | _(a preencher)_ |
| RE-OFF executado (timestamp/ator) | _(a preencher)_ |
| Assert pós-re-OFF (`autoAssign=false` + alias) | _(a preencher)_ |
| Health check / Smoke E2E | _(a preencher)_ |
| Gate rearmado (G1–G7) | _(a preencher)_ |

> Atualização desta tabela ocorre em docs-merge posterior (fora do freeze da janela crítica), conforme plano §8 (persistência de evidências em documento próprio de certificação).
