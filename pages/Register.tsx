import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../services/supabaseClient';
import { tenantProvisioningService } from '../application/tenantProvisioning';
import { useAuth } from '../context/AuthContext';

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { refreshAccessContext, refreshTenant } = useAuth();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [shopName, setShopName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        shop_name: shopName,
                    },
                    emailRedirectTo: window.location.origin,
                }
            });

            if (signUpError) throw signUpError;

            const userId = signUpData.user?.id;
            if (!userId) {
                throw new Error('Não foi possível obter o ID do usuário');
            }

            if (signUpData.session) {
                // Confirmação de e-mail DESATIVADA (ex: dev/autoconfirm)
                await tenantProvisioningService.provision({
                    userId,
                    tenantName: shopName,
                    firstName,
                    lastName,
                });

                await refreshAccessContext();
                await refreshTenant();

                navigate('/onboarding/shop-setup');
            } else {
                // Confirmação de e-mail ATIVADA no Supabase
                navigate('/register/verify-email', { replace: true, state: { email } });
            }
        } catch (err: any) {
            await supabase.auth.signOut().catch(() => {});
            setError(err.message || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#07090E] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden select-none font-sans">
            {/* Ambient Lighting & High-Tech Grids */}
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

                        {/* Title Header */}
                        <div className="mb-6">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                                Crie sua conta
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                                Comece a gerenciar sua barbearia hoje mesmo. Plataforma modular de alto padrão.
                            </p>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-4">
                            {error && (
                                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-400 animate-fade-in">
                                    <span className="material-symbols-outlined text-base text-red-400 shrink-0 mt-0.5">error</span>
                                    <span className="font-medium leading-relaxed">{error}</span>
                                </div>
                            )}

                            {/* Name & Last Name (2 Cols) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300 block">
                                        Nome
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Seu nome"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-300 block">
                                        Sobrenome
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Sobrenome"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
                                    />
                                </div>
                            </div>

                            {/* Shop Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300 block">
                                    Nome da Barbearia
                                </label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base group-focus-within:text-amber-400 transition-colors">
                                        storefront
                                    </span>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Barbearia Sanches"
                                        value={shopName}
                                        onChange={(e) => setShopName(e.target.value)}
                                        className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300 block">
                                    Email
                                </label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base group-focus-within:text-amber-400 transition-colors">
                                        mail
                                    </span>
                                    <input
                                        type="email"
                                        required
                                        autoComplete="email"
                                        placeholder="seu@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-300 block">
                                    Senha (mínimo 8 caracteres)
                                </label>
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base group-focus-within:text-amber-400 transition-colors">
                                        lock
                                    </span>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/[0.03] hover:bg-white/[0.05] focus:bg-white/[0.07] border border-white/10 focus:border-amber-400/60 rounded-xl py-2.5 pl-10 pr-11 text-sm text-white placeholder:text-slate-500 outline-none transition-all duration-200"
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

                            {/* Submit Button */}
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide bg-white hover:bg-slate-100 text-night shadow-[0_0_20px_rgba(255,255,255,0.12)] transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
                                >
                                    {loading ? 'Criando Conta...' : 'Criar Conta'}
                                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Footer Login Link */}
                    <div className="mt-6 pt-4 border-t border-white/5 text-center text-xs text-slate-400">
                        Já tem uma conta?{' '}
                        <Link to="/login" className="text-white hover:text-amber-400 font-medium underline underline-offset-4 transition-colors">
                            Fazer Login
                        </Link>
                    </div>
                </div>

                {/* Right Column (Col 8 to 12): Cybernetic Brain Visual Flank */}
                <div className="lg:col-span-5 relative hidden lg:flex flex-col items-center justify-between p-8 sm:p-10 bg-gradient-to-br from-[#0F131E]/90 via-[#0B0D14] to-[#06070B] border-l border-white/10 overflow-hidden">
                    {/* Ambient Radial Golden Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-amber-500/15 blur-[90px] pointer-events-none" />

                    {/* Subtle dot matrix grid overlay */}
                    <div className="absolute inset-0 bg-[radial-gradient(rgba(245,158,11,0.08)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                    {/* Top Status Header */}
                    <div className="w-full flex items-center justify-between z-10">
                        <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-amber-400/80">
                            SMG BARBER PLATFORM
                        </span>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
                            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[10px] font-mono tracking-widest text-slate-300 uppercase">PROVISIONAMENTO</span>
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
                            <span>ARQUITETURA CORE</span>
                            <span className="text-amber-400 font-bold">100% OPERACIONAL</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans">
                            Ambiente isolado por unidade com isolamento de dados RLS, comissionamento automático e fechamento de caixa auditável.
                        </p>
                    </div>
                </div>

            </div>

            {/* Bottom Security Protocol Notice */}
            <footer className="mt-6 text-center z-10">
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500">
                    SMG PLATFORM // SECURE REGISTRATION GATEWAY
                </p>
            </footer>
        </div>
    );
};

export default Register;
