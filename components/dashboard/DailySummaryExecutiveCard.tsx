import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  CalendarCheck2,
  Users,
  Percent,
  Share2,
  Mail,
  ArrowUpRight,
  Sparkles,
  Clock
} from 'lucide-react';
import { formatCurrency } from '../../shared/format/currency';
import type { TodayDashboardData } from '../../src/modules/dashboard';

interface DailySummaryExecutiveCardProps {
  todayData: TodayDashboardData | null;
  loading: boolean;
  tenantName?: string;
  onSendEmail?: () => void;
}

export const DailySummaryExecutiveCard: React.FC<DailySummaryExecutiveCardProps> = ({
  todayData,
  loading,
  tenantName = 'Barbearia',
  onSendEmail,
}) => {
  const navigate = useNavigate();

  const metrics = useMemo(() => {
    if (!todayData) {
      return {
        revenue: 0,
        completedCount: 0,
        inProgressCount: 0,
        pendingCount: 0,
        totalAppointments: 0,
        ticketMedio: 0,
        occupancyRate: 0,
        topStaffName: 'Equipe',
      };
    }

    const { kpis, todayAppointments } = todayData;
    const completed = kpis.concluidos;
    const inProgress = kpis.emAtendimento;
    const pending = kpis.pendentes;
    const total = kpis.totalToday;
    const revenue = kpis.faturamento;

    const ticketMedio = completed > 0 ? revenue / completed : (total > 0 ? revenue / total : 0);

    // Estimativa de taxa de ocupação (concluídos + em andamento sobre total agendado)
    const activeClients = completed + inProgress;
    const occupancyRate = total > 0 ? Math.min(100, Math.round((activeClients / total) * 100)) : 0;

    // Identificar profissional destaque do dia
    const staffCountMap: Record<string, { count: number; name: string }> = {};
    todayAppointments.forEach((apt) => {
      if (apt.staff_id) {
        if (!staffCountMap[apt.staff_id]) {
          staffCountMap[apt.staff_id] = { count: 0, name: apt.staff_name || 'Profissional' };
        }
        if (apt.status === 'completed' || apt.status === 'in_progress') {
          staffCountMap[apt.staff_id].count += 1;
        }
      }
    });

    let topStaffName = 'Toda a equipe';
    let maxCount = 0;
    Object.values(staffCountMap).forEach((st) => {
      if (st.count > maxCount) {
        maxCount = st.count;
        topStaffName = st.name;
      }
    });

    return {
      revenue,
      completedCount: completed,
      inProgressCount: inProgress,
      pendingCount: pending,
      totalAppointments: total,
      ticketMedio,
      occupancyRate,
      topStaffName,
    };
  }, [todayData]);

  // Formatar mensagem pré-modulada para o WhatsApp
  const handleShareWhatsApp = () => {
    const todayStr = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const text = `📊 *RESUMO DIÁRIO EXECUTIVO — ${tenantName.toUpperCase()}*\n` +
      `📅 *Data:* ${todayStr}\n\n` +
      `💰 *Faturamento Total:* ${formatCurrency(metrics.revenue)}\n` +
      `✂️ *Atendimentos Concluídos:* ${metrics.completedCount}\n` +
      `⏳ *Em Andamento / Pendentes:* ${metrics.inProgressCount + metrics.pendingCount}\n` +
      `🎯 *Ticket Médio:* ${formatCurrency(metrics.ticketMedio)}\n` +
      `⭐ *Destaque de Hoje:* ${metrics.topStaffName}\n\n` +
      `_Enviado via SMG Barber Management System_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleSendEmail = () => {
    if (onSendEmail) {
      onSendEmail();
    } else {
      const subject = encodeURIComponent(`Resumo Executivo do Dia — ${tenantName}`);
      const body = encodeURIComponent(
        `Olá gestor,\n\nSegue o resumo do dia:\n- Faturamento: ${formatCurrency(metrics.revenue)}\n- Atendimentos Concluídos: ${metrics.completedCount}\n- Ticket Médio: ${formatCurrency(metrics.ticketMedio)}\n\nConsulte o fechamento completo no SMG Barber.`
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-4 animate-pulse">
        <div className="h-5 w-1/4 bg-line dark:bg-border-dark rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-line dark:bg-border-dark rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-4 sm:p-5 shadow-sm transition-colors">
      {/* Header Compacto com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-4 h-4" />
          </span>
          <h2 className="text-sm sm:text-base font-bold text-ink dark:text-white">
            Resumo Operacional do Dia
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
            Tempo real
          </span>
        </div>

        {/* Ações de Envio e Fechamento */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            title="Compartilhar resumo via WhatsApp"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-dark text-night transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            title="Enviar resumo por e-mail"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-line dark:border-border-dark hover:bg-gold-pale dark:hover:bg-white/5 text-ink dark:text-white transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            E-mail
          </button>

          <button
            type="button"
            onClick={() => navigate('/cash-closing')}
            title="Acessar fechamento de caixa detalhado"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary hover:text-primary-dark transition-colors cursor-pointer"
          >
            Fechamento de Caixa
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid de KPIs Harmonizado com Atelier Tech */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* KPI 1: Faturamento */}
        <div className="rounded-xl border border-line dark:border-border-dark bg-gold-pale/40 dark:bg-surface-dark/60 p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-ink-soft mb-1">
            <span className="text-[11px] font-medium">Faturamento</span>
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-base sm:text-lg font-bold text-ink dark:text-white tabular-nums tracking-tight">
            {formatCurrency(metrics.revenue)}
          </div>
          <div className="text-[10px] text-ink-soft mt-0.5">
            Total em comandas
          </div>
        </div>

        {/* KPI 2: Atendimentos */}
        <div className="rounded-xl border border-line dark:border-border-dark bg-gold-pale/40 dark:bg-surface-dark/60 p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-ink-soft mb-1">
            <span className="text-[11px] font-medium">Atendimentos</span>
            <CalendarCheck2 className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-base sm:text-lg font-bold text-ink dark:text-white tabular-nums tracking-tight">
            {metrics.completedCount} <span className="text-xs font-normal text-ink-soft">/ {metrics.totalAppointments}</span>
          </div>
          <div className="text-[10px] text-ink-soft mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>{metrics.inProgressCount + metrics.pendingCount} restantes</span>
          </div>
        </div>

        {/* KPI 3: Ticket Médio */}
        <div className="rounded-xl border border-line dark:border-border-dark bg-gold-pale/40 dark:bg-surface-dark/60 p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-ink-soft mb-1">
            <span className="text-[11px] font-medium">Ticket Médio</span>
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-base sm:text-lg font-bold text-ink dark:text-white tabular-nums tracking-tight">
            {formatCurrency(metrics.ticketMedio)}
          </div>
          <div className="text-[10px] text-ink-soft mt-0.5">
            Por cliente
          </div>
        </div>

        {/* KPI 4: Destaque da Equipe */}
        <div className="rounded-xl border border-line dark:border-border-dark bg-gold-pale/40 dark:bg-surface-dark/60 p-3 sm:p-3.5">
          <div className="flex items-center justify-between text-ink-soft mb-1">
            <span className="text-[11px] font-medium">Destaque</span>
            <Percent className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-sm sm:text-base font-bold text-ink dark:text-white truncate" title={metrics.topStaffName}>
            {metrics.topStaffName}
          </div>
          <div className="text-[10px] text-primary font-medium mt-0.5">
            {metrics.occupancyRate}% da agenda
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailySummaryExecutiveCard;
