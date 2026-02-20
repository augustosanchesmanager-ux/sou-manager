import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

const Settings: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Profile State
    const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || '');
    const [lastName, setLastName] = useState(user?.user_metadata?.last_name || '');
    const [shopName, setShopName] = useState(user?.user_metadata?.shop_name || '');

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    shop_name: shopName,
                }
            });

            if (error) throw error;
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil' });
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
                <section className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="material-symbols-outlined text-primary">person_edit</span>
                        <h3 className="font-bold text-slate-900 dark:text-white">Dados Cadastrais</h3>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nome</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Sobrenome</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Nome da Barbearia</label>
                            <input
                                type="text"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>

                        <div className="space-y-1.5 opacity-60">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">E-mail (Não editável)</label>
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
                            {loading ? 'Salvando...' : 'Atualizar Perfil'}
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
