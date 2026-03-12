import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  impact: string;
  confirmLabel: string;
  tone?: 'primary' | 'danger' | 'success' | 'warning';
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  impact,
  confirmLabel,
  tone = 'primary',
  onClose,
  onConfirm,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    maxWidth="lg"
    footer={
      <>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant={tone} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">Impacto da acao</p>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-100">{impact}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Auditoria obrigatoria</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Esta operacao registra responsavel, horario, origem e justificativa no historico administrativo.</p>
      </div>
    </div>
  </Modal>
);

export default ConfirmActionModal;
