import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Star,
  ShieldAlert,
  CheckCircle2,
  Users,
  MessageCircle,
  Sparkles,
  RefreshCw,
  Crown,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../shared/format/currency';
import { getRoleLabelPtBr } from './public/feedback/feedbackService';
import {
  fetchQualityDashboardMetrics,
  resolveTenantReview,
  VIP_LTV_THRESHOLD,
  type QualityDashboardMetrics,
  type RecoveryInboxItem,
} from '../lib/reviews/qualityService';

const QualityDashboard: React.FC = () => {
  const { tenantId, tenantSlug, tenant } = useAuth();
  const [days, setDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<QualityDashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const effectiveSlug = tenantSlug || tenant?.slug || 'sua-barbearia';
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '')
      : 'https://barber.soumanager.com';
  const publicFeedbackUrl = `${baseUrl}/#/feedback/${effectiveSlug}`;

  const loadMetrics = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQualityDashboardMetrics(tenantId, days);
      setMetrics(data);
      const initialDrafts: Record<string, string> = {};
      for (const item of data.recovery_inbox) {
        initialDrafts[item.id] = item.resolution_note || '';
      }
      setNotesDraft(initialDrafts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o painel de qualidade. Verifique se a migration foi aplicada.',
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, days]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const handleCopyFeedbackLink = async () => {
    try {
      await navigator.clipboard.writeText(publicFeedbackUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleResolve = async (item: RecoveryInboxItem) => {
    setResolvingId(item.id);
    try {
      const note = notesDraft[item.id] ?? item.resolution_note ?? '';
      await resolveTenantReview(item.id, note, 'resolved');
      await loadMetrics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resolver avaliação.');
    } finally {
      setResolvingId(null);
    }
  };

  const buildWhatsAppRecoveryHref = (item: RecoveryInboxItem): string | null => {
    const digits = (item.client_phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    const msg = `Olá ${item.client_name}, aqui é da gestão da ${tenant?.name || 'Barbearia'}. Vimos sua avaliação de ${item.rating} estrela(s) e queremos entender como podemos melhorar sua experiência.`;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
  };

  const summary = metrics?.summary ?? {
    total_reviews: 0,
    avg_rating: 0,
    promoters_count: 0,
    detractors_count: 0,
    pending_recovery_count: 0,
    resolved_count: 0,
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-border-dark pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B88A44]/15 text-[#B88A44] text-[10px] font-black uppercase tracking-widest mb-2 border border-[#B88A44]/30">
            <Sparkles className="w-3 h-3" />
            Inteligência Operacional · CRM & Churn Recovery
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Central de Qualidade, Retenção & Equipe
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhe a nota do estabelecimento, o desempenho individual de toda a equipe (recepção, gerência e barbeiros) e recupere clientes insatisfeitos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Período de análise"
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Últimos 12 meses</option>
          </select>

          <button
            type="button"
            onClick={() => void handleCopyFeedbackLink()}
            className="px-3.5 py-2 rounded-xl bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link de Avaliação'}</span>
          </button>

          <a
            href={publicFeedbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 hover:border-[#B88A44]"
            title="Abrir funil público de avaliação"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            type="button"
            onClick={() => void loadMetrics()}
            className="p-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 hover:border-[#B88A44] cursor-pointer"
            title="Atualizar métricas"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Executive KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Nota Média Geral
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {summary.avg_rating.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-[#B88A44]">★ ({summary.total_reviews})</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Promotores (4–5★)
          </span>
          <div className="text-3xl font-black text-emerald-500">{summary.promoters_count}</div>
          <p className="text-[11px] text-slate-400">Direcionados para prova social no Google</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Atritos Pendentes (≤ 3★)
          </span>
          <div className="text-3xl font-black text-amber-500">{summary.pending_recovery_count}</div>
          <p className="text-[11px] text-slate-400">Aguardando contato da gerência</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Crises Convertidas
          </span>
          <div className="text-3xl font-black text-[#B88A44]">{summary.resolved_count}</div>
          <p className="text-[11px] text-slate-400">Documentadas no playbook de retenção</p>
        </div>
      </section>

      {/* Desempenho Individual de Todos os Colaboradores do Tenant */}
      <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-[#B88A44]" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Desempenho por Colaborador (Toda a Equipe)
            </h2>
            <p className="text-xs text-slate-500">
              Avaliação individual de Barbeiros, Recepcionistas e Gerentes Operacionais cadastrados na unidade.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-border-dark text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-3 pr-4">Colaborador</th>
                <th className="py-3 px-4">Função / Cargo</th>
                <th className="py-3 px-4">Avaliações</th>
                <th className="py-3 px-4">Nota Média</th>
                <th className="py-3 px-4">Promotores</th>
                <th className="py-3 px-4">Atritos (≤3★)</th>
                <th className="py-3 pl-4 text-right">Taxa de Aprovação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-border-dark">
              {(metrics?.staff_performance ?? []).map((staff) => (
                <tr key={staff.staff_id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                  <td className="py-3.5 pr-4 font-bold text-slate-900 dark:text-white">
                    {staff.staff_name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#B88A44]/15 text-[#B88A44] font-bold text-[11px]">
                      {getRoleLabelPtBr(staff.role)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                    {staff.reviews_count}
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                    {Number(staff.avg_rating || 0).toFixed(2)} ★
                  </td>
                  <td className="py-3.5 px-4 text-emerald-500 font-bold">
                    {staff.promoters_count}
                  </td>
                  <td className="py-3.5 px-4 text-amber-500 font-bold">
                    {staff.detractors_count}
                  </td>
                  <td className="py-3.5 pl-4 text-right font-black text-slate-900 dark:text-white">
                    {Number(staff.retention_rate ?? 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
              {!loading && (metrics?.staff_performance ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Nenhum colaborador encontrado para este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inbox de Recuperação (Churn Recovery + Playbook) */}
      <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Inbox de Recuperação de Clientes (Churn Recovery)
            </h2>
            <p className="text-xs text-slate-500">
              Acione clientes detratores via WhatsApp e registre a nota de resolução (Playbook) para orientar os próximos atendimentos.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(metrics?.recovery_inbox ?? []).map((item) => {
            const whatsappHref = buildWhatsAppRecoveryHref(item);
            const isVip = Number(item.client_ltv || 0) > VIP_LTV_THRESHOLD;
            const isResolved = item.status === 'resolved';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  isResolved
                    ? 'bg-slate-50/50 dark:bg-surface-dark/40 border-slate-200 dark:border-border-dark'
                    : 'bg-amber-500/5 border-amber-500/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs">
                      {item.rating} ★
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {item.client_name}
                    </span>
                    {isVip && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#B88A44] text-neutral-950 font-black text-[10px] uppercase">
                        <Crown className="w-3 h-3" />
                        VIP · LTV {formatCurrency(item.client_ltv)}
                      </span>
                    )}
                    {item.staff_name ? (
                      <span className="text-xs text-slate-400">
                        · Avaliado: <strong className="text-slate-200">{item.staff_name}</strong> (
                        {getRoleLabelPtBr(item.staff_role)})
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">· Avaliação do Estabelecimento</span>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      isResolved
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {isResolved ? 'Resolvido' : 'Pendente'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-black/30 p-3 rounded-xl border border-slate-200/60 dark:border-border-dark">
                  {item.comment || 'Cliente registrou nota baixa sem comentário em texto.'}
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="text"
                    value={notesDraft[item.id] ?? ''}
                    onChange={(e) =>
                      setNotesDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Playbook: descreva como o caso foi resolvido (aparecerá no próximo check-in do cliente)..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-xs text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Acionar WhatsApp</span>
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={resolvingId === item.id}
                      onClick={() => void handleResolve(item)}
                      className="px-4 py-2.5 rounded-xl bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {resolvingId === item.id
                          ? 'Salvando...'
                          : isResolved
                            ? 'Atualizar Playbook'
                            : 'Marcar Resolvido'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && (metrics?.recovery_inbox ?? []).length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhum atrito pendente! Todas as avaliações recentes estão positivas.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default QualityDashboard;
