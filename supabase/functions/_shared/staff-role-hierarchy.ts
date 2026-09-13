/**
 * F2.1 (SEC-AUTHZ-CREATE-USER) — Hierarquia de papéis de equipe.
 *
 * Fonte canônica da regra de hierarquia. Importada pela edge function
 * `admin-create-user` (via `../_shared/staff-role-hierarchy.ts`) e pelos
 * testes de segurança (`tests/security/f2_1_role_hierarchy.test.ts`).
 *
 * Auditoria ISSUE 2 (docs/security-audit/assets/relatorio.html):
 * "Escalação de privilégio: manager pode criar usuário admin".
 * Correção aprovada: "Aplicar hierarquia: somente superadmin cria/promove
 * para `admin`; manager cria barber/receptionist."
 *
 * Regra: rank(papel solicitado) < rank(papel do chamador) — o chamador só
 * pode atribuir papéis estritamente abaixo do seu próprio nível.
 *
 *   superadmin (4)  -> admin | manager | barber | receptionist
 *   admin (3)       -> manager | barber | receptionist
 *   manager/owner (2) -> barber | receptionist
 *   barber/receptionist (1) -> nenhum
 *
 * SEM imports externos (puro) para funcionar em Deno (edge function) e vitest.
 */

export const STAFF_ROLE_RANK: Record<string, number> = {
  superadmin: 4,
  'super admin': 4,
  admin: 3,
  adminmanager: 3,
  admin_manager: 3,
  'gerente administrativo': 3,
  manager: 2,
  gerente: 2,
  'gerente operacional': 2,
  owner: 2,
  barber: 1,
  barbeiro: 1,
  receptionist: 1,
  recepcionista: 1,
};

const normalizeRole = (role: string): string => String(role || '').trim().toLowerCase();

export const staffRoleRank = (role: string): number => STAFF_ROLE_RANK[normalizeRole(role)] ?? 0;

/**
 * Determina se `callerRole` pode atribuir `requestedRole` a outro usuário.
 * Papéis desconhecidos recebem rank 0 e nunca podem ser atribuídos nem atribuir.
 */
export const canAssignStaffRole = (callerRole: string, requestedRole: string): boolean => {
  const callerRank = staffRoleRank(callerRole);
  const requestedRank = staffRoleRank(requestedRole);
  if (callerRank <= 0 || requestedRank <= 0) return false;
  return requestedRank < callerRank;
};