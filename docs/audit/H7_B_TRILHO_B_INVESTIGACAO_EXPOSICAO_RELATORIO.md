# H-7 — Trilho B · Investigação de Exposição (import-export + sou-manager legado)

> **Tipo:** Investigação read-only · **Mutation:** NENHUMA executada · **Status:** ⏸️ aguardando autorização
> **Data:** 2026-09-20 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Produção:** `ushsnmlbeurfvlkieiln` — **INTACTA** (0 escritas, 0 rotações, 0 deploys)

---

## A. Estado e evidências de `import-export`

### A.1 Source recuperado

`supabase functions download import-export --project-ref ushsnmlbeurfvlkieiln` (read-only) retornou o código-fonte deployado: **`supabase/functions/import-export/index.ts`** (26.193 bytes, 695 linhas).

### A.2 Configuração deployada em PROD

| Atributo | Valor | Fonte |
|----------|-------|-------|
| Nome | `import-export` | `supabase functions list` (P4) |
| ID | `51b517cb-cbe3-4376-9c81-0d8b94cf1dce` | idem |
| Versão | 14 | idem |
| Status | ACTIVE | idem |
| `verify_jwt` (plataforma) | **false** | idem |
| `verify_jwt` (função) | **implementada manualmente** | linha 17-44 (`getAuthContext`) |

### A.3 Env vars consumidas (FATO OBSERVADO — do código)

| Env var | Linha | Uso |
|---------|-------|-----|
| `SUPABASE_URL` | 59 | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | 60 | Chave service_role para acesso admin |
| ❌ `SUPABASE_ANON_KEY` | — | **NÃO usada** |
| ❌ `SUPABASE_PUBLISHABLE_KEY` | — | **NÃO usada** |
| ❌ `SUPABASE_SECRET_KEY` (nova) | — | **NÃO usada** |

### A.4 Auth e roles

Apesar de `verify_jwt: false` na plataforma, a função **implementa sua própria autenticação**:

```
getAuthContext() chama supabase.auth.getUser(jwtDoHeader)
→ exige Authorization: Bearer <jwt-de-usuário-autenticado>
→ valida profile.tenant_id + role
```

Roles aceitas: `superadmin`, `manager`, `staff`, `barber`, `receptionist` (variam por endpoint).

**Observação:** `verify_jwt: false` na plataforma + auth manual na função = padrão válido mas incomum. A função depende do JWT do usuário no header, não de uma service key.

### A.5 Operações e tabelas (FATO OBSERVADO)

| Operação | Endpoint | Tabelas |
|----------|----------|---------|
| CRUD de templates | `/templates` | `control.import_export_templates` |
| Download de template CSV | `/{entity}/template` | `control.import_export_templates` |
| Validação de linhas | `/{entity}/validate` (POST) | `control.import_export_templates`, `control.import_job_rows`, `control.import_jobs` |
| Commit de import | `/{entity}/commit` (POST) | `control.import_jobs`, `control.import_job_rows`, `products`/`services`/`clients`, `control.import_audit_logs` |
| CRUD de jobs | `/jobs` | `control.import_jobs`, `control.import_audit_logs` |
| Cancel job | `/jobs/{id}/cancel` | `control.import_jobs` |
| Export CSV | `/{entity}/export` (GET) | `products`/`services`/`clients` |

Entidades suportadas: `products`, `services`, `clients` (hardcoded em `tableMap`).

### A.6 Evidências de uso em PROD

| Métrica | Valor | Fonte | Interpretação |
|---------|-------|-------|---------------|
| Templates ativos | **5** | Management API: `control.import_export_templates` | 5 registros existem |
| Jobs criados (total histórico) | **0** | Management API: `control.import_jobs` count=0 | **Nenhum job foi criado em PROD** |
| Audit logs (total histórico) | **0** | Management API: `control.import_audit_logs` count=0 | **Nenhuma operação auditada** |
| Invocations HTTP (`net._http_response`) | **0** | Management API: filter por `import-export` | **Zero invocações registradas** |

### A.7 Classificação `import-export`

| Critério | Estado |
|----------|--------|
| Função deployada e ACTIVE | ✅ |
| Código-fonte recuperável | ✅ |
| Implementa auth própria | ✅ |
| Schema/tabelas existem em PROD | ✅ (5 templates seed) |
| Evidência de uso real (jobs/audits/HTTP) | ❌ **ZERO evidência** |
| Risco de segurança (verify_jwt: false) | 🟠 moderado (mitigado por auth manual) |
| Dependência de legacy anon key | ❌ não |
| Dependência de legacy service_role | ✅ **SIM** |

**Classificação técnica:** `import-export` está **operacional mas sem uso observado** — a infraestrutura existe e funciona, mas nenhuma invocação, job ou audit log foi gerado em PROD desde o deploy (2026-04-02). Os 5 templates podem ser seed data. A função é **consumidora de `SUPABASE_SERVICE_ROLE_KEY` legacy** — entra na Fase 2.

---

## B. Evidências de uso/tráfego — `import-export`

### B.1 FATO OBSERVADO: zero tráfego

- `net._http_response`: 0 invocações (todas as colunas filtradas)
- `control.import_jobs`: 0 registros
- `control.import_audit_logs`: 0 registros
- Nenhum caller no código do frontend (`src/`)

### B.2 LACUNA DE EVIDÊNCIA

- Logs de Edge Function no Dashboard Supabase (retenção limitada, não acessíveis via Management API)
- Possíveis invocações externas diretas (curl, Postman, integrações de terceiros) — **INDETERMINADO**
- Possível uso por sistemas legados não rastreados — **INDETERMINADO**

### B.3 INFERÊNCIA (com cautela)

É possível que:
- A função foi deployada como infraestrutura para um feature futuro que nunca foi conectado ao frontend
- Integrações planejadas não foram implementadas
- Foi testada em dev e esquecida em PROD

**Mas:** ausência de evidência de uso ≠ ausência de uso. Não posso descartar chamadas externas.

---

## C. Dependências encontradas — `import-export`

### C.1 Env vars

| Variável | Tipo | Fase 2 |
|----------|------|--------|
| `SUPABASE_URL` | config (URL) | sem mudança |
| `SUPABASE_SERVICE_ROLE_KEY` | **credencial sensível (legacy)** | **DEVE migrar para `SUPABASE_SECRET_KEY`** |

### C.2 Tabelas/Schema

- Schema `control` em PROD: **existe** (verificado via Management API)
- Tabelas `import_export_templates` (5 rows), `import_jobs` (0), `import_job_rows` (0), `import_audit_logs` (0) — todas existem

### C.3 Risco de dados sensíveis

A função opera em `products`, `services`, `clients` — dados de clientes podem conter PII (nome, telefone, email). **INDETERMINADO** se dados sensíveis já foram processados (0 jobs sugere que não).

---

## D. Estado e evidências — projeto Vercel `sou-manager` legado

### D.1 Git link

- **DESCONECTADO** desde 2026-08-08 (D-HOM-11, autorizado pelo PO)
- Nenhum deploy automático por push
- Último deploy conhecido: commit `718f6f9` (~2026-07-17) — conforme `VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §4.2

### D.2 Domínios — FATO OBSERVADO (DNS lookup 2026-09-20)

| Domínio | IP resolvidos | Interpretação |
|---------|---------------|---------------|
| `soumanager.com` | `64.29.17.65`, `216.198.79.1` | 🟠 **IPs de domain parking (Bodis)** — não apontam para Vercel |
| `club.soumanager.com` | `216.198.79.1`, `216.198.79.65` | 🟠 **IPs de domain parking (Bodis)** — não apontam para Vercel |
| `soumanager.vercel.app` | `64.29.17.194`, `216.198.79.194` | ✅ resolve para Vercel (anycast IPs) |

**Achado crítico:** os domínios customizados (`soumanager.com`, `club.soumanager.com`) **não estão apontando para Vercel** — estão em parking no registrar. Apenas o subdomínio `.vercel.app` (auto-gerado) ainda resolve para a infraestrutura Vercel.

**LACUNA DE EVIDÊNCIA:** HEAD requests aos domínios parked (para verificar se retornam conteúdo) não completaram em janela de 60s — comportamento esperado para páginas de parking.

### D.3 Env vars — LACUNA DE EVIDÊNCIA

Sem token Vercel API, **não é possível enumerar diretamente as 25 envs**. Inferência baseada em audit doc + `.env.local` produziu lista de 25 nomes plausíveis (registrada em investigação anterior §B.3). **Os nomes e valores reais só podem ser confirmados via Dashboard Vercel ou REST API.**

### D.4 Consumidores no código atual

| Categoria | Evidência |
|----------|-----------|
| Frontend bundle | ❌ não (smg-barber é o oficial) |
| Edge Functions | ❌ não (as deployadas em PROD são outras) |
| Tests/scripts | ❌ não (tests usam STAGING ou PROD diretamente via .env.local) |
| Integrações externas | **INDETERMINADO** |

### D.5 Classificação `sou-manager` legado

| Critério | Estado |
|----------|--------|
| Git link conectado | ❌ (desconectado desde 2026-08-08) |
| Deploys automáticos | ❌ |
| Domínios customizados → Vercel | ❌ (**parked no registrar**) |
| Subdomínio `.vercel.app` resolve | ✅ |
| 25 envs com credenciais | ✅ (inferido, não enumerado) |
| Consumidores ativos conhecidos | **INDETERMINADO** (nenhum no código atual) |

**Classificação técnica:** `sou-manager` legado está **órfão com domínios customizados em parking**. O subdomínio `.vercel.app` ainda aponta para Vercel mas não recebe deploys. Não há consumidores conhecidos no código atual. As 25 envs permanecem configuradas com credenciais mas não estão sendo consumidas ativamente (pelo código atual).

---

## E. Domínios e tráfego — `sou-manager`

### E.1 Resumo DNS

```
soumanager.com          → 64.29.17.65, 216.198.79.1       (Bodis parking)
club.soumanager.com     → 216.198.79.1, 216.198.79.65     (Bodis parking)
soumanager.vercel.app   → 64.29.17.194, 216.198.79.194   (Vercel anycast)
barber.soumanager.com   → (oficial, não investigado aqui)
```

### E.2 Tráfego observável

- **FATO:** domínios customizados não apontam para Vercel (parking)
- **FATO:** subdomínio vercel.app resolve mas não há deploy desde 2026-07-17
- **LACUNA:** Vercel Analytics (requer token) — **INDETERMINADO** se há tráfego humano
- **INFERÊNCIA:** se domínios custom estão em parking e não há deploy, o tráfego efetivo no projeto legado é provavelmente **nulo ou vestigial**

### E.3 Risco de domínios parked

Domínios em parking podem:
- Exibir anúncios de terceiros
- Ser registrados por terceiros após expiração (risco reputacional)
- Não representam risco técnico direto ao projeto Vercel

---

## F. Consumidores encontrados

### F.1 Consumidores ativos de legacy keys (atualizado pós-import-export)

| Legacy key | Consumidores ativos em PROD |
|------------|------------------------------|
| `SUPABASE_ANON_KEY` | 6 confirmados: frontend `smg-barber` + `admin-create-user` + `invite-team-member` + pg_cron D8 + tests E2E + `sou-manager` legado (provável) |
| `SUPABASE_SERVICE_ROLE_KEY` | **6 confirmados** (atualizado): `admin-create-user` + `portal-auth` + `invite-team-member` + **`import-export`** (novo) + tests + `sou-manager` legado (provável) |

### F.2 Total de Edge Functions consumidoras de `SUPABASE_SERVICE_ROLE_KEY` legacy

| Função | Status em PROD | Fase 2 |
|--------|----------------|---------|
| `admin-create-user` | ACTIVE | migrar |
| `portal-auth` | ACTIVE | migrar |
| `invite-team-member` | ACTIVE | migrar |
| `import-export` | ACTIVE (mas sem uso) | **migrar** |
| `supabase-usage-monitor` | NÃO deployada | n/a |
| `site-sanchez-appointments` | NÃO deployada | n/a |

---

## G. Dependências de legacy keys

### G.1 `SUPABASE_ANON_KEY` (legacy JWT)

| Consumidor | Dependência confirmada |
|------------|------------------------|
| Frontend `smg-barber` (Vercel) | ✅ via `VITE_SUPABASE_ANON_KEY` |
| Edge `admin-create-user` | ✅ via `SUPABASE_ANON_KEY` |
| Edge `invite-team-member` | ✅ via `SUPABASE_ANON_KEY` |
| Edge `notification-sweep` | código tem, mas **NÃO deployada** |
| pg_cron D8 | ✅ via `Authorization: Bearer <anon legacy>` |
| Tests E2E | ✅ leem `VITE_SUPABASE_ANON_KEY` |
| `sou-manager` legado (Vercel) | ✅ provável (env na lista do audit) |

### G.2 `SUPABASE_SERVICE_ROLE_KEY` (legacy JWT)

| Consumidor | Dependência confirmada |
|------------|------------------------|
| Edge `admin-create-user` | ✅ via `SUPABASE_SERVICE_ROLE_KEY` |
| Edge `portal-auth` | ✅ via `SUPABASE_SERVICE_ROLE_KEY` |
| Edge `invite-team-member` | ✅ via `SUPABASE_SERVICE_ROLE_KEY` |
| Edge `import-export` | ✅ via `SUPABASE_SERVICE_ROLE_KEY` |
| Edge `supabase-usage-monitor` | código tem, mas **NÃO deployada** |
| Edge `site-sanchez-appointments` | código tem, mas **NÃO deployada** |
| Tests E2E | ✅ leem `SUPABASE_SERVICE_ROLE_KEY` |
| `sou-manager` legado (Vercel) | ✅ provável (env na lista do audit) |

---

## H. Lacunas de evidência

| # | Lacuna | Impacto |
|---|--------|---------|
| H1 | Logs de Edge Function do Dashboard Supabase (retenção limitada) | Não é possível auditar invocações históricas além de `net._http_response` |
| H2 | Vercel API para `sou-manager` legado | Não é possível enumerar 25 envs exatas nem confirmar tráfego/analytics |
| H3 | DNS reverso dos IPs parked | Não é possível confirmar se `soumanager.com` está em Bodis ou outro parking |
| H4 | Integração `import-export` em sistemas externos | Não é possível descartar uso externo (curl, Postman, integrações) |
| H5 | Vercel deployment atual do `sou-manager` | Último conhecido é `718f6f9` (2026-07-17), estado atual do deployment desconhecido sem API |

---

## I. Riscos encontrados

| # | Risco | Severidade | Detalhes |
|---|-------|------------|----------|
| I1 | `import-export` é service_role + público, sem uso observado | 🟠 alto | Se usado externamente sem sabermos, contém dados de clientes |
| I2 | `sou-manager` legado tem 25 envs com credenciais, domínios parked | 🟠 alto | Credenciais expostas historicamente; sem consumidores ativos conhecidos |
| I3 | Domínios `soumanager.com`/`club.soumanager.com` em parking | 🟡 médio | Risco reputacional se expirarem ou forem registrados por terceiros |
| I4 | `verify_jwt: false` em `import-export` depende de auth manual | 🟡 médio | Se função for modificada sem auth, vira porta aberta |
| I5 | 5 Edge Functions ativas em PROD dependem de legacy keys | 🔴 crítico (para Fase 2) | Janela de desativação legacy é bloqueada por todas |

---

## J. Classificação de cada frente

### J.1 `import-export`

| Dimensão | Avaliação |
|----------|-----------|
| **Operacional?** | **INDETERMINADO** — infraestrutura existe, 0 uso observado |
| **Sem uso observado?** | Provável SIM (5 templates seed, 0 jobs, 0 audits, 0 HTTP) |
| **Desconhecida?** | Possível (uso externo não rastreável) |
| **Potencialmente exposta?** | NÃO diretamente (service_role + auth manual), mas superfície de ataque se modificada |

### J.2 `sou-manager` legado

| Dimensão | Avaliação |
|----------|-----------|
| **Operacional?** | NÃO — domínios parked, sem deploys desde 2026-07-17 |
| **Parcialmente operacional?** | Apenas subdomínio `.vercel.app` resolve |
| **Sem uso observado?** | SIM (nenhum consumidor no código atual) |
| **Órfão?** | SIM — git link desconectado, domínios parked |
| **Indeterminado?** | Tráfego externo nos domínios — **INDETERMINADO** |

---

## K. Recomendação de tratamento (análise técnica para decisão do PO)

### K.1 `import-export`

| Opção | Descrição | Risco | Recomendação |
|-------|-----------|-------|--------------|
| Preservar | Manter ACTIVE, esperar uso futuro | Service_role exposta em código deployado; risco se modificada | ❌ não recomendado |
| Corrigir | Mudar `verify_jwt` para `true` (forçar auth plataforma) | Quebra se callers externos existem | ⚠️ requer investigação adicional |
| Desativar | Set status=INACTIVE_OR_REMOVED (não deleta) | Baixo (sem uso observado); preserva opção de reativar | ✅ **recomendado como passo 1** |
| Eliminar | Deletar função | Irreversível; descarta 5 templates + lógica | ⚠️ só após confirmação de não-uso |
| Investigar mais | Logs Supabase Dashboard + análise de dependências externas | Tempo/custo | ⚠️ opcional |

**Recomendação combinada:**
1. **Desativar** imediatamente (não deletar) — service_role continua válida, mas função para de aceitar invocações. Se houver uso externo, fica visível nos logs.
2. **Investigar** logs de Dashboard Supabase (24-48h após desativação) para confirmar zero impacto.
3. **Eliminar** apenas após confirmação de zero dependências (Change Control próprio).

### K.2 `sou-manager` legado

| Opção | Descrição | Risco | Recomendação |
|-------|-----------|-------|--------------|
| Preservar | Manter projeto Vercel com 25 envs | Credenciais em texto claro em Vercel; risco histórico de exposição | ❌ não recomendado |
| Corrigir | Remover envs sensíveis manualmente via Dashboard | Requer acesso Dashboard do PO | ✅ **recomendado como passo 1** |
| Desativar | Set project status=inactive | Domínios podem quebrar se apontarem para Vercel | ⚠️ verificar DNS primeiro |
| Eliminar | Deletar projeto Vercel + domínios | Irreversível; remove subdomínio `.vercel.app` | ⚠️ só após decisão sobre domínios |
| Investigar mais | Vercel API para confirmar estado exato | Requer token | ⚠️ opcional |

**Recomendação combinada:**
1. **Verificar DNS parked** (confirmar que custom domains não apontam para Vercel) — ✅ **JÁ CONFIRMADO** nesta investigação
2. **Investigar tráfego** (Vercel Analytics, se disponível) para confirmar zero uso
3. **Remover envs sensíveis** (limpar 25 envs sem deletar projeto) — **recomendado** após autorização
4. **Decidir destino dos domínios** (manter parked / deletar / redirecionar) — decisão PO

---

## STOP

Esta investigação termina aqui. **Nenhuma mutação foi executada, nenhuma chave foi criada/rotacionada/desativada.**

### Pendente de autorização do PO:

1. **Decisão sobre `import-export`:** desativar / investigar mais / deletar
2. **Decisão sobre `sou-manager` legado:** limpar envs / deletar projeto / manter
3. Confirmação de janela (P5) quando Fase 2 for autorizada
4. Autorização para iniciar Fase 2 (com escopo atualizado — agora inclui `import-export`)

### Não entregue (depende de ação do PO):

- Enumeração completa das 25 envs do `sou-manager` (requer Vercel API token)
- Confirmação de tráfego em `soumanager.com`/`club.soumanager.com` (requer Vercel Analytics)
- Logs históricos de `import-export` além de `net._http_response` (requer Dashboard Supabase)
- Valores reais de qualquer credencial
- Qualquer mutação
