# H-3 — Chef Club: Validação do Consumo de Créditos (evidência)

> **Gate:** H-3 Chef Club (reflexos financeiros — H3-4)
> **Data:** 2026-08-13
> **Ambiente:** banco real `ushsnmlbeurfvlkieiln` (tenant Sanchez Barber — `b716e290-f7f6-4449-b790-5ae9dcdadcab`)
> **Responsável:** OpenCode (Tech Lead operacional)
> **Referência:** erro `42703` histórico no fluxo de checkout com créditos do Clube (`deduct_chef_club_credits` legada com `SELECT entry->'available'`)

---

## 1. Objetivo

Reproduzir o cenário do erro original de consumo de créditos do Chef Club e provar que a RPC `bulk_close_comandas_with_credits`:

1. Consome **exatamente** a quantidade de créditos correta por serviço;
2. Fecha a comanda sem erros de runtime (`42703`);
3. Falha com mensagem clara quando os créditos são insuficientes (sem `42703`);
4. É **idempotente** (não duplica consumo em re-execução).

---

## 2. Baseline registrado (pré-validação)

| Item | Valor |
|------|-------|
| Cliente | `0fde0cbb-5537-4bee-b30c-85291f65cdf6` (DAVID AMIGO) |
| Subscription | `408da040-2343-45e1-8938-d650d582c686` |
| `available_credits` | 5 |
| `used_credits` | 0 |
| CORTE SIMPLES (`91b9f1f2-...`) — available | 4 |
| HIDRATAÇÃO (`521cd2ba-...`) — available | 1 |
| Comanda de teste | `482d5bc3-52b9-4a47-a0a4-594109e49214` (item `1970b17f-b73d-44ac-80f6-ab7f3a2c71de` CORTE SIMPLES, `unit_price` 45) |
| Receivable pago vigente | `f30f4423-...` (2026-08-10 a 2026-09-10) |
| Tabela `customer_plan_credit_usages` | 0 linhas (órfã do Prisma — não usada no fluxo novo) |

---

## 3. Execução — RPC `bulk_close_comandas_with_credits`

Chamada via SQL direto (`p_apply_credits=true`) na comanda `482d5bc3...`:

```sql
SELECT * FROM public.bulk_close_comandas_with_credits(
    ARRAY['482d5bc3-52b9-4a47-a0a4-594109e49214']::UUID[],
    'b716e290-f7f6-4449-b790-5ae9dcdadcab',
    'VALIDACAO H3 POS-FIX - consumo creditos Chef Club',
    'Club dos Chefes',
    true
);
```

### Resultado

| Campo | Valor |
|-------|-------|
| `updated_count` | 1 |
| `credits_consumed.total` | 1 |
| `credits_consumed.by_service` | `{ "91b9f1f2...": { "service_id": "91b9f1f2...", "consumed": 1 } }` |

> **Achado durante a validação:** em uma primeira execução, `by_service` veio **vazio** (`{}`) apesar de `total=1` — **bug de runtime nº 2** (ver §5).

### Estado da comanda após fechamento

| Campo | Valor |
|-------|-------|
| `status` | `paid` |
| `closure_mode` | `standard` |
| `membership_credit_effect` | `true` |
| `financial_effect` | `true` |
| `payment_method` | `Club dos Chefes` |
| `closure_note` | `VALIDACAO H3 POS-FIX - consumo creditos Chef Club` |
| `closed_at` | 2026-08-13T17:04:30Z |

---

## 4. Consumo de créditos — pós-validação

| Item | Antes | Depois |
|------|-------|--------|
| `available_credits` | 5 | **4** |
| `used_credits` | 0 | **1** |
| CORTE SIMPLES available | 4 | **3** |
| CORTE SIMPLES used | 0 | **1** |
| HIDRATAÇÃO available | 1 | 1 (inalterado) |

**Consumo confirmado: exatamente 1 crédito, do serviço correto (CORTE SIMPLES), sem duplicidade.**

### Itens da comanda (comportamento esperado)

Os itens NÃO foram marcados com `paid_with_plan_credit`/`original_price`/`final_price` — comportamento esperado da RPC de baixa em massa (a RPC não atualiza itens). No fluxo real do frontend, o checkout sincroniza os itens com `unit_price=0` antes do fechamento com crédito (via `syncComanda` + `zeroClose`), e a RPC consome o crédito por serviço.

---

## 5. Bugs de runtime encontrados e corrigidos

### Bug 1 — Precedência do cast `::jsonb` (`22P02 Token "consumed" is invalid`)

A concatenação era avaliada com o cast aplicado apenas ao fragmento final:

```sql
-- ❌ Errado: ('...' || v_service_key || '", "consumed": 0}')::jsonb é avaliado como
--    '...' || v_service_key || ('", "consumed": 0}'::jsonb) → JSON inválido
'{"service_id": "' || v_service_key || '", "consumed": 0}'::jsonb
```

**Correção (parênteses ao redor da concatenação inteira):**

```sql
('{"service_id": "' || v_service_key || '", "consumed": 0}')::jsonb
```

### Bug 2 — `jsonb_set` com `create_missing=false` deixava `by_service` vazio

```sql
-- ❌ Errado: a chave do serviço nunca era criada quando não existia
v_credits_by_service := jsonb_set(v_credits_by_service, ARRAY[v_service_key], v_current_service, false);
```

**Correção:**

```sql
v_credits_by_service := jsonb_set(v_credits_by_service, ARRAY[v_service_key], v_current_service, true);
```

Ambas as correções foram aplicadas em `supabase/migrations/bulk_close_comandas_with_credits.sql` e reaplicadas no banco real (idempotente — `CREATE OR REPLACE FUNCTION`).

---

## 6. Cenário negativo — créditos insuficientes

`deduct_chef_club_credits('408da040...', '521cd2ba...' [HIDRATAÇÃO], 2, ...)` com apenas 1 crédito de HIDRATAÇÃO disponível:

```sql
SELECT * FROM public.deduct_chef_club_credits(
    '408da040-2343-45e1-8938-d650d582c686',
    '521cd2ba-...',
    2,
    'b716e290-f7f6-4449-b790-5ae9dcdadcab',
    true
);
```

**Resultado:** `P0001: Insufficient credits for this service` — **sem `42703`**. Créditos **inalterados** (4/1, CORTE 3/1, HIDRATAÇÃO 1/0).

---

## 7. Idempotência

Segunda chamada da RPC na comanda já fechada `482d5bc3...`:

| Campo | Valor |
|-------|-------|
| `updated_count` | 0 |
| `credits_consumed.total` | 0 |

Créditos permanecem 4/1 — **sem consumo duplicado**.

---

## 8. Testes unitários

| Suíte | Resultado |
|-------|-----------|
| `application/chefClub/chefClub.test.ts` | 57 passed (incl. `resolveMembershipContext` com receivable pago por ciclo ativo) |
| Suíte completa (`npm test`) | **897 passed** |
| `npm run build` | ✅ OK |
| `architecture:ci` | ✅ 0 erros (sem regressões) |

---

## 9. Conclusão

A RPC `bulk_close_comandas_with_credits` valida o consumo de créditos do Chef Club no cenário do erro histórico:

- ✅ Consumo de exatamente 1 crédito do serviço correto (CORTE SIMPLES), sem `42703`;
- ✅ Comanda fechada com `membership_credit_effect=true` e `payment_method="Club dos Chefes"`;
- ✅ Falha com mensagem clara (`P0001 Insufficient credits for this service`) sem `42703` quando insuficiente;
- ✅ Idempotente (2ª execução sem efeito);
- ✅ `by_service` corretamente populado após o fix de `jsonb_set` + cast.

**Sem impacto em dados de produção além do consumo controlado de 1 crédito do cliente de validação (DAVID AMIGO) na comanda `482d5bc3...`.**
