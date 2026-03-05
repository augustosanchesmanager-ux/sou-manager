import React, { useEffect, useState } from 'react';
import { useKioskTheme } from '../KioskThemeProvider';
import { supabase } from '../../../services/supabaseClient';

interface Client { id: string; name: string; phone: string; }
interface Service { id: string; name: string; price: number; duration_minutes: number; }
interface Barber { id: string; name: string; specialty?: string; }
interface Slot { time: string; datetime: string; }

interface KioskScheduleProps {
    tenantId: string;
    client: Client;
    channel: 'totem' | 'qr';
    sessionId?: string;
    onComplete: () => void;
    onBack: () => void;
}

type ScheduleStep = 'service' | 'barber' | 'datetime' | 'confirm' | 'success';

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);
const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

const KioskSchedule: React.FC<KioskScheduleProps> = ({ tenantId, client, channel, sessionId, onComplete, onBack }) => {
    const { theme } = useKioskTheme();

    const [step, setStep] = useState<ScheduleStep>('service');
    const [services, setServices] = useState<Service[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
    const [loading, setLoading] = useState(false);

    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() + i); return d;
    });

    useEffect(() => { loadServices(); }, []);
    useEffect(() => { if (step === 'datetime') generateSlots(); }, [step, selectedBarber, selectedDate]);

    const loadServices = async () => {
        setLoading(true);
        const { data } = await supabase.from('services').select('id, name, price, duration_minutes').eq('tenant_id', tenantId).eq('is_active', true);
        setServices(data || []);
        setLoading(false);
    };

    const loadBarbers = async () => {
        setLoading(true);
        const { data } = await supabase.from('staff').select('id, name').eq('tenant_id', tenantId).eq('is_active', true);
        setBarbers(data || []);
        setLoading(false);
    };

    const generateSlots = async () => {
        setLoading(true);
        const duration = selectedService?.duration_minutes || 30;
        const dateStr = selectedDate.toISOString().split('T')[0];

        // Get existing appointments for the day
        let query = supabase
            .from('appointments')
            .select('start_time, end_time')
            .eq('tenant_id', tenantId)
            .gte('start_time', `${dateStr}T00:00:00`)
            .lt('start_time', `${dateStr}T23:59:59`)
            .in('status', ['scheduled', 'confirmed']);

        if (selectedBarber) query = query.eq('staff_id', selectedBarber.id);

        const { data: booked } = await query;
        const bookedRanges = (booked || []).map(a => ({ start: new Date(a.start_time), end: new Date(a.end_time) }));

        const isToday = dateStr === new Date().toISOString().split('T')[0];
        const startHour = isToday ? Math.max(8, new Date().getHours() + 1) : 8;
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
        setLoading(false);
    };

    const handleConfirm = async () => {
        if (!selectedService || !selectedSlot) return;
        setLoading(true);
        try {
            const start = new Date(selectedSlot.datetime);
            const end = addMinutes(start, selectedService.duration_minutes);

            await supabase.from('appointments').insert({
                tenant_id: tenantId,
                client_id: client.id,
                staff_id: selectedBarber?.id || null,
                service_id: selectedService.id,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                status: 'scheduled',
                source: 'kiosk',
                channel,
                notes: `Agendado via ${channel === 'totem' ? 'Totem' : 'QR Code'}`,
            });

            setStep('success');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const card: React.CSSProperties = {
        background: theme.bgCard,
        border: `1px solid ${theme.border}`,
        backdropFilter: 'blur(20px)',
        borderRadius: '20px',
        padding: '28px',
        width: '100%',
        maxWidth: '680px',
    };

    const itemBtn = (selected: boolean): React.CSSProperties => ({
        background: selected ? theme.primaryLight : theme.buttonSecondary,
        border: `1.5px solid ${selected ? theme.primary : theme.border}`,
        borderRadius: '14px',
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left',
        color: selected ? theme.textMain : theme.textSub,
        boxShadow: selected ? theme.primaryGlow : 'none',
    });

    const btnPrimary: React.CSSProperties = {
        background: theme.buttonPrimary,
        color: theme.buttonPrimaryText,
        border: 'none',
        borderRadius: '14px',
        padding: '16px 28px',
        fontSize: '16px',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: theme.fontBody,
        transition: 'transform 0.15s',
        letterSpacing: theme.name === 'sanchez' ? '1px' : 'normal',
        textTransform: theme.name === 'sanchez' ? 'uppercase' : 'none',
    };

    const heading: React.CSSProperties = {
        color: theme.textMain,
        fontFamily: theme.fontHeading,
        fontWeight: 700,
        fontSize: '22px',
        marginBottom: '20px',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', minHeight: '70vh', justifyContent: 'center' }}>
            <div style={card}>

                {/* STEP: SERVICE */}
                {step === 'service' && (
                    <>
                        <h2 style={heading}>Qual serviço deseja?</h2>
                        {loading ? <p style={{ color: theme.textMuted }}>Carregando...</p> : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                {services.map(s => (
                                    <button key={s.id} style={itemBtn(selectedService?.id === s.id)} onClick={() => setSelectedService(s)}>
                                        <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{s.name}</div>
                                        <div style={{ color: theme.primary, fontWeight: 600 }}>R$ {s.price?.toFixed(2)}</div>
                                        <div style={{ color: theme.textMuted, fontSize: '12px', marginTop: '2px' }}>{s.duration_minutes} min</div>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={onBack}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} disabled={!selectedService} onClick={() => { loadBarbers(); setStep('barber'); }}>
                                Continuar →
                            </button>
                        </div>
                    </>
                )}

                {/* STEP: BARBER */}
                {step === 'barber' && (
                    <>
                        <h2 style={heading}>Escolha o barbeiro</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                            <button style={itemBtn(!selectedBarber)} onClick={() => setSelectedBarber(null)}>
                                <div style={{ fontSize: '28px', textAlign: 'center', marginBottom: '8px' }}>🎲</div>
                                <div style={{ fontWeight: 700, textAlign: 'center' }}>Tanto faz</div>
                                <div style={{ color: theme.textMuted, fontSize: '12px', textAlign: 'center' }}>Próximo disponível</div>
                            </button>
                            {loading ? null : barbers.map(b => (
                                <button key={b.id} style={itemBtn(selectedBarber?.id === b.id)} onClick={() => setSelectedBarber(b)}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: theme.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '20px', border: `1px solid ${theme.border}` }}>✂️</div>
                                    <div style={{ fontWeight: 700, textAlign: 'center', fontSize: '14px' }}>{b.name}</div>
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={() => setStep('service')}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} onClick={() => setStep('datetime')}>Continuar →</button>
                        </div>
                    </>
                )}

                {/* STEP: DATE + TIME */}
                {step === 'datetime' && (
                    <>
                        <h2 style={heading}>Quando você quer vir?</h2>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
                            {dates.map(d => {
                                const isSelected = d.toDateString() === selectedDate.toDateString();
                                return (
                                    <button key={d.toISOString()} onClick={() => setSelectedDate(d)} style={{
                                        background: isSelected ? theme.primaryLight : theme.buttonSecondary,
                                        border: `1.5px solid ${isSelected ? theme.primary : theme.border}`,
                                        borderRadius: '12px',
                                        padding: '10px 14px',
                                        color: isSelected ? theme.textMain : theme.textSub,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        flexShrink: 0,
                                    }}>
                                        {fmtDate(d)}
                                    </button>
                                );
                            })}
                        </div>

                        {loading ? <p style={{ color: theme.textMuted }}>Buscando horários...</p> : slots.length === 0 ? (
                            <p style={{ color: theme.textMuted, textAlign: 'center', padding: '20px' }}>Sem horários disponíveis para este dia.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                {slots.map(s => (
                                    <button key={s.datetime} style={{
                                        background: selectedSlot?.datetime === s.datetime ? theme.primaryLight : theme.buttonSecondary,
                                        border: `1.5px solid ${selectedSlot?.datetime === s.datetime ? theme.primary : theme.border}`,
                                        borderRadius: '10px',
                                        padding: '10px',
                                        color: theme.textMain,
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '14px',
                                        transition: 'all 0.2s',
                                    }} onClick={() => setSelectedSlot(s)}>
                                        {s.time}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={() => setStep('barber')}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} disabled={!selectedSlot} onClick={() => setStep('confirm')}>Ver Resumo →</button>
                        </div>
                    </>
                )}

                {/* STEP: CONFIRM */}
                {step === 'confirm' && (
                    <>
                        <h2 style={heading}>Confirme seu agendamento</h2>
                        <div style={{ background: theme.primaryLight, border: `1px solid ${theme.border}`, borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
                            {[
                                { label: 'Cliente', value: client.name },
                                { label: 'Serviço', value: `${selectedService?.name} (R$ ${selectedService?.price?.toFixed(2)})` },
                                { label: 'Barbeiro', value: selectedBarber?.name || 'Próximo disponível' },
                                { label: 'Data', value: selectedDate ? fmtDate(selectedDate) : '' },
                                { label: 'Horário', value: selectedSlot ? fmtTime(selectedSlot.datetime) : '' },
                                { label: 'Duração', value: `${selectedService?.duration_minutes} minutos` },
                            ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: `1px solid ${theme.border}`, paddingBottom: '10px' }}>
                                    <span style={{ color: theme.textMuted, fontSize: '14px' }}>{item.label}</span>
                                    <span style={{ color: theme.textMain, fontWeight: 600, fontSize: '14px' }}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button style={{ ...btnPrimary, background: theme.buttonSecondary, color: theme.textSub, flex: 1 }} onClick={() => setStep('datetime')}>← Voltar</button>
                            <button style={{ ...btnPrimary, flex: 2 }} disabled={loading} onClick={handleConfirm}>
                                {loading ? 'Agendando...' : '✅ Confirmar Agendamento'}
                            </button>
                        </div>
                    </>
                )}

                {/* STEP: SUCCESS */}
                {step === 'success' && (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
                        <h2 style={{ ...heading, fontSize: '26px', marginBottom: '8px' }}>
                            {theme.name === 'sanchez' ? 'Tá na agenda, Chefe!' : 'Agendado com sucesso!'}
                        </h2>
                        <p style={{ color: theme.textSub, fontSize: '16px', marginBottom: '8px' }}>
                            {selectedDate ? fmtDate(selectedDate) : ''} às {selectedSlot ? fmtTime(selectedSlot.datetime) : ''}
                        </p>
                        <p style={{ color: theme.textMuted, fontSize: '14px', marginBottom: '32px' }}>
                            Você receberá confirmação no WhatsApp 📱
                        </p>
                        <div style={{ background: theme.primaryLight, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '16px', marginBottom: '24px', fontSize: '13px', color: theme.textSub }}>
                            📍 <strong style={{ color: theme.textMain }}>{selectedService?.name}</strong> com <strong style={{ color: theme.textMain }}>{selectedBarber?.name || 'barbeiro'}</strong>
                        </div>
                        <button style={{ ...btnPrimary, padding: '16px 40px', fontSize: '16px' }} onClick={onComplete}>
                            Concluir ✓
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KioskSchedule;
