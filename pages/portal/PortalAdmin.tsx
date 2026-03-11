import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar';
import { Smartphone, Link as LinkIcon, BarChart2, Settings, Copy, Check } from 'lucide-react';
import AddonModal from '../../components/KioskAddonModal';

interface AddonInfo {
    status: 'enabled' | 'disabled';
    theme: string;
    reschedule_window_hours: number;
    cancellation_window_hours: number;
}

const PortalAdmin: React.FC = () => {
    const { tenantId, tenantSlug } = useAuth();
    const [addon, setAddon] = useState<AddonInfo | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'link'>('overview');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Settings
    const [settingsTheme, setSettingsTheme] = useState('default');
    const [rescheduleWindow, setRescheduleWindow] = useState(2);
    const [cancellWindow, setCancellWindow] = useState(2);

    useEffect(() => {
        if (tenantId) {
            loadAddon();
        } else {
            setLoading(false);
        }
    }, [tenantId]);

    const loadAddon = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('tenant_addons')
            .select('status, limits')
            .eq('tenant_id', tenantId)
            .eq('addon_key', 'CLIENT_PORTAL')
            .single();

        const theme = data?.limits?.theme || 'default';
        const addonInfo: AddonInfo | null = data ? {
            status: data.status,
            theme: theme,
            reschedule_window_hours: data.limits?.reschedule_window_hours || 2,
            cancellation_window_hours: data.limits?.cancellation_window_hours || 2
        } : null;

        setAddon(addonInfo);
        if (addonInfo) {
            setSettingsTheme(addonInfo.theme);
            setRescheduleWindow(addonInfo.reschedule_window_hours);
            setCancellWindow(addonInfo.cancellation_window_hours);
        }
        setLoading(false);
    };

    const handleActivateAddon = async () => {
        setSaving(true);
        try {
            const limits = { theme: 'default', reschedule_window_hours: 2, cancellation_window_hours: 2 };
            if (addon) {
                await supabase.from('tenant_addons').update({ status: 'enabled', activated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('addon_key', 'CLIENT_PORTAL');
            } else {
                await supabase.from('tenant_addons').insert({
                    tenant_id: tenantId,
                    addon_key: 'CLIENT_PORTAL',
                    status: 'enabled',
                    activated_at: new Date().toISOString(),
                    limits
                });
            }
            setShowModal(false);
            await loadAddon();
        } finally {
            setSaving(false);
        }
    };

    const handleDisableAddon = async () => {
        if (!confirm('Desabilitar o Portal do Cliente? Os clientes não conseguirão acessar.')) return;
        await supabase.from('tenant_addons').update({ status: 'disabled' }).eq('tenant_id', tenantId).eq('addon_key', 'CLIENT_PORTAL');
        await loadAddon();
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await supabase.from('tenant_addons').update({
                limits: { theme: settingsTheme, reschedule_window_hours: rescheduleWindow, cancellation_window_hours: cancellWindow }
            }).eq('tenant_id', tenantId).eq('addon_key', 'CLIENT_PORTAL');
            await loadAddon();
            alert('Configurações salvas!');
        } finally {
            setSaving(false);
        }
    };

    const portalLink = `${window.location.origin}/#/c/${tenantSlug}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(portalLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isEnabled = addon?.status === 'enabled';

    return (
        <div className="flex h-screen bg-[#f8fafc]">
            <Sidebar />

            {showModal && (
                <AddonModal
                    addonType="CLIENT_PORTAL"
                    theme="default"
                    onActivate={handleActivateAddon}
                    onClose={() => setShowModal(false)}
                />
            )}

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-5 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Portal do Cliente</h1>
                        <p className="text-sm text-slate-500 mt-1">Gerencie seu aplicativo web para clientes</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                        </div>
                    ) : !isEnabled ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-2xl text-center shadow-sm mx-auto mt-12">
                            <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Smartphone size={28} className="text-indigo-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Portal do Cliente Desabilitado</h2>
                            <p className="text-slate-500 mb-8 max-w-md mx-auto">
                                Ofereça um aplicativo web exclusivo para seus clientes agendarem a qualquer momento de casa, sem senha.
                            </p>
                            <button
                                onClick={() => setShowModal(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-sm"
                            >
                                Habilitar Add-on
                            </button>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto flex flex-col gap-6">

                            {/* Tabs */}
                            <div className="-mx-1 overflow-x-auto">
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl min-w-max">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <BarChart2 size={16} /> Visão Geral
                                </button>
                                <button
                                    onClick={() => setActiveTab('link')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'link' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <LinkIcon size={16} /> Compartilhamento
                                </button>
                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${activeTab === 'settings' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Settings size={16} /> Configurações
                                </button>
                            </div>
                            </div>

                            {/* Content Overview */}
                            {activeTab === 'overview' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <p className="text-sm font-semibold text-slate-500 mb-1">Status do Portal</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                            <p className="text-xl font-bold text-slate-800">Ativo</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <p className="text-sm font-semibold text-slate-500 mb-1">Agendamentos (Mensal)</p>
                                        <p className="text-3xl font-bold text-slate-800">--</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <p className="text-sm font-semibold text-slate-500 mb-1">Clientes Únicos</p>
                                        <p className="text-3xl font-bold text-slate-800">--</p>
                                    </div>
                                </div>
                            )}

                            {/* Content Link */}
                            {activeTab === 'link' && (
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-2">Link do seu Portal</h3>
                                    <p className="text-sm text-slate-500 mb-6">Coloque este link na bio do Instagram ou envie pelo WhatsApp.</p>

                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                        <input
                                            readOnly
                                            value={portalLink}
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-600 outline-none"
                                        />
                                        <button
                                            onClick={handleCopy}
                                            className="w-full sm:w-auto bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors border border-indigo-100"
                                        >
                                            {copied ? <><Check size={18} /> Copiado</> : <><Copy size={18} /> Copiar</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Content Settings */}
                            {activeTab === 'settings' && (
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-lg font-bold text-slate-800 mb-6">Ajustes do Portal</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-700 mb-3">Identidade Visual (Tema)</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div
                                                    onClick={() => setSettingsTheme('default')}
                                                    className={`cursor-pointer border rounded-xl p-4 transition-all ${settingsTheme === 'default' ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="w-full h-8 bg-indigo-500 rounded mb-2 opacity-50"></div>
                                                    <p className="font-semibold text-sm text-slate-800 text-center">Padrão</p>
                                                </div>
                                                <div
                                                    onClick={() => setSettingsTheme('sanchez')}
                                                    className={`cursor-pointer border rounded-xl p-4 transition-all ${settingsTheme === 'sanchez' ? 'border-[#d4a017] bg-[#111108] ring-2 ring-[#d4a017]/20' : 'border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="w-full h-8 bg-gradient-to-r from-[#d4a017] to-[#b8860b] rounded mb-2 opacity-80"></div>
                                                    <p className="font-semibold text-sm text-center" style={{ color: settingsTheme === 'sanchez' ? '#d4a017' : '#64748b' }}>Sanchez</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-bold text-slate-700 mb-3">Regras de Agendamento</h4>

                                            <div className="flex flex-col gap-4">
                                                <div>
                                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Reagendar (horas antes)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={rescheduleWindow}
                                                        onChange={e => setRescheduleWindow(Number(e.target.value))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold text-slate-500 block mb-1">Cancelar (horas antes)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={cancellWindow}
                                                        onChange={e => setCancellWindow(Number(e.target.value))}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                                        <button
                                            onClick={handleDisableAddon}
                                            className="text-red-500 text-sm font-semibold hover:text-red-700 px-2 py-1"
                                        >
                                            Desativar Portal
                                        </button>
                                        <button
                                            onClick={handleSaveSettings}
                                            disabled={saving}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg shadow-sm disabled:opacity-50"
                                        >
                                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default PortalAdmin;
