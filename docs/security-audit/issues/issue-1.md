## Descrição do Problema
O arquivo `.vercel-temp.env` foi commitado no histórico do repositório no commit `46e21ce` contendo credenciais administrativas de produção em texto plano:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `POSTGRES_PASSWORD`
- `VERCEL_OIDC_TOKEN`

Embora o commit `c1711da` tenha desindexado o arquivo do rastreamento ativo e adicionado regra ao `.gitignore`, os segredos permanecem intactos e acessíveis no histórico de qualquer clone ou fork do repositório.

## Por que é explorável
A chave `service_role` e as credenciais de banco de dados ignoram completamente as políticas de Row Level Security (RLS) do Supabase. Qualquer pessoa que clone o repositório ou acesse um fork tem capacidade de consultar, alterar ou excluir dados de todos os tenants em produção. O token OIDC da Vercel permite acionar ou modificar deploys na nuvem.

## Evidência
```bash
git show 46e21ce:.vercel-temp.env
# Exibe SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, POSTGRES_PASSWORD e VERCEL_OIDC_TOKEN
```

## Impacto
Comprometimento total da segurança, confidencialidade e integridade dos dados multi-tenant, além da cadeia de deploy de produção.

## Sugestão de Correção
1. Acessar o painel do Supabase e rotacionar imediatamente a `service_role key`, o `JWT Secret` e alterar a `database password`.
2. Acessar o painel da Vercel e revogar o `VERCEL_OIDC_TOKEN`.
3. Executar o utilitário `git-filter-repo` ou `BFG Repo-Cleaner` para purgar o arquivo `.vercel-temp.env` do histórico Git do repositório remoto.

## Critérios de Aceite
- [ ] Novas chaves `service_role` e `POSTGRES_PASSWORD` geradas no Supabase
- [ ] Token Vercel revogado e reconfigurado nas variáveis de CI/CD
- [ ] Execução de `git log -S "SUPABASE_SERVICE_ROLE_KEY"` não retorna o segredo antigo
- [ ] Auditoria de segurança de segredos (gitleaks) concluída sem alertas
