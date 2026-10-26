import React from 'react';
import { Link } from 'react-router-dom';
import type { ReturningClient } from '../../src/modules/dashboard/types';

interface DashboardWidgetsProps {
  appSlug?: string | null;
  returningClients: ReturningClient[];
  birthdaysToday: string[];
  birthdaysTomorrow: string[];
  teamStatus: { id: string; name: string; active: boolean }[];
  loading?: boolean;
  totalClients?: number;
  businessName?: string;
  clientLabel?: string;
  clientPluralLabel?: string;
  professionalPluralLabel?: string;
}

const buildWhatsAppUrl = (client: ReturningClient, businessName: string): string | null => {
  if (!client.phone) return null;
  const digits = client.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) return null;
  const firstName = client.name.split(' ')[0];
  const msg = encodeURIComponent(
    `Olá, ${firstName}! Aqui é da ${businessName}. Que tal agendar seu próximo horário essa semana?`,
  );
  return `https://wa.me/55${digits}?text=${msg}`;
};

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({
  appSlug,
  returningClients,
  birthdaysToday,
  birthdaysTomorrow,
  teamStatus,
  loading,
  totalClients = 0,
  businessName = 'sua unidade',
  clientLabel = 'Cliente',
  clientPluralLabel = 'Clientes',
  professionalPluralLabel = 'profissionais',
}) => {
  const isEsteticaApp = appSlug === 'estetica';
  const activeTeam = teamStatus.filter((t) => t.active).length;
  const totalTeam = teamStatus.length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-1/2 rounded bg-line dark:bg-border-dark" />
              <div className="h-8 w-3/4 rounded bg-line dark:bg-border-dark" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 1. Retorno Inteligente com Ação de 1 Toque */}
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-4 sm:p-5 shadow-sm transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">person_search</span>
              <h4 className="font-display font-bold text-sm text-ink dark:text-white">
                {isEsteticaApp ? 'Clientes para retorno' : 'Retorno inteligente'}
              </h4>
            </div>
            <span className="font-display font-bold tabular-nums text-xs text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              {returningClients.length} sugeridos
            </span>
          </div>

          <div className="mt-3 divide-y divide-line dark:divide-border-dark">
            {returningClients.length > 0 ? (
              returningClients.slice(0, 3).map((client) => {
                const waUrl = buildWhatsAppUrl(client, businessName);
                return (
                  <div key={client.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink dark:text-white truncate">{client.name}</p>
                      <p className="text-[11px] text-ink-soft">há {client.daysSinceVisit} dias sem visita</p>
                    </div>

                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success/10 text-success text-[11px] font-bold hover:bg-success/20 transition-all shrink-0 active:scale-95"
                        title={`Enviar WhatsApp para ${client.name}`}
                        aria-label={`Enviar WhatsApp para ${client.name}`}
                      >
                        <span className="material-symbols-outlined text-xs">chat</span>
                        <span>Avisar</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-ink-soft/50 italic">sem telefone</span>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="py-4 text-xs italic text-ink-soft text-center">Nenhum cliente para retorno hoje.</p>
            )}
          </div>
        </div>

        <Link
          to="/smart-return"
          className="mt-3 pt-3 border-t border-line dark:border-border-dark inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark transition-colors"
        >
          <span>Ver todos os retornos</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      {/* 2. Equipe na Casa / Presença em Tempo Real */}
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-4 sm:p-5 shadow-sm transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">groups</span>
              <h4 className="font-display font-bold text-sm text-ink dark:text-white">
                {isEsteticaApp ? 'Profissionais da unidade' : 'Equipe na casa'}
              </h4>
            </div>
            <span className="font-display font-bold tabular-nums text-xs text-ink dark:text-white px-2 py-0.5 rounded-full bg-card dark:bg-surface-dark border border-line dark:border-border-dark">
              {activeTeam}/{totalTeam} ativos
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Profissionais da equipe">
              {teamStatus.map((member) => (
                <div
                  key={member.id}
                  role="listitem"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line dark:border-border-dark bg-card dark:bg-surface-dark text-xs"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${member.active ? 'bg-success animate-pulse' : 'bg-line dark:bg-border-dark'}`}
                  />
                  <span className="font-medium text-ink dark:text-white">{member.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>

            {birthdaysToday.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-line dark:border-border-dark flex items-center gap-1.5 text-xs text-primary font-semibold">
                <span className="material-symbols-outlined text-sm">cake</span>
                <span>Aniversariante hoje: {birthdaysToday.join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        <Link
          to="/team"
          className="mt-3 pt-3 border-t border-line dark:border-border-dark inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark transition-colors"
        >
          <span>{isEsteticaApp ? 'Ver profissionais' : 'Ver equipe'}</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      {/* 3. Base de Clientes & Fidelidade */}
      <div className="rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-4 sm:p-5 shadow-sm transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">group</span>
              <h4 className="font-display font-bold text-sm text-ink dark:text-white">
                Base de {clientPluralLabel.toLowerCase()}
              </h4>
            </div>
            <span className="font-display font-bold tabular-nums text-xs text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              {totalClients} {clientPluralLabel.toLowerCase()}
            </span>
          </div>

          <p className="mt-3 font-display text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-ink dark:text-white">
            {totalClients}
          </p>
          <p className="text-xs text-ink-soft mt-1">
            {isEsteticaApp
              ? 'Cadastros ativos na clínica.'
              : 'Clientes cadastrados na barbearia e clube de assinaturas.'}
          </p>
        </div>

        <Link
          to="/clients"
          className="mt-3 pt-3 border-t border-line dark:border-border-dark inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark transition-colors"
        >
          <span>Ver lista de {clientPluralLabel.toLowerCase()}</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
};

export default DashboardWidgets;
