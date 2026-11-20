import React, { useMemo, useState } from 'react';
import { Package, DollarSign, TrendingUp, AlertOctagon } from 'lucide-react';
import type {
  ProductCatalogItem,
  ProductSalesByStaffRow,
  ProductSalesReportRow,
} from '../../src/modules/reports/reportsDataService';
import { roundCurrency } from '../../src/utils/financial/discountAllocation';
import { ReportsProductsByStaffView } from './ReportsProductsByStaffView';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface ReportsProductsTabProps {
  salesRows: ProductSalesReportRow[];
  staffRows: ProductSalesByStaffRow[];
  catalogItems: ProductCatalogItem[];
  loading: boolean;
  subView: 'sales' | 'by_staff' | 'stock';
  onChangeSubView: (view: 'sales' | 'by_staff' | 'stock') => void;
  onSendBonusToPayroll?: (row: ProductSalesByStaffRow) => void;
}

export const ReportsProductsTab: React.FC<ReportsProductsTabProps> = ({
  salesRows,
  staffRows,
  catalogItems,
  loading,
  subView,
  onChangeSubView,
  onSendBonusToPayroll,
}) => {
  const [onlyCritical, setOnlyCritical] = useState(false);

  const metrics = useMemo(() => {
    const productRevenue = roundCurrency(salesRows.reduce((s, r) => s + r.appliedTotal, 0));
    const totalCmv = roundCurrency(salesRows.reduce((s, r) => s + r.cmv, 0));
    const grossProfit = roundCurrency(productRevenue - totalCmv);
    const criticalItemsCount = catalogItems.filter((c) => c.isCriticalStock).length;

    return { productRevenue, totalCmv, grossProfit, criticalItemsCount };
  }, [salesRows, catalogItems]);

  const filteredCatalog = useMemo(() => {
    if (!onlyCritical) return catalogItems;
    return catalogItems.filter((c) => c.isCriticalStock);
  }, [catalogItems, onlyCritical]);

  return (
    <div className="space-y-6">
      {/* 4 Cards Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#141210] border border-[#B88A44]/50 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B88A44]">
              Receita de Produtos (Aplicado)
            </span>
            <DollarSign className="w-4 h-4 text-[#B88A44]" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">{fmtBRL(metrics.productRevenue)}</div>
          <div className="mt-1 text-xs text-stone-400">Em comandas pagas no período</div>
        </div>

        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              CMV (Custo Mercadoria)
            </span>
            <Package className="w-4 h-4 text-stone-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-stone-200">{fmtBRL(metrics.totalCmv)}</div>
          <div className="mt-1 text-xs text-stone-500">Qtd vendida × custo cadastrado</div>
        </div>

        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Lucro Bruto Estimado
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-400">{fmtBRL(metrics.grossProfit)}</div>
          <div className="mt-1 text-xs text-stone-500">Receita Produtos - CMV</div>
        </div>

        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Estoque Crítico / Zerado
            </span>
            <AlertOctagon className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-400">{metrics.criticalItemsCount}</div>
          <div className="mt-1 text-xs text-stone-500">Itens abaixo ou no estoque mínimo</div>
        </div>
      </div>

      {/* Sub-toggle Vendas vs Posição de Estoque */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-[#141210] border border-[#2D2A26] p-1">
          <button
            type="button"
            onClick={() => onChangeSubView('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subView === 'sales'
                ? 'bg-[#B88A44] text-[#0E0C0A] shadow'
                : 'text-stone-400 hover:text-[#F5F5F0]'
            }`}
          >
            Desempenho de Vendas ({salesRows.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeSubView('by_staff')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subView === 'by_staff'
                ? 'bg-[#B88A44] text-[#0E0C0A] shadow'
                : 'text-stone-400 hover:text-[#F5F5F0]'
            }`}
          >
            Por Profissional ({staffRows.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeSubView('stock')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subView === 'stock'
                ? 'bg-[#B88A44] text-[#0E0C0A] shadow'
                : 'text-stone-400 hover:text-[#F5F5F0]'
            }`}
          >
            Posição Atual de Estoque ({catalogItems.length})
          </button>
        </div>

        {subView === 'stock' && (
          <label className="inline-flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyCritical}
              onChange={(e) => setOnlyCritical(e.target.checked)}
              className="rounded border-[#2D2A26] bg-[#0E0C0A] text-[#B88A44] focus:ring-[#B88A44]"
            />
            Mostrar apenas itens em alerta / estoque crítico
          </label>
        )}
      </div>

      {/* Tabela Ativa */}
      {subView === 'by_staff' ? (
        <ReportsProductsByStaffView
          rows={staffRows}
          loading={loading}
          onSendBonusToPayroll={onSendBonusToPayroll}
        />
      ) : subView === 'sales' ? (
        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D2A26] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F5F5F0]">
              Vendas de Produtos no Período (com Rateio de Desconto)
            </h3>
            <span className="text-xs text-stone-400">{salesRows.length} produto(s)</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Carregando vendas de produtos...</div>
          ) : salesRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              Nenhuma venda de produto registrada em comandas pagas neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2D2A26] bg-[#0E0C0A] text-[10px] uppercase tracking-wider text-[#B88A44]">
                    <th className="py-3 px-4 font-semibold">Produto</th>
                    <th className="py-3 px-4 font-semibold">Categoria</th>
                    <th className="py-3 px-4 font-semibold text-right">Qtd</th>
                    <th className="py-3 px-4 font-semibold text-right">Vl. Tabela</th>
                    <th className="py-3 px-4 font-semibold text-right">Desconto</th>
                    <th className="py-3 px-4 font-semibold text-right">Vl. Aplicado</th>
                    <th className="py-3 px-4 font-semibold text-right">Custo Unit.</th>
                    <th className="py-3 px-4 font-semibold text-right">Margem</th>
                    <th className="py-3 px-4 font-semibold text-right">Estoque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D2A26]/60 text-xs text-[#F5F5F0]">
                  {salesRows.map((row) => (
                    <tr key={row.productId} className="hover:bg-[#1C1916] transition-colors">
                      <td className="py-3 px-4 font-medium">{row.productName}</td>
                      <td className="py-3 px-4 text-stone-400">{row.category}</td>
                      <td className="py-3 px-4 text-right font-semibold">{row.quantitySold}</td>
                      <td className="py-3 px-4 text-right text-stone-300">{fmtBRL(row.catalogTotal)}</td>
                      <td className="py-3 px-4 text-right text-amber-400">
                        {row.discountTotal > 0 ? `- ${fmtBRL(row.discountTotal)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-[#F5F5F0]">
                        {fmtBRL(row.appliedTotal)}
                      </td>
                      <td className="py-3 px-4 text-right text-stone-400">{fmtBRL(row.unitCost)}</td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-medium">
                        {row.marginPct}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            row.isCriticalStock
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : 'bg-[#0E0C0A] text-stone-300 border border-[#2D2A26]'
                          }`}
                        >
                          {row.currentStock} un
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#141210] border border-[#2D2A26] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2D2A26] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F5F5F0]">
              Catálogo & Posição Atual de Estoque
            </h3>
            <span className="text-xs text-stone-400">{filteredCatalog.length} item(ns)</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Carregando catálogo...</div>
          ) : filteredCatalog.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              Nenhum produto encontrado para o filtro selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2D2A26] bg-[#0E0C0A] text-[10px] uppercase tracking-wider text-[#B88A44]">
                    <th className="py-3 px-4 font-semibold">Produto</th>
                    <th className="py-3 px-4 font-semibold">Categoria</th>
                    <th className="py-3 px-4 font-semibold">Fornecedor</th>
                    <th className="py-3 px-4 font-semibold text-right">Custo Unit.</th>
                    <th className="py-3 px-4 font-semibold text-right">Preço Venda</th>
                    <th className="py-3 px-4 font-semibold text-right">Estoque Atual</th>
                    <th className="py-3 px-4 font-semibold text-right">Estoque Mín.</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D2A26]/60 text-xs text-[#F5F5F0]">
                  {filteredCatalog.map((item) => (
                    <tr key={item.id} className="hover:bg-[#1C1916] transition-colors">
                      <td className="py-3 px-4 font-medium">{item.name}</td>
                      <td className="py-3 px-4 text-stone-400">{item.category}</td>
                      <td className="py-3 px-4 text-stone-400">{item.supplierName}</td>
                      <td className="py-3 px-4 text-right text-stone-300">{fmtBRL(item.costPrice)}</td>
                      <td className="py-3 px-4 text-right font-medium">{fmtBRL(item.price)}</td>
                      <td className="py-3 px-4 text-right font-semibold">{item.stockQuantity}</td>
                      <td className="py-3 px-4 text-right text-stone-400">{item.minStock}</td>
                      <td className="py-3 px-4 text-center">
                        {item.isCriticalStock ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                            Crítico / Repor
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
