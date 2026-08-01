# Onboarding Flow

> **Fase:** 6.0.0 — SaaS Domain Consolidation
> **Status:** ✅ REVISADO PELO PO — 2026-07-28
> **Decisões:** Ver `BUSINESS_DECISIONS.md` (F9)

---

## 1. Fluxo Oficial (decisão do PO)

```
Register (Sign up)
     │
     ▼
Verificação de e-mail
     │
     ▼
Role Selection (manager | barber | receptionist)
     │
     ▼
Tenant Creation (provision_new_tenant RPC)
     │
     ├── tenants row (status = 'draft', plan = 'free')
     ├── profiles row (role = 'manager', status = 'active')   ← owner
     ├── user_tenants row (role = 'manager', is_primary = true)
     ├── tenant_settings row (skeleton — valores no Shop Setup)
     ├── staff row (auto-inserted by trigger handle_new_manager_profile)
     └── event: TenantCreated (somente tenant novo; ver TenantProvisioningService)
     │
     ▼
Shop Setup (complete_onboarding RPC)
     │
     ├── tenant_settings row (chair_count, business_hours, timezone, currency, phone, cnpj, address)
     ├── tenants.status → 'trial' (sempre, mesmo trial zero dias)
     ├── profiles.onboarding_completed = true
     └── event: OnboardingCompleted
     │
     ▼
Checklist (primeiros passos)
     │
     ├── ✔ horário
     ├── ✔ profissional
     ├── ✔ primeiro serviço
     ├── ✔ primeira categoria
     └── event: OnboardingChecklistCompleted
     │
     ▼
Dashboard (tenant ativo)
```

---

## 2. Telas

### 2.1 Register (`pages/Register.tsx`)
- Email + senha
- Nome completo
- WebAuthn (futuro)

### 2.2 Email Verification
- Confirmação de e-mail (link enviado)
- Campo obrigatório antes de prosseguir
- **Reserva para o futuro:** já estrutura o fluxo para exigir confirmação

### 2.3 Role Selection
- Manager (dono da barbearia)
- Barber (profissional)
- Receptionist (atendente)

### 2.4 Tenant Creation
- Nome da barbearia
- App select (barber | auto | club)
- RPC: `provision_new_tenant(user_id, tenant_name, first_name, last_name, app_slug)`

### 2.5 Shop Setup (`pages/onboarding/ShopSetup.tsx`)
- Número de cadeiras
- Horário de funcionamento
- Timezone
- Moeda (currency)
- Telefone
- CNPJ (opcional)
- Endereço
- RPC: `complete_onboarding(tenant_id, chair_count, business_hours, timezone, currency, phone, cnpj, address)`

### 2.6 Checklist
- Horário de funcionamento configurado ✅
- Primeiro profissional cadastrado ✅
- Primeiro serviço cadastrado ✅
- Primeira categoria criada ✅
- Ao concluir: dashboard liberado

---

## 3. RPCs

### 3.1 `provision_new_tenant`

```sql
SELECT * FROM provision_new_tenant(
    p_user_id    => '...',
    p_tenant_name => 'Sanchez Barber',
    p_first_name  => 'Augusto',
    p_last_name   => 'Sanchez',
    p_app_slug    => 'barber'
);
```

Retorno:
```json
{
    "tenant_id": "uuid",
    "slug": "sanchez-barber",
    "already_exists": false
}
```

### 3.2 `complete_onboarding`

```sql
SELECT complete_onboarding(
    p_tenant_id       => '...',
    p_chair_count     => 3,
    p_business_hours  => '{"mon_fri": "08:00-19:00", "sat": "08:00-17:00"}',
    p_timezone        => 'America/Sao_Paulo',
    p_currency        => 'BRL',
    p_phone           => '(11) 99999-9999',
    p_cnpj            => '12.345.678/0001-90',
    p_address_street  => 'Rua Exemplo, 123',
    p_address_city    => 'São Paulo',
    p_address_state   => 'SP'
);
```

---

## 4. Estados do Onboarding

| Estado | Descrição | Próximo |
|--------|-----------|---------|
| `not_started` | Usuário registrado, sem tenant | register → verify email |
| `email_pending` | E-mail enviado, aguardando confirmação | verify email → create tenant |
| `tenant_created` | Tenant em draft, falta setup | create tenant → shop setup |
| `onboarding_complete` | Setup feito, falta checklist | shop setup → checklist |
| `ready` | Checklist concluído, tenant ativo | checklist → dashboard |

Estado atual armazenado em `profiles.onboarding_completed` (boolean).

---

## 5. Validações

| Campo | Regra |
|-------|-------|
| `p_user_id` | Deve ser `auth.uid()` (security definer) |
| `p_tenant_name` | Obrigatório, máx 100 chars |
| `p_app_slug` | DEFAULT 'barber' |
| `user_tenants` | Inserido como `manager`/`is_primary=true` no provisionamento |
| `tenant_settings.tenant_id` | UNIQUE (só um settings por tenant); skeleton criado no provision |
| E-mail | Confirmação obrigatória antes de criar tenant (futuro — F9) |

---

## 6. Eventos Publicados

| Evento | Momento | Payload |
|--------|---------|---------|
| `TenantCreated` | Após `provision_new_tenant` | `{ tenantId, slug, appSlug, createdBy }` |
| `TenantProvisioned` | Após inserção de staff + profile defaults | `{ tenantId, ownerId }` |
| `OnboardingStarted` | Usuário acessa shop setup | `{ tenantId }` |
| `OnboardingCompleted` | Após `complete_onboarding` | `{ tenantId, settings }` |
| `OnboardingChecklistCompleted` | Checklist concluído | `{ tenantId }` |

Eventos atualmente publicados via `appEventBus` (ver `domain/events/`).
