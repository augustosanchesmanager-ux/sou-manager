
-- Drop the existing foreign key constraint that uses NO ACTION
ALTER TABLE public.comandas DROP CONSTRAINT comandas_staff_id_fkey;

-- Re-create it with ON DELETE SET NULL so deleting staff sets the reference to null
ALTER TABLE public.comandas 
  ADD CONSTRAINT comandas_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;
;
