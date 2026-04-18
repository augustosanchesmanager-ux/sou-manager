import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

const BR_STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const cleanDigits = (value: string) => value.replace(/\D/g, '');

const formatPhone = (value: string) => {
    const digits = cleanDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatZip = (value: string) => {
    const digits = cleanDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

type PersonType = 'pf' | 'pj';

const formatDocument = (value: string, personType: PersonType) => {
    const maxLength = personType === 'pf' ? 11 : 14;
    const digits = cleanDigits(value).slice(0, maxLength);

    if (personType === 'pf') {
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
        if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }

    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const validateProfileFields = (profile: Record<string, string>) => {
    const requiredFields: Array<{ key: string; label: string }> = [
        { key: 'first_name', label: 'Nome' },
        { key: 'last_name', label: 'Sobrenome' },
        { key: 'shop_name', label: 'Nome da Barbearia' },
        { key: 'phone', label: 'Telefone/WhatsApp' },
        { key: 'person_type', label: 'Tipo de Pessoa' },
        { key: 'document', label: profile.person_type === 'pf' ? 'CPF' : 'CNPJ' },
        { key: 'zip_code', label: 'CEP' },
        { key: 'street', label: 'Rua/Avenida' },
        { key: 'number', label: 'Número' },
        { key: 'neighborhood', label: 'Bairro' },
        { key: 'city', label: 'Cidade' },
        { key: 'state', label: 'UF' },
        { key: 'business_type', label: 'Tipo de Negócio' }
    ];

    const missing = requiredFields.find((field) => !(profile[field.key] || '').trim());
    if (missing) return `Preencha o campo obrigatório: ${missing.label}.`;

    const phoneDigits = cleanDigits(profile.phone || '');
    if (phoneDigits.length < 10) return 'Informe um telefone válido com DDD.';

    const documentDigits = cleanDigits(profile.document || '');
    if (profile.person_type === 'pf' && documentDigits.length !== 11) {
        return 'Informe um CPF válido com 11 dígitos.';
    }
    if (profile.person_type === 'pj' && documentDigits.length !== 14) {
        return 'Informe um CNPJ válido com 14 dígitos.';
    }

    const zipDigits = cleanDigits(profile.zip_code || '');
    if (zipDigits.length !== 8) return 'Informe um CEP válido com 8 dígitos.';

    return null;
};

const Settings: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [cepLoading, setCepLoading] = useState(false);
    const [cepMessage, setCepMessage] = useState<string | null>(null);
    const [lastFetchedCep, setLastFetchedCep] = useState('');

    const initialDocument = cleanDigits(user?.user_metadata?.document || '');
    const initialPersonType: PersonType = user?.user_metadata?.person_type === 'pf' || user?.user_metadata?.person_type === 'pj'
        ? user.user_metadata.person_type
        : initialDocument.length > 11
            ? 'pj'
            : 'pf';

    const [profile, setProfile] = useState({
        first_name: user?.user_metadata?.first_name || '',
        last_name: user?.user_metadata?.last_name || '',
        shop_name: user?.user_metadata?.shop_name || '',
        phone: formatPhone(user?.user_metadata?.phone || ''),
        person_type: initialPersonType as PersonType,
        document: formatDocument(user?.user_metadata?.document || '', initialPersonType),
        business_type: user?.user_metadata?.business_type || 'Barbearia',
        zip_code: formatZip(user?.user_metadata?.zip_code || ''),
        street: user?.user_metadata?.street || '',
        number: user?.user_metadata?.number || '',
        complement: user?.user_metadata?.complement || '',
        neighborhood: user?.user_metadata?.neighborhood || '',
        city: user?.user_metadata?.city || '',
        state: user?.user_metadata?.state || 'SP',
        instagram: user?.user_metadata?.instagram || '',
        website: user?.user_metadata?.website || '',
        fiscal_email: user?.user_metadata?.fiscal_email || ''
    });

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const missingRequired = useMemo(() => {
        const requiredKeys = ['first_name', 'last_name', 'shop_name', 'phone', 'document', 'zip_code', 'street', 'number', 'neighborhood', 'city', 'state', 'business_type'] as const;
        return requiredKeys.filter((key) => !(profile[key] || '').trim()).length;
    }, [profile]);

    const handleProfileField = (field: keyof typeof profile, value: string) => {
        if (field === 'person_type') {
            const nextType = value as PersonType;
            setProfile((prev) => ({
                ...prev,
                person_type: nextType,
                document: formatDocument(cleanDigits(prev.document), nextType)
            }));
            return;
        }
        if (field === 'phone') {
            setProfile((prev) => ({ ...prev, phone: formatPhone(value) }));
            return;
        }
        if (field === 'document') {
            setProfile((prev) => ({ ...prev, document: formatDocument(value, prev.person_type) }));
            return;
        }
        if (field === 'zip_code') {
            setProfile((prev) => ({ ...prev, zip_code: formatZip(value) }));
            return;
        }
        if (field === 'state') {
            setProfile((prev) => ({ ...prev, state: value.toUpperCase().slice(0, 2) }));
            return;
        }
        setProfile((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        const zipDigits = cleanDigits(profile.zip_code);
        if (zipDigits.length !== 8 || zipDigits === lastFetchedCep) {
            return;
        }

        let isCancelled = false;

        const fetchCep = async () => {
            setCepLoading(true);
            setCepMessage(null);
            try {
                const response = await fetch(`https://viacep.com.br/ws/${zipDigits}/json/`);
                const data = await response.json();

                if (isCancelled) return;

                if (!response.ok || data?.erro) {
                    setCepMessage('CEP não encontrado. Preencha o endereço manualmente.');
                    return;
                }

                setProfile((prev) => ({
                    ...prev,
                    street: prev.street || data.logradouro || '',
                    neighborhood: prev.neighborhood || data.bairro || '',
                    city: prev.city || data.localidade || '',
                    state: (prev.state && prev.state !== 'SP') ? prev.state : (data.uf || prev.state || 'SP'),
                }));
                setLastFetchedCep(zipDigits);
                setCepMessage('Endereço preenchido automaticamente pelo CEP.');
            } catch {
                if (!isCancelled) {
                    setCepMessage('Não foi possível consultar o CEP agora. Continue com preenchimento manual.');
                }
            } finally {
                if (!isCancelled) setCepLoading(false);
            }
        };

        void fetchCep();

        return () => {
            isCancelled = true;
        };
    }, [profile.zip_code, lastFetchedCep]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        const validationError = validateProfileFields(profile);
        if (validationError) {
            setMessage({ type: 'error', text: validationError });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    ...profile,
                    phone: cleanDigits(profile.phone),
                    document: cleanDigits(profile.document),
                    zip_code: cleanDigits(profile.zip_code)
                }
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Dados cadastrais atualizados com sucesso!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao atualizar dados cadastrais.' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao alterar senha' });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <header>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Configurações</h2>
                <p className="text-slate-500 mt-1">Gerencie seu perfil, segurança e acompanhe sua utilização.</p>
            </header>

            {message && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 animate-fade-in ${message.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}>
                    <span className="material-symbols-outlined">
                        {message.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    <p className="text-sm font-bold">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Profile Section */}
                <section className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm md:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary">person_edit</span>
                        <h3 className="font-bold text-slate-900 dark:text-white">Dados Cadastrais</h3>
                    </div>

                    <div className={`mb-5 rounded-xl border px-4 py-3 flex items-center justify-between gap-4 ${missingRequired === 0
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-600'
                        }`}>
                        <p className="text-sm font-bold">
                            {missingRequired === 0
                                ? 'Cadastro completo. Seu perfil está pronto para operação.'
                                : `Faltam ${missingRequired} campo(s) obrigatório(s) para completar seu cadastro.`}
                        </p>
                        <span className="material-symbols-outlined">{missingRequired === 0 ? 'verified' : 'rule'}</span>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nome *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.first_name}
                                    onChange={(e) => handleProfileField('first_name', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Sobrenome *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.last_name}
                                    onChange={(e) => handleProfileField('last_name', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nome da Barbearia *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.shop_name}
                                    onChange={(e) => handleProfileField('shop_name', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Tipo de Negócio *</label>
                                <select
                                    required
                                    value={profile.business_type}
                                    onChange={(e) => handleProfileField('business_type', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    <option value="Barbearia">Barbearia</option>
                                    <option value="Barbearia e Salão">Barbearia e Salão</option>
                                    <option value="Salão">Salão</option>
                                    <option value="Clínica de Estética">Clínica de Estética</option>
                                    <option value="Outro">Outro</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Telefone/WhatsApp *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.phone}
                                    onChange={(e) => handleProfileField('phone', e.target.value)}
                                    placeholder="(11) 99999-9999"
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Tipo de Pessoa *</label>
                                <select
                                    required
                                    value={profile.person_type}
                                    onChange={(e) => handleProfileField('person_type', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    <option value="pf">Pessoa Física</option>
                                    <option value="pj">Pessoa Jurídica</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{profile.person_type === 'pf' ? 'CPF *' : 'CNPJ *'}</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.document}
                                    onChange={(e) => handleProfileField('document', e.target.value)}
                                    placeholder={profile.person_type === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">E-mail Fiscal/Financeiro</label>
                            <input
                                type="email"
                                value={profile.fiscal_email}
                                onChange={(e) => handleProfileField('fiscal_email', e.target.value)}
                                placeholder="financeiro@suaempresa.com"
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">CEP *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.zip_code}
                                    onChange={(e) => handleProfileField('zip_code', e.target.value)}
                                    placeholder="00000-000"
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                                {(cepLoading || cepMessage) && (
                                    <p className={`text-[11px] ${cepMessage?.includes('não') ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {cepLoading ? 'Consultando CEP...' : cepMessage}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Rua/Avenida *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.street}
                                    onChange={(e) => handleProfileField('street', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Número *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.number}
                                    onChange={(e) => handleProfileField('number', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Bairro *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.neighborhood}
                                    onChange={(e) => handleProfileField('neighborhood', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Cidade *</label>
                                <input
                                    type="text"
                                    required
                                    value={profile.city}
                                    onChange={(e) => handleProfileField('city', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">UF *</label>
                                <select
                                    required
                                    value={profile.state}
                                    onChange={(e) => handleProfileField('state', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                >
                                    {BR_STATES.map((state) => (
                                        <option key={state} value={state}>{state}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Complemento</label>
                            <input
                                type="text"
                                value={profile.complement}
                                onChange={(e) => handleProfileField('complement', e.target.value)}
                                placeholder="Sala, bloco, referência..."
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Instagram</label>
                                <input
                                    type="text"
                                    value={profile.instagram}
                                    onChange={(e) => handleProfileField('instagram', e.target.value)}
                                    placeholder="@sua_barbearia"
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Site</label>
                                <input
                                    type="url"
                                    value={profile.website}
                                    onChange={(e) => handleProfileField('website', e.target.value)}
                                    placeholder="https://www.suaempresa.com.br"
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 opacity-60">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">E-mail da Conta (Não editável)</label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                readOnly
                                className="w-full bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm cursor-not-allowed"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : 'Salvar Dados Cadastrais'}
                        </button>
                    </form>
                </section>

                {/* Password Section */}
                <section className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary">lock_reset</span>
                        <h3 className="font-bold text-slate-900 dark:text-white">Segurança</h3>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nova Senha</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Confirmar Nova Senha</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark hover:border-primary text-slate-700 dark:text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                        >
                            {loading ? 'Alterando...' : 'Alterar Senha'}
                        </button>
                    </form>
                </section>
            </div>

            {/* Usage Stats Section */}
            <section className="bg-white dark:bg-card-dark p-8 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <span className="material-symbols-outlined text-9xl">analytics</span>
                </div>

                <div className="flex items-center gap-3 mb-8">
                    <span className="material-symbols-outlined text-primary">monitoring</span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">Acompanhamento de Utilização</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Membro desde</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(user?.created_at)}</p>
                    </div>
                    <div className="space-y-2 border-slate-100 dark:border-white/5 sm:border-l sm:pl-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Último Acesso</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatDate(user?.last_sign_in_at)}</p>
                    </div>
                    <div className="space-y-2 border-slate-100 dark:border-white/5 sm:border-l sm:pl-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Plano Atual</p>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                                {user?.user_metadata?.plan || 'Free'}
                            </span>
                            <button className="text-[10px] text-primary hover:underline font-bold uppercase tracking-widest">Upgrade</button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Settings;
