import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Preços', href: '#precos' },
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

const Landing: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');

  useEffect(() => {
    if (session) navigate('/dashboard');
  }, [session, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0E0C0A] text-white font-display overflow-x-hidden">

      {/* ═══ NAVBAR ═══ */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0E0C0A]/95 backdrop-blur-md border-b border-[#2E2720] shadow-xl' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 lg:h-20 flex items-center justify-between">
          <Logo size="lg" />

          {/* Links centrais */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setActiveNav(link.label)}
                className={`text-sm font-medium transition-colors relative group ${activeNav === link.label ? 'text-primary' : 'text-slate-400 hover:text-white'
                  }`}
              >
                {link.label}
                {activeNav === link.label && (
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary rounded-full" />
                )}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden sm:block text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Acessar Conta
            </Link>
            <Link
              to="/onboarding/role"
              className="px-5 py-2.5 bg-primary hover:bg-primary-light text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              Começar Agora
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO SECTION ═══ */}
      <section id="home" className="min-h-screen flex">
        {/* Lado esquerdo — texto */}
        <div className="flex-1 flex flex-col justify-center px-6 xl:pl-[calc((100vw-80rem)/2+1.5rem)] pt-24 pb-16 lg:max-w-[55%]">
          {/* Badge */}
          <div className="inline-flex items-center self-start gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 mb-8">
            <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Nossa Essência</span>
          </div>

          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.1] tracking-tight mb-6">
            A Evolução da<br />
            sua <span className="text-primary">Barbearia</span>
          </h1>

          <p className="text-slate-300 text-base lg:text-lg mb-4 max-w-[480px] leading-relaxed">
            O <span className="font-bold text-white">SOU MANA.GER</span> é uma plataforma de gestão inteligente criada para transformar barbearias em negócios organizados, estratégicos e lucrativos.
          </p>

          {/* Bloco citação */}
          <div className="border-l-2 border-primary/60 pl-5 py-2 mb-10 max-w-[480px] bg-white/3 rounded-r-xl">
            <p className="text-slate-400 text-sm leading-relaxed mb-3">
              Desenvolvido a partir da realidade do setor, nosso sistema une tecnologia, simplicidade e dados para ajudar empreendedores a gerenciar clientes, vendas, estoque e crescimento de forma profissional.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Mais do que um software, somos uma ferramenta de evolução para quem deseja crescer com controle e visão estratégica.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/onboarding/role"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-all shadow-xl shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0"
            >
              Agende uma Demo
              <span className="material-symbols-outlined text-lg">trending_up</span>
            </Link>
            <a
              href="#funcionalidades"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold rounded-xl transition-all hover:-translate-y-0.5"
            >
              Ver Recursos
            </a>
          </div>

          {/* Social Proof minimalista */}
          <div className="mt-12 flex items-center gap-4">
            <div className="flex -space-x-2">
              {['AB', 'MS', 'SL', 'RJ'].map((initials, i) => (
                <div key={i} className="size-8 rounded-full bg-slate-700 border-2 border-[#0E0C0A] flex items-center justify-center text-[10px] font-bold text-slate-300">
                  {initials}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-400">
              <span className="text-white font-bold">+200</span> barbearias já evoluíram
            </p>
          </div>
        </div>

        {/* Lado direito — imagem */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden">
          {/* Gradiente de transição */}
          <div className="absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-[#0E0C0A] to-transparent" />

          {/* FOTO DO USUÁRIO — coloque sua foto em public/hero-owner.jpg */}
          <img
            src="/hero-owner.jpg"
            alt="Dono da barbearia"
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              // Fallback para imagem do Unsplash se a foto pessoal não existir
              (e.target as HTMLImageElement).src =
                'https://images.unsplash.com/photo-1503951914875-452162b7f30a?q=80&w=800&auto=format&fit=crop';
            }}
          />
          {/* Gradiente inferior */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0E0C0A] to-transparent z-10" />
        </div>
      </section>

      {/* ═══ SOBRE SECTION ═══ */}
      <section id="sobre" className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-block px-3 py-1 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs font-bold uppercase tracking-widest mb-4">
            Quem somos
          </span>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-6">
            Feito por quem entende<br /> o mercado de barbearia
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Nascemos da necessidade real do setor. Cada funcionalidade foi pensada junto com donos de barbearia, para resolver problemas reais de gestão com uma interface que qualquer profissional consegue usar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {[
              { value: '200+', label: 'Barbearias cadastradas' },
              { value: '98%', label: 'Satisfação dos clientes' },
              { value: '3x', label: 'Mais organização e lucro' },
            ].map(stat => (
              <div key={stat.value} className="bg-[#1C1814] border border-[#2E2720] rounded-2xl p-8 hover:border-primary/40 transition-colors">
                <p className="text-4xl font-black text-primary mb-2">{stat.value}</p>
                <p className="text-slate-400 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FUNCIONALIDADES ═══ */}
      <section id="funcionalidades" className="py-24 px-6 bg-[#0A0907]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs font-bold uppercase tracking-widest mb-4">
              Funcionalidades
            </span>
            <h2 className="text-4xl font-black tracking-tight mb-4">
              Tudo em um só lugar
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Substitua planilhas e cadernos por uma plataforma inteligente que trabalha pelo seu crescimento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="group bg-[#1C1814] border border-[#2E2720] rounded-2xl p-7 hover:border-primary/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300 cursor-default"
              >
                <div className="size-12 rounded-xl bg-primary/15 flex items-center justify-center text-primary mb-5 group-hover:scale-110 transition-transform duration-300">
                  <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section id="precos" className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block px-3 py-1 rounded-full border border-primary/30 bg-primary/8 text-primary text-xs font-bold uppercase tracking-widest mb-6">
            Comece hoje
          </span>
          <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-6">
            Pronto para elevar sua<br />
            <span className="text-primary">barbearia ao próximo nível?</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Junte-se a centenas de profissionais que já transformaram sua gestão com o SOU MANA.GER.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/onboarding/role"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-xl transition-all shadow-2xl shadow-primary/25 hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">rocket_launch</span>
              Iniciar Gratuitamente
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white/8 hover:bg-white/12 border border-white/10 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">login</span>
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-[#2E2720] bg-[#0A0907] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-slate-500 text-xs text-center">
            © {new Date().getFullYear()} SOU MANA.GER. Todos os direitos reservados. Inteligência para seu negócio.
          </p>
          <div className="flex items-center gap-4">
            <a href="mailto:sanches.augusto@outlook.com" className="text-slate-500 hover:text-primary text-xs transition-colors">
              sanches.augusto@outlook.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;