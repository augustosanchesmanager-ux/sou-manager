import React from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import { formatCurrency } from '../../../shared/format/currency';

interface InventoryAuditPinModalProps {
    isOpen: boolean;
    discrepanciesCount: number;
    totalDifferenceValue: number;
    managerPin: string;
    pinError: string;
    isSubmitting: boolean;
    onClose: () => void;
    onPinChange: (pin: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export const InventoryAuditPinModal: React.FC<InventoryAuditPinModalProps> = ({
    isOpen,
    discrepanciesCount,
    totalDifferenceValue,
    managerPin,
    pinError,
    isSubmitting,
    onClose,
    onPinChange,
    onSubmit,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Autorização do Gestor — Ajuste de Inventário"
            maxWidth="sm"
        >
            <form onSubmit={onSubmit} className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-ink">
                    Você está prestes a atualizar o saldo físico de{' '}
                    <strong className="text-amber-400">{discrepanciesCount} produto(s)</strong>{' '}
                    com um impacto financeiro de{' '}
                    <strong className={totalDifferenceValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {formatCurrency(totalDifferenceValue)}
                    </strong>.
                </div>

                <div>
                    <label className="block text-xs font-semibold text-ink-soft uppercase mb-1">
                        PIN do Gestor (6 dígitos) *
                    </label>
                    <input
                        type="password"
                        maxLength={6}
                        autoFocus
                        placeholder="••••••"
                        value={managerPin}
                        onChange={e => onPinChange(e.target.value)}
                        className="w-full text-center text-2xl tracking-widest px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                    />
                    {pinError && (
                        <p className="text-xs text-rose-400 mt-1 font-medium">{pinError}</p>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSubmitting}
                        className="bg-amber-500 text-slate-950 font-bold"
                    >
                        Aprovar Ajuste
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
