import React, { useState } from 'react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import {
  CHANGELOG_ITEMS,
  CHANGELOG_VERSION,
  markChangelogSeen,
} from '../src/lib/changelog';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal de release notes (novidades da semana).
 * Fonte dos itens: src/lib/changelog.ts. Marca a versão como vista ao fechar
 * quando a opção "não exibir novamente" permanece marcada.
 */
const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const handleClose = () => {
    if (dontShowAgain) {
      markChangelogSeen();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Novidades e melhorias da semana"
      maxWidth="lg"
      footer={
        <Button variant="primary" onClick={handleClose}>
          OK
        </Button>
      }
    >
      <div className="space-y-5">
        {/* Header: versão + contador */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold-pale dark:bg-gold-soft/20 border border-primary/30 text-xs font-bold text-primary-dark">
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            v{CHANGELOG_VERSION}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-xs font-bold text-primary-dark">
            Novidades {CHANGELOG_ITEMS.length}
          </span>
        </div>

        {/* Lista de itens */}
        <ul className="divide-y divide-line dark:divide-border-dark">
          {CHANGELOG_ITEMS.map((item) => (
            <li key={item.title} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-bold text-ink">{item.title}</p>
              <p className="text-sm text-ink-soft mt-0.5">{item.description}</p>
            </li>
          ))}
        </ul>

        {/* Checkbox persistente */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="size-4 rounded border-line dark:border-border-dark accent-primary"
          />
          <span className="text-sm text-ink-soft">
            Não exibir essa atualização novamente
          </span>
        </label>
      </div>
    </Modal>
  );
};

export default ReleaseNotesModal;
