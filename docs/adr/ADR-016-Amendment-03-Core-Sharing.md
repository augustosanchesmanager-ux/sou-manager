# ADR-016 Amendment-03 — Core Sharing & Integrity Contract (D8)

**Status:** Proposed (draft — **AGUARDA aprovação do PO** antes de qualquer código)
**Date:** 2026-08-27
**Deciders:** PO (Augusto) + OpenCode
**Prerequisite:** Amendment-01 (Execution Boundary 🟢), Amendment-02 (Data Contract 🟢), Gate A (DB surface provado 🟢), Decisão PO Core Sharing (Option B)
**Theme:** Como o D8 Worker reusa o Financial Domain Core (1 fonte) no bundle real com Supabase CLI **v2.95.6**, com integrity gate.

---

## 1. Problema (confirmado)

O worker Edge Function precisa **executar** o cálculo de comissão (o mesmo do `createCommissionRecordHandler` certificado). O `Financial Domain Core` vive em `domain/commission/` (fonte única). Para deploy na Edge Function (Deno), o core precisa estar dentro do pacote empacotável.

**Limitação confirmada (CLI v2.95.6, pin do repo):** o bundler do Supabase **não empacota de forma confiável imports fora de `supabase/functions/`** (regressões entre 2.107–2.109; só em beta 2.109.1 parcialmente; `--use-api` ainda dropa paths externos). Nenhuma função atual do repo importa código fora do próprio folder (padrão estabelecido = self-contained).

**Regra PO:** sem import externo experimental; sem duplicar; sem reescrever em SQL. **(Decisão: Option B)** — Core permanece fonte única; worker recebe **artefato determinístico** em `supabase/functions/_shared/`; integrity/equivalence gate.

---

## 2. Boundary canônico do Financial Domain Core (para o worker)

O worker só precisa de um subconjunto estável do core. Closure de dependências:

| Arquivo canônico (`domain/…`) | Exports usados pelo worker |
|-------------------------------|----------------------------|
| `domain/commission/calculate.ts` | `resolveCommissionBase`, `detectZeroReason`, `resolveFinancialBase`, `calculateParticipantPayout`, `calculateParticipantBaseValue`, `calculateTotalPayouts`, `calculateCommissionValue`, `isCommissionEligible`, `getEffectiveRate`, `getDefaultRateForRole`, `calculateCommissionReversal` |
| `domain/commission/participants.ts` | `normalizeCommissionParticipants` |
| `domain/commission/types.ts` | `ParticipantRow`, `StaffRoleLike`, `FinancialBaseInput`, `FinancialBaseResult`, `CommissionBaseChoice`, `ZeroCommissionReason`, `ServiceItemLike` |
| `shared/numbers/normalize.ts` | `normalizePercentage` |

**Equivalência comprovada** (validada contra `src/lib/staff/roles.ts`)):
- `isCommissionEligible` ≡ `receivesCommission` (barber|seller true; manager+rate>0 true; senão false).
- `getEffectiveRate` ≡ `getEffectiveCommissionRate` (usam `normalizePercentage` ≡ `normalizeSavedRate`, ambos `>1 → /100`, NaN→0).
- ⚠️ Requisito: **teste de equivalência automatizado** deve *provar* isso (não basta afirmar) — ver §5.

**Não pertence ao core do worker:** `src/lib/staff/roles` (browser-coupled), repositórios/adapters, `FinanceProvider`, hooks, lógica de UI.

---

## 3. Artefato determinístico (Option B)

```text
domain/commission/{calculate,participants,types}.ts
shared/numbers/normalize.ts            ← SOURCE OF TRUTH (única)
        │
        │  scripts/d8/export-core.mjs   (build determinístico, esbuild → Deno)
        ▼
supabase/functions/_shared/financial-core/index.ts   ← ARTEFATO GERADO
```

- **Um único arquivo self-contained** `index.ts` (bundle de todo o closure). Isso **elimina** o problema de imports extensionless (`'../../shared/numbers/normalize'`) no Deno — o bundle resolve tudo e emite um módulo único sem imports relativos externos.
- O bundle usa **esbuild** (já presente no monorepo Vite), `--format=esm`, `--target=deno`, `--platform=browser` (ou neutral), sem externals, com minify desligado para legibilidade/hash estável. Saída `.ts`.
- `index.ts` re-exporta apenas o que o worker consuma (ver §2), nominal.
- **`_shared` é um artefato gerado, nunca editado manualmente.** `.gitignore` NÃO o ignora (é versionado) — em vez disso, o **integrity gate** é o guarda: divergência entre artefato e canônico → STOP.

---

## 4. Integrity / Equivalence Gate (obrigatório)

### 4.1 Manifest (`core.sha256.json`)
Gerado pelo `export-core.mjs` e versionado junto ao artefato. Contém:
- `source`: array de `{ path, sha256 }` de cada arquivo canônico (§2).
- `artifact`: `sha256(index.ts)` **after build**.
- `tooling`: `{ esbuild, node, denoTarget }` p/ reprodutibilidade.
- `consumerBlobs`: lista de exports esperados (guarda contra remoção acidental).

### 4.2 Commands (no build real, CLI v2.95.6)

```bash
npm run d8:build    # node scripts/d8/export-core.mjs → gera _shared/... e core.sha256.json
npm run d8:verify   # node scripts/d8/export-core.mjs --verify
```

`d8:verify`:
1. Recalcula SHA-256 dos fontes canônicos → compara com `core.sha256.json.source`. **Diferente → STOP** (fonte mudou sem rebuild).
2. Gera o bundle num **temp dir** a partir dos fontes atuais → compara byte-a-byte com o `index.ts` versionado. **Diferente → STOP** (artefato desatualizado / editado à mão).
3. Verifica que `index.ts` contém os `consumerBlobs` esperados (exports).
4. `d8:verify` roda em **CI/auditoria gating** (ex.: `predeploy`) e pode ser chamado pelo PO a qualquer momento.

### 4.3 Equivalence do behavior (teste unitário)
`tests/d8/equivalence.test.ts`: para um conjunto de amostras (roles: barber/seller/manager+rate>0/manager+rate=0/receptionist; rates: 0.5, 50, 0, null, '50'), afirma:
- `isCommissionEligible(s)` === `receivesCommission(s)` (equivalente do browser).
- `getEffectiveRate(s)` === `getEffectiveCommissionRate(s)`.
- `resolveFinancialBase`/`calculateCommissionValue` produzem **os mesmos valores** que o handler certificado (fixture do teste existente de `createCommissionRecordHandler`).

Isso **prova** que o worker recalcula exatamente o que o browser handler certificado calcula → sem drift D7.

---

## 5. Integração no build real (CLI v2.95.6)

- **Import do worker:** `import { resolveFinancialBase, calculateCommissionValue, ... } from '../_shared/financial-core/index.ts'`.
  `_shared/` fica **dentro de `supabase/functions/`** → o CLI v2.95.6 empacota estavelmente (sem import externo experimental).
- **Pipeline de deploy do worker:**
  `d8:build` (gera artefato) → `d8:verify` (STOP se divergir) → `supabase functions deploy worker-dispatcher` (CLI 2.95.6, sem `--use-api`; bundle local via Docker).
- **Agendamento:** Supabase Cron (config.toml schedule) → invoca `worker-dispatcher` (Decisão PO: Supabase Cron → Edge Function).
- **Credencial:** `worker_dispatcher` via JWT minted no worker a partir de `SUPABASE_JWT_SECRET` (Decisão PO) — sem `service_role`.

---

## 6. STOP conditions (formalizadas)

| Condição | Ação |
|----------|------|
| Cálculo duplicado em Deno | 🔴 STOP |
| Cálculo duplicado em PL/pgSQL | 🔴 STOP |
| Cópia manual divergente no `_shared` | 🔴 STOP (integrity detecta) |
| Import externo dependente de bundler experimental | 🔴 STOP |
| Worker usando `service_role` p/ acessar tabelas diretamente | 🔴 STOP |
| Alteração da regra financeira certificada sem nova certificação D7 | 🔴 STOP |
| `d8:verify` falha (hash/equivalência) | 🔴 STOP deploy |

---

## 7. Gatilho de implementação

Este Amendment-03 **define o contrato**, mas **não autoriza código ainda**. Após aprovação do PO:
1. `scripts/d8/export-core.mjs` (gera artefato + manifest).
2. `tests/d8/equivalence.test.ts` (prova equivalência com o handler certificado).
3. `supabase/functions/worker-dispatcher/` (orquestra claim → context → calculate(Core `_shared`) → insert → mark; heartbeat; agendamento).
4. Adapters worker → narrow RPCs (Gate A já provado no banco).
5. Testes de concorrência/chaos (reuso harness Gate A), auditoria, build+typecheck+testes, docs, commit, push.

---

## 8. Estado

```text
Gate A (DB/RPC surface)   🟢 provado (concorrência 2×/20×, isolamento, idempotência)
Core Sharing (Option B)   🟢 decidido
Amendment-03 (este)       🟡 AGUARDA APROVAÇÃO
Implementação D8          🔴 bloqueada até aprovação deste contrato
```

**Nenhum código/artefato/produção alterado além do Gate A (já commitado).**

---

## 9. Decisões pendentes do PO

1. **Aprovar o boundary canônico** (§2) — exatamente esses 4 arquivos / exports.
2. **Aprovar o artefato único self-contained** (bundle esbuild → `_shared/financial-core/index.ts`) (§3).
3. **Aprovar o integrity gate** com `d8:verify` como **STOP obrigatório** no deploy/CI (§4).
4. **Aprovar o teste de equivalência** (`isCommissionEligible`/`getEffectiveRate` ≡ browser handler certificado) como pré-requisito (§4.3).
5. **Aprovar o import `../_shared/financial-core/index.ts`** (dentro de `supabase/functions/`, estavelmente empacotado pelo CLI 2.95.6) (§5).
