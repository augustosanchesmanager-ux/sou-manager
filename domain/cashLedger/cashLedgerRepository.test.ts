import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cashLedgerRepository } from './cashLedgerRepository';

describe('cashLedgerRepository', () => {
    const tenantId = 'tenant-test-123';

    beforeEach(() => {
        vi.clearAllMocks();
        cashLedgerRepository.clearInMemory();
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
        } catch {
            // ignore
        }
    });

    it('deve listar os lançamentos padrão do livro razão quando não houver registros', async () => {
        const entries = await cashLedgerRepository.listLedgerEntries(tenantId);
        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.some((e) => e.category === 'Aluguel')).toBe(true);
    });

    it('deve criar uma nova movimentação com sucesso', async () => {
        const newEntry = await cashLedgerRepository.createLedgerEntry(tenantId, {
            type: 'expense',
            category: 'Marketing',
            description: 'Campanha Instagram Ads',
            amount: 250.00,
            due_date: '2026-11-08',
            payment_date: '2026-11-08',
            status: 'paid',
            recipient_or_payer: 'Meta Ads',
            payment_method: 'credit_card',
        });

        expect(newEntry.id).toBeDefined();
        expect(newEntry.amount).toBe(250.00);

        const list = await cashLedgerRepository.listLedgerEntries(tenantId);
        expect(list.some((e) => e.id === newEntry.id)).toBe(true);
    });

    it('deve realizar baixa em lote de múltiplos lançamentos pendentes', async () => {
        const listBefore = await cashLedgerRepository.listLedgerEntries(tenantId);
        const pendings = listBefore.filter((e) => e.status === 'pending');
        expect(pendings.length).toBeGreaterThan(0);

        const idsToSettle = pendings.slice(0, 2).map((e) => e.id);
        const result = await cashLedgerRepository.batchSettleEntries({
            tenantId,
            entryIds: idsToSettle,
            paymentMethod: 'pix',
            paymentDate: '2026-11-08',
        });

        expect(result.success).toBe(true);
        expect(result.settledCount).toBe(idsToSettle.length);

        const listAfter = await cashLedgerRepository.listLedgerEntries(tenantId);
        const settledOnes = listAfter.filter((e) => idsToSettle.includes(e.id));
        expect(settledOnes.every((e) => e.status === 'paid' && e.payment_method === 'pix')).toBe(true);
    });

    it('deve registrar vale para colaborador com débito no livro razão', async () => {
        const valeResult = await cashLedgerRepository.registerVale({
            tenantId,
            staffId: 'staff-99',
            staffName: 'Barbeiro Lucas',
            amount: 150.00,
            paymentMethod: 'dinheiro',
            notes: 'Adiantamento para despesas pessoais',
        });

        expect(valeResult.success).toBe(true);
        expect(valeResult.amount).toBe(150.00);

        const list = await cashLedgerRepository.listLedgerEntries(tenantId);
        const found = list.find((e) => e.id === valeResult.transactionId || e.description.includes('Lucas'));
        expect(found).toBeDefined();
        expect(found?.category).toBe('Vale / Adiantamento');
        expect(found?.type).toBe('expense');
    });
});
