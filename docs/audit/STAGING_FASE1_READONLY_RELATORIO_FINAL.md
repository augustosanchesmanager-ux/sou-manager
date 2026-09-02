# STAGING GATE — FASE 1 · Relatório de Auditoria READ-ONLY (Homologação Isolada M4/P4/P5/P7)

> **Gate:** STAGING GATE · **Fase:** 1 (Auditoria READ-ONLY)
> **Status:** ⛔ **NÃO existe ambiente Supabase isolado de staging** para homologar P4/P5/P7 hoje. Auditado e documentado. **Nenhuma operação de escrita executada.** STOP aguardando aprovação do PO.
> **Data:** 31/08/2026 · **Responsável:** OpenCode (Tech Lead) + Augusto (PO)
> **Produção intocável:** `ushsnmlbeurfvlkieiln` — `sou-manager`
> **Base normativa:** Mandato STAGING GATE FASE 1 (intocado durante a auditoria) · política oficial PG (2026-08-06)

---

## 1. Objetivo

Abrir e executar **somente a FASE 1 READ-ONLY** para preparar uma homologação real em ambiente isolado. Responder, com evidência, à pergunta central:

> "Temos hoje um ambiente Supabase realmente isolado para homologar P4/P5/P7? Se não, exatamente o que precisamos criar/configurar para ter um?"

Nenhuma criação de projeto, migration, seed, DML, RPC financeira, alteração de `.env.local`, código, commit, push ou deploy é permitida nesta fase.

## 2. Escopo

| Item | Conteúdo |
|---|---|
| **Em auditoria (READ-ONLY)** | Projetos Supabase acessíveis (Q1) · existência de staging (Q2) · permissão de provisionamento (Q3) · estado local do projeto (Q4) · migrations necessárias (Q5) · dependências da aplicação/env vars (Q6) · cenários de homologação P4/P5/P7 (Q7) · segurança (FASE 1.5) |
| **Executado** | `supabase projects list` (metadata) · leitura de `linked-project.json` · inspeção de `supabase/migrations/`, `supabase/functions/`, `DATABASE_INVENTORY.md` · auditoria de E2E (`globalSetup.ts`, `supabaseAdmin.ts`, fixtures, flows, homologation, gates) · mapeamento de env vars da aplicação/worker · verificação de ausência de `.env.local`, `config.toml`, `.env.example`, seeds |
| **NÃO executado (por regra)** | Criação de projeto Supabase · migrations · seeds · INSERT/UPDATE/DELETE · RPC financeira · configuração de produção · alteração de `.env.local` · ativação de `.env.local.val-bak` · deploy · commit · push · merge · tag · qualquer comando que pudesse atingir produção de forma ambígua |
| **Fora do escopo** | Provisionamento (próxima fase, depende de aprovação do PO) · homologação funcional efetiva (fases seguintes) |

## 3. Estado dos Projetos Supabase (Q1)

Projetos acessíveis pela CLI (`npx supabase projects list`, leitura de metadata — **nenhum dado de tenant acessado**):

| PROJECT REF | NOME | ORG | REGIÃO | CRIADO (UTC) | LINKED | Classificação p/ staging |
|---|---|---|---|---|---|---|
| **`ushsnmlbeurfvlkieiln`** | **sou-manager** | `eacrvldjisvgkiuamesq` | West US (Oregon) | 2026-02-18 19:53:30 | **● SIM (produção)** | ❌ **INADEQUADO — PRODUÇÃO** (contém dados reais) |
| `rvpmaqoqrorcbxxnqpjo` | sanchez-barber | `eacrvldjisvgkiuamesq` | West US (Oregon) | 2026-03-11 20:47:07 | Não | ❌ **INADEQUADO — tenant/produto real sanitizado (Sanchez Barber)**; não é um staging deste repo |
| `krcerrmflfeetlbrwnxd` | supabase-beige-flame | `vercel_icfg_vJJcbEKNVd5ib9xMmoXawn1u` | East US (North Virginia) | 2026-05-04 22:52:19 | Não | ❌ **INADEQUADO — projeto autônomo criado via Vercel** (org Vercel), sem relação documentada com staging deste repositório |

**Identificação da produção:** o projeto linkado é **`ushsnmlbeurfvlkieiln` `sou-manager`** — confirmado tanto por `npx supabase projects list` (coluna LINKED) quanto por `supabase/.temp/linked-project.json` (`{"ref":"ushsnmlbeurfvlkieiln","name":"sou-manager",...}`). Este é o único projeto com dados reais de produção e é **intocável**.

## 4. Identificação da Produção

- **Ref:** `ushsnmlbeurfvlkieiln`
- **Nome:** `sou-manager`
- **Região:** West US (Oregon)
- **Prova de linked:** `supabase/projects list` marca `●`; `supabase/.temp/linked-project.json` aponta para ele.
- **Risco ativo:** qualquer `supabase db push --linked`, `migration repair --linked`, `db reset --linked`, RPC financeira ou DML **sem** um `.env.local`/projeto explícito diferente **atingiria este projeto**. **Nenhum desses comandos foi executado.**
- **Estado:** intocada (0 escritas nesta fase; auditada apenas via metadata).

## 5. Existência ou Ausência de Staging (Q2)

**NÃO existe um projeto Supabase separado que sirva de homologação/staging do SMG Barber.**

Critério obrigatório atendido na análise dos 3 projetos acessíveis:

| Projeto | Serve como staging isolado do SMG Barber? | Motivo |
|---|---|---|
| `ushsnmlbeurfvlkieiln` sou-manager | ❌ | É a **produção** (dados reais). Proibido para teste de escrita financeira. |
| `rvpmaqoqrorcbxxnqpjo` sanchez-barber | ❌ | Projeto do tenant/produto **Sanchez Barber** (dados reais do negócio). Não é um ambiente de staging genérico/reproduzível deste repo e conteria dados reais. |
| `krcerrmflfeetlbrwnxd` supabase-beige-flame | ❌ | Projeto autônomo criado pelo **Vercel** (org `vercel_icfg_...`), não vinculado a um pipeline de staging deste repositório; sem evidência de estar pronto/reproduzível para M4. |

**Conclusão Q2:** não há tenant isolado **dentro de um projeto separado** que seja equivalente a um staging. (Tenant E2E isolado **dentro da produção** — D-HOM-19 — **não** é considerado equivalente a staging pelo critério obrigatório desta tarefa.)

## 6. Permissões de Provisionamento (Q3)

- **Verificação read-only possível:** o `npx supabase projects list` **retornou os 3 projetos**, o que prova que a CLI está **autenticada** e tem permissão de **leitura** na organização `eacrvldjisvgkiuamesq` (owner).
- **Criação de projeto (WRITE):** **não executada** por regra desta fase. Não é possível **provar** a permissão de criação sem executar um comando de escrita (`supabase projects create`), o que é proibido.
- **Limitação declarada:** a capacidade de criar/administrar um projeto separado **não foi testada** (exigiria escrita). Não fazemos suposição. A próxima fase (provisionamento) deverá validar explicitamente, **somente após aprovação do PO**, se a conta/org permite criar um novo projeto de staging.

## 7. Estado das Migrations (Q4/Q5)

### 7.1 Inventário local

- **`supabase/migrations/` contém 131 arquivos `.sql` + 7 utilitários/diagnósticos** (`bulk_close_comandas_with_credits.sql`, `_audit_queries.sql`, `_diagnostic_*.sql`, `_functional_tests.sql` — não são migrations versionadas).
- **NÃO existe `supabase/config.toml`** (sem configuração local de Supabase; `supabase start`/local não configurado).
- **NÃO existe `env.example`**; **NÃO existe `supabase/seed.sql`**.

### 7.2 Cadeias de migrations relevantes para P4/P5/P7 (Q5)

Para reproduzir o schema necessário a P4/P5/P7 em um staging separado, é preciso aplicar **todas** as migrations na ordem do repositório (a ordem é por timestamp e reflete a história real do banco). As **cadeias nomeadas** (D8/M1/M2/M3/M4) e seus arquivos:

| Cadeia | Migrations (timestamp — nome) | Necessária para |
|---|---|---|
| **(base)** | Toda a história anterior (131 TS) | Schema base completo (tenants, profiles, staff, clients, services, appointments, comandas, comanda_items, participants, commission, cash_closings, transactions, RLS, RPCs, etc.) |
| **D8** | `20260820000000_create_commission_records.sql` · `20260826000000_create_outbox_items.sql` · `20260827000000_transactional_outbox_composite_rpc.sql` · `20260827120000_d8_worker_rpc_surface.sql` · `20260827210000_d8_worker_schedule.sql` · `20260828000000_d8_worker_retry_dead_letter.sql` | Comissão + outbox + worker (D8) |
| **M1** | `20260829000000_attended_at.sql` | Colunas `attended_at`/`attended_at_source` (P4/P5) |
| **M2** | `20260829010000_payment_type_enum.sql` | Enum `payment_type` (P7) |
| **M3** | `20260829020000_comanda_payments.sql` | Tabela `comanda_payments` (P7) |
| **M4** | `20260830000000_m4_p1_reverse_comanda_payment.sql` (P1) · `20260830010000_m4_p4_p5_attendance_rpcs.sql` (P4/P5) · `20260830020000_m4_p6_unblock_comanda.sql` (P6) · `20260830030000_m4_p7_register_comanda_payment.sql` (P7) · `20260830040000_m4_p8_tenant_refund_method.sql` (P8) | RPCs e tabelas M4 (P1/P4/P5/P6/P7/P8) |

> **Observação crítica de precisão:** M1/M2/M3 são as migrations de **base de dados** das colunas/enum/tabela que as RPCs M4 P4/P5/P7 consomem. A aplicação em `src/lib/finance/attendance.ts`/`payment.ts` e as RPCs M4 dependem de **todas** elas. Para reproduzir o schema em staging o caminho mais fiel é aplicar **a sequência integral de migrations** em ordem (não apenas as 6 nomeadas), evitando divergência de schema com produção.

**Nada foi executado.**

## 8. Estado de Seeds / Fixtures (Q4/Q7)

- **Seeds:** **não existe `supabase/seed.sql`** nem mecanismo de seed do CLI. O único seed SQL é **`tests/d8/harness/01_seed.sql`** (harness de concorrência D8 — determinístico, IDs fixos, tenants `11111111…`/`22222222…`, **explicitamente NÃO produção**, comentário "NOT 63742efa / production").
- **E2E globalSetup (mecanismo de dados sintéticos existente):** `tests/e2e/setup/globalSetup.ts` provisiona um **tenant E2E determinístico** + 4 usuários confirmados (manager/barber/cashier/invitee) via Admin API + service role, insere profiles/user_tenants/staff/tenant_settings/clients/services, persiste estado em `test-results/.e2e-fixture-state.json`, e faz **teardown** (deleta usuários/tenant/domain rows) ao final. **Esse mecanismo grava no projeto apontado por `.env.local`** — portanto só pode rodar contra um staging.
- **Fixtures:** `tests/e2e/fixtures/auth.fixture.ts` lê `getFixtureState()` e faz login pela UI.
- **Helpers:** `tests/e2e/helpers/supabaseAdmin.ts` (client service-role; exige `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` em `.env.local`) e `supabaseUser.ts`.
- **Flows E2E:** `flows/` (13 specs) executam fluxos críticos reais contra Supabase REAL; **`homologation/`** tem gates:
  - `h6-5-security-probes.spec.ts` — gate `E2E_PROVISIONING=1`, tenant E2E isolado (D-HOM-19), "NUNCA Sanchez Barber / dados reais".
  - `h6-5-sanchez-regression.spec.ts` — gate `E2E_SANCHEZ_REGRESSION=1` + `E2E_SANCHEZ_PASSWORD`; **requer tenant Sanchez Barber REAL** (não usar em staging sem autorização; é um spec específico de regressão do tenant real).
- **Demo mode:** sem `.env.local` e em `localhost`, o app roda em **demo mode** (localStorage) com RPCs M4 **não emuladas** — o demo mode **não serve** para homologar P4/P5/P7 (por isso o FASE 4 anterior concluiu `NÃO EXECUTÁVEL`).

## 9. Variáveis de Ambiente (Q6)

### 9.1 Para a aplicação (frontend) apontar para staging

Lidas por `src/lib/supabase/client.ts` e `vite.config.ts`:

| Variável | Obrigatória? | Papel |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL do Supabase de staging (faz `hasSupabaseEnv=true`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Chave anon de staging |
| `VITE_SUPABASE_MULTI_SCHEMA_ENABLED` | Opcional | Habilita roteamento multi-schema (default: desligado → tudo em `public`) |
| `VITE_APP_HOSTNAME_MAP` | Opcional | Mapa hostname→appSlug (para barber em dev normalmente não é necessária) |
| `VITE_LOCAL_APP_SLUG` | Opcional | Forçar appSlug local |
| `GEMINI_API_KEY` | Opcional (build) | `process.env.GEMINI_API_KEY` injetado pelo vite (`env.GEMINI_API_KEY`); necessário apenas p/ features de IA |
| (`SUPABASE_SERVICE_ROLE_KEY`) | Apenas E2E | Não é lida pelo frontend; é lida por **`tests/e2e/helpers/supabaseAdmin.ts`** e pelo `globalSetup` (Admin API). **Só no `.env.local` de dev, nunca em produção.** |

> **Decisão Q6:** para staging o `.env.local` deve conter **somente as credenciais do NOVO projeto de staging** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, e `SUPABASE_SERVICE_ROLE_KEY` do staging para E2E). **NÃO copiar credenciais de produção** (nem do `.env.local.val-bak` nem do `.vercel-temp.env`).

### 9.2 Worker Dispatcher (D8) — necessário apenas se os testes envolverem D8

`supabase/functions/worker-dispatcher/` lê (Edge Runtime):
- `SUPABASE_PUBLISHABLE_KEYS` — injetado pelo runtime (anon key)
- `APP_URL` — senha custom (URL do Supabase de staging)
- `EDGE_JWT_SECRET` — senha custom (JWT secret) — **bloqueador de plataforma conhecido** (AGENTS.md: não injetado no runtime; aguardando Supabase). Não pode começar com prefixo `SUPABASE_`.

Os testes comuns P4/P5/P7 **não dependem do worker** (são RPCs diretas); o worker só é necessário para testes do pipeline D8/outbox. Para a homologação P4/P5/P7, o worker não é requisito — **recomendado deixá-lo fora do escopo inicial** para reduzir dependência.

## 10. Dependências E2E

- **`globalSetup` (`tests/e2e/setup/globalSetup.ts`)** — exige `.env.local` com `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; **escreve** (provisiona tenant + usuários + seed) no projeto alvo e faz teardown. **Só seguro contra staging.**
- **`supabaseAdmin.ts:51`** — lança "E2E requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local" se ausentes.
- **`auth.fixture.ts`** — dependente de `getFixtureState()` (gerado pelo globalSetup).
- **Gates de homologação** — `E2E_PROVISIONING=1` (isolado; seguro p/ staging) e `E2E_SANCHEZ_REGRESSION=1` (tenant real; **não usar em staging**).
- **Config playwright** — `playwright.config.ts` define `testDir` `tests/e2e`, `globalSetup`, webServer `npm run dev` em `localhost:3000`, `PLAYWRIGHT_BASE_URL`.

## 11. Plano de Dados Sintéticos (Q7 — documentação, não execução)

Para homologar P4/P5/P7 num staging, o seed precisa conter (base = padrão do `globalSetup` estendido):

| Entidade | Campos essenciais para P4/P5/P7 |
|---|---|
| **Tenants** | 2 tenants (`app_slug='barber'`, `status='active'`, `plan`) — para provar **isolamento** |
| **Profiles / user_tenants / staff** | `manager` (role `manager`) e `receptionist` (P7 gate), `barber` (P5); `staff.commission_rate` variado |
| **Clients** | 1+ clientes ativos |
| **Services** | 1+ serviços (`price`, `duration`, `active`) |
| **Appointments (P4/P5)** | Um appointment **`completed` com `attended_at`** (p/ P4 corrigir) · um **`in_progress`** e um **`confirmed`** (p/ P5 concluir) |
| **Comandas (P7)** | Uma **comanda `open`** com itens/serviços → `total`/`net_total` (p/ pagamento parcial) · valor > 0 |
| **Participantes** | `service_execution_participants` (p/ garantir integridade de comissão, já que P7 não deve alterar comissão) |

**Regras do seed:** IDs sintéticos determinísticos (estilo D-HOM/`01_seed.sql`), **nunca** Sanchez Barber, **nunca** IDs de produção; dois tenants para validar isolamento; app_slug `barber`.

## 12. Cenários P4/P5/P7 (Q7 — documentação de como serão executados no staging)

### P4 — Correção retroativa de atendimento
- Pré-requisito: appointment `completed` com `attended_at`.
- Ação: gestão (`manager`/`superadmin`) chama `correct_appointment_attendance` com novo `attended_at` + **motivo obrigatório**.
- Verificar: histórico append-only em `appointment_attendance_corrections` · atualização de `attended_at`/`attended_at_source='management_correction'` · rejeição sem motivo · rejeição de timestamp inválido · **gate de gestão** (recepção/barbeiro negado) · distinção de `attended_at` (não toca pagamento/comissão) · persistência/reexibição sem dupla conversão de timezone.
- **Testar:** permissão (gestão OK; recepção/barbeiro negado) · motivo obrigatório · valor válido · sem efeito em comanda/comissão.

### P5 — Confirmação de atendimento
- Pré-requisito: appointment `confirmed`/`in_progress`.
- Ação: `confirm_appointment_attendance` → `completed` + grava `attended_at`.
- Verificar: `status='completed'` + `attended_at` gravado · **impossível concluir sem registrar presença** (`changeStatus` restrito) · rejeição se já confirmado · **antecipado (pagamento P7) ≠ atendimento realizado** (P5 não cria pagamento; P7 não altera `attended_at`) · erro tratado na UI · ambiguidade de re-agendamento/cancelamento preservada.
- **Testar:** sucesso · dupla confirmação (rejeição) · distinção pagamento×atendimento.

### P7 — Registro de pagamento
- Pré-requisito: comanda `open` (ou `blocked`) com `net_total > 0`.
- Ações: pagamento **parcial** · pagamento **antecipado** (`payment_type='anticipado'`).
- Verificar: resumo (Total/Pago/Saldo = `remaining`/`total_paid` da RPC) · **limite `amount <= net_total`** (rejeição de excedente) · **idempotência** (`p_idempotency_key` estável → sem duplicação em retry; nova operação → nova key) · atualização do resumo pós-pagamento · **permissões** (`canRegisterPayment` = recepção/manager/superadmin; só comanda open/blocked) · **isolamento por tenant** (pagamento de um tenant não aparece em outro) · P7 **não altera** `status`/`attended_at`/comissão.
- **Testar:** parcial · antecipado · excedente (rejeição) · idempotência/retry · atualização de resumo · permissões · isolamento · não-efeito em comissão/atendimento.

## 13. Estratégia de Isolamento (FASE 1.5 — itens 1–7)

| # | Requisito | Estratégia documentada |
|---|---|---|
| 1 | **Frontend aponta para staging** | `.env.local` (dev) com `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` **do projeto de staging**; app só entra em modo não-demo quando `hasSupabaseEnv`; `VITE_APP_HOSTNAME_MAP`/`VITE_LOCAL_APP_SLUG` opcionais |
| 2 | **Nenhuma credencial de produção carregada** | **NÃO ativar** `.env.local.val-bak` nem `.vercel-temp.env` (ambos carregam credenciais de produção). Criar `.env.local` **novo** apenas com credenciais de staging. Não commitar `.env.local`. |
| 3 | **Testes não podem atingir `ushsnmlbeurfvlkieiln`** | Garantir `VITE_SUPABASE_URL` em `.env.local` aponta para o **ref do staging** (não produção). `globalSetup`/`supabaseAdmin` leem exatamente esse `.env.local`; se o ref for de staging, nenhuma escrita toca produção. Opcional, reforço: guardar o ref em variável e validar `!== ushsnmlbeurfvlkieiln` antes de globalSetup |
| 4 | **Staging vs produção claros** | Nomear o projeto como `sou-manager-staging` (ref distinto); marcar `APP_ENV=staging`; documentar ref de produção (`ushsnmlbeurfvlkieiln`) e de staging em `DATABASE_INVENTORY.md`/`.env`; usar domínio/hostname separado se aplicável |
| 5 | **Limpar/resetar dados sintéticos** | Teardown do `globalSetup` (deleta tenant E2E + usuários + domain rows) · `01_seed.sql` do harness D8 usa `ON CONFLICT ... DO NOTHING` + IDs fixos · `supabase db reset --linked` (staging) p/ reconstrução limpa, **somente em staging** |
| 6 | **Impedir mistura de tenants** | RLS + RPCs SECURITY DEFINER com `tenant_id` (FASE 1) · testes de isolamento com 2 tenants sintéticos · verificação de que cada query/RPC filtra `tenant_id` |
| 7 | **Descartar o ambiente depois** | Deletar o projeto de staging (ou rebaixá-lo aocioso) via `supabase projects delete` **somente com autorização do PO**; ou mantê-lo como ambiente permanente de staging homologado |

## 14. Riscos

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| 1 | **Não existe staging hoje** — homologação funcional P4/P5/P7 segue bloqueada | **ALTO (gap de evidência)** | Provisionar staging isolado (próx. fase, com aprovação do PO) |
| 2 | Uso acidental de produção se `.env.local` apontar para `ushsnmlbeurfvlkieiln` | **CRÍTICO** | Validation só de staging; NUNCA copiar credenciais de produção; guard de ref antes de globalSetup |
| 3 | Ativação acidental de `.env.local.val-bak` / `.vercel-temp.env` (credenciais de produção) | **CRÍTICO** | Não ativar; usar `.env.local` novo só-staging |
| 4 | `sanchez-barber` (`rvpmaqoqrorcbxxnqpjo`) confundido com staging | Alto | Documentado: é produto/tenant real; não usado |
| 5 | `supabase-beige-flame` (`krcerrmflfeetlbrwnxd`) confundido com staging | Alto | Documentado: projeto Vercel autônomo, não é staging deste repo |
| 6 | Migrations aplicadas em ordem errada no staging → schema divergente de produção | Médio | Aplicar sequência integral de migrations em ordem (131 TS), validar com `npm run d8:verify` e auditoria de schema |
| 7 | Worker D8 (EDGE_JWT_SECRET) bloqueador de plataforma conhecido | Médio (só p/ D8) | Fora do escopo inicial P4/P5/P7; tratar separadamente |
| 8 | Perda de isolamento se teste usar tenant real | **CRÍTICO** | Gates `E2E_PROVISIONING=1` (isolado); `E2E_SANCHEZ_REGRESSION=1` bloqueado em staging |

## 15. Plano de Provisionamento (para a próxima fase — NÃO executado)

1. **PO aprova** a criação de um projeto Supabase separado de staging.
2. Criar projeto `sou-manager-staging` (ref novo, região a definir) via `supabase projects create` — **somente com aprovação**.
3. Aplicar a **sequência integral de migrations** do repositório (incl. D8→M1→M2→M3→M4) em ordem (`supabase db push` **apontando para staging**, nunca `--linked` sem verificar ref; idealmente `supabase link` explícito para o ref de staging).
4. Configurar env: `.env.local` novo (dev) com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` de staging; aplicar migrations já configuradas.
5. Seeds sintéticos (P4/P5/P7 conforme §11) via globalSetup/harness — somente em staging.
6. Executar smokes reais P4/P5/P7 (§12) + auditoria visual viva.
7. Teardown/limpeza e descarte conforme §13.
8. Reconciliar em `schema_migrations`; `npm run d8:verify` como porta de segurança.

## 16. Critérios de Entrada da Próxima Fase

- [ ] **Aprovação explícita do PO** para provisionar o projeto de staging.
- [ ] Presença de credenciais **de staging** (nunca produção) para `.env.local`.
- [ ] Confirmação do **ref do projeto de staging** (não `ushsnmlbeurfvlkieiln`).
- [ ] Compromisso de **não** ativar `.env.local.val-bak`/`.vercel-temp.env`.
- [ ] Migrations M4/D8/M1/M2/M3 disponíveis no repo (já estão) e aplicáveis em ordem.
- [ ] Validação de que nenhum teste tocará Sanchez Barber nem produção.

## 17. Critérios de Saída

- [ ] Ambiente isolado de staging criado e linkado (ref ≠ produção).
- [ ] Schema de staging reproduzido (migrations em ordem) e validado (`d8:verify`).
- [ ] Seeds sintéticos P4/P5/P7 provisionados em staging.
- [ ] Smokes reais P4/P5/P7 executados com PASS/FAIL legítimos (nunca fabricados).
- [ ] Isolamento de tenant provado; nenhuma escrita em produção.
- [ ] Teardown/limpeza concluídos; credenciais de produção jamais carregadas.

## 18. Decisões que Precisam do PO

| # | Decisão | Impacto |
|---|---|---|
| 1 | **Criar projeto Supabase separado de staging?** (custos, manutenção) | Desbloqueia homologação real; sem isso, P4/P5/P7 continuam `NÃO EXECUTÁVEL` |
| 2 | Nome/região do staging (`sou-manager-staging` sugerido; região a definir) | Identificação clara; custo/latência |
| 3 | Staging **permanente** (homologação contínua) vs **descartável** (usar e deletar) | Orçamento/processo |
| 4 | Incluir D8/worker no escopo de staging ou focar só P4/P5/P7 | Escopo e esforço (worker tem bloqueador de plataforma) |
| 5 | Autorização explícita para `supabase projects create` e migrations/seeds em staging | Escrita — só após aprovação |
| 6 | Configuração do frontend em dev para staging (`.env.local` novo) | Necessária p/ validar UI |

---

## GATE FINAL

```text
STAGING GATE — FASE 1 (READ-ONLY)

Produção:             intocada
Escritas em produção: 0

Staging existente:    NÃO
Staging adequado:     NÃO  (projetos acessíveis = produção, sanchez-barber real, supabase-beige-flame Vercel-autônomo; nenhum é staging deste repo)
Provisionamento:      NÃO EXECUTADO (exigiria escrita; requer aprovação do PO)
Migrations:           NÃO EXECUTADAS
Seeds:                NÃO EXECUTADOS
Código:               NÃO ALTERADO
.env.local:           NÃO ALTERADO (credenciais de produção NÃO ativadas)
Commit:               NÃO
Push:                 NÃO
Deploy:               NÃO

Migrations mapeadas:  sequência integral (131 TS) incl. D8 → M1 → M2 → M3 → M4 (P1/P4/P5/P6/P7/P8)
Env para staging:     VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY · (E2E) SUPABASE_SERVICE_ROLE_KEY · opcionais (MULTI_SCHEMA, HOSTNAME_MAP, GEMINI_API_KEY)
Worker D8:            NÃO necessário p/ P4/P5/P7 (fora do escopo inicial; tem bloqueador EDGE_JWT_SECRET)

Resposta à pergunta central:
  "Temos hoje um ambiente Supabase realmente isolado para homologar P4/P5/P7?"
  → NÃO. Nenhum dos 3 projetos acessíveis é um staging separado deste repositório.
  "Exatamente o que precisamos criar/configurar para ter um?"
  → Criar projeto Supabase separado (ex.: sou-manager-staging), linkar só a ele,
     aplicar todas as migrations em ordem (incl. M4), provisionar seeds sintéticos
     P4/P5/P7 (2 tenants, appointments completed/in_progress/confirmed, comanda open),
     configurar .env.local só-staging, e executar os smokes reais + teardown.
     Tudo isso é de escrita → requer aprovação explícita do PO.

Relatório:
docs/audit/STAGING_FASE1_READONLY_RELATORIO_FINAL.md

STATUS: STOP — AGUARDANDO APROVAÇÃO DO PO
```
