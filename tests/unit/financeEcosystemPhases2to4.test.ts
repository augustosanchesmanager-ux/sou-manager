import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const readRepoFile = (relPath: string) => readFileSync(resolve(process.cwd(), relPath), 'utf-8');

describe('ADR-045 Phases 2-4 — Unified Financial Ecosystem', () => {
  it('should_enforce_single_reversal_execution_point_exclusively_in_Cashflow', () => {
    const cashflow = readRepoFile('pages/Cashflow.tsx');
    const receipts = readRepoFile('pages/Receipts.tsx');
    const accountsReceivable = readRepoFile('pages/AccountsReceivable.tsx');
    const comandas = readRepoFile('pages/Comandas.tsx');

    expect(cashflow).toContain('reverseFinancialTransaction');
    expect(cashflow).toContain("searchParams.get('tx')");
    expect(cashflow).toContain("searchParams.get('action')");
    expect(cashflow).toContain('<CashLedger />');
    expect(cashflow).toContain('auditPin');

    expect(receipts).not.toContain('reverseFinancialTransaction');
    expect(receipts).toContain('/cashflow?tx=');

    expect(accountsReceivable).not.toContain('reverseFinancialTransaction');
    expect(accountsReceivable).toContain('/cashflow?tx=');

    expect(comandas).not.toContain('reverseFinancialTransaction');
    expect(comandas).toContain('/cashflow?tx=');
  });

  it('should_separate_debtors_fiado_from_positive_balances_in_AccountsReceivable', () => {
    const ar = readRepoFile('pages/AccountsReceivable.tsx');

    expect(ar).toContain("'creditos'");
    expect(ar).toContain('positiveCreditWallets');
    expect(ar).toContain('Number(w.balance || 0) > 0');
    expect(ar).toContain('Number(w.balance || 0) < 0');
    expect(ar).toContain('consolidatedPaymentDate');
    expect(ar).toContain('<option value="cash">');
    expect(ar).toContain('<option value="debit">');
    expect(ar).toContain('<option value="credit">');
    expect(ar).toContain('<option value="other">');
    expect(ar).not.toContain('<option value="dinheiro">');
    expect(ar).not.toContain('<option value="debito">');
    expect(ar).not.toContain('<option value="credito">');
  });

  it('should_support_explicit_mark_as_fiado_flow_in_Comandas_and_Sidebar', () => {
    const comandas = readRepoFile('pages/Comandas.tsx');
    const sidebar = readRepoFile('components/ComandaSidebar.tsx');
    const listItem = readRepoFile('components/ComandaListItem.tsx');

    expect(comandas).toContain('markComandaAsFiado');
    expect(comandas).toContain('handleMarkAsFiado');
    expect(sidebar).toContain('Definir como Fiado');
    expect(listItem).toContain('is_fiado');
  });

  it('should_consolidate_routes_and_sidebar_finance_menu_and_link_eod_reconciliation', () => {
    const app = readRepoFile('App.tsx');
    const navSidebar = readRepoFile('components/Sidebar.tsx');
    const cashClosing = readRepoFile('pages/CashClosingPage.tsx');
    const bankReconciliation = readRepoFile('pages/BankReconciliation.tsx');

    expect(app).toContain('<Route path="/financial-overview" element={<Navigate to="/cashflow" replace />} />');
    expect(app).toContain('<Route path="/entrada-saida" element={<Navigate to="/cashflow?view=ledger" replace />} />');
    expect(app).toContain('<Route path="/client-accounts" element={<Navigate to="/accounts-receivable?tab=creditos" replace />} />');

    expect(navSidebar).not.toContain("path: '/financial-overview'");
    expect(navSidebar).not.toContain("path: '/entrada-saida'");
    expect(navSidebar).not.toContain("path: '/client-accounts'");

    expect(cashClosing).toContain('/bank-reconciliation?date=');
    expect(bankReconciliation).toContain('cashClosingRepository.getByBusinessDate');
    expect(bankReconciliation).toContain("searchParams.get('date')");
  });
});
