import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../services/supabaseClient';
import { teamInvitationService } from '../application/teamInvitation';
import { useAuth } from '../context/AuthContext';
import type { InvitePublic } from '../domain/invitation/types';

const ROLE_LABELS: Record<string, string> = {
  barber: 'Barbeiro',
  receptionist: 'Recepcionista',
};

const AcceptInvite: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, refreshAccessContext, refreshTenant } = useAuth();

  const [invite, setInvite] = useState<InvitePublic | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const loadInvite = useCallback(async () => {
    setLoadingInvite(true);
    setLoadError(null);
    try {
      const data = await teamInvitationService.getByToken(token);
      setInvite(data);
      if (!data) setLoadError('Convite não encontrado.');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar convite.');
    } finally {
      setLoadingInvite(false);
    }
  }, [token]);

  useEffect(() => { loadInvite(); }, [loadInvite]);

  const finishAcceptance = useCallback(async (first: string, last: string) => {
    const result = await teamInvitationService.accept(token, first, last);
    setAccepted(true);
    await refreshAccessContext();
    await refreshTenant();
    navigate(`/dashboard?welcome=${result.role}`, { replace: true });
  }, [navigate, refreshAccessContext, refreshTenant, token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError('Informe seu nome completo.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setNeedsEmailConfirmation(false);

    try {
      if (!session) {
        if (!password || password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres.');
          setSubmitting(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: invite.email,
          password,
          options: {
            data: { first_name: firstName, last_name: lastName },
            emailRedirectTo: `${window.location.origin}/#/accept-invite/${token}`,
          },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setNeedsEmailConfirmation(true);
          return;
        }
      }

      await finishAcceptance(firstName, lastName);
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Erro ao aceitar o convite.';
      if (msg.includes('expired')) msg = 'Este convite expirou.';
      else if (msg.includes('already linked') || msg.includes('already a member')) {
        msg = 'Sua conta já está vinculada a outra empresa. Entre em contato com o gerente.';
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const inviteInvalid = !invite || invite.status !== 'pending' || new Date(invite.expiresAt) < new Date();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 transition-colors duration-300">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl shadow-sm p-8">
          {loadError || inviteInvalid ? (
            <>
              <div className="size-14 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-amber-500 text-3xl">link_off</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Convite indisponível</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                {loadError || 'Este convite não está mais ativo. Peça um novo convite ao gerente da sua equipe.'}
              </p>
              <Link to="/" className="block text-center text-sm font-bold text-primary hover:underline">
                Voltar ao início
              </Link>
            </>
          ) : accepted ? (
            <>
              <div className="size-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Convite aceito!</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                Bem-vindo(a) à equipe. Redirecionando para o seu painel...
              </p>
            </>
          ) : needsEmailConfirmation ? (
            <>
              <div className="size-14 rounded-2xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-sky-500 text-3xl">mark_email_read</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-2">Confirme seu e-mail</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                Enviamos um link de confirmação para <strong className="text-slate-700 dark:text-slate-200">{invite.email}</strong>.
                Após confirmar, acesse o link do convite novamente para concluir.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Você foi convidado!</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {invite!.tenantName} · {ROLE_LABELS[invite!.role] || invite!.role}
                  </p>
                </div>
              </div>

              {session && (
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#141414] border border-slate-100 dark:border-[#262626] rounded-lg px-3 py-2 mb-4">
                  Conectado como <strong className="text-slate-700 dark:text-slate-200">{session.user.email}</strong>
                </div>
              )}

              <form onSubmit={handleAccept} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome</label>
                    <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="João" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Sobrenome</label>
                    <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="Silva" />
                  </div>
                </div>

                {!session && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Senha</label>
                    <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="Mínimo 6 caracteres" />
                    <p className="text-[10px] text-slate-400 mt-1">Você criará sua conta usando o e-mail do convite.</p>
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                  {submitting ? 'Aceitando...' : 'Aceitar convite'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
