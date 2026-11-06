import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingSupportWidget from '../components/LandingSupportWidget';

/**
 * Player de Sequência de Frames (Canvas 24fps)
 * Renderiza os 40 quadros 3D da pasta /Loop em ciclo suave e contínuo.
 */
const FrameSequencePlayer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedPercent, setLoadedPercent] = useState<number>(0);

  useEffect(() => {
    let animationFrameId: number;
    let isMounted = true;
    const totalFrames = 40;
    const images: HTMLImageElement[] = [];
    let loadedCount = 0;
    let currentFrame = 0;
    let lastTime = 0;
    const fps = 24;
    const interval = 1000 / fps;

    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const frameNum = String(i).padStart(3, '0');
      img.src = `/Loop/ezgif-frame-${frameNum}.png`;
      img.onload = () => {
        if (!isMounted) return;
        loadedCount++;
        setLoadedPercent(Math.round((loadedCount / totalFrames) * 100));
        if (loadedCount === 1 && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      };
      images.push(img);
    }

    const render = (time: number) => {
      if (!isMounted) return;
      if (time - lastTime >= interval) {
        lastTime = time;
        const canvas = canvasRef.current;
        if (canvas && images[currentFrame] && images[currentFrame].complete) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(images[currentFrame], 0, 0, canvas.width, canvas.height);
          }
          currentFrame = (currentFrame + 1) % totalFrames;
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative w-full max-w-3xl lg:max-w-4xl mx-auto aspect-video flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-contain drop-shadow-[0_0_60px_rgba(217,154,43,0.32)]"
      />
      {loadedPercent < 100 && (
        <div className="absolute bottom-2 right-4 text-[10px] font-code-mono text-slate-500 tracking-widest">
          CARREGANDO {loadedPercent}%
        </div>
      )}
    </div>
  );
};

/**
 * Componente de revelação fluida ativado pelo scroll do mouse.
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
        rootMargin: '0px 0px -40px 0px',
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
          : 'opacity-0 translate-y-12 scale-95'
      } ${className}`}
    >
      {children}
    </div>
  );
};

const NAV_LINKS = [
  { label: 'SISTEMA', href: '#conteudo' },
  { label: 'ARQUITETURA', href: '#arquitetura' },
  { label: 'COCKPIT', href: '#cockpit' },
  { label: 'CLUBE', href: '#clube' },
  { label: 'PLANOS', href: '#planos' },
];

const ARCHITECTURE_CALLOUTS = [
  {
    id: '01',
    side: 'left',
    tag: '// 01 · OPERACIONAL',
    title: 'Cockpit de Bancada',
    desc: 'Agenda multiprofissional em tempo real, fila dinâmica de cadeiras e comandas ágeis.',
  },
  {
    id: '02',
    side: 'left',
    tag: '// 02 · GOVERNANÇA',
    title: 'Fechamento Canônico',
    desc: 'Conferência cega de caixa, sangria, suprimento e rateio de comissão auditável (ADR-001).',
  },
  {
    id: '03',
    side: 'right',
    tag: '// 03 · RECORRÊNCIA',
    title: 'Clube dos Chefes',
    desc: 'Assinaturas mensais no cartão com baixa automática de créditos diretamente na comanda.',
  },
  {
    id: '04',
    side: 'right',
    tag: '// 04 · INTELIGÊNCIA',
    title: 'IA Preditiva Gemini',
    desc: 'Diagnóstico contínuo de retenção, motor inteligente de retorno e ocupação da bancada.',
  },
];

const MATURITY_PLANS = [
  {
    code: 'PLANO 01',
    name: 'Operação Essencial',
    badge: 'ESTRUTURAÇÃO',
    desc: 'Para barbearias que desejam profissionalizar o atendimento, eliminar comandas de papel e controlar o caixa com segurança.',
    features: [
      'Agenda multiprofissional com visão diária e semanal em tempo real',
      'Ponto de Venda (PDV) ágil integrado a comandas digitais',
      'Cadastro detalhado e histórico completo de consumo dos clientes',
      'Controle de estoque de produtos e insumos de bancada',
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

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);

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

  const handleExploreClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById('conteudo');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#060504] text-white font-sans selection:bg-primary/30 relative overflow-x-hidden">

      {/* Grid técnico no fundo */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] -z-10"
        style={{
          backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ═══ NAVBAR TELEMETRIA ATELIER ═══ */}
      <nav
        className={`fixed w-full top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#060504]/95 backdrop-blur-xl border-b border-border-dark py-3 shadow-2xl'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">

          {/* Logotipo Oficial */}
          <Link to="/" className="flex items-center group">
            <img
              src="/branding/smg-barber-intelligence-logo.png"
              alt="SMG Barber Intelligence"
              className="h-8 sm:h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Navegação Central com Tipografia Técnica Code Pro */}
          <div className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href, link.label)}
                className={`text-[11px] font-code-mono tracking-[0.2em] transition-colors relative py-1.5 ${
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

          {/* Ações */}
          <div className="flex items-center gap-3">
            <Link
              to="/portal"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-code-mono tracking-widest text-slate-400 hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-card-dark border border-transparent hover:border-border-dark"
            >
              <span className="material-symbols-outlined text-sm text-primary">hub</span>
              PORTAL
            </Link>
            <Link
              to="/login"
              className="text-[11px] font-code-mono tracking-widest text-slate-300 hover:text-white transition-colors px-3 py-2"
            >
              ENTRAR
            </Link>
            <a
              href="https://wa.me/5511978496799?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20guiada%20do%20SMG%20Barber%20Intelligence."
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-primary hover:bg-primary-light text-night text-[11px] font-code-mono font-bold tracking-widest uppercase rounded-lg transition-all shadow-smg-glow hover:-translate-y-0.5 flex items-center gap-1.5"
            >
              <span>DEMO</span>
              <span className="material-symbols-outlined text-xs font-black">arrow_forward</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ═══ HERO SECTION: SEQUÊNCIA 3D EM LOOP + BOTÃO EXPLORAR ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-12 px-6 overflow-hidden">

        {/* Brilho atmosférico central */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-primary/10 blur-[160px] pointer-events-none rounded-full -z-10" />

        <div className="max-w-5xl mx-auto w-full text-center flex flex-col items-center justify-center my-auto">

          {/* Eyebrow Code Pro Light */}
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-6 h-px bg-primary" />
            <span className="text-[11px] font-code-mono tracking-[0.25em] text-primary uppercase">
              SMG BARBER INTELLIGENCE
            </span>
            <span className="w-6 h-px bg-primary" />
          </div>

          {/* Tipografia Code Pro: LIGHT + BOLD */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.08] mb-3">
            <span className="font-code-light block text-slate-300">ALÉM DO CORTE.</span>
            <span className="font-code-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
              GESTÃO INTELIGENTE
            </span>
            <span className="text-primary font-code-bold">.</span>
          </h1>

          {/* PLAYER EM LOOP 3D DOS 40 FRAMES */}
          <div className="w-full my-2 sm:my-4">
            <FrameSequencePlayer />
          </div>

          {/* O BOTÃO EXPLORAR EM DESTAQUE */}
          <div className="mt-2 flex flex-col items-center gap-3">
            <a
              href="#conteudo"
              onClick={handleExploreClick}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary-light text-night font-code-mono font-bold text-xs uppercase tracking-[0.25em] rounded-lg transition-all shadow-smg-glow hover:-translate-y-1 cursor-pointer"
            >
              <span>EXPLORAR...</span>
              <span className="material-symbols-outlined text-sm font-black transition-transform duration-300 group-hover:translate-y-1">
                arrow_downward
              </span>
            </a>
            <p className="text-[11px] font-code-mono tracking-widest text-slate-400">
              CLIQUE PARA CONHECER A PLATAFORMA
            </p>
          </div>

        </div>

        {/* Telemetria de Rodapé da Seção */}
        <div className="max-w-7xl mx-auto w-full pt-6 mt-8 border-t border-border-dark grid grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          <div>
            <p className="text-[10px] font-code-mono tracking-[0.2em] uppercase text-slate-400">SEGURANÇA</p>
            <p className="text-sm font-bold text-white mt-0.5">Multi-Tenant RLS</p>
          </div>
          <div>
            <p className="text-[10px] font-code-mono tracking-[0.2em] uppercase text-slate-400">GOVERNANÇA</p>
            <p className="text-sm font-bold text-white mt-0.5">Norma ADR-001</p>
          </div>
          <div>
            <p className="text-[10px] font-code-mono tracking-[0.2em] uppercase text-slate-400">RECORRÊNCIA</p>
            <p className="text-sm font-bold text-white mt-0.5">Clube dos Chefes</p>
          </div>
          <div>
            <p className="text-[10px] font-code-mono tracking-[0.2em] uppercase text-slate-400">LATÊNCIA</p>
            <p className="text-sm font-bold text-emerald-400 mt-0.5">Tempo Real</p>
          </div>
        </div>

      </section>

      {/* ═══ CONTEÚDO PRINCIPAL (REDUZIDO, DIRETO E ELEGANTE) ═══ */}
      <div id="conteudo">

        {/* ═══ SEÇÃO: ARQUITETURA EM 4 CAMADAS ═══ */}
        <section id="arquitetura" className="py-24 lg:py-32 px-6 relative border-t border-border-dark bg-[#070605]">
          <div className="max-w-7xl mx-auto">

            <div className="mb-16 text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-5 h-px bg-primary" />
                <span className="text-[10px] font-code-mono tracking-[0.2em] text-primary uppercase">
                  ARQUITETURA DO SISTEMA
                </span>
                <span className="w-5 h-px bg-primary" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-code-bold text-white tracking-tight mb-3">
                UMA PLATAFORMA. QUATRO CAMADAS.
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-code-reg">
                Módulos integrados sem atrito operacional entre a recepção e a bancada.
              </p>
            </div>

            {/* CHIP EXPLODIDO NO CENTRO COM CALLOUTS LATERAIS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

              {/* Esquerda */}
              <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
                {ARCHITECTURE_CALLOUTS.filter(c => c.side === 'left').map(item => (
                  <ScrollReveal key={item.id} delay={100}>
                    <div className="p-5 rounded-xl bg-card-dark/80 border border-border-dark hover:border-primary/50 transition-all">
                      <p className="text-[10px] font-code-mono tracking-widest text-primary mb-1">{item.tag}</p>
                      <h3 className="text-base font-bold text-white mb-1.5">{item.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

              {/* Centro: Chip em Camadas */}
              <div className="lg:col-span-6 relative flex items-center justify-center order-1 lg:order-2">
                <div className="absolute inset-0 bg-primary/10 blur-[130px] pointer-events-none rounded-full -z-10" />
                <ScrollReveal delay={150} className="w-full flex items-center justify-center">
                  <img
                    src="/branding/smg-layered-architecture.png"
                    alt="Arquitetura de Camadas SMG Barber"
                    className="w-full max-w-[500px] lg:max-w-[560px] h-auto object-contain drop-shadow-[0_0_50px_rgba(217,154,43,0.35)] hover:scale-105 transition-transform duration-700 ease-out"
                  />
                </ScrollReveal>
              </div>

              {/* Direita */}
              <div className="lg:col-span-3 space-y-6 order-3">
                {ARCHITECTURE_CALLOUTS.filter(c => c.side === 'right').map(item => (
                  <ScrollReveal key={item.id} delay={200}>
                    <div className="p-5 rounded-xl bg-card-dark/80 border border-border-dark hover:border-primary/50 transition-all">
                      <p className="text-[10px] font-code-mono tracking-widest text-primary mb-1">{item.tag}</p>
                      <h3 className="text-base font-bold text-white mb-1.5">{item.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>

            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: COCKPIT OPERACIONAL (SIMPLIFICADO) ═══ */}
        <section id="cockpit" className="py-20 px-6 border-t border-border-dark bg-[#060504]">
          <div className="max-w-7xl mx-auto">

            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-[10px] font-code-mono tracking-[0.2em] text-primary uppercase block mb-1">
                  COCKPIT EM TEMPO REAL
                </span>
                <h2 className="text-2xl sm:text-3xl font-code-bold text-white tracking-tight">
                  CONTROLE TOTAL DA BANCADA.
                </h2>
              </div>
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed">
                Agenda, fila de cadeiras e comandas unificadas para dono, gerente e equipe.
              </p>
            </div>

            <ScrollReveal delay={100}>
              <div className="rounded-xl border border-border-dark bg-night overflow-hidden shadow-2xl">

                {/* Topbar */}
                <div className="bg-card-dark px-5 py-3 border-b border-border-dark flex items-center justify-between text-xs font-code-mono">
                  <span className="text-slate-300 font-bold">ATELIER SANCHEZ — UNIDADE PRINCIPAL</span>
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    TEMPO REAL ATIVO
                  </span>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border-dark text-left">
                  <div className="bg-night p-4">
                    <p className="text-[10px] font-code-mono text-slate-400 uppercase">FATURAMENTO HOJE</p>
                    <p className="text-xl font-bold text-white mt-0.5">R$ 4.850,00</p>
                  </div>
                  <div className="bg-night p-4">
                    <p className="text-[10px] font-code-mono text-slate-400 uppercase">OCUPAÇÃO</p>
                    <p className="text-xl font-bold text-primary mt-0.5">94%</p>
                  </div>
                  <div className="bg-night p-4">
                    <p className="text-[10px] font-code-mono text-slate-400 uppercase">TICKET MÉDIO</p>
                    <p className="text-xl font-bold text-white mt-0.5">R$ 173,20</p>
                  </div>
                  <div className="bg-night p-4">
                    <p className="text-[10px] font-code-mono text-slate-400 uppercase">CLUBE DOS CHEFES</p>
                    <p className="text-xl font-bold text-amber-400 mt-0.5">142 Membros</p>
                  </div>
                </div>

                {/* Cadeiras e Comanda */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-card-dark/30">

                  <div className="lg:col-span-8 space-y-2.5">
                    <div className="bg-card-dark p-3.5 rounded-lg border border-border-dark flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg flex items-center justify-center font-bold text-night text-xs" style={{ backgroundColor: '#C98A1F' }}>
                          GB
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Guilherme Bastos · Cadeira 01</p>
                          <p className="text-[11px] text-slate-300">Corte Degradê Navalhado + Barboterapia</p>
                        </div>
                      </div>
                      <span className="text-xs font-code-mono font-bold text-primary">R$ 160,00</span>
                    </div>

                    <div className="bg-card-dark p-3.5 rounded-lg border border-border-dark flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg flex items-center justify-center font-bold text-night text-xs" style={{ backgroundColor: '#10B981' }}>
                          MS
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Mateus Silva · Cadeira 02</p>
                          <p className="text-[11px] text-slate-300">Alinhamento Clássico (Membro Gold)</p>
                        </div>
                      </div>
                      <span className="text-xs font-code-mono font-bold text-amber-400">PLANO CLUBE</span>
                    </div>

                    <div className="bg-card-dark p-3.5 rounded-lg border border-border-dark flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg flex items-center justify-center font-bold text-night text-xs" style={{ backgroundColor: '#F59E0B' }}>
                          RO
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Rafael Oliveira · Cadeira 03</p>
                          <p className="text-[11px] text-slate-300">Combo Chef + Pomada Matte Efeito Seco</p>
                        </div>
                      </div>
                      <span className="text-xs font-code-mono font-bold text-primary">R$ 215,00</span>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-night p-4 rounded-lg border border-border-dark flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center pb-2 border-b border-border-dark text-xs font-code-mono">
                        <span className="font-bold text-white">COMANDA #1042</span>
                        <span className="text-primary">EM ATENDIMENTO</span>
                      </div>
                      <div className="py-2.5 space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span>Corte Degradê</span>
                          <span className="text-white">R$ 90,00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Barboterapia</span>
                          <span className="text-white">R$ 70,00</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pomada Matte</span>
                          <span className="text-white">R$ 55,00</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border-dark flex justify-between text-xs font-code-mono font-bold">
                      <span className="text-slate-400">Total</span>
                      <span className="text-primary">R$ 215,00</span>
                    </div>
                  </div>

                </div>

              </div>
            </ScrollReveal>

          </div>
        </section>

        {/* ═══ SEÇÃO: CLUBE DOS CHEFES (RECORRÊNCIA MRR) ═══ */}
        <section id="clube" className="py-20 lg:py-28 px-6 border-t border-border-dark bg-[#070605]">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

            <div className="lg:col-span-6">
              <span className="text-[10px] font-code-mono tracking-[0.2em] text-primary uppercase block mb-2">
                MOTOR DE RECORRÊNCIA
              </span>
              <h2 className="text-3xl sm:text-4xl font-code-bold text-white tracking-tight mb-4">
                CLUBE DOS CHEFES. RECEITA PREVISÍVEL.
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6 font-code-reg">
                Assinaturas recorrentes no cartão com baixa automática diretamente na comanda, gerando fluxo financeiro garantido no início de cada mês.
              </p>

              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span>Cobrança mensal automatizada no cartão de crédito</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span>Controle de saldo de cortes e serviços na comanda</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span>Agendamento VIP pelo próprio celular do cliente</span>
                </div>
              </div>
            </div>

            {/* 3 Níveis de Membro em Cards Enxutos */}
            <div className="lg:col-span-6 space-y-3">
              <div className="p-4 rounded-lg bg-card-dark border border-border-dark flex items-center justify-between text-xs">
                <div>
                  <p className="font-code-mono text-[10px] text-slate-400">NÍVEL 01</p>
                  <p className="font-bold text-white">Plano Clássico</p>
                  <p className="text-slate-400 text-[11px]">Cortes programados no mês</p>
                </div>
                <span className="font-code-mono text-[10px] text-primary border border-primary/30 px-2.5 py-1 rounded">RECORRÊNCIA</span>
              </div>

              <div className="p-4 rounded-lg bg-card-dark border border-primary/50 flex items-center justify-between text-xs shadow-smg-glow/20">
                <div>
                  <p className="font-code-mono text-[10px] text-primary">NÍVEL 02 · MAIS ESCOLHIDO</p>
                  <p className="font-bold text-white">Plano Gentleman</p>
                  <p className="text-slate-300 text-[11px]">Corte + Barba + Bebida Cortesia</p>
                </div>
                <span className="font-code-mono text-[10px] bg-primary text-night font-bold px-2.5 py-1 rounded">VIP CLUB</span>
              </div>

              <div className="p-4 rounded-lg bg-card-dark border border-border-dark flex items-center justify-between text-xs">
                <div>
                  <p className="font-code-mono text-[10px] text-amber-400">NÍVEL 03</p>
                  <p className="font-bold text-white">Black Chef Exclusive</p>
                  <p className="text-slate-400 text-[11px]">Experiência ilimitada na bancada</p>
                </div>
                <span className="font-code-mono text-[10px] text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded">ATELIER TOP</span>
              </div>
            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: PLANOS POR MATURIDADE OPERACIONAL ═══ */}
        <section id="planos" className="py-24 px-6 border-t border-border-dark bg-[#060504]">
          <div className="max-w-7xl mx-auto">

            <div className="text-center max-w-xl mx-auto mb-16">
              <span className="text-[10px] font-code-mono tracking-[0.2em] text-primary uppercase block mb-1">
                PLANOS DE IMPLANTAÇÃO
              </span>
              <h2 className="text-3xl font-code-bold text-white tracking-tight mb-2">
                MATURIDADE OPERACIONAL.
              </h2>
              <p className="text-slate-400 text-xs">
                Estrutura desenhada para cada estágio da sua barbearia.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {MATURITY_PLANS.map((plan, index) => (
                <ScrollReveal key={plan.name} delay={index * 120}>
                  <div
                    className={`flex flex-col p-6 sm:p-8 rounded-xl relative transition-all duration-300 h-full ${
                      plan.highlight
                        ? 'bg-gradient-to-b from-card-dark to-[#060504] border-2 border-primary/60 shadow-xl shadow-primary/10'
                        : 'bg-card-dark/80 border border-border-dark'
                    }`}
                  >
                    {plan.highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-night text-[9px] font-code-mono font-bold uppercase tracking-widest rounded-full">
                        {plan.badge}
                      </span>
                    )}

                    <div className="mb-4">
                      <span className="text-[9px] font-code-mono tracking-widest text-primary uppercase">
                        {plan.code}
                      </span>
                      <h3 className="text-xl font-bold text-white mt-0.5 mb-1.5">{plan.name}</h3>
                      <p className="text-slate-300 text-xs leading-relaxed">{plan.desc}</p>
                    </div>

                    <div className="flex-1 space-y-2.5 my-4 pt-4 border-t border-border-dark">
                      {plan.features.map(feat => (
                        <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-300">
                          <span className="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5">
                            check_circle
                          </span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    <a
                      href={`https://wa.me/5511978496799?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20plano%20${encodeURIComponent(
                        plan.name
                      )}%20do%20SMG%20Barber%20Intelligence.`}
                      target="_blank"
                      rel="noreferrer"
                      className={`w-full py-3.5 rounded-lg font-code-mono font-bold text-xs uppercase tracking-widest text-center transition-all ${
                        plan.highlight
                          ? 'bg-primary hover:bg-primary-light text-night shadow-smg-glow'
                          : 'bg-surface-dark hover:bg-card-dark text-white border border-border-dark hover:border-primary/50'
                      }`}
                    >
                      {plan.cta}
                    </a>
                  </div>
                </ScrollReveal>
              ))}
            </div>

          </div>
        </section>

      </div>

      {/* ═══ RODAPÉ TELEMETRIA ATELIER ═══ */}
      <footer className="bg-[#040302] border-t border-border-dark py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-border-dark">

            <div className="md:col-span-5">
              <div className="mb-4">
                <img
                  src="/branding/smg-barber-intelligence-logo.png"
                  alt="SMG Barber Intelligence"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-sm mb-4 font-code-reg">
                Plataforma de alta precisão para barbearias de elite: agenda multiprofissional, fechamento de caixa auditável e motor de recorrência.
              </p>
              <div className="flex items-center gap-2 text-xs font-code-mono text-slate-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>PLATAFORMA ATIVA</span>
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <p className="text-xs font-code-mono font-bold uppercase tracking-widest text-white">NAVEGAÇÃO</p>
              <ul className="space-y-1.5 text-xs text-slate-400 font-code-reg">
                <li><a href="#conteudo" className="hover:text-primary transition-colors">Sistema Operacional</a></li>
                <li><a href="#arquitetura" className="hover:text-primary transition-colors">Arquitetura em Camadas</a></li>
                <li><a href="#cockpit" className="hover:text-primary transition-colors">Cockpit de Bancada</a></li>
                <li><a href="#clube" className="hover:text-primary transition-colors">Clube dos Chefes</a></li>
                <li><a href="#planos" className="hover:text-primary transition-colors">Planos de Implantação</a></li>
              </ul>
            </div>

            {/* DADOS DE CONTATO OFICIAIS ATUALIZADOS */}
            <div className="md:col-span-4 space-y-2.5">
              <p className="text-xs font-code-mono font-bold uppercase tracking-widest text-white">CONTATO EXECUTIVO</p>
              <div className="space-y-2 text-xs text-slate-300 font-code-mono">
                <a
                  href="https://wa.me/5511978496799"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-sm">chat</span>
                  <span>WhatsApp: +55 11 97849-6799</span>
                </a>
                <a
                  href="mailto:contato@soumanager.com"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-sm">mail</span>
                  <span>contato@soumanager.com</span>
                </a>
                <p className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                  Atendimento direto para donos e gestores de barbearias em todo o Brasil.
                </p>
              </div>
            </div>

          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-code-mono text-slate-400">
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
    </div>
  );
};

export default Landing;
