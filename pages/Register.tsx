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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
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
                // Confirmação de e-mail DESATIVADA (ex: ambiente de dev/autoconfirm).
                // O signUp já retorna sessão → provisiona na hora e segue para o onboarding.
                await tenantProvisioningService.provision({
                    userId,
                    tenantName: shopName,
                    firstName,
                    lastName,
                });

                // Re-resolve contextos após o provisionamento — o onAuthStateChange
                // original pode ter lido profiles antes do RPC criar o tenant.
                await refreshAccessContext();
                await refreshTenant();

                navigate('/onboarding/shop-setup');
            } else {
                // Confirmação de e-mail ATIVADA no Supabase: o signUp não cria sessão
                // e o RPC provision_new_tenant exige auth.uid(). O provisionamento
                // acontece no primeiro login após a confirmação do e-mail
                // (ProtectedRoute redireciona para /onboarding/provision).
                navigate('/register/verify-email', { replace: true, state: { email } });
            }
        } catch (err: any) {
            // If signUp succeeded but provision failed, sign out to prevent orphaned session
            await supabase.auth.signOut().catch(() => {});
            setError(err.message || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-2xl z-10">
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
                    <header className="mb-8">
                        <Logo size="sm" className="mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Crie sua conta</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Comece a gerenciar sua barbearia hoje mesmo. Plano gratuito incluso.</p>
                    </header>

                    <form onSubmit={handleRegister} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-center font-bold">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Nome</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Seu nome"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Sobrenome</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Sobrenome"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Nome da Barbearia</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-primary transition-colors">storefront</span>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Barbearia do Zé"
                                    value={shopName}
                                    onChange={(e) => setShopName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">E-mail</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-primary transition-colors">mail</span>
                                <input
                                    type="email"
                                    required
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-primary transition-colors">lock</span>
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    placeholder="Mínimo 8 caracteres"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-3 pl-11 pr-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                        >
                            {loading ? 'Criando Conta...' : 'Criar Conta'}
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>
                    </form>

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

export default Register;
