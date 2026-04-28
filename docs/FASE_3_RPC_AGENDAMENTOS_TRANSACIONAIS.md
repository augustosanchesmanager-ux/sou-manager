# Fase 3 — RPC Agendamentos Transacionais

## Resumo Executivo

A Fase 3 implementa a criação atômica de agendamentos e comandas via RPC `create_appointment_with_comanda`, eliminando race conditions e duplicidades causadas por cliques duplos no frontend.

**Escopo implementado:**
- RPC PostgreSQL que cria `appointment` + `comanda` + `comanda_item` em uma única transação
- Idempotência no banco de dados com coluna `idempotency_key`
- Proteção contra duplo clique no frontend com `useRef` (lock flag)
- Suporte ao modo demo local com emulação de idempotência
- Integração no Dashboard (agendamento rápido) e Agenda (criação manual)

**Resultado:** Agendamentos internos agora são criados com integridade transacional garantida. Um duplo clique não gera duplicatas; retry após falha de rede retorna o registro existente em vez de criar um novo.

---

## Problema Resolvido

### Situação Anterior

Antes da Fase 3, o frontend seguia este fluxo para criar um agendamento:

```typescript
// Passo 1: criar appointment
await supabase.from('appointments').insert({...});

// Passo 2: criar comanda
await supabase.from('comandas').insert({...});

// Passo 3: criar comanda_item
await supabase.from('comanda_items').insert({...});
```

**Três riscos críticas existiam:**

1. **Appointment órfão**: Se a etapa 2 falhasse, o appointment ficava sem comanda. O cliente ficava "agendado" mas sem comanda para consumir o serviço.

2. **Comanda sem item**: Se a etapa 3 falhasse, a comanda ficava vazia (total = 0, sem produtos). Não era possível fechar a venda.

3. **Duplicidade por clique duplo**: Um duplo clique no botão "Confirmar" enviava 2+ requests simultâneas. Sem proteção no banco, ambas criavam registros duplicados. O banco não tinha constraint para impedir isso.

### Solução Implementada

A RPC `create_appointment_with_comanda` executa as três operações em uma **única transação PostgreSQL**. Se qualquer passo falhar, o rollback é automático e imediato. A idempotência por `idempotency_key` impede duplicatas mesmo em caso de retry.

---

## Migrations Criadas

| Migration | Descrição |
|-----------|-----------|
| `20260420120001_create_appointment_with_comanda_rpc.sql` | Versão inicial da RPC |
| `20260427_update_create_appointment_with_comanda_rpc.sql` | Adiciona `p_client_phone`, `p_price`, `p_notes` |
| `20260428_add_idempotency_key_to_appointments_and_comandas.sql` | Adiciona coluna `idempotency_key TEXT UNIQUE` + índices em `appointments` e `comandas` |
| `20260428_update_rpc_idempotency_key.sql` | **Versão atual** — adiciona parâmetro `p_idempotency_key` e lógica de deduplicação |

---

## RPC `create_appointment_with_comanda`

### Assinatura

```sql
CREATE OR REPLACE FUNCTION public.create_appointment_with_comanda(
  p_tenant_id       UUID,
  p_client_id       UUID   DEFAULT NULL,
  p_client_name     TEXT   DEFAULT NULL,
  p_client_phone    TEXT   DEFAULT NULL,
  p_service_id      UUID   DEFAULT NULL,
  p_staff_id        UUID   DEFAULT NULL,
  p_start_time      TIMESTAMPTZ DEFAULT NULL,
  p_price           NUMERIC DEFAULT NULL,
  p_notes           TEXT   DEFAULT NULL,
  p_idempotency_key TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```

### Parâmetros

| Parâmetro | Obrigatório | Descrição |
|-----------|-------------|-----------|
| `p_tenant_id` | Sim | UUID do tenant |
| `p_client_id` | Não | UUID do cliente cadastrado |
| `p_client_name` | Condicional | Nome do cliente (obrigatório se `client_id` não fornecido) |
| `p_client_phone` | Não | Telefone do cliente |
| `p_service_id` | Sim | UUID do serviço |
| `p_staff_id` | Sim | UUID do profissional |
| `p_start_time` | Sim | Data/hora de início (TIMESTAMPTZ) |
| `p_price` | Não | Preço override (se fornecido e >= 0) |
| `p_notes` | Não | Observações |
| `p_idempotency_key` | Não | Chave UUID gerada no frontend |

### Retorno

```json
{
  "appointment_id":    "uuid",
  "comanda_id":         "uuid",
  "comanda_item_id":    "uuid",
  "service_price":      0.00,
  "appointment_status": "confirmed"
}
```

Se uma entrada duplicada for detectada pela idempotency key, retorna os dados do registro já existente em vez de criar um novo.

### Tabelas Afetadas

| Tabela | Operação | Detalhes |
|--------|----------|----------|
| `public.appointments` | INSERT | Status `confirmed`, `idempotency_key` opcional |
| `public.comandas` | INSERT | Status `open`, `total` = preço do serviço, `idempotency_key` opcional |
| `public.comanda_items` | INSERT | 1 item com o serviço como `product_name`, quantidade 1 |

### Validações

A RPC executa as seguintes validações nesta ordem:

1. **Autenticação**: `auth.uid()` deve existir
2. **Tenant**: Usuário deve pertencer ao tenant (ou ser superadmin)
3. **Campos obrigatórios**: `service_id`, `staff_id`, `start_time` não podem ser nulos
4. **Serviço**: Deve existir, estar ativo, e pertencer ao tenant
5. **Profissional**: Deve existir, ter status `active`, e pertencer ao tenant
6. **Cliente**: Se `client_id` fornecido, deve pertencer ao tenant
7. **Nome do cliente**: Obrigatório (do parâmetro ou do registro do cliente)
8. **Idempotência**: Se `p_idempotency_key` fornecido, verifica se já existe registro — retorna o existente se найден

### Comportamento Transacional

Todas as operações ocorrem em uma **única transação**:

```sql
BEGIN;
  -- 1. Verifica idempotência (se key fornecida)
  -- 2. Valida serviço
  -- 3. Valida profissional
  -- 4. Valida cliente (se houver)
  -- 5. INSERT INTO appointments (...)
  -- 6. INSERT INTO comandas (...)
  -- 7. INSERT INTO comanda_items (...)
  -- 8. RETURN jsonb
COMMIT;
```

Se qualquer validação ou insert falhar, o rollback é automático. Não há scenario de appointment sem comanda, ou comanda sem item.

---

## Idempotência

### Mecanismo no Banco

A coluna `idempotency_key TEXT UNIQUE` foi adicionada às tabelas `appointments` e `comandas`:

```sql
ALTER TABLE public.appointments ADD COLUMN idempotency_key TEXT UNIQUE;
ALTER TABLE public.comandas ADD COLUMN idempotency_key TEXT UNIQUE;

CREATE INDEX idx_appointments_idempotency_key ON public.appointments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_comandas_idempotency_key ON public.comandas(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

### Lógica na RPC

```sql
IF p_idempotency_key IS NOT NULL THEN
  SELECT jsonb_build_object(...) INTO v_existing_appointment
  FROM public.appointments a
  LEFT JOIN public.comandas c ON c.appointment_id = a.id
  LEFT JOIN public.comanda_items ci ON ci.comanda_id = c.id
  WHERE a.idempotency_key = p_idempotency_key
    AND a.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_existing_appointment IS NOT NULL THEN
    RETURN v_existing_appointment;  -- Retorna existente, não cria
  END IF;
END IF;
```

A verificação é scoped por `tenant_id` — uma idempotency key não pode ser reutilizada entre tenants.

### Proteção no Frontend (useRef)

O frontend utiliza dois mecanismos:

1. **Lock flag**: `useRef` impede chamadas simultâneas
   ```typescript
   const quickAppointmentLockRef = useRef(false);
   if (quickAppointmentLockRef.current) {
     throw new Error('Agendamento já está sendo criado.');
   }
   quickAppointmentLockRef.current = true;
   ```

2. **Idempotency key persistida**: A key é gerada uma vez por intento e reutilizada em retry
   ```typescript
   if (!quickAppointmentIdempotencyKeyRef.current) {
     quickAppointmentIdempotencyKeyRef.current = generateIdempotencyKey('quick-appt');
   }
   ```

### Comportamento em Duplo Clique

| Cenário | Comportamento |
|---------|---------------|
| Dois cliques rápidos sequenciais | Lock flag bloqueia a segunda chamada |
| Retry após falha de rede | Idempotency key faz o banco retornar o registro existente |
| Deux clicks com delay entre eles | Primeira chamada cria; segunda retorna existente |

---

## Fluxos Migrados

### Dashboard / Agendamento Rápido

**Arquivo:** `src/modules/dashboard/hooks/useDashboardActions.ts`

**Função:** `createQuickAppointment`

```typescript
const idempotencyKey = quickAppointmentIdempotencyKeyRef.current;
await supabase.rpc('create_appointment_with_comanda', {
  p_tenant_id: resolvedTenantId,
  p_client_id: payload.clientId || null,
  p_client_name: clientName,
  p_client_phone: client?.phone || null,
  p_service_id: payload.serviceId,
  p_staff_id: payload.staffId,
  p_start_time: startTime.toISOString(),
  p_price: servicePrice,
  p_notes: null,
  p_idempotency_key: idempotencyKey,
});
```

**Fluxo completo:**
1. Validação de lock (`quickAppointmentLockRef.current === true` → rejeita)
2. Geração de idempotency key (uma vez por intento)
3. Validação client-side de serviço, profissional e cliente
4. Chamada RPC atômica
5. Retorno normalizado com `normalizeQuickAppointmentResult`
6. Limpeza de lock e key em `finally`

### Agenda / Novo Agendamento Manual

**Arquivo:** `pages/Schedule.tsx` (~linha 1331)

**Função:** `handleSaveAppointment` (branch de novo agendamento)

```typescript
const idempotencyKey = scheduleIdempotencyKeyRef.current;
await supabase.rpc('create_appointment_with_comanda', {
  p_tenant_id: tenantId,
  p_client_id: clientId,
  p_client_name: formData.client,
  p_client_phone: formData.clientPhone || null,
  p_service_id: selectedService?.id || null,
  p_staff_id: formData.staffId || null,
  p_start_time: startTimeLine.toISOString(),
  p_price: finalPrice,
  p_notes: formData.notes.trim() || null,
  p_idempotency_key: idempotencyKey,
});
```

**Fluxo completo:**
1. Form filled → clique em "Confirmar"
2. `scheduleCreateLockRef` bloqueia chamadas simultâneas
3. Idempotency key mantida durante ciclo do formulário
4. RPC cria appointment + comanda + item
5. UI atualizada com novo agendamento
6. Lock e key limpos após sucesso ou erro

---

## Fluxos Não Migrados

### Edição de Agendamento

A edição (`update`) continua usando `supabase.from('appointments').update({...})` diretamente.

**O que não acontece:**
- Não há validação de idempotência na edição
- Não há criação automática de comanda na edição
- Editar um appointment existente não gera comanda

### Cancelamento

O cancelamento (`updateAppointmentStatus` em `useDashboardActions`) também usa update direto — não passa pela RPC.

### Checkout

**Arquivo:** `pages/Checkout.tsx`

O Checkout **não** utiliza `create_appointment_with_comanda`. Possui fluxo próprio:

- Insert direto em `appointments` e `comandas` (não atômico entre si)
- Idempotência própria via localStorage
- Trata erro `23505` (unique violation) para deduplicar
- Gerencia `service_execution_participants` (comissões entre profissionais) — **fora do escopo da RPC**

### Portal do Cliente

**Arquivo:** `pages/portal/PortalSchedule.tsx`

```typescript
await supabase.from('appointments').insert({
  tenant_id: tenant.id,
  client_id: client.id,
  staff_id: selectedBarber?.id || null,
  service_id: selectedService.id,
  start_time: start.toISOString(),
  end_time: end.toISOString(),
  status: 'pending',
  source: 'client_portal',
  channel: 'home_portal',
  notes: `Agendado via Portal do Cliente`
});
```

**Características:**
- Insert direto, sem RPC
- Sem idempotency key
- `status: 'pending'` (não `confirmed`)
- Sem comanda automática

### Kiosk

**Arquivo:** `pages/kiosk/components/KioskSchedule.tsx` (~linha 141)

Mesmo padrão do Portal:
- Insert direto em `appointments`
- Sem idempotency key
- `status: 'pending'`
- Sem comanda automática

---

## Decisões Arquiteturais

### 1. Portal e Kiosk Não Criam Comanda Automática

Portal e Kiosk foram intencionalmente mantidos fora do fluxo transacional nesta fase.

**Justificativa:** O fluxo do Portal/Kiosk termina em `status: pending` — o profissional precisa confirmar o agendamento presencialmente antes de abrir a comanda. Criar comanda automaticamente no ato do agendamento causaria comandas órfãs para horários que o cliente não comparece.

**Impacto aceite:** Appointments criados via Portal/Kiosk não têm comanda associada até que o profissional crie manualmente.

### 2. Tabelas Permanecem em `public.*`

A RPC e as tabelas (`appointments`, `comandas`, `comanda_items`) vivem em `public`, não em `barber`.

**Justificativa:** A RPC utiliza `SECURITY DEFINER` com `SET search_path = public`, garantindo acesso correto. Manter em `public` simplifica a operação sem perda de funcionalidade para o cenário atual.

**Atenção futura:** Quando `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true`, as queries de leitura do frontend precisam continuar lendo de `public` (via `getClientForTable`), não do schema `barber`. Este ponto precisa de revisão quando o multi-schema for ativado.

### 3. `service_execution_participants` Fora do Escopo

A tabela de mapeamento de comissão entre profissionais (**não**) foi incluída na RPC.

**Justificativa:** O agendamento rápido padrão envolve um profissional apenas (atendimento simples). A distribuição de comissão entre múltiplos profissionais é um caso complexo coberto pelo Checkout via interface própria.

**Impacto:** Se um serviço requerer múltiplos profissionais com participação diferenciada na comissão, isso não é automatizado no fluxo de agendamento rápido.

### 4. Lock Flag no Frontend Como Primeira Linha de Defesa

O lock com `useRef` é a primeira barreira contra duplicidade — impede que a segunda chamada sequer chegue ao banco.

**Justificativa:** Mesmo com idempotência no banco, evitar chamadas desnecessárias reduz carga e latência. O lock flag é simples, previsível e não depende de round-trip ao banco.

---

## Checklist de Teste

### Build e Typecheck

```bash
npm run build
```

O build deve completar sem erros.

### Criação de Agendamento Rápido (Dashboard)

1. Abrir Dashboard
2. Selecionar cliente, serviço, profissional, horário
3. Clicar em "Confirmar" ou "Criar Agendamento"
4. **Verificar:** Toast de sucesso aparece
5. **Verificar no banco:** 1 appointment com `status = confirmed`, 1 comanda `open`, 1 comanda_item

### Criação de Agendamento Manual (Agenda)

1. Abrir Agenda (`/schedule`)
2. Clicar em novo agendamento
3. Preencher cliente, serviço, profissional, horário
4. Clicar em "Confirmar"
5. **Verificar:** Agendamento aparece na grade
6. **Verificar no banco:** Mesma tríade appointment + comanda + item

### Teste de Duplo Clique

1. Preencher formulário de agendamento
2. Clicar "Confirmar" 2+ vezes em sequência (< 500ms entre cliques)
3. **Verificar:** Apenas 1 registro criado
4. **Verificar no banco:** `SELECT * FROM appointments WHERE idempotency_key = '...'` — exatamente 1 linha

### Teste de Retry

1. Iniciar criação de agendamento
2. Simular falha de rede (desconectar temporariamente ou usar Network throttle no DevTools)
3. Retry automática deve ocorrer
4. **Verificar:** Não há duplicata — apenas 1 registro existe

### Abrir Comanda

1. Localizar agendamento criado na agenda
2. Clicar para abrir comanda vinculada
3. **Verificar:** Comanda abre com item do serviço, preço correto, profissional atribuído

### Abrir Checkout

1. Com comanda aberta, clicar em "Fechar" ou "Checkout"
2. **Verificar:** Tela de fechamento carrega com dados corretos (serviço, profissional, preço)
3. **Verificar:** Comanda atualiza para `closed` após finalização

### Segurança / RLS

1. Login como usuário comum → criar agendamento para tenant diferente → deve falhar
2. Login como superadmin → criar agendamento para qualquer tenant → deve funcionar
3. Logout → tentar criar agendamento → deve falhar com `Usuario nao autenticado`

### Modo Demo (localhost)

1. Acessar aplicação sem `VITE_SUPABASE_URL` configurado
2. Criar agendamento rápido
3. **Verificar:** Não há duplicata no localStorage emulado

---

## Próximos Passos Recomendados

### 1. Remover Logs Temporários

Diversos `console.log` de debug foram deixados no código durante desenvolvimento:

```typescript
// Em useDashboardActions.ts (linha ~200)
console.log('[idempotency]', idempotencyKey);
console.log('[createQuickAppointment] rpcResult:', rpcResult, 'rpcError:', rpcError);
```

**Recomendação:** Remover todos os logs de debug antes de delivery para produção.

### 2. Remover Mocks do Dashboard/BI

O código atual possui trechos mockados ou comentados que precisam de revisão:

- Verificar se há dados de exemplohardcoded no Dashboard
- Confirmar que gráficos/indicadores puxam dados reais do banco

### 3. Avaliar Check-in para Portal/Kiosk

Portal e Kiosk atualmente criam `appointments` sem comanda, com `status: pending`.

**Recomendação:** Avaliar se faz sentido adicionar um step de "check-in" no Portal/Kiosk — quando o cliente chega e confirma presença, o sistema poderia criar a comanda automaticamente.

Alternativa: Manter o fluxo atual (comanda criada pelo profissional) e documentar a limitação para operadores.

### 4. Revisar Multi-Schema

Quando `VITE_SUPABASE_MULTI_SCHEMA_ENABLED=true`:

- A RPC opera em `public` (correto)
- As queries de leitura do frontend usam `getClientForTable` que pode direcionar para `barber`
- **Risco:** Appointments criados via RPC não aparecem na agenda se o frontend ler de `barber`

**Recomendação:** Auditar todas as queries de `appointments`, `comandas`, `comanda_items` para garantir que usem `public` quando a RPC for o origem dos dados.

### 5. Incluir `service_execution_participants` no Fluxo (Futuro)

Quando o agendamento precisar suportar múltiplos profissionais com commission split, a RPC precisar ser estendida para incluir insertion em `service_execution_participants`.

---

## Referências

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/20260428_update_rpc_idempotency_key.sql` | RPC atual |
| `supabase/migrations/20260428_add_idempotency_key_to_appointments_and_comandas.sql` | Colunas de idempotência |
| `src/modules/dashboard/hooks/useDashboardActions.ts` | Hook de agendamento rápido |
| `pages/Schedule.tsx` | Criação manual na agenda |
| `src/utils/idempotency.ts` | Utilitário de geração de keys |
| `src/lib/supabase/client.ts` | Emulação de idempotência no modo demo |