import React from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { formatCurrency } from '../../../shared/format/currency';
import type { ProductStockItem } from '../../../domain/stock/types';
import type { PurchaseFormState } from '../types';

interface PurchaseEntryModalProps {
    isOpen: boolean;
    products: ProductStockItem[];
    form: PurchaseFormState;
    selectedProduct?: ProductStockItem;
    previewNewCost: number;
    onClose: () => void;
    onChange: React.Dispatch<React.SetStateAction<PurchaseFormState>>;
    onSubmit: (e: React.FormEvent) => void;
}

export const PurchaseEntryModal: React.FC<PurchaseEntryModalProps> = ({
    isOpen,
    products,
    form,
    selectedProduct,
    previewNewCost,
    onClose,
    onChange,
    onSubmit,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Entrada de Compra no Estoque"
            maxWidth="md"
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                        Produto Comprado *
                    </label>
                    <select
                        required
                        value={form.productId}
                        onChange={e => {
                            const prodId = e.target.value;
                            const p = products.find(prod => prod.id === prodId);
                            onChange({
                                ...form,
                                productId: prodId,
                                unitCost: p ? p.cost_price : form.unitCost,
                                supplierName: p?.supplier_name || form.supplierName,
                            });
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    >
                        <option value="">Selecione um produto...</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} (Atual: {p.stock_quantity} un a {formatCurrency(p.cost_price)})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                            Quantidade Comprada *
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
                            Custo Unitário da Nota (R$) *
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={form.unitCost}
                            onChange={e => onChange({ ...form, unitCost: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                {/* Simulação em Tempo Real do Custo Médio Ponderado */}
                {selectedProduct && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between text-slate-400">
                            <span>Custo Médio Anterior:</span>
                            <span>{formatCurrency(selectedProduct.cost_price)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                            <span>Novo Estoque Total:</span>
                            <span>{selectedProduct.stock_quantity + form.quantity} un</span>
                        </div>
                        <div className="flex justify-between font-bold text-amber-400 pt-1 border-t border-slate-800">
                            <span>Novo Custo Médio Ponderado:</span>
                            <span>{formatCurrency(previewNewCost)}</span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                            Fornecedor
                        </label>
                        <input
                            type="text"
                            placeholder="Nome da distribuidora"
                            value={form.supplierName}
                            onChange={e => onChange({ ...form, supplierName: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                            Nº da Nota / Pedido
                        </label>
                        <input
                            type="text"
                            placeholder="NF-e 12345"
                            value={form.invoiceNumber}
                            onChange={e => onChange({ ...form, invoiceNumber: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>
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
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
                    >
                        Confirmar Compra
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
