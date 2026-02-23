import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { generateBusinessInsights } from '../services/geminiService';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import OnboardingChecklist from '../components/OnboardingChecklist';
import DashboardAlerts from '../components/DashboardAlerts';
import DashboardReminders from '../components/DashboardReminders';
import Modal from '../components/ui/Modal';

interface DBClient {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday?: string;
  last_visit?: string;
  avatar?: string;
}

interface DBStaff {
  id: string;
  name: string;
}

interface DBService {
  id: string;
  name: string;
  duration: number;
}

interface DBAppointment {
  id: string;
  client_name: string;
  service_name: string;
  staff_name: string;
  start_time: string;
  status: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const { theme } = useTheme();
  const { tenantId } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data from Supabase
  const [clients, setClients] = useState<DBClient[]>([]);
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [servicesList, setServicesList] = useState<DBService[]>([]);
  const [appointments, setAppointments] = useState<DBAppointment[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [metrics, setMetrics] = useState({ revenue: 0, growth: 0, activeStaffPercent: 0 });

  // Onboarding
  const [profile, setProfile] = useState<any>(null);
  const { user } = useAuth();

  // Quick Appointment States
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    clientSearch: '',
    selectedClientId: '',
    serviceId: '',
    staffId: '',
  });

  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // New Client Modal
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '', email: '' });

  // Appointment Action Menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [clientsRes, staffRes, servicesRes, apptsRes, profileRes, transRes] = await Promise.all([
      supabase.from('clients').select('id, name, phone, email, birthday, last_visit, avatar').order('name'),
      supabase.from('staff').select('id, name').eq('status', 'active'),
      supabase.from('services').select('id, name, duration').eq('active', true),
      supabase.from('appointments').select('*').neq('status', 'cancelled').order('start_time', { ascending: true }).limit(10),
      user ? supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single() : Promise.resolve({ data: null }),
      supabase.from('transactions').select('*').eq('type', 'income').order('date', { ascending: true })
    ]);

    if (clientsRes.data) {
      setClients(clientsRes.data);
      // Process birthdays
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const bdays = clientsRes.data
        .filter(c => c.birthday)
        .map(c => {
          const bDate = new Date(c.birthday + "T00:00:00");
          let nextBday = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate());

          if (nextBday < today) {
            nextBday.setFullYear(today.getFullYear() + 1);
          }

          const diffTime = Math.abs(nextBday.getTime() - today.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let lastVisitText = 'Sem registro';
          if (c.last_visit) {
            const lv = new Date(c.last_visit);
            const diffVisit = Math.floor((today.getTime() - lv.getTime()) / (1000 * 60 * 60 * 24));
            lastVisitText = diffVisit === 0 ? 'Hoje' : diffVisit === 1 ? 'Ontem' : `${diffVisit} Dias atrás`;
          }

          return {
            ...c,
            displayDate: bDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''),
            daysUntil: diffDays,
            lastVisitText,
            status: diffDays <= 7 ? 'due_soon' : diffDays <= 30 ? 'visited_recently' : 'overdue'
          };
        })
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 5); // top 5

      setUpcomingBirthdays(bdays);
    }

    if (transRes.data) {
      const now = new Date();
      const thisMonth = now.getMonth();
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;

      let thisMonthRev = 0;
      let lastMonthRev = 0;

      const grouped: Record<string, number> = {};

      transRes.data.forEach(t => {
        const d = new Date(t.date);
        const day = d.getDate();
        if (d.getMonth() === thisMonth) {
          thisMonthRev += Number(t.amount || t.val) || 0;
          const label = day.toString();
          grouped[label] = (grouped[label] || 0) + (Number(t.amount || t.val) || 0);
        } else if (d.getMonth() === lastMonth) {
          lastMonthRev += Number(t.amount || t.val) || 0;
        }
      });

      const growth = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : 0;
      setMetrics(prev => ({ ...prev, revenue: thisMonthRev, growth }));

      // Fill chart data (1 to 30)
      const cData = [];
      for (let i = 1; i <= 30; i += 5) {
        cData.push({ name: i.toString(), value: grouped[i.toString()] || 0 });
      }
      setChartData(cData);
    }

    // Active Staff based on today's appointments
    if (staffRes.data) {
      setStaffList(staffRes.data);
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: todayAppts } = await supabase.from('appointments').select('staff_id').eq('status', 'confirmed').gte('start_time', `${todayStr}T00:00:00`);
      const activeIds = new Set(todayAppts?.map(a => a.staff_id));
      const percent = staffRes.data.length > 0 ? (activeIds.size / staffRes.data.length) * 100 : 0;
      setMetrics(prev => ({ ...prev, activeStaffPercent: percent || 0 }));
    }

    if (servicesRes.data) setServicesList(servicesRes.data);
    if (apptsRes.data) setAppointments(apptsRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Set default staff/service when data loads
  useEffect(() => {
    if (staffList.length > 0 && !formData.staffId) {
      setFormData(prev => ({ ...prev, staffId: staffList[0].id }));
    }
  }, [staffList, formData.staffId]);

  useEffect(() => {
    if (servicesList.length > 0 && !formData.serviceId) {
      setFormData(prev => ({ ...prev, serviceId: servicesList[0].id }));
    }
  }, [servicesList, formData.serviceId]);

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    const result = await generateBusinessInsights({
      revenue: metrics.revenue,
      growth: metrics.growth,
      nps: 98, // Mocked for now
      activeStaff: staffList.length
    });
    setInsight(result);
    setLoadingInsight(false);
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(formData.clientSearch.toLowerCase())
  );

  const handleCreateNewClient = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate
    const existing = clients.find(c => c.name.toLowerCase() === newClientForm.name.toLowerCase() && c.phone === newClientForm.phone);
    if (existing) {
      setToast({ message: 'Cliente já existe!', type: 'error' });
      return;
    }

    const { data, error } = await supabase.from('clients').insert({
      name: newClientForm.name,
      phone: newClientForm.phone,
      email: newClientForm.email,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newClientForm.name)}&background=random`,
      tenant_id: tenantId
    }).select().single();

    if (error) {
      setToast({ message: 'Erro ao cadastrar cliente.', type: 'error' });
      return;
    }

    setClients(prev => [...prev, data]);
    setFormData({ ...formData, clientSearch: data.name, selectedClientId: data.id });
    setShowNewClientModal(false);
    setNewClientForm({ name: '', phone: '', email: '' });
    setToast({ message: `Cliente "${data.name}" cadastrado!`, type: 'success' });
  };

  const handleConfirmAppointment = async (e: React.FormEvent) => {
    e.preventDefault();

    const clientName = formData.clientSearch;
    const selectedService = servicesList.find(s => s.id === formData.serviceId);
    const selectedStaff = staffList.find(s => s.id === formData.staffId);

    if (!clientName || !selectedService || !selectedStaff) {
      setToast({ message: 'Preencha todos os campos.', type: 'error' });
      return;
    }

    const startTime = new Date(`${formData.date}T${formData.time}:00`);

    const { data: savedApt, error: saveError } = await supabase.from('appointments').insert({
      client_id: formData.selectedClientId || null,
      service_id: formData.serviceId,
      staff_id: formData.staffId,
      client_name: clientName,
      service_name: selectedService.name,
      staff_name: selectedStaff.name,
      start_time: startTime.toISOString(),
      duration: selectedService.duration / 60,
      status: 'confirmed',
      tenant_id: tenantId
    }).select().single();

    if (saveError) {
      setToast({ message: 'Erro ao criar agendamento.', type: 'error' });
      return;
    }

    // AUTOMATION: Create Comanda
    if (savedApt) {
      const { data: comanda } = await supabase.from('comandas').insert({
        appointment_id: savedApt.id,
        client_id: formData.selectedClientId || null,
        staff_id: formData.staffId,
        status: 'open',
        total: 0,
        tenant_id: tenantId
      }).select().single();

      if (comanda) {
        // Fetch service price
        const { data: serviceData } = await supabase.from('services').select('price').eq('id', formData.serviceId).single();

        await supabase.from('comanda_items').insert({
          comanda_id: comanda.id,
          service_id: formData.serviceId,
          product_name: selectedService.name,
          quantity: 1,
          unit_price: serviceData?.price || 0,
          tenant_id: tenantId
        });

        // Update comanda total
        await supabase.from('comandas').update({ total: serviceData?.price || 0 }).eq('id', comanda.id);
      }
    }

    setFormData({
      ...formData,
      clientSearch: '',
      selectedClientId: '',
    });
    setToast({ message: 'Agendamento confirmado!', type: 'success' });
    fetchData();
  };

  const handleCancelAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    if (!error) {
      setToast({ message: 'Agendamento cancelado.', type: 'info' });
      fetchData();
    }
    setActiveMenuId(null);
  };

  const handleCompleteAppointment = async (id: string) => {
    const { error } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
    if (!error) {
      setToast({ message: 'Agendamento concluído!', type: 'success' });
      fetchData();
    }
    setActiveMenuId(null);
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Visão Geral Executiva</h2>
          <p className="text-slate-500 mt-1">Sua empresa está com crescimento de {metrics.growth.toFixed(0)}% este mês.</p>
        </div>
        <button
          onClick={handleGenerateInsight}
          disabled={loadingInsight}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20"
        >
          <span className="material-symbols-outlined text-lg">auto_awesome</span>
          {loadingInsight ? 'Analisando...' : 'Gerar Insights IA'}
        </button>
      </div>

      {insight && (
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-4 rounded-xl animate-fade-in">
          <div className="flex gap-3">
            <span className="material-symbols-outlined text-indigo-500 dark:text-indigo-400">psychology</span>
            <div>
              <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-300 mb-1">Análise de IA</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{insight}</p>
            </div>
          </div>
        </div>
      )}

      {/* ONBOARDING CHECKLIST */}
      {profile && !profile.onboarding_completed && (
        <OnboardingChecklist onComplete={() => setProfile({ ...profile, onboarding_completed: true })} />
      )}

      {/* ALERTAS DA BARBEARIA E LEMBRETES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardAlerts />
        <DashboardReminders />
      </div>

      {/* BLOCO SUPERIOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* AGENDAMENTO RÁPIDO */}
        <div className="col-span-1 bg-white dark:bg-card-dark rounded-xl p-6 border border-primary/30 dark:border-primary/20 shadow-lg shadow-primary/5 transition-all">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_circle</span>
            Agendamento Rápido
          </h3>
          <form onSubmit={handleConfirmAppointment} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="relative">
                <input
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
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
                onChange={(e) => {
                  setFormData({ ...formData, clientSearch: e.target.value, selectedClientId: '' });
                  setShowClientSuggestions(true);
                }}
              />

              {showClientSuggestions && formData.clientSearch && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {filteredClients.length > 0 ? (
                    filteredClients.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, clientSearch: c.name, selectedClientId: c.id });
                          setShowClientSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-border-dark last:border-0"
                      >
                        {c.name} <span className="text-[10px] text-slate-500">({c.phone || 'Sem tel'})</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-center">
                      <p className="text-xs text-slate-500 mb-2">Cliente não encontrado.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewClientForm({ ...newClientForm, name: formData.clientSearch });
                          setShowNewClientModal(true);
                          setShowClientSuggestions(false);
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
                  onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {staffList.map(p => <option key={p.id} value={p.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Serviço</label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {servicesList.map(s => <option key={s.id} value={s.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{s.name}</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all hover:bg-blue-600"
            >
              Confirmar
            </button>
          </form>
        </div>

        {/* Status da Equipe */}
        <div className="col-span-1 bg-white dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-white/5 flex flex-col justify-center items-center shadow-sm">
          <p className="text-slate-500 text-[10px] font-bold uppercase mb-4 self-start">Equipe Ativa</p>
          <div className="relative size-24">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-200 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
              <path className="text-primary" strokeDasharray={`${metrics.activeStaffPercent}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-xl font-bold text-slate-900 dark:text-white">{metrics.activeStaffPercent.toFixed(0)}%</span>
            </div>
          </div>
          <p className="mt-4 text-[10px] font-bold text-accent uppercase tracking-wider">Online Agora</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase">{staffList.length} colaboradores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos Agendamentos */}
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white">Próximos Agendamentos</h3>
            <button
              onClick={() => navigate('/schedule')}
              className="text-primary text-xs font-bold uppercase tracking-wider hover:text-blue-600 dark:hover:text-white transition-colors"
            >
              Ver Todos
            </button>
          </div>
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-white/5">
                    <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhum agendamento encontrado.</p>
            ) : (
              appointments.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer group relative">
                  <div className={`w-12 h-12 rounded-lg bg-white dark:bg-white/5 flex flex-col items-center justify-center border border-slate-200 dark:border-transparent text-primary group-hover:bg-primary/20 group-hover:text-primary transition-colors shrink-0`}>
                    <span className="text-xs font-bold">{formatTime(item.start_time)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.client_name || 'Cliente'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{item.service_name || 'Serviço'} • {item.staff_name || 'Profissional'}</p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                      className="text-slate-400 dark:text-slate-600 shrink-0 hover:text-slate-700 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10"
                    >
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    {activeMenuId === item.id && (
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl py-1 min-w-[160px]">
                        <button
                          onClick={() => navigate('/schedule')}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span> Visualizar
                        </button>
                        <button
                          onClick={() => handleCompleteAppointment(item.id)}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span> Concluir
                        </button>
                        <button
                          onClick={() => handleCancelAppointment(item.id)}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span> Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Aniversariantes */}
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-white/5 shadow-sm transition-colors">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-pink-500">cake</span>
              <h3 className="font-bold text-slate-900 dark:text-white">Aniversariantes Próximos</h3>
            </div>
            <button
              onClick={() => navigate('/clients')}
              className="text-pink-500 text-xs font-bold uppercase tracking-wider hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
            >
              Ver Mês
            </button>
          </div>
          <div className="space-y-4">
            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Nenhum aniversariante próximo.</p>
            ) : upcomingBirthdays.map((person, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                {person.avatar ? (
                  <img src={person.avatar} alt={person.name} className="size-10 rounded-full border border-slate-200 dark:border-white/5 object-cover shrink-0" />
                ) : (
                  <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-slate-400">person</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{person.name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${person.daysUntil === 0 ? 'bg-pink-500 text-white' : 'text-pink-500 bg-pink-500/10'}`}>
                      {person.daysUntil === 0 ? 'Hoje' : person.displayDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[10px] text-slate-400">history</span>
                    <p className="text-[10px] text-slate-500 truncate">Última visita: {person.lastVisitText}</p>
                  </div>
                </div>
                {(person.status === 'overdue' || person.daysUntil === 0) && (
                  <button onClick={() => window.open(`https://wa.me/55${person.phone.replace(/\D/g, '')}`, '_blank')} title="Enviar Oferta no WhatsApp" className="size-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">chat</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Client Modal */}
      <Modal
        isOpen={showNewClientModal}
        onClose={() => setShowNewClientModal(false)}
        title="Cadastrar Novo Cliente"
        maxWidth="md"
      >
        <form onSubmit={handleCreateNewClient} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
            <input
              type="text"
              required
              placeholder="Ex: Carlos Oliveira"
              value={newClientForm.name}
              onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone / WhatsApp</label>
            <input
              type="tel"
              required
              placeholder="(11) 99999-9999"
              value={newClientForm.phone}
              onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">E-mail (Opcional)</label>
            <input
              type="email"
              placeholder="exemplo@email.com"
              value={newClientForm.email}
              onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowNewClientModal(false)}
              className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              Cadastrar
            </button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Dashboard;