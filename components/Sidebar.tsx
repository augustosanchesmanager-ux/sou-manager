import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import Logo from './Logo';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { isAppModuleEnabled } from '../src/lib/apps/modules';
import type { AppModuleSlug } from '../src/lib/supabase/schemas';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface ChildItem {
  name: string;
  path: string;
  module?: AppModuleSlug;
  hideFromEsteticaMenu?: boolean;
}

interface SubGroup {
  type: 'subgroup';
  name: string;
  icon: string;
  items: ChildItem[];
}

type ChildOrSubGroup = ChildItem | SubGroup;

interface MenuItem {
  name: string;
  path?: string;
  icon: string;
  module?: AppModuleSlug;
  hideFromEsteticaMenu?: boolean;
  children?: ChildOrSubGroup[];
}

interface MenuCategory {
  title: string;
  icon: string;
  items: MenuItem[];
  compact?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed = false, onToggleCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, accessRole, canAccessSuperAdmin, appSlug } = useAuth();
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Menu Definition structure
  const menuCategories: MenuCategory[] = [
    {
      title: 'INÍCIO',
      icon: 'dashboard',
      compact: true,
      items: [
        { name: isEsteticaApp ? 'Dashboard' : 'Início', icon: 'dashboard', path: '/dashboard', module: 'dashboard' }
      ]
    },
    {
      title: 'NEGÓCIOS',
      icon: 'business_center',
      items: [
        { name: 'Painel Estratégico', icon: 'insights', path: '/strategic-dashboard', module: 'dashboard', hideFromEsteticaMenu: true },
        { name: 'Visão do Negócio', icon: 'query_stats', path: '/bi', module: 'dashboard', hideFromEsteticaMenu: true },
        { name: 'Motor de Retorno', icon: 'psychology', path: '/smart-return', module: 'clients', hideFromEsteticaMenu: true },
        {
          name: labels.package,
          icon: 'workspace_premium',
          module: 'chef_club',
          children: [
            { name: 'Planos', path: '/chef-club-plans', module: 'chef_club' },
            { name: 'Assinaturas', path: '/chef-club-subscriptions', module: 'chef_club' },
            { name: labels.credits, path: '/chef-club-subscriptions', module: 'chef_club' },
          ]
        }
      ]
    },
    {
      title: 'OPERAÇÃO',
      icon: 'sync_alt',
      items: [
        { name: isEsteticaApp ? 'Agenda' : 'Agendamentos', icon: 'calendar_month', path: '/schedule', module: 'schedule' },
        { name: labels.clientPlural, icon: 'group', path: '/clients', module: 'clients' },
        { name: labels.orderPlural, icon: 'receipt', path: '/comandas', module: 'comandas' },
        { name: isEsteticaApp ? labels.checkout : 'Checkout / PDV', icon: 'point_of_sale', path: '/checkout?mode=pdv', module: 'checkout', hideFromEsteticaMenu: true },
        { name: 'Operações Diárias', icon: 'assignment', path: '/operations', module: 'dashboard', hideFromEsteticaMenu: true },
      ]
    },
    {
      title: 'ADMINISTRAÇÃO',
      icon: 'admin_panel_settings',
      items: [
        { name: labels.servicePlural, icon: 'content_cut', path: '/services', module: 'services' },
        { name: isEsteticaApp ? 'Produtos / Estoque' : 'Produtos', icon: 'inventory_2', path: '/products', module: 'products' },
        { name: labels.professionalPlural, icon: 'groups', path: '/team', module: 'team' },
        { name: 'Categorias', icon: 'category', path: '/categories', module: 'products', hideFromEsteticaMenu: true },
        { name: 'Kiosk', icon: 'tablet_android', path: '/kiosk-admin', module: 'kiosk' },
        { name: 'Portal', icon: 'public', path: '/portal-admin', module: 'portal' },
        { name: 'Fornecedores', icon: 'local_shipping', path: '/suppliers', module: 'suppliers', hideFromEsteticaMenu: true },
      ]
    },
    {
      title: 'FINANCEIRO',
      icon: 'payments',
      items: [
        { name: isEsteticaApp ? 'Financeiro' : 'Visao Geral', icon: 'account_balance_wallet', path: '/financial-overview', module: 'financial' },
        { name: 'Fluxo de Caixa',          icon: 'swap_horiz',            path: '/cashflow', module: 'cashflow', hideFromEsteticaMenu: true },
        { name: 'Contas a Receber',        icon: 'request_quote',         path: '/accounts-receivable', module: 'financial', hideFromEsteticaMenu: true },
        { name: 'Recibos',                 icon: 'receipt_long',           path: '/receipts', module: 'financial', hideFromEsteticaMenu: true },
        { name: 'Contas a Pagar',         icon: 'event_busy',             path: '/expenses', module: 'financial', hideFromEsteticaMenu: true },
        { name: 'Recebimentos do Clube',  icon: 'workspace_premium',      path: '/chef-club-receivables', module: 'chef_club' },
        { name: 'Conferencia de Caixa',   icon: 'lock',                   path: '/cash-closing', module: 'financial', hideFromEsteticaMenu: true },
        { name: isEsteticaApp ? 'Repasses' : 'Comissoes', icon: 'percent', path: '/commissions', module: 'commissions' },
        { name: isEsteticaApp ? 'Relatórios' : 'Relatorios', icon: 'summarize', path: '/reports', module: 'reports', hideFromEsteticaMenu: true },
      ]
    }
  ];

  // System items go at the bottom
  const systemItems: MenuItem[] = [
    { name: 'Offline seguro', icon: 'sync_problem', path: '/offline-sync' },
    { name: 'Configurações', icon: 'settings', path: '/settings', module: 'settings' },
    { name: 'Suporte', icon: 'support_agent', path: '/support', hideFromEsteticaMenu: true },
  ];

  // Auto-expand group if current path is inside it
  useEffect(() => {
    const currentPath = location.pathname;

    const checkExpandables = (items: MenuItem[] | ChildOrSubGroup[]) => {
      items.forEach(item => {
        if ('children' in item && item.children) {
          const hasActiveChild = checkIsGroupActive(item.children);
          if (hasActiveChild && !expandedGroups.includes(item.name)) {
            setExpandedGroups(prev => [...prev, item.name]);
          }
          checkExpandables(item.children); // recursively check
        } else if ('type' in item && item.type === 'subgroup') {
          const hasActiveChild = item.items.some(i => i.path === currentPath);
          if (hasActiveChild && !expandedGroups.includes(item.name)) {
            setExpandedGroups(prev => [...prev, item.name]);
          }
        }
      });
    };

    menuCategories.forEach(category => {
      // Check if category has active child
      const hasActiveChild = category.items.some(item => {
        if (item.path && isActive(item.path)) return true;
        if (item.children && checkIsGroupActive(item.children)) return true;
        return false;
      });
      if (hasActiveChild && !expandedGroups.includes(category.title)) {
        setExpandedGroups(prev => [...prev, category.title]);
      }
      checkExpandables(category.items);
    });
  }, [location.pathname]);

  const toggleGroup = (name: string) => {
    if (isCollapsed && onToggleCollapse) {
      onToggleCollapse(); // expand sidebar if user clicks a group
    }
    setExpandedGroups(prev =>
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    );
  };

  const isActive = (path: string) => location.pathname === path.split('?')[0];

  const checkIsGroupActive = (children: ChildOrSubGroup[]): boolean => {
    return children.some(child => {
      if ('type' in child && child.type === 'subgroup') {
        return child.items.some(i => i.path === location.pathname);
      }
      return (child as ChildItem).path === location.pathname;
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleChangePlan = async (newPlan: string) => {
    setIsUpdatingPlan(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { plan: newPlan }
      });
      if (error) throw error;
      setIsPlanModalOpen(false);
      setIsProfileModalOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Erro ao mudar plano:', err);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const userRole = canAccessSuperAdmin
    ? 'Super Admin'
    : accessRole === 'barber'
      ? 'Barber'
      : accessRole === 'receptionist'
        ? 'Receptionist'
        : accessRole === 'adminmanager'
          ? 'Admin Manager'
          : accessRole === 'manager'
            ? 'Manager'
            : '';
  const isOperationalOnly = accessRole === 'barber' || accessRole === 'receptionist';
  const navActiveClass = isEsteticaApp
    ? 'bg-[#EFE8D8] text-[#2E2B24] ring-1 ring-[#D8C994]/70 shadow-[0_10px_24px_rgba(111,104,69,0.13)]'
    : 'bg-[#EAF7FF] dark:bg-[#0D2238] text-[#003366] dark:text-[#F5FCFF] ring-1 ring-[#00D2FF]/25 shadow-[0_8px_24px_rgba(0,123,255,0.10)]';
  const navIdleClass = isEsteticaApp
    ? 'text-[#6F6758] hover:bg-[#EFE8D8]/70 hover:text-[#2E2B24]'
    : 'text-slate-600 dark:text-[#A7B8C8] hover:bg-[#F7FBFE] dark:hover:bg-[#102033] hover:text-[#003366] dark:hover:text-[#F5FCFF]';
  const navIconActiveClass = isEsteticaApp ? 'text-[#6F6845]' : 'text-[#007BFF] dark:text-[#00D2FF]';
  const navSectionActiveClass = isEsteticaApp ? 'text-[#6F6845]' : 'text-[#007BFF] dark:text-[#00D2FF]';
  const navSectionIdleClass = isEsteticaApp
    ? 'text-[#9B9368]/70 group-hover:text-[#6F6845]'
    : 'text-slate-400 dark:text-[#A7B8C8]/60 group-hover:text-[#003366] dark:group-hover:text-[#A7B8C8]';
  const sidebarShellClass = isEsteticaApp
    ? 'bg-[#F8F5ED] border-[#DDD2B6] shadow-[0_24px_70px_rgba(111,104,69,0.18)] lg:shadow-[0_18px_50px_rgba(111,104,69,0.12)]'
    : 'bg-white dark:bg-[#071426] border-[#D9EAF5] dark:border-[#14304A] shadow-[0_24px_70px_rgba(0,51,102,0.18)] lg:shadow-[0_18px_50px_rgba(0,51,102,0.10)]';
  const collapsedLogoClass = isEsteticaApp
    ? 'bg-[#F8F5ED] border border-[#D8C994] text-[#6F6845] shadow-[0_12px_24px_rgba(111,104,69,0.16)]'
    : 'bg-gradient-to-br from-[#00D2FF] to-[#007BFF] text-white shadow-[0_0_22px_rgba(0,210,255,0.24)]';
  const tooltipClass = isEsteticaApp
    ? 'bg-[#2E2B24] text-[#F8F5ED]'
    : 'bg-[#003366] dark:bg-[#EAF7FF] text-white dark:text-[#003366]';
  const tooltipArrowClass = isEsteticaApp
    ? 'border-r-[#2E2B24]'
    : 'border-r-[#003366] dark:border-r-[#EAF7FF]';
  const footerClass = isEsteticaApp
    ? 'border-[#DDD2B6] bg-[#F8F5ED]'
    : 'border-[#D9EAF5] dark:border-[#14304A] bg-white dark:bg-[#071426]';
  const profileButtonClass = isEsteticaApp
    ? isCollapsed
      ? 'p-1.5 border-transparent hover:bg-[#EFE8D8]'
      : 'p-3 bg-white border-[#DDD2B6] hover:border-[#D8C994]'
    : isCollapsed
      ? 'p-1.5 border-transparent hover:bg-[#F7FBFE] dark:hover:bg-[#102033]'
      : 'p-3 bg-[#F7FBFE] dark:bg-[#0B1828] border-[#D9EAF5] dark:border-[#14304A] hover:border-[#00D2FF]/45 dark:hover:border-[#00D2FF]/50';
  const profileAvatarClass = canAccessSuperAdmin
    ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-[#C6A45A] text-amber-600'
    : isEsteticaApp
      ? 'bg-[#EFE8D8] border-[#D8C994] text-[#6F6845]'
      : 'bg-[#EAF7FF] dark:bg-[#0D2238] border-[#00D2FF]/35 text-[#007BFF] dark:text-[#00D2FF]';
  const planOptions = isEsteticaApp
    ? [
        { id: 'free', name: 'Starter', monthlyPrice: '0,00', annualPrice: '0,00', desc: 'Agenda e Clientes', icon: 'bolt', color: 'slate' },
        { id: 'pro', name: 'Professional', monthlyPrice: '59,90', annualPrice: '599,00', desc: 'Procedimentos, equipe e finalização', icon: 'auto_awesome', color: 'primary' },
        { id: 'elite', name: 'Elite', monthlyPrice: '99,90', annualPrice: '999,00', desc: 'IA, retornos e gestão avançada', icon: 'workspace_premium', color: 'amber' },
      ]
    : [
        { id: 'free', name: 'Starter', monthlyPrice: '0,00', annualPrice: '0,00', desc: 'Agendamentos e Clientes', icon: 'bolt', color: 'slate' },
        { id: 'pro', name: 'Professional', monthlyPrice: '59,90', annualPrice: '599,00', desc: 'Checkout, Folha e Recibos', icon: 'auto_awesome', color: 'primary' },
        { id: 'elite', name: 'Elite', monthlyPrice: '99,90', annualPrice: '999,00', desc: 'IA, Motor de Retorno e Totem', icon: 'workspace_premium', color: 'amber' },
      ];
  const isModuleAllowed = (moduleName?: AppModuleSlug) =>
    !moduleName || isAppModuleEnabled(appSlug, moduleName);
  const isMenuItemVisible = (item: MenuItem | ChildItem) =>
    !(isEsteticaApp && item.hideFromEsteticaMenu);
  const isChildAllowed = (child: ChildOrSubGroup): boolean => {
    if ('type' in child && child.type === 'subgroup') {
      return child.items.some((item) => isMenuItemVisible(item) && isModuleAllowed(item.module));
    }

    const item = child as ChildItem;
    return isMenuItemVisible(item) && isModuleAllowed(item.module);
  };

  // Filter based on role
  const filteredCategories = menuCategories.map(category => {
    if (userRole === 'Barber' && category.title !== 'OPERAÇÃO' && category.title !== 'INÍCIO' && category.title !== 'DASHBOARD') {
      if (category.title === 'ADMINISTRAÇÃO') {
        return null;
      }
      return null;
    }
    // Deep clone and filter items
    const filteredItems = category.items.map(item => {
      if (!isMenuItemVisible(item)) {
        return null;
      }

      if (!isModuleAllowed(item.module)) {
        return null;
      }

      if (userRole === 'Barber' && item.children) {
        // remove specific children logic here if needed
        return { ...item, children: item.children.filter(isChildAllowed) };
      }

      if (item.children) {
        const filteredChildren = item.children.filter(isChildAllowed);
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }

      return item;
    }).filter(Boolean) as MenuItem[];

    if (filteredItems.length === 0) return null;

    return { ...category, items: filteredItems };
  }).filter(Boolean) as MenuCategory[];

  if (canAccessSuperAdmin) {
    filteredCategories.push({
      title: 'MASTER',
      icon: 'shield_person',
      items: [
        { name: 'Administração Geral', icon: 'shield_person', path: '/superadmin' },
        { name: 'Monitoramento Supabase', icon: 'monitor_heart', path: '/admin/supabase-monitoring' },
      ]
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        border-r lg:border ${sidebarShellClass}
        flex flex-col h-screen shrink-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]
        overflow-visible
        lg:my-4 lg:ml-4 lg:h-[calc(100vh-2rem)] lg:rounded-[2rem]
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        ${isCollapsed ? 'lg:w-[80px]' : 'lg:w-[280px] w-[280px]'}
      `}>
        <div className={`p-5 flex items-center justify-between lg:justify-start gap-3 h-16 shrink-0 ${isCollapsed ? 'lg:justify-center' : ''}`}>
          {(!isCollapsed || !window.matchMedia('(min-width: 1024px)').matches) ? (
            <Logo />
          ) : (
            <div className={`size-8 rounded-xl flex items-center justify-center font-black text-xl shrink-0 ${collapsedLogoClass}`}>
              S
            </div>
          )}
          <button onClick={onClose} className={`lg:hidden transition-colors ${isEsteticaApp ? 'text-[#6F6758] hover:text-[#6F6845]' : 'text-slate-500 hover:text-[#007BFF] dark:hover:text-[#00D2FF]'}`} aria-label="Fechar menu">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
          {filteredCategories.map((category, idx) => (
            <div key={idx} className="flex flex-col gap-1">
              {category.compact ? (
                category.items.map((item) => {
                  const isCompactActive = item.path ? isActive(item.path) : false;
                  return (
                    <div key={item.path || item.name} className="relative group/menuitem">
                      <Link
                        to={item.path!}
                        onClick={onClose}
                        className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all relative overflow-hidden
                          ${isCompactActive ? navActiveClass : navIdleClass}
                          ${isCollapsed ? 'justify-center' : 'justify-start'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined text-[20px] ${isCompactActive ? navIconActiveClass : ''} transition-colors duration-300`}>{item.icon}</span>
                          {!isCollapsed && <span className={`text-sm transition-all duration-300 ${isCompactActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>}
                        </div>
                      </Link>

                      {isCollapsed && (
                        <div className={`absolute left-16 top-1/2 -translate-y-1/2 px-3 py-2 text-xs font-bold rounded-lg opacity-0 invisible group-hover/menuitem:opacity-100 group-hover/menuitem:visible transition-all whitespace-nowrap z-50 shadow-xl pointer-events-none ${tooltipClass}`}>
                          {item.name}
                          <div className={`absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 ${tooltipArrowClass}`}></div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <>
              {/* Category Title Toggle */}
              <button
                onClick={() => toggleGroup(category.title)}
                className={`
                 flex items-center px-2 py-1 mb-1 transition-all duration-300 group focus:outline-none
                 ${isCollapsed ? 'justify-center mx-auto' : `justify-between w-full rounded-lg ${isEsteticaApp ? 'hover:bg-[#EFE8D8]/70' : 'hover:bg-[#F7FBFE] dark:hover:bg-[#102033]'}`}
                `}
                disabled={isCollapsed}
              >
                {isCollapsed ? (
                  <div className={`w-6 border-b-2 mt-2 ${isEsteticaApp ? 'border-[#DDD2B6]' : 'border-[#D9EAF5] dark:border-[#14304A]'}`} />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[16px] transition-colors
                        ${expandedGroups.includes(category.title) ? navSectionActiveClass : 'text-slate-400 dark:text-[#A7B8C8]/50'}
                      `}>
                        {category.icon}
                      </span>
                      <span className={`text-[10px] font-black uppercase transition-colors
                        ${expandedGroups.includes(category.title) ? navSectionActiveClass : navSectionIdleClass}
                      `}>
                        {category.title}
                      </span>
                    </div>
                    <span className={`material-symbols-outlined text-[14px] transition-transform duration-300
                      ${expandedGroups.includes(category.title) ? `rotate-180 ${navSectionActiveClass}` : 'text-slate-400 dark:text-[#A7B8C8]/50 group-hover:text-slate-500'}
                    `}>
                      expand_more
                    </span>
                  </>
                )}
              </button>

              {/* Category Items Accordion */}
              <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] flex flex-col gap-1
                ${expandedGroups.includes(category.title) || isCollapsed ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}
              `}>

                {/* Category Items */}
                {category.items.map((item) => {

                  // Group Item
                  if (item.children) {
                    const isExpanded = expandedGroups.includes(item.name);
                    const groupActive = checkIsGroupActive(item.children);

                    return (
                      <div key={item.name} className="flex flex-col relative group/menuitem">
                        <button
                          onClick={() => toggleGroup(item.name)}
                          className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all relative overflow-hidden
                          ${groupActive ? navActiveClass : navIdleClass}
                          ${isCollapsed ? 'justify-center' : 'justify-between'}
                        `}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined text-[20px] ${groupActive ? navIconActiveClass : ''}`}>{item.icon}</span>
                            {!isCollapsed && <span className={`text-sm ${groupActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>}
                          </div>
                          {!isCollapsed && (
                            <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isExpanded ? `rotate-180 ${navIconActiveClass}` : isEsteticaApp ? 'text-[#9B9368]/70' : 'text-slate-400 dark:text-[#A7B8C8]'}`}>
                              expand_more
                            </span>
                          )}
                        </button>

                        {/* Tooltip for collapsed mode */}
                        {isCollapsed && (
                          <div className={`absolute left-16 top-1/2 -translate-y-1/2 px-3 py-2 text-xs font-bold rounded-lg opacity-0 invisible group-hover/menuitem:opacity-100 group-hover/menuitem:visible transition-all whitespace-nowrap z-50 shadow-xl pointer-events-none ${tooltipClass}`}>
                            {item.name}
                            {/* Arrow */}
                            <div className={`absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 ${tooltipArrowClass}`}></div>
                          </div>
                        )}

                        {/* Submenu */}
                        <div className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${isExpanded && !isCollapsed ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                          <div className={`flex flex-col gap-0.5 relative ml-6 pl-3 border-l-2 ${isEsteticaApp ? 'border-[#DDD2B6]' : 'border-[#D9EAF5] dark:border-[#14304A]'}`}>
                            {item.children.map(child => {
                              if ('type' in child && child.type === 'subgroup') {
                                // Nested subgroup omitted for brevity, but easily added if needed back
                                return null;
                              }
                              const simpleChild = child as ChildItem;
                              const isChildActive = isActive(simpleChild.path);
                              return (
                                <Link
                                  key={`${simpleChild.name}-${simpleChild.path}`}
                                  to={simpleChild.path}
                                  onClick={onClose}
                                  className={`flex items-center w-full px-3 py-2 rounded-lg transition-all text-sm relative group/subitem
                                  ${isChildActive
                                      ? isEsteticaApp ? 'text-[#6F6845] font-bold bg-[#EFE8D8]' : 'text-[#007BFF] dark:text-[#00D2FF] font-bold bg-[#EAF7FF] dark:bg-[#0D2238]'
                                      : isEsteticaApp ? 'text-[#6F6758] hover:text-[#2E2B24] hover:bg-[#EFE8D8]/70' : 'text-slate-500 dark:text-[#A7B8C8] hover:text-[#003366] dark:hover:text-white hover:bg-[#F7FBFE] dark:hover:bg-[#102033]'}
                                  `}
                                >
                                  {isChildActive && <div className={`absolute -left-[14px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${isEsteticaApp ? 'bg-[#D8C994]' : 'bg-[#00D2FF]'}`} />}
                                  {simpleChild.name}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Single Item
                  const isSingleActive = isActive(item.path!);
                  return (
                    <div key={`${item.name}-${item.path}`} className="relative group/menuitem">
                      <Link
                        to={item.path!}
                        onClick={onClose}
                        className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all relative overflow-hidden
                          ${isSingleActive ? navActiveClass : navIdleClass}
                          ${isCollapsed ? 'justify-center' : 'justify-start'}
                          `}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined text-[20px] ${isSingleActive ? navIconActiveClass : ''} transition-colors duration-300`}>{item.icon}</span>
                          {!isCollapsed && <span className={`text-sm transition-all duration-300 ${isSingleActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>}
                        </div>
                      </Link>

                      {/* Tooltip for collapsed mode */}
                      {isCollapsed && (
                        <div className={`absolute left-16 top-1/2 -translate-y-1/2 px-3 py-2 text-xs font-bold rounded-lg opacity-0 invisible group-hover/menuitem:opacity-100 group-hover/menuitem:visible transition-all whitespace-nowrap z-50 shadow-xl pointer-events-none ${tooltipClass}`}>
                          {item.name}
                          <div className={`absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 ${tooltipArrowClass}`}></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </div>
          ))}
        </nav>

        {/* System Settings (Sticky Bottom) */}
        <div className={`mt-auto shrink-0 flex flex-col gap-1 p-3 border-t transition-all ${footerClass} ${isCollapsed ? 'items-center' : ''}`}>
          {systemItems.filter((item) => isMenuItemVisible(item) && isModuleAllowed(item.module)).map(item => {
            const isSystemActive = isActive(item.path!);
            if (item.name === 'Configurações' && isOperationalOnly) return null;

            return (
              <div key={item.path} className="relative group/menuitem w-full">
                <Link
                  to={item.path!}
                  onClick={onClose}
                  className={`flex items-center w-full px-3 py-2.5 rounded-xl transition-all relative overflow-hidden
                          ${isSystemActive ? navActiveClass : navIdleClass}
                          ${isCollapsed ? 'justify-center' : 'justify-start'}
                          `}
                >
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-[20px] transition-colors duration-300 ${isSystemActive ? navIconActiveClass : ''}`}>{item.icon}</span>
                    {!isCollapsed && <span className={`text-sm transition-all duration-300 ${isSystemActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>}
                  </div>
                </Link>

                {/* Tooltip for collapsed mode */}
                {isCollapsed && (
                  <div className={`absolute left-16 top-1/2 -translate-y-1/2 px-3 py-2 text-xs font-bold rounded-lg opacity-0 invisible group-hover/menuitem:opacity-100 group-hover/menuitem:visible transition-all whitespace-nowrap z-50 shadow-xl pointer-events-none ${tooltipClass}`}>
                    {item.name}
                    <div className={`absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 ${tooltipArrowClass}`}></div>
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className={`w-full mt-2 rounded-2xl flex items-center gap-3 transition-all border group relative text-left
                ${profileButtonClass}
            `}
          >
            <div className={`rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-105 shrink-0 bg-cover bg-center
               ${isCollapsed ? 'size-9' : 'size-11'}
               ${profileAvatarClass}
              `}
              style={{ backgroundImage: user?.user_metadata?.avatar ? `url(${user?.user_metadata?.avatar})` : 'none' }}>
              {!user?.user_metadata?.avatar && (
                <span className="material-symbols-outlined text-xl">
                  {canAccessSuperAdmin ? 'workspace_premium' : 'person'}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <>
                <div className="flex flex-col text-left truncate flex-1 leading-tight">
                  <p className={`text-sm font-bold truncate display-font ${isEsteticaApp ? 'text-[#2E2B24]' : 'text-slate-900 dark:text-[#F5F5F5]'}`}>
                    {user?.user_metadata?.first_name ? `${user?.user_metadata?.first_name} ${user?.user_metadata?.last_name || ''}` : 'Utilizador'}
                  </p>
                  <p className={`text-[11px] truncate font-medium mt-0.5 ${isEsteticaApp ? 'text-[#6F6758]' : 'text-slate-500 dark:text-[#A7AFB7]'}`}>
                    {user?.email || 'usuario@email.com'}
                  </p>
                </div>
                <span className={`material-symbols-outlined text-sm shrink-0 transition-colors ${isEsteticaApp ? 'text-[#9B9368] group-hover:text-[#6F6845]' : 'text-slate-400 dark:text-[#A7B8C8] group-hover:text-[#007BFF] dark:group-hover:text-[#00D2FF]'}`}>more_vert</span>
              </>
            )}

            {isCollapsed && (
              <div className={`absolute left-16 top-1/2 -translate-y-1/2 px-3 py-2 text-xs font-bold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl pointer-events-none ${tooltipClass}`}>
                Meu Perfil
                <div className={`absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 ${tooltipArrowClass}`}></div>
              </div>
            )}
          </button>
        </div>


        {/* Modals reused from original */}
        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="Minha Conta"
          maxWidth="sm"
        >
          <div className="space-y-3">
            <button
              onClick={() => { setIsProfileModalOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 hover:border-[#00D2FF]/35 hover:bg-[#EAF7FF] dark:hover:bg-[#0D2238] transition-all group"
            >
              <div className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-[#007BFF] dark:group-hover:text-[#00D2FF] transition-colors">
                <span className="material-symbols-outlined">person</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Meu Perfil</p>
                <p className="text-[10px] text-slate-500">Gerenciar dados e segurança</p>
              </div>
              <span className="material-symbols-outlined text-slate-400 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>

            <button
              onClick={() => setIsPlanModalOpen(true)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
            >
              <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">workspace_premium</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Mudar de Plano</p>
                <p className="text-[10px] text-slate-500">Upgrade ou gerenciar assinatura</p>
              </div>
              <span className="material-symbols-outlined text-slate-400 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-red-100 dark:border-red-900/20 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group"
            >
              <div className="size-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined">logout</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-red-600">Sair do Sistema</p>
                <p className="text-[10px] text-red-400">Encerrar sua sessão atual</p>
              </div>
            </button>
          </div>
        </Modal>

        {/* Modal de Planos */}
        <Modal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          title="Escolha seu Plano"
          maxWidth="md"
        >
          <div className="flex flex-col gap-6">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3 py-2 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 mx-auto px-4">
              <span className={`text-[10px] font-black uppercase ${billingCycle === 'monthly' ? 'text-primary' : 'text-slate-500'}`}>Mensal</span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="w-10 h-5 bg-slate-200 dark:bg-white/10 rounded-full relative p-0.5 transition-all"
              >
                <div className={`size-4 rounded-full bg-primary transition-all duration-300 ${billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase ${billingCycle === 'annual' ? 'text-primary' : 'text-slate-500'}`}>Anual</span>
                <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">-17%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Modals code kept practically identical to preserve component logic */}
              {planOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleChangePlan(`${p.id}${billingCycle === 'annual' ? '_annual' : ''}`)}
                  disabled={isUpdatingPlan || (user?.user_metadata?.plan === p.id && !billingCycle)}
                  className={`flex flex-col items-center p-6 rounded-2xl border transition-all text-center relative overflow-hidden group
                    ${user?.user_metadata?.plan?.includes(p.id)
                      ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                      : 'border-slate-100 dark:border-white/5 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-white/5'}
                  `}
                >
                  {user?.user_metadata?.plan?.includes(p.id) && (
                    <div className="absolute top-0 right-0 p-2">
                      <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                    </div>
                  )}
                  <div className={`size-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110
                    ${p.id === 'elite' ? 'bg-amber-500/10 text-amber-600' :
                      p.id === 'pro' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}
                  `}>
                    <span className="material-symbols-outlined text-3xl">{p.icon}</span>
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-white uppercase">{p.name}</h4>
                  <p className="text-lg font-bold text-primary mt-1">
                    R$ {billingCycle === 'monthly' ? p.monthlyPrice : p.annualPrice}
                    <span className="text-[10px] text-slate-500 uppercase font-black ml-1">/{billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-2 font-medium leading-tight">{p.desc}</p>

                  <div className={`w-full mt-6 py-2 rounded-lg text-[10px] font-black uppercase transition-all
                    ${user?.user_metadata?.plan?.includes(p.id)
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 group-hover:bg-primary group-hover:text-white'}
                  `}>
                    {user?.user_metadata?.plan?.includes(p.id) ? 'Plano Atual' : 'Selecionar'}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {isUpdatingPlan && (
            <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </Modal>
      </aside>
    </>
  );
};

export default Sidebar;
