import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CreditCard, FileSearch, HandCoins, ScrollText, Users } from 'lucide-react';
import Toast from '../components/Toast';
import SuperAdminHeader from '../components/superadmin/SuperAdminHeader';
import SuperAdminFilters from '../components/superadmin/SuperAdminFilters';
import KpiCard from '../components/superadmin/KpiCard';
import ActivityTimeline from '../components/superadmin/ActivityTimeline';
import DataTable, { DataColumn } from '../components/superadmin/DataTable';
import StatusBadge from '../components/superadmin/StatusBadge';
import AlertStack from '../components/superadmin/AlertStack';
import QuickActionsPanel from '../components/superadmin/QuickActionsPanel';
import AuditDrawer from '../components/superadmin/AuditDrawer';
import AdminActionMenu from '../components/superadmin/AdminActionMenu';
import { AdminActivity, AdminFilterState, AdminKpi, AdminStatus, AdminTab, AuditEntry, ManagedUserRow, QuickAction, RiskAlert, SubscriptionRequestRow } from '../components/superadmin/types';
import Button from '../components/ui/Button';
import { supabase } from '../services/supabaseClient';

type TenantRow = { id: string; name: string; slug: string; active: boolean; created_at: string };
type ProfileRow = { id: string; tenant_id: string | null; full_name: string | null; role: string | null; created_at: string; updated_at?: string | null };
type PlanRow = { id: string; user_id: string; current_plan: string | null; requested_plan: string | null; status: string; created_at: string };
type TicketRow = { id: string; user_id: string; subject: string; description: string | null; status: string; priority: string; created_at: string };
type AlertRow = { id: string; resource_type: string; message: string; level: string; usage_pct: number | null; resolved_at: string | null; created_at: string };
type AuditLogRow = { id: string; table_name: string; record_id: string; action: string; old_data: Record<string, any> | null; new_data: Record<string, any> | null; changed_by: string | null; changed_at: string; tenant_id: string | null };
type AccessRequestRow = { id: string; tenant_name: string | null; owner_name: string | null; email: string | null; phone: string | null; status: string; created_at: string };
type CompanyRow = { id: string; name: string; slug: string; usersCount: number; createdAt: string; status: AdminStatus };

const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Visao Geral', icon: <HandCoins className="h-4 w-4" /> },
  { id: 'companies', label: 'Empresas', icon: <Building2 className="h-4 w-4" /> },
  { id: 'users', label: 'Usuarios', icon: <Users className="h-4 w-4" /> },
  { id: 'subscriptions', label: 'Solicitacoes', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'audit', label: 'Auditoria', icon: <ScrollText className="h-4 w-4" /> },
  { id: 'logs', label: 'Alertas', icon: <FileSearch className="h-4 w-4" /> },
];

const defaultFilters: AdminFilterState = {
  period: '7d',
  company: 'all',
  status: 'all',
  movementType: 'all',
  plan: 'all',
  user: 'all',
  financial: 'all',
  blockedState: 'all',
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
const formatDateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const paginate = <T,>(items: T[], page: number, size = 6) => ({ totalPages: Math.max(1, Math.ceil(items.length / size)), items: items.slice((page - 1) * size, (page - 1) * size + size) });

const mapPlanStatus = (status: string): AdminStatus => status === 'approved' ? 'aprovado' : status === 'rejected' ? 'recusado' : 'pendente';
const mapTicketStatus = (status: string): AdminStatus => status === 'closed' ? 'aprovado' : status === 'responded' ? 'analise' : 'pendente';
const mapAlertSeverity = (level: string): 'alto' | 'medio' | 'baixo' => level === 'critical' ? 'alto' : level === 'warning' ? 'medio' : 'baixo';
const periodStart = (period: string) => {
  const now = new Date();
  const days = period === '24h' ? 1 : period === '30d' ? 30 : period === '90d' ? 90 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};

const SuperAdmin: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AdminFilterState>(defaultFilters);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [activityPage, setActivityPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [companyPage, setCompanyPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<AdminActivity | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date().toISOString());

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestRow[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const savedView = localStorage.getItem('superadmin-view');
    if (!savedView) return;

    try {
      const parsed = JSON.parse(savedView) as Partial<{
        filters: AdminFilterState;
        search: string;
        activeTab: AdminTab;
      }>;

      if (parsed.filters) setFilters({ ...defaultFilters, ...parsed.filters });
      if (typeof parsed.search === 'string') setSearch(parsed.search);
      if (parsed.activeTab) setActiveTab(parsed.activeTab);
    } catch (error) {
      console.warn('Nao foi possivel restaurar a visao salva do SuperAdmin.', error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      supabase.from('tenants').select('id, name, slug, active, created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, tenant_id, full_name, role, created_at, updated_at').order('created_at', { ascending: false }),
      supabase.from('plan_change_requests').select('id, user_id, current_plan, requested_plan, status, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('support_tickets').select('id, user_id, subject, description, status, priority, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('alerts').select('id, resource_type, message, level, usage_pct, resolved_at, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('audit_logs').select('id, table_name, record_id, action, old_data, new_data, changed_by, changed_at, tenant_id').order('changed_at', { ascending: false }).limit(100),
      supabase.from('access_requests').select('id, tenant_name, owner_name, email, phone, status, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('transactions').select('id, type, amount, date, tenant_id').order('date', { ascending: false }).limit(500),
    ]);

    const failedSources = results.filter((result) => result.status !== 'fulfilled' || Boolean(result.value?.error)).length;

    const unwrap = <T,>(result: PromiseSettledResult<any>): T[] => {
      if (result.status !== 'fulfilled' || result.value?.error) return [];
      return (result.value.data || []) as T[];
    };

    setTenants(unwrap<TenantRow>(results[0]));
    setProfiles(unwrap<ProfileRow>(results[1]));
    setPlans(unwrap<PlanRow>(results[2]));
    setTickets(unwrap<TicketRow>(results[3]));
    setAlerts(unwrap<AlertRow>(results[4]));
    setAuditLogs(unwrap<AuditLogRow>(results[5]));
    setAccessRequests(unwrap<AccessRequestRow>(results[6]));
    setTransactions(unwrap<any>(results[7]));
    setLastUpdatedAt(new Date().toISOString());
    if (failedSources > 0) {
      setToast({
        message: `${failedSources} consultas nao puderam ser carregadas. O painel exibiu apenas os blocos disponiveis.`,
        type: 'info',
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setActivityPage(1); setUserPage(1); setSubscriptionPage(1); setCompanyPage(1); }, [filters, search]);

  const tenantMap = useMemo(() => tenants.reduce<Record<string, TenantRow>>((acc, tenant) => { acc[tenant.id] = tenant; return acc; }, {}), [tenants]);
  const profileMap = useMemo(() => profiles.reduce<Record<string, ProfileRow>>((acc, profile) => { acc[profile.id] = profile; return acc; }, {}), [profiles]);

  const companies = useMemo<CompanyRow[]>(() => tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    usersCount: profiles.filter((profile) => profile.tenant_id === tenant.id).length,
    createdAt: tenant.created_at,
    status: tenant.active ? 'ativo' : 'inativo',
  })), [profiles, tenants]);

  const users = useMemo<ManagedUserRow[]>(() => profiles.map((profile) => {
    const tenant = profile.tenant_id ? tenantMap[profile.tenant_id] : null;
    return {
      id: profile.id,
      name: profile.full_name || 'Usuario sem nome',
      company: tenant?.name || 'Sem tenant',
      role: profile.role || 'Sem perfil',
      lastAccess: profile.updated_at || profile.created_at,
      status: tenant?.active === false ? 'inativo' : 'ativo',
      phone: '-',
      email: profile.id,
      riskLevel: auditLogs.filter((audit) => audit.changed_by === profile.id).length > 3 ? 'alto' : 'baixo',
      history: [`Criado em ${formatDate(profile.created_at)}`],
    };
  }), [auditLogs, profiles, tenantMap]);

  const subscriptions = useMemo<SubscriptionRequestRow[]>(() => plans.map((plan) => {
    const profile = profileMap[plan.user_id];
    const tenant = profile?.tenant_id ? tenantMap[profile.tenant_id] : null;
    return {
      id: plan.id,
      company: tenant?.name || 'Sem tenant',
      owner: profile?.full_name || 'Usuario sem nome',
      plan: plan.requested_plan || plan.current_plan || 'Plano nao informado',
      value: 0,
      paymentMethod: 'Nao informado',
      status: mapPlanStatus(plan.status),
      requestDate: plan.created_at,
      dueDate: plan.created_at,
      history: [`Atual: ${plan.current_plan || 'Nao informado'}`, `Solicitado: ${plan.requested_plan || 'Nao informado'}`],
    };
  }), [plans, profileMap, tenantMap]);

  const alertItems = useMemo<RiskAlert[]>(() => {
    const baseAlerts = alerts.filter((item) => !item.resolved_at).map((item) => ({
      id: item.id,
      title: `Alerta em ${item.resource_type}`,
      description: item.message,
      count: 1,
      severity: mapAlertSeverity(item.level),
      sla: item.level === 'critical' ? 'Agir em ate 1h' : 'Agir hoje',
      cta: 'Abrir aba de alertas',
    } as RiskAlert));
    const supportAlerts = tickets.filter((ticket) => ticket.status !== 'closed').map((ticket) => ({
      id: `ticket-${ticket.id}`,
      title: 'Ticket de suporte aberto',
      description: ticket.subject,
      count: 1,
      severity: ticket.priority === 'high' ? 'alto' : 'medio',
      sla: ticket.priority === 'high' ? 'Agir em ate 2h' : 'Tratar hoje',
      cta: 'Abrir suporte',
    } as RiskAlert));
    return [...baseAlerts, ...supportAlerts].slice(0, 8);
  }, [alerts, tickets]);

  const audits = useMemo<AuditEntry[]>(() => auditLogs.map((audit) => ({
    id: audit.id,
    actor: audit.changed_by ? (profileMap[audit.changed_by]?.full_name || 'Sistema') : 'Sistema',
    when: audit.changed_at,
    action: `${audit.action} em ${audit.table_name}`,
    oldValue: audit.old_data ? JSON.stringify(audit.old_data).slice(0, 48) : '-',
    newValue: audit.new_data ? JSON.stringify(audit.new_data).slice(0, 48) : '-',
    origin: audit.table_name,
    riskLevel: audit.action === 'DELETE' ? 'alto' : audit.action === 'UPDATE' ? 'medio' : 'baixo',
    relatedObject: audit.record_id,
    justification: `Evento auditado na tabela ${audit.table_name}.`,
  })), [auditLogs, profileMap]);

  const activities = useMemo<AdminActivity[]>(() => {
    const rows: AdminActivity[] = [];
    auditLogs.forEach((audit) => {
      const actor = audit.changed_by ? (profileMap[audit.changed_by]?.full_name || 'Sistema') : 'Sistema';
      rows.push({
        id: `audit-${audit.id}`,
        dateTime: audit.changed_at,
        type: `${audit.action} em ${audit.table_name}`,
        company: audit.tenant_id ? (tenantMap[audit.tenant_id]?.name || 'Plataforma') : 'Plataforma',
        user: actor,
        origin: audit.table_name,
        status: audit.action === 'DELETE' ? 'critico' : audit.action === 'UPDATE' ? 'analise' : 'ativo',
        actor,
        summary: `Registro ${audit.record_id} alterado na tabela ${audit.table_name}.`,
        eventType: audit.table_name,
        notes: 'Evento carregado da trilha de auditoria.',
        technicalLog: JSON.stringify({ old_data: audit.old_data, new_data: audit.new_data }, null, 2),
        auditTrail: [`Tabela: ${audit.table_name}`, `Acao: ${audit.action}`, `Registro: ${audit.record_id}`],
      });
    });
    tickets.forEach((ticket) => {
      const profile = profileMap[ticket.user_id];
      const tenant = profile?.tenant_id ? tenantMap[profile.tenant_id] : null;
      rows.push({
        id: `ticket-${ticket.id}`,
        dateTime: ticket.created_at,
        type: 'Ticket de suporte',
        company: tenant?.name || 'Sem tenant',
        user: profile?.full_name || ticket.user_id,
        origin: 'Suporte',
        status: mapTicketStatus(ticket.status),
        actor: profile?.full_name || 'Usuario',
        summary: ticket.subject,
        eventType: 'support_ticket',
        notes: ticket.description || 'Ticket sem descricao.',
        technicalLog: JSON.stringify(ticket, null, 2),
        auditTrail: [`Prioridade: ${ticket.priority}`, `Status: ${ticket.status}`],
      });
    });
    alerts.filter((alert) => !alert.resolved_at).forEach((alert) => {
      rows.push({
        id: `alert-${alert.id}`,
        dateTime: alert.created_at,
        type: `Alerta ${alert.resource_type}`,
        company: 'Plataforma',
        user: 'Sistema',
        origin: 'Monitoramento',
        status: alert.level === 'critical' ? 'critico' : 'analise',
        actor: 'Supabase Monitor',
        summary: alert.message,
        eventType: alert.resource_type,
        notes: `Uso reportado: ${alert.usage_pct || 0}%`,
        technicalLog: JSON.stringify(alert, null, 2),
        auditTrail: [`Recurso: ${alert.resource_type}`, `Nivel: ${alert.level}`],
      });
    });
    accessRequests.forEach((request) => {
      rows.push({
        id: `access-${request.id}`,
        dateTime: request.created_at,
        type: 'Solicitacao de acesso',
        company: request.tenant_name || 'Novo tenant',
        user: request.owner_name || request.email || 'Solicitante',
        origin: 'Landing',
        status: request.status === 'approved' ? 'aprovado' : request.status === 'rejected' ? 'recusado' : 'pendente',
        actor: request.owner_name || 'Solicitante',
        summary: `Solicitacao recebida para ${request.tenant_name || 'empresa nova'}.`,
        eventType: 'access_request',
        notes: request.phone || request.email || 'Sem contato adicional.',
        technicalLog: JSON.stringify(request, null, 2),
        auditTrail: [`Status: ${request.status}`, `Email: ${request.email || 'Nao informado'}`],
      });
    });
    return rows.sort((a, b) => +new Date(b.dateTime) - +new Date(a.dateTime));
  }, [accessRequests, alerts, auditLogs, profileMap, tenantMap, tickets]);

  const kpis = useMemo<AdminKpi[]>(() => {
    const income = transactions.filter((item: any) => item.type === 'income').reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    return [
      { id: 'kpi-tenants', title: 'Empresas ativas', value: String(tenants.filter((tenant) => tenant.active).length), delta: `${tenants.length} tenants cadastrados`, context: 'Base real de tenants em operacao.', icon: Building2, tone: 'gold' },
      { id: 'kpi-users', title: 'Usuarios mapeados', value: String(profiles.length), delta: `${profiles.filter((profile) => (profile.role || '').toLowerCase() === 'manager').length} gestores`, context: 'Perfis reais encontrados em profiles.', icon: Users, tone: 'emerald' },
      { id: 'kpi-requests', title: 'Solicitacoes pendentes', value: String(plans.filter((plan) => plan.status === 'pending').length + accessRequests.filter((request) => request.status === 'pending').length), delta: `${tickets.filter((ticket) => ticket.status !== 'closed').length} tickets em aberto`, context: 'Fila comercial e operacional atual.', icon: CreditCard, tone: 'blue' },
      { id: 'kpi-alerts', title: 'Alertas criticos', value: String(alerts.filter((alert) => !alert.resolved_at && alert.level === 'critical').length), delta: `${alertItems.length} alertas ativos`, context: 'Incidentes reais do ambiente.', icon: AlertTriangle, tone: 'red' },
      { id: 'kpi-finance', title: 'Movimento financeiro', value: formatCurrency(income), delta: `${transactions.length} transacoes lidas`, context: 'Receitas registradas em transactions.', icon: HandCoins, tone: 'gold' },
      { id: 'kpi-audit', title: 'Eventos auditados', value: String(auditLogs.length), delta: `${auditLogs.filter((audit) => audit.action === 'DELETE').length} exclusoes`, context: 'Trilha real vinda de audit_logs.', icon: ScrollText, tone: 'slate' },
    ];
  }, [accessRequests, alertItems.length, alerts, auditLogs, plans, profiles, tenants, tickets, transactions]);

  const filterOptions = useMemo(() => ({
    periods: [{ value: '24h', label: 'Ultimas 24h' }, { value: '7d', label: 'Ultimos 7 dias' }, { value: '30d', label: 'Ultimos 30 dias' }, { value: '90d', label: 'Ultimos 90 dias' }],
    companies: [{ value: 'all', label: 'Todas empresas' }, ...companies.map((row) => ({ value: row.name, label: row.name }))],
    statuses: [{ value: 'all', label: 'Todos status' }, ...Array.from(new Set([...activities.map((item) => item.status), ...subscriptions.map((item) => item.status), ...users.map((item) => item.status)])).map((status) => ({ value: status, label: status }))],
    movementTypes: [{ value: 'all', label: 'Todas movimentacoes' }, ...Array.from(new Set(activities.map((item) => item.type))).map((type) => ({ value: type, label: type }))],
    plans: [{ value: 'all', label: 'Todos planos' }, ...Array.from(new Set(subscriptions.map((item) => item.plan))).map((plan) => ({ value: plan, label: plan }))],
    users: [{ value: 'all', label: 'Todos usuarios' }, ...users.map((user) => ({ value: user.name, label: user.name }))],
    financialStates: [{ value: 'all', label: 'Toda situacao financeira' }, { value: 'regular', label: 'Regular' }, { value: 'inadimplente', label: 'Inadimplente' }, { value: 'aguardando pagamento', label: 'Aguardando pagamento' }],
    blockedStates: [{ value: 'all', label: 'Todos' }, { value: 'blocked', label: 'Bloqueados' }, { value: 'unblocked', label: 'Desbloqueados' }],
  }), [activities, companies, subscriptions, users]);

  const quickActions: QuickAction[] = [
    { id: 'go-companies', label: 'Abrir empresas', description: 'Mostra a base real de tenants cadastrados.', tone: 'default' },
    { id: 'go-users', label: 'Revisar usuarios', description: 'Abre a lista real de perfis.', tone: 'default' },
    { id: 'go-subscriptions', label: 'Ver solicitacoes', description: 'Mostra os pedidos de plano ativos.', tone: 'default' },
    { id: 'go-audit', label: 'Abrir auditoria', description: 'Vai para a trilha administrativa real.', tone: 'default' },
    { id: 'go-logs', label: 'Abrir alertas', description: 'Mostra a fila de riscos e monitoramento.', tone: 'default' },
    { id: 'refresh', label: 'Atualizar painel', description: 'Recarrega todos os dados do ambiente.', tone: 'success' },
  ];

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const start = periodStart(filters.period);
    const matchesSearch = (values: (string | undefined)[]) => !term || values.some((value) => value && normalize(value).includes(term));
    const inRange = (value: string) => new Date(value) >= start;

    return {
      companies: companies.filter((row) => (filters.company === 'all' || row.name === filters.company) && matchesSearch([row.name, row.slug])),
      users: users.filter((row) => (filters.company === 'all' || row.company === filters.company) && (filters.user === 'all' || row.name === filters.user) && (filters.status === 'all' || normalize(row.status) === normalize(filters.status)) && matchesSearch([row.name, row.company, row.role, row.id])),
      subscriptions: subscriptions.filter((row) => inRange(row.requestDate) && (filters.company === 'all' || row.company === filters.company) && (filters.plan === 'all' || row.plan === filters.plan) && (filters.status === 'all' || normalize(row.status) === normalize(filters.status)) && matchesSearch([row.company, row.owner, row.plan, row.id])),
      activities: activities.filter((row) => inRange(row.dateTime) && (filters.company === 'all' || row.company === filters.company) && (filters.status === 'all' || normalize(row.status) === normalize(filters.status)) && (filters.movementType === 'all' || row.type === filters.movementType) && (filters.user === 'all' || row.user === filters.user) && matchesSearch([row.type, row.company, row.user, row.origin, row.actor])),
      alerts: alertItems.filter((row) => matchesSearch([row.title, row.description, row.severity, row.cta])),
      audits: audits.filter((row) => inRange(row.when) && matchesSearch([row.actor, row.action, row.origin, row.relatedObject])),
    };
  }, [activities, alertItems, audits, companies, filters, search, subscriptions, users]);

  const pagedActivities = paginate(filtered.activities, activityPage);
  const pagedUsers = paginate(filtered.users, userPage);
  const pagedSubscriptions = paginate(filtered.subscriptions, subscriptionPage);
  const pagedCompanies = paginate(filtered.companies, companyPage);

  const handleExport = () => {
    const payload = { generatedAt: new Date().toISOString(), filters, search, companies: filtered.companies, users: filtered.users, subscriptions: filtered.subscriptions, activities: filtered.activities, alerts: filtered.alerts, audits: filtered.audits };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `administracao-geral-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setToast({ message: 'Relatorio exportado com dados reais filtrados.', type: 'success' });
  };

  const handleSaveView = () => {
    localStorage.setItem('superadmin-view', JSON.stringify({ filters, search, activeTab }));
    setToast({ message: 'Visao salva neste navegador.', type: 'success' });
  };

  const handleAction = (action: QuickAction) => {
    setActionMenuOpen(false);
    if (action.id === 'refresh') { fetchData(); return; }
    if (action.id === 'go-companies') setActiveTab('companies');
    if (action.id === 'go-users') setActiveTab('users');
    if (action.id === 'go-subscriptions') setActiveTab('subscriptions');
    if (action.id === 'go-audit') setActiveTab('audit');
    if (action.id === 'go-logs') setActiveTab('logs');
  };

  const companyColumns: DataColumn<CompanyRow>[] = [
    { key: 'name', label: 'Empresa', render: (item) => <div><p className="font-bold text-slate-950 dark:text-white">{item.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.slug}</p></div> },
    { key: 'usersCount', label: 'Usuarios', render: (item) => item.usersCount },
    { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
    { key: 'createdAt', label: 'Criada em', render: (item) => formatDate(item.createdAt) },
  ];
  const userColumns: DataColumn<ManagedUserRow>[] = [
    { key: 'name', label: 'Usuario', render: (item) => <div><p className="font-bold text-slate-950 dark:text-white">{item.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.id}</p></div> },
    { key: 'company', label: 'Empresa', render: (item) => item.company },
    { key: 'role', label: 'Perfil', render: (item) => item.role },
    { key: 'lastAccess', label: 'Atualizado em', render: (item) => formatDateTime(item.lastAccess) },
    { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
  ];
  const subscriptionColumns: DataColumn<SubscriptionRequestRow>[] = [
    { key: 'company', label: 'Empresa', render: (item) => <div><p className="font-bold text-slate-950 dark:text-white">{item.company}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.owner}</p></div> },
    { key: 'plan', label: 'Plano', render: (item) => item.plan },
    { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
    { key: 'requestDate', label: 'Criado em', render: (item) => formatDate(item.requestDate) },
    { key: 'action', label: 'Acao', align: 'right', render: (item) => <div className="flex justify-end"><Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setToast({ message: `Solicitacao ${item.id} aberta para analise.`, type: 'info' })}>Ver historico</Button></div> },
  ];
  const auditColumns: DataColumn<AuditEntry>[] = [
    { key: 'actor', label: 'Quem fez', render: (item) => item.actor },
    { key: 'when', label: 'Quando', render: (item) => formatDateTime(item.when) },
    { key: 'action', label: 'Acao', render: (item) => item.action },
    { key: 'origin', label: 'Origem', render: (item) => item.origin },
    { key: 'riskLevel', label: 'Risco', render: (item) => <span className="capitalize">{item.riskLevel}</span> },
  ];

  if (loading) {
    return <section className="rounded-[2rem] border border-slate-200/80 bg-white p-10 text-center dark:border-[#262A33] dark:bg-[#141519]"><div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div><p className="mt-3 text-sm text-slate-500">Carregando dados administrativos reais...</p></section>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SuperAdminHeader search={search} onSearchChange={setSearch} onExport={handleExport} onRefresh={fetchData} onOpenActionMenu={() => setActionMenuOpen(true)} lastUpdatedLabel={new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(lastUpdatedAt))} />
      <SuperAdminFilters value={filters} onChange={setFilters} onReset={() => { setFilters(defaultFilters); setSearch(''); }} onSaveView={handleSaveView} options={filterOptions} />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{kpis.map((item) => <KpiCard key={item.id} item={item} />)}</section>
      <section className="card-boutique p-3"><div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'}`}>{tab.icon}{tab.label}</button>)}</div></section>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <ActivityTimeline items={pagedActivities.items} onOpenDetails={setSelectedActivity} />
            <DataTable title="Solicitacoes de plano" description="Pedidos reais de mudanca de plano no ambiente." columns={subscriptionColumns} rows={pagedSubscriptions.items} page={subscriptionPage} totalPages={pagedSubscriptions.totalPages} onPageChange={setSubscriptionPage} emptyTitle="Nenhuma solicitacao encontrada" emptyDescription="Nao ha mudancas de plano para os filtros atuais." />
            <DataTable title="Usuarios da plataforma" description="Perfis reais encontrados em profiles." columns={userColumns} rows={pagedUsers.items} page={userPage} totalPages={pagedUsers.totalPages} onPageChange={setUserPage} emptyTitle="Nenhum usuario localizado" emptyDescription="Nao ha usuarios para os filtros aplicados." />
            <DataTable title="Auditoria administrativa" description="Trilha real vinda de audit_logs." columns={auditColumns} rows={filtered.audits.slice(0, 6)} page={1} totalPages={1} onPageChange={() => undefined} emptyTitle="Nenhum evento auditado" emptyDescription="Nao ha eventos auditados para os filtros atuais." />
          </div>
          <div className="space-y-6 xl:col-span-4">
            <AlertStack items={filtered.alerts} onOpenAlert={() => setActiveTab('logs')} />
            <QuickActionsPanel actions={quickActions} onSelect={handleAction} />
          </div>
        </div>
      )}

      {activeTab === 'companies' && <DataTable title="Empresas e tenants" description="Base real de tenants cadastrados." columns={companyColumns} rows={pagedCompanies.items} page={companyPage} totalPages={pagedCompanies.totalPages} onPageChange={setCompanyPage} emptyTitle="Nenhuma empresa encontrada" emptyDescription="Nao ha tenants para os filtros atuais." />}
      {activeTab === 'users' && <DataTable title="Usuarios da plataforma" description="Perfis reais encontrados em profiles." columns={userColumns} rows={pagedUsers.items} page={userPage} totalPages={pagedUsers.totalPages} onPageChange={setUserPage} emptyTitle="Nenhum usuario encontrado" emptyDescription="Nao ha perfis correspondentes aos filtros." />}
      {activeTab === 'subscriptions' && <DataTable title="Solicitacoes de plano" description="Mudancas reais de plano vindas de plan_change_requests." columns={subscriptionColumns} rows={pagedSubscriptions.items} page={subscriptionPage} totalPages={pagedSubscriptions.totalPages} onPageChange={setSubscriptionPage} emptyTitle="Nenhuma solicitacao encontrada" emptyDescription="Nao ha solicitacoes no periodo." />}
      {activeTab === 'audit' && <DataTable title="Auditoria administrativa" description="Registros reais da tabela audit_logs." columns={auditColumns} rows={filtered.audits} page={1} totalPages={1} onPageChange={() => undefined} emptyTitle="Nenhum evento auditado" emptyDescription="Nao ha eventos auditados para os filtros atuais." />}
      {activeTab === 'logs' && <div className="space-y-6"><AlertStack items={filtered.alerts} onOpenAlert={() => setToast({ message: 'Alerta destacado na fila atual.', type: 'info' })} /><ActivityTimeline items={pagedActivities.items} onOpenDetails={setSelectedActivity} /></div>}

      <AuditDrawer item={selectedActivity} isOpen={Boolean(selectedActivity)} onClose={() => setSelectedActivity(null)} />
      <AdminActionMenu isOpen={actionMenuOpen} onClose={() => setActionMenuOpen(false)} onSelect={handleAction} />
    </div>
  );
};

export default SuperAdmin;
