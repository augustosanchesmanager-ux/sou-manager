import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { bankReconciliationService } from '../services/bankReconciliationService';
import {
  BankAccount,
  BankStatementTransaction,
  SystemTransactionCandidate,
  ReconciliationSummary,
  CreateBankAccountInput,
} from '../src/types/reconciliation';
import { parseBankStatementFile, ParsedStatement } from '../src/lib/banking/ofxParser';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  EyeOff,
  Sparkles,
} from 'lucide-react';

export default function BankReconciliation() {
  const { tenantId } = useAuth();

  // Estados principais
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<BankStatementTransaction[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unreconciled' | 'reconciled' | 'ignored'>('unreconciled');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Notificações
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal Nova Conta Bancária
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [newAccountData, setNewAccountData] = useState<CreateBankAccountInput>({
    name: '',
    bank_name: '',
    bank_code: '',
    agency: '',
    account_number: '',
    account_type: 'checking',
    initial_balance: 0,
    color: '#0284c7',
  });
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);

  // Modal Importar Arquivo OFX / CSV
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [parsedStatement, setParsedStatement] = useState<ParsedStatement | null>(null);
  const [importFilename, setImportFilename] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Correspondência e Ação Rápida de Criação
  const [activeTxForMatching, setActiveTxForMatching] = useState<BankStatementTransaction | null>(null);
  const [candidates, setCandidates] = useState<SystemTransactionCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);

  // Modal Criar Lançamento do Sistema a partir do Extrato
  const [isCreateTxModalOpen, setIsCreateTxModalOpen] = useState<boolean>(false);
  const [newTxDescription, setNewTxDescription] = useState<string>('');
  const [newTxCategory, setNewTxCategory] = useState<string>('Outros');
  const [newTxPaymentMethod, setNewTxPaymentMethod] = useState<string>('transferencia');
  const [savingNewTx, setSavingNewTx] = useState<boolean>(false);

  // Carregar contas bancárias
  const loadBankAccounts = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const accounts = await bankReconciliationService.listBankAccounts(tenantId);
      setBankAccounts(accounts);
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
    } catch (err: any) {
      setToast({ message: 'Erro ao carregar contas bancárias.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBankAccounts();
  }, [tenantId]);

  // Carregar transações e sumário ao trocar de conta ou filtro
  const loadAccountData = async () => {
    if (!tenantId || !selectedAccountId) return;
    try {
      setLoading(true);
      const [txs, sum] = await Promise.all([
        bankReconciliationService.listStatementTransactions(tenantId, selectedAccountId, statusFilter),
        bankReconciliationService.getSummary(tenantId, selectedAccountId),
      ]);
      setTransactions(txs);
      setSummary(sum);
    } catch (err: any) {
      setToast({ message: 'Erro ao carregar movimentações do extrato.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountData();
    }
  }, [tenantId, selectedAccountId, statusFilter]);

  // Carregar candidatos inteligentes quando seleciona uma transação para correspondência
  useEffect(() => {
    const fetchMatches = async () => {
      if (!tenantId || !activeTxForMatching) {
        setCandidates([]);
        return;
      }
      setLoadingCandidates(true);
      try {
        const matches = await bankReconciliationService.findCandidates(tenantId, activeTxForMatching);
        setCandidates(matches);
      } catch (err) {
        setToast({ message: 'Erro ao buscar correspondências automáticas.', type: 'error' });
      } finally {
        setLoadingCandidates(false);
      }
    };

    fetchMatches();
  }, [tenantId, activeTxForMatching]);

  // Criar Conta Bancária
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !newAccountData.name || !newAccountData.bank_name) {
      setToast({ message: 'Preencha o nome da conta e o banco.', type: 'error' });
      return;
    }

    try {
      setCreatingAccount(true);
      const created = await bankReconciliationService.createBankAccount(tenantId, newAccountData);
      setBankAccounts((prev) => [...prev, created]);
      setSelectedAccountId(created.id);
      setIsAccountModalOpen(false);
      setToast({ message: 'Conta bancária cadastrada com sucesso!', type: 'success' });
      setNewAccountData({
        name: '',
        bank_name: '',
        bank_code: '',
        agency: '',
        account_number: '',
        account_type: 'checking',
        initial_balance: 0,
        color: '#0284c7',
      });
    } catch (err: any) {
      setToast({ message: 'Falha ao salvar conta bancária.', type: 'error' });
    } finally {
      setCreatingAccount(false);
    }
  };

  // Upload e Parse de Arquivo
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseBankStatementFile(file);
      setParsedStatement(parsed);
      setImportFilename(file.name);
    } catch (err: any) {
      setToast({ message: `Erro ao processar arquivo: ${err.message}`, type: 'error' });
    }
  };

  // Confirmar Importação
  const handleConfirmImport = async () => {
    if (!tenantId || !selectedAccountId || !parsedStatement) return;

    const fileFormat = importFilename.endsWith('.csv') ? 'csv' : 'ofx';

    try {
      setImporting(true);
      const result = await bankReconciliationService.importStatement(
        tenantId,
        selectedAccountId,
        importFilename,
        fileFormat,
        parsedStatement.transactions,
        null,
        null,
        parsedStatement.periodStart,
        parsedStatement.periodEnd
      );

      setToast({
        message: `Extrato importado! ${result.inserted_count} transações incluídas (${result.duplicates_skipped} duplicadas ignoradas).`,
        type: 'success',
      });

      setIsImportModalOpen(false);
      setParsedStatement(null);
      setImportFilename('');
      await loadAccountData();
    } catch (err: any) {
      setToast({ message: 'Erro ao importar extrato no banco de dados.', type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  // Ação de Conciliação direta com sugestão
  const handleReconcile = async (statementTxId: string, systemTxId: string) => {
    if (!tenantId) return;
    try {
      await bankReconciliationService.reconcile(tenantId, statementTxId, systemTxId);
      setToast({ message: 'Lançamento conciliado com sucesso!', type: 'success' });
      setActiveTxForMatching(null);
      await loadAccountData();
    } catch (err: any) {
      setToast({ message: 'Falha ao conciliar lançamento.', type: 'error' });
    }
  };

  // Ação de Desconciliação
  const handleUnreconcile = async (statementTxId: string) => {
    if (!tenantId) return;
    try {
      await bankReconciliationService.unreconcile(tenantId, statementTxId);
      setToast({ message: 'Conciliação desfeita com sucesso.', type: 'info' });
      await loadAccountData();
    } catch (err: any) {
      setToast({ message: 'Erro ao desconciliar.', type: 'error' });
    }
  };

  // Ignorar / Reativar
  const handleToggleIgnore = async (tx: BankStatementTransaction) => {
    if (!tenantId) return;
    const newStatus = tx.status === 'ignored' ? 'unreconciled' : 'ignored';
    try {
      await bankReconciliationService.setStatus(tenantId, tx.id, newStatus);
      setToast({
        message: newStatus === 'ignored' ? 'Transação ignorada.' : 'Transação reativada.',
        type: 'info',
      });
      await loadAccountData();
    } catch (err: any) {
      setToast({ message: 'Erro ao atualizar status.', type: 'error' });
    }
  };

  // Abrir Modal de Criar Lançamento do Sistema
  const openCreateTxModal = (tx: BankStatementTransaction) => {
    setActiveTxForMatching(tx);
    setNewTxDescription(tx.description);
    setNewTxCategory(tx.amount < 0 ? 'Taxas Bancárias' : 'Receita de Serviços');
    setNewTxPaymentMethod('transferencia');
    setIsCreateTxModalOpen(true);
  };

  // Confirmar Criação e Conciliação Instantânea
  const handleCreateAndReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !selectedAccountId || !activeTxForMatching) return;

    try {
      setSavingNewTx(true);
      await bankReconciliationService.createAndReconcile({
        tenant_id: tenantId,
        bank_account_id: selectedAccountId,
        statement_transaction_id: activeTxForMatching.id,
        description: newTxDescription,
        amount: Math.abs(activeTxForMatching.amount),
        type: activeTxForMatching.amount > 0 ? 'income' : 'expense',
        date: activeTxForMatching.transaction_date,
        category: newTxCategory,
        payment_method: newTxPaymentMethod,
      });

      setToast({ message: 'Lançamento criado no sistema e conciliado!', type: 'success' });
      setIsCreateTxModalOpen(false);
      setActiveTxForMatching(null);
      await loadAccountData();
    } catch (err: any) {
      setToast({ message: 'Erro ao criar lançamento conciliado.', type: 'error' });
    } finally {
      setSavingNewTx(false);
    }
  };

  // Filtragem local por texto
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    const term = searchTerm.toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.description.toLowerCase().includes(term) ||
        (tx.memo && tx.memo.toLowerCase().includes(term)) ||
        tx.amount.toString().includes(term) ||
        tx.transaction_date.includes(term)
    );
  }, [transactions, searchTerm]);

  const selectedAccount = bankAccounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-teal-700 dark:text-teal-300" />
            Conciliação Bancária Inteligente
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Importe extratos OFX/CSV e concilie suas movimentações financeiras com correspondência automática.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsAccountModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>

          <Button
            onClick={() => setIsImportModalOpen(true)}
            disabled={!selectedAccountId}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-night"
          >
            <UploadCloud className="w-4 h-4" />
            Importar Extrato (OFX/CSV)
          </Button>
        </div>
      </div>

      {/* Seletor de Contas e Resumo Financeiro */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Card Seletor de Conta */}
        <div className="p-5 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Conta Bancária Ativa
          </span>
          <div className="mt-3">
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma conta cadastrada.</p>
            ) : (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
              >
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — {acc.bank_name} {acc.account_number ? `(${acc.account_number})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          {selectedAccount && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
              <span>Ag: {selectedAccount.agency || 'N/A'}</span>
              <span>CC: {selectedAccount.account_number || 'N/A'}</span>
            </div>
          )}
        </div>

        {/* Card Saldo Extrato */}
        <div className="p-5 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Saldo Atual da Conta
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                selectedAccount?.current_balance || 0
              )}
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Saldo acumulado cadastrado no sistema
          </p>
        </div>

        {/* Card Conciliação (%) */}
        <div className="p-5 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Progresso da Conciliação
            </span>
            <span className="text-xs font-bold text-teal-700 dark:text-teal-300">
              {summary?.reconciliationPercentage || 0}%
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 mt-3 overflow-hidden">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${summary?.reconciliationPercentage || 0}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{summary?.reconciledCount || 0} conciliados</span>
            <span>{summary?.unreconciledCount || 0} pendentes</span>
          </div>
        </div>

        {/* Card Status Resumo */}
        <div className="p-5 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Importado
          </span>
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary?.totalStatementCount || 0}
              </span>
              <span className="text-xs text-gray-500 block">movimentações</span>
            </div>
            <div className="p-2.5 bg-teal-50 dark:bg-teal-950/40 rounded-lg text-teal-700 dark:text-teal-300">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Barra de Ações da Lista */}
      <div className="p-4 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Abas de Status */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-full md:w-auto">
          {(
            [
              { key: 'unreconciled', label: 'Pendentes' },
              { key: 'reconciled', label: 'Conciliados' },
              { key: 'ignored', label: 'Ignorados' },
              { key: 'all', label: 'Todos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Busca e Atualização */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar no extrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <Button variant="outline" size="sm" onClick={loadAccountData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Grid Principal: Lista de Extrato vs Detalhes/Correspondência */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Transações de Extrato (8 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-700" />
              Linhas do Extrato Bancário
            </h3>
            <span className="text-xs text-gray-500">
              {filteredTransactions.length} exibidas
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Carregando movimentações...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-sm">
              Nenhuma transação encontrada para este filtro.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] overflow-y-auto">
              {filteredTransactions.map((tx) => {
                const isSelected = activeTxForMatching?.id === tx.id;
                const isPositive = tx.amount > 0;

                return (
                  <div
                    key={tx.id}
                    onClick={() => setActiveTxForMatching(tx)}
                    className={`p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-teal-50/60 dark:bg-teal-950/20 border-l-4 border-teal-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span>{tx.transaction_date}</span>
                          <span>•</span>
                          <span className="capitalize">{tx.transaction_type}</span>
                          {tx.fitid && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-gray-400">{tx.fitid}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold ${
                          isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                      </p>

                      <div className="mt-1 flex items-center justify-end gap-1">
                        {tx.status === 'reconciled' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Check className="w-3 h-3" /> Conciliado
                          </span>
                        )}
                        {tx.status === 'ignored' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            Ignorado
                          </span>
                        )}
                        {tx.status === 'unreconciled' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Painel Lateral: Detalhes e Sugestões de Correspondência (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 flex flex-col justify-between">
          {!activeTxForMatching ? (
            <div className="py-20 text-center text-gray-400 dark:text-gray-500 flex flex-col items-center">
              <Sparkles className="w-10 h-10 mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium">Selecione uma transação ao lado</p>
              <p className="text-xs text-gray-400 mt-1">
                O motor inteligente de conciliação buscará lançamentos equivalentes automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Card da Transação Selecionada */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Transação Selecionada
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleIgnore(activeTxForMatching)}
                      title={activeTxForMatching.status === 'ignored' ? 'Reativar' : 'Ignorar'}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1"
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                    {activeTxForMatching.status === 'reconciled' && (
                      <button
                        onClick={() => handleUnreconcile(activeTxForMatching.id)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40"
                      >
                        Desconciliar
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-base font-bold text-gray-900 dark:text-white mt-2">
                  {activeTxForMatching.description}
                </p>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{activeTxForMatching.transaction_date}</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                      activeTxForMatching.amount
                    )}
                  </span>
                </div>
              </div>

              {/* Se já estiver conciliado, mostrar o vínculo */}
              {activeTxForMatching.status === 'reconciled' && activeTxForMatching.reconciled_transaction && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado ao Sistema
                  </span>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                    {activeTxForMatching.reconciled_transaction.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {activeTxForMatching.reconciled_transaction.date} • Categoria:{' '}
                    {activeTxForMatching.reconciled_transaction.category || 'Geral'}
                  </p>
                </div>
              )}

              {/* Correspondências Inteligentes Encontradas */}
              {activeTxForMatching.status === 'unreconciled' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      Sugestões do Sistema ({candidates.length})
                    </h4>
                  </div>

                  {loadingCandidates ? (
                    <div className="p-4 text-center text-xs text-gray-500">Buscando correspondências...</div>
                  ) : candidates.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-500">
                      Nenhum lançamento com valor similar encontrado no período.
                      <div className="mt-3">
                        <Button
                          size="sm"
                          onClick={() => openCreateTxModal(activeTxForMatching)}
                          className="text-xs bg-primary hover:bg-primary-dark text-night"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Criar e Conciliar no Caixa
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {candidates.map((cand) => (
                        <div
                          key={cand.id}
                          className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between hover:border-teal-500 transition-colors"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">
                                {cand.description}
                              </span>
                              {cand.matchScore && cand.matchScore >= 80 && (
                                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] font-bold rounded">
                                  {cand.matchScore}% Match
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {cand.date} • {cand.category} • {cand.matchReason}
                            </div>
                          </div>

                          <div className="text-right pl-3 shrink-0">
                            <span className="text-xs font-bold text-gray-900 dark:text-white block">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                cand.amount
                              )}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleReconcile(activeTxForMatching.id, cand.id)}
                              className="mt-1 text-[11px] py-1 px-2.5 h-auto bg-primary hover:bg-primary-dark text-night"
                            >
                              Conciliar
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => openCreateTxModal(activeTxForMatching)}
                          className="text-xs text-teal-700 hover:text-teal-700 dark:text-teal-300 font-medium"
                        >
                          Não é nenhum destes? Criar novo lançamento
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nova Conta Bancária */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Cadastrar Conta Bancária"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Nome de Identificação (Ex: Itaú Barbearia, NuBank PJ)
            </label>
            <input
              type="text"
              required
              value={newAccountData.name}
              onChange={(e) => setNewAccountData({ ...newAccountData, name: e.target.value })}
              className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
              placeholder="Ex: Itaú Matriz"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Banco
              </label>
              <input
                type="text"
                required
                value={newAccountData.bank_name}
                onChange={(e) => setNewAccountData({ ...newAccountData, bank_name: e.target.value })}
                className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                placeholder="Ex: Itaú Unibanco"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Tipo da Conta
              </label>
              <select
                value={newAccountData.account_type}
                onChange={(e) =>
                  setNewAccountData({ ...newAccountData, account_type: e.target.value as any })
                }
                className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="checking">Conta Corrente</option>
                <option value="savings">Poupança</option>
                <option value="payment_gateway">Gateway / Maquininha</option>
                <option value="cash">Caixa Físico</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Código do Banco
              </label>
              <input
                type="text"
                value={newAccountData.bank_code || ''}
                onChange={(e) => setNewAccountData({ ...newAccountData, bank_code: e.target.value })}
                className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                placeholder="Ex: 341"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Agência
              </label>
              <input
                type="text"
                value={newAccountData.agency || ''}
                onChange={(e) => setNewAccountData({ ...newAccountData, agency: e.target.value })}
                className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                placeholder="Ex: 0001"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Conta
              </label>
              <input
                type="text"
                value={newAccountData.account_number || ''}
                onChange={(e) => setNewAccountData({ ...newAccountData, account_number: e.target.value })}
                className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                placeholder="Ex: 12345-6"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Saldo Inicial (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={newAccountData.initial_balance}
              onChange={(e) =>
                setNewAccountData({ ...newAccountData, initial_balance: parseFloat(e.target.value) || 0 })
              }
              className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Button variant="outline" type="button" onClick={() => setIsAccountModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creatingAccount} className="bg-primary hover:bg-primary-dark text-night">
              {creatingAccount ? 'Salvando...' : 'Cadastrar Conta'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Importar Extrato OFX/CSV */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setParsedStatement(null);
        }}
        title="Importar Extrato Bancário"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Envie o arquivo OFX ou CSV emitido pelo seu banco. O sistema detectará automaticamente as
            movimentações e ignorará registros duplicados previamente importados.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-teal-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Clique para selecionar o arquivo
            </p>
            <p className="text-xs text-gray-400 mt-1">Formatos aceitos: .ofx, .csv (extrato bancário padrão)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ofx,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {parsedStatement && (
            <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
              <h4 className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase">
                Extrato Processado com Sucesso!
              </h4>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>
                  <strong>Arquivo:</strong> {importFilename}
                </p>
                <p>
                  <strong>Movimentações encontradas:</strong> {parsedStatement.transactions.length}
                </p>
                {parsedStatement.periodStart && parsedStatement.periodEnd && (
                  <p>
                    <strong>Período:</strong> {parsedStatement.periodStart} até {parsedStatement.periodEnd}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsImportModalOpen(false);
                setParsedStatement(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!parsedStatement || importing}
              onClick={handleConfirmImport}
              className="bg-primary hover:bg-primary-dark text-night"
            >
              {importing ? 'Importando...' : 'Confirmar Importação'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Criar Lançamento do Sistema a partir do Extrato */}
      <Modal
        isOpen={isCreateTxModalOpen}
        onClose={() => setIsCreateTxModalOpen(false)}
        title="Criar Lançamento no Fluxo de Caixa"
      >
        <form onSubmit={handleCreateAndReconcile} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Esta ação registrará uma nova transação no fluxo de caixa e a conciliará imediatamente com o extrato.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </label>
            <input
              type="text"
              required
              value={newTxDescription}
              onChange={(e) => setNewTxDescription(e.target.value)}
              className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Valor (R$)
              </label>
              <input
                type="text"
                disabled
                value={
                  activeTxForMatching
                    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        Math.abs(activeTxForMatching.amount)
                      )
                    : ''
                }
                className="w-full p-2.5 text-sm bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Tipo
              </label>
              <input
                type="text"
                disabled
                value={
                  activeTxForMatching && activeTxForMatching.amount > 0 ? 'Receita (Entrada)' : 'Despesa (Saída)'
                }
                className="w-full p-2.5 text-sm bg-gray-100 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Categoria
              </label>
              <select
                value={newTxCategory}
                onChange={(e) => setNewTxCategory(e.target.value)}
                className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="Taxas Bancárias">Taxas Bancárias</option>
                <option value="Juros / Tarifas">Juros / Tarifas</option>
                <option value="Receita de Serviços">Receita de Serviços</option>
                <option value="Rendimento de Aplicação">Rendimento de Aplicação</option>
                <option value="Fornecedores">Fornecedores</option>
                <option value="Contas de Consumo">Contas de Consumo</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Método de Pagamento
              </label>
              <select
                value={newTxPaymentMethod}
                onChange={(e) => setNewTxPaymentMethod(e.target.value)}
                className="w-full p-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="transferencia">Transferência / TED</option>
                <option value="pix">PIX</option>
                <option value="debito_automatico">Débito Automático</option>
                <option value="boleto">Boleto</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Button variant="outline" type="button" onClick={() => setIsCreateTxModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={savingNewTx} className="bg-primary hover:bg-primary-dark text-night">
              {savingNewTx ? 'Salvando...' : 'Criar e Conciliar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
