/**
 * [SMG][COMPONENT] UpgradePrompt — fallback do FeatureGuard (6.0.5.5).
 *
 * D-6.0.5.3-5: UI híbrida — `FeatureGuard` renderiza este prompt quando a
 * flag EFETIVA do tenant (`can(feature)`) é falsa (plano atual não inclui o
 * recurso). Nunca um 403 genérico — sempre orienta o upgrade (D-6.0.5.3-5).
 *
 * D-6.0.5.5-2: entrega de `UpgradePrompt` (fallback do FeatureGuard) com CTA
 * de upgrade que direciona ao estado do plano (`/settings` — Ver Meu Plano).
 * O enforcement REAL continua no backend (RPCs com guarda) — o prompt é
 * conveniência de UI e NUNCA derruba/libera acesso por conta própria
 * (Estado Efetivo 6.0.5.1 continua autoridade).
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../Logo';
import type { FeatureKey } from '../../domain/billing/featureKey';

interface FeatureMeta {
  title: string;
  description: string;
  icon: string;
}

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  appointments: { title: 'Agenda', description: 'Agenda de agendamentos', icon: 'calendar_month' },
  pos: { title: 'PDV', description: 'PDV / Comandas / Checkout', icon: 'point_of_sale' },
  clients: { title: 'Clientes', description: 'Cadastro de clientes', icon: 'group' },
  services: { title: 'Serviços', description: 'Cadastro de serviços', icon: 'content_cut' },
  products: { title: 'Produtos', description: 'Cadastro de produtos', icon: 'inventory_2' },
  team: { title: 'Equipe', description: 'Gestão de equipe', icon: 'groups' },
  dashboard: { title: 'Dashboard', description: 'Dashboard', icon: 'dashboard' },
  finance: { title: 'Financeiro', description: 'Módulo financeiro', icon: 'account_balance_wallet' },
  cash_closing: { title: 'Fechamento de caixa', description: 'Fechamento de caixa', icon: 'lock' },
  commissions: { title: 'Comissões', description: 'Comissões', icon: 'percent' },
  receivables: { title: 'Contas a receber', description: 'Contas a receber', icon: 'request_quote' },
  expenses: { title: 'Contas a pagar', description: 'Contas a pagar', icon: 'event_busy' },
  chef_club: { title: 'Club dos Chefes', description: 'Club dos Chefes (assinaturas)', icon: 'workspace_premium' },
  vouchers: { title: 'Vales-presente', description: 'Vales-presente', icon: 'card_giftcard' },
  promotions: { title: 'Promoções', description: 'Promoções', icon: 'local_offer' },
  api: { title: 'API REST', description: 'API REST externa', icon: 'api' },
  whatsapp: { title: 'WhatsApp', description: 'Notificações WhatsApp', icon: 'chat' },
  marketplace: { title: 'Marketplace', description: 'Marketplace de fornecedores', icon: 'storefront' },
  multi_unit: { title: 'Múltiplas unidades', description: 'Múltiplas unidades', icon: 'business' },
  bi: { title: 'Business Intelligence', description: 'Business Intelligence', icon: 'insights' },
};

const UpgradePrompt: React.FC<{ feature: FeatureKey }> = ({ feature }) => {
  const navigate = useNavigate();
  const meta = FEATURE_META[feature];

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-fade-in">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-amber-500">lock</span>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-black text-white tracking-tight">
            {meta.title}
          </h1>
          <p className="text-slate-400 leading-relaxed">
            {meta.description} não está disponível no plano atual da sua conta.
          </p>
        </div>

        <div className="bg-black border border-white/10 rounded-2xl p-6 text-left space-y-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">upgrade</span>
            <div>
              <p className="text-sm font-bold text-white">Faça upgrade do plano</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Fale com o responsável pela conta ou mude de plano para liberar este recurso.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="w-full py-3.5 rounded-xl bg-amber-500 text-black font-black text-sm hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
          >
            Ver Meu Plano
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 rounded-xl bg-white/5 text-slate-400 font-bold text-sm hover:bg-white/10 transition-all border border-white/10"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
