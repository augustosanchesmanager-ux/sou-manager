# ADR-030: Ciclos de Repasse, Gestão de Vales e Refatoração de Folha (SMG-PAYOUT-SCHEDULES)

## Status

PROPOSTO (Em discussão de arquitetura)

## Contexto

O Fechamento de Caixa Diário (Fases A, B e C — PRs #118, #119 e #120) estabeleceu a apuração por competência contábil, isolando comissões de fiado em `pendingCommission` e calculando repasses imediatos sobre a base liquidada (`totalReceived`).

No entanto, a operação real de barbearias apresenta duas necessidades financeiras não atendidas:

1. **Periodicidade Divergente:** barbeiros raramente recebem diariamente; a maioria opera em regime semanal (fechamento terça a domingo com acerto na terça seguinte), quinzenal ou mensal.
2. **Gestão de Adiantamentos (Vales):** retiradas financeiras no meio do expediente para despesas pessoais exigem saída física do caixa no dia da ocorrência e dedução automática no próximo acerto de contas.

Adicionalmente, existe um protótipo em `pages/Payroll.tsx` que realiza cálculos manuais no cliente, simula vales com valor estático zero (`// Temporary vales/discounts mock as 0`) e insere registros não rastreados em `transactions`. Faz-se necessária a substituição dessa lógica por um domínio formal de liquidação.

---

## Evidência Factual: `comanda_payments` é append-only

A regra de Regime de Caixa (Decisão 3) depende de cada pagamento gerar uma **nova linha** com `created_at` correspondente ao momento da liquidação. Isso **não é premissa** — é propriedade verificada da DDL.

**Fonte:** `supabase/migrations/20260830030000_m4_p7_register_comanda_payment.sql:127-133`

```sql
INSERT INTO public.comanda_payments (
    tenant_id, comanda_id, payment_type, amount,
    payment_method, actor_id, motivo, idempotency_key
) VALUES (
    p_tenant_id, p_comanda_id, p_payment_type, p_amount,
    p_payment_method, v_auth_uid, p_motivo, p_idempotency_key
);
```

Propriedades confirmadas:

1. A função executa **unicamente `INSERT`**. Não há `UPDATE` nem mutação de linhas pré-existentes.
2. `created_at` **não consta** na lista de colunas do `INSERT`, portanto assume o default da tabela (`supabase/migrations/20260829020000_comanda_payments.sql`):
   `created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())`
   → cada parcela registra o timestamp real da sua liquidação.
3. Estorno é **marcação**, não remoção: `reversed_at TIMESTAMPTZ NULL`. Linhas estornadas preservam o `created_at` original e devem ser excluídas por `reversed_at IS NULL` — mesmo filtro já aplicado pelo `domain/comanda/comandaPaymentRepository.ts` (PR #119).
4. A RPC é explicitamente neutra em relação à comissão (L152-153): *"NÃO altera status, attended_at, nem comissão."*

**Consequência:** uma comanda de período anterior liquidada no balcão hoje gera linha com `created_at` de hoje, caindo corretamente no acerto do período corrente. A eliminação de dupla contagem (Decisão 3) está garantida por construção.

---

## Decisões de Arquitetura

### 1. Separação de Responsabilidades: Apuração Diária vs. Liquidação Periódica

* **Fechamento Diário (`cash_closings`):** registro imutável de competência diária — quanto a barbearia produziu e quanto entrou no caixa. **Não faz desembolso** de repasse para profissionais de ciclo não-diário.
* **Liquidação Periódica (`barber_payout_settlements`):** consolida um período `[T_inicio, T_fim]` para um profissional específico, apura as comissões devidas, abate vales e emite a Ordem de Pagamento.

### 2. Destino de `pages/Payroll.tsx`

* A rota é **preservada**; a lógica interna é substituída.
* `Payroll.tsx` deixa de conter matemática ad-hoc e chamadas diretas ao banco.
* A página passa a atuar exclusivamente como interface do `payoutService`, consumindo liquidações consolidadas e allowing registro de vales.
* Os mocks de vales e as inserções manuais em `transactions` são aposentados.

### 3. Eliminação de Dupla Contagem (Regime de Caixa por Liquidação)

* Toda comissão do período é derivada estritamente dos registros de `comanda_payments` onde `created_at BETWEEN T_inicio AND T_fim` e `reversed_at IS NULL`.
* Pagamentos de atendimentos fiados de períodos anteriores, liquidados no balcão dentro do período atual, entram **naturalmente** nessa consulta.
* **Não existe parcela avulsa de "Fiados Quitados"** na fórmula — eliminada a fonte de sobreposição financeira.

$$\text{Repasse Líquido} = \sum(\text{Comissões Liquidadas no Período}) - \sum(\text{Vales Pendentes do Profissional}) + \sum(\text{Bônus / Diárias})$$

**Desdobramento analítico: DEFERIDO, NÃO HABILITADO (Decisão C).**

O desdobramento por origem do atendimento ("comissões de atendimentos do ciclo" vs. "comissões de fiado anterior liquidado") está **deferred**. Motivo: exigiria ancorar a classificação em `comandas.attended_at`, **coluna que não existe** — `attended_at` foi implementado exclusivamente em `public.appointments` (`supabase/migrations/20260829000000_attended_at.sql:9-10`) e nunca foi espelhada em `comandas`. O ADR-020 D-1 já havia ressalvado essa decisão como pendente ("se necessário, espelhada em `comandas` — decidir no G1/schema design"), e o schema seguiu apenas com `appointments`.

Alternativas descartadas na decisão:

* **Espelhar `attended_at` em `comandas`** — exigiria redesenhar RPCs de checkout, tratar comandas com múltiplos profissionais e criar migrations de dados complexas, fora do escopo deste ADR.
* **Classificar via JOIN com `appointments`** — quebra em atendimentos de balcão (*walk-ins* sem agendamento prévio na grade) e introduz cardinalidade $N:N$ e heurística frágil.

**Consequência:** a liquidação opera em **regime de caixa puro**. O repasse é apurado exclusivamente por `comanda_payments.created_at` dentro do intervalo do acerto, sem qualquer dependência de `attended_at`. O gestor visualiza o total consolidado; a transparente de "quando o serviço foi cortado" fica para ADR posterior que trate a questão na dimensionalidade correta.

### 4. Ciclo de Vida dos Vales (`barber_advances`)

* Todo vale é registrado com vínculo ao profissional (`staff_id`), valor e operador responsável (`created_by` — `profiles.id`, pois o operador é sempre um usuário autenticado).
* Status inicial `pending`. Ao aprovar uma liquidação, os vales selecionados transitam para `deducted` vinculados ao `settlement_id`.

### 4.1 Contrato de Espelhamento Contábil no Caixa (`public.transactions`)

O vale é uma saída física de dinheiro: a gaveta ou a conta bancária sofre o desembolso **no dia da concessão**, não no acerto. Por isso cada vale gera, na mesma transação, um espelho em `public.transactions`.

**Contrato canônico — campos e valores obrigatórios:**

| Campo em `transactions` | Valor | Razão |
|---|---|---|
| `type` | `'expense'` | Saída de caixa |
| `category` | `'vale_comissao'` | **Chave técnica estável**, não texto humano. Garante agregação determinística: `WHERE category = 'vale_comissao' AND tenant_id = ...` |
| `date` | **Data de competência do caixa** (o dia do expediente em que o desembolso saiu) | É a coluna que o fechamento de caixa concilia. `created_at` é timestamp de gravação e não substitui `date` |
| `amount` | Valor do vale, positivo | |
| `description` | `"Vale / Adiantamento - [Nome do Barbeiro]"` | Texto livre, apenas humano |
| `source_type` | `'barber_advance'` | Âncora da conciliação bidirecional |
| `source_id` | `barber_advances.id` | Idem |
| `tenant_id` | `advance.tenant_id` — **obrigatório, nunca nulo** | Ver Cláusula de Fail-Closed abaixo |

**Conciliação bidirecional:**

$$\text{barber\_advances.transaction\_id} \longleftrightarrow \text{transactions.(source\_type, source\_id)}$$

A coluna `category` recebe **exclusivamente** a chave técnica. Rótulos legíveis nunca são gravados nesse campo — `transactions.category` é `TEXT` sem `CHECK` e recebe categorias arbitrárias de despesas operacionais (aluguel, produtos, manutenção); gravá-la com texto humano permitiria divergência de grafia que quebraria a agregação **sem gerar erro**. O índice `idx_transactions_tenant_source` já existente cobre a consulta de conciliação.

**Cláusula de Fail-Closed do Espelhamento.** `public.transactions.tenant_id` é `UUID` **nullable e sem `REFERENCES`** — dívida histórica. Um espelho de vale com `tenant_id` nulo cairia no caixa sem escopo de tenant e **não apareceria em nenhum fechamento multi-tenant**, sem gerar erro. Portanto o lançamento **rejeita** a operação antes de escrever:

```typescript
if (!advance.tenant_id) {
  throw new Error('Multi-tenant violation: tenant_id is mandatory for advance mirroring');
}
```

### 5. Harmonização Canônica com o ADR-020 (Direito × Desembolso)

Não há contradição entre o ADR-020 e este ADR. Eles governam **duas dimensões ortogonais** do mesmo fato econômico:

| Dimensão | ADR que governa | Ancoragem | Pergunta que responde |
|---|---|---|---|
| **Fato gerador / Elegibilidade** | ADR-020 | `public.appointments.attended_at` | O barbeiro **tem direito** a essa comissão? |
| **Gatilho de desembolso / Liquidação** | ADR-030 (este) | `public.comanda_payments.created_at` | **Quando** o caixa permite pagar? |

O ADR-020 **provisiona o direito** (o serviço foi comprovadamente prestado — evita comissão sobre agendamento cancelado ou fantasma). O ADR-030 **dispara o desembolso** (a barbearia não transfere dinheiro que não recebeu).

**Cenário de referência — atendimento em 28/09, fiado pago em 05/10:**

1. Pelo **ADR-020**: o fato gerador existiu em 28/09. A comissão é legítima e foi atribuída ao colaborador; nas Fases A/B/C ela permanece registrada como `pendingCommission`.
2. Pelo **ADR-030**: o dinheiro só entrou no caixa em 05/10. O repasse é liquidado no ciclo do pagamento.

**Prevalência canônica:** o ADR-020 governa **a legitimidade do crédito** (quem trabalhou); o ADR-030 governa **a data do desembolso financeiro** (quando o caixa permite pagar). São cumulativos, não concorrentes — um não substitui o outro.

### 6. Periodicidade e Fim de Mês

* `payout_frequency` ∈ `daily` | `weekly` | `biweekly` | `monthly`.
* `payout_weekday` segue **ISO 8601** (`1` = Segunda … `7` = Domingo), alinhado a `EXTRACT(ISODOW FROM ...)` no PostgreSQL e `date-fns/getISODay()` no frontend. O acerto padrão da operação é `2` (terça-feira).
* **Clamping de fim de mês:** para `payout_month_day` ∈ {29, 30, 31} em meses mais curtos (fevereiro), o acerto liquida no **último dia do mês corrente** — `MIN(payout_month_day, último_dia_do_mês)`. Nunca há adiamento para o mês seguinte, o que preserva a competência do período.

---

## Modelagem de Dados Proposta

```sql
-- 1. Parametrização no Perfil do Profissional
CREATE TABLE public.barber_payout_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    staff_id UUID NOT NULL REFERENCES public.staff(id),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    payout_weekday INTEGER CHECK (payout_weekday BETWEEN 1 AND 7),   -- ISO 8601: 1=Seg .. 7=Dom
    payout_month_day INTEGER CHECK (payout_month_day BETWEEN 1 AND 31),
    allow_advances BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_barber_payout_config UNIQUE (tenant_id, staff_id),
    CONSTRAINT chk_weekday_only_weekly CHECK (
        frequency = 'daily' OR payout_weekday IS NULL OR frequency IN ('weekly', 'biweekly')
    ),
    CONSTRAINT chk_monthday_only_monthly CHECK (
        frequency <> 'monthly' OR payout_month_day IS NOT NULL
    )
);

-- 2. Registro de Vales / Adiantamentos
CREATE TABLE public.barber_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    staff_id UUID NOT NULL REFERENCES public.staff(id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    transaction_id UUID REFERENCES public.transactions(id),
    settlement_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deducted', 'cancelled')),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id)
);

-- FK de settlement_id adicionada após a criação da tabela de liquidações
ALTER TABLE public.barber_advances
    ADD CONSTRAINT fk_advance_settlement
    FOREIGN KEY (settlement_id) REFERENCES public.barber_payout_settlements(id);

-- 3. Liquidações Periódicas Consolidadas
CREATE TABLE public.barber_payout_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    staff_id UUID NOT NULL REFERENCES public.staff(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_commission NUMERIC(12, 2) NOT NULL CHECK (gross_commission >= 0),
    advances_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (advances_deducted >= 0),
    net_payout NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_period CHECK (period_end >= period_start),
    CONSTRAINT chk_settlement_window CHECK (period_end > period_start),
    CONSTRAINT uq_barber_payout_period UNIQUE (tenant_id, staff_id, period_start, period_end),
    CONSTRAINT chk_paid_has_timestamp CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

-- 4. Idempotência de pagamento: um acerto 'paid' por profissional/ciclo.
--    Reemitir exige estornar antes.
CREATE UNIQUE INDEX uq_settlement_paid_period
    ON public.barber_payout_settlements (tenant_id, staff_id, period_start, period_end)
    WHERE status = 'paid';

-- 5. RLS obrigatório nas três tabelas, via helpers canônicos do projeto
ALTER TABLE public.barber_payout_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_payout_settlements ENABLE ROW LEVEL SECURITY;
```

---

## Diretrizes de Governança

1. **Multi-tenancy e RLS:** toda tabela contém `tenant_id` com políticas ativas usando `current_tenant_id_from_auth_uid()` / `current_is_super_admin_from_auth_uid()`. Antes de escrever as políticas, consultar `docs/security/SECURITY_AUDIT_RLS.md`.
2. **Arquitetura em Camadas:** `domain/payout/payoutRepository.ts` e `application/payout/payoutService.ts`, **sem introduzir violações** nos gates (`npm run architecture:ci` deve permanecer em `227=227`, `0=0`, `0=0`).
3. **Compatibilidade:** o fechamento de caixa diário (`CashClosingPage.tsx`) permanece inalterado em suas regras, fornecendo dados analíticos para as liquidações periódicas.
4. **Atomicidade:** a aprovação de uma liquidação e a transição dos vales para `deducted` ocorrem na mesma transação. Nunca existe `settlement.status = 'approved'` com vales `pending` já incluídos em `advances_deducted`.
5. **Imutabilidade do apurado:** uma liquidação `paid` é imutável. Correções exigem estorno (`cancelled`) e nova emissão.
6. **Identidade canônica:** toda referência a profissional usa `staff.id`, **nunca** `profiles.id`. As Fases A/B/C de comissionamento operam sobre `comandas.staff_id` → `staff.id`; `profiles.id` é identidade de *login* (`auth.users`), distinta e sem vínculo direto com `staff`. Usar `profiles.id` no settlement impediria o cruzamento com as comissões apuradas.
7. **Defesa em profundidade para `staff` (cláusula obrigatória):** a tabela legada `public.staff` tem RLS habilitada, mas com políticas **permissivas** — `USING (true)` em `SELECT` e `WITH CHECK (true)` nas escritas (`supabase/migrations/20260219183612_create_initial_schema.sql:73-76`). Ela **não isola tenant**. Portanto **nenhuma** consulta de validação, cálculo ou amarração com `staff_id` pode assumir isolamento vindo da RLS: o filtro de tenant é obrigatório e explícito.

   ```sql
   -- obrigatório: staff.id E staff.tenant_id
   WHERE s.id = :staff_id AND s.tenant_id = :tenant_id
   ```

   Sem esse filtro, um `staff_id` conhecido de outro tenant resolve a linha e a liquidação apura comissão de profissional alheio. Esta é defense-in-depth: a correção definitiva das políticas de `staff` é dívida separada e **não** faz parte do escopo deste ADR.

---

## Consequências

**Positivas**
- Elimina a conciliação manual em planilha externa.
- Passa a haver extrato auditado por profissional e por período.
- Vales deixam de ser lançados manualmente sem rastreio.
- O `Payroll.tsx` deixa de ser cálculo em cliente e passa a ser interface de domínio.

**Riscos / custos**
- Três tabelas novas + RLS +índice parcial → exige migration em ambiente controlado.
- `Payroll.tsx` perde comportamento de demonstração (vales mockados); risco de quebra visual na rota.
- Períodos longos elevam o custo da agregação sobre `comanda_payments`; mitigável com `idx_comanda_payments_tenant (tenant_id, created_at DESC)`, já existente.
- O extrato não decompõe a comissão por origem do atendimento (Decisão C). O gestor vê o total consolidado do ciclo, sem a separação "atendimentos do ciclo" vs. "fiado anterior liquidado".

---

## Pendências para Aceitação

- [ ] Executar o diagnóstico de volumetria de `comanda_payments` em produção (SQL Editor) — define se o balcão já persiste na ADR-018.
- [ ] Executar o diagnóstico de inconsistência de `attended_at` em `public.appointments` (violações D-1) — não bloqueia este ADR, mas alimenta a qualidade do dado operacional.
- [ ] Definir o comportamento quando o profissional é admitido no meio de um ciclo em aberto.
- [ ] Definir política de arredondamento quando `gross_commission` é fracionário ao longo do período.
- [ ] Definir se vale cancelado (`cancelled`) retorna valor ao caixa via `transactions` estorno, e em qual fluxo.
- [ ] Definir o escopo de uma ADR futura para o desdobramento analítico por origem do atendimento, caso seja desejado.