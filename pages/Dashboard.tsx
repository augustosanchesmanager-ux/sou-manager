import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
  AppointmentDetailModal,
  NewClientModal,
  useDashboardActions,
  useDashboardData,
  type DashboardAppointment,
  type NewClientFormState,
  type QuickAppointmentFormState,
  type Client,
} from '../src/modules/dashboard';
import {
  DashboardHeader,
  KPIGrid,
  AppointmentTimeline,
  QuickAppointmentWidget,
  DashboardWidgets,
} from '../components/dashboard';

type PeriodOption = 'today' | 'yesterday' | 'week' | 'month';
type CompareOption = 'yesterday' | 'week_ago' | 'month_ago';

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
  const { user } = useAuth();
  const { data, loading, error, reload } = useDashboardData();
  const { createClient, createQuickAppointment, completeAppointment, cancelAppointment, busyState } = useDashboardActions();

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [period, setPeriod] = useState<PeriodOption>('today');
  const [compare, setCompare] = useState<CompareOption>('yesterday');

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
  const [newClientForm, setNewClientForm] = useState<NewClientFormState>({ name: '', phone: '', email: '' });
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
      await reload();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao cancelar agendamento.', type: 'error' });
    }
  };

  const handleCompleteAppointment = async (id: string) => {
    try {
      await completeAppointment(id);
      setToast({ message: 'Agendamento concluído!', type: 'success' });
      await reload();
    } catch (nextError: any) {
      setToast({ message: nextError?.message || 'Erro ao concluir agendamento.', type: 'error' });
    }
  };

  const metricValues = {
    revenue: data.metrics.revenue,
    revenuePrevious: data.metrics.revenuePrevious,
    todayAppointments: data.metrics.todayAppointments,
    previousAppointments: data.metrics.previousAppointments,
    totalClients: data.clients.length,
    previousClients: data.clients.length,
    avgTicket: data.metrics.avgTicket,
    previousAvgTicket: data.metrics.avgTicketPrevious,
    revenueGoal: data.metrics.revenueGoal,
    appointmentsGoal: data.metrics.appointmentsGoal,
  };

  const returningClients: Client[] = data.clients.slice(0, 3);
  const teamStatus = data.staffList.map((s) => ({
    id: s.id,
    name: s.name,
    active: true,
  }));

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <DashboardHeader
        period={period}
        onPeriodChange={setPeriod}
        compare={compare}
        onCompareChange={setCompare}
      />

      <KPIGrid metrics={metricValues} period={period} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuickAppointmentWidget
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
        </div>

        <AppointmentTimeline
          appointments={data.appointments}
          loading={loading}
          onSelectAppointment={(apt) => {
            setSelectedAppointment(apt);
            setIsDetailModalOpen(true);
          }}
        />
      </div>

      <DashboardWidgets
        returningClients={returningClients}
        birthdaysToday={[]}
        birthdaysTomorrow={[]}
        teamStatus={teamStatus}
        loading={loading}
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

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Dashboard;
