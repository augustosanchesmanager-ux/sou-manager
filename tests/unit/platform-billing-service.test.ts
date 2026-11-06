import { describe, it, expect, vi, beforeEach } from 'vitest';
import { platformBillingService } from '../../services/platformBillingService';
import type {
  PlatformPlan,
  PlatformSubscription,
  PlatformInvoice,
  SaaSExecutiveMetrics,
  SettleInvoiceResult,
} from '../../src/types/platformBilling';

describe('PlatformBillingService — Unit Tests (Subphase 8.6)', () => {
  const mockTenantId = 'tenant-uuid-111';
  const mockPlanId = 'plan-uuid-pro';
  const mockSubId = 'sub-uuid-123';
  const mockInvoiceId = 'inv-uuid-999';

  const samplePlan: PlatformPlan = {
    id: mockPlanId,
    slug: 'pro',
    name: 'SMG Pro',
    description: 'Plano profissional com até 6 cadeiras, Public API e Webhooks.',
    price_cents: 29900,
    billing_interval: 'monthly',
    max_staff: 6,
    max_api_rpm: 300,
    features: {
      public_api: true,
      webhooks: true,
      multi_unit: false,
      financial_erp_sync: true,
    },
    active: true,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  };

  const sampleSubscription: PlatformSubscription = {
    id: mockSubId,
    tenant_id: mockTenantId,
    plan_id: mockPlanId,
    status: 'active',
    current_period_start: '2026-11-06T00:00:00Z',
    current_period_end: '2026-12-06T00:00:00Z',
    cancel_at_period_end: false,
    canceled_at: null,
    trial_ends_at: null,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
    plan: samplePlan,
  };

  const sampleInvoice: PlatformInvoice = {
    id: mockInvoiceId,
    subscription_id: mockSubId,
    tenant_id: mockTenantId,
    invoice_number: 'INV-202611-001',
    amount_cents: 29900,
    status: 'pending',
    due_date: '2026-11-15',
    paid_at: null,
    payment_method: 'pix',
    payment_link: 'https://pay.soumanager.com/inv/123',
    pdf_url: null,
    created_at: '2026-11-06T00:00:00Z',
    updated_at: '2026-11-06T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listPlans', () => {
    it('should_list_active_plans_ordered_by_price_ascending', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [samplePlan], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.listPlans(true, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('platform_plans');
      expect(mockQuery.eq).toHaveBeenCalledWith('active', true);
      expect(mockQuery.order).toHaveBeenCalledWith('price_cents', { ascending: true });
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('pro');
    });

    it('should_include_inactive_plans_when_activeOnly_is_false', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [samplePlan], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      await platformBillingService.listPlans(false, mockClient);

      expect(mockQuery.eq).not.toHaveBeenCalled();
      expect(mockQuery.order).toHaveBeenCalledWith('price_cents', { ascending: true });
    });

    it('should_throw_error_when_database_fails_to_list_plans', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      await expect(platformBillingService.listPlans(true, mockClient)).rejects.toThrow('DB Error');
    });
  });

  describe('getPlanBySlug', () => {
    it('should_return_plan_when_slug_exists', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: samplePlan, error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.getPlanBySlug('pro', mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('platform_plans');
      expect(mockQuery.eq).toHaveBeenCalledWith('slug', 'pro');
      expect(result?.slug).toBe('pro');
    });

    it('should_return_null_when_slug_is_empty', async () => {
      const result = await platformBillingService.getPlanBySlug('');
      expect(result).toBeNull();
    });

    it('should_throw_error_when_database_query_fails', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      await expect(platformBillingService.getPlanBySlug('pro', mockClient)).rejects.toThrow('Not found');
    });
  });

  describe('getTenantSubscription', () => {
    it('should_return_tenant_subscription_with_joined_plan', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: sampleSubscription, error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.getTenantSubscription(mockTenantId, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('platform_subscriptions');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(result?.status).toBe('active');
      expect(result?.plan?.name).toBe('SMG Pro');
    });

    it('should_unwrap_plan_when_postgrest_returns_it_as_array', async () => {
      const rawDataWithArrayPlan = {
        ...sampleSubscription,
        plan: [samplePlan],
      };

      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: rawDataWithArrayPlan, error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.getTenantSubscription(mockTenantId, mockClient);

      expect(result?.plan?.slug).toBe('pro');
    });

    it('should_throw_error_if_tenant_id_is_empty', async () => {
      await expect(platformBillingService.getTenantSubscription('')).rejects.toThrow('Tenant ID é obrigatório');
    });
  });

  describe('createOrUpdateSubscription', () => {
    it('should_upsert_subscription_successfully', async () => {
      const mockQuery: any = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: sampleSubscription, error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.createOrUpdateSubscription(
        {
          tenantId: mockTenantId,
          planId: mockPlanId,
          status: 'active',
          currentPeriodDays: 30,
        },
        mockClient
      );

      expect(mockClient.from).toHaveBeenCalledWith('platform_subscriptions');
      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: mockTenantId,
          plan_id: mockPlanId,
          status: 'active',
        }),
        { onConflict: 'tenant_id' }
      );
      expect(result.id).toBe(mockSubId);
    });

    it('should_set_trial_period_and_default_trialing_status', async () => {
      const mockQuery: any = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...sampleSubscription, status: 'trialing', trial_ends_at: '2026-11-20T00:00:00Z' },
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.createOrUpdateSubscription(
        {
          tenantId: mockTenantId,
          planId: mockPlanId,
          trialDays: 14,
        },
        mockClient
      );

      expect(mockQuery.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'trialing',
          trial_ends_at: expect.any(String),
        }),
        { onConflict: 'tenant_id' }
      );
      expect(result.status).toBe('trialing');
    });

    it('should_throw_validation_error_when_required_fields_are_missing', async () => {
      await expect(
        platformBillingService.createOrUpdateSubscription({ tenantId: '', planId: 'plan-1' })
      ).rejects.toThrow('Tenant ID é obrigatório');

      await expect(
        platformBillingService.createOrUpdateSubscription({ tenantId: 'tenant-1', planId: '' })
      ).rejects.toThrow('Plan ID é obrigatório');
    });
  });

  describe('cancelSubscription', () => {
    it('should_schedule_cancellation_at_period_end_by_default', async () => {
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...sampleSubscription, cancel_at_period_end: true },
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.cancelSubscription(mockTenantId, false, mockClient);

      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          cancel_at_period_end: true,
        })
      );
      expect(result.cancel_at_period_end).toBe(true);
    });

    it('should_cancel_immediately_when_requested', async () => {
      const mockQuery: any = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...sampleSubscription, status: 'canceled', canceled_at: '2026-11-06T12:00:00Z' },
          error: null,
        }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.cancelSubscription(mockTenantId, true, mockClient);

      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
          cancel_at_period_end: false,
          canceled_at: expect.any(String),
        })
      );
      expect(result.status).toBe('canceled');
    });

    it('should_throw_error_if_tenant_id_is_empty_on_cancel', async () => {
      await expect(platformBillingService.cancelSubscription('')).rejects.toThrow('Tenant ID é obrigatório');
    });
  });

  describe('listTenantInvoices', () => {
    it('should_list_invoices_for_given_tenant', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [sampleInvoice], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.listTenantInvoices(mockTenantId, undefined, 20, mockClient);

      expect(mockClient.from).toHaveBeenCalledWith('platform_invoices');
      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(result).toHaveLength(1);
      expect(result[0].invoice_number).toBe('INV-202611-001');
    });

    it('should_filter_by_invoice_status_when_provided', async () => {
      const mockQuery: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [sampleInvoice], error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      await platformBillingService.listTenantInvoices(mockTenantId, 'pending', 10, mockClient);

      expect(mockQuery.eq).toHaveBeenCalledWith('tenant_id', mockTenantId);
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should_throw_error_if_tenant_id_is_empty_on_list_invoices', async () => {
      await expect(platformBillingService.listTenantInvoices('')).rejects.toThrow('Tenant ID é obrigatório');
    });
  });

  describe('createInvoice', () => {
    it('should_create_invoice_with_valid_parameters', async () => {
      const mockQuery: any = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: sampleInvoice, error: null }),
      };

      const mockClient: any = {
        from: vi.fn().mockReturnValue(mockQuery),
      };

      const result = await platformBillingService.createInvoice(
        {
          subscriptionId: mockSubId,
          tenantId: mockTenantId,
          amountCents: 29900,
          dueDate: '2026-11-15',
          paymentMethod: 'pix',
        },
        mockClient
      );

      expect(mockClient.from).toHaveBeenCalledWith('platform_invoices');
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_id: mockSubId,
          tenant_id: mockTenantId,
          amount_cents: 29900,
          status: 'pending',
          due_date: '2026-11-15',
          payment_method: 'pix',
        })
      );
      expect(result.amount_cents).toBe(29900);
    });

    it('should_throw_validation_error_on_invalid_amount_or_missing_dates', async () => {
      await expect(
        platformBillingService.createInvoice({
          subscriptionId: mockSubId,
          tenantId: mockTenantId,
          amountCents: -50,
          dueDate: '2026-11-15',
        })
      ).rejects.toThrow('Valor da fatura deve ser maior ou igual a zero');

      await expect(
        platformBillingService.createInvoice({
          subscriptionId: mockSubId,
          tenantId: mockTenantId,
          amountCents: 29900,
          dueDate: '',
        })
      ).rejects.toThrow('Data de vencimento é obrigatória');
    });
  });

  describe('settleInvoice (RPC)', () => {
    it('should_invoke_settle_platform_invoice_rpc_and_return_success', async () => {
      const mockRpcResult: SettleInvoiceResult = {
        success: true,
        idempotent: false,
        invoice_id: mockInvoiceId,
        status: 'paid',
        paid_at: '2026-11-06T15:00:00Z',
      };

      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: mockRpcResult, error: null }),
      };

      const result = await platformBillingService.settleInvoice(mockInvoiceId, 'pix', mockClient);

      expect(mockClient.rpc).toHaveBeenCalledWith('settle_platform_invoice', {
        p_invoice_id: mockInvoiceId,
        p_payment_method: 'pix',
      });
      expect(result.success).toBe(true);
      expect(result.status).toBe('paid');
    });

    it('should_throw_error_when_settle_rpc_fails', async () => {
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('Acesso negado') }),
      };

      await expect(
        platformBillingService.settleInvoice(mockInvoiceId, 'pix', mockClient)
      ).rejects.toThrow('Acesso negado');
    });

    it('should_throw_error_if_invoice_id_is_empty', async () => {
      await expect(platformBillingService.settleInvoice('')).rejects.toThrow('Invoice ID é obrigatório');
    });
  });

  describe('getSaaSExecutiveMetrics (RPC)', () => {
    it('should_call_rpc_and_return_aggregated_saas_metrics', async () => {
      const sampleMetrics: SaaSExecutiveMetrics = {
        mrr_cents: 1547000,
        arr_cents: 18564000,
        active_subscribers: 52,
        past_due_subscribers: 3,
        trialing_subscribers: 10,
        canceled_subscribers: 2,
        overdue_invoices_amount_cents: 89700,
        by_plan: [
          { plan_id: 'p1', slug: 'starter', name: 'SMG Starter', subscribers_count: 30, mrr_cents: 447000 },
          { plan_id: 'p2', slug: 'pro', name: 'SMG Pro', subscribers_count: 20, mrr_cents: 598000 },
          { plan_id: 'p3', slug: 'enterprise', name: 'SMG Enterprise', subscribers_count: 5, mrr_cents: 349500 },
        ],
        calculated_at: '2026-11-06T15:30:00Z',
      };

      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({ data: sampleMetrics, error: null }),
      };

      const result = await platformBillingService.getSaaSExecutiveMetrics(mockClient);

      expect(mockClient.rpc).toHaveBeenCalledWith('get_saas_executive_metrics');
      expect(result.mrr_cents).toBe(1547000);
      expect(result.arr_cents).toBe(18564000);
      expect(result.active_subscribers).toBe(52);
      expect(result.by_plan).toHaveLength(3);
    });

    it('should_throw_error_if_rpc_fails_or_caller_is_not_super_admin', async () => {
      const mockClient: any = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Acesso negado: apenas Super-Admin pode consultar métricas executivas de SaaS.'),
        }),
      };

      await expect(platformBillingService.getSaaSExecutiveMetrics(mockClient)).rejects.toThrow('Acesso negado');
    });
  });
});
