import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { generateBusinessInsights } from '../services/geminiService';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';

const chartData = [
  { name: '1', value: 4000 },
  { name: '5', value: 3000 },
  { name: '10', value: 5000 },
  { name: '15', value: 2780 },
  { name: '20', value: 7890 },
  { name: '25', value: 6390 },
  { name: '30', value: 8490 },
];

interface DBClient {
  id: string;
  name: string;
  phone: string;
  email: string;
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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Data from Supabase
  const [clients, setClients] = useState<DBClient[]>([]);
  const [staffList, setStaffList] = useState<DBStaff[]>([]);
  const [servicesList, setServicesList] = useState<DBService[]>([]);
  const [appointments, setAppointments] = useState<DBAppointment[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [clientsRes, staffRes, servicesRes, apptsRes] = await Promise.all([
      supabase.from('clients').select('id, name, phone, email').order('name'),
      supabase.from('staff').select('id, name').eq('status', 'active'),
      supabase.from('services').select('id, name, duration').eq('active', true),
      supabase.from('appointments').select('*').neq('status', 'cancelled').order('start_time', { ascending: true }).limit(10),
    ]);

    if (clientsRes.data) setClients(clientsRes.data);
    if (staffRes.data) setStaffList(staffRes.data);
    if (servicesRes.data) setServicesList(servicesRes.data);
    if (apptsRes.data) setAppointments(apptsRes.data);
    setLoading(false);
  }, []);

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
      revenue: 45200,
      growth: 12.5,
      nps: 8.8,
      activeStaff: 0.92
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
      status: 'confirmed'
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
        total: 0
      }).select().single();

      if (comanda) {
        // Fetch service price
        const { data: serviceData } = await supabase.from('services').select('price').eq('id', formData.serviceId).single();

        await supabase.from('comanda_items').insert({
          comanda_id: comanda.id,
          service_id: formData.serviceId,
          product_name: selectedService.name,
          quantity: 1,
          unit_price: serviceData?.price || 0
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

  const upcomingBirthdays = [
    { name: 'Gabriel Costa', date: '02 Nov', daysUntil: 5, lastVisit: '1 Dia atrás', status: 'visited_recently', avatar: 'https://picsum.photos/203' },
    { name: 'André Macedo', date: '28 Out', daysUntil: 0, lastVisit: '12 Dias atrás', status: 'due_soon', avatar: 'https://picsum.photos/201' },
    { name: 'Juliana Paes', date: '05 Nov', daysUntil: 8, lastVisit: '45 Dias atrás', status: 'overdue', avatar: 'https://picsum.photos/205' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Visão Geral Executiva</h2>
          <p className="text-slate-500 mt-1">Sua empresa está com crescimento de +12% este mês.</p>
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

      {/* BLOCO SUPERIOR */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lucro Real */}
        <div className="col-span-1 lg:col-span-2 bg-white dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-white/5 flex flex-col justify-between relative overflow-hidden shadow-sm transition-colors">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-slate-500 text-sm font-medium">Lucro Real Mensal</p>
                <h3 className="text-4xl font-bold mt-1 tracking-tight text-slate-900 dark:text-white">R$ 45.200,00</h3>
              </div>
              <div className="bg-accent/10 text-accent px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                +12.5%
              </div>
            </div>
            <div className="h-32 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3c83f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3c83f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
                      borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
                      borderRadius: '8px',
                      color: theme === 'dark' ? '#fff' : '#0f172a'
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#fff' : '#0f172a' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3c83f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

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
              <path className="text-primary" strokeDasharray="92, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-xl font-bold text-slate-900 dark:text-white">92%</span>
            </div>
          </div>
          <p className="mt-4 text-[10px] font-bold text-accent uppercase tracking-wider">Online Agora</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase">{staffList.length} colaboradores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <h3 className="font-bold text-slate-900 dark:text-white">Aniversariantes</h3>
            </div>
            <button
              onClick={() => navigate('/clients')}
              className="text-pink-500 text-xs font-bold uppercase tracking-wider hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
            >
              Ver Mês
            </button>
          </div>
          <div className="space-y-4">
            {upcomingBirthdays.map((person, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${person.avatar})` }}></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{person.name}</p>
                    <span className="text-[10px] font-bold text-pink-500 bg-pink-500/10 px-1.5 py-0.5 rounded">{person.date}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[10px] text-slate-400">history</span>
                    <p className="text-[10px] text-slate-500 truncate">Última visita: {person.lastVisit}</p>
                  </div>
                </div>
                {person.status === 'overdue' && (
                  <button title="Enviar Oferta" className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">redeem</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* KPIs Adicionais */}
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-white/5 flex flex-col justify-between shadow-sm transition-colors">
          <div>
            <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">NPS Médio</p>
            <div className="flex items-end gap-2">
              <h4 className="text-3xl font-bold text-slate-900 dark:text-white">8.8</h4>
              <span className="text-slate-500 text-sm mb-1">/10</span>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5">
            <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Ticket Médio</p>
            <h4 className="text-2xl font-bold text-slate-900 dark:text-white">R$ 1.250,00</h4>
            <p className="text-accent text-[10px] font-bold mt-1 uppercase">+4.2% vs mês anterior</p>
          </div>
        </div>
      </div>

      {/* New Client Modal */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-white/5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person_add</span>
                Cadastrar Novo Cliente
              </h3>
              <button onClick={() => setShowNewClientModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateNewClient} className="p-6 space-y-4">
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
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Dashboard;