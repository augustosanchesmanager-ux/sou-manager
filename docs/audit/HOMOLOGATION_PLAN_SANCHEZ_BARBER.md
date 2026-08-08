# HOMOLOGATION PLAN — SANCHEZ BARBER (gate formal da v1.5.0)

> **Data do plano:** 2026-08-08
> **Autorização:** Plano elaborado por solicitação do PO (2026-08-08) como **gate formal de homologação** da Release v1.5, posicionado **após a janela única de deploy (6.0.5 aplicada no banco real) e antes da Fase 6.0.6**.
> **Modo do plano:** **EXCLUSIVAMENTE DOCUMENTAL** — este documento **não executa testes, não altera código, não altera banco e não aplica migrations**. Nenhuma ação será executada até aprovação formal do PO.
> **Baseline de referência:** 6.0.5.x **DEPLOYADA E VALIDADA** no banco real (`ushsnmlbeurfvlkieiln`) — ver `docs/DEPLOY_LOG_FASE_6_0_5.md`.
> **Branch:** `feature/phase-6.0.4-billing`
> **Fonte de autoridade:** decisão do PO (2026-08-08) + `ROADMAP.md` (seção 6.0.5/6.0.6) + `RELEASE_CHECKLIST_v1.5.md` + `docs/DEPLOY_LOG_FASE_6_0_5.md`.

---

## STATUS: 🟡 PLANO SUBMETIDO PARA APROVAÇÃO DO PO (2026-08-08)

> **Regra da release (PO):** **6.0.6 não começa enquanto a homologação não estiver formalmente `HOMOLOGADO` ou `HOMOLOGADO COM RESSALVAS`, aprovada pelo PO.** Nenhuma execução será iniciada antes da aprovação explícita deste plano.

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
- **H-7** Operação real (um ciclo completo de trabalho acompanhado).

## 2. Escopo

### 2.1 Inclui

- Execução de testes (E2E automatizados, consultas SQL de verificação e validações manuais) **exclusivamente contra o tenant Sanchez Barber** e dados reais de produção;
- Validação de todos os fluxos listados nos gates H-1 a H-7;
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

## 4. Dependências

- Tenant produtivo Sanchez Barber ativo e acessível (credenciais de homologação/operação);
- Usuários de teste no tenant (evitar contaminação de dados reais — preferência por dados criados e limpos ao fim, ou uso controlado de dados reais conforme regra do PO);
- `.env.local` com credenciais reais (já presente) + `E2E_PROVISIONING` conforme necessidade;
- Sem dependência de nova infraestrutura — tudo já deployado.

## 5. Critérios de Saída

Todos os testes de H-1 a H-7 executados, com evidência registrada, **e** veredito final atribuído (ver §6).

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
| H3-6 | Assinaturas Chef Club existentes preservadas | SQL | Igual ao snapshot (15) | OpenCode | ⏳ | ⏳ | |

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

---

## 9. Estratégia de execução (após aprovação do PO)

1. **Preparação:** snapshot/contagem SQL do tenant Sanchez Barber (estado pré-homologação) para conferência.
2. **Automação:** executar suítes E2E já existentes que cobrem os gates (Flow14, Flow13, Smoke, flows P0/P1) contra o ambiente real com `E2E_PROVISIONING` conforme necessário.
3. **Validação manual/SQL:** testes que exigem inspeção de dados (integridade, quadratura, RLS/grants) executados via consultas individuais no runner Management API.
4. **Operação real (H7):** agendar com a equipe da Sanchez Barber um ciclo real de trabalho acompanhado.
5. **Registro:** preencher este documento com evidência (responsável, data, resultado, observação) para cada teste.
6. **Veredito:** atribuir 🟢 / 🟡 / 🔴 e submeter à aprovação formal do PO.
7. **Atualização dos docs da release** (RELEASE_CHECKLIST, PROJECT_STATUS, ROADMAP, BUSINESS_DECISIONS se aplicável) e commit semântico + push.

## 10. Riscos

| Risco | Mitigação |
|-------|-----------|
| Testes automatizados poluem o banco real (usuários/tenants de teste) | Seguir padrão de seed/teardown do projeto; housekeeping ao final; uso controlado de dados reais conforme regra do PO |
| Divergência de valores encontrada (quadratura) | Registro P0/P1 → veredito BLOQUEADO; retorno à correção |
| Vazamento de acesso entre tenants detectado | Registro P0 → bloqueio; revalidação de RLS |
| Frontend consultando `feature_flags` diretamente | Inspeção grep (H5-8) → violação registrada e corrigida |
| Indisponibilidade do tenant em horário de operação real (H7) | Agendamento prévio com a operação; janela curta de acompanhamento |

## 11. Responsável

- **Execução:** OpenCode (Tech Lead operacional) com suporte da operação da Sanchez Barber para H7.
- **Aprovação do plano e do veredito:** Augusto (PO).

## 12. Próxima Etapa

1. PO aprova este plano (ou solicita ajustes).
2. OpenCode executa a homologação conforme §9.
3. Veredito 🟢/🟡 → **abertura da Fase 6.0.6 (Compliance & Legal)**.
4. Veredito 🔴 → retorno à correção (nenhuma fase avança).

> **Regra da release:** **6.0.6 não começa enquanto a homologação não estiver `HOMOLOGADO` ou `HOMOLOGADO COM RESSALVAS` formalmente aprovada pelo PO.**
