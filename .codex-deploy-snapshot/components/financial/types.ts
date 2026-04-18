export type PeriodFilter = 'hoje' | '7dias' | '30dias' | 'mesAtual' | 'personalizado';
export type EntryType = 'entrada' | 'saida';
export type EntryStatus = 'realizado' | 'previsto' | 'vencido';

export interface FinancialAccount {
  id: string;
  name: string;
  initialBalance: number;
}

export interface CashFlowEntry {
  id: string;
  date: string;
  description: string;
  category: string;
  accountId: string;
  costCenter: string;
  type: EntryType;
  paymentMethod: string;
  status: EntryStatus;
  value: number;
}

export interface FilterState {
  period: PeriodFilter;
  accountId: string;
  category: string;
  costCenter: string;
  status: 'todos' | EntryStatus;
  paymentMethod: string;
  search: string;
  customStart: string;
  customEnd: string;
}

export interface SummaryCardData {
  title: string;
  value: number;
  changeText: string;
  trend: 'up' | 'down';
  tone: 'positive' | 'negative' | 'neutral';
  helperText: string;
}

export interface EnrichedCashFlowEntry extends CashFlowEntry {
  accountName: string;
  runningBalance: number;
}
