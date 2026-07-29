/**
 * [SMG][SHARED][UTIL] dateRange
 *
 * Utilitários de data para filtros de período.
 * Substitui 3+ cópias de formatDateInputValue, parseDateInputValue, applyQuickRange.
 *
 * Canonical source: pages/Comandas.tsx:174-748
 * Migração: Fase 2.1 — Padronização
 */

export type QuickRange = 'today' | '7d' | '30d' | 'all' | 'custom';

/**
 * Formata Date para input type="date" (YYYY-MM-DD).
 */
export const formatDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Converte string YYYY-MM-DD para Date.
 * Se endOfDay = true, retorna 23:59:59.999.
 * Retorna null para entradas inválidas.
 */
export const parseDateInputValue = (
  value: string,
  endOfDay = false,
): Date | null => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Calcula as datas de início e fim para um QuickRange.
 * Retorna { from, to } onde cada valor é string YYYY-MM-DD ou vazio.
 */
export const getQuickRangeDates = (
  range: QuickRange,
): { from: string; to: string } => {
  const today = new Date();

  if (range === 'all') return { from: '', to: '' };
  if (range === 'custom') return { from: '', to: '' };

  const startDate = new Date(today);
  if (range === '7d') startDate.setDate(startDate.getDate() - 6);
  if (range === '30d') startDate.setDate(startDate.getDate() - 29);

  return {
    from: formatDateInputValue(range === 'today' ? today : startDate),
    to: formatDateInputValue(today),
  };
};

/**
 * Formata um intervalo de datas para exibição em pt-BR.
 * Ex: "01/07/2026 – 20/07/2026"
 */
export const formatDateRange = (
  from: string | null | undefined,
  to: string | null | undefined,
): string => {
  const startDate = parseDateInputValue(from || '');
  const endDate = parseDateInputValue(to || '', true);
  if (!startDate && !endDate) return 'Todo o período';
  if (startDate && !endDate)
    return `A partir de ${startDate.toLocaleDateString('pt-BR')}`;
  if (!startDate && endDate)
    return `Até ${endDate.toLocaleDateString('pt-BR')}`;
  return `${startDate!.toLocaleDateString('pt-BR')} – ${endDate!.toLocaleDateString('pt-BR')}`;
};
