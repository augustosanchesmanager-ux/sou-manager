/**
 * [SMG][LEGAL] Versioned Legal & LGPD Documents (Issue #384 / GTM-008)
 *
 * NOTE (DEC-09): Current texts are structured v1.0.0-draft templates pending
 * final legal review/sign-off by the PO prior to commercial production launch.
 */

export type LegalDocumentType = 'terms_of_service' | 'privacy_policy' | 'lgpd_dpa';

export interface LegalDocumentSpec {
  type: LegalDocumentType;
  version: string;
  title: string;
  effectiveDate: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

export const CURRENT_LEGAL_DOCUMENTS: readonly LegalDocumentSpec[] = [
  {
    type: 'terms_of_service',
    version: '1.0.0-draft',
    title: 'Termos de Uso — SMG Barber',
    effectiveDate: '2026-11-24',
    summary: 'Condições de licenciamento SaaS multi-tenant, responsabilidades da unidade contratante e regras de uso da plataforma SMG Barber.',
    sections: [
      {
        heading: '1. Objeto e Licenciamento',
        body: 'O SMG Barber disponibiliza licença de uso de software como serviço (SaaS) para gestão operacional, agenda, comandas, comissões e relacionamento com clientes da unidade contratante.',
      },
      {
        heading: '2. Responsabilidade sobre Dados e Acessos',
        body: 'Cada unidade opera em ambiente lógico isolado por tenant. O gestor contratante é responsável pelo cadastro, permissões e revogação de acesso de seus colaboradores.',
      },
      {
        heading: '3. Planos, Assinatura e Suporte',
        body: 'A contratação, alteração de plano e renovação seguem as condições comerciais vigentes acordadas com o time SMG.',
      },
    ],
  },
  {
    type: 'privacy_policy',
    version: '1.0.0-draft',
    title: 'Política de Privacidade e Proteção de Dados (LGPD)',
    effectiveDate: '2026-11-24',
    summary: 'Transparência sobre coleta, finalidade, base legal, retenção e direitos dos titulares conforme a Lei nº 13.709/2018 (LGPD).',
    sections: [
      {
        heading: '1. Papéis na LGPD (Controlador vs Operador)',
        body: 'Para dados de clientes finais cadastrados pela barbearia, a unidade contratante atua como Controladora e a SMG atua como Operadora, tratando dados exclusivamente para execução do serviço.',
      },
      {
        heading: '2. Segurança e Isolamento',
        body: 'Os dados são protegidos por autenticação, criptografia em trânsito e isolamento por tenant via Row-Level Security (RLS) no banco de dados.',
      },
      {
        heading: '3. Direitos dos Titulares',
        body: 'Solicitações de acesso, correção, portabilidade ou eliminação de dados pessoais podem ser encaminhadas pelo canal de suporte/DPO da plataforma.',
      },
    ],
  },
  {
    type: 'lgpd_dpa',
    version: '1.0.0-draft',
    title: 'Adendo de Tratamento de Dados (DPA / LGPD)',
    effectiveDate: '2026-11-24',
    summary: 'Diretrizes técnicas e organizacionais para tratamento de dados pessoais em nome da unidade contratante.',
    sections: [
      {
        heading: '1. Suboperadores e Infraestrutura',
        body: 'A plataforma utiliza provedores de nuvem e banco de dados gerenciados com controles de segurança e registro de auditoria.',
      },
      {
        heading: '2. Notificação de Incidentes',
        body: 'Em caso de incidente relevante envolvendo dados pessoais, a SMG comunicará a unidade contratante em prazo razoável com plano de mitigação.',
      },
    ],
  },
] as const;

export const REQUIRED_ONBOARDING_DOCUMENTS: readonly LegalDocumentSpec[] =
  CURRENT_LEGAL_DOCUMENTS.filter(
    (doc) => doc.type === 'terms_of_service' || doc.type === 'privacy_policy'
  );
