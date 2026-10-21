/**
 * [SMG][DOMAIN][PAYOUT] settledCommission
 *
 * RESPONSABILIDADE: Reconciliação contábil da base liquidada de repasse (ADR-030).
 * Garante que:
 * 1. Apenas comandas pagas e liquidadas em regime de caixa sejam apuradas.
 * 2. Registros de comissão com status = 'reversed' ou record_type = 'reversal' (C1/ADR-033)
 *    sejam estritamente expurgados/descontados.
 * 3. Múltiplos itens do mesmo profissional na mesma comanda (C2/ADR-034) sejam
 *    agregados integralmente.
 * 4. Respeita centavo a centavo (roundCents) os valores persistidos no livro-razão.
 */

import { roundCents } from './money';

export interface RawCommissionRecord {
    id: string;
    comanda_id: string;
    comanda_item_id?: string | null;
    staff_id: string;
    gross_value?: number | string | null;
    net_value?: number | string | null;
    commission_value: number | string;
    status: string; // 'active' | 'reversed'
    record_type: string; // 'commission' | 'reversal'
    original_record_id?: string | null;
    created_at?: string;
}

export interface FallbackComandaItem {
    id: string;
    comanda_id: string;
    staff_id: string;
    unit_price: number | string;
    quantity: number | string;
    created_at?: string;
}

export interface ReconciledPeriodRow {
    comanda_id: string;
    staff_id: string | null;
    amount: number | string;
    created_at: string;
    commission_value?: number | string;
    status?: string;
    record_type?: string;
    comanda_item_id?: string | null;
}

export interface ReconcileSettledCommissionsInput {
    records: RawCommissionRecord[];
    fallbackItems?: FallbackComandaItem[];
}

/**
 * Reconcilia registros do livro-razão e itens de fallback em linhas de apuração de período.
 * Expulsa registros estornados (status = 'reversed' ou record_type = 'reversal'),
 * preserva múltiplos itens por profissional na mesma comanda (C2) e desconta
 * eventuais reversões órfãs.
 */
export function reconcileSettledCommissionsToPeriodRows(
    input: ReconcileSettledCommissionsInput,
): ReconciledPeriodRow[] {
    const { records, fallbackItems = [] } = input;
    const rows: ReconciledPeriodRow[] = [];

    // 1. Identificar registros revertidos e de reversão (C1 / ADR-033)
    const reversedRecordIds = new Set<string>();
    const orphanReversals: RawCommissionRecord[] = [];

    for (const rec of records) {
        if (rec.status === 'reversed') {
            reversedRecordIds.add(rec.id);
        }
        if (rec.record_type === 'reversal') {
            if (rec.original_record_id) {
                reversedRecordIds.add(rec.original_record_id);
            } else {
                orphanReversals.push(rec);
            }
        }
    }

    // 2. Filtrar e agregar registros ativos legítimos (suporte a múltiplos itens C2)
    for (const rec of records) {
        // Reversões declaradas são expurgadas da soma direta
        if (rec.record_type === 'reversal') {
            continue;
        }
        // Registros com status 'reversed' ou cujo ID foi marcado para reversão são expurgados
        if (rec.status === 'reversed' || reversedRecordIds.has(rec.id)) {
            continue;
        }
        // Apenas registros de comissão ativos são processados
        if (rec.record_type === 'commission' && rec.status === 'active') {
            rows.push({
                comanda_id: rec.comanda_id,
                comanda_item_id: rec.comanda_item_id ?? null,
                staff_id: rec.staff_id,
                amount: Number(rec.gross_value ?? rec.net_value ?? 0),
                commission_value: roundCents(Number(rec.commission_value)),
                status: rec.status,
                record_type: rec.record_type,
                created_at: rec.created_at ?? new Date().toISOString(),
            });
        }
    }

    // 3. Caso haja reversão órfã (sem original_record_id identificado na lista), descontar como débito
    for (const orphan of orphanReversals) {
        const value = Number(orphan.commission_value);
        const signedValue = value > 0 ? -value : value; // garante débito (sinal negativo)
        rows.push({
            comanda_id: orphan.comanda_id,
            comanda_item_id: orphan.comanda_item_id ?? null,
            staff_id: orphan.staff_id,
            amount: 0,
            commission_value: roundCents(signedValue),
            status: orphan.status,
            record_type: orphan.record_type,
            created_at: orphan.created_at ?? new Date().toISOString(),
        });
    }

    // 4. Itens de comanda sem registro no livro-razão (fallback legado)
    for (const item of fallbackItems) {
        const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        const baseAmount = Number(item.unit_price) * qty;
        rows.push({
            comanda_id: item.comanda_id,
            comanda_item_id: item.id,
            staff_id: item.staff_id,
            amount: roundCents(baseAmount),
            created_at: item.created_at ?? new Date().toISOString(),
        });
    }

    return rows;
}
