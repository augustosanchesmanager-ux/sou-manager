// Temporary frontend settlement organizer. The durable financial settlement must become a transactional RPC.
export interface CheckoutSettlementInput {
  client: any;
  comandaId: string;
  appointmentId?: string | null;
  tenantId: string;
  supabase: any;
  clientDb: any;
  paymentMethod: string;
  paidAmount: number;
  incomeCategory: string;
  description: string;
  shouldApplyFinancialEffects: boolean;
  closure: {
    mode: string;
    note?: string | null;
    financialEffect: boolean;
    membershipCreditEffect: boolean;
    legacyReferenceMonth?: string | null;
  };
  clientStats?: {
    lastService?: string;
  };
}

export const settleCheckoutComanda = async ({
  client,
  comandaId,
  appointmentId,
  tenantId,
  supabase,
  clientDb,
  paymentMethod,
  paidAmount,
  incomeCategory,
  description,
  shouldApplyFinancialEffects,
  closure,
  clientStats,
}: CheckoutSettlementInput) => {
  const paymentDateReal = new Date().toISOString();
  const { data: authData } = await supabase.auth.getUser();
  const settledByUserId = authData?.user?.id || null;

  const { error: updateError } = await clientDb
    .from('comandas')
    .update({
      status: 'paid',
      closure_mode: closure.mode,
      closure_note: closure.note || null,
      financial_effect: closure.financialEffect,
      membership_credit_effect: closure.membershipCreditEffect,
      legacy_reference_month: closure.legacyReferenceMonth || null,
      closed_at: paymentDateReal,
    })
    .eq('id', comandaId)
    .eq('tenant_id', tenantId);

  if (updateError) {
    console.warn('Error updating comanda status:', updateError);
  }

  if (appointmentId) {
    const { error: appointmentSyncError } = await clientDb
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (appointmentSyncError) {
      console.warn('Checkout finalized without appointment sync:', appointmentSyncError);
    }
  }

  if (!shouldApplyFinancialEffects) return;

  try {
    const { error: transError } = await clientDb.from('transactions').insert({
      user_id: settledByUserId,
      type: 'income',
      category: incomeCategory,
      amount: paidAmount,
      description,
      payment_method: paymentMethod,
      date: paymentDateReal,
      tenant_id: tenantId,
    });

    if (transError) {
      console.warn('Checkout finalized without transaction record:', transError);
    }
  } catch (transactionError) {
    console.warn('Checkout finalized but transaction logging failed:', transactionError);
  }

  try {
    const { data: clientData, error: clientFetchErr } = await clientDb
      .from('clients')
      .select('total_spent')
      .eq('id', client.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!clientFetchErr) {
      const newTotal = (clientData?.total_spent || 0) + paidAmount;
      const { error: clientUpdateError } = await clientDb.from('clients').update({
        total_spent: newTotal,
        last_visit: paymentDateReal,
        last_service: clientStats?.lastService || '',
      }).eq('id', client.id).eq('tenant_id', tenantId);

      if (clientUpdateError) {
        console.warn('Checkout finalized without client stats update:', clientUpdateError);
      }
    } else {
      console.warn('Checkout finalized without loading client stats:', clientFetchErr);
    }
  } catch (clientStatsError) {
    console.warn('Checkout finalized but client stats update failed:', clientStatsError);
  }
};
