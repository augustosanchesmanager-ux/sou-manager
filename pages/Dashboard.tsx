import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import OnboardingChecklist from '../components/OnboardingChecklist';
import DashboardAlerts from '../components/DashboardAlerts';
import DashboardReminders from '../components/DashboardReminders';
import { useAuth } from '../context/AuthContext';
import { generateBusinessInsights } from '../services/geminiService';
import {
  AppointmentDetailModal,
  MetricsPanel,
  NewClientModal,
  QuickAppointmentCard,
  SmartReturnWidget,
  TeamStatusCard,
  UpcomingAppointmentsCard,
  UpcomingBirthdaysCard,
  useDashboardActions,
  useDashboardData,
  type DashboardAppointment,
  type NewClientFormState,
  type QuickAppointmentFormState,
} from '../src/modules/dashboard';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useDashboardData();
  const { createClient, createQuickAppointment, completeAppointment, cancelAppointment, busyState } = useDashboardActions();

  const [insight, setInsight] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const [formData, setFormData] = useState<QuickAppointmentFormState>({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    clientSearch: '',
    selectedClientId: '',
    serviceId: '',
    staffId: '',
  });
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState<NewClientFormState>({ name: '', phone: '', email: '' });
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<DashboardAppointment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (error) {
      setToast({ message: error, type: 'error' });
    }
  }, [error]);

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

  const filteredClients = useMemo(
    () => data.clients.filter((client) => client.name.toLowerCase().includes(formData.clientSearch.toLowerCase())),
    [data.clients, formData.clientSearch],
  );

  const handleGenerateInsight = async () => {
    setLoadingInsight(true);
    try {
      const result = await generateBusinessInsights({
        revenue: data.metrics.revenue,
        growth: data.metrics.growth,
        nps: 98,
        activeStaff: data.staffList.length,
      });
      setInsight(result);
    } finally {
      setLoadingInsight(false);
    }
  };

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
      setToast({ message: 'Agendamento confirmado!', type: 'success' });
      await reload();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao criar agendamento.', type: 'error' });
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      await cancelAppointment(id);
      setToast({ message: 'Agendamento cancelado.', type: 'info' });
      setActiveMenuId(null);
      await reload();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao cancelar agendamento.', type: 'error' });
    }
  };

  const handleCompleteAppointment = async (id: string) => {
    try {
      await completeAppointment(id);
      setToast({ message: 'Agendamento concluido!', type: 'success' });
      setActiveMenuId(null);
      await reload();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao concluir agendamento.', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-primary font-black text-xs uppercase tracking-[0.2em] mb-1">
            SEJA BEM VINDO, {user?.user_metadata?.shop_name || user?.user_metadata?.first_name || 'MINHA BARBEARIA'}
          </p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight display-font">Visao Geral Executiva</h2>
          <p className="text-slate-500 mt-1">Sua empresa esta com crescimento de {data.metrics.growth.toFixed(0)}% este mes.</p>
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
              <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-300 mb-1">Analise de IA</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{insight}</p>
            </div>
          </div>
        </div>
      )}

      <MetricsPanel metrics={data.metrics} clientsCount={data.clients.length} />

      {data.profile && !data.profile.onboarding_completed && !onboardingDismissed && (
        <OnboardingChecklist onComplete={() => setOnboardingDismissed(true)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickAppointmentCard
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
          isSubmitting={busyState.creatingQuickAppointment}
        />

        <UpcomingAppointmentsCard
          appointments={data.appointments}
          loading={loading}
          activeMenuId={activeMenuId}
          onToggleMenu={(id) => setActiveMenuId((current) => (current === id ? null : id))}
          onSelectAppointment={(appointment) => {
            setSelectedAppointment(appointment);
            setIsDetailModalOpen(true);
          }}
          onOpenSchedule={() => navigate('/schedule')}
          onCompleteAppointment={handleCompleteAppointment}
          onCancelAppointment={handleCancelAppointment}
        />
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamStatusCard activeStaffPercent={data.metrics.activeStaffPercent} staffCount={data.staffList.length} />
        <UpcomingBirthdaysCard upcomingBirthdays={data.upcomingBirthdays} onNavigateClients={() => navigate('/clients')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardAlerts />
        <DashboardReminders />
      </div>

      <SmartReturnWidget clients={data.clients} onNavigate={() => navigate('/smart-return')} />

      <NewClientModal
        isOpen={showNewClientModal}
        form={newClientForm}
        setForm={setNewClientForm}
        onClose={() => setShowNewClientModal(false)}
        onSubmit={handleCreateNewClient}
        isSubmitting={busyState.creatingClient}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Dashboard;

