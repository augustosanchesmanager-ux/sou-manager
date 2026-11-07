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
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-6 animate-pulse">
        <div className="h-6 w-1/3 bg-line dark:bg-border-dark rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-line dark:bg-border-dark rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-night dark:text-white">
              Resumo Executivo do Dia
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/20">
              Ao vivo
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Consolidação em tempo real do faturamento e atendimentos de hoje.
          </p>
        </div>

        {/* Ações de envio */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            title="Compartilhar resumo via WhatsApp sem custo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            title="Enviar resumo por e-mail"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-line dark:border-border-dark hover:bg-neutral-100 dark:hover:bg-white/5 text-night dark:text-white transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            E-mail
          </button>

          <button
            type="button"
            onClick={() => navigate('/cash-closing')}
            title="Acessar fechamento de caixa detalhado"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            Fechamento
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid de KPIs Executivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1: Faturamento */}
        <div className="rounded-xl border border-line/60 dark:border-border-dark/60 bg-neutral-50/50 dark:bg-white/[0.02] p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Faturamento Hoje</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-night dark:text-white tabular-nums">
            {formatCurrency(metrics.revenue)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Recebido em comandas
          </div>
        </div>

        {/* KPI 2: Atendimentos */}
        <div className="rounded-xl border border-line/60 dark:border-border-dark/60 bg-neutral-50/50 dark:bg-white/[0.02] p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Atendimentos</span>
            <CalendarCheck2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-night dark:text-white tabular-nums">
            {metrics.completedCount} <span className="text-xs font-normal text-muted-foreground">/ {metrics.totalAppointments}</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>{metrics.inProgressCount + metrics.pendingCount} restantes</span>
          </div>
        </div>

        {/* KPI 3: Ticket Médio */}
        <div className="rounded-xl border border-line/60 dark:border-border-dark/60 bg-neutral-50/50 dark:bg-white/[0.02] p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Ticket Médio</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-night dark:text-white tabular-nums">
            {formatCurrency(metrics.ticketMedio)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Por atendimento
          </div>
        </div>

        {/* KPI 4: Ocupação & Destaque */}
        <div className="rounded-xl border border-line/60 dark:border-border-dark/60 bg-neutral-50/50 dark:bg-white/[0.02] p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-medium">Destaque do Dia</span>
            <Percent className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base font-bold text-night dark:text-white truncate" title={metrics.topStaffName}>
            {metrics.topStaffName}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            {metrics.occupancyRate}% da agenda ativa
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailySummaryExecutiveCard;
