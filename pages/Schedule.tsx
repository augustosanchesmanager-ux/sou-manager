import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';



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
  buffer?: number;
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
  staffName: string;
  clientPhone: string;
  price: number;
  startTime: string;
  notes: string;
  date: string;
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
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data from Supabase
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [servicesList, setServicesList] = useState<DBService[]>([]);
  const [clientsList, setClientsList] = useState<DBClient[]>([]);
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [activePromotions, setActivePromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Week days (Mon-Sun of the week containing selectedDate)
  const getWeekDays = (date: Date): Date[] => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const wd = new Date(monday);
      wd.setDate(monday.getDate() + i);
      return wd;
    });
  };
  const weekDays = getWeekDays(selectedDate);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Lógica de Horário Dinâmico (Opção C: Expansão Automática)
  const displayEndHour = React.useMemo(() => {
    if (appointments.length === 0) return 20;
    const maxAptEndTime = Math.max(...appointments.map(a => a.start + a.duration));
    return Math.min(23, Math.max(20, Math.ceil(maxAptEndTime - 1)));
  }, [appointments]);

  const dynamicTimeSlots = React.useMemo(() => {
    return Array.from({ length: displayEndHour - 8 + 1 }, (_, i) => i + 8);
  }, [displayEndHour]);

  const totalSlots = dynamicTimeSlots.length;
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);

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
  const [chefClubInfo, setChefClubInfo] = useState<{ planName: string; credits: number; status: string } | null>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Fetch base data
  const fetchBaseData = useCallback(async () => {
    if (!tenantId) {
      setStaffList([]);
      setServicesList([]);
      setClientsList([]);
      setFilteredClients([]);
      return;
    }

    const [staffRes, servicesRes, clientsRes, promoRes] = await Promise.all([
      supabase.from('staff').select('id, name, role, avatar').eq('tenant_id', tenantId).eq('status', 'active').in('role', ['Barber', 'Manager']),
      supabase.from('services').select('id, name, duration, buffer, price').eq('tenant_id', tenantId).eq('active', true),
      supabase.from('clients').select('id, name, phone').eq('tenant_id', tenantId).order('name'),
      supabase.from('promotions').select('*').eq('tenant_id', tenantId).eq('active', true),
    ]);

    if (staffRes.data) setStaffList(staffRes.data);

    // Se a consulta de serviços falhar (ex: coluna buffer ausente), tenta sem o buffer
    if (servicesRes.error) {
      console.error('Erro ao buscar serviços com buffer:', servicesRes.error);
      const retryServices = await supabase.from('services').select('id, name, duration, price').eq('tenant_id', tenantId).eq('active', true);
      if (retryServices.data) setServicesList(retryServices.data);
    } else if (servicesRes.data) {
      setServicesList(servicesRes.data);
    }

    if (clientsRes.data) { setClientsList(clientsRes.data); setFilteredClients(clientsRes.data); }
    if (promoRes.data) {
      const now = new Date();
      const validPromos = promoRes.data.filter((p: any) => {
        const start = new Date(p.start_date);
        const end = new Date(p.end_date);
        end.setHours(23, 59, 59, 999);
        return now >= start && now <= end;
      });
      setActivePromotions(validPromos);
    }
  }, [tenantId]);

  // Fetch appointments for the selected date (or week)
  const fetchAppointments = useCallback(async () => {
    if (!tenantId) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    let rangeStart: string;
    let rangeEnd: string;

    if (viewMode === 'week') {
      const days = getWeekDays(selectedDate);
      const first = new Date(days[0]);
      first.setHours(0, 0, 0, 0);
      const last = new Date(days[6]);
      last.setHours(23, 59, 59, 999);
      rangeStart = first.toISOString();
      rangeEnd = last.toISOString();
    } else {
      const dStart = new Date(selectedDate);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(selectedDate);
      dEnd.setHours(23, 59, 59, 999);
      rangeStart = dStart.toISOString();
      rangeEnd = dEnd.toISOString();
    }

    const { data } = await supabase
      .from('appointments')
      .select('*, clients!appointments_client_id_fkey(phone)')
      .eq('tenant_id', tenantId)
      .gte('start_time', rangeStart)
      .lte('start_time', rangeEnd)
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
          staffName: apt.staff_name || '',
          clientPhone: (apt as any).clients?.phone || apt.client_phone || '',
          price: apt.price || 0,
          startTime: apt.start_time,
          notes: apt.notes || '',
          date: apt.start_time,
        };
      });
      setAppointments(mapped);
    }
    setLoading(false);
  }, [selectedDate, tenantId, viewMode]);

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

  const handleNavigateToCheckout = async (apt: CalendarAppointment) => {
    try {
      if (!tenantId) {
        navigate('/checkout');
        return;
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.eq.${apt.clientPhone},name.eq.${apt.client}`)
        .limit(1)
        .single();

      const clientId = clientData?.id || '';

      navigate('/checkout', {
        state: {
          fromAppointment: true,
          appointmentId: apt.id,
          clientId: clientId,
          clientName: apt.client,
          serviceName: apt.service,
          staffId: apt.staffId,
          price: apt.price
        }
      });
    } catch (err) {
      console.error('Error navigating to checkout:', err);
      navigate('/checkout');
    }
  };

  const handleInputChange = (field: keyof NewAppointmentForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);

    if (field === 'service') {
      const selectedService = servicesList.find(s => s.name === value);
      if (selectedService) {
        const fullDuration = (selectedService.duration + (selectedService.buffer || 0)) / 60;
        setFormData(prev => ({ ...prev, service: value, duration: fullDuration }));
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

  const selectClient = async (clientName: string) => {
    setFormData(prev => ({ ...prev, client: clientName, clientPhone: '' }));
    setShowClientSuggestions(false);
    setIsNewClientMode(false);

    // Check for Chef Club Subscription
    const client = clientsList.find(c => c.name === clientName);
    if (client) {
      const { data, error } = await supabase
        .from('customer_subscriptions')
        .select(`
          status,
          plan:customer_plans(name),
          credits:customer_credits(available_credits)
        `)
        .eq('client_id', client.id)
        .eq('status', 'active')
        .maybeSingle();

      if (data) {
        setChefClubInfo({
          planName: (data.plan as any).name,
          credits: (data.credits as any)?.[0]?.available_credits || 0,
          status: data.status
        });
      } else {
        setChefClubInfo(null);
      }
    }
  };

  const enableNewClientMode = () => {
    setIsNewClientMode(true);
    setShowClientSuggestions(false);
    setChefClubInfo(null);
  };

  const handleEditAppointment = (apt: CalendarAppointment) => {
    setEditingAppointmentId(apt.id);
    const datePart = apt.startTime.split('T')[0];

    setFormData({
      client: apt.client,
      clientPhone: apt.clientPhone,
      service: apt.service,
      staffId: apt.staffId,
      date: datePart,
      start: apt.start,
      duration: apt.duration
    });

    setIsDetailModalOpen(false);
    setIsModalOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessário para permitir o drop
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropAppointment = async (e: React.DragEvent, dropStaffId: string, dropDate?: string) => {
    e.preventDefault();
    const aptId = e.dataTransfer.getData('aptId');
    if (!aptId) return;

    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    const columnRect = e.currentTarget.getBoundingClientRect();
    const yPosition = e.clientY - columnRect.top;

    // Calcula o novo horário dinamicamente
    const totalHours = dynamicTimeSlots.length;
    const percentage = yPosition / columnRect.height;
    const exactHour = 8 + (percentage * totalHours);

    // Arredonda para blocos de 15 minutos mais próximos
    const roundedHour = Math.floor(exactHour * 4) / 4;

    if (roundedHour < 8 || roundedHour >= (displayEndHour + 1)) {
      setToast({ message: 'Horário fora de operação.', type: 'error' });
      return;
    }

    // Calcula nova Start_time
    const newHours = Math.floor(roundedHour);
    const newMinutes = (roundedHour % 1) * 60;

    const dateStr = dropDate || apt.startTime.split('T')[0];
    const newStartTimeLine = new Date(`${dateStr}T${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:00`);

    // Validação Anti-Overbooking
    const overlapping = appointments.filter(a =>
      a.id !== apt.id &&
      a.staffId === dropStaffId &&
      new Date(a.date).toDateString() === new Date(dateStr).toDateString() &&
      !(
        (roundedHour + apt.duration) <= a.start ||
        roundedHour >= (a.start + a.duration)
      )
    );

    if (overlapping.length > 0) {
      setToast({ message: 'Conflito de horário! Não é possível encaixar aqui.', type: 'error' });
      return;
    }

    // Otimista Update UI
    setAppointments(prev => prev.map(a =>
      a.id === apt.id
        ? { ...a, staffId: dropStaffId, start: roundedHour, startTime: newStartTimeLine.toISOString(), date: dateStr }
        : a
    ));

    try {
      if (!tenantId) {
        setToast({ message: 'Tenant inválido para mover agendamento.', type: 'error' });
        fetchAppointments();
        return;
      }

      const selectedStaff = staffList.find(s => s.id === dropStaffId);

      const { error } = await supabase.from('appointments').update({
        staff_id: dropStaffId,
        staff_name: selectedStaff?.name || apt.staffName,
        start_time: newStartTimeLine.toISOString(),
        duration: apt.duration,
      }).eq('id', apt.id).eq('tenant_id', tenantId);

      if (error) {
        setToast({ message: 'Erro ao salvar alteração no banco.', type: 'error' });
        fetchAppointments(); // Reverte
      } else {
        // Update comanda if exists
        await supabase.from('comandas').update({
          staff_id: dropStaffId,
        }).eq('appointment_id', apt.id).eq('tenant_id', tenantId).eq('status', 'open');

        setToast({ message: 'Agendamento movido com sucesso!', type: 'success' });
        fetchAppointments(); // Refresh for safety
      }
    } catch (err) {
      console.error('Error dragging appointment:', err);
      fetchAppointments(); // Revert on failure
      setToast({ message: 'Erro ao mover agendamento.', type: 'error' });
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!window.confirm("Deseja realmente cancelar este agendamento?")) return;
    if (!tenantId) {
      setToast({ message: 'Tenant inválido para cancelar agendamento.', type: 'error' });
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Also cancel associated comanda if it exists and is open
      await supabase
        .from('comandas')
        .update({ status: 'cancelled' })
        .eq('appointment_id', appointmentId)
        .eq('tenant_id', tenantId)
        .eq('status', 'open');

      setToast({ message: 'Agendamento cancelado com sucesso.', type: 'info' });
      setIsDetailModalOpen(false);
      fetchAppointments();
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setToast({ message: 'Erro ao cancelar agendamento.', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      setError('Tenant inválido para salvar agendamento.');
      return;
    }

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
    const startTimeLine = new Date(`${formData.date}T${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}:00`);

    const endTimeLine = new Date(startTimeLine.getTime() + Number(formData.duration) * 60 * 60 * 1000);

    if (editingAppointmentId) {
      const endTimeLine = new Date(startTimeLine.getTime() + Number(formData.duration) * 60 * 60 * 1000);

      // UPDATE EXISTING
      const { error: updateError } = await supabase.from('appointments').update({
        service_id: selectedService?.id || null,
        staff_id: formData.staffId || null,
        service_name: formData.service,
        client_phone: formData.clientPhone,
        staff_name: selectedStaff?.name || '',
        start_time: startTimeLine.toISOString(),
        end_time: endTimeLine.toISOString(),
        duration: Number(formData.duration),
        price: selectedService?.price || 0,
      }).eq('id', editingAppointmentId).eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Erro ao atualizar agendamento:', updateError);
        setError(`Erro ao atualizar agendamento: ${updateError.message}`);
        return;
      }

      // Update comanda if exists
      await supabase.from('comandas').update({
        staff_id: formData.staffId || null,
      }).eq('appointment_id', editingAppointmentId).eq('tenant_id', tenantId).eq('status', 'open');

      setToast({ message: 'Agendamento atualizado com sucesso!', type: 'success' });
    } else {
      const endTimeLine = new Date(startTimeLine.getTime() + Number(formData.duration) * 60 * 60 * 1000);

      // INSERT NEW
      const { data: savedApt, error: saveError } = await supabase.from('appointments').insert({
        client_id: clientId,
        service_id: selectedService?.id || null,
        staff_id: formData.staffId || null,
        client_name: formData.client,
        client_phone: formData.clientPhone,
        service_name: formData.service,
        staff_name: selectedStaff?.name || '',
        start_time: startTimeLine.toISOString(),
        end_time: endTimeLine.toISOString(),
        duration: Number(formData.duration),
        price: selectedService?.price || 0,
        status: 'confirmed',
        tenant_id: tenantId
      }).select().single();

      if (saveError) {
        console.error('Erro ao salvar agendamento:', saveError);
        setError(`Erro ao salvar agendamento: ${saveError.message}`);
        return;
      }

      if (savedApt) {
        const { data: comanda } = await supabase.from('comandas').insert({
          appointment_id: savedApt.id,
          client_id: clientId,
          staff_id: formData.staffId || null,
          status: 'open',
          total: 0,
          tenant_id: tenantId
        }).select().single();

        if (comanda && selectedService) {
          const { data: serviceData } = await supabase.from('services').select('price').eq('id', selectedService.id).single();
          let finalPrice = serviceData?.price || 0;

          const promo = activePromotions.find(p =>
            (p.target_type === 'all') ||
            (p.target_type === 'service' && p.target_id === selectedService.id)
          );

          if (promo) {
            if (promo.discount_type === 'fixed') {
              finalPrice = Math.max(0, finalPrice - promo.discount_value);
            } else {
              finalPrice = finalPrice * (1 - (promo.discount_value / 100));
            }
          }

          await supabase.from('comanda_items').insert({
            comanda_id: comanda.id,
            service_id: selectedService.id,
            product_name: selectedService.name,
            quantity: 1,
            unit_price: finalPrice,
            tenant_id: tenantId,
            staff_id: formData.staffId || null
          });

          await supabase.from('comandas').update({ total: finalPrice }).eq('id', comanda.id);
        }
      }
      setToast({ message: 'Agendamento criado com sucesso!', type: 'success' });
    }

    setIsModalOpen(false);
    setIsNewClientMode(false);
    setEditingAppointmentId(null);
    setFormData({ client: '', clientPhone: '', service: '', staffId: staffList[0]?.id ?? '', date: formData.date, start: 8, duration: 1 });
    fetchAppointments();
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const exportToCSV = () => {
    if (appointments.length === 0) {
      setToast({ message: 'Não há agendamentos para exportar no período selecionado.', type: 'error' });
      return;
    }

    const headers = ['Data', 'Início', 'Fim', 'Cliente', 'Telefone', 'Serviço', 'Profissional', 'Duração (min)', 'Valor (R$)', 'Status'];

    const rows = appointments.map(apt => {
      const dateStr = apt.date.split('-').reverse().join('/');
      const startHour = `${Math.floor(apt.start).toString().padStart(2, '0')}:${(apt.start % 1 === 0 ? '00' : '30')}`;
      const endCalc = apt.start + apt.duration;
      const endHour = `${Math.floor(endCalc).toString().padStart(2, '0')}:${(endCalc % 1 === 0 ? '00' : '30')}`;

      return [
        dateStr,
        startHour,
        endHour,
        `"${apt.client}"`,
        `"${apt.clientPhone || ''}"`,
        `"${apt.service}"`,
        `"${apt.staffName}"`,
        apt.duration * 60,
        apt.price || 0,
        apt.status
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n'); // \uFEFF for BOM (UTF-8 Excel interpretation)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agenda_exportada_${selectedDate.toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast({ message: 'Agenda exportada com sucesso!', type: 'success' });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in relative">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-4 bg-white dark:bg-surface-dark p-1.5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() - (viewMode === 'week' ? 7 : 1));
              setSelectedDate(newDate);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="flex items-center gap-2 px-2 text-slate-900 dark:text-white font-bold min-w-[220px] justify-center">
            <span className="material-symbols-outlined text-primary">calendar_month</span>
            <span className="text-sm">
              {viewMode === 'week'
                ? `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : formatDateDisplay(selectedDate)
              }
            </span>
          </div>
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(selectedDate.getDate() + (viewMode === 'week' ? 7 : 1));
              setSelectedDate(newDate);
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-surface-dark p-1 rounded-lg border border-slate-200 dark:border-border-dark">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'day'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
            >Dia</button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'week'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
            >Semana</button>
          </div>
          <button
            onClick={exportToCSV}
            className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all"
            title="Exportar agenda em CSV"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            <span className="hidden lg:inline">Exportar CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingAppointmentId(null);
              setFormData(prev => ({ ...prev, client: '', clientPhone: '', service: '', duration: 1 }));
              setIsModalOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span className="hidden sm:inline">Novo Agendamento</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 flex-1 min-h-0">
        {/* DASHBOARD INDICATORS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-1 gap-4 shrink-0 w-full xl:w-64 max-xl:mb-6 xl:overflow-y-auto custom-scrollbar xl:pr-1">
          <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl border border-slate-200 dark:border-border-dark flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Atendimentos</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{appointments.length}</p>
            </div>
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">event_available</span>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl border border-slate-200 dark:border-border-dark flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Profissionais</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{staffList.length}</p>
            </div>
            <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined text-2xl">badge</span>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl border border-slate-200 dark:border-border-dark flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ocupação Média</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {staffList.length > 0 ? Math.round((appointments.reduce((sum, apt) => sum + apt.duration, 0) / (staffList.length * totalSlots)) * 100) : 0}%
              </p>
            </div>
            <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <span className="material-symbols-outlined text-2xl">query_stats</span>
            </div>
          </div>

          <div className="bg-white dark:bg-surface-dark p-4 rounded-2xl border border-slate-200 dark:border-border-dark flex items-center justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Previsto</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                R$ {appointments.reduce((acc, curr) => acc + (curr.price || 0), 0).toFixed(2).replace('.', ',')}
              </p>
            </div>
            <div className="relative z-10 size-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-2xl">payments</span>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col shadow-sm min-w-0">
          {viewMode === 'week' ? (
            <>
              <div className="flex border-b border-slate-200 dark:border-border-dark shrink-0">
                <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5" />
                {weekDays.map((day, i) => {
                  const isToday = day.toDateString() === new Date().toDateString();
                  const isSelected = day.toDateString() === selectedDate.toDateString();
                  const dayApts = appointments.filter(a => {
                    const d = new Date((a as any).date);
                    return d.toDateString() === day.toDateString();
                  });
                  return (
                    <div
                      key={i}
                      onClick={() => { setSelectedDate(day); setViewMode('day'); }}
                      className={`flex-1 py-3 px-2 border-r border-slate-200 dark:border-border-dark last:border-r-0 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                        }`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-primary' : 'text-slate-400'
                        }`}>
                        {day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                      </p>
                      <div className={`size-8 rounded-full flex items-center justify-center text-sm font-black ${isToday ? 'bg-primary text-white' : 'text-slate-700 dark:text-white'
                        }`}>
                        {day.getDate()}
                      </div>
                      {dayApts.length > 0 && (
                        <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                          {dayApts.length} aptos
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="flex min-h-[2600px]">
                    <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 flex flex-col">
                      {dynamicTimeSlots.map(hour => (
                        <div key={hour} className="flex-1 border-b border-slate-200 dark:border-border-dark text-xs font-bold text-slate-400 flex items-start justify-center pt-2">
                          {hour}:00
                        </div>
                      ))}
                    </div>
                    <div className="flex-1 flex">
                      {weekDays.map((day, di) => {
                        const dayApts = appointments.filter(a => {
                          const d = new Date((a as any).date);
                          return d.toDateString() === day.toDateString();
                        });
                        const isToday = day.toDateString() === new Date().toDateString();
                        return (
                          <div
                            key={di}
                            className={`flex-1 border-r border-slate-200 dark:border-border-dark last:border-r-0 relative group ${isToday ? 'bg-primary/[0.02]' : ''}`}
                            onDragOver={handleDragOver}
                            onDrop={(e) => {
                              const aptId = e.dataTransfer.getData('aptId');
                              const apt = appointments.find(a => a.id === aptId);
                              if (apt) {
                                const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                                handleDropAppointment(e, apt.staffId, dateStr);
                              }
                            }}
                          >
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-slate-50/50 dark:bg-white/[0.02] pointer-events-none transition-opacity"></div>
                            <div className="absolute inset-0 flex flex-col z-0">
                              {dynamicTimeSlots.map(h => <div key={h} className="flex-1 border-b border-slate-100 dark:border-border-dark/50" />)}
                            </div>
                            {dayApts.map((apt, idx) => {
                              const startOffset = (apt.start - 8) * (100 / totalSlots);
                              const height = apt.duration * (100 / totalSlots);
                              const barberColors = ['bg-barber-1', 'bg-barber-2', 'bg-barber-3', 'bg-barber-4', 'bg-barber-5', 'bg-barber-6'];
                              const borderColors = ['border-barber-1', 'border-barber-2', 'border-barber-3', 'border-barber-4', 'border-barber-5', 'border-barber-6'];
                              const staffIdx = staffList.findIndex(s => s.id === apt.staffId);
                              const barberColor = barberColors[Math.max(0, staffIdx) % barberColors.length];
                              const borderColor = borderColors[Math.max(0, staffIdx) % borderColors.length];
                              return (
                                <div
                                  key={apt.id}
                                  draggable
                                  onDragStart={(e) => { e.dataTransfer.setData('aptId', apt.id); }}
                                  onClick={() => { setSelectedAppointment(apt); setIsDetailModalOpen(true); }}
                                  className={`absolute left-0.5 right-0.5 rounded-md p-1.5 border-l-4 ${borderColor} ${barberColor} z-10 overflow-hidden shadow-sm hover:brightness-110 cursor-pointer transition-all hover:shadow-md active:scale-95 active:opacity-80`}
                                  style={{ top: `${startOffset}%`, height: `${Math.max(height, 4)}%` }}
                                  title={`${apt.client} — ${apt.service}`}
                                >
                                  <p className="text-[10px] font-black text-white truncate leading-tight drop-shadow-sm">
                                    <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">person</span>
                                    {apt.client}
                                  </p>
                                  <p className="text-[9px] text-white/90 font-bold truncate drop-shadow-sm">
                                    <span className="material-symbols-outlined text-[9px] align-middle mr-0.5">content_cut</span>
                                    {apt.service}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
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

              <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="flex min-h-[2600px]">
                    <div className="w-20 shrink-0 border-r border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 flex flex-col">
                      {dynamicTimeSlots.map(hour => (
                        <div key={hour} className="flex-1 border-b border-slate-200 dark:border-border-dark text-xs font-bold text-slate-400 flex items-start justify-center pt-2 relative">
                          {hour}:00
                        </div>
                      ))}
                    </div>

                    <div className="flex-1 flex relative">
                      <div className="absolute inset-0 flex flex-col z-0">
                        {dynamicTimeSlots.map(hour => (
                          <div key={hour} className="flex-1 border-b border-slate-100 dark:border-border-dark/50"></div>
                        ))}
                      </div>

                      {staffList.map(resource => (
                        <div
                          key={resource.id}
                          className="flex-1 border-r border-slate-200 dark:border-border-dark last:border-r-0 relative z-10 group"
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropAppointment(e, resource.id)}
                        >
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-slate-50/50 dark:bg-white/[0.02] pointer-events-none transition-opacity"></div>
                          {appointments
                            .filter(apt => apt.staffId === resource.id)
                            .map((apt, idx) => {
                              const startOffset = (apt.start - 8) * (100 / totalSlots);
                              const height = apt.duration * (100 / totalSlots);
                              const staffIndex = staffList.findIndex(s => s.id === resource.id);
                              const barberColors = ['bg-barber-1', 'bg-barber-2', 'bg-barber-3', 'bg-barber-4', 'bg-barber-5', 'bg-barber-6'];
                              const borderColors = ['border-barber-1', 'border-barber-2', 'border-barber-3', 'border-barber-4', 'border-barber-5', 'border-barber-6'];
                              const barberColor = barberColors[staffIndex % barberColors.length];
                              const borderColor = borderColors[staffIndex % borderColors.length];

                              return (
                                <div
                                  key={apt.id}
                                  draggable
                                  onDragStart={(e) => { e.dataTransfer.setData('aptId', apt.id); }}
                                  onClick={() => { setSelectedAppointment(apt); setIsDetailModalOpen(true); }}
                                  className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 border-l-4 ${borderColor} ${barberColor} hover:brightness-110 cursor-pointer transition-all shadow-md hover:shadow-lg flex flex-col justify-start z-20 overflow-hidden active:scale-[0.98] active:opacity-80`}
                                  style={{ top: `${startOffset}%`, height: `${height}%` }}
                                  title={`${apt.client} — ${apt.service}`}
                                >
                                  <div className="flex items-center justify-between mb-0.5 shrink-0">
                                    <span className="text-[9px] font-black px-1 py-0.5 rounded bg-black/20 text-white uppercase tracking-tighter leading-none">
                                      {Math.floor(apt.start)}:{apt.start % 1 === 0 ? '00' : '30'}
                                    </span>
                                    <div className="flex bg-black/10 rounded px-1 py-0.5">
                                      {apt.status === 'confirmed' && <span className="material-symbols-outlined text-[12px] text-white">check_circle</span>}
                                      {apt.status === 'completed' && <span className="material-symbols-outlined text-[12px] text-emerald-300">task_alt</span>}
                                      {apt.status === 'pending' && <span className="material-symbols-outlined text-[12px] text-amber-300">schedule</span>}
                                    </div>
                                  </div>
                                  <p className="text-xs font-black text-white truncate leading-none drop-shadow-sm mt-0.5">
                                    {apt.client}
                                  </p>
                                  <p className="text-[10px] text-white/90 font-bold truncate leading-none drop-shadow-sm mt-0.5">
                                    {apt.service}
                                  </p>
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
            </>
          )}
        </div>

        {/* Próximos Agendamentos Oculto em telas menores de lg (1024px) */}
        <div className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 bg-white dark:bg-[#121316] rounded-2xl border border-slate-200 dark:border-[#262A33] overflow-hidden shadow-sm">
          <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-[#262A33]">
            <h3 className="text-slate-900 dark:text-white font-bold text-sm">Próximos Agendamentos</h3>
            <button className="text-primary dark:text-[#C6A45A] text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-all">Ver Todos</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
            {appointments
              .filter(apt => apt.status !== 'completed' && apt.status !== 'cancelled' && (new Date(apt.date).toDateString() === new Date().toDateString() || new Date(apt.date) >= new Date()))
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.start - b.start)
              .slice(0, 10)
              .map(apt => {
                const staff = staffList.find(s => s.id === apt.staffId);
                return (
                  <div
                    key={apt.id}
                    onClick={() => { setSelectedAppointment(apt); setIsDetailModalOpen(true); }}
                    className="bg-slate-50 dark:bg-[#181A1F] p-3 rounded-xl flex gap-3 items-center group cursor-pointer hover:bg-slate-100 dark:hover:bg-[#181A1F]/80 transition-all border border-transparent dark:hover:border-[#262A33]"
                  >
                    <div className="bg-slate-200 dark:bg-[#262A33] text-primary dark:text-[#C6A45A] font-black text-xs px-2 py-1.5 rounded-lg shrink-0 text-center min-w-[44px]">
                      {Math.floor(apt.start).toString().padStart(2, '0')}:{(apt.start % 1) === 0 ? '00' : '30'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{apt.client}</p>
                      <p className="text-slate-500 dark:text-[#A7AFB7] text-[10px] uppercase tracking-wider mt-0.5 truncate">
                        {apt.service} • {staff?.name?.split(' ')[0] || apt.staffName?.split(' ')[0]}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 dark:text-[#A7AFB7] text-lg opacity-0 group-hover:opacity-100 transition-opacity">more_vert</span>
                  </div>
                );
              })}
            {appointments.filter(apt => apt.status !== 'completed' && apt.status !== 'cancelled').length === 0 && (
              <div className="text-center text-slate-500 dark:text-[#A7AFB7] py-10 text-xs font-medium">Nenhum agendamento futuro</div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setIsNewClientMode(false); setEditingAppointmentId(null); setError(null); }}
        title={editingAppointmentId ? "Editar Agendamento" : "Novo Agendamento"}
        maxWidth="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 text-sm mt-0.5">error</span>
              <p className="text-xs text-red-600 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

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
            {chefClubInfo && (
              <div className="mt-2 animate-bounce-in bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex items-center justify-between">
                <div>
                  <label className="block text-[10px] font-black uppercase text-amber-600 mb-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">workspace_premium</span>
                    Membro Clube do Chefe
                  </label>
                  <p className="text-xs font-bold text-slate-700 dark:text-amber-200">Plano {chefClubInfo.planName}</p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">
                    {chefClubInfo.status === 'active' ? 'Membro ativo' : 'Assinatura pendente'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-amber-600 uppercase">Créditos</p>
                  <p className="text-lg font-black text-amber-600">{chefClubInfo.credits}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Serviço</label>
            <div className="relative">
              <select
                value={formData.service}
                onChange={(e) => handleInputChange('service', e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="" disabled>Selecione um serviço...</option>
                {servicesList.length > 0 ? (
                  servicesList.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.duration} min)</option>
                  ))
                ) : (
                  <option disabled>Nenhum serviço disponível</option>
                )}
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
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
              >
                {staffList.map(r => (
                  <option key={r.id} value={r.id}>{r.name} - {roleLabels[r.role] || r.role}</option>
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
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
                >
                  {(() => {
                    // Gerando slots de 8h às 00h (33 slots total: 8, 8.5, ..., 24)
                    const allSlots = Array.from({ length: 33 }, (_, i) => 8 + i * 0.5);
                    const aptsOnDay = appointments.filter(a => {
                      const aptDate = new Date(a.date);
                      const fDate = new Date(formData.date + 'T12:00:00'); // Midday to safely compare day/month/year
                      return aptDate.getFullYear() === fDate.getFullYear() &&
                        aptDate.getMonth() === fDate.getMonth() &&
                        aptDate.getDate() === fDate.getDate() &&
                        a.staffId === formData.staffId &&
                        a.id !== editingAppointmentId;
                    });

                    return allSlots.map(slot => {
                      const slotEnd = slot + formData.duration;
                      const hasConflict = aptsOnDay.some(apt =>
                        slot < (apt.start + apt.duration) && slotEnd > apt.start
                      );

                      return (
                        <option key={slot} value={slot} disabled={hasConflict} className={hasConflict ? 'text-red-400 bg-red-50 dark:bg-red-900/10' : ''}>
                          {Math.floor(slot)}:{slot % 1 === 0 ? '00' : '30'} {hasConflict ? '(Ocupado)' : ''}
                        </option>
                      );
                    });
                  })()}
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
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-2.5 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none appearance-none"
                >
                  <option value="0.25">15 min</option>
                  <option value="0.5">30 min</option>
                  <option value="0.75">45 min</option>
                  <option value="1">1h</option>
                  <option value="1.5">1h 30m</option>
                  <option value="2">2h</option>
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
              {editingAppointmentId ? "Salvar Alterações" : "Confirmar"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedAppointment(null); }}
        title="Resumo do Atendimento"
        maxWidth="md"
      >
        {selectedAppointment && (() => {
          const apt = selectedAppointment;
          const startDate = new Date(apt.startTime);
          const endDate = new Date(startDate.getTime() + apt.duration * 60 * 60 * 1000);
          const staff = staffList.find(s => s.id === apt.staffId);

          const statusLabels: Record<string, string> = {
            confirmed: 'Confirmado',
            pending: 'Pendente',
            completed: 'Concluído',
          };
          const statusBgColors: Record<string, string> = {
            confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
            completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          };
          const statusIcons: Record<string, string> = {
            confirmed: 'check_circle',
            pending: 'schedule',
            completed: 'task_alt',
          };

          return (
            <div className="space-y-5">
              <div className="flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${statusBgColors[apt.status] || 'bg-slate-100 text-slate-700'}`}>
                  <span className="material-symbols-outlined text-base">{statusIcons[apt.status] || 'info'}</span>
                  {statusLabels[apt.status] || apt.status}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-2xl">person</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900 dark:text-white truncate">{apt.client}</p>
                    {apt.clientPhone && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-sm">phone</span>
                        {apt.clientPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Serviço</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">content_cut</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{apt.service}</p>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Profissional</p>
                  <div className="flex items-center gap-2">
                    {staff?.avatar ? (
                      <img src={staff.avatar} alt={staff.name || 'Avatar do profissional'} className="size-7 rounded-full bg-slate-200 object-cover object-center border border-slate-100 dark:border-slate-600" />
                    ) : (
                      <span className="material-symbols-outlined text-primary text-lg">badge</span>
                    )}
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{staff?.name || apt.staffName || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Data</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Horário</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Duração</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {apt.duration >= 1 ? `${Math.floor(apt.duration)}h` : ''}{apt.duration % 1 !== 0 ? ` ${Math.round((apt.duration % 1) * 60)}min` : ''}
                  </p>
                </div>
              </div>

              {apt.notes && (
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Observações</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{apt.notes}</p>
                </div>
              )}

              <div className="pt-4 flex justify-center gap-3 border-t border-slate-100 dark:border-white/5 mt-2 flex-wrap">
                <button
                  onClick={() => {
                    if (!apt.clientPhone) {
                      setToast({ message: 'Cliente sem telefone cadastrado.', type: 'error' });
                      return;
                    }
                    const cleanPhone = apt.clientPhone.replace(/\D/g, '');
                    const finalPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                    const text = `Olá ${apt.client.split(' ')[0]}! Tudo bem? Aqui é da barbearia. Passando para confirmar seu agendamento:

📅 *Data:* ${new Date(apt.startTime).toLocaleDateString('pt-BR')} 
⏰ *Hora:* ${new Date(apt.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
💈 *Serviço:* ${apt.service}
🧔 *Profissional:* ${staff?.name || apt.staffName}

Podemos confirmar? 😄`;
                    const link = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
                    window.open(link, '_blank');
                  }}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-[#25D366] text-white hover:bg-[#20b857] shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.559 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </button>

                <button
                  onClick={() => handleEditAppointment(apt)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  Editar
                </button>

                <button
                  onClick={() => handleNavigateToCheckout(apt)}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">point_of_sale</span>
                  Checkout
                </button>

                <button
                  onClick={() => handleCancelAppointment(apt.id)}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                  Cancelar
                </button>

                <button
                  onClick={() => { setIsDetailModalOpen(false); setSelectedAppointment(null); }}
                  className="w-full mt-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors"
                >
                  Fechar Revisor
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div >
  );
};

export default Schedule;
