import { getSharedClient, logSupabaseError } from '../../services/supabaseClient';
import type {
  ProductGoalPeriod,
  ProductGoalTargetRole,
  ProductGoalTemplate,
  ProductGoalTier,
  StaffProductGoal,
} from './types';

interface RawTemplateRow {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  target_role: ProductGoalTargetRole;
  period_type: ProductGoalPeriod;
  base_goal_amount: number | string;
  tiers: ProductGoalTier[] | null;
  active: boolean;
}

interface RawStaffGoalRow {
  id: string;
  tenant_id: string;
  staff_id: string;
  template_id?: string | null;
  period_type: ProductGoalPeriod;
  base_goal_amount: number | string;
  custom_tiers?: ProductGoalTier[] | null;
  active: boolean;
}

function mapTemplateRow(row: RawTemplateRow): ProductGoalTemplate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description ?? null,
    targetRole: row.target_role,
    periodType: row.period_type,
    baseGoalAmount: Number(row.base_goal_amount ?? 0),
    tiers: Array.isArray(row.tiers) ? row.tiers : [],
    active: Boolean(row.active),
  };
}

function mapStaffGoalRow(row: RawStaffGoalRow): StaffProductGoal {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    staffId: row.staff_id,
    templateId: row.template_id ?? null,
    periodType: row.period_type,
    baseGoalAmount: Number(row.base_goal_amount ?? 0),
    customTiers: Array.isArray(row.custom_tiers) ? row.custom_tiers : null,
    active: Boolean(row.active),
  };
}

export async function fetchProductGoalTemplates(tenantId: string): Promise<ProductGoalTemplate[]> {
  if (!tenantId) return [];
  const supabase = getSharedClient();
  const { data, error } = await supabase
    .from('product_goal_templates')
    .select('id, tenant_id, name, description, target_role, period_type, base_goal_amount, tiers, active')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    logSupabaseError('fetchProductGoalTemplates', error);
    return [];
  }

  return (data as RawTemplateRow[] | null)?.map(mapTemplateRow) ?? [];
}

export async function upsertProductGoalTemplate(
  tenantId: string,
  input: Omit<ProductGoalTemplate, 'id' | 'tenantId'> & { id?: string }
): Promise<ProductGoalTemplate | null> {
  const supabase = getSharedClient();
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    tenant_id: tenantId,
    name: input.name.trim(),
    description: input.description ?? null,
    target_role: input.targetRole,
    period_type: input.periodType,
    base_goal_amount: Number(input.baseGoalAmount) || 0,
    tiers: input.tiers ?? [],
    active: input.active,
  };

  const { data, error } = await supabase
    .from('product_goal_templates')
    .upsert(payload, { onConflict: 'id' })
    .select('id, tenant_id, name, description, target_role, period_type, base_goal_amount, tiers, active')
    .single();

  if (error) {
    logSupabaseError('upsertProductGoalTemplate', error);
    throw error;
  }

  return mapTemplateRow(data as RawTemplateRow);
}

export async function deleteProductGoalTemplate(tenantId: string, templateId: string): Promise<void> {
  const supabase = getSharedClient();
  const { error } = await supabase
    .from('product_goal_templates')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', templateId);

  if (error) {
    logSupabaseError('deleteProductGoalTemplate', error);
    throw error;
  }
}

export async function fetchStaffProductGoals(tenantId: string): Promise<StaffProductGoal[]> {
  if (!tenantId) return [];
  const supabase = getSharedClient();
  const { data, error } = await supabase
    .from('staff_product_goals')
    .select('id, tenant_id, staff_id, template_id, period_type, base_goal_amount, custom_tiers, active')
    .eq('tenant_id', tenantId);

  if (error) {
    logSupabaseError('fetchStaffProductGoals', error);
    return [];
  }

  return (data as RawStaffGoalRow[] | null)?.map(mapStaffGoalRow) ?? [];
}

export async function upsertStaffProductGoal(
  tenantId: string,
  input: Omit<StaffProductGoal, 'id' | 'tenantId'>
): Promise<StaffProductGoal | null> {
  const supabase = getSharedClient();
  const payload = {
    tenant_id: tenantId,
    staff_id: input.staffId,
    template_id: input.templateId ?? null,
    period_type: input.periodType,
    base_goal_amount: Number(input.baseGoalAmount) || 0,
    custom_tiers: input.customTiers ?? null,
    active: input.active,
  };

  const { data, error } = await supabase
    .from('staff_product_goals')
    .upsert(payload, { onConflict: 'tenant_id,staff_id' })
    .select('id, tenant_id, staff_id, template_id, period_type, base_goal_amount, custom_tiers, active')
    .single();

  if (error) {
    logSupabaseError('upsertStaffProductGoal', error);
    throw error;
  }

  return mapStaffGoalRow(data as RawStaffGoalRow);
}

export async function deleteStaffProductGoal(tenantId: string, staffId: string): Promise<void> {
  const supabase = getSharedClient();
  const { error } = await supabase
    .from('staff_product_goals')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId);

  if (error) {
    logSupabaseError('deleteStaffProductGoal', error);
    throw error;
  }
}
