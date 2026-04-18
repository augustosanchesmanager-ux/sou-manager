import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { supabase } from '../services/supabaseClient';

const plans = [
    {
        id: 'starter',
        name: 'Starter',
        price: 'R$ 49',
        period: '/mês',
        features: ['1 Barbeiro', 'Agenda Básica', 'Relatórios Simples'],
        recommended: false
    },
    {
        id: 'pro',
        name: 'Professional',
        price: 'R$ 89',
        period: '/mês',
        features: ['Até 3 Barbeiros', 'Agenda Inteligente', 'Financeiro Completo', 'Lembretes WhatsApp'],
        recommended: true
    },
    {
        id: 'elite',
        name: 'Elite',
        price: 'R$ 149',
        period: '/mês',
        features: ['Barbeiros Ilimitados', 'Múltiplas Unidades', 'API de Integração', 'Gerente de Conta'],
        recommended: false
    }
];

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [selectedPlan, setSelectedPlan] = useState('pro');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [shopName, setShopName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        first_name: firstName,
                        last_name: lastName,
                        shop_name: shopName,
                        plan: selectedPlan,
                    }
                }
            });

            if (signUpError) throw signUpError;
            navigate('/register-success');
        } catch (err: any) {
            setError(err.message || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
            {/* Background Glow */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                {/* Left Side: Form */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
                    <header className="mb-8">
                        <Logo size="sm" className="mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Crie sua conta</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Comece a gerenciar sua barbearia hoje mesmo.</p>
                    </header>

                    <form onSubmit={handleRegister} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-center font-bold">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs p-3 rounded-lg text-center font-bold">
                                Conta criada com sucesso! Redirecionando...
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
                            disabled={loading || success}
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

                {/* Right Side: Plan Selection */}
                <div className="flex flex-col gap-6">
                    <div className="text-center lg:text-left">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Escolha seu plano</h3>
                        <p className="text-slate-500 dark:text-slate-400">Selecione o pacote ideal para o tamanho do seu negócio.</p>
                    </div>

                    <div className="space-y-4">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                onClick={() => setSelectedPlan(plan.id)}
                                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${selectedPlan === plan.id
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-lg shadow-primary/10'
                                    : 'border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                            >
                                {plan.recommended && (
                                    <span className="absolute -top-3 right-4 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">Recomendado</span>
                                )}
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="font-bold text-lg text-slate-900 dark:text-white">{plan.name}</h4>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                                            <span className="text-xs text-slate-500">{plan.period}</span>
                                        </div>
                                    </div>
                                    <div className={`size-6 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? 'border-primary bg-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {selectedPlan === plan.id && <span className="material-symbols-outlined text-white text-sm">check</span>}
                                    </div>
                                </div>
                                <ul className="space-y-2">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                            <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Register;