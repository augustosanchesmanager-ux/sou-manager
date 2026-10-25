import { describe, it, expect } from 'vitest';
import {
    DURATION_PRESETS,
    calculateServicesNominalDuration,
    calculateEndTime,
    getResolvedAppointmentInterval,
    detectAppointmentOverlap,
    type ServiceDurationInput,
    type ExistingAppointmentSlot,
} from './scheduleDuration';

describe('scheduleDuration utility', () => {
    describe('DURATION_PRESETS', () => {
        it('should have 9 presets from 15m to 3h', () => {
            expect(DURATION_PRESETS).toHaveLength(9);
            expect(DURATION_PRESETS[0]).toEqual({ label: '15m', minutes: 15, decimalHours: 0.25 });
            expect(DURATION_PRESETS[3]).toEqual({ label: '1h', minutes: 60, decimalHours: 1.0 });
            expect(DURATION_PRESETS[8]).toEqual({ label: '3h', minutes: 180, decimalHours: 3.0 });
        });
    });

    describe('calculateServicesNominalDuration', () => {
        const catalog: ServiceDurationInput[] = [
            { id: 'corte', duration_minutes: 30, buffer: 0 },
            { id: 'barba', duration: 30, buffer: 5 }, // 35min
            { id: 'quimica', duration_minutes: 90, buffer: 15 }, // 105min
        ];

        it('should return fallback 30 when serviceIds is empty', () => {
            expect(calculateServicesNominalDuration([], catalog)).toBe(30);
        });

        it('should return nominal duration for single service', () => {
            expect(calculateServicesNominalDuration(['corte'], catalog)).toBe(30);
            expect(calculateServicesNominalDuration(['barba'], catalog)).toBe(35);
        });

        it('should aggregate duration and buffers for multi-service combos', () => {
            // corte (30) + barba (35) = 65
            expect(calculateServicesNominalDuration(['corte', 'barba'], catalog)).toBe(65);
            // corte (30) + quimica (105) = 135
            expect(calculateServicesNominalDuration(['corte', 'quimica'], catalog)).toBe(135);
        });
    });

    describe('calculateEndTime', () => {
        it('should calculate end time for ISO timestamp', () => {
            const startIso = '2026-10-25T14:00:00.000Z';
            const endIso = calculateEndTime(startIso, 45);
            expect(endIso).toBe('2026-10-25T14:45:00.000Z');
        });

        it('should calculate end time for HH:mm strings', () => {
            expect(calculateEndTime('14:00', 45)).toBe('14:45');
            expect(calculateEndTime('14:30', 90)).toBe('16:00');
            expect(calculateEndTime('23:30', 45)).toBe('00:15');
        });
    });

    describe('getResolvedAppointmentInterval', () => {
        const catalog: ServiceDurationInput[] = [
            { id: 'corte', duration_minutes: 30 },
            { id: 'barba', duration_minutes: 30 },
        ];

        it('should mark isCustom=false when duration matches nominal service time', () => {
            const result = getResolvedAppointmentInterval(
                { serviceId: 'corte', duration: 0.5 },
                catalog,
            );
            expect(result.durationMinutes).toBe(30);
            expect(result.durationDecimal).toBe(0.5);
            expect(result.isCustom).toBe(false);
            expect(result.nominalMinutes).toBe(30);
        });

        it('should mark isCustom=true when duration is manually extended', () => {
            const result = getResolvedAppointmentInterval(
                { serviceId: 'corte', duration: 0.75 }, // 45min em vez de 30
                catalog,
            );
            expect(result.durationMinutes).toBe(45);
            expect(result.durationDecimal).toBe(0.75);
            expect(result.isCustom).toBe(true);
        });

        it('should mark isCustom=true when duration is manually reduced', () => {
            const result = getResolvedAppointmentInterval(
                { serviceId: 'corte', duration_minutes: 20 }, // 20min em vez de 30
                catalog,
            );
            expect(result.durationMinutes).toBe(20);
            expect(result.isCustom).toBe(true);
        });

        it('should handle multi-service combos without false positives', () => {
            // Combo Corte + Barba = 60min
            const comboNominal = getResolvedAppointmentInterval(
                { serviceIds: ['corte', 'barba'], duration: 1.0 },
                catalog,
            );
            expect(comboNominal.durationMinutes).toBe(60);
            expect(comboNominal.isCustom).toBe(false);

            // Combo com tempo estendido = 80min
            const comboCustom = getResolvedAppointmentInterval(
                { serviceIds: ['corte', 'barba'], duration_minutes: 80 },
                catalog,
            );
            expect(comboCustom.durationMinutes).toBe(80);
            expect(comboCustom.isCustom).toBe(true);
        });
    });

    describe('detectAppointmentOverlap', () => {
        const existing: ExistingAppointmentSlot[] = [
            {
                id: 'apt-1',
                staffId: 'staff-1',
                dateKey: '2026-10-25',
                startDecimal: 14.0, // 14:00
                durationDecimal: 0.5, // 14:30
                status: 'confirmed',
                client: 'Carlos',
            },
            {
                id: 'apt-2',
                staffId: 'staff-1',
                dateKey: '2026-10-25',
                startDecimal: 15.0, // 15:00
                durationDecimal: 1.0, // 16:00
                status: 'confirmed',
                client: 'Marcos',
            },
            {
                id: 'apt-cancelled',
                staffId: 'staff-1',
                dateKey: '2026-10-25',
                startDecimal: 14.5,
                durationDecimal: 0.5,
                status: 'cancelled',
                client: 'Cancelado',
            },
        ];

        it('should NOT detect overlap for perfectly contiguous appointments', () => {
            // 14:30 até 15:00 cabe perfeitamente entre apt-1 e apt-2
            const result = detectAppointmentOverlap(
                {
                    id: 'new-apt',
                    staffId: 'staff-1',
                    dateKey: '2026-10-25',
                    startDecimal: 14.5,
                    durationDecimal: 0.5,
                },
                existing,
            );
            expect(result.hasOverlap).toBe(false);
            expect(result.conflictingAppointments).toHaveLength(0);
        });

        it('should detect overlap when extension exceeds slot and invades next appointment', () => {
            // Inicia 14:00 e estica para 1h15 (até 15:15), colidindo com apt-2 (15:00)
            const result = detectAppointmentOverlap(
                {
                    id: 'new-apt',
                    staffId: 'staff-1',
                    dateKey: '2026-10-25',
                    startDecimal: 14.5,
                    durationDecimal: 0.75, // até 15:15
                },
                existing,
            );
            expect(result.hasOverlap).toBe(true);
            expect(result.conflictingAppointments).toHaveLength(1);
            expect(result.conflictingAppointments[0].id).toBe('apt-2');
        });

        it('should ignore cancelled appointments during collision check', () => {
            // Ocupa 14:30 às 15:00 onde existia apt-cancelled
            const result = detectAppointmentOverlap(
                {
                    id: 'new-apt',
                    staffId: 'staff-1',
                    dateKey: '2026-10-25',
                    startDecimal: 14.5,
                    durationDecimal: 0.5,
                },
                existing,
            );
            expect(result.hasOverlap).toBe(false);
        });

        it('should ignore the target appointment itself when editing', () => {
            const result = detectAppointmentOverlap(
                {
                    id: 'apt-1', // editando apt-1
                    staffId: 'staff-1',
                    dateKey: '2026-10-25',
                    startDecimal: 14.0,
                    durationDecimal: 0.5,
                },
                existing,
            );
            expect(result.hasOverlap).toBe(false);
        });
    });
});
