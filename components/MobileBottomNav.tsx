import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { isAppModuleEnabled } from '../src/lib/apps/modules';
import type { AppModuleSlug } from '../domain/shared/app';

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
  path?: string;
  onClick?: () => void;
  module?: AppModuleSlug;
}

interface MobileBottomNavProps {
  onOpenMenu?: () => void;
}

export const isMobileBottomNavRoute = (pathname: string, _appSlug?: string | null): boolean => {
  const normalized = pathname.toLowerCase();

  // Rotas públicas / isoladas onde o menu inferior não deve aparecer
  if (
    normalized === '/' ||
    normalized.startsWith('/login') ||
    normalized.startsWith('/register') ||
    normalized.startsWith('/reset-password') ||
    normalized.startsWith('/accept-invite') ||
    normalized.startsWith('/pending-approval') ||
    normalized.startsWith('/kiosk') ||
    normalized.startsWith('/c/') ||
    normalized.startsWith('/agendar') ||
    normalized.startsWith('/booking') ||
    normalized.startsWith('/feedback') ||
    normalized.startsWith('/r/') ||
    normalized.startsWith('/onboarding')
  ) {
    return false;
  }

  // Todas as telas internas renderizadas pelo Layout devem exibir o menu inferior
  return true;
};

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenMenu }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessRole, canAccessSuperAdmin, appSlug } = useAuth();
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const shouldRender = isMobileBottomNavRoute(location.pathname, appSlug);

  const isManager = canAccessSuperAdmin || accessRole === 'manager';
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
    const items: NavItem[] = [
      { key: 'home', label: 'Início', icon: 'home', path: '/dashboard', module: 'dashboard' },
      { key: 'agenda', label: 'Agenda', icon: 'calendar_month', path: '/schedule', module: 'schedule' },
      { key: 'orders', label: labels.orderPlural, icon: 'receipt_long', path: '/comandas', module: 'comandas' },
      { key: 'menu', label: 'Menu', icon: 'menu', onClick: onOpenMenu },
    ];

    return items;
  }, [labels.orderPlural, onOpenMenu]);

  const isActive = (path?: string): boolean => {
    if (!path) return false;
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
        <div className="lg:hidden fixed inset-0 z-40 bg-night/40 backdrop-blur-sm" onClick={() => setIsQuickMenuOpen(false)}>
          <div className="absolute bottom-24 inset-x-4 rounded-2xl border border-line bg-card p-3 shadow-smg-shell" onClick={(e) => e.stopPropagation()}>
            <p className="px-2 py-1 text-[10px] font-black uppercase text-primary-dark">Ações rápidas</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleNavigate(action.path, action.state)}
                  className="flex items-center gap-2 rounded-xl border border-line bg-gold-pale px-3 py-3 text-left text-xs font-bold text-ink transition-colors hover:border-primary hover:bg-gold-soft"
                >
                  <span className="material-symbols-outlined text-base text-primary-dark">{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden fixed inset-x-0 bottom-4 z-40 px-4">
        <div className="mx-auto max-w-md rounded-full border border-line bg-card/95 px-4 py-2 shadow-smg-shell backdrop-blur-xl">
          <div className="grid grid-cols-5 items-center">
            {navItems.slice(0, 2).map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  else if (item.path) handleNavigate(item.path);
                }}
                aria-label={item.label}
                className={`mx-auto flex flex-col items-center justify-center size-11 transition-colors ${
                  isActive(item.path)
                    ? 'bg-gold-soft text-primary-dark shadow-smg-glow rounded-full'
                    : 'text-ink-soft hover:bg-gold-pale hover:text-ink rounded-full'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span className="text-[9px] font-medium leading-none mt-0.5">{item.label}</span>
              </button>
            ))}

            <button
              onClick={() => setIsQuickMenuOpen((prev) => !prev)}
              className="mx-auto -mt-8 flex size-14 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-primary to-primary-dark text-night shadow-smg-glow transition-transform active:scale-95 cursor-pointer"
              aria-label={isQuickMenuOpen ? 'Fechar ações rápidas' : 'Abrir ações rápidas'}
            >
              <span className="material-symbols-outlined text-xl">add</span>
            </button>

            {navItems.slice(2).map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  else if (item.path) handleNavigate(item.path);
                }}
                aria-label={item.label}
                className={`mx-auto flex flex-col items-center justify-center size-11 transition-colors cursor-pointer ${
                  isActive(item.path)
                    ? 'bg-gold-soft text-primary-dark shadow-smg-glow rounded-full'
                    : 'text-ink-soft hover:bg-gold-pale hover:text-ink rounded-full'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <span className="text-[9px] font-medium leading-none mt-0.5">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileBottomNav;
