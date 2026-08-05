/**
 * [SMG][APPLICATION][ONBOARDING_PROGRESS] OnboardingProgressService
 *
 * RESPONSABILIDADE: Calcula o progresso do onboarding de um tenant (Fase 6.0.2,
 * Bloco 4 — checklist persistente no dashboard até a barbearia entrar em
 * operação).
 *
 * ITENS (decisão PO 2026-08-05):
 *   - Loja criada (empresa + horários) — passa a valer quando o onboarding é
 *     finalizado (tenant ativo)
 *   - Barbeiros (staff > 0)
 *   - Serviços (services > 0)
 *   - Clientes (clients > 0)
 *   - Primeiro agendamento (tenants.first_appointment_at != null — KPI TTFA)
 *
 * NÃO FAZ:
 *   - Renderização de UI
 *   - Qualquer escrita (checklist derivado apenas de leitura)
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { tenantSettingsRepository } from '../domain/tenantSettings/repository';
import { tenantRepository } from '../domain/tenant/repository';
import { staffRepository } from '../domain/staff/repository';
import { serviceRepository } from '../domain/service/repository';
import { clientRepository } from '../domain/client/repository';

// ─── Types ───────────────────────────────────────────────────────

export interface OnboardingChecklistItem {
  key: 'shop' | 'barbers' | 'services' | 'clients' | 'firstAppointment';
  label: string;
  done: boolean;
}

export interface OnboardingProgress {
  items: OnboardingChecklistItem[];
  doneCount: number;
  totalCount: number;
  percent: number;
  completed: boolean;
}

const DEFAULT_ITEMS: OnboardingChecklistItem[] = [
  { key: 'shop', label: 'Loja criada', done: false },
  { key: 'barbers', label: 'Adicionar barbeiros', done: false },
  { key: 'services', label: 'Cadastrar serviços', done: false },
  { key: 'clients', label: 'Adicionar clientes', done: false },
  { key: 'firstAppointment', label: 'Fazer primeiro agendamento', done: false },
];

// ─── Service ─────────────────────────────────────────────────────

class OnboardingProgressServiceImpl {
  async getProgress(tenantId: string): Promise<OnboardingProgress> {
    const [settings, tenant, staff, services, clients] = await Promise.all([
      tenantSettingsRepository.getByTenantId(tenantId),
      tenantRepository.getById(tenantId),
      staffRepository.list(tenantId),
      serviceRepository.list(tenantId),
      clientRepository.list(tenantId),
    ]);

    const items = DEFAULT_ITEMS.map((item) => {
      const copy = { ...item };
      switch (item.key) {
        case 'shop':
          copy.done = Boolean(settings && tenant && tenant.status !== 'draft');
          break;
        case 'barbers':
          copy.done = staff.length > 0;
          break;
        case 'services':
          copy.done = services.length > 0;
          break;
        case 'clients':
          copy.done = clients.length > 0;
          break;
        case 'firstAppointment':
          copy.done = Boolean(tenant?.first_appointment_at);
          break;
      }
      return copy;
    });

    const doneCount = items.filter((i) => i.done).length;
    const totalCount = items.length;
    const percent = Math.round((doneCount / totalCount) * 100);

    return {
      items,
      doneCount,
      totalCount,
      percent,
      completed: doneCount === totalCount,
    };
  }
}

export const onboardingProgressService = new OnboardingProgressServiceImpl();
