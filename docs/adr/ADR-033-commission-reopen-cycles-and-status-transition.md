# ADR-033: Ciclos de Comissão em Comandas Reabertas e Transição de Status no Ledger D7/D8

**Status:** Accepted  
**Date:** 2026-10-20  
**Deciders:** PO (Augusto) + OpenCode  
**References:** ADR-001 (Commission vs Settlement), ADR-014 (Transactional Outbox), ADR-016 (Execution Boundary & Dispatcher Server-Side), ADR-026 (Merge ≠ Deploy Prod), PR #146 (Reabertura e Estorno de Comanda Paga)

---

## Context

Com a entrega do Item 4 (PR #146, commit `d868e87`), o SMG Barber passou a permitir que gestores (`isManagerLikeRole`) estornem liquidações incorretas (`wrong_settlement`) e reabram a comanda correspondente para correção operacional e refaturamento posterior.

Durante o teste real em produção pós-deploy, identificou-se o seguinte comportamento contábil nos logs:
1. Ao estornar a comanda paga, a liquidação financeira original foi estornada e a comissão original foi devidamente revertida via `create_commission_reversal` (Net = R$ 0,00).
2. Ao editar a comanda reaberta e realizar um segundo checkout com novos itens e valores, o processador de outbox (`createCommissionRecordHandler`) emitiu:
   ```text
   [COMMISSION_RECORD_HANDLER] Record already exists for staff X + comanda Y — skipping
   [COMMISSION_RECORD_HANDLER] Comanda Y: 0 commission record(s) created
   ```
3. O segundo checkout gerou receita no caixa, mas **nenhuma comissão foi gerada para o profissional**.
4. Em uma segunda reversão subsequente, a RPC tentou reverter o registro original do primeiro ciclo (já revertido), ignorando a operação.

---

## Problem & Root Cause

No design inicial do D7/D8 (agosto/2026), antes da introdução da reabertura operacional de comandas, adotou-se a premissa de que uma comanda seria liquidada uma única vez em seu ciclo de vida.

Para garantir idempotência contra reprocessamento duplicado de eventos de outbox, três mecanismos foram travados:
1. **Índice Único Parcial no Banco:**
   `CREATE UNIQUE INDEX idx_commission_records_staff_comanda ON commission_records(tenant_id, staff_id, comanda_id) WHERE record_type = 'commission';`
2. **Consulta de Idempotência no Domínio:**
   `existsByStaffComanda(staffId, comandaId, tenantId)` com filtro `WHERE record_type = 'commission'`.
3. **RPC de Verificação do Worker D8:**
   `exists_commission_record(staffId, comandaId, tenantId)` com filtro `WHERE record_type = 'commission'`.

Quando uma comissão é revertida pela RPC `create_commission_reversal`, é inserido um novo registro com `record_type = 'reversal'`, mas o registro original permanecia inalterado com `record_type = 'commission'` e `status = 'active'`. Consequentemente, as três travas consideravam a comissão anterior como "vigente", impedindo a emissão de nova comissão no refaturamento da comanda.

---

## Decision

Fica aprovada a **Opção A** de transição de status no ciclo contábil de estorno e reabertura:

1. **Transição de Status no Estorno Integral:**
   Na RPC `public.create_commission_reversal`, ao inserir o registro de reversão (`record_type = 'reversal'`), se o montante acumulado estornado for igual ou superior à comissão original (`ABS(v_new_total) >= ABS(v_original.commission_value)`), o registro original tem seu status atualizado para:
   ```sql
   UPDATE public.commission_records
   SET status = 'reversed'
   WHERE id = p_original_record_id;
   ```
   O registro de reversão continua existindo com `record_type = 'reversal'` e `status = 'active'`, garantindo que o extrato contábil e o livro-razão preservem 100% da rastreabilidade histórica (`+X` e `-X` somando zero).

2. **Refinamento do Índice Único Parcial:**
   O índice único parcial passa a cobrir apenas comissões ativas:
   ```sql
   DROP INDEX IF EXISTS public.idx_commission_records_staff_comanda;
   CREATE UNIQUE INDEX idx_commission_records_staff_comanda
     ON public.commission_records(tenant_id, staff_id, comanda_id)
     WHERE record_type = 'commission' AND status = 'active';
   ```

3. **Refinamento das Consultas de Idempotência:**
   - No repositório de domínio (`CommissionRecordRepository.existsByStaffComanda`): adicionado o filtro `.eq('status', 'active')`.
   - Na RPC do worker D8 (`public.exists_commission_record`): adicionado o predicado `AND status = 'active'`.

4. **Backfill Idempotente em Produção:**
   A migration executa a atualização de `status = 'reversed'` em todos os registros `record_type = 'commission'` que já possuem reversões integrais registradas no histórico.

---

## Consequences

### Positivas
- Permite que comandas reabertas e refaturadas gerem suas respectivas comissões corretas para os profissionais envolvidos.
- Preserva a integridade do livro-razão (as linhas de reversão permanecem ativas com seus valores negativos, mantendo o balanço contábil).
- Mantém intactos os arquivos canônicos de cálculo do D8 (`domain/commission/{calculate,participants,types}.ts`, `shared/numbers/normalize.ts`), garantindo conformidade com o comando `npm run d8:verify`.
- O handler de reversão (`reverseCommissionHandler`) já filtrava `status === 'active'`, passando a operar naturalmente sobre o ciclo vigente.

### Restrições & Delimitações
- **Escopo Estrito:** Esta mudança trata exclusivamente o ciclo de vida e status de comissões em comandas reabertas (`C1-a`).
- **Frente C2 Separada:** O achado latente sobre granularidade de comissão por múltiplos serviços do mesmo profissional na comanda (`C1-b`) será tratado em frente dedicada (C2), sem misturar escopos nem diluir o controle de mudanças.
- **Correção Retroativa:** A reconciliação das comissões não emitidas durante testes anteriores será executada via rotina operacional controlada após o deploy da migration, com validação do PO.
