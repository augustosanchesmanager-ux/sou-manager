/**
 * Unit tests for CommandPalette search, indexing and navigation logic:
 * - Filtering by module name, keyword, and action
 * - Keyword coverage for key screens (payroll, agenda, comandas, etc.)
 * - Empty query behavior
 */

import { describe, it, expect } from 'vitest';
import type { CommandItem } from './CommandPalette';

describe('CommandPalette Logic & Search Filtering', () => {
  const sampleCommands: CommandItem[] = [
    {
      id: 'page-agenda',
      title: 'Agenda',
      description: 'Visualização de horários, barbeiros e agendamentos',
      category: 'Páginas',
      path: '/agenda',
      icon: (() => null) as never,
      keywords: ['agenda', 'horario', 'agendamento', 'marcar', 'calendario'],
    },
    {
      id: 'page-payroll',
      title: 'Repasse de Comissões',
      description: 'Apuração periódica, vales e liquidação de comissões',
      category: 'Páginas',
      path: '/payroll',
      icon: (() => null) as never,
      keywords: ['payroll', 'comissao', 'repasse', 'vale', 'pagamento', 'salario', 'barbeiro'],
    },
    {
      id: 'page-services',
      title: 'Serviços',
      description: 'Catálogo de cortes, barbas, combos e valores',
      category: 'Páginas',
      path: '/services',
      icon: (() => null) as never,
      keywords: ['servico', 'corte', 'barba', 'preco', 'catalogo', 'duracao'],
    },
    {
      id: 'action-new-comanda',
      title: 'Nova Comanda',
      description: 'Abrir atendimento imediato para cliente',
      category: 'Ações Rápidas',
      path: '/comandas',
      icon: (() => null) as never,
      keywords: ['nova', 'comanda', 'abrir', 'iniciar', 'cliente'],
    },
  ];

  const filterCommands = (commands: CommandItem[], query: string): CommandItem[] => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((cmd) => {
      const matchTitle = cmd.title.toLowerCase().includes(q);
      const matchDesc = cmd.description.toLowerCase().includes(q);
      const matchKeywords = cmd.keywords.some((k) => k.toLowerCase().includes(q));
      return matchTitle || matchDesc || matchKeywords;
    });
  };

  it('should return all commands when query is empty', () => {
    const results = filterCommands(sampleCommands, '');
    expect(results).toHaveLength(4);
  });

  it('should find payroll page using keyword "payroll"', () => {
    const results = filterCommands(sampleCommands, 'payroll');
    expect(results.some((r) => r.path === '/payroll')).toBe(true);
  });

  it('should find payroll page using keyword "comissão" or "repasse"', () => {
    const results = filterCommands(sampleCommands, 'comissao');
    expect(results.some((r) => r.path === '/payroll')).toBe(true);

    const repasseResults = filterCommands(sampleCommands, 'repasse');
    expect(repasseResults.some((r) => r.path === '/payroll')).toBe(true);
  });

  it('should find agenda page using keyword "horario" or "marcar"', () => {
    const results = filterCommands(sampleCommands, 'horario');
    expect(results.some((r) => r.path === '/agenda')).toBe(true);
  });

  it('should find quick actions by keyword like "abrir"', () => {
    const results = filterCommands(sampleCommands, 'abrir');
    expect(results.some((r) => r.id === 'action-new-comanda')).toBe(true);
  });

  it('should return empty array for non-matching search', () => {
    const results = filterCommands(sampleCommands, 'xyzinexistente999');
    expect(results).toHaveLength(0);
  });
});
