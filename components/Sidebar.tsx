import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Users,
  Package,
  CircleDollarSign,
  BarChart3,
  Settings,
  MonitorDot,
  Bell,
  Sparkles,
  LifeBuoy,
  GraduationCap,
  Headset,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Receipt,
  ShoppingBag,
  UserCheck,
  Scissors,
  Tags,
  Crown,
  Percent,
  TrendingUp,
  BrainCircuit,
  Truck,
  ShoppingCart,
  Wallet,
  ArrowRightLeft,
  Lock,
  FileSpreadsheet,
  CreditCard,
  PieChart,
  Activity,
  Gift,
  Globe,
  ShieldCheck,
  RefreshCw,
  Eye,
  GitBranch,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { isAppModuleEnabled, getFeatureForModule } from '../src/lib/apps/modules';
import { useFeatureFlags } from '../src/hooks/useFeatureFlags';
import { CHANGELOG_VERSION } from '../src/lib/changelog';
import type { AppModuleSlug } from '../domain/shared/app';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenReleaseNotes?: () => void;
  releaseNotesUnseen?: boolean;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
}

interface SubMenuItem {
  name: string;
  icon: LucideIcon;
  path?: string;
  onClick?: () => void;
  badge?: number | string;
  dot?: boolean;
  module?: AppModuleSlug;
  hideFromEsteticaMenu?: boolean;
  operationalAllowed?: boolean;
}

interface MenuEntry {
  name: string;
  icon: LucideIcon;
  type: 'item' | 'group';
  path?: string;
  module?: AppModuleSlug;
  operationalAllowed?: boolean;
  items?: SubMenuItem[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  onOpenReleaseNotes,
  releaseNotesUnseen = false,
  unreadNotificationsCount = 0,
  onOpenNotifications,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessRole, canAccessSuperAdmin, appSlug } = useAuth();
  const labels = getBusinessLabels(appSlug);
  const { can } = useFeatureFlags();
  const isEsteticaApp = appSlug === 'estetica';

  // Desktop open state is inverse of isCollapsed; if parent doesn't control it, keep internal fallback
  const [internalOpen, setInternalOpen] = useState(true);
  const isDesktopExpanded = onToggleCollapse ? !isCollapsed : internalOpen;

  const handleDesktopToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalOpen((prev) => !prev);
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Principal: true,
    Sistema: false,
  });

  const isSupportRoute = location.pathname === '/support';
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(isSupportRoute);

  useEffect(() => {
    if (isSupportRoute) {
      setIsHelpMenuOpen(true);
    }
  }, [isSupportRoute]);

  const isOperationalOnly = accessRole === 'barber' || accessRole === 'receptionist';

  const isModuleAllowed = (moduleName?: AppModuleSlug) => {
    if (!moduleName) return true;
    if (!isAppModuleEnabled(appSlug, moduleName)) return false;

    const feature = getFeatureForModule(moduleName);
    return feature ? can(feature) : true;
  };

  const isSubItemVisible = (item: SubMenuItem) => {
    if (isEsteticaApp && item.hideFromEsteticaMenu) return false;
    if (isOperationalOnly && !item.operationalAllowed) return false;
    return isModuleAllowed(item.module);
  };

  const rawMenuStructure: MenuEntry[] = [
    {
      name: 'Principal',
      icon: LayoutDashboard,
      type: 'group',
      operationalAllowed: true,
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', module: 'dashboard', operationalAllowed: true },
        { name: isEsteticaApp ? 'Agenda' : 'Agenda', icon: CalendarDays, path: '/schedule', module: 'schedule', operationalAllowed: true },
        { name: labels.orderPlural, icon: Receipt, path: '/comandas', module: 'comandas', operationalAllowed: true },
        {
          name: isEsteticaApp ? labels.checkout : 'Checkout / PDV',
          icon: ShoppingBag,
          path: '/checkout?mode=pdv',
          module: 'checkout',
          hideFromEsteticaMenu: true,
          operationalAllowed: true,
        },
        {
          name: 'Cockpit de Operações',
          icon: Activity,
          path: '/operations',
          module: 'dashboard',
          hideFromEsteticaMenu: true,
        },
      ],
    },
    {
      name: 'Cadastros',
      icon: FileText,
      type: 'group',
      items: [
        { name: labels.clientPlural, icon: Users, path: '/clients', module: 'clients' },
        { name: isEsteticaApp ? 'Profissionais' : 'Profissionais', icon: UserCheck, path: '/team', module: 'team' },
        { name: labels.servicePlural, icon: Scissors, path: '/services', module: 'services' },
        { name: 'Produtos', icon: Package, path: '/products', module: 'products' },
        { name: 'Categorias', icon: Tags, path: '/categories', module: 'products', hideFromEsteticaMenu: true },
        { name: 'Fornecedores', icon: Truck, path: '/suppliers', module: 'suppliers', hideFromEsteticaMenu: true },
        { name: 'Promoções', icon: Gift, path: '/promotions', module: 'products', hideFromEsteticaMenu: true },
        { name: 'Maquininhas de Cartão', icon: CreditCard, path: '/payment-terminals', module: 'settings', hideFromEsteticaMenu: true },
      ],
    },
    {
      name: 'Gestão',
      icon: Users,
      type: 'group',
      items: [
        { name: 'Assinaturas (Clube)', icon: Crown, path: '/chef-club-subscriptions', module: 'chef_club' },
        { name: 'Planos do Clube', icon: Sparkles, path: '/chef-club-plans', module: 'chef_club' },
        { name: isEsteticaApp ? 'Repasses' : 'Comissões', icon: Percent, path: '/commissions', module: 'commissions' },
        { name: 'Performance', icon: TrendingUp, path: '/performance', module: 'reports', hideFromEsteticaMenu: true },
        { name: 'Motor de Retorno', icon: BrainCircuit, path: '/smart-return', module: 'clients', hideFromEsteticaMenu: true },
      ],
    },
    {
      name: 'Estoque',
      icon: Package,
      type: 'group',
      items: [
        { name: 'Controle de Estoque', icon: Package, path: '/products', module: 'products' },
        { name: 'Pedidos de Compra', icon: ShoppingCart, path: '/orders', module: 'orders', hideFromEsteticaMenu: true },
      ],
    },
    {
      name: 'Financeiro',
      icon: CircleDollarSign,
      type: 'group',
      items: [
        { name: 'Visão Geral', icon: Wallet, path: '/financial-overview', module: 'financial' },
        { name: 'Fluxo de Caixa', icon: ArrowRightLeft, path: '/cashflow', module: 'cashflow', hideFromEsteticaMenu: true },
        { name: 'Conciliação Bancária', icon: Building2, path: '/bank-reconciliation', module: 'financial', hideFromEsteticaMenu: true },
        { name: 'Fechamento de Caixa', icon: Lock, path: '/cash-closing', module: 'financial', hideFromEsteticaMenu: true },
        { name: 'Contas a Receber', icon: FileSpreadsheet, path: '/accounts-receivable', module: 'financial', hideFromEsteticaMenu: true },
        { name: 'Contas a Pagar', icon: CreditCard, path: '/expenses', module: 'financial', hideFromEsteticaMenu: true },
        { name: 'Folha de Pagamento', icon: Users, path: '/payroll', module: 'financial', hideFromEsteticaMenu: true },
      ],
    },
    {
      name: 'Relatórios',
      icon: BarChart3,
      type: 'group',
      items: [
        { name: 'Vendas e Faturamento', icon: BarChart3, path: '/reports', module: 'reports', hideFromEsteticaMenu: true },
        { name: 'Inteligência (BI)', icon: PieChart, path: '/bi', module: 'reports', hideFromEsteticaMenu: true },
        { name: 'Visão Estratégica', icon: Activity, path: '/strategic-dashboard', module: 'reports', hideFromEsteticaMenu: true },
      ],
    },
    {
      name: 'Configurações',
      icon: Settings,
      type: 'group',
      items: [
        { name: 'Geral da Unidade', icon: Settings, path: '/settings', module: 'settings' },
        { name: 'Agendamento Online', icon: Globe, path: '/booking-settings', module: 'portal' },
        { name: 'Permissões e Perfis', icon: ShieldCheck, path: '/access-control' },
        { name: 'Sincronização Offline', icon: RefreshCw, path: '/offline-sync', operationalAllowed: true },
      ],
    },
    {
      name: 'Sistema',
      icon: MonitorDot,
      type: 'group',
      operationalAllowed: true,
      items: [
        {
          name: 'Avisos',
          icon: Bell,
          badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
          onClick: () => {
            onClose();
            onOpenNotifications?.();
          },
          operationalAllowed: true,
        },
        {
          name: 'Novidades',
          icon: Sparkles,
          dot: releaseNotesUnseen,
          onClick: () => {
            onClose();
            onOpenReleaseNotes?.();
          },
          operationalAllowed: true,
        },
        ...(!isOperationalOnly
          ? [{ name: 'Observabilidade', icon: Eye, path: '/observability' } as SubMenuItem]
          : []),
        ...(canAccessSuperAdmin
          ? [
              { name: 'Super Admin', icon: ShieldCheck, path: '/superadmin' } as SubMenuItem,
              { name: 'Event Versioning', icon: GitBranch, path: '/event-versioning' } as SubMenuItem,
            ]
          : []),
      ],
    },
  ];

  // Filter menu structure according to role and active tenant features
  const menuStructure = rawMenuStructure
    .map((entry) => {
      if (entry.type === 'item') {
        if (isOperationalOnly && !entry.operationalAllowed) return null;
        if (!isModuleAllowed(entry.module)) return null;
        return entry;
      }

      const visibleSubItems = (entry.items || []).filter(isSubItemVisible);
      if (visibleSubItems.length === 0) return null;

      return {
        ...entry,
        items: visibleSubItems,
      };
    })
    .filter(Boolean) as MenuEntry[];

  const isPathActive = (path?: string) => {
    if (!path) return false;
    const cleanTarget = path.split('?')[0];
    return location.pathname === cleanTarget;
  };

  // Auto-expand group containing current active route
  useEffect(() => {
    menuStructure.forEach((entry) => {
      if (entry.type === 'group' && entry.items) {
        const hasActiveChild = entry.items.some((sub) => isPathActive(sub.path));
        if (hasActiveChild) {
          setExpandedGroups((prev) => (prev[entry.name] ? prev : { ...prev, [entry.name]: true }));
        }
      }
    });
  }, [location.pathname]);

  const toggleGroup = (groupName: string) => {
    if (!isDesktopExpanded && onToggleCollapse) {
      onToggleCollapse();
      setExpandedGroups((prev) => ({ ...prev, [groupName]: true }));
      return;
    }
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  const productSubtitle = isEsteticaApp ? 'Aesthetic Intelligence' : 'Barber Intelligence';

  // In mobile drawer, always render expanded content
  const showLabels = isDesktopExpanded || isOpen;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`fixed inset-0 bg-night/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          flex h-screen bg-[#F1ECE0] dark:bg-[#15130F] text-[#6B6252] dark:text-[#A89D8B] font-sans
          transition-all duration-300 shrink-0
          ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'}
          ${isDesktopExpanded ? 'lg:w-72' : 'lg:w-20'}
        `}
      >
        {/* Sidebar Container */}
        <div className="flex flex-col h-full w-full border-r border-[#EFE9D8] dark:border-[#262017] relative">
          {/* Desktop Floating Toggle Button */}
          <button
            type="button"
            onClick={handleDesktopToggle}
            title={isDesktopExpanded ? 'Recolher menu' : 'Expandir menu'}
            aria-label={isDesktopExpanded ? 'Recolher menu' : 'Expandir menu'}
            className="hidden lg:flex absolute -right-3 top-8 bg-[#A96F14] text-[#F7E7C2] rounded-full p-1 shadow-md hover:bg-[#c28827] transition-colors z-30 cursor-pointer"
          >
            {isDesktopExpanded ? <X size={16} /> : <Menu size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="lg:hidden absolute right-4 top-8 text-[#6B6252] dark:text-[#A89D8B] hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2] p-1 rounded-lg transition-colors z-30"
          >
            <X size={20} />
          </button>

          {/* Logo Area */}
          <div
            onClick={() => {
              onClose();
              navigate('/dashboard');
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onClose();
                navigate('/dashboard');
              }
            }}
            className={`flex items-center justify-center h-24 sm:h-28 border-b border-[#EFE9D8] dark:border-[#262017] overflow-hidden shrink-0 cursor-pointer select-none transition-all ${
              showLabels ? 'px-4' : 'px-2'
            }`}
          >
            {showLabels ? (
              <div className="flex items-center justify-center w-full">
                <img
                  src="/branding/smg-barber-intelligence-logo.png"
                  alt="SMG Barber Intelligence"
                  className="h-16 sm:h-20 w-auto max-w-[245px] object-contain filter drop-shadow-[0_0_18px_rgba(245,158,11,0.35)] hover:scale-[1.02] transition-transform"
                />
              </div>
            ) : (
              <div className="relative w-14 h-14 flex items-center justify-center">
                <img
                  src="/branding/smg-chip-hero.png"
                  alt="SMG"
                  className="w-11 h-11 object-contain filter drop-shadow-[0_0_14px_rgba(245,158,11,0.45)]"
                />
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-4 flex flex-col px-3 custom-scrollbar">
            {menuStructure.map((menuItem) => {
              // Render single top-level item (Home)
              if (menuItem.type === 'item' && menuItem.path) {
                const Icon = menuItem.icon;
                const isActive = isPathActive(menuItem.path);
                return (
                  <Link
                    key={menuItem.name}
                    to={menuItem.path}
                    onClick={onClose}
                    className={`flex items-center w-full rounded-lg transition-colors mb-1
                      ${
                        isActive
                          ? 'bg-[#E7DFC6]/60 dark:bg-[#A96F14]/20 text-[#A96F14] dark:text-[#E2A63B] font-semibold'
                          : 'text-[#6B6252] dark:text-[#A89D8B] hover:bg-[#EFE9D8]/60 dark:hover:bg-[#262017] hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2]'
                      }
                      ${showLabels ? 'px-3 py-2.5' : 'p-2.5 justify-center'}
                    `}
                    title={!showLabels ? menuItem.name : ''}
                  >
                    <Icon size={20} className="shrink-0" />
                    {showLabels && <span className="ml-3 text-sm">{menuItem.name}</span>}
                  </Link>
                );
              }

              // Render group item
              if (menuItem.type === 'group') {
                const Icon = menuItem.icon;
                const isExpanded = Boolean(expandedGroups[menuItem.name]);
                const hasItems = Boolean(menuItem.items && menuItem.items.length > 0);
                const hasActiveChild = Boolean(menuItem.items?.some((sub) => isPathActive(sub.path)));

                return (
                  <div key={menuItem.name} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(menuItem.name)}
                      className={`flex items-center w-full rounded-lg transition-colors cursor-pointer
                        ${
                          isExpanded || hasActiveChild
                            ? 'bg-[#EFE9D8]/60 dark:bg-[#262017]/80 text-[#1F1D1A] dark:text-[#F3EEE2] font-medium'
                            : 'text-[#6B6252] dark:text-[#A89D8B] hover:bg-[#EFE9D8]/40 dark:hover:bg-[#262017]/50 hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2]'
                        }
                        ${showLabels ? 'px-3 py-2.5' : 'p-2.5 justify-center'}
                      `}
                      title={!showLabels ? menuItem.name : ''}
                    >
                      <Icon
                        size={20}
                        className={`shrink-0 ${hasActiveChild ? 'text-[#A96F14] dark:text-[#E2A63B]' : ''}`}
                      />

                      {showLabels && (
                        <>
                          <span className="ml-3 text-sm flex-1 text-left">{menuItem.name}</span>
                          {hasItems &&
                            (isExpanded ? (
                              <ChevronDown size={16} className="opacity-70" />
                            ) : (
                              <ChevronRight size={16} className="opacity-70" />
                            ))}
                        </>
                      )}
                    </button>

                    {/* Sub-items */}
                    {showLabels && isExpanded && hasItems && (
                      <div className="mt-1 flex flex-col space-y-1 relative pl-7">
                        {/* Vertical line connecting sub-items */}
                        <div className="absolute left-[22px] top-0 bottom-2 w-px bg-[#E3DCB8] dark:bg-[#342B1C]"></div>

                        {menuItem.items!.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = isPathActive(subItem.path);

                          const itemClasses = `flex items-center w-full rounded-lg px-3 py-2 transition-colors relative z-10 cursor-pointer
                            ${
                              isSubActive
                                ? 'bg-[#E7DFC6]/60 dark:bg-[#A96F14]/20 text-[#A96F14] dark:text-[#E2A63B] font-semibold'
                                : 'text-[#6B6252] dark:text-[#A89D8B] hover:bg-[#EFE9D8]/50 dark:hover:bg-[#262017] hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2]'
                            }
                          `;

                          const content = (
                            <>
                              <SubIcon
                                size={18}
                                className={`shrink-0 mr-3 ${
                                  isSubActive
                                    ? 'text-[#A96F14] dark:text-[#E2A63B]'
                                    : 'text-[#6B6252]/70 dark:text-[#A89D8B]/70'
                                }`}
                              />
                              <span className="text-sm flex-1 text-left truncate">{subItem.name}</span>

                              {subItem.badge !== undefined && (
                                <span className="bg-[#050505] dark:bg-[#E2A63B] text-[#F7E7C2] dark:text-[#15130F] text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {subItem.badge}
                                </span>
                              )}
                              {subItem.dot && (
                                <span className="size-2 rounded-full bg-[#A96F14] dark:bg-[#E2A63B]" />
                              )}
                            </>
                          );

                          if (subItem.path) {
                            return (
                              <Link
                                key={`${subItem.name}-${subItem.path}`}
                                to={subItem.path}
                                onClick={onClose}
                                className={itemClasses}
                              >
                                {content}
                              </Link>
                            );
                          }

                          return (
                            <button
                              key={subItem.name}
                              type="button"
                              onClick={subItem.onClick}
                              className={itemClasses}
                            >
                              {content}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </nav>

          {/* Bottom Area */}
          <div className="border-t border-[#EFE9D8] dark:border-[#262017] flex flex-col bg-[#F1ECE0] dark:bg-[#15130F] shrink-0">
            {/* Bottom Links */}
            <div className="py-2 px-3 flex flex-col gap-1">
              {onOpenReleaseNotes && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReleaseNotes();
                  }}
                  title={`Novidades da versão v${CHANGELOG_VERSION}`}
                  className={`flex items-center w-full rounded-lg text-[#6B6252]/80 dark:text-[#A89D8B]/80 hover:bg-[#EFE9D8] dark:hover:bg-[#262017] hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2] transition-colors cursor-pointer ${
                    showLabels ? 'px-3 py-2' : 'p-2 justify-center'
                  }`}
                >
                  <Sparkles size={18} className="shrink-0" />
                  {showLabels && (
                    <span className="ml-3 text-sm flex-1 text-left">v{CHANGELOG_VERSION}</span>
                  )}
                  {releaseNotesUnseen && (
                    <span className="size-2 rounded-full bg-[#A96F14] dark:bg-[#E2A63B]" />
                  )}
                </button>
              )}

              {!isEsteticaApp && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      if (!showLabels) {
                        onClose();
                        navigate('/support?tab=academy');
                      } else {
                        setIsHelpMenuOpen((prev) => !prev);
                      }
                    }}
                    title={!showLabels ? 'Precisa de ajuda?' : ''}
                    className={`flex items-center justify-between w-full rounded-lg text-[#6B6252]/80 dark:text-[#A89D8B]/80 hover:bg-[#EFE9D8] dark:hover:bg-[#262017] hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2] transition-colors cursor-pointer ${
                      showLabels ? 'px-3 py-2' : 'p-2 justify-center'
                    } ${isSupportRoute ? 'bg-[#EFE9D8]/60 dark:bg-[#262017]/60 text-[#1F1D1A] dark:text-[#F3EEE2] font-semibold' : ''}`}
                  >
                    <div className="flex items-center">
                      <LifeBuoy size={18} className="shrink-0" />
                      {showLabels && <span className="ml-3 text-sm">Precisa de ajuda?</span>}
                    </div>
                    {showLabels && (
                      <ChevronDown
                        size={15}
                        className={`transition-transform duration-200 text-[#6B6252]/60 dark:text-[#A89D8B]/60 ${
                          isHelpMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>

                  {showLabels && isHelpMenuOpen && (
                    <div className="mt-1 ml-4 pl-3 border-l border-[#EFE9D8] dark:border-[#262017] space-y-1">
                      <Link
                        to="/support?tab=academy"
                        onClick={onClose}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isSupportRoute && (location.search.includes('tab=academy') || !location.search.includes('tab='))
                            ? 'bg-[#EFE9D8] dark:bg-[#262017] text-[#A96F14] dark:text-[#E2A63B]'
                            : 'text-[#6B6252] dark:text-[#A89D8B] hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2] hover:bg-[#EFE9D8] dark:hover:bg-[#262017]'
                        }`}
                      >
                        <GraduationCap size={15} className="shrink-0 text-[#A96F14] dark:text-[#E2A63B]" />
                        <span>SMG Academy</span>
                      </Link>
                      <Link
                        to="/support?tab=tickets"
                        onClick={onClose}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isSupportRoute && location.search.includes('tab=tickets')
                            ? 'bg-[#EFE9D8] dark:bg-[#262017] text-[#A96F14] dark:text-[#E2A63B]'
                            : 'text-[#6B6252] dark:text-[#A89D8B] hover:text-[#1F1D1A] dark:hover:text-[#F3EEE2] hover:bg-[#EFE9D8] dark:hover:bg-[#262017]'
                        }`}
                      >
                        <Headset size={15} className="shrink-0 text-[#A96F14] dark:text-[#E2A63B]" />
                        <span>Chamados de Suporte</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
