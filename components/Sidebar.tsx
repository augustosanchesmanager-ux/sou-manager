import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  name: string;
  path?: string;
  icon: string;
  children?: { name: string; path: string }[];
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
        { name: 'Checkout / PDV', path: '/checkout' },
        { name: 'Comandas', path: '/comandas' },
        { name: 'Agendamentos', path: '/schedule' },
        { name: 'Clientes', path: '/clients' },
        { name: 'Serviços', path: '/services' },
        { name: 'Equipe / Profissionais', path: '/team' },
        { name: 'Produtos & Estoque', path: '/products' },
        { name: 'Operações do Dia', path: '/operations' },
        { name: 'Pedidos de Compra', path: '/orders' },
      ]
    },
    {
      name: 'Financeiro',
      icon: 'payments',
      children: [
        { name: 'Visão Geral', path: '/financial' },
        { name: 'Gestão de Saídas', path: '/expenses' },
      ]
    },
    {
      name: 'Gestão',
      icon: 'analytics',
      children: [
        { name: 'Relatórios', path: '/reports' },
        { name: 'Suporte', path: '/support' },
      ]
    },
    { name: 'Super Admin', icon: 'admin_panel_settings', path: '/admin' },
  ];

  // Auto-expand group if current path is inside it
  useEffect(() => {
    const currentPath = location.pathname;
    menuStructure.forEach(item => {
      if (item.children) {
        const hasChildActive = item.children.some(child => child.path === currentPath);
        if (hasChildActive && !expandedGroups.includes(item.name)) {
          setExpandedGroups(prev => [...prev, item.name]);
        }
      }
    });
  }, [location.pathname]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev =>
      prev.includes(name) ? prev.filter(g => g !== name) : [...prev, name]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (children: { path: string }[]) => children.some(c => c.path === location.pathname);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Filter menu items based on role
  const filteredMenu = menuStructure.filter(item => {
    if (item.name === 'Super Admin') {
      return user?.user_metadata?.role === 'Super Admin' || user?.user_metadata?.role === 'superadmin';
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
        w-64 bg-white dark:bg-background-dark border-r border-slate-200 dark:border-border-dark 
        flex flex-col h-screen shrink-0 transition-transform duration-300 shadow-2xl lg:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0
      `}>
        <div className="p-6 flex items-center justify-between lg:justify-start gap-3">
          <Logo />
          {/* Close button for mobile */}
          <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white">
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
                      ? 'text-primary bg-primary/5'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
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
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="flex flex-col gap-1 pl-4 border-l border-slate-200 dark:border-border-dark ml-5 my-1">
                      {item.children.map(child => (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={onClose}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${isActive(child.path)
                            ? 'text-primary font-bold bg-primary/10'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                          {child.name}
                        </Link>
                      ))}
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
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}

          <div className="mt-auto pt-10">
            <Link
              to="/settings"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-all group"
            >
              <span className="material-symbols-outlined">settings</span>
              <span className="text-sm font-medium">Configurações</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all group mt-2"
            >
              <span className="material-symbols-outlined">logout</span>
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-border-dark">
          <div className="bg-slate-50 dark:bg-surface-dark p-3 rounded-xl flex items-center gap-3 transition-colors">
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
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}` : 'Marcus Vinicius'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {user?.user_metadata?.role === 'Super Admin' ? 'SUPER ADMIN ELITE' : `Plano ${(user?.user_metadata?.plan || 'Premium').toUpperCase()}`}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-sm ml-auto">more_vert</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;