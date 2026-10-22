/**
 * CommandPalette - Global Search & Command Menu (Ctrl + K / Cmd + K).
 * Provides instantaneous search across all modules, pages and quick actions.
 */

import type React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  FileText,
  CreditCard,
  CircleDollarSign,
  Users,
  Scissors,
  Package,
  Settings,
  BarChart3,
  Sparkles,
  Receipt,
  ArrowRight,
  Globe,
  PlusCircle,
  Command,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface CommandItem {
  id: string;
  title: string;
  description: string;
  category: 'Páginas' | 'Ações Rápidas';
  path: string;
  icon: LucideIcon;
  keywords: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const tenantSlug = tenant?.slug;

  const commands: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [
      // Páginas
      {
        id: 'page-agenda',
        title: 'Agenda',
        description: 'Visualização de horários, barbeiros e agendamentos',
        category: 'Páginas',
        path: '/agenda',
        icon: Calendar,
        keywords: ['agenda', 'horario', 'agendamento', 'marcar', 'calendario'],
      },
      {
        id: 'page-comandas',
        title: 'Comandas',
        description: 'Atendimentos em aberto, fechados e consumo',
        category: 'Páginas',
        path: '/comandas',
        icon: FileText,
        keywords: ['comanda', 'atendimento', 'ordem', 'consumo', 'servico'],
      },
      {
        id: 'page-checkout',
        title: 'Frente de Caixa (PDV)',
        description: 'Cobrança rápida, pagamentos e recebimentos',
        category: 'Páginas',
        path: '/checkout',
        icon: CreditCard,
        keywords: ['caixa', 'pdv', 'checkout', 'pagamento', 'pagar', 'cobrar'],
      },
      {
        id: 'page-cash-closing',
        title: 'Fechamento de Caixa',
        description: 'Conferência de turno, sangria e rateio',
        category: 'Páginas',
        path: '/cash-closing',
        icon: Receipt,
        keywords: ['fechamento', 'caixa', 'turno', 'conferencia', 'sangria'],
      },
      {
        id: 'page-payroll',
        title: 'Repasse de Comissões',
        description: 'Apuração periódica, vales e liquidação de comissões',
        category: 'Páginas',
        path: '/payroll',
        icon: CircleDollarSign,
        keywords: ['payroll', 'comissao', 'repasse', 'vale', 'pagamento', 'salario', 'barbeiro'],
      },
      {
        id: 'page-services',
        title: 'Serviços',
        description: 'Catálogo de cortes, barbas, combos e valores',
        category: 'Páginas',
        path: '/services',
        icon: Scissors,
        keywords: ['servico', 'corte', 'barba', 'preco', 'catalogo', 'duracao'],
      },
      {
        id: 'page-clients',
        title: 'Clientes',
        description: 'Base de contatos, histórico e fidelidade',
        category: 'Páginas',
        path: '/clients',
        icon: Users,
        keywords: ['cliente', 'contato', 'telefone', 'historico', 'fidelidade'],
      },
      {
        id: 'page-team',
        title: 'Equipe & Profissionais',
        description: 'Cadastro de barbeiros, gerentes e permissões',
        category: 'Páginas',
        path: '/team',
        icon: Users,
        keywords: ['equipe', 'time', 'barbeiro', 'profissional', 'gerente', 'staff'],
      },
      {
        id: 'page-products',
        title: 'Produtos & Estoque',
        description: 'Pomadas, óleos, controle de estoque e revenda',
        category: 'Páginas',
        path: '/products',
        icon: Package,
        keywords: ['produto', 'estoque', 'pomada', 'oleo', 'venda', 'item'],
      },
      {
        id: 'page-reports',
        title: 'Relatórios Financeiros',
        description: 'DRE, faturamento diário e métricas financeiras',
        category: 'Páginas',
        path: '/reports',
        icon: BarChart3,
        keywords: ['relatorio', 'financeiro', 'faturamento', 'dre', 'grafico', 'vendas'],
      },
      {
        id: 'page-settings',
        title: 'Configurações',
        description: 'Preferências da barbearia, horário e dados gerais',
        category: 'Páginas',
        path: '/settings',
        icon: Settings,
        keywords: ['configuracao', 'ajuste', 'empresa', 'logo', 'horario'],
      },
      {
        id: 'page-chef-club',
        title: 'Club dos Chefes',
        description: 'Planos de assinatura e membros recorrentes',
        category: 'Páginas',
        path: '/chef-club',
        icon: Sparkles,
        keywords: ['clube', 'chef', 'assinatura', 'recorrente', 'plano', 'socio'],
      },
      // Ações Rápidas
      {
        id: 'action-new-comanda',
        title: 'Nova Comanda',
        description: 'Abrir atendimento imediato para cliente',
        category: 'Ações Rápidas',
        path: '/comandas',
        icon: PlusCircle,
        keywords: ['nova', 'comanda', 'abrir', 'iniciar', 'cliente'],
      },
      {
        id: 'action-new-booking',
        title: 'Novo Agendamento',
        description: 'Reservar horário na agenda da equipe',
        category: 'Ações Rápidas',
        path: '/agenda',
        icon: PlusCircle,
        keywords: ['novo', 'agendamento', 'marcar', 'horario', 'reserva'],
      },
      {
        id: 'action-new-service',
        title: 'Cadastrar Novo Serviço',
        description: 'Adicionar opção de corte ou procedimento',
        category: 'Ações Rápidas',
        path: '/services',
        icon: PlusCircle,
        keywords: ['cadastrar', 'novo', 'servico', 'criar'],
      },
      {
        id: 'action-new-client',
        title: 'Cadastrar Novo Cliente',
        description: 'Registrar novo cliente na base',
        category: 'Ações Rápidas',
        path: '/clients',
        icon: PlusCircle,
        keywords: ['cadastrar', 'novo', 'cliente', 'adicionar'],
      },
    ];

    if (tenantSlug) {
      list.push({
        id: 'page-public-booking',
        title: 'Ver Agendamento Online Público',
        description: `Página pública de agendamento (/#/agendar/${tenantSlug})`,
        category: 'Páginas',
        path: `/agendar/${tenantSlug}`,
        icon: Globe,
        keywords: ['publico', 'online', 'link', 'agendar', 'vitrine', 'whatsapp'],
      });
    }

    return list;
  }, [tenantSlug]);

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;

    return commands.filter((cmd) => {
      const matchTitle = cmd.title.toLowerCase().includes(q);
      const matchDesc = cmd.description.toLowerCase().includes(q);
      const matchKeywords = cmd.keywords.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchKeywords;
    });
  }, [commands, query]);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle keyboard events (ESC, Up, Down, Enter)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev + 1 >= filteredCommands.length ? 0 : prev + 1
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev - 1 < 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          navigate(selected.path);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, navigate, onClose]);

  // Keep selected element in view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-14 sm:pt-20 px-3 sm:px-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Busca Global e Comandos"
    >
      {/* Backdrop click dismiss */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      {/* Palette Container */}
      <div className="w-full max-w-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-neutral-800">
          <Search className="w-5 h-5 text-slate-400 dark:text-neutral-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar telas, clientes, comandas ou ações... (ex: payroll, agenda)"
            className="w-full bg-transparent border-0 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              aria-label="Limpar busca"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Command List */}
        <div className="overflow-y-auto flex-1 p-2">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-10 px-4 text-slate-400 dark:text-neutral-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                Nenhum resultado para &quot;{query}&quot;
              </p>
              <p className="text-xs mt-1">
                Tente buscar por termos como <em>agenda</em>, <em>comandas</em>, <em>payroll</em> ou <em>clientes</em>.
              </p>
            </div>
          ) : (
            <ul ref={listRef} className="space-y-1 list-none p-0 m-0">
              {filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = cmd.icon;

                return (
                  <li key={cmd.id}>
                    <button
                      type="button"
                      onClick={() => {
                        navigate(cmd.path);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-neutral-950 font-semibold shadow-sm'
                          : 'text-slate-700 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? 'bg-neutral-950/20 text-neutral-950'
                              : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold truncate">{cmd.title}</span>
                            <span
                              className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? 'bg-neutral-950/20 text-neutral-950'
                                  : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'
                              }`}
                            >
                              {cmd.category}
                            </span>
                          </div>
                          <p
                            className={`text-xs truncate mt-0.5 ${
                              isSelected ? 'text-neutral-900/90' : 'text-slate-500 dark:text-neutral-400'
                            }`}
                          >
                            {cmd.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs">
                        {isSelected && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold">
                            Abrir <ArrowRight size={13} />
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-950/70 border-t border-slate-200 dark:border-neutral-800 text-[11px] text-slate-500 dark:text-neutral-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-neutral-800 rounded text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-neutral-800 rounded text-[10px] font-mono">↓</kbd>
              Navegar
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-neutral-800 rounded text-[10px] font-mono">↵</kbd>
              Acessar
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <Command size={11} />
            <span>SMG Quick Navigation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
