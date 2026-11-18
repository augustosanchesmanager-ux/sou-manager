import React from 'react';
import { ShoppingCart, Scissors, Layers } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import type { ProductFormState } from '../types';

interface ProductFormModalProps {
    isOpen: boolean;
    isEditing: boolean;
    form: ProductFormState;
    onClose: () => void;
    onChange: React.Dispatch<React.SetStateAction<ProductFormState>>;
    onSubmit: (e: React.FormEvent) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
    isOpen,
    isEditing,
    form,
    onClose,
    onChange,
    onSubmit,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Editar Produto' : 'Novo Produto'}
            maxWidth="lg"
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Nome do Produto *
                    </label>
                    <input
                        type="text"
                        required
                        placeholder="Ex: Pomada Matte Efeito Seco"
                        value={form.name}
                        onChange={e => onChange({ ...form, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Categoria
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Finalizadores, Barba, Insumos"
                            value={form.category}
                            onChange={e => onChange({ ...form, category: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Marca / Fabricante
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Barber Premium"
                            value={form.brand}
                            onChange={e => onChange({ ...form, brand: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                {/* Finalidade do Produto (Decisão do PO: 1 - a b c) */}
                <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Finalidade de Uso *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => onChange({ ...form, purpose: 'sale' })}
                            className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                form.purpose === 'sale'
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                        >
                            <ShoppingCart className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                            Para Venda
                        </button>

                        <button
                            type="button"
                            onClick={() => onChange({ ...form, purpose: 'internal_use' })}
                            className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                form.purpose === 'internal_use'
                                    ? 'bg-[#B88A44]/20 border-[#B88A44] text-[#B88A44]'
                                    : 'bg-[#0E0C0A] border-[#2D2A26] text-stone-400 hover:border-[#B88A44]/50'
                            }`}
                        >
                            <Scissors className="w-4 h-4 mx-auto mb-1 text-[#B88A44]" />
                            Uso Interno (Bancada)
                        </button>

                        <button
                            type="button"
                            onClick={() => onChange({ ...form, purpose: 'both' })}
                            className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                form.purpose === 'both'
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                        >
                            <Layers className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                            Híbrido (Venda e Uso)
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Preço de Custo (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.cost_price}
                            onChange={e => onChange({ ...form, cost_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Preço de Venda (R$)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={form.purpose === 'internal_use'}
                            value={form.purpose === 'internal_use' ? 0 : form.sale_price}
                            onChange={e => onChange({ ...form, sale_price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Comissão Barbeiro (%)
                        </label>
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            disabled={form.purpose === 'internal_use'}
                            value={form.purpose === 'internal_use' ? 0 : form.commission_rate}
                            onChange={e => onChange({ ...form, commission_rate: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Estoque Atual (un)
                        </label>
                        <input
                            type="number"
                            step="1"
                            min="0"
                            value={form.stock_quantity}
                            onChange={e => onChange({ ...form, stock_quantity: parseInt(e.target.value, 10) || 0 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Estoque Mínimo (Alerta)
                        </label>
                        <input
                            type="number"
                            step="1"
                            min="0"
                            value={form.minimum_stock}
                            onChange={e => onChange({ ...form, minimum_stock: parseInt(e.target.value, 10) || 0 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                        Fornecedor Principal
                    </label>
                    <input
                        type="text"
                        placeholder="Ex: Distribuidora Alpha Barber"
                        value={form.supplier_name}
                        onChange={e => onChange({ ...form, supplier_name: e.target.value })}
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
                        className="bg-amber-500 text-slate-950 font-semibold"
                    >
                        Salvar Produto
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
