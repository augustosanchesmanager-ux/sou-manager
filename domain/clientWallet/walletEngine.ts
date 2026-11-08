/**
 * [SMG][DOMAIN][CLIENT_WALLET] walletEngine.ts
 *
 * Motor de cálculo financeiro e regras de negócio para a Carteira do Cliente.
 */

import type {
  ClientWallet,
  ClientWalletSummary,
  ChargeToAccountValidation,
  WalletTransactionType,
} from './types';

export type {
  ClientWallet,
  ClientWalletSummary,
  ChargeToAccountValidation,
  WalletTransactionType,
};

/**
 * Valida se um cliente pode fechar uma comanda "Na Conta" (fiado ou consumo de crédito pré-pago).
 * O limite liberado é manual por cliente.
 */
export const validateChargeToAccount = (
  wallet: ClientWallet | null | undefined,
  amountToCharge: number,
): ChargeToAccountValidation => {
  const currentBalance = Number(wallet?.balance || 0);
  const creditLimit = Number(wallet?.credit_limit || 0);

  // Margem total disponível = saldo positivo pré-pago + limite de crédito autorizado - saldo devedor atual
  const availableLimit = currentBalance >= 0
    ? currentBalance + creditLimit
    : creditLimit + currentBalance; // se currentBalance é -50 e limit é 100, sobra 50

  if (amountToCharge <= 0) {
    return {
      allowed: false,
      reason: 'Valor da cobrança deve ser maior que zero.',
      availableLimit,
      currentBalance,
      creditLimit,
    };
  }

  // Se o cliente tem saldo pré-pago suficiente, sempre pode consumir
  if (currentBalance >= amountToCharge) {
    return {
      allowed: true,
      availableLimit,
      currentBalance,
      creditLimit,
    };
  }

  // Se não tem saldo pré-pago suficiente, precisa de limite de crédito autorizado pelo gestor
  if (creditLimit <= 0) {
    return {
      allowed: false,
      reason: 'Cliente não possui limite de crédito ("fiado") autorizado pelo gestor.',
      availableLimit: Math.max(0, availableLimit),
      currentBalance,
      creditLimit,
    };
  }

  if (availableLimit < amountToCharge) {
    const faltam = (amountToCharge - availableLimit).toFixed(2);
    return {
      allowed: false,
      reason: `Limite de crédito insuficiente. Limite disponível: R$ ${Math.max(0, availableLimit).toFixed(2)} (Faltam R$ ${faltam}).`,
      availableLimit: Math.max(0, availableLimit),
      currentBalance,
      creditLimit,
    };
  }

  return {
    allowed: true,
    availableLimit,
    currentBalance,
    creditLimit,
  };
};

/**
 * Calcula o novo saldo após uma transação na carteira.
 */
export const calculateNewBalance = (
  currentBalance: number,
  type: WalletTransactionType,
  amount: number,
): number => {
  const safeAmount = Math.abs(Number(amount) || 0);
  const cur = Number(currentBalance) || 0;

  switch (type) {
    case 'debit_comanda':
      // Consumo a prazo reduz o saldo (gera dívida ou abate crédito pré-pago)
      return Number((cur - safeAmount).toFixed(2));
    case 'credit_deposit':
    case 'payment_settlement':
      // Pagamento de dívida ou depósito antecipado aumenta o saldo
      return Number((cur + safeAmount).toFixed(2));
    case 'adjustment':
      // No ajuste manual, a aplicação do sinal deve ser decidida pelo chamador ou por convenção
      return Number((cur + amount).toFixed(2));
    default:
      return cur;
  }
};

/**
 * Consolida o resumo executivo de dívidas e créditos de todos os clientes da barbearia.
 */
export const calculateWalletSummary = (wallets: ClientWallet[] = []): ClientWalletSummary => {
  let totalDebt = 0;
  let totalCredit = 0;
  let debtorsCount = 0;
  let creditorsCount = 0;

  for (const w of wallets) {
    const bal = Number(w.balance || 0);
    if (bal < 0) {
      totalDebt += Math.abs(bal);
      debtorsCount++;
    } else if (bal > 0) {
      totalCredit += bal;
      creditorsCount++;
    }
  }

  totalDebt = Number(totalDebt.toFixed(2));
  totalCredit = Number(totalCredit.toFixed(2));
  const netBalance = Number((totalCredit - totalDebt).toFixed(2));

  return {
    totalDebt,
    totalCredit,
    netBalance,
    debtorsCount,
    creditorsCount,
  };
};

/**
 * Gera mensagem educada e profissional para cobrança de saldo devedor via WhatsApp com chave PIX.
 */
export const generateWhatsAppDebtMessage = (params: {
  clientName: string;
  debtAmount: number;
  pixKey?: string;
  shopName?: string;
}): string => {
  const { clientName, debtAmount, pixKey, shopName } = params;
  const firstName = clientName.trim().split(' ')[0] || 'Cliente';
  const formattedDebt = Math.abs(debtAmount).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const shop = shopName || 'sua barbearia';

  let msg = `Olá, *${firstName}*! Tudo bem? 💈\n\n`;
  msg += `Passando para enviar o resumo da sua conta em aberto na *${shop}*.\n`;
  msg += `Valor pendente: *${formattedDebt}*\n\n`;

  if (pixKey) {
    msg += `Você pode efetuar o acerto via PIX através da chave:\n`;
    msg += `🔑 Chave PIX: *${pixKey}*\n\n`;
    msg += `Assim que realizar a transferência, basta nos enviar o comprovante por aqui. `;
  }

  msg += `Agradecemos a confiança e estamos à disposição! 🤝`;

  return msg;
};
