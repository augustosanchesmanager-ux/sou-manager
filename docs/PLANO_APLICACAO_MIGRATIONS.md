# Plano de Aplicação de Migrations — SMG Barber

## Objetivo

Consolidar e aplicar migrations do financeiro e vouchers em uma janela controlada, depois de validar o histórico local e remoto. Este plano não autoriza aplicação automática de banco.

## Regra atual

- Não rodar `supabase db push` durante desenvolvimento de UX/frontend.
- Não rodar `supabase migration repair` sem inventário completo.
- Não aplicar SQL remoto sem aprovação explícita.
- Não misturar migrations financeiras com commits de UI.
- Não alterar dados reais sem backup e checklist de validação.

## Fase Banco 0 — Inventário

1. Rodar `git status --short`.
2. Listar migrations locais.
3. Listar migrations remotas com `npx supabase migration list --linked`.
4. Confirmar quais objetos já existem no banco:
   - `finance_settle_comanda`;
   - `finance_reverse_transaction`;
   - `financial_reversals`;
   - `customer_vouchers`;
   - colunas financeiras em `comandas` e `transactions`.
5. Registrar qualquer migration aplicada manualmente fora do histórico.

## Fase Banco 1 — Reconciliação

1. Separar migrations já aplicadas manualmente.
2. Separar migrations novas e ainda pendentes.
3. Confirmar ordem de execução.
4. Confirmar que cada arquivo tem até 120 linhas quando essa regra for exigida.
5. Evitar renomear migrations já aplicadas em ambiente remoto.

## Fase Banco 2 — Dry-run

Rodar somente:

```bash
npx supabase db push --linked --dry-run
```

O dry-run deve mostrar apenas migrations esperadas. Se aparecer qualquer migration inesperada, parar e revisar antes de aplicar.

## Fase Banco 3 — Aplicação controlada

Aplicar somente após aprovação explícita do Augusto:

```bash
npx supabase db push --linked
```

Após aplicar, validar no SQL Editor:

```sql
select to_regclass('public.customer_vouchers') as customer_vouchers_exists;
select to_regclass('public.financial_reversals') as financial_reversals_exists;
select proname from pg_proc where proname in ('finance_settle_comanda', 'finance_reverse_transaction');
```

## Fase Banco 4 — Smoke test

1. Criar voucher de teste para cliente controlado.
2. Cancelar voucher com motivo.
3. Marcar voucher como usado e confirmar que nenhum valor financeiro mudou.
4. Baixar comanda via Checkout.
5. Validar transaction com `source_type = 'comanda'`.
6. Estornar transaction controlada.
7. Confirmar que transaction original permanece.
8. Confirmar que `financial_reversals` registra vínculo.

## Rollback lógico

- Não apagar histórico financeiro.
- Para vouchers, preferir status `cancelled` em vez de delete.
- Para baixa financeira, usar reversão auditada em vez de editar transaction original.
- Para falha de aplicação de migration, parar antes de qualquer `repair` e documentar o estado.

## Pendências que precisam de aprovação

- Aplicar migrations de vouchers.
- Confirmar se migrations de `finance_settle_comanda` já foram aplicadas manualmente e como serão refletidas no histórico remoto.
- Validar ordem final entre baixa, reversão e vouchers.
- Definir se `customer_vouchers` deve ter RPC própria antes de uso em produção.

## Comandos proibidos até aprovação

```bash
supabase db push
npx supabase db push
supabase migration repair
npx supabase migration repair
```

