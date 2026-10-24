# 🛡️ Disaster Recovery Plan (DRP) — SMG (Sou.Manager)

> Referência: Subfase 6.10 (Backup) e 6.11 (Disaster Recovery) — Fase 6: Production Readiness  
> Aplicação: SMG Barber (`https://barber.soumanager.com`)  
> Última Atualização: 2026-10-24

---

## 1. Visão Geral e SLAs

Este documento estabelece os procedimentos operacionais de recuperação de desastres para a infraestrutura do SMG (Sou.Manager), cobrindo banco de dados (PostgreSQL/Supabase), runtime de Edge Functions e distribuição frontend (Vercel).

### Parâmetros de Continuidade de Negócio

| Métrica | Meta Alvo | Justificativa Operacional |
|---|---|---|
| **RPO** *(Recovery Point Objective)* | **≤ 24h** (rotina diária)<br>**0 min** (migrações críticas) | Snapshots automáticos diários do Supabase. Para migrações DDL/DML estruturais, extração obrigatória de dump lógico pré-deploy. |
| **RTO** *(Recovery Time Objective)* | **≤ 5 min** (frontend)<br>**≤ 60 min** (banco de dados) | Rollback instantâneo na Vercel via comando `vercel promote`. Restauração lógica do banco via dump em contingência. |

---

## 2. Matriz de Cenários de Desastre

### Cenário 1: Falha Crítica ou Regressão no Frontend
* **Gatilho:** Erro bloqueante de runtime pós-deploy, falha de autenticação geral ou quebra severa de layout.
* **Ação:** Reversão atômica via promoção do deployment anterior conhecido.
* **Comando:**
  ```bash
  vercel promote <deployment-id-anterior> --scope smg-barber
  ```
* **Validação:** Acessar `https://barber.soumanager.com` e executar a suite básica de smoke test.

### Cenário 2: Corrupção Lógica ou Erro em Migração de Banco
* **Gatilho:** Execução de migração com perda de dados, corrupção de comissões/comandas ou falha de integridade referencial.
* **Ação Imediata (Contenção):**
  1. Habilitar modo de manutenção na Vercel (`VITE_MAINTENANCE_MODE=true`) para cessar novas gravações.
  2. Isolar o tenant afetado via política ou suspensão temporária se o dano for localizado.
* **Procedimento de Restauração:**
  1. Identificar o ponto no tempo anterior à falha.
  2. Restaurar os dados a partir do dump lógico pré-deploy (`.backups/`) em schema isolado para auditoria.
  3. Aplicar o script de saneamento/rollback transacionalmente (`BEGIN ... COMMIT`).

### Cenário 3: Indisponibilidade Severa do Provedor de Banco (Supabase)
* **Gatilho:** Queda regional prolongada ou bloqueio estrutural do projeto `ushsnmlbeurfvlkieiln`.
* **Ação de Contingência:**
  1. Provisionar instância de backup (ou redirecionar temporariamente para projeto de staging isolado).
  2. Restaurar schema e dados:
     ```bash
     psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" -f .backups/smg_prod_latest.sql
     ```
  3. Atualizar as variáveis de ambiente na Vercel:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
  4. Redesplegar a aplicação na Vercel.

---

## 3. Rotina Operacional de Backup Pré-Deploy

Toda migração classificada como **Crítica** ou com risco de DDL destrutivo exige dump lógico manual antes da execução em produção:

```bash
# Execução via script automatizado:
powershell -ExecutionPolicy Bypass -File scripts/ops/backup-prod.ps1
```

O script armazena o dump com timestamp no diretório local seguro `.backups/` (ignorado pelo Git).

---

## 4. Checklist Pós-Restauração (Sanity Check)

Antes de reabrir o tráfego aos clientes:
- [ ] **Multi-tenancy:** Verificar integridade das tabelas core (`tenants`, `staff`, `comandas`).
- [ ] **Consistência Financeira:** Validar saldo em aberto de comandas e comissões do dia corrente.
- [ ] **RLS e Políticas:** Confirmar que as tabelas permanecem com `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- [ ] **Smoke Test E2E:** Executar `npm run test:e2e:smoke` contra a URL de produção.
- [ ] **Desativação de Manutenção:** Remover a flag `VITE_MAINTENANCE_MODE` e notificar a equipe de atendimento.
