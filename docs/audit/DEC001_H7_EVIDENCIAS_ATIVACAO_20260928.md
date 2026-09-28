# DEC-001/H7 — Evidências da Ativação PROD Site↔SMG + Checklist Executável

> **Front ID oficial:** `DEC-001-A` — "Gate de Ativação PROD Site↔SMG" (decisão PO 2026-09-28, Alternativa A; `H-1..H-8` congelado só para homologação — nome de arquivo legado `DEC001_H7_*` preservado por continuidade).
> **Ciclo autorizado pelo PO (2026-09-28):** diagnóstico → evidências (A0 read-only) → classificação → commit documental → STOP/GO-NO-GO A1–A5.
> **Fase deste documento:** EVIDÊNCIAS + descoberta A0 executada (read-only). Nenhum deploy, migration ou alteração de código/configuração; commit documental restrito aos docs necessários (decisão PO #5).
> **Data:** 2026-09-28 · **Executor:** OpenCode (Tech Lead operacional) · **STATUS:** STOP/GATE — A0 concluído, aguardando GO/NO-GO A1–A5 (§14).
> **Documento-irmão:** `DEC001_H7_ATIVACAO_DIAGNOSTICO_20260928.md` (diagnóstico; correções aplicadas §4.4/§7/§8; decisões PO registradas §9/§11).

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
```

## 6. DATA FLOW

```
[Site · booking] SchedulingFlow/Hero/Dashboard
  → service=LABEL pt-BR · serviceId=SLUG hífen · barberId=SLUG hífen
  → appointmentsStorage.saveOrReplaceActiveAppointment (:297)
  → smgClient.syncSiteAppointmentWithSmg → POST /api/smg/sync (Bearer session)
  → sync.js handleCreate (:228) → INSERT appointments (sync_status='pending')
  → buildCanonicalSmgPayload (:153) → serviceIdMap[row.service=LABEL] ⚠ SEM NORMALIZAÇÃO
  → callSmgWithRetry → POST {SMG_API_BASE_URL}/site-sanchez-appointments   ❌ 404 HOJE
  → [ET a criar] → RPC public.create_site_sanchez_appointment              ❌ AUSENTE HOJE
  → appointments SMG (tenant b716e290) + idempotência/ext_id

[SMG → Site] webhook appointments.js (x-smg-secret) → normalize → upsert onConflict external_id
```

**Bloqueios atuais (cadeia inteira inerte):** ET 404 → RPC ausente → 18≠22 serviços → convenção do map (G2).

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
> G8 (re-set dos 5 `SMG_*` vazios, §4.6) antes de qualquer redeploy · G9 (NXDOMAIN `rvpmaq…`, §4.6) antes de A5.
> Convenção G2 resolvida: map **label-keyed** de 11 chaves (§4.7c).

| # | Passo | Comando/ação | Verificação (critério de saída) | Rollback |
|---|---|---|---|---|
| **A0** | ~~Descoberta read-only~~ **EXECUTADA (2026-09-28, §4.6–§4.8)** + **Gate PO** — GO/NO-GO de A1–A5 (convenção G2 resolvida) | decisão explícita do PO neste STOP | registro em `BUSINESS_DECISIONS.md` | n/a |
| **A1** | Deploy ET | `supabase functions deploy site-sanchez-appointments --no-verify-jwt --project-ref ushsnmlbeurfvlkieiln` + `supabase secrets set` (6 env: `SANCHEZ_TENANT_ID`, `SANCHEZ_WEBHOOK_SECRET`, `SANCHEZ_DOMAIN_SCHEMA`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SANCHEZ_ALLOWED_ORIGIN`) | POST vazio → **não**-404 (envelope da função); segredos listados | `supabase functions delete` / redeploy da versão anterior |
| **A2** | Migration | aplicar `20260426000000_site_sanchez_appointments.sql` (CLI/dashboard) | OpenAPI contém `/rpc/create_site_sanchez_appointment` | `DROP FUNCTION public.create_site_sanchez_appointment(...)` (migration é só-create; rollback = drop) |
| **A3** | Serviços 18→22 + map | executar query §5 (diff) → criar 4 services faltantes no tenant + montar `SMG_SERVICE_ID_MAP`/`SMG_PROFESSIONAL_ID_MAP` **label-keyed, 11 chaves** (§4.7c), com correspondência label→UUID validada pelo PO (`Primeiro disponível` a definir) | `count=exact services = 22`; cada uma das 11 chaves resolve para UUID existente | não criar/deletar os 4 (estado volta a 18) |
| **A4** | Config Site (Vercel) | **re-setar os 5 `SMG_*`** (pull A0 = vazios — §4.6/G8): `SMG_API_BASE_URL`, `SMG_WEBHOOK_SECRET`/`SMG_API_TOKEN` + os 2 maps label-keyed; redeploy Site se necessário | `buildCanonicalSmgPayload` não lança "Unmapped service slug" em teste; gate `:469` segue passando | reverter env Vercel |
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
| Diff 18→22 (§4.5) | 🟡 query pronta (§5/§10.A3) — reexecutar em ambiente estável |
| Ledger `supabase_migrations` | 🟡 inacessível (Management API) — substituído por OpenAPI (equivalente) |
| **G8** env snapshot ≠ projeto (pull vazio × gate do deploy passou, §4.6) | 🔴 ABERTO — A4 deve re-setar os 5 `SMG_*` antes de qualquer redeploy (senão sync cai com 500 `Missing server configuration`) |
| **G9** `VITE_SUPABASE_URL` do Site = `rvpmaq…` NXDOMAIN (§4.6) | 🔴 ABERTO — bundle live embute a URL morta; definir projeto alvo do frontend do Site antes do smoke A5 |

## 13. DECISION NEEDED (PO)

**Decisões recebidas (PO, 2026-09-28):**
1. **Nomenclatura (G4)** → Alternativa A: **`DEC-001-A`**; `H-1..H-8` congelados só para homologação (filenames `DEC001_H7_*` mantidos).
2. **Hostname map (G3)** → **fora de escopo** de DEC-001-A; documentado como achado arquitetural (§12).
3. **Refs documentais (G5)** → classificar **antes** do commit — sem commit de "tudo que está untracked" (§4.8).
4. **A0 read-only obrigatório** antes de tocar em map/site → **executado (§4.6–§4.8)**; correção de normalização (9.1.C) = STOP separado.
5. **Commit+push somente dos docs necessários** classificados, com evidência antes/depois (`git status`/`git diff --stat`/`git diff --check`) → executado neste ciclo.
6. **A1–A5 NÃO autorizados** — fluxo A0 → G2 confirmado → STOP → decisão do PO.

**Pendente (este STOP):** **GO/NO-GO dos passos A1–A5** (granularidade por passo), considerando as pré-condições G8 (re-set do env Vercel em A4) e G9 (NXDOMAIN em A5).

## 14. STATUS

**STOP / GATE** — A0 executado: pull+probe §4.6 · tabela Origem×formato (entregável) §4.7 · classificação das refs §4.8;
G1–G5 e G7 encerrados · G6/G8/G9 abertos · commit documental dos 4 docs necessários autorizado e executado
(decisão PO #5). Ação de produção (A1–A5) **não iniciada**. Aguardando **GO/NO-GO** do PO por passo.

Registro: `EVIDENCE §4 (A0 = §4.6–§4.8) · REPRODUCTION §5 · DATA FLOW §6 · GAPS §12 · DECISION §13 · STATUS STOP`.
