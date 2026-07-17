import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { isAppModuleEnabled } from '../src/lib/apps/modules';
import type { AppModuleSlug } from '../src/lib/supabase/schemas';

type QuickActionRole = 'all' | 'manager' | 'operational';

interface QuickActionItem {
  label: string;
  icon: string;
  path: string;
  state?: Record<string, unknown>;
  role: QuickActionRole;
  module?: AppModuleSlug;
  hideFromEsteticaNav?: boolean;
}

interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
  module?: AppModuleSlug;
}

export const isMobileBottomNavRoute = (pathname: string, appSlug?: string | null): boolean => {
  const normalized = pathname.toLowerCase();

  if (appSlug === 'estetica') {
    return (
      normalized === '/dashboard' ||
      normalized === '/schedule' ||
      normalized === '/clients' ||
      normalized === '/comandas' ||
      normalized === '/services' ||
      normalized === '/financial-overview' ||
      normalized === '/settings'
    );
  }

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
  const { accessRole, canAccessSuperAdmin, appSlug } = useAuth();
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const shouldRender = isMobileBottomNavRoute(location.pathname, appSlug);

  const isManager = canAccessSuperAdmin || accessRole === 'manager' || accessRole === 'adminmanager';
  const isOperational = accessRole === 'barber' || accessRole === 'receptionist';

  const quickActions = useMemo<QuickActionItem[]>(() => {
    const allActions: QuickActionItem[] = [
      { label: isEsteticaApp ? 'Novo agendamento' : 'Novo Agendamento', icon: 'calendar_add_on', path: '/schedule', state: { openNewAppointment: true }, role: 'all', module: 'schedule' },
      { label: isEsteticaApp ? `Novo ${labels.client.toLowerCase()}` : 'Novo Cliente', icon: 'person_add', path: '/clients', state: { openNewClient: true }, role: 'manager', module: 'clients' },
      { label: isEsteticaApp ? `Novo ${labels.service.toLowerCase()}` : 'Novo Serviço', icon: 'content_cut', path: '/services', state: { openNewService: true }, role: 'manager', module: 'services' },
      { label: isEsteticaApp ? 'Novo produto' : 'Novo Produto', icon: 'inventory_2', path: '/products', state: { openNewProduct: true }, role: 'manager', module: 'products' },
      { label: isEsteticaApp ? `Novo ${labels.professional.toLowerCase()}` : 'Novo Profissional', icon: 'badge', path: '/team', state: { openNewTeamMember: true }, role: 'manager', module: 'team' },
      { label: isEsteticaApp ? `Novo ${labels.order.toLowerCase()}` : 'Nova Comanda', icon: 'point_of_sale', path: '/checkout?mode=comanda', role: 'all', module: 'checkout', hideFromEsteticaNav: true },
    ];
    const moduleActions = allActions.filter((item) =>
      !(isEsteticaApp && item.hideFromEsteticaNav) &&
      (!item.module || isAppModuleEnabled(appSlug, item.module))
    );

    if (isManager) return moduleActions;
    if (isOperational) return moduleActions.filter((item) => item.role === 'all');
    return moduleActions.filter((item) => item.role !== 'manager');
  }, [appSlug, isEsteticaApp, isManager, isOperational, labels.client, labels.order, labels.professional, labels.service]);

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = isEsteticaApp
      ? [
          { key: 'agenda', label: 'Agenda', icon: 'calendar_month', path: '/schedule', module: 'schedule' },
          { key: 'clients', label: labels.clientPlural, icon: 'group', path: '/clients', module: 'clients' },
          { key: 'orders', label: labels.orderPlural, icon: 'receipt', path: '/comandas', module: 'comandas' },
          { key: 'services', label: labels.servicePlural, icon: 'content_cut', path: '/services', module: 'services' },
        ]
      : [
          { key: 'home', label: 'Início', icon: 'home', path: '/dashboard', module: 'dashboard' },
          { key: 'agenda', label: 'Agenda', icon: 'calendar_month', path: '/schedule', module: 'schedule' },
          { key: 'checkout', label: labels.checkout, icon: 'point_of_sale', path: '/checkout?mode=pdv', module: 'checkout' },
          { key: 'profile', label: 'Perfil', icon: 'person', path: '/settings', module: 'settings' },
        ];

    return items.filter((item) => !item.module || isAppModuleEnabled(appSlug, item.module));
  }, [appSlug, isEsteticaApp, labels.checkout, labels.clientPlural, labels.orderPlural, labels.servicePlural]);

  const isActive = (path: string): boolean => {
    if (path.startsWith('/checkout')) return location.pathname.startsWith('/checkout');
    return location.pathname === path;
  };

  const handleNavigate = (path: string, state?: Record<string, unknown>) => {
    setIsQuickMenuOpen(false);
    navigate(path, state ? { state } : undefined);
  };

  if (!shouldRender) return null;

  return (
    <>
      {isQuickMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setIsQuickMenuOpen(false)}>
          <div className="absolute bottom-24 inset-x-4 rounded-2xl border border-[#D9EAF5] dark:border-[#14304A] bg-white dark:bg-[#071426] p-3 shadow-[0_24px_70px_rgba(0,51,102,0.22)]" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-[10px] font-black uppercase text-[#003366] dark:text-[#00D2FF]">Ações rápidas</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleNavigate(action.path, action.state)}
                  className="flex items-center gap-2 rounded-xl border border-[#D9EAF5] dark:border-[#14304A] bg-[#F7FBFE] dark:bg-[#0B1828] px-3 py-3 text-left text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors hover:border-[#00D2FF]/40 hover:bg-[#EAF7FF] dark:hover:bg-[#102033]"
                >
                  <span className="material-symbols-outlined text-base text-[#007BFF] dark:text-[#00D2FF]">{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden fixed inset-x-0 bottom-4 z-40 px-4">
        <div className="mx-auto max-w-md rounded-full border border-[#D9EAF5]/90 dark:border-[#14304A] bg-white/95 dark:bg-[#071426]/95 px-4 py-2 shadow-[0_20px_55px_rgba(0,51,102,0.20)] backdrop-blur-xl">
          <div className="grid grid-cols-5 items-center">
            {navItems.slice(0, 2).map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.path)}
                aria-label={item.label}
                className={`mx-auto flex size-11 items-center justify-center rounded-full transition-colors ${
                  isActive(item.path)
                    ? 'bg-[#007BFF] text-white shadow-[0_8px_24px_rgba(0,123,255,0.25)]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-[#EAF7FF] dark:hover:bg-[#102033] hover:text-[#007BFF] dark:hover:text-[#00D2FF]'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </button>
            ))}

            <button
              onClick={() => setIsQuickMenuOpen((prev) => !prev)}
              className="mx-auto -mt-8 flex size-14 items-center justify-center rounded-full border-4 border-white dark:border-[#071426] bg-gradient-to-br from-[#00D2FF] to-[#007BFF] text-white shadow-[0_18px_36px_rgba(0,210,255,0.28)] transition-transform active:scale-95"
              aria-label={isQuickMenuOpen ? 'Fechar ações rápidas' : 'Abrir ações rápidas'}
            >
              <span className="material-symbols-outlined text-[24px]">add</span>
            </button>

            {navItems.slice(2).map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.path)}
                aria-label={item.label}
                className={`mx-auto flex size-11 items-center justify-center rounded-full transition-colors ${
                  isActive(item.path)
                    ? 'bg-[#007BFF] text-white shadow-[0_8px_24px_rgba(0,123,255,0.25)]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-[#EAF7FF] dark:hover:bg-[#102033] hover:text-[#007BFF] dark:hover:text-[#00D2FF]'
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
