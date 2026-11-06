import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingSupportWidget from '../components/LandingSupportWidget';
import DemoBookingModal from '../components/DemoBookingModal';

/**
 * Componente de revelação fluida ativado pelo scroll do mouse.
 * Aplica transição suave e natural com IntersectionObserver.
 */
interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, className = '', delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    const currentEl = elementRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, []);

  return (
    <div
      ref={elementRef}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-out will-change-transform ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-16 scale-95'
      } ${className}`}
    >
      {children}
    </div>
  );
};

const NAV_LINKS = [
  { label: 'SISTEMA', href: '#solucoes' },
  { label: 'ARQUITETURA', href: '#arquitetura' },
  { label: 'COCKPIT', href: '#cockpit' },
  { label: 'CLUBE DOS CHEFES', href: '#clube' },
  { label: 'IA PREDITIVA', href: '#ia' },
  { label: 'PLANOS', href: '#planos' },
];

const ARCHITECTURE_CALLOUTS = [
  {
    id: '01',
    side: 'left',
    tag: '// CAMADA 01 · OPERACIONAL',
    title: 'Cockpit de Bancada',
    desc: 'Agenda multiprofissional em tempo real, fila dinâmica de cadeiras e abertura instantânea de comandas.',
  },
  {
    id: '02',
    side: 'left',
    tag: '// CAMADA 02 · GOVERNANÇA',
    title: 'Financeiro & Rateio Auditável',
    desc: 'Fechamento de caixa com conferência cega, sangria, suprimento e rateio de comissão canônico (ADR-001).',
  },
  {
    id: '03',
    side: 'right',
    tag: '// CAMADA 03 · RECORRÊNCIA',
    title: 'Clube dos Chefes',
    desc: 'Assinaturas recorrentes no cartão com débito automático, controle de saldo de serviços e baixa na comanda.',
  },
  {
    id: '04',
    side: 'right',
    tag: '// CAMADA 04 · INTELIGÊNCIA',
    title: 'IA Preditiva com Gemini',
    desc: 'Algoritmos que monitoram o ciclo de retorno dos clientes, previnem o cancelamento e orientam a ocupação.',
  },
];

const MATURITY_PLANS = [
  {
    code: 'PLANO 01',
    name: 'Operação Essencial',
    badge: 'ESTRUTURAÇÃO',
    desc: 'Para barbearias que desejam profissionalizar o balcão, aposentar papéis e gerenciar o caixa com exatidão.',
    features: [
      'Agenda multiprofissional com visão diária e semanal em tempo real',
      'Ponto de Venda (PDV) ágil integrado a comandas digitais',
      'Cadastro detalhado e histórico completo de consumo dos clientes',
      'Controle de estoque de produtos para venda e insumos de bancada',
      'Portal web exclusivo para agendamento online do cliente',
      'Relatórios de fechamento de caixa e conferência de turnos',
    ],
    cta: 'SOLICITAR DEMONSTRAÇÃO',
    highlight: false,
  },
  {
    code: 'PLANO 02',
    name: 'Gestão & Clube Pro',
    badge: 'RECOMENDADO',
    desc: 'O motor operacional completo para barbearias consolidadas que buscam receita previsível e retenção contínua.',
    features: [
      'Todos os recursos do plano Operação Essencial',
      'Módulo Clube dos Chefes completo (Planos Recorrentes no Cartão)',
      'Fechamento de caixa avançado com conferência cega e sangria',
      'Cálculo automatizado de rateio de comissões (norma canônica ADR-001)',
      'Controle dinâmico de fila de espera e atendimento por cadeira',
      'Notificações de lembretes e confirmações automáticas via WhatsApp',
      'Suporte prioritário na implantação e treinamento da equipe',
    ],
    cta: 'AGENDAR DEMONSTRAÇÃO GUIADA',
    highlight: true,
  },
  {
    code: 'PLANO 03',
    name: 'Atelier Multi-Unidade',
    badge: 'ESCALA CORPORATIVA',
    desc: 'Tecnologia de ponta com inteligência artificial preditiva e totem de autoatendimento para operações em expansão.',
    features: [
      'Todos os recursos do plano Gestão & Clube Pro',
      'BI Preditivo com IA Gemini (Previsão de churn e horários ociosos)',
      'Módulo Totem / Kiosk de autoatendimento para a recepção',
      'Painel consolidado para gestão de múltiplas filiais',
      'API pública e webhooks para integrações contábeis e externas',
      'Acompanhamento executivo contínuo e parametrização personalizada',
    ],
    cta: 'FALAR COM CONSULTOR',
    highlight: false,
  },
];

const Landing: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('SISTEMA');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [selectedDemoPlan, setSelectedDemoPlan] = useState<string | null>(null);

  const openDemoBooking = (planName?: string) => {
    setSelectedDemoPlan(planName || null);
    setIsDemoModalOpen(true);
  };

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 25);

      const sections = NAV_LINKS.map(link => ({
        id: link.href.substring(1),
        label: link.label,
      }));

      const sectionsToSpy = [...sections].reverse();
      for (const section of sectionsToSpy) {
        const el = document.getElementById(section.id);
        if (el && window.scrollY >= el.offsetTop - 160) {
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
    <div className="min-h-screen bg-[#070605] text-white font-sans selection:bg-primary/30 relative overflow-x-hidden">

      {/* Grid sutil de precisão técnica no fundo (estética Aphelion) */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.035] -z-10"
        style={{
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ═══ NAVBAR TELEMETRIA ATELIER ═══ */}
      <nav
        className={`fixed w-full top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#070605]/95 backdrop-blur-xl border-b border-border-dark py-3.5 shadow-2xl'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">

          {/* Logotipo Oficial Horizontal em PNG Transparente */}
          <Link to="/" className="flex items-center group">
            <img
              src="/branding/smg-barber-intelligence-logo.png"
              alt="SMG Barber Intelligence"
              className="h-9 sm:h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Links Centrais com Estilo Técnico */}
          <div className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href, link.label)}
                className={`text-[11px] font-mono tracking-[0.18em] transition-colors relative py-1.5 ${
                  activeNav === link.label ? 'text-primary font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.label}
                {activeNav === link.label && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(217,154,43,0.7)]" />
                )}
              </a>
            ))}
          </div>

          {/* Ações / CTAs */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/portal"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest text-slate-400 hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-card-dark border border-transparent hover:border-border-dark"
            >
              <span className="material-symbols-outlined text-sm text-primary">hub</span>
              PORTAL
            </Link>
            <Link
              to="/login"
              className="text-[11px] font-mono tracking-widest text-slate-300 hover:text-white transition-colors px-3 py-2"
            >
              ENTRAR
            </Link>
            <button
              type="button"
              onClick={() => openDemoBooking()}
              className="px-4 sm:px-5 py-2.5 bg-primary hover:bg-primary-light text-night text-[11px] font-mono font-bold tracking-widest uppercase rounded-lg transition-all shadow-smg-glow hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
            >
              <span>AGENDAR DEMO</span>
              <span className="material-symbols-outlined text-xs font-black">arrow_forward</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO SECTION (INSPIRADO NA REFERÊNCIA APHELION) ═══ */}
      <section id="solucoes" className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 px-6 overflow-hidden min-h-[92vh] flex flex-col justify-between">

        {/* Brilho atmosférico sutil no fundo */}
        <div className="absolute top-1/3 right-1/4 w-[650px] h-[650px] bg-primary/10 blur-[160px] pointer-events-none rounded-full -z-10" />

        <div className="max-w-7xl mx-auto w-full my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

            {/* Flanco Esquerdo: Conteúdo Editorial e Tipografia Aphelion */}
            <div className="lg:col-span-5 flex flex-col justify-center z-10">

              {/* Eyebrow Técnico com traço */}
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-6 h-px bg-primary" />
                <span className="text-[11px] font-mono tracking-[0.22em] text-primary uppercase">
                  01 / PLATAFORMA OPERACIONAL DE ELITE
                </span>
              </div>

              {/* Headline em Destaque Absoluto com Ponto Final Colorido */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.04] tracking-tight mb-6 font-display">
                ALÉM DO CORTE.<br />
                <span className="text-white">
                  UMA GESTÃO
                </span><br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
                  INTELIGENTE
                </span>
                <span className="text-primary text-5xl lg:text-6xl">.</span>
              </h1>

              {/* Parágrafo em Português Brasileiro Fluente */}
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-lg font-normal">
                Engenharia de precisão para barbearias de alto padrão. Unificamos agenda multiprofissional, governança financeira auditável e motor de receita recorrente em uma plataforma de alta densidade.
              </p>

              {/* Chamadas de Ação com Estética de Telemetria */}
              <div className="flex flex-col sm:flex-row gap-3.5 mb-8">
                <button
                  type="button"
                  onClick={() => openDemoBooking()}
                  className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-primary hover:bg-primary-light text-night font-mono font-bold text-xs uppercase tracking-widest rounded-lg transition-all shadow-smg-glow hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>AGENDAR DEMONSTRAÇÃO</span>
                  <span className="material-symbols-outlined text-sm font-black">arrow_forward</span>
                </button>
                <a
                  href="#arquitetura"
                  onClick={(e) => handleNavClick(e, '#arquitetura', 'ARQUITETURA')}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 bg-transparent hover:bg-card-dark border border-border-dark text-slate-300 hover:text-white font-mono text-xs uppercase tracking-widest rounded-lg transition-all hover:border-primary/50"
                >
                  <span>EXPLORAR SISTEMA</span>
                  <span className="material-symbols-outlined text-sm text-primary">south</span>
                </a>
              </div>

            </div>

            {/* Flanco Direito: CHIP EM DESTAQUE MASSIVO (BEM MAIOR E SEM CAIXA) */}
            <div className="lg:col-span-7 relative flex items-center justify-center lg:justify-end">

              {/* Brilho radial sem moldura */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-amber-500/10 to-transparent blur-[140px] pointer-events-none rounded-full -z-10" />

              <ScrollReveal delay={100} className="w-full flex items-center justify-center lg:justify-end">
                <img
                  src="/branding/smg-chip-hero.png"
                  alt="Processador Neural SMG Barber Intelligence"
                  className="w-full max-w-[720px] lg:max-w-[820px] xl:max-w-[920px] h-auto object-contain drop-shadow-[0_0_55px_rgba(217,154,43,0.38)] hover:scale-105 transition-transform duration-700 ease-out cursor-pointer"
                />
              </ScrollReveal>

            </div>

          </div>
        </div>

        {/* Telemetria de Rodapé da Seção (Estilo Aphelion: RANGE / CREW / LAUNCH) */}
        <div className="max-w-7xl mx-auto w-full pt-8 mt-12 border-t border-border-dark grid grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div>
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-400">SEGURANÇA DE DADOS</p>
            <p className="text-sm font-bold text-white mt-1">Isolamento Multi-Tenant</p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">RLS Nativo no PostgreSQL</p>
          </div>
          <div>
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-400">GOVERNANÇA FINANCEIRA</p>
            <p className="text-sm font-bold text-white mt-1">Conferência Cega (ADR-001)</p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Rateio Canônico sem Conflito</p>
          </div>
          <div>
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-400">MOTOR DE RECORRÊNCIA</p>
            <p className="text-sm font-bold text-white mt-1">Clube dos Chefes</p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">Receita Previsível no Cartão</p>
          </div>
          <div>
            <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-slate-400">SINCRONIZAÇÃO</p>
            <p className="text-sm font-bold text-white mt-1">Tempo Real Instantâneo</p>
            <p className="text-[11px] text-emerald-400 font-mono mt-0.5">Supabase Realtime Ativo</p>
          </div>
        </div>

      </section>

      {/* ═══ SEÇÃO 02: ARQUITETURA EM 4 CAMADAS (ESTILO EXPLODED VIEW APHELION) ═══ */}
      <section id="arquitetura" className="py-24 lg:py-36 px-6 relative border-t border-border-dark bg-[#080706]">
        <div className="max-w-7xl mx-auto">

          {/* Cabeçalho da Seção */}
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-6 h-px bg-primary" />
              <span className="text-[11px] font-mono tracking-[0.22em] text-primary uppercase">
                02 / ARQUITETURA DO SISTEMA
              </span>
              <span className="w-6 h-px bg-primary" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4 font-display">
              UMA PLATAFORMA.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
                QUATRO CAMADAS DE INTELIGÊNCIA.
              </span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              O SMG Barber Intelligence opera sobre uma estrutura em camadas independentes, garantindo estabilidade na bancada e precisão contábil irretocável.
            </p>
          </div>

          {/* COMPOSIÇÃO EXPLODIDA: CHIP EM CAMADAS NO CENTRO + CALLOUTS TÉCNICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

            {/* Chamadas da Esquerda */}
            <div className="lg:col-span-3 space-y-8 order-2 lg:order-1">
              {ARCHITECTURE_CALLOUTS.filter(c => c.side === 'left').map(item => (
                <ScrollReveal key={item.id} delay={150}>
                  <div className="p-5 rounded-xl bg-card-dark/80 border border-border-dark hover:border-primary/50 transition-all duration-300">
                    <p className="text-[10px] font-mono tracking-widest text-primary mb-1.5">{item.tag}</p>
                    <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            {/* Imagem Central: CHIP EM CAMADAS BEM MAIOR E FLUTUANDO LIVRE */}
            <div className="lg:col-span-6 relative flex items-center justify-center order-1 lg:order-2">
              <div className="absolute inset-0 bg-primary/10 blur-[130px] pointer-events-none rounded-full -z-10" />
              <ScrollReveal delay={100} className="w-full flex items-center justify-center">
                <img
                  src="/branding/smg-layered-architecture.png"
                  alt="Arquitetura Explodida em Camadas SMG Barber"
                  className="w-full max-w-[560px] lg:max-w-[640px] h-auto object-contain drop-shadow-[0_0_60px_rgba(217,154,43,0.35)] hover:scale-105 transition-transform duration-700 ease-out"
                />
              </ScrollReveal>
            </div>

            {/* Chamadas da Direita */}
            <div className="lg:col-span-3 space-y-8 order-3">
              {ARCHITECTURE_CALLOUTS.filter(c => c.side === 'right').map(item => (
                <ScrollReveal key={item.id} delay={250}>
                  <div className="p-5 rounded-xl bg-card-dark/80 border border-border-dark hover:border-primary/50 transition-all duration-300">
                    <p className="text-[10px] font-mono tracking-widest text-primary mb-1.5">{item.tag}</p>
                    <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

          </div>

        </div>
      </section>

      {/* ═══ SEÇÃO 03: SHOWCASE COCKPIT OPERACIONAL (DADOS REAIS EM TEMPO REAL) ═══ */}
      <section id="cockpit" className="py-24 px-6 border-t border-border-dark bg-[#070605] relative">
        <div className="max-w-7xl mx-auto">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-6 h-px bg-primary" />
                <span className="text-[11px] font-mono tracking-[0.22em] text-primary uppercase">
                  03 / TELEMETRIA OPERACIONAL
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
                CONTROLE TOTAL DA BANCADA.<br />
                <span className="text-primary italic font-serif">Sem papéis, sem planilhas, sem atrito.</span>
              </h2>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm max-w-md leading-relaxed font-normal">
              Painel desenvolvido para proprietários, gerentes e profissionais dominarem o fluxo de atendimento em uma única tela de alta densidade.
            </p>
          </div>

          {/* MOCKUP INTERATIVO DO COCKPIT */}
          <ScrollReveal delay={150}>
            <div className="rounded-2xl border border-border-dark bg-night shadow-2xl overflow-hidden">

              {/* Barra Superior do Cockpit */}
              <div className="bg-card-dark px-6 py-4 border-b border-border-dark flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full bg-red-500/80" />
                    <span className="size-3 rounded-full bg-amber-500/80" />
                    <span className="size-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-300 pl-2 border-l border-border-dark">
                    ATELIER SANCHEZ — UNIDADE PRINCIPAL
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    SUPABASE REALTIME ATIVO
                  </span>
                  <span className="text-slate-400">06 DE NOVEMBRO</span>
                </div>
              </div>

              {/* Faixa de Indicadores de Produção */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border-dark">
                <div className="bg-night p-5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">FATURAMENTO DO DIA</p>
                  <p className="text-2xl font-black text-white mt-1">R$ 4.850,00</p>
                  <p className="text-[11px] text-emerald-400 mt-1 font-medium">28 atendimentos concluídos</p>
                </div>
                <div className="bg-night p-5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">TAXA DE OCUPAÇÃO</p>
                  <p className="text-2xl font-black text-primary mt-1">94%</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Capacidade máxima da bancada</p>
                </div>
                <div className="bg-night p-5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">TICKET MÉDIO</p>
                  <p className="text-2xl font-black text-white mt-1">R$ 173,20</p>
                  <p className="text-[11px] text-emerald-400 mt-1 font-medium">Venda cruzada de produtos ativa</p>
                </div>
                <div className="bg-night p-5">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">CLUBE DOS CHEFES</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">142 Assinantes</p>
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">Faturamento mensal previsível</p>
                </div>
              </div>

              {/* Cadeiras em Atendimento e Comanda Aberta */}
              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-card-dark/40">

                {/* Coluna 1-8: Timeline de Cadeiras com Chips Atelier */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border-dark">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      BANCADAS EM ATENDIMENTO
                    </span>
                    <span className="text-[10px] font-mono font-semibold text-primary">3 barbeiros ativos</span>
                  </div>

                  <div className="space-y-3">

                    {/* Cadeira 01 */}
                    <div className="bg-card-dark p-4 rounded-xl border border-border-dark flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg flex items-center justify-center font-black text-night text-xs" style={{ backgroundColor: '#C98A1F' }}>
                          GB
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">Guilherme Bastos</p>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              CADEIRA 01
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">Cliente: Rodrigo Sanches — Corte Degradê Navalhado + Barboterapia</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-black text-primary">R$ 160,00</span>
                        <p className="text-[10px] text-emerald-400 font-medium">Em finalização (35 min)</p>
                      </div>
                    </div>

                    {/* Cadeira 02 */}
                    <div className="bg-card-dark p-4 rounded-xl border border-border-dark flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg flex items-center justify-center font-black text-night text-xs" style={{ backgroundColor: '#10B981' }}>
                          MS
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">Mateus Silva</p>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              CADEIRA 02
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">Cliente: Bruno Alcantara — Alinhamento Clássico de Barba (Membro Gold)</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-black text-amber-400">PLANO CLUBE</span>
                        <p className="text-[10px] text-slate-400 font-medium">Em andamento (15 min)</p>
                      </div>
                    </div>

                    {/* Cadeira 03 */}
                    <div className="bg-card-dark p-4 rounded-xl border border-border-dark flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg flex items-center justify-center font-black text-night text-xs" style={{ backgroundColor: '#F59E0B' }}>
                          RO
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white">Rafael Oliveira</p>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary-light border border-primary/20">
                              CADEIRA 03
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">Cliente: Eduardo Lima — Combo Chef + Pomada Matte</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-black text-primary">R$ 215,00</span>
                        <p className="text-[10px] text-slate-400 font-medium">Em andamento (20 min)</p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Coluna 9-12: Comanda Aberta */}
                <div className="lg:col-span-4 bg-night p-5 rounded-xl border border-border-dark flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-border-dark">
                      <span className="text-xs font-mono font-bold text-white">COMANDA #1042</span>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        EM ATENDIMENTO
                      </span>
                    </div>

                    <div className="py-3 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>Corte Degradê Navalhado</span>
                        <span className="font-semibold text-white font-mono">R$ 90,00</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Barboterapia com Toalha Quente</span>
                        <span className="font-semibold text-white font-mono">R$ 70,00</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Pomada Matte Efeito Seco</span>
                        <span className="font-semibold text-white font-mono">R$ 55,00</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border-dark text-xs space-y-1.5 font-mono">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal</span>
                        <span>R$ 215,00</span>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-semibold">
                        <span>Rateio da Bancada</span>
                        <span>R$ 88,00</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-white pt-1">
                        <span>Margem da Casa</span>
                        <span className="text-primary font-black">R$ 127,00</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border-dark">
                    <div className="w-full py-2.5 rounded-lg bg-primary/15 text-primary-light border border-primary/30 text-center text-[11px] font-mono font-bold">
                      AUDITORIA CANÔNICA ADR-001 ATIVA
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </ScrollReveal>

        </div>
      </section>

      {/* ═══ SEÇÃO 04: CLUBE DOS CHEFES (RECORRÊNCIA E PREVISIBILIDADE) ═══ */}
      <section id="clube" className="py-24 lg:py-36 px-6 relative border-t border-border-dark bg-[#080706]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-6 h-px bg-primary" />
                <span className="text-[11px] font-mono tracking-[0.22em] text-primary uppercase">
                  04 / MOTOR DE RECORRÊNCIA (MRR)
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-6 font-display">
                CLUBE DOS CHEFES.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
                  RECEITA PREVISÍVEL NO PRIMEIRO DIA DO MÊS.
                </span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                Converta clientes esporádicos em assinantes fiéis com cobranças automáticas no cartão de crédito. O Clube dos Chefes gerencia limites mensais de serviços, cortesias e controle de saldo sem desestruturar o fluxo de caixa.
              </p>

              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="size-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/30">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Estabilidade Financeira no Início do Mês</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Receita recorrente garantida para custear aluguel e despesas fixas, blindando a barbearia contra períodos de chuva e feriados prolongados.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="size-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/30">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Débito Transparente na Comanda</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Ao atender o assinante, a comanda debita a sessão do plano instantaneamente e calcula a comissão correspondente do profissional sem fricção.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="size-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/30">
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Agendamento Prioritário pelo Celular</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      O membro acessa o link direto da barbearia, consulta os horários livres do barbeiro de sua preferência e confirma o agendamento em segundos.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Níveis de Membro Ilustrativos */}
            <div className="lg:col-span-6 space-y-4">
              <ScrollReveal delay={100}>
                <div className="bg-card-dark/80 backdrop-blur-md border border-border-dark p-6 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-11 rounded-lg bg-surface-dark border border-border-dark flex items-center justify-center text-slate-300">
                      <span className="material-symbols-outlined text-2xl">shield</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">NÍVEL 01</span>
                      <h3 className="text-base font-bold text-white">Plano Clássico</h3>
                      <p className="text-xs text-slate-400">Cortes de cabelo regulares com frequência quinzenal ou mensal</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-wider bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-md">
                    RECORRÊNCIA
                  </span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={200}>
                <div className="bg-card-dark/90 backdrop-blur-md border border-primary/50 p-6 rounded-xl flex items-center justify-between shadow-smg-glow/20">
                  <div className="flex items-center gap-4">
                    <div className="size-11 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-primary uppercase">NÍVEL 02 · MAIS ESCOLHIDO</span>
                      <h3 className="text-base font-bold text-white">Plano Gentleman</h3>
                      <p className="text-xs text-slate-300">Cabelo alinhado, barba completa e bebida cortesia a cada atendimento</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black text-night uppercase tracking-wider bg-primary px-3 py-1.5 rounded-md">
                    VIP CLUB
                  </span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={300}>
                <div className="bg-card-dark/80 backdrop-blur-md border border-border-dark p-6 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-11 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <span className="material-symbols-outlined text-2xl">diamond</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase">NÍVEL 03</span>
                      <h3 className="text-base font-bold text-white">Black Chef Exclusive</h3>
                      <p className="text-xs text-slate-400">Experiência completa ilimitada, desconto em produtos e prioridade na bancada</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md">
                    ATELIER TOP
                  </span>
                </div>
              </ScrollReveal>
            </div>

          </div>
        </div>
      </section>

      {/* ═══ SEÇÃO 05: IA PREDITIVA COM O CÉREBRO NEURAL (BEM MAIOR E SEM CAIXA) ═══ */}
      <section id="ia" className="py-24 lg:py-36 px-6 relative border-t border-border-dark bg-[#070605]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            {/* Imagem do Cérebro Neural em Destaque Massivo (Sem Moldura) */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/15 blur-[150px] pointer-events-none rounded-full -z-10" />
              <ScrollReveal delay={100} className="w-full flex items-center justify-center">
                <img
                  src="/branding/smg-ai-brain-barber.png"
                  alt="Inteligência Artificial Preditiva SMG Barber"
                  className="w-full max-w-[620px] lg:max-w-[720px] h-auto object-contain drop-shadow-[0_0_60px_rgba(217,154,43,0.38)] hover:scale-105 transition-transform duration-700 ease-out cursor-pointer"
                />
              </ScrollReveal>
            </div>

            {/* Texto Descritivo */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-6 h-px bg-primary" />
                <span className="text-[11px] font-mono tracking-[0.22em] text-primary uppercase">
                  05 / INTELIGÊNCIA ARTIFICIAL PREDITIVA
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-6 font-display">
                DADOS QUE ANTECIPAM DECISÕES.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
                  MENOS PALPITES, MAIS LUCRO.
                </span>
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8">
                Com o SMG Barber Intelligence, sua barbearia para de operar no escuro. Nossos algoritmos preditivos analisam o intervalo histórico de agendamentos e alertam sobre clientes em risco de esquecimento, maximizando a taxa de ocupação das bancadas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-card-dark/80 border border-border-dark">
                  <div className="flex items-center gap-2.5 text-primary mb-2.5">
                    <span className="material-symbols-outlined text-xl">restore</span>
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">MOTOR DE RETORNO</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Identifica automaticamente clientes que ultrapassaram o ciclo médio de retorno e programa disparos pontuais no momento propício.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-card-dark/80 border border-border-dark">
                  <div className="flex items-center gap-2.5 text-primary mb-2.5">
                    <span className="material-symbols-outlined text-xl">query_stats</span>
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">OCUPAÇÃO DE BANCADA</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mapeia janelas ociosas na grade semanal dos profissionais e orienta ações estratégicas para evitar horários vazios na cadeira.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══ SEÇÃO 06: DEMONSTRAÇÃO & MATURIDADE OPERACIONAL ═══ */}
      <section id="planos" className="py-24 lg:py-36 px-6 relative border-t border-border-dark bg-[#080706]">
        <div className="max-w-7xl mx-auto">

          <div className="text-center max-w-3xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="w-6 h-px bg-primary" />
              <span className="text-[11px] font-mono tracking-[0.22em] text-primary uppercase">
                06 / MATURIDADE OPERACIONAL & DEMONSTRAÇÃO
              </span>
              <span className="w-6 h-px bg-primary" />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4 font-display">
              MATURIDADE OPERACIONAL.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
                A ESCOLHA EXATA PARA SEU MOMENTO.
              </span>
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
              Não trabalhamos com pacotes engessados de prateleira. A tecnologia SMG Barber é dimensionada para a escala de cadeiras e o modelo de negócio da sua barbearia. Agende uma demonstração guiada e experimente ao vivo antes de qualquer decisão.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-14">
            {MATURITY_PLANS.map((plan, index) => (
              <ScrollReveal key={plan.name} delay={index * 150}>
                <div
                  className={`flex flex-col p-8 sm:p-10 rounded-2xl relative transition-all duration-300 h-full ${
                    plan.highlight
                      ? 'bg-gradient-to-b from-card-dark to-[#070605] border-2 border-primary/60 shadow-2xl shadow-primary/10'
                      : 'bg-card-dark/80 border border-border-dark'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-night text-[10px] font-mono font-black uppercase tracking-widest rounded-full shadow-lg">
                      {plan.badge}
                    </span>
                  )}

                  <div className="mb-6">
                    <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold">
                      {plan.code}
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

                  <button
                    type="button"
                    onClick={() => openDemoBooking(plan.name)}
                    className={`w-full py-4 rounded-xl font-mono font-bold text-xs uppercase tracking-widest text-center transition-all cursor-pointer ${
                      plan.highlight
                        ? 'bg-primary hover:bg-primary-light text-night shadow-smg-glow hover:-translate-y-0.5'
                        : 'bg-surface-dark hover:bg-card-dark text-white border border-border-dark hover:border-primary/50'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* Faixa Explicativa de Construção de Valor */}
          <div className="bg-[#0D0B09] border border-border-dark rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">verified</span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
                  POR QUE NÃO COLOCAMOS VALORES NA PRATELEIRA?
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Cada barbearia opera com uma dinâmica própria de profissionais, comissões e recorrência. Na demonstração guiada, configuramos um ambiente com os seus dados para você comprovar o ganho de produtividade e a economia gerada antes de receber sua proposta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openDemoBooking()}
              className="px-6 py-3.5 bg-primary/10 hover:bg-primary/20 border border-primary/50 hover:border-primary text-primary hover:text-white font-mono text-xs font-bold uppercase tracking-wider rounded-xl transition-all shrink-0 cursor-pointer"
            >
              AGENDAR DEMONSTRAÇÃO
            </button>
          </div>

        </div>
      </section>

      {/* ═══ SEÇÃO 07: ECOSSISTEMA SMG INTELLIGENCE ═══ */}
      <section className="py-20 px-6 border-t border-border-dark bg-[#070605]">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-card-dark to-[#0B0907] border border-border-dark rounded-2xl p-8 sm:p-12 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="max-w-2xl">
              <span className="text-[10px] font-mono tracking-widest text-primary uppercase block mb-2 font-bold">
                SUÍTE SMG INTELLIGENCE
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-4 font-display">
                Tecnologia corporativa para negócios de serviços de alto valor.
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Além do <strong>SMG Barber Intelligence</strong>, nosso ecossistema integra a vertical <strong>Auto Control</strong> (gestão automotiva de alta precisão) e o <strong>Portal Unificado</strong> de agendamentos e membros.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
              <Link
                to="/portal"
                className="px-6 py-3.5 bg-card-dark hover:bg-surface-dark border border-border-dark text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all text-center flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base text-primary">hub</span>
                <span>ACESSAR PORTAL</span>
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 bg-primary hover:bg-primary-light text-night text-xs font-mono font-black uppercase tracking-wider rounded-xl transition-all text-center shadow-smg-glow flex items-center justify-center gap-2"
              >
                <span>ACESSAR BARBEARIA</span>
                <span className="material-symbols-outlined text-base">login</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ RODAPÉ TÉCNICO ATELIER ═══ */}
      <footer className="bg-[#050403] border-t border-border-dark py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-border-dark">

            <div className="md:col-span-5">
              <div className="mb-5">
                <img
                  src="/branding/smg-barber-intelligence-logo.png"
                  alt="SMG Barber Intelligence"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-sm mb-6">
                Tecnologia, governança contábil e recorrência concebidas para barbearias e ateliers que operam no mais alto nível do mercado.
              </p>
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>PLATAFORMA OPERACIONAL ATIVA</span>
              </div>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-white">NAVEGAÇÃO</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#solucoes" className="hover:text-primary transition-colors">Sistema Operacional</a></li>
                <li><a href="#arquitetura" className="hover:text-primary transition-colors">Arquitetura de Camadas</a></li>
                <li><a href="#cockpit" className="hover:text-primary transition-colors">Cockpit de Bancada</a></li>
                <li><a href="#clube" className="hover:text-primary transition-colors">Clube dos Chefes</a></li>
                <li><a href="#ia" className="hover:text-primary transition-colors">IA Preditiva</a></li>
                <li><a href="#planos" className="hover:text-primary transition-colors">Planos de Implantação</a></li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-mono font-bold uppercase tracking-widest text-white">CONTATO EXECUTIVO</p>
              <div className="space-y-2 text-xs text-slate-400">
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">chat</span>
                  <span>WhatsApp: (11) 98207-3536</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">mail</span>
                  <span>sanches.augusto@outlook.com</span>
                </p>
                <p className="text-[11px] text-slate-400 pt-2 leading-relaxed">
                  Atendimento especializado para proprietários e gestores de barbearias em todo o Brasil.
                </p>
              </div>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
            <p>© {new Date().getFullYear()} SMG INTELLIGENCE. TODOS OS DIREITOS RESERVADOS.</p>
            <div className="flex items-center gap-6">
              <Link to="/portal" className="hover:text-primary transition-colors">PORTAL DO CLIENTE</Link>
              <Link to="/login" className="hover:text-primary transition-colors">ACESSO RESTRITO</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Widget Interativo de Atendimento Pré-Venda */}
      <LandingSupportWidget />

      {/* Modal Interativo de Agendamento de Demonstração */}
      <DemoBookingModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        initialPlan={selectedDemoPlan}
      />
    </div>
  );
};

export default Landing;
