import React from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { formatCurrency } from '../../shared/format/currency';
import type { ClientWallet } from '../../domain/clientWallet/types';

interface DepositWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    wallet: ClientWallet | null;
    depositAmount: string;
    onDepositAmountChange: (amount: string) => void;
    isSaving: boolean;
    onConfirm: () => void;
}

const DepositWalletModal: React.FC<DepositWalletModalProps> = ({
    isOpen,
    onClose,
    wallet,
    depositAmount,
    onDepositAmountChange,
    isSaving,
    onConfirm,
}) => {
    if (!wallet) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !isSaving && onClose()}
            title={`Adicionar Crédito Pré-Pago — ${wallet.client_name || 'Cliente'}`}
            maxWidth="sm"
        >
            <div className="space-y-4">
                <p className="text-xs text-slate-500">
                    Saldo atual em créditos: <strong className="text-emerald-600">{formatCurrency(wallet.balance)}</strong>
                </p>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor da Recarga (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={depositAmount}
                        onChange={(e) => onDepositAmountChange(e.target.value)}
                        placeholder="Ex: 100.00"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-sm text-slate-900 dark:text-white"
                    />
                </div>
                <div className="flex gap-2 pt-2">
                    <Button type="button" variant="secondary" className="flex-1" disabled={isSaving} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" variant="primary" className="flex-1" disabled={isSaving} onClick={onConfirm}>
                        {isSaving ? 'Salvando...' : 'Confirmar Crédito'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default DepositWalletModal;
