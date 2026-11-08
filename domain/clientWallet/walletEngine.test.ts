import { describe, it, expect } from 'vitest';
import {
  validateChargeToAccount,
  calculateNewBalance,
  calculateWalletSummary,
  generateWhatsAppDebtMessage,
} from './walletEngine';
import type { ClientWallet } from './types';

describe('walletEngine: Carteira do Cliente e Fiado Controlado', () => {
  const baseWallet: ClientWallet = {
    client_id: 'client-1',
    tenant_id: 'tenant-1',
    balance: 0,
    credit_limit: 0,
    client_name: 'Carlos Oliveira',
  };

  describe('validateChargeToAccount', () => {
    it('should_reject_charge_when_amount_is_zero_or_negative', () => {
      const res = validateChargeToAccount(baseWallet, 0);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('maior que zero');
    });

    it('should_allow_charge_when_client_has_sufficient_prepaid_credit', () => {
      const prepaidWallet: ClientWallet = {
        ...baseWallet,
        balance: 150.0,
        credit_limit: 0, // Sem limite de fiado, mas tem crédito pré-pago
      };

      const res = validateChargeToAccount(prepaidWallet, 80.0);
      expect(res.allowed).toBe(true);
      expect(res.currentBalance).toBe(150.0);
    });

    it('should_reject_charge_when_client_has_no_credit_limit_and_no_balance', () => {
      const res = validateChargeToAccount(baseWallet, 50.0);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('não possui limite de crédito');
    });

    it('should_allow_charge_when_authorized_credit_limit_covers_amount', () => {
      const authorizedWallet: ClientWallet = {
        ...baseWallet,
        balance: 0,
        credit_limit: 200.0, // Limite liberado manualmente pelo gestor
      };

      const res = validateChargeToAccount(authorizedWallet, 120.0);
      expect(res.allowed).toBe(true);
      expect(res.availableLimit).toBe(200.0);
    });

    it('should_reject_when_existing_debt_exceeds_available_credit_limit', () => {
      const debtorWallet: ClientWallet = {
        ...baseWallet,
        balance: -160.0, // Já deve R$ 160
        credit_limit: 200.0, // Limite total de R$ 200 (sobra R$ 40)
      };

      const res = validateChargeToAccount(debtorWallet, 50.0);
      expect(res.allowed).toBe(false);
      expect(res.availableLimit).toBe(40.0);
      expect(res.reason).toContain('Limite de crédito insuficiente');
    });

    it('should_allow_charge_when_debt_plus_new_charge_is_within_limit', () => {
      const debtorWallet: ClientWallet = {
        ...baseWallet,
        balance: -100.0,
        credit_limit: 200.0,
      };

      const res = validateChargeToAccount(debtorWallet, 80.0);
      expect(res.allowed).toBe(true);
      expect(res.availableLimit).toBe(100.0);
    });
  });

  describe('calculateNewBalance', () => {
    it('should_decrease_balance_on_comanda_debit', () => {
      expect(calculateNewBalance(50, 'debit_comanda', 30)).toBe(20);
      expect(calculateNewBalance(0, 'debit_comanda', 60)).toBe(-60);
      expect(calculateNewBalance(-50, 'debit_comanda', 40)).toBe(-90);
    });

    it('should_increase_balance_on_payment_settlement', () => {
      expect(calculateNewBalance(-100, 'payment_settlement', 100)).toBe(0);
      expect(calculateNewBalance(-100, 'payment_settlement', 40)).toBe(-60);
      expect(calculateNewBalance(0, 'credit_deposit', 150)).toBe(150);
    });
  });

  describe('calculateWalletSummary', () => {
    it('should_correctly_compute_totals_and_counts_for_debtors_and_creditors', () => {
      const wallets: ClientWallet[] = [
        { client_id: '1', tenant_id: 't', balance: -150, credit_limit: 200 },
        { client_id: '2', tenant_id: 't', balance: -50, credit_limit: 100 },
        { client_id: '3', tenant_id: 't', balance: 80, credit_limit: 0 },
        { client_id: '4', tenant_id: 't', balance: 0, credit_limit: 50 },
      ];

      const summary = calculateWalletSummary(wallets);
      expect(summary.totalDebt).toBe(200);
      expect(summary.totalCredit).toBe(80);
      expect(summary.netBalance).toBe(-120);
      expect(summary.debtorsCount).toBe(2);
      expect(summary.creditorsCount).toBe(1);
    });
  });

  describe('generateWhatsAppDebtMessage', () => {
    it('should_generate_polite_collection_message_with_pix_key_and_amount', () => {
      const msg = generateWhatsAppDebtMessage({
        clientName: 'Fernando Alencar',
        debtAmount: 75.0,
        pixKey: '11999998888',
        shopName: 'Barbearia Sanchez',
      });

      expect(msg).toContain('Fernando');
      expect(msg).toContain('R$ 75,00');
      expect(msg).toContain('Barbearia Sanchez');
      expect(msg).toContain('11999998888');
    });
  });
});
