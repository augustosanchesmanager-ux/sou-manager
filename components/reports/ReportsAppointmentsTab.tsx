import React, { useMemo } from 'react';
import { Calendar, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { AppointmentReportRow } from '../../src/modules/reports/reportsDataService';

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

export type AppointmentStatusFilter = 'all' | 'completed' | 'scheduled' | 'cancelled' | 'no_show';

interface ReportsAppointmentsTabProps {
  appointments: AppointmentReportRow[];
  loading: boolean;
  selectedStaff: string;
  onSelectStaff: (staff: string) => void;
  selectedStatus: AppointmentStatusFilter;
  onSelectStatus: (status: AppointmentStatusFilter) => void;
  availableStaff: string[];
}

export const ReportsAppointmentsTab: React.FC<ReportsAppointmentsTabProps> = ({
  appointments,
  loading,
  selectedStaff,
  onSelectStaff,
  selectedStatus,
  onSelectStatus,
  availableStaff,
}) => {
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (selectedStaff !== 'all' && a.staffName !== selectedStaff) return false;
      if (selectedStatus !== 'all' && a.statusCategory !== selectedStatus) return false;
      return true;
    });
  }, [appointments, selectedStaff, selectedStatus]);

  const metrics = useMemo(() => {
    const total = filteredAppointments.length;
    const completed = filteredAppointments.filter((a) => a.statusCategory === 'completed');
    const cancelledAndNoShow = filteredAppointments.filter(
      (a) => a.statusCategory === 'cancelled' || a.statusCategory === 'no_show'
    );

    const completionRate = total > 0 ? Math.round((completed.length / total) * 1000) / 10 : 0;
    const gapRate = total > 0 ? Math.round((cancelledAndNoShow.length / total) * 1000) / 10 : 0;

    const totalMinutesCompleted = completed.reduce((acc, a) => acc + a.durationMinutes, 0);
    const hours = Math.floor(totalMinutesCompleted / 60);
    const mins = totalMinutesCompleted % 60;
    const hoursFormatted = `${hours}h ${String(mins).padStart(2, '0')}m`;

    return {
      total,
      completedCount: completed.length,
      completionRate,
      gapsCount: cancelledAndNoShow.length,
      gapRate,
      hoursFormatted,
    };
  }, [filteredAppointments]);

  const staffSummary = useMemo(() => {
    const map = new Map<
      string,
      { staffName: string; total: number; completed: number; gaps: number; minutes: number }
    >();

    for (const a of filteredAppointments) {
      const existing = map.get(a.staffName) || {
        staffName: a.staffName,
        total: 0,
        completed: 0,
        gaps: 0,
        minutes: 0,
      };
      existing.total += 1;
      if (a.statusCategory === 'completed') {
        existing.completed += 1;
        existing.minutes += a.durationMinutes;
      }
      if (a.statusCategory === 'cancelled' || a.statusCategory === 'no_show') {
        existing.gaps += 1;
      }
      map.set(a.staffName, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredAppointments]);

  const renderStatusBadge = (cat: AppointmentReportRow['statusCategory']) => {
    switch (cat) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Concluído
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#B88A44]/15 text-[#B88A44] border border-[#B88A44]/30">
            Agendado / Confirmado
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-500/20 text-stone-300 border border-stone-500/30">
            Cancelado
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
            No-Show / Falta
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros da Aba Atendimentos */}
      <div className="flex flex-wrap items-center gap-3 bg-[#141210] border border-[#2D2A26] rounded-xl p-4">
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Profissional
          </label>
          <select
            value={selectedStaff}
            onChange={(e) => onSelectStaff(e.target.value)}
            className="bg-[#0E0C0A] border border-[#2D2A26] rounded-lg px-3 py-2 text-xs text-[#F5F5F0] focus:border-[#B88A44] focus:outline-none"
          >
            <option value="all">Todos os profissionais</option>
            {availableStaff.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Status Operacional
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => onSelectStatus(e.target.value as AppointmentStatusFilter)}
            className="bg-[#0E0C0A] border border-[#2D2A26] rounded-lg px-3 py-2 text-xs text-[#F5F5F0] focus:border-[#B88A44] focus:outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="completed">Concluídos</option>
            <option value="scheduled">Agendados / Confirmados</option>
            <option value="cancelled">Cancelados</option>
            <option value="no_show">No-Show / Falta</option>
          </select>
        </div>

        <div className="ml-auto text-right">
          <span className="text-[11px] text-stone-400">
            Visão 100% operacional de ocupação da cadeira (independente do caixa).
          </span>
        </div>
      </div>

      {/* 4 Cards Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Total de Agendamentos
            </span>
            <Calendar className="w-4 h-4 text-[#B88A44]" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">{metrics.total}</div>
          <div className="mt-1 text-xs text-stone-500">Horários marcados no período</div>
        </div>

        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Taxa de Conclusão
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-400">{metrics.completionRate}%</div>
          <div className="mt-1 text-xs text-stone-500">{metrics.completedCount} atendimentos realizados</div>
        </div>

        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Furos de Agenda
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-400">
            {metrics.gapsCount} <span className="text-sm font-normal text-stone-400">({metrics.gapRate}%)</span>
          </div>
          <div className="mt-1 text-xs text-stone-500">Cancelamentos + No-Shows</div>
        </div>

        <div className="bg-[#141210] border border-[#B88A44]/50 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B88A44]">
              Horas em Cadeira
            </span>
            <Clock className="w-4 h-4 text-[#B88A44]" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">{metrics.hoursFormatted}</div>
          <div className="mt-1 text-xs text-stone-400">Produtividade em serviços concluídos</div>
        </div>
      </div>

      {/* Resumo por Profissional */}
      {staffSummary.length > 0 && (
        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#B88A44] mb-3">
            Resumo Operacional por Profissional
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {staffSummary.map((st) => {
              const hrs = Math.floor(st.minutes / 60);
              const mins = st.minutes % 60;
              return (
                <div
                  key={st.staffName}
                  className="bg-[#0E0C0A] border border-[#2D2A26] rounded-lg p-3 flex flex-col gap-1"
                >
                  <div className="text-xs font-semibold text-[#F5F5F0] truncate">{st.staffName}</div>
                  <div className="flex items-center justify-between text-[11px] text-stone-400 mt-1">
                    <span>Concluídos: <strong className="text-emerald-400">{st.completed}</strong>/{st.total}</span>
                    <span>Furos: <strong className="text-amber-400">{st.gaps}</strong></span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    Tempo produtivo: {hrs}h {String(mins).padStart(2, '0')}m
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela Analítica */}
      <div className="bg-[#141210] border border-[#2D2A26] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D2A26] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#F5F5F0]">
            Detalhamento de Atendimentos & Agendamentos
          </h3>
          <span className="text-xs text-stone-400">{filteredAppointments.length} registro(s)</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-stone-400">Carregando agendamentos...</div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400">
            Nenhum agendamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#2D2A26] bg-[#0E0C0A] text-[10px] uppercase tracking-wider text-[#B88A44]">
                  <th className="py-3 px-4 font-semibold">Data / Hora</th>
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Telefone</th>
                  <th className="py-3 px-4 font-semibold">Profissional</th>
                  <th className="py-3 px-4 font-semibold">Serviço(s)</th>
                  <th className="py-3 px-4 font-semibold text-right">Duração</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D2A26]/60 text-xs text-[#F5F5F0]">
                {filteredAppointments.map((a) => (
                  <tr key={a.id} className="hover:bg-[#1C1916] transition-colors">
                    <td className="py-3 px-4 text-stone-300 whitespace-nowrap">{fmtDateTime(a.startTime)}</td>
                    <td className="py-3 px-4 font-medium">{a.clientName}</td>
                    <td className="py-3 px-4 text-stone-400 font-mono text-[11px]">{a.clientPhone || '-'}</td>
                    <td className="py-3 px-4 text-stone-300">{a.staffName}</td>
                    <td className="py-3 px-4 text-stone-200">{a.serviceNames}</td>
                    <td className="py-3 px-4 text-right text-stone-400">{a.durationMinutes} min</td>
                    <td className="py-3 px-4 text-center">{renderStatusBadge(a.statusCategory)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
