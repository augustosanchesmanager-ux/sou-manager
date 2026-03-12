import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type QuickActionRole = 'all' | 'manager' | 'operational';

interface QuickActionItem {
  label: string;
  icon: string;
  path: string;
  state?: Record<string, unknown>;
  role: QuickActionRole;
}

export const isMobileBottomNavRoute = (pathname: string): boolean => {
  const normalized = pathname.toLowerCase();
  return (
    normalized === '/dashboard' ||
    normalized === '/schedule' ||
    normalized === '/comandas' ||
    normalized.startsWith('/checkout') ||
    normalized === '/settings'
  );
};

const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessRole, canAccessSuperAdmin } = useAuth();
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);

  if (!isMobileBottomNavRoute(location.pathname)) return null;

  const isManager = canAccessSuperAdmin || accessRole === 'manager';
  const isOperational = accessRole === 'barber' || accessRole === 'receptionist';

  const quickActions = useMemo<QuickActionItem[]>(() => {
    const allActions: QuickActionItem[] = [
      { label: 'Novo Agendamento', icon: 'calendar_add_on', path: '/schedule', state: { openNewAppointment: true }, role: 'all' },
      { label: 'Novo Cliente', icon: 'person_add', path: '/clients', state: { openNewClient: true }, role: 'manager' },
      { label: 'Novo Serviço', icon: 'content_cut', path: '/services', state: { openNewService: true }, role: 'manager' },
      { label: 'Novo Produto', icon: 'inventory_2', path: '/products', state: { openNewProduct: true }, role: 'manager' },
      { label: 'Novo Profissional', icon: 'badge', path: '/team', state: { openNewTeamMember: true }, role: 'manager' },
      { label: 'Nova Comanda', icon: 'point_of_sale', path: '/checkout', role: 'all' },
    ];

    if (isManager) return allActions;
    if (isOperational) return allActions.filter((item) => item.role === 'all');
    return allActions.filter((item) => item.role !== 'manager');
  }, [isManager, isOperational]);

  const navItems = [
    { key: 'home', icon: 'home', path: '/dashboard' },
    { key: 'agenda', icon: 'calendar_month', path: '/schedule' },
    { key: 'checkout', icon: 'point_of_sale', path: '/checkout' },
    { key: 'profile', icon: 'person', path: '/settings' },
  ];

  const isActive = (path: string): boolean => {
    if (path === '/checkout') return location.pathname.startsWith('/checkout');
    return location.pathname === path;
  };

  const handleNavigate = (path: string, state?: Record<string, unknown>) => {
    setIsQuickMenuOpen(false);
    navigate(path, state ? { state } : undefined);
  };

  return (
    <>
      {isQuickMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setIsQuickMenuOpen(false)}>
          <div className="absolute bottom-24 inset-x-4 rounded-2xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Ações rápidas</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleNavigate(action.path, action.state)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 px-3 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
                >
                  <span className="material-symbols-outlined text-base text-primary">{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden fixed inset-x-0 bottom-4 z-40 px-4">
        <div className="mx-auto max-w-md rounded-full border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-[#121316]/95 px-4 py-2 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-5 items-center">
            {navItems.slice(0, 2).map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.path)}
                className={`mx-auto flex size-11 items-center justify-center rounded-full transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </button>
            ))}

            <button
              onClick={() => setIsQuickMenuOpen((prev) => !prev)}
              className="mx-auto -mt-8 flex size-14 items-center justify-center rounded-full border-4 border-white dark:border-[#121316] bg-primary text-white shadow-2xl shadow-primary/35 transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[24px]">add</span>
            </button>

            {navItems.slice(2).map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.path)}
                className={`mx-auto flex size-11 items-center justify-center rounded-full transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileBottomNav;
