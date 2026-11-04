## Descrição do Problema
Em tabelas como `services`, `products` e `categories` (criadas em `20260212000000_initial_schema.sql`), as políticas de RLS de escrita (`INSERT`, `UPDATE`, `DELETE`) validam apenas a cláusula:
```sql
USING (tenant_id = current_tenant_id_from_auth_uid())
WITH CHECK (tenant_id = current_tenant_id_from_auth_uid())
```

## Por que é explorável
O frontend esconde as telas de gestão de catálogo para usuários de cargos operacionais (`barber` e `receptionist`) via componentes de rota (`ManagerRoute`). No entanto, a API REST do Supabase não possui esse gate no banco de dados. Um barbeiro autenticado pode emitir requisições HTTP REST com seu token JWT para alterar o preço de serviços ou excluir itens do catálogo.

## Evidência
- Políticas de RLS em `services` e `products` checam apenas `tenant_id = current_tenant_id_from_auth_uid()`.
- Ausência da verificação `current_is_tenant_manager_from_auth_uid(tenant_id)` nas operações de escrita.

## Impacto
Violação de controle de acesso baseado em papel (RBAC), permitindo sabotagem operacional ou alteração indevida de valores financeiros de serviços.

## Sugestão de Correção
Adicionar migration atualizando as políticas de `INSERT`, `UPDATE` e `DELETE` das tabelas mestres:
```sql
CREATE POLICY "services_manager_write" ON public.services
  FOR ALL TO authenticated
  USING (
    tenant_id = current_tenant_id_from_auth_uid()
    AND current_is_tenant_manager_from_auth_uid(tenant_id)
  );
```

## Critérios de Aceite
- [ ] Barbeiro recebe erro 403 / RLS policy violation ao tentar mutação via REST em `services`
- [ ] Gerente / admin consegue alterar preços e cadastrar itens normalmente
- [ ] Teste automatizado de mutação REST validando negação para papel `barber`
