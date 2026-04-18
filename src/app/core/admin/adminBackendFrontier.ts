export type AdminBackendWave1CapabilityKey = 'admin.system' | 'superadmin.logs';
export type AdminBackendBoundaryDomain = 'platform-internal' | 'platform-observability';
export type AdminBackendAuthContract = 'superadmin-session';

export interface AdminBackendBoundaryDefinition {
  frontendTransitionPolicy: 'freeze-wave-1';
  authContract: AdminBackendAuthContract;
  entryOwnership: 'platform-admin';
  runtimeTarget: 'smg-admin-backend';
  description: string;
}

export interface AdminBackendWave1CapabilityBlueprint {
  key: AdminBackendWave1CapabilityKey;
  sourceRoute: 'admin' | 'superadmin';
  sourceTab: 'system' | 'logs';
  boundaryDomain: AdminBackendBoundaryDomain;
  authContract: AdminBackendAuthContract;
  migrationPriority: 'wave-1';
  backendBacklog: readonly string[];
}

export const adminBackendBoundaryDefinition: AdminBackendBoundaryDefinition = {
  frontendTransitionPolicy: 'freeze-wave-1',
  authContract: 'superadmin-session',
  entryOwnership: 'platform-admin',
  runtimeTarget: 'smg-admin-backend',
  description: 'Backend administrativo separado para capacidades internas e de observabilidade da SMG, iniciado pela fila wave-1 do frontend atual.',
};

export const adminBackendWave1Blueprint: readonly AdminBackendWave1CapabilityBlueprint[] = [
  {
    key: 'admin.system',
    sourceRoute: 'admin',
    sourceTab: 'system',
    boundaryDomain: 'platform-internal',
    authContract: 'superadmin-session',
    migrationPriority: 'wave-1',
    backendBacklog: [
      'definir boundary tecnico das ferramentas internas',
      'separar a primeira superficie operacional hoje concentrada em Admin.system',
      'preservar no frontend apenas a camada transitoria enquanto a nova superficie nao existir',
    ],
  },
  {
    key: 'superadmin.logs',
    sourceRoute: 'superadmin',
    sourceTab: 'logs',
    boundaryDomain: 'platform-observability',
    authContract: 'superadmin-session',
    migrationPriority: 'wave-1',
    backendBacklog: [
      'definir primeira superficie de observabilidade administrativa',
      'separar alertas e sinais operacionais globais hoje concentrados em SuperAdmin.logs',
      'preservar no frontend apenas a leitura transitoria enquanto o backend administrativo nao assumir a capability',
    ],
  },
] as const;
