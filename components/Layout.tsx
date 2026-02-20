import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import NotificationCenter from './NotificationCenter';
import Modal from './ui/Modal';
import { supabase } from '../services/supabaseClient';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const fetchUnreadCount = async () => {
    if (!user) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false);

    if (!error) setUnreadCount(count || 0);
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, [user]);

  const displayName = user?.user_metadata?.shop_name || user?.user_metadata?.first_name || 'Minha Barbearia';
  const displayPlan = user?.user_metadata?.plan ? `Plano ${user.user_metadata.plan.charAt(0).toUpperCase() + user.user_metadata.plan.slice(1)}` : 'Plano Free';

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display transition-colors duration-300">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 dark:border-border-dark px-4 sm:px-8 flex items-center justify-between shrink-0 bg-white/80 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-20 transition-colors duration-300">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>

            <div className="relative w-full hidden md:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xl">search</span>
              <input
                className="w-full bg-slate-100 dark:bg-surface-dark border-none rounded-lg py-2 pl-10 pr-4 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-primary outline-none transition-colors"
                placeholder="Pesquisar... (Cmd+K)"
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 size-4 bg-primary text-[10px] text-white font-bold rounded-full border-2 border-white dark:border-background-dark flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-border-dark mx-1"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{displayName}</p>
                <p className="text-[10px] text-primary">{displayPlan}</p>
              </div>
              <div
                className="size-8 sm:size-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/40"
              >
                <span className="material-symbols-outlined text-primary text-xl">person</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
          <Outlet />
        </div>

        {/* Notificações Modal */}
        <Modal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          title="Central de Avisos"
          maxWidth="md"
        >
          <NotificationCenter onClose={() => setIsNotificationsOpen(false)} />
        </Modal>
      </main>
    </div>
  );
};

export default Layout;