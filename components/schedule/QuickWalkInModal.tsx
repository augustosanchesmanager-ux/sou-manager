import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal';
import { validateWalkInForm } from '../../src/utils/barberQueue';

export interface QuickWalkInPayload {
  clientName: string;
  clientPhone?: string;
  clientId?: string;
  staffId: string;
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
}

export interface QuickWalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: Array<{ id: string; name: string }>;
  servicesList: Array<{ id: string; name: string; price: number; duration: number }>;
  clientsList: Array<{ id: string; name: string; phone?: string }>;
  defaultStaffId?: string;
  onSubmitWalkIn: (payload: QuickWalkInPayload) => Promise<void>;
  isSubmitting?: boolean;
}

export const QuickWalkInModal: React.FC<QuickWalkInModalProps> = ({
  isOpen,
  onClose,
  staffList,
  servicesList,
  clientsList,
  defaultStaffId,
  onSubmitWalkIn,
  isSubmitting = false,
}) => {
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientPhone, setClientPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Inicializar staffId padrão e resetar formulário ao abrir
  useEffect(() => {
    if (isOpen) {
      setClientSearch('');
      setSelectedClientId(null);
      setClientPhone('');
      setSelectedServiceId(servicesList[0]?.id || '');
      setSelectedStaffId(defaultStaffId || staffList[0]?.id || '');
      setFormError(null);
      setShowSuggestions(false);
    }
  }, [isOpen, defaultStaffId, staffList, servicesList]);

  // Busca filtrada de clientes com debounce implícito por render
  const filteredClients = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    if (!term || selectedClientId) return [];
    return clientsList
      .filter((c) => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)))
      .slice(0, 5);
  }, [clientSearch, clientsList, selectedClientId]);

  const handleSelectClient = (client: { id: string; name: string; phone?: string }) => {
    setSelectedClientId(client.id);
    setClientSearch(client.name);
    setClientPhone(client.phone || '');
    setShowSuggestions(false);
    setFormError(null);
  };

  const handleClientInputChange = (value: string) => {
    setClientSearch(value);
    setSelectedClientId(null); // Volta a ser digitação livre se alterar
    setShowSuggestions(true);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateWalkInForm({
      clientName: clientSearch,
      serviceId: selectedServiceId,
      staffId: selectedStaffId,
    });

    if (!validation.isValid) {
      setFormError(validation.error || 'Dados inválidos.');
      return;
    }

    const service = servicesList.find((s) => s.id === selectedServiceId);
    if (!service) {
      setFormError('Serviço selecionado não encontrado.');
      return;
    }

    try {
      await onSubmitWalkIn({
        clientName: clientSearch.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientId: selectedClientId || undefined,
        staffId: selectedStaffId,
        serviceId: service.id,
        serviceName: service.name,
        price: Number(service.price) || 0,
        duration: Number(service.duration) || 0.5,
      });
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Falha ao iniciar encaixe rápido.');
    }
  };

  const selectedService = servicesList.find((s) => s.id === selectedServiceId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Encaixe Rápido na Cadeira"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Inicia o atendimento imediatamente em status <span className="font-bold text-sky-600 dark:text-sky-400">Em Atendimento</span> e gera a comanda vinculada no caixa.
        </p>

        {formError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs font-bold text-red-600 dark:text-red-400 animate-fade-in">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{formError}</span>
          </div>
        )}

        {/* Profissional da Cadeira */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Cadeira / Profissional
          </label>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1A1A1A] p-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>

        {/* Cliente (Busca ou Nome Livre) */}
        <div className="relative">
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Cliente (Nome ou Busca)
          </label>
          <div className="relative">
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => handleClientInputChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Ex: Pedro Henrique"
              autoFocus
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1A1A1A] pl-9 pr-3 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              person
            </span>
          </div>

          {/* Sugestões de Clientes Cadastrados */}
          {showSuggestions && filteredClients.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-1 shadow-lg">
              <div className="px-2 py-1 text-[10px] font-black uppercase text-slate-400">Clientes encontrados</div>
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left"
                >
                  <span className="font-bold">{client.name}</span>
                  <span className="text-[10px] text-slate-400">{client.phone || 'Sem telefone'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Telefone Opcional */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Telefone / WhatsApp (Opcional)
          </label>
          <div className="relative">
            <input
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1A1A1A] pl-9 pr-3 py-2 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              phone
            </span>
          </div>
        </div>

        {/* Serviço */}
        <div>
          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
            Serviço
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
            {servicesList.map((service) => {
              const isSelected = selectedServiceId === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setFormError(null);
                  }}
                  className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-400/10 text-slate-900 dark:text-white shadow-xs'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="text-xs font-bold truncate">{service.name}</span>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="font-extrabold text-amber-600 dark:text-amber-400">
                      R$ {Number(service.price).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {Math.round(Number(service.duration) * 60)} min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumo do Encaixe */}
        {selectedService && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">
                timer
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Entrada Imediata
                </p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedService.name} (R$ {Number(selectedService.price).toFixed(2).replace('.', ',')})
                </p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">
              Cadeira Agora
            </span>
          </div>
        )}

        {/* Botão de Encaixe com Ergonomia de Polegar */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm py-3.5 shadow-lg shadow-amber-400/20 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                <span>Iniciando na cadeira...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">play_circle</span>
                <span>Iniciar Atendimento Imediato</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default QuickWalkInModal;
