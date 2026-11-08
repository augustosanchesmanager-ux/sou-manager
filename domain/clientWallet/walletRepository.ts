/**
 * [SMG][DOMAIN][CLIENT_WALLET] walletRepository.ts
 *
 * Repositório desacoplado para persistência da Carteira do Cliente,
 * limites manuais de fiado e extrato de transações.
 */

import { getClientForTable } from '../../services/supabaseClient';
import type {
  ClientWallet,
  ClientWalletTransaction,
  WalletTransactionType,
} from './types';
import { calculateNewBalance } from './walletEngine';

// Armazenamento em memória para testes e modo offline/demo
const inMemoryWallets = new Map<string, ClientWallet>();
const inMemoryTransactions = new Map<string, ClientWalletTransaction[]>();

export class ClientWalletRepository {
  /**
   * Limpa os dados em memória (útil para testes unitários)
   */
  clearInMemory(): void {
    inMemoryWallets.clear();
    inMemoryTransactions.clear();
  }

  private getWalletKey(tenantId: string, clientId: string): string {
    return `${tenantId}:${clientId}`;
  }

  /**
   * Obtém a carteira do cliente pelo ID.
   */
  async getWallet(tenantId: string, clientId: string): Promise<ClientWallet> {
    if (!tenantId || !clientId) {
      return {
        client_id: clientId,
        tenant_id: tenantId,
        balance: 0,
        credit_limit: 0,
      };
    }

    const key = this.getWalletKey(tenantId, clientId);
    if (inMemoryWallets.has(key)) {
      return inMemoryWallets.get(key)!;
    }

    try {
      const client = getClientForTable('clients');

      // Tenta buscar da tabela de carteiras ou direto do cliente
      const { data, error } = await client
        .from('client_wallets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .maybeSingle();

      if (!error && data) {
        const wallet: ClientWallet = {
          client_id: data.client_id,
          tenant_id: data.tenant_id,
          balance: Number(data.balance || 0),
          credit_limit: Number(data.credit_limit || 0),
          last_movement_at: data.last_movement_at,
        };
        inMemoryWallets.set(key, wallet);
        return wallet;
      }

      // Se não existir registro de carteira, busca dados do cliente e inicia com saldo 0 e limite 0
      const { data: clientData } = await client
        .from('clients')
        .select('id, name, phone')
        .eq('tenant_id', tenantId)
        .eq('id', clientId)
        .maybeSingle();

      const newWallet: ClientWallet = {
        client_id: clientId,
        tenant_id: tenantId,
        client_name: clientData?.name || 'Cliente',
        client_phone: clientData?.phone || '',
        balance: 0,
        credit_limit: 0,
      };

      inMemoryWallets.set(key, newWallet);
      return newWallet;
    } catch {
      const fallback: ClientWallet = {
        client_id: clientId,
        tenant_id: tenantId,
        balance: 0,
        credit_limit: 0,
      };
      return fallback;
    }
  }

  /**
   * Lista todas as carteiras de clientes do tenant.
   */
  async listWallets(tenantId: string): Promise<ClientWallet[]> {
    if (!tenantId) return [];

    try {
      const client = getClientForTable('clients');
      const { data: clientsData, error } = await client
        .from('clients')
        .select('id, name, phone')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error || !clientsData) {
        return Array.from(inMemoryWallets.values()).filter((w) => w.tenant_id === tenantId);
      }

      const wallets: ClientWallet[] = [];
      for (const c of clientsData) {
        const key = this.getWalletKey(tenantId, c.id);
        const existing = inMemoryWallets.get(key);
        wallets.push({
          client_id: c.id,
          tenant_id: tenantId,
          client_name: c.name,
          client_phone: c.phone || '',
          balance: existing ? existing.balance : 0,
          credit_limit: existing ? existing.credit_limit : 0,
          last_movement_at: existing?.last_movement_at,
        });
      }

      return wallets;
    } catch {
      return Array.from(inMemoryWallets.values()).filter((w) => w.tenant_id === tenantId);
    }
  }

  /**
   * Atualiza o limite de fiado liberado manualmente pelo gestor.
   */
  async updateCreditLimit(tenantId: string, clientId: string, newLimit: number): Promise<ClientWallet> {
    const wallet = await this.getWallet(tenantId, clientId);
    wallet.credit_limit = Number(Math.max(0, newLimit).toFixed(2));

    const key = this.getWalletKey(tenantId, clientId);
    inMemoryWallets.set(key, wallet);

    try {
      const client = getClientForTable('clients');
      await client
        .from('client_wallets')
        .upsert({
          tenant_id: tenantId,
          client_id: clientId,
          credit_limit: wallet.credit_limit,
          balance: wallet.balance,
          updated_at: new Date().toISOString(),
        });
    } catch (err) {
      console.warn('[ClientWalletRepository] Aviso ao persistir limite:', err);
    }

    return wallet;
  }

  /**
   * Registra uma movimentação (débito de comanda, quitação ou depósito).
   */
  async recordTransaction(params: {
    tenantId: string;
    clientId: string;
    type: WalletTransactionType;
    amount: number;
    description: string;
    comandaId?: string | null;
    paymentMethod?: string | null;
    createdBy?: string | null;
  }): Promise<ClientWalletTransaction> {
    const { tenantId, clientId, type, amount, description, comandaId, paymentMethod, createdBy } = params;
    const wallet = await this.getWallet(tenantId, clientId);

    const balanceBefore = wallet.balance;
    const balanceAfter = calculateNewBalance(balanceBefore, type, amount);

    wallet.balance = balanceAfter;
    wallet.last_movement_at = new Date().toISOString();

    const key = this.getWalletKey(tenantId, clientId);
    inMemoryWallets.set(key, wallet);

    const tx: ClientWalletTransaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      client_id: clientId,
      type,
      amount: Math.abs(amount),
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      comanda_id: comandaId || null,
      payment_method: paymentMethod || null,
      description,
      created_at: new Date().toISOString(),
      created_by: createdBy || null,
    };

    const clientTxs = inMemoryTransactions.get(key) || [];
    clientTxs.unshift(tx);
    inMemoryTransactions.set(key, clientTxs);

    try {
      const client = getClientForTable('clients');
      // Atualiza carteira
      await client
        .from('client_wallets')
        .upsert({
          tenant_id: tenantId,
          client_id: clientId,
          balance: wallet.balance,
          credit_limit: wallet.credit_limit,
          last_movement_at: wallet.last_movement_at,
          updated_at: wallet.last_movement_at,
        });

      // Grava transação
      await client
        .from('client_wallet_transactions')
        .insert({
          id: tx.id,
          tenant_id: tenantId,
          client_id: clientId,
          type: tx.type,
          amount: tx.amount,
          balance_before: tx.balance_before,
          balance_after: tx.balance_after,
          comanda_id: tx.comanda_id,
          payment_method: tx.payment_method,
          description: tx.description,
          created_at: tx.created_at,
          created_by: tx.created_by,
        });
    } catch (err) {
      console.warn('[ClientWalletRepository] Transação mantida com segurança:', err);
    }

    return tx;
  }

  /**
   * Obtém histórico de movimentações da conta de um cliente.
   */
  async getTransactions(tenantId: string, clientId: string): Promise<ClientWalletTransaction[]> {
    const key = this.getWalletKey(tenantId, clientId);
    if (inMemoryTransactions.has(key)) {
      return inMemoryTransactions.get(key)!;
    }

    try {
      const client = getClientForTable('clients');
      const { data, error } = await client
        .from('client_wallet_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const list = data.map((d: any) => ({
          id: d.id,
          tenant_id: d.tenant_id,
          client_id: d.client_id,
          type: d.type,
          amount: Number(d.amount),
          balance_before: Number(d.balance_before),
          balance_after: Number(d.balance_after),
          comanda_id: d.comanda_id,
          payment_method: d.payment_method,
          description: d.description,
          created_at: d.created_at,
          created_by: d.created_by,
        }));
        inMemoryTransactions.set(key, list);
        return list;
      }
    } catch {
      // Ignora erro
    }

    return [];
  }
}

export const clientWalletRepository = new ClientWalletRepository();
