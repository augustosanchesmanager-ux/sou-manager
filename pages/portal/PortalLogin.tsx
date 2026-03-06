import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { usePortalAuth } from '../../components/PortalAuthProvider';

const PortalLogin: React.FC = () => {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const navigate = useNavigate();
    const { requestOtp, verifyOtp, token, tenantId: authTenantId } = usePortalAuth();

    const [tenant, setTenant] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Step 1: Phone
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phone, setPhone] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Step 2: OTP
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isVerifying, setIsVerifying] = useState(false);
    const [timer, setTimer] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (!tenantSlug) { setError('URL Inválida'); setLoading(false); return; }
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

            // Redirect if already logged in for THIS tenant
            if (token && authTenantId === tenantData.id) {
                navigate(`/c/${tenantSlug}/app`, { replace: true });
            }
        } catch (e) {
            setError('Erro ao carregar.');
        } finally {
            setLoading(false);
        }
    };

    // Timer logic for Resend OTP
    useEffect(() => {
        let interval: any;
        if (timer > 0 && step === 'otp') {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer, step]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        let formatted = val;
        if (val.length > 2) formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
        if (val.length > 7) formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
        setPhone(formatted);
    };

    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const rawPhone = phone.replace(/\D/g, '');
        if (rawPhone.length < 10) {
            setError('Digite um celular válido (DDD + 9 dígitos).');
            return;
        }

        setError('');
        setIsSending(true);
        try {
            // We expect the backend to return status 404 with code 'CLIENT_NOT_FOUND' if they need to register
            // For now, let's assume requestOtp throws an error with that message if not found
            await requestOtp(tenant.id, rawPhone);
            setStep('otp');
            setTimer(60); // 60s cooldown
            setOtp(['', '', '', '', '', '']);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar código. Tente novamente.');
        } finally {
            setIsSending(false);
        }
    };

    const handleOtpChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '');
        if (!val) {
            const newOtp = [...otp];
            newOtp[index] = '';
            setOtp(newOtp);
            return;
        }

        // Handle pasting multiple digits
        if (val.length > 1) {
            const chars = val.slice(0, 6).split('');
            const newOtp = [...otp];
            chars.forEach((c, i) => { if (index + i < 6) newOtp[index + i] = c; });
            setOtp(newOtp);
            const focusIndex = Math.min(5, index + chars.length);
            inputRefs.current[focusIndex]?.focus();
            return;
        }

        const newOtp = [...otp];
        newOtp[index] = val;
        setOtp(newOtp);

        if (val && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
            const newOtp = [...otp];
            newOtp[index - 1] = '';
            setOtp(newOtp);
        }
    };

    const handleVerifyOtp = async () => {
        const code = otp.join('');
        if (code.length !== 6) return;

        setError('');
        setIsVerifying(true);
        const rawPhone = phone.replace(/\D/g, '');
        try {
            await verifyOtp(tenant.id, rawPhone, code);
            navigate(`/c/${tenantSlug}/app`);
        } catch (err: any) {
            setError(err.message || 'Código inválido. Tente novamente.');
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setIsVerifying(false);
        }
    };

    // Auto verify when 6 digits are typed
    useEffect(() => {
        if (otp.join('').length === 6) {
            handleVerifyOtp();
        }
    }, [otp]);


    if (loading) return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
        </div>
    );

    if (error && !tenant) return (
        <div className="min-h-screen bg-[#0f172a] flex items-center justify-center flex-col gap-3 text-center px-6">
            <span className="text-4xl">⚠️</span>
            <p className="text-slate-100 text-lg font-bold">Acesso Indisponível</p>
            <p className="text-slate-400 text-sm">{error}</p>
        </div>
    );

    const isSanchez = tenant.theme === 'sanchez';

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center px-6 ${isSanchez ? 'bg-[#090909]' : 'bg-[#0f172a]'}`} style={{ fontFamily: isSanchez ? "'Playfair Display', serif" : "'Inter', sans-serif" }}>

            <div className="w-full max-w-sm">

                {/* Back button */}
                <button
                    onClick={() => step === 'otp' ? setStep('phone') : navigate(`/c/${tenantSlug}`)}
                    className="mb-8 text-sm flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
                    style={{ color: isSanchez ? '#c9a227' : '#94a3b8' }}
                >
                    ← Voltar
                </button>

                <div className="mb-8">
                    <h2 className={`text-2xl font-bold mb-2 ${isSanchez ? 'text-white' : 'text-slate-100'}`}>
                        {step === 'phone' ? 'Identifique-se' : 'Verifique seu número'}
                    </h2>
                    <p className={`text-sm ${isSanchez ? 'text-[#c9a227]' : 'text-slate-400'}`}>
                        {step === 'phone'
                            ? 'Digite seu WhatsApp para acessar a agenda da barbearia.'
                            : `Enviamos um código de 6 dígitos para ${phone}.`}
                    </p>
                </div>

                {error && tenant && (
                    <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        {error}
                    </div>
                )}

                {step === 'phone' && (
                    <form onSubmit={handleSendOtp} className="w-full flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <label className={`text-sm font-semibold ${isSanchez ? 'text-[#c9a227]' : 'text-slate-300'}`}>
                                WhatsApp
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={handlePhoneChange}
                                placeholder="(11) 99999-9999"
                                className="w-full px-5 py-4 rounded-2xl outline-none text-lg tracking-wide transition-all"
                                style={{
                                    background: isSanchez ? 'rgba(212,160,23,0.05)' : 'rgba(255,255,255,0.03)',
                                    border: isSanchez ? '1px solid rgba(212,160,23,0.2)' : '1px solid rgba(255,255,255,0.1)',
                                    color: '#fff',
                                }}
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSending || phone.replace(/\D/g, '').length < 10}
                            className="w-full py-4 rounded-2xl font-bold text-lg shadow-lg disabled:opacity-50 transition-all"
                            style={{
                                background: isSanchez
                                    ? 'linear-gradient(135deg, #d4a017, #b8860b)'
                                    : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: isSanchez ? '#000' : '#fff',
                            }}
                        >
                            {isSending ? 'Enviando...' : 'Receber Código'}
                        </button>
                    </form>
                )}

                {step === 'otp' && (
                    <div className="w-full flex flex-col gap-8">
                        <div className="flex justify-between gap-2">
                            {otp.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => inputRefs.current[index] = el}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleOtpChange(index, e)}
                                    onKeyDown={e => handleOtpKeyDown(index, e)}
                                    className="w-12 h-16 text-center text-2xl font-bold rounded-xl outline-none transition-all"
                                    style={{
                                        background: isSanchez ? 'rgba(212,160,23,0.05)' : 'rgba(255,255,255,0.03)',
                                        border: isSanchez
                                            ? `1.5px solid ${digit ? '#d4a017' : 'rgba(212,160,23,0.2)'}`
                                            : `1.5px solid ${digit ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                                        color: isSanchez ? '#d4a017' : '#fff',
                                    }}
                                />
                            ))}
                        </div>

                        <div className="flex flex-col gap-4 text-center">
                            {isVerifying && (
                                <p className={`text-sm ${isSanchez ? 'text-[#d4a017]' : 'text-indigo-400'}`}>Verificando código...</p>
                            )}

                            <button
                                onClick={() => handleSendOtp()}
                                disabled={timer > 0 || isSending}
                                className={`text-sm font-semibold transition-opacity ${timer > 0 ? 'opacity-50' : 'hover:opacity-80'}`}
                                style={{ color: isSanchez ? '#c9a227' : '#8b5cf6' }}
                            >
                                {timer > 0
                                    ? `Aguarde ${timer}s para reenviar`
                                    : (isSending ? 'Reenviando...' : 'Não recebeu? Reenviar código')}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default PortalLogin;
