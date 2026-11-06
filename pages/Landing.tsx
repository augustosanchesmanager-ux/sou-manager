import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LandingSupportWidget from '../components/LandingSupportWidget';

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
    code: '01',
    tag: '// 01 · OPERACIONAL',
    title: 'Cockpit de Bancada',
    desc: 'Agenda multiprofissional em tempo real, fila dinâmica de cadeiras e comandas ágeis.',
  },
  {
    id: '02',
    code: 'ADR',
    tag: '// 02 · GOVERNANÇA',
    title: 'Fechamento Canônico',
    desc: 'Conferência cega de caixa, sangria, suprimento e rateio de comissão auditável (ADR-001).',
  },
  {
    id: '03',
    code: 'MRR',
    tag: '// 03 · RECORRÊNCIA',
    title: 'Clube dos Chefes',
    desc: 'Assinaturas mensais no cartão com baixa automática de créditos diretamente na comanda.',
  },
  {
    id: '04',
    code: 'IA',
    tag: '// 04 · INTELIGÊNCIA',
    title: 'IA Preditiva Gemini',
    desc: 'Diagnóstico contínuo de retenção, motor inteligente de retorno e ocupação da bancada.',
  },
];

/**
 * Componente de Modal Estilo Stockholm (Vidro Fumê Arredondado) com Ignição Elétrica Suave
 */
interface ElectricModalProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const ElectricModal: React.FC<ElectricModalProps> = ({ children, className = '', delay = 0 }) => {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ animationDelay: `${delay}ms` }}
      className={`card-stockholm will-change-transform ${
        active ? 'animate-vulto' : 'opacity-0 -translate-x-28'
      } ${className}`}
    >
      {children}
    </div>
  );
};

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef<number>(0);
  const introFinishedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);

  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('SISTEMA');

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  // Função para desenhar o frame em tela cheia real (estilo cover)
  const drawFrame = (frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = imagesRef.current[frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    if (!canvasWidth || !canvasHeight) return;

    const canvasRatio = canvasWidth / canvasHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    let sWidth = img.naturalWidth;
    let sHeight = img.naturalHeight;
    let sX = 0;
    let sY = 0;

    if (canvasRatio > imgRatio) {
      sHeight = img.naturalWidth / canvasRatio;
      sY = (img.naturalHeight - sHeight) / 2;
    } else {
      sWidth = img.naturalHeight * canvasRatio;
      sX = (img.naturalWidth - sWidth) / 2;
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, sX, sY, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
  };

  // Pré-carregamento dos 41 frames e animação de abertura controlada via requestAnimationFrame
  useEffect(() => {
    isMountedRef.current = true;
    const totalFrames = 41;
    const loadedImages: HTMLImageElement[] = [];

    // Ajusta resolução do canvas de imediato
    if (canvasRef.current) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasRef.current.width = window.innerWidth * dpr;
      canvasRef.current.height = window.innerHeight * dpr;
    }

    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const frameNum = String(i).padStart(3, '0');
      img.src = `/Loop/ezgif-frame-${frameNum}.png`;

      img.onload = () => {
        if (!isMountedRef.current) return;
        // Assim que o frame inicial estiver disponível, desenha imediatamente
        if (i === 1 && currentFrameRef.current === 0) {
          drawFrame(0);
        }
      };

      loadedImages.push(img);
    }
    imagesRef.current = loadedImages;

    // Animação de abertura: avança suavemente a ~12fps do frame 0 ao 40
    let animFrame = 0;
    let lastTime = performance.now();
    const fpsInterval = 1000 / 12; // ~83ms por frame

    const playIntro = (time: number) => {
      if (!isMountedRef.current || introFinishedRef.current) return;

      if (time - lastTime >= fpsInterval) {
        lastTime = time;
        currentFrameRef.current = animFrame;
        drawFrame(animFrame);

        if (animFrame < 40) {
          animFrame++;
        } else {
          // Chegou ao frame 40 (ezgif-frame-041.png) - para estático nele
          introFinishedRef.current = true;
          return;
        }
      }

      requestAnimationFrame(playIntro);
    };

    const animId = requestAnimationFrame(playIntro);

    return () => {
      isMountedRef.current = false;
      cancelAnimationFrame(animId);
    };
  }, []);

  // Redimensionamento do Canvas para Tela Cheia Real
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvasRef.current.width = window.innerWidth * dpr;
        canvasRef.current.height = window.innerHeight * dpr;
        drawFrame(currentFrameRef.current);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Controle da Animação dos Frames através do Scroll do Mouse (Scrubbing contínuo)
  useEffect(() => {
    const handleScroll = () => {
      // Se o usuário rolar a página, a intro inicial é pausada e o scroll assume o controle
      introFinishedRef.current = true;

      const scrollY = window.scrollY;
      setScrolled(scrollY > 80);

      // A cada 24px de rolagem avança 1 frame do loop 3D
      // Inicia no frame 40 (onde a sequência atinge o ápice) e gira continuamente conforme o usuário rola
      const frameOffset = Math.floor(scrollY / 24);
      const targetFrame = (40 + frameOffset) % 41;

      if (targetFrame !== currentFrameRef.current) {
        currentFrameRef.current = targetFrame;
        drawFrame(targetFrame);
      }

      // Atualização de navegação ativa
      const sections = NAV_LINKS.map(link => ({
        id: link.href.substring(1),
        label: link.label,
      }));

      const sectionsToSpy = [...sections].reverse();
      for (const section of sectionsToSpy) {
        const el = document.getElementById(section.id);
        if (el && scrollY >= el.offsetTop - 180) {
          setActiveNav(section.label);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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

      {/* ═══ CANVAS 3D EM TELA CHEIA FIXO (RESPONDE AO SCROLL) ═══ */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
      />

      {/* Vinheta atmosférica suave nas bordas para contraste e profundidade */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(circle at center, transparent 65%, rgba(6,5,4,0.65) 100%)' }}
      />

      {/* ═══ NAVBAR TELEMETRIA (TOTALMENTE OCULTA NO PRIMEIRO MOMENTO, APARECE APENAS AO ROLAR) ═══ */}
      <nav
        className={`fixed w-full top-0 z-50 transition-all duration-700 ease-out ${
          scrolled
            ? 'bg-[#060504]/90 backdrop-blur-xl py-3 shadow-2xl opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-full pointer-events-none'
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

          {/* Navegação Central */}
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
              </a>
            ))}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3">
            <Link
              to="/portal"
              className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-code-mono tracking-widest text-slate-400 hover:text-primary transition-colors py-2 px-3 rounded-lg hover:bg-card-dark"
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

      {/* ═══ TELA CHEIA INICIAL: IMAGEM PURA (SEM LOGO EM CIMA) + MINIMALIST SCROLL INDICATOR ═══ */}
      <section className="relative w-full h-screen flex flex-col justify-end items-center pb-14 px-6 pointer-events-none">

        {/* O BOTÃO EXPLORAR + ÍCONE DE MOUSE MINIMALISTA (STOCKHOLM REFERENCE) */}
        <div className="z-20 flex flex-col items-center gap-4 text-center pointer-events-auto">
          <a
            href="#conteudo"
            onClick={handleExploreClick}
            className="group inline-flex items-center gap-3 px-8 py-3.5 bg-black/40 hover:bg-black/70 backdrop-blur-xl border border-white/15 hover:border-primary/50 text-white font-code-mono text-xs uppercase tracking-[0.25em] rounded-full transition-all shadow-2xl hover:shadow-primary/20 cursor-pointer"
          >
            <span>EXPLORAR SISTEMA</span>
            <span className="material-symbols-outlined text-xs text-primary transition-transform duration-300 group-hover:translate-y-0.5">
              arrow_downward
            </span>
          </a>

          {/* Mouse Outline Minimalista como na referência */}
          <div className="flex flex-col items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
            <div className="w-5 h-8 rounded-full border border-white/30 flex justify-center pt-1.5">
              <div className="w-1 h-2 rounded-full bg-primary animate-bounce" />
            </div>
            <span className="text-[8px] font-code-mono tracking-[0.3em] text-slate-400 uppercase">
              SCROLL
            </span>
          </div>
        </div>

      </section>

      {/* ═══ CONTEÚDO QUE SOBE AO ROLAR O MOUSE (FLANCOS LATERAIS COM CENTRO LIVRE) ═══ */}
      <div id="conteudo" className="relative z-10">

        {/* ═══ BLOCO DE INTRODUÇÃO: FLANCOS LATERAIS COM CENTRO LIVRE PARA O 3D ═══ */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[500px]">

            {/* Flanco Esquerdo: Manifesto Tecnológico */}
            <div className="lg:col-span-5">
              <div className="mb-6">
                <span className="text-[10px] font-code-mono tracking-[0.3em] text-slate-400 uppercase block mb-1">
                  // 01 · NÚCLEO OPERACIONAL
                </span>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-code-light tracking-[0.16em] uppercase text-white flex items-center gap-3">
                  <span>ALÉM DO CORTE</span>
                  <span className="h-px w-10 bg-white/20 inline-block" />
                </h1>
                <p className="text-[11px] font-code-mono tracking-[0.25em] text-primary uppercase mt-1">
                  GESTÃO INTELIGENTE & ATELIER
                </p>
              </div>

              <ElectricModal delay={0} className="p-7">
                <span className="text-[9px] font-code-mono tracking-[0.25em] text-slate-400 uppercase block text-right mb-2">
                  01 · INTEGRADO
                </span>
                <p className="text-4xl font-code-light text-white my-2 tracking-tight">360°</p>
                <h2 className="text-xs font-code-bold tracking-[0.2em] uppercase text-white mb-2">
                  ENGENHARIA DE PRECISÃO
                </h2>
                <p className="text-xs text-slate-300 font-code-reg leading-relaxed mb-6">
                  Engenharia de precisão para barbearias de alto padrão. Agenda multiprofissional em tempo real, fechamento de caixa auditável e motor de recorrência.
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <a
                    href="https://wa.me/5511978496799?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20demonstra%C3%A7%C3%A3o%20guiada%20do%20SMG%20Barber%20Intelligence."
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-primary hover:bg-primary-light text-night text-xs font-code-mono font-bold tracking-widest uppercase rounded-full transition-all shadow-smg-glow"
                  >
                    AGENDAR DEMO
                  </a>
                  <a
                    href="#arquitetura"
                    onClick={(e) => handleNavClick(e, '#arquitetura', 'ARQUITETURA')}
                    className="text-xs font-code-mono text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <span>SISTEMA</span>
                    <span className="text-primary">—</span>
                  </a>
                </div>
              </ElectricModal>
            </div>

            {/* Centro: CORREDOR 100% LIVRE PARA O 3D DA CADEIRA / CHIP */}
            <div className="hidden lg:block lg:col-span-3 pointer-events-none" />

            {/* Flanco Direito: Modais com Ignição Elétrica */}
            <div className="lg:col-span-4 space-y-4">
              <ElectricModal delay={100} className="p-6">
                <div className="flex items-center justify-between text-[9px] font-code-mono text-slate-400 mb-2">
                  <span>DISPONIBILIDADE</span>
                  <span className="text-emerald-400 font-bold">99.8% UPTIME</span>
                </div>
                <p className="text-3xl font-code-light text-white my-1">60 FPS</p>
                <p className="text-xs font-code-bold tracking-widest uppercase text-white mb-1">
                  OPERAÇÃO EM TEMPO REAL
                </p>
                <p className="text-[11px] text-slate-400 font-code-reg">
                  Sincronização instantânea e contínua entre recepção e bancada.
                </p>
                <div className="border-t border-white/5 pt-3 mt-3 text-[9px] font-code-mono text-slate-400 uppercase tracking-widest">
                  TELEMETRIA ATIVA —
                </div>
              </ElectricModal>

              <ElectricModal delay={200} className="p-6">
                <div className="flex items-center justify-between text-[9px] font-code-mono text-slate-400 mb-2">
                  <span>GOVERNANÇA</span>
                  <span className="text-primary font-bold">NORMA CANÔNICA</span>
                </div>
                <p className="text-3xl font-code-light text-primary my-1">ADR-001</p>
                <p className="text-xs font-code-bold tracking-widest uppercase text-white mb-1">
                  FECHAMENTO AUDITÁVEL
                </p>
                <p className="text-[11px] text-slate-400 font-code-reg">
                  Separação matemática rigorosa entre comissão teórica e rateio de caixa.
                </p>
                <div className="border-t border-white/5 pt-3 mt-3 text-[9px] font-code-mono text-slate-400 uppercase tracking-widest">
                  AUDITORIA —
                </div>
              </ElectricModal>
            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: ARQUITETURA EM 4 CAMADAS (FLANCOS LATERAIS COM CENTRO 100% LIVRE) ═══ */}
        <section id="arquitetura" className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[550px]">

            {/* Flanco Esquerdo: Camadas 01 e 02 */}
            <div className="lg:col-span-4 space-y-4">
              <div className="mb-4">
                <span className="text-[10px] font-code-mono tracking-[0.3em] text-slate-400 uppercase block mb-1">
                  // 02 · ARQUITETURA
                </span>
                <h2 className="text-2xl sm:text-3xl font-code-light tracking-[0.2em] uppercase text-white flex items-center gap-3">
                  <span>PLATAFORMA</span>
                  <span className="h-px w-10 bg-white/20 inline-block" />
                </h2>
                <p className="text-[11px] font-code-mono tracking-[0.25em] text-primary uppercase mt-1">
                  QUATRO CAMADAS INTEGRADAS
                </p>
              </div>

              <ElectricModal delay={0} className="p-6">
                <span className="text-[9px] font-code-mono tracking-[0.25em] text-slate-400 uppercase block text-right mb-1">
                  01 · OPERACIONAL
                </span>
                <p className="text-4xl font-code-light text-white my-1.5">{ARCHITECTURE_CALLOUTS[0].code}</p>
                <h3 className="text-xs font-code-bold tracking-widest uppercase text-white mb-1.5">
                  {ARCHITECTURE_CALLOUTS[0].title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-code-reg mb-3">
                  {ARCHITECTURE_CALLOUTS[0].desc}
                </p>
                <div className="border-t border-white/5 pt-2.5 text-[9px] font-code-mono text-slate-400 uppercase tracking-widest">
                  DETALHES —
                </div>
              </ElectricModal>

              <ElectricModal delay={150} className="p-6">
                <span className="text-[9px] font-code-mono tracking-[0.25em] text-slate-400 uppercase block text-right mb-1">
                  02 · GOVERNANÇA
                </span>
                <p className="text-4xl font-code-light text-primary my-1.5">{ARCHITECTURE_CALLOUTS[1].code}</p>
                <h3 className="text-xs font-code-bold tracking-widest uppercase text-white mb-1.5">
                  {ARCHITECTURE_CALLOUTS[1].title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-code-reg mb-3">
                  {ARCHITECTURE_CALLOUTS[1].desc}
                </p>
                <div className="border-t border-white/5 pt-2.5 text-[9px] font-code-mono text-slate-400 uppercase tracking-widest">
                  DETALHES —
                </div>
              </ElectricModal>
            </div>

            {/* Centro: CORREDOR 100% LIVRE — O 3D DA CADEIRA FICA TOTALMENTE DESOBSTRUÍDO */}
            <div className="hidden lg:block lg:col-span-4 pointer-events-none" />

            {/* Flanco Direito: Camadas 03 e 04 */}
            <div className="lg:col-span-4 space-y-4 lg:pt-14">
              <ElectricModal delay={100} className="p-6">
                <span className="text-[9px] font-code-mono tracking-[0.25em] text-amber-400 uppercase block text-right mb-1">
                  03 · RECORRÊNCIA
                </span>
                <p className="text-4xl font-code-light text-amber-400 my-1.5">{ARCHITECTURE_CALLOUTS[2].code}</p>
                <h3 className="text-xs font-code-bold tracking-widest uppercase text-white mb-1.5">
                  {ARCHITECTURE_CALLOUTS[2].title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-code-reg mb-3">
                  {ARCHITECTURE_CALLOUTS[2].desc}
                </p>
                <div className="border-t border-white/5 pt-2.5 text-[9px] font-code-mono text-slate-400 uppercase tracking-widest">
                  DETALHES —
                </div>
              </ElectricModal>

              <ElectricModal delay={250} className="p-6">
                <span className="text-[9px] font-code-mono tracking-[0.25em] text-slate-400 uppercase block text-right mb-1">
                  04 · INTELIGÊNCIA
                </span>
                <p className="text-4xl font-code-light text-primary my-1.5">{ARCHITECTURE_CALLOUTS[3].code}</p>
                <h3 className="text-xs font-code-bold tracking-widest uppercase text-white mb-1.5">
                  {ARCHITECTURE_CALLOUTS[3].title}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-code-reg mb-3">
                  {ARCHITECTURE_CALLOUTS[3].desc}
                </p>
                <div className="border-t border-white/5 pt-2.5 text-[9px] font-code-mono text-slate-400 uppercase tracking-widest">
                  DETALHES —
                </div>
              </ElectricModal>
            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: COCKPIT OPERACIONAL (FLANCOS LATERAIS COM CENTRO LIVRE) ═══ */}
        <section id="cockpit" className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[550px]">

            {/* Flanco Esquerdo: Gestão de Cadeiras em Tempo Real */}
            <div className="lg:col-span-5 space-y-4">
              <div className="mb-4">
                <span className="text-[10px] font-code-mono tracking-[0.3em] text-slate-400 uppercase block mb-1">
                  // 03 · COCKPIT DE BANCADA
                </span>
                <h2 className="text-2xl sm:text-3xl font-code-light tracking-[0.2em] uppercase text-white flex items-center gap-3">
                  <span>CONTROLE TOTAL</span>
                  <span className="h-px w-10 bg-white/20 inline-block" />
                </h2>
                <p className="text-[11px] font-code-mono tracking-[0.25em] text-primary uppercase mt-1">
                  BANCADA EM TEMPO REAL
                </p>
              </div>

              <ElectricModal delay={0} className="p-5 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-white/5 text-[10px] font-code-mono">
                  <span className="text-slate-300 font-bold uppercase tracking-widest">CADEIRAS ATIVAS</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    AO VIVO
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center font-code-mono border border-primary/30">
                      01
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white tracking-wide">Guilherme Bastos</p>
                      <p className="text-[11px] text-slate-400 font-code-reg">Degradê Navalhado + Barboterapia</p>
                    </div>
                  </div>
                  <span className="text-xs font-code-mono font-bold text-primary">R$ 160,00</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center font-code-mono border border-emerald-500/30">
                      02
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white tracking-wide">Mateus Silva</p>
                      <p className="text-[11px] text-slate-400 font-code-reg">Alinhamento Clássico (Membro Gold)</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-code-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full">PLANO CLUBE</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center font-code-mono border border-amber-500/30">
                      03
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white tracking-wide">Rafael Oliveira</p>
                      <p className="text-[11px] text-slate-400 font-code-reg">Combo Chef + Pomada Matte</p>
                    </div>
                  </div>
                  <span className="text-xs font-code-mono font-bold text-primary">R$ 215,00</span>
                </div>
              </ElectricModal>
            </div>

            {/* Centro: CORREDOR LIVRE */}
            <div className="hidden lg:block lg:col-span-2 pointer-events-none" />

            {/* Flanco Direito: Comanda e KPIs */}
            <div className="lg:col-span-5 space-y-4">
              {/* KPI HUD */}
              <div className="grid grid-cols-2 gap-3">
                <ElectricModal delay={100} className="p-4">
                  <span className="text-[8px] font-code-mono text-slate-400 uppercase tracking-widest block text-right">HOJE</span>
                  <p className="text-2xl font-code-light text-white my-1">R$ 4.850</p>
                  <p className="text-[10px] font-code-bold tracking-widest text-slate-300 uppercase">FATURAMENTO</p>
                </ElectricModal>

                <ElectricModal delay={180} className="p-4">
                  <span className="text-[8px] font-code-mono text-slate-400 uppercase tracking-widest block text-right">BANCADA</span>
                  <p className="text-2xl font-code-light text-primary my-1">94%</p>
                  <p className="text-[10px] font-code-bold tracking-widest text-slate-300 uppercase">OCUPAÇÃO</p>
                </ElectricModal>
              </div>

              {/* Comanda Digital */}
              <ElectricModal delay={250} className="p-6">
                <div className="flex justify-between items-center pb-3 border-b border-white/5 text-xs font-code-mono">
                  <span className="font-bold text-white tracking-widest">COMANDA #1042</span>
                  <span className="text-primary text-[10px] font-bold">EM ATENDIMENTO</span>
                </div>
                <div className="py-3.5 space-y-2 text-xs text-slate-300 font-code-reg">
                  <div className="flex justify-between">
                    <span>Corte Degradê Navalhado</span>
                    <span className="font-code-mono text-white">R$ 90,00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Barboterapia com Toalha Quente</span>
                    <span className="font-code-mono text-white">R$ 70,00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pomada Modeladora Matte</span>
                    <span className="font-code-mono text-white">R$ 55,00</span>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/5 flex justify-between items-center text-xs font-code-mono font-bold">
                  <span className="text-slate-400 tracking-widest uppercase">TOTAL DA COMANDA</span>
                  <span className="text-primary text-base">R$ 215,00</span>
                </div>
              </ElectricModal>
            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: CLUBE DOS CHEFES (FLANCOS LATERAIS COM CENTRO LIVRE) ═══ */}
        <section id="clube" className="py-24 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center min-h-[500px]">

            {/* Flanco Esquerdo: Proposta de Valor e Regras */}
            <div className="lg:col-span-5">
              <div className="mb-4">
                <span className="text-[10px] font-code-mono tracking-[0.3em] text-slate-400 uppercase block mb-1">
                  // 04 · MOTOR DE RECORRÊNCIA
                </span>
                <h2 className="text-2xl sm:text-3xl font-code-light tracking-[0.2em] uppercase text-white flex items-center gap-3">
                  <span>CLUBE DOS CHEFES</span>
                  <span className="h-px w-10 bg-white/20 inline-block" />
                </h2>
                <p className="text-[11px] font-code-mono tracking-[0.25em] text-amber-400 uppercase mt-1">
                  RECEITA PREVISÍVEL MRR
                </p>
              </div>

              <ElectricModal delay={0} className="p-7">
                <span className="text-[9px] font-code-mono tracking-[0.25em] text-slate-400 uppercase block text-right mb-2">
                  AUTO COBRANÇA
                </span>
                <p className="text-4xl font-code-light text-amber-400 my-2 tracking-tight">100%</p>
                <h3 className="text-xs font-code-bold tracking-widest uppercase text-white mb-2">
                  ASSINATURAS RECORRENTES
                </h3>
                <p className="text-slate-300 text-xs leading-relaxed font-code-reg mb-5">
                  Cobrança mensal no cartão com baixa automática de créditos diretamente na comanda, gerando fluxo financeiro garantido no início de cada mês.
                </p>

                <div className="space-y-3 text-xs text-slate-300 font-code-reg border-t border-white/5 pt-4">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                    <span>Cobrança mensal automatizada no cartão de crédito</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                    <span>Controle de saldo de cortes e serviços na comanda</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                    <span>Agendamento VIP pelo próprio celular do cliente</span>
                  </div>
                </div>
              </ElectricModal>
            </div>

            {/* Centro: CORREDOR LIVRE */}
            <div className="hidden lg:block lg:col-span-2 pointer-events-none" />

            {/* Flanco Direito: Níveis de Assinatura */}
            <div className="lg:col-span-5 space-y-3.5">
              <ElectricModal delay={100} className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-code-mono text-[9px] text-slate-400 tracking-widest uppercase">NÍVEL 01 · BÁSICO</p>
                  <p className="font-code-bold text-sm text-white tracking-wide mt-0.5">Plano Clássico</p>
                  <p className="text-slate-400 text-[11px] font-code-reg">Cortes programados no mês</p>
                </div>
                <span className="font-code-mono text-[10px] text-primary bg-primary/10 px-3 py-1 rounded-full">RECORRÊNCIA</span>
              </ElectricModal>

              <ElectricModal delay={180} className="p-5 flex items-center justify-between border-primary/30">
                <div>
                  <p className="font-code-mono text-[9px] text-primary font-bold tracking-widest uppercase">NÍVEL 02 · MAIS ESCOLHIDO</p>
                  <p className="font-code-bold text-sm text-white tracking-wide mt-0.5">Plano Gentleman</p>
                  <p className="text-slate-300 text-[11px] font-code-reg">Corte + Barba + Bebida Cortesia</p>
                </div>
                <span className="font-code-mono text-[10px] bg-primary text-night font-bold px-3 py-1 rounded-full shadow-smg-glow">VIP CLUB</span>
              </ElectricModal>

              <ElectricModal delay={260} className="p-5 flex items-center justify-between">
                <div>
                  <p className="font-code-mono text-[9px] text-amber-400 tracking-widest uppercase">NÍVEL 03 · PREMIUM</p>
                  <p className="font-code-bold text-sm text-white tracking-wide mt-0.5">Black Chef Exclusive</p>
                  <p className="text-slate-400 text-[11px] font-code-reg">Experiência ilimitada na bancada</p>
                </div>
                <span className="font-code-mono text-[10px] text-amber-300 bg-amber-500/10 px-3 py-1 rounded-full">ATELIER TOP</span>
              </ElectricModal>
            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: PLANOS POR MATURIDADE OPERACIONAL (ALINHADA AO CANTO) ═══ */}
        <section id="planos" className="py-24 px-6 max-w-7xl mx-auto">
          <div className="mb-14 max-w-xl">
            <span className="text-[10px] font-code-mono tracking-[0.3em] text-slate-400 uppercase block mb-1">
              // 05 · IMPLANTAÇÃO
            </span>
            <h2 className="text-2xl sm:text-3xl font-code-light tracking-[0.2em] uppercase text-white flex items-center gap-3">
              <span>MATURIDADE OPERACIONAL</span>
              <span className="h-px w-10 bg-white/20 inline-block" />
            </h2>
            <p className="text-slate-400 text-xs font-code-reg mt-1">
              Estrutura sob medida para cada estágio da sua barbearia.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {MATURITY_PLANS.map((plan, idx) => (
              <ElectricModal
                key={plan.name}
                delay={idx * 140}
                className={`flex flex-col p-7 rounded-[28px] relative ${
                  plan.highlight ? 'border-primary/50 shadow-smg-glow/30' : ''
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-night text-[9px] font-code-mono font-bold uppercase tracking-widest rounded-full shadow-smg-glow">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-4">
                  <span className="text-[9px] font-code-mono tracking-widest text-primary uppercase">
                    {plan.code}
                  </span>
                  <h3 className="text-lg font-code-bold text-white mt-1 mb-1 tracking-wide">{plan.name}</h3>
                  <p className="text-slate-300 text-xs leading-relaxed font-code-reg">{plan.desc}</p>
                </div>

                <div className="flex-1 space-y-2.5 my-4 pt-3 border-t border-white/5">
                  {plan.features.map(feat => (
                    <div key={feat} className="flex items-start gap-2.5 text-xs text-slate-300 font-code-reg">
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
                  className={`w-full py-3 rounded-full font-code-mono font-bold text-xs uppercase tracking-widest text-center transition-all ${
                    plan.highlight
                      ? 'bg-primary hover:bg-primary-light text-night shadow-smg-glow'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}
                >
                  {plan.cta}
                </a>
              </ElectricModal>
            ))}
          </div>
        </section>

      </div>

      {/* ═══ RODAPÉ TELEMETRIA ATELIER (SEM LINHAS DE SEPARAÇÃO) ═══ */}
      <footer className="bg-[#040302] py-14 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10">

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
                <p className="text-[10px] text-slate-400 pt-1 leading-relaxed font-code-reg">
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
