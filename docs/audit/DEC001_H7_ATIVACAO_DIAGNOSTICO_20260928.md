# DEC-001 — Diagnóstico da Frente H7 (Ativação PROD Site↔SMG)

> **Front ID oficial:** `DEC-001-A` — "Gate de Ativação PROD Site↔SMG" (decisão PO 2026-09-28, Alternativa A, §9; nome de arquivo legado `DEC001_H7_*` preservado).
> **Ciclo autorizado pelo PO (2026-09-28):** diagnóstico → evidências (A0) → classificação → commit documental → STOP/GO-NO-GO A1–A5.
> **Fase deste documento:** AUDIT (diagnóstico). Read-only. Nenhum deploy, migration ou alteração de código/configuração; commit documental restrito aos docs necessários.
> **Data:** 2026-09-28 · **Executor:** OpenCode (Tech Lead operacional) · **STATUS final:** ver §11.
> **Atualização (evidências + A0):** G1/G2/G3/G4/G5/G7 fechados; correções em §4.4/§7/§8/§9/§11; A0 executado (irmão §4.6–§4.8).
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

**Decisões recebidas do PO (2026-09-28):**
1. **Nomenclatura (G4)** → Alternativa A: **`DEC-001-A`** (§9); `H-1..H-8` congelados só para homologação.
2. **Hostname map (G3)** → **fora de escopo** de DEC-001-A; achado arquitetural documentado (irmão §12).
3. **Refs `H7_B_*` (G5)** → classificar **antes** do commit (irmão §4.8): 4 NECESSÁRIO → commit; demais `untracked`.
4. **A0 read-only obrigatório** antes de tocar em map/site → **executado** (irmão §4.6–§4.7); correção de normalização (recomendação 9.1.C do irmão) = STOP separado.
5. **Commit+push somente dos docs necessários**, com antes/depois (`git status`/`git diff --stat`/`git diff --check`) → executado neste ciclo.
6. **A1–A5 não autorizados** — fluxo A0 → G2 confirmado → STOP → decisão do PO.

**Pendente:** **GO/NO-GO dos passos A1–A5** por passo (irmão §10), com pré-condições G8 (re-set do env Vercel em A4) e G9 (`VITE_SUPABASE_URL` NXDOMAIN em A5) — irmão §12. G6 (`BUSINESS_DECISIONS.md`) registra a autorização.

**STATUS: STOP** — diagnóstico + evidências + A0 completos; commit documental autorizado/executado; ação de produção (A1–A5) **não iniciada**. Aguardando GO/NO-GO do PO.
Registro de evidência: `EVIDENCE §4 · INTERPRETATION §1/§4/§5 · GAP §8 · DECISION §11 · STATUS STOP`.
