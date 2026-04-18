import type { AdminBackendWave1CapabilityKey } from './adminBackendFrontier';

export interface AdminBackendSurfaceBlockDefinition {
  id: string;
  title: string;
  currentFrontendSource: string;
  backendIntent: string;
  requiredData: readonly string[];
}

export interface AdminBackendWave1SurfaceDefinition {
  capability: AdminBackendWave1CapabilityKey;
  targetSurface: string;
  description: string;
  blocks: readonly AdminBackendSurfaceBlockDefinition[];
}

export const adminBackendWave1Surfaces: readonly AdminBackendWave1SurfaceDefinition[] = [
  {
    capability: 'admin.system',
    targetSurface: 'platform-internal-ops',
    description: 'Primeira superficie administrativa para operacao interna da SMG, separando visao de infraestrutura e stack tecnica do painel transitorio atual.',
    blocks: [
      {
        id: 'database-overview',
        title: 'Database Overview',
        currentFrontendSource: 'pages/Admin.tsx#system tab / bloco "Database (Supabase)"',
        backendIntent: 'Resumo operacional interno com metricas de base e sinais gerais do ambiente administrativo.',
        requiredData: ['totalShops', 'totalUsers', 'activeTickets'],
      },
      {
        id: 'platform-stack',
        title: 'Platform Stack',
        currentFrontendSource: 'pages/Admin.tsx#system tab / bloco "Stack Tecnica"',
        backendIntent: 'Inventario tecnico minimo do ambiente administrativo, sem depender de texto hardcoded no frontend transitorio.',
        requiredData: ['frontendRuntime', 'backendRuntime', 'authModel', 'deployContext'],
      },
    ],
  },
  {
    capability: 'superadmin.logs',
    targetSurface: 'platform-observability',
    description: 'Primeira superficie administrativa de observabilidade da SMG, separando alertas globais e linha do tempo operacional sensivel.',
    blocks: [
      {
        id: 'alert-queue',
        title: 'Alert Queue',
        currentFrontendSource: 'components/superadmin/AlertStack.tsx',
        backendIntent: 'Fila priorizada de alertas administrativos globais com criticidade, SLA e CTA operativo.',
        requiredData: ['alerts', 'openSupportTickets', 'severitySummary'],
      },
      {
        id: 'operational-timeline',
        title: 'Operational Timeline',
        currentFrontendSource: 'components/superadmin/ActivityTimeline.tsx',
        backendIntent: 'Linha do tempo administrativa consolidada para eventos sensiveis de auditoria, suporte, acesso e monitoramento.',
        requiredData: ['auditLogs', 'supportTickets', 'accessRequests', 'criticalAlerts'],
      },
    ],
  },
] as const;
