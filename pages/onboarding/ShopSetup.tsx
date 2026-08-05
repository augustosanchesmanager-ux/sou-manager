import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { completeOnboardingService } from '../../application/onboarding';

const CHAIR_OPTIONS = [
    { value: 2, label: '1 a 3 Cadeiras' },
    { value: 5, label: '4 a 7 Cadeiras' },
    { value: 10, label: '8+ Cadeiras' },
];

const ShopSetup: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId, tenantSlug, refreshTenant } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Company data (Step 1)
    const [cnpj, setCnpj] = useState('');
    const [phone, setPhone] = useState('');

    // Address + Operational data (Step 2)
    const [addressZip, setAddressZip] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [chairCount, setChairCount] = useState<number>(2);

    const handleFinish = async () => {
        if (!tenantId) {
            setError('Tenant não identificado. Faça login novamente.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await completeOnboardingService.complete({
                tenantId,
                tenantSlug: tenantSlug ?? undefined,
                phone: phone || undefined,
                cnpj: cnpj || undefined,
                addressStreet: addressStreet || undefined,
                addressNumber: addressNumber || undefined,
                addressZip: addressZip || undefined,
                chairCount,
            });

            // O complete_onboarding ativa o tenant no banco; sem refrescar o
            // contexto, o ProtectedRoute ainda enxerga status=draft e devolve o
            // usuário para o shop-setup em vez de liberar o /dashboard.
            await refreshTenant();

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Erro ao finalizar cadastro');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col lg:flex-row">
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
                <div className="relative z-10 p-12 max-w-lg">
                    <div className="inline-flex items-center gap-2 mb-6 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                        <span className="material-symbols-outlined text-emerald-400 text-sm">rocket_launch</span>
                        <span className="text-sm font-bold text-white tracking-wide">PASSO {step} DE 2</span>
                    </div>
                    <h2 className="text-5xl font-black text-white tracking-tight leading-tight mb-6">
                        Leve sua barbearia para o próximo nível.
                    </h2>
                    <p className="text-slate-300 text-lg leading-relaxed">
                        Configure seu ambiente de trabalho digital e comece a ter controle total sobre seu faturamento e equipe em poucos minutos.
                    </p>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative">
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-6 left-6 lg:top-12 lg:left-12 flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-bold"
                >
                    <span className="material-symbols-outlined">arrow_back</span> Voltar
                </button>

                <div className="w-full max-w-md animate-fade-in">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Dados da Barbearia</h1>
                        <p className="text-slate-500 dark:text-slate-400">Preencha as informações do seu negócio.</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-center font-bold mb-5">
                            {error}
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Telefone / WhatsApp</label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="(11) 99999-9999"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">CNPJ (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="00.000.000/0001-00"
                                    value={cnpj}
                                    onChange={(e) => setCnpj(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
                                />
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                Continuar
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">CEP</label>
                                <input
                                    type="text"
                                    placeholder="00000-000"
                                    value={addressZip}
                                    onChange={(e) => setAddressZip(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="col-span-1 sm:col-span-2 space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Rua</label>
                                    <input
                                        type="text"
                                        placeholder="Rua..."
                                        value={addressStreet}
                                        onChange={(e) => setAddressStreet(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Número</label>
                                    <input
                                        type="text"
                                        placeholder="123"
                                        value={addressNumber}
                                        onChange={(e) => setAddressNumber(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Quantidade de Cadeiras</label>
                                <select
                                    value={chairCount}
                                    onChange={(e) => setChairCount(Number(e.target.value))}
                                    className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    {CHAIR_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleFinish}
                                disabled={loading}
                                className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                            >
                                {loading ? 'Finalizando...' : 'Finalizar Cadastro'}
                                {!loading && <span className="material-symbols-outlined">check</span>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShopSetup;
