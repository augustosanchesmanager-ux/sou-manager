-- 20261103214000_add_notes_and_preferences_to_clients.sql
-- SMG Barber: Frente 7.1 — Perfil 360° do Cliente & Fidelização
-- Adiciona notas técnicas e preferências de agendamento/cadeira cativa na tabela clients

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS preferred_frequency TEXT CHECK (preferred_frequency IS NULL OR preferred_frequency IN ('weekly', 'biweekly', 'monthly')),
    ADD COLUMN IF NOT EXISTS preferred_weekday INTEGER CHECK (preferred_weekday IS NULL OR (preferred_weekday BETWEEN 1 AND 7)),
    ADD COLUMN IF NOT EXISTS preferred_time TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS preferred_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.notes IS 'Notas técnicas e observações operacionais do cliente (ex.: preferências de corte, sensibilidades)';
COMMENT ON COLUMN public.clients.preferred_frequency IS 'Periodicidade preferida de retorno (weekly = semanal, biweekly = quinzenal, monthly = mensal)';
COMMENT ON COLUMN public.clients.preferred_weekday IS 'Dia da semana preferido no padrão ISO (1 = Segunda ... 7 = Domingo)';
COMMENT ON COLUMN public.clients.preferred_time IS 'Horário preferido para atendimento no formato HH:MM (ex: 18:00)';
COMMENT ON COLUMN public.clients.preferred_staff_id IS 'Barbeiro/profissional de preferência para os atendimentos fixos';
