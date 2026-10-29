import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
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
import { supabase } from '../services/supabaseClient';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [releaseNotesUnseen, setReleaseNotesUnseen] = useState(() => hasUnseenChangelog());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { user, appSlug, signOut } = useAuth();
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

  // Close user dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  const userDisplayName = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim()
    : user?.user_metadata?.shop_name || (isEsteticaApp ? 'Minha Estética' : 'Minha Barbearia');
  const userEmail = user?.email || '';
  const userInitials = userDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || 'SM';
  const displayPlan = user?.user_metadata?.plan
    ? `Plano ${user.user_metadata.plan.charAt(0).toUpperCase() + user.user_metadata.plan.slice(1)}`
    : 'Plano Free';
  const showMobileBottomNav = isMobileBottomNavRoute(location.pathname, appSlug);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleChangePlan = async (newPlan: string) => {
    setIsUpdatingPlan(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { plan: newPlan },
      });
      if (error) throw error;
      setIsPlanModalOpen(false);
      setIsUserMenuOpen(false);
      window.location.reload();
    } catch (err) {
      console.error('Erro ao mudar plano:', err);
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const planOptions = isEsteticaApp
    ? [
        { id: 'free', name: 'Starter', monthlyPrice: '0,00', annualPrice: '0,00', desc: 'Agenda e Clientes', icon: 'bolt' },
        { id: 'pro', name: 'Professional', monthlyPrice: '59,90', annualPrice: '599,00', desc: 'Procedimentos, equipe e finalização', icon: 'auto_awesome' },
        { id: 'premium', name: 'Premium', monthlyPrice: '99,90', annualPrice: '999,00', desc: 'IA, retornos e gestão avançada', icon: 'workspace_premium' },
      ]
    : [
        { id: 'free', name: 'Starter', monthlyPrice: '0,00', annualPrice: '0,00', desc: 'Agendamentos e Clientes', icon: 'bolt' },
        { id: 'pro', name: 'Professional', monthlyPrice: '59,90', annualPrice: '599,00', desc: 'Checkout, Folha e Recibos', icon: 'auto_awesome' },
        { id: 'premium', name: 'Premium', monthlyPrice: '99,90', annualPrice: '999,00', desc: 'IA, Motor de Retorno e Totem', icon: 'workspace_premium' },
      ];

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
            <div className={`h-6 w-px mx-1 ${isEsteticaApp ? 'bg-[#DDD2B6]' : 'bg-line dark:bg-border-dark'}`} />

            {/* User Profile Menu (Top Right) */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex items-center gap-2.5 sm:gap-3 p-1 sm:px-2.5 sm:py-1.5 rounded-xl transition-all cursor-pointer text-left border ${
                  isUserMenuOpen
                    ? isEsteticaApp
                      ? 'border-[#9B9368] bg-[#EFE8D8]'
                      : 'border-primary/40 bg-gold-pale dark:bg-card-dark shadow-xs'
                    : isEsteticaApp
                      ? 'border-transparent hover:border-[#DDD2B6] hover:bg-[#EFE8D8]'
                      : 'border-transparent hover:border-line dark:hover:border-border-dark hover:bg-gold-pale/60 dark:hover:bg-card-dark'
                }`}
                aria-label="Minha Conta"
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
              >
                <div className="text-right hidden sm:block leading-tight">
                  <p className={`text-xs sm:text-sm font-medium tracking-tight truncate max-w-[140px] md:max-w-[170px] ${
                    isEsteticaApp ? 'text-[#2E2B24]' : 'text-ink dark:text-white'
                  }`}>
                    {userDisplayName}
                  </p>
                  <p className={`text-[10px] sm:text-[11px] font-normal truncate max-w-[140px] md:max-w-[170px] ${
                    isEsteticaApp ? 'text-[#6F6845]' : 'text-ink-soft'
                  }`}>
                    {userEmail || displayPlan}
                  </p>
                </div>

                <div
                  className={`size-8 sm:size-9 rounded-full flex items-center justify-center font-medium text-xs shrink-0 border bg-cover bg-center ${
                    isEsteticaApp
                      ? 'bg-white border-[#D8C994] text-[#6F6845]'
                      : 'bg-gold-pale dark:bg-card-dark border-primary/30 text-primary-dark dark:text-primary shadow-xs'
                  }`}
                  style={{
                    backgroundImage: user?.user_metadata?.avatar ? `url(${user.user_metadata.avatar})` : 'none',
                  }}
                >
                  {!user?.user_metadata?.avatar && userInitials}
                </div>

                <span
                  className={`material-symbols-outlined text-base hidden sm:block text-ink-soft transition-transform duration-200 ${
                    isUserMenuOpen ? 'rotate-180 text-primary' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div
                  role="menu"
                  className={`absolute right-0 mt-2 w-64 rounded-2xl border p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 ${
                    isEsteticaApp
                      ? 'bg-white border-[#DDD2B6] text-[#2E2B24]'
                      : 'bg-card dark:bg-card-dark border-line dark:border-border-dark text-ink dark:text-white'
                  }`}
                >
                  {/* User info card inside dropdown */}
                  <div className={`p-3 rounded-xl mb-1 ${
                    isEsteticaApp ? 'bg-[#F8F5ED]' : 'bg-gold-pale/50 dark:bg-night-soft/60'
                  }`}>
                    <p className="text-sm font-medium truncate">{userDisplayName}</p>
                    <p className="text-xs text-ink-soft truncate">{userEmail || '—'}</p>
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gold-pale dark:bg-primary/10 text-primary-dark dark:text-primary border border-primary/20">
                      {displayPlan}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-gold-pale dark:hover:bg-night-soft transition-colors cursor-pointer text-left"
                    >
                      <span className="material-symbols-outlined text-lg text-ink-soft">person</span>
                      <span>Meu Perfil</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsPlanModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-gold-pale dark:hover:bg-night-soft transition-colors cursor-pointer text-left"
                    >
                      <span className="material-symbols-outlined text-lg text-ink-soft">workspace_premium</span>
                      <span>Mudar de Plano</span>
                    </button>

                    {!isEsteticaApp && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/support');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-gold-pale dark:hover:bg-night-soft transition-colors cursor-pointer text-left"
                      >
                        <span className="material-symbols-outlined text-lg text-ink-soft">help</span>
                        <span>Precisa de Ajuda?</span>
                      </button>
                    )}

                    <div className={`my-1 border-t ${isEsteticaApp ? 'border-[#DDD2B6]' : 'border-line dark:border-border-dark'}`} />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-danger hover:bg-danger/10 transition-colors cursor-pointer text-left"
                    >
                      <span className="material-symbols-outlined text-lg text-danger">logout</span>
                      <span>Sair do Sistema</span>
                    </button>
                  </div>
                </div>
              )}
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

        {/* Modal de Planos */}
        <Modal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
          title="Escolha seu Plano"
          maxWidth="md"
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-center gap-3 py-2 bg-gold-pale rounded-2xl border border-line mx-auto px-4">
              <span
                className={`text-[10px] font-bold uppercase ${
                  billingCycle === 'monthly' ? 'text-primary-dark' : 'text-ink-soft'
                }`}
              >
                Mensal
              </span>
              <button
                type="button"
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="w-12 h-6 bg-night-soft rounded-full p-1 transition-colors relative cursor-pointer"
              >
                <div
                  className={`size-4 bg-primary rounded-full transition-transform ${
                    billingCycle === 'annual' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
                  billingCycle === 'annual' ? 'text-primary-dark' : 'text-ink-soft'
                }`}
              >
                Anual <span className="text-[8px] bg-primary/20 text-primary-dark px-1.5 py-0.5 rounded-full font-bold">-20%</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {planOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleChangePlan(`${p.id}${billingCycle === 'annual' ? '_annual' : ''}`)}
                  disabled={isUpdatingPlan || (user?.user_metadata?.plan === p.id && !billingCycle)}
                  className={`flex flex-col items-center p-6 rounded-2xl border transition-all text-center relative overflow-hidden group cursor-pointer ${
                    user?.user_metadata?.plan?.includes(p.id)
                      ? 'border-success bg-success/5 ring-1 ring-success/20'
                      : 'border-line dark:border-border-dark hover:border-primary hover:bg-gold-pale dark:hover:bg-card-dark'
                  }`}
                >
                  {user?.user_metadata?.plan?.includes(p.id) && (
                    <div className="absolute top-0 right-0 p-2">
                      <span className="material-symbols-outlined text-success text-sm">check_circle</span>
                    </div>
                  )}
                  <div className="size-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 bg-gold-pale text-primary-dark">
                    <span className="material-symbols-outlined text-xl">{p.icon}</span>
                  </div>
                  <h4 className="font-bold text-ink dark:text-white uppercase text-sm">{p.name}</h4>
                  <p className="text-base font-bold text-primary-dark dark:text-primary mt-1">
                    R$ {billingCycle === 'monthly' ? p.monthlyPrice : p.annualPrice}
                    <span className="text-[10px] text-ink-soft uppercase font-bold ml-1">
                      /{billingCycle === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </p>
                  <p className="text-[10px] text-ink-soft mt-2 font-normal leading-tight">{p.desc}</p>

                  <div
                    className={`w-full mt-6 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                      user?.user_metadata?.plan?.includes(p.id)
                        ? 'bg-success text-white'
                        : 'bg-line dark:bg-neutral-800 text-ink-soft group-hover:bg-primary group-hover:text-night'
                    }`}
                  >
                    {user?.user_metadata?.plan?.includes(p.id) ? 'Plano Atual' : 'Selecionar'}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {isUpdatingPlan && (
            <div className="absolute inset-0 bg-card/60 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
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
