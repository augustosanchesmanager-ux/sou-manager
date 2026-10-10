# SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md

**Versão:** 1.1
**Data:** 2026-10-09
**Status:** Rascunho com decisões 1-7 do PO homologadas (2026-10-09) — não implementado
**Front:** P.02-BOOKING-PUBLIC
**Escopo:** Especificação técnica das 4 RPCs públicas de agendamento anônimo
**Changelog:** v1.1 — decisões do PO homologadas; incluída RPC 4 (`cancel_public_booking`); colunas `auto_confirm_online_bookings` e `public_cancel_window_minutes`; expediente com fallback em cascata (decisão 6).

## 1. Objetivo

Especificar o contrato técnico das 4 RPCs `SECURITY DEFINER` para a superfície pública de agendamento online (`/booking/:tenantSlug`), sem acesso direto a tabelas por `anon`. O objetivo é permitir que um revisor implemente o backend (Sprint 1) a partir desta especificação, com zero ambiguidade.

## 2. Princípios

- **Zero vazamento:** projeção estrita, allowlist de campos. Nunca retornar financeiro, faturamento, configs internas, staff inativo, dados de outros clientes.
- **Least-privilege:** seguir ADR-012. `REVOKE EXECUTE ... FROM PUBLIC`, `REVOKE EXECUTE ... FROM anon`, `GRANT EXECUTE ... TO anon, authenticated` nas 4 públicas.
- **Anti-dupla-reserva:** `pg_advisory_xact_lock(hashtextextended(tenant_id || ':' || staff_id, 0))` + `tstzrange(...) && tstzrange(...)` → `ERRCODE '23P01'` (padrão `create_site_sanchez_appointment`, `20260426000001:166-168, 282-291`).
- **Idempotência:** `create_public_booking` aceita `p_idempotency_key` e retorna o registro existente se encontrado em `appointments.idempotency_key` (UNIQUE, `20260428_add_idempotency_key_to_appointments_and_comandas.sql:3`).
- **Token público:** armazenado **hashado** (precedente `portal_sessions.token_hash`, `20260305100000_unified_addons_and_portal.sql:163`), retornado em texto puro **uma única vez**.
- **Multi-tenant:** resolução por `tenants.slug` (UNIQUE, `20260220145436_setup_multi_tenant_and_products_v2.sql:6`), fallback por id (padrão `kiosk_get_staff`, `20260806000000:933-940`).
- **Sem novas camadas:** reutilizar schema existente. Não criar Repository/Application Service.

## 3. RPC 1: `get_public_tenant_profile`

### 3.1 Propósito

Retornar o perfil público do tenant para exibição na página de reserva. Apenas dados necessários à experiência pública.

### 3.2 Assinatura SQL (proposta)

```sql
CREATE OR REPLACE FUNCTION public.get_public_tenant_profile(
  p_tenant_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
-- implementação conforme regras abaixo
$function$;
```

### 3.3 Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `p_tenant_identifier` | TEXT | Sim | `slug` do tenant ou `id` (UUID). Trim. |

### 3.4 Retorno (JSONB)

Shape estrito (allowlist):

```json
{
  "tenant_id": "uuid",
  "name": "string",
  "slug": "string",
  "logo_url": "string|null",
  "address": "string|null",
  "phone": "string|null",
  "social_links": { "instagram": "...", "whatsapp": "...", "website": "..." } | null,
  "booking_enabled": true,
  "booking_rules": {
    "horizon_days": 30,
    "min_booking_notice_minutes": 30,
    "auto_confirm_online_bookings": true,
    "public_cancel_window_minutes": 120,
    "appointment_interval_minutes": 30,
    "default_appointment_duration_minutes": 60,
    "timezone": "America/Sao_Paulo"
  },
  "services": [
    {
      "id": "uuid",
      "name": "string",
      "price": 50.00,
      "duration": 30,
      "active": true,
      "category": "string|null"
    }
  ],
  "staff": [
    {
      "id": "uuid",
      "name": "string",
      "status": "active"
    }
  ]
}
```

### 3.5 Validações e regras

- Resolver tenant: `SELECT id FROM tenants WHERE slug = p_tenant_identifier LIMIT 1`; se nulo, tentar `id::text = p_tenant_identifier`. Se não encontrado → retornar `NULL` (ou `jsonb_build_object('found', false)`) — não levantar exceção.
- Exigir `booking_enabled = true` (coluna nova, ver seção 7). Se falso → retornar `NULL` ou objeto com `booking_enabled: false` (decisão: retornar `NULL` para ocultar perfil público).
- **Allowlist estrita:** apenas campos acima. **FORBIDDEN:** financeiro, faturamento, configs internas, `app_slug`, `plan`, `status` interno (exceto o que já exposto), `staff.email`, `staff.phone`, `staff.user_id`, `staff.role` (não necessário ao público), dados de clientes.
- `services`: filtrar `active = true` (coluna `services.active` BOOLEAN, `20260219183612_create_initial_schema.sql:24`). **NUNCA** usar `is_active`/`duration_minutes` (não existem). `duration` INTEGER (minutos).
- `staff`: filtrar `status = 'active'` (`staff.status`, `20260219183612_create_initial_schema.sql:37`). Retornar apenas `id, name, status`.
- `tenant_settings`: ler `booking_horizon_days`, `appointment_interval_minutes`, `default_appointment_duration_minutes`, `timezone` (`20260805120000_phase_6_0_2_onboarding.sql:22-28`). `min_booking_notice_minutes`, `auto_confirm_online_bookings` e `public_cancel_window_minutes` são novos (seção 7).
- `social_links`: derivar de colunas existentes em `tenants` se presentes; caso contrário `null`. Não inventar schema.
- `SECURITY DEFINER`, `STABLE`, `SET search_path = 'public'`.

### 3.6 Grants

```sql
REVOKE EXECUTE ON FUNCTION public.get_public_tenant_profile(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_tenant_profile(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_profile(TEXT) TO anon, authenticated;
```

## 4. RPC 2: `get_public_available_slots`

### 4.1 Propósito

Retornar **apenas horários livres** para um tenant/profissional/serviços selecionados, considerando expediente, bloqueios, agendamentos existentes e regras de antecedência/horizonte. **Nunca** retornar quem ocupa.

### 4.2 Assinatura SQL (proposta)

```sql
CREATE OR REPLACE FUNCTION public.get_public_available_slots(
  p_tenant_identifier TEXT,
  p_staff_id UUID DEFAULT NULL,
  p_service_ids UUID[] DEFAULT NULL,
  p_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
-- implementação conforme regras abaixo
$function$;
```

### 4.3 Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `p_tenant_identifier` | TEXT | Sim | slug ou id do tenant |
| `p_staff_id` | UUID | Não | se NULL → "qualquer profissional" (união server-side) |
| `p_service_ids` | UUID[] | Não | serviços selecionados para calcular duração total |
| `p_date` | DATE | Não | data alvo; se NULL → usar `CURRENT_DATE` (timezone do tenant) |

### 4.4 Retorno (JSONB)

```json
{
  "date": "2026-10-09",
  "timezone": "America/Sao_Paulo",
  "interval_minutes": 30,
  "slots": [
    { "staff_id": "uuid", "start_time": "2026-10-09T09:00:00-03:00", "end_time": "2026-10-09T09:30:00-03:00", "available": true }
  ]
}
```

**Regra:** `available = true` sempre. Não incluir slots ocupados.

### 4.5 Regras de cálculo

1. **Tenant resolution**: mesma lógica RPC 1. Exigir `booking_enabled = true`.
2. **Duração total dos serviços**: somar `services.duration` (INTEGER minutos) para cada `service_id` em `p_service_ids`. **NUNCA** usar `duration_minutes`. Se array vazio → usar `default_appointment_duration_minutes` (`tenant_settings`).
3. **Janela de expediente (GAP B — declarar e resolver)**: fonte não resolvida no audit. Opções:
   - (i) **Recomendado Sprint 1:** adicionar colunas em `tenant_settings`: `work_start_time TIME DEFAULT '07:00:00'`, `work_end_time TIME DEFAULT '20:00:00'` (ou `work_start_hour/work_end_hour INTEGER`). Janela fixa por tenant.
   - (ii) tabela `staff_schedules` nova (mais flexível).
   - (iii) manter janela fixa hardcoded (não recomendado).

   **Decisão 6 HOMOLOGADA (PO, 2026-10-09):** opção (i) para Sprint 1, com **fallback em cascata**: usar `tenant_settings.work_start_time`/`work_end_time` quando preenchidos; se nulos, cair para os defaults `'07:00:00'`/`'20:00:00'`. A opção (ii) (`staff_schedules`) fica para frente futura; se adotada, atualizar esta SPEC antes de codificar.
4. **Antecedência mínima**: `min_booking_notice_minutes` (nova, seção 7; decisão 2 HOMOLOGADA, DEFAULT 30). Um slot só é livre se `start_time >= (now() + min_booking_notice_minutes * interval '1 minute')` no timezone do tenant.
5. **Horizonte**: `tenant_settings.booking_horizon_days` (default 30). Não retornar datas > `CURRENT_DATE + booking_horizon_days`.
6. **Intervalo**: `tenant_settings.appointment_interval_minutes` (default 30). Gerar grade de slots alinhados ao intervalo dentro da janela.
7. **Bloqueios**: excluir slots que intersectam `schedule_blocks` com `status = 'active'`. Atenção: coluna é `professional_id` (não `staff_id`) — `20260312_schedule_blocks.sql:6`. Tratar `professional_id IS NULL` como bloqueio para "qualquer profissional" quando aplicável.
8. **Agendamentos existentes**: excluir slots onde existe `appointments` com `lower(coalesce(status,'pending')) NOT IN ('cancelled','no_show','completed')` e `tstzrange(a.start_time, a.end_time, '[)')` intersecta `tstzrange(slot_start, slot_end, '[)')`. Usar `end_time` se existir; senão estimar por duração (padrão Site Sanchez usa `end_time` ou fallback por duração).
9. **Modo "qualquer profissional"** (`p_staff_id IS NULL`): gerar união de slots livres por profissional ativo, deduplicando slots idênticos (mesmo `start_time`/`end_time`) — retornar lista com `staff_id` associado ao slot livre.
10. **Somente ativos**: considerar apenas `staff.status = 'active'`. Não retornar slots para staff inativo.
11. **`SECURITY DEFINER`, `STABLE`, `SET search_path = 'public'`.**

### 4.6 Grants

```sql
REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_available_slots(TEXT, UUID, UUID[], DATE) TO anon, authenticated;
```

## 5. RPC 3: `create_public_booking`

### 5.1 Propósito

Criar reserva anônima atômica: criar `client` (se não existir, dedup por telefone normalizado), criar `appointment` com `source='booking_web'`, criar `appointment_services` (1+ linhas), gerar `public_booking_tokens` com token hashado e retornar plaintext **uma única vez**. Tudo em transação com lock anti-sobreposição.

### 5.2 Assinatura SQL (proposta)

```sql
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_identifier TEXT,
  p_staff_id UUID,
  p_service_ids UUID[],
  p_start_time TIMESTAMPTZ,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
-- implementação conforme regras abaixo
$function$;
```

### 5.3 Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `p_tenant_identifier` | TEXT | Sim | slug ou id |
| `p_staff_id` | UUID | Sim | profissional |
| `p_service_ids` | UUID[] | Sim | ao menos 1 serviço |
| `p_start_time` | TIMESTAMPTZ | Sim | início agendado |
| `p_client_name` | TEXT | Sim | nome do cliente |
| `p_client_phone` | TEXT | Sim | WhatsApp/telefone |
| `p_notes` | TEXT | Não | observações |
| `p_idempotency_key` | TEXT | Não | chave de idempotência (gerada pelo frontend) |

### 5.4 Retorno (JSONB)

```json
{
  "appointment_id": "uuid",
  "client_id": "uuid",
  "status": "confirmed",
  "public_token": "plaintext-once",
  "public_token_id": "uuid",
  "expires_at": "2026-10-09T23:59:59-03:00",
  "services": [{"service_id": "uuid", "name": "string", "duration": 30, "price": 50.00}],
  "staff": {"id": "uuid", "name": "string"},
  "start_time": "2026-10-09T09:00:00-03:00",
  "end_time": "2026-10-09T09:30:00-03:00",
  "idempotent": false
}
```

Se idempotente (chave já existe): retornar mesmo shape com `idempotent: true` e **NUNCA** reemitir token — `public_token: null` e `public_token_id` do registro existente, pois o plaintext só é retornado uma única vez (na criação).

### 5.5 Algoritmo passo a passo

1. **Tenant resolution**: por slug→id, fallback id. Exigir `booking_enabled = true`. Obter `tenant_id`, `timezone`, `booking_horizon_days`, `min_booking_notice_minutes`.
2. **Idempotência (pré-lock)**: se `p_idempotency_key` não nulo, buscar em `appointments` por `(tenant_id, idempotency_key)` onde `idempotency_key IS NOT NULL`. Se encontrado → retornar dados existentes (appointment + appointment_services + token existente se houver) com `idempotent: true`. **Não** prosseguir para inserção.
3. **Validações**: `p_client_name` não vazio (trim), `p_client_phone` válido (mínimo dígitos após normalização), `array_length(p_service_ids,1)>0`, `p_staff_id` válido e `staff.status='active'` e pertence ao tenant.
4. **Antecedência/horizonte**: `p_start_time >= now() + min_booking_notice_minutes * interval '1 minute'`. `p_start_time::date <= CURRENT_DATE + booking_horizon_days`. Rejeitar com `RAISE EXCEPTION 'booking_too_soon'` / `RAISE EXCEPTION 'booking_too_far'` (usar `ERRCODE` apropriado, ex. `P0001`).
5. **Calcular duração/fim**: somar `services.duration` para cada serviço. Calcular `end_time = p_start_time + sum(duration)*interval '1 minute'`.
6. **Anti-dupla-reserva (lock + probe)**: `PERFORM pg_advisory_xact_lock(hashtextextended(tenant_id || ':' || p_staff_id, 0));` então consultar conflito: existe appointment com `staff_id=p_staff_id`, `tenant_id`, `lower(coalesce(status,'pending')) NOT IN ('cancelled','no_show','completed')` e `tstzrange(start_time,end_time,'[)') && tstzrange(p_start_time,end_time,'[)')`? (usar `end_time` calculado). Se conflito → `RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01'` (mesmo padrão Site Sanchez `20260426000001:282-291`).
7. **Client dedup**: normalizar telefone `regexp_replace(p_client_phone, '\D', '', 'g')`. Buscar `clients` por `(tenant_id, phone_normalizado)`? `clients.phone` é TEXT (`20260219183612_create_initial_schema.sql:7`), sem unique. Buscar `WHERE tenant_id=$1 AND regexp_replace(coalesce(phone,''),'\D','','g') = phone_norm ORDER BY created_at ASC LIMIT 1` (padrão `20260426000001:266`). Se não existe → `INSERT INTO clients (tenant_id, name, phone) VALUES (...) RETURNING id`. **Não** adicionar coluna `origin` (não existe; se desejado futuramente, migration separada).
8. **Inserir appointment**: `INSERT INTO appointments (...) VALUES (...) RETURNING id`. Campos obrigatórios: `tenant_id, client_id, staff_id, start_time, end_time, status, source, notes, idempotency_key`. `status` conforme **decisão 1 HOMOLOGADA**: `CASE WHEN tenant_settings.auto_confirm_online_bookings THEN 'confirmed' ELSE 'pending' END` (coluna nova `tenant_settings.auto_confirm_online_bookings BOOLEAN NOT NULL DEFAULT true`, seção 7). `source` deve ser `'booking_web'` (extender CHECK de `appointments.source` — atual `('app','kiosk','site_sanchez')`, `20260426000001_site_sanchez_appointments_correction.sql:46`).
9. **Inserir appointment_services**: para cada `service_id` em `p_service_ids` (preservar ordem), inserir linha em `appointment_services` com `tenant_id, appointment_id, service_id, unit_price, duration_minutes, quantity=1, sort_order`. Obter `price` e `duration` de `services`. **Tabela existe** (backup `docs/backups/backup_pre_migration_20260728_152717.sql:7575-7586`) mas **NÃO tem migration de criação** — incluir `CREATE TABLE IF NOT EXISTS` na migration (seção 7).
10. **Gerar public token**: gerar token aleatório (ex. `base64url` 32 bytes) → `token_plaintext`. Calcular `token_hash = sha256(token_plaintext)` (ou `crypt`/`digest` conforme padrão portal). Inserir em `public_booking_tokens` (tabela nova, seção 7): `tenant_id, appointment_id, token_hash, expires_at, created_at`. `expires_at` = `now() + INTERVAL '90 days'` (**decisão 4 HOMOLOGADA** — 90 dias). Retornar `token_plaintext` **apenas nesta resposta**. Nunca logar plaintext.
11. **Commit transação**. Retornar shape com `idempotent=false`.

### 5.6 Grants

```sql
REVOKE EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
```

## 6. RPC 4: `cancel_public_booking`

### 6.1 Propósito

Cancelar uma reserva pública usando o `public_token` emitido na criação (fluxo pós-reserva do cliente anônimo), respeitando a janela de cancelamento homologada (decisão 3: 120 min antes do início), e revogando o token (single-use).

### 6.2 Assinatura SQL (proposta)

```sql
CREATE OR REPLACE FUNCTION public.cancel_public_booking(
  p_tenant_identifier TEXT,
  p_public_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
-- implementação conforme regras abaixo
$function$;
```

### 6.3 Parâmetros

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `p_tenant_identifier` | TEXT | Sim | slug ou id do tenant |
| `p_public_token` | TEXT | Sim | token plaintext emitido na criação da reserva |

### 6.4 Retorno (JSONB)

```json
{
  "appointment_id": "uuid",
  "status": "cancelled",
  "cancelled_at": "2026-10-09T10:00:00-03:00",
  "cancelled": true,
  "idempotent": false
}
```

### 6.5 Algoritmo passo a passo

1. **Tenant resolution**: por slug→id, fallback id (padrão `kiosk_get_staff`). Apenas resolver `tenant_id` — **não** exigir `booking_enabled` (a reserva pode existir mesmo que a casa tenha desativado novas reservas).
2. **Validar token**: hashear `p_public_token` e buscar em `public_booking_tokens` por `(tenant_id, token_hash)`. Casos:
   - Não encontrado (ou tenant divergente) → `RAISE EXCEPTION 'invalid_token'` (ERRCODE `P0001`).
   - `expires_at <= now()` → `RAISE EXCEPTION 'token_expired'`.
   - `revoked_at IS NOT NULL` **e** appointment já `cancelled` → retorno **idempotente** (`cancelled: true`, `idempotent: true`), sem erro.
   - `revoked_at IS NOT NULL` com appointment ainda ativo → `RAISE EXCEPTION 'token_revoked'`.
3. **Lock**: `PERFORM pg_advisory_xact_lock(hashtextextended(tenant_id || ':' || appointment.staff_id, 0));` — mesmo lock da RPC 3, serializando com criações concorrentes.
4. **Janela de cancelamento (decisão 3 HOMOLOGADA)**: carregar `tenant_settings.public_cancel_window_minutes` (DEFAULT 120). Se `now() > appointment.start_time - public_cancel_window_minutes * interval '1 minute'` → `RAISE EXCEPTION 'cancellation_window_closed'`.
5. **Atualizar appointment**: `status = 'cancelled'`, `cancelled_at = now()`. **Atenção:** `cancellation_type` tem CHECK restritivo de valores — verificar o CHECK vigente antes de popular; se não houver valor compatível com cancelamento online, deixar `NULL` (não inventar valor; migration de extensão de CHECK seria mudança separada).
6. **Revogar token**: `revoked_at = now()`. O token é single-use para cancelamento.
7. **Retornar** shape da seção 6.4 (`idempotent=false` no fluxo normal).

### 6.6 Grants

```sql
REVOKE EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_public_booking(TEXT, TEXT) TO anon, authenticated;
```

## 7. Migration dependencies

Todas as alterações abaixo devem ser feitas em **migration timestampada** (não neste documento). Nenhuma alteração em produção sem aprovação explícita do PO.

| Item | Status | Detalhes |
|---|---|---|
| **(i) tenant_settings.booking_enabled** | NOVA | `ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN NOT NULL DEFAULT false;` Índice opcional por tenant com enabled. |
| **(i) tenant_settings.min_booking_notice_minutes** | NOVA | `ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS min_booking_notice_minutes INTEGER NOT NULL DEFAULT 30;` (**decisão 2 HOMOLOGADA** — 30 min). |
| **(i) tenant_settings.auto_confirm_online_bookings** | NOVA | `ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS auto_confirm_online_bookings BOOLEAN NOT NULL DEFAULT true;` (**decisão 1 HOMOLOGADA** — `true` → status `confirmed`; `false` → `pending`). |
| **(i) tenant_settings.public_cancel_window_minutes** | NOVA | `ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS public_cancel_window_minutes INTEGER NOT NULL DEFAULT 120;` (**decisão 3 HOMOLOGADA** — 120 min; aplicado na RPC 4). |
| **(i) tenant_settings.work_start_time/work_end_time** | NOVA (para RPC 2) | `ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS work_start_time TIME, ADD COLUMN IF NOT EXISTS work_end_time TIME;` (**decisão 6 HOMOLOGADA** — fallback em cascata para `'07:00:00'`/`'20:00:00'` quando nulos). |
| **(ii) appointments.source CHECK** | EXTENDER | Atual: `('app','kiosk','site_sanchez')` (`20260426000001:46`). Adicionar `'booking_web'`. `ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_source_check; ALTER TABLE public.appointments ADD CONSTRAINT appointments_source_check CHECK (source IN ('app','kiosk','site_sanchez','booking_web'));` |
| **(iii) appointment_services** | CRIAR SE AUSENTE | Tabela existe no backup (`7575-7586`) mas sem migration de criação. Incluir `CREATE TABLE IF NOT EXISTS public.appointment_services (...)` com PK, FKs (`tenant_id`, `appointment_id`, `service_id`), índices, `updated_at` trigger se aplicável. Manter colunas existentes: `unit_price numeric(10,2)`, `duration_minutes integer`, `quantity integer`, `sort_order integer`. |
| **(iv) public_booking_tokens** | NOVA | `CREATE TABLE IF NOT EXISTS public.public_booking_tokens (...)` com: `id UUID PK DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE`, `token_hash VARCHAR(255) NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `expires_at TIMESTAMPTZ NOT NULL`, `used_at TIMESTAMPTZ NULL`, `revoked_at TIMESTAMPTZ NULL`. Índices: `(tenant_id, appointment_id)`, `(token_hash)`. RLS: habilitar com políticas tenant-scoped (usar helpers canônicos). |
| **(v) tenants.profile fields (opcional)** | OPCIONAL | Se desejado expor `logo_url`, `address`, `phone`, redes sociais no perfil público: adicionar colunas em `tenants` (ex. `logo_url TEXT`, `address TEXT`, `phone TEXT`, `social_links JSONB`). **Não obrigatório** — RPC 1 pode retornar `null` se ausentes. |

**Recomendação:** reutilizar `tenant_settings.booking_horizon_days` (já existe). Não criar `max_booking_days_ahead` redundante.

## 8. Grants matrix (ADR-012)

Para **cada uma** das 4 funções:

```sql
REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ... FROM anon;
GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;
```

Demais funções criadas na mesma migration: **SEMPRE** `REVOKE EXECUTE ... FROM anon` (a menos que haja justificativa explícita e aprovada pelo PO).

## 9. Regras de idempotência, rate-limit/abuse

- **Idempotência:** `p_idempotency_key` UNIQUE em `appointments.idempotency_key` (`20260428:3`). RPC 3 checa pré-lock e retorna existente com `idempotent: true`. Não reemite token plaintext.
- **Rate-limit/abuse (superfície anon) — decisão 7 HOMOLOGADA:** o lock por `(tenant_id, staff_id)` já impede sobreposição de slots, mas não impede spam de reservas. Implementar na Sprint 1: no máximo **1 reserva por telefone normalizado por tenant em janela de 10 min**, verificado dentro de `create_public_booking`. Rate-limit por IP exige Edge Function e fica para frente futura.
- **O que NUNCA pode ser retornado (zero-vazamento):**
  - `clients.email`, `clients.birthday`, `clients.avatar`, `clients.total_spent`, `clients.last_visit`, `clients.last_service`
  - `appointments.price`, `appointments.channel` interno, `appointments.external_id`, `appointments.is_overbooked`, campos internos
  - `staff.email`, `staff.phone`, `staff.user_id`, `staff.role`, `staff.commission_percent`
  - financeiro/faturamento, `tenant_settings` internos, `tenants.plan`, `tenants.status` (exceto booking_enabled)
  - outros clientes, outros agendamentos (exceto slots livres agregados)

## 10. Decisões de negócio homologadas (PO)

**Registro:** decisões 1-7 homologadas pelo PO em 2026-10-09. Documento apto para Sprint 1 (frente isolada de código, com gates próprios de migration/RLS).

| # | Campo | Homologado (PO, 2026-10-09) | Implementação |
|---|---|---|---|
| **(1)** | Status padrão do agendamento online | `confirmed`, condicionado a `tenant_settings.auto_confirm_online_bookings` (DEFAULT `true`; se `false` → `pending`) | coluna nova (seção 7) + `CASE` no passo 8 da RPC 3 |
| **(2)** | Antecedência mínima padrão | 30 min | `tenant_settings.min_booking_notice_minutes` DEFAULT 30 |
| **(3)** | Janela de cancelamento público | 120 min antes do início | `tenant_settings.public_cancel_window_minutes` DEFAULT 120; aplicado na RPC 4 (seção 6) |
| **(4)** | Validade do public token | 90 dias | `expires_at = created_at + INTERVAL '90 days'` |
| **(5)** | Escopo do token | **4ª RPC `cancel_public_booking` incluída nesta frente** (emenda do rascunho; ADR-032 atualizado para 4 RPCs) | seção 6 |
| **(6)** | Fonte de expediente | `tenant_settings` na Sprint 1 com **fallback em cascata** (valores do tenant → defaults `'07:00'`/`'20:00'`) | seção 4.5, item 3 |
| **(7)** | Rate-limit anti-spam | Aprovado: máx. 1 reserva por telefone normalizado por tenant em janela de 10 min | seção 9 |

## 11. Testes obrigatórios

| Categoria | Cenário | Critério |
|---|---|---|
| **Unidade (SQL)** | Tenant inexistente (RPC 1) | Retorna NULL, sem exceção |
| **Unidade** | booking_enabled=false | Perfil não retornado/ocultado |
| **Unidade** | Soma de durações (RPC 2) | `services.duration` somados corretamente; ignora `duration_minutes` |
| **Unidade** | Modo "qualquer profissional" | União sem duplicados |
| **Unidade** | Bloqueio schedule_blocks | Slots intersectados excluídos |
| **Unidade** | Antecedência mínima | Slots < now+min ignorados |
| **Concorrência** | 2 chamadas simultâneas mesmo slot | 2ª recebe `ERRCODE '23P01'` ('slot_occupied') |
| **Vazamento** | Resposta RPC 1 | Não contém `email`, `role`, financeiro, configs internas |
| **Vazamento** | Resposta RPC 3 | Não contém dados de terceiros; token plaintext **apenas uma vez** |
| **Idempotência** | Retry com mesmo `p_idempotency_key` | Retorna existente, `idempotent=true`, sem novo token |
| **Dedup cliente** | Mesmo telefone normalizado | Reutiliza `client_id` existente |
| **Source CHECK** | Inserir com source='booking_web' | Aceito após extensão do CHECK |
| **Token hash** | Armazenar token | Apenas `token_hash` persistido; plaintext nunca gravado |
| **Cancel (RPC 4)** | Cancel dentro da janela (≥120 min antes) | `status='cancelled'`, `cancelled_at` e `revoked_at` preenchidos |
| **Cancel (RPC 4)** | Cancel fora da janela (<120 min antes) | `RAISE 'cancellation_window_closed'` |
| **Cancel (RPC 4)** | Token inválido / expirado / de outro tenant | `invalid_token` / `token_expired` / `invalid_token` |
| **Cancel (RPC 4)** | Segundo cancel com mesmo token (appointment já cancelled) | retorno idempotente, `cancelled=true`, `idempotent=true` |
| **Cancel (RPC 4)** | Após cancelamento | slot volta a aparecer na resposta da RPC 2 |
| **Auto-confirm (decisão 1)** | `auto_confirm_online_bookings=false` | appointment criado com `status='pending'` |

## 12. Referências

- `docs/adr/ADR-032-public-online-booking.md` (esta frente)
- `docs/adr/ADR-012-rpc-execute-grants.md`
- `docs/security/SECURITY_AUDIT_RPC.md` (Padrão obrigatório ADR-012)
- `docs/FASE_3_RPC_AGENDAMENTOS_TRANSACIONAIS.md` (precedente de spec)
- `docs/integrations/SITE-SANCHEZ-CONTRACT.md` (precedente contrato público)
- `supabase/migrations/20260426000001_site_sanchez_appointments_correction.sql:46,166-168,282-291`
- `supabase/migrations/20260428_add_idempotency_key_to_appointments_and_comandas.sql:3`
- `supabase/migrations/20260305100000_unified_addons_and_portal.sql:159-168`
- `supabase/migrations/20260806000000_phase_6_0_3_team_invitations_and_role_normalization.sql:910-956`
- `supabase/migrations/20260805120000_phase_6_0_2_onboarding.sql:22-28`
- `supabase/migrations/20260312_schedule_blocks.sql:6,75-80`
- `supabase/migrations/20260813130000_h6_fix_f6_a_public_select_tenants_services.sql:23-24,61-62`
- `docs/backups/backup_pre_migration_20260728_152717.sql:7575-7586`

---

**STATUS:** Rascunho v1.1 — decisões 1-7 do PO homologadas (2026-10-09). Apto como base da Sprint 1 (frente isolada de código). Implementação pendente de autorização de frente própria.