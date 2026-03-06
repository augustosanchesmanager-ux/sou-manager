import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import Logo from './Logo';
import Modal from './ui/Modal';
import Button from './ui/Button';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChildItem {
  name: string;
  path: string;
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
  children?: ChildOrSubGroup[];
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Menu Definition structure
  const menuStructure: MenuItem[] = [
    { name: 'Painel Estratégico', icon: 'insights', path: '/strategic-dashboard' },
    { name: 'Visão Operacional', icon: 'dashboard', path: '/dashboard' },
    {
      name: 'Atalhos Rápidos',
      icon: 'bolt',
      children: [
        { name: 'Agendamentos', path: '/schedule' },
        { name: 'Clientes', path: '/clients' },
        { name: 'Comandas', path: '/comandas' },
        { name: 'Checkout / PDV', path: '/checkout' },
      ]
    },
    {
      name: 'Operacional',
      icon: 'storefront',
      children: [
        {
          type: 'subgroup' as const,
          name: 'Vendas',
          icon: 'sell',
          items: [
            { name: 'Comandas', path: '/comandas' },
            { name: 'Agendamentos', path: '/schedule' },
            { name: 'Checkout / PDV', path: '/checkout' },
          ],
        },
        {
          type: 'subgroup' as const,
          name: 'Cadastros',
          icon: 'folder_open',
          items: [
            { name: 'Clientes', path: '/clients' },
            { name: 'Equipe / Profissionais', path: '/team' },
            { name: 'Produtos & Estoque', path: '/products' },
            { name: 'Serviços', path: '/services' },
            { name: 'Pedidos de Compra', path: '/orders' },
            // Funcionalidades Adicionais
            { name: 'Promoções', path: '/promotions' },
            { name: 'Totem Atendimento', path: '/kiosk-admin' },
            { name: 'Portal do Cliente', path: '/portal-admin' },
          ],
        },
        {
          type: 'subgroup' as const,
          name: 'Clube do Chefe 👑',
          icon: 'workspace_premium',
          items: [
            { name: 'Planos', path: '/chef-club-plans' },
            { name: 'Assinaturas', path: '/chef-club-subscriptions' },
          ],
        },
      ]
    },
    {
      name: 'Gestão',
      icon: 'analytics',
      children: [
        { name: 'Visão de Negócio (BI)', path: '/bi' },
        { name: 'Motor de Retorno 🧠', path: '/smart-return' },
        { name: 'Operações do Dia', path: '/operations' },
        { name: 'Relatórios', path: '/reports' },
        {
          type: 'subgroup' as const,
          name: 'Financeiro',
          icon: 'payments',
          items: [
            { name: 'Visão Geral', path: '/financial' },
            { name: 'Folha de Pagamento', path: '/payroll' },
            { name: 'Gestão de Saídas', path: '/expenses' },
            { name: 'Gestão de Recibos', path: '/receipts' },
          ],
        },
      ]
    },
    { name: 'Super Admin', icon: 'admin_panel_settings', path: '/admin' },
  ];

  // Auto-expand group if current path is inside it
  useEffect(() => {
    const currentPath = location.pathname;
    menuStructure.forEach(item => {
      if (item.children) {
        const hasChildActive = item.children.some(child => {
          if ('type' in child && child.type === 'subgroup') {
            return child.items.some(i => i.path === currentPath);
          }
          return (child as ChildItem).path === currentPath;
        });
        if (hasChildActive && !expandedGroups.includes(item.name)) {
          setExpandedGroups(prev => [...prev, item.name]);
        }
        // Also auto-expand subgroups
        item.children.forEach(child => {
          if ('type' in child && child.type === 'subgroup') {
            const subActive = child.items.some(i => i.path === currentPath);
            if (subActive && !expandedGroups.includes(child.name)) {
              setExpandedGroups(prev => [...prev, child.name]);
            }
          }
        });
      }
    });
  }, [location.pathname]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev =>
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (children: ChildOrSubGroup[]) => children.some(child => {
    if ('type' in child && child.type === 'subgroup') {
      return child.items.some(i => i.path === location.pathname);
    }
    return (child as ChildItem).path === location.pathname;
  });

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
      // Force refresh or notification would be good here
      window.location.reload();
    } catch (err) {
      console.error('Erro ao mudar plano:', err);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // Filter menu items based on role
  const userRole = user?.user_metadata?.role || '';
  const isOperationalOnly = userRole === 'Barber' || userRole === 'Receptionist';

  const filteredMenu = menuStructure.map(item => {
    // Clone item to avoid modifying original structure
    const newItem = { ...item };

    if (newItem.name === 'Super Admin') {
      const isSuper = userRole === 'Super Admin' || userRole === 'superadmin';
      return isSuper ? newItem : null;
    }

    if (userRole === 'Barber') {
      if (newItem.name === 'Gestão') return null; // Hide Gestão entirely
      if (newItem.children) {
        newItem.children = newItem.children.map(child => {
          if ('type' in child && child.type === 'subgroup' && child.name === 'Cadastros') {
            return {
              ...child,
              items: child.items.filter(i => i.name === 'Clientes')
            };
          }
          return child;
        }).filter(child => {
          if ('type' in child && child.type === 'subgroup' && child.name === 'Cadastros') {
            return child.items.length > 0;
          }
          return true;
        });
      }
    }

    return newItem;
  }).filter(Boolean) as MenuItem[];

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white dark:bg-[#0A0A0A] border-r border-slate-200 dark:border-[#1A1A1A]
        flex flex-col h-screen shrink-0 transition-transform duration-300 shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0
      `}>
        <div className="p-6 flex items-center justify-between lg:justify-start gap-3">
          <Logo />
          {/* Close button for mobile */}
          <button onClick={onClose} className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
          {filteredMenu.map((item) => {
            // Render Item with Children (Group)
            if (item.children) {
              const isExpanded = expandedGroups.includes(item.name);
              const groupActive = isGroupActive(item.children);

              return (
                <div key={item.name} className="flex flex-col gap-1">
                  <button
                    onClick={() => toggleGroup(item.name)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all group ${groupActive
                      ? 'text-primary bg-primary/5 dark:bg-primary/10 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${groupActive ? 'text-primary' : ''}`}>{item.icon}</span>
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : ''}`}>
                      expand_more
                    </span>
                  </button>

                  {/* Submenu */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="flex flex-col gap-1 pl-4 border-l border-slate-700 ml-5 my-1">
                      {item.children.map(child => {
                        // Sub-grupo aninhado (ex: Vendas)
                        if ('type' in child && child.type === 'subgroup') {
                          const isSubExpanded = expandedGroups.includes(child.name);
                          const subActive = child.items.some(i => isActive(i.path));
                          return (
                            <div key={child.name} className="flex flex-col gap-0.5">
                              <button
                                onClick={() => toggleGroup(child.name)}
                                className={`flex items-center justify-between w-full px-3 py-2 rounded-lg transition-all text-sm ${subActive
                                  ? 'text-white bg-white/10'
                                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-base">{child.icon}</span>
                                  <span className="font-medium">{child.name}</span>
                                </div>
                                <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isSubExpanded ? 'rotate-180' : ''}`}>
                                  expand_more
                                </span>
                              </button>
                              <div className={`overflow-hidden transition-all duration-200 ${isSubExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="flex flex-col gap-0.5 pl-3 border-l border-slate-700/60 ml-4 my-0.5">
                                  {child.items.map(subItem => (
                                    <Link
                                      key={subItem.path}
                                      to={subItem.path}
                                      onClick={onClose}
                                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm ${isActive(subItem.path)
                                        ? 'bg-primary text-white font-medium shadow-md shadow-primary/20'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1A1A1A]'
                                        }`}
                                    >
                                      {subItem.name}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        // Item simples
                        const simpleChild = child as ChildItem;
                        return (
                          <Link
                            key={simpleChild.path}
                            to={simpleChild.path}
                            onClick={onClose}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm ${isActive(simpleChild.path)
                              ? 'bg-primary text-white font-medium shadow-md shadow-primary/20 scale-[0.98]'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#1A1A1A]'
                              }`}
                          >
                            {simpleChild.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            // Render Single Item
            return (
              <Link
                key={item.path}
                to={item.path!}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive(item.path!)
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[0.98]'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <span className={`material-symbols-outlined ${isActive(item.path!) ? '' : 'text-slate-400 group-hover:text-primary transition-colors'}`}>{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}

          <div className="mt-auto pt-10">
            <Link
              to="/support"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive('/support')
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <span className={`material-symbols-outlined ${isActive('/support') ? '' : 'text-slate-400 group-hover:text-primary transition-colors'}`}>support_agent</span>
              <span className="text-sm font-medium">Suporte</span>
            </Link>
            {!isOperationalOnly && (
              <Link
                to="/settings"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${isActive('/settings')
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <span className={`material-symbols-outlined ${isActive('/settings') ? '' : 'text-slate-400 group-hover:text-primary transition-colors'}`}>settings</span>
                <span className="text-sm font-medium">Configurações</span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition-all group mt-2"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-[#1A1A1A]">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full bg-slate-50 dark:bg-[#141414] p-3 rounded-2xl flex items-center gap-3 transition-all border border-slate-100 dark:border-[#262626] hover:border-primary/30 group"
          >
            <div className={`size-9 rounded-full flex items-center justify-center border transition-transform group-hover:scale-110 ${user?.user_metadata?.role === 'Super Admin'
              ? 'bg-amber-100 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30'
              : 'bg-primary/20 border-primary/40'
              }`}>
              <span className={`material-symbols-outlined text-xl ${user?.user_metadata?.role === 'Super Admin' ? 'text-amber-600 dark:text-amber-500' : 'text-primary'
                }`}>
                {user?.user_metadata?.role === 'Super Admin' ? 'workspace_premium' : 'admin_panel_settings'}
              </span>
            </div>
            <div className="flex flex-col text-left truncate">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate display-font">
                {user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}` : 'Marcus Vinicius'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-bold uppercase tracking-wider">
                {user?.user_metadata?.role === 'Super Admin' ? 'SUPER ADMIN ELITE' : `Plano ${(user?.user_metadata?.plan || 'Premium').toUpperCase()}`}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-sm ml-auto group-hover:text-primary transition-colors">more_vert</span>
          </button>
        </div>

        {/* Modal de Perfil - Os "Três Botões" solicitados */}
        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          title="Minha Conta"
          maxWidth="sm"
        >
          <div className="space-y-3">
            <button
              onClick={() => { setIsProfileModalOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all group"
            >
              <div className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
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
              <span className={`text-[10px] font-black uppercase tracking-widest ${billingCycle === 'monthly' ? 'text-primary' : 'text-slate-500'}`}>Mensal</span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="w-10 h-5 bg-slate-200 dark:bg-white/10 rounded-full relative p-0.5 transition-all"
              >
                <div className={`size-4 rounded-full bg-primary transition-all duration-300 ${billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${billingCycle === 'annual' ? 'text-primary' : 'text-slate-500'}`}>Anual</span>
                <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">-17%</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'free', name: 'Starter', monthlyPrice: '0,00', annualPrice: '0,00', desc: 'Agendamentos e Clientes', icon: 'bolt', color: 'slate' },
                { id: 'pro', name: 'Professional', monthlyPrice: '59,90', annualPrice: '599,00', desc: 'Checkout, Folha e Recibos', icon: 'auto_awesome', color: 'primary' },
                { id: 'elite', name: 'Elite', monthlyPrice: '99,90', annualPrice: '999,00', desc: 'IA, Motor de Retorno e Totem', icon: 'workspace_premium', color: 'amber' },
              ].map((p) => (
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
                  <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter">{p.name}</h4>
                  <p className="text-lg font-bold text-primary mt-1">
                    R$ {billingCycle === 'monthly' ? p.monthlyPrice : p.annualPrice}
                    <span className="text-[10px] text-slate-500 uppercase font-black ml-1">/{billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-2 font-medium leading-tight">{p.desc}</p>

                  <div className={`w-full mt-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
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