import React from 'react';
import { Link } from 'react-router-dom';
import type { ReturningClient } from '../../src/modules/dashboard/types';

function buildWhatsAppUrl(client: ReturningClient): string | null {
  if (!client.phone) return null;
  const digits = client.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return null;
  const firstName = client.name.split(' ')[0];
  const msg = encodeURIComponent(
    `Olá, ${firstName}! Aqui é da Sanchez Barber. Faz um tempinho que você não aparece por aqui. Que tal agendar seu próximo atendimento essa semana?`
  );
  return `https://wa.me/55${digits}?text=${msg}`;
}

interface DashboardWidgetsProps {
  returningClients: ReturningClient[];
  birthdaysToday: string[];
  birthdaysTomorrow: string[];
  teamStatus: { id: string; name: string; active: boolean }[];
  loading?: boolean;
  totalClients?: number;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  returningClients,
  birthdaysToday,
  birthdaysTomorrow,
  teamStatus,
  loading,
  totalClients = 0,
}) => {
  const activeTeam = teamStatus.filter((t) => t.active).length;
  const totalTeam = teamStatus.length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-purple-500">psychology</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Retorno Inteligente</h4>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {returningClients.length}
          </p>
          <p className="text-xs text-slate-500">
            {returningClients.length === 1 ? 'cliente para retorno' : 'clientes para retorno'}
          </p>
        </div>

        {returningClients.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="space-y-1.5 max-h-20 overflow-y-auto">
              {returningClients.slice(0, 3).map((client) => {
                const waUrl = buildWhatsAppUrl(client);
                return (
                  <div key={client.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-slate-600 dark:text-slate-300 truncate">{client.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-400 text-[10px]">{client.daysSinceVisit}d</span>
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                          title={`Enviar WhatsApp para ${client.name}`}
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>
                      ) : (
                        <span
                          className="text-slate-300 dark:text-slate-600 cursor-not-allowed"
                          title="Sem telefone cadastrado"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 italic">Nenhum cliente para retorno</p>
          </div>
        )}

        <Link
          to="/smart-return"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
        >
          Ver lista completa →
        </Link>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-pink-500">cake</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Aniversários</h4>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {birthdaysToday.length}
          </p>
          <p className="text-xs text-slate-500">aniversariantes hoje</p>
          {birthdaysTomorrow.length > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              +{birthdaysTomorrow.length} amanhã
            </p>
          )}
        </div>

        {birthdaysToday.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="space-y-1">
              {birthdaysToday.slice(0, 3).map((name, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-slate-600 dark:text-slate-300">{name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/clients"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
        >
          Ver todos →
        </Link>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-blue-500">groups</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Status Equipe</h4>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {activeTeam}<span className="text-slate-400">/{totalTeam}</span>
          </p>
          <p className="text-xs text-slate-500">profissionais ativos</p>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            {teamStatus.map((member) => (
              <div
                key={member.id}
                className={`w-3 h-3 rounded-full ${
                  member.active
                    ? 'bg-emerald-500'
                    : 'bg-slate-200 dark:bg-slate-600'
                }`}
                title={member.name}
              />
            ))}
          </div>
        </div>

        <Link
          to="/team"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
        >
          Ver equipe →
        </Link>
      </div>

      <div className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-blue-500">group</span>
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Base de clientes</h4>
        </div>

        <div className="space-y-2">
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {totalClients}
          </p>
          <p className="text-xs text-slate-500">
            {totalClients === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
          </p>
        </div>

        <Link
          to="/clients"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-blue-600 transition-colors"
        >
          Ver clientes →
        </Link>
      </div>
    </div>
  );
};

export default DashboardWidgets;