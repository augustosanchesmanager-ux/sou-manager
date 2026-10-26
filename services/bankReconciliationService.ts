import { supabase } from './supabaseClient';
import {
  BankAccount,
  BankStatement,
  BankStatementTransaction,
  CreateBankAccountInput,
  CreateTransactionFromStatementInput,
  SystemTransactionCandidate,
  ReconciliationSummary,
} from '../src/types/reconciliation';
import { ParsedTransaction } from '../src/lib/banking/ofxParser';

export const bankReconciliationService = {
  /**
   * Lista todas as contas bancárias ativas do tenant
   */
  async listBankAccounts(tenantId: string): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching bank accounts:', error);
      throw error;
    }
    return (data || []) as BankAccount[];
  },

  /**
   * Cria uma nova conta bancária
   */
  async createBankAccount(tenantId: string, input: CreateBankAccountInput): Promise<BankAccount> {
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        bank_name: input.bank_name,
        bank_code: input.bank_code || null,
        agency: input.agency || null,
        account_number: input.account_number || null,
        account_type: input.account_type,
        initial_balance: input.initial_balance,
        current_balance: input.initial_balance,
        color: input.color || '#0284c7',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bank account:', error);
      throw error;
    }
    return data as BankAccount;
  },

  /**
   * Importa extrato e transações usando a RPC idempotente
   */
  async importStatement(
    tenantId: string,
    bankAccountId: string,
    filename: string,
    fileFormat: 'ofx' | 'csv' | 'manual',
    transactions: ParsedTransaction[],
    openingBalance?: number | null,
    closingBalance?: number | null,
    periodStart?: string | null,
    periodEnd?: string | null
  ): Promise<{ statement_id: string; inserted_count: number; duplicates_skipped: number }> {
    const payload = transactions.map((t) => ({
      fitid: t.fitid,
      transaction_date: t.posted_at,
      amount: t.amount,
      transaction_type: t.type,
      description: t.memo,
      memo: t.memo || null,
    }));

    const { data, error } = await supabase.rpc('import_bank_statement_transactions', {
      p_tenant_id: tenantId,
      p_bank_account_id: bankAccountId,
      p_filename: filename,
      p_file_format: fileFormat,
      p_transactions: payload,
      p_opening_balance: openingBalance ?? null,
      p_closing_balance: closingBalance ?? null,
      p_period_start: periodStart ?? null,
      p_period_end: periodEnd ?? null,
    });

    if (error) {
      console.error('Error importing bank statement:', error);
      throw error;
    }
    return data;
  },

  /**
   * Lista transações importadas de extrato para uma conta bancária
   */
  async listStatementTransactions(
    tenantId: string,
    bankAccountId: string,
    statusFilter?: 'all' | 'unreconciled' | 'reconciled' | 'ignored'
  ): Promise<BankStatementTransaction[]> {
    let query = supabase
      .from('bank_statement_transactions')
      .select(`
        *,
        reconciled_transaction:transactions!reconciled_transaction_id (
          id,
          description,
          amount,
          type,
          date,
          category
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('bank_account_id', bankAccountId)
      .order('transaction_date', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching statement transactions:', error);
      throw error;
    }

    return (data || []) as BankStatementTransaction[];
  },

  /**
   * Busca candidatos de lançamentos do sistema para correspondência inteligente
   * Regra: mesmo valor aproximado (ou exato), tipo coincidente, intervalo de datas ±3 dias
   */
  async findCandidates(
    tenantId: string,
    statementTx: BankStatementTransaction,
    daysTolerance = 4
  ): Promise<SystemTransactionCandidate[]> {
    const isCredit = statementTx.amount > 0;
    const targetType = isCredit ? 'income' : 'expense';
    const absTargetAmount = Math.abs(statementTx.amount);

    // Calcular range de datas
    const txDate = new Date(statementTx.transaction_date);
    const startDate = new Date(txDate);
    startDate.setDate(startDate.getDate() - daysTolerance);
    const endDate = new Date(txDate);
    endDate.setDate(endDate.getDate() + daysTolerance);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('transactions')
      .select('id, tenant_id, description, amount, type, date, category, payment_method')
      .eq('tenant_id', tenantId)
      .eq('type', targetType)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error finding candidate transactions:', error);
      return [];
    }

    const candidates = ((data || []) as any[]).map((cand) => {
      const candAmount = typeof cand.amount === 'string' ? parseFloat(cand.amount) : cand.amount;
      const amountDiff = Math.abs(candAmount - absTargetAmount);
      
      let score = 0;
      let reasons: string[] = [];

      // Valor
      if (amountDiff === 0) {
        score += 60;
        reasons.push('Valor idêntico');
      } else if (amountDiff < 0.05) {
        score += 50;
        reasons.push('Valor com centavos próximos');
      }

      // Data
      if (cand.date === statementTx.transaction_date) {
        score += 25;
        reasons.push('Mesma data');
      } else {
        const diffDays = Math.abs(
          (new Date(cand.date).getTime() - txDate.getTime()) / (1000 * 3600 * 24)
        );
        if (diffDays <= 1) {
          score += 20;
          reasons.push('Diferença de 1 dia');
        } else if (diffDays <= 3) {
          score += 10;
          reasons.push(`Diferença de ${Math.round(diffDays)} dias`);
        }
      }

      // Texto/descrição
      const descBank = (statementTx.description || '').toLowerCase();
      const descSys = (cand.description || '').toLowerCase();
      if (descBank && descSys) {
        const words = descBank.split(/\s+/).filter((w) => w.length > 3);
        const hasCommonWord = words.some((w) => descSys.includes(w));
        if (hasCommonWord) {
          score += 15;
          reasons.push('Descrição similar');
        }
      }

      return {
        id: cand.id,
        tenant_id: cand.tenant_id,
        description: cand.description || 'Sem descrição',
        amount: candAmount,
        type: cand.type,
        date: cand.date,
        category: cand.category || 'Geral',
        payment_method: cand.payment_method,
        matchScore: Math.min(score, 100),
        matchReason: reasons.join(' • '),
      } as SystemTransactionCandidate;
    });

    // Ordenar por score decrescente
    return candidates.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  },

  /**
   * Executa a conciliação via RPC
   */
  async reconcile(
    tenantId: string,
    statementTxId: string,
    systemTxId: string,
    notes?: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('reconcile_bank_transaction', {
      p_tenant_id: tenantId,
      p_statement_tx_id: statementTxId,
      p_system_tx_id: systemTxId,
      p_notes: notes || null,
    });

    if (error) {
      console.error('Error reconciling transaction:', error);
      throw error;
    }
    return Boolean(data);
  },

  /**
   * Desfaz a conciliação via RPC
   */
  async unreconcile(tenantId: string, statementTxId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('unreconcile_bank_transaction', {
      p_tenant_id: tenantId,
      p_statement_tx_id: statementTxId,
    });

    if (error) {
      console.error('Error unreconciling transaction:', error);
      throw error;
    }
    return Boolean(data);
  },

  /**
   * Ignora ou reativa transação de extrato
   */
  async setStatus(
    tenantId: string,
    statementTxId: string,
    status: 'ignored' | 'unreconciled'
  ): Promise<void> {
    const { error } = await supabase
      .from('bank_statement_transactions')
      .update({ status })
      .eq('id', statementTxId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error updating statement transaction status:', error);
      throw error;
    }
  },

  /**
   * Cria um lançamento no sistema a partir do extrato e já o concilia
   */
  async createAndReconcile(
    input: CreateTransactionFromStatementInput
  ): Promise<{ transaction_id: string; success: boolean }> {
    // 1. Inserir a transação em `transactions`
    const { data: newTx, error: txError } = await supabase
      .from('transactions')
      .insert({
        tenant_id: input.tenant_id,
        description: input.description,
        amount: input.amount,
        type: input.type,
        date: input.date,
        category: input.category,
        payment_method: input.payment_method || 'transferencia',
        status: 'completed',
        source_type: 'bank_statement',
        source_id: input.statement_transaction_id,
      })
      .select('id')
      .single();

    if (txError || !newTx) {
      console.error('Error creating system transaction from statement:', txError);
      throw txError || new Error('Falha ao criar transação no sistema');
    }

    // 2. Conciliar com a RPC
    const success = await this.reconcile(
      input.tenant_id,
      input.statement_transaction_id,
      newTx.id,
      'Criado automaticamente via extrato bancário'
    );

    return { transaction_id: newTx.id, success };
  },

  /**
   * Calcula o resumo de conciliação para a conta
   */
  async getSummary(tenantId: string, bankAccountId: string): Promise<ReconciliationSummary> {
    const { data: accountData } = await supabase
      .from('bank_accounts')
      .select('current_balance')
      .eq('id', bankAccountId)
      .eq('tenant_id', tenantId)
      .single();

    const { data: txs, error } = await supabase
      .from('bank_statement_transactions')
      .select('status, amount')
      .eq('tenant_id', tenantId)
      .eq('bank_account_id', bankAccountId);

    if (error) {
      console.error('Error calculating reconciliation summary:', error);
    }

    const transactions = txs || [];
    const reconciled = transactions.filter((t) => t.status === 'reconciled');
    const unreconciled = transactions.filter((t) => t.status === 'unreconciled');
    const ignored = transactions.filter((t) => t.status === 'ignored');

    const bankBalance = accountData?.current_balance || 0;
    // O saldo do sistema considerado reconciliado:
    const reconciledStatementSum = reconciled.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const difference = bankBalance - (accountData?.current_balance || 0);

    const totalCount = transactions.length;
    const reconciledCount = reconciled.length;
    const reconciliationPercentage = totalCount > 0 ? Math.round((reconciledCount / totalCount) * 100) : 100;

    return {
      bankBalance,
      systemBalance: bankBalance,
      difference: 0,
      reconciledCount,
      unreconciledCount: unreconciled.length,
      ignoredCount: ignored.length,
      totalStatementCount: totalCount,
      reconciliationPercentage,
    };
  },
};
