import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';
import Modal from './ui/Modal';
import SupportWidget from './SupportWidget';
import MobileBottomNav, { isMobileBottomNavRoute } from './MobileBottomNav';
import { useNotifications } from '../src/hooks/useNotifications';

const Layout: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { user, appSlug } = useAuth();
  const notificationsController = useNotifications('unread');
  const { unreadCount } = notificationsController;
  const isEsteticaApp = appSlug === 'estetica';

  const fallbackDisplayName = isEsteticaApp ? 'Minha Estética' : 'Minha Barbearia';
  const displayName = user?.user_metadata?.shop_name || user?.user_metadata?.first_name || fallbackDisplayName;
  const displayPlan = user?.user_metadata?.plan ? `Plano ${user.user_metadata.plan.charAt(0).toUpperCase() + user.user_metadata.plan.slice(1)}` : 'Plano Free';
  const showMobileBottomNav = isMobileBottomNavRoute(location.pathname, appSlug);

  return (
    <div
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${
        isEsteticaApp
          ? 'theme-estetica bg-[#F8F5ED] text-[#2E2B24]'
          : 'bg-[#F4F8FB] dark:bg-[#06111F] text-slate-900 dark:text-white'
      }`}
      data-app-theme={isEsteticaApp ? 'estetica' : undefined}
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className={`h-16 border-b px-4 sm:px-8 flex items-center justify-between shrink-0 backdrop-blur-md sticky top-0 z-20 transition-colors duration-300 ${
          isEsteticaApp
            ? 'border-[#DDD2B6] bg-[#F8F5ED]/92'
            : 'border-[#D9EAF5] dark:border-[#14304A] bg-[#F4F8FB]/90 dark:bg-[#071426]/90'
        }`}>
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`lg:hidden p-2 -ml-2 rounded-lg transition-colors ${
                isEsteticaApp
                  ? 'text-[#6F6758] hover:text-[#6F6845] hover:bg-[#EFE8D8]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-[#007BFF] dark:hover:text-[#00D2FF] hover:bg-white dark:hover:bg-[#102033]'
              }`}
              aria-label="Abrir menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            {/* Desktop Collapse Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`hidden lg:flex p-2 -ml-2 rounded-lg transition-colors ${
                isEsteticaApp
                  ? 'text-[#6F6758] hover:text-[#6F6845] hover:bg-[#EFE8D8]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-[#007BFF] dark:hover:text-[#00D2FF] hover:bg-white dark:hover:bg-[#102033]'
              }`}
              title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              aria-label={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            >
              <span className="material-symbols-outlined">
                {isSidebarCollapsed ? 'menu_open' : 'menu'}
              </span>
            </button>

            <div className="relative w-full hidden md:block">
              <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl ${isEsteticaApp ? 'text-[#9B9368]' : 'text-slate-400 dark:text-slate-500'}`}>search</span>
              <input
                className={`w-full border rounded-lg py-2 pl-10 pr-4 text-sm outline-none transition-colors ${
                  isEsteticaApp
                    ? 'bg-white/90 border-[#DDD2B6] text-[#2E2B24] placeholder:text-[#6F6758]/70 focus:ring-2 focus:ring-[#D8C994]/35 focus:border-[#9B9368]'
                    : 'bg-white/85 dark:bg-[#0B1828] border-[#D9EAF5] dark:border-[#14304A] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-[#00D2FF]/25 focus:border-[#00D2FF]/50'
                }`}
                placeholder="Pesquisar..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className={`relative p-2 transition-colors rounded-lg ${
                isEsteticaApp
                  ? 'text-[#6F6758] hover:text-[#6F6845] hover:bg-[#EFE8D8]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-[#007BFF] dark:hover:text-[#00D2FF] hover:bg-white dark:hover:bg-[#102033]'
              }`}
              aria-label="Abrir central de avisos"
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className={`absolute top-1.5 right-1.5 size-4 text-[10px] font-bold rounded-full border-2 flex items-center justify-center ${
                  isEsteticaApp
                    ? 'bg-[#D8C994] text-[#2E2B24] border-[#F8F5ED]'
                    : 'bg-[#00D2FF] text-[#003366] border-white dark:border-[#06111F]'
                }`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className={`h-6 w-px mx-1 ${isEsteticaApp ? 'bg-[#DDD2B6]' : 'bg-[#D9EAF5] dark:bg-[#14304A]'}`}></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className={`text-sm font-bold display-font ${isEsteticaApp ? 'text-[#2E2B24]' : 'text-slate-900 dark:text-white'}`}>{displayName}</p>
                <p className={`text-[10px] uppercase font-bold ${isEsteticaApp ? 'text-[#6F6845]' : 'text-[#007BFF] dark:text-[#00D2FF]'}`}>{displayPlan}</p>
              </div>
              <div
                className={`size-8 sm:size-10 rounded-lg flex items-center justify-center border ${
                  isEsteticaApp
                    ? 'bg-white border-[#D8C994] shadow-[0_10px_22px_rgba(111,104,69,0.12)]'
                    : 'bg-[#EAF7FF] dark:bg-[#0D2238] border-[#00D2FF]/35 shadow-[0_0_18px_rgba(0,210,255,0.14)]'
                }`}
              >
                <span className={`material-symbols-outlined text-xl ${isEsteticaApp ? 'text-[#6F6845]' : 'text-[#007BFF] dark:text-[#00D2FF]'}`}>person</span>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 main-content ${showMobileBottomNav ? 'pb-24 md:pb-24 lg:pb-8' : ''}`}>
          <Outlet />
        </div>

        <MobileBottomNav />

        {/* Notificações Modal */}
        <Modal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          title="Central de Avisos"
          maxWidth="md"
        >
          <NotificationCenter
            controller={notificationsController}
            onClose={() => setIsNotificationsOpen(false)}
          />
        </Modal>

        {/* Widget de Suporte Flutuante */}
        <SupportWidget avoidBottomNav={showMobileBottomNav} />
      </main>
    </div>
  );
};

export default Layout;
