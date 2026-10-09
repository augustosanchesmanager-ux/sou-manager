import React from 'react';

export interface PublishServiceSummary {
  name: string;
  price: number;
  duration: number;
}

export interface PublishBusinessHour {
  label: string;
  open: string;
  close: string;
}

export interface PublishSummary {
  shopName: string;
  publicLink: string;
  phone: string;
  address: string;
  chairCount: number;
  timezone: string;
  services: PublishServiceSummary[];
  businessHours: PublishBusinessHour[];
}

export type PublishVisibility = 'public' | 'draft';

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface PublishStepProps {
  summary: PublishSummary;
  tenantStatus: string | null;
  visibility: PublishVisibility;
  onVisibilityChange: (visibility: PublishVisibility) => void;
  onPublish: () => void;
  onSaveDraft: () => void;
  loading: boolean;
  error: string | null;
}

/**
 * Passo 3 — "Publicação".
 * Resumo do cadastro + escolha de visibilidade (Público / Rascunho).
 */
const PublishStep: React.FC<PublishStepProps> = ({
  summary,
  tenantStatus,
  visibility,
  onVisibilityChange,
  onPublish,
  onSaveDraft,
  loading,
  error,
}) => {
  const isDraft = tenantStatus === 'draft';

  return (
    <div className="space-y-5">
      {isDraft && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-amber-500 text-lg">edit_note</span>
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Rascunho</span>
        </div>
      )}

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-border-dark">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Resumo do cadastro</h2>
          <p className="text-xs text-slate-400">Confira os dados antes de publicar.</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-border-dark">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-slate-400">Barbearia</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{summary.shopName}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-slate-400">Link público</span>
            <span className="text-xs font-medium text-primary truncate max-w-[55%]">{summary.publicLink}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-slate-400">Telefone</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{summary.phone || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-slate-400">Endereço</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white text-right">{summary.address || '—'}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-slate-400">Cadeiras</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{summary.chairCount}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-slate-400">Fuso horário</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{summary.timezone}</span>
          </div>
          <div className="px-5 py-3">
            <span className="text-xs text-slate-400">Horário de funcionamento</span>
            <div className="mt-2 space-y-1">
              {summary.businessHours.map((hour) => (
                <div key={hour.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{hour.label}</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {hour.open} às {hour.close}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-3">
            <span className="text-xs text-slate-400">Serviços</span>
            <div className="mt-2 space-y-1">
              {summary.services.map((service) => (
                <div key={service.name} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {service.name} · {service.duration} min
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatBRL(service.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Visibilidade</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onVisibilityChange('public')}
            className={`text-left rounded-2xl border p-4 transition-all ${
              visibility === 'public'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`size-4 rounded-full border-2 flex items-center justify-center ${
                  visibility === 'public' ? 'border-primary' : 'border-slate-300 dark:border-white/20'
                }`}
              >
                {visibility === 'public' && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Público</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Seu link fica disponível para clientes agendarem.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onVisibilityChange('draft')}
            className={`text-left rounded-2xl border p-4 transition-all ${
              visibility === 'draft'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark hover:border-slate-300 dark:hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`size-4 rounded-full border-2 flex items-center justify-center ${
                  visibility === 'draft' ? 'border-primary' : 'border-slate-300 dark:border-white/20'
                }`}
              >
                {visibility === 'draft' && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">Rascunho</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Publicar depois. Visível apenas para você.
            </p>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={visibility === 'public' ? onPublish : onSaveDraft}
          disabled={loading}
          className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : visibility === 'public' ? 'Publicar agora' : 'Salvar rascunho'}
          {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
        </button>
        <button
          type="button"
          onClick={visibility === 'public' ? onSaveDraft : onPublish}
          disabled={loading}
          className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all disabled:opacity-50"
        >
          {loading ? 'Salvando...' : visibility === 'public' ? 'Salvar rascunho' : 'Publicar agora'}
        </button>
      </div>
    </div>
  );
};

export default PublishStep;