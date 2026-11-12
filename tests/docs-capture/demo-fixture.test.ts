import { describe, expect, it } from 'vitest';
import { DEMO_TENANT_ID, buildDemoFixture } from './demo-fixture';

// `now` fixo para o teste ser determinístico (15:00 UTC = 12:00 em São Paulo).
const NOW = new Date('2026-11-11T15:00:00.000Z');
const TODAY = '2026-11-11';

const fixture = buildDemoFixture(NOW);

const rows = (table: string): Array<Record<string, unknown>> => fixture[table] ?? [];

describe('fixture de captura (Local Demo Mode)', () => {
  it('should_have_unique_ids_when_fixture_is_built', () => {
    // Arrange
    const tablesWithIds = ['clients', 'appointments', 'transactions', 'comandas', 'comanda_items', 'service_execution_participants'];

    // Act + Assert
    for (const table of tablesWithIds) {
      const ids = rows(table).map((row) => row.id);
      expect(new Set(ids).size, `${table} tem id duplicado`).toBe(ids.length);
    }
  });

  it('should_match_item_sum_when_comanda_total_is_declared', () => {
    // Arrange
    const items = rows('comanda_items');
    const comandas = rows('comandas');

    // Act + Assert
    for (const comanda of comandas) {
      const expected = items
        .filter((item) => item.comanda_id === comanda.id)
        .reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
      expect(comanda.total, `total divergente na comanda ${String(comanda.id)}`).toBe(expected);
    }
  });

  it('should_have_closed_at_and_income_transaction_when_comanda_is_paid', () => {
    // Arrange
    const paid = rows('comandas').filter((comanda) => comanda.status === 'paid');
    const transactions = rows('transactions');

    // Act + Assert
    expect(paid.length).toBeGreaterThan(0);
    for (const comanda of paid) {
      expect(comanda.closed_at, `comanda paga sem closed_at: ${String(comanda.id)}`).toBeTruthy();
      const linked = transactions.find(
        (transaction) => transaction.source_type === 'comanda' && transaction.source_id === comanda.id,
      );
      expect(linked, `comanda paga sem lançamento financeiro: ${String(comanda.id)}`).toBeDefined();
      expect(linked?.amount).toBe(comanda.total);
    }
  });

  it('should_anchor_today_rows_to_sao_paulo_today_when_fixture_is_built', () => {
    // Arrange
    const todayAppointments = rows('appointments').filter((appointment) =>
      String(appointment.id).includes('-today-'),
    );
    const todayComandas = rows('comandas');

    // Act + Assert
    expect(todayAppointments.length).toBeGreaterThan(0);
    for (const appointment of todayAppointments) {
      expect(String(appointment.start_time).startsWith(TODAY)).toBe(true);
    }
    for (const comanda of todayComandas) {
      expect(String(comanda.created_at).startsWith(TODAY)).toBe(true);
    }
  });

  it('should_have_positive_today_and_month_revenue_when_fixture_is_built', () => {
    // Arrange
    const transactions = rows('transactions');

    // Act
    const incomeToday = transactions
      .filter((tx) => tx.type === 'income' && String(tx.date).startsWith(TODAY))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const incomeMonth = transactions
      .filter((tx) => tx.type === 'income' && String(tx.date).slice(0, 7) === TODAY.slice(0, 7))
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    // Assert
    expect(incomeToday).toBeGreaterThan(0);
    expect(incomeMonth).toBeGreaterThan(incomeToday);
  });

  it('should_not_keep_april_2026_seed_dates_when_fixture_is_built', () => {
    // Arrange
    const dateFields = ['date', 'start_time', 'created_at', 'closed_at', 'last_visit', 'end_date'];

    // Act
    const aprilRows = Object.values(fixture)
      .flat()
      .filter((row) =>
        dateFields.some((field) => {
          const value = (row as Record<string, unknown>)[field];
          return typeof value === 'string' && value.includes('2026-04');
        }),
      );

    // Assert
    expect(aprilRows).toHaveLength(0);
  });

  it('should_reuse_seed_ids_when_seed_rows_are_suppressed', () => {
    // Arrange
    const seedTransactionIds = ['demo-transaction-1', 'demo-transaction-2', 'demo-transaction-3', 'demo-transaction-4'];

    // Act
    const presentIds = rows('transactions').map((row) => row.id);

    // Assert — ids de seed reusados impedem que mergeSeedRows reintroduza as
    // linhas de abril/2026 no banco local do demo.
    for (const id of seedTransactionIds) {
      expect(presentIds).toContain(id);
    }
  });

  it('should_use_demo_tenant_when_rows_are_scoped', () => {
    // Arrange
    const tenantScoped = ['clients', 'appointments', 'transactions', 'comandas'];

    // Act + Assert
    for (const table of tenantScoped) {
      for (const row of rows(table)) {
        expect(row.tenant_id, `${table} com tenant divergente`).toBe(DEMO_TENANT_ID);
      }
    }
  });

  it('should_declare_numeric_total_spent_when_client_is_built', () => {
    // Arrange
    const clients = rows('clients');

    // Act + Assert — a coluna clients.total_spent é lida direto pelo front
    // (`(client.total_spent || 0).toFixed(2)`), então valor ausente vira R$ 0,00.
    expect(clients.length).toBeGreaterThan(0);
    for (const client of clients) {
      const totalSpent = client.total_spent;
      expect(typeof totalSpent, `total_spent não numérico em ${String(client.id)}`).toBe('number');
      expect(Number.isFinite(totalSpent), `total_spent inválido em ${String(client.id)}`).toBe(true);
      expect(Number(totalSpent), `total_spent negativo em ${String(client.id)}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('should_cover_paid_comandas_when_client_total_spent_is_declared', () => {
    // Arrange — LTV é acumulado; nunca pode ser menor que o que o cliente já
    // pagou na própria fixture.
    const paidByClient = new Map<string, number>();
    for (const comanda of rows('comandas')) {
      if (comanda.status !== 'paid') continue;
      const clientId = String(comanda.client_id);
      paidByClient.set(clientId, (paidByClient.get(clientId) ?? 0) + Number(comanda.total));
    }

    // Act + Assert
    for (const client of rows('clients')) {
      const clientId = String(client.id);
      expect(
        Number(client.total_spent),
        `total_spent menor que o total pago em ${clientId}`,
      ).toBeGreaterThanOrEqual(paidByClient.get(clientId) ?? 0);
    }
  });

  it('should_have_positive_total_spent_when_client_has_paid_comanda', () => {
    // Arrange
    const paidClientIds = new Set(
      rows('comandas')
        .filter((comanda) => comanda.status === 'paid')
        .map((comanda) => String(comanda.client_id)),
    );

    // Act
    const zeroSpentForPayingClients = rows('clients').filter(
      (client) => paidClientIds.has(String(client.id)) && Number(client.total_spent) <= 0,
    );

    // Assert
    expect(zeroSpentForPayingClients).toHaveLength(0);
  });
});
