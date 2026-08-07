# Feature Flags Model

> **Fase:** 6.0.0 — SaaS Domain Consolidation
> **Status:** ✅ REVISADO PELO PO — 2026-07-28 · **ALINHADO AO ADR-013 — 2026-08-06** (Subfase 0)
> **Decisões:** Ver `BUSINESS_DECISIONS.md` (F7, F8) e `docs/adr/ADR-013-billing-tenant-featureflags.md`
>
> **Papel no ADR-013:** as feature flags formam o **3º contexto desacoplado** (funcionalidade), junto com Subscription (contrato) e Tenant (acesso). O **Estado Efetivo** (§2.4) combina os três. **Writer único** das flags = `FeatureFlagService` (§3.1). Em caso de divergência, o ADR prevalece.

---

## 1. Regras de Nomenclatura (decisão do PO)

### Regra 1 — Uma feature, uma flag

Nunca criar flags compostas como:

```text
featureFinancePremiumPlus
agendaGold
```

Sempre flags simples e diretas:

```text
appointments
finance
dashboard
bi
whatsapp
api
marketplace
```

### Regra 2 — Flags não sabem plano; plano conhece flags

```
pro
 │
 └── flags
      ├── finance    = true
      ├── dashboard  = true
      └── api        = false
```

**Nunca** o contrário (flag não referencia plano).

> **Alinhamento (ADR-013 §4.11):** string literals de planos/features **fora** de `domain/` são proibidas. O catálogo de flags deve viver no domínio, e a leitura passa pelo `FeatureFlagService`. Os planos oficiais são `free`, `pro`, `premium` (o nome comercial "Elite" é obsoleto — ver `SAAS_CORE_ARCHITECTURE.md` Bloco 4).

---

## 2. FeatureFlag Definition

```typescript
interface FeatureFlag {
  key: string;                 // Identificador único (ex: "appointments")
  name: string;                // Nome exibido (ex: "Agenda")
  description: string;
  category: FeatureCategory;
  depends_on: string[];        // Flags que esta requer
}
```

### 2.1 Categorias

```typescript
enum FeatureCategory {
  core         = 'core',        // Funcionalidades base
  financial    = 'financial',   // Módulo financeiro
  engagement   = 'engagement',  // Club dos Chefes, fidelidade
  integration  = 'integration', // API, WhatsApp, marketplace
  admin        = 'admin',       // Multi-unidade, BI
}
```

---

## 3. Catálogo de Flags

### Core
| Flag | Descrição | Depende |
|------|-----------|---------|
| `appointments` | Agenda de agendamentos | — |
| `pos` | PDV / Comandas / Checkout | — |
| `clients` | Cadastro de clientes | — |
| `services` | Cadastro de serviços | — |
| `products` | Cadastro de produtos | — |
| `team` | Gestão de equipe | — |
| `dashboard` | Dashboard | `appointments` |

### Financial
| Flag | Descrição | Depende |
|------|-----------|---------|
| `finance` | Módulo financeiro | `pos` |
| `cash_closing` | Fechamento de caixa | `finance` |
| `commissions` | Comissões | `finance` |
| `receivables` | Contas a receber | `finance` |
| `expenses` | Contas a pagar | `finance` |

### Engagement
| Flag | Descrição | Depende |
|------|-----------|---------|
| `chef_club` | Club dos Chefes (assinaturas) | `clients` |
| `vouchers` | Vales-presente | `clients` |
| `promotions` | Promoções | — |

### Integration
| Flag | Descrição | Depende |
|------|-----------|---------|
| `api` | API REST externa | — |
| `whatsapp` | Notificações WhatsApp | — |
| `marketplace` | Marketplace de fornecedores | `products` |

### Admin
| Flag | Descrição | Depende |
|------|-----------|---------|
| `multi_unit` | Múltiplas unidades | — |
| `bi` | Business Intelligence | `finance` |

---

## 4. Enforcement

### 4.1 Frontend

```typescript
// Hook de verificação
const { can } = useFeatureFlags();

// Uso em componentes
{can('finance') && <FinancialSummary />}

// Bloqueio de rotas
<FeatureGuard feature="finance" fallback={<UpgradePrompt />}>
  <FinancialPage />
</FeatureGuard>
```

### 4.2 Backend (RPCs)

> **Alinhamento (ADR-013 §3.1):** o trecho abaixo é o **modelo alvo** (6.0.5.3). Hoje o enforcement real é `moduleRegistry.ts` (por app) + `PLAN_LIMITS` em `domain/billing/limits.ts` (staff: `free=1`, `pro=5`, `premium=∞`) + gate de `chef_club` por plano. O RPC `tenant_has_feature` **ainda não existe** — ver §6. A verificação oficial futura é via `FeatureFlagService`.

Cada RPC crítico valida a flag antes de executar:

```sql
IF NOT public.tenant_has_feature(p_tenant_id, 'finance') THEN
    RAISE EXCEPTION 'Feature não disponível no plano atual';
END IF;
```

### 4.3 Navegação

O Sidebar já respeita feature flags via `moduleRegistry.ts`:

```typescript
const moduleRegistry = {
  financial: {
    condition: (ctx) => ctx.features.includes('finance'),
  },
};
```

---

## 5. Matriz de Acesso (por Plano)

> **Alinhamento:** matriz alinhada aos planos oficiais (`free`/`pro`/`premium`) e ao catálogo D4/P4. Flags marcadas com "⚠️" habilitam com limites de plano (`max_staff` etc.). `chef_club` é a flag do módulo Club dos Chefes (presente em `moduleRegistry.ts` como AppModuleSlug).

| Flag | free | pro | premium |
|------|------|-----|---------|
| `appointments` | ✅ | ✅ | ✅ |
| `clients` | ✅ | ✅ | ✅ |
| `pos` | ✅ | ✅ | ✅ |
| `team` | ⚠️ | ✅ | ✅ |
| `finance` | ⚠️ | ✅ | ✅ |
| `dashboard` | ✅ | ✅ | ✅ |
| `chef_club` | ❌ | ✅ | ✅ |
| `bi` | ❌ | ❌ | ✅ |
| `api` | ❌ | ❌ | ✅ |
| `whatsapp` | ❌ | ❌ | ✅ |
| `marketplace` | ❌ | ❌ | ✅ |
| `multi_unit` | ❌ | ❌ | ✅ |

> ⚠️ = habilitada com limites de plano (`max_staff` = `free:1`, `pro:5`, `premium:∞` — `domain/billing/limits.ts`).

---

## 6. Implementação Futura

> **Alinhamento (ADR-013):** a proposta abaixo é o modelo alvo da **6.0.5.3**, sujeita ao **modelo congelado** (contexto 3 — Feature Flags, writer único `FeatureFlagService`). Hoje **não existe** tabela `feature_flags` nem coluna `plans.features` (confirmado nas migrations). **Modelo de dados decidido (D-6.0.5-5 aprovada, 2026-08-06): `plans + features + plan_features`** (D4/P4) — a seção abaixo é a proposta histórica `plans.features TEXT[]`, **substituída** pela decisão. **Plano Free congelado (D-6.0.5-3):** 1 profissional, 1 unidade, sem Chef Club, sem módulos Premium — limites controlados exclusivamente pelas Feature Flags, nunca pelo nome do plano.

```sql
-- Plans.features armazena o array de flags habilitadas
ALTER TABLE public.plans ADD COLUMN features TEXT[] NOT NULL DEFAULT '{}';

-- Função de verificação
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
    p_tenant_id UUID,
    p_feature TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_plan_slug TEXT;
    v_features TEXT[];
BEGIN
    SELECT plan INTO v_plan_slug FROM public.tenants WHERE id = p_tenant_id;
    SELECT features INTO v_features FROM public.plans WHERE slug = v_plan_slug;
    RETURN p_feature = ANY(v_features);
END;
$$;
```
