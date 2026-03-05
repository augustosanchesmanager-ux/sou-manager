import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import KioskAddonModal from '../components/KioskAddonModal';

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

    useEffect(() => {
        if (tenantId) {
            loadAll();
        } else {
            // No tenantId available — stop loading and show a message
            setLoading(false);
        }
    }, [tenantId]);

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([loadAddon(), loadDevices(), loadMetrics()]);
        setLoading(false);
    };

    const loadAddon = async () => {
        const { data } = await supabase
            .from('kiosk_addons')
            .select('status, kiosk_theme, max_devices')
            .eq('tenant_id', tenantId)
            .single();
        setAddon(data as AddonInfo | null);
        if (data?.kiosk_theme) setSettingsTheme(data.kiosk_theme);
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
                await supabase.from('kiosk_addons').update({ status: 'enabled', activated_at: new Date().toISOString() }).eq('tenant_id', tenantId);
            } else {
                await supabase.from('kiosk_addons').insert({ tenant_id: tenantId, status: 'enabled', activated_at: new Date().toISOString(), kiosk_theme: 'default' });
            }
            setShowModal(false);
            await loadAddon();
        } finally {
            setSaving(false);
        }
    };

    const handleDisableAddon = async () => {
        if (!confirm('Desabilitar o add-on Totem + QR? O totem e o QR Code ficarão inacessíveis.')) return;
        await supabase.from('kiosk_addons').update({ status: 'disabled' }).eq('tenant_id', tenantId);
        await loadAddon();
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await supabase.from('kiosk_addons').update({ kiosk_theme: settingsTheme }).eq('tenant_id', tenantId);
            await loadAddon();
        } finally {
            setSaving(false);
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
        return `${base}#/kiosk/${slug || tenantId}`;
    };

    // ── Styles ──
    const page: React.CSSProperties = {
        minHeight: '100vh',
        background: 'var(--bg-dark, #0f172a)',
        padding: '24px',
        fontFamily: "'Inter', sans-serif",
        color: '#f8fafc',
    };

    const card: React.CSSProperties = {
        background: 'rgba(30,41,59,0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px',
        backdropFilter: 'blur(10px)',
    };

    const metricCard = (color: string): React.CSSProperties => ({
        ...card,
        borderTop: `3px solid ${color}`,
        textAlign: 'center',
    });

    const tabBtn = (active: boolean): React.CSSProperties => ({
        padding: '8px 18px',
        borderRadius: '10px',
        border: 'none',
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? '#6366f1' : '#64748b',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s',
        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
    });

    const btnPrimary: React.CSSProperties = {
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'transform 0.15s',
    };

    const btnDanger: React.CSSProperties = {
        ...btnPrimary,
        background: 'rgba(239,68,68,0.15)',
        color: '#ef4444',
        border: '1px solid rgba(239,68,68,0.3)',
    };

    const input: React.CSSProperties = {
        background: 'rgba(255,255,255,0.05)',
        border: '1.5px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        color: '#f8fafc',
        padding: '10px 14px',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    };

    const select: React.CSSProperties = { ...input };

    if (!tenantId) return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-dark, #0f172a)', padding: '24px', fontFamily: "'Inter', sans-serif", color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '48px' }}>🔐</div>
            <h2 style={{ color: '#f8fafc', fontWeight: 700 }}>Tenant não encontrado</h2>
            <p style={{ color: '#64748b', maxWidth: '400px', textAlign: 'center' }}>
                Sua conta não possui uma barbearia associada. O painel Totem + QR requer um tenant ativo vinculado ao seu perfil.
            </p>
        </div>
    );

    if (loading) return (
        <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: '#64748b' }}>Carregando painel do totem...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    const isEnabled = addon?.status === 'enabled';

    return (
        <div style={page}>
            {showModal && (
                <KioskAddonModal
                    theme={(addon?.kiosk_theme as any) || 'default'}
                    onActivate={handleActivateAddon}
                    onLearnMore={() => window.open('https://sou-manager.com/totem', '_blank')}
                    onClose={() => setShowModal(false)}
                />
            )}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '28px' }}>🖥️</span>
                        <h1 style={{ color: '#f8fafc', fontWeight: 800, fontSize: '26px', margin: 0 }}>Totem + QR (Autoatendimento)</h1>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        Gerencie dispositivos, configurações, métricas e feedback do módulo de autoatendimento.
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
                        {isEnabled ? 'Add-on Ativo' : 'Add-on Inativo'}
                    </div>
                    {!isEnabled ? (
                        <button style={btnPrimary} onClick={() => setShowModal(true)}>
                            ✨ Ativar Add-on
                        </button>
                    ) : (
                        <button style={btnDanger} onClick={handleDisableAddon}>
                            🔒 Desativar
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '2px' }}>
                {[
                    { id: 'overview', label: '📊 Visão Geral' },
                    { id: 'devices', label: '🖥️ Dispositivos' },
                    { id: 'metrics', label: '📈 Métricas' },
                    { id: 'settings', label: '⚙️ Configurações' },
                ].map(tab => (
                    <button key={tab.id} style={tabBtn(activeTab === tab.id)} onClick={() => setActiveTab(tab.id as any)}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {!isEnabled && (
                        <div style={{ ...card, background: 'rgba(99,102,241,0.05)', border: '1px dashed rgba(99,102,241,0.3)', textAlign: 'center', padding: '40px' }}>
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🖥️</div>
                            <h3 style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '8px' }}>Add-on não está ativo</h3>
                            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                                Ative o módulo Totem + QR para permitir autoatendimento na recepção da barbearia.
                            </p>
                            <button style={btnPrimary} onClick={() => setShowModal(true)}>✨ Ativar Totem + QR</button>
                        </div>
                    )}

                    {isEnabled && (
                        <>
                            {/* Quick KPIs */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                                <div style={metricCard('#6366f1')}>
                                    <p style={{ color: '#6366f1', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Agend. Totem</p>
                                    <p style={{ color: '#f8fafc', fontSize: '32px', fontWeight: 800, margin: 0 }}>{metrics?.appointments_totem ?? 0}</p>
                                </div>
                                <div style={metricCard('#8b5cf6')}>
                                    <p style={{ color: '#8b5cf6', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Agend. QR</p>
                                    <p style={{ color: '#f8fafc', fontSize: '32px', fontWeight: 800, margin: 0 }}>{metrics?.appointments_qr ?? 0}</p>
                                </div>
                                <div style={metricCard('#fbbf24')}>
                                    <p style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Nota Média ⭐</p>
                                    <p style={{ color: '#f8fafc', fontSize: '32px', fontWeight: 800, margin: 0 }}>{metrics?.avg_barber_rating || '—'}</p>
                                </div>
                                <div style={metricCard('#10b981')}>
                                    <p style={{ color: '#10b981', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>NPS Médio</p>
                                    <p style={{ color: '#f8fafc', fontSize: '32px', fontWeight: 800, margin: 0 }}>{metrics?.avg_nps || '—'}</p>
                                </div>
                                <div style={metricCard('#06b6d4')}>
                                    <p style={{ color: '#06b6d4', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Taxa Conclusão</p>
                                    <p style={{ color: '#f8fafc', fontSize: '32px', fontWeight: 800, margin: 0 }}>
                                        {metrics && metrics.total_sessions > 0
                                            ? `${Math.round((metrics.completed_sessions / metrics.total_sessions) * 100)}%`
                                            : '—'}
                                    </p>
                                </div>
                                <div style={metricCard('#f59e0b')}>
                                    <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Dispositivos</p>
                                    <p style={{ color: '#f8fafc', fontSize: '32px', fontWeight: 800, margin: 0 }}>{devices.filter(d => d.is_active).length}</p>
                                </div>
                            </div>

                            {/* Link do totem */}
                            <div style={card}>
                                <p style={{ color: '#94a3b8', fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>🔗 URL do Totem</p>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <code style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#6366f1', flex: 1, wordBreak: 'break-all' }}>
                                        {getTotemUrl()}
                                    </code>
                                    <button
                                        style={btnPrimary}
                                        onClick={() => { navigator.clipboard.writeText(getTotemUrl()); }}
                                    >
                                        📋 Copiar
                                    </button>
                                    <button style={btnPrimary} onClick={() => window.open(getTotemUrl(), '_blank')}>
                                        🚀 Abrir Totem
                                    </button>
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
                        <h3 style={{ color: '#f8fafc', fontWeight: 700, margin: 0 }}>Dispositivos Cadastrados ({devices.length})</h3>
                        <button style={btnPrimary} onClick={() => setShowAddDevice(v => !v)}>
                            {showAddDevice ? '✕ Cancelar' : '+ Novo Dispositivo'}
                        </button>
                    </div>

                    {showAddDevice && (
                        <div style={{ ...card, border: '1px solid rgba(99,102,241,0.3)' }}>
                            <h4 style={{ color: '#f8fafc', marginBottom: '16px' }}>Novo Dispositivo Totem</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Nome do Dispositivo *</label>
                                    <input style={input} placeholder="Ex: Recepção TV Principal" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Tema</label>
                                    <select style={select} value={newDeviceTheme} onChange={e => setNewDeviceTheme(e.target.value)}>
                                        <option value="default">Padrão (White-label)</option>
                                        <option value="sanchez">Sanchez Barber (Preto/Dourado)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>Timeout (segundos)</label>
                                    <input style={input} type="number" min={10} max={120} value={newDeviceTimeout} onChange={e => setNewDeviceTimeout(Number(e.target.value))} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button style={btnPrimary} disabled={addingDevice || !newDeviceName.trim()} onClick={handleAddDevice}>
                                    {addingDevice ? 'Cadastrando...' : '✅ Cadastrar Dispositivo'}
                                </button>
                            </div>
                        </div>
                    )}

                    {devices.length === 0 ? (
                        <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
                            <p style={{ fontSize: '40px', marginBottom: '12px' }}>🖥️</p>
                            <p style={{ color: '#64748b' }}>Nenhum dispositivo cadastrado. Adicione seu primeiro totem!</p>
                        </div>
                    ) : (
                        devices.map(device => (
                            <div key={device.id} style={{ ...card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '20px' }}>🖥️</span>
                                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>{device.name}</span>
                                        <span style={{
                                            background: device.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                            color: device.is_active ? '#10b981' : '#ef4444',
                                            borderRadius: '6px',
                                            padding: '2px 8px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                        }}>
                                            {device.is_active ? '● Ativo' : '○ Inativo'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>Tema: <strong style={{ color: '#94a3b8' }}>{device.theme}</strong></span>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>Timeout: <strong style={{ color: '#94a3b8' }}>{device.timeout_seconds}s</strong></span>
                                        {device.last_seen_at && (
                                            <span style={{ color: '#64748b', fontSize: '12px' }}>
                                                Visto: <strong style={{ color: '#94a3b8' }}>{new Date(device.last_seen_at).toLocaleString('pt-BR')}</strong>
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ marginTop: '8px' }}>
                                        <code style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', color: '#6366f1' }}>
                                            {getTotemUrl()}?device={device.id}
                                        </code>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => toggleDevice(device.id, device.is_active)}
                                        style={{ ...btnPrimary, background: device.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: device.is_active ? '#ef4444' : '#10b981', border: `1px solid ${device.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, fontSize: '12px', padding: '8px 14px' }}
                                    >
                                        {device.is_active ? 'Desativar' : 'Ativar'}
                                    </button>
                                    <button onClick={() => deleteDevice(device.id)} style={{ ...btnDanger, fontSize: '12px', padding: '8px 14px' }}>🗑️</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* METRICS TAB */}
            {activeTab === 'metrics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                        {[
                            { label: 'Agendamentos via Totem', value: metrics?.appointments_totem ?? 0, color: '#6366f1', icon: '🖥️' },
                            { label: 'Agendamentos via QR', value: metrics?.appointments_qr ?? 0, color: '#8b5cf6', icon: '📱' },
                            { label: 'Avaliações de Barbeiro', value: metrics?.feedback_barber_count ?? 0, color: '#fbbf24', icon: '⭐' },
                            { label: 'Pesquisas NPS', value: metrics?.feedback_shop_count ?? 0, color: '#10b981', icon: '📊' },
                            { label: 'Nota Média Barbeiro', value: metrics?.avg_barber_rating ? `${metrics.avg_barber_rating}/5` : '—', color: '#fbbf24', icon: '🌟' },
                            { label: 'NPS Médio Barbearia', value: metrics?.avg_nps ? `${metrics.avg_nps}/10` : '—', color: '#10b981', icon: '💚' },
                            { label: 'Sessões Iniciadas', value: metrics?.total_sessions ?? 0, color: '#06b6d4', icon: '🚀' },
                            {
                                label: 'Taxa de Conclusão',
                                value: metrics && metrics.total_sessions > 0
                                    ? `${Math.round((metrics.completed_sessions / metrics.total_sessions) * 100)}%`
                                    : '—',
                                color: '#f59e0b',
                                icon: '✅',
                            },
                        ].map((m, i) => (
                            <div key={i} style={{ ...card, textAlign: 'center', borderTop: `3px solid ${m.color}` }}>
                                <p style={{ fontSize: '28px', marginBottom: '8px', margin: '0 0 8px' }}>{m.icon}</p>
                                <p style={{ color: m.color, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{m.label}</p>
                                <p style={{ color: '#f8fafc', fontSize: '28px', fontWeight: 800, margin: 0 }}>{m.value}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ ...card }}>
                        <p style={{ color: '#94a3b8', fontWeight: 700, fontSize: '13px', marginBottom: '12px' }}>💡 Dica de Análise</p>
                        <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6 }}>
                            Uma <strong style={{ color: '#f8fafc' }}>taxa de conclusão acima de 70%</strong> indica boa usabilidade do totem.
                            Um <strong style={{ color: '#f8fafc' }}>NPS acima de 8</strong> indica alta lealdade dos clientes.
                            Compare agendamentos via <strong style={{ color: '#6366f1' }}>Totem</strong> vs <strong style={{ color: '#8b5cf6' }}>QR</strong> para saber qual canal seu público prefere.
                        </p>
                    </div>
                </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '520px' }}>
                    <div style={card}>
                        <h3 style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '16px' }}>⚙️ Configurações do Add-on</h3>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                                🎨 Tema Visual
                            </label>
                            <select style={select} value={settingsTheme} onChange={e => setSettingsTheme(e.target.value)}>
                                <option value="default">Padrão (White-label) — Neutro e minimalista</option>
                                <option value="sanchez">Sanchez Barber — Preto e Dourado, tom "Chefe"</option>
                            </select>
                            <p style={{ color: '#475569', fontSize: '12px', marginTop: '6px' }}>
                                Define o tema visual do totem e do mini-portal QR para todos os dispositivos.
                            </p>
                        </div>

                        {settingsTheme === 'sanchez' && (
                            <div style={{ background: 'rgba(212,160,23,0.06)', border: '1px solid rgba(212,160,23,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
                                <p style={{ color: '#c9a227', fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }}>👑 Tema Sanchez Barber</p>
                                <p style={{ color: '#6b5a2a', fontSize: '12px', margin: 0 }}>Visual premium: preto, dourado e branco. Texto no tom do "Chefe".</p>
                            </div>
                        )}

                        <button style={btnPrimary} disabled={saving} onClick={handleSaveSettings}>
                            {saving ? 'Salvando...' : '💾 Salvar Configurações'}
                        </button>
                    </div>

                    <div style={card}>
                        <h4 style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '12px' }}>ℹ️ Informações do Add-on</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[
                                { label: 'Status', value: addon?.status === 'enabled' ? '✅ Ativo' : '❌ Inativo' },
                                { label: 'Dispositivos', value: `${devices.length} cadastrado(s)` },
                                { label: 'Tema atual', value: addon?.kiosk_theme || 'default' },
                                { label: 'Max. dispositivos', value: addon?.max_devices || 1 },
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span style={{ color: '#64748b', fontSize: '13px' }}>{item.label}</span>
                                    <span style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600 }}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KioskAdmin;
