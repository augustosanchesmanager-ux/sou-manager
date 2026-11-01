# F01 — Evidência de teste da proposta de correção

**Data:** 30 de outubro de 2026
**Objeto:** `public.prepare_invite_user(text, text)` e a proposta `F01-fix-proposal.sql`
**Veredito:** **18/18 verificações passaram**

## Ambiente

- Node.js 24.20.0
- `@electric-sql/pglite` 0.5.13 (PostgreSQL 17 compilado para WASM)
- Extensão `pgcrypto` no schema `extensions`
- Roles sintéticas: `anon`, `authenticated`, `service_role`, `random_user`
- Tabelas sintéticas: `auth.users`, `public.team_invitations`
- Execução como superusuário; o caminho anônimo foi simulado com `SET ROLE anon`

## O que foi testado

1. A função **vulnerável**, extraída de
   `supabase/migrations/20261020210000_prepare_invite_user_rpc.sql`.
2. A função **corrigida**, extraída de `docs/security-audit/F01-fix-proposal.sql`.
3. O ACL da função antes e depois da proposta.
4. O fluxo de usuário novo, token inválido, revogado, expirado e já aceito.

## Resultados

| # | Verificação | Resultado |
|---|---|---|
| 1 | `random_user` herda `EXECUTE` de `PUBLIC` na função original | PASS |
| 2 | `anon` executa `prepare_invite_user` na função original | PASS |
| 3 | Após o ataque, a senha antiga da vítima deixa de funcionar | PASS |
| 4 | Após o ataque, a senha escolhida pelo atacante funciona | PASS |
| 5 | Após a proposta, `random_user` não executa mais (sem grant a `PUBLIC`) | PASS |
| 6 | Após a proposta, `anon` mantém `EXECUTE` para o primeiro acesso | PASS |
| 7 | Após a proposta, `authenticated` mantém `EXECUTE` | PASS |
| 8 | ACL final não contém entrada de `PUBLIC` | PASS |
| 9 | Conta existente retorna `user_exists=true`, `requires_login=true`, `success=false` | PASS |
| 10 | Senha antiga da vítima continua funcionando após a proposta | PASS |
| 11 | Senha do atacante **não** funciona após a proposta | PASS |
| 12 | Usuário novo retorna `user_exists=false`, `success=true` | PASS |
| 13 | `prepare_invite_user` não cria linha em `auth.users` | PASS |
| 14 | Token inexistente é rejeitado | PASS |
| 15 | Token revogado é rejeitado | PASS |
| 16 | Token expirado é rejeitado | PASS |
| 17 | Token já aceito é rejeitado | PASS |
| 18 | Nenhuma escrita em `auth.users` nos caminhos de erro | PASS |

### ACL final observado

```
{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

Sem `=X/postgres` (grant a `PUBLIC`). O `random_user` deixa de herdar `EXECUTE`.

### Evidência central

**Antes da correção:**

```
old_ok = false
attack_ok = true
```

**Depois da correção:**

```
old_ok = true
attack_ok = false
requires_login = true
```

## Limitações

- PGlite é PostgreSQL real em WASM, mas **não** é o Supabase completo: não há
  PostgREST, GoTrue, RLS, triggers de `auth`, nem o ACL real de produção.
- O teste prova a lógica da função e o efeito do `REVOKE`/`GRANT`; não prova que
  o endpoint `POST /rest/v1/rpc/prepare_invite_user` está exposto no projeto.
- A aquisição do token via `invite_team_member` foi validada por leitura de código
  (a função retorna `token` e tem `GRANT` para `authenticated`), não executada
  neste harness.
- O ACL de produção deve ser confirmado antes de aplicar a proposta; o dono da
  função precisa ser o role da migration para que o `REVOKE` funcione.

## Reprodução

O harness foi executado em um diretório temporário com:

```bash
npm install @electric-sql/pglite
node f01-test.mjs <raiz-do-repositorio>
```

O teste cria o schema mínimo, aplica a migration vulnerável, executa o ataque
como `anon`, aplica `F01-fix-proposal.sql` e repete o ataque. O script não faz
parte do repositório para não adicionar dependência de runtime ao projeto.

## Próximo passo

Para validar em Supabase real, é necessário um projeto de staging com PostgREST
e GoTrue, aplicar a proposta e rodar o teste cross-tenant descrito no rodapé de
`F01-fix-proposal.sql`. Nenhuma alteração foi feita em produção.
