# FASE 6 — BACKLOG DE FECHAMENTO 6.1–6.13

## 1. Cabeçalho

**Finalidade:** Consolidar o resultado do **RECONCILIATION AUDIT 6.1–6.13** em um plano de fechamento controlado da Fase 6 — uma tabela única de decisão, com uma linha por subfase, pronta para avançar pelos estados `FECHAR → DOCUMENTAR → IMPLEMENTAR → VALIDAR → INVESTIGAR → DEFERIR`.

**Natureza:** **READ-ONLY / CONSOLIDAÇÃO.** Este documento NÃO altera `PROJECT_STATUS.md`, `ROADMAP.md`, código, testes, migrations, configuração ou infraestrutura (Supabase/Vercel/GitHub). Nenhum commit de alteração funcional, merge ou deploy é autorizado por este artefato.

**Data da consolidação:** 2026-09-22.

**Fontes canônicas:**
- `ROADMAP.md` — definições oficiais de 6.1–6.13 (linhas 1426–1549)
- `PROJECT_STATUS.md` — claims oficiais (6.1–6.13 = 0%, linhas 167–179)
- Evidência do repositório em `main` @ `7b69cf4` + GitHub API (branch protection)
- Diagnóstico anterior: `docs/audit/FASE_6_GAP_ANALYSIS.md` (2026-09-03 — parcialmente desatualizado; Phase 6.1 posteriormente implementada)

**Regra de encerramento (PO, 2026-09-22):**
> Nenhuma subfase será marcada como concluída sem **evidência suficiente contra seus critérios**. Atualização de percentual não equivale a encerramento. Documentação não equivale a implementação.

**Decisão de PO registrada neste STOP:**
> Auditoria encerrada em modo READ-ONLY. Resultado aceito como **evidência de diagnóstico**, não como evidência de encerramento. Nenhuma implementação, migration, deploy ou alteração de `PROJECT_STATUS.md` autorizada neste momento. Próximo passo autorizado: esta consolidação em backlog.

---

## 2. Tabela única de decisão

Legenda de AÇÃO: `FECHAR` · `DOCUMENTAR` · `IMPLEMENTAR` · `VALIDAR` · `INVESTIGAR` · `DEFERIR`

| # | Subfase | Critério ROADMAP (resumo) | Evidência encontrada | Estado real | Gap | Evid. suficiente? | Tipo de pendência | AÇÃO | Detalhe da ação | Bloco PO | Ordem PO |
|---|---------|---------------------------|----------------------|-------------|-----|-------------------|-------------------|------|-----------------|----------|----------|
| 6.1 | CI/CD | Actions, branch protection, CI gates, preview/staging/prod deploy | `ci.yml` (typecheck+build+unit+architecture; lint/e2e advisory), `deploy-validate.yml`, `smg-approve.yml`; branch protection API: required check `validate`, enforce_admins=true | ~90% | Formalizar preview/staging/prod deploy; decisão advisory→blocking (PO vetou prematuremente) | ⚠️ Parcial | DOCUMENTAÇÃO + VALIDAÇÃO | DOCUMENTAR | Publicar matriz de pipelines (gates blocking vs advisory, ambientes de deploy) — decisão advisory→blocking fica **DEFERIDA** ao gate de release | **A** | 2 |
| 6.2 | Observabilidade | Sentry, correlation IDs, error boundary, health check | `src/lib/observability/` completo (logger, 14 regras de alerta, dashboard `/#/observability`, webhook, ADR-015); `createCorrelationId()` em uso; **sem Sentry; sem ErrorBoundary; sem `/health`** | ~60% | Sentry ausente; ErrorBoundary ausente; equivalência "própria × Sentry" nunca formalizada | ⚠️ Parcial | IMPLEMENTAÇÃO + EVIDÊNCIA | DEFERIR + IMPLEMENTAR | **DEFERIR** decisão de escopo (PO): Sentry obrigatório OU observabilidade própria aceita como equivalente. Independentemente: **IMPLEMENTAR** ErrorBoundary global React | B (decisão+impl) | — |
| 6.3 | Ambientes | Dev, Preview, Demo, Staging, Prod | Todas 5 com evidência: `npm run dev`; Vercel previews; demo mode; staging `tjcvuhynckocmvtqykxp` + relatórios `STAGING_*`; prod `barber.soumanager.com`; `VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` | ~80% | Matriz formal de ambientes (URL, ref, dados, responsável) não consolidada num único documento | ⚠️ Parcial | DOCUMENTAÇÃO | DOCUMENTAR | Redigir matriz única de ambientes e referenciá-la no TAXONOMY | **A** | 2 |
| 6.4 | Hardening | ESLint+Prettier, `.env.example`, `config.toml`, migrations verificadas/docs | **Biome** (`biome.json`) — desvio do critério literal ESLint+Prettier; **sem `.env.example`**; **sem `supabase/config.toml`**; migrations 100+ arquivos com docs (`PLANO_APLICACAO_MIGRATIONS.md`, `BANCO_DE_DADOS.md`); restore-testadas em docker | ~50% | `.env.example` ausente; `config.toml` ausente; tooling literal não corresponde (Biome≠ESLint+Prettier) | ❌ Não | IMPLEMENTAÇÃO + DOCUMENTAÇÃO | IMPLEMENTAR + DEFERIR | **IMPLEMENTAR**: criar `.env.example` (todas as vars `VITE_*`) e `supabase/config.toml`. **DEFERIR** ao PO: ratificação de Biome como equivalente a ESLint+Prettier. Segurança não se encerra por documentação | **B** | 4 |
| 6.5 | E2E Críticos | 3 fluxos: Agendamento→…→Fechamento; Checkout→Comissão→Fechamento; Club Criar→Utilizar→Cancelar | 53 specs E2E; flow1 ✅; flow2 + flow-p0-3-c ✅; comissão presente em flow4/12/13/14 mas **sem spec dedicado** "checkout→comissão→fechamento"; smoke 10/10 certificado | ~80% | Formalização dos 3 specs oficiais; verificar cobertura real do fluxo de comissão | ⚠️ Parcial | VALIDAÇÃO | VALIDAR | Mapear os 3 specs oficiais ao critério; auditar se fluxo comissão coberto (flow1+flow4) ou exige spec novo | B | — |
| 6.6 | Deploy Produção | Contas, staging, smoke, deploy controlado, rollback, monitoramento | Deploy real 2026-08-08 (`DEPLOY_LOG_FASE_6_0_5.md`, runbook, PCA READY, pós-deploy 7/7 + E2E verdes); smoke existem; contas Supabase/Vercel ativas | ~85% | Runbook canônico único; monitoramento pós-deploy contínuo; conta Sentry (depende 6.2) | ⚠️ Parcial | DOCUMENTAÇÃO + DEPLOY | DOCUMENTAR | Consolidar runbook canônico de deploy; definir procedimento de monitoramento pós-deploy | **A** | 2 |
| 6.7 | Release Notes | `npm run release`, formato, git tags | 19 git tags anotadas (v1.0.0→v2.1.0); formato em `RELEASE_PROCESS.md` §11; `RELEASE_CHECKLIST_v1.5.md`; **sem script `npm run release`; sem CHANGELOG.md** | ~60% | Script de release ausente; CHANGELOG ausente; RN da v1.5 não publicadas | ⚠️ Parcial | DOCUMENTAÇÃO + IMPLEMENTAÇÃO | IMPLEMENTAR + DEFERIR | **IMPLEMENTAR**: CHANGELOG.md + script de release. **DEFERIR** publicação das RN da v1.5 ao gate de release (não é frente de dev) | B | — |
| 6.8 | Docs Operacionais | Ambientes, aprovação deploy, segredos, procedimentos | `RELEASE_PROCESS.md`, `DEPLOY_RUNBOOK_FASE_6_0_5.md`, `docs/runbooks/ci-gate-override.md`, `DEPLOYMENT_PLAN_20260728.md`, `PLANO_APLICACAO_MIGRATIONS.md` | ~80% | Gestão de segredos sem procedimento dedicado; docs dispersos sem índice operacional | ⚠️ Parcial | DOCUMENTAÇÃO | DOCUMENTAR | Indexar runbooks operacionais; criar procedimento de gestão de segredos/variáveis | **A** | 2 |
| 6.9 | Health Checks | `/health`, readiness, liveness, dependency checks | SPA estática — rota `/health` não existe; sinais: worker_heartbeat D8 (DB), `deploy-validate.yml` (curl HTTP 200 + smoke pós-deploy), `net._http_response`; **sem readiness/liveness** | ~40% | **Critério de "saudável" nunca definido** — paradigma Vercel SPA não mapeado ao checklist literal | ⚠️ Parcial | EVIDÊNCIA + VALIDAÇÃO | DEFERIR + INVESTIGAR | **DEFERIR** ao PO: definição do critério de saúde (aplicação, banco, auth, jobs, erros, disponibilidade). Só depois: implementar o critério definido. **Não inventar health-check porque o nome da subfase sugere** | **B** | 5 |
| 6.10 | Backup | Backup automático, backup config, teste de restauração | Backup lógico D-6.0.5.7 + restore test 100% idêntico em Docker (`DEPLOY_LOG_FASE_6_0_5.md`); `docs/backups/backup_pre_migration_20260728.sql`; PITR Supabase não evidenciado | ~60% | Backup foi **manual/pontual** — sem automação/cadência; política de retenção não documentada | ⚠️ Parcial | IMPLEMENTAÇÃO + DOCUMENTAÇÃO | IMPLEMENTAR + DOCUMENTAR | **IMPLEMENTAR**: automação de backup (Supabase PITR ou pg_cron). **DOCUMENTAR**: política de cadência/retention/responsável | B | — |
| 6.11 | Disaster Recovery | Plano DR, procedimentos testados, contatos de emergência | **Nenhum plano DR no repositório** (único restore test é o do deploy 6.0.5) | ~5% | Plano DR inteiro ausente: RPO, RTO, cenários, procedimentos, responsáveis, contatos, evidência de teste | ❌ Não | DOCUMENTAÇÃO | DOCUMENTAR + VALIDAR | **DOCUMENTAR** plano DR completo (RPO/RTO, cenários, de onde/de como recuperar, responsável, contatos). **VALIDAR** com teste de recuperação — sem isso, "temos DR" é afirmação, não evidência | **B** | 3 |
| 6.12 | Deploy Validation | Pipeline, staging test, rollback, monitoramento | `deploy-validate.yml` (health curl + E2E smoke pós-deploy + audit summary); rollback documentado (`RELEASE_PROCESS.md` §10, "<5min") mas **não executado como teste real** | ~70% | Rollback "testado conceitualmente" nunca executado; monitoramento não contínuo | ⚠️ Parcial | VALIDAÇÃO | VALIDAR + DEFERIR | **VALIDAR**: executar 1 ciclo real de rollback. **DEFERIR** a execução ao gate apropriado (operação destrutiva exige aprovação PO) | B | — |
| 6.13 | Production Certification | 12 itens + relatório + sign-off | Segurança ✅ (RLS/RPC audits + F1–F5); Performance ✅ (`PERFORMANCE_BASELINE.md`/`PERFORMANCE_REPORT.md`); Backup executado ✅; deploy pipeline ✅; **DR ❌**; observabilidade operacional/health/backup automático parciais | ~40% | Itens 1, 5, 6, 7, **8 (DR — bloqueante)**, 12; checklist consolidado da Fase 6 não existe | ❌ Não | EVIDÊNCIA + DOCUMENTAÇÃO | DEFERIR | **Bloqueado** por 6.2/6.9/6.10/6.11. Checklist consolidado só após fechamento das dependências. Última linha a encerrar | B | — |

---

## 3. Leitura por bloco de trabalho (decisão PO)

### BLOCO A — Puramente documental (fechamento mais próximo)
**Subfases:** 6.1, 6.3, 6.6, 6.8

Fluxo por subfase: critério exato → evidência → falta → produzir documentação → validar contra critério → então marcar encerrável.

| Ordem | Frente | Decisão PO |
|-------|--------|-----------|
| 1 | Consolidação da matriz 6.1–6.13 (este documento) | 🔴 **Concluída agora** |
| 2 | 6.1 / 6.6 / 6.3 / 6.8 — documentação/decisão | 🟡 Próxima, quando o PO abrir o bloco |

### BLOCO B — Gaps reais
**Subfases:** 6.4 (Hardening), 6.9 (Health), 6.11 (DR) — explicitamente priorizadas pelo PO. Demais frentes com ação própria (6.2, 6.5, 6.7, 6.10, 6.12, 6.13) encaixam aqui conforme o tipo de pendência.

| Ordem | Frente | Decisão PO |
|-------|--------|-----------|
| 3 | 6.11 — DR (gap real, quase zero) | 🟠 Implementar/documentar gap |
| 4 | 6.4 — Hardening (segurança não encerra por documentação) | 🟠 Investigar/corrigir |
| 5 | 6.9 — Health (definir critério primeiro) | 🟠 Definir critério + implementar |

### BLOCO C — Reconciliação do `PROJECT_STATUS.md`
**Só depois dos Blocos A e B.** Atualização é **consequência** da auditoria, não mecanismo para fazê-la parecer resolvida.

| Ordem | Frente | Decisão PO |
|-------|--------|-----------|
| 6 | Atualizar `PROJECT_STATUS.md` para refletir estado real | 🟢 Após consolidação A+B |
| 7 | Fechamento de cada 6.x por evidência | 🔒 STOP por subfase |

---

## 4. O que NÃO está autorizado neste STOP

- Implementar as 13 subfases de uma vez / levar tudo a 100%
- Alterar migrations ou tocar em produção
- Corrigir "percentuais" antes de definir estado real
- Tratar documentação como equivalente a implementação
- Fechar 6.x porque `PROJECT_STATUS.md` foi atualizado
- Alterar `PROJECT_STATUS.md` antes do Bloco C
- Executar rollback/deploy sem gate e aprovação explícita do PO

---

## 5. Critério de promoção (para todas as subfases)

```
AÇÃO atribuída na tabela
        ↓
trabalho executado (pelo tipo de pendência)
        ↓
evidência produzida contra o critério ROADMAP da subfase
        ↓
validação: evidência suficiente?  ── NÃO → voltar ao trabalho
        ↓ SIM
subfase marcada como encerrável (STATUS só aqui é atualizado)
        ↓
STOP → decisão do PO
```

---

**Responsável:** OpenCode (execução técnica) · Augusto PO (decisões, aprovação, encerramento)
**Próxima etapa:** aguardar abertura do Bloco A pelo PO.
