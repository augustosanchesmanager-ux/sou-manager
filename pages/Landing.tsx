import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingSupportWidget from '../components/LandingSupportWidget';

const NAV_LINKS = [
  { label: 'SoluÃ§Ãµes', href: '#solucoes' },
  { label: 'Arquitetura', href: '#arquitetura' },
  { label: 'Cockpit', href: '#cockpit' },
  { label: 'Clube dos Chefes', href: '#clube' },
  { label: 'Planos', href: '#planos' },
  { label: 'Ecossistema', href: '#ecossistema' },
];

const ARCHITECTURE_LAYERS = [
  {
    layer: 'Camada 01',
    badge: 'OperaÃ§Ã£o de Bancada',
    title: 'Cockpit Operacional da Cadeira',
    desc: 'Agenda em grade milimÃ©trica multi-profissional, fila dinÃ¢mica de cadeiras e comandas abertas em 2 cliques com catÃ¡logo dinÃ¢mico.',
    icon: 'calendar_clock',
  },
  {
    layer: 'Camada 02',
    badge: 'GovernanÃ§a & RLS',
    title: 'Motor Financeiro & Rateio AuditÃ¡vel',
    desc: 'Fechamento de caixa com conferÃªncia cega, sangrias, suprimentos e rateio de comissÃ£o desacoplado (ADR-001) sem conflito entre bancadas.',
    icon: 'account_balance_wallet',
  },
  {
    layer: 'Camada 03',
    badge: 'Receita PrevisÃ­vel',
    title: 'Clube dos Chefes & FidelizaÃ§Ã£o',
    desc: 'Motor de recorrÃªncia integrado (MRR) com dÃ©bito recorrente, concessÃ£o controlada de crÃ©ditos e agendamento VIP no portal do cliente.',
    icon: 'loyalty',
  },
  {
    layer: 'Camada 04',
    badge: 'InteligÃªncia Artificial',
    title: 'BI Preditivo com IA Gemini',
    desc: 'DiagnÃ³stico contÃ­nuo de retenÃ§Ã£o, motor inteligente de retorno de clientes inativos e projeÃ§Ã£o de faturamento por cadeira em tempo real.',
    icon: 'psychology',
  },
];

const MATURITY_PLANS = [
  {
    level: 'NÃ­vel 1',
    name: 'OperaÃ§Ã£o Essencial',
    badge: 'EstruturaÃ§Ã£o',
    desc: 'Para barbearias que buscam erradicar anotaÃ§Ãµes em papel e planilhas com controle de fluxo impecÃ¡vel.',
    features: [
      'Agenda inteligente multi-barbeiro em tempo real',
      'PDV Ã¡gil com comandas e catÃ¡logo de produtos',
      'Cadastro e histÃ³rico completo de clientes',
      'Controle de estoque de bancada e suprimentos',
      'Portal web de agendamento online',
      'RelatÃ³rios operacionais de produÃ§Ã£o diÃ¡ria',
    ],
    cta: 'Solicitar DemonstraÃ§Ã£o',
    highlight: false,
  },
  {
    level: 'NÃ­vel 2',
    name: 'GestÃ£o & Clube Pro',
    badge: 'Recomendado para Ateliers',
    desc: 'O motor completo para barbearias consolidadas que querem previsibilidade de receita e governanÃ§a.',
    features: [
      'Tudo do plano OperaÃ§Ã£o Essencial',
      'Motor Clube dos Chefes completo (Planos Recorrentes)',
      'Fechamento de caixa avanÃ§ado com conferÃªncia cega',
      'Rateio de comissÃ£o automatizado e auditÃ¡vel (ADR-001)',
      'Controle de fila de espera e atendimento por cadeira',
      'ComunicaÃ§Ã£o de lembretes e avisos via WhatsApp',
      'Suporte prioritÃ¡rio na implantaÃ§Ã£o',
    ],
    cta: 'Agendar DemonstraÃ§Ã£o Guiada',
    highlight: true,
  },
  {
    level: 'NÃ­vel 3',
    name: 'Atelier Multi-Unidade & Enterprise',
    badge: 'Escala & InteligÃªncia',
    desc: 'Tecnologia de ponta com IA preditiva e automaÃ§Ã£o de autoatendimento para operaÃ§Ãµes em expansÃ£o.',
    features: [
      'Tudo do plano GestÃ£o & Clube Pro',
      'BI Preditivo com IA Gemini (PrevisÃ£o de Churn e OcupaÃ§Ã£o)',
      'MÃ³dulo Totem / Kiosk de Autoatendimento na RecepÃ§Ã£o',
      'Painel de gestÃ£o unificada para mÃºltiplas filiais',
      'API pÃºblica e Webhooks para integraÃ§Ãµes corporativas',
      'Acompanhamento executivo e onboarding presencial guiado',
    ],
    cta: 'Falar com Consultor Executivo',
    highlight: false,
  },
];

const Landing: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('SoluÃ§Ãµes');

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = NAV_LINKS.map(link => ({
        id: link.href.substring(1),
        label: link.label,
      }));

      const sectionsToSpy = [...sections].reverse();
      for (const section of sectionsToSpy) {
        const el = document.getElementById(section.id);
        if (el && window.scrollY >= el.offsetTop - 140) {
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
    <div className="min-h-screen bg-night text-white font-sans selection:bg-primary/30">

      {/* â•â•â• NAVBAR â•â•â• */}
      <nav
        className={`fixed w-full top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-night/95 backdrop-blur-xl border-b border-border-dark py-3.5 shadow-2xl'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">

          {/* Brand Lockup */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <div className="relative size-10 rounded-xl overflow-hidden border border-border-dark bg-card-dark flex items-center justify-center p-1 shadow-smg-glow/30 transition-transform group-hover:scale-105">
              <img
                src="/branding/smg-barber-intelligence-logo.jpg"
                alt="SMG Barber Intelligence"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5 font-display">
                SMG
                <span className="text-primary text-[10px] uppercase font-bold tracking-[0.2em] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                  Barber Intelligence
                </span>
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                Atelier Tech Platform
              </span>
            </div>
          </Link>

          {/* Links Centrais */}
          <div className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href, link.label)}
                className={`text-xs font-bold uppercase tracking-wider transition-colors relative py-1.5 ${
                  activeNav === link.label ? 'text-primary' : 'text-slate-300 hover:text-white'
                }`}
              >
                {link.label}
                {activeNav === link.label && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(217,154,43,0.6)]" />
                )}
              </a>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-4">
            <Link
              to="/portal"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-card-dark border border-transparent hover:border-border-dark"
            >
              <span className="material-symbols-outlined text-base">hub</span>
              Portal
            </Link>
            <Link
              to="/login"
              className="text-xs font-bold uppercase tracking-wider text-white hover:text-primary-light transition-colors px-4 py-2"
            >
              Acessar
            </Link>
            <a
              href="https://wa.me/5511982073536?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20guiada%20do%20SMG%20Barber%20Intelligence."
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-primary hover:bg-primary-light text-night text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-smg-glow hover:-translate-y-0.5 flex items-center gap-2"
            >
              <span>Agendar Demo</span>
              <span className="material-symbols-outlined text-sm font-black">arrow_forward</span>
            </a>
          </div>
        </div>
      </nav>

      {/* â•â•â• HERO SECTION â•â•â• */}
      <section id="solucoes" className="relative pt-36 pb-24 lg:pt-44 lg:pb-32 px-6 overflow-hidden">
        {/* Glowing atmospheric backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-primary/10 blur-[140px] pointer-events-none rounded-full" />
        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Flanco Esquerdo: Proposta de Valor */}
            <div className="lg:col-span-6 flex flex-col justify-center">

              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 self-start mb-6">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-bold text-primary-light uppercase tracking-[0.2em] font-display">
                  SMG Barber Intelligence
                </span>
              </div>

              {/* Headline Oficial */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.08] tracking-tight mb-6 font-display">
                ALÃ‰M DO CORTE.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
                  UMA GESTÃƒO INTELIGENTE.
                </span>
              </h1>

              {/* SubtÃ­tulo */}
              <p className="text-slate-300 text-base lg:text-lg leading-relaxed mb-8 max-w-xl font-medium">
                InteligÃªncia operacional, governanÃ§a financeira auditÃ¡vel e motor de recorrÃªncia contÃ­nua para barbearias e ateliers que operam no mais alto padrÃ£o do mercado.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <a
                  href="https://wa.me/5511982073536?text=Ol%C3%A1%2C%20quero%20conhecer%20o%20SMG%20Barber%20Intelligence%20e%20agendar%20uma%20demonstra%C3%A7%C3%A3o."
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-3 px-7 py-4 bg-primary hover:bg-primary-light text-night font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-smg-glow hover:-translate-y-0.5"
                >
                  <span>Agendar DemonstraÃ§Ã£o Guiada</span>
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </a>
                <a
                  href="#cockpit"
                  onClick={(e) => handleNavClick(e, '#cockpit', 'Cockpit')}
                  className="flex items-center justify-center gap-2.5 px-6 py-4 bg-card-dark hover:bg-surface-dark border border-border-dark text-white font-bold text-sm uppercase tracking-wider rounded-xl transition-all hover:border-primary/40"
                >
                  <span>Ver Cockpit Operacional</span>
                  <span className="material-symbols-outlined text-lg text-primary">keyboard_arrow_down</span>
                </a>
              </div>

              {/* Credenciais de Arquitetura (Sem fake stats) */}
              <div className="pt-8 border-t border-border-dark/80 grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Isolamento</p>
                  <p className="text-sm font-extrabold text-white mt-1">Multi-Tenant RLS</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">SeguranÃ§a em banco</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Financeiro</p>
                  <p className="text-sm font-extrabold text-white mt-1">ADR-001 CanÃ´nico</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Rateio e fechamento</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">RecorrÃªncia</p>
                  <p className="text-sm font-extrabold text-white mt-1">Clube dos Chefes</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">MRR e fidelizaÃ§Ã£o</p>
                </div>
              </div>
            </div>

            {/* Flanco Direito: Showcase GrÃ¡fico + Chip Oficial */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden border border-border-dark bg-card-dark/80 backdrop-blur-md p-2 shadow-2xl shadow-black/80">
                <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-night">
                  <img
                    src="/branding/smg-chip-hero.jpg"
                    alt="SMG Barber Intelligence Neural Architecture"
                    className="w-full h-full object-cover object-center scale-105 hover:scale-100 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night via-transparent to-transparent opacity-80" />

                  {/* Floating Micro-Badge */}
                  <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-xl bg-card-dark/90 backdrop-blur-md border border-border-dark flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-lg">bolt</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white tracking-wide">Arquitetura de Alta Densidade</p>
                        <p className="text-[10px] text-slate-400">Processamento em tempo real com Supabase Realtime</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Ativo
                    </span>
                  </div>
                </div>
              </div>

              {/* Subtle ambient light */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 via-amber-500/10 to-transparent blur-2xl -z-10 rounded-3xl" />
            </div>

          </div>
        </div>
      </section>

      {/* â•â•â• FAIXA DE DIFERENCIAIS TÃ‰CNICOS (GROUND REALITY) â•â•â• */}
      <section className="border-y border-border-dark bg-surface-dark/60 py-10 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-card-dark border border-border-dark flex items-center justify-center text-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Isolamento Multi-Tenant RLS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                SeguranÃ§a em nÃ­vel de banco de dados (PostgreSQL RLS). Blindagem de dados por tenant sem vazamento entre barbearias.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-card-dark border border-border-dark flex items-center justify-center text-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-2xl">price_check</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Financeiro AuditÃ¡vel (ADR-001)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ComissÃ£o teÃ³rica e rateio de fechamento de caixa tratados como domÃ­nios separados. Zero margem para disputas de bancada.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-card-dark border border-border-dark flex items-center justify-center text-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-2xl">sync_saved_locally</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Motor Event-Driven Outbox</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Despacho de eventos assÃ­ncrono com idempotÃªncia e retry inteligente. ComunicaÃ§Ã£o garantida mesmo em instabilidade de rede.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-card-dark border border-border-dark flex items-center justify-center text-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-2xl">touch_app</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Totem Kiosk & Portal Web</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Check-in autÃ´nomo na recepÃ§Ã£o via Totem dedicado e agendamento digital no portal do cliente sem intermediÃ¡rios.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* â•â•â• ARQUITETURA EM TODAS AS CAMADAS â•â•â• */}
      <section id="arquitetura" className="py-24 lg:py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">

          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary-light text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
              Tecnologia de Ponta
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-6 font-display">
              UMA PLATAFORMA INTELIGENTE,<br />
              <span className="text-primary italic font-serif">EM TODAS AS CAMADAS.</span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              O poder do SMG Barber Intelligence reside em uma arquitetura modular desenhada especificamente para a rotina cirÃºrgica do atelier: alta densidade, sincronizaÃ§Ã£o imediata e precisÃ£o contÃ¡bil.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Visual 3D das Camadas Oficiais */}
            <div className="lg:col-span-5 order-2 lg:order-1">
              <div className="relative rounded-2xl overflow-hidden border border-border-dark bg-card-dark p-2 shadow-2xl shadow-black/90">
                <div className="rounded-xl overflow-hidden aspect-[4/5] bg-night relative">
                  <img
                    src="/branding/smg-layered-architecture.jpg"
                    alt="SMG Barber Intelligence - Arquitetura de Camadas"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night via-transparent to-transparent opacity-60" />
                </div>
              </div>
            </div>

            {/* Lista Estruturada das Camadas */}
            <div className="lg:col-span-7 order-1 lg:order-2 space-y-5">
              {ARCHITECTURE_LAYERS.map(item => (
                <div
                  key={item.layer}
                  className="bg-card-dark/80 backdrop-blur-md border border-border-dark hover:border-primary/40 rounded-2xl p-6 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-night transition-colors">
                        <span className="material-symbols-outlined text-xl">{item.icon}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {item.layer}
                        </span>
                        <h3 className="text-base font-extrabold text-white tracking-tight">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded bg-surface-dark text-slate-300 border border-border-dark">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed pl-13">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* â•â•â• SHOWCASE: COCKPIT OPERACIONAL (NATIVE REACT UI) â•â•â• */}
      <section id="cockpit" className="py-24 px-6 bg-surface-dark/40 border-y border-border-dark relative">
        <div className="max-w-7xl mx-auto">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary-light text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
                Showcase Operacional
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                O Cockpit que comanda a barbearia<br />
                <span className="text-primary italic font-serif">sem pausas e sem ruÃ­do.</span>
              </h2>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm max-w-md leading-relaxed">
              Desenvolvido para dono, gerente e recepcionista dominarem o balcÃ£o e a bancada em uma Ãºnica tela de alta densidade informativa.
            </p>
          </div>

          {/* MOCKUP EM CÃ“DIGO NATIVO DO COCKPIT */}
          <div className="rounded-2xl border border-border-dark bg-night shadow-2xl overflow-hidden">

            {/* Topbar do Cockpit Mockup */}
            <div className="bg-card-dark px-6 py-4 border-b border-border-dark flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-red-500/80" />
                  <span className="size-3 rounded-full bg-amber-500/80" />
                  <span className="size-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-bold text-slate-300 pl-2 border-l border-border-dark">
                  Atelier Sanchez â€” BalcÃ£o Principal
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Supabase Realtime Conectado
                </span>
                <span className="text-slate-400">Hoje, 06 de Novembro</span>
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border-dark">
              <div className="bg-night p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faturamento Hoje</p>
                <p className="text-2xl font-black text-white mt-1">R$ 4.850,00</p>
                <p className="text-[10px] text-emerald-400 mt-1 font-semibold">28 atendimentos realizados</p>
              </div>
              <div className="bg-night p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taxa de OcupaÃ§Ã£o</p>
                <p className="text-2xl font-black text-primary mt-1">94%</p>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">Bancadas a pleno vapor</p>
              </div>
              <div className="bg-night p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket MÃ©dio</p>
                <p className="text-2xl font-black text-white mt-1">R$ 173,20</p>
                <p className="text-[10px] text-emerald-400 mt-1 font-semibold">Combos e produtos ativos</p>
              </div>
              <div className="bg-night p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clube dos Chefes</p>
                <p className="text-2xl font-black text-amber-400 mt-1">142 Ativos</p>
                <p className="text-[10px] text-slate-400 mt-1 font-semibold">Receita recorrente garantida</p>
              </div>
            </div>

            {/* VisualizaÃ§Ã£o de Cadeiras & Comandas em Andamento */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-card-dark/40">

              {/* Coluna 1-8: Timeline de Cadeiras com Chips Atelier */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border-dark">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Bancadas em Atendimento (Tempo Real)
                  </span>
                  <span className="text-[10px] font-semibold text-primary">3 barbeiros ativos</span>
                </div>

                <div className="space-y-3">

                  {/* Cadeira 1 */}
                  <div className="bg-card-dark p-4 rounded-xl border border-border-dark flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg flex items-center justify-center font-black text-night text-xs" style={{ backgroundColor: '#C98A1F' }}>
                        GB
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">Guilherme Bastos</p>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Cadeira 01
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">Cliente: Rodrigo Sanches â€” Corte DegradÃª + Barba Terapia</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-primary">R$ 160,00</span>
                      <p className="text-[10px] text-emerald-400 font-semibold">Em finalizaÃ§Ã£o (35 min)</p>
                    </div>
                  </div>

                  {/* Cadeira 2 */}
                  <div className="bg-card-dark p-4 rounded-xl border border-border-dark flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg flex items-center justify-center font-black text-night text-xs" style={{ backgroundColor: '#10B981' }}>
                        MS
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">Mateus Silva</p>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Cadeira 02
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">Cliente: Bruno Alcantara â€” Alinhamento ClÃ¡ssico (Membro Gold)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-amber-400">Plano Clube</span>
                      <p className="text-[10px] text-slate-400 font-semibold">Iniciado hÃ¡ 15 min</p>
                    </div>
                  </div>

                  {/* Cadeira 3 */}
                  <div className="bg-card-dark p-4 rounded-xl border border-border-dark flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg flex items-center justify-center font-black text-night text-xs" style={{ backgroundColor: '#F59E0B' }}>
                        RO
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">Rafael Oliveira</p>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary-light border border-primary/20">
                            Cadeira 03
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">Cliente: Eduardo Lima â€” Combo Chef + Pomada Matte</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-primary">R$ 215,00</span>
                      <p className="text-[10px] text-slate-400 font-semibold">Iniciado hÃ¡ 20 min</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Coluna 9-12: Comanda Aberta em Destaque */}
              <div className="lg:col-span-4 bg-night p-5 rounded-xl border border-border-dark flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border-dark">
                    <span className="text-xs font-bold text-white">Comanda #1042</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      Aberta
                    </span>
                  </div>

                  <div className="py-3 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Corte DegradÃª Navalhado</span>
                      <span className="font-semibold text-white">R$ 90,00</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Barboterapia com Toalha Quente</span>
                      <span className="font-semibold text-white">R$ 70,00</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Pomada Matte Efeito Seco</span>
                      <span className="font-semibold text-white">R$ 55,00</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border-dark text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span>
                      <span>R$ 215,00</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-semibold">
                      <span>Rateio de ComissÃ£o (Bancada)</span>
                      <span>R$ 88,00</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-white pt-1">
                      <span>LÃ­quido da Casa</span>
                      <span className="text-primary font-black">R$ 127,00</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-dark">
                  <div className="w-full py-2.5 rounded-lg bg-primary/15 text-primary-light border border-primary/30 text-center text-xs font-bold">
                    Auditoria CanÃ´nica ADR-001 Ativa
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* â•â•â• CLUBE DOS CHEFES (RECORRÃŠNCIA MRR) â•â•â• */}
      <section id="clube" className="py-24 lg:py-32 px-6 relative overflow-hidden">

        {/* Background com imagem editorial de alta resoluÃ§Ã£o com overlay elegante */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src="/bg-sobre.jpg"
            alt="Atelier de barbearia"
            className="w-full h-full object-cover object-center opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-night via-night/95 to-night" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-bold uppercase tracking-[0.2em] mb-6">
                RecorrÃªncia PrevisÃ­vel
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-6 font-display">
                O CLUBE DOS CHEFES<br />
                <span className="text-primary italic font-serif">na sua barbearia.</span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                Transforme clientes casuais em membros fiÃ©is com assinaturas recorrentes debitadas automaticamente. O mÃ³dulo Clube dos Chefes gerencia crÃ©ditos de serviÃ§os, benefÃ­cios exclusivos e fidelizaÃ§Ã£o sem quebrar o fluxo de caixa.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Receita Recorrente no InÃ­cio do MÃªs (MRR)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Estabilidade garantida para honrar custos fixos da barbearia independentemente de dias chuvosos ou feriados.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Consumo e Baixa Transparente na Comanda</h3>
                    <p className="text-xs text-slate-400 mt-0.5">O barbeiro atende o assinante e a comanda dÃ¡ baixa imediata nos crÃ©ditos com rateio de comissÃ£o correto.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Agendamento PrioritÃ¡rio no Portal do Cliente</h3>
                    <p className="text-xs text-slate-400 mt-0.5">O membro acessa o link da barbearia pelo celular, escolhe o horÃ¡rio preferido e garante seu atendimento sem fricÃ§Ã£o.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cards Ilustrativos dos NÃ­veis de Membro */}
            <div className="lg:col-span-6 space-y-4">

              <div className="bg-card-dark/90 backdrop-blur-md border border-border-dark p-6 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <span className="material-symbols-outlined text-2xl">shield</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NÃ­vel 01</span>
                    <h3 className="text-base font-black text-white">Plano ClÃ¡ssico</h3>
                    <p className="text-xs text-slate-300">Cortes de cabelo programados no mÃªs</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg">
                  RecorrÃªncia
                </span>
              </div>

              <div className="bg-card-dark/90 backdrop-blur-md border border-primary/40 p-6 rounded-2xl flex items-center justify-between shadow-smg-glow/20">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">NÃ­vel 02 â€¢ Mais Assinado</span>
                    <h3 className="text-base font-black text-white">Plano Gentleman</h3>
                    <p className="text-xs text-slate-300">Cabelo + Barba + Bebida Cortesia por visita</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-night uppercase tracking-wider bg-primary px-3 py-1.5 rounded-lg font-black">
                  VIP Club
                </span>
              </div>

              <div className="bg-card-dark/90 backdrop-blur-md border border-border-dark p-6 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <span className="material-symbols-outlined text-2xl">diamond</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">NÃ­vel 03</span>
                    <h3 className="text-base font-black text-white">Black Chef Exclusive</h3>
                    <p className="text-xs text-slate-300">ExperiÃªncia completa ilimitada + desconto em produtos</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                  Atelier Top
                </span>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* â•â•â• INTELIGÃŠNCIA ARTIFICIAL & GOVERNANÃ‡A â•â•â• */}
      <section className="py-24 lg:py-32 px-6 bg-surface-dark/30 border-y border-border-dark relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Visual 3D do CÃ©rebro Neural */}
            <div className="lg:col-span-6">
              <div className="relative rounded-2xl overflow-hidden border border-border-dark bg-card-dark p-2 shadow-2xl shadow-black/80">
                <div className="rounded-xl overflow-hidden aspect-[16/10] bg-night">
                  <img
                    src="/branding/smg-ai-brain-barber.jpg"
                    alt="SMG Barber Intelligence - CÃ©rebro Neural e GovernanÃ§a"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-night via-transparent to-transparent opacity-60" />
                </div>
              </div>
            </div>

            {/* ConteÃºdo de IA e GovernanÃ§a */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary-light text-[11px] font-bold uppercase tracking-[0.2em] mb-6">
                InteligÃªncia Preditiva
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-6 font-display">
                DESENVOLVIDA PARA QUEM BUSCA<br />
                <span className="text-primary italic font-serif">RESULTADOS EXCEPCIONAIS.</span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                Com o SMG Barber Intelligence, sua barbearia deixa de operar no escuro. Nossos algoritmos analisam a cadÃªncia dos atendimentos e transformam dados brutos em decisÃµes que elevam o faturamento da cadeira.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-card-dark border border-border-dark">
                  <div className="flex items-center gap-2.5 text-primary mb-2">
                    <span className="material-symbols-outlined text-xl">restore</span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Motor de Retorno</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Identifica clientes que passaram da janela habitual de corte e gera lembretes precisos no momento de recompra.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-card-dark border border-border-dark">
                  <div className="flex items-center gap-2.5 text-primary mb-2">
                    <span className="material-symbols-outlined text-xl">query_stats</span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">DetecÃ§Ã£o de Ociosidade</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mapeia horÃ¡rios ociosos na grade semanal e recomenda encaixes para maximizar a ocupaÃ§Ã£o das cadeiras.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* â•â•â• PLANOS POR MATURIDADE OPERACIONAL (SEM VALORES DESCALIBRADOS) â•â•â• */}
      <section id="planos" className="py-24 lg:py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">

          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary-light text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
              Investimento EstratÃ©gico
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-6 font-display">
              MATURIDADE OPERACIONAL<br />
              <span className="text-primary italic font-serif">sob medida para seu momento.</span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Planos desenhados para a escala real da sua operaÃ§Ã£o. Agende uma demonstraÃ§Ã£o guiada e conheÃ§a a plataforma personalizada para a sua barbearia.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {MATURITY_PLANS.map(plan => (
              <div
                key={plan.name}
                className={`flex flex-col p-8 sm:p-10 rounded-2xl relative transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-card-dark to-night border-2 border-primary/60 shadow-2xl shadow-primary/10'
                    : 'bg-card-dark border border-border-dark'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-night text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    {plan.level}
                  </span>
                  <h3 className="text-2xl font-black text-white mt-1 mb-3">{plan.name}</h3>
                  <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{plan.desc}</p>
                </div>

                <div className="flex-1 space-y-3.5 my-6 pt-6 border-t border-border-dark">
                  {plan.features.map(feat => (
                    <div key={feat} className="flex items-start gap-3 text-xs leading-relaxed">
                      <span className="material-symbols-outlined text-primary text-base shrink-0 mt-0.5">
                        check_circle
                      </span>
                      <span className="text-slate-200">{feat}</span>
                    </div>
                  ))}
                </div>

                <a
                  href={`https://wa.me/5511982073536?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20plano%20${encodeURIComponent(
                    plan.name
                  )}%20do%20SMG%20Barber%20Intelligence.`}
                  target="_blank"
                  rel="noreferrer"
                  className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-wider text-center transition-all ${
                    plan.highlight
                      ? 'bg-primary hover:bg-primary-light text-night shadow-smg-glow'
                      : 'bg-surface-dark hover:bg-card-dark text-white border border-border-dark hover:border-primary/40'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* â•â•â• ECOSSISTEMA SMG INTELLIGENCE â•â•â• */}
      <section id="ecossistema" className="py-20 px-6 bg-surface-dark/60 border-y border-border-dark">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-card-dark to-night border border-border-dark rounded-2xl p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-2">
                Ecossistema SMG Intelligence
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-4 font-display">
                Uma suÃ­te de inteligÃªncia para operaÃ§Ãµes de serviÃ§os de alto valor.
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                AlÃ©m do <strong>SMG Barber Intelligence</strong>, o ecossistema SMG Intelligence integra as verticais <strong>Auto Control</strong> (estÃ©tica e mecÃ¢nica de precisÃ£o) e o <strong>Portal Unificado</strong> de agendamentos e membros.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
              <Link
                to="/portal"
                className="px-6 py-3.5 bg-card-dark hover:bg-surface-dark border border-border-dark text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all text-center flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base text-primary">hub</span>
                <span>Acessar Portal SMG</span>
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 bg-primary hover:bg-primary-light text-night text-xs font-black uppercase tracking-wider rounded-xl transition-all text-center shadow-smg-glow flex items-center justify-center gap-2"
              >
                <span>Acessar Barbearia</span>
                <span className="material-symbols-outlined text-base">login</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* â•â•â• FOOTER ATELIER â•â•â• */}
      <footer className="bg-night border-t border-border-dark py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-border-dark">

            <div className="md:col-span-5">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="size-9 rounded-xl overflow-hidden border border-border-dark bg-card-dark p-1">
                  <img
                    src="/branding/smg-barber-intelligence-logo.jpg"
                    alt="SMG Barber Intelligence"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-sm font-extrabold text-white tracking-tight font-display">
                  SMG Barber Intelligence
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-sm mb-6">
                Tecnologia, governanÃ§a contÃ¡bil e motor de recorrÃªncia desenhados para barbearias e ateliers que buscam o mais alto patamar de excelÃªncia.
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span>Plataforma Operacional Ativa</span>
              </div>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white">Plataforma</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#solucoes" className="hover:text-primary transition-colors">SoluÃ§Ãµes</a></li>
                <li><a href="#arquitetura" className="hover:text-primary transition-colors">Arquitetura de Camadas</a></li>
                <li><a href="#cockpit" className="hover:text-primary transition-colors">Cockpit Operacional</a></li>
                <li><a href="#clube" className="hover:text-primary transition-colors">Clube dos Chefes</a></li>
                <li><a href="#planos" className="hover:text-primary transition-colors">Maturidade & Planos</a></li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-white">Contato & DemonstraÃ§Ã£o</p>
              <div className="space-y-2 text-xs text-slate-400">
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">chat</span>
                  <span>WhatsApp: (11) 98207-3536</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">mail</span>
                  <span>sanches.augusto@outlook.com</span>
                </p>
                <p className="text-[11px] text-slate-400 pt-2">
                  Atendimento especializado para proprietÃ¡rios e gestores de barbearias em todo o Brasil.
                </p>
              </div>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>Â© {new Date().getFullYear()} SMG Intelligence. Todos os direitos reservados.</p>
            <div className="flex items-center gap-6">
              <Link to="/portal" className="hover:text-primary transition-colors">Portal SMG</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Acesso ao Sistema</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Widget Interativo de Atendimento PrÃ©-Venda Preservado */}
      <LandingSupportWidget />
    </div>
  );
};

export default Landing;
