import React from 'react';
import DatePickerInput from '../../../../components/ui/DatePickerInput';
import type {
  DashboardClient,
  DashboardService,
  DashboardStaff,
  NewClientFormState,
  QuickAppointmentFormState,
} from '../types';

interface QuickAppointmentCardProps {
  formData: QuickAppointmentFormState;
  setFormData: React.Dispatch<React.SetStateAction<QuickAppointmentFormState>>;
  filteredClients: DashboardClient[];
  showClientSuggestions: boolean;
  setShowClientSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  servicesList: DashboardService[];
  staffList: DashboardStaff[];
  newClientForm: NewClientFormState;
  setNewClientForm: React.Dispatch<React.SetStateAction<NewClientFormState>>;
  onOpenNewClientModal: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
}

export const QuickAppointmentCard: React.FC<QuickAppointmentCardProps> = ({
  formData,
  setFormData,
  filteredClients,
  showClientSuggestions,
  setShowClientSuggestions,
  servicesList,
  staffList,
  newClientForm,
  setNewClientForm,
  onOpenNewClientModal,
  onSubmit,
  isSubmitting,
}) => (
  <div className="card-boutique p-6">
    <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
      <span className="material-symbols-outlined text-primary">add_circle</span>
      Agendamento Rapido
    </h3>
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <DatePickerInput
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
            title="Data do Agendamento"
            value={formData.date}
            onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
          />
        </div>
        <div className="relative">
          <input
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
            type="time"
            title="Hora do Agendamento"
            value={formData.time}
            onChange={(event) => setFormData((current) => ({ ...current, time: event.target.value }))}
          />
        </div>
      </div>

      <div className="relative">
        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Cliente</label>
        <input
          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg text-sm py-2 px-3 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
          type="text"
          placeholder="Buscar ou cadastrar..."
          value={formData.clientSearch}
          onFocus={() => setShowClientSuggestions(true)}
          onChange={(event) => {
            setFormData((current) => ({
              ...current,
              clientSearch: event.target.value,
              selectedClientId: '',
            }));
            setShowClientSuggestions(true);
          }}
        />

        {showClientSuggestions && formData.clientSearch && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl max-h-40 overflow-y-auto">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    setFormData((current) => ({
                      ...current,
                      clientSearch: client.name,
                      selectedClientId: client.id,
                    }));
                    setShowClientSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-border-dark last:border-0"
                >
                  {client.name} <span className="text-[10px] text-slate-500">({client.phone || 'Sem tel'})</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-center">
                <p className="text-xs text-slate-500 mb-2">Cliente não encontrado.</p>
                <button
                  type="button"
                  onClick={() => {
                    setNewClientForm({ ...newClientForm, name: formData.clientSearch });
                    setShowClientSuggestions(false);
                    onOpenNewClientModal();
                  }}
                  className="w-full py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-bold uppercase transition-colors"
                >
                  <span className="material-symbols-outlined text-sm align-middle mr-1">person_add</span>
                  Cadastrar "{formData.clientSearch}"
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Barbeiro</label>
          <select
            value={formData.staffId}
            title="Selecionar Barbeiro"
            onChange={(event) => setFormData((current) => ({ ...current, staffId: event.target.value }))}
            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
          >
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                {staff.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Servico</label>
          <select
            value={formData.serviceId}
            title="Selecionar Servico"
            onChange={(event) => setFormData((current) => ({ ...current, serviceId: event.target.value }))}
            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
          >
            {servicesList.map((service) => (
              <option key={service.id} value={service.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                {service.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all hover:bg-blue-600 disabled:opacity-50"
      >
        {isSubmitting ? 'Confirmando...' : 'Confirmar'}
      </button>
    </form>
  </div>
);

