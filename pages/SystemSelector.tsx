import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import type { AppSlug } from '../src/lib/supabase/schemas';
import { ACCESS_APPS } from '../src/lib/apps/catalog';
import { buildAppUrl, getPublicHostnameForApp, isInstitutionalHostname } from '../src/lib/apps/publicUrl';

const SystemSelector: React.FC = () => {
  const navigate = useNavigate();
  const { loading, session, memberships, tenant, signOut, isSuperAdmin } = useAuth();

  const institutionalHost = isInstitutionalHostname(window.location.hostname);

  const accessibleApps = React.useMemo(() => {
    if (isSuperAdmin) {
      return new Set<AppSlug>(ACCESS_APPS.map((app) => app.slug));
    }

    const mappedApps = memberships
      .map((membership) => membership.tenant?.app_slug)
      .filter((appSlug): appSlug is AppSlug => Boolean(appSlug));

    if (mappedApps.length > 0) {
      return new Set<AppSlug>(mappedApps);
    }

    return new Set<AppSlug>(tenant?.app_slug ? [tenant.app_slug] : []);
  }, [isSuperAdmin, memberships, tenant?.app_slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0B10] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!institutionalHost) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleOpenApp = (appSlug: AppSlug) => {
    if (!accessibleApps.has(appSlug)) {
      return;
    }

    window.location.assign(buildAppUrl(appSlug));
  };

  return (
    <div className="min-h-screen bg-[#0A0B10] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(190,129,75,0.22),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),_transparent_32%)]" />

      <div className="relative max-w-6xl mx-auto px-6 py-8 sm:py-12">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size="lg" />
            <p className="mt-4 text-xs font-black uppercase tracking-[0.22em] text-primary/80">
              SMG - Sou.Manager
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-bold text-slate-200 hover:bg-white/5 transition-colors"
            >
              Voltar para o site
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 rounded-xl bg-white text-[#0A0B10] text-sm font-black hover:bg-slate-100 transition-colors"
            >
              Sair
            </button>
          </div>
        </header>

        <section className="mt-12 max-w-3xl">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/25 bg-primary/10 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
            Escolha o sistema
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl font-black tracking-tight">
            Entrada central, operacao desacoplada
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            O dominio principal <span className="font-bold text-white">soumanager.com</span> representa a marca SMG,
            o portal principal e o acesso central da plataforma. Os sistemas operacionais rodam em subdominios
            dedicados para garantir clareza, seguranca e escala.
          </p>
        </section>

        <section className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {ACCESS_APPS.map((app) => {
            const hasAccess = accessibleApps.has(app.slug);
            const isComingSoon = app.status === 'coming-soon';
            const disabled = !hasAccess || isComingSoon;

            return (
              <article
                key={app.slug}
                className={`rounded-[2rem] border p-6 transition-all ${
                  disabled
                    ? 'border-white/10 bg-white/[0.03]'
                    : 'border-primary/30 bg-gradient-to-br from-[#171310] to-[#111827] shadow-2xl shadow-black/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/80">
                      {app.shortName}
                    </p>
                    <h2 className="mt-3 text-2xl font-black">{app.name}</h2>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.16em] ${
                      isComingSoon
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                        : hasAccess
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
                          : 'bg-slate-500/15 text-slate-300 border border-white/10'
                    }`}
                  >
                    {isComingSoon ? 'Em breve' : hasAccess ? 'Liberado' : 'Sem acesso'}
                  </span>
                </div>

                <p className="mt-5 text-sm text-slate-300 leading-relaxed">{app.description}</p>

                <div className="mt-6 space-y-3 text-sm text-slate-400">
                  <p>
                    <span className="font-bold text-slate-200">Uso:</span> {app.audience}
                  </p>
                  <p>
                    <span className="font-bold text-slate-200">URL:</span> {getPublicHostnameForApp(app.slug)}
                  </p>
                </div>

                <button
                  onClick={() => handleOpenApp(app.slug)}
                  disabled={disabled}
                  className={`mt-8 w-full rounded-2xl px-5 py-4 text-sm font-black transition-all ${
                    disabled
                      ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary-light hover:-translate-y-0.5'
                  }`}
                >
                  {isComingSoon ? 'Disponivel em breve' : hasAccess ? `Abrir ${app.shortName}` : 'Acesso indisponivel'}
                </button>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default SystemSelector;
