# DEC-001 — Diagnóstico da Frente H7 (Ativação PROD Site↔SMG)

> **Front ID oficial:** `DEC-001-A` — "Gate de Ativação PROD Site↔SMG" (decisão PO 2026-09-28, Alternativa A, §9; nome de arquivo legado `DEC001_H7_*` preservado).
> **Ciclo autorizado pelo PO (2026-09-28):** diagnóstico → evidências (A0) → classificação → commit documental → STOP/GO-NO-GO A1–A5.
> **Fase deste documento:** AUDIT (diagnóstico). Read-only. Nenhum deploy, migration ou alteração de código/configuração; commit documental restrito aos docs necessários.
> **Data:** 2026-09-28 · **Executor:** OpenCode (Tech Lead operacional) · **STATUS final:** ver §11 (ciclo NO-GO + execução G8/G9+A1 registrada §11; irmão §4.11 + §4.12).
> **Atualização (evidências + A0 + execução G8/G9 + A1):** G1/G2/G3/G4/G5/G7 fechados; correções em §4.4/§7/§8/§9/§11; A0 executado (irmão §4.6–§4.8); **execução G8+G9 registrada** §11 (irmão §4.11); **A1 — Deploy ET — registrado** §11 (irmão §4.12).
> Documento-irmão: `DEC001_H7_EVIDENCIAS_ATIVACAO_20260928.md` (evidências + A0 + checklist A1–A5; status vigente = STOP/GATE aguardando GO/NO-GO).

---

## 1. Diagnóstico (visão geral)

A frente H7 é o **gate de ativação em produção** da integração Site↔SMG (DEC-001), aberta pelo PO
após o fechamento da Fase 1 (PRs #95/#1/#97, `main = 1d79c4a0`). O gate nunca foi executado.

**Estado atual da ativação: ZERO de 4 blocos executados.**

| Bloco | Estado | Evidência (2026-09-28) |
|---|---|---|
| B1 — Deploy ET `site-sanchez-appointments` em PROD | 🔴 Não executado | Live **HTTP 404 `NOT_FOUND`** (§4.2) |
| B2 — Migration `20260426000000` aplicada em PROD | 🔴 Não executado | Live: RPC ausente no OpenAPI (§4.3) |
| B3 — Distribuição 22 serviços + realinhamento `SMG_SERVICE_ID_MAP` | 🔴 Não executado | PROD tem **18** services; map local = **22** entradas (§4.4, corrigido na fase de evidências) |
| B4 — JWT `--no-verify-jwt` + env vars da ET | 🔴 Não executado | `verify_jwt=false` só em config local; env secrets da ET inexistentes (função não existe) |

Projeto Supabase alvo da integração = **`ushsnmlbeurfvlkieiln`** (`SMG_API_BASE_URL` em `.env.local`).
Atenção: `.env.local` também contém `VITE_SUPABASE_URL=https://tjcvuhynckocmvtqykxp.supabase.co` —
**projeto diferente**, usado pelo frontend. Todo probe de H7 deve usar `ush...` (§4.1).

## 2. Classificação

`INTAKE → AUDIT` (P.02 startup rule, `.opencode/AGENTS.md`). Front novo, discovery-driven.
Nenhuma mudança em código/produto neste estágio.

## 3. Risco

**Alto (por natureza do gate):** ativação em produção envolve migration de banco, Edge Function com
`service_role`, dados financeiros de tenant real e integração externa (Site do PO).
**Risco do diagnóstico:** baixo — somente leitura (invariante: *"Never alter production during investigation"*).

## 4. Evidências (E = fato observado · I = interpretação · G = gap)

### 4.1 Identidade dos projetos
- **E:** `.env.local`: `SUPABASE_URL=https://ushsnmlbeurfvlkieiln.supabase.co`;
  `SMG_API_BASE_URL=https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1`;
  `VITE_SUPABASE_URL=https://tjcvuhynckocmvtqykxp.supabase.co`.
- **I:** PROD da integração = `ush...` (é o que o Site chama). `tjcvuhy...` é outro projeto (frontend).
  Evidência histórica H7 (relatório 2026-09-20) usou `ush...` — consistente.
- **G:** nenhum — identidade resolvida.

### 4.2 Edge Function não deployada (reprodução ao vivo do FATO G2)
- **E:** `POST /functions/v1/site-sanchez-appointments` → **HTTP 404**
  `{"code":"NOT_FOUND","message":"Requested function was not found"}`.
  Controle negativo (`nao-existe-xyz-123`) → 404 idêntico.
  Controle positivo (`worker-dispatcher`, sabidamente deployada) → **HTTP 503** com envelope da função.
- **I:** **FATO confirmado ao vivo:** ET não existe em PROD. Discriminador validado por controles.
  Confirma `SITE-SANCHEZ-CONTRACT.md:293` (G2) e `docs/audit/H7_B_TRILHO_B_P1_P4_READONLY_RELATORIO.md:179`.
- **G:** o relatório citado pelo contrato está **untracked no git** (§8, gap G5).

### 4.3 Migration `20260426000000` não aplicada (nova prova direta)
- **E:** OpenAPI do PostgREST de `ush...` (HTTP 200 via `service_role`): **118 RPCs expostas**;
  `/rpc/create_site_sanchez_appointment` **ausente**. Migration fonte: `supabase/migrations/20260426000000_site_sanchez_appointments.sql`
  (338 linhas; cria apenas a RPC `public.create_site_sanchez_appointment`; SECURITY INVOKER; GRANT/REVOKE nas linhas 367–370).
- **I:** **FATO:** a migration não foi aplicada em PROD (a RPC não existe no schema público → não aparece no PostgREST).
  Antes esta era apenas **asserção** propagada (`ROADMAP.md` 8.83, `PROJECT_STATUS.md` 7.44); agora é evidência direta.
- **G:** ledger `supabase_migrations.schema_migrations` não pôde ser lido (Management API `api.supabase.com`
  inacessível do ambiente — hang; §7). A prova via OpenAPI é equivalente e suficiente.

### 4.4 Estado do tenant e maps
- **E (live, `service_role`, `count=exact`):** tenant `b716e290-f7f6-4449-b790-5ae9dcdadcab` →
  **services = 18 · staff = 7 · appointments = 2040** — idêntico à evidência G4 de 2026-09-27
  (`SITE-SANCHEZ-CONTRACT.md:295`). `.env.local`: `SMG_SERVICE_ID_MAP` = **22 entradas**
  (chaves underscore-slug → UUID SMG); `SMG_PROFESSIONAL_ID_MAP` = **3 entradas**
  (`any`, `rubens_sanchez`, `heron_ferreira`). *(Correção 2026-09-28 fase de evidências: a leitura
  inicial "1 entrada" era artefato do `ConvertFrom-Json` aplicado a string JSON duplamente codificada.)*
- **I:** sem drift desde 2026-09-27. **Fonte dos "22 serviços" identificada (G1 fechado):** as 22 chaves
  do `SMG_SERVICE_ID_MAP` local — este é o catálogo de referência do contrato. Para ativação faltam
  4 services (18→22) + realinhamento do map. Os maps do `.env.local` são de desenvolvimento —
  o map efetivo da ET vive nos secrets da ET (a criar no deploy).
- **G:** valores reais do `SMG_SERVICE_ID_MAP` de produção (Vercel, legado) **não verificados**
  (`H7_B_TRILHO_B_INVESTIGACAO_ADICIONAL_RELATORIO.md:172` declara item #22 "particularmente incerto").
  **Mismatch de convenção observado:** Site grava `appointments.service` = **label pt-BR**
  (ex.: `"Corte Sanchez"`, `SchedulingFlow.tsx:97` × catálogo `scheduling/data.ts:3-63`; não confundir
  com `BOOKING_SERVICES` do `appointmentConfig.ts`, fluxo WhatsApp que não grava `appointments`) e
  `service_id` = slug hífen; `sync.js`
  `buildCanonicalSmgPayload` faz lookup `serviceIdMap[row.service]` **sem normalização** →
  com o map local (chaves underscore) o lookup falharia → `throw "Unmapped service slug"`.
  Convenção do map PROD (Vercel) é a peça que decide — permanece G2.
  *(A0 2026-09-28, irmão §4.6–§4.7: pull PROD com os 5 `SMG_*` vazios × probe vivo cujo gate `:469`
  passou → sem convenção legada legível; runtime exige **label-keyed** → A3/A4 criam o map de 11 chaves. **G2 encerrado.**)*

### 4.5 JWT / env vars
- **E:** `supabase/functions/site-sanchez-appointments/config.toml` → `verify_jwt = false` (local).
  Contrato §10 exige 6 env vars da ET (`SANCHEZ_TENANT_ID`, `SANCHEZ_WEBHOOK_SECRET`, `SANCHEZ_DOMAIN_SCHEMA`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SANCHEZ_ALLOWED_ORIGIN`).
  `.env.local` contém `SMG_WEBHOOK_SECRET` e `SMG_API_TOKEN` (lado Site/SMG).
- **I:** `--no-verify-jwt` obrigatório no deploy (ROADMAP 8.83: `supabase/config.toml` raiz ausente no repo —
  config.toml só existe por função). Secrets da ET não existem (função não existe) → criar no momento do deploy.
- **G:** mapeamento exato de quem valida o Bearer (ET vs Site) deve constar do plano de ativação (fase de evidências).

### 4.6 Hostname/app-resolution
- **E:** `VITE_APP_HOSTNAME_MAP` **ausente** em `.env.local`; nenhuma entrada de H7 em ROADMAP/PROJECT_STATUS/contrato
  menciona hostname map.
- **I:** o PO mencionou "realinhamento do map" no contexto dos maps de serviço — hostname map **não faz parte
  dos requisitos documentados** da frente.
- **G:** G3 do §8 — confirmar com o PO se está fora de escopo ou é item esquecido.

## 5. Causa raiz do estado atual

A Fase 1 do DEC-001 entregou implementação + testes + contrato com **gate explícito não executado**
(`SITE-SANCHEZ-CONTRACT.md:311`: *"NÃO commit, NÃO push, NÃO deploy, NÃO migration (fase posterior, gated)"*).
A ativação nunca foi agendada/autorizada — **não há bug; há um gate intocado**.

## 6. Impacto

- Enquanto H7 não executar: integração Site↔SMG **inerte em produção** (Site não cria agendamentos no SMG).
- Nenhum impacto em produção existente (nenhuma alteração foi feita).
- Fronteira de risco: migration + ET com `service_role` + tenant real → exige o ciclo completo do
  `smg-change-control` até `DEPLOY AUTHORIZATION`.

## 7. Limitações de instrumentação (declaradas)

1. **Management API (`api.supabase.com`)** inacessível do ambiente (hang >90s) → ledger de migrations não lido;
   substituído por prova equivalente via OpenAPI (§4.3).
2. **`Invoke-WebRequest`/comandos `bash` complexos** travam intermitentemente → sondas reexecutadas uma a uma
   com `curl.exe --max-time`; nenhum resultado parcial foi aceito sem controles.
3. *(Superado na fase de evidências)* — estrutura dos maps obtida: JSON único codificado com aspas simples,
   chaves underscore-slug, valores UUID (§4.4).

## 8. Gaps (para fase de evidências / decisão PO)

| ID | Gap | Ação |
|---|---|---|
| G1 | ~~Catálogo dos **22 serviços** do Site não localizado no clone~~ | ✅ **FECHADO (fase de evidências):** fonte dos 22 = as 22 chaves do `SMG_SERVICE_ID_MAP` local (§4.4). Diff 18→22 (PROD vs map) executado no checklist de ativação |
| G2 | ~~Valores/convenção do `SMG_SERVICE_ID_MAP` PROD (Vercel legado) não verificados~~ | ✅ **FECHADO (A0, 2026-09-28):** pull PROD com os 5 `SMG_*` vazios × probe vivo com gate `:469` passou → sem convenção legada legível; runtime exige **label-keyed** (11 chaves) → A3/A4 criam o map (irmão §4.6–§4.7) |
| G3 | Hostname map: fora de escopo? (sem base documental em H7) | ✅ **DECIDIDO (PO #2):** fora de escopo de DEC-001-A — evidência: `VITE_APP_HOSTNAME_MAP` ausente, Site chama `SMG_API_BASE_URL` direto (§4.6); registrado como achado arquitetural (irmão §12) |
| G4 | Colisão de nomenclatura "H7" — 4 clusters no repo (§9) | ✅ **DECIDIDO (PO #1):** Alternativa A — frente renomeada **`DEC-001-A`**; `H-1..H-8` congelados só para homologação |
| G5 | ~~8 docs `H7_B_*` **untracked** contêm a evidência citada pelo contrato~~ | ✅ **CLASSIFICADO (PO #3, irmão §4.8):** `P1_P4` + `INVESTIGACAO_ADICIONAL` = NECESSÁRIO (commit, ambos citados por docs versionados); demais 6 `H7_B_*` + `H7_1_*` + `ARCHAEOLOGY_20260927/` = auxiliares, permanecem `untracked` |
| G6 | `docs/BUSINESS_DECISIONS.md` sem registro `DEC-001` | Incluir no pacote documental da autorização |
| G7 | ~~Estrutura dos maps (limitação §7.3)~~ | ✅ **FECHADO (fase de evidências):** JSON com aspas simples, chaves underscore-slug → UUID (§4.4) |

## 9. Nomenclatura — colisão "H7" (exige decisão; regra do próprio PO)

Mapeamento documental (2026-09-28) encontrou **4 significados distintos** de "H7"/"H-7" no repo:

| Cluster | Período | Assunto | Status |
|---|---|---|---|
| **A — este front** | 2026-09-27/28 | Ativação PROD DEC-001 (ET + migration + 22 serviços + JWT) | 🆕 aberto pelo PO |
| B — homologação "H-7 Operação real" | 2026-08-08 → | Ciclo real acompanhado, quadratura Q1–Q7, gate 6.0.6 | 🟡 **RETOMADA ABERTA (nunca fechado)** |
| C — "H-7-1" migration V2 `bulk_close_comandas_with_credits` | 2026-09-19/20 | Homologação de migration em staging | 🟢 certificado (docs untracked) |
| D — "H-7 Trilho B" segurança/chaves API | 2026-09-20 | Exposição de credenciais, rotação de keys | ⏸ (docs untracked) |

Regra aplicável: **"um identificador de decisão nunca deve ter dois significados" (PO, D-HOM-30,
`ROADMAP.md:1976`).**

**Alternativas:**
- **A (recomendada):** renomear este front para **`DEC-001-A` — "Gate de Ativação PROD Site↔SMG"**
  (subitens A.1 deploy ET, A.2 migration, A.3 serviços+map, A.4 JWT/env). Congela `H-1..H-8` só para homologação.
- **B:** manter "H7" apenas com prefixo obrigatório `DEC-001/H7` em todo registro.
- **C:** `H7-ACT` — rejeitada: diferença de 1 caractere do cluster B gera erro humano.

**Decisão do PO (2026-09-28): Alternativa A adotada — frente `DEC-001-A` (Gate de Ativação PROD Site↔SMG).**
*(Decisões #1 e #2: nomenclatura fechada em A; hostname map fora de escopo — G3/G4 encerrados.)*

## 10. Recomendação

1. Seguir para a **fase de evidências** (já autorizada no ciclo do PO): checklist executável de ativação,
   fecho de G1/G2/G7, plano de passos com verificações.
2. Apresentar **STOP/GATE** ao PO com: nomenclatura (G4), hostname map (G3), destinos de G5/G6,
   e o plano de ativação para autorização específica (deploy ET → migration → maps → smoke).
3. **Nenhuma ação de produção** antes da autorização explícita correspondente.

## 11. Decision required / STATUS

**Decisões recebidas do PO (2026-09-28/29):**
1. **Nomenclatura (G4)** → Alternativa A: **`DEC-001-A`** (§9); `H-1..H-8` congelados só para homologação.
2. **Hostname map (G3)** → **fora de escopo** de DEC-001-A; achado arquitetural documentado (irmão §12).
3. **Refs `H7_B_*` (G5)** → classificar **antes** do commit (irmão §4.8): 4 NECESSÁRIO → commit; demais `untracked`.
4. **A0 read-only obrigatório** antes de tocar em map/site → **executado** (irmão §4.6–§4.7); correção de normalização (recomendação 9.1.C do irmão) = STOP separado.
5. **Commit+push somente dos docs necessários**, com antes/depois (`git status`/`git diff --stat`/`git diff --check`) → executado neste ciclo.
6. **A1–A5 não autorizados** — fluxo A0 → G2 confirmado → STOP → decisão do PO.
7. **NO-GO total A1–A5** (2026-09-28): sem ativação PROD neste momento; sem migration, sem banco, sem regra de negócio, sem deploy adicional sem autorização. Agente autorizado **somente** a diagnóstico/revalidação dos gates **G8** e **G9** (read-only), com **evidências separadas** (irmão §4.9/§4.10), seguido de novo STOP.
8. **Correção G8+G9 autorizada + executada + verificada** (PO, 2026-09-28): valores `SMG_*` conforme guia recomendado (#2); front→`ush…` (#3); escrita nos envs Vercel (PROD+PREVIEW) + redeploy (`sanchez-barber-8o7sye15j`) + verificação (probe 400, bundle `rvpmaq=0`/`ush=1`) — execução registrada (irmão §4.11). A1–A5 **mantêm NO-GO**.
9. **A1 — Deploy ET autorizado + executado + verificado** (PO, 2026-09-28): `supabase functions deploy site-sanchez-appointments --no-verify-jwt --project-ref ushsnmlbeurfvlkieiln` → `Deployed Functions`; 6 secrets configuradas (4 via `supabase secrets set`, 1 via Management API por bug `//` do CLI v2.95.6, 2 herdadas pré-existentes confirmadas pelo ET responder sem 500). GET → 405 `Method not allowed` (não 404); POST → 401 `Unauthorized` (config carregada, auth ativo). **RPC `create_site_sanchez_appointment` ainda ausente** → POST autenticado falha com `function … does not exist` (A2 NO-GO). Execução registrada (irmão §4.12). A2–A5 **mantêm NO-GO**.
10. **A2 bloqueado por drift → A2-DIAG autorizado** (PO, 2026-09-28): a tentativa de aplicar `20260426000000` falhou com **42809** (`barber.appointments` = VIEW, não TABLE — premissa da migration incompatível com PROD) → **NO-GO** na aplicação como estava; proibido converter/remover a VIEW, aplicar parcialmente, marcar a migration como aplicada ou inserir RPC manualmente. Autorizada **somente** investigação read-only (12 perguntas) para determinar a correção canônica (A/B/C); A3–A5 permanecem 🔒.
11. **A2-DIAG → Opção B autorizada (criação + validação)** (PO, 2026-09-28): PO escolheu **B** — `20260426000000` permanece histórica **intocada**; correção em **nova migration** `20260426000001_site_sanchez_appointments_correction.sql` com escopo **somente `public`**. Autorizada a criação + validação local + diff, **sem** aplicação em PROD; guardrail: tocar `barber.appointments`, alterar RLS, modificar a migration original ou aplicar direto → STOP imediato. Criação + diff executados (irmão §4.13) → **PASS**.
12. **A2-Prod — GO para aplicação** (PO, 2026-09-28): aplicação **exclusiva** da `20260426000001` em `ushsnmlbeurfvlkieiln` + validação obrigatória (migration aplicada · `external_source` · constraints · índices · RPC · `barber.appointments` intocada · registro irmão §4.14). Drift não diagnosticado → STOP imediato. Aplicação **não** autoriza A3 automaticamente — **STOP/GATE para fechamento do A2**. Executado + validado, todos os checks PASS (irmão §4.14). A3–A5 **mantêm 🔒**.
13. **A2-W1-DIAG — somente diagnóstico read-only do ledger** (PO, 2026-09-29): A2-Prod reconhecido como **PASS técnico**, mas A2 **não** certificado como encerrado; **GAP A2-W1 = ABERTO / STOP CONTROLADO**. Autorizado **apenas** A2-W1-DIAG read-only com 6 itens mínimos (ledger completo/ordenado · dependências de `20260426000000` · duplicados/anomalias · registro posterior de `20260426000001` sem violar o mecanismo · forma oficial de reconciliar vs DML manual · comparação REPO × LEDGER × ESTADO EFETIVO). **Proibido:** DML no ledger, commit, A3, A4, A5; `20260905000000_…` fora de escopo. Ao concluir → **STOP/GATE para decisão do PO sobre reconciliação**. Executado (irmão §4.15, 6/6 PASS, nenhuma escrita).
14. **A2-W1-RECON — GO para reconciliação cirúrgica via `migration repair`** (PO, 2026-09-29): autorizado **apenas** `migration repair 20260426000001 --status applied --linked` (aplicada e validada em A2-Prod) e `migration repair 20260915175459 --status reverted --linked` (órfã = mecanismo documentado; sem exclusão física, sem DML). **Não autorizado:** `20260919054555` (não marcar applied) · `20260924000000` (não marcar applied — "PREPARAÇÃO apenas — NÃO aplicar em PROD") · DML manual · `db push` · re-execução de SQL. Regra de execução (7 itens): verificar ledger · confirmar `20260426000001` applied · confirmar `20260915175459` reverted · confirmar nenhum SQL re-executado · confirmar `20260919054555`/`20260924000000` sem alteração · `git diff --check` · STOP/GATE; comando exigir ação extra → STOP imediato. Executado (irmão §4.16, **7/7 PASS**) → PO poderá formalizar `A2-Prod PASS · A2-W1-DIAG PASS · A2-W1-RECON PASS · A2 CLOSED` e então decidir o commit documental. **A3 bloqueada até fechamento formal do A2.**
15. **A2 CLOSED + commit documental + A3 GO** (PO, 2026-09-29): certificação formal — **A2 ENCERRADO** (G8/G9 · A1 · A2-DIAG · A2-B · A2-Prod · A2-W1-DIAG 6/6 · A2-W1-RECON 7/7 todos PASS); divergência residual `20260919054555`/`20260924000000` registrada e deliberadamente não reconciliada. **GO commit exclusivamente documental** dos 2 DEC001; proibido incluir `AGENTS.md`, `docs/adr/README.md`, `20260905000000_…` ou qualquer outro arquivo; não autorizado: código, migration, banco, push, PR, merge, deploy. Pós-commit → STOP/GATE (`git status` · `git diff --cached` · `git show --stat HEAD` · `git diff HEAD^ HEAD -- docs/audit/DEC001_*`). **GO granular A3** (18→22 + maps → STOP) após o gate documental; A3 não autoriza A4/A5 — **A4 🔒 · A5 🔒**.

16. **Mudança de plano: A3-DIAG-2 (identidade do tenant) antes de qualquer escrita do A3** (PO, 2026-09-29): após o STOP intermediário do A3 (irmão §4.17), o PO determinou **pausar** a criação de `Sobrancelha` e a montagem dos maps e inserir diagnóstico read-only de identidade do tenant **Portal ↔ SMG**: (1) inventariar onde o tenant é exibido/referenciado nos dois lados; (2) definir **nome canônico + slug** ("Sanchez" = identidade legível; `tenant_id` UUID = identidade do sistema); (3) garantir que Portal e SMG falem do **mesmo `tenant_id`**; (4) mapear impacto nos maps e na RPC. **Regra exigida pelo PO (requisito de integração):** *"Nenhuma integração deve usar 'Sanchez' como chave técnica quando já existe `tenant_id`."* Sequência nova: **A3 atual ❌(criar Sobrancelha/maps) → A3-DIAG-2 (read-only, zero escrita) → STOP → A3-IMPLEMENT**. Nenhuma escrita autorizada neste intervalo. A4/A5 **mantêm 🔒**.

17. **A3-IMPLEMENT — GO com Q1–Q6 decididos (decisão #17)** (PO, 2026-09-29): **Q1-C** 🟢 criar `Sobrancelha` no tenant (R$15 · 15min · category `Acabamento` · 18→19 · não-global · não `CORTE + SOMBRANCELHA`) · **Q2** 🟢 `Primeiro disponível` → Rubens `0b0d5fd1-818e-418d-a40d-378d772a787b` · **Q3-B** 🟢 somente 18→19 (22 não é requisito) · **Q4** 🟢 nome humano canônico `Sanchez` (coluna `name`; `tenant_id` UUID = identidade técnica) · **Q5** 🟢 padronizar apresentações, **NÃO** renomear registros de negócio (serviços/profissionais) · **Q6** 🟢 copy `phone.ts` → `Sanchez`, sem reescrever lógica telefônica. Sequência exigida: 1) identidade · 2) criar `Sobrancelha` · 3) montar os 2 maps de 11 chaves · 4) validar UUIDs vs `tenant_id` · 5) serviços ativos · 6) Rubens · 7) RPC/intake → **STOP/GATE A3**. **Limites explícitos:** "Nenhuma autorização de A3 implica autorização para A4/A5." **A4 🔒 · A5 🔒 · Push 🔒 · PR 🔒 · Merge 🔒 · Deploy 🔒.** Execução: irmão §4.20 (A3-1..A3-7 executados · validação 7/7 · gates PASS).

18. **Gate A3 — resposta do PO (2026-09-29):** A3-1..A3-7 **🟢 PASS técnico** · typecheck TS8016 = 🟡 **known issue pré-existente** (script `untracked` — **não corrigir, não excluir**; registrar apenas como known issue com evidência) · **🛑 STOP Q1-R**: confirmar o `name` efetivo do UUID `a2f28824…` (relatório exibia `Acabamento` em parêntese) antes de qualquer commit · **Commit A3 🔒 · Push/PR/Merge/Deploy 🔒 · A4/A5 🔒.** Confirmação executada read-only (irmão §4.21): `name="Sobrancelha"` · `category="Acabamento"` · `price=15.00` · `duration=15` · `active=true` · `tenant=b716e290…` → **caso #1, divergência inexistente** → aguardando **GO de commit** do PO.

19. **GO DE COMMIT A3 — autorizado + executado (PO, 2026-09-30):** Q1-R confirmado (caso #1) → autorizado somente o commit da frente A3 (6 arquivos exatos; excluídos `AGENTS.md`, `docs/adr/README.md`, `20260905000000_*.sql`, untracked). Condições cumpridas: `diff --check` 0 · staging exato · sem TS8016 · sem mapas/banco/A4/Vercel · **sem push/PR/merge/deploy**. Commit **`f4a1c51`** (6 files, 241+/18-). STOP após o commit; próximo gate = revisão do commit A3. A4/A5 🔒.

20. **A4 — GO com escopo estreitado + caminho de escrita bloqueado (PO, 2026-09-30):** A3 formalmente encerrada no `f4a1c51`. **GO:** `SMG_SERVICE_ID_MAP` (8) + `SMG_PROFESSIONAL_ID_MAP` (3), artefatos irmão §4.20, sem alteração; PROD+PREVIEW; preservar demais vars; redeploy só se necessário; validar consumo. **NÃO GO:** criar/inventar `SMG_API_TOKEN` (permanece vazio) · código/banco/mapas · A5 · push/PR/merge · deploy além do necessário. **Redeploy ≠ automático** — se exigido, volta como **subgate A4**. **BLOQUEIO:** Vercel CLI/auth/rede indisponíveis deste ambiente → escritas inexequíveis aqui; caminho devolvido ao PO sem resposta — **STOP interim**.

21. **A4 ✅ CERTIFICADO + A5 BLOQUEADO (PO, 2026-09-30):** A4 fechado — redeploy `dpl_3qHo…` READY pós-vars (23:36:42Z) + revalidação A4-1..A4-6 aceitos; não mexer mais em A4. A5 segue BLOQUEADO — exige gate próprio + autorização explícita (inclui prova runtime dos 11 maps). Próximo trabalho, quando autorizado: exclusivamente preflight/gate do A5.

22. **GO G1 + EXECUÇÃO (PO, 2026-09-30):** corretiva RPC $13/$14 (só nova migration `20260930000000…`, sem G2/commit/PROD). AUDIT confirmou binding + achou D2 (parêntese overlap — empírico). Irmão §4.25: migration criada (DIFF +1/0); harness local: apply OK, positive BLOQUEADO por D2, negatives PASS. STOP com pedido de GO p/ fix-D2 + revalidação. G2/G3/G4 não executados; PROD intocado.

23. **GO D2 + REVALIDAÇÃO (PO, 2026-09-30):** parêntese movido p/ posição correta na migration G1. Irmão §4.26: harness recriado — apply OK · positive PASS · cancel/negatives/overlap PASS · re-run = unique violation (idempotência intacta). Teardown OK. STOP; G2 não executado; PROD intocado.

24. **GO G2 + EXECUÇÃO (PO, 2026-09-30):** smoke em harness local (UUIDs reais, sem PROD). Irmão §4.27: 9 creates + 9 cancels PASS · negatives/overlap PASS · rerun = unique (idempotência intacta). Teardown OK. STOP; PROD intocado.

25. **GO COMMIT + EXECUÇÃO (PO, 2026-09-30):** commit só da migration `20260930000000…`. Irmão §4.26: pré-checks OK (main/f4a1c51, staging vazio, diff-check 0, D1/D2 re-verificados). Staged exato (1 arquivo). Commit **`d86ca0f`** (subject com `$13/$14` renderizado como `/` — só cosmético). Sem push/PR/merge/deploy. STOP.

26. **GO COMMIT DOCS + EXECUÇÃO (PO, 2026-09-30):** commit só dos 2 DEC001. Irmão §4.27: pré-checks OK (main/d86ca0f, staging vazio, diff-check 0). Staged exato (2 arquivos). Commit **`3563e13`**. Sem push/PR/merge/deploy. STOP.

27. **RE-AUDITORIA (PO, 2026-09-30):** re-verificar sem promover. Irmãos §4.24–§4.27: HEAD/hash/chain íntegros; Registro completado c/ §4.26-irmão. Sem divergências. STOP.

28. **CERTIFICAR-A5 review (PO, 2026-09-30):** revisar e propor veredito, sem promover. Irmão §4.28: nada novo; proposta **A5 PASS técnico — CERTIFICÁVEL**. Certificação formal c/ PO. STOP.

29. **A5 ✅ CERTIFICADO técnico/harness (PO, 2026-09-30):** validação aceita; promoção e PROD bloqueados (gates próprios); idempotência fora do escopo. STOP.

30. **GATE ADR-029 ÍNDICE (PO, 2026-10-01):** entrada adicionada sem tocar concorrentes; diff-check 0. Commit negado; próximo = ownership + review gate. STOP.

31. **GATE ADR-029 REVISÃO FINAL (PO, 2026-10-01):** STOP mantido, commit negado (nem combinado, nem `git add .`); ownership indeterminável; ADR-028 ausente intocado. Próximo: ownership → resolver → review → escopo → PO autoriza. STOP.

**Pendente (este STOP):** ~~validação do ledger + formalização A2 CLOSED~~ ✅ **resolvido (PO #15): A2 = CLOSED** · ~~commit documental~~ ✅ **autorizado + executado (PO #15, somente os 2 DEC001; push não autorizado)** · **A3 → plano alterado (PO #16): A3-DIAG-2 read-only EXECUTADO (irmãos §4.17 + §4.18, zero escritas) + forense read-only do consumidor dos maps (irmão §4.19, zero escritas)** — mesmo `tenant_id` UUID nos dois lados ✓ · name DB = "Barbearia Principal" ≠ "Sanchez" (slug já `sanchez`) · identificadores legados com "Sanchez" (RPC/enum/ET/envs) classificados — **A3-IMPLEMENT executada (PO #17: Q1–Q6 decididos; A3-1..A3-5 PASS, validação 7/7, irmão §4.20)** · A3-7 executado (build 0 · unit 76/76 · diff-check 0 · typecheck = known issue) · **gate respondido (PO #18): técnica PASS · Q1-R confirmado (irmão §4.21)** · **commit `f4a1c51` ✅ (PO #19)** · **A3 ✅ CLOSED (PO #20)** · **A4 ✅ CERTIFICADO (#21)** · **A5 ✅ CERTIFICADO técnico/harness (PO #29, §4.28)**. G6 (`BUSINESS_DECISIONS.md`) registra a autorização.

**STATUS: A3 ✅ CLOSED · A4 ✅ CERTIFICADO (PO #21) · A5 ✅ CERTIFICADO técnico/harness (PO #29, 2026-09-30; §4.28): G1/G2/G3 + re-auditoria PASS · idempotência divergente por decisão (fora do escopo A5) · promoção/PROD/push/PR/merge/deploy 🔒 (gates próprios).** Commit validado pelo PO (gate #15); plano alterado pelo PO (#16 → A3-DIAG-2 antes de qualquer escrita); DIAG-2 executado e documentado (irmãos §4.17 + §4.18): diff 18→22 · RPC intake validada (Sobrancelha (a) RULED OUT) · identidade do tenant inventariada (mesmo UUID `b716e290` nos dois lados ✓ · name DB = "Barbearia Principal" ≠ "Sanchez", slug já `sanchez` · identificadores legados "Sanchez" em RPC/enum/ET/envs classificados como backlog) · **forense §4.19 (2026-09-29): Production = `e7e50e9` (PR #1, 2× success) · consumidor único dos maps = `api/smg/sync.js` server-side (`serviceIdMap[row.service]` `:157`, label-keyed, sem normalização) · alvo = ET A1 `site-sanchez-appointments` com `Bearer SMG_WEBHOOK_SECRET` · Site usa o MESMO Supabase do SMG (`SUPABASE_URL=ush…` no Vercel PROD) · bundle `index-DEGutXL9.js` = build `e7e50e9` · citações §4.7c confirmadas contra o código deployado · clone local desatualizado (370 linhas, sem maps; `api/public/sanchez` não-deployado) · maps PROD vazios (`""`) → A4 segue necessário** · **A3-IMPLEMENT executada (PO #17: Q1–Q6 decididos)** (irmão §4.20): identidade `tenants.name`→`Sanchez` + 4 copy edits (Q4/Q5/Q6) · `Sobrancelha` `a2f28824…` 18→19 (Q1-C) · 2 maps 11 chaves montados como evidência, **não setados no Vercel** · validação **7/7 PASS** (`failures=0`, RPC intake + grant ✓) · pendente **A3-7** + **STOP/GATE A3** · A4/A5 🔒. Estado oficial: `A1 ✅ · A2 ✅ · A3 ✅ CLOSED f4a1c51 · A4 ✅ CERTIFICADO #21 · A5 ✅ CERTIFICADO técnico/harness #29 · Push/PR/Merge/Deploy 🔒`. Encerramento: G8/G9 (PO #8) · A1 (PO #9) · A2-Prod (PO #12) · A2-W1-DIAG 6/6 (PO #13, §4.15) · A2-W1-RECON 7/7 (PO #14, §4.16) — repairs `20260426000001 → applied` + `20260915175459 → reverted`, ledger 155, efetivo byte-idêntico · fechamento formal A2 + commit documental só dos 2 DEC001 (`3f6fc0d`, sem push/PR/merge/deploy). GAPS: **A2-W1** 🟢 · A1-W1 (CLI `//` bug) · G6 · Diff 18→22 🟢 (§4.17) · identidade 🟢 (§4.18). Integração Site↔SMG ainda inerte (A3-IMPLEMENT → A4 → A5, cada um com gate próprio).
Registro de evidência: `EVIDENCE §4 (G8/G9 §4.9/§4.10) · EXECUÇÃO §4.11 (G8/G9) + §4.12 (A1) + §4.13 (A2-DIAG/A2-B) + §4.14 (A2-Prod) + §4.15 (A2-W1-DIAG) + §4.16 (A2-W1-RECON) + §4.17 (A3 diff read-only / STOP intermediário) + §4.18 (A3-DIAG-2 identidade do tenant) + §4.19 (forense consumidor dos maps / endpoint alvo / mesmo Supabase) + §4.20-irmão (A3-IMPLEMENT) + §4.21-irmão (confirmação Q1-R) + §4.22-irmão (A4-VALIDATE parcial) + §4.23-irmão (evidência Vercel: redeploy NECESSÁRIO) + §4.24-irmão (preflight A5) + §4.25-irmão (G1 corretiva RPC) + §4.26-irmão (D2-FIX + revalidação) + §4.27-irmão (G2 smoke) + §4.28-irmão (certificação A5) · INTERPRETATION §1/§4/§5 · GAP §8 · DECISION §11 (#1–#31; #31 = REVISÃO FINAL/STOP sem commit) · STATUS A4 ✅ CERTIFICADO · A5 ✅ CERTIFICADO técnico/harness (PROD intocado)`.
