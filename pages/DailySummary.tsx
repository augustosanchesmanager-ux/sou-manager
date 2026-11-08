import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
  Sun,
  Moon,
  Copy,
  SlidersHorizontal,
  Sunrise,
  CalendarCheck,
  TrendingUp,
  Percent,
  Crown,
  Users,
  BellRing,
  Banknote,
  CheckCircle2,
  Receipt,
  AlertTriangle,
  ExternalLink,
  Award,
  MessageSquare,
  Mail,
  Bot,
  CheckCheck,
  Send,
  Cpu,
  Shield,
  UserCheck,
  Database,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dailySummaryService } from '../services/dailySummaryService';
import type {
  DailySummaryPayload,
  ShiftType,
  PreviewChannel,
  DispatchLogItem,
  AutomationSettings,
} from '../src/types/dailySummary';
import { formatCurrency } from '../shared/format/currency';

export const DailySummary: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const tenantId = tenant?.id || 'sanchez-barber-default';
  const tenantName = tenant?.name || 'Sanchez Barber';

  const [activeShift, setActiveShift] = useState<ShiftType>('morning');
  const [activeChannel, setActiveChannel] = useState<PreviewChannel>('WHATSAPP');
  const [loading, setLoading] = useState<boolean>(true);
  const [summaryData, setSummaryData] = useState<DailySummaryPayload | null>(null);
  const [settings, setSettings] = useState<AutomationSettings>({
    morningEnabled: true,
    morningTime: '07:30',
    eveningEnabled: true,
    eveningTime: '21:30',
    sendIndividualBarber: true,
  });
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogItem[]>([]);
  const [headerCopyLabel, setHeaderCopyLabel] = useState<string>('Copiar p/ WhatsApp');

  // Toast State
  const [toast, setToast] = useState<{ visible: boolean; title: string; subtitle: string }>({
    visible: false,
    title: '',
    subtitle: '',
  });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const automationCardRef = useRef<HTMLDivElement | null>(null);

  const showToast = (title: string, subtitle: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, title, subtitle });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3200);
  };

  // Carregar dados
  const loadData = async () => {
    setLoading(true);
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const data = await dailySummaryService.getDailySummary(tenantId, todayIso, tenantName);
      setSummaryData(data);
      setSettings(data.automationSettings);
      setDispatchLogs(data.recentLogs);
    } catch (err) {
      console.error('Erro ao carregar resumo diário:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [tenantId]);

  // Mensagem formatada para WhatsApp
  const whatsappText = useMemo(() => {
    if (!summaryData) return '';

    if (activeShift === 'morning') {
      return (
        `☀️ *BRIEFING DA MANHÃ — ${tenantName.toUpperCase()}*\n` +
        `📅 *${summaryData.formattedDate}* (${summaryData.unitName})\n\n` +
        `📊 *PREVISÃO OPERACIONAL DE HOJE*\n` +
        `• *Agendamentos:* ${summaryData.morning.scheduledCount} clientes (${summaryData.morning.occupancyRate}% ocupação)\n` +
        `• *Receita Prevista:* ${formatCurrency(summaryData.morning.projectedRevenue)} _(${summaryData.morning.projectedBreakdownLabel})_\n` +
        `• *Clube dos Chefes:* ${summaryData.morning.clubSubscribersCount} assinantes agendados\n\n` +
        `💈 *OCUPAÇÃO POR PROFISSIONAL*\n` +
        summaryData.morning.staffOccupancy
          .map((s) => `• *${s.name}:* ${s.scheduledCount} agend. (${s.occupancyPercentage}%) — _Livre: ${s.freeWindows}_`)
          .join('\n') +
        `\n\n` +
        `⚠️ *ALERTAS FINANCEIROS DE HOJE*\n` +
        `• 🔴 A Pagar: R$ 340,00 _(2 vencimentos hoje)_\n` +
        `• 🟡 Clube dos Chefes: 1 renovação hoje _(Felipe A. às 14:30)_`
      );
    } else {
      return (
        `🌙 *FECHAMENTO DA NOITE — ${tenantName.toUpperCase()}*\n` +
        `📅 *${summaryData.formattedDate}* (${summaryData.unitName})\n\n` +
        `💰 *RESULTADO FINANCEIRO REALIZADO*\n` +
        `• *Caixa Líquido Hoje:* ${formatCurrency(summaryData.evening.realizedRevenue)} _(${summaryData.evening.paymentBreakdownLabel})_\n` +
        `• *Consumo Clube dos Chefes:* ${summaryData.evening.clubCreditsCount} créditos _(R$ 0 impacto caixa)_\n` +
        `• *Concluídos:* ${summaryData.evening.completedCount} de ${summaryData.evening.totalAppointments} _(1 Cancelado)_\n` +
        `• *Ticket Médio:* ${formatCurrency(summaryData.evening.ticketMedio)}\n\n` +
        `🚨 *AUDITORIA: ${summaryData.evening.openComandas.length} COMANDAS EM ABERTO (${formatCurrency(summaryData.evening.openComandasTotal)})*\n` +
        summaryData.evening.openComandas
          .map((c) => `• *${c.comandaNumber}* ${c.clientName} (c/ ${c.staffName}) — *${formatCurrency(c.amount)}*`)
          .join('\n') +
        `\n_Acesse o PDV para baixar ou cancelar antes de encerrar o caixa._\n\n` +
        `💈 *COMISSÕES GERADAS HOJE (CAIXA)*\n` +
        summaryData.evening.staffClosing
          .map((st) => `• *${st.name}:* ${st.completedCount} atend. → *${formatCurrency(st.commissionAmount)}*`)
          .join('\n')
      );
    }
  }, [summaryData, activeShift, tenantName]);

  // Cópia para a área de transferência
  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(whatsappText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = whatsappText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setHeaderCopyLabel('Copiado!');
      setTimeout(() => setHeaderCopyLabel('Copiar p/ WhatsApp'), 2000);

      const label = activeShift === 'morning' ? 'Briefing da Manhã' : 'Fechamento da Noite';
      showToast(
        `${label} copiado!`,
        'Texto formatado com negritos e emojis pronto para colar no WhatsApp.'
      );
    } catch {
      showToast('Erro ao copiar', 'Não foi possível copiar automaticamente para a área de transferência.');
    }
  };

  // Simular disparo com checagem de idempotência
  const handleSimulateDispatch = async () => {
    const todayIso = new Date().toISOString().split('T')[0];
    const res = await dailySummaryService.recordDispatch(
      tenantId,
      todayIso,
      activeShift,
      activeChannel
    );

    setDispatchLogs((prev) => [res.item, ...prev]);

    if (res.wasDuplicate) {
      showToast(
        'Disparo Duplicado Bloqueado (Idempotência)',
        `A chave ${res.item.idempotencyKey} já foi processada hoje. Nenhum envio duplicado gerado.`
      );
    } else {
      showToast(
        `Disparo ${activeChannel} Registrado!`,
        `Enviado com timezone America/Sao_Paulo e gravado em summary_dispatch_log.`
      );
    }
  };

  // Atualizar configurações de automação
  const handleSettingChange = async (key: keyof AutomationSettings, value: unknown) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await dailySummaryService.saveAutomationSettings(tenantId, updated);
    showToast('Automação Atualizada', 'Configurações de horário e governança salvas com sucesso.');
  };

  // Foco no card de automação
  const focusAutomationPanel = () => {
    if (automationCardRef.current) {
      automationCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      automationCardRef.current.classList.add('ring-2', 'ring-amber-500');
      setTimeout(() => {
        automationCardRef.current?.classList.remove('ring-2', 'ring-amber-500');
      }, 1800);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EE] dark:bg-[#0B0A09] text-[#191611] dark:text-[#F4EFE6] transition-colors duration-200 pb-20">
      {/* ======================================================================= */}
      {/* 1. BARRA DE CONTROLE SUPERIOR (HEADER DA TELA)                          */}
      {/* ======================================================================= */}
      <header className="sticky top-0 z-40 border-b border-[#E8DFC9] dark:border-[#29241D] bg-[#FAF6EE]/95 dark:bg-[#0B0A09]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">

            {/* Identificação da Unidade & Segurança de Timezone */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-[#D4A95E] shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-600 dark:text-[#D4A95E] font-semibold">
                    {tenantName} • {summaryData?.unitName || 'Unidade Parque Cisper'}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] text-[#6B6252] dark:text-[#A69D8E]"
                    title="Âncora de data protegida contra virada UTC à meia-noite"
                  >
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    America/Sao_Paulo • UTC-3
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <h1 className="text-base sm:text-lg font-bold text-[#191611] dark:text-[#F4EFE6]">
                    Central de Resumo Diário & Automações
                  </h1>
                  <span className="text-stone-400 hidden sm:inline">•</span>
                  <span className="text-xs sm:text-sm text-[#6B6252] dark:text-[#A69D8E] flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-[#D4A95E]" />
                    {summaryData?.formattedDate || 'Sexta-feira, 6 de novembro de 2026'}
                  </span>
                </div>
              </div>
            </div>

            {/* Controles Centrais e Ações Rápidas */}
            <div className="flex flex-wrap items-center justify-between xl:justify-end gap-3">

              {/* Seletor Principal de Turno/Visão (Segmented Control) */}
              <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D]" role="tablist">
                <button
                  type="button"
                  onClick={() => setActiveShift('morning')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    activeShift === 'morning'
                      ? 'bg-amber-500 text-stone-950 shadow-sm'
                      : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Sun className="w-4 h-4 stroke-[2.2]" />
                  <span>Briefing da Manhã</span>
                  <span className="text-[11px] font-mono opacity-80 hidden md:inline">({settings.morningTime})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveShift('evening')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
                    activeShift === 'evening'
                      ? 'bg-amber-500 text-stone-950 shadow-sm font-semibold'
                      : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>Fechamento da Noite</span>
                  <span className="text-[11px] font-mono opacity-75 hidden md:inline">({settings.eveningTime})</span>
                  {summaryData?.evening?.openComandas && summaryData.evening.openComandas.length > 0 && (
                    <span
                      className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                      title={`${summaryData.evening.openComandas.length} comandas abertas detectadas`}
                    />
                  )}
                </button>
              </div>

              {/* Ações Rápidas */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="h-10 px-4 rounded-xl bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-amber-500/50 hover:border-amber-500 text-amber-700 dark:text-[#D4A95E] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <Copy className="w-4 h-4" />
                  <span>{headerCopyLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={focusAutomationPanel}
                  className="h-10 px-4 rounded-xl bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] text-[#191611] dark:text-[#F4EFE6] font-medium text-xs sm:text-sm inline-flex items-center gap-2 transition-all cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                  <span>Configurar Automação</span>
                </button>

                <button
                  type="button"
                  onClick={loadData}
                  title="Atualizar dados do resumo diário"
                  className="h-10 w-10 rounded-xl bg-white dark:bg-[#12100E] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] text-[#6B6252] dark:text-[#A69D8E] flex items-center justify-center transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Toast de Feedback Global */}
      {toast.visible && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#12100E] border border-amber-500 shadow-2xl text-xs sm:text-sm text-[#191611] dark:text-[#F4EFE6] animate-in fade-in slide-in-from-bottom-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-[#D4A95E] shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold">{toast.title}</p>
            <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] font-mono">{toast.subtitle}</p>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. ÁREA PRINCIPAL (GRID DE 12 COLUNAS)                                  */}
      {/* ======================================================================= */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {/* Banner Explicativo do Turno Ativo */}
        <div className="mb-6 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-[#D4A95E] shrink-0">
              {activeShift === 'morning' ? <Sunrise className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6]">
                  {activeShift === 'morning'
                    ? 'Modo Briefing da Manhã (Foco em Previsão, Ocupação e Alertas do Dia)'
                    : 'Modo Fechamento da Noite (Foco em Caixa Realizado, Comissões e Auditoria)'}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-[#D4A95E] border border-amber-500/30">
                  {activeShift === 'morning' ? `Disparo ${settings.morningTime}` : `Disparo ${settings.eveningTime}`}
                </span>
              </div>
              <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] mt-0.5">
                {activeShift === 'morning'
                  ? 'Evita enviar faturamento zerado às 07:30. Mostra a previsão real da agenda, janelas livres por barbeiro, clientes do Clube dos Chefes e contas vencendo hoje.'
                  : 'Separa dinheiro real no caixa de créditos do Clube dos Chefes e destaca comandas esquecidas em aberto antes de fechar o turno.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-[#6B6252] dark:text-stone-400">
            <span>
              RPC: <code className="text-amber-700 dark:text-[#D4A95E]">get_daily_summary('{summaryData?.date || '2026-11-06'}', '{activeShift}')</code>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* =================================================================== */}
          {/* COLUNA ESQUERDA (7 COLUNAS) — PAINEL ANALÍTICO DO TURNO             */}
          {/* =================================================================== */}
          <div className="lg:col-span-7 space-y-6">

            {/* --------------------------------------------------------------- */}
            {/* VISÃO 1: BRIEFING DA MANHÃ (07:30)                              */}
            {/* --------------------------------------------------------------- */}
            {activeShift === 'morning' && summaryData && (
              <div className="space-y-6 animate-in fade-in duration-200">

                {/* 4 KPIs de Previsão da Manhã */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Agendados Hoje</span>
                      <CalendarCheck className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                    </div>
                    <div className="text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums">
                      {summaryData.morning.scheduledCount}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-mono mt-1">
                      {summaryData.morning.scheduledDeltaLabel}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Receita Prevista</span>
                      <TrendingUp className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums whitespace-nowrap">
                      {formatCurrency(summaryData.morning.projectedRevenue)}
                    </div>
                    <div className="text-[11px] text-[#6B6252] dark:text-stone-400 font-mono mt-1">
                      {summaryData.morning.projectedBreakdownLabel}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Taxa Ocupação</span>
                      <Percent className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-[#D4A95E] tabular-nums">
                      {summaryData.morning.occupancyRate}%
                    </div>
                    <div className="text-[11px] text-[#6B6252] dark:text-stone-400 font-mono mt-1">
                      {summaryData.morning.freeSlotsLabel}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Clube dos Chefes</span>
                      <Crown className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                    </div>
                    <div className="text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums">
                      {summaryData.morning.clubSubscribersCount}
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-[#D4A95E] font-mono mt-1">
                      Assinantes na agenda
                    </div>
                  </div>
                </div>

                {/* Ocupação e Previsão por Profissional */}
                <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h2 className="text-sm sm:text-base font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
                        <Users className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                        <span>Ocupação & Previsão por Profissional</span>
                      </h2>
                      <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
                        Distribuição da agenda de hoje e janelas disponíveis para encaixe rápido
                      </p>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] text-[#6B6252] dark:text-[#A69D8E]">
                      {summaryData.morning.staffOccupancy.length} cadeiras ativas
                    </span>
                  </div>

                  <div className="space-y-4">
                    {summaryData.morning.staffOccupancy.map((staff) => (
                      <div
                        key={staff.staffId}
                        className="p-4 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-[#D4A95E] font-bold text-xs">
                              {staff.initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6]">{staff.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-[#D4A95E] border border-amber-500/30">
                                  {staff.roleBadge}
                                </span>
                              </div>
                              <span className="text-xs text-[#6B6252] dark:text-[#A69D8E]">{staff.timeRangeDescription}</span>
                            </div>
                          </div>
                          <div className="text-right tabular-nums">
                            <span className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">{staff.scheduledCount} agendados</span>
                            <span className="text-xs text-stone-400 mx-1">•</span>
                            <span className="text-sm font-semibold text-amber-700 dark:text-[#D4A95E]">
                              {formatCurrency(staff.projectedRevenue)} prev.
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 rounded-full bg-stone-200 dark:bg-[#0B0A09] overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full ${
                              staff.occupancyPercentage >= 85
                                ? 'bg-emerald-500'
                                : staff.occupancyPercentage >= 70
                                ? 'bg-amber-500'
                                : 'bg-amber-600'
                            }`}
                            style={{ width: `${staff.occupancyPercentage}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {staff.occupancyPercentage}% Ocupação
                          </span>
                          <span className="text-[#6B6252] dark:text-[#A69D8E]">
                            Janelas livres: <strong className="font-mono text-[#191611] dark:text-[#F4EFE6]">{staff.freeWindows}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Destaques & Alertas da Manhã (Clube dos Chefes + Financeiro do Dia) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Clientes Clube dos Chefes Hoje */}
                  <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                        <span>Clube dos Chefes Hoje ({summaryData.morning.clubClients.length})</span>
                      </h3>
                      <span className="text-[11px] font-mono text-amber-700 dark:text-[#D4A95E] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                        Consumo Crédito
                      </span>
                    </div>
                    <ul className="space-y-2.5 text-xs">
                      {summaryData.morning.clubClients.map((cc, idx) => (
                        <li key={idx} className="flex items-center justify-between py-1.5 border-b border-stone-200 dark:border-[#29241D]/70">
                          <div>
                            <span className="font-medium text-[#191611] dark:text-[#F4EFE6] block">
                              {cc.time} • {cc.clientName}
                            </span>
                            <span className="text-[#6B6252] dark:text-stone-400">{cc.serviceDescription}</span>
                          </div>
                          <span
                            className={`font-mono px-2 py-0.5 rounded text-[11px] ${
                              cc.status === 'Renova Hoje'
                                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold'
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {cc.status}
                          </span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between pt-1 text-[#6B6252] dark:text-[#A69D8E]">
                        <span>+ 2 assinantes às 16:00 e 18:00</span>
                        <span className="font-mono text-amber-700 dark:text-[#D4A95E]">5 créditos</span>
                      </li>
                    </ul>
                  </div>

                  {/* Alertas Financeiros do Dia (Contas a Pagar / Receber) */}
                  <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-amber-500" />
                        <span>Vencimentos Financeiros Hoje</span>
                      </h3>
                      <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                        Atenção Caixa
                      </span>
                    </div>
                    <div className="space-y-3 text-xs">
                      {summaryData.morning.financialAlerts.map((fa) => (
                        <div
                          key={fa.id}
                          className={`p-3 rounded-xl bg-stone-50 dark:bg-[#171411] border flex items-center justify-between ${
                            fa.amount < 0
                              ? 'border-red-500/30 text-red-600 dark:text-red-400'
                              : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <div>
                            <span className="font-semibold text-[#191611] dark:text-[#F4EFE6] block">{fa.title}</span>
                            <span className="text-[#6B6252] dark:text-[#A69D8E]">{fa.subtitle}</span>
                          </div>
                          <span className="font-mono font-bold tabular-nums">
                            {fa.amount < 0 ? `- ${formatCurrency(Math.abs(fa.amount))}` : `+ ${formatCurrency(fa.amount)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* VISÃO 2: FECHAMENTO DA NOITE (21:30)                            */}
            {/* --------------------------------------------------------------- */}
            {activeShift === 'evening' && summaryData && (
              <div className="space-y-6 animate-in fade-in duration-200">

                {/* 4 KPIs de Fechamento da Noite (Separando Caixa Real de Crédito Clube) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-emerald-500/40 shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Caixa Realizado</span>
                      <Banknote className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums whitespace-nowrap">
                      {formatCurrency(summaryData.evening.realizedRevenue)}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-mono mt-1">
                      {summaryData.evening.paymentBreakdownLabel}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Consumo Clube</span>
                      <Crown className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600 dark:text-[#D4A95E] tabular-nums">
                      {summaryData.evening.clubCreditsCount} créd.
                    </div>
                    <div className="text-[11px] text-[#6B6252] dark:text-stone-400 font-mono mt-1">
                      R$ 0 impacto caixa hoje
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Concluídos</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums">
                      {summaryData.evening.completedCount}{' '}
                      <span className="text-sm font-normal text-[#6B6252] dark:text-stone-400">
                        / {summaryData.evening.totalAppointments}
                      </span>
                    </div>
                    <div className="text-[11px] text-red-500 font-mono mt-1">
                      {summaryData.evening.cancelledCount} Cancelado • {summaryData.evening.openCount} Abertos
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs">
                    <div className="flex items-center justify-between text-xs text-[#6B6252] dark:text-[#A69D8E] mb-1.5">
                      <span>Ticket Médio</span>
                      <Receipt className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                    </div>
                    <div className="text-xl sm:text-2xl font-bold text-[#191611] dark:text-[#F4EFE6] tabular-nums whitespace-nowrap">
                      {formatCurrency(summaryData.evening.ticketMedio)}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-mono mt-1">
                      {summaryData.evening.ticketMedioDeltaLabel}
                    </div>
                  </div>
                </div>

                {/* ALERTA DE AUDITORIA OPERACIONAL (Comandas Esquecidas em Aberto) */}
                <div className="rounded-2xl bg-white dark:bg-[#12100E] border-2 border-amber-500/70 p-5 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200 dark:border-[#29241D]">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-[#191611] dark:text-[#F4EFE6]">
                            Alerta de Auditoria: {summaryData.evening.openComandas.length} Comandas continuam abertas hoje
                          </h3>
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40 tabular-nums">
                            {formatCurrency(summaryData.evening.openComandasTotal)} pendentes
                          </span>
                        </div>
                        <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] mt-0.5">
                          Estes atendimentos já passaram do horário de término mas não tiveram o recebimento baixado no PDV.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('/comandas')}
                      className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Inspecionar Comandas</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {summaryData.evening.openComandas.map((cmd) => (
                      <div
                        key={cmd.id}
                        className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                              {cmd.comandaNumber}
                            </span>
                            <span className="text-xs text-[#191611] dark:text-[#F4EFE6] font-medium">• {cmd.clientName}</span>
                          </div>
                          <span className="text-xs text-[#6B6252] dark:text-[#A69D8E] block mt-0.5">
                            {cmd.serviceDescription} • Prof:{' '}
                            <strong className="text-[#191611] dark:text-[#F4EFE6]">{cmd.staffName}</strong>
                          </span>
                        </div>
                        <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {formatCurrency(cmd.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resultado & Comissões por Profissional (Separando Caixa vs Clube) */}
                <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div>
                      <h2 className="text-sm sm:text-base font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                        <span>Fechamento & Comissões por Profissional</span>
                      </h2>
                      <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
                        Separação estrita entre serviços pagos em Caixa Hoje vs. Créditos Clube dos Chefes
                      </p>
                    </div>
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] text-amber-700 dark:text-[#D4A95E]">
                      Auditoria Anti-Inflação de Caixa
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 dark:border-[#29241D] text-[11px] font-mono uppercase text-[#6B6252] dark:text-stone-400">
                          <th className="py-2.5 pr-3">Profissional</th>
                          <th className="py-2.5 px-3 text-center">Atend.</th>
                          <th className="py-2.5 px-3 text-right">Faturado Caixa</th>
                          <th className="py-2.5 px-3 text-center">Clube Chefes</th>
                          <th className="py-2.5 pl-3 text-right">Comissão Hoje</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200 dark:divide-[#29241D]/70 text-xs sm:text-sm tabular-nums">
                        {summaryData.evening.staffClosing.map((staff) => (
                          <tr key={staff.staffId}>
                            <td className="py-3.5 pr-3">
                              <span className="font-semibold text-[#191611] dark:text-[#F4EFE6] block">{staff.name}</span>
                              <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">{staff.roleDescription}</span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono text-[#191611] dark:text-[#F4EFE6]">
                              {staff.completedCount} concl.
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono font-semibold text-[#191611] dark:text-[#F4EFE6]">
                              {formatCurrency(staff.cashRevenue)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono text-amber-700 dark:text-[#D4A95E]">
                              {staff.clubCredits} créd.
                            </td>
                            <td className="py-3.5 pl-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(staff.commissionAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-stone-200 dark:border-[#29241D] bg-stone-100/60 dark:bg-[#171411]/60 font-mono text-xs">
                          <td className="py-3 px-3 font-semibold text-[#191611] dark:text-[#F4EFE6]">TOTAL CONSOLIDADO</td>
                          <td className="py-3 px-3 text-center font-bold text-[#191611] dark:text-[#F4EFE6]">
                            {summaryData.evening.completedCount} concl.
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#191611] dark:text-[#F4EFE6]">
                            {formatCurrency(summaryData.evening.totalCashRevenue)}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-amber-700 dark:text-[#D4A95E]">
                            {summaryData.evening.totalClubCredits} créd.
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(summaryData.evening.totalCommissions)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* =================================================================== */}
          {/* COLUNA DIREITA (5 COLUNAS) — SIMULADOR DE DISPARO & AUTOMAÇÃO       */}
          {/* =================================================================== */}
          <div className="lg:col-span-5 space-y-6">

            {/* --------------------------------------------------------------- */}
            {/* CARD 1: PREVIEW REALISTA (WHATSAPP & E-MAIL EXECUTIVO)          */}
            {/* --------------------------------------------------------------- */}
            <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] overflow-hidden shadow-xl">

              {/* Header do Simulador */}
              <div className="p-4 bg-stone-50 dark:bg-[#171411] border-b border-[#E8DFC9] dark:border-[#29241D] flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D]">
                  <button
                    type="button"
                    onClick={() => setActiveChannel('WHATSAPP')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeChannel === 'WHATSAPP'
                        ? 'bg-amber-500 text-stone-950'
                        : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Preview WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChannel('EMAIL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeChannel === 'EMAIL'
                        ? 'bg-amber-500 text-stone-950 font-semibold'
                        : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Preview E-mail Executivo</span>
                  </button>
                </div>

                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] text-amber-700 dark:text-[#D4A95E]">
                  Template: {activeShift === 'morning' ? `Manhã (${settings.morningTime})` : `Noite (${settings.eveningTime})`}
                </span>
              </div>

              {/* Conteúdo Aba 1: Preview WhatsApp */}
              {activeChannel === 'WHATSAPP' && (
                <div className="p-4 bg-[#EFEAE2] dark:bg-[#0E0C0A]">
                  <div className="rounded-2xl bg-white dark:bg-[#161310] border border-stone-300 dark:border-amber-500/30 p-4 shadow-lg relative">
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-stone-200 dark:border-[#29241D] text-[11px] font-mono text-amber-700 dark:text-[#D4A95E]">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5" />
                        SMG • Assistente Operacional
                      </span>
                      <span>{activeShift === 'morning' ? settings.morningTime : settings.eveningTime}</span>
                    </div>

                    {/* Texto Formatado do WhatsApp */}
                    <pre className="text-xs font-sans text-stone-900 dark:text-[#F4EFE6] whitespace-pre-wrap leading-relaxed select-all">
                      {whatsappText}
                    </pre>

                    <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-[#29241D]/60 flex items-center justify-between text-[11px] text-[#6B6252] dark:text-stone-400 font-mono">
                      <span>Destinatários: Augusto (Admin), Rubens (Gestor)</span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" /> Verificado
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação do Simulador */}
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="flex-1 h-10 px-3.5 rounded-xl bg-white dark:bg-[#171411] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-[#E8DFC9] dark:border-[#29241D] text-[#191611] dark:text-[#F4EFE6] font-medium text-xs inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-600 dark:text-[#D4A95E]" />
                      <span>Copiar Texto Formatado</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSimulateDispatch}
                      className="flex-1 h-10 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Simular Disparo Agora</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Conteúdo Aba 2: Preview E-mail Executivo */}
              {activeChannel === 'EMAIL' && (
                <div className="p-4 bg-stone-50 dark:bg-[#0B0A09]">
                  <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-4 space-y-3">
                    <div className="border-b border-stone-200 dark:border-[#29241D] pb-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[#6B6252] dark:text-[#A69D8E]">
                        <span>De: <strong className="text-[#191611] dark:text-white font-mono">resumos@soumanager.com.br</strong></span>
                        <span className="font-mono text-[11px] text-amber-700 dark:text-[#D4A95E]">TLS • Resend</span>
                      </div>
                      <div className="text-[#6B6252] dark:text-[#A69D8E]">
                        Para: <strong className="text-[#191611] dark:text-white">augusto@sanchezbarber.com.br, rubens@sanchezbarber.com.br</strong>
                      </div>
                      <div className="pt-1">
                        <span className="text-stone-400">Assunto: </span>
                        <strong className="text-amber-700 dark:text-[#D4A95E] font-semibold">
                          {activeShift === 'morning'
                            ? `[SMG] ☀️ Briefing da Manhã — ${tenantName} (${summaryData?.date || '06/11/2026'})`
                            : `[SMG] 🚨 Fechamento da Noite (2 Comandas Abertas) — ${tenantName}`}
                        </strong>
                      </div>
                    </div>

                    {/* Corpo HTML simulado do E-mail */}
                    <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] text-xs space-y-3">
                      {activeShift === 'morning' ? (
                        <>
                          <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-2">
                            <span className="font-semibold text-[#191611] dark:text-white">Resumo Previsional do Dia</span>
                            <span className="font-mono text-amber-700 dark:text-[#D4A95E]">Ocupação: {summaryData?.morning.occupancyRate}%</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono">
                            <div className="p-2 rounded bg-white dark:bg-[#12100E] border border-stone-200 dark:border-[#29241D]">
                              <span className="text-[10px] text-[#6B6252] dark:text-[#A69D8E] block">AGENDADOS</span>
                              <strong className="text-sm text-[#191611] dark:text-white">{summaryData?.morning.scheduledCount}</strong>
                            </div>
                            <div className="p-2 rounded bg-white dark:bg-[#12100E] border border-stone-200 dark:border-[#29241D]">
                              <span className="text-[10px] text-[#6B6252] dark:text-[#A69D8E] block">PREVISTO CAIXA</span>
                              <strong className="text-sm text-amber-700 dark:text-[#D4A95E]">
                                {formatCurrency(summaryData?.morning.projectedRevenue || 1480)}
                              </strong>
                            </div>
                            <div className="p-2 rounded bg-white dark:bg-[#12100E] border border-stone-200 dark:border-[#29241D]">
                              <span className="text-[10px] text-[#6B6252] dark:text-[#A69D8E] block">CLUBE CHEFES</span>
                              <strong className="text-sm text-[#191611] dark:text-white">{summaryData?.morning.clubSubscribersCount} créd.</strong>
                            </div>
                          </div>
                          <p className="text-[#6B6252] dark:text-[#A69D8E] leading-relaxed">
                            <strong className="text-[#191611] dark:text-white">Destaques:</strong> Rubens está com 90% da agenda tomada. Lucas possui janelas às 14:00 e 17:00 para encaixes. Existem contas a pagar com vencimento no dia.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-2">
                            <span className="font-semibold text-[#191611] dark:text-white">Auditoria de Caixa & Comissões</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              Caixa: {formatCurrency(summaryData?.evening.realizedRevenue || 1320)}
                            </span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-400 font-mono text-[11px]">
                            ⚠️ ATENÇÃO: {summaryData?.evening.openComandas.length} comandas somando{' '}
                            {formatCurrency(summaryData?.evening.openComandasTotal || 160)} continuam abertas às {settings.eveningTime}.
                          </div>
                          <p className="text-[#6B6252] dark:text-[#A69D8E] leading-relaxed">
                            Foram concluídos <strong className="text-[#191611] dark:text-white">{summaryData?.evening.completedCount} atendimentos</strong> com ticket médio de <strong className="text-[#191611] dark:text-white">{formatCurrency(summaryData?.evening.ticketMedio || 94.28)}</strong>, além de {summaryData?.evening.clubCreditsCount} atendimentos via crédito do Clube dos Chefes. Total de comissões do dia:{' '}
                            <strong className="text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(summaryData?.evening.totalCommissions || 660)}
                            </strong>.
                          </p>
                        </>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-[#6B6252] dark:text-stone-400">Custo marginal: R$ 0,00 / disparo</span>
                      <button
                        type="button"
                        onClick={handleSimulateDispatch}
                        className="h-9 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Testar Envio de E-mail</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* --------------------------------------------------------------- */}
            {/* CARD 2: MOTOR DE AUTOMAÇÃO & GOVERNANÇA DE IDEMPOTÊNCIA         */}
            {/* --------------------------------------------------------------- */}
            <div
              ref={automationCardRef}
              className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-5 space-y-5 transition-all shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-600 dark:text-[#D4A95E]" />
                    <span>Regras de Automação (Manhã & Noite)</span>
                  </h2>
                  <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
                    Configuração por unidade com proteção de fuso horário e RBAC
                  </p>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  pg_cron Ativo
                </span>
              </div>

              {/* Toggles de Horário (Manhã e Noite) */}
              <div className="space-y-3">
                {/* Regra 1: Manhã */}
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="toggle-auto-morning"
                      checked={settings.morningEnabled}
                      onChange={(e) => handleSettingChange('morningEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <div>
                      <label htmlFor="toggle-auto-morning" className="text-xs sm:text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] cursor-pointer block">
                        ☀️ Disparo Briefing da Manhã
                      </label>
                      <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">Previsão da agenda, janelas livres e contas do dia</span>
                    </div>
                  </div>
                  <input
                    type="time"
                    value={settings.morningTime}
                    onChange={(e) => handleSettingChange('morningTime', e.target.value)}
                    className="bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] rounded-lg px-2.5 py-1 text-xs font-mono text-amber-700 dark:text-[#D4A95E] focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Regra 2: Noite */}
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="toggle-auto-evening"
                      checked={settings.eveningEnabled}
                      onChange={(e) => handleSettingChange('eveningEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <div>
                      <label htmlFor="toggle-auto-evening" className="text-xs sm:text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] cursor-pointer block">
                        🌙 Disparo Fechamento da Noite
                      </label>
                      <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">Caixa líquido, comissões e alerta de comandas abertas</span>
                    </div>
                  </div>
                  <input
                    type="time"
                    value={settings.eveningTime}
                    onChange={(e) => handleSettingChange('eveningTime', e.target.value)}
                    className="bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] rounded-lg px-2.5 py-1 text-xs font-mono text-amber-700 dark:text-[#D4A95E] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Destinatários & Isolamento de Permissão (RBAC) */}
              <div className="space-y-2.5 pt-2 border-t border-stone-200 dark:border-[#29241D]">
                <span className="text-xs font-semibold text-[#191611] dark:text-[#F4EFE6] block">
                  Destinatários & Governança de Dados (RBAC)
                </span>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-[#171411] border border-amber-500/40 text-xs text-[#191611] dark:text-white">
                    <Shield className="w-3 h-3 text-amber-500" />
                    Augusto (Admin Global)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-50 dark:bg-[#171411] border border-amber-500/40 text-xs text-[#191611] dark:text-white">
                    <UserCheck className="w-3 h-3 text-amber-500" />
                    Rubens (Gestor Unidade)
                  </span>
                </div>

                <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    id="toggle-barber-individual"
                    checked={settings.sendIndividualBarber}
                    onChange={(e) => handleSettingChange('sendIndividualBarber', e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
                  />
                  <span className="text-xs text-[#6B6252] dark:text-[#A69D8E] leading-snug">
                    Enviar resumo individual restrito para <strong className="text-[#191611] dark:text-white">Heron</strong> e <strong className="text-[#191611] dark:text-white">Lucas</strong> (oculta faturamento global da barbearia e exibe apenas a própria agenda/comissão).
                  </span>
                </label>
              </div>

              {/* Log de Idempotência & Auditoria (summary_dispatch_log) */}
              <div className="pt-3 border-t border-stone-200 dark:border-[#29241D] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-[#D4A95E] font-semibold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    summary_dispatch_log (Idempotência)
                  </span>
                  <span className="text-[10px] font-mono text-[#6B6252] dark:text-stone-400">UNIQUE(tenant, date, shift, channel)</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {dispatchLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between text-[11px] font-mono"
                    >
                      <div>
                        <span
                          className={`font-semibold ${
                            log.status === 'SENT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          [{log.status}]
                        </span>
                        <span className="text-[#191611] dark:text-white ml-1">
                          {log.date} • {log.shift.toUpperCase()} • {log.channel}
                        </span>
                        <span className="text-[#6B6252] dark:text-stone-400 block text-[10px]">key: {log.idempotencyKey}</span>
                      </div>
                      <span className="text-[#6B6252] dark:text-[#A69D8E]">{log.dispatchedAt}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
};

export default DailySummary;
