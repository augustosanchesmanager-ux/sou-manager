import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';

const PortalLanding: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const navigate = useNavigate();
    const [tenant, setTenant] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!tenantSlug) { setError('Barbearia não informada.'); setLoading(false); return; }
        loadTenant();
    }, [tenantSlug]);

    const loadTenant = async () => {
        try {
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('id, name, slug')
                .eq('slug', tenantSlug)
                .single();

            if (!tenantData) { setError('Barbearia não encontrada.'); setLoading(false); return; }

            const { data: addon } = await supabase
                .from('tenant_addons')
                .select('status, limits')
                .eq('tenant_id', tenantData.id)
                .eq('addon_key', 'CLIENT_PORTAL')
                .single();

            if (!addon || addon.status !== 'enabled') {
                setError('Portal indisponível no momento.');
                setLoading(false);
                return;
            }

            setTenant({
                ...tenantData,
                theme: addon.limits?.theme || 'default',
            });
        } catch (e) {
            setError('Erro ao carregar.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center flex-col gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
        </div>
    );

    if (error || !tenant) return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center flex-col gap-3 text-center px-6">
            <span className="text-4xl">⚠️</span>
            <p className="text-slate-100 text-lg font-bold">Acesso Indisponível</p>
            <p className="text-slate-400 text-sm max-w-sm">{error}</p>
        </div>
    );

    const isSanchez = tenant.theme === 'sanchez';

    return (
        <div className={`min-h-screen flex flex-col ${isSanchez ? 'bg-[#090909]' : 'bg-[#0f172a]'}`} style={{ fontFamily: isSanchez ? "'Playfair Display', serif" : "'Inter', sans-serif" }}>
            {/* Background Details */}
            <div className="absolute top-0 w-full h-64 opacity-20 pointer-events-none" style={{
                background: isSanchez
                    ? 'radial-gradient(circle at 50% 0%, #d4a017 0%, transparent 70%)'
                    : 'radial-gradient(circle at 50% 0%, #6366f1 0%, transparent 70%)'
            }} />

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10 text-center">
                {/* Logo / Avatar */}
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-xl ${isSanchez ? 'bg-[#1a180f] border border-[#d4a017]/30 text-[#d4a017]' : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400'
                    }`}>
                    ✂️
                </div>

                <h1 className={`text-3xl font-bold mb-2 ${isSanchez ? 'text-white' : 'text-slate-100'}`}>
                    {tenant.name}
                </h1>

                <p className={`text-base mb-12 max-w-xs ${isSanchez ? 'text-[#c9a227]' : 'text-slate-400'}`}>
                    {isSanchez
                        ? 'Agende o seu próximo horário no conforto de casa, Chefe.'
                        : 'Agende seu serviço a qualquer momento, rápido e fácil.'}
                </p>

                <button
                    onClick={() => navigate(`/c/${tenant.slug}/login`)}
                    className="w-full max-w-xs py-4 px-6 rounded-2xl flex items-center justify-center gap-2 text-white font-bold text-lg shadow-lg"
                    style={{
                        background: isSanchez
                            ? 'linear-gradient(135deg, #d4a017, #b8860b)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: isSanchez ? '#000' : '#fff',
                        transition: 'transform 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Acessar Agenda 📅
                </button>
            </div>

            <footer className="py-6 text-center z-10">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Desenvolvido por SOU MANA.GER
                </p>
            </footer>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
            `}</style>
        </div>
    );
};

export default PortalLanding;
