export type DiscountAuditType =
  | 'barber_discount'
  | 'manager_discount'
  | 'barbershop_discount'
  | 'promotion'
  | 'correction'
  | 'courtesy'
  | 'other';

export type DiscountReasonType =
  | 'fidelizacao'
  | 'erro_operacional'
  | 'ajuste_comercial'
  | 'promocao'
  | 'cortesia'
  | 'reclamacao_cliente'
  | 'autorizado_gestor'
  | 'outro';

export interface DiscountAuditDraft {
  amount: number;
  type: DiscountAuditType;
  reasonType: DiscountReasonType;
  reasonNote: string;
  responsibleStaffId?: string | null;
  responsibleStaffName?: string | null;
  commissionImpact: 'pending_review';
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountAuditType, string> = {
  barber_discount: 'Desconto do barbeiro',
  manager_discount: 'Desconto do gestor',
  barbershop_discount: 'Desconto da barbearia',
  promotion: 'Promoção',
  correction: 'Correção',
  courtesy: 'Cortesia',
  other: 'Outro',
};

export const DISCOUNT_REASON_LABELS: Record<DiscountReasonType, string> = {
  fidelizacao: 'Fidelização',
  erro_operacional: 'Erro operacional',
  ajuste_comercial: 'Ajuste comercial',
  promocao: 'Promoção',
  cortesia: 'Cortesia',
  reclamacao_cliente: 'Reclamação do cliente',
  autorizado_gestor: 'Autorizado pelo gestor',
  outro: 'Outro',
};

export const formatDiscountAuditNote = (draft: DiscountAuditDraft) => {
  const responsible = draft.responsibleStaffName || draft.responsibleStaffId || 'Não informado';
  return [
    '[Desconto auditado]',
    `Valor: R$ ${draft.amount.toFixed(2)}`,
    `Origem: ${DISCOUNT_TYPE_LABELS[draft.type]}`,
    `Responsável: ${draft.type === 'barber_discount' ? responsible : 'Não aplicável'}`,
    `Motivo: ${DISCOUNT_REASON_LABELS[draft.reasonType]}`,
    `Observação: ${draft.reasonNote.trim()}`,
    'Impacto na comissão: pendente de regra aprovada',
  ].join('\n');
};
