# Matriz Única de Ambientes — Fase 6.3

> **Fase 6 — Production Readiness**, subfase **6.3 Ambientes**.
> Documentação operacional da matriz de ambientes da SMG Platform.
> Consolida: `docs/TAXONOMY.md` (§5), `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`, `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md`, `PROJECT_STATUS.md`, `ROADMAP.md` (D5).
>
> **Natureza:** DOCUMENTAÇÃO. Nenhum código, migration, deploy ou alteração de infraestrutura é autorizado por este artefato.
>
> **Última atualização:** 2026-10-23
> **Autor:** Sisyphus (OpenCode)

---

## 1. Objetivo

Estabelecer uma **matriz única e canônica** dos ambientes da plataforma, servindo como referência para desenvolvimento, homologação, deploy e operação. Elimina a dispersão de informações sobre ambientes entre múltiplos documentos.

---

## 2. Matriz de Ambientes

| # | Ambiente | Domínio | Supabase | Vercel | Dados | Responsável | Uso |
|---|----------|---------|----------|--------|-------|-------------|-----|
| 1 | **Development** | `localhost:3000` | Projeto dev local (ou modo demo) | — | Dados emulado (demo) | Desenvolvedor | Desenvolvimento local |
| 2 | **Preview** | `pr-{id}.vercel.app` | Projeto staging | Preview branch | Dados de staging (tenant efêmero) | CI / PR | Validação de cada PR |
| 3 | **Demo** | `demo.soumanager.com` | Projeto demo | Production branch | Dados de demonstração | Comercial | Demo pública para prospects |
| 4 | **Staging** | `staging.barber.soumanager.com` | Projeto staging (`tjcvuhynckocmvtqykxp`) | Staging branch | Dados de staging (isolados) | QA / Homologação | Validação antes de produção |
| 5 | **Production** | `barber.soumanager.com` | Projeto production (`ushsnmlbeurfvlkieiln`) | Production branch (`main`) | Dados reais de clientes | PO / Operação | Clientes reais |

### Regras de ambiente

- ✅ Sempre 3 ambientes no mínimo: Development, Staging, Production.
- ✅ Preview automático para cada PR (via GitHub Actions + Vercel).
- ✅ Demo separada para demonstrações comerciais.
- ❌ Nunca deploy direto para produção sem passar por staging.
- ❌ Nunca utilizar `app.soumanager.com` como domínio principal (ver `docs/TAXONOMY.md` §4).

---

## 3. Domínios Oficiais (TAXONOMY §4)

```
soumanager.com                    ← Domínio raiz
├── barber.soumanager.com         ← SMG Barber (produção) — ÚNICO DOMÍNIO ATIVO
├── admin.soumanager.com          ← Painel administrativo central
├── docs.soumanager.com           ← Documentação pública
└── status.soumanager.com         ← Status page
```

- **SMG Barber** é o único produto comercial ativo (`barber.soumanager.com`).
- Domínios para futuros produtos serão definidos mediante decisão oficial do Product Owner.
- Cada produto possui seu próprio subdomínio; nunca utilizar `app.soumanager.com`.

---

## 4. Projetos Vercel

| Projeto | Project ID | Domínio de produção | Integração git | Observação |
|---------|------------|---------------------|----------------|------------|
| `smg-barber` | `prj_M3cJ2cZosLONAt9IzumF2LwJZTSj` | `barber.soumanager.com` | Conectada (ativa) | **Oficial** — frontend de produção do SMG Barber |
| `smg-barber-staging` | `prj_5qoCiw7lwSZnKgB6UcS7kSNQqRAk` | `staging.barber.soumanager.com` | — | Staging |
| `smg-estetica` | `prj_my8ykBB67rDKQZi4RKPtv7MotAC2` | `estetica.soumanager.com.br` | — | Legado / fora de escopo |

> **Projeto legado `sou-manager`** (`prj_fnQHNKxQR2XRMhAg5y9eA0qwyIN3`): integração git **desconectada** em 2026-08-08 (D-HOM-11, autorização do PO) para eliminar double-deploy. Projeto, domínios e env preservados. Destino definitivo continua decisão do PO.

---

## 5. Supabase

| Projeto | Ref | Uso |
|---------|-----|-----|
| Produção (SMG Barber) | `ushsnmlbeurfvlkieiln` | Dados reais de clientes (tenant Sanchez Barber) |
| Staging | `tjcvuhynckocmvtqykxp` | Dados de staging, isolados da produção |

> Multi-schema: `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` não definido no projeto oficial (default `false` → tabelas em `public`). No projeto legado `sou-manager` está `true` — divergência funcional documentada em `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §4.

---

## 6. Fluxo de Promoção (Merge ≠ Deploy)

Conforme `ADR-026` e `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md`:

```
Merge em main  →  Build automático (Vercel Git Integration)  →  Deploy staged (Preview/Produção sem alias)
                                                      ↓
                                              Promoção controlada (workflow_dispatch)
                                                      ↓
                                              Environment Production + aprovação do PO
                                                      ↓
                                              vercel promote (move alias)
                                                      ↓
                                              post-validate (health + smoke)
```

- **Merge em `main` ≠ Deploy de produção.** O merge dispara build automático; a promoção de alias exige dispatch manual + aprovação do PO no Environment `Production`.
- `dry_run=true` por padrão no workflow de promoção — nunca promove acidentalmente.

---

## 7. Critérios de Uso por Ambiente

| Ambiente | Quando usar | Quem acessa |
|----------|-------------|-------------|
| Development | Desenvolvimento local, testes unitários, lint, typecheck | Desenvolvedores |
| Preview | Validação de cada PR antes do merge | Revisores, CI |
| Demo | Demonstrações para prospects, vendas | Comercial, prospects |
| Staging | Homologação, testes E2E críticos, validação pré-produção | QA, homologação |
| Production | Operação com clientes reais | Usuários finais, operação |

---

## 8. Referências

- `docs/TAXONOMY.md` — Glossário oficial (§4 Domínios, §5 Ambientes)
- `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` — Auditoria de topologia Vercel (H-8)
- `docs/DEPLOY_RUNBOOK_FASE_6_0_5.md` — Runbook de deploy da fase 6.0.5
- `docs/runbooks/P-AUTO_PROMOTE_RUNBOOK.md` — Runbook de promoção controlada
- `docs/adr/ADR-026-merge-not-equal-deploy-prod-gate.md` — Merge ≠ Deploy PROD
- `ROADMAP.md` (D5 — Ambientes)
- `PROJECT_STATUS.md` — Status do projeto
