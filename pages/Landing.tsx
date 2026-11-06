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
    tag: '// 01 · OPERACIONAL',
    title: 'Cockpit de Bancada',
    desc: 'Agenda multiprofissional em tempo real, fila dinâmica de cadeiras e comandas ágeis.',
  },
  {
    id: '02',
    tag: '// 02 · GOVERNANÇA',
    title: 'Fechamento Canônico',
    desc: 'Conferência cega de caixa, sangria, suprimento e rateio de comissão auditável (ADR-001).',
  },
  {
    id: '03',
    tag: '// 03 · RECORRÊNCIA',
    title: 'Clube dos Chefes',
    desc: 'Assinaturas mensais no cartão com baixa automática de créditos diretamente na comanda.',
  },
  {
    id: '04',
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

      {/* ═══ TELA CHEIA INICIAL: IMAGEM PURA (SEM LOGO EM CIMA) + BOTÃO EXPLORAR ═══ */}
      <section className="relative w-full h-screen flex flex-col justify-end items-center pb-16 px-6">

        {/* O BOTÃO EXPLORAR NO FINAL DA TELA INICIAL */}
        <div className="z-20 flex flex-col items-center gap-3 text-center animate-fade-in">
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
          <p className="text-[10px] font-code-mono tracking-widest text-slate-400 uppercase">
            ROLE O MOUSE OU CLIQUE PARA NAVEGAR
          </p>
        </div>

      </section>

      {/* ═══ CONTEÚDO QUE SOBE AO ROLAR O MOUSE (SEM LINHAS DE SEPARAÇÃO) ═══ */}
      <div id="conteudo" className="relative z-10">

        {/* ═══ BLOCO DE INTRODUÇÃO (SURGE NA SUBIDA DO SCROLL) ═══ */}
        <section className="py-28 px-6 text-center max-w-4xl mx-auto">
          <div className="p-8 sm:p-12 rounded-2xl bg-card-dark/70 backdrop-blur-md shadow-2xl">
            <span className="text-[10px] font-code-mono tracking-[0.25em] text-primary uppercase block mb-3">
              SMG BARBER INTELLIGENCE
            </span>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.08] mb-6">
              <span className="font-code-light block text-slate-300">ALÉM DO CORTE.</span>
              <span className="font-code-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary-light to-amber-200">
                GESTÃO INTELIGENTE
              </span>
              <span className="text-primary font-code-bold">.</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-code-reg">
              Engenharia de precisão para barbearias de alto padrão. Agenda multiprofissional em tempo real, fechamento de caixa auditável e motor de recorrência.
            </p>
          </div>
        </section>

        {/* ═══ SEÇÃO: ARQUITETURA EM 4 CAMADAS ═══ */}
        <section id="arquitetura" className="py-24 px-6 relative">
          <div className="max-w-7xl mx-auto">

            <div className="mb-16 text-center max-w-2xl mx-auto">
              <span className="text-[10px] font-code-mono tracking-[0.2em] text-primary uppercase block mb-2">
                ARQUITETURA DO SISTEMA
              </span>
              <h2 className="text-3xl sm:text-4xl font-code-bold text-white tracking-tight mb-3">
                UMA PLATAFORMA. QUATRO CAMADAS.
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed font-code-reg">
                Módulos integrados sem atrito operacional entre a recepção e a bancada.
              </p>
            </div>

            {/* Grid Enxuto das 4 Camadas sem Linhas Harsh */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ARCHITECTURE_CALLOUTS.map(item => (
                <div key={item.id} className="p-6 rounded-xl bg-card-dark/80 backdrop-blur-md hover:bg-card-dark transition-all">
                  <p className="text-[10px] font-code-mono tracking-widest text-primary mb-2">{item.tag}</p>
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-code-reg">{item.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: COCKPIT OPERACIONAL EM TEMPO REAL ═══ */}
        <section id="cockpit" className="py-20 px-6">
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
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed font-code-reg">
                Agenda, fila de cadeiras e comandas unificadas para dono, gerente e equipe.
              </p>
            </div>

            <div className="rounded-xl bg-card-dark/90 backdrop-blur-md overflow-hidden shadow-2xl">

              {/* Topbar */}
              <div className="bg-night/80 px-5 py-3 flex items-center justify-between text-xs font-code-mono">
                <span className="text-slate-300 font-bold">ATELIER SANCHEZ — UNIDADE PRINCIPAL</span>
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  TEMPO REAL ATIVO
                </span>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 text-left">
                <div className="bg-card-dark p-4 rounded-lg">
                  <p className="text-[10px] font-code-mono text-slate-400 uppercase">FATURAMENTO HOJE</p>
                  <p className="text-xl font-bold text-white mt-0.5">R$ 4.850,00</p>
                </div>
                <div className="bg-card-dark p-4 rounded-lg">
                  <p className="text-[10px] font-code-mono text-slate-400 uppercase">OCUPAÇÃO</p>
                  <p className="text-xl font-bold text-primary mt-0.5">94%</p>
                </div>
                <div className="bg-card-dark p-4 rounded-lg">
                  <p className="text-[10px] font-code-mono text-slate-400 uppercase">TICKET MÉDIO</p>
                  <p className="text-xl font-bold text-white mt-0.5">R$ 173,20</p>
                </div>
                <div className="bg-card-dark p-4 rounded-lg">
                  <p className="text-[10px] font-code-mono text-slate-400 uppercase">CLUBE DOS CHEFES</p>
                  <p className="text-xl font-bold text-amber-400 mt-0.5">142 Membros</p>
                </div>
              </div>

              {/* Cadeiras e Comanda */}
              <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-card-dark/40">

                <div className="lg:col-span-8 space-y-2.5">
                  <div className="bg-card-dark p-3.5 rounded-lg flex items-center justify-between">
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

                  <div className="bg-card-dark p-3.5 rounded-lg flex items-center justify-between">
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

                  <div className="bg-card-dark p-3.5 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg flex items-center justify-center font-bold text-night text-xs" style={{ backgroundColor: '#F59E0B' }}>
                        RO
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Rafael Oliveira · Cadeira 03</p>
                        <p className="text-[11px] text-slate-300">Combo Chef + Pomada Matte</p>
                      </div>
                    </div>
                    <span className="text-xs font-code-mono font-bold text-primary">R$ 215,00</span>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-night p-4 rounded-lg flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center pb-2 text-xs font-code-mono">
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
                  <div className="pt-2 flex justify-between text-xs font-code-mono font-bold">
                    <span className="text-slate-400">Total</span>
                    <span className="text-primary">R$ 215,00</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: CLUBE DOS CHEFES (RECORRÊNCIA MRR) ═══ */}
        <section id="clube" className="py-20 lg:py-28 px-6">
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

              <div className="space-y-3.5 text-xs text-slate-300 font-code-reg">
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
              <div className="p-4 rounded-lg bg-card-dark/80 backdrop-blur-md flex items-center justify-between text-xs">
                <div>
                  <p className="font-code-mono text-[10px] text-slate-400">NÍVEL 01</p>
                  <p className="font-bold text-white">Plano Clássico</p>
                  <p className="text-slate-400 text-[11px]">Cortes programados no mês</p>
                </div>
                <span className="font-code-mono text-[10px] text-primary bg-primary/10 px-2.5 py-1 rounded">RECORRÊNCIA</span>
              </div>

              <div className="p-4 rounded-lg bg-card-dark/90 backdrop-blur-md flex items-center justify-between text-xs shadow-smg-glow/20">
                <div>
                  <p className="font-code-mono text-[10px] text-primary">NÍVEL 02 · MAIS ESCOLHIDO</p>
                  <p className="font-bold text-white">Plano Gentleman</p>
                  <p className="text-slate-300 text-[11px]">Corte + Barba + Bebida Cortesia</p>
                </div>
                <span className="font-code-mono text-[10px] bg-primary text-night font-bold px-2.5 py-1 rounded">VIP CLUB</span>
              </div>

              <div className="p-4 rounded-lg bg-card-dark/80 backdrop-blur-md flex items-center justify-between text-xs">
                <div>
                  <p className="font-code-mono text-[10px] text-amber-400">NÍVEL 03</p>
                  <p className="font-bold text-white">Black Chef Exclusive</p>
                  <p className="text-slate-400 text-[11px]">Experiência ilimitada na bancada</p>
                </div>
                <span className="font-code-mono text-[10px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded">ATELIER TOP</span>
              </div>
            </div>

          </div>
        </section>

        {/* ═══ SEÇÃO: PLANOS POR MATURIDADE OPERACIONAL ═══ */}
        <section id="planos" className="py-24 px-6">
          <div className="max-w-7xl mx-auto">

            <div className="text-center max-w-xl mx-auto mb-16">
              <span className="text-[10px] font-code-mono tracking-[0.2em] text-primary uppercase block mb-1">
                PLANOS DE IMPLANTAÇÃO
              </span>
              <h2 className="text-3xl font-code-bold text-white tracking-tight mb-2">
                MATURIDADE OPERACIONAL.
              </h2>
              <p className="text-slate-400 text-xs font-code-reg">
                Estrutura desenhada para cada estágio da sua barbearia.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {MATURITY_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col p-6 sm:p-8 rounded-xl relative transition-all duration-300 h-full ${
                    plan.highlight
                      ? 'bg-gradient-to-b from-card-dark to-[#060504] shadow-xl shadow-primary/10'
                      : 'bg-card-dark/80 backdrop-blur-md'
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
                    <p className="text-slate-300 text-xs leading-relaxed font-code-reg">{plan.desc}</p>
                  </div>

                  <div className="flex-1 space-y-2.5 my-4 pt-4">
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
                    className={`w-full py-3.5 rounded-lg font-code-mono font-bold text-xs uppercase tracking-widest text-center transition-all ${
                      plan.highlight
                        ? 'bg-primary hover:bg-primary-light text-night shadow-smg-glow'
                        : 'bg-surface-dark hover:bg-card-dark text-white'
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>

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
