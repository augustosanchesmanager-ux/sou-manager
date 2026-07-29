import {
  DEFAULT_APP_SLUG,
  isAppSlug,
  type AppSlug,
} from '../supabase/schemas';

export interface BusinessLabels {
  staff: string;
  staffPlural: string;
  service: string;
  servicePlural: string;
  order: string;
  orderPlural: string;
  checkout: string;
  package: string;
  credits: string;
  client: string;
  clientPlural: string;
  professional: string;
  professionalPlural: string;
}

export const BUSINESS_LABELS: Record<AppSlug, BusinessLabels> = {
  barber: {
    staff: 'Barbeiro',
    staffPlural: 'Barbeiros',
    service: 'Serviço',
    servicePlural: 'Serviços',
    order: 'Comanda',
    orderPlural: 'Comandas',
    checkout: 'Checkout',
    package: 'Club dos Chefes',
    credits: 'Créditos',
    client: 'Cliente',
    clientPlural: 'Clientes',
    professional: 'Barbeiro',
    professionalPlural: 'Barbeiros',
  },
  auto: {
    staff: 'Operador',
    staffPlural: 'Operadores',
    service: 'Serviço',
    servicePlural: 'Serviços',
    order: 'Ordem',
    orderPlural: 'Ordens',
    checkout: 'Checkout',
    package: 'Pacotes',
    credits: 'Créditos',
    client: 'Cliente',
    clientPlural: 'Clientes',
    professional: 'Operador',
    professionalPlural: 'Operadores',
  },
  club: {
    staff: 'Profissional',
    staffPlural: 'Profissionais',
    service: 'Benefício',
    servicePlural: 'Benefícios',
    order: 'Atendimento',
    orderPlural: 'Atendimentos',
    checkout: 'Checkout',
    package: 'Assinaturas',
    credits: 'Créditos',
    client: 'Membro',
    clientPlural: 'Membros',
    professional: 'Profissional',
    professionalPlural: 'Profissionais',
  },
  estetica: {
    staff: 'Profissional',
    staffPlural: 'Profissionais',
    service: 'Procedimento',
    servicePlural: 'Procedimentos',
    order: 'Atendimento',
    orderPlural: 'Atendimentos',
    checkout: 'Finalizar atendimento',
    package: 'Pacotes',
    credits: 'Sessões',
    client: 'Cliente',
    clientPlural: 'Clientes',
    professional: 'Profissional',
    professionalPlural: 'Profissionais',
  },
};

export const getBusinessLabels = (appSlug?: string | null): BusinessLabels => {
  const resolvedAppSlug = isAppSlug(appSlug) ? appSlug : DEFAULT_APP_SLUG;
  return BUSINESS_LABELS[resolvedAppSlug] || BUSINESS_LABELS[DEFAULT_APP_SLUG];
};
