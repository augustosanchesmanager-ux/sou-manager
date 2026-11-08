import { describe, it, expect } from 'vitest';
import {
    calculateLedgerSummary,
    filterLedgerEntries,
    validateBatchSettle,
    validateCreateVale,
    roundToCurrency,
} from './cashLedgerEngine';
import type { LedgerEntry, FiadoReceivableSummary } from './types';

describe('cashLedgerEngine', () => {
    const mockEntries: LedgerEntry[] = [
        {
            id: '1',
            tenant_id: 'tenant-1',
            type: 'income',
            category: 'Serviços',
            description: 'Corte Degrade',
            amount: 50.00,
            due_date: '2026-11-08',
            payment_date: '2026-11-08',
            status: 'paid',
            recipient_or_payer: 'Carlos',
            payment_method: 'pix',
        },
        {
            id: '2',
            tenant_id: 'tenant-1',
            type: 'expense',
            category: 'Insumos',
            description: 'Lâminas Gillette',
            amount: 30.00,
            due_date: '2026-11-08',
            payment_date: '2026-11-08',
            status: 'paid',
            recipient_or_payer: 'Distribuidora Alpha',
            payment_method: 'money',
        },
        {
            id: '3',
            tenant_id: 'tenant-1',
            type: 'expense',
            category: 'Aluguel',
            description: 'Aluguel Barbearia',
            amount: 1500.00,
            due_date: '2026-11-10',
            payment_date: null,
            status: 'pending',
            recipient_or_payer: 'Imobiliária Central',
            payment_method: null,
        },
        {
            id: '4',
            tenant_id: 'tenant-1',
            type: 'income',
            category: 'Assinatura',
            description: 'Mensalidade Club',
            amount: 120.00,
            due_date: '2026-11-12',
            payment_date: null,
            status: 'pending',
            recipient_or_payer: 'Marcos Silva',
            payment_method: null,
        },
        {
            id: '5',
            tenant_id: 'tenant-1',
            type: 'expense',
            category: 'Energia',
            description: 'Conta de Luz',
            amount: 350.00,
            due_date: '2026-11-25',
            payment_date: null,
            status: 'pending',
            recipient_or_payer: 'Enel',
            payment_method: null,
        },
    ];

    const mockFiados: FiadoReceivableSummary[] = [
        {
            id: 'client-1',
            client_name: 'Roberto Diniz',
            phone: '11999999999',
            balance: -85.00,
            debt_amount: 85.00,
            credit_limit: 200.00,
            last_movement: '2026-11-08',
        },
        {
            id: 'client-2',
            client_name: 'Lucas Mendes',
            phone: '11988888888',
            balance: -115.00,
            debt_amount: 115.00,
            credit_limit: 150.00,
            last_movement: '2026-11-07',
        },
    ];

    it('deve calcular corretamente os totais e saldos do período e acumulados', () => {
        const summary = calculateLedgerSummary(
            mockEntries,
            '2026-11-01',
            '2026-11-15',
            mockFiados
        );

        // Entradas e saídas efetivadas no período
        expect(summary.totalIncomePeriod).toBe(50.00);
        expect(summary.totalExpensePeriod).toBe(30.00);
        expect(summary.netPeriod).toBe(20.00);

        // Contas a Pagar:
        // entry 3 (1500) está no período (10/11)
        // entry 5 (350) é fora do período (25/11)
        expect(summary.totalPayablePeriod).toBe(1500.00);
        expect(summary.totalPayableAll).toBe(1850.00);

        // Contas a Receber:
        // entry 4 (120) está no período (12/11)
        expect(summary.totalReceivablePeriod).toBe(120.00);
        expect(summary.totalReceivableAll).toBe(120.00);

        // Fiados: 85 + 115 = 200
        expect(summary.totalFiadosDebt).toBe(200.00);
    });

    it('deve filtrar entradas por aba payable', () => {
        const payables = filterLedgerEntries(mockEntries, {
            tab: 'payable',
            status: 'pending',
        });
        expect(payables.length).toBe(2);
        expect(payables.every((e) => e.type === 'expense' && e.status === 'pending')).toBe(true);
    });

    it('deve filtrar entradas por aba receivable', () => {
        const receivables = filterLedgerEntries(mockEntries, {
            tab: 'receivable',
        });
        expect(receivables.length).toBe(2); // 1 paid (entry 1) + 1 pending (entry 4)
        expect(receivables.every((e) => e.type === 'income')).toBe(true);
    });

    it('deve buscar por texto em descrição, categoria e pagador/recebedor', () => {
        const resultsDesc = filterLedgerEntries(mockEntries, {
            tab: 'all',
            search: 'Degrade',
        });
        expect(resultsDesc.length).toBe(1);
        expect(resultsDesc[0].id).toBe('1');

        const resultsPayer = filterLedgerEntries(mockEntries, {
            tab: 'all',
            search: 'Enel',
        });
        expect(resultsPayer.length).toBe(1);
        expect(resultsPayer[0].id).toBe('5');
    });

    it('deve validar parâmetros de baixa em lote', () => {
        const invalidEmpty = validateBatchSettle([], 'pix');
        expect(invalidEmpty.valid).toBe(false);

        const invalidMethod = validateBatchSettle(['1', '2'], '');
        expect(invalidMethod.valid).toBe(false);

        const valid = validateBatchSettle(['1', '2'], 'dinheiro');
        expect(valid.valid).toBe(true);
    });

    it('deve validar parâmetros de lançamento de vale', () => {
        const invalidStaff = validateCreateVale('', 100);
        expect(invalidStaff.valid).toBe(false);

        const invalidAmount = validateCreateVale('staff-1', 0);
        expect(invalidAmount.valid).toBe(false);

        const valid = validateCreateVale('staff-1', 150);
        expect(valid.valid).toBe(true);
    });
});
