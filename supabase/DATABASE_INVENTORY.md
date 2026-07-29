# Database Inventory — SOU MANA.GER

> Complete inventory of all database objects defined in `supabase/migrations/`.
> Reflects **final state** after all 96 migration files are applied.

---

## 1. ENUMS / CUSTOM TYPES

| Name | Values | Notes |
|------|--------|-------|
| `user_role_enum` | `owner`, `manager`, `receptionist` | Used in `profiles.role` CHECK |

> **Note:** Most "enums" are enforced via CHECK constraints on TEXT columns, not actual PostgreSQL ENUM types. The app uses TEXT + CHECK throughout.

---

## 2. TABLES (37 total)

### 2.1 Core Business Tables

#### `clients`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| name | TEXT | — | NOT NULL |
| email | TEXT | '' | |
| phone | TEXT | '' | |
| birthday | TEXT | '' | |
| avatar | TEXT | '' | |
| status | TEXT | 'active' | CHECK (active, inactive) |
| last_visit | TIMESTAMPTZ | now() | |
| last_service | TEXT | '-' | |
| total_spent | NUMERIC(10,2) | 0 | |
| created_at | TIMESTAMPTZ | now() | |

#### `services`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| name | TEXT | — | NOT NULL |
| category | TEXT | 'Cabelo' | NOT NULL |
| price | NUMERIC(10,2) | 0 | NOT NULL |
| duration | INTEGER | 30 | NOT NULL (minutes) |
| buffer | INTEGER | 0 | Added in 20260306 |
| active | BOOLEAN | true | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |

#### `staff`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| name | TEXT | — | NOT NULL |
| email | TEXT | '' | |
| phone | TEXT | '' | |
| role | TEXT | 'Barber' | CHECK (Manager, Barber, Receptionist, AdminManager) |
| avatar | TEXT | '' | |
| commission_rate | INTEGER | 40 | NOT NULL |
| status | TEXT | 'active' | CHECK (active, inactive) |
| specialties | TEXT[] | '{}' | Added in 20260306 |
| created_at | TIMESTAMPTZ | now() | |

#### `appointments`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| client_id | UUID | — | FK → clients(id) ON DELETE SET NULL |
| service_id | UUID | — | FK → services(id) ON DELETE SET NULL |
| staff_id | UUID | — | FK → staff(id) ON DELETE SET NULL |
| client_name | TEXT | '' | |
| client_phone | TEXT | '' | Added in 20260506 |
| service_name | TEXT | '' | |
| staff_name | TEXT | '' | |
| start_time | TIMESTAMPTZ | — | NOT NULL |
| end_time | TIMESTAMPTZ | — | Added in 20260506 |
| duration | NUMERIC(3,1) | 1 | NOT NULL (hours) |
| price | NUMERIC(10,2) | 0 | Added in 20260506 |
| notes | TEXT | '' | Added in 20260316 |
| status | TEXT | 'pending' | CHECK (pending, confirmed, in_progress, completed, cancelled, no_show) |
| cancellation_type | TEXT | — | Added in 20260501 |
| cancellation_reason | TEXT | '' | Added in 20260421 |
| cancelled_at | TIMESTAMPTZ | — | Added in 20260423 |
| cancelled_by_user_id | UUID | — | Added in 20260423 |
| hidden_from_schedule | BOOLEAN | false | Added in 20260501 |
| source | TEXT | 'app' | CHECK (app, kiosk, site_sanchez) |
| channel | TEXT | — | CHECK (totem, qr, whatsapp, admin, site) |
| external_source | TEXT | — | Added in 20260426 |
| external_id | TEXT | — | Added in 20260426 |
| is_overbooked | BOOLEAN | false | Added in 20260502 |
| idempotency_key | TEXT | — | UNIQUE, Added in 20260428 |
| subscription_id | UUID | — | Added in 20260506 |
| eligible_for_plan_credit | BOOLEAN | false | Added in 20260506 |
| expected_plan_service | TEXT | — | Added in 20260506 |
| plan_credit_preview | JSONB | — | Added in 20260506 |
| created_at | TIMESTAMPTZ | now() | |

#### `comandas`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| appointment_id | UUID | — | FK → appointments(id) ON DELETE SET NULL |
| client_id | UUID | — | FK → clients(id) |
| staff_id | UUID | — | FK → staff(id) ON DELETE SET NULL |
| status | TEXT | 'open' | CHECK (blocked, open, paid, cancelled) |
| total | NUMERIC | 0 | |
| payment_method | TEXT | — | |
| closure_mode | TEXT | 'standard' | CHECK (standard, legacy_membership) |
| closure_note | TEXT | — | |
| financial_effect | BOOLEAN | true | |
| membership_credit_effect | BOOLEAN | true | |
| legacy_reference_month | DATE | — | |
| payment_date_real | TIMESTAMPTZ | — | Added in 20260514 |
| settled_at | TIMESTAMPTZ | — | Added in 20260514 |
| settled_by_user_id | UUID | — | Added in 20260514 |
| closed_at | TIMESTAMPTZ | — | Added in 20260420 |
| cancellation_type | TEXT | — | Added in 20260501 |
| cancelled_at | TIMESTAMPTZ | — | Added in 20260501 |
| cancelled_by_user_id | UUID | — | Added in 20260501 |
| hidden_from_financial | BOOLEAN | false | Added in 20260501 |
| idempotency_key | TEXT | — | UNIQUE, Added in 20260428 |
| created_at | TIMESTAMPTZ | now() | |

#### `comanda_items`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| comanda_id | UUID | — | FK → comandas(id) ON DELETE CASCADE |
| service_id | UUID | — | FK → services(id) |
| product_id | UUID | — | FK → products(id), Added in 20260220 |
| product_name | TEXT | — | |
| quantity | INTEGER | 1 | |
| unit_price | NUMERIC | — | NOT NULL |
| subtotal | NUMERIC | — | |
| staff_id | UUID | — | FK → staff(id) |
| notes | TEXT | — | |
| created_at | TIMESTAMPTZ | now() | |

### 2.2 Tenant & Auth Tables

#### `tenants`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| name | TEXT | — | NOT NULL |
| slug | TEXT | — | UNIQUE, NOT NULL |
| active | BOOLEAN | true | |
| plan | TEXT | — | |
| address | TEXT | — | |
| phone | TEXT | — | |
| email | TEXT | — | |
| logo_url | TEXT | — | |
| settings | JSONB | — | |
| onboarding_completed | BOOLEAN | — | Added in 20260221 |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `profiles`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | — | PK, FK → auth.users(id) ON DELETE CASCADE |
| tenant_id | UUID | — | FK → tenants(id) |
| email | TEXT | — | |
| full_name | TEXT | — | |
| role | TEXT | 'staff' | CHECK (superadmin, manager, staff, barber) |
| status | TEXT | 'active' | CHECK (active, pending, suspended) |
| avatar_url | TEXT | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `user_tenants`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| user_id | UUID | — | FK → auth.users(id) ON DELETE CASCADE |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| role | TEXT | 'member' | |
| is_primary | BOOLEAN | false | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

### 2.3 Products & Inventory Tables

#### `products`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) |
| name | TEXT | — | NOT NULL |
| description | TEXT | — | |
| cost_price | NUMERIC | — | |
| sale_price | NUMERIC | — | |
| stock_quantity | INTEGER | 0 | |
| minimum_stock | INTEGER | 0 | |
| auto_generate_purchase_order | BOOLEAN | false | |
| active | BOOLEAN | true | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `suppliers`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) |
| name | TEXT | — | NOT NULL |
| email | TEXT | — | |
| phone | TEXT | — | |
| category | TEXT | — | |
| created_at | TIMESTAMPTZ | now() | |

#### `purchase_orders`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) |
| product_id | UUID | — | FK → products(id) |
| supplier_id | UUID | — | FK → suppliers(id) |
| quantity | INTEGER | — | NOT NULL |
| status | TEXT | — | CHECK (pending, approved, ordered, received) |
| created_at | TIMESTAMPTZ | now() | |

#### `inventory_movements`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| product_id | UUID | — | FK → products(id) ON DELETE RESTRICT |
| movement_type | TEXT | — | CHECK (sale, return, reversal, adjustment, purchase, manual_correction) |
| quantity_delta | INTEGER | — | NOT NULL, CHECK (<> 0) |
| quantity_before | INTEGER | — | NOT NULL, CHECK (>= 0) |
| quantity_after | INTEGER | — | NOT NULL, CHECK (>= 0) |
| source_type | TEXT | — | CHECK (comanda, financial_reversal, manual, purchase_order) |
| source_id | UUID | — | NOT NULL |
| idempotency_key | TEXT | — | UNIQUE per tenant |
| reason | TEXT | — | |
| created_by_user_id | UUID | — | FK → auth.users(id) |
| created_at | TIMESTAMPTZ | now() | |
| metadata | JSONB | '{}' | |

### 2.4 Financial Tables

#### `transactions`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | |
| user_id | UUID | — | |
| type | TEXT | — | NOT NULL |
| category | TEXT | — | NOT NULL |
| amount | NUMERIC | — | NOT NULL |
| description | TEXT | — | |
| payment_method | TEXT | — | |
| date | TIMESTAMPTZ | utc now() | |
| status | TEXT | 'completed' | |
| method | VARCHAR | — | |
| notes | TEXT | — | |
| due_day | INTEGER | — | |
| source_type | TEXT | — | Added in 20260514 |
| source_id | UUID | — | Added in 20260514 |
| idempotency_key | TEXT | — | UNIQUE per tenant, Added in 20260514 |
| metadata | JSONB | '{}' | Added in 20260514 |
| created_at | TIMESTAMPTZ | utc now() | |
| updated_at | TIMESTAMPTZ | utc now() | |

#### `cash_closings`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| business_date | DATE | — | NOT NULL, UNIQUE(tenant_id, business_date) |
| period_start | TIMESTAMPTZ | — | NOT NULL |
| period_end | TIMESTAMPTZ | — | NOT NULL |
| status | TEXT | 'draft' | CHECK (draft, confirmed, adjusted) |
| created_by_user_id | UUID | — | FK → profiles(id) |
| confirmed_by_user_id | UUID | — | FK → profiles(id) |
| notes | TEXT | — | |
| expected_income | NUMERIC | 0 | |
| expected_expense | NUMERIC | 0 | |
| expected_balance | NUMERIC | 0 | |
| total_counted | NUMERIC | 0 | |
| total_difference | NUMERIC | 0 | |
| appointments_scheduled_count | INTEGER | 0 | |
| appointments_completed_count | INTEGER | 0 | |
| appointments_received_count | INTEGER | 0 | |
| appointments_cancelled_count | INTEGER | 0 | |
| appointments_pending_count | INTEGER | 0 | |
| appointments_no_show_count | INTEGER | 0 | |
| appointments_summary | JSONB | '{}' | |
| financial_summary | JSONB | '{}' | |
| opening_time | TIMESTAMPTZ | — | Added in 20260717 |
| closing_time | TIMESTAMPTZ | — | Added in 20260717 |
| ip_address | TEXT | — | Added in 20260717 |
| user_agent | TEXT | — | Added in 20260717 |
| total_sangrias | NUMERIC | 0 | Added in 20260717 |
| total_suprimentos | NUMERIC | 0 | Added in 20260717 |
| barber_closings_count | INTEGER | 0 | Added in 20260717 |
| barber_closings_complete | BOOLEAN | false | Added in 20260717 |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |
| confirmed_at | TIMESTAMPTZ | — | |

#### `barber_closings`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| cash_closing_id | UUID | — | FK → cash_closings(id) ON DELETE CASCADE |
| business_date | DATE | — | NOT NULL |
| staff_id | UUID | — | FK → staff(id) ON DELETE RESTRICT |
| status | TEXT | 'open' | CHECK (open, closed, discrepancy) |
| total_produced | NUMERIC | 0 | |
| total_received | NUMERIC | 0 | |
| commission_total | NUMERIC | 0 | |
| repasse_total | NUMERIC | 0 | |
| discounts_total | NUMERIC | 0 | |
| advances_total | NUMERIC | 0 | |
| balance | NUMERIC | 0 | |
| payment_methods | JSONB | '{}' | |
| counted_cash | NUMERIC | 0 | |
| expected_cash | NUMERIC | 0 | |
| cash_difference | NUMERIC | 0 | |
| conference_justification | TEXT | — | |
| checklist | JSONB | '{}' | |
| comandas_count | INTEGER | 0 | |
| clients_served_count | INTEGER | 0 | |
| products_sold_count | INTEGER | 0 | |
| closed_by_user_id | UUID | — | FK → profiles(id) |
| closed_at | TIMESTAMPTZ | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `cash_closing_events`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| cash_closing_id | UUID | — | FK → cash_closings(id) ON DELETE CASCADE |
| barber_closing_id | UUID | — | FK → barber_closings(id) ON DELETE SET NULL |
| business_date | DATE | — | NOT NULL |
| event_type | TEXT | — | CHECK (opening, service, sangria, suprimento, reversal, closing, barber_closing, audit, adjustment) |
| event_time | TIMESTAMPTZ | now() | NOT NULL |
| label | TEXT | — | NOT NULL |
| detail | TEXT | — | |
| metadata | JSONB | '{}' | |
| created_by_user_id | UUID | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | now() | |

#### `financial_reversals`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| original_transaction_id | UUID | — | FK → transactions(id) ON DELETE RESTRICT |
| reversal_transaction_id | UUID | — | FK → transactions(id) ON DELETE SET NULL |
| source_type | TEXT | — | |
| source_id | UUID | — | |
| reversal_type | TEXT | — | CHECK (wrong_settlement, full_refund, partial_refund, duplicate_charge, administrative_cancellation, financial_review) |
| amount | NUMERIC | — | NOT NULL, CHECK (> 0) |
| reason_type | TEXT | — | NOT NULL |
| reason_note | TEXT | — | NOT NULL |
| refund_method | TEXT | — | |
| idempotency_key | TEXT | — | UNIQUE per tenant |
| created_by_user_id | UUID | — | FK → auth.users(id) |
| created_at | TIMESTAMPTZ | now() | |
| metadata | JSONB | '{}' | |

### 2.5 Chef Club (Subscription) Tables

#### `customer_plans`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| name | TEXT | — | NOT NULL, UNIQUE(tenant_id, name) |
| monthly_price | NUMERIC(10,2) | 0 | NOT NULL |
| service_credits | INTEGER | 0 | NOT NULL |
| description | TEXT | '' | NOT NULL |
| priority_booking | BOOLEAN | false | NOT NULL |
| product_discount | NUMERIC(5,2) | 0 | CHECK (0-100) |
| max_rollover_credits | INTEGER | 0 | NOT NULL |
| credit_validity_days | INTEGER | 30 | CHECK (> 0) |
| service_credit_map | JSONB | '[]' | NOT NULL, Added in 20260418 |
| active | BOOLEAN | true | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `customer_subscriptions`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| client_id | UUID | — | FK → clients(id) ON DELETE CASCADE |
| plan_id | UUID | — | FK → customer_plans(id) ON DELETE RESTRICT |
| status | TEXT | 'active' | CHECK (active, past_due, canceled, paused) |
| started_at | TIMESTAMPTZ | now() | NOT NULL |
| cycle_start | TIMESTAMPTZ | now() | NOT NULL |
| cycle_end | TIMESTAMPTZ | now()+30d | NOT NULL |
| next_billing_date | DATE | now()+30d | NOT NULL |
| canceled_at | TIMESTAMPTZ | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Unique index:** One open subscription per (tenant_id, client_id) where status IN (active, past_due, paused)

#### `customer_credits`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| subscription_id | UUID | — | FK → customer_subscriptions(id) ON DELETE CASCADE, UNIQUE |
| client_id | UUID | — | FK → clients(id) ON DELETE CASCADE |
| available_credits | INTEGER | 0 | NOT NULL |
| used_credits | INTEGER | 0 | NOT NULL |
| service_balance_map | JSONB | '[]' | NOT NULL, Added in 20260418 |
| period_start | TIMESTAMPTZ | now() | NOT NULL |
| period_end | TIMESTAMPTZ | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `customer_subscription_receivables`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| customer_id | UUID | — | FK → clients(id) ON DELETE CASCADE |
| subscription_id | UUID | — | FK → customer_subscriptions(id) ON DELETE CASCADE |
| plan_id | UUID | — | FK → customer_plans(id) ON DELETE RESTRICT |
| billing_cycle_start | TIMESTAMPTZ | — | NOT NULL |
| billing_cycle_end | TIMESTAMPTZ | — | NOT NULL |
| due_date | DATE | — | NOT NULL |
| amount | NUMERIC(12,2) | 0 | CHECK (>= 0) |
| status | TEXT | 'pending' | CHECK (pending, paid, overdue, cancelled, refunded) |
| payment_method | TEXT | — | |
| paid_at | TIMESTAMPTZ | — | |
| paid_by | UUID | — | |
| transaction_id | UUID | — | FK → transactions(id) ON DELETE SET NULL, UNIQUE |
| notes | TEXT | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

### 2.6 Scheduling Tables

#### `schedule_blocks`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| professional_id | UUID | — | FK → staff(id) ON DELETE SET NULL |
| block_type | TEXT | — | CHECK (full_day, time_range) |
| start_date | DATE | — | NOT NULL |
| end_date | DATE | — | NOT NULL, CHECK (>= start_date) |
| start_time | TIME | — | |
| end_time | TIME | — | |
| reason | TEXT | — | NOT NULL |
| notes | TEXT | — | |
| recurrence_type | TEXT | 'none' | CHECK (none, weekly) |
| recurrence_until | DATE | — | |
| existing_appointments_action | TEXT | 'keep' | CHECK (keep, review, cancel) |
| created_by | UUID | — | |
| removed_by | UUID | — | |
| removed_at | TIMESTAMPTZ | — | |
| status | TEXT | 'active' | CHECK (active, cancelled) |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

### 2.7 Kiosk & Feedback Tables

#### `kiosk_addons`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | NOT NULL, UNIQUE |
| status | TEXT | 'disabled' | CHECK (enabled, disabled) |
| activated_at | TIMESTAMPTZ | — | |
| max_devices | INT | 1 | |
| kiosk_theme | TEXT | 'default' | CHECK (default, sanchez, custom) |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `tenant_addons`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| addon_key | VARCHAR(50) | — | NOT NULL |
| status | VARCHAR(20) | 'disabled' | |
| activated_at | TIMESTAMPTZ | — | |
| limits | JSONB | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Unique constraint:** UNIQUE(tenant_id, addon_key)

#### `kiosk_devices`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | NOT NULL |
| name | TEXT | — | NOT NULL |
| is_active | BOOLEAN | true | |
| theme | TEXT | 'default' | CHECK (default, sanchez, custom) |
| timeout_seconds | INT | 30 | |
| visible_services | UUID[] | '{}' | |
| visible_barbers | UUID[] | '{}' | |
| last_seen_at | TIMESTAMPTZ | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

#### `kiosk_sessions`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | NOT NULL |
| device_id | UUID | — | FK → kiosk_devices(id) ON DELETE SET NULL |
| channel | TEXT | 'totem' | CHECK (totem, qr) |
| started_at | TIMESTAMPTZ | now() | |
| ended_at | TIMESTAMPTZ | — | |
| client_id | UUID | — | |
| status | TEXT | 'initiated' | CHECK (initiated, identified, completed, expired) |
| ip_address | TEXT | — | |
| user_agent | TEXT | — | |
| action_log | JSONB | '[]' | |

#### `feedback_barber`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | NOT NULL |
| client_id | UUID | — | |
| barber_id | UUID | — | |
| session_id | UUID | — | FK → kiosk_sessions(id) ON DELETE SET NULL |
| rating | INT | — | CHECK (1-5) |
| tags | TEXT[] | '{}' | |
| comment | TEXT | — | |
| source_channel | TEXT | 'totem' | CHECK (totem, qr, app) |
| created_at | TIMESTAMPTZ | now() | |

#### `feedback_shop`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | NOT NULL |
| client_id | UUID | — | |
| session_id | UUID | — | FK → kiosk_sessions(id) ON DELETE SET NULL |
| nps | INT | — | CHECK (0-10) |
| reasons | TEXT[] | '{}' | |
| comment | TEXT | — | |
| marketing_opt_in | BOOLEAN | false | |
| source_channel | TEXT | 'totem' | CHECK (totem, qr, app) |
| created_at | TIMESTAMPTZ | now() | |

### 2.8 Notification & Monitoring Tables

#### `notifications`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| user_id | UUID | — | FK → auth.users(id) ON DELETE CASCADE |
| type | TEXT | — | NOT NULL |
| title | TEXT | — | NOT NULL |
| message | TEXT | — | NOT NULL |
| entity_type | TEXT | — | |
| entity_id | UUID | — | |
| severity | TEXT | 'info' | CHECK (info, warning, critical) |
| status | TEXT | 'unread' | CHECK (unread, read, archived) |
| read_at | TIMESTAMPTZ | — | |
| metadata | JSONB | '{}' | |
| created_at | TIMESTAMPTZ | now() | |

**Unique partial index:** unread notifications deduplicated by (tenant_id, type, entity_type, entity_id, user_id)

#### `notification_preferences`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| user_id | UUID | — | FK → auth.users(id) ON DELETE CASCADE |
| type | TEXT | — | NOT NULL |
| enabled | BOOLEAN | true | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Unique constraint:** UNIQUE(tenant_id, user_id, type)

#### `notification_channels`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| channel_type | TEXT | — | CHECK (email, webhook, internal) |
| target | TEXT | — | NOT NULL |
| is_enabled | BOOLEAN | true | NOT NULL |
| last_triggered_at | TIMESTAMPTZ | — | |
| created_at | TIMESTAMPTZ | now() | |

#### `usage_logs`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| resource_type | TEXT | — | NOT NULL |
| value | NUMERIC | — | NOT NULL |
| limit_value | NUMERIC | — | NOT NULL |
| unit | TEXT | — | NOT NULL |
| source | TEXT | 'manual' | NOT NULL |
| metadata | JSONB | '{}' | |
| created_at | TIMESTAMPTZ | now() | |

#### `alerts`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| resource_type | TEXT | — | NOT NULL |
| message | TEXT | — | NOT NULL |
| level | TEXT | — | CHECK (warning, critical) |
| current_value | NUMERIC | — | |
| limit_value | NUMERIC | — | |
| usage_pct | NUMERIC | — | |
| resolved_at | TIMESTAMPTZ | — | |
| created_at | TIMESTAMPTZ | now() | |

### 2.9 Voucher & Promotion Tables

#### `promotions`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| title | TEXT | — | NOT NULL |
| target_type | TEXT | — | CHECK (service, product, all) |
| target_id | UUID | — | |
| discount_type | TEXT | — | CHECK (percentage, fixed) |
| discount_value | NUMERIC | — | NOT NULL |
| start_date | TIMESTAMPTZ | — | |
| end_date | TIMESTAMPTZ | — | |
| active | BOOLEAN | true | |
| created_at | TIMESTAMPTZ | now() | |

#### `customer_vouchers`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| customer_id | UUID | — | FK → clients(id) ON DELETE CASCADE |
| promotion_id | UUID | — | FK → promotions(id) ON DELETE SET NULL |
| voucher_code | TEXT | — | |
| title | TEXT | — | NOT NULL |
| description | TEXT | — | |
| benefit_type | TEXT | — | CHECK (free_service, discount_fixed, discount_percentage, custom_benefit) |
| service_id | UUID | — | FK → services(id) ON DELETE SET NULL |
| discount_amount | NUMERIC | — | CHECK (>= 0) |
| discount_percentage | NUMERIC | — | CHECK (0-100) |
| status | TEXT | 'available' | CHECK (available, used, expired, cancelled) |
| issued_at | TIMESTAMPTZ | now() | |
| expires_at | TIMESTAMPTZ | — | |
| used_at | TIMESTAMPTZ | — | |
| used_comanda_id | UUID | — | FK → comandas(id) ON DELETE SET NULL |
| issued_by_user_id | UUID | — | FK → auth.users(id) |
| used_by_user_id | UUID | — | FK → auth.users(id) |
| cancelled_by_user_id | UUID | — | FK → auth.users(id) |
| cancellation_reason | TEXT | — | |
| notes | TEXT | — | |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

### 2.10 Service Execution & Kiosk Tables

#### `service_execution_participants`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| comanda_item_id | UUID | — | FK → comanda_items(id) ON DELETE CASCADE |
| professional_id | UUID | — | FK → staff(id) ON DELETE CASCADE |
| role | TEXT | 'assistant' | CHECK (primary, assistant, co_executor) |
| payout_type | TEXT | 'percentage' | CHECK (percentage, fixed) |
| payout_value | NUMERIC(10,2) | 0 | NOT NULL |
| affects_revenue | BOOLEAN | false | NOT NULL |
| affects_commission | BOOLEAN | true | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |

### 2.11 Access Request & Support Tables

#### `access_requests`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_name | TEXT | — | |
| owner_name | TEXT | — | |
| email | TEXT | — | |
| phone | TEXT | — | |
| status | TEXT | 'pending' | CHECK (pending, approved, rejected) |
| created_at | TIMESTAMPTZ | now() | |

#### `support_tickets`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| user_id | UUID | — | NOT NULL |
| subject | TEXT | — | NOT NULL |
| description | TEXT | — | |
| status | TEXT | 'open' | CHECK (open, responded, closed) |
| priority | TEXT | 'medium' | CHECK (low, medium, high) |
| created_at | TIMESTAMPTZ | now() | |

#### `ticket_messages`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| ticket_id | UUID | — | FK → support_tickets(id) ON DELETE CASCADE |
| sender_id | UUID | — | NOT NULL |
| message | TEXT | — | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |

#### `plan_change_requests`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| user_id | UUID | — | NOT NULL |
| current_plan | TEXT | — | |
| requested_plan | TEXT | — | |
| status | TEXT | 'pending' | CHECK (pending, approved, rejected) |
| created_at | TIMESTAMPTZ | now() | |

### 2.12 Portal & OTP Tables

#### `otp_requests`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| phone | VARCHAR(20) | — | NOT NULL |
| code_hash | VARCHAR(255) | — | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |
| expires_at | TIMESTAMPTZ | — | NOT NULL |
| attempts | INTEGER | 0 | |
| last_sent_at | TIMESTAMPTZ | — | |
| status | VARCHAR(20) | 'pending' | |

#### `portal_sessions`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| client_id | UUID | — | FK → clients(id) ON DELETE CASCADE |
| token_hash | VARCHAR(255) | — | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |
| expires_at | TIMESTAMPTZ | — | NOT NULL |
| last_seen_at | TIMESTAMPTZ | now() | |
| device_fingerprint | VARCHAR(255) | — | |

### 2.13 Audit & Role Permission Tables

#### `audit_logs`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | uuid_generate_v4() | PK |
| tenant_id | UUID | — | |
| table_name | TEXT | — | NOT NULL |
| record_id | TEXT | — | NOT NULL |
| action | TEXT | — | CHECK (INSERT, UPDATE, DELETE) |
| old_data | JSONB | — | |
| new_data | JSONB | — | |
| changed_by | UUID | — | FK → auth.users(id) ON DELETE SET NULL |
| changed_at | TIMESTAMPTZ | utc now() | |

#### `role_permissions`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| role | TEXT | — | CHECK (Barber, Receptionist) |
| permission_key | TEXT | — | NOT NULL |
| enabled | BOOLEAN | false | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |
| created_by | UUID | — | FK → auth.users(id) ON DELETE SET NULL |

**Unique constraint:** UNIQUE(tenant_id, role, permission_key)

#### `role_permissions_audit`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| role | TEXT | — | CHECK (Barber, Receptionist) |
| permission_key | TEXT | — | NOT NULL |
| old_enabled | BOOLEAN | — | |
| new_enabled | BOOLEAN | — | NOT NULL |
| changed_by | UUID | — | FK → auth.users(id) ON DELETE SET NULL |
| changed_at | TIMESTAMPTZ | now() | |

### 2.14 Event Sourcing Tables

#### `event_store`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| event_id | TEXT | — | NOT NULL, UNIQUE |
| event_type | TEXT | — | NOT NULL |
| aggregate_type | TEXT | — | NOT NULL |
| aggregate_id | TEXT | — | NOT NULL |
| payload | JSONB | '{}' | NOT NULL |
| metadata | JSONB | '{}' | NOT NULL |
| version | INTEGER | 1 | NOT NULL |
| occurred_at | TIMESTAMPTZ | — | NOT NULL |
| stored_at | TIMESTAMPTZ | now() | NOT NULL |
| tenant_id | TEXT | — | NOT NULL |
| correlation_id | TEXT | — | |
| causation_id | TEXT | — | |
| source | TEXT | — | |

**Append-only:** No UPDATE or DELETE policies. RLS: superadmin bypass + tenant isolation.

#### `processed_operations`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | TEXT | — | NOT NULL |
| event_id | TEXT | — | NOT NULL |
| operation_type | TEXT | — | NOT NULL |
| idempotency_key | TEXT | — | NOT NULL |
| processed_at | TIMESTAMPTZ | now() | NOT NULL |
| handler_version | INTEGER | 1 | NOT NULL |
| metadata | JSONB | '{}' | |

**Immutable:** No UPDATE or DELETE policies. RLS: superadmin bypass + tenant isolation.

### 2.15 Tenant Goals Table

#### `tenant_goals`
| Column | Type | Default | Constraints |
|--------|------|---------|-------------|
| id | UUID | gen_random_uuid() | PK |
| tenant_id | UUID | — | FK → tenants(id) ON DELETE CASCADE |
| period | TEXT | 'monthly' | CHECK (weekly, monthly, yearly) |
| revenue_goal | NUMERIC(12,2) | 0 | NOT NULL |
| appointments_goal | INTEGER | 0 | NOT NULL |
| clients_goal | INTEGER | 0 | NOT NULL |
| active | BOOLEAN | true | NOT NULL |
| created_at | TIMESTAMPTZ | now() | |
| updated_at | TIMESTAMPTZ | now() | |

**Unique partial index:** UNIQUE(tenant_id, period) WHERE active = true

---

## 3. FUNCTIONS / RPCs (44 total)

### 3.1 Helper Functions (used across RLS policies)

| Function | Returns | Volatility | Purpose |
|----------|---------|------------|---------|
| `current_tenant_id_from_auth_uid()` | UUID | STABLE, SECURITY DEFINER | Returns tenant_id for current auth user |
| `current_is_super_admin_from_auth_uid()` | BOOLEAN | STABLE, SECURITY DEFINER | Checks if current user is superadmin |
| `get_current_tenant_id()` | UUID | — | Legacy helper (replaced in RLS by above) |
| `is_super_admin()` | BOOLEAN | STABLE, SECURITY DEFINER | JWT-based superadmin check |
| `get_auth_access_context()` | — | — | RPC returning access context |

### 3.2 Appointment & Comanda RPCs

| Function | Returns | Parameters | Security |
|----------|---------|------------|----------|
| `create_appointment_with_comanda(...)` | JSONB | p_tenant_id, p_client_id, p_client_name, p_client_phone, p_service_id, p_staff_id, p_start_time, p_price, p_notes, p_idempotency_key, p_is_overbooked | SECURITY DEFINER |
| `create_appointment_with_services(...)` | JSONB | p_tenant_id, p_client_id, p_client_name, p_client_phone, p_staff_id, p_start_time, p_notes, p_idempotency_key, p_services (JSONB array) | SECURITY DEFINER |
| `create_site_sanchez_appointment(...)` | JSONB | p_tenant_id, p_client_name, p_phone, p_service_id, p_professional_id, p_scheduled_at, p_notes, p_domain_schema, p_status, p_site_appointment_id, p_external_id | SECURITY INVOKER |
| `bulk_close_comandas_admin(...)` | JSONB | p_comanda_ids (UUID[]), p_tenant_id, p_closure_note, p_legacy_reference_month | SECURITY DEFINER |
| `validate_and_fix_comandas(...)` | TABLE(fix_type, comanda_id, description, fixed) | p_tenant_id | SECURITY DEFINER |
| `detect_no_show_appointments(...)` | TABLE(appointment_id, client_name, start_time, minutes_late) | p_tenant_id, p_grace_minutes | SECURITY DEFINER |

### 3.3 Financial RPCs

| Function | Returns | Parameters | Security |
|----------|---------|------------|----------|
| `finance_settle_comanda(...)` | JSONB | p_tenant_id, p_comanda_id, p_payment_method, p_paid_amount, p_payment_date_real, p_source, p_notes, p_idempotency_key | SECURITY DEFINER |
| `finance_reverse_transaction(...)` | JSONB | p_tenant_id, p_original_transaction_id, p_reversal_type, p_amount, p_reason_type, p_reason_note, p_refund_method, p_reversal_date, p_idempotency_key | SECURITY DEFINER |
| `finance_zero_close_comanda(...)` | JSONB | p_tenant_id, p_comanda_id, p_origin, p_reason, p_source, p_idempotency_key, p_authorized_by | SECURITY DEFINER |
| `close_order(p_comanda_id)` | VOID | p_comanda_id | SECURITY DEFINER (legacy) |

### 3.4 Inventory RPCs

| Function | Returns | Parameters | Security |
|----------|---------|------------|----------|
| `apply_inventory_sale_for_comanda(...)` | JSONB | p_tenant_id, p_comanda_id, p_source_idempotency_key, p_created_by_user_id | SECURITY DEFINER |
| `check_minimum_stock(p_product_id)` | VOID | p_product_id | SECURITY DEFINER |

### 3.5 Chef Club RPCs

| Function | Returns | Parameters | Security |
|----------|---------|------------|----------|
| `create_chef_club_subscription(...)` | JSONB | p_tenant_id, p_client_id, p_plan_id, p_next_billing_date, p_replace_existing | SECURITY DEFINER |
| `deduct_chef_club_credits(...)` | VOID | p_subscription_id, p_service_id, p_amount, p_reference | SECURITY DEFINER |
| `preview_plan_credit_for_service(...)` | TABLE(eligible, reason, available_credits, subscription_id) | p_tenant_id, p_client_id, p_service_id, p_start_time | SECURITY DEFINER |
| `ensure_club_receivable_for_cycle(...)` | UUID | p_subscription_id, p_billing_cycle_start, p_billing_cycle_end, p_due_date | SECURITY DEFINER |
| `pay_club_receivable(...)` | JSONB | p_receivable_id, p_payment_method, p_paid_at, p_notes | SECURITY DEFINER |
| `generate_club_receivables(...)` | INTEGER | p_tenant_id | SECURITY DEFINER |
| `refresh_club_receivable_statuses(...)` | INTEGER | p_tenant_id | SECURITY DEFINER |
| `build_chef_club_service_balance_map(...)` | TABLE(service_balance_map, total_credits) | p_plan_id | SECURITY DEFINER |

### 3.6 Notification RPCs

| Function | Returns | Parameters | Security |
|----------|---------|------------|----------|
| `create_internal_notification(...)` | UUID | p_tenant_id, p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id, p_severity, p_metadata | SECURITY DEFINER |
| `list_internal_notifications(...)` | TABLE(id, tenant_id, ...) | p_status, p_limit, p_offset | SECURITY DEFINER |
| `count_unread_notifications()` | INTEGER | — | SECURITY DEFINER |
| `mark_notification_read(p_notification_id)` | VOID | p_notification_id | SECURITY DEFINER |
| `mark_all_notifications_read()` | INTEGER | — | SECURITY DEFINER |
| `archive_notification(p_notification_id)` | VOID | p_notification_id | SECURITY DEFINER |
| `get_notification_preferences()` | TABLE(type, label, description, enabled) | — | SECURITY DEFINER |
| `set_notification_preferences(...)` | TABLE(type, label, description, enabled) | p_preferences (JSONB) | SECURITY DEFINER |
| `generate_system_notifications(...)` | JSONB | p_tenant_id, p_upcoming_minutes, p_billing_days | SECURITY DEFINER |
| `notification_type_catalog()` | TABLE(type, label, description) | — | SQL, STABLE |

### 3.7 Role Permission RPCs

| Function | Returns | Parameters | Security |
|----------|---------|------------|----------|
| `get_role_permissions(...)` | TABLE(permission_key, enabled) | p_tenant_id, p_role | SECURITY DEFINER |
| `upsert_role_permissions(...)` | VOID | p_tenant_id, p_role, p_permissions (JSONB) | SECURITY DEFINER |
| `reset_role_permissions_to_default(...)` | VOID | p_tenant_id, p_role | SECURITY DEFINER |
| `set_role_permission(...)` | — | — | SECURITY DEFINER |

### 3.8 Access Request RPCs

| Function | Returns | Parameters | Security |
|----------|---------|------------|----------|
| `approve_access_request(p_request_id)` | VOID | p_request_id | SECURITY DEFINER |

### 3.9 Trigger Functions

| Function | Trigger Event | Table | Purpose |
|----------|--------------|-------|---------|
| `set_tenant_id()` | BEFORE INSERT | Multiple | Sets tenant_id from profiles |
| `set_tenant_id_from_profile()` | BEFORE INSERT | 11 tables | SECURITY DEFINER version of above |
| `handle_new_manager_profile()` | AFTER INSERT | profiles | Auto-inserts manager into staff |
| `set_updated_at_timestamp()` | BEFORE UPDATE | Multiple | Sets updated_at = now() |
| `handle_updated_at()` | BEFORE UPDATE | tenant_goals | Same as above |
| `touch_updated_at()` | BEFORE UPDATE | notification_preferences | Same as above |
| `update_cash_closing_updated_at()` | BEFORE UPDATE | cash_closings | Same as above |
| `handle_barber_closings_updated_at()` | BEFORE UPDATE | barber_closings | Same as above |
| `update_role_permissions_updated_at()` | BEFORE UPDATE | role_permissions | Same as above |
| `process_audit_log()` | AFTER INSERT/UPDATE/DELETE | clients, appointments, products, services, comandas | SECURITY DEFINER audit logger |
| `audit_role_permissions_changes()` | AFTER INSERT/UPDATE/DELETE | role_permissions | SECURITY DEFINER audit for permissions |
| `notify_comanda_open()` | AFTER INSERT/UPDATE | comandas | Creates notification on comanda open |
| `notify_low_stock_product()` | AFTER INSERT/UPDATE | products | Creates notification on low stock |
| `validate_customer_voucher_tenant()` | BEFORE INSERT/UPDATE | customer_vouchers | Validates voucher references |

---

## 4. TRIGGERS (30+)

| Trigger Name | Table | Event | Function |
|-------------|-------|-------|----------|
| trg_set_tenant_id_clients | clients | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_services | services | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_staff | staff | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_appointments | appointments | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_comandas | comandas | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_comanda_items | comanda_items | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_products | products | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_suppliers | suppliers | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_purchase_orders | purchase_orders | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id_promotions | promotions | BEFORE INSERT | set_tenant_id() |
| trg_set_tenant_id (bulk) | notifications, etc. | BEFORE INSERT | set_tenant_id_from_profile() |
| trg_auto_insert_manager_to_staff | profiles | AFTER INSERT | handle_new_manager_profile() |
| trg_customer_plans_updated_at | customer_plans | BEFORE UPDATE | set_updated_at_timestamp() |
| trg_customer_subscriptions_updated_at | customer_subscriptions | BEFORE UPDATE | set_updated_at_timestamp() |
| trg_customer_credits_updated_at | customer_credits | BEFORE UPDATE | set_updated_at_timestamp() |
| trg_customer_vouchers_updated_at | customer_vouchers | BEFORE UPDATE | set_updated_at_timestamp() |
| trg_customer_subscription_receivables_updated_at | customer_subscription_receivables | BEFORE UPDATE | set_updated_at_timestamp() |
| trg_schedule_blocks_updated_at | schedule_blocks | BEFORE UPDATE | set_updated_at_timestamp() |
| trg_notification_preferences_updated_at | notification_preferences | BEFORE UPDATE | touch_updated_at() |
| cash_closings_updated_at | cash_closings | BEFORE UPDATE | update_cash_closing_updated_at() |
| barber_closings_updated_at | barber_closings | BEFORE UPDATE | handle_barber_closings_updated_at() |
| trigger_update_role_permissions_updated_at | role_permissions | BEFORE UPDATE | update_role_permissions_updated_at() |
| trigger_audit_role_permissions_changes | role_permissions | AFTER INSERT/UPDATE/DELETE | audit_role_permissions_changes() |
| trg_notify_comanda_open_insert | comandas | AFTER INSERT (WHEN open) | notify_comanda_open() |
| trg_notify_comanda_open_update | comandas | AFTER UPDATE OF status (WHEN open) | notify_comanda_open() |
| trg_notify_low_stock_product | products | AFTER INSERT/UPDATE OF stock_quantity, minimum_stock, active | notify_low_stock_product() |
| trg_customer_vouchers_validate_tenant | customer_vouchers | BEFORE INSERT/UPDATE | validate_customer_voucher_tenant() |
| audit_trigger_row_clients | clients | AFTER INSERT/UPDATE/DELETE | process_audit_log() |
| audit_trigger_row_appointments | appointments | AFTER INSERT/UPDATE/DELETE | process_audit_log() |
| audit_trigger_row_products | products | AFTER INSERT/UPDATE/DELETE | process_audit_log() |
| audit_trigger_row_services | services | AFTER INSERT/UPDATE/DELETE | process_audit_log() |
| audit_trigger_row_comandas | comandas | AFTER INSERT/UPDATE/DELETE | process_audit_log() |

---

## 5. RLS POLICIES

### 5.1 Helper Functions Used in RLS

| Function | Purpose |
|----------|---------|
| `current_tenant_id_from_auth_uid()` | SECURITY DEFINER — resolves tenant_id |
| `current_is_super_admin_from_auth_uid()` | SECURITY DEFINER — superadmin bypass |
| `get_current_tenant_id()` | Legacy — still used in some policies |

### 5.2 Tenant Isolation Policies

| Table | Policy Name | Rule |
|-------|-------------|------|
| clients | tenant_isolation_clients | tenant_id = current_tenant_id_from_auth_uid() |
| services | tenant_isolation_services | Same |
| staff | tenant_isolation_staff | Same |
| appointments | tenant_isolation_appointments | Same |
| comandas | tenant_isolation_comandas | Same |
| comanda_items | tenant_isolation_comanda_items | Same |
| products | tenant_isolation_products | Same |
| purchase_orders | tenant_isolation_purchase_orders | Same |
| suppliers | tenant_isolation_suppliers | Same |
| promotions | tenant_isolation_promotions | Same |
| notifications | notifications_select/insert/update | Same + (user_id IS NULL OR user_id = auth.uid()) |
| cash_closings | tenant_isolation_cash_closings | Same + superadmin bypass |
| barber_closings | barber_closings_tenant_isolation | Same + superadmin bypass |
| cash_closing_events | cash_closing_events_tenant_isolation | Same + superadmin bypass |
| customer_plans | customer_plans_tenant_isolation | Same + superadmin bypass |
| customer_subscriptions | customer_subscriptions_tenant_isolation | Same + superadmin bypass |
| customer_credits | customer_credits_tenant_isolation | Same + superadmin bypass |
| customer_subscription_receivables | customer_subscription_receivables_tenant_isolation | Same + superadmin bypass |
| customer_vouchers | tenant isolation (via trigger) | Same |
| schedule_blocks | tenant_isolation_schedule_blocks | Same + superadmin bypass |
| transactions | (RLS enabled) | Same |
| financial_reversals | financial_reversals_select_by_tenant_or_superadmin | Same + superadmin bypass |
| inventory_movements | inventory_movements_select_by_tenant_or_superadmin | Same + superadmin bypass |
| service_execution_participants | tenant isolation | current_setting('app.current_tenant_id') |
| tenant_goals | tenant_goals_select/insert/update/delete | Same + superadmin bypass |
| role_permissions | Managers can view/manage | Same + role check |
| role_permissions_audit | SuperAdmins can view | Superadmin only |
| user_tenants | user_tenants_select_own_or_tenant_or_superadmin | Same + user_id = auth.uid() |
| event_store | event_store_superadmin_all + tenant_select + insert | Superadmin bypass + tenant isolation |
| processed_operations | processed_operations_superadmin_all + tenant_select + insert | Same |

### 5.3 Superadmin-Only Policies

| Table | Policy |
|-------|--------|
| access_requests | superadmin full access |
| audit_logs | Superadmins can view all |
| usage_logs | super admins can read/manage |
| alerts | super admins can read/manage |
| notification_channels | super admins can read/manage |

### 5.4 Public/Anon Policies

| Table | Policy |
|-------|--------|
| access_requests | public insert |
| kiosk_addons | public select/insert/update (status = 'enabled') |
| kiosk_devices | ALL USING (true) |
| kiosk_sessions | ALL USING (true) |
| feedback_barber | ALL USING (true) |
| feedback_shop | ALL USING (true) |
| otp_requests | public insert, public update (status = 'pending') |
| portal_sessions | public select/insert/update |
| schedule_blocks | public SELECT (status = 'active') |

---

## 6. INDEXES (70+)

### 6.1 Performance Indexes (Phase 3.6)

| Table | Index | Columns | Notes |
|-------|-------|---------|-------|
| comandas | idx_comandas_tenant_created | (tenant_id, created_at DESC) | P0 |
| comandas | idx_comandas_tenant_appointment | (tenant_id, appointment_id) WHERE NOT NULL | P0 |
| comandas | idx_comandas_tenant_staff | (tenant_id, staff_id) WHERE NOT NULL | P1 |
| customer_plans | idx_customer_plans_tenant_name | (tenant_id, name) | P1 |
| customer_subscriptions | idx_customer_subscriptions_client_status | (client_id, status) | P1 |
| products | idx_products_tenant_active | (tenant_id, active) WHERE active = true | P2 |
| promotions | idx_promotions_tenant_active | (tenant_id, active) WHERE active = true | P2 |

### 6.2 Idempotency/Uniqueness Indexes

| Table | Index | Columns | Condition |
|-------|-------|---------|-----------|
| transactions | idx_transactions_tenant_idempotency_key | (tenant_id, idempotency_key) | WHERE NOT NULL |
| financial_reversals | idx_financial_reversals_tenant_idempotency | (tenant_id, idempotency_key) | WHERE NOT NULL |
| inventory_movements | idx_inventory_movements_tenant_idempotency | (tenant_id, idempotency_key) | WHERE NOT NULL |
| appointments | idx_appointments_idempotency_key | (idempotency_key) | UNIQUE, WHERE NOT NULL |
| comandas | idx_comandas_idempotency_key | (idempotency_key) | UNIQUE, WHERE NOT NULL |
| user_tenants | idx_user_tenants_one_primary_per_user | (user_id) WHERE is_primary = true | UNIQUE |
| customer_subscriptions | idx_customer_subscriptions_one_open_per_client | (tenant_id, client_id) WHERE status IN ('active', 'past_due', 'paused') | UNIQUE |

### 6.3 Financial & Operational Indexes

| Table | Index | Columns |
|-------|-------|---------|
| transactions | idx_transactions_tenant_date | (tenant_id, date DESC) |
| transactions | idx_transactions_tenant_type | (tenant_id, type) |
| transactions | idx_transactions_tenant_type_date | (tenant_id, type, date DESC) |
| transactions | idx_transactions_tenant_source | (tenant_id, source_type, source_id) |
| cash_closings | idx_cash_closings_tenant_date_status | (tenant_id, business_date, status) |
| financial_reversals | idx_financial_reversals_original | (tenant_id, original_transaction_id) |
| financial_reversals | idx_financial_reversals_source | (tenant_id, source_type, source_id) |
| financial_reversals | idx_financial_reversals_created_at | (tenant_id, created_at DESC) |
| inventory_movements | idx_inventory_movements_product_created | (tenant_id, product_id, created_at DESC) |
| inventory_movements | idx_inventory_movements_source | (tenant_id, source_type, source_id) |
| inventory_movements | idx_inventory_movements_type_created | (tenant_id, movement_type, created_at DESC) |
| comandas | idx_comandas_tenant_settled_at | (tenant_id, settled_at DESC) WHERE settled_at NOT NULL |
| comandas | idx_comandas_tenant_payment_date_real | (tenant_id, payment_date_real DESC) WHERE NOT NULL |
| comandas | idx_comandas_hidden_from_financial | (hidden_from_financial) WHERE true |
| comandas | idx_comandas_cancellation_type | (cancellation_type) WHERE NOT NULL |

### 6.4 Kiosk & Feedback Indexes

| Table | Index | Columns |
|-------|-------|---------|
| kiosk_addons | idx_kiosk_addons_tenant | (tenant_id) |
| kiosk_devices | idx_kiosk_devices_tenant | (tenant_id) |
| kiosk_sessions | idx_kiosk_sessions_tenant | (tenant_id) |
| kiosk_sessions | idx_kiosk_sessions_device | (device_id) |
| feedback_barber | idx_feedback_barber_tenant | (tenant_id) |
| feedback_barber | idx_feedback_barber_barber | (barber_id) |
| feedback_shop | idx_feedback_shop_tenant | (tenant_id) |
| appointments | idx_appointments_source | (source) |
| appointments | idx_appointments_channel | (channel) |

### 6.5 Chef Club Indexes

| Table | Index | Columns |
|-------|-------|---------|
| customer_plans | idx_customer_plans_tenant | (tenant_id) |
| customer_plans | idx_customer_plans_active | (active) |
| customer_plans | idx_customer_plans_tenant_active | (tenant_id, active) |
| customer_subscriptions | idx_customer_subscriptions_tenant | (tenant_id) |
| customer_subscriptions | idx_customer_subscriptions_client | (client_id) |
| customer_subscriptions | idx_customer_subscriptions_plan | (plan_id) |
| customer_subscriptions | idx_customer_subscriptions_status | (status) |
| customer_subscriptions | idx_customer_subscriptions_tenant_client_status | (tenant_id, client_id, status) |
| customer_credits | idx_customer_credits_tenant | (tenant_id) |
| customer_credits | idx_customer_credits_client | (client_id) |
| customer_credits | idx_customer_credits_subscription | (subscription_id) |
| customer_credits | idx_customer_credits_tenant_client_subscription | (tenant_id, client_id, subscription_id) |
| customer_subscription_receivables | idx_club_receivables_tenant_status_due | (tenant_id, status, due_date) |
| customer_subscription_receivables | idx_club_receivables_customer | (tenant_id, customer_id) |
| customer_subscription_receivables | idx_club_receivables_subscription | (subscription_id) |
| customer_subscription_receivables | idx_club_receivables_transaction_id | (transaction_id) UNIQUE WHERE NOT NULL |

### 6.6 Notification & Monitoring Indexes

| Table | Index | Columns |
|-------|-------|---------|
| notifications | idx_notifications_tenant_id | (tenant_id) |
| notifications | idx_notifications_user_id | (user_id) |
| notifications | idx_notifications_status | (status) |
| notifications | idx_notifications_type | (type) |
| notifications | idx_notifications_created_at | (created_at DESC) |
| notifications | idx_notifications_tenant_status_created | (tenant_id, status, created_at DESC) |
| notifications | idx_notifications_unread_dedupe | (tenant_id, type, entity_type, entity_id, user_id) WHERE status = 'unread' UNIQUE |
| notification_preferences | idx_notification_preferences_tenant_user | (tenant_id, user_id) |
| notification_preferences | idx_notification_preferences_type | (type) |
| usage_logs | usage_logs_resource_type_created_at_idx | (resource_type, created_at DESC) |
| alerts | alerts_resource_type_created_at_idx | (resource_type, created_at DESC) |

### 6.7 Appointment Indexes

| Table | Index | Columns | Condition |
|-------|-------|---------|-----------|
| appointments | idx_appointments_active_slot | (tenant_id, staff_id, start_time) | WHERE status NOT IN ('cancelled', 'no_show') |
| appointments | idx_appointments_external_site | (tenant_id, external_source, external_id) | UNIQUE WHERE NOT NULL |
| appointments | idx_appointments_hidden_from_schedule | (hidden_from_schedule) | WHERE true |
| appointments | idx_appointments_cancellation_type | (cancellation_type) | WHERE NOT NULL |

### 6.8 Other Indexes

| Table | Index | Columns |
|-------|-------|---------|
| service_execution_participants | idx_service_execution_participants_comanda_item | (comanda_item_id) |
| service_execution_participants | idx_service_execution_participants_professional | (professional_id) |
| service_execution_participants | idx_service_execution_participants_tenant | (tenant_id) |
| role_permissions | idx_role_permissions_tenant_role | (tenant_id, role) |
| role_permissions | idx_role_permissions_key | (tenant_id, role, permission_key) |
| role_permissions_audit | idx_role_permissions_audit_tenant | (tenant_id, changed_at DESC) |
| tenant_goals | tenant_goals_tenant_period_active_idx | (tenant_id, period) WHERE active = true UNIQUE |
| tenant_goals | tenant_goals_tenant_id_idx | (tenant_id) |
| tenant_addons | idx_tenant_addons_tenant_key | (tenant_id, addon_key) |
| otp_requests | idx_otp_phone | (phone) |
| portal_sessions | idx_portal_sessions_token | (token_hash) |
| portal_sessions | idx_portal_sessions_client | (client_id) |
| user_tenants | idx_user_tenants_user_tenant | (user_id, tenant_id) UNIQUE |
| user_tenants | idx_user_tenants_user_id | (user_id) |
| user_tenants | idx_user_tenants_tenant_id | (tenant_id) |
| user_tenants | idx_user_tenants_tenant_role | (tenant_id, role) |
| customer_vouchers | idx_customer_vouchers_tenant | (tenant_id) |
| customer_vouchers | idx_customer_vouchers_customer | (customer_id) |
| customer_vouchers | idx_customer_vouchers_status | (status) |
| customer_vouchers | idx_customer_vouchers_expires_at | (expires_at) |
| customer_vouchers | idx_customer_vouchers_tenant_customer_status | (tenant_id, customer_id, status) |
| schedule_blocks | idx_schedule_blocks_tenant_dates | (tenant_id, start_date, end_date) |
| schedule_blocks | idx_schedule_blocks_professional | (tenant_id, professional_id, status) |
| schedule_blocks | uq_schedule_blocks_unique_active | Partial unique on active blocks |
| barber_closings | idx_barber_closings_tenant_date | (tenant_id, business_date) |
| barber_closings | idx_barber_closings_cash_closing | (cash_closing_id) |
| barber_closings | idx_barber_closings_staff | (staff_id) |
| cash_closing_events | idx_cash_closing_events_tenant_date | (tenant_id, business_date) |
| cash_closing_events | idx_cash_closing_events_cash_closing | (cash_closing_id) |
| cash_closing_events | idx_cash_closing_events_barber_closing | (barber_closing_id) |
| cash_closing_events | idx_cash_closing_events_time | (tenant_id, business_date, event_time) |
| event_store | idx_event_store_aggregate | (aggregate_type, aggregate_id, occurred_at) |
| event_store | idx_event_store_correlation | (correlation_id) WHERE NOT NULL |
| event_store | idx_event_store_tenant | (tenant_id, occurred_at) |
| event_store | idx_event_store_type | (event_type, occurred_at) |
| event_store | idx_event_store_occurred_at | (occurred_at) |
| event_store | idx_event_store_source | (source) WHERE NOT NULL |
| processed_operations | idx_processed_operations_idempotency | (tenant_id, idempotency_key) UNIQUE |
| processed_operations | idx_processed_operations_event | (event_id) |
| processed_operations | idx_processed_operations_tenant | (tenant_id, processed_at) |
| processed_operations | idx_processed_operations_type | (operation_type, processed_at) |

---

## 7. VIEWS (1)

| View | Query Summary |
|------|---------------|
| `comandas_health` | SELECT status, COUNT(*), FILTER counts for open/paid/cancelled/stale, SUM(total) FROM comandas GROUP BY status |

---

## 8. EXTENSIONS

| Extension | Purpose |
|-----------|---------|
| `pgcrypto` | Used for gen_random_uuid() in some migrations |
| `uuid-ossp` | Used for uuid_generate_v4() in audit_logs |

---

## 9. SEQUENCES

No explicit sequences defined. All tables use UUID primary keys with `gen_random_uuid()` or `uuid_generate_v4()`.

---

## 10. GRANTS

| Object | Grant |
|--------|-------|
| service_execution_participants | SELECT, INSERT, UPDATE, DELETE → anon, authenticated, service_role |
| backfill_service_execution_participants() | EXECUTE → anon, authenticated, service_role |
| Multiple RPCs | EXECUTE → authenticated (REVOKE ALL FROM PUBLIC first) |
| user_tenants | SELECT → authenticated (REVOKE from anon) |
| customer_subscription_receivables | SELECT → authenticated (REVOKE from PUBLIC, anon) |
| inventory_movements | SELECT → authenticated (REVOKE from anon) |

---

## Summary Statistics

| Object Type | Count |
|-------------|-------|
| Tables | ~37 |
| Functions/RPCs | ~44 |
| Triggers | ~30+ |
| RLS Policies | ~50+ |
| Indexes | ~70+ |
| Views | 1 |
| Extensions | 2 |
