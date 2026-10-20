# ADR-034: Granularidade por Item no Ledger de Comissões D7/D8

**Status:** Accepted  
**Date:** 2026-10-20  
**Deciders:** PO (Augusto) + OpenCode  
**References:** ADR-001 (Commission vs Settlement), ADR-014 (Transactional Outbox), ADR-016 (Execution Boundary & Dispatcher Server-Side), ADR-033 (Ciclos de Comissão em Comandas Reabertas), Frente C1

---

## Context

Durante a homologação em produção da Frente C1 (ADR-033), um teste de faturamento de comanda com múltiplos itens (`itemCount: 2`) executados pelo mesmo profissional (`62ddf002...`) revelou nos logs:

```text
[COMMISSION_RECORD_HANDLER] Created commission record: staff=62ddf002..., comanda=406856cc..., value=0.01
[COMMISSION_RECORD_HANDLER] Record already exists for staff 62ddf002... + comanda 406856cc... — skipping
[COMMISSION_RECORD_HANDLER] Comanda 406856cc...: 1 commission record(s) created
```

O profissional recebeu a comissão de apenas 1 dos 2 itens faturados na mesma comanda.

---

## Problem & Root Cause

No design inicial do D7/D8, a idempotência do outbox e do banco foi modelada no nível de **profissional + comanda**, em vez de **profissional + comanda + item do serviço**:
1. **Índice Único Parcial:**
   `idx_commission_records_staff_comanda ON commission_records(tenant_id, staff_id, comanda_id) WHERE record_type = 'commission' AND status = 'active';`
2. **Chave de Idempotência do Registro:**
   A chave gerada pelo handler e pelo worker era `${context.idempotencyKey}_${staffId}`, sem discriminar o `item.id`. Caso o mesmo profissional executasse dois itens na comanda, o segundo registro causava violação do índice único `idx_commission_records_idempotency`.
3. **Consulta de Idempotência:**
   Tanto `existsByStaffComanda` (client) quanto `exists_commission_record` (RPC D8) consultavam sem o filtro de `comanda_item_id`.

Embora a tabela `commission_records` já possuísse a coluna `comanda_item_id` (preenchida em 100% dos 205 registros existentes em produção), a chave de unicidade ignorava essa granularidade, impedindo o pagamento de múltiplos serviços para o mesmo profissional (combos como "Corte + Barba").

---

## Decision

Fica aprovada a transição da chave de unicidade e das consultas de idempotência para o nível de item:

1. **Substituição do Índice Único Parcial:**
   ```sql
   DROP INDEX IF EXISTS public.idx_commission_records_staff_comanda;
   DROP INDEX IF EXISTS public.idx_commission_records_staff_item;

   CREATE UNIQUE INDEX idx_commission_records_staff_item
     ON public.commission_records(tenant_id, staff_id, comanda_id, comanda_item_id)
     WHERE record_type = 'commission' AND status = 'active';
   ```

2. **Refinamento da Chave de Idempotência:**
   A chave de idempotência de cada registro gerado passa a incluir o ID do item:
   ```typescript
   idempotency_key: `${context.idempotencyKey}_${staffId}_${item.id}`
   ```
   Aplicado de forma idêntica em `createCommissionRecordHandler.ts` e em `worker-dispatcher/calculate.ts`.

3. **Atualização das Consultas de Idempotência:**
   - **Domínio (`CommissionRecordRepository.existsByStaffComanda`):** aceita o parâmetro opcional `comandaItemId?: string`, adicionando `.eq('comanda_item_id', comandaItemId)` quando fornecido.
   - **RPC Worker D8 (`public.exists_commission_record`):** atualizada para aceitar `p_comanda_item_id UUID DEFAULT NULL`, mantendo compatibilidade com chamadas legadas e filtrando `AND (p_comanda_item_id IS NULL OR comanda_item_id = p_comanda_item_id)`.

---

## Consequences

### Positivas
- Corrige a falha de remuneração em combos e múltiplos serviços por profissional na mesma comanda.
- Transição segura comprovada por auditoria: 100% dos registros históricos em produção já possuem `comanda_item_id` preenchido e zero duplicatas.
- Mantém paridade estrita e compatibilidade com o worker D8 e contratos de RPC existentes.
- Os canônicos do Financial Domain Core (`domain/commission/{calculate,participants,types}.ts`) permanecem intocados (`npm run d8:verify` verde).
