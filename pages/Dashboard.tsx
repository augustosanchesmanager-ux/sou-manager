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

/* ─── Smart Return Widget (mini-engine embutido) ─── */
interface SmartWidgetClient { id: string; name: string; phone: string; last_visit?: string; }
const SmartReturnWidget: React.FC<{ clients: SmartWidgetClient[]; onNavigate: () => void }> = ({ clients, onNavigate }) => {
  const today = new Date();
  const daysSince = (d: string) => Math.floor((today.getTime() - new Date(d).getTime()) / 86400000);

  const atRisk = clients
    .filter(c => c.last_visit && daysSince(c.last_visit) >= 18)
    .map(c => ({ ...c, days: daysSince(c.last_visit!) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 4);

  if (atRisk.length === 0) return null;

  return (
    <div className="card-boutique p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-lg">psychology</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Motor de Retorno</h3>
            <p className="text-[10px] text-slate-500">{atRisk.length} cliente(s) precisam de atenção</p>
          </div>
          <span className="size-2 bg-red-500 rounded-full animate-pulse ml-1"></span>
        </div>
        <button onClick={onNavigate} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider">
          Ver todos →
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {atRisk.map(c => (
          <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${c.days >= 30 ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/20' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/20'
            }`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={`size-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${c.days >= 30 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700'
                }`}>{c.name[0].toUpperCase()}</div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</p>
                <p className={`text-[10px] font-bold ${c.days >= 30 ? 'text-red-500' : 'text-amber-600'}`}>{c.days}d sem visita</p>
              </div>
            </div>
            {c.phone && (
              <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Fala ${c.name.split(' ')[0]}! Sentimos sua falta. Que tal agendar um corte? 😄`)}`}
                target="_blank" rel="noopener noreferrer"
                className="size-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-colors shrink-0">
                <span className="material-symbols-outlined text-sm">chat</span>
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
/* ───────────────────────────────────────── */

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
  duration_minutes?: number;
  price?: number;
}

interface DBAppointment {
  id: string;
  client_name: string;
  client_phone?: string;
  service_name: string;
  staff_name: string;
  start_time: string;
  status: string;
}

/* ─── Metrics Panel (personalizável pelo gestor) ─── */
type MetricType = 'revenue' | 'clients' | 'appointments' | 'avg_ticket' | 'growth' | 'retention' | 'team' | 'custom';
interface DashboardMetric {
  id: string; type: MetricType; label: string; icon: string; color: string;
  goal?: number; unit?: 'currency' | 'percent' | 'number'; visible: boolean;
}
const DEFAULT_METRICS: DashboardMetric[] = [
  { id: 'm1', type: 'revenue', label: 'Faturamento do Mês', icon: 'payments', color: 'emerald', goal: 10000, unit: 'currency', visible: true },
  { id: 'm2', type: 'clients', label: 'Total de Clientes', icon: 'group', color: 'blue', goal: 200, unit: 'number', visible: true },
  { id: 'm3', type: 'appointments', label: 'Agendamentos Hoje', icon: 'calendar_month', color: 'primary', goal: 20, unit: 'number', visible: true },
  { id: 'm4', type: 'avg_ticket', label: 'Ticket Médio', icon: 'receipt_long', color: 'amber', goal: 80, unit: 'currency', visible: true },
  { id: 'm5', type: 'growth', label: 'Crescimento Mensal', icon: 'trending_up', color: 'violet', goal: 20, unit: 'percent', visible: false },
  { id: 'm6', type: 'retention', label: 'Taxa de Retorno', icon: 'psychology', color: 'red', goal: 70, unit: 'percent', visible: false },
  { id: 'm7', type: 'team', label: 'Equipe Ativa', icon: 'badge', color: 'indigo', goal: 100, unit: 'percent', visible: false },
];
const M_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
  primary: 'bg-primary/10 text-primary border-primary/20',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
  violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/30',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30',
};
interface MPProps { revenue: number; clientsCount: number; todayAppts: number; growth: number; activeStaffPct: number; }
const MetricsPanel: React.FC<MPProps> = ({ revenue, clientsCount, todayAppts, growth, activeStaffPct }) => {
  const SK = 'sou_manager_metrics_v1';
  const [metrics, setMetrics] = React.useState<DashboardMetric[]>(() => {
    try { const s = localStorage.getItem(SK); return s ? JSON.parse(s) : DEFAULT_METRICS; } catch { return DEFAULT_METRICS; }
  });
  const [isEditing, setIsEditing] = React.useState(false);
  const [editGoal, setEditGoal] = React.useState<Record<string, string>>({});
  const [customLabel, setCustomLabel] = React.useState('');

  const resolveVal = (type: MetricType): number => {
    const avg = clientsCount > 0 ? revenue / clientsCount : 0;
    const map: Record<MetricType, number> = {
      revenue, clients: clientsCount, appointments: todayAppts,
      avg_ticket: avg, growth, retention: 68, team: activeStaffPct, custom: 0,
    };
    return map[type] ?? 0;
  };
  const fmt = (v: number, u?: string) => {
    if (u === 'currency') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    if (u === 'percent') return `${v.toFixed(1)}%`;
    return String(Math.round(v));
  };
  const save = (m: DashboardMetric[]) => { setMetrics(m); localStorage.setItem(SK, JSON.stringify(m)); };
  const toggleV = (id: string) => save(metrics.map(m => m.id === id ? { ...m, visible: !m.visible } : m));
  const updGoal = (id: string, g: number) => save(metrics.map(m => m.id === id ? { ...m, goal: g } : m));
  const addCustom = () => {
    if (!customLabel.trim()) return;
    save([...metrics, { id: `c_${Date.now()}`, type: 'custom', label: customLabel, icon: 'star', color: 'amber', goal: 100, unit: 'number', visible: true }]);
    setCustomLabel('');
  };
  const visible = metrics.filter(m => m.visible);
  const cols = visible.length <= 2 ? visible.length : visible.length === 3 ? 3 : 4;
  return (
    <div className="space-y-3">
      {visible.length > 0 && (
        <div className={`grid gap-4 grid-cols-2 lg:grid-cols-${cols}`}>
          {visible.map(m => {
            const val = resolveVal(m.type);
            const pct = m.goal ? Math.min(100, Math.round((val / m.goal) * 100)) : null;
            const cc = M_COLORS[m.color] || M_COLORS['primary'];
            return (
              <div key={m.id} className="card-boutique p-5 relative overflow-hidden hover:scale-[1.01] transition-transform duration-200">
                <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10 ${cc.split(' ')[0]}`} />
                <div className={`size-10 rounded-xl border flex items-center justify-center mb-3 ${cc}`}>
                  <span className="material-symbols-outlined text-lg">{m.icon}</span>
                </div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{m.label}</p>
                <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{fmt(val, m.unit)}</p>
                {pct !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                      <span>Meta: {fmt(m.goal!, m.unit)}</span>
                      <span className="font-black">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isEditing ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}>
          <span className="material-symbols-outlined text-sm">{isEditing ? 'check' : 'tune'}</span>
          {isEditing ? 'Concluir' : 'Personalizar Métricas'}
        </button>
      </div>
      {isEditing && (
        <div className="card-boutique p-5 border-primary/20 animate-fade-in">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">tune</span>
            Configurar Painel de Métricas
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {metrics.map(m => (
              <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${m.visible ? 'border-primary/30 bg-primary/5' : 'border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}>
                <button onClick={() => toggleV(m.id)} className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${m.visible ? 'bg-primary border-primary' : 'border-slate-300 dark:border-white/20'}`}>
                  {m.visible && <span className="material-symbols-outlined text-white" style={{ fontSize: '10px' }}>check</span>}
                </button>
                <span className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${M_COLORS[m.color]}`}>
                  <span className="material-symbols-outlined text-sm">{m.icon}</span>
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-white flex-1 truncate">{m.label}</span>
                {m.visible && (
                  <input type="number" title={`Meta de ${m.label}`} placeholder="Meta"
                    value={editGoal[m.id] ?? m.goal ?? ''}
                    onChange={e => setEditGoal({ ...editGoal, [m.id]: e.target.value })}
                    onBlur={() => { if (editGoal[m.id]) updGoal(m.id, Number(editGoal[m.id])); }}
                    className="w-20 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] text-right font-bold outline-none text-slate-900 dark:text-white" />
                )}
                {m.type === 'custom' && (
                  <button onClick={() => save(metrics.filter(x => x.id !== m.id))} className="text-red-400 hover:text-red-600 shrink-0">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-white/5">
            <input type="text" placeholder="Nova métrica personalizada..." title="Nome da nova métrica"
              value={customLabel} onChange={e => setCustomLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" />
            <button onClick={addCustom} disabled={!customLabel.trim()}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm disabled:opacity-40 flex items-center gap-1.5 transition-all">
              <span className="material-symbols-outlined text-sm">add</span>
              Adicionar
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">💡 Ajuste a meta ao lado de cada métrica. A barra de progresso é atualizada em tempo real.</p>
        </div>
      )}
    </div>
  );
};
/* ──────────────────────────────────────────────────────────── */

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

  // Detail Modal State
  const [selectedAppointment, setSelectedAppointment] = useState<DBAppointment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setClients([]);
      setStaffList([]);
      setAppointments([]);
      setLoading(false);
      setToast({ message: 'Tenant invalido para carregar dashboard.', type: 'error' });
      return;
    }

    setLoading(true);
    const [clientsRes, staffRes, servicesRes, apptsRes, profileRes, transRes] = await Promise.all([
      supabase.from('clients').select('id, name, phone, email, birthday, last_visit, avatar').eq('tenant_id', tenantId).order('name'),
      supabase.from('staff').select('id, name').eq('tenant_id', tenantId).eq('status', 'active'),
      supabase.from('services').select('id, name, duration, price').eq('tenant_id', tenantId).eq('active', true).order('name'),
      supabase.from('appointments').select('*').eq('tenant_id', tenantId).neq('status', 'cancelled').gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(10),
      user ? supabase.from('profiles').select('onboarding_completed').eq('id', user.id).single() : Promise.resolve({ data: null }),
      supabase.from('transactions').select('*').eq('tenant_id', tenantId).eq('type', 'income').order('date', { ascending: true })
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
      const { data: todayAppts } = await supabase
        .from('appointments')
        .select('staff_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'confirmed')
        .gte('start_time', `${todayStr}T00:00:00`);
      const activeIds = new Set(todayAppts?.map(a => a.staff_id));
      const percent = staffRes.data.length > 0 ? (activeIds.size / staffRes.data.length) * 100 : 0;
      setMetrics(prev => ({ ...prev, activeStaffPercent: percent || 0 }));
    }

    if (servicesRes.error) {
      const legacyServices = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      if (legacyServices.data) {
        setServicesList(
          legacyServices.data.map((s: any) => ({
            id: s.id,
            name: s.name,
            duration: Number(s.duration_minutes) || 30,
            duration_minutes: Number(s.duration_minutes) || 30,
            price: Number(s.price) || 0,
          }))
        );
      } else {
        setServicesList([]);
      }
    } else if (servicesRes.data && servicesRes.data.length > 0) {
      setServicesList(
        servicesRes.data.map((s: any) => ({
          ...s,
          duration: Number(s.duration) || 30,
          price: Number(s.price) || 0,
        }))
      );
    } else {
      const fallbackServices = await supabase
        .from('services')
        .select('id, name, duration, price')
        .eq('tenant_id', tenantId)
        .neq('active', false)
        .order('name');

      if (fallbackServices.data && fallbackServices.data.length > 0) {
        setServicesList(
          fallbackServices.data.map((s: any) => ({
            ...s,
            duration: Number(s.duration) || 30,
            price: Number(s.price) || 0,
          }))
        );
      } else {
        const legacyServices = await supabase
          .from('services')
          .select('id, name, duration_minutes, price')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('name');

        if (legacyServices.data) {
          setServicesList(
            legacyServices.data.map((s: any) => ({
              id: s.id,
              name: s.name,
              duration: Number(s.duration_minutes) || 30,
              duration_minutes: Number(s.duration_minutes) || 30,
              price: Number(s.price) || 0,
            }))
          );
        } else {
          setServicesList([]);
        }
      }
    }
    if (apptsRes.data) setAppointments(apptsRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setLoading(false);
  }, [tenantId, user]);

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
    if (!tenantId) {
      setToast({ message: 'Tenant invalido para cadastrar cliente.', type: 'error' });
      return;
    }

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
    if (!tenantId) {
      setToast({ message: 'Tenant invalido para criar agendamento.', type: 'error' });
      return;
    }

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
      duration: (Number(selectedService.duration ?? selectedService.duration_minutes) || 30) / 60,
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
        const { data: serviceData } = await supabase
          .from('services')
          .select('price')
          .eq('id', formData.serviceId)
          .eq('tenant_id', tenantId)
          .single();

        await supabase.from('comanda_items').insert({
          comanda_id: comanda.id,
          service_id: formData.serviceId,
          product_name: selectedService.name,
          quantity: 1,
          unit_price: serviceData?.price || 0,
          tenant_id: tenantId
        });

        // Update comanda total
        await supabase
          .from('comandas')
          .update({ total: serviceData?.price || 0 })
          .eq('id', comanda.id)
          .eq('tenant_id', tenantId);
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
    if (!tenantId) return;
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (!error) {
      setToast({ message: 'Agendamento cancelado.', type: 'info' });
      fetchData();
    }
    setActiveMenuId(null);
  };

  const handleCompleteAppointment = async (id: string) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', id)
      .eq('tenant_id', tenantId);
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
          <p className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-1">
            SEJA BEM VINDO, {user?.user_metadata?.shop_name || user?.user_metadata?.first_name || 'MINHA BARBEARIA'}
          </p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight display-font">Visão Geral Executiva</h2>
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

      {/* ─── PAINEL DE MÉTRICAS PERSONALIZÁVEIS ─── */}
      <MetricsPanel
        revenue={metrics.revenue}
        clientsCount={clients.length}
        todayAppts={appointments.length}
        growth={metrics.growth}
        activeStaffPct={metrics.activeStaffPercent}
      />

      {/* ONBOARDING CHECKLIST */}
      {profile && !profile.onboarding_completed && (
        <OnboardingChecklist onComplete={() => setProfile({ ...profile, onboarding_completed: true })} />
      )}

      {/* ROW 1: AGENDAMENTO RÁPIDO & PRÓXIMOS AGENDAMENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AGENDAMENTO RÁPIDO */}
        <div className="card-boutique p-6">
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
                  title="Data do Agendamento"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="relative">
                <input
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-lg text-xs py-2 px-2 text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  type="time"
                  title="Hora do Agendamento"
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
                  title="Selecionar Barbeiro"
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
                  title="Selecionar Serviço"
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

        {/* PRÓXIMOS AGENDAMENTOS */}
        <div className="card-boutique p-6">
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
                  <div className="flex-1 min-w-0" onClick={() => { setSelectedAppointment(item); setIsDetailModalOpen(true); }}>
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
                          onClick={() => {
                            if (item.client_phone) {
                              const date = new Date(item.start_time);
                              const formattedDate = date.toLocaleDateString('pt-BR');
                              const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                              const text = `Olá ${item.client_name.split(' ')[0]}! Passando para confirmar seu agendamento no dia ${formattedDate} às ${formattedTime} para o serviço ${item.service_name}. Nos vemos lá! 😄`;
                              window.open(`https://wa.me/55${item.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                            }
                            setActiveMenuId(null);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 ${item.client_phone ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 cursor-not-allowed opacity-50'}`}
                        >
                          <span className="material-symbols-outlined text-sm">chat</span> WhatsApp
                        </button>
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
      </div>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedAppointment(null); }}
        title="Resumo do Atendimento"
        maxWidth="md"
      >
        {selectedAppointment && (() => {
          const apt = selectedAppointment;
          const startDate = new Date(apt.start_time);
          const staff = staffList.find(s => s.name === apt.staff_name);

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
                    <p className="text-base font-black text-slate-900 dark:text-white truncate">{apt.client_name}</p>
                    {apt.client_phone && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-sm">phone</span>
                        {apt.client_phone}
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
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{apt.service_name}</p>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1.5">Profissional</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">badge</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{apt.staff_name || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Data</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-4 border border-slate-100 dark:border-border-dark text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Horário</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3 border-t border-slate-100 dark:border-white/5 mt-2">
                <button
                  onClick={() => {
                    if (apt.client_phone) {
                      const text = `Olá ${apt.client_name.split(' ')[0]}! Passando para confirmar seu agendamento no dia ${startDate.toLocaleDateString('pt-BR')} às ${startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} para o serviço ${apt.service_name}. Nos vemos lá! 😄`;
                      window.open(`https://wa.me/55${apt.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
                    }
                  }}
                  disabled={!apt.client_phone}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-[#25D366] text-white hover:bg-[#20b857] shadow-lg shadow-[#25D366]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
                >
                  <span className="material-symbols-outlined text-sm">chat</span> WhatsApp
                </button>

                <button
                  onClick={() => { setIsDetailModalOpen(false); setSelectedAppointment(null); navigate('/schedule'); }}
                  className="flex-1 min-w-[120px] px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                  Agenda Completa
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ROW 2: EQUIPE & ANIVERSARIANTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status da Equipe */}
        <div className="card-boutique p-6 flex flex-col justify-center items-center">
          <p className="text-slate-500 text-[10px] font-bold uppercase mb-4 self-start tracking-widest">Equipe Ativa</p>
          <div className="relative size-24">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-200 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
              <path className="text-primary" strokeDasharray={`${metrics.activeStaffPercent}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-2xl font-bold text-slate-900 dark:text-white display-font">{metrics.activeStaffPercent.toFixed(0)}%</span>
            </div>
          </div>
          <p className="mt-4 text-[10px] font-bold text-accent uppercase tracking-wider">Online Agora</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase">{staffList.length} colaboradores</p>
        </div>

        {/* Aniversariantes */}
        <div className="card-boutique p-6">
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

      {/* ROW 3: ALERTAS DA BARBEARIA E LEMBRETES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardAlerts />
        <DashboardReminders />
      </div>

      {/* ROW 4: MOTOR DE RETORNO INTELIGENTE — Widget */}
      <SmartReturnWidget clients={clients} onNavigate={() => navigate('/smart-return')} />

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
