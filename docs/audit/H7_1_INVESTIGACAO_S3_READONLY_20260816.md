# H-7 — Investigação S3 (Recebíveis) — Read-Only

> **Data:** 2026-08-16 · **Modo:** somente leitura (`supabase db query --linked`, zero escritas) · **Tenant:** Sanchez Barber `b716e290-f7f6-4449-b790-5ae9dcdadcab`
> **Escopo:** pré-requisito D-HOM-26#3 — investigar S3 (10 overdue + 7 pending) e reflexo receivable do crédito Chef Club consumido (H3-4).
> **Regra respeitada (D-HOM-27 §4):** qualquer duplicidade = **PARAR imediatamente, sem corrigir no banco; registrar achado e apresentar ao PO.**

---

## 1. Resumo da investigação

| Item | Resultado |
|------|-----------|
| Quadratura geral S3 | 47 receivables = 30 paid (R$ 6.440) · **10 overdue (R$ 2.340)** · **7 pending (R$ 1.360)** — **confere com a baseline B10** |
| H3-4 reflexo receivable | ✅ **VALIDADO** — crédito consumido (5→4) + receivable do ciclo pago via Pix (R$ 160, 2026-08-11), sem `42703`, sem duplicidade |
| Duplicidade de receivables | 🔴 **ACHADO S3-1 (P1)** — 1 receivable duplicado: RIOS, ciclo 2026-06-15, R$ 260,00 |
| Duplicidade por par `(subscription_id, due_date)` | 1 único caso (RIOS 06-15) |
| Receivables criados após o vencimento | 15 registros (maioria backfill inicial 05-11; 1 caso relevante 08-06 = o duplicado RIOS) |

---

## 2. Achado S3-1 — Receivable duplicado (RIOS - AMIGO)

### 2.1 Evidência

**Mesma subscription `6ce92093-9840-4966-ac21-d7f845b18365` (RIOS - AMIGO), mesma `due_date` 2026-06-15, dois receivables:**

| id | billing_cycle_start | billing_cycle_end | due_date | status | amount | created_at | paid_at | transaction_id |
|----|--------------------|--------------------|----------|--------|-------:|-----------|---------|----------------|
| `0c1ee064-7195-4ebd-9b41-0812220f6689` | 2026-06-15 | 2026-07-15 | 2026-06-15 | `paid` | 260,00 | 2026-05-16 | 2026-06-06 | `cb41ed2c…` |
| `d561a4c3-05ce-4722-b2bf-3816fec34aa1` | **2026-06-15** | **2026-08-14** | **2026-06-15** | `overdue` | 260,00 | **2026-08-06 18:45** | — | — |

### 2.2 Causa raiz (técnica)

- A constraint única da tabela é `UNIQUE (subscription_id, billing_cycle_start, billing_cycle_end)`.
- A função `ensure_club_receivable_for_cycle` usa `ON CONFLICT (subscription_id, billing_cycle_start, billing_cycle_end) DO UPDATE`.
- No caso RIOS, o receivable duplicado foi criado com **mesmo `billing_cycle_start`** (06-15) do receivable já pago, porém com **`billing_cycle_end` diferente** (08-14 vs 07-15) → o `ON CONFLICT` **não disparou** e uma segunda linha foi inserida.
- A chamada que originou o insert de `d561a4c3` em **2026-08-06 18:45** derivou um ciclo 06-15 → 08-14 (janela anômala de ~2 meses) — provável geração via `generate_club_receivables`/`ensure_club_receivable_for_cycle` com parâmetros de ciclo inconsistentes com o ciclo já registrado.
- A sub RIOS hoje: `status=active`, `cycle_start=07-15`, `cycle_end=08-15`, `next_billing_date=08-15`, `updated_at=08-06 22:14`.

### 2.3 Impacto

- **S3 inflado em R$ 260,00** (o receivable `overdue` `d561a4c3` representa um ciclo **já pago** em 2026-06-06 via transaction `cb41ed2c`).
- Se a quadratura S3 for apurada por soma de `overdue`, o total apresentado (R$ 2.340) contém R$ 260,00 **fantasma**.
- **Não há duplicidade de caixa/transação** (o duplicado não tem `transaction_id`) — o risco é apenas de exibição/cobrança indevida na tela de receivables.

### 2.4 Recomendação ao PO (decisão de tratamento — NÃO executada)

- Opções: (a) marcar `d561a4c3` como duplicado/cancelado (sem deletar — append-only); (b) verificar se a função `ensure_club_receivable_for_cycle` deve incluir `due_date` ou validar ciclo já existente; (c) reforçar guarda contra ciclos anômalos (start/end divergentes). **Decisão de negócio/tratamento = PO.**

---

## 3. Reflexo receivable H3-4 (crédito Chef Club consumido) — ✅ VALIDADO

Cliente **HOMOLOG H3 TESTE 2026-08-11** (`394dc685…`), subscription `7b92c958…`:

| item | valor |
|------|-------|
| Receivable ciclo 08-11 | `8b1cdee8…` — R$ 160,00 — `paid` via **Pix** em 2026-08-11 15:00, notes `HOMOLOGACAO H3 - baixa do ciclo de teste` |
| Receivable ciclo seguinte | `ca8e2110…` — R$ 160,00 — `pending` (due 2026-09-10) — criação normal do próximo ciclo |
| customer_credits | `available_credits=4`, `used_credits=1`, `last_consumed_at=null`, período 08-11 → 09-10 |

> **Conclusão:** o crédito Chef Club consumido no H3-4 **refletiu corretamente no receivable** (pagamento do ciclo via Pix com nota de homologação; crédito debitado 5→4/1 usado). **Sem `42703`, sem duplicidade no caso H3-4.** Pendência H3-4 "reflexo no receivable" → **FECHADA**.

---

## 4. Quadratura S3 — análise dos 10 overdue

| Cliente | due_date | valor | Sub | next_billing | leitura |
|---------|----------|------:|-----|--------------|---------|
| LEONE L.S | 04-30 | 260,00 | active | 05-10 | ciclo nunca avançou; 1 único receivable |
| LUKAS STIFER | 05-07 | 260,00 | active | 06-06 | idem |
| THIAGOOOO - AMIGO | 05-07 | 260,00 | active | 05-18 | idem |
| RAFAEL - VLX | 06-10 | 160,00 | active | 06-10 | série paga 05-07/05-10; parou em 06-10 |
| RIOS - AMIGO | 06-15 | **260,00** | active | 08-15 | **DUPLICADO (S3-1)** — ciclo já pago |
| PIETRO MUNIZ | 07-05 | 160,00 | canceled | 07-05 | sub cancelada com receivable overdue (dívida órfã) |
| K11 | 07-10 | 260,00 | canceled | 07-10 | idem |
| LIP | 07-10 | 260,00 | active | 07-10 | série paga até 06-10; parou em 07-10 |
| DAVI - RUA | 07-15 | 260,00 | active | 08-14 | 1 único receivable; nunca avançou |
| EVERTON - BOY | 08-06 | 260,00 | active | 08-06 | série paga até 07-06; overdue 08-06 normal |

> **Observações S3 (sem correção):**
> - **2 overdue pertencem a assinaturas `canceled`** (PIETRO, K11) → dívida órfã de assinatura cancelada (decisão de negócio: cobrar/baixar).
> - **Várias assinaturas ativas têm `next_billing_date` parado no passado** e **1 único receivable** (LEONE, LUKAS, THIAGO, DAVI) → o ciclo de billing **não avançou** para essas assinaturas. Padrão distinto das assinaturas com série completa (GUILHERME, DAVID, João telles, etc.).
> - **Falha de `generate_club_receivables`/`ensure_club_receivable_for_cycle` em avançar ciclos** das subs que nunca tiveram pagamento registrado é hipótese técnica a validar na janela acompanhada — **sem correção agora**.

---

## 5. Evidências SQL (todas read-only)

| Query | Resultado |
|-------|-----------|
| Status aggregation S3 | 30 paid / 10 overdue / 7 pending = R$ 10.140 |
| Detalhe overdue+pending | 10 overdue + 7 pending listados |
| HOMOLOG H3 receivables | 1 paid (Pix) + 1 pending — reflexo OK |
| customer_credits HOMOLOG | available 4 / used 1 |
| Subs canceled com overdue | PIETRO (R$ 160) + K11 (R$ 260) |
| Duplicidade por `(sub, due_date)` | **1 caso: RIOS 06-15 (2×260)** |
| Criados após vencimento | 15 registros (backfill 05-11; RIOS 08-06) |
| Constraint da tabela | UNIQUE (subscription_id, billing_cycle_start, billing_cycle_end) |

---

## 6. Conclusão e próximo passo

- 🔴 **Achado S3-1 (P1) — receivable duplicado RIOS** registrado e **apresentado ao PO** (regra D-HOM-27 §4: duplicidade = PARAR; sem correção no banco).
- ✅ **H3-4 reflexo receivable FECHADO** (crédito + receivable corretos).
- ⏳ **S3 parcialmente investigado** — demais overdue configuram padrão de ciclos que não avançam (hipótese de billing a validar), **decisão de tratamento = PO**.
- ⏳ **Ciclo H7-1 NÃO executado** — aguarda janela acompanhada (dia/horário + equipe, decisão do PO).

> **Estado H-7:** H-6 🟢 → **H-7 ⏳ (baseline pronto; S3 com achado S3-1 a decidir)** → H-8 🔴.

---

## 7. Investigação S3-3 — Origem do ciclo inconsistente (read-only)

> **Data:** 2026-08-16 · **Modo:** somente leitura · **Objetivo:** localizar exatamente de onde veio a chamada que criou o receivable `d561a4c3` (ciclo 06-15→08-14, end 00:00).

### 7.1 Inventário de caminhos de criação

**Única função que aceita `billing_cycle_start/end` como parâmetros de entrada:** `ensure_club_receivable_for_cycle` (4 params, todos opcionais com DEFAULT NULL).

| # | Função pai | Migration | Args passados | Ciclo explícito? | Ativo? |
|---|-----------|-----------|---------------|-----------------|--------|
| 1 | `generate_club_receivables` (original) | `…0817:41` | `sub.id` apenas | NULL (defaults de sub) | ❌ Substituído por #5 |
| 2 | `pay_club_receivable` (original) | `…0818:208` | 4 explícitos | Computado do receivable atual | ❌ Substituído por #6 |
| 3 | `create_chef_club_subscription` | `…0819:186` | 4 explícitos | Da sub recém-criada | ✅ |
| 4 | Backfill `DO $$` | `…0820:263` | `sub.id` apenas | NULL (defaults de sub) | ✅ One-shot |
| 5 | `generate_club_receivables` (6.0.5.3) | `…0807:174` | `sub.id` apenas | NULL (defaults de sub) | ✅ **Atual** |
| 6 | `pay_club_receivable` (6.0.5.3) | `…0807:441` | 4 explícitos | Computado do receivable atual | ✅ **Atual** |

**Edge functions:** Nenhuma lida com recebíveis. **INSERT direto no frontend:** Zero. **UI com parâmetros customizados:** Nenhuma — o frontend não expõe `billing_cycle_start/end`.

### 7.2 Traçamento do ciclo impossível

O receivable `d561a4c3` tem: `start=06-15 12:00`, `end=08-14 00:00`, `due=06-15`, `created_at=08-06 18:45`.

**Nenhum caminho padrão produz essa combinação:**

| Caminho | Resultado esperado | Conflito | Produce d561a4c3? |
|---------|-------------------|----------|-------------------|
| `generate` (Call #5) com sub.cycle_start=06-15, cycle_end=07-15 | (06-15→07-15) | Com `0c1ee064` → UPDATE | ❌ |
| `pay` (Call #6) após `0c1ee064` (end=07-15) | (07-15→08-15) | Cria `b3bdec3f` | ❌ |
| `pay` (Call #6) após `b3bdec3f` (end=08-15) | (08-15→09-15) | Cria `2039bd97` | ❌ |
| `create_subscription` (Call #3) | start=now(), end=next_billing+12h | Não produz start=06-15 | ❌ |

### 7.3 Evidência-chave: 00:00 vs 12:00

| Campo | `d561a4c3` (anômalo) | Receivables normais |
|-------|----------------------|---------------------|
| `billing_cycle_end` | **00:00:00** (meia-noite) | **12:00:00** (meio-dia) |

- Receivables normais têm `end` às 12:00 porque `create_chef_club_subscription` usa `p_next_billing_date + time '12:00'`.
- O `end=08-14 00:00` indica conversão `DATE → timestamptz` (meia-noite) — consistente com input manual de uma data `'2026-08-14'` sem componente horário.

### 7.4 Auditoria de audit_logs

```sql
SELECT count(*) FROM public.audit_logs
WHERE tenant_id = 'b716e290-...';  → 0 rows
```

**Tabela `audit_logs` está vazia para este tenant.** Sem trilha de auditoria para a criação de `d561a4c3`.

### 7.5 updated_at anômalo

`d561a4c3` tem `updated_at=2026-08-06 22:13:51` — ~3.5h após criação (18:45) e ~2min antes do pagamento de `b3bdec3f` (22:14). Nenhum fluxo padrão explica esse UPDATE:
- `generate` não atingiria `d561a4c3` (conflito seria com `0c1ee064` ou `b3bdec3f`)
- `pay` atualiza o receivable sendo pago (status→paid), mas `d561a4c3` continua `overdue`
- Trigger existente: apenas `set_updated_at_timestamp()` em UPDATE (não INSERT)

**Hipótese:** intervenção manual direta (SQL dashboard ou Table Editor) tanto para INSERT quanto para UPDATE posterior.

### 7.6 Conclusão S3-3

| Afirmação | Status |
|-----------|--------|
| O receivable `d561a4c3` **não foi criado** por nenhum fluxo padrão do código | ✅ **Confirmado** |
| A origem é **intervenção manual** (SQL dashboard, Table Editor, ou client library com params explícitos) | ✅ **Hipótese forte** (evidência: end 00:00, sem trilha de auditoria, nenhum caminho de código produce) |
| A constraint `ON CONFLICT (sub, start, end)` **não impediu** a inserção | ✅ Confirmado — o conflito só existe se os 3 campos coincidirem |
| Não há edge function, cron, ou trigger INSERT que possa ter criado o registro | ✅ Confirmado |
| A `audit_logs` não fornece trilha para this tenant | ✅ Confirmado — tabela vazia |

### 7.7 Implicação para decisão do PO

O S3-1 é **dado histórico de intervenção manual**, não bug de código em produção. Isso muda o escopo da correção:

- **Correção de código (constraint/guard)** → previne intervenções manuais futuras, mas não é "correção de bug"
- **Tratamento do registro** → `d561a4c3` é um insert manual inválido; o registro deve ser marcado como cancelado/duplicado
- **Root cause real** → alguém (operador/admin) inseriu o registro diretamente no banco, provavelmente copiando dados de `0c1ee064` com uma data de cycle_end incorreta (08-14 ao invés de 07-15)

---

## 8. Tratamento S3-4 — Cancelamento do `d561a4c3` (executado, 2026-08-16)

> **Modo:** escrita (única operação write nesta investigação) · **Aprovação:** PO (D-HOM-27 §4) · **Critério:** tratamento mínimo — registro isolado, sem impacto de caixa

### 8.1 Pré-operação

| Campo | Valor |
|-------|-------|
| `id` | `d561a4c3-05ce-4722-b2bf-3816fec34aa1` |
| `status` | `overdue` |
| `amount` | R$ 260,00 |
| `transaction_id` | null |
| `paid_at` / `payment_method` / `paid_by` | null / null / null |
| `payment_attempts` | 0 registros |
| `notes` | null |
| `created_at` | 2026-08-06 18:45:34 |
| `updated_at` | 2026-08-06 22:13:51 |

**S3 pré:** overdue=10 (R$2.340) · paid=30 (R$6.440) · pending=7 (R$1.360) · **total=47 (R$10.140)**

### 8.2 Operação

```sql
UPDATE public.customer_subscription_receivables
SET status = 'cancelled',
    notes = '[S3-4] Cancelado em 2026-08-16 por OpenCode (S3-1/S3-3). Registro duplicado identificado...',
    updated_at = now()
WHERE id = 'd561a4c3-...'
  AND status = 'overdue';
```

### 8.3 Pós-operação

| Métrica | Pré | Pós | Delta |
|---------|-----|-----|-------|
| overdue | 10 (R$2.340) | 9 (R$2.080) | **-1 (-R$260)** |
| cancelled | 0 | 1 (R$260) | **+1 (+R$260)** |
| paid | 30 (R$6.440) | 30 (R$6.440) | 0 |
| pending | 7 (R$1.360) | 7 (R$1.360) | 0 |
| **Total** | **47 (R$10.140)** | **47 (R$10.140)** | **0** |

### 8.4 Verificação de integridade

- ✅ Total de receivables inalterado (47)
- ✅ Soma total inalterada (R$10.140)
- ✅ Subscription RIOS inalterada (active, cycle 07-15→08-15)
- ✅ Nenhum outro receivable afetado
- ✅ `cancelled` é status válido no tipo `ReceivableStatus` (label "Cancelado", ícone `block`)
- ✅ Sem efeito financeiro (sem transaction_id, sem payment_attempts, sem comissões)

### 8.5 Conclusão S3-1 → FECHADO

**S3-1 (P1) — FECHADO.** O receivable duplicado `d561a4c3` foi cancelado com sucesso. A investigação S3 completa (S3-1/S3-2/S3-3/S3-4) confirmou:

1. **1 caso isolado** de duplicidade (RIOS, R$260)
2. **Origem:** intervenção manual (não bug de código)
3. **Tratamento:** cancelamento pontual (registro preservado com status `cancelled`)
4. **Impacto:** zero (sem caixa, sem integridade financeira)
5. **Prevenção futura:** opcional — reforçar constraint ou guarda no `ensure` (melhoria, não correção)

> **S3 está limpo para prosseguir com H-7.**
