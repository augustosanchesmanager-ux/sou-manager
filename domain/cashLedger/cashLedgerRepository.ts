/**
 * [SMG][DOMAIN][CASH_LEDGER] cashLedgerRepository
 *
 * Repositório para o módulo de Entrada / Saída, Contas a Pagar,
 * Contas a Receber, Baixa em Lote e Vales de Profissionais.
 */

import { getClientForTable } from '../../services/supabaseClient';
import { hasSupabaseEnv } from '../../src/lib/supabase/client';
import { PayoutRepository } from '../payout/payoutRepository';
import { clientWalletRepository } from '../clientWallet/walletRepository';
import type {
    LedgerEntry,
    BatchSettleInput,
    BatchSettleResult,
    CreateValeInput,
    CreateValeResult,
    FiadoReceivableSummary,
} from './types';

// Storage in-memory exclusivo para testes unitários e modo demo sem Supabase
const inMemoryLedgers = new Map<string, LedgerEntry[]>();

const isDemoOrTestMode = (): boolean =>
    !hasSupabaseEnv ||
    import.meta.env.MODE === 'test' ||
    (typeof process !== 'undefined' && Boolean(process.env?.VITEST));

export class CashLedgerRepository {
    private payoutRepo: PayoutRepository | null = null;

    private getPayoutRepo(): PayoutRepository | null {
        try {
            if (!this.payoutRepo) {
                this.payoutRepo = new PayoutRepository();
            }
            return this.payoutRepo;
        } catch {
            return null;
        }
    }

    clearInMemory(): void {
        inMemoryLedgers.clear();
    }

    private getDemoKey(tenantId: string): string {
        return `smg.ledger.${tenantId}`;
    }

    private getInitialSeed(tenantId: string): LedgerEntry[] {
        return [
            {
                id: 'seed-tx-1',
                tenant_id: tenantId,
                type: 'income',
                category: 'Serviços',
                description: 'Corte + Barboterapia',
                amount: 75.00,
                due_date: new Date().toISOString().split('T')[0],
                payment_date: new Date().toISOString().split('T')[0],
                status: 'paid',
                recipient_or_payer: 'Felipe Amorim',
                payment_method: 'pix',
                source_type: 'comanda',
            },
            {
                id: 'seed-tx-2',
                tenant_id: tenantId,
                type: 'expense',
                category: 'Insumos',
                description: 'Reposição de Pomadas Modeladoras (10 un)',
                amount: 180.00,
                due_date: new Date().toISOString().split('T')[0],
                payment_date: new Date().toISOString().split('T')[0],
                status: 'paid',
                recipient_or_payer: 'Barber Supply Distribuidora',
                payment_method: 'money',
                source_type: 'manual',
            },
            {
                id: 'seed-tx-3',
                tenant_id: tenantId,
                type: 'expense',
                category: 'Aluguel',
                description: 'Aluguel do Salão - Mês Atual',
                amount: 2200.00,
                due_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
                payment_date: null,
                status: 'pending',
                recipient_or_payer: 'Imobiliária Santa Cruz',
                payment_method: null,
                source_type: 'recurring_bill',
            },
            {
                id: 'seed-tx-4',
                tenant_id: tenantId,
                type: 'expense',
                category: 'Energia',
                description: 'Conta de Energia Elétrica',
                amount: 420.50,
                due_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
                payment_date: null,
                status: 'pending',
                recipient_or_payer: 'Enel Distribuição',
                payment_method: null,
                source_type: 'manual',
            },
            {
                id: 'seed-tx-5',
                tenant_id: tenantId,
                type: 'income',
                category: 'Club dos Chefes',
                description: 'Renovação Plano VIP Mensal',
                amount: 149.90,
                due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
                payment_date: null,
                status: 'pending',
                recipient_or_payer: 'Rodrigo Medeiros',
                payment_method: null,
                source_type: 'membership',
            },
        ];
    }

    private getDemoEntries(tenantId: string): LedgerEntry[] {
        const stored = inMemoryLedgers.get(tenantId);
        if (stored) return stored;

        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const raw = localStorage.getItem(this.getDemoKey(tenantId));
                if (raw) {
                    const parsed = JSON.parse(raw);
                    inMemoryLedgers.set(tenantId, parsed);
                    return parsed;
                }
            } catch {
                // ignore
            }
        }

        const seed = this.getInitialSeed(tenantId);
        inMemoryLedgers.set(tenantId, seed);
        this.saveDemoEntries(tenantId, seed);
        return seed;
    }

    private saveDemoEntries(tenantId: string, entries: LedgerEntry[]): void {
        inMemoryLedgers.set(tenantId, entries);
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                localStorage.setItem(this.getDemoKey(tenantId), JSON.stringify(entries));
            } catch {
                // ignore
            }
        }
    }

    /**
     * Lista todas as entradas e saídas do livro razão
     */
    async listLedgerEntries(
        tenantId: string,
        _filter?: { startDate?: string; endDate?: string }
    ): Promise<LedgerEntry[]> {
        if (!tenantId) return [];

        if (isDemoOrTestMode()) {
            if (inMemoryLedgers.has(tenantId)) {
                return inMemoryLedgers.get(tenantId)!;
            }
            return this.getDemoEntries(tenantId);
        }

        const client = getClientForTable('transactions', 'barber');
        const { data, error } = await client
            .from('transactions')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('date', { ascending: false });

        if (error) {
            throw error;
        }

        return (data || []).map((row: Record<string, unknown>) => ({
            id: String(row.id || ''),
            tenant_id: String(row.tenant_id || tenantId),
            type: (row.type as 'income' | 'expense') || 'income',
            category: String(row.category || 'Geral'),
            description: String(row.description || 'Movimentação'),
            amount: Number(row.amount || 0),
            due_date: String(row.date || row.created_at || '').split('T')[0],
            payment_date: row.status === 'paid' ? String(row.date || '').split('T')[0] : null,
            status: (row.status as 'pending' | 'paid' | 'cancelled') || 'paid',
            recipient_or_payer: String(row.customer_name || row.staff_name || row.recipient || ''),
            payment_method: row.payment_method ? String(row.payment_method) : null,
            source_type: row.source_type ? String(row.source_type) : null,
            source_id: row.source_id ? String(row.source_id) : null,
            notes: row.notes ? String(row.notes) : null,
            created_at: String(row.created_at || ''),
            updated_at: String(row.updated_at || ''),
        }));
    }

    /**
     * Cria uma nova movimentação (Entrada ou Saída)
     */
    async createLedgerEntry(
        tenantId: string,
        input: Omit<LedgerEntry, 'id' | 'tenant_id'>
    ): Promise<LedgerEntry> {
        const id = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        const entry: LedgerEntry = {
            id,
            tenant_id: tenantId,
            ...input,
            created_at: nowIso,
            updated_at: nowIso,
        };

        if (isDemoOrTestMode()) {
            const list = this.getDemoEntries(tenantId);
            list.unshift(entry);
            this.saveDemoEntries(tenantId, list);
            return entry;
        }

        const client = getClientForTable('transactions', 'barber');
        const { error } = await client
            .from('transactions')
            .insert({
                id,
                tenant_id: tenantId,
                type: entry.type,
                category: entry.category,
                description: entry.description,
                amount: entry.amount,
                date: entry.status === 'paid' ? (entry.payment_date || entry.due_date) : entry.due_date,
                status: entry.status,
                payment_method: entry.payment_method,
                source_type: entry.source_type || 'manual',
                source_id: entry.source_id,
            });

        if (error) {
            throw error;
        }

        return entry;
    }

    /**
     * Baixa em lote de múltiplos lançamentos pendentes
     */
    async batchSettleEntries(input: BatchSettleInput): Promise<BatchSettleResult> {
        const { tenantId, entryIds, paymentMethod, paymentDate } = input;
        if (!entryIds || entryIds.length === 0) {
            return {
                success: false,
                settledCount: 0,
                totalSettledAmount: 0,
                failedIds: [],
                message: 'Nenhum lançamento informado.',
            };
        }

        if (isDemoOrTestMode()) {
            let settledCount = 0;
            let totalSettledAmount = 0;
            const list = this.getDemoEntries(tenantId);
            for (const entry of list) {
                if (entryIds.includes(entry.id)) {
                    entry.status = 'paid';
                    entry.payment_method = paymentMethod;
                    entry.payment_date = paymentDate;
                    settledCount++;
                    totalSettledAmount += entry.amount;
                }
            }
            this.saveDemoEntries(tenantId, list);
            return {
                success: true,
                settledCount,
                totalSettledAmount,
                failedIds: [],
                message: `${settledCount} lançamentos baixados com sucesso.`,
            };
        }

        const client = getClientForTable('transactions', 'barber');
        const { data: updatedRows, error } = await client
            .from('transactions')
            .update({
                status: 'paid',
                payment_method: paymentMethod,
                date: paymentDate,
            })
            .eq('tenant_id', tenantId)
            .in('id', entryIds)
            .select('id, amount');

        if (error) {
            throw error;
        }

        const settledCount = updatedRows?.length ?? entryIds.length;
        const totalSettledAmount = (updatedRows || []).reduce(
            (sum: number, row: { amount?: number | string | null }) => sum + Number(row.amount || 0),
            0,
        );

        return {
            success: true,
            settledCount,
            totalSettledAmount,
            failedIds: [],
            message: `${settledCount} lançamentos baixados com sucesso.`,
        };
    }

    /**
     * Lançamento de Vale para Profissional (Integrado com Payout / Folha e Caixa)
     */
    async registerVale(input: CreateValeInput): Promise<CreateValeResult> {
        const { tenantId, staffId, staffName, amount, paymentMethod, notes, issuedAt } = input;
        const effectiveDate = issuedAt || new Date().toISOString().split('T')[0];

        // 1. Tenta acionar a RPC canônica do Payout se disponível (apenas fora de modo demo/teste)
        if (!isDemoOrTestMode()) {
            try {
                const payout = this.getPayoutRepo();
                if (payout) {
                    const payoutResult = await payout.registerAdvance({
                        tenantId,
                        staffId,
                        amount,
                        paymentMethod,
                        notes: notes ? `[Vale] ${notes}` : `[Vale Balcão] ${staffName}`,
                    });

                    if (payoutResult && payoutResult.success) {
                        return {
                            success: true,
                            advanceId: payoutResult.advanceId,
                            transactionId: payoutResult.transactionId,
                            amount,
                            message: `Vale de R$ ${amount.toFixed(2)} registrado com sucesso e vinculado à folha do profissional.`,
                        };
                    }
                }
            } catch (err) {
                throw err;
            }
        }

        // 2. Fallback de persistência no livro razão
        const advanceId = `adv_${Date.now()}`;
        const newTx = await this.createLedgerEntry(tenantId, {
            type: 'expense',
            category: 'Vale / Adiantamento',
            description: `Vale - ${staffName}`,
            amount,
            due_date: effectiveDate,
            payment_date: effectiveDate,
            status: 'paid',
            recipient_or_payer: staffName,
            payment_method: paymentMethod,
            source_type: 'barber_advance',
            source_id: advanceId,
            notes: notes ? `[Vale] ${notes}` : `Adiantamento com desconto na comissão semanal`,
        });

        return {
            success: true,
            advanceId,
            transactionId: newTx.id,
            amount,
            message: `Vale de R$ ${amount.toFixed(2)} registrado com sucesso para ${staffName}.`,
        };
    }

    /**
     * Lista débitos de clientes na Conta do Cliente (Fiados) para a sub-aba de Contas a Receber
     */
    async listFiadosForReceivables(tenantId: string): Promise<FiadoReceivableSummary[]> {
        try {
            const wallets = await clientWalletRepository.listWallets(tenantId);
            return wallets
                .filter((w) => w.balance < 0)
                .map((w) => ({
                    id: w.client_id,
                    client_name: w.client_name || 'Cliente',
                    phone: w.client_phone || '',
                    balance: w.balance,
                    debt_amount: Math.abs(w.balance),
                    credit_limit: w.credit_limit,
                    last_movement: w.last_movement_at || '',
                }));
        } catch {
            return [];
        }
    }
}

export const cashLedgerRepository = new CashLedgerRepository();
