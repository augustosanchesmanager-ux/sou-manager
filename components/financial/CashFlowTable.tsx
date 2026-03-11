import React from 'react';
import { Eye, Copy, Pencil, Trash2 } from 'lucide-react';
import { EnrichedCashFlowEntry } from './types';

interface CashFlowTableProps {
  entries: EnrichedCashFlowEntry[];
}

const statusStyles = {
  realizado: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
  previsto: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  vencido: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20',
};

const CashFlowTable: React.FC<CashFlowTableProps> = ({ entries }) => {
  return (
    <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px]">
          <thead className="bg-slate-50/90 dark:bg-[#101010] border-b border-slate-200 dark:border-border-dark">
            <tr>
              {['Data', 'Descricao', 'Categoria', 'Conta', 'Tipo', 'Forma de pagamento', 'Status', 'Valor', 'Saldo acumulado', 'Acoes'].map((col) => (
                <th key={col} className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 dark:text-slate-400">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50/90 dark:hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{entry.description}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.category}</td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.accountName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${
                      entry.type === 'entrada'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                    }`}
                  >
                    {entry.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{entry.paymentMethod}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 rounded-full border text-[11px] font-bold uppercase ${statusStyles[entry.status]}`}>{entry.status}</span>
                </td>
                <td
                  className={`px-4 py-3 text-sm font-bold ${
                    entry.type === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {entry.type === 'entrada' ? '+' : '-'}{' '}
                  {entry.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {entry.runningBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" title="Visualizar">
                      <Eye size={15} />
                    </button>
                    <button className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors" title="Duplicar">
                      <Copy size={15} />
                    </button>
                    <button className="p-2 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
};

export default CashFlowTable;
