import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Building2, CreditCard, FileSearch, HandCoins, ScrollText, Settings2, Shield, Users } from 'lucide-react';
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
import ConfirmActionModal from '../components/superadmin/ConfirmActionModal';
import { adminFilterOptions, cloneDataset, defaultAdminFilters, formatCurrency, overviewHealthCards } from '../components/superadmin/mockData';
import {
  AdminActivity,
  AdminFilterState,
  AdminTab,
  AuditEntry,
  ManagedUserRow,
  QuickAction,
  RiskAlert,
  SubscriptionRequestRow,
  SuperAdminDataset,
} from '../components/superadmin/types';
import Button from '../components/ui/Button';

const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Visao Geral', icon: <Activity className="h-4 w-4" /> },
  { id: 'companies', label: 'Empresas', icon: <Building2 className="h-4 w-4" /> },
  { id: 'users', label: 'Usuarios', icon: <Users className="h-4 w-4" /> },
  { id: 'subscriptions', label: 'Assinaturas', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'finance', label: 'Financeiro SaaS', icon: <HandCoins className="h-4 w-4" /> },
  { id: 'audit', label: 'Auditoria', icon: <ScrollText className="h-4 w-4" /> },
  { id: 'logs', label: 'Logs', icon: <FileSearch className="h-4 w-4" /> },
  { id: 'permissions', label: 'Permissoes', icon: <Shield className="h-4 w-4" /> },
  { id: 'settings', label: 'Configuracoes da Plataforma', icon: <Settings2 className="h-4 w-4" /> },
];

const ITEMS_PER_PAGE = 4;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const matchesStatus = (status: string, filter: string) => filter === 'all' || normalize(status) === normalize(filter);

const isBlockedStatus = (status: string) => ['bloqueado', 'suspenso'].includes(normalize(status));

const paginate = <T,>(items: T[], page: number) => {
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ITEMS_PER_PAGE;
  return {
    totalPages,
    page: safePage,
    items: items.slice(start, start + ITEMS_PER_PAGE),
  };
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));

const SuperAdmin: React.FC = () => {
  const [dataset, setDataset] = useState<SuperAdminDataset>(() => cloneDataset());
  const [filters, setFilters] = useState<AdminFilterState>(defaultAdminFilters);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [activityPage, setActivityPage] = useState(1);
  const [subscriptionPage, setSubscriptionPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<AdminActivity | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    setActivityPage(1);
    setSubscriptionPage(1);
    setUserPage(1);
  }, [filters, search]);

  const filteredData = useMemo(() => {
    const term = normalize(search.trim());
    const bySearch = (values: (string | undefined)[]) =>
      !term || values.some((value) => value && normalize(value).includes(term));

    const activities = dataset.activities.filter((item) => {
      if (filters.company !== 'all' && item.company !== filters.company) return false;
      if (!matchesStatus(item.status, filters.status)) return false;
      if (filters.movementType !== 'all' && item.type !== filters.movementType) return false;
      if (filters.user !== 'all' && item.user !== filters.user) return false;
      if (filters.blockedState === 'blocked' && !isBlockedStatus(item.status)) return false;
      if (filters.blockedState === 'unblocked' && isBlockedStatus(item.status)) return false;
      if (filters.financial === 'inadimplente' && normalize(item.status) !== 'inadimplente') return false;
      return bySearch([item.type, item.company, item.user, item.origin, item.actor, item.technicalLog]);
    });

    const subscriptions = dataset.subscriptions.filter((item) => {
      if (filters.company !== 'all' && item.company !== filters.company) return false;
      if (!matchesStatus(item.status, filters.status)) return false;
      if (filters.plan !== 'all' && item.plan !== filters.plan) return false;
      if (filters.financial === 'regular' && ['inadimplente', 'bloqueado'].includes(normalize(item.status))) return false;
      if (filters.financial === 'inadimplente' && normalize(item.status) !== 'inadimplente') return false;
      if (filters.financial === 'aguardando pagamento' && normalize(item.status) !== 'aguardando pagamento') return false;
      return bySearch([item.company, item.owner, item.plan, item.paymentMethod, item.id]);
    });

    const users = dataset.users.filter((item) => {
      if (filters.company !== 'all' && item.company !== filters.company) return false;
      if (!matchesStatus(item.status, filters.status)) return false;
      if (filters.user !== 'all' && item.name !== filters.user) return false;
      if (filters.blockedState === 'blocked' && !isBlockedStatus(item.status)) return false;
      if (filters.blockedState === 'unblocked' && isBlockedStatus(item.status)) return false;
      return bySearch([item.name, item.company, item.email, item.phone, item.role, item.id]);
    });

    const alerts = dataset.alerts.filter((item) => bySearch([item.title, item.description, item.severity, item.sla, item.cta]));
    const audits = dataset.audits.filter((item) => bySearch([item.actor, item.action, item.origin, item.relatedObject, item.justification]));

    return { activities, subscriptions, users, alerts, audits };
  }, [dataset, filters, search]);

  const pagedActivities = useMemo(() => paginate(filteredData.activities, activityPage), [filteredData.activities, activityPage]);
  const pagedSubscriptions = useMemo(() => paginate(filteredData.subscriptions, subscriptionPage), [filteredData.subscriptions, subscriptionPage]);
  const pagedUsers = useMemo(() => paginate(filteredData.users, userPage), [filteredData.users, userPage]);

  useEffect(() => {
    if (pagedActivities.page !== activityPage) setActivityPage(pagedActivities.page);
  }, [activityPage, pagedActivities.page]);

  useEffect(() => {
    if (pagedSubscriptions.page !== subscriptionPage) setSubscriptionPage(pagedSubscriptions.page);
  }, [subscriptionPage, pagedSubscriptions.page]);

  useEffect(() => {
    if (pagedUsers.page !== userPage) setUserPage(pagedUsers.page);
  }, [userPage, pagedUsers.page]);

  const lastUpdatedLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dataset.lastUpdatedAt)),
    [dataset.lastUpdatedAt],
  );

  const handleRefresh = () => {
    setDataset(cloneDataset());
    setToast({ message: 'Painel atualizado com sucesso.', type: 'success' });
  };

  const handleExport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      filters,
      activities: filteredData.activities,
      subscriptions: filteredData.subscriptions,
      users: filteredData.users,
      alerts: filteredData.alerts,
      audits: filteredData.audits,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `administracao-geral-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Relatorio exportado com a visao filtrada.', type: 'success' });
  };

  const handleSaveView = () => {
    setToast({ message: 'Vista administrativa salva para uso futuro.', type: 'info' });
  };

  const handleResetFilters = () => {
    setFilters(defaultAdminFilters);
    setSearch('');
    setToast({ message: 'Filtros redefinidos.', type: 'info' });
  };

  const handleAction = (action: QuickAction) => {
    setPendingAction(action);
  };

  const confirmPendingAction = () => {
    if (!pendingAction) return;
    setToast({ message: `${pendingAction.label} registrada com trilha de auditoria.`, type: 'success' });
    setPendingAction(null);
  };

  const subscriptionColumns: DataColumn<SubscriptionRequestRow>[] = [
    {
      key: 'company',
      label: 'Empresa',
      render: (item) => (
        <div>
          <p className="font-bold text-slate-950 dark:text-white">{item.company}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{item.owner}</p>
        </div>
      ),
    },
    { key: 'plan', label: 'Plano', render: (item) => <span className="font-medium">{item.plan}</span> },
    { key: 'value', label: 'Valor', render: (item) => formatCurrency(item.value) },
    { key: 'paymentMethod', label: 'Pagamento', render: (item) => item.paymentMethod },
    { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
    {
      key: 'dates',
      label: 'Pedido / vencimento',
      render: (item) => (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <p>{formatDate(item.requestDate)}</p>
          <p>Vence em {formatDate(item.dueDate)}</p>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Acao',
      align: 'right',
      render: (item) => (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setToast({ message: `Historico de ${item.company} aberto.`, type: 'info' })}>
            Ver historico
          </Button>
        </div>
      ),
    },
  ];

  const userColumns: DataColumn<ManagedUserRow>[] = [
    {
      key: 'name',
      label: 'Usuario',
      render: (item) => (
        <div>
          <p className="font-bold text-slate-950 dark:text-white">{item.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{item.email}</p>
        </div>
      ),
    },
    { key: 'company', label: 'Empresa', render: (item) => item.company },
    { key: 'role', label: 'Perfil', render: (item) => item.role },
    {
      key: 'lastAccess',
      label: 'Ultimo acesso',
      render: (item) => (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <p>{formatDateTime(item.lastAccess)}</p>
          <p>Telefone: {item.phone}</p>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
    {
      key: 'action',
      label: 'Acao',
      align: 'right',
      render: (item) => (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => setToast({ message: `Historico de atividades de ${item.name} aberto.`, type: 'info' })}>
            Ver historico
          </Button>
        </div>
      ),
    },
  ];

  const auditColumns: DataColumn<AuditEntry>[] = [
    { key: 'actor', label: 'Quem fez', render: (item) => item.actor },
    { key: 'when', label: 'Quando', render: (item) => formatDateTime(item.when) },
    { key: 'action', label: 'O que alterou', render: (item) => item.action },
    { key: 'oldValue', label: 'Valor antigo', render: (item) => item.oldValue },
    { key: 'newValue', label: 'Valor novo', render: (item) => item.newValue },
    { key: 'origin', label: 'IP / origem', render: (item) => item.origin },
    { key: 'riskLevel', label: 'Risco', render: (item) => <span className="capitalize">{item.riskLevel}</span> },
  ];

  const renderOverview = () => (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-6 xl:col-span-8">
        <ActivityTimeline items={pagedActivities.items} onOpenDetails={setSelectedActivity} />
        <DataTable
          title="Pedidos de assinatura"
          description="Decisoes comerciais e financeiras com historico, vencimento e situacao atual."
          columns={subscriptionColumns}
          rows={pagedSubscriptions.items}
          page={pagedSubscriptions.page}
          totalPages={pagedSubscriptions.totalPages}
          onPageChange={setSubscriptionPage}
          emptyTitle="Nenhum pedido de assinatura"
          emptyDescription="Os filtros atuais nao retornaram solicitacoes."
        />
        <DataTable
          title="Gestao de usuarios"
          description="Controle de acesso, permissoes, status de bloqueio e visao consolidada de risco."
          columns={userColumns}
          rows={pagedUsers.items}
          page={pagedUsers.page}
          totalPages={pagedUsers.totalPages}
          onPageChange={setUserPage}
          emptyTitle="Nenhum usuario localizado"
          emptyDescription="Nao ha usuarios correspondentes aos filtros informados."
        />
        <DataTable
          title="Auditoria administrativa"
          description="Resumo das ultimas acoes sensiveis com trilha de origem e comparativo de valores."
          columns={auditColumns}
          rows={filteredData.audits.slice(0, 4)}
          page={1}
          totalPages={1}
          onPageChange={() => undefined}
          emptyTitle="Nenhum evento de auditoria"
          emptyDescription="A trilha administrativa aparece aqui quando houver alteracoes sensiveis."
        />
      </div>

      <div className="space-y-6 xl:col-span-4">
        <AlertStack items={filteredData.alerts} onOpenAlert={(alert: RiskAlert) => setToast({ message: `${alert.title} aberto para analise.`, type: 'info' })} />
        <QuickActionsPanel actions={dataset.quickActions} onSelect={handleAction} />
        <section className="card-boutique p-5">
          <p className="text-base font-bold text-slate-950 dark:text-white">Saude do ambiente</p>
          <div className="mt-4 space-y-3">
            {overviewHealthCards.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-950 dark:text-white">{item.title}</p>
                      <p className="text-lg font-black text-slate-950 dark:text-white display-font">{item.value}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );

  const renderTabPlaceholder = (title: string, description: string, primaryCta: string) => (
    <section className="card-boutique p-8">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Modulo estruturado</p>
        <h3 className="mt-3 text-3xl font-black text-slate-950 dark:text-white display-font">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setToast({ message: `${primaryCta} aberto.`, type: 'info' })}>
            {primaryCta}
          </Button>
          <Button variant="secondary" onClick={() => setActiveTab('overview')}>
            Voltar para visao geral
          </Button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <SuperAdminHeader
        search={search}
        onSearchChange={setSearch}
        onExport={handleExport}
        onRefresh={handleRefresh}
        onOpenActionMenu={() => setActionMenuOpen(true)}
        lastUpdatedLabel={lastUpdatedLabel}
      />

      <SuperAdminFilters
        value={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        onSaveView={handleSaveView}
        options={adminFilterOptions}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dataset.kpis.map((item) => (
          <KpiCard key={item.id} item={item} />
        ))}
      </section>

      <section className="card-boutique p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'companies' &&
        renderTabPlaceholder(
          'Empresas e tenants',
          'Espaco reservado para consolidar carteira de tenants, status operacional, limite de uso, bloqueios por inadimplencia e saude de onboarding.',
          'Abrir operacao de empresas',
        )}
      {activeTab === 'users' &&
        renderTabPlaceholder(
          'Controle detalhado de usuarios',
          'Aba preparada para evoluir com filtros de acesso, analise de risco por perfil, redefinicao de credenciais e historico aprofundado.',
          'Abrir gestao de usuarios',
        )}
      {activeTab === 'subscriptions' &&
        renderTabPlaceholder(
          'Governanca de assinaturas',
          'Aba dedicada a upgrades, cancelamentos, renovacoes, divergencias de cobranca e trilha financeira do ciclo SaaS.',
          'Abrir operacoes de assinatura',
        )}
      {activeTab === 'finance' &&
        renderTabPlaceholder(
          'Financeiro SaaS',
          'Espaco pensado para MRR, churn, inadimplencia, cohort de planos e monitoramento de pagamentos com granularidade executiva.',
          'Abrir financeiro SaaS',
        )}
      {activeTab === 'audit' &&
        renderTabPlaceholder(
          'Auditoria master',
          'Area reservada para trilhas completas por acao, comparativo de valores, origens suspeitas, justificativas e consultas historicas.',
          'Abrir central de auditoria',
        )}
      {activeTab === 'logs' &&
        renderTabPlaceholder(
          'Logs administrativos e tecnicos',
          'Modulo pronto para concentrar logs de aplicacao, falhas de integracao, eventos de seguranca e rastreio por request ou tenant.',
          'Abrir visualizador de logs',
        )}
      {activeTab === 'permissions' &&
        renderTabPlaceholder(
          'Permissoes e politicas',
          'Modulo desenhado para perfis master, matrizes de acesso, heranca de permissoes e acoes com impacto financeiro ou operacional.',
          'Abrir permissoes',
        )}
      {activeTab === 'settings' &&
        renderTabPlaceholder(
          'Configuracoes da plataforma',
          'Espaco para regras globais do SaaS, parametros de cobranca, integracoes principais e preferencias do ambiente administrativo.',
          'Abrir configuracoes',
        )}

      <AuditDrawer item={selectedActivity} isOpen={Boolean(selectedActivity)} onClose={() => setSelectedActivity(null)} />
      <AdminActionMenu isOpen={actionMenuOpen} onClose={() => setActionMenuOpen(false)} onSelect={handleAction} />
      <ConfirmActionModal
        isOpen={Boolean(pendingAction)}
        title={pendingAction?.label || 'Confirmar acao'}
        description={pendingAction ? `${pendingAction.description} Revise a operacao antes de executar em producao.` : ''}
        impact="A acao pode alterar acesso de usuarios, disponibilidade de tenants ou o estado financeiro da assinatura."
        confirmLabel={pendingAction?.label || 'Confirmar'}
        tone={pendingAction?.tone === 'danger' ? 'danger' : pendingAction?.tone === 'success' ? 'success' : 'primary'}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
};

export default SuperAdmin;
