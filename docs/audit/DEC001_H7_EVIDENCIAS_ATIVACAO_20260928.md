# DEC-001/H7 — Evidências da Ativação PROD Site↔SMG + Checklist Executável

> **Front ID oficial:** `DEC-001-A` — "Gate de Ativação PROD Site↔SMG" (decisão PO 2026-09-28, Alternativa A; `H-1..H-8` congelado só para homologação — nome de arquivo legado `DEC001_H7_*` preservado por continuidade).
> **Ciclo autorizado pelo PO (2026-09-28):** diagnóstico → evidências (A0 read-only) → classificação → commit documental → STOP/GO-NO-GO A1–A5 → **NO-GO recebido** → diagnóstico/revalidação G8+G9 (read-only, evidências separadas §4.9/§4.10) → STOP.
> **Fase deste documento:** EVIDÊNCIAS + descoberta A0 executada (read-only); diagnóstico G8/G9 executado (read-only); **correção G8+G9 autorizada e executada** (envs + redeploy + verificação, §4.11); **A1 — Deploy ET — autorizado e executado** (ET deploy + 6 secrets, §4.12). A2–A5 mantêm NO-GO. Commit documental restrito aos docs necessários (decisão PO #5); atualização documental do ciclo NO-GO + execução G8/G9 + A1 **ainda não commitada** (aguarda autorização — §13).
> **Data:** 2026-09-28 · **Executor:** OpenCode (Tech Lead operacional) · **STATUS:** STOP/GATE — NO-GO A2–A5 mantido · G8+G9 execução verificada (§4.11) · A1 execução verificada (§4.12) · aguardando decisões do PO (§14).
> **Documento-irmão:** `DEC001_H7_ATIVACAO_DIAGNOSTICO_20260928.md` (diagnóstico; correções aplicadas §4.4/§7/§8; execução G8+G9+A1 registrada §11; decisões PO §9/§11).

---

## 1. Front / ID

- **Front:** ativação em produção da integração Site↔SMG (DEC-001), gate nunca executado (Fase 1 entregou com gate explícito, `SITE-SANCHEZ-CONTRACT.md:311`).
- **Escopo desta fase:** fechar gaps G1/G7 do diagnóstico, produzir o checklist executável de ativação, registrar decisões pendentes. **Sem ação de produção.**

## 2. Objective

1. Fechar evidências abertas do diagnóstico (G1 fonte dos 22, G7 estrutura dos maps).
2. Documentar o fluxo de dados Site↔SMG com precisão de arquivo/linha.
3. Entregar **checklist de ativação executável** (§10) com verificação e rollback por passo, pronto para autorização específica do PO.
4. Consolidar as decisões pendentes (§13) para o STOP/GATE.

## 3. Environment

| Item | Valor |
|---|---|
| Projeto PROD da integração | `ushsnmlbeurfvlkieiln` (`SUPABASE_URL` / `SMG_API_BASE_URL` em `.env.local`) |
| Projeto do frontend SMG | `tjcvuhynckocmvtqykxp` (`VITE_SUPABASE_URL`) — **não usar em probes H7** |
| Tenant | `b716e290-f7f6-4449-b790-5ae9dcdadcab` ("Barbearia Principal", slug `sanchez`) |
| Clone Site (arqueologia) | `%TEMP%\opencode\smg-audit\sanchez-barber` |
| Acesso live | `service_role` `.env.local` (len 219) via `curl.exe --max-time` — somente leitura |
| Tooling declarado | Management API `api.supabase.com` inacessível; `bash` complexo/paralelo trava (comandos sequenciais, um por chamada) |

## 4. EVIDENCE

> E = fato observado · I = interpretação · G = gap

### 4.1 Catálogo dos "22 serviços" — G1 FECHADO
- **E:** `.env.local` → `SMG_SERVICE_ID_MAP` contém **22 entradas** (JSON com aspas simples, formato único codificado):
  `barba_premium`, `depilacao_nasal_com_cera`, `corte_progressiva`, `corte_social`, `botox_capilar`,
  `alisamento_masculino`, `corte_degrade`, `progressiva_masculina`, `hidratacao_capilar`,
  `limpeza_de_pele`, `barba_terapia`, `corte_barba`, `corte_alisamento`, `barba_tradicional`,
  `corte_simples`, `platinado_masculino`, `luzes_corte`, `corte_barba_premium`,
  `design_sobrancelha`, `corte_sobrancelha`, `corte_botox_capilar`, `tintura_pigmentacao`.
  Valores: UUID SMG (ex.: `barba_premium → 0daa301a-3bb3-43f0-9dad-d38f277c5d95`).
- **E:** `SMG_PROFESSIONAL_ID_MAP` = **3 entradas**: `any`, `rubens_sanchez`, `heron_ferreira`.
- **I:** **a origem do "22" do contrato é este map** (22 chaves = 22 serviços SMG de referência).
  Leitura inicial "1 entrada" (diagnóstico original) era artefato do `ConvertFrom-Json` sobre string
  duplamente codificada — **corrigido no diagnóstico §4.4**.
- **I:** nenhum código em `sou-manager` consome `SMG_SERVICE_ID_MAP` (grep: só docs) — o mapa local é
  **cópia de referência**, consumidor real = repo Site (`api/smg/sync.js`) no ambiente Vercel.
- **G:** PROD tem **18** services vs 22 do map → diff exato (quais 4 faltam) pendente de leitura PROD (§4.5).

### 4.2 Catálogo do Site (clone) — convenções divergentes
- **E:** `src/lib/appointmentConfig.ts:14-29` — `BOOKING_SERVICES` = **8** itens (ids hífen:
  `corte, barba, corte-barba, sobrancelha, hidratacao, progressiva, luzes, limpeza-pele`;
  labels pt-BR: "Corte", "Corte + Barba", …) · `BOOKING_PROFESSIONALS` = 3
  (`rubens-sanchez`, `heron-ferreira`, `primeiro-disponivel`).
- **E:** `src/components/scheduling/data.ts` — segunda lista de **8** ids hífen
  (`assinatura, barba, ritual, camuflagem, sobrancelha, hidratacao, botox, limpeza-pele`).
  União das duas listas = 12 slugs distintos.
- **E:** build `dist/assets/index-CpLwmeOv.js` — **8 serviços** (lista `appointmentConfig`) + 3 pros.
- **E:** site `.env.example:11` — exemplo do map usa **chaves hífen** (`{"assinatura":"SMG_SERVICE_UUID",...}`).
- **I:** três convenções de chave em jogo: **underscore** (map local 22), **hífen** (catálogo/.env.example),
  **label pt-BR** (runtime) — §4.3.

### 4.3 Fluxo de dados real (arquivo:linha) — mismatch de convenção
- **E:** `SchedulingFlow.tsx:97` → `service: selectedService.name` (**label pt-BR**); `Hero.tsx:92-94` /
  `Dashboard.tsx:73-75` repassam `serviceId` (slug hífen) + `service` (label).
- **E:** `appointmentsStorage.ts:297-307` → `syncSiteAppointmentWithSmg({action:'create', service: LABEL, serviceId: SLUG_HÍFEN, ...})`.
- **E:** `smgClient.ts:55` → `POST /api/smg/sync` (Bearer = session Supabase do Site).
- **E:** `api/smg/sync.js` `handleCreate` (:229-305) → insert em `appointments` do Site com
  `service` = label, `service_id` = slug hífen, `sync_status:'pending'` → `buildCanonicalSmgPayload(created,...)` (:338).
- **E:** `sync.js:153-165` — `serviceSlug = row.service` (**label**) → `serviceIdMap[serviceSlug]`
  **sem normalização** → `if (!serviceId) throw "Unmapped service slug"`.
- **I:** com o **map local (underscore)** o lookup falharia para todo agendamento
  (`serviceIdMap["Corte + Barba"]` = undefined). A integração só funciona se o **map PROD (Vercel)**
  for **label-keyed** — ou se `row.service` em produção contiver outra coisa. **G2 = peça decisiva.**
- **E:** `sync.js:54-56` → destino = `${SMG_API_BASE_URL}site-sanchez-appointments` (**a ET**, hoje 404).
- **E:** sentido inverso: `api/smg/appointments.js` — webhook SMG→Site (`x-smg-secret`, `source_system:'smg'`,
  upsert `onConflict:'external_id'`; normalização em `src/lib/integrations/smg.ts:47-90`).

### 4.4 Estado PROD da ativação (reafirmação do diagnóstico, read-only 2026-09-28)
- **E:** ET `site-sanchez-appointments` → **HTTP 404 `NOT_FOUND`** (controles negativo/positivo validados — diagnóstico §4.2).
- **E:** OpenAPI PostgREST de `ush...` → **118 RPCs**, `create_site_sanchez_appointment` **ausente** → migration `20260426000000` não aplicada (§4.3 do diagnóstico).
- **E:** tenant `b716e290` → **18 services / 7 staff / 2040 appointments** (sem drift vs 2026-09-27).
- **E:** `supabase/functions/site-sanchez-appointments/config.toml` → `verify_jwt = false` (só local; repo **não tem** `supabase/config.toml` raiz → deploy exige `--no-verify-jwt` explícito).

### 4.5 Diff 18→22 (PENDENTE — limitação)
- **E:** 3 tentativas de `GET /rest/v1/services?tenant_id=eq.b716e290...&select=id,name,slug` → timeout
  (rede/travamento intermitente do ambiente nesta sessão). Contagens anteriores (`count=exact`) funcionaram.
- **G:** diff exato (4 services a criar) **não obtido** — query exata preservada no checklist (§10, passo A3).

### 4.6 A0 — Configuração PROD da origem Site (Vercel + probe ao vivo) — 2026-09-28

**Pull do env (`vercel env pull`, PROD **e** PREVIEW, projeto `sanchez-barber` + projeto legado `sou-manager`):**
- **E:** os 5 `SMG_*` estão **vazios** (string `""`, len 0): `SMG_API_BASE_URL`, `SMG_SERVICE_ID_MAP`, `SMG_PROFESSIONAL_ID_MAP`, `SMG_API_TOKEN`, `SMG_WEBHOOK_SECRET` — nos dois ambientes e no projeto legado.
- **E:** preenchidos: `SUPABASE_URL` = `https://ushsnmlbeurfvlkieiln.supabase.co` (len 40) · `VITE_SUPABASE_URL` = `https://rvpmaqoqrorcbxxnqpjo.supabase.co` (len 40) · `SANCHEZ_TENANT_ID` = `b716e290-f7f6-4449-b790-5ae9dcdadcab` (len 36).

**Probe ao vivo (read-only):**
- **E:** `POST https://sanchezbarber.vercel.app/api/smg/sync` body `{}` → **HTTP 400 `{"error":"Unsupported sync action"}`** (`sync.js:523`) — **não** `Missing server configuration`.
- **E:** gate `sync.js:469` `if (!supabaseUrl || !supabaseServiceRoleKey || !smgApiBaseUrl || (!smgWebhookSecret && !smgApiToken))` → 500 `Missing server configuration` (`:470`); map vazio só gera `console.warn` (`:473-478`); `action` desconhecido → 400 (`:515-523`).
- **I:** o gate **passou** → o **runtime do deploy atual** tem `SMG_API_BASE_URL` + secret **não-vazios**, enquanto o **pull do projeto** mostra vazios → **snapshot do deploy ≠ estado atual do projeto Vercel**. Interpretação: env congelado no deploy; o próximo redeploy propagaria `""` e o sync cairia com 500 (`Missing server configuration`).
- **G:** env do deployment específico não é legível read-only (re-pull trava, §7); o conteúdo dos maps dentro do runtime do deploy permanece desconhecido.

**Frontend do Site:**
- **E:** `VITE_SUPABASE_URL` aponta para `rvpmaqoqrorcbxxnqpjo` → **NXDOMAIN** (nslookup local + Google DoH + Cloudflare DoH; SOA `christina.ns.cloudflare.com`); o bundle live embute essa URL morta.
- **I:** ref Supabase do frontend do Site inexistente/renomeada → impacta o smoke **A5** (login/sessão no Site); definir o projeto alvo do frontend antes de A5.

**ush (destino da integração):**
- **E:** `appointments?service=not.is.null` → `[]` (0 linhas) → o Site **nunca gravou** `appointments.service` em PROD; contagens agregadas → `PGRST123` (query exata preservada §10.A3).

### 4.7 Tabela Origem × formato (entregável A0)

**(a) O que `sync.js` espera de `SMG_SERVICE_ID_MAP`:**

| Item | Formato/comportamento |
|---|---|
| Parse | `JSON.parse(process.env.SMG_SERVICE_ID_MAP \|\| '{}')` no load do módulo (`sync.js:13`) |
| Chave | **`row.service` exato** — a label pt-BR gravada pelo Site (ex.: `Corte Sanchez`); lookup `serviceIdMap[serviceSlug]` **sem normalização** (`:154-157`) |
| Valor | UUID do serviço SMG (vira `service_id` no payload canônico, `:170`) |
| Chave ausente | `throw "Unmapped service slug"` (`:160-161`) → `handleCreate` marca `status:'cancelled'`, `sync_status:'failed'` e retorna 500 (`:338-351`) |
| Map vazio | somente `console.warn` (`:473-475`) — todo `create` posterior falha no lookup |
| Profissionais | `SMG_PROFESSIONAL_ID_MAP` idem: chave = `row.barber` exato; valor ausente → throw (`:158,163-165`) |

**(b) O que o Site grava em `appointments.service`:**

| Campo | Conteúdo | Origem (arquivo:linha) |
|---|---|---|
| `service` | **label pt-BR**, um de: `Corte Sanchez`, `Barba de Respeito`, `Ritual do Chefe`, `Camuflagem Executiva`, `Acabamento de Sobrancelha`, `Hidratação`, `Botox Capilar`, `Limpeza de Pele` | `SchedulingFlow.tsx:97` (`selectedService.name`, catálogo `scheduling/data.ts:3-63`) → `Hero.tsx:94` / `Dashboard.tsx:75` → `appointmentsStorage.ts:302` → insert `sync.js:296` |
| `service_id` | slug hífen: `assinatura`, `barba`, `ritual`, `camuflagem`, `sobrancelha`, `hidratacao`, `botox`, `limpeza-pele` | `SchedulingFlow.tsx:95` → insert `sync.js:297` |
| `barber` | `Primeiro disponível` \| `Rubens Sanchez` \| `Heron Ferreira` | `scheduling/data.ts:65-81` → insert `sync.js:298` |
| `barber_id` | `primeiro-disponivel` \| `rubens-sanchez` \| `heron-ferreira` | idem → insert `sync.js:299` |
| demais | `source_system:'local'`, `sync_status:'pending'`, `date/month/time` | `sync.js:302-304` |

- **E:** `appointmentConfig.ts` `BOOKING_SERVICES` (ids hífen; labels `Corte`, `Corte + Barba`…) é consumido **apenas** por `AppointmentPortal.tsx` (fluxo WhatsApp, `:119,275`) — **não** grava `appointments`; não é fonte do map.

**(c) Convenções em jogo e conclusão do G2:**

| # | Origem | Chave | Exemplo | Casa com o runtime? |
|---|---|---|---|---|
| 1 | `.env.local` SMG (22 entradas, §4.1) | underscore-slug | `barba_premium → 0daa…` | ❌ lookup falharia |
| 2 | Site `.env.example:11-12` | hífen-slug | `{"assinatura":…}` | ❌ idem |
| 3 | **Runtime `sync.js:157`** | **label pt-BR exata** | `serviceIdMap["Corte Sanchez"]` | ✅ **única que funciona** |
| 4 | PROD (pull A0) | — (vazio) | `""` | ❌ mapa inexistente |
| 5 | PROD (snapshot do deploy) | desconhecido | — | ❓ ilegível read-only (G8) |

- **I (G2 encerrado no escopo read-only):** **não existe convenção legada a herdar** (pull vazio) e o runtime **exige** label-keyed. A3/A4 devem **criar** o map label-keyed com **11 chaves** — 8 labels de serviço + 3 de barbeiro (§b). `Primeiro disponível` precisa de valor SMG definido (candidato natural: o valor da chave `any` do map local — a validar com o PO/A3).
- **G:** correspondência label → UUID dos 18 services PROD (e criação de faltantes) só é obtível em A3 (diff §4.5).
- **E (forense §4.19, 2026-09-29):** as citações desta tabela (`sync.js:13`, `:157`, `:469`, `:523`) foram **revalidadas contra o código DEPLOYADO** (GitHub main `e7e50e9`, 524 linhas, Production ✓) — batem exatos. O clone local (370 linhas, **sem** consumo de maps) é que estava desatualizado; não é fonte de verdade de `sync.js`.

### 4.8 Classificação das refs documentais (G5 — pré-condição do commit)

Regra: **NECESSÁRIO** = citado por artefato versionado (contrato ou docs deste commit) · **auxiliar** = permanece `untracked`.

| Doc | Citado por | Classificação | Destino |
|---|---|---|---|
| `DEC001_H7_EVIDENCIAS_ATIVACAO_20260928.md` · `DEC001_H7_ATIVACAO_DIAGNOSTICO_20260928.md` | entrega deste front | **NECESSÁRIO** | commit |
| `H7_B_TRILHO_B_P1_P4_READONLY_RELATORIO.md` | `SITE-SANCHEZ-CONTRACT.md:293,321` (→ `:179`) + diagnóstico `:57` | **NECESSÁRIO** | commit |
| `H7_B_TRILHO_B_INVESTIGACAO_ADICIONAL_RELATORIO.md` | diagnóstico `:81` (→ `:172`) | **NECESSÁRIO** | commit |
| demais 6 `H7_B_*` (FRENTE_A, FRENTE_B_B1, AUDITORIA_READONLY, CHANGE_CONTROLS, FASE2_PLANO, INVESTIGACAO_EXPOSICAO) | nenhum doc versionado | auxiliar (outro cluster) | permanece `untracked` |
| `H7_1_STOP_GATE_FINAL_RELATORIO.md` | — (cluster H-7-1) | auxiliar | permanece `untracked` |
| `ARCHAEOLOGY_20260927/` + demais `docs/audit/*` untracked (6.1.4_*, M4_*, P_AUTO_*, …) | — | fora do escopo DEC-001-A | permanece `untracked` |

- **E:** scan de segredos dos 2 relatórios a commitar: apenas **nomes** de env vars citados, nenhum valor.

### 4.9 Diagnóstico G8 — 5 `SMG_*` vazios no Vercel (revalidação read-only — 2026-09-28)

**Escopo (PO):** somente diagnóstico/leitura. Nenhum env alterado, nenhum deploy, nenhuma migration.

**E (fato observado):**
- Pull fresco **PROD** (`vercel env pull --environment=production`) e **PREVIEW** (`--environment=preview`), projeto `sanchez-barber`: os mesmos **5 `SMG_*` = len 0** (string vazia) nos dois ambientes: `SMG_API_BASE_URL` · `SMG_WEBHOOK_SECRET` · `SMG_API_TOKEN` · `SMG_SERVICE_ID_MAP` · `SMG_PROFESSIONAL_ID_MAP`.
- `vercel env ls production`: 12 vars, todas "Encrypted"; as 5 `SMG_*` **existem** (criadas há 124d, Preview+Production) → existem, mas com valor vazio.
- Demais deps do gate `sync.js:469` OK: `SUPABASE_URL` len 40 (`https://ushsnmlbeurfvlkieiln.supabase.co`) · `SUPABASE_SERVICE_ROLE_KEY` len 219 · `SANCHEZ_TENANT_ID` len 36 (`b716e290-…`).
- Probe ao vivo **reexecutado**: `POST https://sanchezbarber.vercel.app/api/smg/sync` body `{}` → **HTTP 400 `{"error":"Unsupported sync action"}`** (`sync.js:523`) — **não** 500 `Missing server configuration` (gate `sync.js:469`) → o runtime do deploy segue com `SMG_API_BASE_URL` + secret **não-vazios**.
- Deploy: `dpl_GyhURnBuJfbwRh72fM9buyDHDGLw` (Production, Ready, criado 2026-09-28 00:08:06 −03:00, alias `sanchezbarber.vercel.app`; builds: λ `api/smg/sync` 207.9KB); `vercel inspect` não expõe SHA de commit.

**Valor esperado por var (fonte; sem valores de segredo):**

| Var | Esperado (fonte) | Estado |
|---|---|---|
| `SMG_API_BASE_URL` | `https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1` — não-segredo; `.env.local` SMG (len 53) × formato `Site README:35` | vazio no pull PROD+PREVIEW |
| `SMG_WEBHOOK_SECRET` | segredo compartilhado Site↔ET (`README:34,116`); tem de igualar `SANCHEZ_WEBHOOK_SECRET` da ET (A1); `.env.local` len 33 (dev) | vazio → **definição = PO** |
| `SMG_API_TOKEN` | fallback deprecado (`README:36`, `sync.js:64`); opcional se o webhook secret existir (gate `:469` exige um dos dois); `.env.local` len 33 | vazio → **definição = PO** |
| `SMG_SERVICE_ID_MAP` | JSON **label-keyed** de 8 labels de serviço → UUIDs ush (`sync.js:157`; montado em A3 — §4.7c) | vazio (o `.env.local` len 1285 tem 22 chaves underscore = convenção errada, §4.7c) |
| `SMG_PROFESSIONAL_ID_MAP` | JSON **label-keyed** de 3 labels de barbeiro → UUID staff (`sync.js:163-165`; A3) | vazio (`.env.local` len 160 — reconstruir em A3) |

- Consumidores: `sync.js:5,6,7,13,19` · gate `:469-470` · warns `:474,:477` · `appointments.js:6` · docs `README:34-38,43,64-65,89,116` · `.env.example:8-12` · `AGENTS.md:29`.

**I (interpretação):**
- Estado **inalterado** desde A0: pull vazio (PROD **e** PREVIEW) × gate vivo passando → o deploy de 2026-09-28 congelou valores não-vazios; o estado atual do projeto está vazio → **qualquer redeploy sem o re-set derruba o sync** (500 `Missing server configuration`) — A4 continua pré-condição dura.
- Mesmo com as 3 primeiras vars re-setadas, **maps vazios ainda quebram todo `create`** (lookup `:157` → throw `:161` → 500); os gates `:474,:477` só avisam. **A3 e A4 são interdependentes.**
- Valor esperado **já determinado** para 1 var não-segredo (`SMG_API_BASE_URL`); 2 segredos são decisão de Augusto; 2 maps são construídos em A3 (não herdam nada — pull vazio, G2 fechado §4.7c).

**G (gap):**
- Quem/esvaziou e quando as 5 vars não é apurável read-only (sem acesso a audit log do Vercel).
- Os valores congelados no snapshot do deploy continuam ilegíveis (limitação registrada §4.6/§7).
- Correção (escrita em env) **não executada** — aguarda autorização do PO.

### 4.10 Diagnóstico G9 — `VITE_SUPABASE_URL` do Site aponta para projeto inexistente (revalidação read-only — 2026-09-28)

**Escopo (PO):** somente diagnóstico/leitura. Nenhum env alterado, nenhum deploy.

**E (fato observado):**
- Origem: **env Vercel Production** `VITE_SUPABASE_URL` = `https://rvpmaqoqrorcbxxnqpjo.supabase.co` (len 40) — **0 ocorrências** de `rvpmaq…` no clone do Site (grep `src/`+`api/`); `.env.example:2` só traz placeholder `https://YOUR_PROJECT_REF.supabase.co` → a URL entra no build via `src/lib/supabaseClient.ts:3` (`import.meta.env.VITE_SUPABASE_URL`).
- `VITE_SUPABASE_ANON_KEY` (len 208): payload JWT = `{"iss":"supabase","ref":"rvpmaqoqrorcbxxnqpjo","role":"anon",…}` → a chave também pertence ao **mesmo ref inexistente**. (`VITE_SUPABASE_PUBLISHABLE_KEY` len 0 — irrelevante: o código lê `VITE_SUPABASE_ANON_KEY`, `supabaseClient.ts:4`.)
- DNS (reconfirmado): Google DoH `rvpmaqoqrorcbxxnqpjo.supabase.co` → **Status 3 (NXDOMAIN)**, SOA `christina.ns.cloudflare.com`; controle `ushsnmlbeurfvlkieiln.supabase.co` → Status 0 (`104.18.38.10`, `172.64.149.246`).
- Bundle live: `https://sanchezbarber.vercel.app/` serve `assets/index-B8GS0yh2.js` → **`rvpmaq…` ×1, `ush…` ×0** → a URL morta está embutida no JS publicado.
- Construção: `supabaseClient.ts:6` `isSupabaseConfigured = Boolean(url && key)` → **true** (ambos setados) → `:15` `createClient(deadUrl)` → a app se considera configurada e **não** cai no fallback `null`.
- Consumidores de `supabase.auth`/client: `authStorage.ts` (`signUp :226`, `signInWithPassword :292`, `signOut :310`, `getUser :161`) · `AuthContext.tsx` (`onAuthStateChange :60`) · `appointmentsStorage.ts` (`getUser :135`) · `smgClient.ts` (`getSession :43`).
- Contraste: **server-side** `SUPABASE_URL` = `ush…` (resolve) — só o **client-side** aponta para o projeto morto.

**I (interpretação):**
- A URL não é gerada por nenhum arquivo do repo: nasce do env `VITE_SUPABASE_URL` (+ anon key) do Vercel e é **inlined em build**. Correção = mudar env + **redeploy** (não há diff de código a fazer).
- Enquanto persistir: auth/sessão/insert dependentes do client Supabase falham em runtime no Site (host NXDOMAIN) → **A5 (smoke com login/sessão) inviável** — bloqueio confirmado, decisão PO sobre o projeto alvo pendente.

**G (gap):**
- Qual projeto o front do Site **deveria** usar (o `rvpmaq…` era apagado/renomeado/nunca existiu?) não é determinável read-only → **decisão de Augusto**.
- Histórico de quando o env apontou para ref válido/inválido: sem audit log read-only.
- Correção de config (env + redeploy) **não executada** — aguarda autorização.

### 4.11 Execução da correção autorizada — G8 + G9 (2026-09-28)

**Escopo (autorização PO):** re-setar os envs G8/G9 + redeploy + verificação (pull + probe), nos limites do "guia recomendado" (decisão PO #2) e "corrigir para ush" (decisão PO #3). A1–A5 seguem NO-GO.

**E (escrita executada):**

*Produção (`vercel env … --yes`, projeto `sanchez-barber`, cwd `%TEMP%\opencode\vprobe`):*

| Var | Valor | Tam. | Origem |
|---|---|---|---|
| `SMG_API_BASE_URL` | `https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1` | 53 | decisão PO #2 (não-segredo) |
| `SMG_WEBHOOK_SECRET` | hex 64 (RNG `RNGCryptoServiceProvider`) | 64 | decisão PO #2: UM segredo novo compartilhado Site↔ET (mesmo valor → `SANCHEZ_WEBHOOK_SECRET` da ET em A1) |
| `VITE_SUPABASE_URL` | `https://ushsnmlbeurfvlkieiln.supabase.co` | 40 | decisão PO #3 |
| `VITE_SUPABASE_ANON_KEY` | JWT anon role, ref `ushsnmlbeurfvlkieiln` | 208 | decisão PO #3 (confirmado via payload JWT) |
| `SMG_API_TOKEN` | vazio (`""`) | 0 | decisão PO #2: fallback deprecado, não usado (gate `:469` satisfeito via `WEBHOOK_SECRET`) |
| `SMG_SERVICE_ID_MAP` | vazio (`""`) | 0 | decisão PO #2: mapas vazios até A3 |
| `SMG_PROFESSIONAL_ID_MAP` | vazio (`""`) | 0 | decisão PO #2: idem |

*Preview (`feat/dec-001-site-sanchez-contrato`):* mesmos valores espelhados (URL, `WEBHOOK_SECRET`, `VITE_*`); gate do projeto exige branch em git-connected (testes com `main` rejeitados — `branch_not_found`; branch `feat/dec-001-site-sanchez-contrato` aceita).

**Redeploy:**
- Origem: `vercel redeploy https://sanchezbarber.vercel.app` → deployment fonte `dpl_GyhURnBuJfbwRh72fM9buyDHDGLw` (o mesmo de §4.9).
- Novo: `sanchez-barber-8o7sye15j-augustosanchesmanager-uxs-projects.vercel.app` (Production, alias `sanchezbarber.vercel.app`).
- Build: 40s · status Ready · sem SHA git exposto.

**I (verificação):**
- Pull fresco `vprod2.env` (produção): comprimentos batem — `SMG_API_BASE_URL=53`, `SMG_WEBHOOK_SECRET=64`, `VITE_SUPABASE_URL=40`, `VITE_SUPABASE_ANON_KEY=208`, token/maps=0. Valores com **zero `\r\n`** (escrita via `--value`, não via pipe stdin).
- Probe ao vivo (pós-redeploy): `POST https://sanchezbarber.vercel.app/api/smg/sync {}` → **`{"error":"Unsupported sync action"}`** (HTTP 400, `sync.js:523`) — **gate `:469` passou** (envs não-vazios como esperado).
- Bundle novo: `https://sanchezbarber.vercel.app/` → `<script src="/assets/index-DEGutXL9.js">` (hash anterior `B8GS0yh2`).
- Grep do bundle: `rvpmaq…` × **0** (URL morta removida do build); `ushsnmlbeurfvlkieiln` × **1** (nova URL inlined).
- Token JWT de `VITE_SUPABASE_ANON_KEY`: payload decodificado = `{"iss":"supabase","ref":"ushsnmlbeurfvlkieiln","role":"anon",…}` — confere com a URL.

**G (limitações remanescentes):**
- **A1–A5 seguem NO-GO:** ET não-deployada, migration não aplicada, 18≠22 serviços, maps ainda vazios → integração Site↔SMG continua **inerte** (`sync.js` cria `appointments` mas RPC/ET não existe; A5 smoke dependeria de A1+A2).
- **Preview só na branch `feat/dec-001-site-sanchez-contrato`:** preview builds em outras branches herdam valores de produção até alguém configurar explicitamente — limitação do projeto git-connected (não documentada no ROADMAP).
- **WEBHOOK_SECRET nunca impresso:** valor vive só no Vercel prod (e preview espelhado); para A1 será recuperado via `vercel env pull` local — registrar na decisão PO de A1.
- **SHA do git do deploy não exposto** pelo `vercel inspect` — correlação bundle↔commit continua limitada a "redeploy do dpl original".

### 4.12 Execução A1 — Deploy ET `site-sanchez-appointments` (2026-09-28)

**Escopo (autorização PO):** A1 apenas — `supabase functions deploy … --no-verify-jwt` + `supabase secrets set` (6 vars). A2–A5 seguem NO-GO.

**E (deploy executado):**
- Comando: `supabase functions deploy site-sanchez-appointments --no-verify-jwt --project-ref ushsnmlbeurfvlkieiln` → resposta `{"message":"Deployed Functions."}`.
- Fonte: `supabase/functions/site-sanchez-appointments/{index.ts, contract.ts, config.toml}` (commit working tree); `config.toml` já traz `verify_jwt = false`; `--no-verify-jwt` é o flag documentado para deploys sem `supabase/config.toml` raiz (§4.5 do diagnóstico).

**E (secrets executados — Management API list, 2026-09-28T19:0x):**

| Var | Valor | updated_at | Origem |
|---|---|---|---|
| `SANCHEZ_TENANT_ID` | `b716e290-…` (len 36, do `.env.local`) | 19:02:28 | `supabase secrets set` |
| `SANCHEZ_WEBHOOK_SECRET` | hex 64 (de `vprod2.env` — mesmo valor de §4.11/G9) | 19:02:46 | `supabase secrets set` |
| `SANCHEZ_DOMAIN_SCHEMA` | `public` | 19:02:58 | `supabase secrets set` |
| `SUPABASE_URL` | `https://ushsnmlbeurfvlkieiln.supabase.co` (pré-existente) | 19:00:04 | herdado (ET confirmou config correta — I abaixo) |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT `eyJ…` len 219 (pré-existente) | 19:00:04 | herdado (idem) |
| `SANCHEZ_ALLOWED_ORIGIN` | `https://sanchezbarber.vercel.app` | 19:13:21 | Management API (workaround CLI bug — G abaixo) |

**I (verificação — ET responde ao envelope):**
- `GET https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1/site-sanchez-appointments` → **HTTP 405** `{"ok":false,"error":"Method not allowed.","request_id":"6f735662-…"}` — **não** 404 `NOT_FOUND` (negativo controlado anterior — §4.2 do diagnóstico).
- `POST …` body `{}` (sem `Authorization`, sem `x-sanchez-signature`) → **HTTP 401** `{"ok":false,"error":"Unauthorized.","request_id":"228eeeb7-…"}` — gate de config passou (sem 500 `Integration is not configured`); auth check (`verifyRequestAuth` em `contract.ts:124`) atua corretamente.
- **RPC ainda ausente:** POST autenticado retorna 500 com mensagem `function create_site_sanchez_appointment … does not exist` (RPC só vem com A2 — migration NÃO aplicada; bloco B2 do diagnóstico).

**G (limitações remanescentes):**
- **CLI v2.95.6 bug:** `supabase secrets set "SUPABASE_URL=https://…"` falha com `LegacySecretsNoArgumentsError — No arguments found. Use --env-file to read from a .env file` — o parser Node.js quebra em valores com `//`. **Workaround:** usar Management API (`api.supabase.com/v1/projects/{ref}/secrets` POST, body JSON array, header `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`). Documentar como **GAP A1-W1** se repetir em A2–A5.
- **`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` pré-existentes:** valores não verificáveis via API (retorna `value` como SHA-256). A resposta 405/401 do ET (sem 500) confirma que estão corretos.
- **A2–A5 seguem NO-GO:** migration `20260426000000_site_sanchez_appointments.sql` ainda ausente do schema público (`/rpc/create_site_sanchez_appointment` → 404 no OpenAPI), 18≠22 serviços, maps vazios → integração **inerte** (RPC chamada falha até A2).

### 4.13 A2-DIAG + A2-B — Diagnóstico de drift e criação da migration corretiva (2026-09-28)

**Escopo (autorizações PO):** A2-DIAG (read-only, 12 perguntas) + A2-B (criação + validação local da `20260426000001`). Aplicação em PROD **não** autorizada nesta etapa.

**E (drift diagnosticado — preflight Management API):**
- A tentativa inicial de aplicar `20260426000000` falhou: PostgreSQL **42809** — `ALTER action ADD COLUMN cannot be performed on relation "appointments" … not supported for views` em `barber.appointments` (CONTEXT: `ALTER TABLE barber.appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ`). Transação com `BEGIN/COMMIT` → rollback total, **nada persistido**.
- Preflight confirmou: `public.appointments` = **BASE TABLE** · `barber.appointments` = **VIEW** · RPC `create_site_sanchez_appointment` **ausente** · `public.appointments` com **9/10** colunas do contrato (faltava só `external_source`) · constraints `source`/`channel` já existentes com a definição do contrato.
- A migration original executa `FOREACH target_schema IN ARRAY ARRAY['public','barber']` assumindo TABLE nos dois schemas — premissa incompatível com o estado real de PROD.

**I (decisão PO):** drift estrutural real → A2 original **NO-GO**; **A2-DIAG** (read-only) autorizado → 12 perguntas respondidas com dados do preflight → PO escolheu **Opção B** (`20260426000000` permanece histórica intocada; correção em nova migration).

**E (A2-B — criação):** criada `supabase/migrations/20260426000001_site_sanchez_appointments_correction.sql` — escopo **APENAS `public`**:
1. `ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS external_source TEXT`;
2. Drop/ADD `appointments_source_check` → `source IN ('app','kiosk','site_sanchez')`;
3. Drop/ADD `appointments_channel_check` → `channel IS NULL OR channel IN ('totem','qr','whatsapp','admin','site')`;
4. `idx_public_appointments_active_slot` (btree `tenant_id, staff_id, start_time` WHERE status ∉ cancelled/no_show);
5. `idx_public_appointments_external_site` (UNIQUE `tenant_id, external_source, external_id` WHERE ambos NOT NULL);
6. `CREATE OR REPLACE public.create_site_sanchez_appointment(…)` — mesma lógica da original + guard adicional `v_schema != 'public'` → RAISE;
7. REVOKE `PUBLIC`/`anon`/`authenticated` + GRANT `service_role`; `NOTIFY pgrst, 'reload schema'`.

**I (validação diff = PASS):** 7 diferenças estruturais vs `20260426000000` (loop `barber` removido · guard público-only · índices prefixados `idx_public_` · demais contrato idêntico). Evidências: zero referência DDL a `barber` (apenas comentário) · `20260426000000` sem modificação (`git status`/`git diff`) · nenhum DDL/DML fora do escopo. **Aprovação PO → A2-Prod.**

### 4.14 Execução A2-Prod — Aplicação da migration corretiva `20260426000001` (2026-09-28)

**Escopo (autorização PO):** A2-Prod apenas — aplicar `20260426000001` em `ushsnmlbeurfvlkieiln` + validação + registro §4.14. A3–A5 seguem 🔒.

**E (aplicação):**
- Método: Supabase Management API `POST /v1/projects/ushsnmlbeurfvlkieiln/database/query` com body `{"query": <SQL integral do arquivo>}` (UTF-8 verificado byte-a-byte; JSON validado antes do envio).
- Resposta: `[]` — sucesso (DDL não produz result set; erro retornaria `{"message":…}` como o 42809 anterior).

**E (validação pós-aplicação — queries read-only):**

| Check | Resultado |
|---|---|
| `public.appointments.external_source` | ✅ presente (coluna) |
| `appointments_source_check` | ✅ `CHECK (source = ANY(ARRAY['app',…]))` |
| `appointments_channel_check` | ✅ `CHECK (channel IS NULL OR channel IN (…))` |
| `idx_public_appointments_active_slot` | ✅ btree `(tenant_id, staff_id, start_time)` WHERE status ∉ (cancelled, no_show) |
| `idx_public_appointments_external_site` | ✅ UNIQUE `(tenant_id, external_source, external_id)` WHERE ambos NOT NULL |
| RPC `create_site_sanchez_appointment` | ✅ existe; **ACL** = `{postgres=X/postgres, service_role=X/postgres}` (PUBLIC/anon/authenticated **sem** EXECUTE) |
| Guard `v_schema != 'public'` no `prosrc` | ✅ presente |
| Colunas do contrato | ✅ 10/10 (`missing_cols = none`) |
| `barber.appointments` | ✅ permanece **VIEW** — intocada |
| `20260426000000` (repo) | ✅ sem modificação (`git status`/`git diff`) |

**E (teste funcional negativo da RPC — sem DML, exceção antes de qualquer escrita):**
- `create_site_sanchez_appointment(…, p_domain_schema => 'barber')` → **P0001** `Schema de domínio invalido para esta migration corretiva. Apenas 'public' e suportado. Recebido: barber` (prosrc line 22) — guard funciona.
- `create_site_sanchez_appointment(NULL tenant, …)` → **P0001** `Tenant Sanchez nao configurado` (prosrc line 34) — corpo da função executa de ponta a ponta até a validação.

**G (limitações remanescentes):**
- **Ledger divergente (GAP A2-W1):** `supabase_migrations.schema_migrations` contém `20260426000000` (`site_sanchez_appointments`), porém seu conteúdo **não** estava aplicado (RPC/coluna ausentes antes de A2-Prod) → ledger registra como aplicada uma migration cujo efeito não existia. Inversamente, `20260426000001` **não** foi registrada no ledger (aplicação via API bruta não grava `schema_migrations`). Reconciliação de ledger = **DML não autorizada neste gate** → decisão futura do PO.
- **Teste positivo (happy-path com dados reais) não executado** — exigiria escrita em PROD; A5 (smoke E2E) é o gate próprio.
- **A3–A5 permanecem 🔒** — sucesso de A2 não gera autorização automática.

**I:** **A2-Prod PASS.** RPC disponível com least-privilege + guard público-only; colunas/índices/constraints do contrato presentes; `barber.appointments` intocada; `20260426000000` intocada. Integração Site↔SMG permanece **inerte** até A3 (services+maps) e A5 (smoke).

### 4.15 A2-W1-DIAG — Diagnóstico read-only do ledger `supabase_migrations.schema_migrations` (2026-09-29)

**Escopo (autorização PO #13):** somente leitura no ledger e no estado efetivo · 6 itens mínimos exigidos · **proibido** DML, commit, A3, A4, A5. Evidências brutas: `C:\Users\admsm\AppData\Local\Temp\smg_w1_*.json` (28 queries) + scripts `a2w1_diag*.ps1`.

**E — Item 1: ledger completo/ordenado**
- 155 linhas; colunas: `version` (PK, text) · `statements` (array) · `name` · `created_by` · `idempotency_key` · `rollback`. **Não existe coluna de data/hora** → o ledger não permite datar cada gravação.
- `max_version = 20260915175459`; duplicatas de `version`: nenhuma (PK única); linhas com `idempotency_key`: 0.

**E — Item 2: dependências de `20260426000000`**
- Grep `site_sanchez|external_source|idx_public_appointments_external_site|create_site_sanchez_appointment` em `supabase/migrations/2026*.sql`: **apenas** `20260426000000` e `20260426000001`.
- **Nenhuma outra migration do repo depende dela.** Única dependência em runtime: ET `site-sanchez-appointments` (A1) → RPC.

**E — Item 3: duplicados/anomalias**
- `20260426000000`: **sem duplicado**; `created_by=null` · `idempotency_key=null` · `has_rollback=false` · 10 statements (`BEGIN` · `DO` com `FOREACH ARRAY['public','barber']` · `DROP FUNCTION` · `CREATE FUNCTION` · `REVOKE`×3 · `GRANT` · `NOTIFY` · `COMMIT`) — casamento íntegro com o arquivo.
- Anomalias do ledger (outras linhas):
  - `20260915175459`: **órfã** (nenhum arquivo no repo); `name=20260914130000_f1_staff_role_hierarchy_enforcement`; 1 statement = arquivo F1 inteiro; `created_by=sanchesfotografias@gmail.com` → **F1 registrado 2×** (também `20260914130000`, 8 statements).
  - `20260806010000`: `name` contém `.sql` + `statements IS NULL`.
  - `20260421002405`: `statements IS NULL`.
  - `created_by` = e-mail apenas nas ~21 primeiras (fev/2026) + na órfã; demais `null`.
- **I (causa raiz — INDETERMINADA por leitura):** HIPÓTESES rotuladas, não confirmadas: **(H1)** aplicação CLI histórica cujos efeitos foram perdidos por operação posterior out-of-band — porém **nenhuma migration dropa a RPC** e o ledger é atemporal; **(H2)** gravação da linha sem execução real (repair/manual anterior). **GAP: não determinável com certeza read-only** (sem timestamp nem trilha de auditoria no ledger).

**E — Itens 4–5: mecanismo oficial de reconciliação**
- Caminho oficial documentado (docs Supabase + `supabase migration repair --help`, CLI v2.95.6): **`supabase migration repair <version> --status applied --linked`** — *"updates the tracking table only — it does not apply or revert any SQL"*. Registra `20260426000001` (e as demais pendentes) **sem violar o mecanismo** — é exatamente o procedimento documentado para "schema change already there (for example, it was applied manually)".
- Alternativa oficial: **`supabase db push`** — re-executa as pendentes em ordem (todas idempotentes/no-op no estado atual) e grava os registros automaticamente.
- `--status reverted` deleta um registro (ex.: limpeza opcional da órfã `20260915175459`).
- **DML manual (INSERT/UPDATE/DELETE) = caminho não suportado → descartado.** Qualquer uma das duas opções = **escrita → exige autorização explícita do PO**.

**E — Item 6: REPO × LEDGER × ESTADO EFETIVO**

| Dimensão | Resultado |
|---|---|
| Repo (`supabase/migrations/`) | **157** versions |
| Ledger | **155** rows |
| Repo **sem** ledger (3) | `20260426000001` (aplicada via Management API em A2-Prod, efeito validado §4.14) · `20260919054555` (SHA256 **idêntico** a `20260901120000` já aplicada → no-op; PROD: `has_auth_guard/has_v2_membership/has_v2_var=true`, `prosrc_len=7357`) · `20260924000000` (coluna `comanda_items.staff_id` + FK `_l_comanda_items_staff_id_fkey` com `confdeltype='n'` já presentes → no-op; arquivo declarado "PREPARAÇÃO apenas — NÃO aplicar em PROD") |
| Ledger **sem** repo (1) | `20260915175459` (órfã = duplicata do F1) |
| Estado efetivo pós-A2-Prod | 10/10 colunas · 2 constraints · 2 índices · RPC presente ✅ |
| Tabelas `_legacy%` | nenhuma (restore já ocorrido) |

**I:** **A2-W1-DIAG PASS (6/6 itens).** Divergências mapeadas: **3 pendências de registro** + **1 linha órfã**; causa da linha `20260426000000` sem efeito prévio **indeterminada read-only** (H1/H2 rotuladas). Reconciliação = escrita no ledger → **STOP/GATE para decisão do PO** (opções A/B, §13).

### 4.16 Execução A2-W1-RECON — reconciliação cirúrgica via `migration repair` (2026-09-29)

**Escopo (autorização PO #14):** somente 2 comandos `supabase migration repair` (CLI v2.95.6, `--linked --yes`): `20260426000001 → applied` e `20260915175459 → reverted`. **Proibido:** registrar `20260919054555`/`20260924000000` · DML manual · `db push` · re-execução de SQL · exclusão física.

**E (pré-estado baseline — read-only, `smg_recon_pre_*.json`):**
- Ledger: **155** rows · alvos `20260426000001`/`20260919054555`/`20260924000000` **ausentes** · órfã `20260915175459` presente (1 stmt / 11004 B / `created_by` e-mail) · `20260426000000` = 10 stmts / 12552 B.
- Efetivo: `appt_cols=47 · appt_cons=12 · appt_idxs=19 · rpc_cnt=1 · barber.appointments=VIEW · ACL={postgres,service_role}`.
- Pré-condições: projeto linkado (`supabase/.temp/project-ref = ushsnmlbeurfvlkieiln`) · arquivo local `20260426000001_…` existe · `migration list --linked` operacional (exit 0).

**E (execução — exatamente o escopo autorizado, nenhuma ação extra exigida):**
1. `supabase migration repair 20260426000001 --status applied --linked --yes` → `Repaired migration history: [20260426000001] => applied` (**exit 0**).
2. `supabase migration repair 20260915175459 --status reverted --linked --yes` → `Repaired migration history: [20260915175459] => reverted` (**exit 0**).

**E (validação pós — 7 itens da regra de execução do PO, `smg_recon_post_*.json`):**

| # | Item exigido | Resultado |
|---|---|---|
| 1 | Verificar o ledger | ✅ total **155** (155 − 1 órfã + 1 nova = 155) · 0 versões duplicadas |
| 2 | `20260426000001` = `applied` | ✅ presente (`name=site_sanchez_appointments_correction`, 13 stmts do arquivo local gravados pelo repair, `created_by=null`) · `migration list` mostra **LOCAL = REMOTE pareado** |
| 3 | `20260915175459` = `reverted` | ✅ **ausente** do ledger · `migration list` sem a linha |
| 4 | Nenhum SQL de migration re-executado | ✅ efetivo **idêntico** ao baseline: `47/12/19/1/VIEW` · ACL inalterada · `20260426000000` **byte-idêntica** (10 stmts / 12552 B) |
| 5 | `20260919054555` e `20260924000000` sem alteração | ✅ ambas permanecem **fora** do ledger · `migration list` = LOCAL-only |
| 6 | `git diff --check` | ✅ **PASS (exit 0)** · nenhum arquivo local alterado pela operação (`git status supabase/migrations/` inalterado) |
| 7 | STOP/GATE | ✅ emitido (irmão §13/§14) |

**G (divergências remanescentes — deliberadas pelo PO #14):**
- `20260919054555` segue local-only — **não registrada** (rastreabilidade própria pendente). *Registro factual:* o arquivo **existe e está commitado** no repo (tracked, commit `21438a2`; SHA256 idêntico a `20260901120000`) — divergente da premissa "arquivo ausente no repositório" citada na decisão; a decisão de não registrar vale independentemente do motivo.
- `20260924000000` segue local-only — **não registrada** (cabeçalho: "PREPARAÇÃO apenas — NÃO aplicar em PROD").
- Causa H1/H2 da linha `20260426000000` permanece indeterminada — **sem impacto**: estado efetivo validado correto desde A2-Prod.
- Achado colateral pré-existente (fora de escopo): `migration list` exibe versões de datas curtas (`20260420/27/28`, `20260501/02`) como linhas LOCAL/REMOTE separadas apesar de string idêntica no ledger (vlen=8) e arquivo local único — quirk de pareamento do CLI v2.95.6; nenhum efeito sobre os 2 repairs executados (todos os alvos de 14 dígitos parearam corretamente).

**I:** **A2-W1-RECON PASS.** Ledger reconciliado cirurgicamente exatamente conforme o GO do PO · zero SQL re-executado · objetos do banco inalterados · anomalia da órfã removida pelo mecanismo oficial.

### 4.17 A3 — Diff read-only 18→22 + análise de mapeamento · STOP intermediário (2026-09-29)

**Escopo executado:** somente leitura (pré-condição §10 "diff reexecutado" + mitigação §11 "diff validado pelo PO **antes** de criar"). **Zero escritas** — nenhum service criado, nenhum dado alterado.

**E (estado + backup):**
- Tenant `b716e290`: **18 services / 7 staff** (snapshots completos capturados: id/nome/categoria/preço/duração/ativo dos serviços; id/nome/papel/status do staff; catálogo global com 8 linhas).
- `barber.services`/`barber.staff` = **views** sobre `public` (`relkind='v'`, 18/7 ids compartilhados) → fonte única = `public`.
- Professional map local resolve **3/3 no tenant**: `any` = `rubens_sanchez` = `0b0d5fd1-818e-418d-a40d-378d772a787b` (= **RUBENS SANCHEZ**) · `heron_ferreira` = `62ddf002-5c05-49fa-8ff3-6d67fa82c562` (= **HERON FERREIRA**) ✓

**E (diff exato — hipótese §4.5 "faltam 4" INVALIDADA):** map local (22 UUIDs) × PROD (18 UUIDs):

| Conjunto | Qtde | Detalhe |
|---|---|---|
| UUIDs exatos no tenant | **11** | depilação · corte+progressiva · botox · alisante · hidratação · limpeza · corte+alisante · barba · corte simples · corte+barba · corte+sobrancelha |
| UUIDs do **catálogo global** (`tenant_id=NULL`) | **8** | Barba Premium · Barba Terapia · Corte+Barba(global) · Corte Degradê · Corte Social · Platinado · Sobrancelha · Tintura/Pigmentação |
| UUIDs **corrompidos no map** (typos 1–2 dígitos) | **4** | `2fe802e7→2fe803e7` · `50ffdcc6→50ffdc6b` · `…dc599**cd**→…ed…` · `…**4ef7**→…47ef` |
| Services do tenant **fora do map** | **4** | CORTE + HIDRATAÇÃO · CORTE + SOMBRANCELHA (2º) · Penteado · PIGMENTAÇÃO |

- **I:** os 22 do map = **14 reais-do-tenant + 8 globais**. "Criar 4 → 22" é aritmeticamente inviável (18+8=26; exatamente 22 exigiria deletar serviços = destrutivo). O critério `count=22` de §10 **precisa de redefinição pelo PO (Q3)**.

**E (autoridade do catálogo do Site — baseline §4.7b confirmada):**
- Bundle PROD vivo `index-DEGutXL9.js`: contém `Camuflagem`/`Ritual do Chefe`; **não** contém `Experiência do Chefe`/`Luzes Sanchez`. ~~deploy = `origin/main` @ `6228e6c`~~ → **corrigido pela forense §4.19 (2026-09-29): deploy = `e7e50e9`** (o `compare 6228e6c…e7e50e9` não toca `scheduling/data.ts`, então os labels são idênticos nos dois commits — a conclusão de labels desta seção permanece válida; a atribuição de commit estava errada).
- `git show 6228e6c:src/components/scheduling/data.ts` **confirma os 8 labels da §4.7b** e os 3 barbeiros — o runtime vivo usa exatamente os labels documentados (revalidado contra `e7e50e9` em §4.19: `:6,14,22,30,37,44,51,58` + `:68,73,78`). ✅
- *Informativo, fora de escopo A3:* repo local do Site está **ahead 9** de um `origin/main` cujo remote sumiu (`Repository not found`); rebranding novo não deployado. Nenhuma ação.

**Proposta de mapa 11 chaves submetida ao PO (label → UUID):** 8 serviços — Corte Sanchez→CORTE SIMPLES `91b9f1f2…` (🟡) · Barba de Respeito→BARBA `81532669…` (🟢) · Ritual do Chefe→CORTE + BARBA `b8b4f34e…` (🟢, rebrand interno "Corte + barba") · Camuflagem Executiva→PIGMENTAÇÃO `e2c29bc8…` (🟡) · **Acabamento de Sobrancelha 🔴 sem correspondente no tenant** (opções: (a) global `Sobrancelha` `ccb3e709…` com `tenant_id=NULL` · (b) `CORTE + SOMBRANCELHA` `d8f82054…`/`b4284498…` · (c) criar no tenant) · Hidratação→HIDRATAÇÃO `521cd2ba…` (🟢) · Botox Capilar→BOTOX `321e5843…` (🟢) · Limpeza de Pele→LIMPEZA DE PELE `6b92dc32…` (🟢) — + barbeiros: Rubens `0b0d5fd1…` (🟢) · Heron `62ddf002…` (🟢) · **Primeiro disponível 🟡** = candidato chave `any` = `0b0d5fd1…`.

**E (pré-condições do intake — RPC `create_site_sanchez_appointment`, migration `20260426000001` já aplicada no A2-Prod):**
- Lookup de serviço: `FROM public.services s WHERE s.id = $1 AND s.tenant_id = $2 AND active = true` → senão `RAISE 'Servico invalido para a Sanchez Barber'` → **opção (a) do Q1 RULED OUT**: serviço do catálogo global (`tenant_id=NULL`) **nunca resolve** no intake. Restam (b) ou (c).
- Lookup de profissional: `st.tenant_id = p_tenant_id AND status='active'` → **RUBENS `0b0d5fd1…` active ✓ · HERON `62ddf002…` active ✓** → candidato do Q2 (`Primeiro disponível` = Rubens) **viável**.
- Re-consulta read-only (irmaos r1/r2): **18/18 services do tenant `active=true`** (todos os candidatos da tabela viáveis); staff = 5 `active` (inclui smoke "P2.1 Smoke Test") / 2 `inactive` (Conta Homologacao · Lucas Gonçalves).
- *Nota:* 2 quase-duplicados no tenant: `d8f82054` = `"CORTE +  SOMBRANCELHA"` (espaço duplo, **no** map) e `b4284498` = `"CORTE + SOMBRANCELHA"` (fora do map).

**STOP intermediário emitido — Q1–Q3 pendentes do PO (hoje absorvidas pelo novo plano #16; resposta PO = decisão #17):**
1. **Q1:** aprovar tabela 8 labels → UUID? **Acabamento de Sobrancelha:** ~~(a) global~~ **RULED OUT** (validação acima), restam **(b)** `CORTE + SOMBRANCELHA` existente (`d8f82054…`/`b4284498…`) ou **(c)** criar no tenant? Confirmar Corte Sanchez→CORTE SIMPLES e Camuflagem Executiva→PIGMENTAÇÃO?
2. **Q2:** `Primeiro disponível` = `0b0d5fd1…` (Rubens) — confirmar ou outro destino?
3. **Q3:** meta de quantidade — **(A)** nenhum create, só montar os 2 maps (count fica 18; redigir critério) · **(B)** criar só o que falta para as 8 chaves (Sobrancelha via (c) → 19) · **(C)** atribuir os 8 globais ao tenant (→ 26) · **(D)** outra meta.

**I:** **A3 read-only PASS; criação de services e montagem final dos maps BLOQUEADAS** até Q1–Q3. Nenhuma escrita; backup capturado. A4/A5 🔒.

### 4.18 A3-DIAG-2 — Identidade do tenant Sanchez: Portal ↔ SMG (read-only) · STOP (2026-09-29)

**Escopo (PO #16):** inventário read-only da identidade do tenant nos dois lados · nome canônico + slug · verificação de mesmo `tenant_id` · impacto nos maps/RPC. **Zero escritas.**

**E (estado canônico no PROD — `public.tenants`):**
- Colunas de identidade: `id uuid` · `name text NOT NULL` · `slug text NOT NULL` · `app_slug text` · `plan` · `status` · `settings jsonb`.
- Row: `id = b716e290-f7f6-4449-b790-5ae9dcdadcab` · **`name = "Barbearia Principal"`** · **`slug = "sanchez"`** · `app_slug = barber` · `plan = pro` · `status = active` · `settings = {}`.

**E (Portal ↔ SMG falam do MESMO UUID — verificado nos dois lados):**
| Lado | Mecanismo | Valor |
|---|---|---|
| SMG Edge Function | secret `SANCHEZ_TENANT_ID` (A1, §4.12) | `b716e290-…` ✓ |
| Site/Vercel (sync.js deps, G8/G9 §4.11) | env | `b716e290-…` (len 36) ✓ |
| Site `api/public/sanchez/{appointments,availability}.ts` | `process.env.SANCHEZ_TENANT_ID` → `.eq('tenant_id', …)` | UUID ✓ |
| SMG RPC `create_site_sanchez_appointment` | parâmetro `p_tenant_id` + filtro (§4.17) | UUID ✓ |
| `api/smg/sync.js` | só `SUPABASE_URL`/`SERVICE_ROLE`/`SMG_API_*` — **sem** identidade de tenant | n/a |
- **I:** **nenhum lado usa "Sanchez" como chave de identidade** — a chave é UUID em todas as pontas (regra do PO satisfeita no plano de dados).

**E (inventário "Sanchez" — chave técnica × identidade legível):**
- **Identificadores técnicos com "Sanchez" embutido (violação literal da regra, legado):** nome da RPC `create_site_sanchez_appointment` · valor de enum `source = 'site_sanchez'` (CHECK + dados) · nome da ET `site-sanchez-appointments` · nomes de env `SANCHEZ_*` + header `x-sanchez-signature` · enum de tema `'sanchez'` (CHECK kiosk/portal) · namespace de rotas `api/public/sanchez/*`.
- **Identidade legível (permitida):** mensagens da RPC (`'Tenant Sanchez nao configurado'` · `'…para a Sanchez Barber'`) · copy de UI (`isSanchez`/theme) · comentários E2E.
- **UUID duplicado como literal (chave correta, mas hardcodada):** `b716e290` em ~20 scripts `h7-*`/ops + 3 specs E2E (`PRINCIPAL_TENANT_ID`).
- **⚠ copy compartilhada:** `src/lib/utils/phone.ts:24` embute "Aqui é da Sanchez Barber" em util **global** — risco de mensagem errada em outros tenants (backlog, não bloqueia A3).

**E (impacto de rename do `name` DB):** grep "Barbearia Principal" em código = **apenas 2 comentários de teste E2E** → rename é barato.

**Propostas submetidas ao PO (decisão #17):**
- **Q4 — nome canônico:** `name` DB hoje = "Barbearia Principal"; UI/código/erros dizem "Sanchez"/"Sanchez Barber"; `slug = "sanchez"` já canônico. Opções: **(i)** `name = "Sanchez"` (exemplo do PO) · **(ii)** `name = "Sanchez Barber"` (bate com UI/copy atual) · manter slug `sanchez`.
- **Q5 — renomear identificadores técnicos legados (RPC/enum `site_sanchez`/ET/envs)?** **Recomendação: NÃO no A3** — renomear RPC/enum/ET quebra deploy, dados históricos (`source`) e exige ADR/backlog de padronização multi-cliente. Registrar como pendência futura.
- **Q6 — `phone.ts` copy global:** mover para config por tenant (backlog, não bloqueante).

**I:** **A3-DIAG-2 PASS** (4/4: estado canônico · mesmo UUID nos dois lados · inventário · impacto). Zero escritas. Plano novo: **A3-IMPLEMENT só após #17** (que absorve Q1–Q3 ainda abertos: Sobrancelha (b)/(c) · `Primeiro disponível` · meta de quantidade). A4/A5 🔒.

### 4.19 Forense read-only — quem consome os maps / onde label→UUID acontece / endpoint alvo (2026-09-29)

**Escopo:** rastrear, no fluxo PROD **realmente deployado**, quem lê `SMG_SERVICE_ID_MAP`/`SMG_PROFESSIONAL_ID_MAP`, onde `label pt-BR → UUID` é resolvido, para onde `SMG_API_BASE_URL` aponta e se o Site usa o mesmo Supabase do SMG. **Zero escritas** (GitHub Contents/Deployments API, `gh api`, `vercel env pull` read-only, probe do bundle via `curl`, leitura de arquivo do clone).

**E (qual commit está no ar):**
- Repo remoto `sanchez-barber` **`main` = `e7e50e9`** — PR #1 `feat/dec-001-site-sanchez-contrato` (head `4fd6b45`), merged **2026-09-28T03:08:03Z**. Production deployment id `6701570628` · status **success** `2026-09-28T03:08:33Z` (`sanchez-barber-h71ag2lh6…`) e **redeploy success** `2026-09-28T18:02:29Z` (`sanchez-barber-8o7sye15j…` = pós-fix G8/G9 §4.11). Ref `6228e6c` = Production de 2026-05-30 (histórico).
- **Bundle live `index-DEGutXL9.js` (630.965 bytes) = build de `e7e50e9`**: contém strings **exclusivas** do `smgClient` daquele commit (`smg_error` · `"SMG retornou falha na sincronizacao"` · `"[smgClient] SMG returned ok:false"`) — ausentes em `6228e6c`. Também `action:"create"` ×1 · `action:"cancel"` ×1 · `api/smg/sync` ×1 · labels legacy (`Corte Sanchez` ×1 · `Barba de Respeito` ×1 · `Acabamento de Sobrancelha` ×1 · `Primeiro dispon` ×2). **Não contém** (`=0`, correto por ser server-side/não-deployado): `site-sanchez-appointments` · `SMG_SERVICE_ID_MAP` · `Unmapped service slug` · `api/public/sanchez`.
- Clone local = **ahead 9** de `origin/main` (push nunca ocorreu; `git fetch` falha `Repository not found` — credencial quebrada; `gh api` funciona). Inclui `api/public/sanchez/{appointments,availability}.ts` que **não existe no remoto** (contents → 404 em `e7e50e9`) — caminho paralelo **não-deployado**, irrelevante para DEC-001-A. `compare 6228e6c…e7e50e9` = só 6 arquivos (`.env.example`, `README.md`, `api/smg/sync.js`, `src/lib/integrations/smg.ts`, `smgClient.ts`, `src/test/smgIntegration.test.ts`).

**E (quem consome os maps — consumidor único, server-side):** `api/smg/sync.js @e7e50e9` (**524 linhas**), Vercel serverless (funções não entram no bundle):
| O quê | Linha |
|---|---|
| `JSON.parse(process.env.SMG_SERVICE_ID_MAP ?? '{}')` | **:13** (idem profissional **:19**) |
| `getBearerToken()` → `Bearer ${SMG_WEBHOOK_SECRET}` | :48–52 |
| `getSmgAppointmentsUrl()` → `` `${base}site-sanchez-appointments` `` | :54–57 (**:56**) |
| `getSmgAuthHeader()` — `Bearer` webhook secret; fallback **deprecado** `SMG_API_TOKEN` | :59–68 (:61 · :64–65) |
| `buildCanonicalSmgPayload()` | **:153** |
| lookup `serviceIdMap[row.service]` / `professionalIdMap[row.barber]` | **:157 / :158** |
| throw `Unmapped service slug…` / `Unmapped professional slug…` | **:161 / :164** (call sites :193/:338/:419) |
| `handleCreate()` → lê `req.body.service/barber` | :228–232 |
| catch `mapError` → status `cancelled` + `sync_status='failed'` → 500 `configuration` | :340–351 |
| gate `Missing server configuration` (só warn se map vazio) | **:469–470** (warns :474/:477) |
| auth do request / dispatch / `Unsupported sync action` | :484–497 / :515–519 / :523 |
- Chave do lookup = **`row.service`/`row.barber` = label pt-BR exata** (insert grava o label recebido; **sem normalização além de `trim`**). **`SMG_SERVICE_ID_MAP`/`SMG_PROFESSIONAL_ID_MAP` nunca aparecem no bundle (=0)** — credencial fica server-side (esperado).
- **`sync.js @6228e6c` (370 linhas) = SEM maps**: alvo `new URL('appointments', base)` (:39), auth `Bearer ${smgApiToken}` (:55), gate (:323), unsupported (:369). Ou seja: **consumo de maps + alvo `site-sanchez-appointments` entram só com o PR #1 (`e7e50e9`)**.

**E (cadeia deployada que faz label→UUID):**
`SchedulingFlow.tsx @e7e50e9:95/:97` (`serviceId` = slug hífen · `service` = label de `scheduling/data.ts` **:6,14,22,30,37,44,51,58** = 8 serviços + profissionais **:68,73,78** = 3 → **11 labels**) → `appointmentsStorage.ts @e7e50e9:297` (`action:'create'` com `service`/`serviceId`/`barber`/`barberId`; cancel :340) → `smgClient.ts @e7e50e9:55` `fetch('/api/smg/sync')` → `sync.js` `handleCreate` :228 → INSERT (`service` = label, `service_id` = slug) → **`serviceIdMap[label]` :157** (miss → :161 → catch :340 → 500) → ET. `AppointmentPortal`/`appointmentRequest.ts` @e7e50e9 = **só WhatsApp** (`wa.me`, sem fetch) — **não** entra nessa cadeia.

**E (endpoint alvo + mesmo Supabase — `vercel env pull --environment=production`):**
- `SMG_API_BASE_URL="https://ushsnmlbeurfvlkieiln.supabase.co/functions/v1"` → alvo efetivo **`…/functions/v1/site-sanchez-appointments`** = ET do A1 (§4.12).
- `SMG_WEBHOOK_SECRET` = hex64 preenchido ✓ (valor não reproduzido — §4.8) · `SMG_API_TOKEN=""` · **`SMG_SERVICE_ID_MAP=""` · `SMG_PROFESSIONAL_ID_MAP=""`** (maps vazios → A4 necessário).
- **`SUPABASE_URL="https://ushsnmlbeurfvlkieiln.supabase.co"` + `SUPABASE_SERVICE_ROLE_KEY` (len 221) + `VITE_SUPABASE_URL=ush…`** → **SIM: o Site usa o MESMO projeto Supabase do SMG** (`ush…`); `sync.js` grava `appointments` nesse projeto via service_role.

**I:**
- **label→UUID acontece só em `api/smg/sync.js :157/:158`** (server-side); o plano A3/A4 (montar 2 maps com **11 chaves label-keyed** e setar no Vercel) ataca exatamente o ponto certo — **nenhum código precisa mudar**.
- **`§4.7c` CONFIRMADO contra o código deployado** (citações `:13/:157/:469` batem exatos em `e7e50e9`); a refutação anterior decorria do clone local desatualizado (370 linhas, sem maps).
- 3 teses refutadas nesta rodada: "bundle = `6228e6c`" ❌ · "bundle contém `api/public/sanchez` ×2" ❌ (=0) · "citações §4.7c PROVADAS FALSAS" ❌.
- **maps PROD vazios → integração segue inerte**: gate :469 passa (só warn :474/:477), mas todo `create` real cai em :161/:164 → 500 `configuration`. **A4 continua necessário.**

**G:** nenhum bloqueador novo para #17. Clone local **não** é fonte de verdade de `sync.js` (usar `gh api`/`e7e50e9`).

### 4.20 A3-IMPLEMENT — identidade + Sobrancelha + 2 maps label-keyed + validação (PO #17 · 2026-09-29)

**Escopo (PO #17, sequência 1–7):** 1) padronizar identidade legível (`Sanchez`) · 2) criar `Sobrancelha` no tenant · 3) montar os 2 maps de 11 chaves · 4) validar UUIDs vs `tenant_id` · 5) validar serviços ativos · 6) validar Rubens · 7) validar RPC/intake → **STOP/GATE A3**. **Não autorizado:** setar maps no Vercel (A4) · A5 · push · PR · merge · deploy · reescrever lógica telefônica · renomear registros de negócio (serviços/profissionais). Artefatos (evidência) em `%TEMP%\opencode\` (`a3_rename.ps1` · `a3_insert_sobrancelha.ps1` · `a3_maps_service.json` · `a3_maps_professional.json` · `a3_validate.ps1`); o conteúdo relevante está reproduzido aqui (§4.20 é o registro durável).

**E (execução — somente escritas autorizadas):**

- **A3-1 — escopo fechado (read-only):** `normalizeText` (`sync_e7.js:31-33`) = **`.trim()` apenas**; lookup `serviceIdMap[row.service]`/`professionalIdMap[row.barber]` (`:157-158`) = **igualdade byte-a-byte** da label → keys UTF-8 exatas obrigatórias. Varredura de marca "Sanchez"/"Barbearia Principal": único copy em código de produto não-teste = `src/lib/utils/phone.ts:24`; demais = comentários/fixtures E2E (**intocados**). Nenhum teste afetado (só comentários).
- **A3-2 — identidade (Q4/Q5/Q6):**

| Ação | Alvo | Evidência |
|---|---|---|
| `UPDATE tenants SET name='Sanchez'` (Management API `database/query`) | PROD `ush…`, id `b716e290-…` | before `name="Barbearia Principal"` → after `name="Sanchez"`; `slug="sanchez"` + `status="active"` inalterados |
| copy | `src/lib/utils/phone.ts:24` | "Aqui é da Sanchez." |
| copy | `components/KioskAddonModal.tsx:86` | "identidade premium da Sanchez." |
| copy | `pages/kiosk/KioskClientPage.tsx:85` | fallback `'Sanchez'` |
| copy | `pages/kiosk/components/KioskShopFeedback.tsx:102` | "Quanto indicaria a Sanchez, Chefe?" |

- Nenhum registro de negócio renomeado (serviços/profissionais intocados — Q5); lógica telefônica não reescrita (só string literal — Q6).
- **A3-3 — serviço `Sobrancelha` (Q1-C):** INSERT em `public.services` → id **`a2f28824-f741-48df-92b9-858f3e1c3266`** · name `Sobrancelha` · category `Acabamento` · price `15.00` · duration `15` · `active=true` · `tenant_id=b716e290-…`; contagem do tenant **18 → 19**. Não-global; `CORTE + SOMBRANCELHA` não usada (Q1-R).
- **A3-4 — os 2 maps (11 chaves label-keyed; evidência `a3_maps_service.json` + `a3_maps_professional.json`, UTF-8):**

`SMG_SERVICE_ID_MAP` (8):

```json
{
  "Corte Sanchez": "91b9f1f2-76b7-4ac5-be9a-6e675a395b90",
  "Barba de Respeito": "81532669-c8a9-4908-bae9-14918ab1d2d3",
  "Ritual do Chefe": "b8b4f34e-064c-4f0d-bb73-77d40d46b9c4",
  "Camuflagem Executiva": "e2c29bc8-da13-436a-8c4d-fd4cfeedb157",
  "Acabamento de Sobrancelha": "a2f28824-f741-48df-92b9-858f3e1c3266",
  "Hidratação": "521cd2ba-4ce4-47d8-ba5f-37eb74100ab9",
  "Botox Capilar": "321e5843-bd40-4416-9eb3-4623281eb533",
  "Limpeza de Pele": "6b92dc32-20fc-4a5a-8c93-3acb9f092b29"
}
```

`SMG_PROFESSIONAL_ID_MAP` (3):

```json
{
  "Primeiro disponível": "0b0d5fd1-818e-418d-a40d-378d772a787b",
  "Rubens Sanchez": "0b0d5fd1-818e-418d-a40d-378d772a787b",
  "Heron Ferreira": "62ddf002-5c05-49fa-8ff3-6d67fa82c562"
}
```

- Keys = labels pt-BR **byte-exatas** de `data_e7.ts @e7e50e9` (11 labels = 8 serviços + 3 profissionais); valores = UUIDs do tenant. **Somente evidência — NÃO setados no Vercel (A4 🔒); `.env.local` não alterado.**
- **A3-5 — validação (7/7 PASS, `a3_validate.ps1`; SQL gerado a partir dos próprios JSONs):**

| # | Check | Resultado |
|---|---|---|
| a | cobertura de chaves: labels do site × map keys | `site_labels=11 map_keys=11` · `only_in_site=[]` · `only_in_map=[]` |
| b | 11 keys → UUID existente no tenant + ativo (predicados da RPC intake: `id+tenant_id`, `lower(coalesce(status,'active'))='active'`) | **11/11 `pass=true`** (8 serviços `active` + 3 profissionais ativos; todos `tenant_id=b716e290-…`) |
| c | resumo | `total=11` · **`failures=0`** |
| d | identidade pós-rename | `name="Sanchez"` · `slug="sanchez"` · `status=active` |
| e | RPC intake existe | `create_site_sanchez_appointment` (11 args, conforme `20260426000001`) |
| f | grant | `service_role_can_execute=true` |
| g | contagens | `services_total=19` · `services_active=19` · `staff_active=5` |

- Map key (label do Site) ≠ name no DB (`Corte Sanchez`→`CORTE SIMPLES` · `Acabamento de Sobrancelha`→`Sobrancelha` · `Camuflagem Executiva`→`PIGMENTAÇÃO` …) — **por design**: o runtime resolve por UUID via map (§4.19).

**I:**
- A3-1..A3-5 executados exatamente na ordem do PO; **zero divergência** de schema/config/quantidade/mapeamento → nenhum STOP disparado dentro da sequência (guardrail §4.17/§4.18 não atingido: `tenant_id` idêntico nos dois lados).
- Meta `count=22` **não** perseguida (Q3-B: requisito = 18→19).
- Integração **segue inerte**: maps ainda `""` no Vercel → todo `create` real cairia em `sync.js:161/:164` (500 `configuration`) — **A4 continua necessário** (🔒).

**A3-7 — gates locais (2026-09-29; evidência em `%TEMP%\opencode\a3_7_*.txt`):**
- `npm run build` → **exit 0** (`✓ built in 13.70s`).
- `npm run test` → **exit 0** · **76/76 test files · 1565 passed · 5 skipped (1570)**.
- `git diff --check` → **exit 0**.
- `npm run typecheck` → **exit 2**: 4× TS8016 **todos** em `scripts/h7-p1-comanda-audit-probe.mjs:11–13` (`as any` em `.mjs`) — arquivo **untracked** (`git ls-files` vazio), `LastWriteTime 2026-09-23`, **não aparece em `git diff`** (pré-existente, fora do diff do A3); `tsconfig.json` (`allowJs: true`, `exclude` só `supabase`/`examples`/`tests`) o inclui. **0 erros no diff do A3** (4 copy files). Não corrigido por conta própria — decisão do PO.
- `git status` (evidência `a3_7_git_evidence.txt`): modificados = 2 DEC001 + 4 copy files (escopo A3-2) + `AGENTS.md` · `docs/adr/README.md` · `supabase/migrations/20260905000000_…` (pré-modificados, **fora do escopo A3**).

**G:** nenhum bloqueador do A3. Pendências p/ PO: (1) **autorização de commit** (escopo proposto: 2 DEC001 + 4 copy files; excluídos `AGENTS.md`, `docs/adr/README.md`, `20260905000000_…`) · (2) **tratamento do typecheck pré-existente** (script untracked) · (3) A4 🔒 · A5 🔒.

**Próximo:** **STOP/GATE A3** entregue → decisão do PO (commit) → A4/A5 sob gates próprios 🔒.

### 4.21 Gate A3 — confirmação Q1-R do `name` (STOP do PO #18 · 2026-09-29)

**Escopo (PO):** somente confirmar o `name` efetivamente gravado para o UUID `a2f28824-f741-48df-92b9-858f3e1c3266` (read-only). Nenhuma escrita. Evidências: `smg_a3r_q1r_by_id.json` · `smg_a3r_q1r_name_scan.json` (`%TEMP%\opencode\`).

**E:**
- Tentativa inicial com coluna `slug` → erro **42703** `column "slug" does not exist` (coluna inexistente em `services`; erro de query read-only, corrigida em seguida — nenhuma escrita).
- Query corrigida `SELECT id, name, category, price, duration, active, tenant_id … WHERE id='a2f28824-…'`:

```json
[{"id":"a2f28824-f741-48df-92b9-858f3e1c3266","name":"Sobrancelha","category":"Acabamento","price":"15.00","duration":15,"active":true,"tenant_id":"b716e290-f7f6-4449-b790-5ae9dcdadcab"}]
```

- Scan do tenant por `%acabamento%`/`%sobrancelha%` no **name**: retorno **1 única linha** (o serviço `Sobrancelha`) → **nenhum serviço com `name`="Acabamento"** existe.

**I:** **caso #1 confirmado** — `name = "Sobrancelha"` (exatamente o exigido na decisão #17 Q1-C); `Acabamento` = **`category`** (campo à parte, valor previsto em Q1-C). A ambiguidade originou-se do atalho textual da minha tabela no STOP/GATE ("(`Acabamento`, R$15.00, 15min…" = parêntese com a categoria); o §4.20 é explícito ("name `Sobrancelha` · category `Acabamento`") e o A3-5 já registrava `db_name="Sobrancelha"`. **Divergência Q1-R inexistente** → correção nominal não necessária (e não autorizada).

**G:** nenhuma. Fato devolvido ao PO → aguardando **GO de commit** (escopo: 2 DEC001 + 4 copy files).

### 4.22 A4-VALIDATE parcial read-only (2026-09-30)

**Contexto:** PO executou as 4 escritas (2 maps × PROD/PREVIEW) + autorizou redeploy (aguardando Ready). Proibições: sem alterar vars/token/banco/código/push/PR/merge/deploy; sem "corrigir" em FAIL (só PASS/FAIL + causa + evidência).

**E (somente leitura):**
- Site vivo: `GET /` → 200 (edge HIT); `x-vercel-id: gru1::vxhb2-…` = request-id (não identifica deployment).
- Sync gate: `POST /api/smg/sync {}` → **HTTP 400** `{"error":"Unsupported sync action"}` em 0.4s (= G8; sem regressão 500).
- Bundle: `assets/index-DEGutXL9.js` **inalterado** (esperado — só env server-side mudou); `ush=1`, `rvpmaq=0`.
- DB escopo = baseline A3-5: services **19/19** · tenant **`Sanchez`** · staff ativos **5**.
- appointments: total 2063 · 12 desde 2026-09-29 **todas `external_source NULL`** (movimento normal do app; **zero linhas site-originadas** → integração não disparou nada até aqui).
- git: só os 5 modificados conhecidos (3 fora-escopo + 2 DEC001 #19/#20).

**I (vereditos por item do PO):**
1. Deployment Production → **INCONCLUSIVO daqui** (identidade do deployment novo indeterminável: x-vercel-id é por-request, bundle não muda, API/CLI bloqueados; depende do executor).
2. Incorporação das vars → **NÃO VERIFICÁVEL daqui** (sem leitura Vercel; depende de evidência do executor).
3. Fluxo → **PARCIAL**: gate 400 vivo sem regressão; prova fim-a-fim exigiria escrita (não autorizada).
4. Mapas = A3 → **CADEIA DE CUSTÓDIA**: runbook MATCH 11/11 + paste-exact (a confirmar pelo executor).
5. 11 mapeamentos runtime → **NÃO VERIFICÁVEL sem escrita** (fake-service dá 500 idêntico com mapa vazio ou populado — provado §4.19).
6. Supabase ush → **PASS**.
7. Sem alteração banco/código → **PASS**.
8. Docs → este §4.22.

**G:** pendente confirmação do executor (Ready + presença das vars + redeploy ocorrido?) — sem ela, A4-1..A4-4 ficam EXTERNOS.

**Próximo:** STOP interim → PO.

### 4.23 Gate de evidência A4 — leitura Vercel via API (2026-09-30)

**Contexto:** gate só-evidência do PO (8 itens); read-only; sem inferir deployment de HTTP/`x-vercel-id`; sem expor segredos (só metadados: nomes/targets/timestamps/ids; valores jamais lidos/impressos; corpos de resposta apagados após parse). Rede: `VERCEL_TOKEN` (len 60, valor nunca exposto) + `api.vercel.com` HTTP 200 (bloqueio anterior levantado); CLI segue sem auth (irrelevante — API usada).

**E:**
- Projetos (14 listados): `sanchez-barber` = `prj_Ii5Voiuzo0bMdyexlffbPCovq3HF` (demais: smg-*, sou-manager, etc. — fora de escopo).
- Envs (20 entradas, só metadados): 5 `SMG_*` presentes — `SMG_API_BASE_URL` + `SMG_WEBHOOK_SECRET` (PROD+PREVIEW, timestamps era G8, intactos) · `SMG_API_TOKEN` ([preview,production], updatedAt mai/2026 = **intocado** ✓ NÃO GO) · `SMG_SERVICE_ID_MAP` ([production,preview], id `eR5…QuD`, updatedAt 1790807718448 = **2026-09-30 22:35:18 UTC**) · `SMG_PROFESSIONAL_ID_MAP` ([production,preview], id `Ljf…ucd`, updatedAt 1790807767769 = **2026-09-30 22:36:07 UTC**). Demais vars intactas (nomes: `VITE_*`, `SUPABASE_*`, `SANCHEZ_TENANT_ID`, `VITE_ADMIN_EMAILS`).
- Deployments (top-10): último PROD = `dpl_oWmatdZp5LeMWstmyAweATummkk1` (`sanchez-barber-8o7sye15j`), **READY**, created **2026-09-28 18:01:52Z** (= redeploy G8); anterior `dpl_GyhURnBuJfbwRh72fM9buyDHDGLw` (28/09 03:08Z). **Nenhum deployment posterior às vars.**
- Conteúdo dos maps: `GET .../env/{id}` trava (2 tentativas, kills 90/120s; listagens voam) — leitura de valor inviável; **cadeia de custódia**: runbook MATCH 11/11 (§4.20) + timestamps frescos + confirmação do executor.
- Edge re-provado: `/` 200 · Etag idêntico ao §4.22 · sync **HTTP 400** · asset `index-DEGutXL9.js` · clone do site ausente em disco (só `sou-manager`).

**I (tabela do gate):**
| Projeto Vercel | **PASS** | `sanchez-barber`/`prj_Ii5…` via API (14 projetos) |
| Deployment PROD | **PASS (identificado)** | `dpl_oWma…` (`8o7sye15j`), target=production |
| Status Ready | **PASS (mas STALE)** | state=READY — porém anterior às vars (ver item 6) |
| SMG_* Production | **PASS (presença)** | 5/5 presentes; maps updated 30/09 22:35–22:36Z; valores nunca lidos |
| SMG_* Preview | **PASS (presença)** | mesmos 5 com target preview; maps cobrem [production,preview] |
| Redeploy após vars | **FAIL (ação requerida)** | último PROD (28/09 18:01Z) < vars (30/09 22:35Z) → runtime **NÃO** incorpora maps; redeploy **NECESSÁRIO, não executado (subgate)** |
| Domínio | **PASS** | 200 + gate 400 vivos |

**Limitações:** sem leitura de valores (por regra) → conteúdo via cadeia de custódia; single-env GET trava; sem auth CLI (irrelevante).
**Divergências:** nenhuma nos dados (executor aplicou 4 escritas 22:35–22:36Z; nenhum deploy posterior).
**Certificabilidade:** A4 **NÃO certificável** sem redeploy — runtime atual ainda tem maps vazios (integração segue inerte).
**Desbloqueio:** subgate PO autorizando redeploy → após Ready, revalidar (edge + gate passam a vigorar os maps).

**G:** nada mais verificável daqui. **Próximo:** STOP → PO (subgate redeploy).

### 4.24 A5 preflight — formas, blast radius, achado $14 e plano smoke (read-only, 2026-09-30)

**Escopo (PO):** somente preflight/gate do A5. Nenhuma execução, nenhuma escrita, nenhum dado tocado.

**E — formas exatas (`api/smg/sync.js` @e7e50e9 524l; `contract.ts` 285l; `smgIntegration.test.ts` 384l):**
- Create: POST `{action:'create', service, serviceId, barber, barberId, customerName, customerPhone, appointmentAt}`; `service`/`barber` = **LABELS byte-exatos** (lookup `serviceIdMap[row.service]`/`:157-158`, trim-only :31-33); guest sem Bearer OK se email ou phone; `handleCreate` insere row no Site (source_system local) → ET → RPC.
- Cancel: POST `{action:'cancel', appointmentId}` (id da row do Site) + **mesmo user_email** + status active; ET cancel → RPC UPDATE; `not_found:true` com 200 = checar body, não só status.
- ET: Bearer==webhookSecret ou HMAC; phone 10-13 dígitos (active); scheduled_at futuro (active); UUIDs; `site_appointment_id` obrigatório; 201 active / 200 cancelled|rescheduled / 409 conflict / 400 / 401; `SANCHEZ_DOMAIN_SCHEMA` ∈ {public,barber} mas RPC rejeita ≠public → efetivo `public` (valor da env não verificável daqui).
- Retry sync 12s ×3 + backoff; falha SMG não-conflict → site row `cancelled` + 502; conflict → 409. Cascade: demais active-rows do mesmo user_email viram `rescheduled` + sync → **phone/email único por execução é obrigatório**.
- Endpoint sem auth (observação p/ backlog segurança, fora do escopo).

**E — RPC (`20260426000001`, 356l, lida integral):** validações → advisory lock → client upsert por phone → overlap `23P01` → INSERT (`confirmed`/`site_sanchez`/`site`) → cancel = UPDATE com `not_found` se já finalizado. Grants: só `service_role`.

**E — ACHADO $14 (bloqueante p/ A5):** INSERT lista `$1..$14` (l.294-316) mas `USING` tem 13 itens (l.320-333); **`$14` sem parâmetro → ERROR em todo create**; além disso `$13` receberia notes no lugar de `external_id` (`v_site_appointment_id` nunca entra no USING). A2-Prod só rodou testes negativos (abortam antes do INSERT) → caminho positivo nunca validado. Drift PROD×repo não confirmado via API (egress travou 4×: 180s+120s×2+90s); ledger registra o arquivo do repo como applied (A2-W1-RECON) e fix manual era proibido → alta confiança de que o bug está em PROD. Correção exige **nova migration + autorização** (NÃO aplicada aqui). Fix proposto (p/ autorização): `$13=v_site_appointment_id`, `$14=notes`.

**E — blast radius (explore bg_baf585ad + leitura direta):** CONFIRMADO escreve: site appointments row · SMG `clients` row (se phone novo) · SMG `appointments` row · `audit_logs` (INSERT + UPDATE, `changed_by` NULL) · `tenants.first_appointment_at` (só se NULL — Sanchez já tem). INERTE: domain events (RPC bypassa lifecycle) · outbox/event_store · commission/finance · comandas · realtime em appointments (inexistente) · WhatsApp/SMS (sem sender). POSSÍVEL: `proximo_cliente`/`cliente_atrasado` se slot ≤60min ou sweep tardio (sweep 5min front + ET notification-sweep); `detect_no_show` se algo invocar (não agendado — mina). `production-smoke.mjs` usa tenant efêmero — **INAPLICÁVEL** (maps fixos no tenant real); teardown deve ser cirúrgico por marcadores, nunca wipe.

**E — armadilhas:** unique index exige `site_appointment_id` novo por run · slot livre + >60min à frente · phone único por run · cancel matcher (mesmo user_email) · endpoint público · onboarding flip (só se first NULL).

**I:** A5 NÃO PODE PASSAR sem a corretiva da RPC. Smoke proposto (pós-fix): ~10 creates (8 services + Heron + Primeiro-disponível) + cancels; asserts de presença (rows + audit) + asserts de ausência (outbox/event_store/commission/transactions/comandas sem delta; notifications silenciosas); teardown cirúrgico (`SMOKE A5 *`, phone único, site_appointment_id único).

**G (pedidos de GO ao PO):** G1 — corretiva RPC (nova migration + revalidação); G2 — GO smoke (N creates + cancels + teardown); G3 — janela/horário; G4 — API-level (recomendado) vs UI-E2E.

**Próximo:** STOP/GATE A5-preflight → PO.

### 4.25 G1 — corretiva RPC $13/$14 + achado D2 (execução, 2026-09-30)

**Escopo (PO — GO G1):** só corretiva da RPC. Sequência `smg-change-control → smg-isolate → AUDIT READ-ONLY → smg-implement → smg-validate → STOP`. NÃO: G2/smoke, migration histórica, outras RPCs, lifecycle/eventos, outbox, notificações, financeiro, RLS, auth endpoint, push/PR/merge/deploy PROD, commit.

**E — AUDIT (proposta $13/$14 CONFIRMADA + achados):**
- INSERT lista `$1..$14` (20260426000001 l.294-316) vs `USING` com 13 itens (l.321-333) — **D1 CONFIRMADO mecanicamente**; `v_site_appointment_id` ausente; cancel `$1..$5` OK (`$4` extra é legal).
- Original 20260426000000 tinha **14/14 + check de idempotência** (l.266-286, retorna `idempotent:true`) — a **correção introduziu a regressão** (dropou `v_site_appointment_id` E o check de idempotência). Idempotência perdida = divergência comportamental REPORTADA, não incluída no fix (decisão separada).
- Grants/segurança idênticos (`service_role` só); `search_path`/INVOKER idênticos.

**E — IMPLEMENT:** `supabase/migrations/20260930000000_site_sanchez_appointments_fix_insert_params.sql` (arquivo NOVO, untracked; histórico intacto), gerado por script byte-fiel do 20260426000001: **DIFF +1 linha (`    v_site_appointment_id,`) / 0 modificações** (Compare-Object); newline preservado; anchor único verificado. Checkpoint: HEAD `f4a1c51`, sem reset/stash (adição pura).

**E — VALIDATE (harness docker `postgres:16` local, hermético, trust-auth, removido após; PG16 vs PROD PG15 irrelevante p/ binding/parênteses):**
- Setup (roles anon/authenticated/service_role + tabelas mínimas + pgcrypto) ✓ · migration integral aplicada ✓ (`BEGIN..COMMIT`, indexes, grants, `NOTIFY`, zero erros `ON_ERROR_STOP`).
- Positive create → **ERROR `syntax error at/near LIMIT` (D2, function l.179) — NOVO ACHADO**: falta 1 parêntese no overlap single-line (stack walk prova; original multilinha correto). D2 precede D1 (overlap roda antes do INSERT) → **G1-$14 sozinho NÃO destravaria creates**. Fix D2 = 1 parêntese (proposta p/ autorização — NÃO aplicado).
- Negatives PASS (`Servico invalido` l.140; `Telefone invalido` l.59 — guards intactos). Re-run SKIPPED (exige create OK).

**I:** D1 provado estaticamente (14 vs 13), mascarado em runtime até D2 sair. Harness cobriu função+constraints do arquivo; triggers/RLS de PROD fora do escopo do arquivo. Drift PROD×repo não confirmado via API (egress travou 4×); ledger + proibição de fix manual sustentam alta confiança.

**G (pedidos de GO ao PO):** (a) incluir fix D2 na migration G1 + revalidação completa; (b) idempotência perdida: restaurar check original? (decisão separada); (c) G2 smoke segue pendente.

**Riscos:** PG16 vs PROD (invariante de linguagem — desprezível); sem drift confirmado via API (ledger como base); teardown do container executado (`docker rm -f`, sem volumes).

**Evidências:** migration (repo, untracked) · `%TEMP%\opencode\a4_g1_gen_migration.ps1`, `g1_setup.sql`, `g1_test.sql`, `g1_neg.sql`, `g1_rerun.sql` (+ outputs em transcript).

**Confirmação:** nenhum G2/G3/G4 executado; nenhuma escrita fora do harness local descartável; PROD intocado; sem commit/push/PR/merge/deploy.

**Próximo:** STOP/GATE G1 → PO.

### 4.26 D2-FIX + revalidação (GO restrito PO, 2026-09-30)

**Escopo:** só parêntese overlap na migration G1 + revalidação. Proibido: resto (código, SMG_*, banco PROD, push/PR/merge/deploy, G2, idempotência).

**E — D2 antes/depois (migration `20260930000000…`, l.291):**
- ANTES: `...interval ''1 hour''), ''[)'') && ...` — flags dentro do `coalesce` (3 args) + `tstzrange` externo aberto → `ERROR syntax at/near LIMIT` (empírico, function l.179).
- DEPOIS: `...interval ''1 hour'')), ''[)'') && ...` — `coalesce` 2 args + flags como 3º arg do `tstzrange` (espelha original l.295-302). Aplicado via script posicional com asserts (1ª tentativa — só fechar T — deu type-error `timestamptz '[)'`; corrigida para MOVER o parêntese, net-zero verificado por contagem).
- `git diff --check` exit 0. Arquivo segue untracked; histórica intocada.

**E — revalidação (harness recriado, `postgres:16`, trust-auth, removido após):** setup + apply (`BEGIN..COMMIT`, zero erros) · **positive create PASS**: `external_id=a5pre-g1-001`, `notes=nota g1`, `status=confirmed` (D1+D2 OK) · cancel PASS (`cancelled`) · negatives PASS (`Servico invalido` l.140, `Telefone invalido` l.59) · **overlap PASS** (`Horario indisponivel`, l.187, com cleanup) · **re-run = unique violation** `idx_public_appointments_external_site` (idempotência NÃO corrigida, conforme instrução).

**I:** D1+D2 sanados no caminho positivo; runtime comporta-se como o original corrigido. Idempotência segue divergente (re-runs 500) — pendência separada já registrada. PG16 vs PROD irrelevante p/ binding/parênteses (regras invariantes); drift PROD×repo segue não confirmado via API (ledger como base).

**G:** nenhuma pendência técnica p/ G2 além do GO. **Recomendação objetiva:** autorizar **G2 smoke** (plano §4.24; ~10 creates + cancels + teardown cirúrgico) — pré-requisito técnico cumprido.

### 4.27 G2 Smoke — execução em harness descartável (GO PO, 2026-09-30)

**Escopo:** somente G2 (9 creates + 9 cancels + 2 negs + overlap + rerun-observação) em `postgres:16` local hermético, UUIDs reais A3 como constantes locais. Proibido: resto (PROD, commit/push/PR/merge/deploy, G3/G4, idempotência).

**E — execução (container recriado, trust-auth, removido após):** setup + apply migration D1+D2 (`BEGIN..COMMIT`, zero erros) · **9 creates PASS** (`ok:true`, `confirmed`, `site_sanchez`): 8 service-UUIDs (4 Rubens + 4 Heron) + cross-combo Sobrancelha/Rubens; slots +14d escalonados; phones únicos; 9 clients distintos · **9 cancels PASS** (todos `cancelled`; teardown lógico) · **negatives PASS** (`Servico invalido`, `Telefone invalido`) · **overlap PASS** (`Horario indisponivel` em B; cleanup com cancel A) · **re-run = unique violation** `idx_public_appointments_external_site` (idempotência NÃO corrigida, conforme instrução).
**Final:** 10/10 rows `cancelled` (9 smoke + 1 overlap); nenhuma escrita fora do harness (zero chamadas Supabase nesta rodada).

**I:** caminho positivo completo validado nos 8 UUIDs + ambos profissionais; guards/overlap/cancel íntegros; idempotência segue divergente (decisão separada).

**G:** nenhuma pendência técnica; **recomendação: certificação A5 cabe ao PO** (prova runtime completa no escopo autorizado).

### 4.28 Proposta de certificação A5 (revisão, 2026-09-30)

**Escopo (PO):** revisar G1/G2/G3 + commits e propor veredito. Sem execução, sem remoto, sem promoção.

**E — re-verificação:** HEAD 3563e13→d86ca0f→f4a1c51 inalterado; migration commitada e intocada (ausente do status); histórica intacta; `diff --check` 0; blob d86ca0f com D1 (USING l.341) + D2 (overlap l.291) re-confirmados, sem RLS/financeiro/idempotência; cadeia #22–#27 + §§4.24–4.27 íntegra nos 2 docs.
**E — G1/G2/G3:** G1 migration correta (D2 achado e corrigido em follow-up autorizado); G2 9 creates + 9 cancels + neg + overlap + rerun-observado + teardown; G3 auditoria limpa; commits escopo-exatos e locais.
**I:** nada novo desde G2; idempotência segue divergente por decisão (não contamina A5, cf. PO). Nenhum fato impeditivo encontrado.
**Proposta: A5 PASS técnico (harness) — CERTIFICÁVEL como fase de validação; promoção e prova runtime em PROD ficam para gates próprios.** Certificação formal cabe ao PO.

## 5. REPRODUCTION (comandos read-only)

```bash
# Map local (22 chaves) — extrai linha e conta chaves
#   valor = JSON único-aspas; regex: '"([a-z0-9_]+)"\s*:'

# ET não deployada (404 NOT_FOUND = negativo controlado)
curl.exe -sS --max-time 15 -X POST \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  "$URL/functions/v1/site-sanchez-appointments" -d '{}'
# esperado hoje: {"code":"NOT_FOUND",...}   |  pós-deploy: envelope da função

# RPC ausente (OpenAPI)
curl.exe -sS --max-time 15 -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/rest/v1/" -o openapi.json   # grep create_site_sanchez_appointment → ausente

# Diff 18→22 (executar quando a rede/ambiente permitir; ver §10 A3)
curl.exe -sS --max-time 20 -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  "$URL/rest/v1/services?tenant_id=eq.b716e290-f7f6-4449-b790-5ae9dcdadcab&select=id,name,slug"

# ---- Revalidação G8 (read-only; 2026-09-28) — ver §4.9 ----
vercel env pull g8reval.env --environment=production --yes     # 5 SMG_* = len 0 (não imprimir segredos)
vercel env pull g8preview.env --environment=preview --yes      # idem em PREVIEW
vercel env ls production                                       # 5 SMG_* existem (124d, Encrypted)
vercel ls                                                      # último Production Ready + alias
vercel inspect <deployment-url>                                # dpl_… + builds λ api/smg/sync (sem SHA git)
curl.exe -sS --max-time 20 -X POST -H "Content-Type: application/json" \
  -d "{}" https://sanchezbarber.vercel.app/api/smg/sync        # esperado: 400 Unsupported sync action (não 500)

# ---- Revalidação G9 (read-only; 2026-09-28) — ver §4.10 ----
curl.exe -sS --max-time 15 "https://dns.google/resolve?name=rvpmaqoqrorcbxxnqpjo.supabase.co&type=A"   # Status:3 NXDOMAIN
curl.exe -sS --max-time 15 "https://dns.google/resolve?name=ushsnmlbeurfvlkieiln.supabase.co&type=A"   # Status:0 (controle)
grep -r "rvpmaq" <clone>/src <clone>/api                       # 0 matches → origem = env Vercel (build-time)
curl.exe -sS --max-time 30 https://sanchezbarber.vercel.app/    # → assets/index-B8GS0yh2.js
curl.exe -sS --max-time 60 https://sanchezbarber.vercel.app/assets/index-B8GS0yh2.js | grep -c "rvpmaq"  # 1 → URL morta no bundle
# VITE_SUPABASE_ANON_KEY (len 208): payload JWT (2º segmento base64) → {"iss":"supabase","ref":"rvpmaqoqrorcbxxnqpjo","role":"anon"}
```

## 6. DATA FLOW

```
[Site · booking] SchedulingFlow/Hero/Dashboard
  → service=LABEL pt-BR · serviceId=SLUG hífen · barberId=SLUG hífen
  → appointmentsStorage.saveOrReplaceActiveAppointment (:297)
  → smgClient.syncSiteAppointmentWithSmg → POST /api/smg/sync (Bearer session)
  → sync.js handleCreate (:228) → INSERT appointments (sync_status='pending')
  → buildCanonicalSmgPayload (:153) → serviceIdMap[row.service=LABEL] ⚠ SEM NORMALIZAÇÃO
  → callSmgWithRetry → POST {SMG_API_BASE_URL}/site-sanchez-appointments   ✅ ET deployada (A1, §4.12)
  → ET → RPC public.create_site_sanchez_appointment                          ✅ RPC criada (A2, §4.14)
  → appointments SMG (tenant b716e290) + idempotência/ext_id

[SMG → Site] webhook appointments.js (x-smg-secret) → normalize → upsert onConflict external_id
```

**Bloqueios atuais (cadeia ainda inerte):** maps PROD vazios (`SMG_SERVICE_ID_MAP=""`/`SMG_PROFESSIONAL_ID_MAP=""`, §4.19) → todo `create` real cai no throw `sync.js:161/:164` → 500 `configuration`. Restam: **A3** (montar os 11 maps label-keyed) · **A4** (setar no Vercel) · **A5** (smoke). ET ✅ · RPC ✅ · convenção do map ✅ (G2/B).

## 7. ROOT CAUSE

Nenhum bug: a Fase 1 entregou com **gate explícito não executado**
(`SITE-SANCHEZ-CONTRACT.md:311` — "NÃO commit, NÃO push, NÃO deploy, NÃO migration (fase posterior, gated)").
A ativação nunca foi autorizada. O estado atual é **consequência de processo**, não de falha técnica.

## 8. IMPACT

- Integração **inerte em PROD**: o Site não cria agendamentos no SMG (e nunca criou em produção).
- Produção existente intocada (nenhuma alteração foi feita).
- Risco da ativação: migration + ET com `service_role` + tenant real + integração externa → exige gate completo.

## 9. ALTERNATIVES

**9.1 Convenção do map (G2) — como resolver:**
- **A0 executado (2026-09-28, §4.6):** pull PROD dos 5 `SMG_*` = vazios → **não há convenção legada a herdar**;
  a leitura read-only (9.1.A) não tem o que revelar no estado atual do projeto. Como o gate `sync.js:469`
  passou no deploy vivo, o map congelado no snapshot do deploy é ilegível (G8).
- **B (única viável e adotada):** montar map **label-keyed** — 11 chaves (8 labels de serviço + 3 de barbeiro,
  §4.7c) — em A3/A4; zero mudança de código Site; nenhum outro consumidor dos maps existe no repo (§4.1).
- **C:** alterar `sync.js` para normalizar/`row.service_id` — **mudança de código do Site**, fora do escopo
  autorizado; correção de normalização = STOP separado (decisão PO #4).

**9.2 Nomenclatura** — ver diagnóstico §9 (Alternativa A `DEC-001-A` recomendada).

## 10. RECOMMENDATION — Checklist de ativação (EXECUTÁVEL SOMENTE COM AUTORIZAÇÃO DO PO)

> Cada passo = fronteira de autorização. Nada avança sem o "GO" correspondente.
> Pré-condições globais: diff A3 reexecutado (§4.5) · backup/export do estado atual do tenant ·
> G8 (re-set dos 5 `SMG_*` vazios — diagnóstico **§4.9**) antes de qualquer redeploy ·
> G9 (NXDOMAIN `rvpmaq…` — diagnóstico **§4.10**) antes de A5; ambos com **correção pendente de decisão/autorização do PO**.
> Convenção G2 resolvida: map **label-keyed** de 11 chaves (§4.7c).
> 🔴 **NO-GO vigente (PO, 2026-09-28):** passos A1–A5 **bloqueados** até novo GO (§13).

| # | Passo | Comando/ação | Verificação (critério de saída) | Rollback |
|---|---|---|---|---|
| **A0** | ~~Descoberta read-only~~ **EXECUTADA (2026-09-28, §4.6–§4.8)** + **Gate PO** — GO/NO-GO de A1–A5 (convenção G2 resolvida) | decisão explícita do PO neste STOP | registro em `BUSINESS_DECISIONS.md` | n/a |
| **A1** | Deploy ET | ~~`supabase functions deploy site-sanchez-appointments --no-verify-jwt --project-ref ushsnmlbeurfvlkieiln` + `supabase secrets set` (6 env: `SANCHEZ_TENANT_ID`, `SANCHEZ_WEBHOOK_SECRET`, `SANCHEZ_DOMAIN_SCHEMA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SANCHEZ_ALLOWED_ORIGIN`)~~ **EXECUTADA (§4.12)** | ~~POST vazio → **não**-404 (envelope da função); segredos listados~~ **VERIFICADA: GET→405, POST→401, 6 secrets listadas (Management API)** | `supabase functions delete` / redeploy da versão anterior |
| **A2** | Migration | aplicar `20260426000000_site_sanchez_appointments.sql` (CLI/dashboard) | OpenAPI contém `/rpc/create_site_sanchez_appointment` | `DROP FUNCTION public.create_site_sanchez_appointment(...)` (migration é só-create; rollback = drop) |
| **A3** | Serviços 18→22 + map | executar query §5 (diff) → criar 4 services faltantes no tenant + montar `SMG_SERVICE_ID_MAP`/`SMG_PROFESSIONAL_ID_MAP` **label-keyed, 11 chaves** (§4.7c), com correspondência label→UUID validada pelo PO (`Primeiro disponível` a definir) | `count=exact services = 22`; cada uma das 11 chaves resolve para UUID existente | não criar/deletar os 4 (estado volta a 18) |
| **A4** | Config Site (Vercel) | **re-setar os 5 `SMG_*`** (pull = vazios — diagnóstico **§4.9**/G8): `SMG_API_BASE_URL`, `SMG_WEBHOOK_SECRET`/`SMG_API_TOKEN` + os 2 maps label-keyed; redeploy Site se necessário | `buildCanonicalSmgPayload` não lança "Unmapped service slug" em teste; gate `:469` segue passando | reverter env Vercel |
| **A5** | Smoke E2E | agendamento real de teste (slot futuro) Site→SMG; verificar linha em `appointments` SMG + RPC; cancelar agendamento de teste | 1 agendamento criado + 1 cancelado, sem duplicatas, `event_store`/logs OK | cancelar/limpar agendamento de teste |

**Ordem obrigatória:** A1 → A2 → A3 → A4 → A5 (cadeia dependente). **P.02:** nenhuma ação A1–A5 antes do GO/NO-GO do PO.

## 11. RISKS

| Risco | Severidade | Mitigação |
|---|---|---|
| Convenção errada do map → "Unmapped service slug" em produção (§4.3) | Alta | G2 resolvido **antes** de A4; smoke A5 |
| ET com `service_role` exposta sem JWT | Alta | `verify_jwt=false` intencional + `SANCHEZ_WEBHOOK_SECRET`/ORIGEM na função (validar no deploy) |
| Migration em tenant real | Média | é só-create (função); rollback = DROP; executar em janela autorizada |
| 4 services a criar podem divergir do catálogo comercial | Média | diff A3 validado pelo PO antes de criar |
| Tooling instável (timeouts) no ambiente | Baixa | comandos sequenciais + `--max-time`; queries preservadas para reexecução |

## 12. GAPS

| ID | Status |
|---|---|
| G1 fonte dos 22 | ✅ FECHADO (map local, §4.1) |
| G7 estrutura dos maps | ✅ FECHADO (§4.1) |
| G2 map PROD valores + convenção | ✅ FECHADO no escopo read-only (§4.6–§4.7): pull vazio → sem convenção legada; runtime exige **label-keyed** → A3/A4 criam map de 11 chaves |
| G3 hostname map | ✅ DECIDIDO (PO #2): fora do caminho crítico e fora de escopo de DEC-001-A — `VITE_APP_HOSTNAME_MAP` ausente e o Site chama `SMG_API_BASE_URL` direto; registrado como achado arquitetural (§4.4/§4.6) |
| G4 nomenclatura | ✅ DECIDIDO (PO #1): `DEC-001-A` (Alternativa A; `H-1..H-8` congelados só para homologação) |
| G5 refs `H7_B_*`/ARCHAEOLOGY | ✅ CLASSIFICADO (PO #3, §4.8): 4 NECESSÁRIO → commit; demais permanecem `untracked` |
| G6 `BUSINESS_DECISIONS.md` | 🔴 ABERTO — registro na autorização de A1–A5 |
| Diff 18→22 (§4.5) | 🟢 **EXECUTADO (§4.17, 2026-09-29):** hipótese "faltam 4" **invalidada** — 22 do map = 14 tenant + 8 globais + 4 typos no map; meta `count=22` exige redefinição do PO (Q3) |
| **A3 / A3-DIAG-2** Identidade + serviços 18→19 + maps label-keyed | 🟢 **A3-IMPLEMENT EXECUTADA (PO #17, §4.20, 2026-09-29):** A3-1 escopo fechado · A3-2 rename `tenants.name`→`Sanchez` + 4 copy edits · A3-3 `Sobrancelha` `a2f28824…` (18→19) · A3-4 2 maps 11 chaves montados (evidência, **não setados no Vercel** — A4 🔒) · A3-5 validação **7/7 PASS** (`failures=0`, RPC intake + grant ✓). A3 técnica **🟢 PASS (PO #18)** · typecheck = known issue pré-existente · Q1-R **confirmado sem divergência** (§4.21) · **commit `f4a1c51` ✅ (PO #19)** · **A3 ✅ CLOSED (PO #20)** · **A4 ✅ CERTIFICADO (#21): redeploy dpl_3qHo READY pós-vars + revalidação aceitos · A4 FECHADO** · **A5 🟡 G2 PASS (§4.27; PROD intocado)** · Push/PR/Merge/Deploy 🔒 |
| Forense "quem consome os maps" (§4.19) | ✅ **FECHADO (2026-09-29):** Production = `e7e50e9` (PR #1, 2× success); consumidor único = `api/smg/sync.js` server-side (`:13/:19` parse · `:157/:158` lookup label-keyed · `:161/:164` throw · gate `:469`); alvo = `…/functions/v1/site-sanchez-appointments` (ET A1) com `Bearer SMG_WEBHOOK_SECRET`; **mesmo Supabase do SMG** (`SUPABASE_URL=ush…` PROD); bundle `index-DEGutXL9.js` = build `e7e50e9`; `§4.7c` citado = correto; clone local desatualizado (370 l, sem maps, `api/public/sanchez` não-deployado); maps PROD vazios → A4 segue necessário |
| Ledger `supabase_migrations` | ✅ **ACESSÍVEL** (2026-09-28, Management API `database/query`): 155 entries; `20260426000000` consta como aplicada (ver **GAP A2-W1** abaixo). |
| **G8** env snapshot ≠ projeto (pull vazio × gate do deploy passou) | ✅ **EXECUTADO + VERIFICADO** (§4.9 + §4.11): pull vazio (PROD+PREVIEW) confirmado; **re-set autorizado** (PO #8, 2026-09-28) — `SMG_API_BASE_URL=ush…/functions/v1`, `SMG_WEBHOOK_SECRET=hex64 (RNG)`, `VITE_SUPABASE_URL=ush…`, `VITE_SUPABASE_ANON_KEY=ush JWT anon`, `SMG_API_TOKEN`+maps=vazios (permanecem até A3); **redeploy Ready** (`sanchez-barber-8o7sye15j`); probe 400 (gate `:469` passa); bundle `index-DEGutXL9.js` com `rvpmaq=0` |
| **G9** `VITE_SUPABASE_URL` do Site = `rvpmaq…` NXDOMAIN | ✅ **EXECUTADO + VERIFICADO** (§4.10 + §4.11): `VITE_SUPABASE_URL` + anon key corrigidos para `ush…`; **redeploy Ready**; bundle novo `index-DEGutXL9.js` embute `ushsnmlbeurfvlkieiln` (não `rvpmaq`); token JWT confirmado `ref=ush…`; consumers auth/insert agora apontam para projeto válido. Integração Site↔SMG segue **inerte** (ET não-deployada, migration ausente — A1+A2 NO-GO) |
| **A1** Deploy ET | ✅ **EXECUTADO + VERIFICADO** (§4.12): `supabase functions deploy site-sanchez-appointments --no-verify-jwt --project-ref ushsnmlbeurfvlkieiln` → `Deployed Functions`; 6 secrets setadas (4 via CLI, 1 via Management API work-around do bug `//` do CLI v2.95.6, 2 herdadas pré-existentes confirmadas pelo ET respondendo sem 500); GET → 405 `Method not allowed` (não 404); POST → 401 `Unauthorized` (config carregada, auth ativo). **RPC ainda ausente** → POST autenticado falha com `function create_site_sanchez_appointment does not exist` (A2 NO-GO à época). |
| **A2** Migration corretiva em PROD | 🟢 **CLOSED** (PO #15): A2-DIAG (§4.13) → A2-B `20260426000001` (§4.13) → A2-Prod aplicada + validada (§4.14, todos checks PASS) → A2-W1-DIAG 6/6 (§4.15) → A2-W1-RECON 7/7 (§4.16). `20260426000000` preservada intocada; `barber.appointments` preservada como VIEW; ledger reconciliado cirurgicamente. |
| **GAP A2-W1** Ledger `schema_migrations` divergente | 🟢 **RECONCILIADO CIRURGICAMENTE** (PO #14, §4.16): diagnóstico read-only (§4.15) → 155 × repo 157 · **repair executado**: `20260426000001 → applied` (presente, 13 stmts gravados pelo repair) e `20260915175459 → reverted` (órfã removida) · ledger segue **155** (−1 órfã +1 nova) · efetivo **inalterado** (`47/12/19/1/VIEW`, ACL idêntica, `20260426000000` byte-idêntica) → **zero SQL re-executado** · `20260919054555`/`20260924000000` **deliberadamente fora do ledger** (PO #14) · causa H1/H2 da linha `20260426000000` indeterminada mas **irrelevante** (efetivo correto desde A2-Prod). Divergências residuais remanescentes = as 2 versões não registradas por decisão + quirk de exibição de datas curtas no CLI (pré-existente, sem impacto). |

## 13. DECISION NEEDED (PO)

**Decisões recebidas (PO, 2026-09-28/29):**
1. **Nomenclatura (G4)** → Alternativa A: **`DEC-001-A`**; `H-1..H-8` congelados só para homologação (filenames `DEC001_H7_*` mantidos).
2. **Hostname map (G3)** → **fora de escopo** de DEC-001-A; documentado como achado arquitetural (§12).
3. **Refs documentais (G5)** → classificar **antes** do commit — sem commit de "tudo que está untracked" (§4.8).
4. **A0 read-only obrigatório** antes de tocar em map/site → **executado (§4.6–§4.8)**; correção de normalização (9.1.C) = STOP separado.
5. **Commit+push somente dos docs necessários** classificados, com evidência antes/depois (`git status`/`git diff --stat`/`git diff --check`) → executado neste ciclo.
6. **A1–A5 NÃO autorizados** — fluxo A0 → G2 confirmado → STOP → decisão do PO.
7. **NO-GO total A1–A5** (2026-09-28): sem ativação PROD neste momento; **sem alterar migration, sem alterar banco, sem alterar regras de negócio, sem deploy adicional sem autorização**. Agente autorizado **somente** a diagnóstico/revalidação dos gates **G8** e **G9** (read-only), com **evidências separadas** (§4.9/§4.10), seguido de novo STOP. Augusto decide: valores dos 5 `SMG_*` · se o host `rvpmaq…` é o endpoint esperado · se a correção de config está autorizada · GO final.
8. **Correção G8+G9 autorizada + executada + verificada** (PO, 2026-09-28): valores `SMG_*` conforme guia recomendado (#2); front→`ush…` (#3); escrita nos envs Vercel (PROD+PREVIEW) + redeploy (`sanchez-barber-8o7sye15j`) + verificação (probe 400, bundle `rvpmaq=0`/`ush=1`) — execução registrada §4.11. A1–A5 **mantêm NO-GO**.
9. **A1 — Deploy ET autorizado + executado + verificado** (PO, 2026-09-28): `supabase functions deploy site-sanchez-appointments --no-verify-jwt --project-ref ushsnmlbeurfvlkieiln` → `Deployed Functions`; 6 secrets configuradas (4 via `supabase secrets set`, 1 via Management API por bug `//` do CLI v2.95.6 — GAP A1-W1, 2 herdadas pré-existentes confirmadas pelo ET responder sem 500). GET → 405 `Method not allowed` (não 404); POST → 401 `Unauthorized` (config carregada, auth ativo). **RPC `create_site_sanchez_appointment` ainda ausente** → POST autenticado falha com `function … does not exist` (A2 NO-GO). Execução registrada §4.12. A2–A5 **mantêm NO-GO**.
10. **A2 bloqueado por drift → A2-DIAG autorizado** (PO, 2026-09-28): preflight provou `barber.appointments` = **VIEW** (42809 na aplicação da `20260426000000`) → **NO-GO** na aplicação como estava; proibido converter/remover a VIEW, aplicar parcialmente, marcar migration como aplicada ou inserir RPC manualmente. Autorizada **somente** investigação read-only (12 perguntas) para determinar a correção canônica; A3–A5 permanecem 🔒.
11. **A2-DIAG → Opção B autorizada (criação + validação)** (PO, 2026-09-28): PO escolheu **B** — `20260426000000` permanece histórica **intocada**; correção em **nova migration** `20260426000001_site_sanchez_appointments_correction.sql` com escopo **somente `public`**. Autorizada a criação + validação local + diff, **sem** aplicação em PROD; guardrail: qualquer necessidade de tocar `barber.appointments`, migrar a VIEW, alterar RLS, modificar a migration original ou aplicar direto → STOP imediato. Criação + diff executados (§4.13) → **PASS**.
12. **A2-Prod — GO para aplicação** (PO, 2026-09-28): autorizada a aplicação **exclusiva** da `20260426000001` em `ushsnmlbeurfvlkieiln` + validação obrigatória (migration aplicada · `external_source` · constraints `source`/`channel` · índices · RPC · `barber.appointments` intocada · registro §4.14). Drift/erro não diagnosticado → STOP imediato (sem correção por fora, sem migration adicional, sem avançar a A3). Aplicação **não** significa autorização automática para A3 — **STOP/GATE para fechamento do A2** ao concluir. Executado + validado (§4.14, todos checks PASS). A3–A5 **mantêm 🔒**.
13. **A2-W1-DIAG — somente diagnóstico read-only do ledger** (PO, 2026-09-29): A2-Prod reconhecido como **PASS técnico**, porém A2 **não** certificado como encerrado; **GAP A2-W1 = ABERTO / STOP CONTROLADO**. Autorizado **apenas** A2-W1-DIAG read-only com 6 itens mínimos (ledger completo/ordenado · dependências de `20260426000000` · duplicados/anomalias · se `20260426000001` pode ser registrada depois sem violar o mecanismo · forma oficial/reprodutível de reconciliar vs DML manual · comparação REPO × LEDGER × ESTADO EFETIVO). **Proibido:** DML no ledger, commit, A3, A4, A5. Ao concluir → **STOP/GATE para decisão do PO sobre reconciliação**. `supabase/migrations/20260905000000_…` continua fora de escopo e não entra em commit. Executado (§4.15, 6/6 PASS — nenhuma escrita).
14. **A2-W1-RECON — GO para reconciliação cirúrgica via `migration repair`** (PO, 2026-09-29): autorizado **apenas** `migration repair 20260426000001 --status applied --linked` (aplicada e validada em A2-Prod) e `migration repair 20260915175459 --status reverted --linked` (órfã = mecanismo documentado; sem exclusão física, sem DML). **Não autorizado:** `20260919054555` (não marcar applied — rastreabilidade própria pendente) · `20260924000000` (não marcar applied — cabeçalho "PREPARAÇÃO apenas — NÃO aplicar em PROD") · DML manual · `db push` · re-execução de SQL. Regra de execução: após rodar os 2 comandos → verificar ledger · confirmar `20260426000001` applied · confirmar `20260915175459` reverted · confirmar nenhum SQL re-executado · confirmar `20260919054555`/`20260924000000` sem alteração · `git diff --check` · STOP/GATE. Comando exigir ação extra → STOP imediato. Executado (§4.16, 7/7 PASS). Se validação passar → PO poderá formalizar `A2-Prod PASS · A2-W1-DIAG PASS · A2-W1-RECON PASS · A2 CLOSED` e então decidir o commit documental. **A3 permanece bloqueada até o fechamento formal do A2.**
15. **A2 CLOSED + commit documental + A3 GO** (PO, 2026-09-29): certificação formal — **A2 ENCERRADO** (G8/G9 PASS · A1 PASS · A2-DIAG PASS · A2-B PASS · A2-Prod PASS · A2-W1-DIAG 6/6 · A2-W1-RECON 7/7). Divergência residual `20260919054555`/`20260924000000` fica **registrada e deliberadamente não reconciliada** (decisão #14 explícita — não impede o fechamento). **GO para commit exclusivamente documental** dos 2 DEC001 (inclui §4.13–§4.16, decisão #14, STATUS, GAPS, evidências do fechamento A2); **proibido** incluir `AGENTS.md`, `docs/adr/README.md`, `supabase/migrations/20260905000000_…` ou qualquer outro arquivo; **não autorizado** neste gate: alteração de código, nova migration, alteração de banco, push, PR, merge, deploy. Pós-commit → **STOP/GATE** com `git status` · `git diff --cached` · `git show --stat HEAD` · `git diff HEAD^ HEAD -- docs/audit/DEC001_*`. **GO granular para iniciar A3** (serviços 18→22 + maps label-keyed + validação → STOP) **após o gate documental**; A3 **não** autoriza A4 nem A5 — **A4 🔒 · A5 🔒**. Estado oficial: `A1 ✅ CLOSED · A2 ✅ CLOSED · A3 🟢 GO · A4 🔒 · A5 🔒`.
16. **Mudança de plano: A3-DIAG-2 (identidade do tenant) antes de qualquer escrita do A3** (PO, 2026-09-29): interromper A3-IMPLEMENT; executar diagnóstico read-only Portal ↔ SMG (inventário de identidade, nome canônico + slug, mesmo `tenant_id` nos dois lados, impacto em maps e na RPC). Regra exigida: *"Nenhuma integração deve usar 'Sanchez' como chave técnica quando já existe `tenant_id`."* Executado sem escritas (§4.17 + §4.18 + §4.19). Detalhe completo: `DEC001_H7_ATIVACAO_DIAGNOSTICO_20260928.md` §11 #16.
17. **A3-IMPLEMENT — GO com Q1–Q6 decididos** (PO #17, 2026-09-29): **Q1-C** 🟢 criar `Sobrancelha` no tenant (R$15 · 15min · `Acabamento` · 18→19 · não-global · não `CORTE + SOMBRANCELHA`) · **Q2** 🟢 `Primeiro disponível` → Rubens `0b0d5fd1-…` · **Q3-B** 🟢 somente 18→19 (22 não é requisito) · **Q4** 🟢 nome humano canônico `Sanchez` (coluna `name`; `tenant_id` UUID = identidade técnica) · **Q5** 🟢 padronizar apresentações, **NÃO** renomear registros de negócio · **Q6** 🟢 copy `phone.ts` → `Sanchez`, sem reescrever lógica telefônica. Sequência 1–7: identidade → Sobrancelha → montar 2 maps (11 chaves) → validar UUIDs/ativos → RPC/intake → **STOP/GATE A3**. **Limites explícitos:** "Nenhuma autorização de A3 implica autorização para A4/A5." **A4 🔒 · A5 🔒 · Push 🔒 · PR 🔒 · Merge 🔒 · Deploy 🔒.** Execução: §4.20 (A3-1..A3-7 executados).
18. **Gate A3 — resposta do PO (#18, 2026-09-29):** A3-1..A3-7 **🟢 PASS técnico** (critérios do PO todos atendidos: rename · `tenant_id` idêntico · 18→19 · 11/11 maps · `failures=0` · staff ativos · RPC executável · build/unit/`diff --check` PASS). 🟡 typecheck TS8016 = **known issue pré-existente** — script `untracked` **não corrigir, não excluir** (registrar apenas como known issue com evidência). **🛑 STOP Q1-R**: relatório exibia `Acabamento` em parêntese; PO exigiu confirmação do `name` efetivo do UUID `a2f28824…` antes de qualquer commit. **Commit A3 🔒 · Push/PR/Merge/Deploy 🔒 · A4/A5 🔒.** Confirmação executada read-only (§4.21): `name="Sobrancelha"` · `category="Acabamento"` → **caso #1, divergência inexistente** → aguardando GO de commit do PO.
19. **GO DE COMMIT A3 — autorizado + executado (PO, 2026-09-30):** Q1-R confirmado (caso #1) eliminou a pendência do gate; autorizado **somente o commit da frente A3** com escopo exato de **6 arquivos** (2 DEC001 + `src/lib/utils/phone.ts` + 3 copy kiosk), excluídos `AGENTS.md`, `docs/adr/README.md`, `20260905000000_*.sql`, untracked e qualquer alteração fora do escopo. Condições cumpridas: `git diff --check` 0 (working + staged) · staging exato verificado (`--name-only` = 6) · sem TS8016 · sem mapas · sem banco · sem A4/Vercel · **sem push/PR/merge/deploy**. Commit **`f4a1c51`** `docs(dec-001-a): A3-IMPLEMENT — tenant Sanchez + Sobrancelha + maps 11 chaves` (6 files, 241+/18-). **STOP após o commit**; próximo gate = revisão do commit A3. **A4 🔒 · A5 🔒 · Push 🔒 · PR 🔒 · Merge 🔒 · Deploy 🔒.**
20. **A4 — GO com escopo estreitado + caminho de escrita bloqueado (PO, 2026-09-30):** A3 formalmente encerrada no `f4a1c51`. **GO:** configurar `SMG_SERVICE_ID_MAP` (8 chaves) + `SMG_PROFESSIONAL_ID_MAP` (3 chaves) — artefatos A3/§4.20, sem alteração; PROD+PREVIEW; preservar demais vars; redeploy somente se necessário; validar consumo. **NÃO GO:** criar/inventar `SMG_API_TOKEN` (permanece `""`/vazio — "token sem consumidor não é configuração, é dívida operacional"; G8 já o deixara vazio como "definição = PO") · alterar código/banco/mapas · A5 · push/PR/merge · deploy além do necessário. **Redeploy ≠ automático:** salvar env ≠ deployment existente enxergar; se nova deployment for exigida, volta como **subgate A4** com evidência (sem deploy automático). **BLOQUEIO operacional (evidência):** Vercel CLI trava até com `--version` (4 tentativas) · `~/.vercel/auth.json` inexistente · `VERCEL_TOKEN` ausente (env + `.env.local`, só comprimentos verificados) · `curl` a `api.vercel.com` trava 40s (só Supabase + edge do site respondem) → **escritas A4 inexequíveis deste ambiente**; maps prontos (bytes confirmados = §4.20). Atualização pós-#20: PO salvou `VERCEL_TOKEN` no `.env.local` (len 60; valor nunca exibido, registrado, commitado ou logado — uso só como variável Bearer); 3 probes `api.vercel.com` travaram além do `--max-time` (kills 40/45/90s) com Supabase respondendo normal → bloqueio de rede ao Vercel persiste (DNS resolve `api.vercel.com`→76.76.21.112 e Supabase normal; TCP ao Vercel trava = blackhole seletivo de egresso); CLI segue inviável (trava antes de auth). Pergunta do caminho de execução (dashboard PO × outro ambiente) devolvida ao PO sem resposta — **STOP interim aguardando definição do executor**. Runbook verificado pós-STOP: payloads colados = arquivos A3 byte-a-byte (comparação file-to-file explícita UTF-8, MATCH=True 11/11; divergência anterior era artefato de parsing ANSI do PS 5.1).
21. **A4 ✅ CERTIFICADO + A5 BLOQUEADO (PO, 2026-09-30):** A4 fechado — redeploy `dpl_3qHo…` READY pós-vars (23:36:42Z) + revalidação A4-1..A4-6 aceitos; não mexer mais em A4. A5 segue BLOQUEADO — exige gate próprio + autorização explícita (inclui prova runtime dos 11 maps). Próximo trabalho, quando autorizado pelo PO: exclusivamente preflight/gate do A5.

22. **GO G1 + EXECUÇÃO (PO, 2026-09-30):** corretiva RPC $13/$14 autorizada (só nova migration; sem G2/smoke, sem histórica, sem push/PR/merge/deploy PROD/commit). Sequência smg-change-control→isolate→AUDIT→implement→validate→STOP cumprida. AUDIT confirmou proposta + achou D2 (parêntese overlap, empírico no harness). IMPLEMENT: `supabase/migrations/20260930000000_site_sanchez_appointments_fix_insert_params.sql` (novo; DIFF +1 linha/0 modificações). VALIDATE: harness docker postgres:16 local hermético — setup+apply OK; positive BLOQUEADO por D2 (syntax l.179); negatives PASS; rerun SKIPPED. **STOP com pedido de GO p/ fix-D2 + revalidação.** G2/G3/G4 NÃO executados; PROD intocado.

23. **GO D2 + REVALIDAÇÃO (PO, 2026-09-30):** parêntese overlap autorizado (só migration G1; sem resto). D2 movido p/ posição correta (script posicional, net-zero verificado); `git diff --check` 0. Harness recriado: apply OK · **positive PASS** (external_id+notes corretos) · cancel PASS · negatives PASS · **overlap PASS** (409-style, com cleanup) · re-run = unique violation (idempotência intacta). Teardown executado. **STOP; G2 NÃO executado; PROD intocado; sem commit/push/PR/merge/deploy.**

24. **GO G2 + EXECUÇÃO (PO, 2026-09-30):** smoke autorizado (só harness descartável; sem PROD/commit/push/PR/merge/deploy; sem G3/G4; idempotência intacta). 9 creates PASS (8 UUIDs + cross-combo) + 9 cancels PASS + negatives PASS + overlap PASS + rerun = unique (documentado). Teardown executado. **STOP; PROD intocado.**

25. **GO COMMIT + EXECUÇÃO (PO, 2026-09-30):** commit só da migration `20260930000000…` (sem resto). Pré-checks: branch main, HEAD f4a1c51, staging vazio, diff-check 0, D1/D2 re-verificados no arquivo. Staged exato (1 arquivo, 365 insertions). Commit **`d86ca0f`** `fix(dec-001-a): corretiva RPC site-sanchez - binding $13/$14 (D1) + parentese overlap (D2)` — nota: `$13/$14` renderizou como `/` no subject por expansão de shell (só cosmético; corpo íntegro). **Sem push/PR/merge/deploy.** STOP.

26. **GO COMMIT DOCS + EXECUÇÃO (PO, 2026-09-30):** commit só dos 2 DEC001 (G1/G2/G3 + #22–#25, §4.24–§4.27). Pré-checks: main/d86ca0f, staging vazio, diff-check 0, migration inalterada. Staged exato (2 arquivos, 166+/9-). Commit **`3563e13`** `docs(dec-001-a): registra G1/G2/G3 A5...`. **Sem push/PR/merge/deploy.** STOP.

27. **RE-AUDITORIA A5/G1/G2/G3 (PO, 2026-09-30):** direção: re-auditar/revalidar, NÃO promover. Re-verificado: HEAD 3563e13→d86ca0f→f4a1c51; migration worktree==blob d86ca0f (hash idêntico); diff-check 0; cadeia #22–#26 + §§4.24–4.27 íntegra (Registro evidence-list completada c/ §4.26). Nenhuma divergência nova. STOP.

28. **CERTIFICAR-A5 review (PO, 2026-09-30):** revisar G1/G2/G3 + commits e propor veredito (só docs e relatório, nada remoto). Irmão §4.28: nada novo; proposta **A5 PASS técnico — CERTIFICÁVEL como validação** (promoção/prova PROD em gates próprios). Certificação formal c/ PO. STOP.

29. **A5 ✅ CERTIFICADO técnico/harness (PO, 2026-09-30):** G1/G2/G3 + re-auditoria PASS aceitos; promoção, aplicação em PROD, push/PR/merge/deploy seguem 🔒 (gates próprios); idempotência divergente por decisão (fora do escopo A5). STOP.

30. **GATE ADR-029 ÍNDICE (PO, 2026-10-01):** linha ADR-029 adicionada preservando ADR-027/028 (Cenário B→A autorizado); diff-check 0; ADR-029 intacto. **Commit NÃO autorizado**; próximo = ownership ADR-027/028 + novo gate de revisão do diff completo. STOP.

31. **GATE ADR-029 REVISÃO FINAL (PO, 2026-10-01):** STOP mantido, commit NEGADO (inclusive combinado 027/028/029; sem `git add .`). Ownership indeterminável tecnicamente (não atribuir por inferência); ADR-028 ausente = link quebrado (não remover/recriar/corrigir); 20260905000000 não absorver. Próximo: ownership → resolver ausente → revisão do conjunto → escopo exato → PO autoriza → smg-commit. STOP.

**Pendente (este STOP):**
1. ~~Commit da atualização documental~~ ✅ **autorizado + executado (PO #15, este ciclo)**: somente os 2 DEC001 (excluídos `AGENTS.md`, `docs/adr/README.md`, `20260905000000_…` e demais arquivos) — evidência no STOP/GATE pós-commit (`git status`/`git diff --cached`/`git show --stat HEAD`/`git diff HEAD^ HEAD -- docs/audit/DEC001_*`). Push **não** autorizado neste gate.
2. ~~Valores dos 5 `SMG_*` para PROD~~ ✅ **resolvido (§4.11)**: `SMG_API_BASE_URL`+`SMG_WEBHOOK_SECRET` definidos; `SMG_API_TOKEN`+2 maps ficam vazios até A3.
3. ~~Host `rvpmaq…`~~ ✅ **resolvido (§4.11)**: front agora aponta para `ush…` (URL + anon key JWT `ref=ushsnmlbeurfvlkieiln`).
4. ~~Autorização da correção de config~~ ✅ **autorizado + executado (§4.11)**: envs re-setados + redeploy + verificação.
5. ~~Deploy ET (A1)~~ ✅ **autorizado + executado (§4.12)**: ET deployada + 6 secrets + envelope verificado.
6. ~~GO granular A2~~ ✅ **autorizado + executado + validado (§4.13–§4.14)**: drift 42809 → A2-DIAG → Opção B → `20260426000001` criada + aplicada + verificada.
7. ~~Fechamento do A2 (PO)~~ ✅ **resolvido (PO #15): A2 = CLOSED** — certificação formal com 7 frentes todas PASS.
8. ~~GAP A2-W1 (decisão do PO)~~ ✅ **resolvido (PO #14, §4.16)**: reconciliação cirúrgica executada com os 2 repairs autorizados (`20260426000001 → applied`, `20260915175459 → reverted`), 7/7 itens de validação PASS, zero SQL re-executado. `20260919054555`/`20260924000000` mantidas fora do ledger por decisão do PO; DML manual e `db push` nunca executados.
9. **A3 serviço 18→19 + maps label-keyed + validação** → ✅ **resolvido (PO #17): A3-IMPLEMENT executada** (§4.20): Q1–Q6 decididos (Q1-C `Sobrancelha` criada · Q2 `Primeiro disponível`→Rubens · Q3-B meta 18→19 · Q4 `name` canônico `Sanchez` · Q5 sem renomear negócios · Q6 copy `phone.ts`) · A3-1..A3-5 PASS · validação **7/7** (`failures=0`) · A3-7 executado (build/unit/diff-check PASS; typecheck = known issue) · **gate respondido (PO #18): técnica PASS · Q1-R confirmado (§4.21)** · **commit `f4a1c51` ✅ (PO #19)** · **A3 ✅ CLOSED (PO #20)** · **A4 ✅ CERTIFICADO (#21)** · **A5 🟡 G2 PASS (§4.27; PROD intocado)**.

## 14. STATUS

**A3 ✅ CLOSED · A4 ✅ CERTIFICADO (PO #21) · A5 ✅ CERTIFICADO técnico/harness (PO #29, 2026-09-30): G1/G2/G3 + re-auditoria PASS · promoção/PROD/push/PR/merge/deploy 🔒 (gates próprios) · idempotência divergente por decisão.**

- **A1 ✅ · A2 ✅ · A3 ✅ CLOSED `f4a1c51` · A4 ✅ CERTIFICADO (#21) · A5 ✅ CERTIFICADO técnico/harness (#29) · Push/PR/Merge/Deploy 🔒 · PROD intocado.**
- **G8+G9** corrigidos + verificados (PO #8, §4.11) · **A1** deploy ET + 6 secrets + envelope verificado (PO #9, §4.12).
- **A2-Prod** aplicado + validado (PO #12, §4.14): `external_source` ✅ · constraints ✅ · índices ✅ · RPC ✅ (ACL mínima + guard público-only, 2 testes negativos PASS) · `barber.appointments` = VIEW intocada ✅ · `20260426000000` intocada ✅.
- **A2-W1-DIAG** executado (PO #13, §4.15): ledger 155 × repo 157 · 3 pendências de registro · 1 órfã · causa H1/H2 indeterminada read-only · mecanismo oficial identificado (`migration repair`). **6/6 PASS, nenhuma escrita.**
- **A2-W1-RECON** executado (PO #14, §4.16): repairs `20260426000001 → applied` + `20260915175459 → reverted` (ambos exit 0, nenhuma ação extra exigida) · validação **7/7 PASS** (ledger 155 · alvos confirmados · efetivo `47/12/19/1/VIEW` + ACL byte-idênticos → zero SQL re-executado · `20260919054555`/`20260924000000` inalteradas · `git diff --check` PASS).
- **A2 formalmente FECHADO (PO #15)**: 7 frentes todas PASS; divergência residual `20260919054555`/`20260924000000` registrada e deliberadamente não reconciliada.
- **GAPS**: **A2-W1** 🟢 **reconciliado** · A1-W1 (CLI `//` bug) · G6 (`BUSINESS_DECISIONS.md`) · Diff 18→22 🟢 **executado** (§4.17; hipótese "faltam 4" invalidada) · A3 **diagnóstico** 🟢 (§4.17–§4.19) · A3-IMPLEMENT 🟢 **executada** (§4.20; A3-7 + STOP/GATE A3 pendentes).
- **Commit documental executado (PO #15)** — somente os 2 DEC001 (§4.13–§4.16, #14/#15, STATUS, GAPS); `AGENTS.md`, `docs/adr/README.md`, `20260905000000_…` e demais arquivos **fora**. Push **não** autorizado neste gate. Evidência = STOP/GATE pós-commit (`git status` · `git diff --cached` · `git show --stat HEAD` · `git diff HEAD^ HEAD -- docs/audit/DEC001_*`).
- **A3-IMPLEMENT (PO #17, §4.20) executada**: identidade (`tenants.name`→`Sanchez` + 4 copy edits) · `Sobrancelha` `a2f28824-f741-48df-92b9-858f3e1c3266` (18→19) · 2 maps 11 chaves label-keyed montados como evidência (**não setados no Vercel**) · validação **7/7 PASS** (`failures=0`, RPC intake + grant ✓); **não** autoriza A4/A5. **A4/A5 🔒.**
- **Integração Site↔SMG ainda inerte** — depende de A3, A4 e A5, cada um com gate próprio.
- **Forense §4.19 (2026-09-29)**: Production = `e7e50e9` · consumidor único dos maps = `api/smg/sync.js` (server-side, `serviceIdMap[label]` `:157`) · alvo = ET A1 `site-sanchez-appointments` · **mesmo Supabase do SMG** (`ush…`) · bundle = build `e7e50e9` · maps PROD vazios (A4 necessário) · zero escrita.

Próximo: **promoção/prova runtime em PROD** (§4.28 — gate próprio, NÃO autorizada; idempotência segue divergente por decisão separada) — sem commit/push/PR/merge/deploy.

Registro: `EVIDENCE §4 (A0 = §4.6–§4.8; G8 = §4.9; G9 = §4.10; execução G8/G9 = §4.11; A1 = §4.12; A2-DIAG+A2-B = §4.13; A2-Prod = §4.14; A2-W1-DIAG = §4.15; A2-W1-RECON = §4.16; A3-DIAG = §4.17; A3-DIAG-2 = §4.18; forense consumidor maps = §4.19; A3-IMPLEMENT = §4.20; confirmação Q1-R = §4.21; A4-VALIDATE parcial = §4.22; evidência Vercel = §4.23; preflight A5 = §4.24; G1 corretiva RPC = §4.25; D2-FIX + revalidação = §4.26; G2 smoke = §4.27; certificação A5 = §4.28) · REPRODUCTION §5 · DATA FLOW §6 · GAPS §12 · DECISION §13 (#1–#31; #31 = REVISÃO FINAL/STOP sem commit) · STATUS A4 ✅ CERTIFICADO · A5 ✅ CERTIFICADO técnico/harness (PROD intocado)`.
