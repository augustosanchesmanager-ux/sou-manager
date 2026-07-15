import { useState, useEffect, useCallback } from 'react';
import { supabase, getScopedClient } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { logSupabaseError } from '../lib/supabase/errors';
import type {
  SubscriptionStatus,
  MembershipFilters,
  MembershipOverviewData,
  MembershipMetrics,
  Subscription,
  SubscriptionClient,
  CollectionQueueItem,
  PlanDistribution,
} from '../types/membership';
import { getTotalAvailableCredits, getTotalUsedCredits, normalizeCreditBalances } from '../utils/chefClubCredits';

const getCollectionPriority = (dueDate: string, status: SubscriptionStatus): 'high' | 'medium' | 'low' => {
  const today = new Date();
  const due = new Date(dueDate);
  const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOverdue > 30) return 'high';
  if (daysOverdue > 15) return 'medium';
  if (daysOverdue > 0) return 'low';

  const daysUntilDue = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilDue <= 3) return 'low';

  return 'low';
};

export const useMembershipOverview = (filters: MembershipFilters) => {
  const { tenantId } = useAuth();
  const barberSupabase = getScopedClient('barber');

  const [data, setData] = useState<MembershipOverviewData>({
    loading: true,
    error: null,
    metrics: {
      mrr: 0,
      arr: 0,
      activeSubscribers: 0,
      totalSubscribers: 0,
      churnRate: 0,
      churnCount: 0,
      totalOverdue: 0,
      overduePercent: 0,
      pendingAmount: 0,
      expiringNext30Days: 0,
      newSubscribersThisMonth: 0,
    },
    subscriptions: [],
    collectionQueue: [],
    plans: [],
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      const [subsRes, plansRes, creditsRes] = await Promise.all([
        barberSupabase
          .from('customer_subscriptions')
          .select('id, client_id, plan_id, status, next_billing_date, cycle_end, created_at, canceled_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        barberSupabase
          .from('customer_plans')
          .select('id, name, monthly_price, service_credits, service_credit_map, active')
          .eq('tenant_id', tenantId)
          .eq('active', true),
        barberSupabase
          .from('customer_credits')
          .select('subscription_id, available_credits, used_credits, service_balance_map')
          .eq('tenant_id', tenantId),
      ]);

      if (subsRes.error || plansRes.error || creditsRes.error) {
        throw new Error('Erro ao carregar dados do Clube');
      }

      const rawSubscriptions = subsRes.data || [];
      const plans = plansRes.data || [];
      const credits = creditsRes.data || [];

      const planMap = new Map(plans.map(p => [p.id, p]));
      const creditsMap = new Map(credits.map(c => [c.subscription_id, c]));

      const clientIds = Array.from(new Set(rawSubscriptions.map(s => s.client_id).filter(Boolean)));
      const clientPhoneMap = new Map<string, SubscriptionClient>();

      if (clientIds.length > 0) {
        const clientsRes = await supabase
          .from('clients')
          .select('id, name, phone')
          .eq('tenant_id', tenantId)
          .in('id', clientIds);

        if (clientsRes.data) {
          clientsRes.data.forEach(c => clientPhoneMap.set(c.id, { id: c.id, name: c.name, phone: c.phone }));
        }
      }

      let mrr = 0;
      let totalOverdue = 0;
      let pendingAmount = 0;
      let expiringNext30Days = 0;
      let newSubscribersThisMonth = 0;
      let activeCount = 0;
      let pastDueCount = 0;
      let canceledCount = 0;
      let totalSubscribers = rawSubscriptions.length;

      const collectionQueue: CollectionQueueItem[] = [];

      const subscriptions: Subscription[] = rawSubscriptions.map(sub => {
        const plan = planMap.get(sub.plan_id);
        const creditRecord = creditsMap.get(sub.id);
        const client = clientPhoneMap.get(sub.client_id) || { id: sub.client_id, name: 'Cliente não encontrado', phone: '' };
        const status = sub.status as SubscriptionStatus;

        if (status === 'active') {
          activeCount++;
          if (plan) {
            mrr += Number(plan.monthly_price) || 0;
            const dueDate = sub.next_billing_date;
            const daysUntilDue = Math.floor((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilDue <= 0) {
              pastDueCount++;
              totalOverdue += Number(plan.monthly_price) || 0;
              const daysOverdue = Math.abs(daysUntilDue);
              collectionQueue.push({
                id: sub.id,
                clientId: sub.client_id,
                clientName: client.name,
                clientPhone: client.phone,
                planName: plan.name,
                amount: Number(plan.monthly_price) || 0,
                dueDate: dueDate,
                daysOverdue,
                priority: getCollectionPriority(dueDate, status),
              });
            } else if (daysUntilDue <= 7) {
              pendingAmount += Number(plan.monthly_price) || 0;
            }
            if (daysUntilDue > 0 && daysUntilDue <= 30) {
              expiringNext30Days++;
            }
          }
        } else if (status === 'past_due') {
          pastDueCount++;
          if (plan) {
            totalOverdue += Number(plan.monthly_price) || 0;
            const daysOverdue = Math.floor((new Date().getTime() - new Date(sub.next_billing_date).getTime()) / (1000 * 60 * 60 * 24));
            collectionQueue.push({
              id: sub.id,
              clientId: sub.client_id,
              clientName: client.name,
              clientPhone: client.phone,
              planName: plan.name,
              amount: Number(plan.monthly_price) || 0,
              dueDate: sub.next_billing_date,
              daysOverdue,
              priority: getCollectionPriority(sub.next_billing_date, status),
            });
          }
        } else if (status === 'canceled') {
          canceledCount++;
        }

        const createdDate = new Date(sub.created_at);
        if (createdDate >= new Date(firstDayOfMonth)) {
          newSubscribersThisMonth++;
        }

        const serviceBalances = normalizeCreditBalances(
          creditRecord?.service_balance_map,
          creditRecord?.available_credits || 0,
          creditRecord?.used_credits || 0
        );
        const availableCredits = serviceBalances.length > 0
          ? getTotalAvailableCredits(serviceBalances)
          : creditRecord?.available_credits || 0;
        const usedCredits = serviceBalances.length > 0
          ? getTotalUsedCredits(serviceBalances)
          : creditRecord?.used_credits || 0;

        return {
          id: sub.id,
          client,
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                monthlyPrice: Number(plan.monthly_price) || 0,
                serviceCredits: plan.service_credits || 0,
                serviceCreditMap: plan.service_credit_map,
              }
            : { id: 'unknown', name: 'Plano não encontrado', monthlyPrice: 0, serviceCredits: 0 },
          status,
          nextBillingDate: sub.next_billing_date,
          cycleEnd: sub.cycle_end,
          availableCredits,
          usedCredits,
          serviceBalances,
          createdAt: sub.created_at,
          canceledAt: sub.canceled_at,
        };
      });

      const filteredSubscriptions = subscriptions.filter(sub => {
        const matchesStatus = filters.status === 'all' || filters.status === undefined || sub.status === filters.status;
        const matchesSearch =
          !filters.search ||
          sub.client.name.toLowerCase().includes(filters.search.toLowerCase()) ||
          sub.client.phone.includes(filters.search);
        return matchesStatus && matchesSearch;
      });

      const planDistribution: PlanDistribution[] = plans.map(plan => {
        const count = rawSubscriptions.filter(s => s.plan_id === plan.id && s.status === 'active').length;
        return {
          planId: plan.id,
          planName: plan.name,
          subscriberCount: count,
          monthlyRevenue: count * (Number(plan.monthly_price) || 0),
          percentOfTotal: activeCount > 0 ? (count / activeCount) * 100 : 0,
        };
      }).filter(p => p.subscriberCount > 0);

      const metrics: MembershipMetrics = {
        mrr,
        arr: mrr * 12,
        activeSubscribers: activeCount,
        totalSubscribers,
        churnRate: totalSubscribers > 0 ? (canceledCount / totalSubscribers) * 100 : 0,
        churnCount: canceledCount,
        totalOverdue,
        overduePercent: activeCount > 0 ? (pastDueCount / activeCount) * 100 : 0,
        pendingAmount,
        expiringNext30Days,
        newSubscribersThisMonth,
      };

      const sortedQueue = collectionQueue
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, 10);

      setData({
        loading: false,
        error: null,
        metrics,
        subscriptions: filteredSubscriptions,
        collectionQueue: sortedQueue,
        plans: planDistribution,
      });
    } catch (error: any) {
      logSupabaseError('[useMembershipOverview] Erro ao buscar dados do Clube', error, { tenantId });
      setData(prev => ({ ...prev, loading: false, error: error.message }));
    }
  }, [tenantId, filters.status, filters.search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, reload: fetchData };
};
