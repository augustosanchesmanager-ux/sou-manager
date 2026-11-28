import React, { useEffect, useMemo, useState } from 'react';
import { getSharedClient } from '../../services/supabaseClient';
import {
  DEFAULT_TENANT_BUSINESS_RULES,
  getTenantBusinessRules,
  upsertTenantBusinessRules,
  type TenantBusinessRules,
  type PartialPaymentCommissionPolicy,
  type DiscountCommissionBase,
  type PartialPaymentRoleGate,
  type OverdueOpenComandaPolicy,
  type OverdueClientNewFiadoPolicy,
} from '../../src/lib/finance/businessRules';
import { REFUND_METHODS, type RefundMethod } from '../../src/lib/finance/refundConfig';

interface BusinessRulesSectionProps {
  tenantId: string | null;
}

const RULE_LABELS: Record<string, string> = {
  partial_payment_commission_policy: 'Comissão em pagamento parcial',
  discount_commission_base: 'Base de comissão com desconto',
  default_product_commission_rate: 'Taxa padrão de comissão em produtos (%)',
  allow_split_payment: 'Múltiplas formas de pagamento (Split)',
  partial_payment_role_gate: 'Permissão para lançar sinal / parcial',
  require_client_for_partial_or_fiado: 'Exigir cliente identificado em parcial/fiado',
  overdue_open_comanda_policy: 'Virada do dia (Pagamento Pendente)',
  default_fiado_due_days: 'Prazo padrão de vencimento do Fiado (dias)',
  overdue_client_new_fiado_policy: 'Novo fiado para cliente com pendência',
  refund_method: 'Método padrão de reembolso',
  require_manager_pin_rules: 'Regras de PIN do Gestor',
};

export const BusinessRulesSection: React.FC<BusinessRulesSectionProps> = ({ tenantId }) => {
  const [savedRules, setSavedRules] = useState<TenantBusinessRules>(DEFAULT_TENANT_BUSINESS_RULES);
  const [draft, setDraft] = useState<TenantBusinessRules>(DEFAULT_TENANT_BUSINESS_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getTenantBusinessRules({ tenantId, supabase: getSharedClient() })
      .then((rules) => {
        if (cancelled) return;
        setSavedRules(rules);
        setDraft(rules);
      })
      .catch((err) => {
        console.warn('[BusinessRulesSection] Erro ao carregar regras:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const changedKeys = useMemo(() => {
    const keys = Object.keys(DEFAULT_TENANT_BUSINESS_RULES) as Array<keyof TenantBusinessRules>;
    return keys.filter((k) => JSON.stringify(draft[k]) !== JSON.stringify(savedRules[k]));
  }, [draft, savedRules]);

  const handleSave = async () => {
    if (!tenantId || changedKeys.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await upsertTenantBusinessRules({
        tenantId,
        rules: draft,
        supabase: getSharedClient(),
      });
      setSavedRules(res.rules);
      setDraft(res.rules);
      setFeedback({ type: 'success', text: 'Regras de negócio salvas com trilha de auditoria.' });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Não foi possível salvar as regras de negócio.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!tenantId) return null;

  return (
    <section className="bg-card p-6 sm:p-8 rounded-2xl border border-line shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 text-primary-dark dark:text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">tune</span>
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-ink">
              Central de Regras de Negócio (ADR-059)
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Parametrize comissões, PDV, virada do dia e governança da unidade. Alterações valem apenas para operações futuras e ficam registradas em auditoria.
            </p>
          </div>
        </div>
        {changedKeys.length > 0 && (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-warning/20 text-warning border border-warning/30 w-fit">
            {changedKeys.length} alteração(ões) pendente(s)
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-ink-soft animate-pulse py-4">Carregando parâmetros da unidade...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Bloco 1: Comissões */}
          <div className="p-4 rounded-xl bg-cream border border-line space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary-dark dark:text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">percent</span>
              1. Comissões
            </h4>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Comissão em pagamento parcial
              </label>
              <select
                value={draft.partial_payment_commission_policy}
                onChange={(e) =>
                  setDraft({ ...draft, partial_payment_commission_policy: e.target.value as PartialPaymentCommissionPolicy })
                }
                className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-medium outline-none focus:border-primary"
              >
                <option value="proportional_cash">Proporcional ao valor recebido no dia (ADR-030)</option>
                <option value="only_on_full_settlement">Somente após quitação 100% da comanda</option>
              </select>
              <p className="text-[11px] text-ink-soft">
                Ex.: cliente pagou R$ 50 de R$ 100 hoje → libera comissão sobre R$ 50 hoje e R$ 50 na quitação.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Base de cálculo quando há desconto
              </label>
              <select
                value={draft.discount_commission_base}
                onChange={(e) =>
                  setDraft({ ...draft, discount_commission_base: e.target.value as DiscountCommissionBase })
                }
                className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-medium outline-none focus:border-primary"
              >
                <option value="net_after_discount">Valor líquido recebido após desconto</option>
                <option value="respect_discount_bearer">Respeitar quem absorve (barbeiro vs. barbearia)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Taxa padrão de comissão em produtos (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.default_product_commission_rate}
                onChange={(e) =>
                  setDraft({ ...draft, default_product_commission_rate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                }
                className="w-32 px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-bold tabular-nums outline-none focus:border-primary"
              />
              <p className="text-[11px] text-ink-soft">
                Respeita sempre o percentual individual configurado no cadastro do profissional (ADR-047).
              </p>
            </div>
          </div>

          {/* Bloco 2: PDV & Pagamentos */}
          <div className="p-4 rounded-xl bg-cream border border-line space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary-dark dark:text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">point_of_sale</span>
              2. PDV & Múltiplas Formas
            </h4>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.allow_split_payment}
                onChange={(e) => setDraft({ ...draft, allow_split_payment: e.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <div>
                <span className="text-xs font-bold text-ink block">Habilitar múltiplas formas de pagamento (Split)</span>
                <span className="text-[11px] text-ink-soft">Permite receber Pix + Cartão + Dinheiro na mesma comanda.</span>
              </div>
            </label>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Quem pode lançar sinal / pagamento parcial
              </label>
              <select
                value={draft.partial_payment_role_gate}
                onChange={(e) =>
                  setDraft({ ...draft, partial_payment_role_gate: e.target.value as PartialPaymentRoleGate })
                }
                className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-medium outline-none focus:border-primary"
              >
                <option value="reception_and_management">Recepção + Gestão</option>
                <option value="management_only">Somente Gestão</option>
                <option value="disabled">Desabilitado</option>
              </select>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.require_client_for_partial_or_fiado}
                onChange={(e) => setDraft({ ...draft, require_client_for_partial_or_fiado: e.target.checked })}
                className="mt-0.5 size-4 accent-primary"
              />
              <div>
                <span className="text-xs font-bold text-ink block">Exigir cliente identificado em parcial ou fiado</span>
                <span className="text-[11px] text-ink-soft">Evita saldo devedor sem cadastro para cobrança.</span>
              </div>
            </label>
          </div>

          {/* Bloco 3: Virada do Dia & Pendências */}
          <div className="p-4 rounded-xl bg-cream border border-line space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary-dark dark:text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">schedule</span>
              3. Virada do Dia & Pendências
            </h4>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Comanda aberta ou parcial após virar o dia
              </label>
              <select
                value={draft.overdue_open_comanda_policy}
                onChange={(e) =>
                  setDraft({ ...draft, overdue_open_comanda_policy: e.target.value as OverdueOpenComandaPolicy })
                }
                className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-medium outline-none focus:border-primary"
              >
                <option value="auto_pending_payment">Vira Pagamento Pendente automaticamente (00:05 BRT)</option>
                <option value="manual">Manter em aberto até ação manual</option>
              </select>
              <p className="text-[11px] text-ink-soft">
                Entra automaticamente na fila de Contas a Receber com Total, Já Pago e Saldo Restante.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Prazo padrão de vencimento do Fiado (dias)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={draft.default_fiado_due_days}
                onChange={(e) =>
                  setDraft({ ...draft, default_fiado_due_days: Math.max(1, Math.min(365, Number(e.target.value) || 15)) })
                }
                className="w-32 px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-bold tabular-nums outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Novo fiado para cliente com pendência vencida
              </label>
              <select
                value={draft.overdue_client_new_fiado_policy}
                onChange={(e) =>
                  setDraft({ ...draft, overdue_client_new_fiado_policy: e.target.value as OverdueClientNewFiadoPolicy })
                }
                className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-medium outline-none focus:border-primary"
              >
                <option value="warn">Alertar operador no PDV</option>
                <option value="block_with_pin">Bloquear (exige PIN do Gestor)</option>
                <option value="off">Desligado</option>
              </select>
            </div>
          </div>

          {/* Bloco 4: Caixa & Segurança */}
          <div className="p-4 rounded-xl bg-cream border border-line space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-primary-dark dark:text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">shield</span>
              4. Caixa & Segurança
            </h4>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-ink">
                Método padrão de reembolso
              </label>
              <select
                value={draft.refund_method}
                onChange={(e) => setDraft({ ...draft, refund_method: e.target.value as RefundMethod })}
                className="w-full px-3 py-2 rounded-lg border border-line bg-card text-ink text-xs font-medium outline-none focus:border-primary"
              >
                {REFUND_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-ink">Exigir PIN do Gestor para:</p>
              <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.require_manager_pin_rules.refund}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      require_manager_pin_rules: { ...draft.require_manager_pin_rules, refund: e.target.checked },
                    })
                  }
                  className="size-4 accent-primary"
                />
                Estorno no Fluxo de Caixa
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.require_manager_pin_rules.zero_close}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      require_manager_pin_rules: { ...draft.require_manager_pin_rules, zero_close: e.target.checked },
                    })
                  }
                  className="size-4 accent-primary"
                />
                Fechamento zerado (cortesia / ajuste)
              </label>
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <span>Desconto acima de</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.require_manager_pin_rules.discount_above_pct}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      require_manager_pin_rules: {
                        ...draft.require_manager_pin_rules,
                        discount_above_pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      },
                    })
                  }
                  className="w-16 px-2 py-1 rounded border border-line bg-card text-ink font-bold text-center tabular-nums"
                />
                <span>%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Travas Estruturais Invioláveis */}
      <div className="p-3.5 rounded-xl bg-cream/70 border border-line flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-soft">
        <span className="font-black uppercase tracking-wider text-ink flex items-center gap-1">
          <span className="material-symbols-outlined text-sm text-primary">lock</span>
          Travas estruturais SMG:
        </span>
        <span>• Isolamento multi-tenant (RLS)</span>
        <span>• Estorno único no Fluxo de Caixa (ADR-045)</span>
        <span>• Antecipado ≠ atendimento concluído (ADR-017)</span>
      </div>

      {/* Resumo de diff antes de salvar */}
      {changedKeys.length > 0 && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-xs space-y-1">
          <p className="font-bold text-ink">Resumo das alterações a salvar:</p>
          <ul className="list-disc list-inside text-ink-soft space-y-0.5">
            {changedKeys.map((k) => (
              <li key={k}>{RULE_LABELS[k] || k}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback && (
        <p className={`text-xs font-bold ${feedback.type === 'success' ? 'text-success' : 'text-danger'}`}>
          {feedback.text}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
        {changedKeys.length > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setDraft(savedRules);
              setFeedback(null);
            }}
            className="px-4 py-2.5 rounded-xl border border-line bg-cream text-xs font-bold text-ink-soft hover:text-ink transition-colors"
          >
            Descartar
          </button>
        )}
        <button
          type="button"
          disabled={loading || saving || changedKeys.length === 0}
          onClick={handleSave}
          className="px-6 py-2.5 rounded-xl bg-primary text-night text-xs font-bold hover:brightness-105 transition-all disabled:opacity-40"
        >
          {saving ? 'Salvando...' : 'Salvar Regras de Negócio'}
        </button>
      </div>
    </section>
  );
};

export default BusinessRulesSection;
