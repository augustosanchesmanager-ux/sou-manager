## Descrição
Resolve #225: alinha as permissões de tabela no PostgreSQL ao princípio do menor privilégio, revogando grants residuais que excediam as políticas de RLS ativas:
- Revoga `ALL` de `anon` na tabela `service_execution_participants` (eliminando permissões de mutação e leitura do papel anônimo).
- Revoga `INSERT`, `UPDATE` e `DELETE` na tabela `feature_flags` de `authenticated` e `PUBLIC`, mantendo apenas `SELECT` (as mutações de feature flags são exclusivas de `superadmin`).
- Adiciona suíte de testes unitários de integridade estática em `tests/security/f1_1_residual_grants.test.ts`.

## Validação
- `npx vitest run tests/security/f1_1_residual_grants.test.ts` -> 3/3 aprovados
- `npm run typecheck` -> exit 0
- `npm run test` -> 119 suítes passaram (2025 testes unitários)

```yaml
authorization_record:
  ticket: "#225"
  authorized_by: "Augusto (PO)"
  date: "2026-11-03"
  target_env: "ci"
  merge_approved: false
  deploy_approved: false
```
