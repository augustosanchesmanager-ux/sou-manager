import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../services/supabaseClient';
import { isInstitutionalHostname } from '../src/lib/apps/publicUrl';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const [showReset, setShowReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const [activeTab, setActiveTab] = useState<'user' | 'elite'>('user');
    const [isLocalhost, setIsLocalhost] = useState(false);
    const isLocalDemoMode = isLocalhost && !import.meta.env.VITE_SUPABASE_URL;

    const normalizeEmail = (value: string) => value.trim().toLowerCase();

    const getAuthErrorMessage = (err: any) => {
        const rawMessage = err?.message || '';
        const normalizedMessage = rawMessage.toLowerCase();

        if (normalizedMessage.includes('invalid login credentials')) {
            return 'E-mail ou senha inválidos. Revise os dados e tente novamente.';
        }

        if (normalizedMessage.includes('erro no banco de dados ao encontrar o usuario')) {
            return 'Não foi possível localizar este acesso no Auth do Supabase. Confirme o e-mail sem espaços e valide se o usuário existe.';
        }

        return rawMessage || 'Ocorreu um erro ao fazer login.';
    };

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
            const normalizedEmail = normalizeEmail(email);
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            });

            if (authError) throw authError;

            if (authData.user && isInstitutionalHostname(window.location.hostname)) {
                navigate('/select-system', { replace: true });
                return;
            }

            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(getAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetLoading(true);
        setError(null);

        try {
            const normalizedResetEmail = normalizeEmail(resetEmail);
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedResetEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (resetError) throw resetError;

            setResetSent(true);
            setResetEmail(normalizedResetEmail);
        } catch (err: any) {
            setError(getAuthErrorMessage(err));
        } finally {
            setResetLoading(false);
        }
    };

    const isElite = activeTab === 'elite';
    const isCentralPortal = isInstitutionalHostname(window.location.hostname);
    const subtitle = isElite
        ? 'Área exclusiva para administradores da rede.'
        : (isCentralPortal
            ? 'Entre no portal central para gerenciar suas unidades.'
            : 'Continue para acessar sua conta.');

    return (
        <div className="min-h-screen bg-[#07090E] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden select-none font-sans">
            {/* Ambient Lighting & Tech Grids */}
            <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-slate-700/15 blur-[120px] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

            {/* Main Split Card — Widescreen Frosted Glass */}
            <div className="relative w-full max-w-5xl rounded-3xl border border-white/10 bg-[#0B0D14]/85 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_80px_rgba(245,158,11,0.06)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10 transition-all duration-500">

                {/* Left Column (Col 1 to 7): The Modern Form */}
                <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative z-10">
                    <div>
                        {/* Top Branding Bar — Centered & Highly Legible */}
                        <div className="flex flex-col items-center justify-center mb-6 w-full text-center">
                            <div className="flex items-center justify-center w-full py-2">
                                <img
                                    src="/branding/smg-barber-intelligence-logo.png"
                                    alt="SMG Barber Intelligence"
                                    className="h-16 sm:h-20 md:h-24 w-auto max-w-[280px] sm:max-w-[340px] object-contain filter drop-shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:scale-[1.02] transition-transform"
                                />
                            </div>
                        </div>

                        {/* Localhost Tabs (Usuário / Elite) */}
                        {isLocalhost && !showReset && (
                            <div className="flex justify-center w-full mb-6">
                                <div className="inline-flex p-1 bg-white/[0.04] border border-white/10 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('user')}
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-mono font-bold tracking-wider rounded-lg transition-all ${
                                            activeTab === 'user'
                                                ? 'bg-white/10 text-white shadow-xs'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">person</span>
                                        USUÁRIO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('elite')}
                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-mono font-bold tracking-wider rounded-lg transition-all ${
                                            activeTab === 'elite'
                                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-xs'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">workspace_premium</span>
                                        ELITE
                                    </button>
                                </div>
                            </div>
                        )}

                        {!showReset ? (
                            <>
                                {/* Header Title */}
                                <div className="mb-7">
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                        {isElite ? 'Acesso Restrito Elite' : 'Entrar'}
                                    </h1>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                                        {subtitle}
                                    </p>
                                </div>

                                {/* Local Demo Mode Quick Helper */}
                                {isLocalDemoMode && !isElite && (
                                    <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 flex items-center justify-between text-xs animate-fade-in">
                                        <div>
                                            <p className="font-mono font-bold text-[10px] tracking-wider uppercase text-emerald-400">Acesso Local de Demonstração</p>
                                            <p className="text-slate-300 font-mono text-[11px] mt-0.5">teste@soumanager.local • 12345678</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEmail('teste@soumanager.local');
                                                setPassword('12345678');
                                            }}
                                            className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                                        >
                                            Preencher
                                        </button>
                                    </div>
                                )}

                                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                                    {error && (
                                        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400 animate-fade-in">
                                            <span className="material-symbols-outlined text-base text-red-400 shrink-0 mt-0.5">error</span>
                                            <span className="font-medium leading-relaxed">{error}</span>
                                        </div>
                                    )}

                                    {/* Email Field */}
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-300 block">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            autoComplete="email"
                                            placeholder="Digite seu email"
                                            value={email}
                                            onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                                            className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-3 px-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
                                        />
                                    </div>

                                    {/* Password Field */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-slate-300">
                                                Senha
                                            </label>
                                            {!isElite && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowReset(true)}
                                                    className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
                                                >
                                                    Esqueceu sua senha?
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                autoComplete="current-password"
                                                placeholder="Digite sua senha"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-3 pl-3.5 pr-11 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                                                aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                                            >
                                                <span className="material-symbols-outlined text-lg leading-none">
                                                    {showPassword ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Remember Me */}
                                    <div className="flex items-center pt-0.5">
                                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 hover:text-slate-300">
                                            <input
                                                type="checkbox"
                                                className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-0 focus:ring-offset-0"
                                            />
                                            <span>Lembrar de mim</span>
                                        </label>
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 ${
                                                isElite
                                                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-night hover:brightness-110 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                                                    : 'bg-white hover:bg-slate-100 text-night shadow-[0_0_20px_rgba(255,255,255,0.12)]'
                                            }`}
                                        >
                                            {loading ? 'Validando...' : (isElite ? 'Autenticar Elite' : 'Entrar')}
                                            <span className="material-symbols-outlined text-base">arrow_forward</span>
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            /* Password Reset Form */
                            <div className="animate-fade-in">
                                <div className="mb-7">
                                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                        Recuperar Senha
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                                        Enviaremos um link de recuperação diretamente para o seu e-mail cadastrado.
                                    </p>
                                </div>

                                {!resetSent ? (
                                    <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-5">
                                        {error && (
                                            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400 animate-fade-in">
                                                <span className="material-symbols-outlined text-base text-red-400 shrink-0 mt-0.5">error</span>
                                                <span className="font-medium leading-relaxed">{error}</span>
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-slate-300 block">
                                                Email Cadastrado
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                autoComplete="email"
                                                placeholder="seu@email.com"
                                                value={resetEmail}
                                                onChange={(e) => setResetEmail(normalizeEmail(e.target.value))}
                                                className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-3 px-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
                                            />
                                        </div>

                                        <div className="pt-2 space-y-3">
                                            <button
                                                type="submit"
                                                disabled={resetLoading}
                                                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide bg-white hover:bg-slate-100 text-night shadow-[0_0_20px_rgba(255,255,255,0.12)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {resetLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                                                <span className="material-symbols-outlined text-base">send</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setShowReset(false)}
                                                className="w-full text-slate-400 hover:text-white text-xs font-medium py-2 transition-colors text-center block"
                                            >
                                                Voltar para o Login
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="py-4 text-center">
                                        <div className="size-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="material-symbols-outlined text-3xl">check_circle</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-1.5">E-mail enviado com sucesso</h3>
                                        <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6 leading-relaxed">
                                            Verifique sua caixa de entrada e siga as instruções contidas no e-mail para criar uma nova senha.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setShowReset(false)}
                                            className="px-6 py-2.5 rounded-xl bg-white text-night font-bold text-xs hover:bg-slate-100 transition-colors"
                                        >
                                            Voltar ao Login
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Registration Link */}
                    <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-slate-400">
                        Ainda não tem conta?{' '}
                        <Link to="/register" className="text-white hover:text-amber-400 font-medium underline underline-offset-4 transition-colors">
                            Se inscreva
                        </Link>
                    </div>
                </div>

                {/* Right Column (Col 8 to 12): Cybernetic Brain Visual Flank */}
                <div className="lg:col-span-5 relative hidden lg:flex flex-col items-center justify-between p-8 sm:p-10 bg-gradient-to-br from-[#0F131E]/90 via-[#0B0D14] to-[#06070B] border-l border-white/10 overflow-hidden">
                    {/* Ambient Radial Golden Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-amber-500/15 blur-[90px] pointer-events-none" />

                    {/* Subtle dot matrix grid overlay (matching reference layout) */}
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(245,158,11,0.08)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                    {/* Top Status Header */}
                    <div className="w-full flex items-center justify-between z-10">
                        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-amber-400/80">
                            AI CORE ENGINE v2.6
                        </span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-mono tracking-widest text-slate-300 uppercase">SYNCHRONIZED</span>
                        </div>
                    </div>

                    {/* The Golden Cyber Brain with Ambient Floating Glow */}
                    <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center p-2 my-auto z-10">
                        <img
                            src="/branding/smg-ai-brain-barber.png"
                            alt="SMG Barber Intelligence AI Core"
                            className="w-full h-full object-contain filter drop-shadow-[0_0_35px_rgba(245,158,11,0.35)] transition-transform duration-700 ease-out hover:scale-105"
                        />
                    </div>

                    {/* Bottom Telemetry HUD Card */}
                    <div className="w-full z-10 p-4 rounded-2xl bg-black/60 border border-white/5 backdrop-blur-md">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span>SISTEMA AUDITÁVEL</span>
                            <span className="text-amber-400 font-bold">100% OPERACIONAL</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans">
                            Inteligência neural aplicada à gestão financeira, comissionamento e agenda de barbearias de alto padrão.
                        </p>
                    </div>
                </div>

            </div>

            {/* Bottom Security Protocol Notice */}
            <footer className="mt-6 text-center z-10">
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500">
                    {isElite ? 'Protocolo de segurança nível 5 ativado' : 'SMG PLATFORM // ENCRYPTED AUTH PROTOCOL'}
                </p>
            </footer>
        </div>
    );
};

export default Login;
