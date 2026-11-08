import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import {
  Bot,
  Zap,
  Sliders,
  FileCode,
  ListOrdered,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  MessageSquare,
  Mail,
  Send,
  Copy,
  Check,
  Save,
  RefreshCw,
  Search,
  ExternalLink,
  Smartphone,
  Server,
  Lock,
  ChevronRight,
  Sparkles,
  QrCode,
  X,
  BatteryCharging,
  Wifi,
  Power,
  Play,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { automationHubService } from '../services/automationHubService';
import type {
  AutomationRule,
  AutomationTemplate,
  DispatchQueueItem,
  ConnectionSettings,
  AutomationCategory,
  ChannelType,
} from '../src/types/automations';

export const Automations: React.FC = () => {
  const { tenant } = useAuth();
  const tenantId = tenant?.id || 'sanchez-barber-default';
  const tenantName = tenant?.name || 'Sanchez Barber';

  const [activeTab, setActiveTab] = useState<'rules' | 'templates' | 'queue' | 'connections'>('rules');
  const [loading, setLoading] = useState<boolean>(true);

  // Dados
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [queue, setQueue] = useState<DispatchQueueItem[]>([]);
  const [connections, setConnections] = useState<ConnectionSettings>({
    whatsappStatus: 'connected',
    whatsappPhoneNumber: '+55 11 98888-7777 (Unidade Parque Cisper)',
    resendStatus: 'active',
    senderEmail: 'resumos@soumanager.com.br',
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    dailyRateLimit: 500,
  });

  // Filtros
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tmpl-no-show-d1');
  const [editedTemplateContent, setEditedTemplateContent] = useState<string>('');
  const [queueSearch, setQueueSearch] = useState<string>('');

  // Modais de Integração WhatsApp
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [qrTimer, setQrTimer] = useState<number>(45);
  const [qrToken, setQrToken] = useState<string>('smg_wa_pairing_token_initial_2026');

  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState<string>('11987654321');
  const [testRecipientName, setTestRecipientName] = useState<string>('Augusto (Gestor)');

  // Toast
  const [toast, setToast] = useState<{ visible: boolean; title: string; subtitle: string }>({
    visible: false,
    title: '',
    subtitle: '',
  });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      const [r, t, q, c] = await Promise.all([
        automationHubService.getRules(tenantId),
        automationHubService.getTemplates(tenantId),
        automationHubService.getQueue(tenantId),
        automationHubService.getSettings(tenantId),
      ]);
      setRules(r);
      setTemplates(t);
      setQueue(q);
      setConnections(c);

      const currentTmpl = t.find((item) => item.id === selectedTemplateId) || t[0];
      if (currentTmpl) {
        setSelectedTemplateId(currentTmpl.id);
        setEditedTemplateContent(currentTmpl.content);
      }
    } catch (err) {
      console.error('Erro ao carregar central de automações:', err);
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

  // Timer do QR Code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isQrModalOpen && qrTimer > 0) {
      interval = setInterval(() => {
        setQrTimer((prev) => prev - 1);
      }, 1000);
    } else if (isQrModalOpen && qrTimer === 0) {
      // Renovar QR Code
      setQrToken(`smg_wa_token_${Date.now()}`);
      setQrTimer(45);
    }
    return () => clearInterval(interval);
  }, [isQrModalOpen, qrTimer]);

  // Alternar toggle de regra
  const handleToggleRule = async (ruleId: string) => {
    const updated = await automationHubService.toggleRule(tenantId, ruleId);
    setRules(updated);
    const rule = updated.find((r) => r.id === ruleId);
    showToast(
      rule?.enabled ? 'Automação Ativada' : 'Automação Pausada',
      `${rule?.name} agora está ${rule?.enabled ? 'ativa' : 'em pausa'}.`
    );
  };

  // Selecionar template para edição
  const handleSelectTemplate = (tmpl: AutomationTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setEditedTemplateContent(tmpl.content);
  };

  // Inserir variável no template
  const handleInsertVariable = (variable: string) => {
    setEditedTemplateContent((prev) => prev + ` ${variable} `);
  };

  // Salvar template editado
  const handleSaveTemplate = async () => {
    const currentTmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!currentTmpl) return;

    const updatedTemplate: AutomationTemplate = {
      ...currentTmpl,
      content: editedTemplateContent,
    };

    const updatedList = await automationHubService.saveTemplate(tenantId, updatedTemplate);
    setTemplates(updatedList);
    showToast('Template Salvo', 'O texto da automação foi atualizado com sucesso.');
  };

  // Salvar configurações de conexão/proteção
  const handleSaveSettings = async (updated: ConnectionSettings) => {
    setConnections(updated);
    await automationHubService.updateSettings(tenantId, updated);
    showToast('Configurações Atualizadas', 'Regras de proteção e conexões salvas.');
  };

  // Confirmar pareamento do QR Code
  const handleConfirmQrPairing = async () => {
    const phone = '+55 11 98888-7777 (Unidade Parque Cisper)';
    const updated = await automationHubService.connectWhatsApp(tenantId, phone);
    setConnections(updated);
    setIsQrModalOpen(false);
    showToast('WhatsApp Conectado!', 'Instância pareada e pronta para disparos automáticos.');
  };

  // Desconectar WhatsApp
  const handleDisconnectWhatsApp = async () => {
    const updated = await automationHubService.disconnectWhatsApp(tenantId);
    setConnections(updated);
    showToast('WhatsApp Desconectado', 'A instância foi desconectada.');
  };

  // Disparo de Teste Real
  const handleExecuteTestDispatch = async (mode: 'direct' | 'api') => {
    const previewText = editedTemplateContent
      .replace('{{cliente}}', testRecipientName)
      .replace('{{horario}}', '15:00')
      .replace('{{barbeiro}}', 'Rubens Sanchez')
      .replace('{{servico}}', 'Corte + Barba')
      .replace('{{unidade}}', tenantName)
      .replace('{{endereco_unidade}}', 'Rua Cisper, 120')
      .replace('{{link_avaliacao}}', 'https://smg.app/r/sanchez')
      .replace('{{total_agendados}}', '8')
      .replace('{{primeiro_horario}}', '09:00')
      .replace('{{ultimo_horario}}', '19:30')
      .replace('{{total_clube}}', '3')
      .replace('{{horarios_livres}}', '15:30')
      .replace('{{dias_sem_visita}}', '28')
      .replace('{{link_agendamento}}', 'https://smg.app/agendar/sanchez')
      .replace('{{plano}}', 'Plano Gold')
      .replace('{{creditos}}', '4');

    const cleanPhone = testPhoneNumber.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    if (mode === 'direct') {
      const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(previewText)}`;
      window.open(url, '_blank');
    }

    // Registra na fila de auditoria
    const newLogItem: DispatchQueueItem = {
      id: `test-${Date.now()}`,
      automationName: `[TESTE] ${activeTemplate.name}`,
      recipientName: testRecipientName,
      recipientContact: fullPhone,
      channel: 'whatsapp',
      status: 'delivered',
      scheduledFor: 'Imediato',
      sentAt: new Date().toLocaleTimeString('pt-BR') + ' BRT',
      idempotencyKey: `test_${Date.now()}`,
    };

    const updatedQueue = await automationHubService.addQueueItem(tenantId, newLogItem);
    setQueue(updatedQueue);

    setIsTestModalOpen(false);
    showToast('Disparo de Teste Enviado!', `Mensagem entregue com sucesso para ${testRecipientName}.`);
  };

  // Template ativo selecionado
  const activeTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  // Regras filtradas
  const filteredRules = rules.filter((r) => {
    if (selectedCategory === 'all') return true;
    return r.category === selectedCategory;
  });

  // Fila filtrada
  const filteredQueue = queue.filter((q) => {
    if (!queueSearch) return true;
    const term = queueSearch.toLowerCase();
    return (
      q.recipientName.toLowerCase().includes(term) ||
      q.automationName.toLowerCase().includes(term) ||
      q.recipientContact.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-[#FAF6EE] dark:bg-[#0B0A09] text-[#191611] dark:text-[#F4EFE6] transition-colors duration-200 pb-20">

      {/* Header da Central de Automações */}
      <header className="sticky top-0 z-40 border-b border-[#E8DFC9] dark:border-[#29241D] bg-[#FAF6EE]/95 dark:bg-[#0B0A09]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-[#D4A95E] shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-amber-600 dark:text-[#D4A95E] font-semibold">
                    {tenantName} • Automações de Alta Precisão
                  </span>
                  {connections.whatsappStatus === 'connected' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                      <Radio className="w-3 h-3 animate-pulse text-emerald-500" />
                      WhatsApp Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      WhatsApp Desconectado
                    </span>
                  )}
                </div>
                <h1 className="text-base sm:text-lg font-bold text-[#191611] dark:text-[#F4EFE6] mt-0.5">
                  Central de Automações & Disparos
                </h1>
              </div>
            </div>

            {/* Navegação por Abas Principais */}
            <div className="inline-flex p-1 rounded-xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D]">
              <button
                type="button"
                onClick={() => setActiveTab('rules')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'rules'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Réguas & Gatilhos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'templates'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                }`}
              >
                <FileCode className="w-4 h-4" />
                <span>Templates</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'queue'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                <span>Fila & Auditoria</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('connections')}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'connections'
                    ? 'bg-amber-500 text-stone-950 shadow-sm'
                    : 'text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Conexões & Proteção</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Toast Feedback */}
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

      {/* Conteúdo Principal */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">

        {/* =================================================================== */}
        {/* ABA 1: RÉGUAS & GATILHOS                                            */}
        {/* =================================================================== */}
        {activeTab === 'rules' && (
          <div className="space-y-6 animate-in fade-in duration-200">

            {/* Filtros de Categoria */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'Todas as Automações' },
                  { id: 'client', label: 'Anti-No-Show & Clientes' },
                  { id: 'operational', label: 'Operacional & Barbeiros' },
                  { id: 'retention', label: 'Retenção & Clube' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-amber-500 text-stone-950 shadow-xs'
                        : 'bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] text-[#6B6252] dark:text-[#A69D8E] hover:text-black dark:hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Disparo de Teste</span>
                </button>

                <span className="text-xs font-mono text-[#6B6252] dark:text-stone-400">
                  {rules.filter((r) => r.enabled).length} de {rules.length} automações ativas
                </span>
              </div>
            </div>

            {/* Grid de Regras */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    rule.enabled
                      ? 'bg-white dark:bg-[#12100E] border-[#E8DFC9] dark:border-[#29241D] shadow-xs'
                      : 'bg-stone-100/60 dark:bg-[#0E0C0A] border-stone-200 dark:border-stone-800 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase ${
                            rule.category === 'client'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : rule.category === 'operational'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-[#D4A95E] border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {rule.category === 'client' ? 'Cliente' : rule.category === 'operational' ? 'Operacional' : 'Retenção'}
                        </span>
                        {rule.channels.map((ch) => (
                          <span
                            key={ch}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#171411] text-[#6B6252] dark:text-[#A69D8E] border border-[#E8DFC9] dark:border-[#29241D]"
                          >
                            {ch === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                          </span>
                        ))}
                      </div>
                      <h3 className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6] leading-tight">
                        {rule.name}
                      </h3>
                    </div>

                    {/* Switch Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.enabled ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          rule.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-[#6B6252] dark:text-[#A69D8E] leading-relaxed mb-4">
                    {rule.description}
                  </p>

                  <div className="pt-3 border-t border-stone-100 dark:border-[#29241D]/70 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-[#6B6252] dark:text-stone-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-[#D4A95E]" />
                      {rule.triggerDescription}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(rule.templateId);
                        const tmpl = templates.find((t) => t.id === rule.templateId);
                        if (tmpl) setEditedTemplateContent(tmpl.content);
                        setActiveTab('templates');
                      }}
                      className="text-amber-700 dark:text-[#D4A95E] hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver Template</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 2: BIBLIOTECA & EDITOR DE TEMPLATES                             */}
        {/* =================================================================== */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">

            {/* Lista Lateral de Templates (4 colunas) */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-wider text-[#6B6252] dark:text-stone-400 font-semibold mb-2">
                Modelos de Mensagem
              </h2>
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    tmpl.id === selectedTemplateId
                      ? 'bg-white dark:bg-[#12100E] border-amber-500 shadow-sm ring-1 ring-amber-500/50'
                      : 'bg-white dark:bg-[#12100E] border-[#E8DFC9] dark:border-[#29241D] hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-[#D4A95E]">
                      {tmpl.channel.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-[#6B6252] dark:text-stone-400">
                      {tmpl.availableVariables.length} variáveis
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#191611] dark:text-[#F4EFE6] truncate">
                    {tmpl.name}
                  </h3>
                </div>
              ))}
            </div>

            {/* Editor & Preview (8 colunas) */}
            <div className="lg:col-span-8 space-y-6">

              {/* Card Editor */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-[#29241D] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">
                      {activeTemplate.name}
                    </h3>
                    <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
                      Edite a mensagem e insira as variáveis dinâmicas com um clique.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTestModalOpen(true)}
                      className="h-9 px-3.5 rounded-xl bg-white dark:bg-[#171411] hover:bg-stone-100 dark:hover:bg-[#1E1A16] border border-amber-500/50 text-amber-700 dark:text-[#D4A95E] font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Testar Envio Real</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    >
                      <Save className="w-4 h-4" />
                      <span>Salvar Template</span>
                    </button>
                  </div>
                </div>

                {/* Variáveis Dinâmicas Clicáveis */}
                <div>
                  <span className="text-xs font-semibold text-[#191611] dark:text-[#F4EFE6] block mb-1.5">
                    Tags Dinâmicas (Clique para inserir no texto):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.availableVariables.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v)}
                        className="px-2 py-1 rounded-lg bg-stone-100 dark:bg-[#171411] hover:bg-amber-500/20 border border-[#E8DFC9] dark:border-[#29241D] text-xs font-mono text-amber-700 dark:text-[#D4A95E] transition-colors cursor-pointer"
                        title="Clique para adicionar ao final do texto"
                      >
                        + {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <label className="text-xs font-semibold text-[#191611] dark:text-[#F4EFE6] block mb-1">
                    Conteúdo do Template:
                  </label>
                  <textarea
                    rows={6}
                    value={editedTemplateContent}
                    onChange={(e) => setEditedTemplateContent(e.target.value)}
                    className="w-full p-3.5 rounded-xl bg-stone-50 dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] text-xs font-sans text-[#191611] dark:text-[#F4EFE6] focus:outline-none focus:border-amber-500 leading-relaxed font-mono"
                  />
                </div>
              </div>

              {/* Preview Realista do Template */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-2">
                  <span className="text-xs font-bold text-[#191611] dark:text-[#F4EFE6] flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    Preview Visual no WhatsApp
                  </span>
                  <span className="text-[11px] font-mono text-[#6B6252] dark:text-stone-400">
                    Renderização em Tempo Real
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#EFEAE2] dark:bg-[#0E0C0A]">
                  <div className="rounded-xl bg-white dark:bg-[#161310] border border-stone-300 dark:border-amber-500/30 p-3.5 shadow-sm max-w-lg">
                    <pre className="text-xs font-sans text-stone-900 dark:text-[#F4EFE6] whitespace-pre-wrap leading-relaxed">
                      {editedTemplateContent
                        .replace('{{cliente}}', 'Gustavo')
                        .replace('{{horario}}', '14:30')
                        .replace('{{barbeiro}}', 'Rubens Sanchez')
                        .replace('{{servico}}', 'Corte + Barba')
                        .replace('{{unidade}}', tenantName)
                        .replace('{{endereco_unidade}}', 'Rua Cisper, 120')
                        .replace('{{link_avaliacao}}', 'https://smg.app/r/sanchez')
                        .replace('{{total_agendados}}', '8')
                        .replace('{{primeiro_horario}}', '09:00')
                        .replace('{{ultimo_horario}}', '19:30')
                        .replace('{{total_clube}}', '3')
                        .replace('{{horarios_livres}}', '15:30')
                        .replace('{{dias_sem_visita}}', '28')
                        .replace('{{link_agendamento}}', 'https://smg.app/agendar/sanchez')
                        .replace('{{plano}}', 'Plano Gold')
                        .replace('{{creditos}}', '4')}
                    </pre>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 3: FILA & AUDITORIA DE DISPAROS                                 */}
        {/* =================================================================== */}
        {activeTab === 'queue' && (
          <div className="space-y-4 animate-in fade-in duration-200">

            {/* Header com Busca */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#6B6252] dark:text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por destinatário, telefone ou automação..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Novo Disparo de Teste</span>
                </button>

                <span className="text-xs font-mono text-[#6B6252] dark:text-stone-400">
                  Trava de Idempotência: <code className="text-amber-700 dark:text-[#D4A95E]">UNIQUE(tenant, key)</code>
                </span>
              </div>
            </div>

            {/* Tabela de Disparos */}
            <div className="rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 dark:border-[#29241D] bg-stone-50 dark:bg-[#171411] text-[11px] font-mono uppercase text-[#6B6252] dark:text-stone-400">
                      <th className="py-3 px-4">Destinatário</th>
                      <th className="py-3 px-4">Regra de Disparo</th>
                      <th className="py-3 px-4 text-center">Canal</th>
                      <th className="py-3 px-4">Horário / Disparo</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Idempotência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-[#29241D]/70 font-sans">
                    {filteredQueue.map((item) => (
                      <tr key={item.id} className="hover:bg-stone-50/50 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#191611] dark:text-[#F4EFE6] block">
                            {item.recipientName}
                          </span>
                          <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E] font-mono">
                            {item.recipientContact}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#191611] dark:text-[#F4EFE6]">
                          {item.automationName}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-[#171411] border border-stone-200 dark:border-[#29241D] uppercase">
                            {item.channel}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#6B6252] dark:text-[#A69D8E]">
                          {item.sentAt || item.scheduledFor}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                              item.status === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : item.status === 'sent'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {item.status === 'delivered' && <CheckCircle2 className="w-3 h-3" />}
                            {item.status === 'skipped_duplicate' && <AlertTriangle className="w-3 h-3" />}
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-[#6B6252] dark:text-stone-400">
                          {item.idempotencyKey}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* ABA 4: CONEXÕES & PROTEÇÃO                                          */}
        {/* =================================================================== */}
        {activeTab === 'connections' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-200">

            {/* Status Conexão WhatsApp */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">
                      WhatsApp Gateway (Baileys / Evolution)
                    </h3>
                    {connections.whatsappStatus === 'connected' ? (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Instância Pareada & Ativa
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Aguardando Conexão
                      </span>
                    )}
                  </div>
                </div>

                {connections.whatsappStatus === 'connected' ? (
                  <button
                    type="button"
                    onClick={handleDisconnectWhatsApp}
                    className="h-8 px-3 rounded-lg border border-red-500/40 hover:bg-red-500/10 text-red-600 text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setQrTimer(45);
                      setIsQrModalOpen(true);
                    }}
                    className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Parear via QR Code</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-[#29241D]/70">
                  <span className="text-[#6B6252] dark:text-[#A69D8E]">Número Pareado:</span>
                  <span className="font-mono font-semibold text-[#191611] dark:text-white">
                    {connections.whatsappPhoneNumber || 'Nenhum número conectado'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-[#29241D]/70">
                  <span className="text-[#6B6252] dark:text-[#A69D8E]">Saúde da Conexão:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                    Latência: 88ms • Bateria: 94% ⚡
                  </span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setQrTimer(45);
                      setIsQrModalOpen(true);
                    }}
                    className="text-amber-700 dark:text-[#D4A95E] hover:underline font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Exibir QR Code de Pareamento</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTestModalOpen(true)}
                    className="text-[#191611] dark:text-white hover:text-amber-600 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-500" />
                    <span>Disparo de Teste</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Status E-mail Executivo (Resend) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">
                      E-mail Executivo (Resend TLS)
                    </h3>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Domínio Autenticado (SPF/DKIM)
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-[#29241D]/70">
                  <span className="text-[#6B6252] dark:text-[#A69D8E]">Remetente Oficial:</span>
                  <span className="font-mono font-semibold text-[#191611] dark:text-white">
                    {connections.senderEmail}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-stone-100 dark:border-[#29241D]/70">
                  <span className="text-[#6B6252] dark:text-[#A69D8E]">Custo Marginal:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    R$ 0,00 (Plano Free até 3.000 envios/mês)
                  </span>
                </div>
                <div className="pt-2">
                  <span className="text-[11px] text-[#6B6252] dark:text-stone-400 block">
                    Utilizado para os relatórios do Briefing Matinal e Fechamento da Noite.
                  </span>
                </div>
              </div>
            </div>

            {/* Governança: Horário Silencioso (Do Not Disturb) */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-3">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-500" />
                  <div>
                    <h3 className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">
                      Proteção Anti-Spam & Horário Silencioso (Do Not Disturb)
                    </h3>
                    <p className="text-xs text-[#6B6252] dark:text-[#A69D8E]">
                      Bloqueia disparos em horários inoportunos para proteger a reputação do número no WhatsApp.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveSettings({
                      ...connections,
                      quietHoursEnabled: !connections.quietHoursEnabled,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    connections.quietHoursEnabled ? 'bg-amber-500' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      connections.quietHoursEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between">
                  <span className="text-[#6B6252] dark:text-[#A69D8E]">Início do Silêncio:</span>
                  <input
                    type="time"
                    value={connections.quietHoursStart}
                    onChange={(e) =>
                      handleSaveSettings({ ...connections, quietHoursStart: e.target.value })
                    }
                    className="bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] rounded-lg px-2 py-1 font-mono text-amber-700 dark:text-[#D4A95E]"
                  />
                </div>

                <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#171411] border border-[#E8DFC9] dark:border-[#29241D] flex items-center justify-between">
                  <span className="text-[#6B6252] dark:text-[#A69D8E]">Fim do Silêncio:</span>
                  <input
                    type="time"
                    value={connections.quietHoursEnd}
                    onChange={(e) =>
                      handleSaveSettings({ ...connections, quietHoursEnd: e.target.value })
                    }
                    className="bg-white dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] rounded-lg px-2 py-1 font-mono text-amber-700 dark:text-[#D4A95E]"
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* ======================================================================= */}
      {/* MODAL 1: PAREAMENTO WHATSAPP VIA QR CODE                                */}
      {/* ======================================================================= */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">
                    Conectar WhatsApp da Barbearia
                  </h3>
                  <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">
                    Sincronização direta via WhatsApp Web
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Container do QR Code */}
            <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-stone-100 dark:bg-[#171411] border border-stone-200 dark:border-[#29241D]">
              <div className="p-3 bg-white rounded-xl shadow-md">
                <QRCode
                  value={`whatsapp-pairing://${qrToken}?unit=${encodeURIComponent(tenantName)}`}
                  size={190}
                  level="M"
                />
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs font-mono text-[#6B6252] dark:text-[#A69D8E]">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Atualiza em <strong className="text-amber-600 dark:text-amber-400">{qrTimer}s</strong></span>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setQrToken(`smg_wa_token_${Date.now()}`);
                    setQrTimer(45);
                  }}
                  className="text-amber-700 dark:text-[#D4A95E] hover:underline cursor-pointer"
                >
                  Renovar Agora
                </button>
              </div>
            </div>

            {/* Instruções passo a passo */}
            <div className="space-y-1.5 text-xs text-[#6B6252] dark:text-[#A69D8E]">
              <p className="font-semibold text-[#191611] dark:text-white">Instruções:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abra o WhatsApp no smartphone da barbearia</li>
                <li>Toque em <strong>Aparelhos Conectados</strong> &gt; <strong>Conectar um Aparelho</strong></li>
                <li>Aponte a câmera para este QR Code</li>
              </ol>
            </div>

            {/* Ações */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="flex-1 h-10 rounded-xl border border-stone-300 dark:border-[#29241D] text-xs font-semibold hover:bg-stone-100 dark:hover:bg-[#1E1A16] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmQrPairing}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Conectar Instância</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* MODAL 2: DISPARO DE TESTE REAL NO WHATSAPP                              */}
      {/* ======================================================================= */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12100E] border border-[#E8DFC9] dark:border-[#29241D] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-[#29241D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#191611] dark:text-[#F4EFE6]">
                    Disparo de Teste Real
                  </h3>
                  <span className="text-[11px] text-[#6B6252] dark:text-[#A69D8E]">
                    Template: {activeTemplate.name}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#191611] dark:text-white block mb-1">
                  Nome do Destinatário de Teste:
                </label>
                <input
                  type="text"
                  value={testRecipientName}
                  onChange={(e) => setTestRecipientName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="font-semibold text-[#191611] dark:text-white block mb-1">
                  WhatsApp com DDD (apenas números):
                </label>
                <input
                  type="text"
                  placeholder="Ex: 11987654321"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-[#0B0A09] border border-[#E8DFC9] dark:border-[#29241D] text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-stone-100 dark:bg-[#171411] border border-stone-200 dark:border-[#29241D] text-[11px] text-[#6B6252] dark:text-[#A69D8E]">
                A mensagem será enviada com as tags dinâmicas substituídas pelos dados de teste e registrada na <strong>Fila de Auditoria</strong>.
              </div>
            </div>

            {/* Ações de envio */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleExecuteTestDispatch('direct')}
                className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Abrir e Enviar no WhatsApp Web</span>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteTestDispatch('api')}
                className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Bot className="w-4 h-4" />
                <span>Simular Disparo via Gateway Automático</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Automations;
