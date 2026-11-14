import React from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import type { ClientWallet } from '../../domain/clientWallet/types';

interface LimitWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    wallet: ClientWallet | null;
    limitInput: string;
    onLimitInputChange: (val: string) => void;
    isSaving: boolean;
    onConfirm: () => void;
}

const LimitWalletModal: React.FC<LimitWalletModalProps> = ({
    isOpen,
    onClose,
    wallet,
    limitInput,
    onLimitInputChange,
    isSaving,
    onConfirm,
}) => {
    if (!wallet) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !isSaving && onClose()}
            title={`Ajustar Limite de Fiado — ${wallet.client_name || 'Cliente'}`}
            maxWidth="sm"
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Limite Liberado (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={limitInput}
                        onChange={(e) => onLimitInputChange(e.target.value)}
                        placeholder="Ex: 250.00"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-sm text-slate-900 dark:text-white"
                    />
                </div>
                <div className="flex gap-2 pt-2">
                    <Button type="button" variant="secondary" className="flex-1" disabled={isSaving} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" variant="primary" className="flex-1" disabled={isSaving} onClick={onConfirm}>
                        {isSaving ? 'Salvando...' : 'Salvar Limite'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default LimitWalletModal;
