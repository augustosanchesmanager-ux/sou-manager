import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';
import { tenantProvisioningService } from '../../application/tenantProvisioning';

/**
 * Provisionamento do tenant no primeiro login pós-confirmação de e-mail.
 *
 * Com a confirmação de e-mail ATIVADA no Supabase, o signUp NÃO cria sessão e o
 * RPC provision_new_tenant exige auth.uid() (fix de segurança — chamadas anônimas
 * são rejeitadas). Este passo roda autenticado, imediatamente após o login do
 * usuário recém-cadastrado (ProtectedRoute redireciona para cá).
 *
 * FLUXO:
 *   1. Se já existe tenant → segue direto para /onboarding/shop-setup.
 *   2. Lê dados do cadastro de user_metadata (first_name/last_name/shop_name).
 *   3. Chama tenantProvisioningService.provision (RPC autenticada).
 *   4. Re-resolve contextos e navega para /onboarding/shop-setup.
 *
 * Fallback: se user_metadata não tiver shop_name (caso limite), exibe um pequeno
 * formulário para completar o cadastro antes de provisionar.
 */
const Provision: React.FC = () => {
    const navigate = useNavigate();
    const { session, user, tenantId, loading, refreshAccessContext, refreshTenant } = useAuth();

    const [state, setState] = useState<'idle' | 'provisioning' | 'done' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [formFirstName, setFormFirstName] = useState('');
    const [formLastName, setFormLastName] = useState('');
    const [formShopName, setFormShopName] = useState('');
    const runRef = useRef(false);

    const runProvision = async (values: { firstName: string; lastName: string; shopName: string }) => {
        if (!session?.user) return;
        setState('provisioning');
        setError(null);
        try {
            await tenantProvisioningService.provision({
                userId: session.user.id,
                tenantName: values.shopName,
                firstName: values.firstName,
                lastName: values.lastName,
            });
            // Re-resolve contextos após o provisionamento — o onAuthStateChange
            // original pode ter lido profiles antes do RPC criar o tenant.
            await refreshAccessContext();
            await refreshTenant();
            setState('done');
            navigate('/onboarding/shop-setup', { replace: true });
        } catch (err: any) {
            setState('error');
            setError(err.message || 'Não foi possível concluir a criação da conta.');
        }
    };

    useEffect(() => {
        const meta = user?.user_metadata ?? {};
        setFormFirstName(typeof meta.first_name === 'string' ? meta.first_name : '');
        setFormLastName(typeof meta.last_name === 'string' ? meta.last_name : '');
        setFormShopName(typeof meta.shop_name === 'string' ? meta.shop_name : '');
    }, [user]);

    useEffect(() => {
        if (loading) return;
        if (!session?.user) {
            navigate('/login', { replace: true });
            return;
        }
        if (tenantId) {
            navigate('/onboarding/shop-setup', { replace: true });
            return;
        }

        const meta = user?.user_metadata ?? {};
        if (!meta.shop_name) {
            setState('error');
            setError('Dados do cadastro não encontrados. Preencha os dados abaixo para continuar.');
            return;
        }
        if (runRef.current) return;
        runRef.current = true;

        void runProvision({
            firstName: String(meta.first_name ?? ''),
            lastName: String(meta.last_name ?? ''),
            shopName: String(meta.shop_name),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, session, tenantId, user, navigate]);

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formShopName.trim()) {
            setError('Informe o nome da barbearia.');
            return;
        }
        await runProvision({
            firstName: formFirstName,
            lastName: formLastName,
            shopName: formShopName,
        });
    };

    const needsForm = state === 'error' && !String(user?.user_metadata?.shop_name ?? '');

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md z-10">
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-8 shadow-2xl backdrop-blur-sm text-center">
                    <header className="mb-6">
                        <Logo size="sm" className="mb-4" />
                    </header>

                    <div className="size-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                        {state === 'provisioning' ? (
                            <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
                        ) : (
                            <span className="material-symbols-outlined text-3xl">storefront</span>
                        )}
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {state === 'provisioning' ? 'Configurando sua barbearia...' : 'Último passo para começar'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                        {state === 'provisioning'
                            ? 'Estamos criando o espaço da sua barbearia. Isso leva alguns segundos.'
                            : 'Complete seus dados para criar o espaço da sua barbearia.'}
                    </p>

                    {error && (
                        <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-center font-bold">
                            {error}
                        </div>
                    )}

                    {needsForm ? (
                        <form onSubmit={handleManualSubmit} className="space-y-4 text-left mb-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Nome</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Seu nome"
                                        value={formFirstName}
                                        onChange={(e) => setFormFirstName(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Sobrenome</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Sobrenome"
                                        value={formLastName}
                                        onChange={(e) => setFormLastName(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Nome da Barbearia</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Barbearia do Zé"
                                    value={formShopName}
                                    onChange={(e) => setFormShopName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={state === 'provisioning'}
                                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {state === 'provisioning' ? 'Criando...' : 'Criar barbearia'}
                            </button>
                        </form>
                    ) : state === 'error' ? (
                        <button
                            type="button"
                            onClick={() => {
                                const meta = user?.user_metadata ?? {};
                                void runProvision({
                                    firstName: String(meta.first_name ?? ''),
                                    lastName: String(meta.last_name ?? ''),
                                    shopName: String(meta.shop_name ?? ''),
                                });
                            }}
                            className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg shadow-primary/20 transition-all"
                        >
                            Tentar novamente
                        </button>
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Você será redirecionado automaticamente.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Provision;
