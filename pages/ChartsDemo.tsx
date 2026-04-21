import React from 'react';
import { ModernGaugeChart } from '../components/charts/ModernGaugeChart';
import { ProgressRings, SingleProgressRing } from '../components/charts/ProgressRings';
import { ModernDonutChart, DonutLegend } from '../components/charts/ModernDonutChart';

const COLORS = {
  primary: '#3B82F6',
  emerald: '#10B981',
  amber: '#F59E0B',
  rose: '#F43F5E',
  violet: '#8B5CF6',
  cyan: '#06B6D4',
};

const ChartsDemo: React.FC = () => {
  const serviceData = [
    { value: 45, label: 'Corte Masculino', color: COLORS.primary },
    { value: 28, label: 'Barba', color: COLORS.violet },
    { value: 18, label: 'Sobrancelha', color: COLORS.emerald },
    { value: 9, label: 'Hidratação', color: COLORS.amber },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F0F11] p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Novos Gráficos SMG Barber
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Design inspirado em dashboards modernos - Behance Design
          </p>
        </div>

        {/* KPIs com Gauges */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">speed</span>
            Gauge Charts (Medidores)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <div className="flex justify-center">
                <ModernGaugeChart
                  value={78}
                  label="Ocupação"
                  color={COLORS.primary}
                  size={140}
                  strokeWidth={14}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <div className="flex justify-center">
                <ModernGaugeChart
                  value={92}
                  label="Conversão"
                  color={COLORS.emerald}
                  size={140}
                  strokeWidth={14}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <div className="flex justify-center">
                <ModernGaugeChart
                  value={65}
                  label="Retorno"
                  color={COLORS.violet}
                  size={140}
                  strokeWidth={14}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <div className="flex justify-center">
                <ModernGaugeChart
                  value={45}
                  label=" Avaliação"
                  color={COLORS.amber}
                  size={140}
                  strokeWidth={14}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Progress Rings */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">track_changes</span>
            Progress Rings (Anéis de Progresso)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-8 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">
                Metas Mensais
              </h3>
              <div className="flex justify-center">
                <ProgressRings
                  rings={[
                    { value: 85, max: 100, color: COLORS.primary, label: 'Receita' },
                    { value: 72, max: 100, color: COLORS.emerald, label: 'Clientes' },
                    { value: 60, max: 100, color: COLORS.violet, label: 'Serviços' },
                  ]}
                  size={200}
                  strokeWidth={14}
                  gap={10}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-8 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">
                Indicadores Individuais
              </h3>
              <div className="flex justify-around">
                <SingleProgressRing
                  value={90}
                  color={COLORS.primary}
                  size={100}
                  label="Ativos"
                />
                <SingleProgressRing
                  value={65}
                  color={COLORS.emerald}
                  size={100}
                  label="Novos"
                />
                <SingleProgressRing
                  value={45}
                  color={COLORS.amber}
                  size={100}
                  label="Retorno"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Donut Chart */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">donut_large</span>
            Donut Chart (Distribuição)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-8 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">
                Serviços Mais Populares
              </h3>
              <div className="flex justify-center">
                <ModernDonutChart
                  data={serviceData}
                  size={220}
                  strokeWidth={36}
                  centerValue="127"
                  centerLabel="Total"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-[#1A1A1D] rounded-3xl p-8 shadow-lg shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-[#262A33]">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                Legenda
              </h3>
              <DonutLegend data={serviceData} />
            </div>
          </div>
        </section>

        {/* Combined Dashboard Preview */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">dashboard</span>
            Preview: Dashboard-style Layout
          </h2>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center">
                <ModernGaugeChart
                  value={82}
                  size={110}
                  strokeWidth={10}
                  color={COLORS.emerald}
                  showPercentage
                />
                <p className="text-slate-300 text-sm mt-2">Ocupação</p>
              </div>
              <div className="text-center">
                <ModernGaugeChart
                  value={156}
                  max={200}
                  size={110}
                  strokeWidth={10}
                  color={COLORS.primary}
                  showPercentage
                />
                <p className="text-slate-300 text-sm mt-2">Clientes</p>
              </div>
              <div className="text-center">
                <ModernGaugeChart
                  value={2450}
                  max={5000}
                  size={110}
                  strokeWidth={10}
                  color={COLORS.violet}
                  showPercentage
                />
                <p className="text-slate-300 text-sm mt-2">Faturamento</p>
              </div>
              <div className="text-center">
                <ModernGaugeChart
                  value={4.8}
                  max={5}
                  size={110}
                  strokeWidth={10}
                  color={COLORS.amber}
                  showPercentage
                />
                <p className="text-slate-300 text-sm mt-2">Avaliação</p>
              </div>
            </div>
            
            <div className="flex justify-center">
              <ProgressRings
                rings={[
                  { value: 78, color: COLORS.primary, label: 'Meta' },
                  { value: 65, color: COLORS.emerald, label: 'Real' },
                  { value: 45, color: COLORS.amber, label: 'Cresc.' },
                ]}
                size={140}
                strokeWidth={10}
                gap={6}
              />
            </div>
          </div>
        </section>

        {/* Back button */}
        <div className="text-center pt-8">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};

export default ChartsDemo;