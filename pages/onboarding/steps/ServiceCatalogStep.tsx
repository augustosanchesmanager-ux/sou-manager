import React from 'react';

export interface ServiceRow {
  key: string;
  name: string;
  category: string;
  price: string;
  duration: string;
}

export interface OperationalForm {
  week: Record<string, { open: string; close: string } | null>;
  intervalMinutes: number;
  durationMinutes: number;
  bookingHorizonDays: number;
  staffOwnedSchedule: boolean;
}

export const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

export const DEFAULT_WEEK: Record<string, { open: string; close: string } | null> = {
  mon: { open: '09:00', close: '19:00' },
  tue: { open: '09:00', close: '19:00' },
  wed: { open: '09:00', close: '19:00' },
  thu: { open: '09:00', close: '19:00' },
  fri: { open: '09:00', close: '20:00' },
  sat: { open: '09:00', close: '19:00' },
  sun: null,
};

export const INTERVAL_OPTIONS = [15, 30, 45, 60];
export const DURATION_OPTIONS = [30, 45, 60, 90, 120];

export const SERVICE_CATEGORIES = ['Cabelo', 'Barba', 'Combo', 'Química', 'Acabamento', 'Outros'];

export const createDefaultServiceRows = (): ServiceRow[] => [
  { key: 'default-1', name: 'Corte masculino', category: 'Cabelo', price: '65', duration: '45' },
  { key: 'default-2', name: 'Barba', category: 'Barba', price: '55', duration: '35' },
  { key: 'default-3', name: 'Corte + Barba', category: 'Combo', price: '105', duration: '70' },
];

const INPUT_CLASS =
  'w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium';

const SELECT_CLASS =
  'w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium appearance-none [color-scheme:light] dark:[color-scheme:dark]';

interface ServiceCatalogStepProps {
  operational: OperationalForm;
  onOperationalChange: (patch: Partial<OperationalForm>) => void;
  onToggleDay: (key: string) => void;
  onUpdateDayTime: (key: string, field: 'open' | 'close', value: string) => void;
  servicesLoading: boolean;
  existingServicesCount: number;
  serviceRows: ServiceRow[];
  onRowsChange: (rows: ServiceRow[]) => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onContinue: () => void;
  loading: boolean;
}

/**
 * Passo 2 — "Como você atende".
 * Horário de funcionamento (movido de OperationalSetup) + catálogo inicial.
 */
const ServiceCatalogStep: React.FC<ServiceCatalogStepProps> = ({
  operational,
  onOperationalChange,
  onToggleDay,
  onUpdateDayTime,
  servicesLoading,
  existingServicesCount,
  serviceRows,
  onRowsChange,
  onAddRow,
  onRemoveRow,
  onContinue,
  loading,
}) => {
  const updateRow = (key: string, patch: Partial<ServiceRow>) => {
    onRowsChange(serviceRows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-border-dark">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Horário de funcionamento</h2>
          <p className="text-xs text-slate-400">Toque no dia para abrir/fechar a barbearia.</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-border-dark">
          {DAYS.map((day) => {
            const isOpen = Boolean(operational.week[day.key]);
            return (
              <div key={day.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleDay(day.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      isOpen ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
                    }`}
                    aria-pressed={isOpen}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                        isOpen ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <span
                    className={`text-sm font-bold ${
                      isOpen ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
                {isOpen && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={operational.week[day.key]?.open ?? '09:00'}
                      onChange={(e) => onUpdateDayTime(day.key, 'open', e.target.value)}
                      className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                    <span className="text-slate-400 text-sm font-bold">às</span>
                    <input
                      type="time"
                      value={operational.week[day.key]?.close ?? '19:00'}
                      onChange={(e) => onUpdateDayTime(day.key, 'close', e.target.value)}
                      className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm p-5 space-y-5">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Intervalo entre horários</p>
            <p className="text-xs text-slate-400">Espaço entre um atendimento e outro na agenda.</p>
          </div>
          <select
            value={operational.intervalMinutes}
            onChange={(e) => onOperationalChange({ intervalMinutes: Number(e.target.value) })}
            className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                {opt} min
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Duração padrão dos serviços</p>
            <p className="text-xs text-slate-400">Usado quando um serviço não define duração própria.</p>
          </div>
          <select
            value={operational.durationMinutes}
            onChange={(e) => onOperationalChange({ durationMinutes: Number(e.target.value) })}
            className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                {opt} min
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Clientes podem agendar até</p>
            <p className="text-xs text-slate-400">Horizonte máximo de agendamento online.</p>
          </div>
          <select
            value={operational.bookingHorizonDays}
            onChange={(e) => onOperationalChange({ bookingHorizonDays: Number(e.target.value) })}
            className="bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
          >
            {[15, 30, 60, 90].map((opt) => (
              <option key={opt} value={opt} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                {opt} dias
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Agenda por barbeiro</p>
            <p className="text-xs text-slate-400">Cada barbeiro mantém sua própria agenda de horários.</p>
          </div>
          <button
            onClick={() => onOperationalChange({ staffOwnedSchedule: !operational.staffOwnedSchedule })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              operational.staffOwnedSchedule ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'
            }`}
            aria-pressed={operational.staffOwnedSchedule}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                operational.staffOwnedSchedule ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {servicesLoading ? (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-10 text-center text-slate-400 text-sm">
          Carregando serviços...
        </div>
      ) : existingServicesCount > 0 ? (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Seu catálogo</h2>
          <p className="text-xs text-slate-400">
            Seu catálogo já está no ar — {existingServicesCount} serviço(s). Você poderá editar em Serviços.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-border-dark">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Catálogo inicial de serviços</h2>
            <p className="text-xs text-slate-400">Comece com 3 serviços sugeridos. Você pode editar depois.</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-border-dark">
            {serviceRows.map((row, idx) => (
              <div key={row.key} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Serviço {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.key)}
                    disabled={serviceRows.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                    title="Remover serviço"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Nome</label>
                    <input
                      type="text"
                      placeholder="Ex: Corte Degradê"
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Categoria</label>
                    <select
                      value={row.category}
                      onChange={(e) => updateRow(row.key, { category: e.target.value })}
                      className={SELECT_CLASS}
                    >
                      {SERVICE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Duração (min)</label>
                    <input
                      type="number"
                      min={1}
                      value={row.duration}
                      onChange={(e) => updateRow(row.key, { duration: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Preço (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={row.price}
                        onChange={(e) => updateRow(row.key, { price: e.target.value })}
                        className={`${INPUT_CLASS} pl-10`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-100 dark:border-border-dark">
            <button
              type="button"
              onClick={onAddRow}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg px-3 py-2 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Adicionar serviço
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={onContinue}
          disabled={loading}
          className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Continuar'}
          {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
        </button>
      </div>
    </div>
  );
};

export default ServiceCatalogStep;