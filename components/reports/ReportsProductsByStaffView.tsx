import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Send, Trophy } from 'lucide-react';
import type { ProductSalesByStaffRow } from '../../src/modules/reports/reportsDataService';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const ROLE_LABELS: Record<string, string> = {
  barber: 'Barbeiro',
  receptionist: 'Recepção',
  manager: 'Gerente',
  owner: 'Proprietário',
  admin: 'Admin',
};

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  biweekly: 'Quinzenal',
  weekly: 'Semanal',
};

interface ReportsProductsByStaffViewProps {
  rows: ProductSalesByStaffRow[];
  loading: boolean;
  onSendBonusToPayroll?: (row: ProductSalesByStaffRow) => void;
}

export const ReportsProductsByStaffView: React.FC<ReportsProductsByStaffViewProps> = ({
  rows,
  loading,
  onSendBonusToPayroll,
}) => {
  const [roleFilter, setRoleFilter] = useState<'all' | 'barber' | 'receptionist'>('all');
  const [search, setSearch] = useState('');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (roleFilter === 'barber' && row.staffRole !== 'barber') return false;
      if (roleFilter === 'receptionist' && row.staffRole !== 'receptionist') return false;
      if (q && !row.staffName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, roleFilter, search]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => ({
        sold: acc.sold + r.appliedTotal,
        commission: acc.commission + r.standardCommission,
        bonus: acc.bonus + r.goalEvaluation.bonusAmount,
      }),
      { sold: 0, commission: 0, bonus: 0 }
    );
  }, [filteredRows]);

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Venda de Produtos por Profissional &amp; Metas
          </h3>
          <p className="text-xs text-ink-soft mt-0.5">
            Vendas atribuídas por item na comanda · Total vendido: {fmtBRL(totals.sold)} · Comissões: {fmtBRL(totals.commission)} · Bonificações: {fmtBRL(totals.bonus)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-cream border border-line p-0.5 text-xs">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'barber', label: 'Barbeiros' },
                { id: 'receptionist', label: 'Recepção' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRoleFilter(opt.id)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  roleFilter === opt.id
                    ? 'bg-primary text-night'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink-soft absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-cream border border-line text-xs text-ink placeholder:text-ink-soft outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-ink-soft">
          Carregando vendas por profissional...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-8 text-center text-xs text-ink-soft">
          Nenhuma venda de produto ou meta encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-cream text-[10px] uppercase tracking-wider text-primary-dark dark:text-primary">
                <th className="py-3 px-4 font-semibold">Profissional</th>
                <th className="py-3 px-4 font-semibold text-right">Qtd</th>
                <th className="py-3 px-4 font-semibold text-right">Vl. Aplicado</th>
                <th className="py-3 px-4 font-semibold text-right">Comissão Padrão</th>
                <th className="py-3 px-4 font-semibold">Progresso da Meta</th>
                <th className="py-3 px-4 font-semibold text-right">Bonificação</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 text-xs text-ink">
              {filteredRows.map((row) => {
                const isExpanded = expandedStaffId === row.staffId;
                const evalRes = row.goalEvaluation;
                const clampedPct = Math.min(100, Math.max(0, evalRes.progressPct));

                return (
                  <React.Fragment key={row.staffId}>
                    <tr className="hover:bg-cream/80 dark:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStaffId(isExpanded ? null : row.staffId)
                            }
                            className="p-0.5 text-ink-soft hover:text-primary-dark dark:text-primary"
                            title="Detalhar produtos vendidos"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <div>
                            <div className="font-semibold text-ink">
                              {row.staffName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream border border-line text-ink">
                                {ROLE_LABELS[row.staffRole] || row.staffRole}
                              </span>
                              {row.goalTemplateName && (
                                <span className="text-[10px] text-ink-soft">
                                  {row.goalTemplateName}
                                  {row.goalPeriodType
                                    ? ` · ${PERIOD_LABELS[row.goalPeriodType] || row.goalPeriodType}`
                                    : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-semibold">
                        {row.quantitySold}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-ink">
                        {fmtBRL(row.appliedTotal)}
                      </td>

                      <td className="py-3 px-4 text-right text-ink">
                        {row.standardCommission > 0 ? fmtBRL(row.standardCommission) : '-'}
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        {evalRes.hasGoal ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 font-semibold text-amber-300">
                                {evalRes.achievedTier ? (
                                  <>
                                    <Trophy className="w-3 h-3 text-primary-dark dark:text-primary" />
                                    {evalRes.achievedTier.label}
                                  </>
                                ) : (
                                  <span className="text-ink-soft">Em andamento</span>
                                )}
                              </span>
                              <span className="text-ink-soft">{evalRes.progressPct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-cream overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${clampedPct}%` }}
                              />
                            </div>
                            {evalRes.nextTier ? (
                              <p className="text-[10px] text-ink-soft">
                                Faltam {fmtBRL(evalRes.missingToNextTier)} para {evalRes.nextTier.label}
                              </p>
                            ) : evalRes.achievedTier ? (
                              <p className="text-[10px] text-emerald-400">
                                Faixa máxima atingida
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[11px] text-ink-soft">Sem meta definida</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {evalRes.bonusAmount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                            {fmtBRL(evalRes.bonusAmount)}
                          </span>
                        ) : (
                          <span className="text-ink-soft">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {evalRes.bonusAmount > 0 && onSendBonusToPayroll ? (
                          <button
                            type="button"
                            onClick={() => onSendBonusToPayroll(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary-dark dark:text-primary hover:bg-primary hover:text-[#0E0C0A] text-[11px] font-bold transition-colors"
                            title="Sugerir bonificação na Folha de Pagamento (exige confirmação)"
                          >
                            <Send className="w-3 h-3" />
                            Lançar na Folha
                          </button>
                        ) : (
                          <span className="text-[11px] text-ink-soft">-</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-cream/70">
                        <td colSpan={7} className="px-8 py-3">
                          {row.productsBreakdown.length === 0 ? (
                            <p className="text-xs text-ink-soft">
                              Nenhum produto vendido no período selecionado.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                                Produtos vendidos por {row.staffName}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {row.productsBreakdown.map((item) => (
                                  <div
                                    key={item.productName}
                                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-card border border-line text-xs"
                                  >
                                    <div>
                                      <span className="font-medium text-ink">
                                        {item.productName}
                                      </span>
                                      <span className="block text-[10px] text-ink-soft">
                                        {item.quantitySold} un
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-semibold text-ink">
                                        {fmtBRL(item.appliedTotal)}
                                      </span>
                                      {item.standardCommission > 0 && (
                                        <span className="block text-[10px] text-ink-soft">
                                          Com.: {fmtBRL(item.standardCommission)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
