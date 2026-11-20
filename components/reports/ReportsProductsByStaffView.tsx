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
    <div className="bg-[#141210] border border-[#2D2A26] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2D2A26] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#F5F5F0]">
            Venda de Produtos por Profissional &amp; Metas
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Vendas atribuídas por item na comanda · Total vendido: {fmtBRL(totals.sold)} · Comissões: {fmtBRL(totals.commission)} · Bonificações: {fmtBRL(totals.bonus)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-[#0E0C0A] border border-[#2D2A26] p-0.5 text-xs">
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
                    ? 'bg-[#B88A44] text-[#0E0C0A]'
                    : 'text-stone-400 hover:text-[#F5F5F0]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0E0C0A] border border-[#2D2A26] text-xs text-[#F5F5F0] placeholder:text-stone-500 outline-none focus:border-[#B88A44]"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-stone-400">
          Carregando vendas por profissional...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-8 text-center text-xs text-stone-400">
          Nenhuma venda de produto ou meta encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2D2A26] bg-[#0E0C0A] text-[10px] uppercase tracking-wider text-[#B88A44]">
                <th className="py-3 px-4 font-semibold">Profissional</th>
                <th className="py-3 px-4 font-semibold text-right">Qtd</th>
                <th className="py-3 px-4 font-semibold text-right">Vl. Aplicado</th>
                <th className="py-3 px-4 font-semibold text-right">Comissão Padrão</th>
                <th className="py-3 px-4 font-semibold">Progresso da Meta</th>
                <th className="py-3 px-4 font-semibold text-right">Bonificação</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D2A26]/60 text-xs text-[#F5F5F0]">
              {filteredRows.map((row) => {
                const isExpanded = expandedStaffId === row.staffId;
                const evalRes = row.goalEvaluation;
                const clampedPct = Math.min(100, Math.max(0, evalRes.progressPct));

                return (
                  <React.Fragment key={row.staffId}>
                    <tr className="hover:bg-[#1C1916] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedStaffId(isExpanded ? null : row.staffId)
                            }
                            className="p-0.5 text-stone-400 hover:text-[#B88A44]"
                            title="Detalhar produtos vendidos"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                          <div>
                            <div className="font-semibold text-[#F5F5F0]">
                              {row.staffName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0E0C0A] border border-[#2D2A26] text-stone-300">
                                {ROLE_LABELS[row.staffRole] || row.staffRole}
                              </span>
                              {row.goalTemplateName && (
                                <span className="text-[10px] text-stone-400">
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

                      <td className="py-3 px-4 text-right font-semibold text-[#F5F5F0]">
                        {fmtBRL(row.appliedTotal)}
                      </td>

                      <td className="py-3 px-4 text-right text-stone-300">
                        {row.standardCommission > 0 ? fmtBRL(row.standardCommission) : '-'}
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        {evalRes.hasGoal ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1 font-semibold text-amber-300">
                                {evalRes.achievedTier ? (
                                  <>
                                    <Trophy className="w-3 h-3 text-[#B88A44]" />
                                    {evalRes.achievedTier.label}
                                  </>
                                ) : (
                                  <span className="text-stone-400">Em andamento</span>
                                )}
                              </span>
                              <span className="text-stone-400">{evalRes.progressPct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-[#0E0C0A] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#B88A44] transition-all"
                                style={{ width: `${clampedPct}%` }}
                              />
                            </div>
                            {evalRes.nextTier ? (
                              <p className="text-[10px] text-stone-400">
                                Faltam {fmtBRL(evalRes.missingToNextTier)} para {evalRes.nextTier.label}
                              </p>
                            ) : evalRes.achievedTier ? (
                              <p className="text-[10px] text-emerald-400">
                                Faixa máxima atingida
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-500">Sem meta definida</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {evalRes.bonusAmount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                            {fmtBRL(evalRes.bonusAmount)}
                          </span>
                        ) : (
                          <span className="text-stone-500">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {evalRes.bonusAmount > 0 && onSendBonusToPayroll ? (
                          <button
                            type="button"
                            onClick={() => onSendBonusToPayroll(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#B88A44]/15 text-[#B88A44] hover:bg-[#B88A44] hover:text-[#0E0C0A] text-[11px] font-bold transition-colors"
                            title="Sugerir bonificação na Folha de Pagamento (exige confirmação)"
                          >
                            <Send className="w-3 h-3" />
                            Lançar na Folha
                          </button>
                        ) : (
                          <span className="text-[11px] text-stone-500">-</span>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#0E0C0A]/70">
                        <td colSpan={7} className="px-8 py-3">
                          {row.productsBreakdown.length === 0 ? (
                            <p className="text-xs text-stone-400">
                              Nenhum produto vendido no período selecionado.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                                Produtos vendidos por {row.staffName}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {row.productsBreakdown.map((item) => (
                                  <div
                                    key={item.productName}
                                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#141210] border border-[#2D2A26] text-xs"
                                  >
                                    <div>
                                      <span className="font-medium text-[#F5F5F0]">
                                        {item.productName}
                                      </span>
                                      <span className="block text-[10px] text-stone-400">
                                        {item.quantitySold} un
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-semibold text-[#F5F5F0]">
                                        {fmtBRL(item.appliedTotal)}
                                      </span>
                                      {item.standardCommission > 0 && (
                                        <span className="block text-[10px] text-stone-400">
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
