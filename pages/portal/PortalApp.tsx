import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { usePortalAuth } from '../../components/PortalAuthProvider';
import { LogOut, Calendar, Clock, User, AlertCircle, X, Star } from 'lucide-react';

const PortalApp: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const navigate = useNavigate();
    const { token, client, tenantId, logout } = usePortalAuth();

    const [tenant, setTenant] = useState<any>(null);
    const [upcomingAppt, setUpcomingAppt] = useState<any>(null);
    const [pastAppts, setPastAppts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Action Modal State
    const [actionAppt, setActionAppt] = useState<any>(null);
    const [actionType, setActionType] = useState<'cancel' | 'reschedule' | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Review Modal State
    const [reviewAppt, setReviewAppt] = useState<any>(null);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [reviewLoading, setReviewLoading] = useState(false);

    useEffect(() => {
        if (!token || !client) {
            navigate(`/c/${tenantSlug}/login`, { replace: true });
            return;
        }
        loadPortalData();
    }, [tenantSlug, token]);

    const loadPortalData = async () => {
        try {
            // 1. Get tenant info
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('id, name, slug')
                .eq('slug', tenantSlug)
                .single();

            if (!tenantData) throw new Error('Tenant não encontrado');

            // 2. Access Limits
            const { data: addon } = await supabase
                .from('tenant_addons')
                .select('status, limits')
                .eq('tenant_id', tenantData.id)
                .eq('addon_key', 'CLIENT_PORTAL')
                .single();

            if (!addon || addon.status !== 'enabled') throw new Error('Portal desativado');
            setTenant({ ...tenantData, theme: addon.limits?.theme || 'default', limits: addon.limits });

            // 3. Get Appointments (Upcoming & Past)
            // Wait, we need to pass a valid Authorization header if we are using the custom jwt!
            // But since the frontend uses the normal Supabase client (which uses anon key),
            // if RLS blocks it, we might get an empty array.
            const now = new Date().toISOString();

            // Upcoming
            const { data: upcoming } = await supabase
                .from('appointments')
                .select(`
                    id, start_time, end_time, status, service:services(name, price), staff:staff(name)
                `)
                .eq('tenant_id', tenantData.id)
                .eq('client_id', client.id)
                .in('status', ['scheduled', 'confirmed'])
                .gte('start_time', now)
                .order('start_time', { ascending: true })
                .limit(1)
                .single();

            if (upcoming) setUpcomingAppt(upcoming);

            // History
            const { data: history } = await supabase
                .from('appointments')
                .select(`
                    id, start_time, status, service:services(name), staff:staff(name)
                `)
                .eq('tenant_id', tenantData.id)
                .eq('client_id', client.id)
                .lt('start_time', now)
                .order('start_time', { ascending: false })
                .limit(5);

            if (history) setPastAppts(history);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate(`/c/${tenantSlug}`);
    };

    const checkCanAction = (apptTime: string, limitHours: number) => {
        const apptDate = new Date(apptTime);
        const now = new Date();
        const diffHours = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return diffHours >= limitHours;
    };

    const handleActionClick = (type: 'cancel' | 'reschedule') => {
        const limitHours = type === 'cancel'
            ? (tenant.limits?.cancellation_window_hours || 0)
            : (tenant.limits?.reschedule_window_hours || 0);

        if (!checkCanAction(upcomingAppt.start_time, limitHours)) {
            alert(`Para ${type === 'cancel' ? 'cancelar' : 'reagendar'}, a antecedência exigida é de ${limitHours}h.\nPor favor, entre em contato com a barbearia.`);
            return;
        }

        setActionType(type);
        setActionAppt(upcomingAppt);
    };

    const confirmAction = async () => {
        if (!actionAppt || !actionType) return;
        setActionLoading(true);
        try {
            await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', actionAppt.id);

            if (actionType === 'reschedule') {
                navigate(`/c/${tenantSlug}/app/schedule`);
            } else {
                setUpcomingAppt(null); // Clear optimisticly
                setActionType(null);
                setActionAppt(null);
                setTimeout(loadPortalData, 500); // Reload
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao processar sua solicitação.");
        } finally {
            setActionLoading(false);
        }
    };

    const submitReview = async () => {
        if (!reviewAppt || rating === 0) return;
        setReviewLoading(true);
        try {
            // First submit to feedback_barber
            await supabase.from('feedback_barber').insert({
                tenant_id: tenant.id,
                client_id: client.id,
                barber_id: reviewAppt.staff?.id || null,
                rating,
                comment,
                source_channel: 'app'
            });

            // Mark appointment as 'completed' so it doesn't get reviewed again (or handled differently based on business logic)
            // Or just alert success since we don't have a specific column to hide reviewed appts yet.

            setReviewAppt(null);
            setRating(0);
            setComment('');
            alert('Avaliação enviada com sucesso! Muito obrigado.');
            // Optionally reload past appointments to hide the review button if we add a 'is_reviewed' flag later
        } catch (error) {
            console.error(error);
            alert('Erro ao enviar avaliação.');
        } finally {
            setReviewLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
        </div>
    );

    if (error || !tenant) return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center flex-col gap-4 text-center px-6">
            <span className="text-4xl">⚠️</span>
            <p className="text-slate-100 font-bold">{error || 'Acesso negado'}</p>
            <button onClick={handleLogout} className="text-indigo-400 hover:text-indigo-300">Voltar ao Início</button>
        </div>
    );

    const isSanchez = tenant.theme === 'sanchez';

    const getThemeStyles = () => {
        if (isSanchez) {
            return {
                bg: 'bg-[#090909]',
                text: 'text-white',
                textSub: 'text-[#c9a227]',
                primary: 'text-[#d4a017]',
                card: 'bg-gradient-to-br from-[#111108] to-[#090909] border-[#d4a017]/30',
                cardSelected: 'bg-[#1a180f] border-[#d4a017]/30 ring-1 ring-[#d4a017]/30',
                btnPrimary: 'bg-[#d4a017] text-black hover:bg-[#b8860b]'
            };
        }
        return {
            bg: 'bg-[#0f172a]',
            text: 'text-slate-100',
            textSub: 'text-slate-400',
            primary: 'text-indigo-400',
            card: 'bg-white/[0.03] border-white/10',
            cardSelected: 'bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/30',
            btnPrimary: 'bg-indigo-600 text-white hover:bg-indigo-700'
        };
    };

    const t = getThemeStyles();

    return (
        <div className={`min-h-screen flex flex-col ${t.bg} ${t.text}`} style={{ fontFamily: isSanchez ? "'Playfair Display', serif" : "'Inter', sans-serif" }}>

            {/* Header */}
            <header className={`px-6 py-5 flex items-center justify-between sticky top-0 z-20 ${isSanchez ? 'bg-[#090909]/90 border-b border-[#d4a017]/20 backdrop-blur-md' : 'bg-[#0f172a]/90 border-b border-white/5 backdrop-blur-md'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg ${isSanchez ? 'bg-[#1a180f] border border-[#d4a017]/30 text-[#d4a017]' : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400'
                        }`}>
                        ✂️
                    </div>
                    <div>
                        <p className={`text-[10px] uppercase font-bold tracking-widest ${isSanchez ? 'text-[#c9a227]' : 'text-indigo-400'}`}>Agenda de</p>
                        <h1 className="font-bold leading-tight">{tenant.name}</h1>
                    </div>
                </div>
                <button onClick={handleLogout} className={`p-2 rounded-full transition-colors ${isSanchez ? 'hover:bg-white/5 text-[#c9a227]' : 'hover:bg-white/5 text-slate-400'}`}>
                    <LogOut size={20} />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 pb-24 overflow-y-auto">
                <h2 className="text-2xl font-bold mb-6">
                    {isSanchez ? `Bem-vindo, Chefe ${client?.name?.split(' ')[0] || ''}` : `Olá, ${client?.name?.split(' ')[0] || client?.phone}`}
                </h2>

                {/* Next Appointment Card */}
                {upcomingAppt ? (
                    <div className={`w-full p-5 rounded-2xl mb-8 border relative overflow-hidden ${isSanchez ? 'bg-gradient-to-br from-[#111108] to-[#090909] border-[#d4a017]/30' : 'bg-white/[0.03] border-white/10'
                        }`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 ${isSanchez ? 'bg-[#d4a017]/10' : 'bg-indigo-500/20'}`} />

                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="flex items-center gap-2">
                                <Clock size={16} className={isSanchez ? 'text-[#d4a017]' : 'text-indigo-400'} />
                                <span className="text-sm font-semibold uppercase tracking-wider">Próximo Agendamento</span>
                            </div>
                        </div>

                        <div className="relative z-10">
                            <h3 className={`text-xl font-bold mb-1 ${isSanchez ? 'text-white' : 'text-slate-100'}`}>
                                {upcomingAppt.service?.name || 'Serviço'}
                            </h3>
                            <p className={`text-sm mb-4 ${isSanchez ? 'text-[#c9a227]' : 'text-slate-400'}`}>
                                com {upcomingAppt.staff?.name || 'Profissional'}
                            </p>

                            <div className={`p-4 rounded-xl flex items-center justify-between mb-4 ${isSanchez ? 'bg-white/5 border border-white/10' : 'bg-slate-800/50 border border-slate-700'
                                }`}>
                                <div>
                                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">DATA E HORA</p>
                                    <p className="font-bold">
                                        {new Date(upcomingAppt.start_time).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} • {new Date(upcomingAppt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">VALOR</p>
                                    <p className="font-bold">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(upcomingAppt.service?.price || 0)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleActionClick('reschedule')}
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm shadow-md transition-all ${isSanchez ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-700 text-white hover:bg-slate-600'
                                        }`}>
                                    Reagendar
                                </button>
                                <button
                                    onClick={() => handleActionClick('cancel')}
                                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${isSanchez ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                        }`}>
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={`w-full p-5 rounded-2xl mb-8 border relative overflow-hidden flex flex-col items-center text-center ${isSanchez ? 'bg-gradient-to-br from-[#111108] to-[#090909] border-[#d4a017]/30' : 'bg-white/[0.03] border-white/10'
                        }`}>
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 ${isSanchez ? 'bg-[#d4a017]/10' : 'bg-indigo-500/20'}`} />
                        <Calendar size={32} className={`mb-3 ${isSanchez ? 'text-[#c9a227]' : 'text-slate-500'}`} />
                        <p className={`text-sm mb-4 ${isSanchez ? 'text-[#c9a227]' : 'text-slate-400'}`}>Você não possui agendamentos futuros.</p>

                        <button
                            onClick={() => navigate(`/c/${tenantSlug}/app/schedule`)}
                            className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all ${isSanchez ? 'bg-[#d4a017] text-black hover:bg-[#b8860b]' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                        >
                            Agendar Horário
                        </button>
                    </div>
                )}

                {/* History */}
                <h3 className="text-lg font-bold mb-4">Últimos Atendimentos</h3>

                {pastAppts.length === 0 ? (
                    <div className={`w-full p-4 rounded-xl border flex items-center justify-center h-24 ${isSanchez ? 'bg-white/[0.02] border-white/5 text-[#c9a227]/50' : 'bg-white/[0.02] border-white/5 text-slate-500'
                        }`}>
                        <p className="text-sm">Nenhum histórico encontrado.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {pastAppts.map(appt => (
                            <div key={appt.id} className={`w-full p-4 rounded-xl border flex items-center justify-between ${isSanchez ? 'bg-white/[0.02] border-white/5' : 'bg-white/[0.02] border-white/5'
                                }`}>
                                <div>
                                    <p className={`font-bold mb-0.5 ${isSanchez ? 'text-white' : 'text-slate-200'}`}>{appt.service?.name || 'Serviço'}</p>
                                    <p className={`text-xs ${isSanchez ? 'text-[#c9a227]/70' : 'text-slate-400'}`}>
                                        com {appt.staff?.name || 'Profissional'} • {new Date(appt.start_time).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setReviewAppt(appt)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${isSanchez ? 'bg-[#d4a017]/10 text-[#d4a017] hover:bg-[#d4a017]/20' : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                                        }`}>
                                    Avaliar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Tab Bar */}
            <nav className={`fixed bottom-0 w-full px-6 py-4 flex items-center justify-around border-t z-20 ${isSanchez ? 'bg-[#090909] border-[#d4a017]/20 pb-safe' : 'bg-[#0f172a] border-white/5 pb-safe'
                }`}>
                <button
                    onClick={() => navigate(`/c/${tenantSlug}/app/schedule`)}
                    className={`flex flex-col items-center gap-1 transition-colors relative -mt-6 p-4 rounded-full border shadow-lg ${isSanchez ? 'bg-[#1a180f] text-[#d4a017] border-[#d4a017]/30' : 'bg-indigo-600 text-white border-indigo-500/30 glow-indigo'
                        }`}
                >
                    <Calendar size={24} />
                    <span className="text-[10px] font-semibold text-center mt-1 w-14 leading-tight absolute -bottom-5">Agendar</span>
                </button>
                <button className={`flex flex-col items-center gap-1 transition-colors ${isSanchez ? 'text-white/40 hover:text-white/80' : 'text-slate-500 hover:text-slate-300'}`}>
                    <User size={22} />
                    <span className="text-[10px] font-semibold">Perfil</span>
                </button>
            </nav>

            {/* Action Modal */}
            {actionType && actionAppt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                    <div className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl relative ${isSanchez ? 'bg-[#1a180f] border-[#d4a017] text-white' : 'bg-slate-800 border-slate-700 text-slate-100'}`}>
                        <button
                            onClick={() => { setActionType(null); setActionAppt(null); }}
                            className={`absolute top-4 right-4 p-2 rounded-full ${isSanchez ? 'hover:bg-white/5 text-white/50' : 'hover:bg-slate-700 text-slate-400'}`}
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center mt-2 mb-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isSanchez ? 'bg-[#d4a017]/10 text-[#d4a017]' : 'bg-rose-500/10 text-rose-400'}`}>
                                {actionType === 'reschedule' ? <Calendar size={32} /> : <AlertCircle size={32} />}
                            </div>
                            <h3 className="text-xl font-bold mb-2">
                                {actionType === 'reschedule' ? 'Reagendar Horário?' : 'Cancelar Horário?'}
                            </h3>
                            <p className={`text-sm ${isSanchez ? 'text-white/60' : 'text-slate-400'}`}>
                                {actionType === 'reschedule'
                                    ? 'Seu horário atual será cancelado e você será levado para escolher a nova data e horário.'
                                    : 'Tem certeza que deseja cancelar? Você perderá sua reserva e precisará refazer o agendamento.'}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={confirmAction}
                                disabled={actionLoading}
                                className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-center ${actionType === 'reschedule'
                                    ? (isSanchez ? 'bg-[#d4a017] text-black hover:bg-[#b8860b]' : 'bg-indigo-600 text-white hover:bg-indigo-700')
                                    : 'bg-rose-600 text-white hover:bg-rose-700'
                                    }`}
                            >
                                {actionLoading ? 'Aguarde...' : (actionType === 'reschedule' ? 'Sim, Escolher Nova Data' : 'Sim, Cancelar Horário')}
                            </button>
                            <button
                                onClick={() => { setActionType(null); setActionAppt(null); }}
                                className={`w-full py-4 rounded-xl font-bold transition-all ${isSanchez ? 'bg-transparent text-white/60 hover:text-white' : 'bg-transparent text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {reviewAppt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
                    <div className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl relative ${isSanchez ? 'bg-[#1a180f] border-[#d4a017] text-white' : 'bg-slate-800 border-slate-700 text-slate-100'}`}>
                        <button
                            onClick={() => { setReviewAppt(null); setRating(0); setComment(''); }}
                            className={`absolute top-4 right-4 p-2 rounded-full ${isSanchez ? 'hover:bg-white/5 text-white/50' : 'hover:bg-slate-700 text-slate-400'}`}
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center mt-2 mb-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isSanchez ? 'bg-[#d4a017]/10 text-[#d4a017]' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                <Star size={32} className="fill-current" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">Avalie o Atendimento</h3>
                            <p className={`text-sm ${isSanchez ? 'text-white/60' : 'text-slate-400'}`}>Como foi seu corte com o barbeiro {reviewAppt.staff?.name || 'Profissional'}?</p>
                        </div>

                        <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`p-2 transition-transform hover:scale-110 ${rating >= star ? (isSanchez ? 'text-[#d4a017]' : 'text-amber-400') : (isSanchez ? 'text-white/20' : 'text-slate-600')}`}
                                >
                                    <Star size={36} className={`${rating >= star ? 'fill-current' : ''}`} />
                                </button>
                            ))}
                        </div>

                        <div className="mb-6">
                            <textarea
                                disabled={reviewLoading}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="Deixe um elogio ou sugestão... (Opcional)"
                                className={`w-full p-4 rounded-xl border outline-none min-h-[100px] resize-none text-sm transition-colors ${isSanchez
                                    ? 'bg-white/5 border-white/10 focus:border-[#d4a017] text-white placeholder-white/40'
                                    : 'bg-slate-900/50 border-slate-700 focus:border-indigo-500 text-slate-100 placeholder-slate-500'
                                    }`}
                            />
                        </div>

                        <button
                            onClick={submitReview}
                            disabled={reviewLoading || rating === 0}
                            className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-center ${rating === 0
                                ? 'opacity-50 cursor-not-allowed ' + (isSanchez ? 'bg-white/10 text-white/50' : 'bg-slate-700 text-slate-400')
                                : (isSanchez ? 'bg-[#d4a017] text-black hover:bg-[#b8860b]' : 'bg-indigo-600 text-white hover:bg-indigo-700')
                                }`}
                        >
                            {reviewLoading ? 'Enviando...' : 'Enviar Avaliação'}
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default PortalApp;
