# Feature Flags Model

> **Fase:** 6.0.0 — SaaS Domain Consolidation
> **Status:** ✅ REVISADO PELO PO — 2026-07-28 · **ALINHADO AO ADR-013 — 2026-08-06** (Subfase 0) · **ALINHADO À 6.0.5.3 — 2026-08-07** (decisões D-6.0.5.3-1..6; enforcement definido em §4.2/§5/§6)
> **Decisões:** Ver `BUSINESS_DECISIONS.md` (F7, F8, D-6.0.5.3) e `docs/adr/ADR-013-billing-tenant-featureflags.md`
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

> **Alinhamento 6.0.5.3 (D-6.0.5.3-5/6):** UI **híbrida** aprovada pelo PO — módulo com flag desabilitada é **escondido no sidebar** e, em **rota direta**, exibe página reutilizável `FeatureUnavailablePage` (com convite de upgrade; nunca 403/404 genérico). **Leitura de flags somente via RPC `tenant_has_feature`** consumida pela camada `FeatureFlagService` — nenhum SELECT direto em `feature_flags`/`plans`/`features`/`plan_features` para decisão de acesso.

```typescript
// Hook de verificação (lê via FeatureFlagService → RPC tenant_has_feature)
const { can } = useFeatureFlags();

// Uso em componentes
{can('finance') && <FinancialSummary />}

// Bloqueio de rotas (híbrido)
<FeatureGuard feature="finance">
  <FinancialPage />
</FeatureGuard>
// Rota direta sem a flag → <FeatureUnavailablePage feature="finance" />
```

### 4.2 Backend (RPCs)

> **Alinhamento (ADR-013 §3.1 + 6.0.5.3):** o enforcement real entra na **6.0.5.3**: tabela runtime `feature_flags` (override tenant×flag, escrita superadmin) + RPC **`tenant_has_feature`** (SECURITY DEFINER, auth.uid() — ADR-012) + `FeatureFlagService` (writer único, API congelada na entry audit §2.5). A leitura oficial é via `plan_features` (D-6.0.5-5) + overrides + derivação de suspensão. **RPCs protegidas na 6.0.5.3 (D-6.0.5.3-4):** fechamento de caixa, comissões, receivables, expenses.

Cada RPC protegido valida a flag antes de executar:

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
>
> **Atenção (6.0.5.3, DIV-1):** a tabela abaixo é **ilustrativa** (destaca flags Premium/limitadas). A **fonte canônica** da matriz completa (20 flags por plano) é o seed de `plan_features` (migration `20260806090000`): **free 14 / pro 15 / premium 20**, espelhado por teste de sincronismo contra `PLAN_FEATURES`.

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

> ⚠️ = habilitada com limites de plano (`max_staff` = `free:1`, `pro:5`, `premium:∞` — lidos de `plans.limits` via `FeatureFlagService.getLimits`, `domain/billing/limits.ts` eliminado na 6.0.5.3).

---

## 6. Implementação Futura

> **Alinhamento (ADR-013 + D-6.0.5-5 + D-6.0.5.3-1..6):** a seção abaixo é o **modelo alvo da 6.0.5.3** (enforcement), sujeito ao modelo congelado (contexto 3 — Feature Flags, writer único `FeatureFlagService`). Modelo de dados **decidido**: `plans + features + plan_features` (D-6.0.5-5, implementado na 6.0.5.2 — migration `20260806090000`). A proposta histórica `plans.features TEXT[]` (abaixo) está **substituída**; a RPC real lê de `plan_features` + overrides. **Plano Free congelado (D-6.0.5-3):** 1 profissional, 1 unidade, sem Chef Club, sem módulos Premium — limites controlados exclusivamente pelas Feature Flags, nunca pelo nome do plano.

```sql
-- Tabela runtime de overrides (6.0.5.3) — escrita exclusiva superadmin/service_role
CREATE TABLE IF NOT EXISTS public.feature_flags (
  tenant_id   uuid NOT NULL,
  feature_key text NOT NULL REFERENCES public.features(key) ON DELETE CASCADE,
  override    boolean NOT NULL,           -- true=habilita, false=desabilita (vence a matriz)
  reason      text NOT NULL DEFAULT '',
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_key)
);

-- Função de verificação (6.0.5.3) — única porta de leitura no frontend (D-6.0.5.3-6)
CREATE OR REPLACE FUNCTION public.tenant_has_feature(
    p_tenant_id UUID,
    p_feature TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_plan_slug TEXT;
    v_override  BOOLEAN;
    v_suspended BOOLEAN;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';   -- ADR-012
    END IF;

    SELECT t.plan, t.status = 'suspended' OR t.status = 'archived'
    INTO v_plan_slug, v_suspended
    FROM public.tenants t WHERE t.id = p_tenant_id;

    IF v_suspended THEN
        RETURN FALSE;                                -- override de suspensão (derivado, sem rows)
    END IF;

    SELECT f.override INTO v_override
    FROM public.feature_flags f
    WHERE f.tenant_id = p_tenant_id AND f.feature_key = p_feature;
    IF FOUND THEN
        RETURN v_override;                           -- override explícito vence a matriz
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.plan_features pf
        WHERE pf.plan_slug = v_plan_slug AND pf.feature_key = p_feature
    );
END;
$$;
```

> **Leitura no frontend:** somente via RPC (D-6.0.5.3-6), consumida pela camada `FeatureFlagService` (`domain/billing/featureFlagService.ts`, API congelada na entry audit 6.0.5.3 §2.5). Otimizações futuras (cache, JWT claims, Edge Functions) ficam atrás da abstração.
