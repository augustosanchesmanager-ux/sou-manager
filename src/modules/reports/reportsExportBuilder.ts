/**
 * src/modules/reports/reportsExportBuilder.ts
 *
 * Construtor puro de payloads de exportação (CSV & PDF) contextualizado
 * para cada aba e sub-aba da Central de Relatórios (/reports).
 */

import type { ExportPayload } from '../../utils/export/types';
import { roundCurrency } from '../../utils/financial/discountAllocation';
import type {
  AllocatedComandaItemDetail,
  AppointmentReportRow,
  BarberAdvanceRecord,
  FinancialTitleRow,
  PaidComandaDetail,
  ProductCatalogItem,
  ProductSalesReportRow,
} from './reportsDataService';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const fmtDate = (d?: string | null) => {
  if (!d) return '-';
  if (d.length === 10) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

export function buildSalesExportPayload(
  comandas: PaidComandaDetail[],
  tenantName: string,
  periodLabel: string
): ExportPayload<PaidComandaDetail> {
  const gross = roundCurrency(comandas.reduce((s, c) => s + c.catalogTotal, 0));
  const discounts = roundCurrency(comandas.reduce((s, c) => s + c.discountTotal, 0));
  const net = roundCurrency(comandas.reduce((s, c) => s + c.appliedTotal, 0));
  const avg = comandas.length > 0 ? roundCurrency(net / comandas.length) : 0;

  return {
    metadata: {
      title: 'Relatório de Vendas & Faturamento',
      tenantName,
      periodLabel,
      generatedAt: fmtDateTime(new Date().toISOString()),
      summaryCards: [
        { label: 'Faturamento Bruto', value: fmtBRL(gross) },
        { label: 'Descontos', value: fmtBRL(discounts) },
        { label: 'Faturamento Líquido', value: fmtBRL(net) },
        { label: 'Ticket Médio', value: fmtBRL(avg) },
      ],
    },
    orientation: 'landscape',
    columns: [
      { header: 'Comanda', key: 'shortId' },
      { header: 'Data / Fechamento', key: 'closedAt', format: (v) => fmtDateTime(v) },
      { header: 'Cliente', key: 'clientName' },
      { header: 'Profissional', key: 'staffNames', format: (v: string[]) => v.join(', ') || '-' },
      { header: 'Meio Pgto', key: 'paymentMethodLabels', format: (v: string[]) => v.join(', ') || '-' },
      { header: 'Vl. Tabela', key: 'catalogTotal', format: (v) => fmtBRL(v) },
      { header: 'Desconto', key: 'discountTotal', format: (v) => fmtBRL(v) },
      { header: 'Vl. Aplicado', key: 'appliedTotal', format: (v) => fmtBRL(v) },
    ],
    data: comandas,
  };
}

export function buildAppointmentsExportPayload(
  appointments: AppointmentReportRow[],
  tenantName: string,
  periodLabel: string
): ExportPayload<AppointmentReportRow> {
  const total = appointments.length;
  const completed = appointments.filter((a) => a.statusCategory === 'completed');
  const gaps = appointments.filter(
    (a) => a.statusCategory === 'cancelled' || a.statusCategory === 'no_show'
  );
  const totalMins = completed.reduce((s, a) => s + a.durationMinutes, 0);
  const hours = `${Math.floor(totalMins / 60)}h ${String(totalMins % 60).padStart(2, '0')}m`;

  const statusLabels: Record<AppointmentReportRow['statusCategory'], string> = {
    completed: 'Concluído',
    scheduled: 'Agendado',
    cancelled: 'Cancelado',
    no_show: 'No-Show',
  };

  return {
    metadata: {
      title: 'Relatório de Atendimentos & Agendamentos',
      tenantName,
      periodLabel,
      generatedAt: fmtDateTime(new Date().toISOString()),
      summaryCards: [
        { label: 'Total Agendamentos', value: String(total) },
        { label: 'Concluídos', value: String(completed.length) },
        { label: 'Furos (Canc./Falta)', value: String(gaps.length) },
        { label: 'Horas em Cadeira', value: hours },
      ],
    },
    orientation: 'landscape',
    columns: [
      { header: 'Data / Hora', key: 'startTime', format: (v) => fmtDateTime(v) },
      { header: 'Cliente', key: 'clientName' },
      { header: 'Telefone', key: 'clientPhone', format: (v) => v || '-' },
      { header: 'Profissional', key: 'staffName' },
      { header: 'Serviço(s)', key: 'serviceNames' },
      { header: 'Duração', key: 'durationMinutes', format: (v) => `${v} min` },
      { header: 'Status', key: 'statusCategory', format: (v) => statusLabels[v as AppointmentReportRow['statusCategory']] || v },
    ],
    data: appointments,
  };
}

export function buildProductsSalesExportPayload(
  rows: ProductSalesReportRow[],
  tenantName: string,
  periodLabel: string
): ExportPayload<ProductSalesReportRow> {
  const rev = roundCurrency(rows.reduce((s, r) => s + r.appliedTotal, 0));
  const cmv = roundCurrency(rows.reduce((s, r) => s + r.cmv, 0));
  const profit = roundCurrency(rev - cmv);

  return {
    metadata: {
      title: 'Relatório de Vendas de Produtos',
      tenantName,
      periodLabel,
      generatedAt: fmtDateTime(new Date().toISOString()),
      summaryCards: [
        { label: 'Receita Produtos', value: fmtBRL(rev) },
        { label: 'CMV', value: fmtBRL(cmv) },
        { label: 'Lucro Bruto', value: fmtBRL(profit) },
      ],
    },
    orientation: 'landscape',
    columns: [
      { header: 'Produto', key: 'productName' },
      { header: 'Categoria', key: 'category' },
      { header: 'Qtd', key: 'quantitySold' },
      { header: 'Vl. Tabela', key: 'catalogTotal', format: (v) => fmtBRL(v) },
      { header: 'Desconto', key: 'discountTotal', format: (v) => fmtBRL(v) },
      { header: 'Vl. Aplicado', key: 'appliedTotal', format: (v) => fmtBRL(v) },
      { header: 'Custo Unit.', key: 'unitCost', format: (v) => fmtBRL(v) },
      { header: 'Margem', key: 'marginPct', format: (v) => `${v}%` },
      { header: 'Estoque', key: 'currentStock' },
    ],
    data: rows,
  };
}

export function buildProductsStockExportPayload(
  catalog: ProductCatalogItem[],
  tenantName: string,
  periodLabel: string
): ExportPayload<ProductCatalogItem> {
  const criticalCount = catalog.filter((c) => c.isCriticalStock).length;

  return {
    metadata: {
      title: 'Posição Atual de Estoque & Catálogo',
      tenantName,
      periodLabel,
      generatedAt: fmtDateTime(new Date().toISOString()),
      summaryCards: [
        { label: 'Total Produtos', value: String(catalog.length) },
        { label: 'Estoque Crítico', value: String(criticalCount) },
      ],
    },
    orientation: 'landscape',
    columns: [
      { header: 'Produto', key: 'name' },
      { header: 'Categoria', key: 'category' },
      { header: 'Fornecedor', key: 'supplierName' },
      { header: 'Custo Unit.', key: 'costPrice', format: (v) => fmtBRL(v) },
      { header: 'Preço Venda', key: 'price', format: (v) => fmtBRL(v) },
      { header: 'Estoque Atual', key: 'stockQuantity' },
      { header: 'Estoque Mín.', key: 'minStock' },
      { header: 'Status', key: 'isCriticalStock', format: (v) => (v ? 'Crítico / Repor' : 'Normal') },
    ],
    data: catalog,
  };
}

export function buildCommissionsExportPayload(
  items: AllocatedComandaItemDetail[],
  advances: BarberAdvanceRecord[],
  barberLabel: string,
  tenantName: string,
  periodLabel: string
): ExportPayload<AllocatedComandaItemDetail> {
  const gross = roundCurrency(items.reduce((s, it) => s + it.catalog_price, 0));
  const discounts = roundCurrency(items.reduce((s, it) => s + it.total_discount, 0));
  const applied = roundCurrency(items.reduce((s, it) => s + it.applied_amount, 0));
  const totalComm = roundCurrency(items.reduce((s, it) => s + it.commission_amount, 0));
  const totalAdv = roundCurrency(advances.reduce((s, a) => s + a.amount, 0));
  const netPay = roundCurrency(Math.max(0, totalComm - totalAdv));

  return {
    metadata: {
      title: `Extrato de Comissões — ${barberLabel}`,
      tenantName,
      periodLabel,
      generatedAt: fmtDateTime(new Date().toISOString()),
      summaryCards: [
        { label: 'Vl. Tabela', value: fmtBRL(gross) },
        { label: 'Descontos', value: fmtBRL(discounts) },
        { label: 'Vl. Aplicado', value: fmtBRL(applied) },
        { label: 'Comissão (Líq. Vales)', value: `${fmtBRL(totalComm)} (Líq: ${fmtBRL(netPay)})` },
      ],
    },
    orientation: 'landscape', // Obrigatório para as 10 colunas
    columns: [
      { header: 'Data/Baixa', key: 'closedAt', format: (v) => fmtDateTime(v) },
      { header: 'Comanda', key: 'comandaShortId' },
      { header: 'Cliente', key: 'clientName' },
      { header: 'Serviço/Produto', key: 'item_name' },
      { header: 'Meio Pgto', key: 'paymentMethodLabel' },
      { header: 'Vl. Tabela', key: 'catalog_price', format: (v) => fmtBRL(v) },
      { header: 'Desconto', key: 'total_discount', format: (v) => fmtBRL(v) },
      { header: 'Vl. Aplicado', key: 'applied_amount', format: (v) => fmtBRL(v) },
      { header: '% Comis.', key: 'commission_rate', format: (v) => `${v}%` },
      { header: 'Comissão (R$)', key: 'commission_amount', format: (v) => fmtBRL(v) },
    ],
    data: items,
  };
}

export function buildFinancialTitlesExportPayload(
  rows: FinancialTitleRow[],
  title: string,
  tenantName: string,
  periodLabel: string
): ExportPayload<FinancialTitleRow> {
  const total = roundCurrency(rows.reduce((s, r) => s + r.amount, 0));
  const paid = roundCurrency(rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0));
  const pending = roundCurrency(rows.filter((r) => r.status !== 'paid').reduce((s, r) => s + r.amount, 0));

  const statusMap: Record<FinancialTitleRow['status'], string> = {
    paid: 'Liquidado',
    pending: 'Pendente',
    overdue: 'Em Atraso',
  };

  return {
    metadata: {
      title,
      tenantName,
      periodLabel,
      generatedAt: fmtDateTime(new Date().toISOString()),
      summaryCards: [
        { label: 'Total', value: fmtBRL(total) },
        { label: 'Liquidado', value: fmtBRL(paid) },
        { label: 'Pendente / Atraso', value: fmtBRL(pending) },
      ],
    },
    orientation: 'landscape',
    columns: [
      { header: 'Vencimento', key: 'dueDate', format: (v) => fmtDate(v) },
      { header: 'Tipo', key: 'type', format: (v) => (v === 'receivable' ? 'A Receber' : 'A Pagar') },
      { header: 'Descrição / Origem', key: 'description' },
      { header: 'Cliente / Fornecedor', key: 'partyName' },
      { header: 'Categoria', key: 'category' },
      { header: 'Valor', key: 'amount', format: (v) => fmtBRL(v) },
      { header: 'Status', key: 'status', format: (v) => statusMap[v as FinancialTitleRow['status']] || v },
    ],
    data: rows,
  };
}
