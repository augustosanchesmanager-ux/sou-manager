import React from 'react';
import { ShieldCheck, ShieldOff, UserLock, WalletCards } from 'lucide-react';
import { QuickAction } from './types';

interface AdminActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: QuickAction) => void;
}

const actionMenuItems: QuickAction[] = [
  { id: 'menu-block-user', label: 'Bloquear usuario', description: 'Desativa acesso imediatamente.', tone: 'danger' },
  { id: 'menu-unblock-user', label: 'Desbloquear usuario', description: 'Libera acesso com justificativa.', tone: 'success' },
  { id: 'menu-suspend-company', label: 'Suspender empresa', description: 'Congela tenant por risco financeiro.', tone: 'danger' },
  { id: 'menu-approve-subscription', label: 'Aprovar assinatura', description: 'Conclui a fila de upgrade e ativacao.', tone: 'default' },
];

const iconMap = {
  'Bloquear usuario': UserLock,
  'Desbloquear usuario': ShieldCheck,
  'Suspender empresa': ShieldOff,
  'Aprovar assinatura': WalletCards,
};

const AdminActionMenu: React.FC<AdminActionMenuProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/25 backdrop-blur-sm" />
      <div
        className="absolute right-6 top-28 w-[22rem] rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-2xl dark:border-[#262A33] dark:bg-[#15171c]"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-bold text-slate-950 dark:text-white">Nova acao administrativa</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Escolha uma operacao sensivel. Todas as acoes geram auditoria.</p>

        <div className="mt-4 space-y-2">
          {actionMenuItems.map((item) => {
            const Icon = iconMap[item.label];
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-primary/30 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
              >
                <div className="rounded-xl bg-slate-100 p-2 dark:bg-white/10">
                  <Icon className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-950 dark:text-white">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminActionMenu;
