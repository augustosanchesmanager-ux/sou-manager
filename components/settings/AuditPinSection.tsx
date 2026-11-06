import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSharedClient } from '../../services/supabaseClient';
import { AUDIT_PIN_MAX_LENGTH, normalizeAuditPin } from '../../src/lib/audit/competence';
import {
  AUDIT_PIN_STATUS_UNAVAILABLE,
  isAuditPinRpcUnavailable,
  mapAuditPinRpcError,
  validateAuditPinForm,
} from '../../src/lib/audit/pinManagement';

interface AuditPinStatus {
  configured: boolean;
  updatedAt: string | null;
}

interface FeedbackMessage {
  type: 'success' | 'error';
  text: string;
}

const formatUpdatedAt = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Autoatendimento do PIN gerencial (R-04 revisado em 2026-11-05).
 *
 * O hash nunca chega ao navegador: a tela lê apenas o status
 * (`get_audit_pin_status`) e grava via `set_audit_pin`, ambas RPCs
 * SECURITY DEFINER com escopo no próprio `auth.uid()`.
 */
export const AuditPinSection: React.FC = () => {
  const { tenantId } = useAuth();

  const [status, setStatus] = useState<AuditPinStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<FeedbackMessage | null>(null);

  const loadStatus = useCallback(async () => {
    if (!tenantId) {
      setStatus(null);
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);
    setStatusError(null);

    try {
      const client = getSharedClient();
      const { data, error } = await client.rpc('get_audit_pin_status', {
        p_tenant_id: tenantId,
      });

      if (error) throw error;

      const payload = (data || {}) as { configured?: boolean; updated_at?: string | null };
      setStatus({
        configured: Boolean(payload.configured),
        updatedAt: payload.updated_at ?? null,
      });
    } catch (err: any) {
      setStatus(null);
      setStatusError(mapAuditPinRpcError(err?.message));
      if (!isAuditPinRpcUnavailable(err?.message)) {
        console.error('[Settings][AuditPin] Erro ao carregar status do PIN:', err);
      }
    } finally {
      setStatusLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId || !status || saving) return;

    const validationError = validateAuditPinForm({
      configured: status.configured,
      currentPin,
      newPin,
      confirmPin,
    });

    if (validationError) {
      setFormMessage({ type: 'error', text: validationError });
      return;
    }

    setSaving(true);
    setFormMessage(null);

    try {
      const client = getSharedClient();
      const { data, error } = await client.rpc('set_audit_pin', {
        p_tenant_id: tenantId,
        p_new_pin: newPin,
        p_current_pin: status.configured ? currentPin : null,
      });

      if (error) throw error;

      const payload = (data || {}) as { created?: boolean; message?: string };

      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      await loadStatus();
      setFormMessage({
        type: 'success',
        text:
          payload.message ||
          (payload.created ? 'PIN gerencial cadastrado.' : 'PIN gerencial atualizado.'),
      });
    } catch (err: any) {
      setFormMessage({ type: 'error', text: mapAuditPinRpcError(err?.message) });
    } finally {
      setSaving(false);
    }
  };

  const updatedAtLabel = formatUpdatedAt(status?.updatedAt ?? null);

  return (
    <section className="bg-white dark:bg-card-dark p-8 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden relative">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl">pin</span>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">PIN Gerencial</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Segundo fator exigido em estornos com competência em caixa já confirmado.
            </p>
          </div>
        </div>

        {!statusLoading && status && (
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              status.configured
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}
          >
            {status.configured ? 'PIN cadastrado' : 'PIN não cadastrado'}
          </span>
        )}
      </div>

      {statusLoading && (
        <div className="py-8 flex justify-center items-center">
          <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {!statusLoading && statusError && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-start gap-2">
          <span className="material-symbols-outlined text-sm mt-0.5">info</span>
          <span>{statusError || AUDIT_PIN_STATUS_UNAVAILABLE}</span>
        </div>
      )}

      {!statusLoading && status && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {status.configured
                ? 'Informe o PIN atual para definir um novo.'
                : 'Nenhum PIN cadastrado para o seu usuário neste tenant.'}
            </span>
            {updatedAtLabel && <span>Última alteração: {updatedAtLabel}</span>}
          </div>

          {formMessage && (
            <div
              className={`mb-4 p-3 rounded-lg border text-sm font-bold flex items-center gap-2 ${
                formMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {formMessage.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {formMessage.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
            {status.configured && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  PIN atual
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={AUDIT_PIN_MAX_LENGTH}
                  required
                  value={currentPin}
                  onChange={(event) => setCurrentPin(normalizeAuditPin(event.target.value))}
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm tracking-[0.3em] focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {status.configured ? 'Novo PIN' : 'PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={AUDIT_PIN_MAX_LENGTH}
                  required
                  value={newPin}
                  onChange={(event) => setNewPin(normalizeAuditPin(event.target.value))}
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm tracking-[0.3em] focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Confirmar PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={AUDIT_PIN_MAX_LENGTH}
                  required
                  value={confirmPin}
                  onChange={(event) => setConfirmPin(normalizeAuditPin(event.target.value))}
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm tracking-[0.3em] focus:ring-1 focus:ring-primary outline-none transition-all"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              O PIN tem de 6 a 8 dígitos, é pessoal e nunca é exibido depois de salvo. Se você
              esquecer o PIN, será necessário redefini-lo no banco.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-primary text-night text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving
                ? 'Salvando...'
                : status.configured
                  ? 'Alterar PIN'
                  : 'Cadastrar PIN'}
            </button>
          </form>
        </>
      )}
    </section>
  );
};
