# Modelo de Domínio Definitivo — Evolução Financeira, Atendimento e Pagamentos

**Status:** Design de domínio aprovado via G0 (29/08/2026) — **sem implementação**
**ADRs de referência:** ADR-017, ADR-018, ADR-019, ADR-020
**Fonte:** `PLANO_EVOLUCAO_FINANCEIRA_ATENDIMENTO_AUDITORIA.md` (ETAPA 2) + decisões das 15 DPs
**Regra:** nenhuma migration/RPC/RLS/alteração funcional até aprovação do G1 (schema design)

---

## 1. Visão geral (domínio de referência)

```
AGENDAMENTO
    ↓
ATENDIMENTO            ← evento operacional independente (attended_at) [ADR-020]
    ↓
RECEBÍVEL              ← comanda = ciclo operacional (status: blocked/open/paid/cancelled) [ADR-017]
    ↓
PAGAMENTO(S)           ← comanda_payments + payment_type [ADR-018]
    ↓
QUITAÇÃO               ← balance = 0 (financeiro derivado) [ADR-017]
    ↓
COMISSÃO               ← elegível após atendimento [ADR-017 D-4]
```

## 2. Entidades

### 2.1 `comanda` — ciclo operacional (status inalterado)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | existente |
| `tenant_id` | uuid | existente |
| `status` | `blocked\|open\|paid\|cancelled` | **operacional**, não financeiro [ADR-017 D-1] |
| `total` | numeric(10,2) | existente |
| `discount_amount` | numeric(10,2) | existente |
| `paid_at` | timestamptz | **legado** — mantido; novos pagamentos usam `comanda_payments` [ADR-018] |
| `appointment_id` | uuid | vínculo com appointment |
| `net_total` | derivado | `total − discount_amount` |
| `paid` | derivado | Σ `comanda_payments` não estornados + legado |
| `balance` | derivado | `net_total − paid` (≥ 0) |

**Invariantes:**
- I1: `status` nunca é alterado por pagamento (ADR-017 D-3).
- I2: `paid_at` (legado) é informativo; fonte nova de verdade = `comanda_payments` [ADR-018 D-3].
- I3: `discount_amount` imutável após o primeiro pagamento (DP12 — alteração pós-registro proibida).

### 2.2 `appointment` — ciclo de atendimento

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | existente |
| `start_time` | timestamptz | `scheduled_at` |
| `status` | enum | `confirmed\|in_progress\|completed\|cancelled` (uso atual) |
| `attended_at` | timestamptz **NULL** | **novo** — evento operacional [ADR-020 D-1] |
| `attended_at_source` | text NULL | marcador de backfill [ADR-020 D-3] |

**Invariantes:**
- I4: `attended_at` é preenchido apenas por RPC de evento operacional autorizada [ADR-019 D-1], nunca pela settle.
- I5: `attended_at` é imutável após preenchimento.
- I6: `attended_at_source` é obrigatório quando valor vier de backfill (não do fluxo em tempo real).

### 2.3 `comanda_payments` — pagamentos explícitos (NOVA)

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | RLS tenant |
| `comanda_id` | uuid FK | dona do recebível |
| `payment_type` | enum | `anticipado\|no_atendimento\|posterior\|parcial\|final` [ADR-018 D-1] |
| `amount` | numeric(10,2) | > 0 |
| `payment_method` | text | enum métodos existente |
| `actor_id` | uuid FK | operador que registrou [ADR-019 D-3] |
| `motivo` / `note` | text NULL | quando exigido (DP14) |
| `reversed_at` | timestamptz NULL | marca de estorno — nunca DELETE |
| `idempotency_key` | text | UNIQUE(tenant, key) — D7 |
| `created_at` | timestamptz | |

**Invariantes:**
- I7: `payment_type` imutável [ADR-018 D-1].
- I8: `amount > 0` e `amount ≤ balance` no momento da inserção (RPC valida).
- I9: `reversed_at` apenas via RPC de estorno autorizada (nunca UPDATE/DELETE).
- I10: idempotência em `idempotency_key`.

## 3. Invariantes financeiros (globais)

| # | Invariante | Fonte |
|---|---|---|
| F1 | `net_total = total − discount_amount` | domínio |
| F2 | `paid = Σ(comanda_payments.amount WHERE reversed_at IS NULL) + Σ(transactions income legado)` | ADR-018 D-3 |
| F3 | `balance = net_total − paid` e `balance ≥ 0` | ADR-017 D-2 |
| F4 | `paid_at` legado não libera atendimento/comissão | ADR-017 D-3/D-4 |
| F5 | Comissão elegível **somente** com `attended_at` preenchido (ou derivado marcado) | ADR-017 D-4 + ADR-020 D-4 |
| F6 | `payment_type` nunca derivado por datas; valor é canônico na origem | ADR-018 D-1 |
| F7 | Estorno nunca apaga: marca `reversed_at` | ADR-018 D-2 |
| F8 | Qualquer escrita financeira exige `tenant_id` correto (RLS) + idempotência | ADR-019 + D7 |

## 4. Contrato de `payment_type` [ADR-018 D-1]

```text
anticipado       → antes do atendimento (Cenário C / R0)
no_atendimento   → na data do atendimento (Cenário A — comportamento atual)
posterior        → após o atendimento (Cenário B — atual)
parcial          → sinal/parcela antes do atendimento (Cenário D)
final            → quitação do saldo (posterior)
```

- Imutável após registro.
- Validação na origem: se `now() < attended_at` ⇒ `anticipado`; se `now() > attended_at` ⇒ `posterior`; pressionado apenas como conferência, o valor gravado é canônico.

## 5. Modelo de `comanda_payments` e cenários

| Cenário | Fluxo |
|---|---|
| **C (antecipado integral)** | 1× `comanda_payments` `payment_type=anticipado`, `amount=net_total` → `balance=0` → comanda "paga (antecipado)" em Contas a Receber (DP5) |
| **D (sinal + saldo)** | 1ª `parcial` (sinal) → `balance>0`; 2ª `final` → `balance=0` |
| **A/B (atual)** | `no_atendimento`/`posterior` via fluxo atual da settle (mapeado para `comanda_payments` na F5) |

## 6. Regras de autorização por papel (resumo — ver ADR-019)

| Operação | Gestão (`isManagerLikeRole`) | Recepção | Barber |
|---|---|---|---|
| Pagamento antecipado integral | ✅ | ✅ **escopo estrito** (comanda elegível + agendamento futuro + valor exato) | ❌ |
| Pagamento parcial (Cenário D) | ✅ | ❌ | ❌ |
| Estorno | ✅ | ❌ | ❌ |
| Alterar valor/desconto pós-pagamento | **proibido (DP12)** | **proibido** | **proibido** |
| Registrar atendimento (`attended_at`) | ✅ | ❌ | ✅ (o próprio) |
| Desbloquear comanda | ✅ | ✅ com motivo (DP14) | ❌ |
| Baixa administrativa | ✅ | ❌ | ❌ |

## 7. Estratégia de `attended_at` e backfill (resumo — ver ADR-020)

```text
comprovado (evidência real)      → attended_at = data real, source='backfill_evidence'
pagamento + appointment passado  → attended_at = NULL (preferido) ou inferido COM flag 'inferred_from_payment'
sem evidência                    → attended_at = NULL  (padrão absoluto)
pagamento antecipado             → NUNCA é atendimento
```

## 8. Eventos de domínio (extensão do bus — aditivos)

| Evento | Emissor | Papel |
|---|---|---|
| `AttendanceCompleted` | RPC de atendimento (F2) | elegibilidade comissão [ADR-017 D-4 / ADR-020 D-1] |
| `ComandaUnlocked` | RPC de desbloqueio (F3) | auditoria |
| `PaymentRegistered` | RPC de pagamento (F5) | auditoria + Contas a Receber |
| `PaymentReversed` | RPC de estorno (F5) | auditoria |
| `AppointmentRescheduled` | fluxo reagendamento | auditoria (DP14 motivo) |

Sem novo mecanismo — reuso de `event_store`/`outbox`/subscribers existentes (ADR-006/007/014/016).

## 9. Não-escopo desta etapa

- NENHUMA migration criada.
- NENHUMA RPC alterada/criada.
- NENHUM RLS/policy alterada.
- NENHUM componente alterado.
- Nenhuma regra de comissão alterada (FIX-001 intacto).

## 10. Dependências de implementação (G1+)

```
G0 (domínio, ADR 017-020) → G1 (schema design: attended_at, comanda_payments, enum)
  → F0 (reconciliação schema) → F1 (segurança RPC) → F2 (atendimento) → F3 (desbloqueio)
  → F4 (comissão) → F5 (pagamentos) → F6 (audit) → F7 (RLS) → F8 (UX) → F9 (testes) → F10 (deploy)
```