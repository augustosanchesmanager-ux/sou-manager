import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

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

  // Menu Definition structure
  const menuStructure: MenuItem[] = [
    { name: 'Dashboard', icon: 'dashboard', path: '/dashboard' },
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
            { name: 'Promoções', path: '/promotions' },
          ],
        },
      ]
    },
    {
      name: 'Gestão',
      icon: 'analytics',
      children: [
        { name: 'Visão de Negócio (BI)', path: '/bi' },
        { name: 'Operações do Dia', path: '/operations' },
        { name: 'Relatórios', path: '/reports' },
        {
          type: 'subgroup' as const,
          name: 'Financeiro',
          icon: 'payments',
          items: [
            { name: 'Visão Geral', path: '/financial' },
            { name: 'Gestão de Saídas', path: '/expenses' },
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

  // Filter menu items based on role
  const userRole = user?.user_metadata?.role || '';
  const isOperationalOnly = userRole === 'Barber' || userRole === 'Receptionist';

  const filteredMenu = menuStructure.filter(item => {
    if (item.name === 'Super Admin') {
      return userRole === 'Super Admin' || userRole === 'superadmin';
    }
    if (isOperationalOnly && item.name === 'Gestão') {
      return false; // Hide Gestão entirely
    }
    // Filter internal children (like Cadastros)
    if (item.children && isOperationalOnly) {
      item.children = item.children.filter(child => {
        if (child.name === 'Cadastros') return false;
        return true;
      });
    }
    return true;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={onClose}
      />

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-slate-900 border-r border-slate-800
        flex flex-col h-screen shrink-0 transition-transform duration-300 shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0
      `}>
        <div className="p-6 flex items-center justify-between lg:justify-start gap-3">
          <Logo />
          {/* Close button for mobile */}
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
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
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all group ${groupActive
                      ? 'text-white bg-white/10'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined">{item.icon}</span>
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <span className={`material-symbols-outlined text-lg transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
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
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${isActive(simpleChild.path)
                              ? 'bg-primary text-white font-medium shadow-md shadow-primary/20'
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${isActive(item.path!)
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}

          <div className="mt-auto pt-10">
            <Link
              to="/support"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${isActive('/support')
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
            >
              <span className="material-symbols-outlined">support_agent</span>
              <span className="text-sm font-medium">Suporte</span>
            </Link>
            {!isOperationalOnly && (
              <Link
                to="/settings"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${isActive('/settings')
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined">settings</span>
                <span className="text-sm font-medium">Configurações</span>
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group mt-2"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/50 p-3 rounded-xl flex items-center gap-3 transition-colors">
            <div className={`size-9 rounded-full flex items-center justify-center border ${user?.user_metadata?.role === 'Super Admin'
              ? 'bg-amber-500/20 border-amber-500/40'
              : 'bg-primary/20 border-primary/40'
              }`}>
              <span className={`material-symbols-outlined text-xl ${user?.user_metadata?.role === 'Super Admin' ? 'text-amber-500' : 'text-primary'
                }`}>
                {user?.user_metadata?.role === 'Super Admin' ? 'workspace_premium' : 'admin_panel_settings'}
              </span>
            </div>
            <div className="flex flex-col truncate">
              <p className="text-xs font-bold text-white truncate">
                {user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}` : 'Marcus Vinicius'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.user_metadata?.role === 'Super Admin' ? 'SUPER ADMIN ELITE' : `Plano ${(user?.user_metadata?.plan || 'Premium').toUpperCase()}`}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-sm ml-auto">more_vert</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;