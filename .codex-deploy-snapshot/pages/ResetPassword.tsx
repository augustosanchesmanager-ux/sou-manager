import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../services/supabaseClient';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Supabase puts the token in the URL fragment as:
        // https://app.vercel.app/reset-password#access_token=...&type=recovery
        // The supabase client reads this automatically when you call getSession or onAuthStateChange.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                // Session is set, user can now update their password
                setIsReady(true);
            } else if (event === 'SIGNED_IN' && session) {
                // Also handle if already signed in via recovery token
                setIsReady(true);
            }
        });

        // Also check if we already have a session with recovery (e.g. page reload)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setIsReady(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' });
            return;
        }
        if (password.length < 6) {
            setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Senha redefinida com sucesso! Redirecionando...' });
            setTimeout(() => navigate('/dashboard'), 2000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao redefinir senha.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-background-light dark:bg-background-dark">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] bg-primary/20 pointer-events-none" />

            <header className="mb-8 z-10 animate-fade-in">
                <Logo size="lg" />
            </header>

            <main className="w-full max-w-[440px] z-10 animate-fade-in">
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="size-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">lock_reset</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Redefinir Senha</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            {isReady ? 'Escolha sua nova senha abaixo.' : 'Validando link de recuperação...'}
                        </p>
                    </div>

                    {message && (
                        <div className={`p-3 rounded-lg border text-xs font-bold text-center mb-6 ${message.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    {!isReady ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : (
                        <form onSubmit={handleReset} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Nova Senha</label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">lock</span>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3.5 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Confirmar Nova Senha</label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">lock_clock</span>
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3.5 pl-12 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Salvando...' : 'Confirmar Nova Senha'}
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="w-full text-slate-500 hover:text-slate-900 dark:hover:text-white text-sm font-bold transition-colors"
                            >
                                Voltar para o Login
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ResetPassword;
