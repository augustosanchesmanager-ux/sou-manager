import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantOptional } from '../src/context/TenantContext';
import { clientWalletRepository } from '../domain/clientWallet/walletRepository';
import { comandaRepository } from '../domain/comanda/repository';
import { supabase } from '../services/supabaseClient';
import {
  calculateWalletSummary,
  generateWhatsAppDebtMessage,
} from '../domain/clientWallet/walletEngine';
import type {
  ClientWallet,
  ClientWalletTransaction,
} from '../domain/clientWallet/types';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

export interface OpenComandaItem {
  id: string;
  client_id?: string | null;
  client_name: string;
  client_phone?: string | null;
  staff_id?: string | null;
  staff_name?: string | null;
  appointment_id?: string | null;
  appointment_start_time?: string | null;
  total: number;
  created_at: string;
  is_unidentified: boolean;
}

export const ClientAccount: React.FC = () => {
  let navigate: (path: string) => void = (_path: string) => {};
  try {
    navigate = useNavigate();
  } catch {
    // Fallback gracioso para ambiente de teste sem Router context
  }
  const { tenantId: authTenantId, user } = useAuth();
  const tenantContext = useTenantOptional();
  const tenantId = authTenantId || tenantContext?.tenant?.id || '';
  const tenantName = tenantContext?.tenant?.name || 'SMG Barber';

  const [wallets, setWallets] = useState<ClientWallet[]>([]);
  const [openComandas, setOpenComandas] = useState<OpenComandaItem[]>([]);
  const [activeTab, setActiveTab] = useState<'wallets' | 'open_comandas'>('wallets');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debt' | 'credit' | 'limit'>('all');

  // Filtros e ordenação para Comandas em Aberto (Balcão)
  const [openSortOrder, setOpenSortOrder] = useState<
    'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'scheduled_asc' | 'scheduled_desc' | 'total_desc' | 'total_asc'
  >('created_desc');
  const [openPeriodFilter, setOpenPeriodFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('all');
  const [openStaffFilter, setOpenStaffFilter] = useState<string>('all');

  // Modais
  const [selectedWallet, setSelectedWallet] = useState<ClientWallet | null>(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'pix' | 'cash' | 'credit' | 'debit'>('pix');

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<ClientWalletTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [walletData, cmdRows] = await Promise.all([
        clientWalletRepository.listWallets(tenantId),
        comandaRepository.listOpenWithClients(tenantId),
      ]);

      setWallets(walletData);

      const openList: OpenComandaItem[] = (cmdRows || []).map((c) => ({
        id: c.id,
        client_id: c.client_id,
        client_name: c.clients?.name || 'Cliente não identificado',
        client_phone: c.clients?.phone || null,
        staff_id: c.staff_id || null,
        staff_name: c.staff?.name || null,
        appointment_id: c.appointment_id || null,
        appointment_start_time: c.appointments?.start_time || null,
        total: Number(c.total) || 0,
        created_at: c.created_at,
        is_unidentified: !c.client_id || !c.clients?.name,
      }));
      setOpenComandas(openList);
    } catch (err) {
      console.error('[ClientAccount] Erro ao carregar carteiras e comandas abertas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAllData();
  }, [tenantId]);

  // Resumo de carteiras
  const summary = useMemo(() => calculateWalletSummary(wallets), [wallets]);

  // Total de comandas em aberto
  const openComandasTotal = useMemo(() => {
    return openComandas.reduce((sum, c) => sum + c.total, 0);
  }, [openComandas]);

  // Débito consolidado total (Fiado formal + Comandas em aberto)
  const totalConsolidatedDebt = useMemo(() => {
    return summary.totalDebt + openComandasTotal;
  }, [summary.totalDebt, openComandasTotal]);

  // Filtragem de carteiras
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      const nameMatch = (w.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.client_phone || '').includes(searchTerm);
      if (!nameMatch) return false;

      if (statusFilter === 'debt') return w.balance < 0;
      if (statusFilter === 'credit') return w.balance > 0;
      if (statusFilter === 'limit') return w.credit_limit > 0;
      return true;
    });
  }, [wallets, searchTerm, statusFilter]);

  // Lista única de profissionais presentes nas comandas em aberto
  const openStaffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of openComandas) {
      if (c.staff_id && c.staff_name) {
        map.set(c.staff_id, c.staff_name);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [openComandas]);

  // Verificador de período para agendamento / vencimento
  const isDateInPeriod = (dateStr: string, period: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
    if (period === 'all') return true;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    if (period === 'today') {
      return d >= todayStart && d < tomorrowStart;
    }
    if (period === 'yesterday') {
      return d >= yesterdayStart && d < todayStart;
    }
    if (period === 'week') {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return d >= weekStart && d < tomorrowStart;
    }
    if (period === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= monthStart;
    }
    return true;
  };

  // Filtragem e ordenação de comandas em aberto
  const filteredOpenComandas = useMemo(() => {
    return openComandas
      .filter((c) => {
        const term = searchTerm.toLowerCase().trim();
        const matchSearch =
          !term ||
          c.client_name.toLowerCase().includes(term) ||
          (c.client_phone || '').includes(term) ||
          (c.staff_name || '').toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term);
        if (!matchSearch) return false;

        if (openStaffFilter !== 'all' && c.staff_id !== openStaffFilter) {
          return false;
        }

        const dateToCheck = c.appointment_start_time || c.created_at;
        if (!isDateInPeriod(dateToCheck, openPeriodFilter)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (openSortOrder === 'name_asc') {
          return a.client_name.localeCompare(b.client_name, 'pt-BR');
        }
        if (openSortOrder === 'name_desc') {
          return b.client_name.localeCompare(a.client_name, 'pt-BR');
        }
        if (openSortOrder === 'created_asc') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (openSortOrder === 'created_desc') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (openSortOrder === 'scheduled_asc') {
          const dateA = new Date(a.appointment_start_time || a.created_at).getTime();
          const dateB = new Date(b.appointment_start_time || b.created_at).getTime();
          return dateA - dateB;
        }
        if (openSortOrder === 'scheduled_desc') {
          const dateA = new Date(a.appointment_start_time || a.created_at).getTime();
          const dateB = new Date(b.appointment_start_time || b.created_at).getTime();
          return dateB - dateA;
        }
        if (openSortOrder === 'total_desc') {
          return b.total - a.total;
        }
        if (openSortOrder === 'total_asc') {
          return a.total - b.total;
        }
        return 0;
      });
  }, [openComandas, searchTerm, openStaffFilter, openPeriodFilter, openSortOrder]);

  const filteredOpenComandasTotal = useMemo(() => {
    return filteredOpenComandas.reduce((sum, c) => sum + c.total, 0);
  }, [filteredOpenComandas]);

  // Salvar Limite Manual
  const handleSaveLimit = async () => {
    if (!selectedWallet) return;
    const newLimit = parseFloat(limitInput) || 0;
    try {
      const updated = await clientWalletRepository.updateCreditLimit(tenantId, selectedWallet.client_id, newLimit);
      setWallets((prev) => prev.map((w) => (w.client_id === updated.client_id ? updated : w)));
      showToast(`Limite de ${selectedWallet.client_name} atualizado para R$ ${newLimit.toFixed(2)}.`);
      setIsLimitModalOpen(false);
    } catch {
      showToast('Erro ao atualizar limite de crédito.');
    }
  };

  // Quitar / Liquidar Débito
  const handleSettleDebt = async () => {
    if (!selectedWallet) return;
    const amount = parseFloat(settleAmount);
    if (!amount || amount <= 0) return;

    try {
      await clientWalletRepository.recordTransaction({
        tenantId,
        clientId: selectedWallet.client_id,
        type: 'payment_settlement',
        amount,
        description: `Quitação de dívida via ${settleMethod.toUpperCase()}`,
        paymentMethod: settleMethod,
        createdBy: user?.id,
      });

      await loadAllData();
      showToast(`Pagamento de R$ ${amount.toFixed(2)} registrado com sucesso!`);
      setIsSettleModalOpen(false);
    } catch {
      showToast('Falha ao registrar quitação.');
    }
  };

  // Adicionar Crédito Pré-Pago
  const handleDepositCredit = async () => {
    if (!selectedWallet) return;
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) return;

    try {
      await clientWalletRepository.recordTransaction({
        tenantId,
        clientId: selectedWallet.client_id,
        type: 'credit_deposit',
        amount,
        description: 'Recarga de crédito pré-pago em conta',
        paymentMethod: 'pix',
        createdBy: user?.id,
      });

      await loadAllData();
      showToast(`Crédito de R$ ${amount.toFixed(2)} creditado para ${selectedWallet.client_name}!`);
      setIsDepositModalOpen(false);
    } catch {
      showToast('Falha ao adicionar crédito.');
    }
  };

  // Ver Extrato
  const handleOpenHistory = async (wallet: ClientWallet) => {
    setSelectedWallet(wallet);
    setIsHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const txs = await clientWalletRepository.getTransactions(tenantId, wallet.client_id);
      setTransactions(txs);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Enviar Cobrança via WhatsApp
  const handleSendWhatsAppCobrance = (wallet: ClientWallet) => {
    if (wallet.balance >= 0) return;
    const cleanPhone = (wallet.client_phone || '').replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const text = generateWhatsAppDebtMessage({
      clientName: wallet.client_name || 'Cliente',
      debtAmount: wallet.balance,
      shopName: tenantName,
    });

    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 dark:bg-card-dark text-white text-xs font-bold shadow-2xl border border-white/10 flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500 text-2xl">account_balance_wallet</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Conta do Cliente (Fiado & Carteira)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Controle seguro de débitos a prazo com limite individualizado por cliente e créditos pré-pagos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            leftIcon="refresh"
            onClick={() => void loadAllData()}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* 4 KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total em Débito Consolidado */}
        <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200/80 dark:border-border-dark shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">
              Total em Débito (Fiado a Receber)
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
              Fiado + Balcão
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              R$ {totalConsolidatedDebt.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {summary.debtorsCount + openComandas.length} pendências
            </span>
          </div>
        </div>

        {/* Comandas em Aberto no Balcão */}
        <div
          onClick={() => setActiveTab('open_comandas')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'open_comandas'
              ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
              : 'bg-white dark:bg-card-dark border-slate-200/80 dark:border-border-dark hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Comandas em Aberto (Balcão)
            </span>
            <span className="material-symbols-outlined text-base text-amber-500">receipt_long</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
              R$ {openComandasTotal.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {openComandas.length} {openComandas.length === 1 ? 'comanda' : 'comandas'}
            </span>
          </div>
        </div>

        {/* Total com Crédito (Pré-Pago) */}
        <div
          onClick={() => {
            setActiveTab('wallets');
            setStatusFilter('credit');
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
            activeTab === 'wallets' && statusFilter === 'credit'
              ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
              : 'bg-white dark:bg-card-dark border-slate-200/80 dark:border-border-dark hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total com Crédito (Pré-Pago)
            </span>
            <span className="material-symbols-outlined text-base text-emerald-500">payments</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              R$ {summary.totalCredit.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {summary.creditorsCount} {summary.creditorsCount === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
        </div>

        {/* Saldo Líquido da Barbearia */}
        <div
          onClick={() => {
            setActiveTab('wallets');
            setStatusFilter('all');
          }}
          className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200/80 dark:border-border-dark shadow-sm transition-all cursor-pointer hover:border-amber-500/30"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Saldo Líquido da Barbearia
            </span>
            <span className="material-symbols-outlined text-base text-slate-400">account_balance</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-2xl font-black tabular-nums ${summary.netBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
              R$ {summary.netBalance.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {wallets.length} clientes
            </span>
          </div>
        </div>
      </div>

      {/* Seletor de Modo: Carteira de Clientes vs Comandas em Aberto */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-border-dark pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('wallets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'wallets'
              ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-base">wallet</span>
          <span>Carteira & Fiados ({wallets.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('open_comandas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'open_comandas'
              ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-base">receipt_long</span>
          <span>Comandas em Aberto ({openComandas.length})</span>
          {openComandasTotal > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-mono">
              R$ {openComandasTotal.toFixed(2)}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'wallets' ? (
        <>
          {/* Barra de Filtros */}
          <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200/80 dark:border-border-dark flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300'}`}
              >
                Todos ({wallets.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('debt')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === 'debt' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-surface-dark text-rose-600 dark:text-rose-400'}`}
              >
                Com Débito ({summary.debtorsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('credit')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === 'credit' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-surface-dark text-emerald-600 dark:text-emerald-400'}`}
              >
                Com Crédito ({summary.creditorsCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('limit')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${statusFilter === 'limit' ? 'bg-[#D99A2B] text-slate-950 shadow-sm' : 'bg-slate-100 dark:bg-surface-dark text-slate-600 dark:text-slate-300'}`}
              >
                Com Limite Aprovado
              </button>
            </div>
          </div>

          {/* Tabela de Clientes */}
          <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200/80 dark:border-border-dark overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4 text-right">Limite Liberado</th>
                    <th className="py-3 px-4 text-right">Saldo da Conta</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-2xl animate-spin block mb-1">sync</span>
                        Carregando contas dos clientes...
                      </td>
                    </tr>
                  ) : filteredWallets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Nenhum cliente encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredWallets.map((w) => {
                      const isDebt = w.balance < 0;
                      const isCredit = w.balance > 0;

                      return (
                        <tr key={w.client_id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-slate-400 text-base">person</span>
                              <span>{w.client_name || 'Cliente'}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono">
                            {w.client_phone || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-700 dark:text-slate-300">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedWallet(w);
                                setLimitInput(w.credit_limit.toString());
                                setIsLimitModalOpen(true);
                              }}
                              className="hover:underline text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <span>R$ {w.credit_limit.toFixed(2)}</span>
                              <span className="material-symbols-outlined text-[13px]">edit</span>
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black tabular-nums">
                            {isDebt && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                - R$ {Math.abs(w.balance).toFixed(2)}
                              </span>
                            )}
                            {isCredit && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                + R$ {w.balance.toFixed(2)}
                              </span>
                            )}
                            {!isDebt && !isCredit && (
                              <span className="text-slate-400">R$ 0,00</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {isDebt && (
                                <>
                                  <button
                                    type="button"
                                    title="Cobrar via WhatsApp"
                                    onClick={() => handleSendWhatsAppCobrance(w)}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-sm">chat</span>
                                  </button>
                                  <button
                                    type="button"
                                    title="Liquidar / Receber Débito"
                                    onClick={() => {
                                      setSelectedWallet(w);
                                      setSettleAmount(Math.abs(w.balance).toString());
                                      setIsSettleModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-xs">payments</span>
                                    <span>Receber</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                title="Adicionar Crédito Pré-Pago"
                                onClick={() => {
                                  setSelectedWallet(w);
                                  setDepositAmount('50.00');
                                  setIsDepositModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">add_card</span>
                              </button>

                              <button
                                type="button"
                                title="Histórico / Extrato"
                                onClick={() => void handleOpenHistory(w)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-surface-dark hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">receipt_long</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Barra de Busca e Filtros - Comandas em Aberto */}
          <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200/80 dark:border-border-dark flex flex-col gap-3 shadow-xs">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Campo de Busca */}
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  placeholder="Buscar por cliente, telefone, código ou profissional..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Controles de Filtros e Ordenação */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Ordenação (A-Z, etc.) */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark">
                  <span className="material-symbols-outlined text-sm text-slate-400">sort</span>
                  <select
                    value={openSortOrder}
                    onChange={(e) => setOpenSortOrder(e.target.value as any)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="created_desc">Criação: Mais Recentes</option>
                    <option value="created_asc">Criação: Mais Antigas</option>
                    <option value="name_asc">Cliente: A → Z</option>
                    <option value="name_desc">Cliente: Z → A</option>
                    <option value="scheduled_asc">Atendimento: Mais Próximos</option>
                    <option value="scheduled_desc">Atendimento: Mais Distantes</option>
                    <option value="total_desc">Valor: Maior primeiro</option>
                    <option value="total_asc">Valor: Menor primeiro</option>
                  </select>
                </div>

                {/* Filtro por Período */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark">
                  <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                  <select
                    value={openPeriodFilter}
                    onChange={(e) => setOpenPeriodFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Período: Todos</option>
                    <option value="today">Período: Hoje</option>
                    <option value="yesterday">Período: Ontem</option>
                    <option value="week">Período: Esta Semana</option>
                    <option value="month">Período: Este Mês</option>
                  </select>
                </div>

                {/* Filtro por Profissional */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark">
                  <span className="material-symbols-outlined text-sm text-slate-400">content_cut</span>
                  <select
                    value={openStaffFilter}
                    onChange={(e) => setOpenStaffFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer max-w-[170px]"
                  >
                    <option value="all">Profissional: Todos</option>
                    {openStaffOptions.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contador / Resumo Filtrado */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
              <div>
                Exibindo <strong className="text-slate-900 dark:text-white">{filteredOpenComandas.length}</strong> de <strong className="text-slate-900 dark:text-white">{openComandas.length}</strong> comandas abertas
                {(openPeriodFilter !== 'all' || openStaffFilter !== 'all' || searchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setOpenPeriodFilter('all');
                      setOpenStaffFilter('all');
                      setOpenSortOrder('created_desc');
                    }}
                    className="ml-2 text-amber-500 hover:underline font-bold cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
              <div>
                Total filtrado: <strong className="text-rose-500 font-mono text-xs font-bold">R$ {filteredOpenComandasTotal.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          {/* Tabela de Comandas em Aberto */}
          <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200/80 dark:border-border-dark overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Telefone</th>
                    <th className="py-3 px-4">Profissional</th>
                    <th className="py-3 px-4">Comanda</th>
                    <th className="py-3 px-4">Atendimento (Vencimento)</th>
                    <th className="py-3 px-4">Aberta em</th>
                    <th className="py-3 px-4 text-right">Valor em Aberto</th>
                    <th className="py-3 px-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <span className="material-symbols-outlined text-2xl animate-spin block mb-1">sync</span>
                        Carregando comandas em aberto...
                      </td>
                    </tr>
                  ) : filteredOpenComandas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhuma comanda encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOpenComandas.map((cmd) => {
                      const apptDate = cmd.appointment_start_time ? new Date(cmd.appointment_start_time) : null;
                      const isToday = apptDate ? apptDate.toDateString() === new Date().toDateString() : false;

                      return (
                        <tr key={cmd.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className={`material-symbols-outlined text-base ${cmd.is_unidentified ? 'text-amber-500' : 'text-slate-400'}`}>
                                {cmd.is_unidentified ? 'person_outline' : 'person'}
                              </span>
                              <span>{cmd.client_name}</span>
                              {cmd.is_unidentified && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Não identificado
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-mono">
                            {cmd.client_phone || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            {cmd.staff_name ? (
                              <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                                <span className="material-symbols-outlined text-xs text-amber-500">content_cut</span>
                                <span>{cmd.staff_name}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                            #{cmd.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="py-3.5 px-4">
                            {apptDate ? (
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                                  <span className="material-symbols-outlined text-xs text-amber-500">event</span>
                                  <span>
                                    {apptDate.toLocaleString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                {isToday && (
                                  <span className="inline-block mt-0.5 w-fit px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Hoje
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-400 text-[11px] italic">
                                <span className="material-symbols-outlined text-xs">storefront</span>
                                Balcão (Avulso)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                            {new Date(cmd.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-rose-600 dark:text-rose-400 tabular-nums">
                            R$ {cmd.total.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => navigate(`/checkout/${cmd.id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-colors cursor-pointer shadow-xs"
                            >
                              <span className="material-symbols-outlined text-sm">point_of_sale</span>
                              <span>Receber no Caixa</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal 1: Ajustar Limite Manual */}
      <Modal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
        title="Liberar Limite de Crédito Manual (Fiado)"
        size="sm"
      >
        <div className="space-y-4 p-2 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Defina o limite máximo de saldo devedor permitido para{' '}
            <strong className="text-slate-900 dark:text-white">{selectedWallet?.client_name}</strong>:
          </p>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Limite Máximo (R$)
            </label>
            <input
              type="number"
              step="10"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white font-black text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsLimitModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleSaveLimit()}>
              Salvar Limite
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Quitar / Receber Débito */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Receber / Quitar Débito"
        size="sm"
      >
        <div className="space-y-4 p-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark">
            <span className="text-[10px] font-bold text-slate-400 block">Dívida Atual</span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400">
              R$ {Math.abs(selectedWallet?.balance || 0).toFixed(2)}
            </span>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Valor a Receber (R$)
            </label>
            <input
              type="number"
              step="5"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white font-black text-sm"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Forma de Pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['pix', 'cash', 'debit', 'credit'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSettleMethod(m)}
                  className={`p-2 rounded-xl border font-bold capitalize transition-all cursor-pointer ${settleMethod === m ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 dark:border-border-dark text-slate-600 dark:text-slate-300'}`}
                >
                  {m === 'cash' ? 'Dinheiro' : m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsSettleModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleSettleDebt()}>
              Confirmar Recebimento
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Adicionar Crédito Pré-Pago */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        title="Recarga de Saldo Pré-Pago"
        size="sm"
      >
        <div className="space-y-4 p-2 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Adicione saldo para{' '}
            <strong className="text-slate-900 dark:text-white">{selectedWallet?.client_name}</strong>{' '}
            utilizar em atendimentos futuros:
          </p>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Valor da Recarga (R$)
            </label>
            <input
              type="number"
              step="10"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark text-slate-900 dark:text-white font-black text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsDepositModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={() => void handleDepositCredit()}>
              Confirmar Recarga
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 4: Extrato de Movimentações */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Extrato da Conta • ${selectedWallet?.client_name || ''}`}
        size="md"
      >
        <div className="space-y-4 p-1 text-xs">
          {loadingHistory ? (
            <div className="py-8 text-center text-slate-400">
              <span className="material-symbols-outlined text-2xl animate-spin block mb-1">sync</span>
              Buscando lançamentos...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              Nenhuma movimentação registrada na conta deste cliente.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-96 overflow-y-auto">
              {transactions.map((t) => {
                const isDebit = t.type === 'debit_comanda';
                return (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {t.description}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {new Date(t.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-black block tabular-nums ${isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {isDebit ? '-' : '+'} R$ {t.amount.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Saldo: R$ {t.balance_after.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ClientAccount;
