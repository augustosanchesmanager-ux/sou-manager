import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import LandingSupportWidget from '../components/LandingSupportWidget';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Preços', href: '#precos' },
  { label: 'Contato', href: '#contato' },
];

const FEATURES = [
  {
    icon: 'group',
    title: 'Gestão de Clientes',
    desc: 'Organize sua agenda e fidelize seu público com dados reais sobre comportamento e frequência.',
  },
  {
    icon: 'point_of_sale',
    title: 'Vendas e PDV',
    desc: 'Transforme cada atendimento em uma venda estratégica e lucrativa com interface rápida.',
  },
  {
    icon: 'inventory_2',
    title: 'Controle de Estoque',
    desc: 'Tenha visão total dos seus produtos e evite desperdícios com alertas de reposição inteligentes.',
  },
  {
    icon: 'calendar_month',
    title: 'Agenda Inteligente',
    desc: 'Organize horários, evite conflitos e envie lembretes automáticos para reduzir faltas.',
  },
  {
    icon: 'monitoring',
    title: 'Gestão Financeira',
    desc: 'Acompanhe faturamento, ticket médio, despesas e comissões automáticas em tempo real.',
  },
  {
    icon: 'analytics',
    title: 'Relatórios e Insights',
    desc: 'Decisões mais rápidas com dashboards visuais e exportação de relatórios detalhados.',
  },
];

const PRICING_PLANS = [
  {
    name: 'Gratuito',
    price: '0,00',
    desc: 'Para quem está começando e quer organizar o básico.',
    features: ['Até 50 agendamentos/mês', 'Cadastro de Clientes', 'Agenda Básica', 'Suporte via E-mail'],
    cta: 'Começar Agora',
    highlight: false,
  },
  {
    name: 'Profissional',
    price: '59,90',
    desc: 'O essencial para uma gestão completa e eficiente.',
    features: ['Agendamentos Ilimitados', 'Controle Financeiro Completo', 'Gestão de Equipe e Comissões', 'Relatórios de Vendas', 'Suporte via WhatsApp'],
    cta: 'Escolher Profissional',
    highlight: true,
  },
  {
    name: 'Elite',
    price: '99,90',
    desc: 'Alta performance com inteligência de dados e automação.',
    features: ['Tudo do Profissional', 'BI Dashboard Avançado', 'Automação de Estoque', 'Gestão Multiloja (Breve)', 'Suporte Prioritário'],
    cta: 'Seja Elite Tech',
    highlight: false,
  },
];

const Landing: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);

      // Simple spy for active nav
      const sections = NAV_LINKS.map(link => ({
        id: link.href.substring(1),
        label: link.label
      }));

      // Use a copy to avoid mutating the original array
      const sectionsToSpy = [...sections].reverse();

      for (const section of sectionsToSpy) {
        const el = document.getElementById(section.id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveNav(section.label);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, label: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      setActiveNav(label);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-white font-display selection:bg-primary/30">

      {/* ═══ NAVBAR ═══ */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#0E0C0A]/90 backdrop-blur-xl border-b border-[#2E2720] py-3 shadow-2xl' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Logo size="lg" />

          {/* Links centrais */}
          <div className="hidden lg:flex items-center gap-10">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href, link.label)}
                className={`text-sm font-bold transition-all relative group py-2 tracking-wide ${activeNav === link.label ? 'text-primary' : 'text-slate-300 hover:text-white'
                  }`}
              >
                {link.label}
                {activeNav === link.label && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full h-1 bg-primary rounded-full shadow-[0_2px_8px_rgba(190,129,75,0.4)]" />
                )}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="/login"
              className="hidden sm:block text-sm font-bold text-white/80 hover:text-white transition-colors"
            >
              Acessar Conta
            </Link>
            <Link
              to="/onboarding/role"
              className="px-6 py-2.5 bg-primary hover:bg-primary-light text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-primary/30 hover:-translate-y-0.5"
            >
              Começar Agora
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO SECTION ═══ */}
      <section id="home" className="min-h-screen flex relative">
        <div className="flex-1 flex flex-col justify-center px-6 xl:pl-[calc((100vw-80rem)/2+1.5rem)] pt-24 pb-16 lg:max-w-[55%] z-20">
          <div className="inline-flex items-center self-start gap-2 px-4 py-2 rounded-full border border-primary/40 bg-primary/10 mb-8 animate-fade-in">
            <span className="size-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Nossa Essência</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-8 animate-fade-in" style={{ animationDelay: '100ms' }}>
            A Evolução da<br />
            sua <span className="text-primary italic">Barbearia</span>
          </h1>

          <p className="text-slate-300 text-lg lg:text-xl mb-10 max-w-[540px] leading-relaxed animate-fade-in" style={{ animationDelay: '200ms' }}>
            O <span className="font-bold text-white">SOU MANA.GER</span> é a inteligência que sua barbearia precisa para crescer de forma organizada, estratégica e lucrativa.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-20 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <Link
              to="/onboarding/role"
              className="flex items-center justify-center gap-3 px-8 py-4 bg-primary hover:bg-primary-light text-white font-black rounded-2xl transition-all shadow-2xl shadow-primary/40 hover:-translate-y-1"
            >
              Agende uma Demo
              <span className="material-symbols-outlined">trending_up</span>
            </Link>
            <a
              href="#funcionalidades"
              onClick={(e) => handleNavClick(e, '#funcionalidades', 'Funcionalidades')}
              className="flex items-center justify-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl transition-all hover:-translate-y-1 backdrop-blur-md"
            >
              Ver Recursos
              <span className="material-symbols-outlined text-lg">expand_more</span>
            </a>
          </div>

          <div className="flex items-center gap-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="size-10 rounded-full border-2 border-[#0E0C0A] bg-slate-800 flex items-center justify-center overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-bold text-white">+200 Barbearias</p>
              <p className="text-xs text-slate-400">Gerindo com inteligência</p>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-32 z-10 bg-gradient-to-r from-[#0E0C0A] to-transparent" />
          <img
            src="/hero-owner.jpg"
            alt="Dono da barbearia"
            className="w-full h-full object-cover object-top opacity-60 transition-transform duration-10000 hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1503951914875-452162b7f30a?q=80&w=1200&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#0E0C0A] via-[#0E0C0A]/40 to-transparent z-10" />
        </div>
      </section>

      {/* ═══ SOBRE SECTION ═══ */}
      <section id="sobre" className="py-32 px-6 relative">
        {/* Imagem de fundo com overlay - wrapper isolado com overflow-hidden */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img src="/bg-sobre.jpg" alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#0E0C0A]/85" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0E0C0A] via-transparent to-[#0E0C0A]" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <span className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            Quem somos
          </span>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-8">
            Feito por quem entende<br /> o mercado de barbearia
          </h2>
          <p className="text-slate-300 text-lg lg:text-xl max-w-3xl mx-auto leading-relaxed">
            Nascemos da necessidade real. Cada funcionalidade foi desenhada junto com quem vive o dia a dia da cadeira, focando em simplicidade e resultados reais.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-20">
            {[
              { value: '200+', label: 'Barbearias' },
              { value: '98%', label: 'Satisfação' },
              { value: '3x', label: 'Mais Lucro' },
            ].map(stat => (
              <div key={stat.value} className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative bg-[#1C1814]/80 backdrop-blur-md border border-[#2E2720] rounded-3xl p-10 transition-all duration-300">
                  <p className="text-5xl font-black text-white mb-2">{stat.value}</p>
                  <p className="text-primary font-bold text-xs uppercase tracking-widest">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FUNCIONALIDADES ═══ */}
      <section id="funcionalidades" className="py-32 px-6 relative">
        {/* Imagem de fundo com overlay - wrapper isolado */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img src="/bg-precos.jpg" alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#0A0907]/88" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0E0C0A] via-transparent to-[#0E0C0A]" />
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div className="max-w-xl">
              <span className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                Funcionalidades
              </span>
              <h2 className="text-4xl lg:text-5xl font-black tracking-tight">
                Tudo o que sua barbearia<br /> precisa para <span className="text-primary italic">evoluir</span>
              </h2>
            </div>
            <p className="text-slate-300 max-w-[340px] text-sm leading-relaxed">
              Substitua a confusão de papéis e planilhas por um ecossistema digital completo e intuitivo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group bg-[#1C1814]/70 backdrop-blur-md border border-[#2E2720] rounded-3xl p-8 hover:border-primary/50 transition-all duration-500"
              >
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-8 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-xl shadow-primary/5">
                  <span className="material-symbols-outlined text-3xl">{f.icon}</span>
                </div>
                <h3 className="font-black text-white text-xl mb-3 tracking-tight">{f.title}</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PREÇOS SECTION ═══ */}
      <section id="precos" className="py-32 px-6 relative">
        {/* Imagem de fundo com overlay - wrapper isolado */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img src="/bg-funcionalidades.jpg" alt="" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#0E0C0A]/87" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0E0C0A] via-transparent to-[#0E0C0A]" />
        </div>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <span className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-6">
              Planos e Preços
            </span>
            <h2 className="text-4xl lg:text-6xl font-black tracking-tight mb-8">O investimento que se paga</h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-lg">
              Escolha o plano ideal para o tamanho do seu negócio. Comece grátis e mude quando precisar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-6">
            {PRICING_PLANS.map(plan => (
              <div
                key={plan.name}
                className={`flex flex-col backdrop-blur-md border-2 rounded-[2.5rem] p-10 transition-all duration-300 ${plan.highlight ? 'bg-[#1C1814]/90 border-primary shadow-2xl shadow-primary/20 -translate-y-4' : 'bg-[#1C1814]/70 border-[#2E2720] hover:border-[#42382D]'}`}
              >
                {plan.highlight && (
                  <span className="self-start px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-6">Mais Popular</span>
                )}
                <h3 className="text-2xl font-black text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-sm font-bold text-slate-400 italic">R$</span>
                  <span className="text-5xl font-black text-white tracking-tighter">{plan.price}</span>
                  <span className="text-sm font-bold text-slate-400">/mês</span>
                </div>
                <p className="text-slate-300 text-sm mb-10 leading-relaxed font-bold">{plan.desc}</p>
                <div className="flex-1 space-y-4 mb-10">
                  {plan.features.map(feat => (
                    <div key={feat} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                      <span className="text-sm text-slate-200 font-medium">{feat}</span>
                    </div>
                  ))}
                </div>
                <Link
                  to="/onboarding/role"
                  className={`w-full py-4 rounded-2xl font-black text-sm transition-all text-center ${plan.highlight ? 'bg-primary text-white shadow-xl shadow-primary/30 hover:bg-primary-light' : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTATO SECTION ═══ */}
      <section id="contato" className="py-32 px-6 bg-[#0E0C0A]">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-[#1C1814] to-[#0E0C0A] border border-[#2E2720] rounded-[3rem] p-12 lg:p-20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full group-hover:bg-primary/20 transition-all duration-700"></div>
            <div className="relative z-10 flex flex-col lg:flex-row gap-16 items-center">
              <div className="flex-1">
                <span className="text-primary text-[10px] font-black tracking-[0.2em] uppercase mb-6 block">Fale Conosco</span>
                <h2 className="text-4xl lg:text-5xl font-black mb-8 leading-tight tracking-tight text-white">Pronto para<br />transformar sua barbearia?</h2>
                <p className="text-slate-400 text-lg mb-12 max-w-md font-bold">Inicie sua evolução agora ou tire dúvidas com nosso time comercial.</p>
                <div className="space-y-6">
                  <div className="flex items-center gap-4 text-white group/item">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all">
                      <span className="material-symbols-outlined">call</span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">WhatsApp / Telefone</p>
                      <p className="text-lg font-bold">(11) 98207-3536</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-white group/item">
                    <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all">
                      <span className="material-symbols-outlined">alternate_email</span>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">E-mail Comercial</p>
                      <p className="text-lg font-bold">sanches.augusto@outlook.com</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full lg:w-[40%] flex flex-col gap-4">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all font-bold"
                >
                  Instagram
                  <span className="material-symbols-outlined">arrow_outward</span>
                </a>
                <a
                  href="https://wa.me/5511982073536"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-6 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl hover:bg-green-500/20 transition-all font-bold"
                >
                  Chamar no WhatsApp
                  <span className="material-symbols-outlined">chat_bubble</span>
                </a>
                <Link
                  to="/onboarding/role"
                  className="mt-4 p-8 bg-primary text-white rounded-[2rem] text-center font-black text-xl shadow-2xl shadow-primary/30 hover:scale-[1.02] transition-all"
                >
                  Começar agora 🚀
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-[#2E2720] bg-[#0A0907] py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-16">
            <div className="max-w-xs text-center md:text-left">
              <Logo size="lg" className="mb-6 justify-center md:justify-start" />
              <p className="text-slate-500 text-sm leading-relaxed">
                Transformando a gestão de barbearias através de dados, simplicidade e tecnologia de elite.
              </p>
            </div>
            <div className="flex gap-16">
              <div className="space-y-4">
                <p className="text-white font-bold text-sm uppercase tracking-widest">Produto</p>
                <ul className="space-y-2 text-slate-400 text-sm">
                  <li><a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a></li>
                  <li><a href="#precos" className="hover:text-primary transition-colors">Preços</a></li>
                  <li><a href="/login" className="hover:text-primary transition-colors">Entrar</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <p className="text-white font-bold text-sm uppercase tracking-widest">Comercial</p>
                <ul className="space-y-2 text-slate-400 text-sm">
                  <li><a href="#contato" className="hover:text-primary transition-colors">Contato</a></li>
                  <li><a href="mailto:sanches.augusto@outlook.com" className="hover:text-primary transition-colors">E-mail</a></li>
                  <li><a href="https://wa.me/5511982073536" className="hover:text-primary transition-colors">WhatsApp</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pt-10 border-t border-[#2E2720] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] text-center md:text-left">
              © {new Date().getFullYear()} SOU MANA.GER. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">ELITE TECH ECOSYSTEM</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══ CHATBOT PRÉ-VENDA ═══ */}
      <LandingSupportWidget />
    </div>
  );
};

export default Landing;