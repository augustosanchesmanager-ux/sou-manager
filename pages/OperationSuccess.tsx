import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTenantOptional } from '../src/context/TenantContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { formatCurrency } from '../shared/format/currency';
import { getAppointmentStatusLabel } from '../shared/status/appointment';
import { normalizePhone } from '../src/lib/utils/phone';

type OperationType = 'appointment' | 'comanda';

interface AppointmentData {
  id: string;
  client: string;
  clientPhone?: string;
  service: string;
  professional: string;
  dateTime: string;
  status: string;
}

interface ComandaData {
  id: string;
  client: string;
  total: number;
  paymentMethod: string;
  itemsCount: number;
  status: string;
}

interface OperationSuccessLocationState {
  operationType?: OperationType;
  appointment?: AppointmentData;
  comanda?: ComandaData;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
  cash: 'Dinheiro',
  other: 'Outros',
};

const OperationSuccess: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { appSlug } = useAuth();
  const tenantContext = useTenantOptional();
  const state = location.state as OperationSuccessLocationState | null;
  const businessLabels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';
  const businessName = tenantContext?.tenant?.name || (isEsteticaApp ? 'nossa clínica' : 'nossa barbearia');
  const serviceLabel = businessLabels.service;
  const orderLabel = businessLabels.order;
  const orderPluralLabel = businessLabels.orderPlural;
  const orderLabelLower = orderLabel.toLowerCase();

  const operationType = state?.operationType;
  const appointment = state?.appointment;
  const comanda = state?.comanda;

  const hasValidData = (operationType === 'appointment' && appointment) ||
                       (operationType === 'comanda' && comanda);

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateTimeStr;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    return PAYMENT_METHOD_LABELS[method] || method;
  };

  const getStatusLabel = (status: string) => {
    return getAppointmentStatusLabel(status, isEsteticaApp);
  };

  if (!hasValidData) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
              <span className="material-symbols-outlined text-5xl text-white">check</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {isEsteticaApp ? 'Atendimento finalizado' : 'Operação Concluída'}
            </h1>
            <p className="text-slate-500 mt-2">
              {isEsteticaApp ? 'O atendimento foi finalizado com sucesso.' : 'Sua operação foi finalizada com sucesso.'}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-night rounded-xl font-bold text-lg shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">home</span>
              Ir para Início
            </button>

            <button
              onClick={() => navigate('/schedule')}
              className="w-full py-4 px-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-border-dark hover:border-primary/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">event</span>
              Voltar para Agenda
            </button>

            <button
              onClick={() => navigate('/comandas')}
              className="w-full py-4 px-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-border-dark hover:border-primary/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">receipt_long</span>
              Voltar para {orderPluralLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (operationType === 'appointment' && appointment) {
    const appointmentCode = appointment.id ? appointment.id.slice(0, 8).toUpperCase() : '';
    const formattedDateTime = formatDateTime(appointment.dateTime);
    const { digits: phoneDigits, isValid: isPhoneValid } = normalizePhone(appointment.clientPhone);

    const clientFirstName = appointment.client ? appointment.client.split(' ')[0] : 'Cliente';
    const lines = [
      `Olá, ${clientFirstName}! Seu agendamento foi confirmado com sucesso na ${businessName}!`,
      '',
      `📅 Data e Horário: ${formattedDateTime}`,
      `✂️ ${serviceLabel}: ${appointment.service}`,
      `💈 Profissional: ${appointment.professional}`,
    ];

    if (appointmentCode) {
      lines.push(`🔖 Código do agendamento: #${appointmentCode}`);
    }

    lines.push('', 'Estamos te esperando!');

    const messageText = lines.join('\n');
    const whatsAppUrl = isPhoneValid
      ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/25">
              <span className="material-symbols-outlined text-5xl text-white">event_available</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {isEsteticaApp ? 'Atendimento agendado' : 'Agendamento Confirmado'}
            </h1>
            <p className="text-slate-500 mt-2">
              {isEsteticaApp ? 'O atendimento foi agendado com sucesso!' : 'O agendamento foi criado com sucesso!'}
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-xl mb-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-border-dark">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-primary">person</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cliente</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{appointment.client}</p>
                  {appointment.clientPhone && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{appointment.clientPhone}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{serviceLabel}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{appointment.service}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Profissional</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{appointment.professional}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Data e Hora</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{formattedDateTime}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</p>
                  <p className="text-sm font-bold text-teal-700 mt-1">{getStatusLabel(appointment.status)}</p>
                </div>
              </div>

              {appointment.id && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{isEsteticaApp ? 'ID do atendimento' : 'ID do Agendamento'}</p>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1">#{appointmentCode}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span className="material-symbols-outlined text-2xl">chat</span>
              Enviar confirmação via WhatsApp
            </a>

            <button
              onClick={() => navigate('/schedule')}
              className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-night rounded-xl font-bold text-lg shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">event</span>
              Voltar para Agenda
            </button>

            <button
              onClick={() => navigate('/comandas')}
              className="w-full py-4 px-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-border-dark hover:border-primary/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">receipt_long</span>
              Ver {orderPluralLabel}
            </button>

            <button
              onClick={() => navigate('/schedule', { state: { openNewAppointment: true } })}
              className="w-full py-3 px-6 bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">add</span>
              {isEsteticaApp ? 'Criar novo atendimento' : 'Criar novo agendamento'}
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 px-6 bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">home</span>
              Ir para Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (operationType === 'comanda' && comanda) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
              <span className="material-symbols-outlined text-5xl text-white">check</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {isEsteticaApp ? 'Atendimento finalizado' : 'Comanda Finalizada'}
            </h1>
            <p className="text-slate-500 mt-2">
              {isEsteticaApp ? 'O atendimento foi finalizado e o pagamento foi registrado.' : 'A comanda foi fechada com sucesso!'}
            </p>
          </div>

          <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 shadow-xl mb-6">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-border-dark">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-primary">person</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cliente</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{comanda.client}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Pago</p>
                <p className="text-xl font-black text-primary">{formatCurrency(comanda.total)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pagamento</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-base">payments</span>
                  {getPaymentMethodLabel(comanda.paymentMethod)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Itens</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{comanda.itemsCount} item(ns)</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</p>
                <p className="text-sm font-bold text-emerald-600 flex items-center gap-1 mt-1">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Pago
                </p>
              </div>
            </div>

            {comanda.id && (
              <div className="pt-4 border-t border-slate-100 dark:border-border-dark mt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">ID {isEsteticaApp ? `do ${orderLabelLower}` : 'da Comanda'}</p>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1">#{comanda.id.slice(0, 8).toUpperCase()}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/checkout?mode=pdv')}
              className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-night rounded-xl font-bold text-lg shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">add_shopping_cart</span>
              {isEsteticaApp ? 'Novo atendimento' : 'Nova Comanda / Checkout'}
            </button>

            <button
              onClick={() => navigate('/comandas')}
              className="w-full py-4 px-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-border-dark hover:border-primary/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">receipt_long</span>
              Voltar para {orderPluralLabel}
            </button>

            <button
              onClick={() => navigate('/schedule')}
              className="w-full py-3 px-6 bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">event</span>
              Voltar para Agenda
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 px-6 bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">home</span>
              Ir para Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
            <span className="material-symbols-outlined text-5xl text-white">check</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {isEsteticaApp ? 'Atendimento finalizado' : 'Operação Concluída'}
          </h1>
          <p className="text-slate-500 mt-2">
            {isEsteticaApp ? 'O atendimento foi finalizado com sucesso.' : 'Sua operação foi finalizada com sucesso.'}
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-night rounded-xl font-bold text-lg shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">home</span>
            Ir para Início
          </button>

          <button
            onClick={() => navigate('/schedule')}
            className="w-full py-4 px-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-border-dark hover:border-primary/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">event</span>
            Voltar para Agenda
          </button>

          <button
            onClick={() => navigate('/comandas')}
            className="w-full py-4 px-6 bg-white dark:bg-card-dark border-2 border-slate-200 dark:border-border-dark hover:border-primary/50 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">receipt_long</span>
            Voltar para {orderPluralLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperationSuccess;
