# DESIGN — P0.4 Contas a Pagar

**Status:** APROVADO PELO PO (com条件) — pronto para IMPLEMENT
**Data:** 2026-09-05
**Decisões:** D1-D6 (domínio próprio, separação obrigação×caixa, recorrências persistentes, OVERDUE derivado, CANCELLED estado próprio, pagamento gera transaction vinculada)

## Invariantes Obrigatórios (aprovados pelo PO)

| # | Invariante | Status |
|---|-----------|--------|
| I1 | Unique constraint `recurring_bill_id + competence` é **invariante de banco** | ✅ |
| I2 | `pay_account_payable()` é **idempotente** (duplo clique não cria transaction duplicada) | ✅ |
| I3 | `pay_account_payable()` é **atômica** (BEGIN/COMMIT/ROLLBACK — nunca AP=PAID sem transaction) | ✅ |
| I4 | `PAID` é **terminal** — não pode virar PENDING nem CANCELLED | ✅ |
| I5 | `CANCELLED` é **terminal** — não pode virar PENDING nem PAID | ✅ |
| I6 | Edição de ocorrência **NÃO** altera a regra recorrente | ✅ |
| I7 | Cancelamento de ocorrência **NÃO** cancela a regra recorrente | ✅ |
| I8 | Dados históricos em `transactions` **NÃO serão migrados** automaticamente | ✅ |
| I9 | RLS habilitado em **todas** as novas tabelas | ✅ |
| I10 | Teste de concorrência/duplo clique obrigatório | ✅ |

---

## 1. Visão Geral

```
┌──────────────────────────┐
│   recurring_bills        │  ← Regra recorrente (ex: "Aluguel R$2000 dia 10")
│   "Aluguel"              │
└──────────┬───────────────┘
           │ gera (sob demanda ou mensalmente)
           ▼
┌──────────────────────────┐
│   accounts_payable       │  ← Obrigação mensal (ex: "Aluguel Setembro R$2000")
│   competência: 2026-09   │
│   status: PENDING        │
└──────────┬───────────────┘
           │
           ├───────────────┐
           │               │
           ▼               ▼
       DAR BAIXA      CANCELAR
           │               │
           ▼               ▼
        PAID           CANCELLED
           │
           │ gera (1:1)
           ▼
┌──────────────────────────┐
│   transactions           │  ← Movimento financeiro real
│   type: expense          │
│   account_payable_id: FK │
└──────────────────────────┘
```

---

## 2. Schema

### 2.1 `recurring_bills` — Regra Recorrente

```sql
CREATE TABLE public.recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category TEXT NOT NULL DEFAULT 'outros',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_recurring_bills_tenant ON public.recurring_bills(tenant_id);
CREATE INDEX idx_recurring_bills_tenant_active ON public.recurring_bills(tenant_id, is_active) WHERE is_active = true;
```

**Observações:**
- `amount` é o valor **padrão** da recorrência
- `due_day` é o dia de vencimento padrão
- `is_active` controla se a recorrência gera novas ocorrências
- **NÃO gera transaction** — apenas define a regra

### 2.2 `accounts_payable` — Obrigação Mensal

```sql
CREATE TABLE public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  recurring_bill_id UUID REFERENCES public.recurring_bills(id),
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
  competence_year INTEGER NOT NULL CHECK (competence_year BETWEEN 2020 AND 2099),
  category TEXT NOT NULL DEFAULT 'outros',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  paid_by UUID REFERENCES auth.users(id),
  transaction_id UUID REFERENCES public.transactions(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraint: uma ocorrência por competência por recorrência
  UNIQUE (recurring_bill_id, competence_month, competence_year)
);

-- Índices
CREATE INDEX idx_accounts_payable_tenant ON public.accounts_payable(tenant_id);
CREATE INDEX idx_accounts_payable_tenant_status ON public.accounts_payable(tenant_id, status);
CREATE INDEX idx_accounts_payable_tenant_due_date ON public.accounts_payable(tenant_id, due_date);
CREATE INDEX idx_accounts_payable_tenant_competence ON public.accounts_payable(tenant_id, competence_year, competence_month);
CREATE INDEX idx_accounts_payable_recurring ON public.accounts_payable(recurring_bill_id) WHERE recurring_bill_id IS NOT NULL;
```

**Campos-chave:**
- `recurring_bill_id` — FK para `recurring_bills` (NULL se conta avulsa)
- `competence_month/competence_year` — competência (mês/ano de referência)
- `due_date` — data de vencimento (pode diferir do `due_day` original)
- `status` — `pending` | `paid` | `cancelled`
- `transaction_id` — FK para `transactions` (preenchido ao dar baixa)
- `amount` — valor da ocorrência (pode diferir do `recurring_bills.amount` se editado)

### 2.3 Alteração em `transactions`

```sql
-- Adicionar coluna de vínculo
ALTER TABLE public.transactions
  ADD COLUMN account_payable_id UUID REFERENCES public.accounts_payable(id);

CREATE INDEX idx_transactions_account_payable
  ON public.transactions(account_payable_id)
  WHERE account_payable_id IS NOT NULL;
```

**Constraint de idempotência:**
```sql
-- Uma transaction por account_payable (evitar baixa duplicada)
CREATE UNIQUE INDEX idx_transactions_account_payable_unique
  ON public.transactions(account_payable_id)
  WHERE account_payable_id IS NOT NULL;
```

---

## 3. Lifecycle / Regras de Transição

### 3.1 Status Permitidos

```
                ┌─────────────┐
                │   PENDING   │
                └──────┬──────┘
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
    ┌──────────┐            ┌────────────┐
    │   PAID   │            │ CANCELLED  │
    └──────────┘            └────────────┘
```

### 3.2 Transições Válidas

| De | Para | Operação | Gera Transaction? |
|-----|------|----------|-------------------|
| `pending` | `paid` | Dar baixa | ✅ Sim |
| `pending` | `cancelled` | Cancelar | ❌ Não |
| `paid` | — | — | ❌ Terminal |
| `cancelled` | — | — | ❌ Terminal |

### 3.3 Transições INVÁLIDAS (devem ser rejeitadas)

| De | Para | Motivo |
|-----|------|--------|
| `paid` | `pending` | Não pode "despagar" |
| `paid` | `cancelled` | Já pagou — usar estorno se necessário |
| `cancelled` | `pending` | Não pode reabrir |
| `cancelled` | `paid` | Cancelou — criar nova ocorrência |

**OVERDUE:** Não é status gravado. É derivado em runtime:
```typescript
const isOverdue = (ap: AccountPayable) =>
  ap.status === 'pending' && new Date(ap.due_date) < new Date();
```

---

## 4. Regras de Recorrência

### 4.1 Geração de Ocorrências

**Quando gerar:** Sob demanda (on-demand) ou via cron mensal.

**Opção recomendada: On-demand + lazy**

```typescript
// Ao listar contas a pagar, verificar se a recorrência gerou a competência atual
async function ensureCurrentMonthInstance(recurringBill: RecurringBill, tenantId: string) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Verificar se já existe
  const existing = await supabase
    .from('accounts_payable')
    .select('id')
    .eq('recurring_bill_id', recurringBill.id)
    .eq('competence_month', month)
    .eq('competence_year', year)
    .maybeSingle();

  if (existing.data) return; // Já existe

  // Criar ocorrência
  const dueDate = new Date(year, month - 1, Math.min(recurringBill.due_day, 28));
  await supabase.from('accounts_payable').insert({
    tenant_id: tenantId,
    recurring_bill_id: recurringBill.id,
    name: recurringBill.name,
    amount: recurringBill.amount,
    due_date: dueDate.toISOString().split('T')[0],
    competence_month: month,
    competence_year: year,
    category: recurringBill.category,
    created_by: /* user id */,
  });
}
```

### 4.2 Prevenção de Duplicação

```sql
-- Constraint UNIQUE já definida:
UNIQUE (recurring_bill_id, competence_month, competence_year)
```

### 4.3 Edição por Competência

Edição de uma ocorrência **NÃO** altera a recorrência:

```typescript
// Editar AP Setembro (amount: 2000 → 237.50)
await supabase
  .from('accounts_payable')
  .update({ amount: 237.50 })
  .eq('id', 'ap-setembro-id');

// recurring_bills.amount PERMANECE 2000
// Próximos meses serão gerados com R$ 2000
```

### 4.4 Cancelamento por Competência

```typescript
// Cancelar AP Setembro
await supabase
  .from('accounts_payable')
  .update({ status: 'cancelled', cancelled_at: now(), cancelled_by: userId })
  .eq('id', 'ap-setembro-id');

// recurring_bills.is_active PERMANECE true
// Outubro será gerado normalmente
```

### 4.5 Alteração da Recorrência

Alterar `recurring_bills.amount` de 2000 para 2500:
- **AFETA:** Ocorrências futuras (ainda não geradas)
- **NÃO AFETA:** Ocorrências existentes (já criadas)

---

## 5. Dar Baixa — Regra Financeira

### 5.1 Fluxo

```
1. Validação
   ├── Status = 'pending'
   ├── TenantId consistente
   └── Usuário autorizado

2. Atualizar accounts_payable
   ├── status → 'paid'
   ├── paid_at → now()
   ├── paid_by → user.id

3. Criar transaction
   ├── type: 'expense'
   ├── amount: ap.amount
   ├── description: ap.name
   ├── category: ap.category
   ├── date: now()
   ├── status: 'paid'
   ├── account_payable_id: ap.id
   └── tenant_id: ap.tenant_id

4. Vincular
   └── ap.transaction_id → transaction.id
```

### 5.2 Idempotência

```typescript
async function payAccountPayable(apId: string, userId: string, tenantId: string) {
  // 1. Buscar AP com lock
  const { data: ap } = await supabase
    .from('accounts_payable')
    .select('*')
    .eq('id', apId)
    .eq('tenant_id', tenantId)
    .single();

  if (!ap) throw new Error('Conta não encontrada');
  if (ap.status !== 'pending') throw new Error('Conta não está pendente');
  if (ap.transaction_id) throw new Error('Conta já foi paga (transaction vinculada)');

  // 2. Criar transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .insert({
      tenant_id: tenantId,
      type: 'expense',
      amount: ap.amount,
      description: `[AP] ${ap.name}`,
      category: ap.category,
      date: new Date().toISOString(),
      status: 'paid',
      account_payable_id: ap.id,
    })
    .select()
    .single();

  // 3. Vincular
  await supabase
    .from('accounts_payable')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: userId,
      transaction_id: transaction.id,
    })
    .eq('id', apId);

  return transaction;
}
```

### 5.3 Rollback / Estorno

Se o pagamento foi um erro:
1. Criar **transaction de estorno** (type: 'expense_reversal' ou 'refund')
2. **NÃO** alterar a AP original (ela permanece 'paid')
3. Criar nova ocorrência se necessário

---

## 6. Cancelamento — Regra

```typescript
async function cancelAccountPayable(apId: string, userId: string, tenantId: string) {
  const { data: ap } = await supabase
    .from('accounts_payable')
    .select('*')
    .eq('id', apId)
    .eq('tenant_id', tenantId)
    .single();

  if (!ap) throw new Error('Conta não encontrada');
  if (ap.status !== 'pending') throw new Error('Só é possível cancelar contas pendentes');

  await supabase
    .from('accounts_payable')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
    })
    .eq('id', apId);

  // NÃO gera transaction
}
```

---

## 7. RLS (Row Level Security)

### 7.1 `recurring_bills`

```sql
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_recurring_bills"
ON public.recurring_bills
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);
```

### 7.2 `accounts_payable`

```sql
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_accounts_payable"
ON public.accounts_payable
FOR ALL
TO authenticated
USING (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
)
WITH CHECK (
  public.current_is_super_admin_from_auth_uid()
  OR tenant_id = public.current_tenant_id_from_auth_uid()
);
```

---

## 8. RPCs

### 8.1 `pay_account_payable(ap_id UUID)`

```sql
CREATE OR REPLACE FUNCTION public.pay_account_payable(ap_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap RECORD;
  v_transaction RECORD;
  v_tenant_id UUID;
BEGIN
  -- Resolver tenant
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  -- Buscar AP
  SELECT * INTO v_ap
  FROM public.accounts_payable
  WHERE id = ap_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  IF v_ap.status != 'pending' THEN
    RAISE EXCEPTION 'Conta não está pendente (status: %)', v_ap.status;
  END IF;

  IF v_ap.transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Conta já possui transaction vinculada';
  END IF;

  -- Criar transaction
  INSERT INTO public.transactions (
    tenant_id, type, amount, description, category, date, status, account_payable_id
  ) VALUES (
    v_tenant_id, 'expense', v_ap.amount, '[AP] ' || v_ap.name, v_ap.category,
    now(), 'paid', v_ap.id
  ) RETURNING * INTO v_transaction;

  -- Vincular
  UPDATE public.accounts_payable
  SET status = 'paid',
      paid_at = now(),
      paid_by = auth.uid(),
      transaction_id = v_transaction.id,
      updated_at = now()
  WHERE id = ap_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction.id,
    'amount', v_ap.amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_account_payable(UUID) TO authenticated;
```

### 8.2 `cancel_account_payable(ap_id UUID)`

```sql
CREATE OR REPLACE FUNCTION public.cancel_account_payable(ap_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap RECORD;
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  SELECT * INTO v_ap
  FROM public.accounts_payable
  WHERE id = ap_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  IF v_ap.status != 'pending' THEN
    RAISE EXCEPTION 'Só é possível cancelar contas pendentes';
  END IF;

  UPDATE public.accounts_payable
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_at = now()
  WHERE id = ap_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_account_payable(UUID) TO authenticated;
```

### 8.3 `create_accounts_payable_from_recurring(recurring_bill_id UUID, month INTEGER, year INTEGER)`

```sql
CREATE OR REPLACE FUNCTION public.create_accounts_payable_from_recurring(
  p_recurring_bill_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill RECORD;
  v_tenant_id UUID;
  v_due_date DATE;
  v_existing UUID;
BEGIN
  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant não identificado';
  END IF;

  -- Buscar recorrência
  SELECT * INTO v_bill
  FROM public.recurring_bills
  WHERE id = p_recurring_bill_id AND tenant_id = v_tenant_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recorrência não encontrada ou inativa';
  END IF;

  -- Verificar duplicidade
  SELECT id INTO v_existing
  FROM public.accounts_payable
  WHERE recurring_bill_id = p_recurring_bill_id
    AND competence_month = p_month
    AND competence_year = p_year;

  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'existing_id', v_existing, 'message', 'Já existe');
  END IF;

  -- Calcular vencimento
  v_due_date := make_date(p_year, p_month, LEAST(v_bill.due_day, 28));

  -- Criar ocorrência
  INSERT INTO public.accounts_payable (
    tenant_id, recurring_bill_id, name, amount, due_date,
    competence_month, competence_year, category, created_by
  ) VALUES (
    v_tenant_id, p_recurring_bill_id, v_bill.name, v_bill.amount, v_due_date,
    p_month, p_year, v_bill.category, auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'created', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_accounts_payable_from_recurring(UUID, INTEGER, INTEGER) TO authenticated;
```

---

## 9. Migração de Dados Existentes

### 9.1 Estratégia

**NÃO migrar automaticamente.** Razões:
1. Dados existentes em `transactions` são mistura de despesas avulsas e recorrentes
2. Não há como distinguir qual transaction é "conta a pagar" vs "despesa avulsa"
3. Migrar errado cria mais problema que benefício

**Abordagem:** Criar novas tabelas limpas. Dados antigos permanecem em `transactions`.

### 9.2 Conversão Gradual

Opcionalmente, criar script para "promover" transactions existentes:

```sql
-- Migrar transactions type='expense' para accounts_payable (manual, one-by-one)
-- Só para transações que o usuário confirmar como "conta a pagar"
```

**Decisão:** Não incluir na migration inicial. Fazer sob demanda.

---

## 10. Impacto em Código Existente

| Componente | Impacto | Ação |
|------------|---------|------|
| `pages/Expenses.tsx` | Baixo | Manter — continua listando despesas |
| `components/RecurringBillsWidget.tsx` | Alto | **Substituir** — usar novas tabelas |
| `src/hooks/useRecurringBills.ts` | Alto | **Substituir** — usar novas RPCs |
| `domain/transaction/repository.ts` | Nenhum | Manter — transaction é downstream |
| `application/cashClosing/` | Nenhum | Manter — fecha o que está em transactions |
| `components/Sidebar.tsx` | Nenhum | Manter — rota `/expenses` permanece |

### 10.1 Nova Página (Opcional)

Criar `/accounts-payable` dedicada, OU embedar no existente `/expenses`.

**Recomendação:** Manter em `/expenses` com abas:
- **Despesas** (lista atual de transactions type='expense')
- **Contas a Pagar** (novo widget usando accounts_payable)

---

## 11. Checklist de Validação

| # | Critério | Como validar |
|---|----------|--------------|
| 1 | Criar recorrência | Unit test + E2E |
| 2 | Gerar ocorrência mensal | Unit test |
| 3 | Editar ocorrência (não afeta recorrência) | Unit test |
| 4 | Cancelar ocorrência (recorrência continua) | Unit test |
| 5 | Dar baixa → gera transaction | Unit test + E2E |
| 6 | Baixa duplicada → rejeitada | Unit test |
| 7 | OVERDUE derivado corretamente | Unit test |
| 8 | RLS tenant isolation | Integration test |
| 9 | Cash closing não afetado | Regression test |
| 10 | Build + typecheck OK | CI |

---

## 12. Gate de Aprovação

### Gate 1: Schema ✅ APROVADO
- 3 tabelas: `recurring_bills`, `accounts_payable`, alteração em `transactions`
- Unique constraint `recurring_bill_id + competence_month + competence_year` = **invariante de banco (I1)**

### Gate 2: Lifecycle ✅ APROVADO
- `PENDING → PAID` (terminal, gera transaction)
- `PENDING → CANCELLED` (terminal, sem transaction)
- `PAID` e `CANCELLED` são **terminais (I4, I5)**

### Gate 3: Recorrência On-Demand ✅ APROVADO COM CONDIÇÃO
- Geração lazy/on-demand aprovada
- **Condição:** unique constraint garante idempotência (I1)

### Gate 4: RPCs ✅ APROVADO COM CONDIÇÃO
- 3 RPCs: `pay_account_payable`, `cancel_account_payable`, `create_accounts_payable_from_recurring`
- **Condição:** `pay_account_payable()` deve ser **atômica (I3)** e **idempotente (I2)**

### Gate 5: Dados Antigos ✅ APROVADO
- **NÃO migrar automaticamente (I8)**
- Dados históricos permanecem em `transactions`
- Novas tabelas criadas limpas

### Gate 6: Página ✅ APROVADO
- Manter rota `/expenses`
- Evoluir para "Contas a Pagar" com abas:
  - **Pendentes** (PENDING + derivado OVERDUE)
  - **Pagas** (PAID)
  - **Canceladas** (CANCELLED)
  - **Regras Recorrentes** (recurring_bills)

---

**STATUS:** DESIGN APROVADO PELO PO — pronto para IMPLEMENT.
