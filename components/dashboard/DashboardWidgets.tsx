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
    `Olá, ${firstName}! Aqui é da ${businessName}. Faz um tempo que você não aparece por aqui. Que tal agendar seu próximo atendimento essa semana?`,
  );
  return `https://wa.me/55${digits}?text=${msg}`;
};

const WidgetLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="mt-4 inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-primary-dark"
  >
    {children}
    <span className="material-symbols-outlined text-sm">arrow_forward</span>
  </Link>
);

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
  const gridClassName = isEsteticaApp
    ? 'grid grid-cols-1 gap-4 md:grid-cols-3'
    : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4';

  if (loading) {
    return (
      <div className={gridClassName}>
        {(isEsteticaApp ? [1, 2, 3] : [1, 2, 3, 4]).map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-card p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-1/2 rounded bg-gold-pale" />
              <div className="h-8 w-3/4 rounded bg-gold-pale" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClassName}>
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark">psychology</span>
          <h4 className="text-sm font-bold text-ink">{isEsteticaApp ? 'Clientes para retorno' : 'Retorno inteligente'}</h4>
        </div>

        <p className="text-2xl font-black text-ink">{returningClients.length}</p>
        <p className="text-xs text-ink-soft">
          {returningClients.length === 1 ? 'cliente para retorno' : 'clientes para retorno'}
        </p>

        <div className="mt-3 border-t border-line pt-3">
          {returningClients.length > 0 ? (
            <div className="max-h-24 space-y-2 overflow-y-auto">
              {returningClients.slice(0, 3).map((client) => {
                const waUrl = buildWhatsAppUrl(client, businessName);
                return (
                  <div key={client.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-ink-soft">{client.name}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-[10px] text-ink-soft">{client.daysSinceVisit}d</span>
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-success/10 text-success transition hover:bg-success/20"
                          title={`Enviar WhatsApp para ${client.name}`}
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 text-slate-300"
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
            <p className="text-xs italic text-ink-soft">{isEsteticaApp ? 'Nenhum cliente para retorno agora.' : 'Nenhum cliente para retorno agora.'}</p>
          )}
        </div>

        <WidgetLink to="/smart-return">Ver lista completa</WidgetLink>
      </div>

      {!isEsteticaApp && (
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500">cake</span>
          <h4 className="text-sm font-bold text-ink">Aniversários</h4>
        </div>

        <p className="text-2xl font-black text-ink">{birthdaysToday.length}</p>
        <p className="text-xs text-ink-soft">aniversariantes hoje</p>
        {birthdaysTomorrow.length > 0 && (
          <p className="mt-2 text-xs font-bold text-success">
            +{birthdaysTomorrow.length} amanhã
          </p>
        )}

        {birthdaysToday.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-line pt-3">
            {birthdaysToday.slice(0, 3).map((name) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="text-ink-soft">{name}</span>
              </div>
            ))}
          </div>
        )}

        <WidgetLink to="/clients">Ver clientes</WidgetLink>
      </div>
      )}

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark">groups</span>
          <h4 className="text-sm font-bold text-ink">{isEsteticaApp ? 'Profissionais da unidade' : 'Equipe na casa'}</h4>
        </div>

        <p className="text-2xl font-black text-ink">
          {activeTeam}<span className="text-ink-soft">/{totalTeam}</span>
        </p>
        <p className="text-xs text-ink-soft">{professionalPluralLabel.toLowerCase()} ativos</p>

        <div className="mt-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {teamStatus.map((member) => (
              <span
                key={member.id}
                className={`h-3 w-3 rounded-full ${member.active ? 'bg-success' : 'bg-slate-300'}`}
                title={member.name}
              />
            ))}
          </div>
        </div>

        <WidgetLink to="/team">{isEsteticaApp ? 'Ver profissionais' : 'Ver equipe'}</WidgetLink>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark">group</span>
          <h4 className="text-sm font-bold text-ink">Base de {clientPluralLabel.toLowerCase()}</h4>
        </div>

        <p className="text-2xl font-black text-ink">{totalClients}</p>
        <p className="text-xs text-ink-soft">
          {totalClients === 1 ? `${clientLabel.toLowerCase()} cadastrado` : `${clientPluralLabel.toLowerCase()} cadastrados`}
        </p>

        <div className="mt-3 rounded-xl bg-gold-pale p-3 text-xs font-medium leading-5 text-ink-soft">
          {isEsteticaApp
            ? 'Cadastros alimentam agenda, atendimentos e retornos.'
            : 'Cadastros alimentam agenda, comanda, retorno inteligente e Club dos Chefes.'}
        </div>

        <WidgetLink to="/clients">Ver {clientPluralLabel.toLowerCase()}</WidgetLink>
      </div>
    </div>
  );
};

export default DashboardWidgets;