import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fiscalService } from '../domain/fiscal/fiscalService';
import type {
  ComandaFiscalInvoice,
  FiscalDashboardKPIs,
  FiscalInvoiceStatus,
  FiscalSettings,
  FiscalTaxRegime,
} from '../domain/fiscal/types';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const StatusBadge: React.FC<{ status: FiscalInvoiceStatus }> = ({ status }) => {
  const map: Record<FiscalInvoiceStatus, { label: string; icon: string; cls: string }> = {
    issued: {
      label: 'Autorizada',
      icon: 'verified',
      cls: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25',
    },
    processing: {
      label: 'Processando',
      icon: 'hourglass_top',
      cls: 'bg-teal-50 dark:bg-teal-950/25 text-teal-700 dark:text-teal-400 border border-teal-500/25',
    },
    pending: {
      label: 'Na Fila',
      icon: 'schedule',
      cls: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10',
    },
    rejected: {
      label: 'Rejeitada',
      icon: 'error',
      cls: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-500/25',
    },
    cancelled: {
      label: 'Cancelada',
      icon: 'cancel',
      cls: 'bg-slate-200 dark:bg-white/10 text-slate-500 border border-slate-300 dark:border-white/10',
    },
  };

  const current = map[status] || map.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${current.cls}`}
    >
      <span className="material-symbols-outlined text-sm">{current.icon}</span>
      {current.label}
    </span>
  );
};

export const FiscalPage: React.FC = () => {
  const { tenantId, tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'invoices' | 'settings'>('invoices');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Estados dos dados
  const [invoices, setInvoices] = useState<ComandaFiscalInvoice[]>([]);
  const [kpis, setKpis] = useState<FiscalDashboardKPIs>({
    totalIssued: 0,
    totalPending: 0,
    totalRejected: 0,
    totalAmountIssued: 0,
    averageIssPercentage: 2.0,
  });

  const [settings, setSettings] = useState<FiscalSettings>({
    tenant_id: tenantId || '',
    cnpj: '',
    razao_social: '',
    nome_fantasia: tenant?.name?.trim() || '',
    inscricao_municipal: '',
    cnae: '9602-5/01',
    item_lista_servico: '14.01',
    regime_tributario: 'simples_nacional',
    aliquota_iss: 2.0,
    iss_retido: false,
    auto_issue_on_close: true,
    environment: 'sandbox',
    provider: 'mock_sandbox',
  });

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [loadedSettings, loadedInvoices, loadedKpis] = await Promise.all([
        fiscalService.getSettings(tenantId),
        fiscalService.listInvoices(tenantId),
        fiscalService.getDashboardKPIs(tenantId),
      ]);

      if (loadedSettings) {
        setSettings(loadedSettings);
      }
      setInvoices(loadedInvoices);
      setKpis(loadedKpis);
    } catch (err) {
      console.error('Erro ao carregar dados fiscais:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    setSavingSettings(true);
    setFeedbackMsg(null);

    try {
      const saved = await fiscalService.saveSettings({
        ...settings,
        tenant_id: tenantId,
      });
      setSettings(saved);
      setFeedbackMsg({
        type: 'success',
        text: 'Configurações fiscais da barbearia salvas com sucesso!',
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Erro ao salvar configurações fiscais.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRetryInvoice = async (invoiceId: string) => {
    if (!tenantId) return;
    setActionInProgress(invoiceId);
    setFeedbackMsg(null);
    try {
      await fiscalService.retryInvoice(tenantId, invoiceId);
      setFeedbackMsg({
        type: 'success',
        text: 'Nota fiscal reenviada com sucesso para autorização!',
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Erro ao reprocessar nota fiscal.',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        inv.client_name.toLowerCase().includes(q) ||
        (inv.numero_nfse && inv.numero_nfse.includes(q)) ||
        (inv.client_document && inv.client_document.includes(q)) ||
        inv.comanda_id.toLowerCase().includes(q),
    );
  }, [invoices, search]);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Boutique SMG */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(135deg,#FFFDF6_0%,#FAF4E7_58%,#F7F2EA_100%)] p-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,#0E0C07_0%,#1A150F_58%,#14100A_100%)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#A96F14,#D99A2B,#F3D9A4)]" />
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-dark text-xl">receipt_long</span>
              </div>
              <span className="px-3 py-1 bg-white/75 dark:bg-white/10 border border-primary/20 dark:border-primary/30 text-ink text-[11px] font-black rounded-full">
                SMG Conformidade Fiscal
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                <span className="material-symbols-outlined text-xs">bolt</span>
                Motor Assíncrono sem Fricção
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-950 dark:text-white">
              Emissão de NFS-e sem Atrito
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2 max-w-2xl leading-6 text-sm">
              Emissão automática de Notas Fiscais de Serviços Eletrônicas em segundo plano. Zero espera no caixa ou na cadeira, com apuração de ISS e arquivo digital de DANFSe.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'invoices'
                  ? 'bg-primary text-night shadow-md shadow-primary/20'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              Notas Emitidas ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'settings'
                  ? 'bg-primary text-night shadow-md shadow-primary/20'
                  : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              Configurações Fiscais
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
              title="Recarregar dados"
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">
              {feedbackMsg.type === 'success' ? 'check_circle' : 'error'}
            </span>
            {feedbackMsg.text}
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs hover:underline">
            Fechar
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-boutique p-5">
          <div className="size-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">verified</span>
          </div>
          <p className="text-[11px] font-black text-slate-500 mb-1">Notas Autorizadas</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{kpis.totalIssued}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Total faturado: {formatCurrency(kpis.totalAmountIssued)}</p>
        </div>

        <div className="card-boutique p-5">
          <div className="size-11 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-teal-700 dark:text-teal-400">hourglass_top</span>
          </div>
          <p className="text-[11px] font-black text-slate-500 mb-1">Na Fila / Processando</p>
          <p className="text-2xl font-black text-teal-700 dark:text-teal-400">{kpis.totalPending}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Emissão desacoplada em lote</p>
        </div>

        <div className="card-boutique p-5">
          <div className="size-11 rounded-xl bg-[#B88A44]/15 border border-[#B88A44]/30 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[#9A6F2D] dark:text-[#E3C382]">percent</span>
          </div>
          <p className="text-[11px] font-black text-slate-500 mb-1">Alíquota ISS Média</p>
          <p className="text-2xl font-black text-[#9A6F2D] dark:text-[#E3C382]">{settings.aliquota_iss}%</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Regime: {settings.regime_tributario.replace('_', ' ').toUpperCase()}</p>
        </div>

        <div className="card-boutique p-5">
          <div className="size-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-rose-600 dark:text-rose-300">report_problem</span>
          </div>
          <p className="text-[11px] font-black text-slate-500 mb-1">Rejeitadas / Pendências</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-300">{kpis.totalRejected}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Exigem correção de cadastro</p>
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'invoices' ? (
        <div className="space-y-4">
          {/* Barra de Busca */}
          <div className="card-boutique p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar por cliente, CPF, número de nota ou comanda..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="text-xs text-slate-500">
              Exibindo <strong>{filteredInvoices.length}</strong> de {invoices.length} notas
            </div>
          </div>

          {/* Tabela de Notas Fiscais */}
          <div className="card-boutique overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-dark" />
                <p className="text-sm text-slate-500">Carregando histórico fiscal da barbearia...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700">receipt_long</span>
                <p className="text-base font-bold text-slate-700 dark:text-white">Nenhuma nota fiscal emitida ainda</p>
                <p className="text-sm text-slate-500">
                  {search ? 'Nenhum resultado corresponde à sua pesquisa.' : 'As notas geradas automaticamente no balcão ou na cadeira aparecerão aqui.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[11px] font-black text-slate-500 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/5 uppercase tracking-wider">
                      <th className="px-6 py-4">NFS-e / Código</th>
                      <th className="px-6 py-4">Tomador / Cliente</th>
                      <th className="px-6 py-4">Serviços &amp; ISS</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações &amp; Documentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-black text-slate-900 dark:text-white">
                              {inv.numero_nfse ? `Nº ${inv.numero_nfse}` : 'Pendente de Numeração'}
                            </p>
                            {inv.codigo_verificacao && (
                              <p className="text-[11px] text-slate-500 font-mono">
                                Cód: {inv.codigo_verificacao}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400">
                              Comanda: {inv.comanda_id.substring(0, 8)}...
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{inv.client_name}</p>
                            <p className="text-xs text-slate-500 font-mono">
                              {inv.client_document || 'Sem CPF informado'}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-black text-slate-900 dark:text-white">
                              {formatCurrency(inv.valor_servicos)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              ISS ({inv.aliquota_iss}%): {formatCurrency(inv.valor_iss)}
                            </p>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <StatusBadge status={inv.status} />
                            {inv.erro_mensagem && (
                              <p className="text-[11px] text-rose-600 dark:text-rose-400 max-w-xs truncate" title={inv.erro_mensagem}>
                                {inv.erro_mensagem}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.pdf_url && (
                              <a
                                href={inv.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Visualizar DANFSe (PDF)"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                                <span className="hidden sm:inline">PDF</span>
                              </a>
                            )}
                            {inv.xml_url && (
                              <a
                                href={inv.xml_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Baixar XML assinado"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">code</span>
                                <span className="hidden sm:inline">XML</span>
                              </a>
                            )}
                            {inv.status === 'rejected' && (
                              <button
                                onClick={() => handleRetryInvoice(inv.id)}
                                disabled={actionInProgress === inv.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 rounded-lg border border-rose-500/25 transition-colors disabled:opacity-50"
                              >
                                <span className="material-symbols-outlined text-base">replay</span>
                                {actionInProgress === inv.id ? 'Reenviando...' : 'Reemitir'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Formulário de Configurações Fiscais */
        <form onSubmit={handleSaveSettings} className="card-boutique p-6 space-y-6">
          <div className="border-b border-slate-100 dark:border-white/5 pb-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Identificação Fiscal da Barbearia (Prestador de Serviços)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Dados transmitidos nos lotes de NFS-e para a Prefeitura e Receita Federal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                CNPJ do Estabelecimento *
              </label>
              <input
                type="text"
                required
                value={settings.cnpj}
                onChange={(e) => setSettings({ ...settings, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Inscrição Municipal (CCM) *
              </label>
              <input
                type="text"
                required
                value={settings.inscricao_municipal}
                onChange={(e) => setSettings({ ...settings, inscricao_municipal: e.target.value })}
                placeholder="Número de cadastro na prefeitura"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Razão Social *
              </label>
              <input
                type="text"
                required
                value={settings.razao_social}
                onChange={(e) => setSettings({ ...settings, razao_social: e.target.value })}
                placeholder="Razão Social registrada"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nome Fantasia
              </label>
              <input
                type="text"
                value={settings.nome_fantasia}
                onChange={(e) => setSettings({ ...settings, nome_fantasia: e.target.value })}
                placeholder="Nome fantasia da barbearia"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Regime Tributário *
              </label>
              <select
                value={settings.regime_tributario}
                onChange={(e) =>
                  setSettings({ ...settings, regime_tributario: e.target.value as FiscalTaxRegime })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="simples_nacional">Simples Nacional (Padrão)</option>
                <option value="mei">Microempreendedor Individual (MEI)</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Alíquota de ISS (%) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                required
                value={settings.aliquota_iss}
                onChange={(e) =>
                  setSettings({ ...settings, aliquota_iss: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Item da Lista de Serviços (LC 116)
              </label>
              <input
                type="text"
                value={settings.item_lista_servico}
                onChange={(e) => setSettings({ ...settings, item_lista_servico: e.target.value })}
                placeholder="14.01"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Padrão 14.01: Serviços de cuidados pessoais, corte de cabelo, estética masculina e manicure.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                CNAE Principal
              </label>
              <input
                type="text"
                value={settings.cnae}
                onChange={(e) => setSettings({ ...settings, cnae: e.target.value })}
                placeholder="9602-5/01"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                CNAE 9602-5/01: Cabeleireiros, barbearias e tratamento de beleza.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
            <h4 className="text-sm font-black text-slate-900 dark:text-white">
              Regras de Automação &amp; Desacoplamento
            </h4>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_issue_on_close}
                onChange={(e) => setSettings({ ...settings, auto_issue_on_close: e.target.checked })}
                className="size-5 rounded text-primary focus:ring-primary accent-[#D99A2B]"
              />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  Emitir NFS-e automaticamente ao liquidar comanda
                </p>
                <p className="text-xs text-slate-500">
                  Gera o evento na fila outbox fiscal imediatamente após o pagamento sem travar o operador.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3 bg-gradient-to-r from-primary to-primary-dark hover:brightness-105 text-night font-bold rounded-xl text-sm transition-all shadow-md shadow-primary/20 disabled:opacity-50"
            >
              {savingSettings ? 'Salvando...' : 'Salvar Configurações Fiscais'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FiscalPage;
