/**
 * F2.1 (SEC-AUTHZ-CREATE-USER) — Teste de hierarquia de papéis.
 *
 * Auditoria ISSUE 2: "Escalação de privilégio: manager pode criar usuário admin".
 * Correção aprovada: "Aplicar hierarquia: somente superadmin cria/promove para
 * `admin`; manager cria barber/receptionist."
 *
 * Critérios de aceite:
 *   1. Chamada manager→admin retorna 403 (canAssignStaffRole = false)
 *   2. Superadmin→admin continua funcionando (canAssignStaffRole = true)
 *   3. Teste de hierarquia no backend aprovado (este arquivo)
 *
 * A função testada é a MESMA importada pela edge function `admin-create-user`
 * (fonte única em supabase/functions/_shared/staff-role-hierarchy.ts).
 */

import { describe, it, expect } from 'vitest';
import { canAssignStaffRole, staffRoleRank } from '../../supabase/functions/_shared/staff-role-hierarchy';

describe('F2.1 Security — staff role hierarchy', () => {
  describe('staffRoleRank', () => {
    it('should_return_4_for_superadmin', () => {
      expect(staffRoleRank('superadmin')).toBe(4);
    });

    it('should_return_3_for_admin_variants', () => {
      expect(staffRoleRank('admin')).toBe(3);
      expect(staffRoleRank('adminmanager')).toBe(3);
      expect(staffRoleRank('admin_manager')).toBe(3);
      expect(staffRoleRank('gerente administrativo')).toBe(3);
    });

    it('should_return_2_for_manager_variants_and_owner', () => {
      expect(staffRoleRank('manager')).toBe(2);
      expect(staffRoleRank('gerente')).toBe(2);
      expect(staffRoleRank('gerente operacional')).toBe(2);
      expect(staffRoleRank('owner')).toBe(2);
    });

    it('should_return_1_for_barber_and_receptionist', () => {
      expect(staffRoleRank('barber')).toBe(1);
      expect(staffRoleRank('barbeiro')).toBe(1);
      expect(staffRoleRank('receptionist')).toBe(1);
      expect(staffRoleRank('recepcionista')).toBe(1);
    });

    it('should_return_0_for_unknown_or_empty_role', () => {
      expect(staffRoleRank('unknown')).toBe(0);
      expect(staffRoleRank('')).toBe(0);
    });
  });

  describe('canAssignStaffRole — aceite 1: manager nunca atribui admin', () => {
    it('should_be_false_when_manager_assigns_admin', () => {
      // Arrange & Act & Assert
      expect(canAssignStaffRole('manager', 'admin')).toBe(false);
    });

    it('should_be_false_when_owner_assigns_admin', () => {
      expect(canAssignStaffRole('owner', 'admin')).toBe(false);
    });

    it('should_be_false_when_admin_staff_assigns_admin', () => {
      // Only superadmin promotes to admin.
      expect(canAssignStaffRole('admin', 'admin')).toBe(false);
    });

    it('should_be_false_when_barber_assigns_admin', () => {
      expect(canAssignStaffRole('barber', 'admin')).toBe(false);
    });

    it('should_be_false_when_receptionist_assigns_admin', () => {
      expect(canAssignStaffRole('receptionist', 'admin')).toBe(false);
    });
  });

  describe('canAssignStaffRole — aceite 2: superadmin mantém atribuição de admin', () => {
    it('should_be_true_when_superadmin_assigns_admin', () => {
      expect(canAssignStaffRole('superadmin', 'admin')).toBe(true);
    });

    it('should_be_true_when_superadmin_assigns_any_lower_role', () => {
      expect(canAssignStaffRole('superadmin', 'manager')).toBe(true);
      expect(canAssignStaffRole('superadmin', 'barber')).toBe(true);
      expect(canAssignStaffRole('superadmin', 'receptionist')).toBe(true);
    });

    it('should_be_false_when_superadmin_assigns_superadmin', () => {
      // No papel solicitado fora do contrato R6; hierarquicamente 4 < 4 é falso.
      expect(canAssignStaffRole('superadmin', 'superadmin')).toBe(false);
    });
  });

  describe('canAssignStaffRole — manager cria apenas barber/receptionist', () => {
    it('should_be_true_when_manager_assigns_barber', () => {
      expect(canAssignStaffRole('manager', 'barber')).toBe(true);
    });

    it('should_be_true_when_manager_assigns_receptionist', () => {
      expect(canAssignStaffRole('manager', 'receptionist')).toBe(true);
    });

    it('should_be_false_when_manager_assigns_manager', () => {
      expect(canAssignStaffRole('manager', 'manager')).toBe(false);
    });

    it('should_be_false_when_owner_assigns_manager', () => {
      expect(canAssignStaffRole('owner', 'manager')).toBe(false);
    });
  });

  describe('canAssignStaffRole — admin staff atribui abaixo de si', () => {
    it('should_be_true_when_admin_staff_assigns_manager', () => {
      expect(canAssignStaffRole('admin', 'manager')).toBe(true);
    });

    it('should_be_true_when_admin_staff_assigns_barber', () => {
      expect(canAssignStaffRole('gerente administrativo', 'barber')).toBe(true);
    });

    it('should_be_false_when_gerente_operacional_assigns_admin', () => {
      expect(canAssignStaffRole('gerente operacional', 'admin')).toBe(false);
    });
  });

  describe('canAssignStaffRole — papéis de execução não atribuem nada', () => {
    it('should_be_false_when_barber_assigns_barber', () => {
      expect(canAssignStaffRole('barber', 'barber')).toBe(false);
    });

    it('should_be_false_when_receptionist_assigns_receptionist', () => {
      expect(canAssignStaffRole('receptionist', 'receptionist')).toBe(false);
    });
  });

  describe('canAssignStaffRole — robustez', () => {
    it('should_be_case_insensitive', () => {
      expect(canAssignStaffRole('Manager', 'Admin')).toBe(false);
      expect(canAssignStaffRole('SuperAdmin', 'admin')).toBe(true);
    });

    it('should_be_false_when_caller_role_is_unknown_or_empty', () => {
      expect(canAssignStaffRole('', 'barber')).toBe(false);
      expect(canAssignStaffRole('unknown', 'barber')).toBe(false);
    });

    it('should_be_false_when_requested_role_is_unknown', () => {
      expect(canAssignStaffRole('superadmin', 'owner_of_the_world')).toBe(false);
    });
  });
});