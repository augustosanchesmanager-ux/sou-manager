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

const getPresetDates = (preset: DatePreset, currentStart?: string, currentEnd?: string): { start: string; end: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (preset) {
    case 'today': {
      return { start: today.toISOString().split('T')[0], end: today.toISOString().split('T')[0] };
    }
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday.toISOString().split('T')[0], end: yesterday.toISOString().split('T')[0] };
    }
    case 'last_7_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      const end = new Date(today);
      end.setDate(end.getDate() - 1);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    }
    case 'this_year': {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
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
    <div className={`space-y-3 ${className}`.trim()}>
      {showPresets && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(presetLabels) as DatePreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activePreset === preset
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-primary/10'
              }`}
            >
              {presetLabels[preset]}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
            De
          </label>
          <DatePickerInput
            value={startDate}
            onChange={handleStartDateChange}
            max={endDate}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-[#0f172a]"
          />
        </div>

        <span className="mt-5 text-slate-400">→</span>

        <div className="flex-1">
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
            Ate
          </label>
          <DatePickerInput
            value={endDate}
            onChange={handleEndDateChange}
            min={startDate}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-[#0f172a]"
          />
        </div>
      </div>

      {(startDate || endDate) && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Periodo: <span className="font-bold">{formatDisplayDate(startDate)}</span> ate{' '}
          <span className="font-bold">{formatDisplayDate(endDate)}</span>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
export type { DatePreset, DateRangeFilterProps };