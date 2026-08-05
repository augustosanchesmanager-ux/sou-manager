import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../services/supabaseClient';

/**
 * Passo "verifique seu e-mail" do cadastro.
 *
 * Quando a confirmação de e-mail está ATIVADA no Supabase, o signUp não
 * retorna sessão — o provisionamento do tenant (provision_new_tenant) exige
 * auth.uid() e por isso acontece apenas no PRIMEIRO LOGIN após a confirmação.
 *
 * Esta tela apenas orienta o usuário e detecta a sessão quando o e-mail é
 * confirmado (mesma aba ou outra aba via cross-tab sync do supabase-js),
 * redirecionando para /onboarding/provision.
 */
const VerifyEmail: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const email = (location.state as { email?: string } | null)?.email ?? '';
    const [checking, setChecking] = useState(false);
    const [checked, setChecked] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                navigate('/onboarding/provision', { replace: true });
            }
        });
        return () => subscription.unsubscribe();
    }, [navigate]);

    const handleContinue = async () => {
        setChecking(true);
        setChecked(false);
        try {
            const { data } = await supabase.auth.getSession();
            const active = Boolean(data.session);
            setConfirmed(active);
            setChecked(true);
            if (active) {
                navigate('/onboarding/provision', { replace: true });
            }
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md z-10">
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-8 shadow-2xl backdrop-blur-sm text-center">
                    <header className="mb-6">
                        <Logo size="sm" className="mb-4" />
                    </header>

                    <div className="size-16 bg-amber-100 dark:bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl">mark_email_read</span>
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Confirme seu e-mail
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                        Enviamos um link de confirmação para <span className="font-bold text-slate-700 dark:text-slate-200">{email || 'seu e-mail'}</span>.
                    </p>

                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-4 mb-8 text-left bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-4">
                        <p className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-lg text-primary">inbox</span>
                            <span>Acesse sua caixa de entrada e clique no link <b>Confirmar e-mail</b>.</span>
                        </p>
                        <p className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-lg text-primary">hide_source</span>
                            <span>Não encontrou? Verifique a pasta de <b>spam</b> ou lixo eletrônico.</span>
                        </p>
                        <p className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-lg text-primary">auto_awesome</span>
                            <span>Após confirmar, você será direcionado para configurar sua barbearia.</span>
                        </p>
                    </div>

                    {checked && !confirmed && (
                        <div className="mb-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs p-3 rounded-lg text-center font-bold">
                            Ainda não detectamos a confirmação. Verifique seu e-mail e tente novamente.
                        </div>
                    )}

                    <button
                        type="button"
                        disabled={checking}
                        onClick={handleContinue}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {checking ? 'Verificando...' : 'Já confirmei, continuar'}
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </button>

                    <div className="mt-6 text-center">
                        <p className="text-slate-600 dark:text-slate-500 text-sm">
                            Já tem uma conta? <Link to="/login" className="text-slate-900 dark:text-white font-bold hover:text-primary transition-colors">Fazer Login</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
