import React from 'react';
import { Truck } from 'lucide-react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import type { ProductStockItem } from '../../../domain/stock/types';

interface SuppliersModalProps {
    isOpen: boolean;
    products: ProductStockItem[];
    onClose: () => void;
}

export const SuppliersModal: React.FC<SuppliersModalProps> = ({
    isOpen,
    products,
    onClose,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Fornecedores Parceiros"
            maxWidth="md"
        >
            <div className="space-y-4">
                <p className="text-xs text-slate-400">
                    Distribuidoras e fabricantes cadastrados para abastecimento de estoque e insumos de bancada.
                </p>

                <div className="space-y-2">
                    {Array.from(new Set(products.map(p => p.supplier_name).filter(Boolean))).map((sup, idx) => (
                        <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-amber-400" />
                                <span className="text-sm font-medium text-white">{sup}</span>
                            </div>
                            <span className="text-xs text-slate-500">Parceiro Homologado</span>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                    >
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
