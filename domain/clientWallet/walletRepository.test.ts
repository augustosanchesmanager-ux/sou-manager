import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientWalletRepository } from './walletRepository';

describe('ClientWalletRepository', () => {
  let repo: ClientWalletRepository;
  const tenantId = 't-123';
  const clientId = 'c-456';

  beforeEach(() => {
    repo = new ClientWalletRepository();
    repo.clearInMemory();
    vi.clearAllMocks();
  });

  it('should_return_wallet_with_zero_balance_and_limit_by_default', async () => {
    const wallet = await repo.getWallet(tenantId, clientId);
    expect(wallet.client_id).toBe(clientId);
    expect(wallet.balance).toBe(0);
    expect(wallet.credit_limit).toBe(0);
  });

  it('should_update_credit_limit_manually', async () => {
    const updated = await repo.updateCreditLimit(tenantId, clientId, 250.0);
    expect(updated.credit_limit).toBe(250.0);

    const reloaded = await repo.getWallet(tenantId, clientId);
    expect(reloaded.credit_limit).toBe(250.0);
  });

  it('should_record_comanda_debit_and_adjust_balance', async () => {
    await repo.updateCreditLimit(tenantId, clientId, 300.0);

    const tx = await repo.recordTransaction({
      tenantId,
      clientId,
      type: 'debit_comanda',
      amount: 80.0,
      description: 'Comanda #1024 fechada na conta',
      comandaId: 'cmd-1024',
    });

    expect(tx.balance_before).toBe(0);
    expect(tx.balance_after).toBe(-80.0);
    expect(tx.amount).toBe(80.0);

    const wallet = await repo.getWallet(tenantId, clientId);
    expect(wallet.balance).toBe(-80.0);
  });

  it('should_record_settlement_and_clear_debt', async () => {
    // 1. Gera débito
    await repo.recordTransaction({
      tenantId,
      clientId,
      type: 'debit_comanda',
      amount: 100.0,
      description: 'Comanda #2000',
    });

    // 2. Cliente paga R$ 100 via PIX
    const settleTx = await repo.recordTransaction({
      tenantId,
      clientId,
      type: 'payment_settlement',
      amount: 100.0,
      description: 'Quitação parcial/total via PIX',
      paymentMethod: 'pix',
    });

    expect(settleTx.balance_before).toBe(-100.0);
    expect(settleTx.balance_after).toBe(0);

    const wallet = await repo.getWallet(tenantId, clientId);
    expect(wallet.balance).toBe(0);

    const history = await repo.getTransactions(tenantId, clientId);
    expect(history.length).toBe(2);
  });
});
