/**
 * [SMG][DOMAIN][CLIENT_WALLET] types.ts
 *
 * Modelagem de tipos para Conta do Cliente, Limite de Fiado e Carteira Pré-Paga.
 */

export type WalletTransactionType =
  | 'debit_comanda'      // Comanda fechada a prazo ("na conta")
  | 'credit_deposit'     // Depósito antecipado / recarga de saldo
  | 'payment_settlement' // Pagamento / liquidação de dívida pelo cliente
  | 'adjustment';        // Ajuste manual realizado pelo gestor

export interface ClientWallet {
  client_id: string;
  tenant_id: string;
  client_name?: string;
  client_phone?: string;
  balance: number; // Negativo = débito pendente (fiado); Positivo = crédito disponível
  credit_limit: number; // Limite máximo permitido pelo gestor (padrão 0.00)
  total_spent?: number;
  last_movement_at?: string;
}

export interface ClientWalletTransaction {
  id: string;
  tenant_id: string;
  client_id: string;
  type: WalletTransactionType;
  amount: number; // Valor da movimentação (> 0)
  balance_before: number;
  balance_after: number;
  comanda_id?: string | null;
  payment_method?: string | null; // ex: 'pix', 'cash', 'credit' ao liquidar
  description: string;
  created_at: string;
  created_by?: string | null;
}

export interface ClientWalletSummary {
  totalDebt: number;       // Total a receber (devedores)
  totalCredit: number;     // Total sob custódia (créditos pré-pagos)
  netBalance: number;      // Saldo líquido
  debtorsCount: number;    // Quantidade de clientes em dívida
  creditorsCount: number;  // Quantidade de clientes com crédito positivo
}

export interface ChargeToAccountValidation {
  allowed: boolean;
  reason?: string;
  availableLimit: number;
  currentBalance: number;
  creditLimit: number;
}
