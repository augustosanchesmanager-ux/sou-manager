import React from 'react';
import { LiquidityOverview } from '../../src/types/business-insights';
import { DollarSign, ArrowDownRight, ArrowUpRight, Percent, Landmark, CheckCircle2 } from 'lucide-react';

interface LiquidityWaterfallCardProps {
  liquidity: LiquidityOverview;
}

export const LiquidityWaterfallCard: React.FC<LiquidityWaterfallCardProps> = ({ liquidity }) => {
  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            DRE Gerencial de Liquidez (Faturamento Bruto $\rightarrow$ Caixa Real)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Visão contábil e de fluxo real, cruzando faturamento bruto de comandas com custos de repasse e tarifas apuradas na conciliação bancária.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Margem Líquida da Barbearia: {liquidity.netMarginPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Cascata / Waterfall Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Faturamento Bruto */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              1. Faturamento Bruto
            </span>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-2">
              {formatBRL(liquidity.grossRevenue)}
            </p>
          </div>
          <span className="text-[10px] text-slate-400 mt-3 block">
            Comandas pagas e serviços prestados no período
          </span>
        </div>

        {/* 2. Repasse de Comissões */}
        <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block flex items-center justify-between">
              <span>2. Comissões da Equipe</span>
              <span className="text-xs font-normal">(-)</span>
            </span>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-2">
              - {formatBRL(liquidity.staffCommissions)}
            </p>
          </div>
          <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-3 block">
            Repasses aos barbeiros conforme taxas e rateio
          </span>
        </div>

        {/* 3. Taxas de Cartão / Adquirência */}
        <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/50 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block flex items-center justify-between">
              <span>3. Taxas & Conciliação</span>
              <span className="text-xs font-normal">(-)</span>
            </span>
            <p className="text-xl font-bold text-rose-900 dark:text-rose-200 mt-2">
              - {formatBRL(liquidity.bankingFees)}
            </p>
          </div>
          <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80 mt-3 block">
            Tarifas bancárias, maquininhas e desconto de antecipação
          </span>
        </div>

        {/* 4. Caixa Líquido Real */}
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/80 dark:border-emerald-600/80 flex flex-col justify-between shadow-sm">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block flex items-center justify-between">
              <span>4. Margem Líquida Real</span>
              <span className="text-xs font-bold">(=)</span>
            </span>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-2">
              {formatBRL(liquidity.netOperatingCash)}
            </p>
          </div>
          <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold mt-3 block">
            Valor retido no caixa efetivo da barbearia
          </span>
        </div>
      </div>

      {/* Régua de Conciliação Bancária Integrada */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span className="text-slate-600 dark:text-slate-300">
            Status da Conciliação de Extratos no Período:
          </span>
        </div>

        <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {liquidity.reconciledCount} lançamentos conferidos
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {liquidity.unreconciledCount} pendentes de extrato
          </span>
        </div>
      </div>
    </div>
  );
};
