import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenantOptional } from '../src/context/TenantContext';
import { clientWalletRepository } from '../domain/clientWallet/walletRepository';
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

export const ClientAccount: React.FC = () => {
  const { tenantId: authTenantId, user } = useAuth();
  const tenantContext = useTenantOptional();
  const tenantId = authTenantId || tenantContext?.tenant?.id || '';
  const tenantName = tenantContext?.tenant?.name || 'SMG Barber';

  const [wallets, setWallets] = useState<ClientWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debt' | 'credit' | 'limit'>('all');

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

  const loadWallets = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await clientWalletRepository.listWallets(tenantId);
      setWallets(data);
    } catch (err) {
      console.error('[ClientAccount] Erro ao carregar carteiras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWallets();
  }, [tenantId]);

  // Resumo
  const summary = useMemo(() => calculateWalletSummary(wallets), [wallets]);

  // Filtragem
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

      await loadWallets();
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

      await loadWallets();
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
            onClick={() => void loadWallets()}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* 3 KPIs Executivos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200/80 dark:border-border-dark shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">
            Total em Débito (Fiado a Receber)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
              R$ {summary.totalDebt.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {summary.debtorsCount} {summary.debtorsCount === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200/80 dark:border-border-dark shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Total com Crédito (Pré-Pago)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              R$ {summary.totalCredit.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {summary.creditorsCount} {summary.creditorsCount === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-card-dark border border-slate-200/80 dark:border-border-dark shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Saldo Líquido da Barbearia
          </span>
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
