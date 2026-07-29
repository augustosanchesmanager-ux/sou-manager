-- Migration: Add plan column to tenants table
-- Supports the Admin panel plan management feature (free/pro/elite tiers)
-- Resolves 4.7.3 tenants.plan issue identified in Schema Consistency Audit

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro', 'elite'));

-- Index for plan-based filtering in SuperAdmin panel
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON public.tenants(plan);
