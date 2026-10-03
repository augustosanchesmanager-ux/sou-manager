# SMG-PAYOUT-SCHEDULES — Ciclos de Repasse e Gestão de Vales

## Contexto
O fechamento de caixa diário apura a competência contábil do expediente (produção bruta, retenção de fiado e base liquidada). No entanto, o pagamento financeiro efetivo aos profissionais segue ciclos customizados (diário, semanal, quinzenal, mensal) e convive com retiradas de adiantamentos (vales).

## Requisitos do Módulo
1. **Configuração de Repasse no Perfil do Profissional (`profiles`):**
   - Frequência de acerto: diário, semanal (ex.: terças-feiras), quinzenal ou mensal.
   - Habilitação para solicitação de vales/adiantamentos.
2. **Controle de Vales (`barber_advances`):**
   - Lançamento de saídas de caixa categorizadas como adiantamento vinculado ao colaborador.
   - Abatimento automático na conta-corrente interna do profissional.
3. **Extrato Periódico de Liquidação:**
   - Tela consolidada de liquidação por período (ex.: terça a domingo).
   - Equação: `(+) Comissões de Serviços Liquidados + (+) Comissões de Produtos + (+) Fiados Quitados no Período - (-) Vales Retirados = Ordem de Pagamento / Pix`.