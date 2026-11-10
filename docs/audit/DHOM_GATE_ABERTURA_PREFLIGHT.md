# D-HOM — GATE DE ABERTURA / PREFLIGHT (Homologação Sanchez Barber — Release v1.5.0)

> **Gate:** D-HOM — Homologação formal do tenant produtivo **Sanchez Barber** (Release v1.5.0) — ABERTURA/PREFLIGHT documental
> **Data:** 2026-09-19 · **Autor:** OpenCode (Tech Lead operacional)
> **Status:** ⏸ **ENVIADO PARA REVISÃO DO PO — nenhuma execução de homologação, nenhuma escrita, nenhum deploy, nenhum merge nesta preparação.**
> **Solicitação do PO (2026-09-19):** preparar o gate documental/read-only da D-HOM — **não executar a homologação durante a preparação**.
> **Frente independente:** P0.4 está **ENCERRADA** (gate próprio, V1–V5 5/5 PASS, 2026-09-19). A D-HOM nasce como frente separada e auditável. **H-7 (fix `bulk_close_comandas_with_credits`) e F1 não fazem parte desta frente.**

---

## 1. Objetivo da homologação

Validar, no **tenant produtivo Sanchez Barber** (`b716e290-f7f6-4449-b790-5ae9dcdadcab` — Barbearia Principal / slug `sanchez`, plano `pro`, status `active`, app `barber`) no ambiente real `ushsnmlbeurfvlkieiln`, que a **operação cotidiana** funciona sobre a arquitetura atual — fechando os gates remanescentes da Release v1.5.0 (**H-7 — Operação real** e **H-8 — Infraestrutura Vercel/Deployment Topology**), revalidando o estado dos gates já vereditados (H-1..H-6) contra o estado atual, e atribuindo o **veredito final** da homologação (🟢 HOMOLOGADO / 🟡 HOMOLOGADO COM RESSALVAS / 🔴 BLOQUEADO).

**Não há nada a deployar:** o backend P0.4 está certificado (3/3 ledger, 5/5 ACL) e o frontend já está em produção (`02a8e7f`, Vercel auto-deploy, 2026-09-19). A homologação é **prova operacional**, não aplicação.

---

## 2. Escopo funcional

### 2.1 Inclui

- **H-7 — Operação real:** um ciclo completo ponta-a-ponta acompanhado no tenant real (agenda → atendimento → comanda → pagamento → comissão → fechamento do profissional → fechamento do caixa → conferência financeira), conforme roteiro `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` (baseline B1..B10, ciclo H7-1, quadratura Q1..Q7, controles H2-1..H2-8 + H3-4 + S3 + comissão).
- **H-8 — Infraestrutura Vercel / Deployment Topology:** revalidação da topologia (origem oficial única `smg-barber`/`barber.soumanager.com`; produção atual; env; sem duplicidade de deploy), com **H8-7 (deploy de produção da release)** — *se ainda aplicável* — condicionado a decisão explícita do PO.
- **Revalidação read-only dos gates vereditados:** H-1 (integridade), H-2 (fluxo financeiro P0 — quadratura), H-3 (Chef Club — inclusive ressalva H3-5), H-4 (billing/lifecycle), H-5 (feature flags), H-6 (segurança) — conferência contra o estado atual; re-execução apenas quando houver mudança relevante ou pedido do PO.
- Registro de **evidência** por teste (método, responsável, data, resultado, observação).
- **Veredito final** em um dos 3 estados oficiais (§10).

### 2.2 Não inclui (proibido nesta frente)

- ❌ Nenhuma migration nova; nenhuma reaplicação de migration.
- ❌ Nenhuma alteração de schema/RLS/RPCs; nenhuma correção de corpo de RPC (inclui o drift `create_accounts_payable_from_recurring` `5c87853c…` — D2/D-DEP-4 reafirmados).
- ❌ Nenhuma mudança de regra de negócio; nenhuma correção automática de dados.
- ❌ Nenhum INSERT/UPDATE/DELETE fora dos dados de homologação **identificáveis** (dados de teste de homologação, se autorizados pelo PO, na janela operacional).
- ❌ Nenhum merge para `main`/`develop`; nenhum deploy de frontend (já em produção); nenhuma alteração remota na Vercel.
- ❌ Frentes P0.4 (encerrada), H-7 fix (`bulk_close_comandas_with_credits` — STOP GATE de implementação, separado) e F1 (working tree).
- ❌ Abertura da Fase 6.0.6 (requer veredito formal + aprovação do PO).

---

## 3. Pré-condições

| # | Pré-condição | Estado |
|---|---|---|
| P-1 | Tenant Sanchez Barber ativo e acessível (`pro`/`active`) | ✅ Confirmado (snapshot 2026-08-08; verificar na janela) |
| P-2 | Conta de homologação no tenant (`homolog.sanchez@barber.soumanager.com`, id `189053ab-f76b-4e91-90fc-998bb693711d`, `manager`, `active`) | ✅ Criada e validada (D-HOM-12) |
| P-3 | Backend P0.4 certificado em produção (3/3 ledger, 2/2 objetos, 5/5 ACL) | ✅ PASS em 2026-09-19 (gate P0.4) |
| P-4 | Frontend em produção = release atual (`02a8e7f`) | ✅ Deploy Vercel 2026-09-19T04:25 (verificar H-8 na janela) |
| P-5 | E2E STAGING 18/18 (P0.4) + suítes H-1..H-6 vereditadas | ✅ (H-1 ✅, H-2 ✅, H-3 🟡, H-4 ✅, H-5 ✅, H-6 🟢 c/ ressalva) |
| P-6 | Baseline read-only atualizado (contagens/quadratura) | ⏳ A capturar na auditoria read-only de abertura (nesta preparação: **não executada**) |
| P-7 | Janela operacional agendada com a equipe da Sanchez Barber (Rotinas: Rubens/equipe) | ⏳ **Decisão do PO** (dia/horário) |
| P-8 | Autorização explícita do PO para: (a) auditoria read-only de abertura; (b) janela da homologação | ⏳ **Objeto desta preparação** |

---

## 4. Estado baseline

Baseline de referência (read-only, já registrado — a ser **reconfirmado na auditoria de abertura**):

- **Snapshot pré-homologação:** `docs/audit/SNAPSHOT_PRE_HOMOLOGACAO_SANCHEZ_BARBER_v1_5_0.md` (2026-08-08) — tenant LIVE; contagens instantâneas.
- **Baseline H-7:** `docs/audit/H7_BASELINE_READONLY.md` (2026-08-16, zero escritas).
- **Contagens-chave (snapshot 08-08, para conferência):** appointments ~1.361 · clients 293 · comandas ~1.294 · staff 5 · services 17 · products 18 · transactions ~705 · cash_closings 3 (`draft`) · customer_subscriptions 16 (13 ativas + 3 canceladas) · customer_credits 15 · receivables 43 (27 paid / 10 overdue / 6 pending) · feature_flags 0 (sem override) · suppliers 1 · kiosk_devices 1.
- **Quadro financeiro (08-08):** comandas `paid` 765 / `open` 418 / `cancelled` 107 / `blocked` 4 · soma total R$ 67.331 (financial_effect=true) · pagamentos `pix` 411 (R$ 21.740) / Dinheiro 86 (R$ 4.160) / Clube do Chefe 21 (R$ 625).
- **Achados abertos do histórico (não bloqueiam abertura; exigem tratamento na janela ou decisão do PO):** **S3-1** — duplicidade RIOS R$ 260,00 (read-only 2026-08-16; tratamento = decisão do PO) · **M7** — dívida P3 `approve_access_request` (guarda `auth.uid()`, separada) · **H3-5** — ressalva (bloqueio de roles restritos não exercitado no tenant real).
- **Drift catalogado (preservar, não reparar):** `create_accounts_payable_from_recurring` — PROD `5c87853c…`/1053 vs repo/STAGING `7292cf8b…`/1282 (D2/D-DEP-4).

---

## 5. Janela operacional

- **Formato:** janela **acompanhada** — execução do ciclo H7-1 com a equipe da Sanchez Barber presente (decisão PO, D-HOM-27) e OpenCode operando tecnicamente.
- **Duração estimada:** 1 ciclo completo (H7-1); ampliação **somente** se o primeiro ciclo estiver perfeito e com autorização do PO.
- **Horário:** definido pelo PO (evitar horário de pico da operação; preferencialmente fora de movimentação crítica).
- **Antes da janela:** auditoria read-only de abertura (baseline atualizado + pré-condições + quadratura pré) → evidência → **STOP → decisão do PO**.
- **Após a janela:** quadratura pós + consolidação de evidências → **STOP → decisão do PO** (veredito).

---

## 6. Participantes / operadores

| Papel | Responsável | Atribuição |
|---|---|---|
| **PO / Decisor** | Augusto (PO) | Aprovações (abertura, janela, veredito), decisões estratégicas, agendamento com a operação |
| **Execução técnica** | OpenCode (Tech Lead operacional) | Auditoria read-only, automação E2E, consultas SQL, consolidação de evidências, documentação |
| **Operação / Suporte presencial (H-7)** | Rubens / equipe da Sanchez Barber | Execução do ciclo real acompanhado (dados reais do tenant) |
| **Homologação (conta dedicada)** | `homolog.sanchez@barber.soumanager.com` (manager) | Acesso para testes funcionais sem poluir operação real (quando aplicável) |

---

## 7. Cenários de teste

| Gate | Cenários |
|---|---|
| **H-1** Integridade operacional | Login real (sucesso/erro); tenant correto resolvido; perfis/roles; contagens contra baseline (clients, appointments, comandas, transactions, services, products, staff) |
| **H-2** Fluxo financeiro P0 | Checkout com formas de pagamento do tenant; fechamento de caixa; fechamento por profissional; comissões (ADR-001); receitas/despesas; **quadratura caixa×comissões×comandas (Q1..Q7)**; cancelamento/reversão sem duplicidade |
| **H-3** Chef Club | Adesão; benefício no checkout; regras de plano; créditos/receivables; permissões por role (H3-5 — ressalva revalidada); 16 assinaturas preservadas; S3 (10 overdue + 6 pending) |
| **H-4** Billing/Lifecycle | Revalidação da matriz H4-1..H4-9 (já 🟢; re-execução somente se solicitado — em tenant E2E isolado, **nunca** no tenant real) |
| **H-5** Feature Flags | Revalidação H5-1..H5-9 (já 🟢; re-execução somente se solicitado) |
| **H-6** Segurança | Revalidação read-only RLS/grants/isolamento (já 🟢 c/ ressalva; reauditoria somente se aplicável) |
| **H-7** Operação real | **1 ciclo completo ponta-a-ponta acompanhado** (H7-1) — conforme roteiro `H7_OPERACAO_REAL_ROTEIRO.md` |
| **H-8** Vercel/Topologia | Origem oficial única; produção = release atual; env coerente; sem double-deploy; **H8-7 (deploy de produção da release)** — *somente se ainda aplicável, com decisão explícita do PO* |

---

## 8. Quadratura financeira (antes/depois)

- **Antes (auditoria de abertura):** capturar contagens e somas do tenant (comandas por status/closure_mode, transações, cash closings, comissões por período, receivables/credits Chef Club, saldos) — **conferência Q1..Q7 conforme baseline H-7**.
- **Depois (encerramento da janela):** repetir as mesmas consultas; **diferença esperada = somente os movimentos do ciclo H7-1 de homologação** (identificáveis) — qualquer divergência não explicada = **STOP imediato** (sem correção automática no banco).
- **Critério estrutural (ROADMAP 8.44/ADR-001):** comissão (teórica) ≠ settlement (caixa) — conferências separadas, nunca substituídas.

---

## 9. Evidências obrigatórias

1. Baseline pré-janela (queries read-only com STATUS 201 — Management API) + fingerprint dos arquivos.
2. Registro do ciclo H7-1 (horário, operador, comanda/atendimento identificável como **homologação**).
3. Quadratura pré/pós (SQL).
4. Saídas de testes E2E (quando executados) com runId.
5. Conferências H-1..H-6 revalidadas (quando solicitadas).
6. Auditoria H-8 (API Vercel GET + HTTP + bundles) — revalidação.
7. Achados (P0/P1/P2/P3) — registro individual, **sem correção automática**.
8. Veredito final assinado pelo PO.

---

## 10. Critérios objetivos de PASS/FAIL

| Gate | PASS | FAIL |
|---|---|---|
| H-1 | Contagens ≥ baseline (variação = operação live) e sem regressão; acesso sem redirect indevido | Perda de dados / conta não resolve tenant / quebra de login |
| H-2 | Quadratura caixa × comissões × comandas ok; reversão sem duplicidade | Divergência financeira persistente |
| H-3 | 16 assinaturas preservadas; reflexos financeiros íntegros; S3 tratado/documentado | Perda de assinatura / débito sem lançamento / duplicidade |
| H-4 | Matriz H4-1..H4-9 válida (já 🟢) | Mutação no tenant real |
| H-5 | Flags = matriz do plano (pro 15); bloqueios corretos (já 🟢) | Flag errada / feature paga liberada |
| H-6 | RLS + grants íntegros; zero cross-tenant (já 🟢 c/ ressalva) | Vazamento de dados entre tenants |
| H-7 | Ciclo completo sem erro; valores quadram; dados persistidos | Erro no ciclo com impacto financeiro → **parada imediata** |
| H-8 | Origem oficial única; produção = release; env coerente | Duplicidade de deploy / produção defasada |

**Veredito final (obrigatório):** 🟢 HOMOLOGADO (sem ressalvas P0/P1) · 🟡 HOMOLOGADO COM RESSALVAS (somente P2/P3 documentados com plano de ação) · 🔴 BLOQUEADO (falha P0/P1 ou risco de integridade). **6.0.6 não abre antes do veredito formal do PO.**

---

## 11. Condições de STOP imediato

- Qualquer divergência financeira, duplicidade, perda de crédito, comissão incorreta, alteração inesperada de saldo ou quebra de fechamento (inclusive o achado **S3-1** — duplicidade RIOS — até decisão do PO).
- Escrita acidental ou fora do escopo autorizado.
- Anomalia de segurança/isolamento (cross-tenant).
- Necessidade de alterar código, migration, RPC, ACL ou dados existentes fora do escopo.
- Indisponibilidade da operação durante a janela agendada.

**Regra:** STOP → registrar evidência → apresentar ao PO → **nenhuma correção automática**.

---

## 12. Rollback / mitigação

- **Frente de homologação não altera produção** (nenhuma migration/RPC/ACL/deploy novo) — o "rollback" estrutural é desnecessário; o risco residual é o **drift catalogado** (`5c87853c…`, preservado).
- Testes funcionais criam **somente dados identificáveis de homologação** (prefixo/flag) — removíveis ao fim, sem tocar dados reais.
- Frontend: já em produção; em caso de anomalia de UI → redeploy Vercel de commit anterior (decisão do PO; nada automático).
- Em caso de falha P0/P1: veredito 🔴 → retorno à correção em frente própria (nunca correção dentro da homologação).
- Registro de tudo em `docs/BUSINESS_DECISIONS.md` (decisões D-HOM) + docs da release.

---

## 13. Separação entre teste e produção real

- **Tenant real Sanchez Barber:** somente consultas read-only + o **ciclo H7-1** (ajustado, identificável, autorizado) + dados de homologação identificáveis.
- **Tenant E2E isolado (provisionado):** toda e qualquer mutação (H-4 re-execução, H-5, H-6 adversarial, testes de roles restritos — ressalva H3-5) — **nunca** no tenant real.
- **P0.4/H-7 fix/F1:** frentes separadas, intocadas por esta homologação.
- Operador da homologação = conta dedicada `homolog.sanchez@…` (manager) — não contas de operação real.

---

## 14. Autorização explícita necessária

Para **iniciar a janela de homologação**, o PO deve autorizar formalmente:

1. **Auditoria read-only de abertura** (baseline atualizado + pré-condições + quadratura pré) — primeiro passo pós-aprovação deste gate; produz evidência e novo STOP.
2. **Janela da homologação** (H7-1 + H-8 revalidação) — com dia/horário definidos pelo PO e equipe da Sanchez Barber disponível.
3. **Re-execução de H-1..H-6** somente se o PO solicitar (default: conferência read-only do estado já vereditado).
4. **Veredito final** da homologação (após consolidação de evidências pós-janela).

> **Regra (verbatim PO, 2026-09-19):** *"O PASS de V1–V5 não constitui autorização automática para execução da D-HOM. Ele apenas encerra o gate P0.4 e permite submeter o próximo gate à decisão do PO."*

---

## 15. Decisões solicitadas ao PO (abertura D-HOM)

| # | Proposta | Voto do PO |
|---|---|---|
| **D-HOM-AB1** | Aprovar a **auditoria read-only de abertura** da D-HOM (baseline atualizado + pré-condições + quadratura pré — sem qualquer escrita) | ( ) Autorizado ( ) Outro |
| **D-HOM-AB2** | Confirmar escopo remanescente: **H-7 (ciclo H7-1) + H-8 (revalidação Vercel)** como gates ativos; H-1..H-6 por revalidação read-only (default) | ( ) Autorizado ( ) Outro |
| **D-HOM-AB3** | Definir **janela operacional** (dia/horário + disponibilidade da equipe Sanchez Barber) para o H7-1 | ( ) Informar / ( ) Outro |
| **D-HOM-AB4** | **S3-1 (duplicidade RIOS R$ 260,00):** decisão de tratamento (fora da homologação ou dentro, como achado documentado) | ( ) Fora ( ) Documentar ( ) Outro |
| **D-HOM-AB5** | Reafirmar **proibições**: nenhum deploy/merge/escrita/migration/RPC/ACL; frentes P0.4, H-7 fix e F1 intocadas | ( ) Confirmado ( ) Outro |

**Retorno do PO (o que muda → riscos → pré-condições → critérios de aceite → pontos de STOP → decisão):** espaço para registro do PO.

---

## 16. Fora do escopo (proibido nesta frente)

- Nenhuma escrita em banco fora da janela autorizada (e, dentro da janela, somente dados de homologação identificáveis).
- Nenhuma migration/RPC/ACL/repair de drift.
- Nenhum deploy/merge/tag.
- Nenhuma alteração remota na Vercel.
- Frentes P0.4 (encerrada), H-7 fix (`bulk_close_comandas_with_credits`) e F1 intocadas.
- Nenhuma abertura da 6.0.6 antes do veredito formal do PO.

---

## 17. Próximos passos (após decisão do PO)

1. **D-HOM-AB1..AB5 do PO** → auditoria read-only de abertura → evidências + **STOP → PO**.
2. Sem bloqueios → **janela da homologação** (H7-1 + H-8) agendada → **STOP → PO**.
3. Quadratura pós + veredito formal (+ atualização RELEASE_CHECKLIST/PROJECT_STATUS/ROADMAP/BUSINESS_DECISIONS e commit/push conforme fluxo).
4. Veredito 🟢/🟡 → abertura da 6.0.6 (decisão separada do PO).