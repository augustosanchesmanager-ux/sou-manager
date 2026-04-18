import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import AddonModal, { AddonModalTheme } from '../components/KioskAddonModal';
import Sidebar from '../components/Sidebar';
import { RefreshCw, LayoutDashboard, MonitorSmartphone, Settings, BarChart2 } from 'lucide-react';
import QRCode from 'react-qr-code';

interface Device {
    id: string;
    name: string;
    is_active: boolean;
    theme: string;
    timeout_seconds: number;
    last_seen_at: string | null;
    created_at: string;
}

interface Metrics {
    appointments_totem: number;
    appointments_qr: number;
    total_sessions: number;
    completed_sessions: number;
    avg_barber_rating: number;
    avg_nps: number;
    feedback_barber_count: number;
    feedback_shop_count: number;
}

interface AddonInfo {
    status: 'enabled' | 'disabled';
    kiosk_theme: string;
    max_devices: number;
}

const KioskAdmin: React.FC = () => {
    const { tenantId } = useAuth();
    const [addon, setAddon] = useState<AddonInfo | null>(null);
    const [devices, setDevices] = useState<Device[]>([]);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'settings' | 'metrics'>('overview');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // New device form
    const [newDeviceName, setNewDeviceName] = useState('');
    const [newDeviceTheme, setNewDeviceTheme] = useState('default');
    const [newDeviceTimeout, setNewDeviceTimeout] = useState(30);
    const [addingDevice, setAddingDevice] = useState(false);
    const [showAddDevice, setShowAddDevice] = useState(false);

    // Settings
    const [settingsTheme, setSettingsTheme] = useState('default');
    const [logoUrl, setLogoUrl] = useState('');
    const [ambientImages, setAmbientImages] = useState<string[]>([]);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [tenantSlug, setTenantSlug] = useState<string | null>(null);

    // Refs for hidden inputs
    const logoInputRef = useRef<HTMLInputElement>(null);
    const ambientInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (tenantId) {
            loadAll();
        } else {
            setLoading(false);
        }
    }, [tenantId]);

    const loadAll = async () => {
        setLoading(true);
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('slug')
            .eq('id', tenantId)
            .single();
        if (tenantData?.slug) setTenantSlug(tenantData.slug);
        await Promise.all([loadAddon(), loadDevices(), loadMetrics()]);
        setLoading(false);
    };

    const loadAddon = async () => {
        const { data } = await supabase
            .from('tenant_addons')
            .select('status, limits')
            .eq('tenant_id', tenantId)
            .eq('addon_key', 'TOTEM_QR')
            .single();

        const theme = data?.limits?.theme || 'default';
        const logo = data?.limits?.logo_url || '';
        const images = data?.limits?.ambient_images || [];

        const addonInfo: AddonInfo | null = data ? {
            status: data.status,
            kiosk_theme: theme,
            max_devices: data.limits?.max_devices || 1
        } : null;

        setAddon(addonInfo);
        setSettingsTheme(theme);
        setLogoUrl(logo);
        setAmbientImages(images);
    };

    const loadDevices = async () => {
        const { data } = await supabase
            .from('kiosk_devices')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
        setDevices(data || []);
    };

    const loadMetrics = async () => {
        const [apptResult, sessionResult, ratingResult, npsResult] = await Promise.all([
            supabase.from('appointments').select('channel').eq('tenant_id', tenantId).eq('source', 'kiosk'),
            supabase.from('kiosk_sessions').select('status').eq('tenant_id', tenantId),
            supabase.from('feedback_barber').select('rating').eq('tenant_id', tenantId),
            supabase.from('feedback_shop').select('nps').eq('tenant_id', tenantId),
        ]);

        const apptData = apptResult.data || [];
        const sessionData = sessionResult.data || [];
        const ratingData = ratingResult.data || [];
        const npsData = npsResult.data || [];

        const avgRating = ratingData.length > 0
            ? ratingData.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingData.length
            : 0;

        const avgNps = npsData.length > 0
            ? npsData.reduce((sum, r) => sum + (r.nps || 0), 0) / npsData.length
            : 0;

        setMetrics({
            appointments_totem: apptData.filter(a => a.channel === 'totem').length,
            appointments_qr: apptData.filter(a => a.channel === 'qr').length,
            total_sessions: sessionData.length,
            completed_sessions: sessionData.filter(s => s.status === 'completed').length,
            avg_barber_rating: parseFloat(avgRating.toFixed(1)),
            avg_nps: parseFloat(avgNps.toFixed(1)),
            feedback_barber_count: ratingData.length,
            feedback_shop_count: npsData.length,
        });
    };

    const handleActivateAddon = async () => {
        setSaving(true);
        try {
            if (addon) {
                await supabase.from('tenant_addons')
                    .update({ status: 'enabled', activated_at: new Date().toISOString() })
                    .eq('tenant_id', tenantId)
                    .eq('addon_key', 'TOTEM_QR');
            } else {
                await supabase.from('tenant_addons').insert({
                    tenant_id: tenantId,
                    addon_key: 'TOTEM_QR',
                    status: 'enabled',
                    activated_at: new Date().toISOString(),
                    limits: { theme: 'default', max_devices: 1, logo_url: '', ambient_images: [] }
                });
            }
            setShowModal(false);
            await loadAddon();
        } finally {
            setSaving(false);
        }
    };

    const handleDisableAddon = async () => {
        if (!confirm('Desabilitar o add-on Totem + QR? O totem e o QR Code ficarão inacessíveis.')) return;
        await supabase.from('tenant_addons').update({ status: 'disabled' }).eq('tenant_id', tenantId).eq('addon_key', 'TOTEM_QR');
        await loadAddon();
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const currentLimits = {
                max_devices: 1,
                ...(addon ? { max_devices: addon.max_devices } : {}),
                theme: settingsTheme,
                logo_url: logoUrl,
                ambient_images: ambientImages
            };

            await supabase.from('tenant_addons').update({
                limits: currentLimits
            }).eq('tenant_id', tenantId).eq('addon_key', 'TOTEM_QR');

            await loadAddon();
            alert('Configurações salvas com sucesso!');
        } finally {
            setSaving(false);
        }
    };

    const addAmbientImage = () => {
        if (!newImageUrl.trim()) return;
        setAmbientImages([...ambientImages, newImageUrl.trim()]);
        setNewImageUrl('');
    };

    const removeAmbientImage = (index: number) => {
        setAmbientImages(ambientImages.filter((_, i) => i !== index));
    };

    const handleFileProcess = (file: File, maxWidth: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); // compression
                };
                img.onerror = (e) => reject(e);
            };
            reader.onerror = (e) => reject(e);
        });
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await handleFileProcess(file, 400); // logos are small
            setLogoUrl(base64);
        } catch (err) {
            console.error(err);
            alert('Falha ao processar a imagem do logo.');
        } finally {
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const handleAmbientUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await handleFileProcess(file, 1080); // HD background
            setAmbientImages([...ambientImages, base64]);
        } catch (err) {
            console.error(err);
            alert('Falha ao processar a imagem. Tente de novo.');
        } finally {
            if (ambientInputRef.current) ambientInputRef.current.value = '';
        }
    };

    const handleAddDevice = async () => {
        if (!newDeviceName.trim()) return;
        setAddingDevice(true);
        try {
            await supabase.from('kiosk_devices').insert({
                tenant_id: tenantId,
                name: newDeviceName.trim(),
                theme: newDeviceTheme,
                timeout_seconds: newDeviceTimeout,
                is_active: true,
            });
            setNewDeviceName('');
            setNewDeviceTheme('default');
            setNewDeviceTimeout(30);
            setShowAddDevice(false);
            await loadDevices();
        } finally {
            setAddingDevice(false);
        }
    };

    const toggleDevice = async (deviceId: string, current: boolean) => {
        await supabase.from('kiosk_devices').update({ is_active: !current }).eq('id', deviceId);
        await loadDevices();
    };

    const deleteDevice = async (deviceId: string) => {
        if (!confirm('Remover este dispositivo?')) return;
        await supabase.from('kiosk_devices').delete().eq('id', deviceId);
        await loadDevices();
    };

    const getTotemUrl = (slug?: string) => {
        const base = window.location.origin + window.location.pathname;
        const identifier = slug || tenantSlug || tenantId;
        return `${base}#/kiosk/${identifier}`;
    };

    const isEnabled = addon?.status === 'enabled';

    return (
        <div className="flex h-screen overflow-hidden bg-slate-900">
            <Sidebar />

            <main className="flex-1 overflow-y-auto" style={{ background: '#0f172a', padding: '32px' }}>

                {showModal && (
                    <AddonModal
                        addonType="TOTEM_QR"
                        theme="default"
                        onActivate={handleActivateAddon}
                        onClose={() => setShowModal(false)}
                    />
                )}

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '28px' }}>🖥️</span>
                            <h1 style={{ color: '#f8fafc', fontWeight: 800, fontSize: '26px', margin: 0 }}>Totem Atendimento</h1>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                            Gerencie a experiência do cliente na recepção e em TVs.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <div style={{
                            background: isEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${isEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            color: isEnabled ? '#10b981' : '#ef4444',
                            borderRadius: '10px',
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isEnabled ? '#10b981' : '#ef4444' }} />
                            {isEnabled ? 'Módulo Ativo' : 'Módulo Inativo'}
                        </div>
                        {!isEnabled ? (
                            <button className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95" onClick={() => setShowModal(true)}>
                                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                Ativar Agora
                            </button>
                        ) : (
                            <button className="bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-2 rounded-xl font-bold transition-all hover:bg-red-500/20" onClick={handleDisableAddon}>
                                Desativar
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '2px' }}>
                    {[
                        { id: 'overview', label: '📊 Visão Geral' },
                        { id: 'devices', label: '🖥️ Dispositivos' },
                        { id: 'settings', label: '🎨 Design & Branding' },
                        { id: 'metrics', label: '📈 Métricas' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '10px',
                                border: 'none',
                                background: activeTab === tab.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                                color: activeTab === tab.id ? '#6366f1' : '#64748b',
                                fontWeight: activeTab === tab.id ? 700 : 500,
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s',
                                borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                            }}
                            onClick={() => setActiveTab(tab.id as any)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {!isEnabled && (
                            <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-3xl p-12 text-center flex flex-col items-center">
                                <span className="material-symbols-outlined text-6xl text-slate-600 mb-4">monitor_smartphone</span>
                                <h3 className="text-xl font-black text-white mb-2 tracking-tight">Potencialize sua Recepção</h3>
                                <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
                                    Habilite o autoatendimento para que seus clientes possam agendar e avaliar sem precisar falar com a recepcionista.
                                </p>
                                <button className="bg-primary px-8 py-3 rounded-2xl font-black text-white shadow-xl hover:shadow-primary/20 transition-all active:scale-95" onClick={() => setShowModal(true)}>
                                    LIBERAR DISPOSITIVOS
                                </button>
                            </div>
                        )}

                        {isEnabled && (
                            <>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-slate-800/30 border border-white/5 rounded-3xl p-8">
                                            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                                                <div className="flex-1">
                                                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 w-fit">
                                                        Canal de Autoatendimento
                                                    </div>
                                                    <h4 className="text-white font-black text-2xl mb-2 tracking-tight flex items-center gap-3">
                                                        <span className="material-symbols-outlined text-primary scale-125">tv</span>
                                                        Espelhamento na Smart TV
                                                    </h4>
                                                    <p className="text-slate-400 text-sm leading-relaxed mb-6">
                                                        Transforme qualquer monitor ou Smart TV em um terminal de autoatendimento.
                                                        Basta abrir o navegador da TV e acessar o endereço abaixo.
                                                    </p>

                                                    <div className="space-y-3">
                                                        <div className="bg-black/40 rounded-2xl p-4 flex items-center border border-white/10 group">
                                                            <code className="text-primary text-sm font-bold truncate flex-1">{getTotemUrl()}</code>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(getTotemUrl());
                                                                    alert('Link copiado!');
                                                                }}
                                                                className="text-slate-500 hover:text-white transition-colors p-2"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">content_copy</span>
                                                            </button>
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={() => window.open(getTotemUrl(), '_blank')}
                                                                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                                Testar no Navegador
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-6 rounded-[40px] shadow-2xl border-[12px] border-slate-900">
                                                    <div className="mb-4 text-center">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escaneie na TV</p>
                                                    </div>
                                                    <QRCode value={getTotemUrl()} size={140} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/30 border border-white/5 rounded-3xl p-8 flex items-center justify-between">
                                            <div>
                                                <h5 className="text-white font-black tracking-tight mb-1">Dica de Especialista</h5>
                                                <p className="text-slate-500 text-xs">Ative o "Modo Ambiente" com fotos reais do seu espaço para atrair mais clientes na recepção.</p>
                                            </div>
                                            <button onClick={() => setActiveTab('settings')} className="text-primary font-black text-[10px] uppercase tracking-widest hover:underline">Configurar Agora →</button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {[
                                            { label: 'Agend. Totem', value: metrics?.appointments_totem, color: '#6366f1', icon: 'ads_click' },
                                            { label: 'Agend. QR', value: metrics?.appointments_qr, color: '#8b5cf6', icon: 'qr_code_2' },
                                            { label: 'Nota Time', value: metrics?.avg_barber_rating, color: '#fbbf24', icon: 'star' },
                                            { label: 'NPS Global', value: metrics?.avg_nps, color: '#10b981', icon: 'favorite' },
                                        ].map(m => (
                                            <div key={m.label} className="bg-slate-800/30 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                                                <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-6xl opacity-5" style={{ color: m.color }}>{m.icon}</span>
                                                <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase mb-2">{m.label}</p>
                                                <p className="text-3xl font-black text-white">{m.value || 0}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* DEVICES TAB */}
                {activeTab === 'devices' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="text-white font-black text-xl tracking-tight">Paineis Virtuais</h3>
                            <button className="bg-primary px-4 py-2 rounded-xl text-white font-bold text-sm shadow-lg active:scale-95" onClick={() => setShowAddDevice(v => !v)}>
                                {showAddDevice ? '✕ Fechar' : '+ Adicionar Tela'}
                            </button>
                        </div>

                        {showAddDevice && (
                            <div className="bg-slate-800/50 border border-primary/20 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-300">
                                <h4 style={{ color: '#f8fafc', marginBottom: '16px', fontWeight: 900 }}>Novo Cadastro de Dispositivo</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    <div>
                                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Identificação (Nome)</label>
                                        <input className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary/50" placeholder="Ex: TV Principal Recepção" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1 mb-1 block">Estilo Visual</label>
                                        <select className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-3 text-white outline-none" value={newDeviceTheme} onChange={e => setNewDeviceTheme(e.target.value)}>
                                            <option value="default">Luxury Dark (Ouro / Preto)</option>
                                            <option value="modern">Modern Professional (Azul / Branco)</option>
                                        </select>
                                    </div>
                                </div>
                                <button className="w-full bg-primary py-4 rounded-xl font-black text-white tracking-widest shadow-xl" disabled={addingDevice || !newDeviceName.trim()} onClick={handleAddDevice}>
                                    {addingDevice ? 'PROCESSANDO...' : 'CADASTRAR DISPOSITIVO'}
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {devices.map(device => (
                                <div key={device.id} className="bg-slate-800/30 border border-white/5 rounded-3xl p-6 hover:border-primary/20 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="text-white font-black text-lg tracking-tight uppercase">{device.name}</h4>
                                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Tema: {device.theme}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => toggleDevice(device.id, device.is_active)} className={`p-2 rounded-xl transition-all ${device.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                <span className="material-symbols-outlined">{device.is_active ? 'visibility' : 'visibility_off'}</span>
                                            </button>
                                            <button onClick={() => deleteDevice(device.id)} className="p-2 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                                                <span className="material-symbols-outlined">delete_sweep</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                                        <code className="text-[10px] text-primary font-bold truncate">{getTotemUrl()}/?device={device.id.slice(0, 4)}</code>
                                        <button onClick={() => navigator.clipboard.writeText(`${getTotemUrl()}?device=${device.id}`)} className="text-slate-500 hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-sm">content_copy</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* SETTINGS TAB (DESIGN & BRANDING) */}
                {activeTab === 'settings' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
                        <div className="space-y-4">
                            <div className="bg-slate-800/30 border border-white/5 rounded-3xl p-8">
                                <h3 className="text-white font-black text-xl mb-6 tracking-tight">Identidade Visual</h3>

                                <div className="space-y-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1 block">Logo da Barbearia</label>
                                            <span className="text-[9px] text-slate-500 uppercase font-black bg-slate-800 px-2 py-0.5 rounded">URL OU ARQUIVO</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-primary/50" placeholder="Cole URL HTTP..." value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
                                            <input type="file" accept="image/*" className="hidden" ref={logoInputRef} onChange={handleLogoUpload} />
                                            <button onClick={() => logoInputRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 border border-white/10 text-white rounded-xl p-3 transition-colors flex items-center justify-center shrink-0" title="Upload de Arquivo">
                                                <span className="material-symbols-outlined text-[20px]">upload_file</span>
                                            </button>
                                        </div>
                                        {logoUrl && (
                                            <div className="mt-4 p-4 bg-white/5 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/20 relative group">
                                                <button onClick={() => setLogoUrl('')} className="absolute top-2 right-2 size-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                </button>
                                                <img
                                                    src={logoUrl}
                                                    alt="Logo Preview"
                                                    style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest ml-1 mb-2 block">Tema do Sistema</label>
                                        <select className="w-full bg-slate-900/50 border border-white/10 rounded-xl p-3 text-white text-xs outline-none" value={settingsTheme} onChange={e => setSettingsTheme(e.target.value)}>
                                            <option value="default">Classic Dark Royal</option>
                                            <option value="sanchez">Sanchez Signature</option>
                                            <option value="minimal">Minimal White</option>
                                        </select>
                                    </div>

                                    <button className="w-full bg-primary py-4 rounded-3xl font-black text-white tracking-widest shadow-xl active:scale-95" disabled={saving} onClick={handleSaveSettings}>
                                        {saving ? 'SALVANDO...' : 'SALVAR DESIGN'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800/30 border border-white/5 rounded-3xl p-8">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-white font-black text-xl tracking-tight uppercase">Galeria do Estabelecimento</h3>
                                    <p className="text-slate-500 text-xs">Estas fotos passarão automaticamente na TV quando o totem estiver ocioso.</p>
                                </div>
                                <span className="p-2 px-4 bg-primary/20 text-primary rounded-full text-[10px] font-black">{ambientImages.length} FOTOS</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                {ambientImages.map((img, idx) => (
                                    <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 group bg-slate-900/50 flex items-center justify-center">
                                        <img
                                            src={img}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                            alt={`Ambiente ${idx}`}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%23475569" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
                                            }}
                                        />
                                        <button onClick={() => removeAmbientImage(idx)} className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 backdrop-blur-sm text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                ))}

                                <input type="file" accept="image/*" className="hidden" ref={ambientInputRef} onChange={handleAmbientUpload} />
                                <div onClick={() => ambientInputRef.current?.click()} className="aspect-video rounded-2xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer bg-slate-800/20">
                                    <span className="material-symbols-outlined text-4xl text-slate-600 group-hover:text-primary transition-all mb-2">upload_file</span>
                                    <span className="text-[10px] text-slate-500 group-hover:text-primary uppercase font-bold tracking-widest text-center px-2">Enviar<br />Arquivo</span>
                                </div>
                            </div>

                            <div className="flex gap-2 relative">
                                <input placeholder="Ou cole a URL direta da imagem (HTTP/HTTPS)" className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-primary/50" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAmbientImage()} />
                                <button onClick={addAmbientImage} className="bg-slate-700 hover:bg-slate-600 text-white font-black p-3 px-6 rounded-xl transition-all text-xs uppercase shadow-lg disabled:opacity-50" disabled={!newImageUrl.trim()}>ADD URL</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* METRICS TAB */}
                {activeTab === 'metrics' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                        {[
                            { label: 'Sessões Iniciadas', value: metrics?.total_sessions, color: '#06b6d4', icon: 'bolt' },
                            { label: 'Taxa de Retenção', value: `${metrics && metrics.total_sessions > 0 ? Math.round((metrics.completed_sessions / metrics.total_sessions) * 100) : 0}%`, color: '#f59e0b', icon: 'handshake' },
                            { label: 'Feedbacks Coletados', value: (metrics?.feedback_barber_count || 0) + (metrics?.feedback_shop_count || 0), color: '#fbbf24', icon: 'reviews' },
                        ].map(m => (
                            <div key={m.label} className="bg-slate-800/30 border border-white/5 rounded-3xl p-8 text-center">
                                <span className={`material-symbols-outlined text-3xl mb-4`} style={{ color: m.color }}>{m.icon}</span>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">{m.label}</p>
                                <p className="text-4xl font-black text-white">{m.value}</p>
                            </div>
                        ))}
                    </div>
                )}

            </main>
        </div>
    );
};

export default KioskAdmin;
