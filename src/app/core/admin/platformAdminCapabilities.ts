import type { AdminTab as SuperAdminTab } from '@/components/superadmin/types';

export type PlatformAdminRouteSlug = 'admin' | 'superadmin';
export type AdminConsoleTab = 'overview' | 'shops' | 'users' | 'access' | 'tickets' | 'system' | 'requests';
export type PlatformAdminOwnershipModel =
  | 'tenant-support'
  | 'tenant-governance'
  | 'platform-visibility'
  | 'platform-observability'
  | 'platform-internal';
export type PlatformAdminDeliveryTarget =
  | 'current-frontend'
  | 'frontend-until-admin-backend'
  | 'admin-backend-candidate';
export type PlatformAdminTransitionWave = 'stable' | 'hold' | 'wave-1';
export type PlatformAdminExpansionPolicy = 'evolve' | 'maintain' | 'freeze';

export const platformAdminDeliveryTargetLabels: Record<PlatformAdminDeliveryTarget, string> = {
  'current-frontend': 'frontend atual',
  'frontend-until-admin-backend': 'transitorio ate admin backend',
  'admin-backend-candidate': 'candidato ao admin backend',
};

export const platformAdminTransitionWaveLabels: Record<PlatformAdminTransitionWave, string> = {
  stable: 'estavel no frontend',
  hold: 'transicao planejada',
  'wave-1': 'fila 1 de saida',
};

export const platformAdminExpansionPolicyLabels: Record<PlatformAdminExpansionPolicy, string> = {
  evolve: 'pode evoluir',
  maintain: 'manutencao controlada',
  freeze: 'sem expansao funcional',
};

export interface PlatformAdminRouteDomainDefinition {
  route: PlatformAdminRouteSlug;
  feature: string;
  capabilityBoundary: string;
  ownershipModel: PlatformAdminOwnershipModel;
  deliveryTarget: PlatformAdminDeliveryTarget;
  transitionWave: PlatformAdminTransitionWave;
  expansionPolicy: PlatformAdminExpansionPolicy;
  description: string;
}

export interface PlatformAdminTabDefinition<TTab extends string> {
  id: TTab;
  label: string;
  capabilityBoundary: string;
  ownershipModel: PlatformAdminOwnershipModel;
  deliveryTarget: PlatformAdminDeliveryTarget;
  transitionWave: PlatformAdminTransitionWave;
  expansionPolicy: PlatformAdminExpansionPolicy;
  description: string;
}

export const platformAdminRouteDomains: Record<PlatformAdminRouteSlug, PlatformAdminRouteDomainDefinition> = {
  admin: {
    route: 'admin',
    feature: 'Platform Admin',
    capabilityBoundary: 'tenant-support-and-operations',
    ownershipModel: 'tenant-support',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Operacao de suporte, acesso e governanca de tenants no frontend atual.',
  },
  superadmin: {
    route: 'superadmin',
    feature: 'Super Admin',
    capabilityBoundary: 'global-platform-visibility',
    ownershipModel: 'platform-visibility',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Visao global da SMG, auditoria e monitoramento administrativo da plataforma.',
  },
};

export const adminConsoleTabs = [
  {
    id: 'overview',
    label: 'Visao Geral',
    capabilityBoundary: 'tenant-support-overview',
    ownershipModel: 'tenant-support',
    deliveryTarget: 'current-frontend',
    transitionWave: 'stable',
    expansionPolicy: 'evolve',
    description: 'Kpis e visao sintetica do runtime administrativo.',
  },
  {
    id: 'shops',
    label: 'Barbearias',
    capabilityBoundary: 'tenant-operations',
    ownershipModel: 'tenant-support',
    deliveryTarget: 'current-frontend',
    transitionWave: 'stable',
    expansionPolicy: 'evolve',
    description: 'Consulta operacional de tenants, receita e visao de unidade.',
  },
  {
    id: 'users',
    label: 'Usuarios',
    capabilityBoundary: 'tenant-access-operations',
    ownershipModel: 'tenant-governance',
    deliveryTarget: 'current-frontend',
    transitionWave: 'stable',
    expansionPolicy: 'evolve',
    description: 'Consulta de perfis e colaboradores por tenant.',
  },
  {
    id: 'access',
    label: 'Gestao de Acessos',
    capabilityBoundary: 'tenant-governance',
    ownershipModel: 'tenant-governance',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Governanca operacional de planos e papeis no frontend atual.',
  },
  {
    id: 'system',
    label: 'Infraestrutura',
    capabilityBoundary: 'platform-internal-ops',
    ownershipModel: 'platform-internal',
    deliveryTarget: 'admin-backend-candidate',
    transitionWave: 'wave-1',
    expansionPolicy: 'freeze',
    description: 'Ferramentas internas e operacionais mantidas no frontend atual.',
  },
  {
    id: 'tickets',
    label: 'Chamados de Suporte',
    capabilityBoundary: 'support-operations',
    ownershipModel: 'tenant-support',
    deliveryTarget: 'current-frontend',
    transitionWave: 'stable',
    expansionPolicy: 'evolve',
    description: 'Atendimento e resposta a tickets da operacao.',
  },
  {
    id: 'requests',
    label: 'Pedidos de Acesso',
    capabilityBoundary: 'access-governance',
    ownershipModel: 'tenant-governance',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Aprovacao e rejeicao de acessos pendentes.',
  },
] as const satisfies readonly PlatformAdminTabDefinition<AdminConsoleTab>[];

export const superAdminTabsRegistry = [
  {
    id: 'overview',
    label: 'Visao Geral',
    capabilityBoundary: 'global-platform-overview',
    ownershipModel: 'platform-visibility',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Resumo global da plataforma e do ambiente administrativo.',
  },
  {
    id: 'companies',
    label: 'Empresas',
    capabilityBoundary: 'tenant-landscape',
    ownershipModel: 'platform-visibility',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Visao agregada dos tenants ativos e sua distribuicao.',
  },
  {
    id: 'users',
    label: 'Usuarios',
    capabilityBoundary: 'global-user-visibility',
    ownershipModel: 'platform-visibility',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Leitura global de perfis presentes na plataforma.',
  },
  {
    id: 'subscriptions',
    label: 'Solicitacoes',
    capabilityBoundary: 'commercial-governance',
    ownershipModel: 'platform-visibility',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Mudancas de plano e demandas comerciais em analise.',
  },
  {
    id: 'audit',
    label: 'Auditoria',
    capabilityBoundary: 'global-audit',
    ownershipModel: 'platform-observability',
    deliveryTarget: 'frontend-until-admin-backend',
    transitionWave: 'hold',
    expansionPolicy: 'maintain',
    description: 'Trilha administrativa e eventos criticos do ambiente.',
  },
  {
    id: 'logs',
    label: 'Alertas',
    capabilityBoundary: 'platform-observability',
    ownershipModel: 'platform-observability',
    deliveryTarget: 'admin-backend-candidate',
    transitionWave: 'wave-1',
    expansionPolicy: 'freeze',
    description: 'Alertas e sinais operacionais do ambiente atual.',
  },
] as const satisfies readonly PlatformAdminTabDefinition<SuperAdminTab>[];

export const platformAdminWave1Candidates = {
  admin: adminConsoleTabs.filter((tab) => tab.transitionWave === 'wave-1'),
  superadmin: superAdminTabsRegistry.filter((tab) => tab.transitionWave === 'wave-1'),
} as const;

export const platformAdminStableFrontendCapabilities = {
  admin: adminConsoleTabs.filter((tab) => tab.transitionWave === 'stable'),
  superadmin: [] as const,
} as const;

export const platformAdminHoldCapabilities = {
  admin: adminConsoleTabs.filter((tab) => tab.transitionWave === 'hold'),
  superadmin: superAdminTabsRegistry.filter((tab) => tab.transitionWave === 'hold'),
} as const;
