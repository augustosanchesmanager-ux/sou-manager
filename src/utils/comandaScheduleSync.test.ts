import { describe, it, expect } from 'vitest';
import {
    canModifyLinkedComanda,
    calculateSyncedComandaItems,
    evaluateCascadingCancel,
    type SyncedComandaItemInput,
} from './comandaScheduleSync';

describe('comandaScheduleSync utility', () => {
    describe('canModifyLinkedComanda', () => {
        it('should allow modification when there is no comanda', () => {
            expect(canModifyLinkedComanda(null)).toEqual({ canModify: true, reason: 'no_comanda' });
            expect(canModifyLinkedComanda(undefined)).toEqual({ canModify: true, reason: 'no_comanda' });
            expect(canModifyLinkedComanda({ id: 'cmd-1', status: null })).toEqual({ canModify: true, reason: 'no_comanda' });
        });

        it('should allow modification when comanda is open or blocked', () => {
            expect(canModifyLinkedComanda({ id: 'cmd-1', status: 'open' })).toEqual({
                canModify: true,
                reason: 'ok',
            });
            expect(canModifyLinkedComanda({ id: 'cmd-1', status: 'blocked' })).toEqual({
                canModify: true,
                reason: 'ok',
            });
        });

        it('should block modification when comanda is paid', () => {
            const result = canModifyLinkedComanda({ id: 'cmd-1', status: 'paid' });
            expect(result.canModify).toBe(false);
            expect(result.reason).toBe('paid_comanda');
            expect(result.message).toContain('já foi paga/liquidada');
        });

        it('should block modification when comanda is closed or billed', () => {
            const closedResult = canModifyLinkedComanda({ id: 'cmd-1', status: 'closed' });
            expect(closedResult.canModify).toBe(false);
            expect(closedResult.reason).toBe('closed_comanda');
            expect(closedResult.message).toContain('já foi fechada');

            const billedResult = canModifyLinkedComanda({ id: 'cmd-1', status: 'billed' });
            expect(billedResult.canModify).toBe(false);
            expect(billedResult.reason).toBe('closed_comanda');
        });

        it('should block modification when comanda is cancelled or has unexpected status', () => {
            const result = canModifyLinkedComanda({ id: 'cmd-1', status: 'cancelled' });
            expect(result.canModify).toBe(false);
            expect(result.reason).toBe('blocked_status');
        });
    });

    describe('calculateSyncedComandaItems', () => {
        const sampleItems: SyncedComandaItemInput[] = [
            {
                id: 'item-srv-1',
                service_id: 'srv-corte',
                product_id: null,
                product_name: 'Corte Degradê',
                quantity: 1,
                unit_price: 50,
                staff_id: 'barber-1',
            },
            {
                id: 'item-prod-1',
                service_id: null,
                product_id: 'prod-pomada',
                product_name: 'Pomada Matte',
                quantity: 1,
                unit_price: 35,
                staff_id: null,
            },
            {
                id: 'item-prod-2',
                service_id: null,
                product_id: 'prod-cerveja',
                product_name: 'Cerveja Artesanal',
                quantity: 2,
                unit_price: 15,
                staff_id: null,
            },
        ];

        it('should replace scheduled service item, recalculate total and preserve retail products', () => {
            const result = calculateSyncedComandaItems({
                currentItems: sampleItems,
                originalServiceId: 'srv-corte',
                newService: {
                    id: 'srv-barba',
                    name: 'Barba Terapia',
                    price: 45,
                },
                newProfessionalId: 'barber-1',
            });

            expect(result.preservedProductsCount).toBe(2);
            // 45 (barba) + 35 (pomada) + 30 (2 cervejas) = 110
            expect(result.nextTotal).toBe(110);

            const srvItem = result.updatedItems.find((i) => i.id === 'item-srv-1');
            expect(srvItem?.service_id).toBe('srv-barba');
            expect(srvItem?.product_name).toBe('Barba Terapia');
            expect(srvItem?.unit_price).toBe(45);
            expect(srvItem?.staff_id).toBe('barber-1');

            const pomadaItem = result.updatedItems.find((i) => i.id === 'item-prod-1');
            expect(pomadaItem?.product_name).toBe('Pomada Matte');
            expect(pomadaItem?.unit_price).toBe(35);

            const cervejaItem = result.updatedItems.find((i) => i.id === 'item-prod-2');
            expect(cervejaItem?.quantity).toBe(2);
            expect(cervejaItem?.unit_price).toBe(15);
        });

        it('should reassign commission to new professional for all service items and preserve product staff', () => {
            const multiServiceItems: SyncedComandaItemInput[] = [
                {
                    id: 'item-srv-1',
                    service_id: 'srv-1',
                    product_name: 'Corte',
                    quantity: 1,
                    unit_price: 50,
                    staff_id: 'barber-old',
                },
                {
                    id: 'item-srv-2',
                    service_id: 'srv-2',
                    product_name: 'Sobrancelha',
                    quantity: 1,
                    unit_price: 25,
                    staff_id: 'barber-old',
                },
                {
                    id: 'item-prod-1',
                    service_id: null,
                    product_id: 'prod-1',
                    product_name: 'Óleo de Barba',
                    quantity: 1,
                    unit_price: 40,
                    staff_id: 'reception-1',
                },
            ];

            const result = calculateSyncedComandaItems({
                currentItems: multiServiceItems,
                newProfessionalId: 'barber-new',
            });

            const srv1 = result.updatedItems.find((i) => i.id === 'item-srv-1');
            const srv2 = result.updatedItems.find((i) => i.id === 'item-srv-2');
            const prod = result.updatedItems.find((i) => i.id === 'item-prod-1');

            expect(srv1?.staff_id).toBe('barber-new');
            expect(srv2?.staff_id).toBe('barber-new');
            expect(prod?.staff_id).toBe('reception-1'); // Preserved product seller
            expect(result.nextTotal).toBe(115);
        });
    });

    describe('evaluateCascadingCancel', () => {
        it('should allow direct cancel when no comanda exists', () => {
            const result = evaluateCascadingCancel({ comanda: null });
            expect(result.canDirectCancel).toBe(true);
            expect(result.requiresConfirmation).toBe(false);
            expect(result.reason).toBe('no_comanda');
        });

        it('should allow direct cancel for clean comanda with only service and no payments', () => {
            const comanda = { id: 'cmd-1', status: 'open', total: 50 };
            const comandaItems: SyncedComandaItemInput[] = [
                {
                    id: 'item-1',
                    service_id: 'srv-1',
                    product_name: 'Corte',
                    quantity: 1,
                    unit_price: 50,
                },
            ];

            const result = evaluateCascadingCancel({
                comanda,
                comandaItems,
                hasPayments: false,
            });

            expect(result.canDirectCancel).toBe(true);
            expect(result.requiresConfirmation).toBe(false);
            expect(result.reason).toBe('clean_comanda');
            expect(result.productItems).toHaveLength(0);
        });

        it('should require confirmation when comanda has retail products added', () => {
            const comanda = { id: 'cmd-1', status: 'open', total: 85 };
            const comandaItems: SyncedComandaItemInput[] = [
                {
                    id: 'item-1',
                    service_id: 'srv-1',
                    product_name: 'Corte',
                    quantity: 1,
                    unit_price: 50,
                },
                {
                    id: 'item-2',
                    service_id: null,
                    product_id: 'prod-pomada',
                    product_name: 'Pomada Matte',
                    quantity: 1,
                    unit_price: 35,
                },
            ];

            const result = evaluateCascadingCancel({
                comanda,
                comandaItems,
                hasPayments: false,
            });

            expect(result.canDirectCancel).toBe(false);
            expect(result.requiresConfirmation).toBe(true);
            expect(result.reason).toBe('has_products');
            expect(result.productItems).toHaveLength(1);
            expect(result.productsTotal).toBe(35);
            expect(result.message).toContain('1 produto(s) adicionado(s) no balcão');
        });

        it('should require confirmation when comanda has registered payments', () => {
            const comanda = { id: 'cmd-1', status: 'open', total: 50 };
            const result = evaluateCascadingCancel({
                comanda,
                comandaItems: [],
                hasPayments: true,
            });

            expect(result.canDirectCancel).toBe(false);
            expect(result.requiresConfirmation).toBe(true);
            expect(result.reason).toBe('has_payments');
        });

        it('should block cancel if comanda is already finalized', () => {
            const comanda = { id: 'cmd-1', status: 'paid', total: 50 };
            const result = evaluateCascadingCancel({
                comanda,
                comandaItems: [],
                hasPayments: false,
            });

            expect(result.canDirectCancel).toBe(false);
            expect(result.requiresConfirmation).toBe(true);
            expect(result.reason).toBe('already_closed');
        });
    });
});
