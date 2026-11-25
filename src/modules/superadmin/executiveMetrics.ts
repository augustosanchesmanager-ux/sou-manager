export interface BillingPlanSnapshot {
  slug: string;
  name: string;
  price_cents: number;
  status?: string | null;
}

export interface BillingSubscriptionSnapshot {
  id: string;
  tenant_id: string;
  plan: string;
  status: string;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  canceled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BillingInvoiceSnapshot {
  id: string;
  subscription_id?: string | null;
  tenant_id?: string | null;
  status: string;
  amount: number;
  due_date?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
}

export interface PlanRevenueBreakdown {
  slug: string;
  name: string;
  activeCount: number;
  mrr: number;
}

export interface ExecutiveBillingMetrics {
  mrr: number;
  arr: number;
  activePaidCount: number;
  activeFreeCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledLast30d: number;
  churnRatePct: number;
  paidInvoicesTotal: number;
  paidInvoicesCount: number;
  planBreakdown: PlanRevenueBreakdown[];
}

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

const normalizeSlug = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const normalizeStatus = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

export function calculateExecutiveBillingMetrics(
  plans: BillingPlanSnapshot[],
  subscriptions: BillingSubscriptionSnapshot[],
  invoices: BillingInvoiceSnapshot[] = [],
  now: Date = new Date()
): ExecutiveBillingMetrics {
  const planBySlug = new Map<string, BillingPlanSnapshot>();
  for (const plan of plans) {
    planBySlug.set(normalizeSlug(plan.slug), plan);
  }

  const cutoffMs = now.getTime() - DAYS_30_MS;
  let mrrCents = 0;
  let activePaidCount = 0;
  let activeFreeCount = 0;
  let trialingCount = 0;
  let pastDueCount = 0;
  let canceledLast30d = 0;

  const breakdownMap = new Map<string, PlanRevenueBreakdown>();

  for (const sub of subscriptions) {
    const status = normalizeStatus(sub.status);
    const slug = normalizeSlug(sub.plan);
    const plan = planBySlug.get(slug);
    const priceCents = Math.max(0, Number(plan?.price_cents ?? 0));

    if (status === 'active') {
      if (priceCents > 0) {
        activePaidCount += 1;
        mrrCents += priceCents;
      } else {
        activeFreeCount += 1;
      }

      const key = slug || 'unknown';
      const existing = breakdownMap.get(key) ?? {
        slug: key,
        name: plan?.name || (slug ? slug.toUpperCase() : 'Sem plano'),
        activeCount: 0,
        mrr: 0,
      };
      existing.activeCount += 1;
      existing.mrr = Number(((existing.mrr * 100 + priceCents) / 100).toFixed(2));
      breakdownMap.set(key, existing);
    } else if (status === 'trial' || status === 'trialing') {
      trialingCount += 1;
    } else if (status === 'past_due') {
      pastDueCount += 1;
    } else if (status === 'canceled' || status === 'cancelled') {
      const refDate = sub.canceled_at || sub.updated_at;
      if (refDate) {
        const ts = new Date(refDate).getTime();
        if (Number.isFinite(ts) && ts >= cutoffMs && ts <= now.getTime()) {
          canceledLast30d += 1;
        }
      }
    }
  }

  const mrr = Number((mrrCents / 100).toFixed(2));
  const arr = Number((mrr * 12).toFixed(2));

  const churnDenominator = activePaidCount + canceledLast30d;
  const churnRatePct =
    churnDenominator > 0
      ? Number(((canceledLast30d / churnDenominator) * 100).toFixed(1))
      : 0;

  let paidInvoicesTotal = 0;
  let paidInvoicesCount = 0;
  for (const invoice of invoices) {
    if (normalizeStatus(invoice.status) === 'paid') {
      paidInvoicesCount += 1;
      paidInvoicesTotal += Number(invoice.amount || 0);
    }
  }
  paidInvoicesTotal = Number(paidInvoicesTotal.toFixed(2));

  const planBreakdown = Array.from(breakdownMap.values()).sort((a, b) => b.mrr - a.mrr);

  return {
    mrr,
    arr,
    activePaidCount,
    activeFreeCount,
    trialingCount,
    pastDueCount,
    canceledLast30d,
    churnRatePct,
    paidInvoicesTotal,
    paidInvoicesCount,
    planBreakdown,
  };
}
