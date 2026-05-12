import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import type { Service, Staff, Client, QuickAppointmentFormState, NewClientFormState } from '../types';

interface QuickScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  onCreateClient: (e: React.FormEvent) => Promise<void>;
  isSubmittingAppointment: boolean;
  isSubmittingClient: boolean;
}

export const QuickScheduleModal: React.FC<QuickScheduleModalProps> = ({
  isOpen,
  onClose,
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
  onCreateClient,
  isSubmittingAppointment,
  isSubmittingClient,
}) => {
  const navigate = useNavigate();
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
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

  const handleClose = () => {
    setShowNewClientForm(false);
    setShowClientSuggestions(false);
    onClose();
  };

  const handleClientCreated = (createdClient: Client) => {
    setFormData({
      ...formData,
      clientSearch: createdClient.name,
      selectedClientId: createdClient.id,
    });
    setShowNewClientForm(false);
    setNewClientForm({ name: '', phone: '', email: '' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo Agendamento"
      maxWidth="lg"
    >
      {!showNewClientForm ? (
        <form onSubmit={onSubmit} className="space-y-5">
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
                {selectedStaff?.name || 'Selecionar...'}
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
                      {staff.name}
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

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmittingAppointment}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingAppointment ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined">check_circle</span>
              )}
              Confirmar Agendamento
            </button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={onCreateClient} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Nome
            </label>
            <input
              type="text"
              value={newClientForm.name}
              onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
              placeholder="Nome do cliente"
              className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary/50"
              required
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Telefone
            </label>
            <input
              type="tel"
              value={newClientForm.phone}
              onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary/50"
              required
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-2">
              Email (opcional)
            </label>
            <input
              type="email"
              value={newClientForm.email}
              onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
              placeholder="email@exemplo.com"
              className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmittingClient}
              className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmittingClient ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined">person_add</span>
              )}
              Cadastrar Cliente
            </button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowNewClientForm(false)}
            >
              Voltar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default QuickScheduleModal;