-- Adicionar role 'AdminManager' (Gerente Administrativo) ao constraint da tabela staff
-- Este role NÃO aparece na agenda — apenas 'Manager' (Gerente Operacional) atende como barbeiro

BEGIN;

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;

ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('Manager', 'AdminManager', 'Barber', 'Receptionist'));

COMMIT;
