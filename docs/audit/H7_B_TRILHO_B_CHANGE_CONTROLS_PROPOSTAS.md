# H-7 — Trilho B · Propostas de Change Control + Atualização do Plano Fase 2

> **Tipo:** Planejamento read-only · **Mutation:** NENHUMA executada · **Status:** ⏸️ aguardando autorização
> **Data:** 2026-09-20 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Produção:** `ushsnmlbeurfvlkieiln` — **INTACTA** (0 escritas, 0 deploys, 0 disable, 0 deleções)

---

## A. Change Control: `import-export` — Disable Controlado

### A.1 Contexto

Edge Function `import-export` (v14, ACTIVE em PROD desde ~2026-04-02):
- Consome `SUPABASE_SERVICE_ROLE_KEY` legacy (linha 60 do código deployado)
- `verify_jwt: false` na plataforma, mas implementa auth manual via `supabase.auth.getUser()`
- Zero invocações observadas em `net._http_response`
- Zero registros em `control.import_jobs` e `control.import_audit_logs`
- Schema `control` existe com 5 templates ativos (provável seed)

### A.2 Escopo

Desabilitar a função de forma **reversível** (status=INACTIVE), preservando:
- Código-fonte deployado (recuperável via CLI)
- Configuração (env vars mantidas no Edge Function secrets)
- 5 templates em `control.import_export_templates`

**NÃO fazer:** delete da função, alteração de código, alteração de secrets, alteração de `verify_jwt`.

### A.3 Pré-condições (antes de executar)

| # | Pré-condição | Como verificar |
|---|--------------|----------------|
| P1 | Backup do source atual em local | `supabase functions download import-export --project-ref ushsnmlbeurfvlkieiln` (já feito nesta sessão) |
| P2 | Snapshot das 5 templates | `SELECT * FROM control.import_export_templates` (preservar em arquivo) |
| P3 | Confirmação de zero invocações nas últimas 24h | `SELECT count(*) FROM net._http_response WHERE headers::text LIKE '%import-export%' AND created > now() - interval '24 hours'` |
| P4 | PO autoriza explicitamente o disable | Decisão formal do PO |
| P5 | Janela de observação definida | 24-48h mínimo após disable |

### A.4 Plano de execução

```
1. [PO] Autorizar disable via decisão formal
2. [OpenCode] Executar snapshot: backup source + dump templates → arquivo local
3. [OpenCode] Confirmar zero invocações últimas 24h
4. [OpenCode] Executar disable via CLI/API:
   supabase functions update import-export --project-ref ushsnmlbeurfvlkieiln --status INACTIVE
   (ou Management API: POST /v1/projects/{ref}/functions/{id} com status=INACTIVE)
5. [Observação] 24-48h monitorando:
   - logs de invocação (Dashboard Supabase)
   - net._http_response (deve permanecer em 0)
   - tickets de suporte / reports de erro
6. [Avaliação] Se zero impacto → propor DELETE em CC separado
7. [Documentação] Atualizar relatório com resultado da observação
```

### A.5 Critérios de entrada

- Source da função recuperado e arquivado localmente
- Snapshot das tabelas `control.*` preservado
- Janela de 24h com zero invocações confirmada
- PO autorizou formalmente o disable

### A.6 Critérios de saída

- Função com status=INACTIVE em PROD
- 24-48h de observação sem nenhum request recebido
- Logs do Dashboard Supabase confirmam zero invocações pós-disable
- Documentação atualizada com classificação final (manter inativa / deletar)

### A.7 Riscos

| # | Risco | Severidade | Mitigação |
|---|-------|------------|-----------|
| R1 | Caller externo não documentado tenta usar e falha | 🟠 médio | Disable é reversível (re-activate); monitorar logs |
| R2 | Integração de terceiros não rastreada | 🟠 médio | Mesmo do R1; janela de observação captura |
| R3 | Feature planejada (não conectada) impede rollout futuro | 🟢 baixo | Disable é reversível; re-activate quando necessário |
| R4 | Templates em `control.*` ficam órfãos | 🟢 baixo | Sem uso sem jobs; podem ser limpos separadamente depois |

### A.8 Rollback

```
supabase functions update import-export --project-ref ushsnmlbeurfvlkieiln --status ACTIVE
```

Tempo de execução: segundos. Sem perda de dados (envs preservadas, código deployado, templates intactos).

### A.9 Dependências

- PO autoriza formalmente (decisão)
- Acesso CLI ao projeto PROD (já disponível)
- Nenhuma dependência de outros sistemas (função standalone)

---

## B. Change Control: `sou-manager` legado — Saneamento de envs

### B.1 Contexto

Projeto Vercel `sou-manager`:
- Git link **desconectado** desde 2026-08-08 (D-HOM-11)
- Não dispara mais deploys por push
- Último deploy conhecido: `718f6f9` (~2026-07-17)
- 25 envs configuradas com credenciais sensíveis (audit 2026-08-08)
- Domínios customizados `soumanager.com`/`club.soumanager.com` em **parking no registrar**
- Subdomínio `soumanager.vercel.app` ainda resolve para Vercel (anycast IPs)
- Nenhum consumidor conhecido no código atual

### B.2 Escopo

Remover **credenciais sensíveis** das envs do projeto legado, preservando:
- O projeto Vercel em si (não deletar nesta frente)
- Configurações não-sensíveis (URLs públicas, feature flags)
- Histórico de deployments
- Domínios (decisão separada)

**NÃO fazer:** delete do projeto, alteração de DNS, alteração de domínios, revogação de credenciais Supabase (apenas remover do env do Vercel).

### B.3 Pré-condições

| # | Pré-condição | Como verificar |
|---|--------------|----------------|
| P1 | Enumerar as 25 envs atuais | Vercel Dashboard → projeto `sou-manager` → Settings → Environment Variables (PO) |
| P2 | Backup do snapshot atual | Vercel CLI: `vercel env ls --environment production --yes` para cada env (output para arquivo) |
| P3 | Classificar cada env (sensível/config) | Manual pelo PO baseado na enumeração |
| P4 | Confirmar zero tráfego nos domínios custom | Vercel Analytics (se disponível) ou análise DNS (já confirmado parked) |
| P5 | PO autoriza formalmente o saneamento | Decisão formal |

### B.4 Plano de execução

```
1. [PO] Autorizar saneamento via decisão formal
2. [PO] Acessar Vercel Dashboard → projeto sou-manager → Settings → Environment Variables
3. [PO] Para cada uma das 25 envs:
   a. Identificar se é SENSÍVEL (credencial) ou CONFIG (URL pública, flag)
   b. SENSÍVEL → REMOVER (ou setar para valor dummy inerte)
   c. CONFIG → MANTER
4. [PO] Documentar estado final em relatório:
   - Lista de envs removidas (nome, tipo, justificativa)
   - Lista de envs mantidas (nome, valor, justificativa)
   - Timestamp da operação
5. [Validação] Confirmar que:
   - Projeto não está sendo usado (deploys parados, tráfego zero)
   - Env vars sensíveis não estão mais expostas
6. [Avaliação] Decidir destino dos domínios custom (próxima frente)
```

### B.5 Critérios de entrada

- Enumeração completa das 25 envs obtida via Vercel Dashboard
- Classificação sensível vs config feita para cada env
- PO autorizou formalmente
- Confirmação de que git link permanece desconectado (D-HOM-11)

### B.6 Critérios de saída

- Todas as envs sensíveis removidas (ou dummy inerte)
- Apenas envs de configuração pública mantidas
- Relatório documentando antes/depois arquivado
- Verificação de que nenhum sistema quebrou (zero tráfego esperado)

### B.7 Riscos

| # | Risco | Severidade | Mitigação |
|---|-------|------------|-----------|
| R1 | Env removida era consumida por sistema não rastreado | 🟠 médio | Backup completo antes; reversível via Vercel (re-add) |
| R2 | Decisão de classificar como "config" é errada | 🟡 baixo | Conservador: remover se houver dúvida |
| R3 | Domínios parked continuam parking após saneamento (sem mudança) | 🟢 baixo | Esperado; tratado em frente separada |
| R4 | Auditoria externa questiona remoção de envs "sem explicação" | 🟢 baixo | Relatório documenta cada remoção |

### B.8 Rollback

Re-adicionar env var via Vercel Dashboard:
```
Settings → Environment Variables → Add → [nome] → [valor]
```

Sem perda de dados (Vercel preserva histórico). Tempo: minutos.

### B.9 Dependências

- PO acessa Vercel Dashboard (não posso automatizar sem token)
- Decisão de classificação env-by-env
- Vercel Analytics (se disponível) para confirmar tráfego zero

---

## F. Ordem recomendada entre as frentes

### F.1 Paralelismo

As duas frentes (A: import-export, B: sou-manager) são **independentes** — podem ser autorizadas e executadas em paralelo.

### F.2 Sequência lógica (relativa à Fase 2)

```
[FRENTE A — import-export disable]     [FRENTE B — sou-manager saneamento]
            ↓                                       ↓
       (24-48h observação)                  (documentação)
            ↓                                       ↓
            └───────────────┬───────────────────────┘
                            ↓
              [CONFIRMAÇÃO: zero impacto em ambos]
                            ↓
            [PO autoriza início da Fase 2 — key migration]
                            ↓
              [FASE 2 — sequência conforme plano]
                            ↓
              [Observação ≥24h pós-Fase 2]
                            ↓
              [5 condições AND para desativação legacy]
                            ↓
                  [Disable das legacy keys — reversível]
                            ↓
              [Observação ≥7 dias com legacy disabled]
                            ↓
                  [Delete das legacy keys — irreversível]
                            ↓
                  [Cleanup histórico via git filter-repo — CC próprio]
                            ↓
                  [Promoção V2 → PROD — CC próprio]
```

### F.3 Gating com Fase 2

**Nenhuma das duas frentes autoriza início da Fase 2 isoladamente.** As duas devem ser:
1. Executadas (disable + saneamento)
2. Observadas (24-48h cada)
3. Documentadas

Só então a Fase 2 pode começar — e mesmo assim precisa de nova autorização PO.

### F.4 Recomendações de paralelismo

- **Iniciar ambas em paralelo** se o PO autorizar (economiza tempo)
- **Não bloquear uma pela outra** (são realmente independentes)
- **Revisar ambas antes da Fase 2** (consolidação única dos efeitos)

---

## G. Atualização conceitual do plano Fase 2

### G.1 Consumidores ativos confirmados em PROD (atualizado pós-investigação)

#### `SUPABASE_ANON_KEY` (legacy JWT) — 6 consumidores

| # | Consumidor | Status | Origem |
|---|------------|--------|--------|
| 1 | Frontend `smg-barber` | ACTIVE | `VITE_SUPABASE_ANON_KEY` em `client.ts:13` |
| 2 | Edge `admin-create-user` | ACTIVE | `SUPABASE_ANON_KEY` em `index.ts:69` |
| 3 | Edge `invite-team-member` | ACTIVE | `SUPABASE_ANON_KEY` em `index.ts:43` |
| 4 | pg_cron D8 | ACTIVE | `Authorization: Bearer <anon legacy>` no SQL |
| 5 | Tests E2E | ACTIVE (local) | `VITE_SUPABASE_ANON_KEY` em múltiplos specs |
| 6 | Vercel `sou-manager` legado | ACTIVE (sem deploy) | provável (lista do audit 2026-08-08) |

#### `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT) — 6 consumidores

| # | Consumidor | Status | Origem |
|---|------------|--------|--------|
| 1 | Edge `admin-create-user` | ACTIVE | `SUPABASE_SERVICE_ROLE_KEY` em `index.ts:53` |
| 2 | Edge `portal-auth` | ACTIVE | `SUPABASE_SERVICE_ROLE_KEY` em `index.ts:42` |
| 3 | Edge `invite-team-member` | ACTIVE | `SUPABASE_SERVICE_ROLE_KEY` em `index.ts:17` |
| 4 | Edge `import-export` | ACTIVE (a ser desabilitado pela Frente A) | `SUPABASE_SERVICE_ROLE_KEY` em `index.ts:60` |
| 5 | Tests E2E | ACTIVE (local) | `SUPABASE_SERVICE_ROLE_KEY` em múltiplos specs |
| 6 | Vercel `sou-manager` legado | ACTIVE (sem deploy) | provável (lista do audit 2026-08-08) |

### G.2 Edge Functions fora do escopo PROD

As três funções abaixo **continuam fora do escopo** (não deployadas em PROD):
- `notification-sweep`
- `supabase-usage-monitor`
- `site-sanchez-appointments`

Não fazer deploy delas. Quando necessário, tratar como frentes próprias.

### G.3 Mudanças vs plano original

| Item do plano | Estado real | Ação |
|---------------|-------------|------|
| A1 (frontend) | Requer edição de código + build + deploy | Confirmado (mais amplo que o planejado) |
| B6 `notification-sweep` | **Não deployada** | Removida do escopo |
| B4 `supabase-usage-monitor` | **Não deployada** | Removida do escopo |
| B5 `site-sanchez-appointments` | **Não deployada** | Removida do escopo |
| **`import-export`** | **Descoberta + consome service_role** | **Adicionada (será desabilitada pela Frente A antes da Fase 2)** |

### G.4 Pré-condições absolutas para Fase 2

Antes de criar/rotacionar qualquer chave:

1. ✅ **Frente A concluída:** `import-export` desabilitada, 24-48h observação sem impacto
2. ✅ **Frente B concluída:** envs sensíveis do `sou-manager` legado removidas
3. ⏳ **P5 confirmado:** janela de baixo tráfego definida
4. ⏳ **Re-validação de importadores:** grep final pré-rotação, zero referências a `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` em runtime
5. ⏳ **PO autoriza explicitamente** a Fase 2

### G.5 Sequência revisada da Fase 2

```
[Pré-condições G.4] todas verdes
    ↓
[STAGING canário]
   1. Edge B1, B2, B3, (B4 desabilitada em PROD — não deployar em STAGING? verificar)
   2. pg_cron C1 (re-registro com nova publishable)
   3. Frontend A1 (edição código + build + deploy preview)
   4. Validar: login E2E + worker_heartbeat
    ↓
[PROD janela baixo tráfego]
   1. Edge B1-B3 (deploy discreto)
   2. pg_cron C1 (re-registro atômico)
   3. Frontend A1 (deploy Vercel + validação login)
   4. Tests D1-D4 (atualização de nomes)
   5. .env.local F1
    ↓
[Observação ≥24h]
    ↓
[5 condições AND para desativação legacy]
    ↓
[Disable legacy keys — reversível]
    ↓
[Observação ≥7 dias]
    ↓
[Delete legacy keys — irreversível]
    ↓
[git filter-repo — CC próprio]
    ↓
[Promoção V2 → PROD — CC próprio]
```

### G.6 Notas sobre `import-export` desabilitada

Quando a Frente A desabilitar `import-export`:
- A função deixa de aceitar invocações (retorna 404 ou connection refused)
- Env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) **permanecem configuradas** mas sem uso
- Schema `control` permanece (5 templates órfãos)
- **NÃO afeta a Fase 2** — a chave legacy continua sendo consumida por 5 outros consumidores
- Após Fase 2 (rotação), a env `SUPABASE_SERVICE_ROLE_KEY` da `import-export` ficará desatualizada mas inerte
- Cleanup da env var em si: **não urgente**, pode ser feito após confirmação de Fase 2 estável

---

## STOP

Esta proposta termina aqui. **Nenhuma mutação foi executada, nenhuma proposta foi autorizada para execução.**

### Pendente de autorização do PO:

1. **Frente A (import-export):** autorizar preparação → execução do disable
2. **Frente B (sou-manager):** autorizar preparação → execução do saneamento
3. **Sequência:** autorizar paralelo / sequencial
4. **Após ambas concluídas:** autorizar Fase 2 (com pré-condições G.4)

### Não autorizado por esta proposta:

- Disable de `import-export`
- Delete de `import-export`
- Limpeza de envs no `sou-manager`
- Delete do projeto `sou-manager`
- Criação de chaves
- Rotação de chaves
- Desativação de legacy keys
- Alteração de Vercel
- Alteração de Edge Functions
- Alteração de pg_cron
- Deploy
- Commit/push/merge

### Próxima ação:

Aguardar nova autorização explícita do PO para qualquer uma das duas frentes (A ou B).
