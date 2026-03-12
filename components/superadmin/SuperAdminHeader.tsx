import React from 'react';
import { Download, RefreshCcw, Search, ShieldEllipsis, Sparkles } from 'lucide-react';
import Button from '../ui/Button';

interface SuperAdminHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  onRefresh: () => void;
  onOpenActionMenu: () => void;
  lastUpdatedLabel: string;
}

const SuperAdminHeader: React.FC<SuperAdminHeaderProps> = ({
  search,
  onSearchChange,
  onExport,
  onRefresh,
  onOpenActionMenu,
  lastUpdatedLabel,
}) => (
  <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(229,161,88,0.18),_transparent_32%),linear-gradient(135deg,#ffffff_0%,#fbf8f2_100%)] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-[#262A33] dark:bg-[radial-gradient(circle_at_top_left,_rgba(198,164,90,0.22),_transparent_28%),linear-gradient(135deg,#141519_0%,#0f1014_100%)]">
    <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
    <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-primary">
          <ShieldEllipsis className="h-3.5 w-3.5" />
          Area restrita master
        </div>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 dark:text-white display-font">
          Administracao Geral
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Controle total da plataforma, usuarios, assinaturas e movimentacoes com foco em seguranca, rastreabilidade e operacao em escala.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">
          <Sparkles className="h-3.5 w-3.5" />
          Ultima atualizacao: {lastUpdatedLabel}
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 xl:max-w-[34rem]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            type="text"
            placeholder="Buscar por empresa, usuario, tenant, evento, IP ou assinatura"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-[#262A33] dark:bg-white/5 dark:text-slate-100"
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" size="md" className="rounded-xl" onClick={onExport}>
            <Download className="h-4 w-4" />
            Exportar relatorio
          </Button>
          <Button variant="secondary" size="md" className="rounded-xl" onClick={onRefresh}>
            <RefreshCcw className="h-4 w-4" />
            Atualizar dados
          </Button>
          <Button variant="primary" size="md" className="rounded-xl" onClick={onOpenActionMenu}>
            <ShieldEllipsis className="h-4 w-4" />
            Nova acao administrativa
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default SuperAdminHeader;
