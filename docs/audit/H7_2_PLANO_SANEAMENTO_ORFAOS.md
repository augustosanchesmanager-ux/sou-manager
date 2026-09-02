# H7.2 — Plano de Saneamento de Comandas Órfãs (Fase 3.7)

> **Status:** CONCLUÍDO — EXECUTADO e VERIFICADO contra produção.
> **Tenant alvo:** `b716e290-f7f6-4449-b790-5ae9dcdadcab` (Sanchez Barber)
> **Branch:** `chore/saneamento-comandas-orfas-historicas` (isolada de `ae38faa`)
> **Data:** 2026-08-29
>
> **Resumo da execução:**
> - **FASE A:** aplicada (24/24 comm `membership_credit_effect = false`), post-gate A aprovado.
> - **FASE B:** aplicada (25/25 `status = 'cancelled'`), **POST-GATE B APROVADO** em 9/9 invariantes.
> - **Verificação read-only independente:** corrobora os resultados (25/25 cancelled, 0 transaction, 0 paid, 0 exceções).
> - **Runner:** `scripts/ops/saneamento-orfas/run.ps1` (`supabase db query --linked`).
> - Evidências em `scripts/ops/saneamento-orfas/logs/`.

---

## 1. Contexto

A auditoria read-only (ver `docs/audit/H7_1_INVESTIGACAO_S3_READONLY_20260816.md` e os
arquivos `audit_*.sql` na raiz) encontrou **27 comandas históricas** no tenant
`b716e290-f7f6-4449-b790-5ae9dcdadcab` com:

- `comandas.status = 'open'`
- `appointments.status = 'cancelled'`
- `comandas.membership_credit_effect = true`

Destas 27, **nenhuma** tem item com `unit_price = 0`, portanto nenhuma alteração de
`membership_credit_effect` altera a detecção atual de crédito na comissão
(`domain/commission/calculate.ts` só ativa com `unit_price = 0`).

O saneamento é **histórico e automatizado**: não há usuário humano a atribuir como
autor do cancelamento, e **nenhum cancelamento histórico deve criar `transaction`**.

---

## 2. Por que EXISTEM DUAS fases

As duas fases corrigem **problemas independentes** com **alvos diferentes** e
**efeitos colaterais diferentes**:

| | FASE A | FASE B |
|---|---|---|
| **Problema** | Marcador `membership_credit_effect = true` **sem** assinatura/ciclo que cubra `created_at` | Comanda órfã `open` vinculada a appointment `cancelled`, sem `transaction`, `financial_effect=true` |
| **Alvos (crescimento)** | `A ⊆ B` (as 24 sem assinatura) | `B` (25) = A + 3 com assinatura (`15ef619d`, `f74298c0`, `7dc9fbbb`) |
| **Alteração** | `membership_credit_effect` true → false (1 campo) | `status` → `cancelled` + campos de cancelamento (5 campos) |
| **Risco** | Baixo (flag de interpretação de comissão) | Maior (mudança de estado de comanda aberta) |
| **Guards extra** | `unit_price = 0` ausente; sem ciclo cobrindo data | zero `transaction`; appointment ainda `cancelled` |

### Por que NÃO combinar em um único script

1. **Alvos diferentes.** A ⊆ B, mas não são idênticos. Combinar exigiria lógica condicional
   por comanda (24 com mudança de flag, e destas 24 + 3 com mudança de status). Isso
   torna o `UPDATE` ambíguo e o `post-check` impraticável de verificar por subpopulação.
2. **Transações isoladas.** Se Fase A falhar, Fase B ainda deveria poder rodar? Não —
   a política exige **aprovadores separados** e **auditoria independente**. Cada fase é
   uma transação própria e uma aprovação própria do PO.
3. **Risco/rollback distintos.** Um rollback numa fase não deve arrastar a outra.
4. **Guardas específicas.** Fase A exige guard de `unit_price=0`/ciclo de assinatura;
   Fase B exige guard de `transaction=0`/`paid`. São conjuntos de invariantes diferentes.
5. **Idempotência independente.** Após Fase A, ainda há 25 alvos para Fase B; se fossem
   combinadas, a segunda execução não conseguiria distinguir "já fez A" de "não fez B".

**Conclusão:** Fase A e Fase B são entregas separadas, cada uma com seu script, sua
transação, seus guards e sua aprovação.

---

## 3. FASE A — Alvos e escopo

### População da FASE A (criterio congelado)

As **24** comandas da população auditada (27) que **NÃO possuem assinatura** (qualquer
status atual) **cujo ciclo cubra `created_at`**.

- 27 totais − 3 com assinatura na data (`15ef619d`, `f74298c0`, `7dc9fbbb`) = **24**.

> **NOTA DE CONTEÚDO (IDs):** A definição dos alvos é um **critério** (recomputado na
> execução sobre os dados vivos), **não uma lista literal de UUIDs**. Isso evita o risco
> de hardcodar UUIDs de produção não verificados. Os 24 UUIDs concretos são emitidos pelo
> **relatório** ao fim do script (`SELECT` de auditabilidade) no template `{uuid}`. As
> **exceções conhecidas** com identificadores confirmados estão em §5.

### Alterações permitidas (FASE A)

- `comandas.membership_credit_effect` true → false (somente).

### NÃO altera (FASE A)

`status`, `financial_effect`, `total`, `items`, `transactions`, `subscriptions`,
`credits`, comissão, ou qualquer outro campo.

---

## 4. FASE B — Alvos e escopo

### População da FASE B (criterio congelado)

As **25** comandas com:

- `comandas.status = 'open'`
- `appointments.status = 'cancelled'`
- `comandas.financial_effect = true`
- **zero** `transactions` (`source_type='comanda'`, `source_id=comandas.id`)
- **não** `paid`
- **excluindo** explicitamente as 2 exceções financeiras (§5)

### Alterações permitidas (FASE B)

- `status = 'cancelled'`
- `cancellation_type = appointments.cancellation_type`
- `cancelled_at = now()` (timestamp do saneamento)
- `cancelled_by_user_id = NULL` (saneamento automatizado, sem usuário humano)
- `closure_note = 'Saneamento historico: comanda orfa vinculada a appointment cancelado.'`

### NÃO altera (FASE B)

`financial_effect`, `total`, `transactions`, `payment_method`, `comanda_items`,
`customer_credits`, `customer_subscriptions`. **NÃO cria `transaction`. NÃO cancela `paid`.**
`hidden_from_financial` **não** é alterado (mantém o valor atual).

---

## 5. Exceções financeiras (NUNCA entram na FASE B)

Identificadores confirmados da auditoria:

| Comanda | Motivo da exclusão |
|---|---|
| `d2845e32-a20c-47c7-9484-7992487c744b` | possui **1 `transaction`** |
| `4077d722-327b-4fd1-a0ba-06850aec9d03` | `financial_effect = false` + **2 `transactions`** |

Essas comandas **não** podem ser canceladas pela Fase B; exigiriam tratamento manual/Finance.

> Nota: conforme decisão registrada, essas 2 comandas **permanecem** na FASE A (correção
> do marcador `membership_credit_effect`), pois a Fase A não toca `transactions` nem
> `financial_effect`. A Fase A não as exclui.

---

## 6. 3 comandas com assinatura (fora da FASE A, dentro da FASE B)

| Comanda | Assinatura ativa cujo ciclo cobre `created_at` |
|---|---|
| `15ef619d-991c-4075-92c4-15431e35b0c8` | sim |
| `f74298c0-e369-40fc-886a-d1b81c9d5621` | sim |
| `7dc9fbbb-f3f7-4603-9f89-a4634c83452e` | sim |

Estas **não** estão na FASE A (têm assinatura, logo não corrigimos o marcador), mas
**estão** na FASE B (são órfãs; são canceladas sem criar transação).

---

## 7. Guards implementados (em cada script)

### FASE A (`saneamento_fase_A_membership_credit.sql`)

1. **tenant correto** — toda a CTE filtra `tenant_id = b716e290-...`.
2. **exatamente 24 alvos** — `COUNT(*) = 24`, senão `RAISE EXCEPTION` (aborta).
3. **`membership_credit_effect` ainda `true`** em todos os alvos — senão aborta.
4. **nenhum alvo possui assinatura cujo ciclo cubra `created_at`** — imposto pela CTE;
   divergência → count ≠ 24 → aborta.
5. **nenhum item dos 24 com `unit_price = 0`** — `COUNT(*)` deve ser 0, senão aborta.

### FASE B (`saneamento_fase_B_orphan_comandas.sql`)

1. **tenant correto** — CTE filtra `tenant_id = b716e290-...`.
2. **exatamente 25 alvos** — `COUNT(*) = 25`, senão aborta.
3. **todos ainda `open`** — imposto pela CTE.
4. **appointment correspondente ainda `cancelled`** — imposto pela CTE.
5. **`financial_effect` ainda `true`** — imposto pela CTE.
6. **`transactions = 0`** — imposto pela CTE (`NOT EXISTS`).
7. **`cancellation_type` obtível do appointment** — guard de existência da coluna
   `appointments.cancellation_type` via `information_schema`.

Qualquer divergência → `RAISE EXCEPTION` (a transação inteira aborta).

---

## 8. Transação e idempotência

Cada script:

```
[guards  → RAISE if divergir]
BEGIN;
  UPDATE ... (idempotente: WHERE ... status='open' / membership_credit_effect=true)
  DO post-check (RAISE → ROLLBACK implícito se falhar)
COMMIT;
```

- **Transação própria** por fase (`BEGIN; ... COMMIT;`).
- **Post-check** após o `UPDATE`: se falhar, `RAISE EXCEPTION` → rollback.
- **Idempotência:** a 2ª execução encontra **zero alvos** (flag já `false` / status já
  `cancelled`), então o guard de contagem (24/25) aborta com `RAISE EXCEPTION` — não
  reaplica nada e não causa dano.

---

## 9. Não são migrations; execução via runner autorizado

- Os scripts de fase vivem **fora de `supabase/migrations/`**. **NÃO** são migrations e **NÃO**
  devem ser aplicados via Supabase CLI/`supabase db push`.
- A execução foi feita pelo **runner operacional automatizado** (`scripts/ops/saneamento-orfas/run.ps1`),
  que conecta via `supabase db query --linked` e aplica: preflight → capture do lote → UPDATE →
  post-gate, cada um em transação própria com guards.
- **Itinerário real (2026-08-29), após aprovação explícita do PO:**
  1. FASE A executada e consolidada (`membership_credit_effect false`, 24/24).
  2. Correção do mecanismo de pós-gate (post-gate A = só invariantes A; identidade do lote B capturada antes do UPDATE).
  3. FASE B executada (`status='cancelled'` nos 25 alvos), POST-GATE B aprovado (9/9).
- Nenhuma `FASE A` foi reexecutada; nenhuma migration foi criada; nenhum código de runtime alterado.

---

## 10. Arquivos relacionados

- `scripts/ops/saneamento-orfas/run.ps1` — **runner** autorizado (preflight/execute, captura de lote, post-gates)
- `scripts/ops/saneamento-orfas/preflight.sql` — pré-flight read-only (invariantes A + B)
- `scripts/ops/saneamento-orfas/fase-a.sql` — FASE A (membership true→false), **executada**
- `scripts/ops/saneamento-orfas/fase-b.sql` — FASE B (open→cancelled), **executada**
- `scripts/ops/saneamento-orfas/postflight-a.sql` — post-gate A (somente invariantes A)
- `scripts/ops/saneamento-orfas/capture-b.sql` — captura da identidade do lote B (25 ids)
- `scripts/ops/saneamento-orfas/postflight-b.sql` — post-gate B (valida os mesmos 25 ids capturados)
- `scripts/ops/saneamento-orfas/README.md` — guia do runner
- `scripts/ops/saneamento-orfas/logs/` — evidências: logs de execução, artefato do lote capturado, postflight-b injetado
- `saneamento_fase_A_membership_credit.sql` / `saneamento_fase_B_orphan_comandas.sql` — versões preliminares (raiz)
- `preview_saneamento_A_membership_credit.sql`, `preview_saneamento_B_cancelamento.sql` — previews read-only
- `audit_causality_membership_credit.sql` — auditoria read-only (5 queries A–E)
- `docs/audit/H7_1_INVESTIGACAO_S3_READONLY_20260816.md` — investigação original

---

## 11. Checklist de aprovação (PO) — estado 2026-08-29

- [x] Conferir `count_a_preview = 24` (preview A, read-only) — **confirmado** (pré-flight A=24, flags true=0 pós-aplicação)
- [x] Conferir `count_b_preview = 25` (preview B, read-only) — **confirmado** (pré-flight B=25, status open=25)
- [x] Revisar guards de Fase A e Fase B (seções 7–8)
- [x] Aprovar Fase A (exclusivamente marcador) — **executada e consolidada**
- [x] Aprovar Fase B (exclusivamente cancelamento sem transação) — **executada, POST-GATE B aprovado**
- [x] Executar via runner operacional autorizado (`scripts/ops/saneamento-orfas/run.ps1`)

---

## 12. Registro de execução (FASE B — 2026-08-29, aprovação explícita do PO)

### POST-GATE B (runner, `postflight-b.sql` com os 25 ids capturados do lote)

| Invariante | Esperado | Encontrado |
|---|---|---|
| `b_total_capturado` | 25 | **25** OK |
| `b_alvos_cancelled` | 25 | **25** OK |
| `b_restam_open` | 0 | **0** OK |
| `b_nao_cancelled` | 0 | **0** OK |
| `b_nao_appointment_cancelled` | 0 | **0** OK |
| `b_financial_effect_nao_true` | 0 | **0** OK |
| `b_transactions` | 0 | **0** OK |
| `b_paid` | 0 | **0** OK |
| `b_excecoes_presentes` | 0 | **0** OK |

→ **POST-GATE B APROVADO** (exit 0).

### Verificação read-only independente (query própria usando os mesmos 25 ids do artefato)

| Métrica | Resultado |
|---|---|
| `total_capturado` | 25 |
| `cancelled` | 25 |
| `abertas` (open) | 0 |
| `nao_cancelled` | 0 |
| `nao_appt_cancelled` | 0 |
| `financial_effect_nao_true` | 0 |
| `transactions` | 0 |
| `paid` | 0 |
| `excecoes` | 0 |
| `com_closure_saneamento` | **25/25** — todas as comandas saneadas têm o `closure_note` exclusivo do saneamento |

### Confirmação de escopo (nenhuma alteração fora do lote)

| Métrica | Resultado |
|---|---|
| Total de comandas com `closure_note` de saneamento | **25** (exatamente o lote; não 96) |
| Órfãs B que ainda permanecem `open` | **0** |
| Comandas saneadas com `transaction` criada | **0** (ledger inalterado) |

### Evidências preservadas (`scripts/ops/saneamento-orfas/logs/`)

- `saneamento-execute-20260829-162232.log` — execução anterior (FASE A, travada no post-gate por defeito de medição)
- `saneamento-execute-20260829-164341.log` — **execução da FASE B (POST-GATE B aprovado)**
- `lote-b-capturado-20260829-164341.json` — **artefato de identidade do lote (25 ids)** usado no post-gate B
- `postflight-b-20260829-164341.sql` — post-gate B com os 25 ids **injetados** (não placeholder)
- `saneamento-preflight-20260829-163511.log` — pré-flight read-only aprovado (A=24, B=25)
