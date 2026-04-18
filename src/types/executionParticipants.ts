export type ExecutionRole = 'primary' | 'assistant' | 'co_executor';
export type PayoutType = 'percentage' | 'fixed';

export interface ServiceExecutionParticipant {
  id: string;
  comanda_item_id: string;
  professional_id: string;
  professional?: Staff;
  role: ExecutionRole;
  payout_type: PayoutType;
  payout_value: number;
  affects_revenue: boolean;
  affects_commission: boolean;
  tenant_id: string;
  created_at: string;
}

export interface Staff {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  avatar?: string;
  commission_rate?: number;
  status: string;
  tenant_id?: string;
  created_at?: string;
}

export interface ComandaItem {
  id: string;
  tenant_id?: string;
  comanda_id: string;
  staff_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  product_id?: string | null;
  service_id?: string | null;
  created_at?: string;
  updated_at?: string;
  execution_participants?: ServiceExecutionParticipant[];
}

export interface Comanda {
  id: string;
  tenant_id?: string;
  client_id: string;
  staff_id?: string | null;
  appointment_id?: string | null;
  status: 'open' | 'paid' | 'cancelled';
  cancellation_reason?: string | null;
  total: number;
  created_at: string;
  updated_at?: string;
  clients?: {
    name: string;
    avatar: string;
  };
  staff?: {
    name: string;
  };
  appointment?: {
    start_time: string | null;
  };
  comanda_items: ComandaItem[];
  staff_ids: string[];
  staff_names: string[];
}

export interface CartItem {
  id: string;
  type: 'service' | 'product';
  name: string;
  price: number;
  quantity: number;
  service_id?: string;
  product_id?: string;
  staff_id?: string;
  execution_participants?: CartParticipant[];
}

export interface CartParticipant {
  id: string;
  professional_id: string;
  professional_name?: string;
  role: ExecutionRole;
  payout_type: PayoutType;
  payout_value: number;
  affects_revenue: boolean;
  affects_commission: boolean;
}

export function calculateParticipantPayout(
  itemUnitPrice: number,
  itemQuantity: number,
  participant: ServiceExecutionParticipant | CartParticipant
): number {
  const totalItemValue = itemUnitPrice * itemQuantity;
  
  if (participant.payout_type === 'percentage') {
    return totalItemValue * (participant.payout_value / 100);
  }
  
  return participant.payout_value;
}

export function calculateTotalPayouts(
  itemUnitPrice: number,
  itemQuantity: number,
  participants: (ServiceExecutionParticipant | CartParticipant)[]
): number {
  return participants
    .filter(p => p.affects_commission)
    .reduce((sum, p) => sum + calculateParticipantPayout(itemUnitPrice, itemQuantity, p), 0);
}

export function getPrimaryParticipant(
  participants: (ServiceExecutionParticipant | CartParticipant)[]
): ServiceExecutionParticipant | CartParticipant | undefined {
  return participants.find(p => p.role === 'primary' || p.affects_revenue);
}

export function getAssistantParticipants(
  participants: (ServiceExecutionParticipant | CartParticipant)[]
): (ServiceExecutionParticipant | CartParticipant)[] {
  return participants.filter(p => p.role === 'assistant' || p.role === 'co_executor');
}