import React from 'react';
import { Link } from 'react-router-dom';
import type { ReturningClient } from '../../src/modules/dashboard/types';

interface DashboardWidgetsProps {
  returningClients: ReturningClient[];
  birthdaysToday: string[];
  birthdaysTomorrow: string[];
  teamStatus: { id: string; name: string; active: boolean }[];
  loading?: boolean;
  totalClients?: number;
  businessName?: string;
}

const buildWhatsAppUrl = (client: ReturningClient, businessName: string): string | null => {
  if (!client.phone) return null;
  const digits = client.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return null;
  const firstName = client.name.split(' ')[0];
  const msg = encodeURIComponent(
    `Olá, ${firstName}! Aqui é da ${businessName}. Faz um tempo que você não aparece por aqui. Que tal agendar seu próximo atendimento essa semana?`,
  );
  return `https://wa.me/55${digits}?text=${msg}`;
};

const WidgetLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="mt-4 inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-blue-600"
  >
    {children}
    <span className="material-symbols-outlined text-sm">arrow_forward</span>
  </Link>
);

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  returningClients,
  birthdaysToday,
  birthdaysTomorrow,
  teamStatus,
  loading,
  totalClients = 0,
  businessName = 'sua barbearia',
}) => {
  const activeTeam = teamStatus.filter((t) => t.active).length;
  const totalTeam = teamStatus.length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-8 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#007BFF]">psychology</span>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Retorno inteligente</h4>
        </div>

        <p className="text-2xl font-black text-slate-900 dark:text-white">{returningClients.length}</p>
        <p className="text-xs text-slate-500">
          {returningClients.length === 1 ? 'cliente para reativar' : 'clientes para reativar'}
        </p>

        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          {returningClients.length > 0 ? (
            <div className="max-h-24 space-y-2 overflow-y-auto">
              {returningClients.slice(0, 3).map((client) => {
                const waUrl = buildWhatsAppUrl(client, businessName);
                return (
                  <div key={client.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-600 dark:text-slate-300">{client.name}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">{client.daysSinceVisit}d</span>
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/25 dark:text-emerald-300"
                          title={`Enviar WhatsApp para ${client.name}`}
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600"
                          title="Sem telefone cadastrado"
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs italic text-slate-400">Nenhum cliente para retorno agora.</p>
          )}
        </div>

        <WidgetLink to="/smart-return">Ver lista completa</WidgetLink>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500">cake</span>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Aniversários</h4>
        </div>

        <p className="text-2xl font-black text-slate-900 dark:text-white">{birthdaysToday.length}</p>
        <p className="text-xs text-slate-500">aniversariantes hoje</p>
        {birthdaysTomorrow.length > 0 && (
          <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            +{birthdaysTomorrow.length} amanhã
          </p>
        )}

        {birthdaysToday.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-700">
            {birthdaysToday.slice(0, 3).map((name) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-300">{name}</span>
              </div>
            ))}
          </div>
        )}

        <WidgetLink to="/clients">Ver clientes</WidgetLink>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#00D2FF]">groups</span>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Equipe na casa</h4>
        </div>

        <p className="text-2xl font-black text-slate-900 dark:text-white">
          {activeTeam}<span className="text-slate-400">/{totalTeam}</span>
        </p>
        <p className="text-xs text-slate-500">profissionais ativos</p>

        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-1.5">
            {teamStatus.map((member) => (
              <span
                key={member.id}
                className={`h-3 w-3 rounded-full ${member.active ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                title={member.name}
              />
            ))}
          </div>
        </div>

        <WidgetLink to="/team">Ver equipe</WidgetLink>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-[#1A1A1A]">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#E5A158]">group</span>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Base de clientes</h4>
        </div>

        <p className="text-2xl font-black text-slate-900 dark:text-white">{totalClients}</p>
        <p className="text-xs text-slate-500">
          {totalClients === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
        </p>

        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
          Cadastros alimentam agenda, comanda, retorno inteligente e Clube do Chefe.
        </div>

        <WidgetLink to="/clients">Ver clientes</WidgetLink>
      </div>
    </div>
  );
};

export default DashboardWidgets;
