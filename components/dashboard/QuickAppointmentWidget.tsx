import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Service, Staff, Client, QuickAppointmentFormState, NewClientFormState } from '../../src/modules/dashboard/types';

interface QuickAppointmentWidgetProps {
  formData: QuickAppointmentFormState;
  setFormData: React.Dispatch<React.SetStateAction<QuickAppointmentFormState>>;
  filteredClients: Client[];
  showClientSuggestions: boolean;
  setShowClientSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  servicesList: Service[];
  staffList: Staff[];
  newClientForm: NewClientFormState;
  setNewClientForm: React.Dispatch<React.SetStateAction<NewClientFormState>>;
  onOpenNewClientModal: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
}

export const QuickAppointmentWidget: React.FC<QuickAppointmentWidgetProps> = ({
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
}) => {
  const navigate = useNavigate();
  const [isMinimized, setIsMinimized] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLDivElement>(null);
  const staffRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (serviceRef.current && !serviceRef.current.contains(e.target as Node)) {
        setShowServiceDropdown(false);
      }
      if (staffRef.current && !staffRef.current.contains(e.target as Node)) {
        setShowStaffDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedService = servicesList.find((s) => s.id === formData.serviceId);
  const selectedStaff = staffList.find((s) => s.id === formData.staffId);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="w-full p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between hover:bg-primary/20 transition-colors"
      >
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined">add_circle</span>
          <span className="font-bold text-sm">Novo Agendamento</span>
        </div>
        <span className="material-symbols-outlined text-primary">expand_less</span>
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">bolt</span>
          <h3 className="font-bold text-slate-900 dark:text-white">Novo Agendamento</h3>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">expand_less</span>
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-5 space-y-4">
        <div className="relative">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
            Cliente
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              ref={clientInputRef}
              type="text"
              value={formData.clientSearch}
              onChange={(e) => {
                setFormData({ ...formData, clientSearch: e.target.value, selectedClientId: '' });
                setShowClientSuggestions(true);
              }}
              onFocus={() => setShowClientSuggestions(true)}
              placeholder="Buscar cliente..."
              className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
            <button
              type="button"
              onClick={onOpenNewClientModal}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>
          </div>

          {showClientSuggestions && formData.clientSearch && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <div className="p-3 text-center text-sm text-slate-500">
                  Nenhum cliente encontrado
                </div>
              ) : (
                filteredClients.slice(0, 5).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        clientSearch: client.name,
                        selectedClientId: client.id,
                      });
                      setShowClientSuggestions(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{client.name}</p>
                    <p className="text-xs text-slate-500">{client.phone}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative" ref={serviceRef}>
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Serviço
            </label>
            <button
              type="button"
              onClick={() => setShowServiceDropdown(!showServiceDropdown)}
              className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left text-sm text-slate-900 dark:text-white flex items-center justify-between"
            >
              {selectedService?.name || 'Selecionar...'}
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showServiceDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                {servicesList.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, serviceId: service.id });
                      setShowServiceDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {service.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={staffRef}>
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Profissional
            </label>
            <button
              type="button"
              onClick={() => setShowStaffDropdown(!showStaffDropdown)}
              className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left text-sm text-slate-900 dark:text-white flex items-center justify-between"
            >
              {selectedStaff?.full_name || 'Selecionar...'}
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showStaffDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                {staffList.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, staffId: staff.id });
                      setShowStaffDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {staff.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Data
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Horário
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <span className="material-symbols-outlined">check_circle</span>
          )}
          Confirmar Agendamento
        </button>
      </form>
    </div>
  );
};

export default QuickAppointmentWidget;