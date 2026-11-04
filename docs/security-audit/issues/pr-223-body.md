## Descrição
Resolve #223: alinha as políticas de Row Level Security (RLS) nas tabelas mestres/catálogo com os gates de UI (`ManagerRoute`):
- Restringe operações de escrita (`INSERT`, `UPDATE`, `DELETE`) em `services`, `products`, `suppliers` e `payment_terminals` para usuários com cargo gerencial (`owner`, `admin`, `manager`, `gerente`) ou `superadmin`, utilizando o helper seguro `current_is_manager_from_auth_uid(tenant_id)`.
- Preserva a permissão de leitura (`SELECT`) para todos os funcionários autenticados do tenant para operacionalização da agenda, comandas e PDV.
- Adiciona suíte de testes de invariantes em `tests/security/f2_1_master_tables_rls.test.ts`.

## Validação
- `npx vitest run tests/security/f2_1_master_tables_rls.test.ts` -> 5/5 aprovados
- `npm run typecheck` -> exit 0
- `npm run test` -> 120 suítes passaram (2038 testes unitários)
- `npm run build` -> compilado com sucesso em 10.53s

```yaml
authorization_record:
  ticket: "#223"
  authorized_by: "Augusto (PO)"
  date: "2026-11-03"
  target_env: "ci"
  merge_approved: false
  deploy_approved: false
```
