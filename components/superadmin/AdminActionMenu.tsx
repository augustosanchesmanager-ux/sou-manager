import React from 'react';
import { Building2, ShieldAlert, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { QuickAction } from './types';

interface AdminActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (action: QuickAction) => void;
}

const actionMenuItems: QuickAction[] = [
  { id: 'go-companies', label: 'Abrir empresas', description: 'Vai para a base real de tenants cadastrados.', tone: 'default' },
  { id: 'go-users', label: 'Revisar usuarios', description: 'Mostra os perfis e acessos ativos da plataforma.', tone: 'default' },
  { id: 'go-subscriptions', label: 'Ver solicitacoes', description: 'Abre a fila real de mudanca de plano e acesso.', tone: 'default' },
  { id: 'go-audit', label: 'Abrir auditoria', description: 'Leva direto para os eventos auditados do ambiente.', tone: 'success' },
  { id: 'go-logs', label: 'Abrir alertas', description: 'Mostra a fila de riscos, tickets e monitoramento.', tone: 'danger' },
];

const iconMap = {
  'Abrir empresas': Building2,
  'Revisar usuarios': Users,
  'Ver solicitacoes': WalletCards,
  'Abrir auditoria': ShieldCheck,
  'Abrir alertas': ShieldAlert,
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
        <p className="text-sm font-bold text-slate-950 dark:text-white">Atalhos administrativos</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Acesso rapido aos blocos reais da operacao master.</p>

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
