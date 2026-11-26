import React from 'react';
import { Award, Users, CreditCard, Sparkles } from 'lucide-react';

interface ChefClubStats {
  activeSubscriptions: number;
  totalCreditsAvailable: number;
  totalCreditsUsed: number;
  popularPlan: string | null;
}

interface ReportsChefClubTabProps {
  stats: ChefClubStats;
  loading: boolean;
}

export const ReportsChefClubTab: React.FC<ReportsChefClubTabProps> = ({ stats, loading }) => {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-line rounded-xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Indicadores do Clube dos Chefes
          </h3>
          <p className="text-xs text-ink-soft mt-0.5">
            Consolidado de assinaturas ativas, consumo de créditos e plano mais popular da unidade.
          </p>
        </div>
        <Award className="w-6 h-6 text-primary-dark dark:text-primary" />
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-ink-soft">
          Carregando indicadores do Clube...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-card border border-primary/50 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary-dark dark:text-primary">
                Assinaturas Ativas
              </span>
              <Users className="w-4 h-4 text-primary-dark dark:text-primary" />
            </div>
            <div className="mt-3 text-2xl font-bold text-ink">
              {stats.activeSubscriptions}
            </div>
            <div className="mt-1 text-xs text-ink-soft">Clientes recorrentes ativos</div>
          </div>

          <div className="bg-card border border-line rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Créditos Disponíveis
              </span>
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-emerald-400">
              {stats.totalCreditsAvailable}
            </div>
            <div className="mt-1 text-xs text-ink-soft">Saldo atual de serviços em aberto</div>
          </div>

          <div className="bg-card border border-line rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Créditos Utilizados
              </span>
              <Award className="w-4 h-4 text-ink-soft" />
            </div>
            <div className="mt-3 text-2xl font-bold text-ink">
              {stats.totalCreditsUsed}
            </div>
            <div className="mt-1 text-xs text-ink-soft">Total consumido pelos assinantes</div>
          </div>

          <div className="bg-card border border-line rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Plano Mais Popular
              </span>
              <Sparkles className="w-4 h-4 text-primary-dark dark:text-primary" />
            </div>
            <div className="mt-3 text-lg font-bold text-ink truncate">
              {stats.popularPlan || 'Nenhum plano'}
            </div>
            <div className="mt-1 text-xs text-ink-soft">Maior base de assinantes ativos</div>
          </div>
        </div>
      )}
    </div>
  );
};
