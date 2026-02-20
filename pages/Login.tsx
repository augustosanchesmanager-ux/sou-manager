import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../services/supabaseClient';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showReset, setShowReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const [activeTab, setActiveTab] = useState<'user' | 'elite'>('user');
    const [isLocalhost, setIsLocalhost] = useState(false);

    useEffect(() => {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            setIsLocalhost(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro ao fazer login');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetLoading(true);
        setError(null);
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (resetError) throw resetError;
            setResetSent(true);
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar e-mail de recuperação');
        } finally {
            setResetLoading(false);
        }
    };

    const isElite = activeTab === 'elite';

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden transition-all duration-700 ${isElite ? 'bg-[#050505]' : 'bg-background-light dark:bg-background-dark'
            }`}>
            {/* Background Glow */}
            <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none transition-all duration-700 ${isElite ? 'bg-amber-500/10' : 'bg-primary/20'
                }`}></div>

            {isElite && (
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
            )}

            <header className="mb-8 z-10 animate-fade-in">
                <Logo size="lg" className={isElite ? 'filter brightness-125' : ''} />
            </header>

            <main className="w-full max-w-[440px] z-10">
                <div className={`border rounded-2xl p-8 shadow-2xl backdrop-blur-sm transition-all duration-500 relative overflow-hidden ${isElite
                    ? 'bg-black/80 border-amber-500/30 ring-1 ring-amber-500/20'
                    : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-border-dark'
                    }`}>
                    {/* Elite Accent Strip */}
                    {isElite && (
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>
                    )}

                    {isLocalhost && !showReset && (
                        <div className="flex p-1 bg-slate-100 dark:bg-background-dark rounded-xl mb-8 border border-slate-200 dark:border-border-dark">
                            <button
                                onClick={() => setActiveTab('user')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'user'
                                    ? 'bg-white dark:bg-surface-dark text-primary shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-lg">person</span>
                                Usuário
                            </button>
                            <button
                                onClick={() => setActiveTab('elite')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'elite'
                                    ? 'bg-black text-amber-500 shadow-lg shadow-amber-500/10 border border-amber-500/20'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-lg">workspace_premium</span>
                                Elite
                            </button>
                        </div>
                    )}

                    {!showReset ? (
                        <>
                            <div className="text-center mb-8">
                                <h2 className={`text-xl font-bold transition-colors ${isElite ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                                    {isElite ? 'Acesso Restrito Elite' : 'Bem-vindo de volta'}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                    {isElite ? 'Área exclusiva para administradores do sistema' : 'Acesse sua conta para gerenciar sua barbearia'}
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-6">
                                {error && (
                                    <div className={`text-xs p-3 rounded-lg text-center font-bold animate-fade-in border ${isElite
                                        ? 'bg-amber-900/20 border-amber-500/20 text-amber-500'
                                        : 'bg-red-500/10 border-red-500/20 text-red-500'
                                        }`}>
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">E-mail</label>
                                    <div className="relative group">
                                        <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isElite ? 'text-amber-500/50 group-focus-within:text-amber-500' : 'text-slate-400 dark:text-slate-500 group-focus-within:text-primary'
                                            }`}>mail</span>
                                        <input
                                            type="email"
                                            required
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className={`w-full border rounded-lg py-3.5 pl-12 pr-4 text-sm outline-none transition-all ${isElite
                                                ? 'bg-black/50 border-amber-500/20 text-amber-100 placeholder:text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                                                : 'bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-border-dark text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-primary focus:ring-1 focus:ring-primary'
                                                }`}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
                                    <div className="relative group">
                                        <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isElite ? 'text-amber-500/50 group-focus-within:text-amber-500' : 'text-slate-400 dark:text-slate-500 group-focus-within:text-primary'
                                            }`}>lock</span>
                                        <input
                                            type="password"
                                            required
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className={`w-full border rounded-lg py-3.5 pl-12 pr-12 text-sm outline-none transition-all ${isElite
                                                ? 'bg-black/50 border-amber-500/20 text-amber-100 placeholder:text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                                                : 'bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-border-dark text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-primary focus:ring-1 focus:ring-primary'
                                                }`}
                                        />
                                        <button type="button" className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors ${isElite ? 'text-amber-500/50 hover:text-amber-500' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                                            <span className="material-symbols-outlined text-lg">visibility</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className={`rounded border-slate-300 dark:border-border-dark bg-white dark:bg-background-dark focus:ring-primary ${isElite ? 'text-amber-500 ring-amber-500' : 'text-primary'}`} />
                                        <span className={`transition-colors ${isElite ? 'text-slate-500 group-hover:text-amber-500/70' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-300'}`}>Lembrar de mim</span>
                                    </label>
                                    {!isElite && (
                                        <button
                                            type="button"
                                            onClick={() => setShowReset(true)}
                                            className="text-primary hover:text-blue-600 dark:hover:text-blue-400 font-medium"
                                        >
                                            Esqueci minha senha
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full font-bold py-4 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${isElite
                                        ? 'bg-amber-600 hover:bg-amber-500 text-black shadow-amber-500/20'
                                        : 'bg-primary hover:bg-blue-600 text-white shadow-primary/20'
                                        }`}
                                >
                                    {loading ? 'Validando...' : (isElite ? 'Autenticar Elite' : 'Entrar no Sistema')}
                                    <span className="material-symbols-outlined text-lg">{isElite ? 'verified_user' : 'login'}</span>
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recuperar Senha</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Enviaremos um link de recuperação para o seu e-mail</p>
                            </div>

                            {!resetSent ? (
                                <form onSubmit={handleResetPassword} className="space-y-6">
                                    {error && (
                                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-center font-bold">
                                            {error}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">E-mail</label>
                                        <div className="relative group">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
                                            <input
                                                type="email"
                                                required
                                                placeholder="seu@email.com"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3.5 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={resetLoading}
                                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {resetLoading ? 'Enviando...' : 'Enviar Link'}
                                        <span className="material-symbols-outlined text-lg">send</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowReset(false)}
                                        className="w-full text-slate-500 hover:text-slate-900 dark:hover:text-white text-sm font-bold transition-colors"
                                    >
                                        Voltar para o Login
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="size-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                                    </div>
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">E-mail Enviado!</h3>
                                    <p className="text-sm text-slate-500 mb-6">Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.</p>
                                    <button
                                        onClick={() => setShowReset(false)}
                                        className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all"
                                    >
                                        Entendi
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-border-dark text-center">
                        <p className={`text-sm transition-colors ${isElite ? 'text-slate-600' : 'text-slate-600 dark:text-slate-500'}`}>
                            Ainda não tem conta? <Link to="/register" className={`font-bold transition-colors ${isElite ? 'text-amber-500/70 hover:text-amber-500' : 'text-slate-900 dark:text-white hover:text-primary'}`}>Criar conta</Link>
                        </p>
                    </div>
                </div>
            </main>

            <footer className="mt-8 text-center z-10">
                <p className={`text-[10px] uppercase tracking-[0.2em] font-bold transition-colors ${isElite ? 'text-amber-500/30' : 'text-slate-500 dark:text-slate-600'}`}>
                    {isElite ? 'Protocolo de Segurança Nível 5 Ativado' : 'Gestão Profissional para Barbearias de Elite'}
                </p>
            </footer>
        </div>
    );
};

export default Login;