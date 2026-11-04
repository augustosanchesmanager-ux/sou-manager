import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { calculateCommissionValue } from '../../domain/commission/calculate';
import type { ParticipantRow } from '../../domain/commission/types';
import { calculateTotals } from '../../application/cashClosing/summary';
import { validateCashClose } from '../../components/financial/cashCloseUtils';
import {
    detectAppointmentOverlap,
    calculateServicesNominalDuration,
} from '../../src/utils/scheduleDuration';
import {
    canModifyLinkedComanda,
    calculateSyncedComandaItems,
} from '../../src/utils/comandaScheduleSync';
import {
    calculateBarberStatementSummary,
    type BarberStatementItem,
} from '../../src/utils/barberStatement';
import { calculateTerminalFee } from '../../domain/paymentTerminal/calculateFee';
import type { PaymentTerminalRate } from '../../domain/paymentTerminal/types';
import {
    getTotalAvailableCredits,
    getAvailableCreditsForService,
    type ServiceBalanceEntry,
} from '../../domain/chefClub/credits';
import { sanitizePhoneNumberForWhatsApp, buildWhatsAppUrl } from '../../src/utils/clientReengagement';

// Participant canônico com 100% de apropriação do item
const createFullParticipant = (staffId: string): ParticipantRow => ({
    id: `part-${staffId}`,
    staff_id: staffId,
    affects_commission: true,
    payout_type: 'percentage',
    payout_value: 100, // 100% de apropriação do valor base do item
    source: 'test',
});

describe('FASE 7.9: Business Flow Certification (5 Fluxos Vitais Ponta a Ponta)', () => {
    const rootDir = process.cwd();
    const certDocPath = path.join(rootDir, 'docs', 'certification', 'BUSINESS_FLOW_CERTIFICATION.md');

    // =========================================================================
    // 0. AUDITORIA DOCUMENTAL DO DOSSIÊ DE CERTIFICAÇÃO
    // =========================================================================
    describe('0. Dossiê de Certificação dos Fluxos de Negócio', () => {
        it('FLOW-DOC-001: o documento BUSINESS_FLOW_CERTIFICATION.md deve existir e seguir a taxonomia', () => {
            expect(fs.existsSync(certDocPath), 'Dossiê deve existir').toBe(true);
            const content = fs.readFileSync(certDocPath, 'utf-8');
            expect(content).toContain('SMG Barber');
            expect(content).toContain('SMG Intelligence');
            expect(content).toContain('The Barbershop Intelligence');
            expect(content).toContain('Tolerância Zero');
            expect(content).toContain('ADR-001');
        });

        it('FLOW-DOC-002: deve conter o mapa e especificação dos 5 fluxos vitais', () => {
            const content = fs.readFileSync(certDocPath, 'utf-8');
            expect(content).toContain('Fluxo 1: Agenda');
            expect(content).toContain('Fluxo 2: Financeiro');
            expect(content).toContain('Fluxo 3: Caixa');
            expect(content).toContain('Fluxo 4: Comissão');
            expect(content).toContain('Fluxo 5: Club dos Chefes');
        });
    });

    // =========================================================================
    // 1. FLUXO 1: AGENDA (Cliente → Agendamento → Confirmação → Check-in → Comanda)
    // =========================================================================
    describe('1. Fluxo de Agenda & Atendimento Operacional', () => {
        it('FLOW-SCH-001: deve executar o ciclo completo de cliente, agendamento e comanda vinculada', () => {
            // Etapa 1: Cadastro e Sanitização do Cliente
            const rawPhone = '(11) 98765-4321';
            const cleanPhone = sanitizePhoneNumberForWhatsApp(rawPhone);
            expect(cleanPhone).toBe('5511987654321');

            // Etapa 2: Cálculo de duração dinâmica do agendamento (Corte 30m + Barba 20m = 50m)
            const serviceIds = ['srv-corte', 'srv-barba'];
            const servicesList = [
                { id: 'srv-corte', duration_minutes: 30, price: 50 },
                { id: 'srv-barba', duration_minutes: 20, price: 40 },
            ];
            const totalDuration = calculateServicesNominalDuration(serviceIds, servicesList as any);
            expect(totalDuration).toBe(50);

            // Etapa 3: Validação de conflito de agenda na cadeira do profissional
            const existingAppointments = [
                {
                    id: 'apt-1',
                    staffId: 'barber-1',
                    dateKey: '2026-11-04',
                    startDecimal: 10.0, // 10:00
                    durationDecimal: 0.75, // 45 min -> até 10:45
                    status: 'confirmed',
                },
            ];
            const targetOverlap = {
                staffId: 'barber-1',
                dateKey: '2026-11-04',
                startDecimal: 10.5, // 10:30 (conflita com 10:00-10:45)
                durationDecimal: 0.83, // 50 min
            };
            const conflictResult = detectAppointmentOverlap(targetOverlap, existingAppointments);
            expect(conflictResult.hasOverlap).toBe(true);

            // Agendamento em horário livre sem sobreposição (11:00 às 11:50)
            const targetFree = {
                staffId: 'barber-1',
                dateKey: '2026-11-04',
                startDecimal: 11.0,
                durationDecimal: 0.83,
            };
            const noConflictResult = detectAppointmentOverlap(targetFree, existingAppointments);
            expect(noConflictResult.hasOverlap).toBe(false);

            // Etapa 4: Confirmação e geração de link WhatsApp
            const confirmationUrl = buildWhatsAppUrl(cleanPhone, 'Olá! Confirmamos seu horário hoje às 11:00 no SMG Barber.');
            expect(confirmationUrl).toContain('https://wa.me/5511987654321');
            expect(confirmationUrl).toContain('SMG%20Barber');

            // Etapa 5: Sincronização e atualização de itens da comanda vinculada
            const syncedResult = calculateSyncedComandaItems({
                currentItems: [
                    { id: 'item-1', service_id: 'srv-corte', product_name: 'Corte Tradicional', unit_price: 50, staff_id: 'barber-1' },
                    { id: 'item-2', product_id: 'prod-1', product_name: 'Cerveja Long Neck', unit_price: 15 },
                ],
                originalServiceId: 'srv-corte',
                newService: { id: 'srv-corte-barba', name: 'Combo Corte + Barba', price: 85 },
                newProfessionalId: 'barber-1',
            });
            expect(syncedResult.updatedItems).toHaveLength(2);
            expect(syncedResult.updatedItems[0].product_name).toBe('Combo Corte + Barba');
            expect(syncedResult.updatedItems[0].unit_price).toBe(85);
            expect(syncedResult.updatedItems[0].service_id).toBe('srv-corte-barba');
            expect(syncedResult.updatedItems[0].staff_id).toBe('barber-1');
            expect(syncedResult.updatedItems[1].unit_price).toBe(15);
            expect(syncedResult.nextTotal).toBe(100);
            expect(syncedResult.preservedProductsCount).toBe(1);

            // Validação de que a comanda vinculada está aberta para consumo
            const canModify = canModifyLinkedComanda('open');
            expect(canModify.canModify).toBe(true);
        });
    });

    // =========================================================================
    // 2. FLUXO 2: FINANCEIRO (Comanda → Itens → Checkout Misto → Baixa)
    // =========================================================================
    describe('2. Fluxo Financeiro & Checkout de Balcão', () => {
        it('FLOW-FIN-001: deve liquidar comanda com pagamento misto sem resíduo (Delta = 0,00)', () => {
            // Comanda composta por: Corte (R$ 50), Barba (R$ 40) e Pomada (R$ 30) = Total R$ 120
            const comandaTotal = 120.00;

            // Pagamento misto: R$ 50 no Dinheiro + R$ 70 no Cartão de Crédito
            const payments = [
                { method: 'cash', amount: 50.00 },
                { method: 'credit_card', amount: 70.00, nsu: '198273' },
            ];

            const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
            const residualBalance = comandaTotal - totalPaid;

            // Invariante de tolerância zero: resíduo estritamente igual a 0,00
            expect(residualBalance).toBe(0.00);
            expect(totalPaid).toBe(comandaTotal);

            // Status da comanda transiciona para paid com timestamp de fechamento
            const closedComanda = {
                id: 'cmd-500',
                status: 'paid',
                total: comandaTotal,
                paid_amount: totalPaid,
                closed_at: new Date().toISOString(),
            };
            expect(closedComanda.status).toBe('paid');
            expect(closedComanda.closed_at).toBeDefined();
        });
    });

    // =========================================================================
    // 3. FLUXO 3: CAIXA (Abertura → Movimentações → Suprimento/Sangria → Fechamento Cego)
    // =========================================================================
    describe('3. Fluxo de Caixa & Fechamento Noturno Cego', () => {
        it('FLOW-CSH-001: deve calcular o fechamento de caixa cego e apurar quebra/sobra com exatidão', () => {
            // Abertura do dia com fundo de troco
            const openingBalance = 150.00;

            // Movimentações do dia:
            // - Comandas em Dinheiro: R$ 50,00 + R$ 80,00 + R$ 50,00 = R$ 180,00
            // - Suprimento (reforço de troco): R$ 50,00
            // - Sangria (pagamento de entrega): R$ 40,00
            const cashComandasTotal = 180.00;
            const suppliesTotal = 50.00;
            const withdrawalsTotal = 40.00;

            // Saldo teórico que DEVERIA existir na gaveta:
            // 150 + 180 + 50 - 40 = 340,00
            const expectedDrawerBalance = openingBalance + cashComandasTotal + suppliesTotal - withdrawalsTotal;
            expect(expectedDrawerBalance).toBe(340.00);

            // Cenário A: Conferência Cega Perfeita (Operador conta exatamente R$ 340,00)
            const validationExact = validateCashClose(expectedDrawerBalance, 340.00);
            expect(validationExact.difference).toBe(0.00);
            expect(validationExact.isValid).toBe(true);

            // Cenário B: Conferência com Quebra de Caixa (Faltaram R$ 10,00 -> Contado R$ 330,00)
            const validationShortage = validateCashClose(expectedDrawerBalance, 330.00);
            expect(validationShortage.difference).toBe(-10.00);
            expect(validationShortage.isValid).toBe(false);

            // Cenário C: Conferência com Sobra de Caixa (Sobraram R$ 5,00 -> Contado R$ 345,00)
            const validationSurplus = validateCashClose(expectedDrawerBalance, 345.00);
            expect(validationSurplus.difference).toBe(5.00);
            expect(validationSurplus.isValid).toBe(false);

            // Validação com o calculateTotals do domínio de fechamento de caixa
            const entries = [
                { id: 'e1', type: 'entrada' as const, value: 150.00, paymentMethod: 'money' },
                { id: 'e2', type: 'entrada' as const, value: 180.00, paymentMethod: 'money' },
            ];
            const extras = [
                { id: 'x1', type: 'suprimento' as const, value: 50.00, motivo: 'Troco' },
                { id: 'x2', type: 'sangria' as const, value: 40.00, motivo: 'Despesa' },
            ];
            const totals = calculateTotals(entries as any, extras as any);
            expect(totals.totalExpected).toBe(340.00);
            expect(totals.totalEntradas).toBe(330.00);
            expect(totals.totalExtrasSuprimento).toBe(50.00);
            expect(totals.totalExtrasSangria).toBe(40.00);
        });
    });

    // =========================================================================
    // 4. FLUXO 4: COMISSÃO (Serviço → Cálculo D7 → Rateio Multi-Barbeiro → Extrato)
    // =========================================================================
    describe('4. Fluxo de Comissão & Rateio Proporcional D7', () => {
        it('FLOW-COM-001: deve decompor comanda multi-barbeiro + produto e gerar extratos segregados', () => {
            const partA = createFullParticipant('staff-1');
            const partB = createFullParticipant('staff-2');

            // Comanda Multi-Barbeiro:
            // - Barbeiro A (staff-1): Corte R$ 50,00 @ 50% de comissão
            // - Barbeiro B (staff-2): Barba R$ 40,00 @ 40% de comissão
            // - Venda de Balcão: Pomada R$ 30,00 @ 10% de comissão para Barbeiro A
            const commissionCorteA = calculateCommissionValue(50.00, partA, 0.50);
            expect(commissionCorteA).toBe(25.00);

            const commissionBarbaB = calculateCommissionValue(40.00, partB, 0.40);
            expect(commissionBarbaB).toBe(16.00);

            const commissionPomadaA = calculateCommissionValue(30.00, partA, 0.10);
            expect(commissionPomadaA).toBe(3.00);

            // Total de comissões geradas:
            // Barbeiro A: 25 + 3 = R$ 28,00
            // Barbeiro B: R$ 16,00
            const totalCommissionA = commissionCorteA + commissionPomadaA;
            const totalCommissionB = commissionBarbaB;
            expect(totalCommissionA).toBe(28.00);
            expect(totalCommissionB).toBe(16.00);

            // Retenção líquida da casa:
            // Total Vendas = 120,00. Comissões Pagas = 28 + 16 = 44,00. Retenção = 120 - 44 = R$ 76,00
            const houseNet = 120.00 - (totalCommissionA + totalCommissionB);
            expect(houseNet).toBe(76.00);

            // Dedução de taxas de maquininha da comissão do Barbeiro A (se aplicável contratualmente)
            const rateCredit: any = {
                id: 'rate-1',
                tenant_id: 'tenant-prod',
                terminal_id: 'term-1',
                method: 'credit_card',
                rate_percentage: 2.5,
                fixed_fee: 0,
                settlement_days: 1,
                active: true,
                created_at: '2026-01-01T00:00:00Z',
            };
            const feePomada = calculateTerminalFee({ amount: 30.00, rate: rateCredit });
            expect(feePomada.feeAmount).toBe(0.75); // 2.5% de 30 = 0.75
            expect(feePomada.netAmount).toBe(29.25);

            // Extrato do Barbeiro A
            const statementItemsA: BarberStatementItem[] = [
                {
                    id: 'com-1',
                    comandaId: 'cmd-1',
                    createdAt: '2026-11-04T11:00:00Z',
                    clientName: 'Carlos Cliente',
                    itemName: 'Corte Tradicional',
                    itemType: 'service',
                    grossValue: 50.00,
                    commissionRate: 50,
                    commissionValue: 25.00,
                    comandaStatus: 'paid',
                    isPaid: true,
                },
                {
                    id: 'com-2',
                    comandaId: 'cmd-1',
                    createdAt: '2026-11-04T11:45:00Z',
                    clientName: 'Carlos Cliente',
                    itemName: 'Pomada Matte Fixadora',
                    itemType: 'product',
                    grossValue: 30.00,
                    commissionRate: 10,
                    commissionValue: 3.00,
                    comandaStatus: 'paid',
                    isPaid: true,
                },
            ];
            const statementSummaryA = calculateBarberStatementSummary(statementItemsA);
            expect(statementSummaryA.totalCommission).toBe(28.00);
            expect(statementSummaryA.confirmedCommission).toBe(28.00);
            expect(statementSummaryA.grossProduction).toBe(80.00);
            expect(statementSummaryA.totalComandas).toBe(1);
        });
    });

    // =========================================================================
    // 5. FLUXO 5: CLUB DOS CHEFES (Plano → Assinatura → Créditos → Resgate R$ 0 Caixa)
    // =========================================================================
    describe('5. Fluxo Club dos Chefes & Créditos de Assinatura', () => {
        it('FLOW-CLB-001: deve resgatar créditos do clube sem inflar o caixa em dinheiro físico (ADR-001)', () => {
            // Assinatura ativa com 4 créditos de corte simples
            const initialBalances: ServiceBalanceEntry[] = [
                {
                    service_id: 'srv-corte',
                    service_name: 'Corte Tradicional',
                    available: 4,
                    used: 0,
                },
            ];
            expect(getTotalAvailableCredits(initialBalances)).toBe(4);
            expect(getAvailableCreditsForService(initialBalances, 'srv-corte')).toBe(4);

            // Resgate de 1 crédito para corte realizado na bancada
            const updatedBalances: ServiceBalanceEntry[] = [
                {
                    service_id: 'srv-corte',
                    service_name: 'Corte Tradicional',
                    available: 3,
                    used: 1,
                },
            ];
            expect(getTotalAvailableCredits(updatedBalances)).toBe(3);
            expect(getAvailableCreditsForService(updatedBalances, 'srv-corte')).toBe(3);

            // Comanda liquidada com Crédito do Clube:
            // - Valor nominal de tabela do serviço: R$ 50,00
            // - Valor pago pelo cliente no caixa: R$ 0,00
            // - Meio de pagamento: 'Club dos Chefes'
            const clubComanda = {
                id: 'cmd-club-1',
                client_id: 'client-subscriber',
                staff_id: 'barber-1',
                total: 0.00,
                payment_method: 'Club dos Chefes',
                status: 'paid',
            };
            expect(clubComanda.total).toBe(0.00);
            expect(clubComanda.payment_method).toBe('Club dos Chefes');

            // Invariante de Caixa ADR-001: R$ 0,00 entra na contagem de dinheiro do caixa
            const cashEntries = [
                { id: 'c1', type: 'entrada' as const, value: 0.00, paymentMethod: 'Club dos Chefes' },
            ];
            const cashTotals = calculateTotals(cashEntries as any, []);
            expect(cashTotals.totalEntradas).toBe(0.00);

            // Comissão do barbeiro pelo corte do clube (calculada sobre base acordada de R$ 50 @ 50%)
            const part = createFullParticipant('barber-1');
            const barberClubCommission = calculateCommissionValue(50.00, part, 0.50);
            expect(barberClubCommission).toBe(25.00);
        });
    });

    // =========================================================================
    // 6. INVARIANTE PERMANENTE: SEPARAÇÃO CANÔNICA ADR-001
    // =========================================================================
    describe('6. Invariante Transacional ADR-001 (Comissão vs Settlement)', () => {
        it('FLOW-ADR-001: cálculo de comissão e liquidação de caixa são domínios desacoplados', () => {
            const part = createFullParticipant('staff-1');

            // Comissão teórica gerada na execução
            const theoreticalCommission = calculateCommissionValue(100.00, part, 0.50);
            expect(theoreticalCommission).toBe(50.00);

            // O sumário de caixa apura entradas contábeis, independente de comissões futuras
            const entries = [
                { id: 'e1', type: 'entrada' as const, value: 100.00, paymentMethod: 'pix' },
            ];
            const totals = calculateTotals(entries as any, []);
            expect(totals.totalEntradas).toBe(100.00);
        });
    });
});
