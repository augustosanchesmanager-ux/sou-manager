/**
 * [SMG][DOMAIN][USER_TENANT] types
 *
 * Representa o vínculo de um usuário com um tenant (tabela user_tenants).
 * Escritas normalmente via RPC SECURITY DEFINER; leituras via este repository.
 */

export interface UserTenant {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddUserTenantInput {
  userId: string;
  tenantId: string;
  role: string;
  isPrimary?: boolean;
}
