import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import {
  CUSTOMER_VOUCHERS_UNAVAILABLE_MESSAGE,
  cancelCustomerVoucher,
  createCustomerVoucher,
  isCustomerVouchersUnavailableError,
  listCustomerVouchers,
  markCustomerVoucherUsed,
} from '../../src/lib/vouchers';
import type {
  CustomerVoucher,
  CustomerVoucherBenefitType,
  CustomerVoucherStatus,
} from '../../src/types/vouchers';
import {
  CUSTOMER_VOUCHER_BENEFIT_LABELS,
  CUSTOMER_VOUCHER_STATUS_LABELS,
} from '../../src/types/vouchers';

interface CustomerVouchersSectionProps {
  tenantId: string | null;
  customerId: string;
  currentUserId?: string | null;
  onToast?: (toast: { message: string; type: 'success' | 'error' | 'info' }) => void;
}

interface VoucherFormState {
  title: string;
  benefitType: CustomerVoucherBenefitType;
  voucherCode: string;
  description: string;
  discountAmount: string;
  discountPercentage: string;
  expiresAt: string;
  notes: string;
}

const initialForm: VoucherFormState = {
  title: '',
  benefitType: 'free_service',
  voucherCode: '',
  description: '',
  discountAmount: '',
  discountPercentage: '',
  expiresAt: '',
  notes: '',
};

const statusStyles: Record<CustomerVoucherStatus, string> = {
  available: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  used: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  expired: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
  cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
};

const getEffectiveStatus = (voucher: CustomerVoucher): CustomerVoucherStatus => {
  if (voucher.status !== 'available') return voucher.status;
  if (!voucher.expires_at) return 'available';
  return new Date(voucher.expires_at).getTime() < Date.now() ? 'expired' : 'available';
};

const toNullableNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const CustomerVouchersSection: React.FC<CustomerVouchersSectionProps> = ({
  tenantId,
  customerId,
  currentUserId,
  onToast,
}) => {
  const [vouchers, setVouchers] = useState<CustomerVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<VoucherFormState>(initialForm);
  const [cancelTarget, setCancelTarget] = useState<CustomerVoucher | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [isSchemaAvailable, setIsSchemaAvailable] = useState(true);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    onToast?.({ message, type });
  }, [onToast]);

  const loadVouchers = useCallback(async () => {
    if (!tenantId || !customerId) {
      setVouchers([]);
      return;
    }

    setLoading(true);
    try {
      const data = await listCustomerVouchers(tenantId, customerId);
      setIsSchemaAvailable(true);
      setVouchers(data);
    } catch (error) {
      if (isCustomerVouchersUnavailableError(error)) {
        setIsSchemaAvailable(false);
        setVouchers([]);
        return;
      }
      console.error('Erro ao carregar vouchers do cliente:', error);
      notify('Erro ao carregar vouchers do cliente.', 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, notify, tenantId]);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  const grouped = useMemo(() => ({
    available: vouchers.filter((voucher) => getEffectiveStatus(voucher) === 'available'),
    other: vouchers.filter((voucher) => getEffectiveStatus(voucher) !== 'available'),
  }), [vouchers]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) {
      notify('Tenant inválido para criar voucher.', 'error');
      return;
    }

    setSaving(true);
    try {
      await createCustomerVoucher({
        tenantId,
        customerId,
        title: form.title,
        benefitType: form.benefitType,
        voucherCode: form.voucherCode,
        description: form.description,
        discountAmount: form.benefitType === 'discount_fixed' ? toNullableNumber(form.discountAmount) : null,
        discountPercentage: form.benefitType === 'discount_percentage' ? toNullableNumber(form.discountPercentage) : null,
        expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
        notes: form.notes,
        issuedByUserId: currentUserId || null,
      });
      setForm(initialForm);
      setShowCreateModal(false);
      notify('Voucher criado com sucesso.', 'success');
      await loadVouchers();
    } catch (error) {
      console.error('Erro ao criar voucher:', error);
      notify(error instanceof Error ? error.message : 'Erro ao criar voucher.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!tenantId || !cancelTarget) return;

    setActionId(cancelTarget.id);
    try {
      await cancelCustomerVoucher({
        tenantId,
        voucherId: cancelTarget.id,
        reason: cancelReason,
        cancelledByUserId: currentUserId || null,
      });
      setCancelTarget(null);
      setCancelReason('');
      notify('Voucher cancelado.', 'success');
      await loadVouchers();
    } catch (error) {
      console.error('Erro ao cancelar voucher:', error);
      notify(error instanceof Error ? error.message : 'Erro ao cancelar voucher.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleUse = async (voucher: CustomerVoucher) => {
    if (!tenantId) return;
    const confirmed = window.confirm('Marcar este voucher como usado? Isso não altera valores financeiros nesta fase.');
    if (!confirmed) return;

    setActionId(voucher.id);
    try {
      await markCustomerVoucherUsed({
        tenantId,
        voucherId: voucher.id,
        usedByUserId: currentUserId || null,
      });
      notify('Voucher marcado como usado.', 'success');
      await loadVouchers();
    } catch (error) {
      console.error('Erro ao marcar voucher como usado:', error);
      notify(error instanceof Error ? error.message : 'Erro ao marcar voucher como usado.', 'error');
    } finally {
      setActionId(null);
    }
  };

  const renderVoucher = (voucher: CustomerVoucher) => {
    const effectiveStatus = getEffectiveStatus(voucher);
    const isAvailable = effectiveStatus === 'available';

    return (
      <div
        key={voucher.id}
        className={`rounded-xl border p-4 ${isAvailable
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5'}`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black text-slate-900 dark:text-white">{voucher.title}</p>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusStyles[effectiveStatus]}`}>
                {CUSTOMER_VOUCHER_STATUS_LABELS[effectiveStatus]}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {CUSTOMER_VOUCHER_BENEFIT_LABELS[voucher.benefit_type]}
              {voucher.voucher_code ? ` • Código: ${voucher.voucher_code}` : ''}
            </p>
            {voucher.description && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{voucher.description}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAvailable && (
              <>
                <button
                  type="button"
                  onClick={() => void handleUse(voucher)}
                  disabled={actionId === voucher.id}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Usar
                </button>
                <button
                  type="button"
                  onClick={() => { setCancelTarget(voucher); setCancelReason(''); }}
                  disabled={actionId === voucher.id}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[14px]">cancel</span>
                  Cancelar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500 sm:grid-cols-4">
          <div>
            <p className="font-black uppercase">Criado</p>
            <p>{formatDate(voucher.created_at)}</p>
          </div>
          <div>
            <p className="font-black uppercase">Validade</p>
            <p>{formatDate(voucher.expires_at)}</p>
          </div>
          <div>
            <p className="font-black uppercase">Valor</p>
            <p>
              {voucher.benefit_type === 'discount_fixed' && voucher.discount_amount !== null
                ? `R$ ${Number(voucher.discount_amount).toFixed(2).replace('.', ',')}`
                : voucher.benefit_type === 'discount_percentage' && voucher.discount_percentage !== null
                  ? `${Number(voucher.discount_percentage).toFixed(0)}%`
                  : '-'}
            </p>
          </div>
          <div>
            <p className="font-black uppercase">Uso</p>
            <p>{formatDate(voucher.used_at)}</p>
          </div>
        </div>

        {(voucher.notes || voucher.cancellation_reason) && (
          <div className="mt-3 rounded-lg bg-white/70 p-3 text-xs text-slate-600 dark:bg-black/10 dark:text-slate-300">
            {voucher.notes && <p><strong>Observação:</strong> {voucher.notes}</p>}
            {voucher.cancellation_reason && <p><strong>Cancelamento:</strong> {voucher.cancellation_reason}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">Vouchers</p>
          <p className="text-xs text-slate-500">Benefícios manuais registrados para este cliente.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          disabled={!isSchemaAvailable}
          title={!isSchemaAvailable ? CUSTOMER_VOUCHERS_UNAVAILABLE_MESSAGE : undefined}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Adicionar voucher
        </button>
      </div>

      {!isSchemaAvailable ? (
        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/70 p-4 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {CUSTOMER_VOUCHERS_UNAVAILABLE_MESSAGE} A migration revisável precisa ser aprovada e aplicada antes do uso real.
        </div>
      ) : loading ? (
        <div className="rounded-lg bg-slate-50 p-4 text-xs font-bold text-slate-500 dark:bg-white/5">
          Carregando vouchers...
        </div>
      ) : vouchers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-white/10">
          Nenhum voucher registrado para este cliente.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.available.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-emerald-600">Disponíveis</p>
              {grouped.available.map(renderVoucher)}
            </div>
          )}
          {grouped.other.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase text-slate-500">Histórico</p>
              {grouped.other.map(renderVoucher)}
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); setForm(initialForm); }}
        title="Adicionar voucher"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Nome do voucher</label>
            <input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
              placeholder="Ex: Hidratação gratuita"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Tipo de benefício</label>
            <select
              value={form.benefitType}
              onChange={(event) => setForm((prev) => ({ ...prev, benefitType: event.target.value as CustomerVoucherBenefitType }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
            >
              <option value="free_service">Serviço gratuito</option>
              <option value="discount_fixed">Desconto fixo</option>
              <option value="discount_percentage">Desconto percentual</option>
              <option value="custom_benefit">Benefício personalizado</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Código</label>
              <input
                value={form.voucherCode}
                onChange={(event) => setForm((prev) => ({ ...prev, voucherCode: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Validade</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
              />
            </div>
          </div>

          {form.benefitType === 'discount_fixed' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Valor do desconto</label>
              <input
                inputMode="decimal"
                value={form.discountAmount}
                onChange={(event) => setForm((prev) => ({ ...prev, discountAmount: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                placeholder="0,00"
              />
            </div>
          )}

          {form.benefitType === 'discount_percentage' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Percentual do desconto</label>
              <input
                inputMode="decimal"
                value={form.discountPercentage}
                onChange={(event) => setForm((prev) => ({ ...prev, discountPercentage: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                placeholder="Ex: 15"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Descricao</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
              placeholder="Detalhe o benefício para a equipe."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Observação interna</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="min-h-[70px] w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
              placeholder="Opcional"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowCreateModal(false); setForm(initialForm); }}
              className="flex-1 rounded-lg bg-slate-100 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar voucher'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!cancelTarget}
        onClose={() => { setCancelTarget(null); setCancelReason(''); }}
        title="Cancelar voucher"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Informe o motivo para cancelar <strong>{cancelTarget?.title}</strong>.
          </p>
          <textarea
            required
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            className="min-h-[100px] w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
            placeholder="Motivo obrigatório"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setCancelTarget(null); setCancelReason(''); }}
              className="flex-1 rounded-lg bg-slate-100 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={!cancelReason.trim() || actionId === cancelTarget?.id}
              className="flex-1 rounded-lg bg-red-500 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
            >
              Cancelar voucher
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerVouchersSection;
