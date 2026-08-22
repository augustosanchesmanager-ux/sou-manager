# TD-001 B3.4-B — Testes de Aceitacao (8 Cenarios)

> **Status:** CRITERIOS DE ACEITACAO — NAO IMPLEMENTAR
> **Gate:** B3.4-B — Cenarios validados pelo PO

---

## Cenario 1: Reversao integral — sucesso

```
Setup:
  INSERT commission (staff=S1, comanda=C1, record_type='commission', commission_value=50)

Execute:
  INSERT reversal (staff=S1, comanda=C1, record_type='reversal', commission_value=-50, original_record_id=<original.id>, idempotency_key='E1_S1_rev')

Assert:
  SELECT SUM(commission_value) FROM commission_records WHERE staff_id=S1 AND comanda_id=C1;
  -> 50 + (-50) = 0 (liquido zero)
  total registros: 2
```

## Cenario 2: Replay da mesma reversao — idempotente

```
Setup:
  INSERT original + INSERT reversal (idempotency_key='E1_S1_rev')

Execute:
  INSERT (idempotency_key='E1_S1_rev') — mesmo INSERT novamente

Assert:
  UNIQUE VIOLATION em idempotency_key -> handler trata como skip
  total de registros: 2 (1 original + 1 reversal), nao 3
```

## Cenario 3: Segundo evento diferente tentando reverter integralmente — rejeitado

```
Setup:
  INSERT original (50) + INSERT reversal integral (-50)

Execute:
  INSERT (staff=S1, comanda=C1, record_type='reversal', commission_value=-50, idempotency_key='E2_S1_rev')

Assert:
  Handler valida: abs(total_reversals) = 50 >= original_commission = 50
  -> skip, reason: 'already_fully_reversed'
  total de registros: 2, nao 3
```

## Cenario 4: Reversao parcial — valor proporcional

```
Setup:
  INSERT original (commission_value=50)
  Dados da reversao: reversedAmount=30, originalReceivedValue=100, originalCommission=50
  proportion = 30/100 = 0.30
  reversalAmount = 50 * 0.30 = 15

Execute:
  INSERT (record_type='reversal', commission_value=-15, original_record_id=<original.id>)

Assert:
  liquido = 50 - 15 = 35
  total registros: 2
```

## Cenario 5: Duas reversoes parciais validas — total nao ultrapassa

```
Setup:
  INSERT original (50)
  INSERT reversal-1 (-15, parcial)
  INSERT reversal-2 (-20, parcial)

Assert:
  SELECT SUM(commission_value) FROM commission_records WHERE record_type='reversal' AND original_record_id=<id>;
  -> -35
  liquido = 50 - 35 = 15
  handler validation: abs(35) < 50 -> permitido
  total registros: 3
```

## Cenario 6: Reversao apos comissao ja integralmente revertida — skip

```
Setup:
  INSERT original (50)
  INSERT reversal integral (-50)

Execute:
  INSERT reversal parcial (-10, idempotency_key='E3_S1_rev')

Assert:
  Handler valida: abs(total_reversals) = 50 >= original_commission = 50
  -> skip, reason: 'already_fully_reversed'
  total registros: 2, nao 3
```

## Cenario 7: Shared execution com 2 profissionais — cada um com propria reversao

```
Setup:
  INSERT commission (staff=Heron, comanda=C1, commission_value=35, participant_share=0.7)
  INSERT commission (staff=Rubens, comanda=C1, commission_value=15, participant_share=0.3)

Execute:
  INSERT reversal (staff=Heron, comanda=C1, commission_value=-35, original_record_id=<heron.id>)
  INSERT reversal (staff=Rubens, comanda=C1, commission_value=-15, original_record_id=<rubens.id>)

Assert:
  SELECT staff_id, SUM(commission_value) FROM commission_records WHERE comanda=C1 GROUP BY staff_id;
  -> Heron: 0, Rubens: 0
  total registros: 4 (2 originais + 2 reversals)
```

## Cenario 8: Replay do CheckoutCompleted — nenhuma comissao adicional

```
Setup:
  CheckoutCompleted eventId=E1, comandaId=C1, staffId=Heron
  -> FinanceSubscriber processa: 1 commission_record criado

Execute:
  Mesmo evento eventId=E1 processado novamente

Assert:
  UNIQUE VIOLATION em idempotency_key -> skip
  total de commission_records para C1: 1 (mesmo registro original)
  NENHUM registro adicional criado
```

---

## Resumo dos Cenarios

| # | Cenario | Resultado Esperado | Protecao Testada |
|---|---------|-------------------|-----------------|
| 1 | Reversao integral | Sucesso, liquido = 0 | Schema + handler |
| 2 | Replay mesma reversao | Skip idempotente | idempotency_key UNIQUE |
| 3 | 2o evento reversao integral | Skip (ja revertido) | Handler validation |
| 4 | Reversao parcial | Valor proporcional | calculateCommissionReversal |
| 5 | 2 reversoes parciais | Total nao ultrapassa | Handler validation |
| 6 | Reversao apos integral | Skip (ja revertido) | Handler validation |
| 7 | Shared execution reversal | 2 profissionais, 2 reversals | staff_id + comanda_id |
| 8 | Replay CheckoutCompleted | 1 comissao, nao 2 | idempotency_key UNIQUE |

---

## Nota sobre concorrencia nos testes

Os cenarios 1-8 testam comportamento funcional. Para testar concorrencia real (2 inserts simultaneos), precisaríamos:

```sql
-- Teste de concorrencia (executar em 2 sessoes simultaneamente)
-- Sessao A:
BEGIN; INSERT INTO commission_records (...) VALUES (...); COMMIT;

-- Sessao B (simultanea):
BEGIN; INSERT INTO commission_records (...) VALUES (...); COMMIT;
-- Esperado: Sessao B recebe 23505 UNIQUE VIOLATION
```

Isso e testavel via unit test com `Promise.all` + mocks, nao requer Supabase remoto.
