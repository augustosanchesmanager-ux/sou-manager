import React, { useState } from 'react';
import { useKioskTheme } from '../KioskThemeProvider';
import { supabase } from '../../../services/supabaseClient';
import DatePickerInput from '../../../components/ui/DatePickerInput';

interface Client {
    id: string;
    name: string;
    phone: string;
}

interface KioskIdentifyProps {
    tenantId: string;
    onIdentified: (client: Client) => void;
}

const KioskIdentify: React.FC<KioskIdentifyProps> = ({ tenantId, onIdentified }) => {
    const { theme } = useKioskTheme();
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'input' | 'confirm' | 'register'>('input');
    const [foundClient, setFoundClient] = useState<Client | null>(null);
    const [name, setName] = useState('');
    const [birthday, setBirthday] = useState('');
    const [lgpdConsent, setLgpdConsent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const maskPhone = (p: string) => {
        if (!p) return '';
        const digits = p.replace(/\D/g, '');
        if (digits.length <= 2) return `(${digits}`;
        if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
        setPhone(raw);
        setError('');
    };

    const handleSearch = async () => {
        if (phone.length < 10) { setError('Digite um telefone válido.'); return; }
        setLoading(true);
        try {
            const { data } = await supabase
                .from('clients')
                .select('id, name, phone')
                .eq('tenant_id', tenantId)
                .ilike('phone', `%${phone}%`)
                .limit(1)
                .single();

            if (data) {
                setFoundClient(data);
                setStep('confirm');
            } else {
                setStep('register');
            }
        } catch {
            setStep('register');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!name.trim()) { setError('Nome é obrigatório.'); return; }
        if (!lgpdConsent) { setError('É necessário aceitar o termo de uso dos dados.'); return; }
        setLoading(true);
        try {
            const { data, error: insertError } = await supabase
                .from('clients')
                .insert({ tenant_id: tenantId, name: name.trim(), phone, birthday: birthday || null })
                .select('id, name, phone')
                .single();

            if (insertError) throw insertError;
            if (data) onIdentified(data);
        } catch {
            setError('Erro ao cadastrar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const card: React.CSSProperties = {
        background: theme.bgCard,
        border: `1px solid ${theme.border}`,
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '40px',
        width: '100%',
        maxWidth: '520px',
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: `1.5px solid ${theme.border}`,
        borderRadius: '14px',
        color: theme.textMain,
        fontSize: '20px',
        letterSpacing: '2px',
        padding: '18px 20px',
        outline: 'none',
        fontFamily: theme.fontBody,
        boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    };

    const btnPrimary: React.CSSProperties = {
        background: theme.buttonPrimary,
        color: theme.buttonPrimaryText,
        border: 'none',
        borderRadius: '14px',
        padding: '18px 32px',
        fontSize: '17px',
        fontWeight: 700,
        cursor: 'pointer',
        width: '100%',
        transition: 'transform 0.15s, box-shadow 0.15s',
        fontFamily: theme.fontBody,
        letterSpacing: theme.name === 'sanchez' ? '1px' : 'normal',
        textTransform: theme.name === 'sanchez' ? 'uppercase' : 'none',
    };

    const btnSecondary: React.CSSProperties = {
        ...btnPrimary,
        background: theme.buttonSecondary,
        color: theme.textSub,
        border: `1px solid ${theme.border}`,
    };

    const Numpad: React.FC = () => {
        const nums = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '20px' }}>
                {nums.map(n => (
                    <button
                        key={n}
                        style={{
                            background: n === '✓' ? theme.buttonPrimary : theme.buttonSecondary,
                            color: n === '✓' ? theme.buttonPrimaryText : theme.textMain,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '14px',
                            fontSize: '22px',
                            fontWeight: 600,
                            padding: '18px',
                            cursor: 'pointer',
                            transition: 'transform 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        onClick={() => {
                            if (n === '⌫') setPhone(p => p.slice(0, -1));
                            else if (n === '✓') handleSearch();
                            else if (phone.length < 11) setPhone(p => p + n);
                            setError('');
                        }}
                    >
                        {n}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px' }}>
            <div style={card}>
                {step === 'input' && (
                    <>
                        <p style={{ color: theme.textSub, fontSize: '14px', textAlign: 'center', marginBottom: '6px', fontFamily: theme.fontBody }}>
                            IDENTIFICAÇÃO
                        </p>
                        <h2 style={{ color: theme.textMain, fontSize: '26px', fontWeight: 700, textAlign: 'center', marginBottom: '8px', fontFamily: theme.fontHeading }}>
                            {theme.name === 'sanchez' ? 'Qual é o seu WhatsApp, Chefe?' : 'Digite seu WhatsApp'}
                        </h2>
                        <p style={{ color: theme.textMuted, fontSize: '14px', textAlign: 'center', marginBottom: '24px', fontFamily: theme.fontBody }}>
                            {theme.name === 'sanchez' ? 'Necessário para agendar e avaliar.' : 'Para agendamento e feedback rápido.'}
                        </p>
                        <input
                            value={maskPhone(phone)}
                            readOnly
                            placeholder="(00) 00000-0000"
                            style={inputStyle}
                        />
                        {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>{error}</p>}
                        <Numpad />
                    </>
                )}

                {step === 'confirm' && foundClient && (
                    <>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: theme.primaryLight, border: `2px solid ${theme.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <span style={{ fontSize: '32px' }}>👤</span>
                            </div>
                            <h2 style={{ color: theme.textMain, fontSize: '24px', fontWeight: 700, fontFamily: theme.fontHeading }}>
                                Você é <span style={{ color: theme.primary }}>{foundClient.name.split(' ')[0]}</span>?
                            </h2>
                            <p style={{ color: theme.textMuted, fontSize: '14px', marginTop: '8px' }}>
                                Tel: {maskPhone(foundClient.phone).slice(0, -4) + '****'}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                            <button style={btnPrimary} onClick={() => onIdentified(foundClient)}>
                                ✅  Sim, sou eu!
                            </button>
                            <button style={btnSecondary} onClick={() => { setFoundClient(null); setPhone(''); setStep('input'); }}>
                                ❌  Não sou eu
                            </button>
                        </div>
                    </>
                )}

                {step === 'register' && (
                    <>
                        <h2 style={{ color: theme.textMain, fontSize: '22px', fontWeight: 700, fontFamily: theme.fontHeading, marginBottom: '6px' }}>
                            {theme.name === 'sanchez' ? 'Primeiro acesso, Chefe?' : 'Primeiro acesso?'}
                        </h2>
                        <p style={{ color: theme.textMuted, fontSize: '14px', marginBottom: '24px' }}>
                            Cadastro rápido — menos de 30 segundos!
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input
                                style={{ ...inputStyle, fontSize: '16px', letterSpacing: 'normal' }}
                                placeholder="Seu nome completo *"
                                value={name}
                                onChange={e => { setName(e.target.value); setError(''); }}
                            />
                            <input
                                style={{ ...inputStyle, fontSize: '16px', letterSpacing: 'normal', background: 'rgba(255,255,255,0.03)' }}
                                value={maskPhone(phone)}
                                readOnly
                            />
                            <DatePickerInput
                                style={{ ...inputStyle, fontSize: '14px', letterSpacing: 'normal' }}
                                buttonStyle={{ color: theme.textMuted }}
                                placeholder="Aniversário (opcional)"
                                value={birthday}
                                onChange={e => setBirthday(e.target.value)}
                            />
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={lgpdConsent}
                                    onChange={e => { setLgpdConsent(e.target.checked); setError(''); }}
                                    style={{ accentColor: theme.primary, width: '18px', height: '18px', marginTop: '2px' }}
                                />
                                <span style={{ color: theme.textMuted, fontSize: '13px', lineHeight: 1.5 }}>
                                    Concordo com o uso dos meus dados para agendamento e feedback conforme a LGPD.
                                </span>
                            </label>
                            {error && <p style={{ color: '#ef4444', fontSize: '13px' }}>{error}</p>}
                            <button style={btnPrimary} disabled={loading} onClick={handleRegister}>
                                {loading ? 'Cadastrando...' : '✅ Cadastrar e Continuar'}
                            </button>
                            <button style={btnSecondary} onClick={() => { setStep('input'); setPhone(''); }}>
                                ← Voltar
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default KioskIdentify;
