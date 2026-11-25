import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sunrise, Moon, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { dailySummaryService } from '../services/dailySummaryService';
import { businessDateInTimeZone } from '../shared/dates/timezone';
import type {
  DailySummaryPayload,
  ShiftType,
  PreviewChannel,
  DispatchLogItem,
  AutomationSettings,
} from '../src/types/dailySummary';
import { DailySummaryHeader } from '../components/daily-summary/DailySummaryHeader';
import { MorningSummaryPanel } from '../components/daily-summary/MorningSummaryPanel';
import { EveningSummaryPanel } from '../components/daily-summary/EveningSummaryPanel';
import { DispatchPreviewCard } from '../components/daily-summary/DispatchPreviewCard';
import { AutomationSettingsCard } from '../components/daily-summary/AutomationSettingsCard';

const shiftBusinessDate = (dateIso: string, deltaDays: number): string => {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return businessDateInTimeZone(dt);
};

export const DailySummary: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? null;
  const tenantName = tenant?.name || 'Minha Barbearia';

  const todayIso = useMemo(() => businessDateInTimeZone(), []);
  const yesterdayIso = useMemo(() => shiftBusinessDate(todayIso, -1), [todayIso]);
  const tomorrowIso = useMemo(() => shiftBusinessDate(todayIso, 1), [todayIso]);

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [activeShift, setActiveShift] = useState<ShiftType>('morning');
  const [activeChannel, setActiveChannel] = useState<PreviewChannel>('WHATSAPP');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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

  const [toast, setToast] = useState<{ visible: boolean; title: string; subtitle: string }>({
    visible: false,
    title: '',
    subtitle: '',
  });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const automationCardRef = useRef<HTMLDivElement | null>(null);

  const showToast = (title: string, subtitle: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible: true, title, subtitle });
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3200);
  };

  const loadData = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await dailySummaryService.getDailySummary(tenantId, selectedDate, tenantName);
      setSummaryData(data);
      setSettings(data.automationSettings);
      setDispatchLogs(data.recentLogs);
    } catch (err) {
      console.error('Erro ao carregar resumo diário:', err);
      setError('Não foi possível carregar os dados do resumo diário para esta data.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedDate, tenantName]);

  useEffect(() => {
    loadData();
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [loadData]);

  const whatsappText = useMemo(() => {
    if (!summaryData) return '';
    return activeShift === 'morning'
      ? dailySummaryService.formatWhatsAppMorningMessage(summaryData)
      : dailySummaryService.formatWhatsAppEveningMessage(summaryData);
  }, [summaryData, activeShift]);

  const copyToClipboard = async () => {
    if (!whatsappText) return;
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

  const handleSimulateDispatch = async () => {
    if (!tenantId) return;
    const res = await dailySummaryService.recordDispatch(
      tenantId,
      selectedDate,
      activeShift,
      activeChannel
    );

    setDispatchLogs((prev) => [res.item, ...prev]);

    if (res.wasDuplicate) {
      showToast(
        'Envio já registrado para esta data',
        `Já existe um disparo de ${activeChannel} neste turno em ${selectedDate}.`
      );
    } else {
      showToast(
        `Disparo ${activeChannel} registrado!`,
        `Registrado para ${selectedDate} no horário de Brasília (UTC-3).`
      );
    }
  };

  const handleSettingChange = async (key: keyof AutomationSettings, value: unknown) => {
    if (!tenantId) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await dailySummaryService.saveAutomationSettings(tenantId, updated);
    showToast('Automação atualizada', 'Configurações de horário e envio salvas com sucesso.');
  };

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
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-ink dark:text-white transition-colors duration-200 pb-20">
      <DailySummaryHeader
        tenantName={tenantName}
        formattedDate={summaryData?.formattedDate || selectedDate}
        selectedDate={selectedDate}
        todayIso={todayIso}
        yesterdayIso={yesterdayIso}
        tomorrowIso={tomorrowIso}
        activeShift={activeShift}
        settings={settings}
        openComandasCount={summaryData?.evening?.openComandas?.length ?? 0}
        headerCopyLabel={headerCopyLabel}
        canCopy={Boolean(summaryData)}
        loading={loading}
        onSelectDate={setSelectedDate}
        onShiftDate={(delta) => setSelectedDate((d) => shiftBusinessDate(d, delta))}
        onSelectShift={setActiveShift}
        onCopy={copyToClipboard}
        onFocusAutomation={focusAutomationPanel}
        onRefresh={loadData}
      />

      {toast.visible && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border-dark shadow-2xl text-xs sm:text-sm text-ink animate-in fade-in slide-in-from-bottom-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-dark shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold">{toast.title}</p>
            <p className="text-xs text-ink-soft font-mono">{toast.subtitle}</p>
          </div>
        </div>
      )}

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="mb-6 rounded-2xl bg-card border border-line p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary-dark shrink-0">
              {activeShift === 'morning' ? <Sunrise className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6]">
                  {activeShift === 'morning'
                    ? 'Briefing da Manhã (Previsão, Ocupação e Alertas do Dia)'
                    : 'Fechamento da Noite (Caixa Realizado, Comissões e Auditoria)'}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary-dark border border-primary/30">
                  {activeShift === 'morning' ? `Disparo ${settings.morningTime}` : `Disparo ${settings.eveningTime}`}
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                {activeShift === 'morning'
                  ? 'Mostra a previsão real da agenda, janelas livres por profissional, clientes do Clube dos Chefes e despesas vencendo na data.'
                  : 'Separa dinheiro real no caixa de créditos do Clube dos Chefes e destaca comandas em aberto antes de encerrar o turno.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 text-xs font-mono text-[#6B6252] dark:text-stone-400">
            <span className="px-2.5 py-1 rounded-lg bg-surface-dark border border-border-dark">
              Data: <strong className="text-primary-dark">{selectedDate}</strong>
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-danger/20 border border-danger/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-danger text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="h-9 px-4 rounded-xl bg-danger hover:bg-danger/90 text-white text-xs font-semibold cursor-pointer shrink-0 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {loading && !summaryData && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-card border border-line" />
                ))}
              </div>
              <div className="h-64 rounded-2xl bg-card border border-line" />
            </div>
            <div className="lg:col-span-5 space-y-6">
              <div className="h-80 rounded-2xl bg-card border border-line" />
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-start ${loading && !summaryData ? 'hidden' : ''}`}>
          <div className="lg:col-span-7 space-y-6">
            {activeShift === 'morning' && summaryData && (
              <MorningSummaryPanel morning={summaryData.morning} />
            )}
            {activeShift === 'evening' && summaryData && (
              <EveningSummaryPanel
                evening={summaryData.evening}
                onInspectComandas={() => navigate('/comandas')}
              />
            )}
          </div>

          <div className="lg:col-span-5 space-y-6">
            <DispatchPreviewCard
              tenantName={tenantName}
              selectedDate={selectedDate}
              activeShift={activeShift}
              activeChannel={activeChannel}
              settings={settings}
              summaryData={summaryData}
              whatsappText={whatsappText}
              onSelectChannel={setActiveChannel}
              onCopy={copyToClipboard}
              onDispatch={handleSimulateDispatch}
            />

            <AutomationSettingsCard
              cardRef={automationCardRef}
              tenantName={tenantName}
              selectedDate={selectedDate}
              settings={settings}
              dispatchLogs={dispatchLogs}
              onSettingChange={handleSettingChange}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DailySummary;
