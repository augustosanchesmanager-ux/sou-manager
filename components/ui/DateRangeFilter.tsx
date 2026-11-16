import React, { useState, useCallback } from 'react';
import DatePickerInput from './DatePickerInput';

type DatePreset = 'today' | 'yesterday' | 'last_7_days' | 'this_month' | 'last_month' | 'this_year' | 'custom';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onPresetChange?: (preset: DatePreset) => void;
  className?: string;
  showPresets?: boolean;
}

const formatLocalYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getPresetDates = (preset: DatePreset, currentStart?: string, currentEnd?: string): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today': {
      return { start: formatLocalYMD(today), end: formatLocalYMD(today) };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: formatLocalYMD(yesterday), end: formatLocalYMD(yesterday) };
    }
    case 'last_7_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(today);
      end.setDate(end.getDate() - 1);
      return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
    }
    case 'this_year': {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return { start: formatLocalYMD(start), end: formatLocalYMD(end) };
    }
    case 'custom':
    default:
      return { start: currentStart || '', end: currentEnd || '' };
  }
};

const presetLabels: Record<DatePreset, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  last_7_days: 'Últimos 7 dias',
  this_month: 'Este mês',
  last_month: 'Mês passado',
  this_year: 'Este ano',
  custom: 'Personalizado',
};

// Campos do período usam os tokens do design system (flipam no tema) e não a
// paleta legada slate/#0f172a. `w-[9.75rem]` é o mínimo que evita truncar
// "01/11/2026" depois do `pr-11` que o DatePickerInput reserva para o ícone.
const fieldClassName =
  'rounded-lg border border-line bg-card px-2 py-1.5 text-xs font-bold text-ink outline-none transition-colors focus:border-primary focus-visible:ring-2 focus-visible:ring-primary';

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onPresetChange,
  className = '',
  showPresets = true,
}) => {
  const [activePreset, setActivePreset] = useState<DatePreset>('this_month');

  const handlePresetClick = useCallback((preset: DatePreset) => {
    setActivePreset(preset);
    const { start, end } = getPresetDates(preset, startDate, endDate);
    onStartDateChange(start);
    onEndDateChange(end);
    onPresetChange?.(preset);
  }, [onStartDateChange, onEndDateChange, onPresetChange, startDate, endDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onStartDateChange(value);
    if (activePreset !== 'custom') {
      setActivePreset('custom');
      onPresetChange?.('custom');
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onEndDateChange(value);
    if (activePreset !== 'custom') {
      setActivePreset('custom');
      onPresetChange?.('custom');
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className={`flex flex-wrap items-end gap-2 ${className}`.trim()}>
      {showPresets && (
        <select
          value={activePreset}
          onChange={(e) => handlePresetClick(e.target.value as DatePreset)}
          aria-label="Período"
          className={`${fieldClassName} max-w-[140px]`}
        >
          {(Object.keys(presetLabels) as DatePreset[]).map((preset) => (
            <option key={preset} value={preset}>
              {presetLabels[preset]}
            </option>
          ))}
        </select>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <DatePickerInput
          value={startDate}
          onChange={handleStartDateChange}
          max={endDate}
          className={`${fieldClassName} w-[9.75rem]`}
        />

        <span className="text-ink-soft text-xs mx-1">até</span>

        <DatePickerInput
          value={endDate}
          onChange={handleEndDateChange}
          min={startDate}
          className={`${fieldClassName} w-[9.75rem]`}
        />
      </div>
    </div>
  );
};

export default DateRangeFilter;
export type { DatePreset, DateRangeFilterProps };