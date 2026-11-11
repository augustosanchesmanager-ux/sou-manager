import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { getScopedClient } from '../../services/supabaseClient';
import {
  isAuditPinFormatValid,
  normalizeAuditPin,
  toLocalDateInput,
} from '../../src/lib/audit/competence';
import {
  adminAdjustComandaAudit,
  type AdjustableComandaStatus,
  type AdminAdjustComandaResult,
} from '../../src/lib/finance/comandaAdminAdjust';

export interface ComandaAdminAdjustTarget {
  id: string;
  status: 'blocked' | 'open' | 'paid' | 'cancelled';
  created_at: string;
  payment_date_real?: string | null;
  settled_at?: string | null;
  closed_at?: string | null;
  clients?: { name?: string | null };
}

interface ComandaAdminAdjustModalProps {
  isOpen: boolean;
  comanda: ComandaAdminAdjustTarget | null;
  tenantId: string | null;
  onClose: () => void;
  onSuccess: (result: AdminAdjustComandaResult) => void;
}

export const ComandaAdminAdjustModal: React.FC<ComandaAdminAdjustModalProps> = ({
  isOpen,
  comanda,
  tenantId,
  onClose,
  onSuccess,
}) => {
  const canEditStatus = comanda?.status === 'open' || comanda?.status === 'blocked';
  const canEditPaymentDate = comanda?.status === 'paid';

  const initialCreatedDate = comanda?.created_at ? toLocalDateInput(comanda.created_at) : '';
  const initialPaymentSource =
    comanda?.payment_date_real || comanda?.settled_at || comanda?.closed_at || null;
  const initialPaymentDate = initialPaymentSource ? toLocalDateInput(initialPaymentSource) : '';

  const [status, setStatus] = useState<AdjustableComandaStatus>('open');
  const [createdDate, setCreatedDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [reason, setReason] = useState('');
  const [auditPin, setAuditPin] = useState('');
  const [forceRequirePin, setForceRequirePin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !comanda) return;
    setStatus(comanda.status === 'blocked' ? 'blocked' : 'open');
    setCreatedDate(comanda.created_at ? toLocalDateInput(comanda.created_at) : '');
    const paySrc = comanda.payment_date_real || comanda.settled_at || comanda.closed_at || null;
    setPaymentDate(paySrc ? toLocalDateInput(paySrc) : '');
    setReason('');
    setAuditPin('');
    setForceRequirePin(false);
    setError(null);
  }, [isOpen, comanda]);

  if (!comanda) return null;

  const statusChanged = canEditStatus && status !== comanda.status;
  const createdChanged = Boolean(createdDate) && createdDate !== initialCreatedDate;
  const paymentChanged = canEditPaymentDate && Boolean(paymentDate) && paymentDate !== initialPaymentDate;
  const hasAnyChange = statusChanged || createdChanged || paymentChanged;
  const requiresPin = paymentChanged || forceRequirePin;
  const todayMax = toLocalDateInput(new Date());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setError('Tenant inválido para executar ajuste gerencial.');
      return;
    }
    if (!hasAnyChange) {
      setError('Altere ao menos um campo antes de salvar.');
      return;
    }
    if (!reason.trim()) {
      setError('Informe o motivo obrigatório para o registro de auditoria.');
      return;
    }
    if (requiresPin && !isAuditPinFormatValid(auditPin)) {
      setError('Informe o PIN gerencial válido (6 a 8 dígitos numéricos).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await adminAdjustComandaAudit({
        tenantId,
        comandaId: comanda.id,
        reason: reason.trim(),
        newStatus: statusChanged ? status : null,
        newCreatedAt: createdChanged ? createdDate : null,
        newPaymentDate: paymentChanged ? paymentDate : null,
        auditPin: auditPin.trim() || null,
        supabase: getScopedClient('barber'),
      });
      onSuccess(result);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao executar ajuste gerencial.';
      if (msg.toLowerCase().includes('exige pin')) {
        setForceRequirePin(true);
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!submitting) onClose(); }}
      title="Ajuste Gerencial Auditado"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
          <p className="font-bold">Operação exclusiva de gerência com trilha imutável (ADR-046)</p>
          <p className="mt-1 opacity-90">
            Cliente: <strong>{comanda.clients?.name || 'Não identificado'}</strong> · Comanda #{comanda.id.slice(0, 8)}
          </p>
        </div>

        {canEditStatus ? (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
              Status da comanda
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AdjustableComandaStatus)}
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="open">Aberta (open)</option>
              <option value="blocked">Bloqueada (blocked)</option>
            </select>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-gold-pale/40 px-3 py-2 text-xs text-ink-soft">
            Status atual: <strong className="uppercase">{comanda.status}</strong>. Comandas pagas ou canceladas não alteram status por este ajuste (ADR-035).
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
              Data de abertura
            </label>
            <input
              type="date"
              max={todayMax}
              value={createdDate}
              onChange={(e) => setCreatedDate(e.target.value)}
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {canEditPaymentDate && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                Data de pagamento (exige PIN)
              </label>
              <input
                type="date"
                max={todayMax}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
            Motivo obrigatório
          </label>
          <textarea
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o motivo operacional/financeiro do ajuste"
            className="w-full rounded-xl border border-line bg-card p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {requiresPin && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
              PIN Gerencial (6 a 8 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={auditPin}
              onChange={(e) => setAuditPin(normalizeAuditPin(e.target.value))}
              placeholder="Digite seu PIN gerencial"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm tracking-widest text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-[11px] text-ink-soft">
              Obrigatório ao alterar data de pagamento ou movimentar dia com caixa fechado (ADR-039).
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !hasAnyChange || !reason.trim()}
          >
            {submitting ? 'Salvando ajuste...' : 'Confirmar ajuste auditado'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ComandaAdminAdjustModal;
