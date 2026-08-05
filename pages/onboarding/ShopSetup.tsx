import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { completeOnboardingService } from '../../application/onboarding';

const CHAIR_OPTIONS = [
    { value: 2, label: '1 a 3 Cadeiras' },
    { value: 5, label: '4 a 7 Cadeiras' },
    { value: 10, label: '8+ Cadeiras' },
];

const TIMEZONES = [
    { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
    { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
    { value: 'America/Recife', label: 'Recife (UTC-3)' },
    { value: 'America/Belem', label: 'Belém (UTC-3)' },
    { value: 'America/Bahia', label: 'Salvador (UTC-3)' },
    { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
    { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
    { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
    { value: 'America/Boa_Vista', label: 'Boa Vista (UTC-4)' },
    { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
    { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
];

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DEFAULT_WEEK = {
    sun: { open: '09:00', close: '18:00' },
    mon: { open: '09:00', close: '19:00' },
    tue: { open: '09:00', close: '19:00' },
    wed: { open: '09:00', close: '19:00' },
    thu: { open: '09:00', close: '19:00' },
    fri: { open: '09:00', close: '20:00' },
    sat: { open: '09:00', close: '19:00' },
};

/**
 * Bloco 2 — Configuração da Empresa (Fase 6.0.2).
 *
 * Dados obrigatórios para o sistema funcionar: telefone, CNPJ (opcional),
 * endereço, timezone, moeda e quantidade de cadeiras.
 *
 * Persistência progressiva via saveCompanyStep (RPC save_onboarding_step).
 * Suporta retomada: se o tenant já salvou a etapa, os campos vêm preenchidos.
 */
const ShopSetup: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId, tenant, tenantSlug } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Company data (Step 1)
    const [phone, setPhone] = useState('');
    const [cnpj, setCnpj] = useState('');

    // Address + Operational data (Step 2)
    const [addressZip, setAddressZip] = useState('');
    const [addressStreet, setAddressStreet] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [addressCity, setAddressCity] = useState('');
    const [addressState, setAddressState] = useState('');
    const [chairCount, setChairCount] = useState<number>(2);

    // Regional (Step 3)
    const [timezone, setTimezone] = useState('America/Sao_Paulo');
    const [currency, setCurrency] = useState('BRL');

    // Resume
    useEffect(() => {
        if (!tenantId) return;
        let cancelled = false;
        void (async () => {
            try {
                const settings = await completeOnboardingService.getSettings(tenantId);
                if (cancelled || !settings) return;
                setPhone(settings.phone ?? '');
                setCnpj(settings.cnpj ?? '');
                setAddressZip(settings.address_zip ?? '');
                setAddressStreet(settings.address_street ?? '');
                setAddressNumber(settings.address_number ?? '');
                setAddressCity(settings.address_city ?? '');
                setAddressState(settings.address_state ?? '');
                setChairCount(settings.chair_count ?? 2);
                setTimezone(settings.timezone || 'America/Sao_Paulo');
                setCurrency(settings.currency || 'BRL');
            } catch {
                // Segue com campos vazios — o prefill é otimização, não requisito.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tenantId]);

    const handleSaveCompany = async () => {
        if (!tenantId) {
            setError('Tenant não identificado. Faça login novamente.');
            return;
        }
        if (!phone.trim()) {
            setError('Informe o telefone / WhatsApp da barbearia.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await completeOnboardingService.saveCompanyStep({
                tenantId,
                phone: phone.trim(),
                cnpj: cnpj.trim() || undefined,
                addressStreet: addressStreet.trim() || undefined,
                addressNumber: addressNumber.trim() || undefined,
                addressCity: addressCity.trim() || undefined,
                addressState: addressState.trim() || undefined,
                addressZip: addressZip.trim() || undefined,
                timezone,
                currency,
            });

            navigate('/onboarding/operational-setup');
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar dados da empresa');
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
                        <span className="text-sm font-bold text-white tracking-wide">PASSO {step} DE 3</span>
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
                    onClick={() => navigate('/onboarding/welcome')}
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
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Nome fantasia</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={tenant?.name ?? ''}
                                    className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-400 dark:text-slate-500 font-medium cursor-not-allowed"
                                />
                                <p className="text-[10px] text-slate-400 ml-1">Definido no cadastro. Pode ser alterado depois nas configurações.</p>
                            </div>

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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Cidade</label>
                                    <input
                                        type="text"
                                        placeholder="São Paulo"
                                        value={addressCity}
                                        onChange={(e) => setAddressCity(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Estado</label>
                                    <input
                                        type="text"
                                        placeholder="SP"
                                        maxLength={2}
                                        value={addressState}
                                        onChange={(e) => setAddressState(e.target.value.toUpperCase())}
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

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">arrow_back</span> Voltar
                                </button>
                                <button
                                    onClick={() => setStep(3)}
                                    className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                >
                                    Continuar
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-5 animate-fade-in">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Fuso Horário</label>
                                <select
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    {TIMEZONES.map((tz) => (
                                        <option key={tz.value} value={tz.value} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                                            {tz.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Moeda</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium appearance-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    <option value="BRL" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Real (R$)</option>
                                </select>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setStep(2)}
                                    className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">arrow_back</span> Voltar
                                </button>
                                <button
                                    onClick={handleSaveCompany}
                                    disabled={loading}
                                    className="flex-1 bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Salvando...' : 'Salvar empresa'}
                                    {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShopSetup;
