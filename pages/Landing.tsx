import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const Landing: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-x-hidden transition-colors duration-300 flex flex-col">
      {/* Navbar */}
      <nav className="fixed w-full z-50 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-border-dark transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Logo size="lg" />
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/login" className="hidden sm:block text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary transition-colors">
              Acessar Conta
            </Link>
            <Link to="/onboarding/role" className="px-5 py-2.5 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5">
              Começar Grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6 flex-1 flex flex-col justify-center overflow-hidden">
        {/* Background Image with Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1503951914875-452162b7f30a?q=80&w=2070&auto=format&fit=crop"
            alt="Barber Shop Background"
            className="w-full h-full object-cover opacity-10 dark:opacity-20 grayscale"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background-light/80 via-background-light/50 to-background-light dark:from-background-dark/80 dark:via-background-dark/50 dark:to-background-dark"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-background-light via-transparent to-background-light dark:from-background-dark dark:via-transparent dark:to-background-dark"></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-200/50 dark:bg-white/10 border border-slate-300 dark:border-white/10 mb-8 backdrop-blur-sm animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">O Sistema #1 para Barbearias de Elite</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 via-slate-800 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-600 leading-[1.1]">
            Gestão Profissional <br className="hidden md:block" /> para o seu Negócio.
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Domine sua agenda, controle o financeiro e fidelize clientes com a plataforma mais completa do mercado. Tecnologia de ponta desenhada para o barbeiro moderno.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/onboarding/role" className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-blue-600 text-white text-base font-bold rounded-xl transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-3 hover:scale-105">
              <span className="material-symbols-outlined">rocket_launch</span>
              Teste Grátis por 7 Dias
            </Link>
            <Link to="/login" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white text-base font-bold rounded-xl transition-all flex items-center justify-center gap-3 hover:bg-slate-50 dark:hover:bg-white/5">
              <span className="material-symbols-outlined">play_circle</span>
              Ver Demonstração
            </Link>
          </div>

          {/* Social Proof */}
          <div className="mt-16 pt-8 border-t border-slate-200 dark:border-border-dark/50 max-w-3xl mx-auto">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Utilizado pelas melhores barbearias</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-12 opacity-50 grayscale">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl">content_cut</span>
                <span className="font-black text-xl">Viking's</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl">face</span>
                <span className="font-black text-xl">Gentleman</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl">spa</span>
                <span className="font-black text-xl">Elite Cuts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl">diamond</span>
                <span className="font-black text-xl">Royal</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-white dark:bg-card-dark border-t border-slate-200 dark:border-border-dark relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-4">Tudo o que você precisa em um só lugar</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Substitua planilhas e cadernos por uma inteligência artificial que trabalha pelo seu crescimento.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-50 dark:bg-background-dark p-8 rounded-3xl border border-slate-200 dark:border-border-dark hover:border-primary/50 transition-all group hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5">
              <div className="size-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-3xl">calendar_month</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Agenda Inteligente</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Organize horários, evite conflitos e envie lembretes automáticos via WhatsApp para reduzir faltas.</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-50 dark:bg-background-dark p-8 rounded-3xl border border-slate-200 dark:border-border-dark hover:border-primary/50 transition-all group hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5">
              <div className="size-14 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-3xl">monitoring</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Gestão Financeira</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Acompanhe faturamento, ticket médio, despesas e comissões automáticas em tempo real.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-50 dark:bg-background-dark p-8 rounded-3xl border border-slate-200 dark:border-border-dark hover:border-primary/50 transition-all group hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5">
              <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-3xl">group</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">Fidelização VIP</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Histórico completo de cortes, preferências do cliente e ferramentas de marketing para retorno.</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-background-dark py-12 text-center">
        <div className="flex items-center justify-center mb-4">
          <Logo iconOnly size="sm" className="opacity-50 grayscale hover:grayscale-0 transition-opacity" />
        </div>
        <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Elite Tech Solutions. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Landing;