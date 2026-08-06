# Plan Model

> **Fase:** 6.0.0 — SaaS Domain Consolidation
> **Status:** ✅ REVISADO PELO PO — 2026-07-28
> **Decisões:** Ver `BUSINESS_DECISIONS.md` (F1, F2, F3)

---

## 1. Plan Entity

```typescript
interface Plan {
  slug: string;                // Identificador (ex: "free", "pro", "premium")
  name: string;                // Nome comercial (ex: "Free", "Pro", "Premium")
  description: string;
  price_monthly_cents: number; // Preço mensal em centavos
  price_yearly_cents: number;  // Preço anual em centavos
  trial_days: number;          // Dias de trial (0 = sem trial)
  features: FeatureFlag[];     // Flags habilitadas
  limits: PlanLimits;          // Limites operacionais
  sort_order: number;          // Ordenação
  active: boolean;             // Se está disponível para venda
}
```

### 1.1 Planos Oficiais

**Decisão do PO:** Nenhum plano "Enterprise" nesta fase. O produto é único (SMG Barber).

| Plano | Objetivo | Público |
|-------|----------|---------|
| `free` | Conhecer o sistema | Barbearias em avaliação |
| `pro` | O plano que deve vender | Barbearias operacionais |
| `premium` | Tudo liberado | Barbearias avançadas / redes |

---

## 2. Escopo por Plano

### Free
- Objetivo: conhecer o sistema, **não** gerar receita
- Agenda
- Clientes (até 100)
- 1 profissional
- Financeiro básico
- Dashboard simples
- **Sem** BI
- **Sem** automações
- **Sem** API

### Pro
- Objetivo: vender — tudo que a barbearia precisa
- Todos os módulos core
- Financeiro completo
- Club dos Chefes
- Até 5 profissionais
- Clientes ilimitados

### Premium
- Objetivo: tudo liberado
- BI completo
- API
- WhatsApp
- Marketplace
- Profissionais ilimitados
- Multi-unidade
- Relatórios customizados

---

## 3. Matriz de Flags por Plano

| Flag | free | pro | premium |
|------|------|-----|---------|
| `appointments` | ✅ | ✅ | ✅ |
| `clients` | ✅ | ✅ | ✅ |
| `pos` | ✅ | ✅ | ✅ |
| `team` | ⚠️ (1 prof) | ✅ | ✅ |
| `finance` | ⚠️ (básico) | ✅ | ✅ |
| `dashboard` | ✅ | ✅ | ✅ |
| `chef_club` | ❌ | ✅ | ✅ |
| `bi` | ❌ | ❌ | ✅ |
| `api` | ❌ | ❌ | ✅ |
| `whatsapp` | ❌ | ❌ | ✅ |
| `marketplace` | ❌ | ❌ | ✅ |
| `multi_unit` | ❌ | ❌ | ✅ |

> **Nota:** `team` e `finance` no free usam limites de plano (`max_staff`, `max_clients`) em vez de bloqueio total.

---

## 4. PlanLimits

```typescript
interface PlanLimits {
  max_staff: number;           // Máximo de profissionais
  max_clients: number;         // Máximo de clientes
  max_appointments_per_day: number;
  max_products: number;
  storage_mb: number;
  api_rate_limit_per_minute: number;
}
```

| Limite | free | pro | premium |
|--------|------|-----|---------|
| `max_staff` | 1 | 5 | ∞ |
| `max_clients` | 100 | ∞ | ∞ |
| `max_products` | 20 | ∞ | ∞ |
| `storage_mb` | 100 | 1000 | 10000 |
| `api_rate_limit` | 0 | 0 | 60/min |

---

## 5. Armazenamento

Atualmente `tenants.plan` é TEXT. No futuro:

```sql
CREATE TABLE IF NOT EXISTS public.plans (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly_cents INTEGER NOT NULL DEFAULT 0,
    price_yearly_cents INTEGER NOT NULL DEFAULT 0,
    trial_days INTEGER NOT NULL DEFAULT 0,
    features JSONB NOT NULL DEFAULT '[]',
    limits JSONB NOT NULL DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| Plano padrão | `free` para novos tenants (via `provision_new_tenant`) |
| Trial | 14 dias, contado a partir do **provisionamento do tenant** (F3/D3) |
| Free | Sem trial (trial_days = 0) |
| Upgrade | Imediato, faturamento pro-rata |
| Downgrade | Fim do ciclo de faturamento atual |
| Enterprise | **Não existe nesta fase** |
