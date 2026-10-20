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

const OnlineBookingSettings: React.FC = () => {
  const { tenantId, tenantSlug } = useAuth();
  const [startHour, setStartHour] = useState<number>(7);
  const [endHour, setEndHour] = useState<number>(20);
  const [instagramInput, setInstagramInput] = useState<string>('');
  const [whatsappInput, setWhatsappInput] = useState<string>('');
  const [mapsInput, setMapsInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Link público canônico do agendamento direto (dinâmico conforme o ambiente: staging, dev ou prod)
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '')
    : 'https://barber.soumanager.com';
  const publicBookingUrl = `${baseUrl}/#/agendar/${tenantSlug || 'sua-barbearia'}`;

  // Opções de horários de 06:00 até 23:00
  const hourOptions = Array.from({ length: 18 }, (_, i) => i + 6);

  const formatHourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    if (startHour >= endHour) {
      setSaveError('O horário de abertura deve ser anterior ao horário de fechamento.');
      return;
    }

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

    setSaving(true);

    const workStartTime = `${String(startHour).padStart(2, '0')}:00:00`;
    const workEndTime = `${String(endHour).padStart(2, '0')}:00:00`;

    try {
      const updated = await tenantSettingsRepository.updateWorkingHours(tenantId, {
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        booking_enabled: true,
        instagram_url: sanitizedInstagram,
        whatsapp_number: sanitizedWhatsApp,
        maps_url: sanitizedMaps,
      });

      setInstagramInput(updated.instagram_url ?? sanitizedInstagram ?? '');
      setWhatsappInput(
        (updated.whatsapp_number ?? sanitizedWhatsApp)
          ? formatWhatsAppMask((updated.whatsapp_number ?? sanitizedWhatsApp) as string)
          : ''
      );
      setMapsInput(updated.maps_url ?? sanitizedMaps ?? '');

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
            Gerencie a vitrine digital da sua barbearia, canais de agendamento e horários de atendimento web.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Vitrine Online Ativa
        </div>
      </header>

      {/* SEÇÃO 1: Links de Divulgação */}
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

      {/* SEÇÃO 2 e 3: Formulário de Horários e Canais de Atendimento */}
      {loading ? (
        <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm">
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm font-medium">Carregando configurações da unidade...</p>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* SEÇÃO 2: Horários de Funcionamento Online */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">schedule</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Horários de Funcionamento Online
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Limite os horários disponíveis na vitrine pública. Atendimentos fora dessa janela não aparecerão para clientes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Abertura */}
              <div className="space-y-2">
                <label htmlFor="start-hour" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Abertura da Agenda (Início)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    wb_sunny
                  </span>
                  <select
                    id="start-hour"
                    value={startHour}
                    disabled={saving}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-colors disabled:opacity-60"
                  >
                    {hourOptions.map((h) => (
                      <option key={`start-${h}`} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Fechamento */}
              <div className="space-y-2">
                <label htmlFor="end-hour" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Fechamento da Agenda (Término)
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    bedtime
                  </span>
                  <select
                    id="end-hour"
                    value={endHour}
                    disabled={saving}
                    onChange={(e) => setEndHour(Number(e.target.value))}
                    className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-colors disabled:opacity-60"
                  >
                    {hourOptions.map((h) => (
                      <option key={`end-${h}`} value={h}>
                        {formatHourLabel(h)}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-base">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-surface-dark/50 p-4 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="material-symbols-outlined text-primary text-base">info</span>
              <span>
                Janela diária configurada:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatHourLabel(startHour)} às {formatHourLabel(endHour)}
                </strong>{' '}
                ({Math.max(0, endHour - startHour)} horas de atendimento disponíveis ao público).
              </span>
            </div>
          </section>

          {/* SEÇÃO 3: Canais de Atendimento e Localização */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">share_location</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Canais de Atendimento e Localização
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure os atalhos de contato e mapa que serão exibidos no cabeçalho da tela pública de agendamento.
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
                  Google Maps (Link do Local)
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
                className="w-full sm:w-auto px-7 py-3 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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
