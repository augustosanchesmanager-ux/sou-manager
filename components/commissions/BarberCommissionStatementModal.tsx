import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '../ui/Modal';
import { formatCurrency } from '../../shared/format/currency';
import { getEffectiveCommissionRate } from '../../src/lib/staff/roles';
import {
  calculateBarberStatementSummary,
  getDateRangeForStatementPeriod,
  STATEMENT_PERIOD_LABELS,
  type BarberStatementItem,
  type StatementPeriod,
} from '../../src/utils/barberStatement';
import {
  fetchStatementStaff,
  fetchBarberStatementData,
  type StatementStaffMember,
} from '../../src/modules/commissions/barberStatementService';

interface BarberCommissionStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string | null;
  userRole?: string | null;
  currentUserId?: string | null;
  currentUserEmail?: string | null;
  initialStaffId?: string | null;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const BarberCommissionStatementModal: React.FC<BarberCommissionStatementModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  userRole,
  currentUserId,
  currentUserEmail,
  initialStaffId,
}) => {
  // Staff state
  const [staffList, setStaffList] = useState<StatementStaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [staffLoading, setStaffLoading] = useState(false);

  // Period state
  const [period, setPeriod] = useState<StatementPeriod>('today');

  // Statement data state
  const [items, setItems] = useState<BarberStatementItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const isBarberOnly = userRole?.toLowerCase() === 'barber';

  // Load active staff members via service
  useEffect(() => {
    if (!isOpen || !tenantId) return;

    let isMounted = true;
    setStaffLoading(true);

    fetchStatementStaff(tenantId)
      .then((list) => {
        if (!isMounted) return;
        setStaffList(list);

        // Select default staff:
        if (initialStaffId && list.some((s) => s.id === initialStaffId)) {
          setSelectedStaffId(initialStaffId);
        } else {
          const matchingUser = list.find(
            (s) => s.id === currentUserId || (currentUserEmail && (s as any).email === currentUserEmail)
          );
          // Se o usuário logado for gestor/admin com taxa 0%, mas houver barbeiro comissionado,
          // permitir selecionar o barbeiro comissionado ou o matching
          if (matchingUser) {
            setSelectedStaffId(matchingUser.id);
          } else {
            const firstCommissioned = list.find((s) => Number(s.commission_rate || 0) > 0);
            if (firstCommissioned) {
              setSelectedStaffId(firstCommissioned.id);
            } else if (list.length > 0) {
              setSelectedStaffId(list[0].id);
            }
          }
        }
      })
      .finally(() => {
        if (isMounted) setStaffLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, tenantId, initialStaffId, currentUserId, currentUserEmail]);

  // Selected staff object
  const currentStaff = useMemo(() => {
    return staffList.find((s) => s.id === selectedStaffId) || null;
  }, [staffList, selectedStaffId]);

  // Effective commission percentage (e.g. 50%)
  const staffCommissionPercentage = useMemo(() => {
    if (!currentStaff) return 0;
    const rateNormalized = getEffectiveCommissionRate(currentStaff);
    return Math.round(rateNormalized * 1000) / 10; // e.g. 50
  }, [currentStaff]);

  // Fetch statement data via service
  const loadStatementData = useCallback(async () => {
    if (!tenantId || !selectedStaffId) {
      setItems([]);
      return;
    }

    setDataLoading(true);
    try {
      const { startDate, endDate } = getDateRangeForStatementPeriod(period);
      const statementItems = await fetchBarberStatementData({
        tenantId,
        staffId: selectedStaffId,
        startDate,
        endDate,
        commissionPercentage: staffCommissionPercentage,
      });
      setItems(statementItems);
    } catch (err) {
      console.error('Erro ao calcular extrato do barbeiro:', err);
      setItems([]);
    } finally {
      setDataLoading(false);
    }
  }, [tenantId, selectedStaffId, period, staffCommissionPercentage]);

  useEffect(() => {
    if (isOpen && selectedStaffId) {
      void loadStatementData();
    }
  }, [isOpen, selectedStaffId, period, loadStatementData]);

  // Compute 360 statement summary
  const summary = useMemo(() => {
    return calculateBarberStatementSummary(items);
  }, [items]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Extrato de Comissões & Produtividade"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Controls: Staff selector & Period Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
          {/* Staff selection or badge */}
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-white/10 shrink-0">
              {currentStaff?.avatar ? (
                <img src={currentStaff.avatar} alt={currentStaff.name} className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-slate-400">
                  <span className="material-symbols-outlined text-2xl">person</span>
                </div>
              )}
            </div>

            <div>
              {!isBarberOnly && staffList.length > 1 ? (
                <div>
                  <label htmlFor="statement-staff-select" className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Profissional
                  </label>
                  <select
                    id="statement-staff-select"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role}) {Number(s.commission_rate || 0) > 0 ? `• ${s.commission_rate}%` : '• Fixo'}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {currentStaff?.name || 'Profissional'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Taxa de comissão: <strong className="text-primary">{staffCommissionPercentage}%</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Period selector tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/5">
            {(['today', 'yesterday', 'week', 'month'] as StatementPeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {STATEMENT_PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* 4 KPI Cards (Opção 2-A: Produção Bruta + Opção 3-A: Confirmada vs Prevista) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Comissão Confirmada */}
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Confirmada
              </span>
              <span className="material-symbols-outlined text-lg text-emerald-600 dark:text-emerald-400">
                check_circle
              </span>
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
              {formatCurrency(summary.confirmedCommission)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {staffCommissionPercentage > 0 ? 'Comandas liquidadas no caixa' : 'Remuneração fixa / gestor'}
            </p>
          </div>

          {/* Card 2: Comissão a Liberar / Prevista */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                A Liberar
              </span>
              <span className="material-symbols-outlined text-lg text-amber-600 dark:text-amber-400">
                pending
              </span>
            </div>
            <p className="text-xl font-black text-amber-600 dark:text-amber-400 leading-none">
              {formatCurrency(summary.pendingCommission)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {staffCommissionPercentage > 0 ? 'Comandas abertas no balcão' : 'Sem comissão percentual'}
            </p>
          </div>

          {/* Card 3: Produção Bruta */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Produção Bruta
              </span>
              <span className="material-symbols-outlined text-lg text-slate-400">
                payments
              </span>
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
              {formatCurrency(summary.grossProduction)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Faturamento bruto gerado
            </p>
          </div>

          {/* Card 4: Atendimentos & Ticket Médio */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Atendimentos
              </span>
              <span className="material-symbols-outlined text-lg text-primary">
                analytics
              </span>
            </div>
            <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
              {summary.totalComandas}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Ticket Médio: <strong className="text-slate-800 dark:text-white">{formatCurrency(summary.averageTicket)}</strong>
            </p>
          </div>
        </div>

        {/* Detailed Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">format_list_bulleted</span>
              Detalhamento de Atendimentos ({items.length})
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Total Acumulado: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.totalCommission)}</strong>
            </span>
          </div>

          {dataLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
              Carregando atendimentos e apurando comissões...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
              <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl mb-1">
                receipt_long
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum atendimento registrado para este profissional no período ({STATEMENT_PERIOD_LABELS[period]}).
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase text-slate-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Horário</th>
                    <th className="px-4 py-2.5">Cliente</th>
                    <th className="px-4 py-2.5">Serviço / Item</th>
                    <th className="px-4 py-2.5 text-right">Valor Item</th>
                    <th className="px-4 py-2.5 text-right">Comissão</th>
                    <th className="px-4 py-2.5 text-center">Status Caixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(it.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {it.clientName}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {it.itemName}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(it.grossValue)}
                      </td>
                      <td className="px-4 py-3 text-right font-black whitespace-nowrap">
                        <span className={it.isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {staffCommissionPercentage > 0 ? formatCurrency(it.commissionValue) : '—'}
                        </span>
                        <span className="text-[10px] font-normal text-slate-400 ml-1">
                          {staffCommissionPercentage > 0 ? `(${it.commissionRate}%)` : '(Fixo)'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {it.isPaid || it.comandaStatus === 'paid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="size-1.5 rounded-full bg-current" />
                            Pago
                          </span>
                        ) : it.comandaStatus === 'open' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <span className="size-1.5 rounded-full bg-current" />
                            Em Aberto
                          </span>
                        ) : it.comandaStatus === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            <span className="size-1.5 rounded-full bg-current" />
                            Atendido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                            <span className="size-1.5 rounded-full bg-current" />
                            Agendado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info & close */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
          <p className="text-[11px] text-slate-400">
            * Comissões apuradas conforme taxa padrão cadastrada no perfil do profissional.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default BarberCommissionStatementModal;
