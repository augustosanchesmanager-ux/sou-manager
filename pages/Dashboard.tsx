import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import OnboardingChecklist from '../components/onboarding/OnboardingChecklist';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import {
  AppointmentDetailModal,
  NewClientModal,
  QuickScheduleModal,
  useDashboardActions,
  useDashboardData,
  fetchTodayDashboardData,
  type DashboardAppointment,
  type DashboardPeriod,
  type NewClientFormState,
  type QuickAppointmentFormState,
  type Client,
  type TodayDashboardData,
} from '../src/modules/dashboard';
import {
  DashboardHeader,
  DashboardWidgets,
  TodayCashCard,
  DayTimeline,
} from '../components/dashboard';
import ActivityTimelineModal from '../components/dashboard/ActivityTimelineModal';

const getDefaultQuickAppointmentDateTime = (): { date: string; time: string } => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isBusinessHours = currentHour >= 9 && currentHour < 22;

  if (isBusinessHours) {
    const nextHalfHour = currentMinute <= 30 ? 30 : 60;
    const nextHour = nextHalfHour > 30 ? currentHour + 1 : currentHour;
    const roundedMinute = nextHalfHour > 30 ? 0 : 30;

    const nextTime = new Date(now);
    nextTime.setHours(nextHour, roundedMinute, 0, 0);

    return {
      date: nextTime.toISOString().split('T')[0],
      time: `${String(nextHour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}`,
    };
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  return {
    date: tomorrow.toISOString().split('T')[0],
    time: '09:00',
  };
};

const DEFAULT_QUICK_APPOINTMENT_DATETIME = getDefaultQuickAppointmentDateTime();

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, appSlug, tenantId, accessRole } = useAuth();
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';
  const [period, setPeriod] = useState<DashboardPeriod>('today');
  const { data, loading, error, reload } = useDashboardData(period);
  const { createClient, createQuickAppointment, completeAppointment, cancelAppointment, busyState } = useDashboardActions();

  const [todayData, setTodayData] = useState<TodayDashboardData | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [formData, setFormData] = useState<QuickAppointmentFormState>({
    date: DEFAULT_QUICK_APPOINTMENT_DATETIME.date,
    time: DEFAULT_QUICK_APPOINTMENT_DATETIME.time,
    clientSearch: '',
    selectedClientId: '',
    serviceId: '',
    staffId: '',
  });
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showQuickScheduleModal, setShowQuickScheduleModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState<NewClientFormState>({ name: '', phone: '', email: '' });
  const [selectedAppointment, setSelectedAppointment] = useState<DashboardAppointment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActivityTimelineOpen, setIsActivityTimelineOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setToast({ message: error, type: 'error' });
    }
  }, [error]);

  useEffect(() => {
    if (todayError) {
      setToast({ message: todayError, type: 'error' });
    }
  }, [todayError]);

  useEffect(() => {
    if (data.staffList.length > 0 && !formData.staffId) {
      setFormData((current) => ({ ...current, staffId: data.staffList[0].id }));
    }
  }, [data.staffList, formData.staffId]);

  useEffect(() => {
    if (data.servicesList.length > 0 && !formData.serviceId) {
      setFormData((current) => ({ ...current, serviceId: data.servicesList[0].id }));
    }
  }, [data.servicesList, formData.serviceId]);

  const fetchTodayData = React.useCallback(async () => {
    if (!tenantId) return;
    setTodayLoading(true);
    setTodayError(null);
    try {
      const role = accessRole === 'barber' ? 'barber' : accessRole === 'receptionist' ? 'receptionist' : 'manager';
      const result = await fetchTodayDashboardData({
        tenantId,
        userId: user?.id ?? null,
        role,
      });
      setTodayData(result);
    } catch (err: any) {
      setTodayError(err?.message || 'Erro ao carregar dados do dia');
    } finally {
      setTodayLoading(false);
    }
  }, [tenantId, user?.id, accessRole]);

  useEffect(() => {
    fetchTodayData();
  }, [fetchTodayData]);

  const filteredClients = useMemo(
    () => data.clients.filter((client) => client.name.toLowerCase().includes(formData.clientSearch.toLowerCase())),
    [data.clients, formData.clientSearch],
  );

  const handleCreateNewClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const createdClient = await createClient(newClientForm, { existingClients: data.clients });
      setFormData((current) => ({
        ...current,
        clientSearch: createdClient.name,
        selectedClientId: createdClient.id,
      }));
      setShowNewClientModal(false);
      setNewClientForm({ name: '', phone: '', email: '' });
      setToast({ message: `Cliente "${createdClient.name}" cadastrado!`, type: 'success' });
      await reload();
      fetchTodayData();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao cadastrar cliente.', type: 'error' });
    }
  };

  const handleConfirmAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createQuickAppointment({
        clientId: formData.selectedClientId || null,
        clientName: formData.clientSearch,
        serviceId: formData.serviceId,
        staffId: formData.staffId,
        startTime: new Date(`${formData.date}T${formData.time}:00`).toISOString(),
      });
      setFormData((current) => ({
        ...current,
        clientSearch: '',
        selectedClientId: '',
      }));
      setShowQuickScheduleModal(false);
      setToast({ message: 'Agendamento confirmado!', type: 'success' });
      await reload();
      fetchTodayData();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao criar agendamento.', type: 'error' });
    }
  };

  const handleCancelAppointment = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await cancelAppointment(id);
      setToast({ message: 'Agendamento cancelado.', type: 'info' });
      await reload();
      fetchTodayData();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao cancelar agendamento.', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteAppointment = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      await completeAppointment(id);
      setToast({ message: 'Agendamento concluído!', type: 'success' });
      await reload();
      fetchTodayData();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao concluir agendamento.', type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  const pendingAppointmentsCount = useMemo(
    () => data.appointments.filter((apt) => apt.status === 'pending').length,
    [data.appointments],
  );

  const returningClients = data.returningClients;
  const teamStatus = data.staffList.map((s) => ({
    id: s.id,
    name: s.name,
    active: true,
  }));
  const tenantName = user?.user_metadata?.tenant_name || (isEsteticaApp ? 'sua clínica' : 'sua barbearia');

  const isBarberRole = accessRole === 'barber';
  const isReceptionistRole = accessRole === 'receptionist';

  const isInitialLoading = loading && data.staffList.length === 0;

  return (
    <div className="space-y-6 animate-fade-in pb-20 bg-background-light dark:bg-background-dark min-h-screen">
      <DashboardHeader
        appSlug={appSlug}
        period={period}
        onPeriodChange={setPeriod}
        openComandasCount={data.openComandasCount ?? 0}
        pendingAppointmentsCount={pendingAppointmentsCount}
        returningClientsCount={returningClients.length}
        todayKpis={todayData?.kpis ?? null}
        onKpiClick={(type) => {
          if (type === 'faturamento') navigate('/comandas');
          if (type === 'totalToday' || type === 'emAtendimento' || type === 'pendentes' || type === 'cancelados' || type === 'concluidos') {
            navigate('/schedule');
          }
        }}
        onNewAppointment={() => setShowQuickScheduleModal(true)}
        onOpenCheckout={() => navigate('/checkout?mode=pdv')}
        onOpenComandas={() => navigate('/comandas')}
        onOpenSmartReturn={() => navigate('/smart-return')}
        onOpenCash={() => navigate('/cash-closing')}
        onCloseCash={() => navigate('/cash-closing')}
        onOpenActivityTimeline={() => setIsActivityTimelineOpen(true)}
      />

      {appSlug === 'barber' && tenantId && <OnboardingChecklist tenantId={tenantId} />}

      {/* Row 2: Operação Focada (Agenda do Dia Mais Longa + Movimento Financeiro com Mini-Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Timeline da Agenda do Dia */}
        <div className="lg:col-span-2 space-y-4">
          {todayData ? (
            <DayTimeline
              appSlug={appSlug}
              appointments={todayData.todayAppointments}
              loading={todayLoading && !todayData}
              businessName={tenantName}
              onSelectAppointment={(apt) => {
                setSelectedAppointment(apt);
                setIsDetailModalOpen(true);
              }}
            />
          ) : (
            <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-5">
              <div className="animate-pulse space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-gold-pale dark:bg-white/5 p-3">
                    <div className="h-12 w-12 rounded-lg bg-line dark:bg-border-dark" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-line dark:bg-border-dark" />
                      <div className="h-2 w-1/2 rounded bg-line dark:bg-border-dark" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna 3: Movimento de Caixa Consolidado */}
        <div className="space-y-4">
          <TodayCashCard
            loading={isInitialLoading}
            income={data.metrics.revenue}
            expenses={data.metrics.expenses}
            net={data.metrics.netRevenue}
            period={period}
          />
        </div>
      </div>

      {/* Row 3: Relationship */}
      <DashboardWidgets
        appSlug={appSlug}
        returningClients={returningClients}
        birthdaysToday={[]}
        birthdaysTomorrow={[]}
        teamStatus={teamStatus}
        loading={isInitialLoading}
        totalClients={data.clients.length}
        businessName={tenantName}
        clientLabel={labels.client}
        clientPluralLabel={labels.clientPlural}
        professionalPluralLabel={isEsteticaApp ? labels.professionalPlural : undefined}
      />

      <AppointmentDetailModal
        appointment={selectedAppointment}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedAppointment(null);
        }}
        onOpenSchedule={() => {
          setIsDetailModalOpen(false);
          setSelectedAppointment(null);
          navigate('/schedule');
        }}
      />

      <NewClientModal
        isOpen={showNewClientModal}
        form={newClientForm}
        setForm={setNewClientForm}
        onClose={() => setShowNewClientModal(false)}
        onSubmit={handleCreateNewClient}
        isSubmitting={busyState.creatingClient}
      />

      <QuickScheduleModal
        isOpen={showQuickScheduleModal}
        onClose={() => setShowQuickScheduleModal(false)}
        formData={formData}
        setFormData={setFormData}
        filteredClients={filteredClients}
        showClientSuggestions={showClientSuggestions}
        setShowClientSuggestions={setShowClientSuggestions}
        servicesList={data.servicesList}
        staffList={data.staffList}
        newClientForm={newClientForm}
        setNewClientForm={setNewClientForm}
        onOpenNewClientModal={() => setShowNewClientModal(true)}
        onSubmit={handleConfirmAppointment}
        onCreateClient={handleCreateNewClient}
        isSubmittingAppointment={busyState.creatingQuickAppointment}
        isSubmittingClient={busyState.creatingClient}
      />

      <ActivityTimelineModal
        isOpen={isActivityTimelineOpen}
        onClose={() => setIsActivityTimelineOpen(false)}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Dashboard;