import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Award,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  BookOpen,
  Target
} from 'lucide-react';
import Modal from '../ui/Modal';

export interface AcademyModule {
  number: number;
  title: string;
  duration: string;
  topics: string[];
}

export interface PracticalExercise {
  id: string;
  title: string;
  scenario: string;
  expectedAction: string;
  targetRoute: string;
  routeLabel: string;
}

export interface AcademyTrack {
  id: 'recepcao' | 'barbeiro' | 'gestao';
  title: string;
  roleTarget: string;
  duration: string;
  level: string;
  badge: string;
  iconName: string;
  description: string;
  certificationTitle: string;
  modules: AcademyModule[];
  exercises: PracticalExercise[];
}

export const ACADEMY_TRACKS: AcademyTrack[] = [
  {
    id: 'recepcao',
    title: 'Especialista em Recepção & Caixa Ágil',
    roleTarget: 'Recepcionistas, Hostess e Operadores de Caixa',
    duration: '45 minutos',
    level: 'Operacional / Essencial',
    badge: 'Zero Filas & Caixa Blindado',
    iconName: 'receipt',
    description:
      'Domine o atendimento rápido de balcão com atalho N, gestão de cadeiras cativas semanais, checkout expresso e fechamento de caixa cego com tolerância zero para diferenças.',
    certificationTitle: 'Especialista em Balcão e Caixa Ágil SMG Barber',
    modules: [
      {
        number: 1,
        title: 'O Pulso da Barbearia & Cockpit Matinal',
        duration: '10 min',
        topics: [
          'Abertura do sistema e conferência do fuso oficial (America/Sao_Paulo)',
          'Leitura dos 6 KPIs diários em tempo real (Faturamento real liquidado, Ticket Médio, Ocupação)',
          'Identificação visual de horários de pico (17h às 20h) para encaixes conscientes'
        ]
      },
      {
        number: 2,
        title: 'Balcão Ágil Sem Fila & Atalho N',
        duration: '10 min',
        topics: [
          'Abertura relâmpago de comanda pressionando a tecla N em qualquer tela',
          'Busca debounced inteligente com autocompletar de histórico em 3 caracteres',
          'Atendimento ágil de cliente balcão (Walk-in sem cadastro prévio)',
          'Encaixes rápidos na grade sem gerar conflitos de horário'
        ]
      },
      {
        number: 3,
        title: 'Fidelidade Ativa, Club dos Chefes & Cadeira Cativa',
        duration: '15 min',
        topics: [
          'Estrutura de Cadeira Cativa com projeção de até 12 sessões semanais',
          'Rotina de confirmação da semana via WhatsApp com 1 clique',
          'Liberação pontual de vaga sem perda da reserva futura',
          'Abatimento de créditos do Club dos Chefes mantendo comissão integral do barbeiro'
        ]
      },
      {
        number: 4,
        title: 'Checkout Expresso & Fechamento de Caixa Blindado',
        duration: '10 min',
        topics: [
          'Pagamentos divididos/mistos (Dinheiro + PIX + Cartão na mesma comanda)',
          'Calculadora inteligente de troco com bloqueio de valor insuficiente',
          'Lançamento justificado de sangrias e suprimentos no caixa',
          'Conferência física cega no fechamento de caixa e registro de justificativa'
        ]
      }
    ],
    exercises: [
      {
        id: 'rec-ex-1',
        title: 'Abertura Rápida com Atalho N',
        scenario: 'Cliente novo entra na barbearia querendo cortar cabelo sem agendamento prévio.',
        expectedAction: 'Pressionar tecla N, selecionar Cliente Balcão e associar ao barbeiro com cadeira livre.',
        targetRoute: '/comandas',
        routeLabel: 'Abrir Comandas'
      },
      {
        id: 'rec-ex-2',
        title: 'Agendamento & Encaixe na Grade',
        scenario: 'Cliente liga solicitando encaixe de Barba às 16:30.',
        expectedAction: 'Localizar janela de 30min na agenda, criar agendamento e verificar alerta de conflito.',
        targetRoute: '/schedule',
        routeLabel: 'Ir para a Agenda'
      },
      {
        id: 'rec-ex-3',
        title: 'Checkout Misto & Troco Expresso',
        scenario: 'Comanda de R$ 85,00 paga com R$ 50,00 no PIX e uma cédula de R$ 50,00.',
        expectedAction: 'Lançar PIX de R$ 50, lançar R$ 50 em dinheiro e validar o cálculo de R$ 15 de troco.',
        targetRoute: '/checkout',
        routeLabel: 'Abrir Checkout'
      },
      {
        id: 'rec-ex-4',
        title: 'Fechamento Cego de Caixa',
        scenario: 'Fim do turno: realizar a conferência dos valores físicos.',
        expectedAction: 'Acessar o Fechamento de Caixa, preencher cédulas e comprovantes e finalizar sem divergências.',
        targetRoute: '/cash-closing',
        routeLabel: 'Ir para Fechamento de Caixa'
      }
    ]
  },
  {
    id: 'barbeiro',
    title: 'Barbeiro Digital & Bancada Lucrativa',
    roleTarget: 'Barbeiros, Cabeleireiros e Terapeutas Capilares',
    duration: '30 minutos',
    level: 'Operacional / Prático',
    badge: 'Mobile & Extrato Transparente',
    iconName: 'scissors',
    description:
      'Opere sua cadeira pelo smartphone com o Modo Barbeiro, turbine ganhos com produtos e combos de bancada e consulte seu extrato líquido minuto a minuto sem depender de ninguém.',
    certificationTitle: 'Barbeiro Digital & Bancada Lucrativa SMG Barber',
    modules: [
      {
        number: 1,
        title: 'O Barbeiro Conectado & Modo Mobile',
        duration: '5 min',
        topics: [
          'Acesso mobile pelo smartphone e detecção automática de perfil de bancada',
          'Visão focada na sua cadeira (blindagem de clientes de outros profissionais)',
          'Instalação do atalho na tela inicial do celular para acesso instantâneo'
        ]
      },
      {
        number: 2,
        title: 'A Cadeira em Ação & Fila de Atendimento',
        duration: '10 min',
        topics: [
          'Consulta visual da fila do dia: "Na Cadeira Agora" e "A Seguir"',
          'Leitura rápida de anotações técnicas e estilo preferido do cliente',
          'Sinalização de Início de Atendimento em 1 toque sincronizada com a recepção',
          'Conclusão de atendimento liberando a comanda para o caixa'
        ]
      },
      {
        number: 3,
        title: 'Venda Ativa de Bancada, Produtos & Combos',
        duration: '10 min',
        topics: [
          'Como dobrar o faturamento da cadeira ofertando pomadas, óleos e bebidas',
          'Adição de itens na comanda em voo direto pelo celular',
          'Lançamento de Combos Inteligentes com ajuste automático de tempo'
        ]
      },
      {
        number: 4,
        title: 'Extrato de Comissão Transparente & Repasse de Taxas',
        duration: '5 min',
        topics: [
          'Acompanhamento do saldo em tempo real na tela Meu Extrato',
          'Aplicação do princípio canônico ADR-001 (comissão teórica calculada por item)',
          'Transparência total na dedução proporcional de taxas de cartão',
          'Alinhamento exato de valores entre barbeiro e administração sem divergências'
        ]
      }
    ],
    exercises: [
      {
        id: 'bar-ex-1',
        title: 'Fila do Dia & Status da Cadeira',
        scenario: 'O barbeiro inicia o turno e confere seus primeiros atendimentos.',
        expectedAction: 'Acessar a agenda filtrada pela própria cadeira e revisar horários.',
        targetRoute: '/schedule',
        routeLabel: 'Ver Minha Agenda'
      },
      {
        id: 'bar-ex-2',
        title: 'Venda de Produto na Comanda',
        scenario: 'Cliente na cadeira decide levar uma pomada matte para finalizar em casa.',
        expectedAction: 'Localizar a comanda ativa, adicionar o produto cosmético e verificar atualização do total.',
        targetRoute: '/comandas',
        routeLabel: 'Ver Comandas'
      },
      {
        id: 'bar-ex-3',
        title: 'Conferência de Extrato e Comissão',
        scenario: 'Fim do expediente: o barbeiro audita seus rendimentos líquidos.',
        expectedAction: 'Acessar a área de Comissões e validar os serviços prestados e produtos faturados.',
        targetRoute: '/commissions',
        routeLabel: 'Ver Minhas Comissões'
      }
    ]
  },
  {
    id: 'gestao',
    title: 'Gestão Executiva & Dono da Barbearia',
    roleTarget: 'Proprietários, Sócios, Gerentes Gerais e Consultores',
    duration: '60 minutos',
    level: 'Estratégico / Gestão Avançada',
    badge: 'BI Preditivo & Churn Zero',
    iconName: 'trending_up',
    description:
      'Tome decisões baseadas em dados com o Cockpit Executivo, recupere clientes inativos com 1 clique no WhatsApp, blinde o fluxo financeiro e crie receita recorrente com o Club dos Chefes.',
    certificationTitle: 'Gestão Executiva & Business Intelligence SMG Barber',
    modules: [
      {
        number: 1,
        title: 'O Cockpit Executivo & Leitura dos 6 KPIs Vitais',
        duration: '15 min',
        topics: [
          'Diferença entre faturamento real liquidado e previsões hipotéticas',
          'Monitoramento de faturamento, ticket médio, serviços vs produtos e taxa de ocupação',
          'Identificação precoce de gargalos de ociosidade na grade de horários'
        ]
      },
      {
        number: 2,
        title: 'Inteligência de Retenção & Combate ao Churn via WhatsApp',
        duration: '15 min',
        topics: [
          'O custo do cliente perdido e métricas de LTV (Lifetime Value)',
          'Filtros preditivos de inatividade: 30-44 dias (risco), 45-59 dias (alto risco) e >60 dias (abandono)',
          'Disparo personalizado via WhatsApp em 1 clique com mensagem amigável contextualizada'
        ]
      },
      {
        number: 3,
        title: 'Governança Financeira, Fechamento D0 & Auditoria',
        duration: '15 min',
        topics: [
          'O Princípio Canônico ADR-001 de segregação entre comissões teóricas e rateio de caixa',
          'Proteção da conferência física cega e tratamento de diferenças de caixa',
          'Auditoria contínua de sangrias, suprimentos e taxas de maquininhas'
        ]
      },
      {
        number: 4,
        title: 'Club dos Chefes & Previsibilidade de Receita Recorrente',
        duration: '15 min',
        topics: [
          'Transformação de receita sazonal em receita mensal recorrente previsível',
          'Estruturação de planos e automação de controle de créditos',
          'Remuneração justa da equipe em planos de assinatura para engajar os profissionais'
        ]
      }
    ],
    exercises: [
      {
        id: 'ges-ex-1',
        title: 'Análise do Cockpit Estratégico',
        scenario: 'O gestor analisa a rentabilidade da barbearia na última semana.',
        expectedAction: 'Acessar o Painel Estratégico, analisar o ticket médio e avaliar ocupação por barbeiro.',
        targetRoute: '/strategic-dashboard',
        routeLabel: 'Abrir Painel Estratégico'
      },
      {
        id: 'ges-ex-2',
        title: 'Campanha de Recuperação via WhatsApp',
        scenario: 'Identificar clientes frequentes que não visitam a barbearia há mais de 35 dias.',
        expectedAction: 'Acessar Clientes, aplicar o filtro de inatividade e acionar o botão de mensagem WhatsApp.',
        targetRoute: '/clients',
        routeLabel: 'Ir para Gestão de Clientes'
      },
      {
        id: 'ges-ex-3',
        title: 'Gestão de Assinaturas do Club dos Chefes',
        scenario: 'Conferir os assinantes ativos e acompanhar o saldo de mensalidades e créditos.',
        expectedAction: 'Acessar o módulo Club dos Chefes e consultar as assinaturas vigentes.',
        targetRoute: '/chef-club-subscriptions',
        routeLabel: 'Acessar Club dos Chefes'
      },
      {
        id: 'ges-ex-4',
        title: 'Visão Geral Financeira & Fechamento',
        scenario: 'Validar a conciliação do faturamento e extrato consolidado de caixa.',
        expectedAction: 'Acessar a Visão Financeira para checar receitas por forma de pagamento e sangrias.',
        targetRoute: '/financial-overview',
        routeLabel: 'Abrir Visão Financeira'
      }
    ]
  }
];

export const AcademyHub: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTrack, setSelectedTrack] = useState<AcademyTrack | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Academy Banner Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A1610] via-[#12100C] to-[#0D0B08] border border-[#E2A63B]/25 p-8 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#A96F14]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#A96F14]/20 border border-[#A96F14]/40 text-[#E2A63B] text-[11px] font-black uppercase tracking-widest mb-4">
            <Sparkles size={14} />
            The Barbershop Intelligence
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            SMG Academy — Capacitação Oficial & Certificação
          </h2>
          <p className="mt-3 text-[#A89D8B] text-sm sm:text-base leading-relaxed font-normal">
            Aprenda o método em 3 etapas: estude a trilha do seu papel, pratique sem risco no
            ambiente de demonstração e conquiste a certificação oficial da sua barbearia com
            aproveitamento superior a 80%.
          </p>

          {/* 3 Steps Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
            <div className="flex items-start gap-3 text-slate-300">
              <span className="size-6 rounded-lg bg-[#A96F14] text-black font-black flex items-center justify-center shrink-0 text-xs">
                1
              </span>
              <div>
                <p className="font-bold text-white">Aprenda o Método</p>
                <p className="text-[11px] text-[#A89D8B] mt-0.5">Trilhas curriculares práticas por perfil</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-300">
              <span className="size-6 rounded-lg bg-[#A96F14] text-black font-black flex items-center justify-center shrink-0 text-xs">
                2
              </span>
              <div>
                <p className="font-bold text-white">Pratique Sem Risco</p>
                <p className="text-[11px] text-[#A89D8B] mt-0.5">Simulações guiadas direto nas telas reais</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-slate-300">
              <span className="size-6 rounded-lg bg-[#A96F14] text-black font-black flex items-center justify-center shrink-0 text-xs">
                3
              </span>
              <div>
                <p className="font-bold text-white">Selo de Especialista</p>
                <p className="text-[11px] text-[#A89D8B] mt-0.5">Certificado oficial com nota &ge; 80%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Trilhas Curriculares */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <GraduationCap className="text-[#A96F14] dark:text-[#E2A63B]" size={22} />
              Trilhas Curriculares por Perfil
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A89D8B] mt-1">
              Escolha seu papel na barbearia para abrir os módulos e exercícios práticos
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCertModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#A96F14] dark:text-[#E2A63B] border border-[#A96F14]/30 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            <ShieldCheck size={16} />
            Regras de Certificação
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ACADEMY_TRACKS.map((track) => (
            <div
              key={track.id}
              className="bg-[#12100C] rounded-3xl border border-white/10 hover:border-[#E2A63B]/50 p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-xl group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#A96F14]/5 rounded-bl-full group-hover:bg-[#A96F14]/10 transition-colors pointer-events-none" />

              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-2.5 py-1 rounded-lg bg-[#A96F14]/20 text-[#E2A63B] text-[10px] font-black uppercase tracking-wider border border-[#A96F14]/30">
                    {track.badge}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock size={13} className="text-[#E2A63B]" />
                    <span>{track.duration}</span>
                  </div>
                </div>

                <h4 className="text-lg font-bold text-white group-hover:text-[#E2A63B] transition-colors leading-snug">
                  {track.title}
                </h4>

                <p className="text-xs text-[#A89D8B] mt-1.5 flex items-center gap-1.5">
                  <Users size={13} className="shrink-0 text-slate-400" />
                  <span>{track.roleTarget}</span>
                </p>

                <p className="text-xs text-slate-400 mt-3 line-clamp-3 leading-relaxed">
                  {track.description}
                </p>

                {/* Modules Summary Pills */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Conteúdo ({track.modules.length} Módulos):
                  </p>
                  {track.modules.slice(0, 3).map((m) => (
                    <div key={m.number} className="text-[11px] text-slate-300 flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-[#E2A63B]" />
                      <span className="truncate">{m.title}</span>
                    </div>
                  ))}
                  {track.modules.length > 3 && (
                    <p className="text-[11px] text-[#E2A63B] font-medium">+ {track.modules.length - 3} módulo de fechamento</p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#A96F14] to-[#c28827] hover:from-[#c28827] hover:to-[#A96F14] text-black font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95"
                >
                  <BookOpen size={15} />
                  Ver Trilha & Módulos
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Card: Ambiente de Treino e Simulação */}
      <div className="bg-[#12100C] border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[#E2A63B] flex items-center justify-center shrink-0">
            <Target size={24} />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm sm:text-base">
              Pratique no Ambiente Demo (Sem Risco aos Dados)
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Para treinar os fluxos sem alterar a operação real da sua barbearia, você pode
              utilizar o usuário de demonstração local ou abrir as telas com as comandas de treino.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/schedule')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold border border-white/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            Abrir Agenda
            <ExternalLink size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/comandas')}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#A96F14] text-black hover:bg-[#c28827] text-xs font-black transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            Abrir Balcão
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Modal Detalhado da Trilha Selecionada */}
      {selectedTrack && (
        <Modal
          isOpen={!!selectedTrack}
          onClose={() => setSelectedTrack(null)}
          title={selectedTrack.title}
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
            {/* Track Header Meta */}
            <div className="bg-[#15130F] p-5 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[#A89D8B]">Público:</span>
                <span className="font-bold text-white">{selectedTrack.roleTarget}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock size={14} className="text-[#E2A63B]" />
                  {selectedTrack.duration}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#A96F14]/20 text-[#E2A63B] font-bold">
                  {selectedTrack.level}
                </span>
              </div>
            </div>

            {/* Modules List */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#E2A63B] flex items-center gap-2">
                <BookOpen size={16} />
                Módulos do Curso
              </h4>

              <div className="space-y-3">
                {selectedTrack.modules.map((m) => (
                  <div
                    key={m.number}
                    className="bg-[#12100C] p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-black text-white flex items-center gap-2">
                        <span className="size-5 rounded-md bg-[#A96F14] text-black text-[11px] font-black flex items-center justify-center">
                          {m.number}
                        </span>
                        {m.title}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">{m.duration}</span>
                    </div>

                    <ul className="space-y-1.5 mt-2.5 pl-7 text-xs text-[#A89D8B]">
                      {m.topics.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 size={13} className="text-[#E2A63B] shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Simulado Prático (Hands-On) */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-[#E2A63B] flex items-center gap-2">
                <Target size={16} />
                Exercícios Práticos Simulados (Hands-On)
              </h4>

              <div className="space-y-3">
                {selectedTrack.exercises.map((ex, idx) => (
                  <div
                    key={ex.id}
                    className="bg-[#12100C] p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Desafio {idx + 1}: {ex.title}</span>
                      </div>
                      <p className="text-xs text-slate-400">{ex.scenario}</p>
                      <p className="text-[11px] text-[#A89D8B]">
                        <strong className="text-slate-300">Ação Esperada:</strong> {ex.expectedAction}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrack(null);
                        navigate(ex.targetRoute);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#E2A63B] border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    >
                      <span>{ex.routeLabel}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Certificação Concedida */}
            <div className="bg-[#1A1610] p-4 rounded-2xl border border-[#A96F14]/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#A96F14]/20 text-[#E2A63B] flex items-center justify-center shrink-0">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#E2A63B]">
                    Certificação Obtida
                  </p>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {selectedTrack.certificationTitle}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-400 shrink-0">Nota mínima: 80%</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Regras de Certificação */}
      <Modal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        title="Sistema Oficial de Certificação SMG Barber"
      >
        <div className="space-y-4 text-xs text-slate-300 max-h-[70vh] overflow-y-auto pr-1">
          <div className="bg-[#12100C] p-4 rounded-2xl border border-white/10 space-y-2">
            <h5 className="font-bold text-white flex items-center gap-2 text-sm">
              <Award className="text-[#E2A63B]" size={18} />
              Critérios de Aprovação & Selo de Especialista
            </h5>
            <p className="text-[#A89D8B] leading-relaxed">
              O processo de certificação atesta a proficiência operacional da equipe e a conformidade
              com os fluxos contábeis e de atendimento da plataforma SMG Barber.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#12100C] p-3.5 rounded-xl border border-white/10">
              <p className="font-bold text-white mb-1">Nota de Corte Oficial</p>
              <p className="text-[#A89D8B]">Mínimo de 80% de acertos na avaliação combinada (teoria + prática simulada).</p>
            </div>
            <div className="bg-[#12100C] p-3.5 rounded-xl border border-white/10">
              <p className="font-bold text-white mb-1">Validade da Credencial</p>
              <p className="text-[#A89D8B]">12 meses. Reciclagem expressa de 15 minutos em novos lançamentos.</p>
            </div>
          </div>

          <div className="bg-[#12100C] p-4 rounded-xl border border-white/10 space-y-1.5">
            <p className="font-bold text-white">Selo de Marketing "Unidade Certificada"</p>
            <p className="text-[#A89D8B]">
              As barbearias com 100% da equipe ativa certificada recebem o selo dourado digital
              <strong> "Unidade Certificada SMG Barber"</strong> para exibição em redes sociais, website de booking e na recepção física.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AcademyHub;
