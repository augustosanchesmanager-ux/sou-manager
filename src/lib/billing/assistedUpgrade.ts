/**
 * [SMG][BILLING] Assisted Upgrade Flow Helper (ADR-055 / DEC-01)
 *
 * Centralizes commercial assisted-upgrade URLs and canonical plan labels
 * derived from `tenants.plan` (Stack A), eliminating client-side mutations
 * on `user.user_metadata.plan`.
 */

export const ASSISTED_UPGRADE_WHATSAPP_NUMBER = '5511978496799';

const PLAN_LABELS: Record<string, string> = {
  free: 'Starter (Free)',
  pro: 'Pro',
  premium: 'Premium',
};

export function normalizeTenantPlanSlug(plan?: string | null): 'free' | 'pro' | 'premium' {
  const normalized = String(plan || 'free')
    .trim()
    .toLowerCase()
    .replace(/_annual$/, '');
  if (normalized === 'pro') return 'pro';
  if (normalized === 'premium' || normalized === 'elite') return 'premium';
  return 'free';
}

export function formatTenantPlanLabel(plan?: string | null): string {
  const slug = normalizeTenantPlanSlug(plan);
  return PLAN_LABELS[slug] || 'Starter (Free)';
}

export interface AssistedUpgradeRequest {
  tenantName?: string | null;
  currentPlan?: string | null;
  targetPlan?: string | null;
  billingCycle?: 'monthly' | 'annual';
  contextReason?: string | null;
}

export function buildAssistedUpgradeWhatsAppUrl(params: AssistedUpgradeRequest = {}): string {
  const currentLabel = formatTenantPlanLabel(params.currentPlan);
  const targetLabel = params.targetPlan ? formatTenantPlanLabel(params.targetPlan) : null;
  const cycleLabel = params.billingCycle === 'annual' ? 'anual' : 'mensal';

  const parts: string[] = ['Olá! Gostaria de atendimento para upgrade do plano no SMG Barber.'];
  if (params.tenantName?.trim()) {
    parts.push(`Unidade: ${params.tenantName.trim()}.`);
  }
  parts.push(`Plano atual: ${currentLabel}.`);
  if (targetLabel) {
    parts.push(`Plano de interesse: ${targetLabel} (${cycleLabel}).`);
  }
  if (params.contextReason?.trim()) {
    parts.push(`Motivo: ${params.contextReason.trim()}.`);
  }

  return `https://wa.me/${ASSISTED_UPGRADE_WHATSAPP_NUMBER}?text=${encodeURIComponent(parts.join(' '))}`;
}

export function openAssistedUpgradeChannel(params: AssistedUpgradeRequest = {}): string {
  const url = buildAssistedUpgradeWhatsAppUrl(params);
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return url;
}
