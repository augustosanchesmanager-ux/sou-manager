## Descrição do Problema
Identificadas concessões de permissões SQL a nível de tabela que excedem as políticas de RLS ativas:
1. `service_execution_participants`: GRANT SELECT, UPDATE, DELETE para o papel `anon` (`20260418100000:109`).
2. `feature_flags`: GRANT INSERT, UPDATE, DELETE para o papel `authenticated` (`20260807000000:80`), onde apenas `superadmin` tem política de RLS.

## Por que é explorável
A Row Level Security (RLS) protege as tabelas no estado atual porque o PostgreSQL bloqueia requisições sem policy correspondente. Contudo, manter grants excessivos quebra o princípio da defesa em profundidade: caso uma policy permissiva seja adicionada no futuro, o papel `anon` terá imediatamente permissão de tabela concedida.

## Evidência
- `supabase/migrations/20260418100000_add_service_execution_participants.sql:109`
- `supabase/migrations/20260807000000_phase_6_0_5_3_feature_flags.sql:80`

## Impacto
Débito técnico de segurança e falhas em ferramentas de auditoria estática de banco de dados.

## Sugestão de Correção
Criar migration de limpeza de privilégios:
```sql
REVOKE SELECT, UPDATE, DELETE ON public.service_execution_participants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.feature_flags FROM authenticated;
```

## Critérios de Aceite
- [ ] Inspeção de `information_schema.role_table_grants` sem privilégios excessivos
- [ ] Testes de regressão funcionais aprovados sem impactos em fluxos legítimos
