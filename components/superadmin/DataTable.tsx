import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';

export interface DataColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  title: string;
  description: string;
  columns: DataColumn<T>[];
  rows: T[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyTitle: string;
  emptyDescription: string;
}

function DataTable<T>({
  title,
  description,
  columns,
  rows,
  page,
  totalPages,
  onPageChange,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  return (
    <section className="card-boutique overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-[#262A33]">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
          Pagina {page} de {totalPages}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50/90 dark:bg-white/5">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ${
                        column.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50/80 dark:hover:bg-white/5">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`px-5 py-4 align-top text-sm text-slate-700 dark:text-slate-200 ${
                          column.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-[#262A33]">
            <p className="text-xs text-slate-500 dark:text-slate-400">Use a paginacao para navegar pelos registros do recorte atual.</p>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-primary hover:text-primary disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-primary hover:text-primary disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default DataTable;
