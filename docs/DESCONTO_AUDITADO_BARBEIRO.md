# Desconto Auditado por Barbeiro

## Diagnóstico atual

- O Checkout calcula `subtotal`, `discount` e `total`.
- `comandas.discount` guarda somente o valor do desconto.
- A baixa financeira recebe o valor líquido em `paid_amount`.
- A tela de comissões usa a base do item/participação e apenas expõe o desconto na auditoria.
- Não existe campo atual para responsável, tipo, motivo ou autorização do desconto.

## Regra segura da primeira camada

- Desconto continua afetando o caixa, pois o valor pago já vai líquido para a baixa.
- Desconto ainda não recalcula comissão automaticamente.
- Quando houver desconto no Checkout, a tela exige:
  - origem do desconto;
  - barbeiro responsável, quando a origem for desconto do barbeiro;
  - motivo;
  - observação.
- A informação é enviada nas observações da baixa financeira via RPC existente.

## Regra recomendada para fase futura

- Desconto do barbeiro pode reduzir a base de comissão, se Augusto aprovar.
- Desconto da barbearia, gestor ou promoção deve ser tratado como decisão comercial.
- O impacto na comissão deve ser configurável por tenant.

## Migration futura sugerida

Campos ou tabela de eventos de desconto:

- tenant_id
- comanda_id
- discount_amount
- discount_type
- discount_reason_type
- discount_reason_note
- discount_given_by_staff_id
- discount_authorized_by_user_id
- discount_applied_at
- discount_affects_commission
- discount_metadata

## Relatorios futuros

- descontos por barbeiro;
- descontos por tipo;
- descontos por motivo;
- total semanal/mensal de desconto;
- percentual de desconto sobre produção bruta;
- impacto estimado em comissão.
