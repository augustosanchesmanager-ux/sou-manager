-- Migration: Add is_walk_in field to appointments for walk-in/fit appointments
-- Created: 2026-04-18
-- Purpose: Allow marking appointments as walk-ins (without scheduled time)

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT false;

-- Create index for filtering walk-ins
CREATE INDEX IF NOT EXISTS idx_appointments_is_walk_in ON public.appointments(is_walk_in);