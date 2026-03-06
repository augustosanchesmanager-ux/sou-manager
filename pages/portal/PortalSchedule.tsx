import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { usePortalAuth } from '../../components/PortalAuthProvider';
import { ChevronLeft, Scissors, User, Calendar as CalendarIcon, Clock, CheckCircle } from 'lucide-react';

interface Service { id: string; name: string; price: number; duration_minutes: number; }
interface Barber { id: string; name: string; }
interface Slot { time: string; datetime: string; }

type ScheduleStep = 'service' | 'barber' | 'datetime' | 'confirm' | 'success';

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

const PortalSchedule: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const navigate = useNavigate();
    const { token, client, tenantId: authTenantId } = usePortalAuth();

    const [tenant, setTenant] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [step, setStep] = useState<ScheduleStep>('service');
    const [services, setServices] = useState<Service[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);

    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

    // Days for the week slider
    const next7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() + i); return d;
    });

    useEffect(() => {
        if (!token || !client) {
            navigate(`/c/${tenantSlug}/login`, { replace: true });
            return;
        }
        loadInitialData();
    }, [tenantSlug, token]);

    useEffect(() => {
        if (step === 'datetime' && tenant) {
            generateSlots();
        }
    }, [step, selectedBarber, selectedDate, tenant]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            // 1. Get tenant
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('id, name, slug')
                .eq('slug', tenantSlug)
                .single();

            if (!tenantData) throw new Error('Tenant não encontrado');

            // 2. Addons limits
            const { data: addon } = await supabase
                .from('tenant_addons')
                .select('status, limits')
                .eq('tenant_id', tenantData.id)
                .eq('addon_key', 'CLIENT_PORTAL')
                .single();

            if (!addon || addon.status !== 'enabled') throw new Error('Portal desativado');
            setTenant({ ...tenantData, theme: addon.limits?.theme || 'default' });

            // 3. Services and Barbers base load
            const [svcRes, bbrRes] = await Promise.all([
                supabase.from('services').select('id, name, price, duration_minutes').eq('tenant_id', tenantData.id).eq('is_active', true).order('name'),
                supabase.from('staff').select('id, name').eq('tenant_id', tenantData.id).eq('is_active', true).order('name')
            ]);

            setServices(svcRes.data || []);
            setBarbers(bbrRes.data || []);

        } catch (e: any) {
            console.error(e);
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const generateSlots = async () => {
        if (!tenant || !selectedService) return;
        setSubmitting(true);

        try {
            const duration = selectedService.duration_minutes || 30;
            const dateStr = selectedDate.toISOString().split('T')[0];

            let query = supabase
                .from('appointments')
                .select('start_time, end_time')
                .eq('tenant_id', tenant.id)
                .gte('start_time', `${dateStr}T00:00:00`)
                .lt('start_time', `${dateStr}T23:59:59`)
                .in('status', ['scheduled', 'confirmed']);

            if (selectedBarber && selectedBarber.id !== 'any') {
                query = query.eq('staff_id', selectedBarber.id);
            }

            const { data: booked } = await query;
            const bookedRanges = (booked || []).map(a => ({ start: new Date(a.start_time), end: new Date(a.end_time) }));

            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const startHour = isToday ? Math.max(9, new Date().getHours() + 1) : 9;
            const endHour = 20;

            const generated: Slot[] = [];
            for (let h = startHour; h < endHour; h++) {
                for (let m = 0; m < 60; m += 30) {
                    const dt = new Date(selectedDate);
                    dt.setHours(h, m, 0, 0);
                    const dtEnd = addMinutes(dt, duration);
                    if (dtEnd.getHours() >= endHour) break;

                    const conflict = bookedRanges.some(r => dt < r.end && dtEnd > r.start);
                    if (!conflict) {
                        generated.push({ time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, datetime: dt.toISOString() });
                    }
                }
            }
            setSlots(generated);
        } catch (error) {
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirm = async () => {
        if (!tenant || !client || !selectedService || !selectedSlot) return;
        setSubmitting(true);

        try {
            const start = new Date(selectedSlot.datetime);
            const end = addMinutes(start, selectedService.duration_minutes);

            await supabase.from('appointments').insert({
                tenant_id: tenant.id,
                client_id: client.id,
                staff_id: selectedBarber && selectedBarber.id !== 'any' ? selectedBarber.id : null,
                service_id: selectedService.id,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                status: 'scheduled',
                source: 'client_portal',
                channel: 'home_portal',
                notes: `Agendado via Portal do Cliente`
            });

            setStep('success');
        } catch (e) {
            console.error(e);
            alert('Erro ao agendar horário.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !tenant) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
        );
    }

    const isSanchez = tenant.theme === 'sanchez';

    const getThemeStyles = () => {
        if (isSanchez) return {
            bg: 'bg-[#090909]',
            text: 'text-white',
            textSub: 'text-white/60',
            primary: 'text-[#d4a017]',
            card: 'bg-white/[0.03] border-white/5',
            cardSelected: 'bg-[#d4a017]/10 border-[#d4a017]/30 ring-1 ring-[#d4a017]/30',
            btnPrimary: 'bg-[#d4a017] text-black hover:bg-[#c9a227]'
        };
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
            <header className={`px-6 py-5 flex items-center gap-4 sticky top-0 z-20 ${isSanchez ? 'bg-[#090909]/90 border-b border-[#d4a017]/20 backdrop-blur-md' : 'bg-[#0f172a]/90 border-b border-white/5 backdrop-blur-md'}`}>
                {step === 'success' ? (
                    <div className="w-8 h-8 flex items-center justify-center"></div> // spacer
                ) : (
                    <button
                        onClick={() => {
                            if (step === 'service') navigate(`/c/${tenantSlug}/app`);
                            if (step === 'barber') setStep('service');
                            if (step === 'datetime') setStep('barber');
                            if (step === 'confirm') setStep('datetime');
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSanchez ? 'hover:bg-white/5 text-[#d4a017]' : 'hover:bg-white/5 text-slate-300'}`}
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}

                <div className="flex-1 text-center pr-10">
                    <p className={`text-[10px] uppercase font-bold tracking-widest ${t.primary}`}>NOVO AGENDAMENTO</p>
                    <h1 className="font-bold">
                        {step === 'service' && 'Escolha o Serviço'}
                        {step === 'barber' && 'Escolha o Profissional'}
                        {step === 'datetime' && 'Data e Horário'}
                        {step === 'confirm' && 'Confirmar Resumo'}
                        {step === 'success' && 'Tudo Certo!'}
                    </h1>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 pb-24 overflow-y-auto">

                {step === 'service' && (
                    <div className="flex flex-col gap-3">
                        {services.map(svc => (
                            <button
                                key={svc.id}
                                onClick={() => { setSelectedService(svc); setStep('barber'); }}
                                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${selectedService?.id === svc.id ? t.cardSelected : t.card
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSanchez ? 'bg-[#1a180f] text-[#d4a017]' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                        <Scissors size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{svc.name}</h3>
                                        <p className={`text-sm ${t.textSub}`}>~ {svc.duration_minutes} min</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(svc.price)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'barber' && (
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => { setSelectedBarber({ id: 'any', name: 'Qualquer Profissional' }); setStep('datetime'); }}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${selectedBarber?.id === 'any' ? t.cardSelected : t.card
                                }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSanchez ? 'bg-[#1a180f] text-[#d4a017]' : 'bg-slate-800 text-slate-400'}`}>
                                <User size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Qualquer Profissional</h3>
                                <p className={`text-sm ${t.textSub}`}>O primeiro disponível</p>
                            </div>
                        </button>
                        {barbers.map(bbr => (
                            <button
                                key={bbr.id}
                                onClick={() => { setSelectedBarber(bbr); setStep('datetime'); }}
                                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${selectedBarber?.id === bbr.id ? t.cardSelected : t.card
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSanchez ? 'bg-[#1a180f] text-[#d4a017]' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                    <User size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{bbr.name}</h3>
                                    <p className={`text-sm ${t.textSub}`}>Especialista</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'datetime' && (
                    <div className="flex flex-col gap-6">
                        {/* Date Slider */}
                        <div>
                            <h3 className="font-bold mb-3">Selecione o dia</h3>
                            <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
                                {next7Days.map((d, i) => {
                                    const isSelected = selectedDate.getDate() === d.getDate() && selectedDate.getMonth() === d.getMonth();
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedDate(d); setSelectedSlot(null); }}
                                            className={`shrink-0 snap-center w-20 py-3 rounded-2xl border transition-all flex flex-col items-center justify-center ${isSelected ? t.cardSelected : t.card
                                                }`}
                                        >
                                            <span className={`text-xs uppercase font-bold mb-1 ${isSelected ? t.primary : t.textSub}`}>
                                                {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                                            </span>
                                            <span className="text-xl font-black">{d.getDate()}</span>
                                            <span className={`text-[10px] ${t.textSub}`}>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Slots Grid */}
                        <div>
                            <h3 className="font-bold mb-3 flex items-center gap-2">
                                <Clock size={16} className={t.primary} />
                                Horários Disponíveis
                            </h3>

                            {submitting ? (
                                <div className="text-center py-8">
                                    <div className={`w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto ${isSanchez ? 'border-[#d4a017]' : 'border-indigo-500'}`} />
                                    <p className={`text-xs mt-3 ${t.textSub}`}>Carregando horários...</p>
                                </div>
                            ) : slots.length === 0 ? (
                                <div className={`text-center py-10 rounded-xl border ${t.card}`}>
                                    <CalendarIcon size={32} className={`mx-auto mb-3 opacity-50 ${t.textSub}`} />
                                    <p className={`font-bold ${t.textSub}`}>Nenhum horário livre.</p>
                                    <p className={`text-xs mt-1 ${t.textSub}`}>Tente selecionar outro dia ou profissional.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    {slots.map((slot, i) => {
                                        const isSelected = selectedSlot?.datetime === slot.datetime;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedSlot(slot)}
                                                className={`py-3 rounded-xl border transition-all text-center font-bold ${isSelected ? t.btnPrimary : t.card
                                                    }`}
                                            >
                                                {slot.time}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 'confirm' && selectedService && selectedSlot && (
                    <div className="flex flex-col gap-6">
                        <div className={`p-6 rounded-2xl border ${t.card}`}>
                            <h3 className="font-bold text-xl mb-6">Confirme as informações</h3>

                            <div className="flex flex-col gap-5">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSanchez ? 'bg-[#1a180f] text-[#d4a017]' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                        <Scissors size={18} />
                                    </div>
                                    <div>
                                        <p className={`text-xs uppercase font-bold tracking-widest ${t.textSub}`}>SERVIÇO</p>
                                        <p className="font-bold">{selectedService.name}</p>
                                        <p className={`text-xs ${t.primary}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedService.price)}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSanchez ? 'bg-[#1a180f] text-[#d4a017]' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <p className={`text-xs uppercase font-bold tracking-widest ${t.textSub}`}>PROFISSIONAL</p>
                                        <p className="font-bold">{selectedBarber?.name || 'Qualquer um'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSanchez ? 'bg-[#1a180f] text-[#d4a017]' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                        <CalendarIcon size={18} />
                                    </div>
                                    <div>
                                        <p className={`text-xs uppercase font-bold tracking-widest ${t.textSub}`}>DATA E HORA</p>
                                        <p className="font-bold">{new Date(selectedSlot.datetime).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} • {selectedSlot.time}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleConfirm}
                            disabled={submitting}
                            className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center ${t.btnPrimary} ${submitting ? 'opacity-70' : ''}`}
                        >
                            {submitting ? 'Confirmando...' : 'Confirmar Agendamento'}
                        </button>
                    </div>
                )}

                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center text-center mt-12 gap-6 p-6">
                        <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.3)] ${t.cardSelected}`}>
                            <CheckCircle size={48} className={t.primary} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black mb-2">Agendado!</h2>
                            <p className={t.textSub}>Seu horário foi reservado com sucesso. Te esperamos na {tenant?.name}.</p>
                        </div>
                        <button
                            onClick={() => navigate(`/c/${tenantSlug}/app`)}
                            className={`w-full py-4 rounded-xl font-bold mt-4 shadow-lg transition-all ${t.btnPrimary}`}
                        >
                            Ir para o Início
                        </button>
                    </div>
                )}
            </main>

            {/* Bottom Floating Action Area for steps that need it */}
            {step === 'datetime' && selectedSlot && (
                <div className={`fixed bottom-0 left-0 w-full p-6 border-t z-20 ${isSanchez ? 'bg-[#090909]/90 border-[#d4a017]/20 backdrop-blur-md' : 'bg-[#0f172a]/90 border-white/5 backdrop-blur-md'}`}>
                    <button
                        onClick={() => setStep('confirm')}
                        className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center ${t.btnPrimary}`}
                    >
                        Avançar (Resumo)
                    </button>
                </div>
            )}
        </div>
    );
};

export default PortalSchedule;
