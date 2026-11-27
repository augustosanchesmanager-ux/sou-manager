import React from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import type { ProductStockItem } from '../../../domain/stock/types';
import type { StaffMember } from '../../../domain/staff/types';
import type { ConsumptionFormState } from '../types';

interface InternalConsumptionModalProps {
    isOpen: boolean;
    products: ProductStockItem[];
    staffList: StaffMember[];
    form: ConsumptionFormState;
    onClose: () => void;
    onChange: React.Dispatch<React.SetStateAction<ConsumptionFormState>>;
    onSubmit: (e: React.FormEvent) => void;
}

export const InternalConsumptionModal: React.FC<InternalConsumptionModalProps> = ({
    isOpen,
    products,
    staffList,
    form,
    onClose,
    onChange,
    onSubmit,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Registrar Retirada / Consumo de Bancada"
            maxWidth="md"
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                        Insumo Retirado *
                    </label>
                    <select
                        required
                        value={form.productId}
                        onChange={e => onChange({ ...form, productId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    >
                        <option value="">Selecione o insumo...</option>
                        {products
                            .filter(p => p.purpose === 'internal_use' || p.purpose === 'both')
                            .map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} (Disponível: {p.stock_quantity} un)
                                </option>
                            ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                        Barbeiro / Colaborador Responsável *
                    </label>
                    <select
                        required
                        value={form.staffId}
                        onChange={e => onChange({ ...form, staffId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    >
                        <option value="">Selecione o profissional...</option>
                        {staffList.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name} ({s.role || 'Barbeiro'})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                        Quantidade Retirada *
                    </label>
                    <input
                        type="number"
                        min="1"
                        required
                        value={form.quantity}
                        onChange={e => onChange({ ...form, quantity: parseInt(e.target.value, 10) || 1 })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                        Observações / Motivo
                    </label>
                    <input
                        type="text"
                        placeholder="Ex: Abastecimento de lâminas na bancada 2"
                        value={form.notes}
                        onChange={e => onChange({ ...form, notes: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        className="bg-primary hover:brightness-110 text-[#0E0C0A] font-semibold"
                    >
                        Confirmar Retirada
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
