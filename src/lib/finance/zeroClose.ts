import { logSupabaseError } from '../supabase/errors';

export type ZeroCloseOrigin = 'club_credit' | 'house_courtesy' | 'administrative_adjustment';
export type ZeroCloseSource = 'checkout' | 'financial_admin';

interface ZeroCloseAuditInput {
  origin: ZeroCloseOrigin;
  source: ZeroCloseSource;
  authorizedBy?: string | null;
  reason?: string | null;
  userId?: string | null;
}

interface ZeroCloseInput extends ZeroCloseAuditInput {
  supabase: any;
  tenantId: string;
  comandaId: string;
  legacyReferenceMonth?: string | null;
}

export interface ZeroCloseResult {
  success: boolean;
  comandaId: string;
  updatedCount: number;
  origin: ZeroCloseOrigin;
  message: string;
}

const ZERO_CLOSE_ERROR_MESSAGE =
  'Fechamento zero exige origem auditavel. Nenhuma baixa foi aplicada.';

const ZERO_CLOSE_ORIGIN_LABELS: Record<ZeroCloseOrigin, string> = {
  club_credit: 'Crédito do Club dos Chefes',
  house_courtesy: 'Cortesia da casa',
  administrative_adjustment: 'Baixa administrativa',
};

const requiresReason = (origin: ZeroCloseOrigin) =>
  origin === 'house_courtesy' || origin === 'administrative_adjustment';

const assertComandaOpenForZeroClose = async ({
  supabase,
  tenantId,
  comandaId,
}: Pick<ZeroCloseInput, 'supabase' | 'tenantId' | 'comandaId'>) => {
  const { data, error } = await supabase
    .from('comandas')
    .select('id, status, tenant_id')
    .eq('id', comandaId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    logSupabaseError('[zeroClose] status check failed', error, { comandaId, tenantId });
    throw new Error(error.message || 'Nao foi possivel validar o status da comanda antes do fechamento zero.');
  }

  if (!data) {
    throw new Error('Comanda nao encontrada para este tenant. Nenhuma baixa zero foi aplicada.');
  }

  if (data.status !== 'open') {
    throw new Error(`Comanda com status "${data.status || 'desconhecido'}" nao pode ser fechada por baixa zero. Nenhuma alteracao foi aplicada.`);
  }
};

export const isManagerLikeRole = (role?: string | null, canAccessSuperAdmin = false) => {
  if (canAccessSuperAdmin) return true;
  const normalized = String(role || '').trim().toLowerCase();
  return ['owner', 'admin', 'adminmanager', 'gerente administrativo', 'manager', 'gerente', 'superadmin', 'super admin'].includes(normalized);
};

export const buildZeroCloseAuditNote = ({
  origin,
  source,
  authorizedBy,
  reason,
  userId,
}: ZeroCloseAuditInput) => JSON.stringify({
  zero_close_reason: reason || ZERO_CLOSE_ORIGIN_LABELS[origin],
  zero_close_origin: origin,
  authorized_by: authorizedBy || userId || null,
  reason: reason || null,
  user_id: userId || null,
  created_at: new Date().toISOString(),
  source,
});

export const closeZeroAmountComanda = async ({
  supabase,
  tenantId,
  comandaId,
  origin,
  source,
  authorizedBy,
  reason,
  userId,
  legacyReferenceMonth,
}: ZeroCloseInput): Promise<ZeroCloseResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para fechamento zero.');
  if (!comandaId) throw new Error('comanda_id obrigatório para fechamento zero.');
  if (!origin) throw new Error(ZERO_CLOSE_ERROR_MESSAGE);
  if (requiresReason(origin) && !String(reason || '').trim()) {
    throw new Error('Informe o motivo obrigatório para fechamento zero auditado.');
  }

  await assertComandaOpenForZeroClose({ supabase, tenantId, comandaId });

  const auditNote = buildZeroCloseAuditNote({
    origin,
    source,
    authorizedBy,
    reason: reason?.trim() || null,
    userId,
  });

  const rpcName = origin === 'club_credit'
    ? 'bulk_close_comandas_with_credits'
    : 'bulk_close_comandas_admin';
  const rpcParams = origin === 'club_credit'
    ? {
        p_comanda_ids: [comandaId],
        p_tenant_id: tenantId,
        p_closure_note: auditNote,
        p_payment_method: 'Club dos Chefes',
        p_apply_credits: true,
      }
    : {
        p_comanda_ids: [comandaId],
        p_tenant_id: tenantId,
        p_closure_note: auditNote,
        p_legacy_reference_month: legacyReferenceMonth || null,
      };

  const { data, error } = await supabase.rpc(rpcName, rpcParams);
  if (error) {
    logSupabaseError(`[zeroClose] ${rpcName} failed`, error, {
      comandaId,
      tenantId,
      origin,
    });
    throw new Error(error.message || ZERO_CLOSE_ERROR_MESSAGE);
  }

  const updatedCount = Number(data?.updated_count || 0);
  if (updatedCount < 1) {
    throw new Error('Nenhuma comanda aberta foi fechada. Verifique status, tenant e origem auditada.');
  }

  return {
    success: true,
    comandaId,
    updatedCount,
    origin,
    message: `Comanda fechada com origem zero: ${ZERO_CLOSE_ORIGIN_LABELS[origin]}.`,
  };
};
