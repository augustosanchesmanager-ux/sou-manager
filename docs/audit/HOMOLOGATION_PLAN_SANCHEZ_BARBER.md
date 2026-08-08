# HOMOLOGATION PLAN — SANCHEZ BARBER (gate formal da v1.5.0)

> **Data do plano:** 2026-08-08
> **Autorização:** Plano elaborado por solicitação do PO (2026-08-08) como **gate formal de homologação** da Release v1.5, posicionado **após a janela única de deploy (6.0.5 aplicada no banco real) e antes da Fase 6.0.6**.
> **Modo do plano:** **EXCLUSIVAMENTE DOCUMENTAL** — este documento **não executa testes, não altera código, não altera banco e não aplica migrations**. Nenhuma ação será executada até aprovação formal do PO.
> **Baseline de referência:** 6.0.5.x **DEPLOYADA E VALIDADA** no banco real (`ushsnmlbeurfvlkieiln`) — ver `docs/DEPLOY_LOG_FASE_6_0_5.md`.
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** decisão do PO (2026-08-08) + `ROADMAP.md` (seção 6.0.5/6.0.6) + `RELEASE_CHECKLIST_v1.5.md` + `docs/DEPLOY_LOG_FASE_6_0_5.md`.
> **Atualização 2026-08-08 (D-HOM-9):** adicionado o **Gate H-8 — Infraestrutura Vercel / Deployment Topology** (origem oficial única do frontend). Auditoria read-only executada pelo OpenCode em 2026-08-08 → `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` (oficial: `smg-barber`/`barber.soumanager.com`; legado: `sou-manager`; produção `718f6f9` defasada). **Nenhuma alteração remota na Vercel.**
> **Atualização 2026-08-08 (D-HOM-10):** decisão do PO após a auditoria — **a homologação NÃO está encerrada**; a produção atende o frontend `718f6f9` (sem 6.0.1–6.0.5 e sem o fix `68acda4`), portanto o **H-8 é formalizado como BLOQUEADOR** da homologação. Criado o **bloco de "Hardening da Homologação / Vercel" (§8.1)** com 8 etapas obrigatórias. **Proibido até nova ordem do PO:** merge para `main`, deploy de produção v1.5, abertura da 6.0.6 e qualquer alteração remota na Vercel.
> **Atualização 2026-08-08 (D-HOM-11):** com aprovação explícita do PO, o **git link do projeto legado `sou-manager` foi DESCONECTADO** (double-deploy eliminado; projeto/domínios/env/histórico intactos; reversível via `vercel git connect`). Detalhes: `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` §8. ETAPA B autorizada com **conta de homologação** no tenant Sanchez Barber (validação local, sem deploy de produção).
> **Atualização 2026-08-08 (Pré-homologação autorizada pelo PO):** **baseline do snapshot** registrado em `docs/audit/SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` (contagens read-only do tenant `b716e290...` = Barbearia Principal/`sanchez`, achados S1–S8, **tenant LIVE**) e **especificação de execução dos gates H-1..H-7** adicionada na **§8.2** (pré-condição, procedimento, resultado esperado, evidência, severidade e critério de aprovação/bloqueio por gate). Critério H3-6 corrigido para **16 assinaturas**. **ETAPA B permanece adiada** (5 staff sem usuário de app; apenas o superadmin existe — confirmado no snapshot §9).
> **Atualização 2026-08-08 (D-HOM-12):** **conta de homologação CRIADA, VALIDADA e ETAPA B EXECUTADA** no tenant Sanchez Barber — `homolog.sanchez@barber.soumanager.com` (id `189053ab-f76b-4e91-90fc-998bb693711d`, role `manager`, `active`, membership primária, staff auto-criado pelo trigger). Login GoTrue 200, RLS OK, `get_auth_access_context` → `b716e290...`/manager/active, **login UI local OK (`/#/dashboard`), 0 erros, Comissões com dados reais**. Durante o provisionamento foram identificados e corrigidos 2 requisitos do GoTrue para usuários criados via SQL (linha em `auth.identities` + colunas de token `*_token`/`email_change` em `''`, não `NULL` — causa do `500 Database error querying schema`). **Achado EB-1 (P3, cosmético):** header mostra "Minha Barbearia"/"PLANO FREE" (origem `Layout.tsx` usa `user.user_metadata`, não `tenants`). Procedimento + evidências: `docs/audit/HOMOLOG_ACCOUNT_PROVISIONING.md`.

---

## STATUS: 🟡 PLANO SUBMETIDO PARA APROVAÇÃO DO PO (2026-08-08) — 🔴 H-8 BLOQUEADOR ATIVO — 🟢 PRÉ-HOMOLOGAÇÃO (SNAPSHOT + GATES H-1..H-7) PREPARADA

> **Regra da release (PO):** **6.0.6 não começa enquanto a homologação não estiver formalmente `HOMOLOGADO` ou `HOMOLOGADO COM RESSALVAS`, aprovada pelo PO.** Nenhuma execução será iniciada antes da aprovação explícita deste plano.
> **🔴 Bloqueio ativo (D-HOM-10):** produção atende o frontend `718f6f9` (sem 6.0.1–6.0.5 e sem o fix `68acda4`) + duplicidade Vercel (`smg-barber` × `sou-manager`). Homologar contra o frontend de produção atual **não valida a release v1.5** — a resolução do **bloco de Hardening (§8.1)** é pré-requisito para o fechamento de H-8 e para o veredito final.
> **🟢 Pré-homologação (autorizada 2026-08-08):** baseline `SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` ✅ + especificação de execução H-1..H-7 (pré-condição/procedimento/resultado/evidência/severidade/critério) na §8.2 ✅ + **conta de homologação CRIADA, VALIDADA e ETAPA B EXECUTADA (D-HOM-12)**. **Aguardando:** decisões do PO (destino do legado, deploy v1.5) para iniciar H-1..H-7 e o re-teste de Comissões sobre o preview oficial.

---

## Resumo executivo

A Fase 6.0.5 foi implementada, aplicada e validada no **banco real da Sanchez Barber** (6 migrations, pós-deploy 7/7, E2E Flow14/Flow13/Smoke verdes). Esse estado prova que **o schema se adaptou ao banco em operação** e que **os dados existentes foram preservados**.

A homologação transforma essa validação técnica em **prova operacional**: a Sanchez Barber deixa de ser apenas o tenant produtivo de referência e passa a ser homologada como **tenant produtivo real**, com fluxos de negócio executados no dia a dia. O resultado alimenta a **trilha de certificação da v1.5.0** e é o **gate de entrada da Fase 6.0.6** (Compliance & Legal).

---

## 1. Objetivo

Validar, no **tenant produtivo Sanchez Barber** (ambiente real `ushsnmlbeurfvlkieiln`), que a operação cotidiana funciona sobre a arquitetura 6.0.5 deployada, cobrindo:

- **H-1** Integridade operacional (dados preservados + acesso/permutações);
- **H-2** Fluxo financeiro P0 (atendimento → checkout → caixa → comissões);
- **H-3** Chef Club (adesão, benefícios, reflexos financeiros);
- **H-4** Billing / Tenant Lifecycle (todos os estados do ciclo);
- **H-5** Feature Flags (por plano, com/sem recurso, prompts e páginas de bloqueio);
- **H-6** Segurança (RLS, grants, papéis, isolamento entre tenants);
- **H-7** Operação real (um ciclo completo de trabalho acompanhado);
- **H-8** Infraestrutura Vercel / Deployment Topology (origem oficial única do frontend, domínio, branch, variáveis e Supabase corretamente vinculados).

## 2. Escopo

### 2.1 Inclui

- Execução de testes (E2E automatizados, consultas SQL de verificação e validações manuais) **exclusivamente contra o tenant Sanchez Barber** e dados reais de produção;
- Validação de todos os fluxos listados nos gates H-1 a H-8;
- Registro de evidência para **cada teste** (responsável, data, resultado, observação);
- Veredito final único em um dos 3 estados oficiais (ver §6);
- Atualização dos documentos da release ao final (log de homologação, RELEASE_CHECKLIST, PROJECT_STATUS, ROADMAP).

### 2.2 Não inclui

- ❌ Nenhuma migration nova;
- ❌ Nenhuma alteração de schema/RLS/RPCs fora do que já foi deployado;
- ❌ Nenhuma mudança de regra de negócio;
- ❌ Nenhuma correção automática de dados;
- ❌ Merge para `main`/`develop`;
- ❌ Deploy de frontend (Vercel);
- ❌ Qualquer alteração remota na Vercel (delete, desativar projeto/domínio, desvincular git, alterar env);
- ❌ Baseline/tag da v1.5.0;
- ❌ Início da Fase 6.0.6 (requer veredito + aprovação do PO).

## 3. Critérios de Entrada (pré-requisitos atendidos)

| # | Critério | Status |
|---|----------|--------|
| E-1 | 6.0.5.1–6.0.5.5 implementadas e certificadas | ✅ |
| E-2 | PCA 6.0.5.6 = `READY` | ✅ |
| E-3 | Schema Freeze = `YES` | ✅ |
| E-4 | Janela única de deploy executada (6 migrations aplicadas) | ✅ |
| E-5 | Pós-deploy 7/7 verdes + dados preservados | ✅ |
| E-6 | Backup lógico validado (D-6.0.5.7) | ✅ |
| E-7 | Fix hardening RPCs anon aplicado (D-6.0.5.8) | ✅ |
| E-8 | **Aprovação formal deste plano pelo PO** | ⏳ |
| E-9 | **Bloco de Hardening da Homologação / Vercel (§8.1) — origem oficial única + preview oficial `68acda4` + ETAPA B auth validada (D-HOM-10)** | ⏳ |

## 4. Dependências

- Tenant produtivo Sanchez Barber ativo e acessível (credenciais de homologação/operação);
- Usuários de teste no tenant (evitar contaminação de dados reais — preferência por dados criados e limpos ao fim, ou uso controlado de dados reais conforme regra do PO);
- `.env.local` com credenciais reais (já presente) + `E2E_PROVISIONING` conforme necessidade;
- Sem dependência de nova infraestrutura — tudo já deployado.

## 5. Critérios de Saída

Todos os testes de H-1 a H-8 executados, com evidência registrada, **e** veredito final atribuído (ver §6).

## 6. Veredito final (estados oficiais)

> O documento de homologação deve terminar **obrigatoriamente** em um destes estados:

| Estado | Significado | Consequência |
|--------|-------------|--------------|
| 🟢 **HOMOLOGADO** | Todos os testes P0/P1 passaram; sem ressalvas | Libera abertura da 6.0.6 |
| 🟡 **HOMOLOGADO COM RESSALVAS** | Somente problemas **não bloqueantes** (P2/P3), documentados com plano de ação | Libera abertura da 6.0.6 com pendências rastreadas |
| 🔴 **BLOQUEADO** | Existe **falha P0/P1** ou **risco de integridade** (dados/segurança/financeiro) | 6.0.6 NÃO abre; retorna-se à correção |

**Regra:** **6.0.6 não começa enquanto a homologação não estiver `HOMOLOGADO` ou `HOMOLOGADO COM RESSALVAS` formalmente aprovada pelo PO.**

## 7. Classificação de severidade

| Nível | Definição |
|-------|-----------|
| **P0** | Bloqueia operação; risco de perda/divergência financeira ou de dados; brecha de segurança/isolamento |
| **P1** | Funcionalidade crítica degradada sem workaround; divergência relevante |
| **P2** | Funcionalidade com workaround; problema menor de UX/relatórios |
| **P3** | Cosmético / melhoria sugerida |

---

## 8. Gates de homologação

> **Evidência obrigatória por teste:** método, responsável, data, resultado e observação. A homologação integra a trilha de certificação da v1.5.0 — não é uma lista informal.

### Gate H-1 — Integridade operacional

| ID | Teste | Método | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|-------|--------|--------------------|-------------|------|-----------|------------|
| H1-1 | Login do usuário real (gerente/dono) com credenciais corretas | Manual/E2E | Acesso autenticado; sem redirect indevido | OpenCode | ⏳ | ⏳ | |
| H1-2 | Login com senha incorreta | Manual | Acesso negado com mensagem | OpenCode | ⏳ | ⏳ | |
| H1-3 | Tenant correto resolvido (domínio/hostname → Sanchez Barber) | Inspeção + E2E | Todas as queries usam `tenant_id` da Sanchez Barber | OpenCode | ⏳ | ⏳ | |
| H1-4 | Perfis/roles da equipe mapeados corretamente (manager/barber/receptionist/cashier) | SQL + UI | Papéis efetivos correspondem aos esperados | OpenCode | ⏳ | ⏳ | |
| H1-5 | Listagem de usuários/equipe íntegra | SQL + UI | Contagem e membros corretos | OpenCode | ⏳ | ⏳ | |
| H1-6 | Clientes da Sanchez Barber preservados (contagem + amostra) | SQL | Igual ao snapshot pré-deploy | OpenCode | ⏳ | ⏳ | |
| H1-7 | Agenda (appointments) preservada | SQL | Dados íntegros; sem perda | OpenCode | ⏳ | ⏳ | |
| H1-8 | Serviços e produtos preservados | SQL | Igual ao snapshot | OpenCode | ⏳ | ⏳ | |
| H1-9 | Dados históricos (transações, comandas, cash closings, comissões) preservados | SQL | Contagens coerentes; sem regressão | OpenCode | ⏳ | ⏳ | |

### Gate H-2 — Fluxo financeiro P0

| ID | Teste | Método | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|-------|--------|--------------------|-------------|------|-----------|------------|
| H2-1 | Atendimento → comanda (criação e itens) | E2E | Comanda criada com valores corretos | OpenCode | ⏳ | ⏳ | |
| H2-2 | Checkout com todas as formas de pagamento | E2E | Pagamento registrado; valores conferem | OpenCode | ⏳ | ⏳ | |
| H2-3 | Fechamento de caixa do período | E2E | Total do caixa = soma das transações | OpenCode | ⏳ | ⏳ | |
| H2-4 | Fechamento por profissional | E2E | Valores por profissional corretos | OpenCode | ⏳ | ⏳ | |
| H2-5 | Comissões calculadas e conferidas | SQL/E2E | Comissão = regra de negócio vigente (ADR-001) | OpenCode | ⏳ | ⏳ | |
| H2-6 | Receitas/despesas registradas | SQL/E2E | Lançamentos íntegros | OpenCode | ⏳ | ⏳ | |
| H2-7 | Conferência de valores (caixa × comissões × comandas) | SQL | Quadratura financeira | OpenCode | ⏳ | ⏳ | |
| H2-8 | Cancelamento/reversão de checkout | E2E | Reversão consistente (sem duplicidade) | OpenCode | ⏳ | ⏳ | |

### Gate H-3 — Chef Club

| ID | Teste | Método | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|-------|--------|--------------------|-------------|------|-----------|------------|
| H3-1 | Cadastro/adesão de cliente | E2E | Assinatura criada corretamente | OpenCode | ⏳ | ⏳ | |
| H3-2 | Utilização dos benefícios (desconto/benefício ativo) | E2E | Desconto aplicado no checkout | OpenCode | ⏳ | ⏳ | |
| H3-3 | Regras de plano do Chef Club respeitadas | E2E | Limites/regras vigentes | OpenCode | ⏳ | ⏳ | |
| H3-4 | Reflexos financeiros (créditos, receivables) | SQL | Crédito debitado; receivable criado | OpenCode | ⏳ | ⏳ | |
| H3-5 | Permissões (quem cadastra/utiliza) | E2E | Roles controlam acesso | OpenCode | ⏳ | ⏳ | |
| H3-6 | Assinaturas Chef Club existentes preservadas | SQL | Igual ao snapshot (16: 13 ativas, 3 canceladas) | OpenCode | ⏳ | ⏳ | Ver `SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` |

### Gate H-4 — Billing / Tenant Lifecycle

| ID | Teste | Método | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|-------|--------|--------------------|-------------|------|-----------|------------|
| H4-1 | Estado `active` — acesso pleno | E2E | Acesso completo ao app | OpenCode | ⏳ | ⏳ | |
| H4-2 | Estado `past_due` — acesso restrito read-only com aviso (D-6.0.5-1) | E2E/SQL | Sem bloqueio; aviso presente; escrita bloqueada | OpenCode | ⏳ | ⏳ | |
| H4-3 | Estado `suspended` — acesso bloqueado (`/pending-approval`) | E2E | Redirect correto | OpenCode | ⏳ | ⏳ | |
| H4-4 | Reativação após pagamento (`suspended → active`) | E2E | Retorno automático ao acesso pleno | OpenCode | ⏳ | ⏳ | |
| H4-5 | Cancelamento ao fim do período (`cancel_at_period_end`) | E2E | Pedido registrado; efetivação correta | OpenCode | ⏳ | ⏳ | |
| H4-6 | Transição de plano (`change_tenant_plan` — upgrade/downgrade) | E2E/SQL | Espelho `tenants.plan` + `subscriptions.plan` consistentes | OpenCode | ⏳ | ⏳ | |
| H4-7 | Limites por plano (ex.: `max_staff`) | E2E/SQL | Limite respeitado | OpenCode | ⏳ | ⏳ | |
| H4-8 | Comportamento quando uma feature está indisponível | E2E | Página/bloqueio correto (H-5) | OpenCode | ⏳ | ⏳ | |
| H4-9 | Estados/transições via `runCycle` (grace `past_due` → `suspended`) | SQL | Matriz ADR-013 respeitada | OpenCode | ⏳ | ⏳ | |

### Gate H-5 — Feature Flags

| ID | Teste | Método | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|-------|--------|--------------------|-------------|------|-----------|------------|
| H5-1 | Tenant `free` — matriz de flags free | E2E/SQL | Flags = matriz free (14) | OpenCode | ⏳ | ⏳ | |
| H5-2 | Tenant `pro` — matriz pro | E2E/SQL | Flags = matriz pro (15) | OpenCode | ⏳ | ⏳ | |
| H5-3 | Tenant `premium` — matriz premium | E2E/SQL | Flags = matriz premium (20) | OpenCode | ⏳ | ⏳ | |
| H5-4 | Feature habilitada — acesso à rota/UI | E2E | Acesso liberado | OpenCode | ⏳ | ⏳ | |
| H5-5 | Feature desabilitada — `FeatureUnavailablePage` | E2E | Página de indisponibilidade exibida | OpenCode | ⏳ | ⏳ | |
| H5-6 | Upgrade prompt exibido quando aplicável | E2E | `UpgradePrompt` visível | OpenCode | ⏳ | ⏳ | |
| H5-7 | Acesso direto à rota de feature desabilitada | E2E | Bloqueio mesmo com URL direta | OpenCode | ⏳ | ⏳ | |
| H5-8 | Frontend NÃO consulta `feature_flags` diretamente | Inspeção (grep) | Zero acesso direto; uso exclusivo da RPC `tenant_has_feature` | OpenCode | ⏳ | ⏳ | |
| H5-9 | Override por tenant via `feature_flags` (superadmin) vence a matriz | E2E/SQL | Override aplicado | OpenCode | ⏳ | ⏳ | |

### Gate H-6 — Segurança

| ID | Teste | Método | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|-------|--------|--------------------|-------------|------|-----------|------------|
| H6-1 | RPCs protegidas (cash_closing, commissions, receivables, expenses, billing) rejeitam acesso indevido | SQL | `anon`/role incorreto → erro de auth | OpenCode | ⏳ | ⏳ | |
| H6-2 | Acesso `anon` bloqueado (pós D-6.0.5.8) | SQL | `anon_restantes = 0`; exceções públicas restritas | OpenCode | ⏳ | ⏳ | |
| H6-3 | Acesso `authenticated` autorizado conforme grants ADR-012 | SQL | Grants corretos por RPC | OpenCode | ⏳ | ⏳ | |
| H6-4 | Permissões por papel (manager/barber/receptionist/cashier/superadmin) | E2E | Matriz de navegação Flow13 válida (8/8) | OpenCode | ⏳ | ⏳ | |
| H6-5 | Isolamento entre tenants (RLS) | SQL/E2E | Query cross-tenant retorna vazio | OpenCode | ⏳ | ⏳ | |
| H6-6 | Tentativa de acesso cruzado entre tenants bloqueada | SQL/E2E | Bloqueio confirmado | OpenCode | ⏳ | ⏳ | |
| H6-7 | RLS habilitado nas tabelas de catálogo novas (`plans`/`features`/`plan_features`/`feature_flags`) | SQL | Policies corretas | OpenCode | ⏳ | ⏳ | |

### Gate H-7 — Operação real

> Diferente dos testes automatizados: validar **um ciclo real de trabalho da Sanchez Barber**, acompanhando o sistema durante a operação cotidiana.

| ID | Ciclo real acompanhado | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|------------------------|--------------------|-------------|------|-----------|------------|
| H7-1 | Cliente agenda → chega → atendimento → comanda → pagamento → comissão → fechamento do profissional → fechamento do caixa → conferência financeira | Ciclo completo executado sem erro; valores quadram; dados persistidos corretamente | OpenCode + Operação (Sanchez Barber) | ⏳ | ⏳ | |

> **Ressalva de dados:** H7 pode operar sobre dados reais do tenant conforme regra do PO (dados reais de faturamento da operação). Caso o PO prefira ambiente isolado, o ciclo é repetido com dados de teste e contagem real conferida via SQL.

### Gate H-8 — Infraestrutura Vercel / Deployment Topology

> **Adicionado por decisão do PO (2026-08-08, D-HOM-9)** após a detecção de que o mesmo commit `68acda4` foi implantado (preview) em **dois projetos Vercel** (`smg-barber` e `sou-manager`). Garantir que exista **uma única origem oficial** para o frontend de produção do SMG Barber, com domínio, branch, variáveis e Supabase corretamente vinculados — sem homologar um projeto enquanto o domínio real apontar para outro.
> **Auditoria read-only já executada em 2026-08-08:** `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` (veredito: oficial = `smg-barber`/`barber.soumanager.com`; legado = `sou-manager`; produção atual `718f6f9` defasada; sem alterações remotas).

| ID | Teste | Método | Critério de aceite | Responsável | Data | Resultado | Observação |
|----|-------|--------|--------------------|-------------|------|-----------|------------|
| H8-1 | Auditoria read-only da topologia Vercel (`smg-barber` × `sou-manager`): repo, branch, domínio, env, Supabase | API Vercel (GET) + CLI read-only | Topologia documentada; origem oficial única identificada | OpenCode | 2026-08-08 | ✅ Executado | Ver `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md` |
| H8-2 | Domínio oficial `barber.soumanager.com` atende o projeto oficial (`smg-barber`), sem redirect/erro | HTTP + API | Domínio → projeto oficial; Supabase `ushsnmlbeurfvlkieiln` | OpenCode | 2026-08-08 | ✅ Verificado | Bundles de produção apontam `ushsnmlbeurfvlkieiln` |
| H8-3 | Merge para `main` não gera deploy duplicado em 2 projetos | Inspeção de config | Mecanismo único de deploy definido (double-deploy eliminado) | OpenCode | 2026-08-08 | ✅ Resolvido | **Git link do `sou-manager` desconectado (D-HOM-11, autorização PO)** — merge dispara deploy apenas no `smg-barber`; reversível |
| H8-4 | Env do projeto oficial coerente (Supabase URL, anon key, `MULTI_SCHEMA_ENABLED`) | API Vercel env + bundle | Env = ambiente de homologação; sem divergência de schema routing | OpenCode | 2026-08-08 | ✅ Divergência detectada | `sou-manager` tem `MULTI_SCHEMA_ENABLED=true`; `smg-barber` não → **reconciliar** (decisão PO) |
| H8-5 | Config de build/root/output corretos e coerentes com o repositório | API Vercel | Build Vite correto; output `dist`/`.` | OpenCode | 2026-08-08 | ✅ Verificado | Config divergente entre projetos; ambos servem o mesmo app |
| H8-6 | Nenhuma credencial sensível no env do projeto oficial de frontend | API Vercel env (keys) | Zero `POSTGRES_*`/`SERVICE_ROLE`/`JWT_SECRET` no oficial | OpenCode | 2026-08-08 | ✅ Verificado | Secretas só no `sou-manager` (legado) |
| H8-7 | **Deploy de produção da release v1.5** (merge + build + smoke pós-deploy) planejado e registrado | Runbook | Produção atualizada além de `718f6f9`; smoke pós-deploy verde | OpenCode | ⏳ | ⏳ | Produção atual defasada (sem 6.0.1–6.0.5 e sem fix `68acda4`) — **decisão PO** |

### 8.1 Bloco de Hardening da Homologação / Vercel (decisão do PO, 2026-08-08 — D-HOM-10)

> **Regra do PO:** a homologação **não está encerrada** e **não deve ser considerada concluída** enquanto a produção atender um frontend que não é a release v1.5. O H-8 é formalizado como **🔴 BLOQUEADOR**. A sequência de fechamento passa obrigatoriamente por este bloco.

| # | Etapa | Ação | Status | Decisão do PO necessária |
|---|-------|------|--------|---------------------------|
| 1 | Consolidar origem oficial | Fixar `smg-barber`/`barber.soumanager.com` como **única origem oficial** do frontend de produção do SMG Barber | ✅ Auditado (2026-08-08) | — |
| 2 | Destino do legado `sou-manager` | Definir destino (desativar git link / desvincular deploy / desativar domínio) — **nada é deletado** sem autorização | ✅ Git link **DESCONECTADO** (D-HOM-11, executado 2026-08-08 — double-deploy eliminado); destino definitivo do projeto segue **decisão do PO** | ✅ SIM — git link desconectado; destino final em aberto |
| 3 | Auth / TenantContext (ETAPA B) | Repro do `Invalid Refresh Token` no frontend oficial → logout/limpeza de sessão → login → conferir `auth.uid()`, resolução de tenant (`get_auth_access_context`), Dashboard e Comissões; se `TenantContext` seguir falhando → registrar P1/P0 (independente do fix de comissões) | ✅ **EXECUTADA (2026-08-08, local)** — login UI com a conta `homolog.sanchez@barber.soumanager.com` → `/#/dashboard`; **zero** `Invalid Refresh Token`, zero redirect indevido, **0 erros de console e 0 erros HTTP Supabase**; Comissões renderizou dados reais da Sanchez (confirmada R$ 305,00 / pendente R$ 215,00 / vendas R$ 1.040,00, HERON). **Achado EB-1 (P3, cosmético):** header mostra "Minha Barbearia"/"PLANO FREE" (origem: `Layout.tsx` usa `user.user_metadata`, não `tenants`) — sem impacto funcional (authorização via `tenant_has_feature`). Detalhes: `docs/audit/HOMOLOG_ACCOUNT_PROVISIONING.md` §7 | Validação autorizada — **executada** |
| 4 | Preview oficial contém o fix | Garantir que o preview do **projeto oficial** (`smg-barber`) contenha o `68acda4` (build real, `buildSkipped=false`, env coerente) | ✅ Verificado (2026-08-08, `dpl_HDbTSiquDSC12Jod1MAiBji1cTib`) | — |
| 5 | Re-teste de Comissões | Testar Comissões da Sanchez Barber **sobre o preview oficial** (`smg-barber`), nunca sobre o preview do legado | ⏳ | Validação autorizada |
| 6 | Continuidade dos testes de homologação | Executar os testes remanescentes dos gates H-1 a H-7 (~45 testes) | ⏳ | — |
| 7 | Registro de achados | Registrar P0/P1/P2 encontrados (sem correção automática) | ⏳ | — |
| 8 | Fechamento dos gates | Somente após 1–7: fechar H-1…H-8 e atribuir veredito 🟢/🟡/🔴 | ⏳ | Aprovação do veredito |

> **Proibido até nova ordem do PO:** merge para `main`; deploy de produção v1.5; abertura da Fase 6.0.6; qualquer alteração remota na Vercel (delete, desativar, desvincular git, alterar env).

### 8.2 Especificação de execução dos gates H-1..H-7 (pré-homologação, autorizada 2026-08-08)

> **Baseline de conferência:** `docs/audit/SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` (contagens instantâneas de 2026-08-08 — o tenant é LIVE e as contagens podem variar durante a operação).
> **Regra PO:** qualquer achado P0/P1 durante a execução → **registrar e apresentar ao PO**; nunca corrigir automaticamente.
> **Pré-condição global:** conta de homologação no tenant Sanchez Barber (ETAPA B) **✅ CRIADA, VALIDADA E EXECUTADA (D-HOM-12, 2026-08-08)** + re-teste de Comissões sobre o preview oficial `smg-barber` (§8.1#4/#5) — **pendente** (re-teste deve rodar sobre o preview oficial, não no app local).

| Gate | Pré-condição | Procedimento | Resultado esperado | Evidência | Severidade | Critério de aprovação/bloqueio |
|------|--------------|--------------|--------------------|-----------|-----------|-------------------------------|
| **H-1** Integridade operacional | Conta de homologação ativa no tenant | H1-1/H1-2 login real (sucesso/erro); H1-3 domínio → tenant `b716e290...`; H1-4/H1-5 perfis/roles via SQL+UI; H1-6/H1-7/H1-8/H1-9 conferência de contagens contra snapshot §3/§4/§5 | Acesso sem redirect indevido; tenant correto em todas as queries; contagens coerentes com o snapshot (variação permitida = operação live) | Saída do teste + query SQL + captura de tela | P0: perda de dados/redirect quebra login | 🟢 todas as contagens ≥ baseline (sem regressão) · 🔴 perda de dados ou conta não resolve o tenant |
| **H-2** Fluxo financeiro P0 | H-1 aprovado | H2-1/H2-2 checkout com as formas de pagamento do tenant (pix, dinheiro, crédito, Chef Club); H2-3 fechamento de caixa; H2-4 fechamento por profissional; H2-5 comissões (ADR-001); H2-6 receitas/despesas; H2-7 quadratura caixa×comissões×comandas; H2-8 cancelamento/reversão | Valores do checkout == transações == comissões; quadratura (§4 como baseline); reversão sem duplicidade | JSON das operações + query de quadratura | P0: valor errado persistido | 🟢 quadratura ok + reversão consistente · 🔴 divergência financeira persistente |
| **H-3** Chef Club | H-1 aprovado | H3-1 adesão; H3-2 benefício no checkout; H3-3 regras do plano; H3-4 créditos/receivables via SQL; H3-5 permissões por role; H3-6 conferência de 16 assinaturas (S1: 13 ativas/3 canceladas) | Desconto aplicado; crédito debitado; receivable criado; **10 overdue + 6 pending investigados (S3)** | SQL + E2E + captura | P1: crédito debitado sem reflexo financeiro | 🟢 16 assinaturas preservadas + reflexos financeiros íntegros · 🔴 perda de assinatura/débito sem lançamento |
| **H-4** Billing/Lifecycle | H-1 aprovado | H4-1..H4-6 matriz de estados (active/past_due/suspended/reativação/cancelamento/transição) + H4-7 limites por plano + H4-8 feature indisponível + H4-9 `runCycle` (ADR-013) — **em tenant de teste E2E, NÃO no tenant real** | Estados e transições conforme ADR-013; `tenants.plan` refletido | SQL + E2E (Flow13) | P0: tenant real afetado | 🟢 matriz completa válida · 🔴 qualquer mutação no tenant real |
| **H-5** Feature Flags | H-4 aprovado | H5-1/H5-2/H5-3 matrizes free/pro/premium (14/15/20) via RPC `tenant_has_feature`; H5-4..H5-7 acesso/rota direta; H5-8 grep frontend (zero acesso direto a `feature_flags`); H5-9 override superadmin | Flags = matriz do plano; bloqueios corretos; override vence matriz | SQL + E2E + grep | P1: flag errada para o plano | 🟢 matriz pro (15) correta para Sanchez · 🔴 feature indisponível aparecendo/feature paga liberada |
| **H-6** Segurança | H-5 aprovado | H6-1 RPCs rejeitam acesso indevido; H6-2 `anon` bloqueado; H6-3 grants ADR-012; H6-4 matriz de papéis (Flow13 8/8); H6-5/H6-6 isolamento cross-tenant; H6-7 RLS nas tabelas de catálogo | Zero acesso indevido; queries cross-tenant vazias; RLS ativo (já verificado no snapshot §10) | SQL + E2E | P0: vazamento cross-tenant | 🟢 RLS+grants íntegros · 🔴 vazamento de dados entre tenants |
| **H-7** Operação real | H-2 aprovado + agendamento com a equipe | Acompanhar um ciclo real: agenda → atendimento → comanda → pagamento → comissão → fechamento do profissional → fechamento do caixa → conferência financeira | Ciclo completo sem erro; valores quadram; dados persistidos (§4 como baseline) | Registro do ciclo + conferência SQL pós-operação | P1: valor divergente na operação real | 🟢 ciclo completo e quadratura ok · 🔴 erro no ciclo real com impacto financeiro |

> **Sequência obrigatória:** H-1 → H-2 → H-3 → H-4 → H-5 → H-6 → H-7. Cada gate só inicia após o anterior aprovado. O **H-8 permanece BLOQUEADOR** independente do resultado de H-1..H-7 (produção ainda em `718f6f9`).

---

## 9. Estratégia de execução (após aprovação do PO)

1. **Hardening da Homologação / Vercel (§8.1):** executar as 8 etapas do bloco — consolidação da origem oficial, destino do legado (decisão PO), ETAPA B auth/tenant, preview oficial `68acda4`, re-teste de Comissões, continuidade dos testes H-1..H-7, registro de achados e fechamento dos gates.
2. **Preparação:** snapshot/contagem SQL do tenant Sanchez Barber (estado pré-homologação) para conferência.
3. **Automação:** executar suítes E2E já existentes que cobrem os gates (Flow14, Flow13, Smoke, flows P0/P1) contra o ambiente real com `E2E_PROVISIONING` conforme necessário.
4. **Validação manual/SQL:** testes que exigem inspeção de dados (integridade, quadratura, RLS/grants) executados via consultas individuais no runner Management API.
5. **Operação real (H7):** agendar com a equipe da Sanchez Barber um ciclo real de trabalho acompanhado.
6. **Topologia Vercel (H8):** confirmar H8-1 a H8-7 — auditoria read-only (já executada), reconciliação de duplicidade/env e **deploy de produção da release v1.5 (H8-7) apenas após decisão do PO**.
7. **Registro:** preencher este documento com evidência (responsável, data, resultado, observação) para cada teste.
8. **Veredito:** atribuir 🟢 / 🟡 / 🔴 e submeter à aprovação formal do PO.
9. **Atualização dos docs da release** (RELEASE_CHECKLIST, PROJECT_STATUS, ROADMAP, BUSINESS_DECISIONS se aplicável) e commit semântico + push.

## 10. Riscos

| Risco | Mitigação |
|-------|-----------|
| Testes automatizados poluem o banco real (usuários/tenants de teste) | Seguir padrão de seed/teardown do projeto; housekeeping ao final; uso controlado de dados reais conforme regra do PO |
| Divergência de valores encontrada (quadratura) | Registro P0/P1 → veredito BLOQUEADO; retorno à correção |
| Vazamento de acesso entre tenants detectado | Registro P0 → bloqueio; revalidação de RLS |
| Frontend consultando `feature_flags` diretamente | Inspeção grep (H5-8) → violação registrada e corrigida |
| Indisponibilidade do tenant em horário de operação real (H7) | Agendamento prévio com a operação; janela curta de acompanhamento |
| **Duplicidade Vercel (`smg-barber` × `sou-manager`) e double-deploy em merge para `main` (H8)** | Auditoria read-only executada (ver `docs/audit/VERCEL_DEPLOYMENT_TOPOLOGY_AUDIT.md`); **H-8 formalizado como BLOQUEADOR (D-HOM-10)**; reconciliação e destino do legado = **decisão do PO** antes de qualquer merge |
| **Produção defasada (`718f6f9`) — homologar frontend que não é a release v1.5** | **H8-7**: deploy de produção da release v1.5 planejado e registrado como etapa explícita da homologação, **após decisão do PO**; enquanto pendente, o **H-8 permanece BLOQUEADOR** |
| **Sessão inválida / `Invalid Refresh Token` no frontend oficial (ETAPA B, §8.1#3)** | Repro em produção; logout/limpeza de sessão e novo login; validar `get_auth_access_context` e resolução de tenant; **tratar isoladamente** — não atribuir como causa do bug de comissões (400) já corrigido |

## 11. Responsável

- **Execução:** OpenCode (Tech Lead operacional) com suporte da operação da Sanchez Barber para H7.
- **Aprovação do plano e do veredito:** Augusto (PO).

## 12. Próxima Etapa

1. PO decide o destino do legado `sou-manager` e autoriza a execução do bloco de **Hardening (§8.1)**.
2. **Pré-homologação (autorizada 2026-08-08):** snapshot/baseline concluído (`SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md`) + especificação de execução H-1..H-7 (§8.2) pronta + **conta de homologação CRIADA, VALIDADA e ETAPA B EXECUTADA (D-HOM-12)** — login UI OK, 0 erros, Comissões com dados reais; **achado EB-1 (P3)** registrado.
3. OpenCode executa as etapas restantes do bloco (re-teste de Comissões, testes H-1..H-7, registro de achados).
4. PO decide o deploy de produção da release v1.5 (H8-7) — único caminho para produção sair de `718f6f9`.
5. Veredito 🟢/🟡 → **abertura da Fase 6.0.6 (Compliance & Legal)**.
6. Veredito 🔴 → retorno à correção (nenhuma fase avança).

> **Regra da release:** **6.0.6 não começa enquanto a homologação não estiver `HOMOLOGADO` ou `HOMOLOGADO COM RESSALVAS` formalmente aprovada pelo PO.**
