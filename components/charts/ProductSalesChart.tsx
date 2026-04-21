import React from 'react';
import { SparkLineChart } from './SparkLineChart';

interface ProductSale {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  trendData?: number[];
  category?: string;
}

interface ProductSalesChartProps {
  data: ProductSale[];
  title?: string;
  showTrend?: boolean;
}

const DEFAULT_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
  '#06B6D4', '#EF4444', '#A78BFA', '#F97316', '#84CC16'
];

export const ProductSalesChart: React.FC<ProductSalesChartProps> = ({
  data,
  title = 'Vendas de Produtos',
  showTrend = true,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  const chartData = data.map((item, index) => ({
    ...item,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    percentage: (item.revenue / maxRevenue) * 100,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-pink-500">shopping_bag</span>
          {title}
        </h3>
        <span className="text-xs text-slate-400">
          {data.reduce((acc, p) => acc + p.quantity, 0)} unidades
        </span>
      </div>

      {/* Product List */}
      <div className="space-y-3">
        {chartData.map((product, index) => (
          <div 
            key={product.id}
            className="group relative overflow-hidden rounded-xl bg-slate-50 dark:bg-white/5 p-3 transition-all hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <div className="flex items-center gap-3">
              {/* Rank */}
              <div className={`
                size-6 rounded-lg flex items-center justify-center text-xs font-black
                ${index < 3 
                  ? 'bg-gradient-to-br from-primary to-primary/70 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
              `}>
                {index + 1}
              </div>

              {/* Product Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                      {product.name}
                    </h4>
                    {product.category && (
                      <p className="text-[10px] text-slate-400">{product.category}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatCurrency(product.revenue)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {product.quantity}× R$ {(product.revenue / product.quantity).toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${product.percentage}%`,
                        backgroundColor: product.color,
                      }}
                    />
                  </div>
                </div>

                {/* Sparkline Trend */}
                {showTrend && product.trendData && product.trendData.length > 0 && (
                  <div className="mt-2">
                    <SparkLineChart 
                      data={product.trendData}
                      color={product.color}
                      width={120}
                      height={20}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
          <p className="text-sm">Sem vendas de produtos no período</p>
        </div>
      )}
    </div>
  );
};

export default ProductSalesChart;