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
      <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#F5F5F0]">
            Indicadores do Clube dos Chefes
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">
            Consolidado de assinaturas ativas, consumo de créditos e plano mais popular da unidade.
          </p>
        </div>
        <Award className="w-6 h-6 text-[#B88A44]" />
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-stone-400">
          Carregando indicadores do Clube...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#141210] border border-[#B88A44]/50 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B88A44]">
                Assinaturas Ativas
              </span>
              <Users className="w-4 h-4 text-[#B88A44]" />
            </div>
            <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">
              {stats.activeSubscriptions}
            </div>
            <div className="mt-1 text-xs text-stone-400">Clientes recorrentes ativos</div>
          </div>

          <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Créditos Disponíveis
              </span>
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-emerald-400">
              {stats.totalCreditsAvailable}
            </div>
            <div className="mt-1 text-xs text-stone-500">Saldo atual de serviços em aberto</div>
          </div>

          <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Créditos Utilizados
              </span>
              <Award className="w-4 h-4 text-stone-400" />
            </div>
            <div className="mt-3 text-2xl font-bold text-[#F5F5F0]">
              {stats.totalCreditsUsed}
            </div>
            <div className="mt-1 text-xs text-stone-500">Total consumido pelos assinantes</div>
          </div>

          <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Plano Mais Popular
              </span>
              <Sparkles className="w-4 h-4 text-[#B88A44]" />
            </div>
            <div className="mt-3 text-lg font-bold text-[#F5F5F0] truncate">
              {stats.popularPlan || 'Nenhum plano'}
            </div>
            <div className="mt-1 text-xs text-stone-500">Maior base de assinantes ativos</div>
          </div>
        </div>
      )}
    </div>
  );
};
