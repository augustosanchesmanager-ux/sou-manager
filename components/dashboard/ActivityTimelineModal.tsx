import React, { useState, useEffect } from 'react';
import { logger, type LogEntry } from '../../src/lib/observability/logger';

interface ActivityTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, { icon: string; tone: string; label: string }> = {
  transaction: { icon: 'point_of_sale', tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: 'Financeiro' },
  financial: { icon: 'account_balance_wallet', tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', label: 'Caixa' },
  lifecycle: { icon: 'calendar_today', tone: 'text-primary bg-primary/10 border-primary/20', label: 'Agenda / Clientes' },
  auth: { icon: 'key', tone: 'text-amber-500 bg-amber-500/10 border-amber-500/20', label: 'Acesso' },
  system: { icon: 'terminal', tone: 'text-ink-soft bg-card-dark border-border-dark', label: 'Sistema' },
  subscription: { icon: 'card_membership', tone: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Clube' },
};

const formatTimeDetailed = (isoDate: string): string => {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
};

const formatFriendlyEvent = (event: string): string => {
  const map: Record<string, string> = {
    checkout_started: 'Iniciou comanda / PDV',
    checkout_completed: 'Concluiu pagamento de comanda',
    cash_closing_opened: 'Abriu caixa do dia',
    cash_closing_settled: 'Fechou caixa do dia',
    appointment_created: 'Novo agendamento realizado',
    appointment_status_changed: 'Status de agendamento alterado',
    page_viewed: 'Navegação no sistema',
    user_login: 'Login efetuado no sistema',
  };
  return map[event] || event.replace(/_/g, ' ');
};

export const ActivityTimelineModal: React.FC<ActivityTimelineModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;

    const fetchLogs = () => {
      const all = logger.getLogs();
      setLogs([...all].reverse().slice(0, 40));
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter((l) => l.category === filter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night/70 backdrop-blur-xs animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-timeline-title"
        className="relative flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark shadow-2xl transition-all overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line dark:border-border-dark shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-xl">history</span>
            </div>
            <div>
              <h3 id="activity-timeline-title" className="font-display text-base font-bold text-ink dark:text-white">
                Registro de Atividades no Sistema
              </h3>
              <p className="text-xs text-ink-soft">
                Histórico em tempo real das suas ações e operações nesta sessão
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-gold-pale dark:hover:bg-surface-dark transition-colors"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Filtros de Categoria */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-line dark:border-border-dark bg-gold-pale/50 dark:bg-surface-dark/40 shrink-0 overflow-x-auto">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'transaction', label: 'Comandas & PDV' },
            { id: 'lifecycle', label: 'Agenda & Atendimentos' },
            { id: 'financial', label: 'Fluxo de Caixa' },
            { id: 'auth', label: 'Sessão' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilter(cat.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all whitespace-nowrap ${
                filter === cat.id
                  ? 'bg-primary text-night shadow-xs'
                  : 'text-ink-soft hover:text-ink dark:hover:text-white hover:bg-gold-pale dark:hover:bg-card-dark'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Lista Timeline */}
        <div className="flex-1 overflow-y-auto p-5 divide-y divide-line dark:divide-border-dark">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-3xl text-ink-soft">hourglass_empty</span>
              <p className="mt-2 text-xs font-semibold text-ink-soft">
                Nenhuma atividade recente registrada nesta categoria.
              </p>
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const catSpec = CATEGORY_ICONS[entry.category] || CATEGORY_ICONS.system;
              return (
                <div key={entry.id} className="py-3 flex items-start gap-3.5 first:pt-0 last:pb-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm ${catSpec.tone}`}>
                    <span className="material-symbols-outlined text-base">{catSpec.icon}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-xs capitalize text-ink dark:text-white truncate">
                        {formatFriendlyEvent(entry.event)}
                      </p>
                      <span className="text-[10px] font-mono tabular-nums text-ink-soft shrink-0">
                        {formatTimeDetailed(entry.timestamp)}
                      </span>
                    </div>

                    <p className="text-[11px] text-ink-soft mt-0.5 line-clamp-1">
                      {entry.message}
                    </p>

                    {entry.data && Object.keys(entry.data).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {Object.entries(entry.data).slice(0, 3).map(([k, v]) => (
                          <span
                            key={k}
                            className="inline-flex items-center rounded-md border border-line dark:border-border-dark bg-card dark:bg-surface-dark px-1.5 py-0.5 text-[9px] font-medium text-ink-soft font-mono"
                          >
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-line dark:border-border-dark bg-gold-pale/30 dark:bg-surface-dark/20 shrink-0">
          <span className="text-[10px] text-ink-soft">
            Exibindo os últimos {filteredLogs.length} eventos em memória
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line dark:border-border-dark px-4 py-1.5 text-xs font-semibold text-ink-soft hover:bg-gold-pale dark:hover:bg-card-dark transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityTimelineModal;
