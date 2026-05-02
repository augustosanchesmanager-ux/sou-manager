# Deploy Checklist — Fases 3 e 4
## Sou Mana.ger — Barbearia SaaS

---

## 1. Migration Overview

Este checklist cobre todas as migrations relevantes para as funcionalidades
implementadas nas fases 3 (RPC transacional, idempotência) e 4 (Dashboard real,
Motor de Retorno, metas configuráveis).

---

## 2. Todas as Migrations — Ordem de Aplicação

```
ORDEM CRONOLÓGICA (apply em sequência)

FASE BASE (já devem existir em produção)
├── 20260219183612_create_initial_schema.sql
├── 20260219230006_new_features_notifications_support_comandas.sql
├── 20260220145404_inventory_rpc_functions.sql
├── 20260220145436_setup_multi_tenant_and_products_v2.sql
├── 20260220145620_add_suppliers_and_link_orders.sql
├── 20260220145723_fix_close_order_rpc_and_schema_v3.sql
├── 20260220150238_super_admin_rpc_functions.sql
├── 20260220150538_fix_support_tickets_visibility_v4.sql
├── 20260221182101_add_tenant_isolation.sql
├── 20260221182115_add_onboarding_completed.sql
├── 20260221182432_create_promotions.sql
├── 20260222182115_fix_tenant_id_auto_insert_trigger.sql
├── 20260224040140_fix_rls_user_metadata.sql
├── 20260224040213_create_audit_logs_table_and_trigger.sql
├── 20260224040235_attach_audit_triggers.sql
├── 20260226052507_auto_insert_manager_into_staff.sql
├── 20260226052529_auto_insert_manager_into_staff_v2.sql
├── 20260226052610_fix_manager_trigger_and_backfill_staff.sql
├── 20260227222901_fix_comandas_staff_fk_set_null.sql
├── 20260227223434_fix_all_rls_policies_use_security_definer_function.sql
├── 20260304_kiosk_module.sql
├── 20260305050000_kiosk_rls_fix.sql
├── 20260305100000_unified_addons_and_portal.sql
├── 20260306_smart_schedule.sql
├── 20260308_multitenant_hotfix.sql
├── 20260311_chef_club_tables.sql
├── 20260312_schedule_blocks.sql
├── 20260316193000_add_notes_to_appointments.sql
└── 20260317123000_create_supabase_monitoring_module.sql

FASE 4.1+ — NOVOS MÓDULOS (checar se já existem)
├── 20260418100000_add_service_execution_participants.sql
├── 20260418120000_add_is_walk_in_to_appointments.sql
├── 20260418193000_chef_club_service_credit_map.sql
├── 20260420_add_service_credit_map.sql
├── 20260420_bulk_close_normal.sql
├── 20260420110000_bulk_close_comandas_admin.sql

FASE 4.2 — RPC TRANSAcional com idempotência (CRÍTICAS)
├── 20260420120001_create_appointment_with_comanda_rpc.sql
├── 20260427_update_create_appointment_with_comanda_rpc.sql
├── 20260428_add_idempotency_key_to_appointments_and_comandas.sql
└── 20260428_update_rpc_idempotency_key.sql

FASE 4.2.2 — METAS CONFIGURÁVEIS
└── 20260428_create_tenant_goals_table.sql

FASE 4.4+ — DASHBOARD REAL / MOTOR DE RETORNO
└── (sem nova migration — usado dados reais do banco existente)

EXTRA — se aplicável
├── 20260424000000_performance_indexes.sql
├── 20260425000000_add_blocked_status_to_comandas.sql
├── 20260426000000_site_sanchez_appointments.sql
└── bulk_close_comandas_with_credits.sql
```

### Ordem de Aplicação Sugerida

```bash
# 1. Apply todas as migrations via Supabase CLI
supabase db push

# Ou manualmente via SQL Editor do Supabase, em ordem cronológica.
# Para cada arquivo .sql, copiar e executar no editor.
```

### Dependências entre Migrations

| Migration | Depende de | Ação necessária antes |
|---|---|---|
| `20260428_update_rpc_idempotency_key.sql` | `20260420120001`, `20260427`, `20260428_add_idempotency_key` | Function `create_appointment_with_comanda` precisa existir |
| `20260428_create_tenant_goals_table.sql` | Funções `current_tenant_id_from_auth_uid`, `current_is_super_admin_from_auth_uid` | Confirmar que existem (criadas em migrations anteriores) |

---

## 3. Variáveis de Ambiente Necessárias

No **Supabase Dashboard** (`Settings > API`):

```env
# Supabase — obrigatórias
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # apenas no server, nunca exposta ao browser

# Vercel — obrigatórias (em Configurações do projeto Vercel)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

Verificar também:
- `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false` (padrão) — não mudar se não entender multi-schema.
- `VITE_APP_HOSTNAME_MAP` — apenas se usar domínios customizados por app.

---

## 4. Comandos de Validação Local

```bash
# 1. Instalar dependências
npm install

# 2. Verificar tipos TypeScript
npm run typecheck
# Esperado: nenhuma saída (0 errors)

# 3. Build de produção (valida que não há erros de compile)
npm run build
# Esperado: "✓ built in Xs" no final

# 4. Preview do build (opcional)
npm run preview
# Abrir http://localhost:4173 e navegar manualmente
```

---

## 5. Comandos de Build

```bash
# Development
npm run dev

# Produção — gerar dist/
npm run build

# Preview produção local
npm run preview
```

Build output: `dist/` — Deploy em Vercel via git push ou `vercel --prod`.

---

## 6. Pontos de Teste Manual Pós-Deploy

### Autenticação e Tenant
- [ ] Login com usuário real (não demo) — verificar se tenant_id carrega corretamente
- [ ] Trocar entre apps (barber/auto/club) — se multi-schema ativo

### Agenda (Schedule)
- [ ] Criar agendamento rápido — verificar se `create_appointment_with_comanda` RPC é chamado
- [ ] Abrir comanda gerada — verificar se `comanda_items` populados
- [ ] Agendamento com idempotency key — clicar 2x rapidinho, verificar se não cria duplicado

### Dashboard
- [ ] Dashboard carrega com dados reais (sem mock/fake)
- [ ] KPIs de receita com valores != 0
- [ ] Comparativo mensal visível
- [ ] Metas configuradas aparecem no Dashboard

### Motor de Retorno (/smart-return)
- [ ] Página lista clientes reais das 3 categorias (retorno/risco/inativo)
- [ ] Cliente com telefone mostra botão WhatsApp ativo
- [ ] Cliente sem telefone mostra ícone desabilitado
- [ ] Clicar em WhatsApp abre `wa.me/55NUMERO?text=...` em nova aba
- [ ] Empty state aparece se não houver clientes na categoria

### Comandas e Checkout
- [ ] Fechar comanda — verificar que status muda para `paid`
- [ ] Transação registrada na tabela `transactions`

### Multi-tenant (se ativo)
- [ ] Login com usuário de tenant A — não consegue ver dados de tenant B
- [ ] RLS enforcement — query direta no banco não retorna dados de outro tenant

---

## 7. Riscos Conhecidos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Idempotency key duplicada em concorrência | Baixa | Alta — agendamento duplo | RPC já verifica `idempotency_key` antes de inserir — monitorar logs |
| RLS policy desatualizada após nova migration | Média | Alta — vazamento de dados entre tenants | Revisar policies de todas as tabelas afetadas após cada migration |
| `create_appointment_with_comanda` com assinatura antiga (7 params) | Baixa | Alta — RPC falha em produção | Garantir que `20260428_update_rpc_idempotency_key.sql` foi aplicada por último |
| Multi-schema habilitado sem entender | Baixa | Crítica — todas as queries falham | Manter `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=false` até confirmar necessidade |
| Demo mode ativado em produção | Baixa | Alta — dados não persistem | `hasSupabaseEnv` verifica se vars existem — localStorage.debug = false em produção |
| Telefone inválido no WhatsApp (menos de 10 dígitos) | Baixa | Baixa — link não abre | Frontend já filtra — `digits.length < 10` não gera URL |

---

## 8. Plano de Rollback

### Rollback de Migration (Supabase)

```sql
-- Para reverter uma migration em produção:
-- 1. Identificar a migration que quebrou
-- 2. Executar manualmente o inverso no SQL Editor

-- Exemplo: reverter idempotency_key
ALTER TABLE public.appointments DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE public.comandas DROP COLUMN IF EXISTS idempotency_key;
DROP INDEX IF EXISTS idx_appointments_idempotency_key;
DROP INDEX IF EXISTS idx_comandas_idempotency_key;

-- Exemplo: reverter tenant_goals
DROP TABLE IF EXISTS public.tenant_goals;

-- Exemplo: reverter RPC para versão anterior
-- Refazer o CREATE OR REPLACE FUNCTION manualmente
```

### Rollback de Frontend (Vercel)

```bash
# Via dashboard Vercel
# 1. Ir em Deployments
# 2. Encontrar último deployment estável (verde)
# 3. Clicar em "Preview" → "Promote to Production"

# Via CLI
vercel rollback
```

### Checklist de Rollback Rápido

- [ ] 1. Identificarmigration que causou o problema
- [ ] 2. Reverter SQL no Supabase (manual ou CLI)
- [ ] 3. Identificar commit/branch estável do frontend
- [ ] 4. Reverter frontend via Vercel rollback
- [ ] 5. Testar login básico — Schedule — Dashboard
- [ ] 6. Confirmar que sistema voltou ao estado anterior
- [ ] 7. Investigar root cause antes de relançar

---

## 9. Próximos Passos Recomendados

1. **Antes de production deploy**: garantir que todas as migrations acima
   estejam aplicadas no banco de produção (Supabase CLI: `supabase db push`
   ou aplicar manualmente no SQL Editor).

2. **Testar idempotência**: criar dois agendamentos com a mesma
   `idempotency_key` — o segundo deve retornar o resultado do primeiro
   sem criar duplicado.

3. **Verificar RLS**: logar como usuário de tenant A e tentar consultar
   dados de tenant B via API direta. Deve retornar 0 resultados.

4. **Monitorar erros RPC**: acompanhar logs do Supabase (Dashboard →
   Logs) por 24h após deploy procurando por exceções em
   `create_appointment_with_comanda`.

5. **Backup**: antes de aplicar migrations, confirmar que existe
   backup automático do Supabase ativo (`Settings > Database >
   Backups`).

---

## Resumo

| Item | Status |
|---|---|
| Migrations identificadas | 50+ arquivos |
| Migrations críticas para fase 3/4 | 4 (`20260420_bulk_close` a `20260428_update_rpc`) |
| Variáveis de ambiente | 5 mínimas |
| Comandos de validação | `typecheck` + `build` |
| Riscos conhecidos | 6 |
| Plano de rollback | SQL revert + Vercel rollback |
