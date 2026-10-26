import React, { useState, useEffect } from 'react';
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
import OfflineStatusBanner from '../src/components/offline/OfflineStatusBanner';
import StatusBanner from './billing/StatusBanner';
import ReleaseNotesModal from './ReleaseNotesModal';
import { hasUnseenChangelog } from '../src/lib/changelog';
import { CommandPalette } from './CommandPalette';

const Layout: React.FC = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [releaseNotesUnseen, setReleaseNotesUnseen] = useState(() => hasUnseenChangelog());
  const { user, appSlug } = useAuth();
  const notificationsController = useNotifications('unread');
  const { unreadCount } = notificationsController;
  const isEsteticaApp = appSlug === 'estetica';

  useEffect(() => {
    if (hasUnseenChangelog()) {
      setIsReleaseNotesOpen(true);
    }
  }, []);

  // Global Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fallbackDisplayName = isEsteticaApp ? 'Minha Estética' : 'Minha Barbearia';
  const displayName = user?.user_metadata?.shop_name || user?.user_metadata?.first_name || fallbackDisplayName;
  const displayPlan = user?.user_metadata?.plan ? `Plano ${user.user_metadata.plan.charAt(0).toUpperCase() + user.user_metadata.plan.slice(1)}` : 'Plano Free';
  const showMobileBottomNav = isMobileBottomNavRoute(location.pathname, appSlug);

  return (
    <div
      className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${
        isEsteticaApp
          ? 'theme-estetica bg-[#F8F5ED] text-[#2E2B24]'
          : 'bg-background-light dark:bg-background-dark text-ink dark:text-white'
      }`}
      data-app-theme={isEsteticaApp ? 'estetica' : undefined}
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenReleaseNotes={() => setIsReleaseNotesOpen(true)}
        releaseNotesUnseen={releaseNotesUnseen}
        unreadNotificationsCount={unreadCount}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className={`h-16 border-b px-4 sm:px-8 flex items-center justify-between shrink-0 backdrop-blur-md sticky top-0 z-20 transition-colors duration-300 ${
          isEsteticaApp
            ? 'border-[#DDD2B6] bg-[#F8F5ED]/92'
            : 'border-line dark:border-border-dark bg-background-light/90 dark:bg-surface-dark/90'
        }`}>
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`lg:hidden p-2 -ml-2 rounded-lg transition-colors ${
                isEsteticaApp
                  ? 'text-[#6F6758] hover:text-[#6F6845] hover:bg-[#EFE8D8]'
                  : 'text-ink-soft hover:text-primary hover:bg-gold-pale dark:hover:bg-card-dark'
              }`}
              aria-label="Abrir menu"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            {/* Desktop & Tablet Search Trigger */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className={`relative w-full hidden md:flex items-center justify-between border rounded-xl py-2 pl-10 pr-3 text-sm transition-all cursor-pointer text-left ${
                isEsteticaApp
                  ? 'bg-white/90 border-[#DDD2B6] text-[#6F6758]/80 hover:border-[#9B9368]'
                  : 'bg-card dark:bg-card-dark border-line dark:border-border-dark text-ink-soft hover:border-primary/50'
              }`}
            >
              <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg ${isEsteticaApp ? 'text-[#9B9368]' : 'text-ink-soft'}`}>search</span>
              <span className="truncate">Buscar telas, comandos ou ações...</span>
              <kbd className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-ink-soft bg-gold-pale dark:bg-neutral-800 border border-line dark:border-neutral-700 rounded-md">
                Ctrl K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className={`md:hidden p-2 rounded-lg transition-colors cursor-pointer ${
                isEsteticaApp
                  ? 'text-[#6F6758] hover:text-[#6F6845] hover:bg-[#EFE8D8]'
                  : 'text-ink-soft hover:text-primary hover:bg-gold-pale dark:hover:bg-card-dark'
              }`}
              aria-label="Abrir busca rápida"
            >
              <span className="material-symbols-outlined">search</span>
            </button>
            <ThemeToggle />
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className={`relative p-2 transition-colors rounded-lg ${
                isEsteticaApp
                  ? 'text-[#6F6758] hover:text-[#6F6845] hover:bg-[#EFE8D8]'
                  : 'text-ink-soft hover:text-primary hover:bg-gold-pale dark:hover:bg-card-dark'
              }`}
              aria-label="Abrir central de avisos"
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className={`absolute top-1.5 right-1.5 size-4 text-[10px] font-bold rounded-full border-2 flex items-center justify-center ${
                  isEsteticaApp
                    ? 'bg-[#D8C994] text-[#2E2B24] border-[#F8F5ED]'
                    : 'bg-primary text-night border-white dark:border-surface-dark'
                }`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className={`h-6 w-px mx-1 ${isEsteticaApp ? 'bg-[#DDD2B6]' : 'bg-line dark:bg-border-dark'}`}></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className={`text-sm font-bold display-font ${isEsteticaApp ? 'text-[#2E2B24]' : 'text-ink dark:text-white'}`}>{displayName}</p>
                <p className={`text-[10px] uppercase font-bold ${isEsteticaApp ? 'text-[#6F6845]' : 'text-primary'}`}>{displayPlan}</p>
              </div>
              <div
                className={`size-8 sm:size-10 rounded-lg flex items-center justify-center border ${
                  isEsteticaApp
                    ? 'bg-white border-[#D8C994] shadow-[0_10px_22px_rgba(111,104,69,0.12)]'
                    : 'bg-gold-pale dark:bg-card-dark border-line dark:border-border-dark shadow-sm'
                }`}
              >
                <span className={`material-symbols-outlined text-lg ${isEsteticaApp ? 'text-[#6F6845]' : 'text-primary'}`}>person</span>
              </div>
            </div>
          </div>
        </header>

        <OfflineStatusBanner />
        <StatusBanner />

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

        <ReleaseNotesModal
          isOpen={isReleaseNotesOpen}
          onClose={() => {
            setIsReleaseNotesOpen(false);
            setReleaseNotesUnseen(hasUnseenChangelog());
          }}
        />

        {/* Widget de Suporte Flutuante */}
        <SupportWidget avoidBottomNav={showMobileBottomNav} />

        {/* Global Command Palette (Ctrl + K) */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      </main>
    </div>
  );
};

export default Layout;
