# Testes Manuais - Notificações Internas

## Pré-requisitos

- Aplicar a migration `20260507023024_internal_notifications_center.sql`.
- Entrar com um usuário autenticado vinculado a um tenant.
- Confirmar que a tela de Configurações carrega a seção "Notificações".

## Preferências

1. Acesse `#/settings`.
2. Desative um tipo de notificação, por exemplo "Estoque baixo".
3. Salve as preferências.
4. Gere o evento correspondente.
5. Confirme que nenhuma nova notificação desse tipo aparece para o usuário atual.
6. Reative o tipo, salve novamente e repita o evento.
7. Confirme que a notificação volta a aparecer.

## Fluxos Operacionais

1. Comanda aberta:
   - Crie ou abra uma comanda com status `open`.
   - Confirme notificação "Nova comanda aberta".

2. Estoque baixo:
   - Edite um produto para `stock_quantity <= minimum_stock`.
   - Confirme notificação "Estoque baixo".
   - Suba o estoque acima do mínimo.
   - Confirme que a notificação não lida do produto é arquivada.

3. Pagamento a realizar:
   - Crie uma `transactions` com `type = expense`, `status = pending` e `date` hoje.
   - Execute a rotina pelo carregamento do app ou RPC `generate_system_notifications`.
   - Confirme severidade `warning`.
   - Ajuste a data para antes de hoje e confirme severidade `critical`.

4. Clube dos Chefes:
   - Crie uma assinatura `customer_subscriptions` ativa com `next_billing_date` próximo.
   - Confirme notificação "Cobrança do Clube dos Chefes".
   - Altere para `past_due` e confirme severidade `critical`.

5. Próximo cliente:
   - Crie um `appointments` `confirmed` dentro dos próximos 60 minutos.
   - Execute a rotina.
   - Confirme notificação "Próximo cliente".

6. Cliente atrasado:
   - Crie um `appointments` `confirmed` com `start_time` no passado e sem status final.
   - Execute a rotina.
   - Confirme notificação "Cliente atrasado".

## Central De Notificações

1. Abra o sino no header.
2. Confirme badge com quantidade de não lidas.
3. Marque uma notificação como lida.
4. Confirme que ela some do filtro "Não lidas" e o badge diminui.
5. Use "Marcar todas como lidas".
6. Confirme badge zerado.
7. Arquive uma notificação no filtro "Todas".
8. Confirme que ela não aparece mais na listagem padrão.

## Multi-Tenant

1. Gere notificações em dois tenants diferentes.
2. Entre com usuário do tenant A.
3. Confirme que só vê notificações do tenant A.
4. Entre com usuário do tenant B.
5. Confirme que só vê notificações do tenant B.

