import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

const timeSlots = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00

interface DBStaff {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

interface DBService {
  id: string;
  name: string;
  duration: number;
}

interface DBClient {
  id: string;
  name: string;
  phone: string;
}

interface CalendarAppointment {
  id: string;
  staffId: string;
  start: number;
  duration: number;
  client: string;
  service: string;
  status: string;
  color: string;
}

interface NewAppointmentForm {
  client: string;
  clientPhone?: string;
  service: string;
  staffId: string;
  date: string;
  start: number;
  duration: number;
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-500',
  pending: 'bg-amber-500',
  completed: 'bg-emerald-500',
};

const roleLabels: Record<string, string> = { Manager: 'Gerente', Barber: 'Barbeiro', Receptionist: 'Recepcionista' };

const Schedule: React.FC = () => {
  const { tenantId } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data from Supabase
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [servicesList, setServicesList] = useState<DBService[]>([]);
  const [clientsList, setClientsList] = useState<DBClient[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<NewAppointmentForm>({
    client: '',
    clientPhone: '',
    service: '',
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    start: 8,
    duration: 1
  });

  // Client Autocomplete State
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<DBClient[]>([]);
  const [isNewClientMode, setIsNewClientMode] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Fetch base data
  const fetchBaseData = useCallback(async () => {
    const [staffRes, servicesRes, clientsRes] = await Promise.all([
      supabase.from('staff').select('id, name, role, avatar').eq('status', 'active').in('role', ['Barber', 'Manager']),
      supabase.from('services').select('id, name, duration').eq('active', true),
      supabase.from('clients').select('id, name, phone').order('name'),
    ]);
    if (staffRes.data) setStaffList(staffRes.data);
    if (servicesRes.data) setServicesList(servicesRes.data);
    if (clientsRes.data) { setClientsList(clientsRes.data); setFilteredClients(clientsRes.data); }
  }, []);

  // Fetch appointments for the selected date
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dayStart = `${year}-${month}-${day}T00:00:00`;
    const dayEnd = `${year}-${month}-${day}T23:59:59`;

    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .neq('status', 'cancelled');

    if (data) {
      const mapped: CalendarAppointment[] = data.map(apt => {
        const d = new Date(apt.start_time);
        const startHour = d.getHours() + d.getMinutes() / 60;
        return {
          id: apt.id,
          staffId: apt.staff_id,
          start: startHour,
          duration: Number(apt.duration) || 1,
          client: apt.client_name || 'Cliente',
          service: apt.service_name || 'Serviço',
          status: apt.status,
          color: statusColors[apt.status] || 'bg-blue-500',
        };
      });
      setAppointments(mapped);
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { fetchBaseData(); }, [fetchBaseData]);
  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync modal date with selected view date
  useEffect(() => {
    if (isModalOpen) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setFormData(prev => ({ ...prev, date: `${year}-${month}-${day}`, staffId: prev.staffId || (staffList[0]?.id ?? '') }));
    }
  }, [isModalOpen, selectedDate, staffList]);

  const handleInputChange = (field: keyof NewAppointmentForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);

    if (field === 'service') {
      const selectedService = servicesList.find(s => s.name === value);
      if (selectedService) {
        setFormData(prev => ({ ...prev, service: value, duration: selectedService.duration / 60 }));
      }
    }

    if (field === 'client') {
      const filtered = clientsList.filter(c =>
        c.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredClients(filtered);
      setShowClientSuggestions(true);
      setIsNewClientMode(false);
    }
  };

  const selectClient = (clientName: string) => {
    setFormData(prev => ({ ...prev, client: clientName, clientPhone: '' }));
    setShowClientSuggestions(false);
    setIsNewClientMode(false);
  };

  const enableNewClientMode = () => {
    setIsNewClientMode(true);
    setShowClientSuggestions(false);
  };

  const handleSave = async () => {
    if (!formData.client || !formData.service) {
      setError("Por favor, preencha o nome do cliente e o serviço.");
      return;
    }

    if (isNewClientMode && !formData.clientPhone) {
      setError("Para novos clientes, informe um telefone de contato.");
      return;
    }

    const selectedService = servicesList.find(s => s.name === formData.service);
    const selectedStaff = staffList.find(s => s.id === formData.staffId);

    // Save new client if needed
    let clientId: string | null = null;
    if (isNewClientMode) {
      const { data: newClient, error: clientError } = await supabase.from('clients').insert({
        name: formData.client,
        phone: formData.clientPhone || '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.client)}&background=random`,
        tenant_id: tenantId
      }).select().single();
      if (clientError) { setError('Erro ao cadastrar cliente.'); return; }
      clientId = newClient.id;
      setClientsList(prev => [...prev, newClient]);
    } else {
      const existing = clientsList.find(c => c.name.toLowerCase() === formData.client.toLowerCase());
      if (existing) clientId = existing.id;
    }

    const startHours = Math.floor(formData.start);
    const startMinutes = (formData.start % 1) * 60;
    const startTime = new Date(`${formData.date}T${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:00`);

    const { data: savedApt, error: saveError } = await supabase.from('appointments').insert({
      client_id: clientId,
      service_id: selectedService?.id || null,
      staff_id: formData.staffId || null,
      client_name: formData.client,
      service_name: formData.service,
      staff_name: selectedStaff?.name || '',
      start_time: startTime.toISOString(),
      duration: Number(formData.duration),
      status: 'confirmed',
      tenant_id: tenantId
    }).select().single();

    if (saveError) { setError('Erro ao salvar agendamento.'); return; }

    // AUTOMATION: Create Comanda
    if (savedApt) {
      const { data: comanda } = await supabase.from('comandas').insert({
        appointment_id: savedApt.id,
        client_id: clientId,
        staff_id: formData.staffId || null,
        status: 'open',
        total: selectedService?.duration ? 0 : 0, // Price logic could be here, but we start at 0 and add item
        tenant_id: tenantId
      }).select().single();

      if (comanda && selectedService) {
        // Fetch service price if possible, or use a default
        const { data: serviceData } = await supabase.from('services').select('price').eq('id', selectedService.id).single();

        await supabase.from('comanda_items').insert({
          comanda_id: comanda.id,
          service_id: selectedService.id,
          product_name: selectedService.name,
          quantity: 1,
          unit_price: serviceData?.price || 0,
          tenant_id: tenantId
        });

        // Update comanda total
        await supabase.from('comandas').update({ total: serviceData?.price || 0 }).eq('id', comanda.id);
      }
    }

    setToast({ message: 'Agendamento criado com sucesso!', type: 'success' });
    setIsModalOpen(false);
    setIsNewClientMode(false);
    setFormData({ client: '', clientPhone: '', service: '', staffId: staffList[0]?.id ?? '', date: formData.date, start: 8, duration: 1 });
    fetchAppointments();
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in relative">
      {/* Schedule Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-4 bg-white dark:bg-surface-dark p-1.5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() - 1);
              setSelectedDate(newDate);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="flex items-center gap-2 px-2 text-slate-900 dark:text-white font-bold min-w-[180px] justify-center">
            <span className="material-symbols-outlined text-primary">calendar_month</span>
            <span>{formatDateDisplay(selectedDate)}</span>
          </div>
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() + 1);
              setSelectedDate(newDate);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-surface-dark p-1 rounded-lg border border-slate-200 dark:border-border-dark">
            <button className="px-4 py-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm rounded-md text-xs font-bold transition-all">Dia</button>
            <button className="px-4 py-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all">Semana</button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span className="hidden sm:inline">Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="flex-1 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col shadow-sm">

        {/* Resources Header */}
        <div className="flex border-b border-slate-200 dark:border-border-dark">
          <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5"></div>
          <div className="flex-1 flex">
            {staffList.length === 0 ? (
              <div className="flex-1 py-4 text-center text-sm text-slate-500">Nenhum profissional encontrado</div>
            ) : (
              staffList.map(resource => (
                <div key={resource.id} className="flex-1 py-4 px-2 border-r border-slate-200 dark:border-border-dark last:border-r-0 flex flex-col items-center justify-center gap-2">
                  <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-slate-100 dark:border-slate-600 bg-cover bg-center"
                    style={{ backgroundImage: `url(${resource.avatar || ''})` }}>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{resource.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">{roleLabels[resource.role] || resource.role}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Time Grid Scrollable Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="flex min-h-[800px]">
              {/* Time Axis */}
              <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 flex flex-col">
                {timeSlots.map(hour => (
                  <div key={hour} className="flex-1 border-b border-slate-200 dark:border-border-dark text-xs font-bold text-slate-400 flex items-start justify-center pt-2 relative">
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Columns */}
              <div className="flex-1 flex relative">
                {/* Background Grid Lines */}
                <div className="absolute inset-0 flex flex-col z-0">
                  {timeSlots.map(hour => (
                    <div key={hour} className="flex-1 border-b border-slate-100 dark:border-border-dark/50"></div>
                  ))}
                </div>

                {staffList.map(resource => (
                  <div key={resource.id} className="flex-1 border-r border-slate-200 dark:border-border-dark last:border-r-0 relative z-10 group">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-slate-50/50 dark:bg-white/[0.02] pointer-events-none transition-opacity"></div>

                    {/* Render Appointments */}
                    {appointments
                      .filter(apt => apt.staffId === resource.id)
                      .map((apt, idx) => {
                        const startOffset = (apt.start - 8) * (100 / 13);
                        const height = apt.duration * (100 / 13);

                        // Pick a color based on staff list index
                        const staffIndex = staffList.findIndex(s => s.id === resource.id);
                        const barberColors = ['bg-barber-1', 'bg-barber-2', 'bg-barber-3', 'bg-barber-4', 'bg-barber-5', 'bg-barber-6'];
                        const borderColors = ['border-barber-1', 'border-barber-2', 'border-barber-3', 'border-barber-4', 'border-barber-5', 'border-barber-6'];
                        const barberColor = barberColors[staffIndex % barberColors.length];
                        const borderColor = borderColors[staffIndex % borderColors.length];

                        return (
                          <div
                            key={apt.id}
                            className={`absolute left-1 right-1 rounded-lg p-2 border-l-4 ${borderColor} ${barberColor} hover:brightness-110 cursor-pointer transition-all shadow-md flex flex-col justify-center z-20 overflow-hidden`}
                            style={{ top: `${startOffset}%`, height: `${height}%` }}
                          >
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/20 text-white uppercase tracking-tighter">
                                {Math.floor(apt.start)}:{apt.start % 1 === 0 ? '00' : '30'}
                              </span>
                              {apt.status === 'confirmed' && <span className="material-symbols-outlined text-[14px] text-white/90">check_circle</span>}
                            </div>
                            <p className="text-xs font-black text-white truncate leading-tight mt-0.5 drop-shadow-sm">{apt.client}</p>
                            <p className="text-[10px] text-white/90 font-bold truncate drop-shadow-sm">{apt.service}</p>
                          </div>
                        );
                      })
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Appointment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setIsNewClientMode(false); setError(null); }}
        title="Novo Agendamento"
        maxWidth="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">error</span>
              <p className="text-xs text-red-600 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

          {/* Client Autocomplete */}
          <div className="relative" ref={searchWrapperRef}>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Cliente</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar ou cadastrar cliente..."
                value={formData.client}
                onChange={(e) => handleInputChange('client', e.target.value)}
                onFocus={() => setShowClientSuggestions(true)}
                className={`w-full bg-slate-50 dark:bg-background-dark border ${isNewClientMode ? 'border-primary' : 'border-slate-200 dark:border-border-dark'} rounded-lg p-2.5 pl-9 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none`}
              />
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            </div>

            {isNewClientMode && (
              <div className="mt-2 animate-fade-in bg-primary/5 p-3 rounded-lg border border-primary/20">
                <label className="block text-xs font-bold uppercase text-primary mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Novo Cadastro
                </label>
                <input
                  type="tel"
                  placeholder="Telefone (Obrigatório)"
                  value={formData.clientPhone}
                  onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                  className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            )}

            {showClientSuggestions && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                {filteredClients.length > 0 ? (
                  filteredClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectClient(c.name)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-white/5 flex flex-col border-b border-slate-50 dark:border-border-dark last:border-0"
                    >
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</span>
                      <span className="text-xs text-slate-500">{c.phone}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-center">
                    <p className="text-xs text-slate-500 mb-2">Cliente não encontrado.</p>
                    <button
                      onClick={enableNewClientMode}
                      className="w-full py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-bold uppercase transition-colors"
                    >
                      Cadastrar "{formData.client}"
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service Select */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Serviço</label>
            <div className="relative">
              <select
                value={formData.service}
                onChange={(e) => handleInputChange('service', e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="" disabled className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Selecione um serviço...</option>
                {servicesList.map(s => (
                  <option key={s.id} value={s.name} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{s.name} ({s.duration} min)</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Profissional</label>
            <div className="relative">
              <select
                value={formData.staffId}
                onChange={(e) => handleInputChange('staffId', e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
              >
                {staffList.map(r => (
                  <option key={r.id} value={r.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{r.name} - {roleLabels[r.role] || r.role}</option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Horário</label>
              <div className="relative">
                <select
                  value={formData.start}
                  onChange={(e) => handleInputChange('start', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {Array.from({ length: 25 }, (_, i) => 8 + i * 0.5).map(slot => (
                    <option key={slot} value={slot} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                      {Math.floor(slot)}:{slot % 1 === 0 ? '00' : '30'}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">schedule</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Duração (h)</label>
              <div className="relative">
                <select
                  value={formData.duration}
                  onChange={(e) => handleInputChange('duration', Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="0.25" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">15 min</option>
                  <option value="0.5" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">30 min</option>
                  <option value="0.75" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">45 min</option>
                  <option value="1" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">1h</option>
                  <option value="1.5" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">1h 30m</option>
                  <option value="2" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">2h</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">hourglass_empty</span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={() => { setIsModalOpen(false); setIsNewClientMode(false); setError(null); }}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Schedule;