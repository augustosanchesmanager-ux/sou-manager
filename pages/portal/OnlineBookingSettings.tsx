import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { tenantSettingsRepository } from '../../domain/tenantSettings/repository';

const formatWhatsAppMask = (raw: string): string => {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const sanitizeInstagramUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    const secureUrl = trimmed.replace(/^http:\/\//i, 'https://');
    try {
      const parsed = new URL(secureUrl);
      if (parsed.protocol !== 'https:') return null;
      return parsed.toString();
    } catch {
      return null;
    }
  }

  const handle = trimmed
    .replace(/^@+/, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
    .trim();

  if (!handle) return null;
  return `https://instagram.com/${encodeURIComponent(handle)}`;
};

const sanitizeWhatsAppNumber = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }
  return null;
};

const sanitizeMapsUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, 'https://')
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

interface DayConfig {
  key: string;
  label: string;
  shortLabel: string;
}

const WEEK_DAYS: DayConfig[] = [
  { key: 'monday', label: 'Segunda-feira', shortLabel: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', shortLabel: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', shortLabel: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', shortLabel: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', shortLabel: 'Sex' },
  { key: 'saturday', label: 'Sábado', shortLabel: 'Sáb' },
  { key: 'sunday', label: 'Domingo', shortLabel: 'Dom' },
];

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_OPTIONS.push(`${hh}:00`);
  TIME_OPTIONS.push(`${hh}:30`);
}

const OnlineBookingSettings: React.FC = () => {
  const { tenantId, tenantSlug } = useAuth();
  const [bookingEnabled, setBookingEnabled] = useState<boolean>(true);
  const [startHour, setStartHour] = useState<number>(7);
  const [endHour, setEndHour] = useState<number>(20);
  const [instagramInput, setInstagramInput] = useState<string>('');
  const [whatsappInput, setWhatsappInput] = useState<string>('');
  const [mapsInput, setMapsInput] = useState<string>('');

  // Branding & Identity
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [slogan, setSlogan] = useState<string>('');
  const [aboutText, setAboutText] = useState<string>('');

  // Weekly Schedule
  const [weeklySchedule, setWeeklySchedule] = useState<{
    [day: string]: { enabled: boolean; open: string; close: string };
  }>({
    monday: { enabled: true, open: '08:00', close: '19:00' },
    tuesday: { enabled: true, open: '08:00', close: '19:00' },
    wednesday: { enabled: true, open: '08:00', close: '19:00' },
    thursday: { enabled: true, open: '08:00', close: '19:00' },
    friday: { enabled: true, open: '08:00', close: '20:00' },
    saturday: { enabled: true, open: '08:00', close: '18:00' },
    sunday: { enabled: false, open: '08:00', close: '14:00' },
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Link público canônico do agendamento direto
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '')
    : 'https://barber.soumanager.com';
  const publicBookingUrl = `${baseUrl}/#/agendar/${tenantSlug || 'sua-barbearia'}`;

  // Leitura inicial das configurações da tabela tenant_settings
  useEffect(() => {
    let isCancelled = false;

    const fetchSettings = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await tenantSettingsRepository.getByTenantId(tenantId);

        if (!isCancelled && data) {
          if (data.booking_enabled !== undefined && data.booking_enabled !== null) {
            setBookingEnabled(Boolean(data.booking_enabled));
          }
          if (data.work_start_time) {
            const startParsed = parseInt(data.work_start_time.split(':')[0], 10);
            if (!Number.isNaN(startParsed)) setStartHour(startParsed);
          }
          if (data.work_end_time) {
            const endParsed = parseInt(data.work_end_time.split(':')[0], 10);
            if (!Number.isNaN(endParsed)) setEndHour(endParsed);
          }
          setInstagramInput(data.instagram_url ?? '');
          setWhatsappInput(data.whatsapp_number ? formatWhatsAppMask(data.whatsapp_number) : '');
          setMapsInput(data.maps_url ?? '');

          if (data.business_hours) {
            const bh = data.business_hours as Record<string, any>;
            if (bh._branding) {
              setCoverUrl(bh._branding.cover_url ?? '');
              setLogoUrl(bh._branding.logo_url ?? '');
              setSlogan(bh._branding.slogan ?? '');
              setAboutText(bh._branding.about_text ?? '');
            }
            const updatedWeekly = { ...weeklySchedule };
            WEEK_DAYS.forEach(({ key }) => {
              const dayVal = bh[key];
              if (dayVal === null) {
                updatedWeekly[key] = { enabled: false, open: '08:00', close: '18:00' };
              } else if (dayVal && typeof dayVal === 'object' && dayVal.open && dayVal.close) {
                updatedWeekly[key] = { enabled: true, open: dayVal.open, close: dayVal.close };
              }
            });
            setWeeklySchedule(updatedWeekly);
          }
        }
      } catch (err) {
        console.error('[OnlineBookingSettings] Falha inesperada ao carregar:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    void fetchSettings();

    return () => {
      isCancelled = true;
    };
  }, [tenantId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicBookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.getElementById('public-link-input') as HTMLInputElement | null;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleDayToggle = (dayKey: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: !prev[dayKey].enabled,
      },
    }));
  };

  const handleDayTimeChange = (dayKey: string, field: 'open' | 'close', value: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    if (!tenantId) {
      setSaveError('Identificador da unidade não encontrado.');
      return;
    }

    const sanitizedInstagram = sanitizeInstagramUrl(instagramInput);
    if (instagramInput.trim() && !sanitizedInstagram) {
      setSaveError('Informe um link ou @perfil válido para o Instagram.');
      return;
    }

    const sanitizedWhatsApp = sanitizeWhatsAppNumber(whatsappInput);
    if (whatsappInput.trim() && !sanitizedWhatsApp) {
      setSaveError('Informe um número de WhatsApp válido com DDD (10 ou 11 dígitos).');
      return;
    }

    const sanitizedMaps = sanitizeMapsUrl(mapsInput);
    if (mapsInput.trim() && !sanitizedMaps) {
      setSaveError('Informe uma URL segura (https://) válida para o Google Maps.');
      return;
    }

    // Build business_hours JSON
    const businessHoursPayload: Record<string, any> = {
      _branding: {
        cover_url: coverUrl.trim() || null,
        logo_url: logoUrl.trim() || null,
        slogan: slogan.trim() || null,
        about_text: aboutText.trim() || null,
      },
    };

    let minHour = 23;
    let maxHour = 0;

    WEEK_DAYS.forEach(({ key }) => {
      const dayConfig = weeklySchedule[key];
      if (dayConfig.enabled) {
        businessHoursPayload[key] = {
          open: dayConfig.open,
          close: dayConfig.close,
        };
        const openH = parseInt(dayConfig.open.split(':')[0], 10);
        const closeH = parseInt(dayConfig.close.split(':')[0], 10);
        if (!isNaN(openH) && openH < minHour) minHour = openH;
        if (!isNaN(closeH) && closeH > maxHour) maxHour = closeH;
      } else {
        businessHoursPayload[key] = null;
      }
    });

    const effectiveStartHour = minHour <= 23 && minHour < maxHour ? minHour : startHour;
    const effectiveEndHour = maxHour > 0 && maxHour > minHour ? maxHour : endHour;

    setSaving(true);

    const workStartTime = `${String(effectiveStartHour).padStart(2, '0')}:00:00`;
    const workEndTime = `${String(effectiveEndHour).padStart(2, '0')}:00:00`;

    try {
      const updated = await tenantSettingsRepository.updateWorkingHours(tenantId, {
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        booking_enabled: bookingEnabled,
        instagram_url: sanitizedInstagram,
        whatsapp_number: sanitizedWhatsApp,
        maps_url: sanitizedMaps,
        business_hours: businessHoursPayload,
      });

      setInstagramInput(updated.instagram_url ?? sanitizedInstagram ?? '');
      setWhatsappInput(
        (updated.whatsapp_number ?? sanitizedWhatsApp)
          ? formatWhatsAppMask((updated.whatsapp_number ?? sanitizedWhatsApp) as string)
          : ''
      );
      setMapsInput(updated.maps_url ?? sanitizedMaps ?? '');
      setStartHour(effectiveStartHour);
      setEndHour(effectiveEndHour);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('[OnlineBookingSettings] Erro ao salvar configurações:', err);
      setSaveError(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-fade-in p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-border-dark pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Configurações do Agendamento Online
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie a vitrine digital da sua barbearia, identidade visual, horários semanais e canais de contato.
          </p>
        </div>

        {/* Toggle Vitrine Ativa */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <button
              type="button"
              onClick={() => setBookingEnabled(!bookingEnabled)}
              aria-label={bookingEnabled ? 'Desativar vitrine online' : 'Ativar vitrine online'}
              className={`relative inline-block w-12 h-6 rounded-full transition-colors cursor-pointer ${
                bookingEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  bookingEnabled ? 'left-[26px]' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {bookingEnabled ? 'Vitrine Online Ativa' : 'Vitrine Pausada'}
            </span>
          </label>
        </div>
      </header>

      {/* SEÇÃO 1: Link de Divulgação */}
      <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">link</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Link de Agendamento Direto
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compartilhe na bio do Instagram, WhatsApp ou anúncios. O cliente agenda sem necessidade de senha.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              public
            </span>
            <input
              id="public-link-input"
              type="text"
              readOnly
              value={publicBookingUrl}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-mono text-slate-700 dark:text-slate-200 select-all outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
            </button>

            <a
              href={publicBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary transition-all flex items-center justify-center"
              title="Abrir página de agendamento em nova aba"
            >
              <span className="material-symbols-outlined text-lg">open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2 a 5: Formulário */}
      {loading ? (
        <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm">
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm font-medium">Carregando configurações da unidade...</p>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* SEÇÃO 2: Identidade Visual & Branding */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">palette</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Identidade Visual e Vitrine
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personalize a imagem de capa, avatar e apresentação exibidos no agendamento público.
                </p>
              </div>
            </div>

            {/* Previews Visuais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cover Preview */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Banner Superior (Cover)
                </label>
                <div className="relative h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-border-dark bg-slate-900 flex items-center justify-center group">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Preview da Capa"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-500 text-xs">
                      <span className="material-symbols-outlined text-3xl">image</span>
                      <span>Nenhuma capa configurada (usando padrão escuro)</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                </div>
                <input
                  type="url"
                  value={coverUrl}
                  disabled={saving}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://exemplo.com/banner-barbearia.jpg"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              {/* Logo/Avatar Preview */}
              <div className="space-y-2 flex flex-col items-center md:items-start">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Logo / Avatar
                </label>
                <div className="size-24 rounded-full border-2 border-amber-400 p-0.5 overflow-hidden bg-slate-900 flex items-center justify-center shadow-md">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Preview Logo"
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-amber-400 text-3xl">content_cut</span>
                  )}
                </div>
                <input
                  type="url"
                  value={logoUrl}
                  disabled={saving}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            {/* Slogan & Bio */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Slogan / Frase de Impacto
                </label>
                <input
                  type="text"
                  value={slogan}
                  disabled={saving}
                  onChange={(e) => setSlogan(e.target.value)}
                  placeholder="Ex: Tradição, elegância e o corte perfeito para o seu estilo."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Apresentação Institucional (Aba "Sobre Nós")
                </label>
                <textarea
                  rows={3}
                  value={aboutText}
                  disabled={saving}
                  onChange={(e) => setAboutText(e.target.value)}
                  placeholder="Conte um pouco sobre a história da sua barbearia, experiência da equipe e diferenciais de atendimento..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors resize-none"
                />
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: Grade Semanal de Atendimento */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">calendar_month</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Grade Semanal de Atendimento
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina os horários de abertura e fechamento para cada dia da semana disponíveis na vitrine pública.
                </p>
              </div>
            </div>

            {/* Tabela de Dias */}
            <div className="overflow-hidden border border-slate-200 dark:border-border-dark rounded-xl">
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {WEEK_DAYS.map(({ key, label }) => {
                  const schedule = weeklySchedule[key] || { enabled: false, open: '08:00', close: '18:00' };
                  return (
                    <div
                      key={key}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        schedule.enabled
                          ? 'bg-white dark:bg-card-dark'
                          : 'bg-slate-50/70 dark:bg-white/[0.01] opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-[160px]">
                        <button
                          type="button"
                          onClick={() => handleDayToggle(key)}
                          aria-label={`${schedule.enabled ? 'Fechar' : 'Abrir'} ${label}`}
                          className={`relative inline-block w-10 h-5 rounded-full transition-colors cursor-pointer ${
                            schedule.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              schedule.enabled ? 'left-[22px]' : 'left-0.5'
                            }`}
                          />
                        </button>
                        <span className={`text-sm font-bold ${schedule.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {label}
                        </span>
                      </div>

                      {schedule.enabled ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">De</span>
                            <select
                              value={schedule.open}
                              disabled={saving}
                              onChange={(e) => handleDayTimeChange(key, 'open', e.target.value)}
                              className="px-3 py-1.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={`${key}-open-${t}`} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">Até</span>
                            <select
                              value={schedule.close}
                              disabled={saving}
                              onChange={(e) => handleDayTimeChange(key, 'close', e.target.value)}
                              className="px-3 py-1.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-lg text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                            >
                              {TIME_OPTIONS.map((t) => (
                                <option key={`${key}-close-${t}`} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 self-start sm:self-auto">
                          Fechado
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* SEÇÃO 4: Canais de Atendimento e Localização */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">share_location</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Canais de Atendimento e Localização
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure os atalhos de contato e mapa exibidos no topo e rodapé da vitrine pública.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Instagram */}
              <div className="space-y-2">
                <label htmlFor="instagram-url" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Instagram (Link ou @perfil)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    alternate_email
                  </span>
                  <input
                    id="instagram-url"
                    type="text"
                    value={instagramInput}
                    disabled={saving}
                    onChange={(e) => setInstagramInput(e.target.value)}
                    placeholder="@suabarbearia ou https://instagram.com/suabarbearia"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="space-y-2">
                <label htmlFor="whatsapp-number" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  WhatsApp de Atendimento (com DDD)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    chat
                  </span>
                  <input
                    id="whatsapp-number"
                    type="tel"
                    inputMode="numeric"
                    value={whatsappInput}
                    disabled={saving}
                    onChange={(e) => setWhatsappInput(formatWhatsAppMask(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Google Maps */}
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="maps-url" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Google Maps (Link de Localização)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    location_on
                  </span>
                  <input
                    id="maps-url"
                    type="url"
                    value={mapsInput}
                    disabled={saving}
                    onChange={(e) => setMapsInput(e.target.value)}
                    placeholder="https://maps.google.com/?q=Sua+Barbearia"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Feedback & Botão de Salvar */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 dark:border-border-dark">
              <div className="min-h-[24px] flex items-center" role="status" aria-live="polite">
                {saveSuccess && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Configurações salvas no banco com sucesso!
                  </span>
                )}

                {saveError && (
                  <span className="text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                    <span className="material-symbols-outlined text-base">error</span>
                    {saveError}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={saving || loading}
                className="w-full sm:w-auto px-7 py-3 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">save</span>
                    <span>Salvar Configurações</span>
                  </>
                )}
              </button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
};

export default OnlineBookingSettings;
