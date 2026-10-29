import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/Toast';
import {
  tenantSettingsRepository,
  sanitizeBookingSlug,
  sanitizeHexColor,
  DEFAULT_BRAND_PRIMARY_COLOR,
} from '../../domain/tenantSettings/repository';
import type {
  BookingThemeMode,
  ShowcaseProductItem,
} from '../../domain/tenantSettings/types';
import { ProductShowcaseSelector } from './ProductShowcaseSelector';

const BRAND_COLOR_PRESETS = [
  { label: 'Ouro Atelier', hex: '#B88A44' },
  { label: 'Âmbar Imperial', hex: '#D97706' },
  { label: 'Bronze Vintage', hex: '#A16207' },
  { label: 'Esmeralda Nobre', hex: '#10B981' },
  { label: 'Carmim Clássico', hex: '#E11D48' },
];

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
  const { tenantId, tenantSlug, tenant } = useAuth();

  // 1. Identificação e Vitrine
  const [bookingEnabled, setBookingEnabled] = useState<boolean>(true);
  const [displayName, setDisplayName] = useState<string>('');
  const [customSlug, setCustomSlug] = useState<string>('');
  const [displayAddress, setDisplayAddress] = useState<string>('');

  // 2. Identidade Visual
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_BRAND_PRIMARY_COLOR);
  const [themeMode, setThemeMode] = useState<BookingThemeMode>('dark');
  const [slogan, setSlogan] = useState<string>('');
  const [aboutText, setAboutText] = useState<string>('');

  // 3. Vitrine de Produtos (Home Care)
  const [showProducts, setShowProducts] = useState<boolean>(false);
  const [selectedProducts, setSelectedProducts] = useState<ShowcaseProductItem[]>([]);

  // 4. Canais & Horários
  const [startHour, setStartHour] = useState<number>(7);
  const [endHour, setEndHour] = useState<number>(20);
  const [instagramInput, setInstagramInput] = useState<string>('');
  const [whatsappInput, setWhatsappInput] = useState<string>('');
  const [mapsInput, setMapsInput] = useState<string>('');

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(
    null,
  );

  const effectiveSlug = customSlug || tenantSlug || 'sua-barbearia';
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '')
      : 'https://barber.soumanager.com';
  const publicBookingUrl = `${baseUrl}/#/agendar/${effectiveSlug}`;

  const handleSearchCatalog = useCallback(
    async (query: string): Promise<ShowcaseProductItem[]> => {
      if (!tenantId) return [];
      return tenantSettingsRepository.searchTenantProducts(tenantId, query);
    },
    [tenantId],
  );

  const loadSettings = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [legacyData, onlineData] = await Promise.all([
        tenantSettingsRepository.getByTenantId(tenantId),
        tenantSettingsRepository.getOnlineBookingSettings(tenantId),
      ]);

      if (legacyData) {
        if (legacyData.work_start_time) {
          const startParsed = parseInt(legacyData.work_start_time.split(':')[0], 10);
          if (!Number.isNaN(startParsed)) setStartHour(startParsed);
        }
        if (legacyData.work_end_time) {
          const endParsed = parseInt(legacyData.work_end_time.split(':')[0], 10);
          if (!Number.isNaN(endParsed)) setEndHour(endParsed);
        }
      }

      if (onlineData) {
        setBookingEnabled(onlineData.is_active);
        setDisplayName(onlineData.display_name || tenant?.name || '');
        setCustomSlug(onlineData.slug || tenantSlug || '');
        setDisplayAddress(onlineData.display_address || '');
        setCoverUrl(onlineData.cover_banner_url || '');
        setLogoUrl(onlineData.logo_url || '');
        setPrimaryColor(sanitizeHexColor(onlineData.primary_color));
        setThemeMode(onlineData.theme_mode === 'light' ? 'light' : 'dark');
        setSlogan(onlineData.slogan || '');
        setAboutText(onlineData.about_text || '');
        setShowProducts(Boolean(onlineData.show_products));
        setInstagramInput(onlineData.instagram_url || '');
        setWhatsappInput(
          onlineData.phone_whatsapp ? formatWhatsAppMask(onlineData.phone_whatsapp) : '',
        );
        setMapsInput(onlineData.google_maps_url || '');

        if (onlineData.weekly_schedule) {
          const ws = onlineData.weekly_schedule;
          setWeeklySchedule((prev) => {
            const updatedWeekly = { ...prev };
            WEEK_DAYS.forEach(({ key }) => {
              const dayVal = ws[key] as { open?: string; close?: string } | null | undefined;
              if (dayVal === null) {
                updatedWeekly[key] = { enabled: false, open: '08:00', close: '18:00' };
              } else if (dayVal && typeof dayVal === 'object' && dayVal.open && dayVal.close) {
                updatedWeekly[key] = { enabled: true, open: dayVal.open, close: dayVal.close };
              }
            });
            return updatedWeekly;
          });
        }

        if (onlineData.featured_product_ids.length > 0) {
          const hydratedProducts = await tenantSettingsRepository.getTenantProductsByIds(
            tenantId,
            onlineData.featured_product_ids,
          );
          setSelectedProducts(hydratedProducts);
        } else {
          setSelectedProducts([]);
        }
      } else {
        setDisplayName(tenant?.name || '');
        setCustomSlug(tenantSlug || '');
      }
    } catch (err) {
      console.error('[OnlineBookingSettings] Falha ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenant?.name, tenantSlug]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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

  const handleSlugChange = (raw: string) => {
    setCustomSlug(sanitizeBookingSlug(raw));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    if (!tenantId) {
      const msg = 'Identificador da unidade não encontrado.';
      setSaveError(msg);
      setToast({ message: msg, type: 'error' });
      return;
    }

    const sanitizedSlug = sanitizeBookingSlug(customSlug || tenantSlug || '');
    if (!sanitizedSlug) {
      const msg = 'Informe um identificador de URL (slug) válido para a vitrine.';
      setSaveError(msg);
      setToast({ message: msg, type: 'error' });
      return;
    }

    const sanitizedInstagram = sanitizeInstagramUrl(instagramInput);
    if (instagramInput.trim() && !sanitizedInstagram) {
      const msg = 'Informe um link ou @perfil válido para o Instagram.';
      setSaveError(msg);
      setToast({ message: msg, type: 'error' });
      return;
    }

    const sanitizedWhatsApp = sanitizeWhatsAppNumber(whatsappInput);
    if (whatsappInput.trim() && !sanitizedWhatsApp) {
      const msg = 'Informe um número de WhatsApp válido com DDD (10 ou 11 dígitos).';
      setSaveError(msg);
      setToast({ message: msg, type: 'error' });
      return;
    }

    const sanitizedMaps = sanitizeMapsUrl(mapsInput);
    if (mapsInput.trim() && !sanitizedMaps) {
      const msg = 'Informe uma URL segura (https://) válida para o Google Maps.';
      setSaveError(msg);
      setToast({ message: msg, type: 'error' });
      return;
    }

    const normalizedPrimaryColor = sanitizeHexColor(primaryColor);

    const schedulePayload: Record<string, unknown> = {};
    let minHour = 23;
    let maxHour = 0;

    WEEK_DAYS.forEach(({ key }) => {
      const dayConfig = weeklySchedule[key];
      if (dayConfig.enabled) {
        schedulePayload[key] = {
          open: dayConfig.open,
          close: dayConfig.close,
        };
        const openH = parseInt(dayConfig.open.split(':')[0], 10);
        const closeH = parseInt(dayConfig.close.split(':')[0], 10);
        if (!Number.isNaN(openH) && openH < minHour) minHour = openH;
        if (!Number.isNaN(closeH) && closeH > maxHour) maxHour = closeH;
      } else {
        schedulePayload[key] = null;
      }
    });

    const effectiveStartHour = minHour <= 23 && minHour < maxHour ? minHour : startHour;
    const effectiveEndHour = maxHour > 0 && maxHour > minHour ? maxHour : endHour;

    const workStartTime = `${String(effectiveStartHour).padStart(2, '0')}:00:00`;
    const workEndTime = `${String(effectiveEndHour).padStart(2, '0')}:00:00`;

    setSaving(true);

    try {
      const saved = await tenantSettingsRepository.upsertOnlineBookingSettings({
        tenant_id: tenantId,
        is_active: bookingEnabled,
        display_name: displayName.trim() || tenant?.name || null,
        slug: sanitizedSlug,
        display_address: displayAddress.trim() || null,
        logo_url: logoUrl.trim() || null,
        cover_banner_url: coverUrl.trim() || null,
        primary_color: normalizedPrimaryColor,
        theme_mode: themeMode,
        slogan: slogan.trim() || null,
        about_text: aboutText.trim() || null,
        show_products: showProducts,
        featured_product_ids: selectedProducts.map((p) => p.id),
        featured_service_ids: [],
        phone_whatsapp: sanitizedWhatsApp,
        instagram_url: sanitizedInstagram,
        google_maps_url: sanitizedMaps,
        weekly_schedule: schedulePayload,
        work_start_time: workStartTime,
        work_end_time: workEndTime,
      });

      setCustomSlug(saved.slug || sanitizedSlug);
      setPrimaryColor(saved.primary_color || normalizedPrimaryColor);
      setInstagramInput(saved.instagram_url ?? sanitizedInstagram ?? '');
      setWhatsappInput(
        (saved.phone_whatsapp ?? sanitizedWhatsApp)
          ? formatWhatsAppMask((saved.phone_whatsapp ?? sanitizedWhatsApp) as string)
          : '',
      );
      setMapsInput(saved.google_maps_url ?? sanitizedMaps ?? '');
      setStartHour(effectiveStartHour);
      setEndHour(effectiveEndHour);

      setSaveSuccess(true);
      setToast({
        message: 'Configurações da vitrine online atualizadas com sucesso!',
        type: 'success',
      });
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar configurações.';
      console.error('[OnlineBookingSettings] Erro ao salvar configurações:', err);
      setSaveError(message);
      setToast({ message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-fade-in p-4 sm:p-6 lg:p-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-border-dark pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B88A44]/15 text-[#B88A44] text-[10px] font-black uppercase tracking-widest mb-2 border border-[#B88A44]/30">
            Atelier Tech · Vitrine Pública
          </span>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Configurações do Agendamento Online
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie a vitrine digital da sua barbearia, identidade visual, vitrine Home Care e horários semanais.
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

      {/* Link de Divulgação Rápida */}
      <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B88A44]/15 text-[#B88A44] flex items-center justify-center shrink-0 border border-[#B88A44]/30">
              <span className="material-symbols-outlined text-2xl">link</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Link de Agendamento Direto
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compartilhe na bio do Instagram, WhatsApp ou anúncios. O cliente agenda em segundos sem senha.
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
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-mono text-slate-700 dark:text-slate-200 select-all outline-none focus:ring-2 focus:ring-[#B88A44]/30"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 shadow-md shadow-[#B88A44]/20'
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
              className="p-3 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-600 dark:text-slate-300 hover:text-[#B88A44] hover:border-[#B88A44] transition-all flex items-center justify-center"
              title="Abrir página de agendamento em nova aba"
            >
              <span className="material-symbols-outlined text-lg">open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm">
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-[#B88A44]/30 border-t-[#B88A44] animate-spin" />
            <p className="text-sm font-medium">Carregando configurações da vitrine...</p>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSave} className="space-y-8">
          {/* SEÇÃO 1: Identificação e Vitrine */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B88A44]/15 text-[#B88A44] flex items-center justify-center shrink-0 border border-[#B88A44]/30">
                <span className="material-symbols-outlined text-2xl">storefront</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  1. Identificação e Vitrine
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina o nome público da barbearia, o identificador na URL (slug) e o endereço formatado.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nome Visível da Loja (display_name) */}
              <div className="space-y-2">
                <label
                  htmlFor="display-name-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Nome Visível da Barbearia / Loja
                </label>
                <input
                  id="display-name-input"
                  type="text"
                  value={displayName}
                  disabled={saving}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Barbearia Atelier Prime"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors"
                />
              </div>

              {/* Slug da URL */}
              <div className="space-y-2">
                <label
                  htmlFor="booking-slug-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Identificador na URL (Slug)
                </label>
                <div className="flex items-center rounded-xl bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark overflow-hidden focus-within:ring-2 focus-within:ring-[#B88A44]/30">
                  <span className="pl-3.5 pr-1.5 py-3 text-xs font-mono text-slate-400 select-none">
                    /#/agendar/
                  </span>
                  <input
                    id="booking-slug-input"
                    type="text"
                    value={customSlug}
                    disabled={saving}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="sua-barbearia"
                    className="w-full pr-4 py-3 bg-transparent text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Sanitizado automaticamente (apenas letras minúsculas, números e hífens).
                </p>
              </div>

              {/* Endereço Formatado (display_address) */}
              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="display-address-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Endereço Exibido na Vitrine
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                    pin_drop
                  </span>
                  <input
                    id="display-address-input"
                    type="text"
                    value={displayAddress}
                    disabled={saving}
                    onChange={(e) => setDisplayAddress(e.target.value)}
                    placeholder="Ex: Rua Oscar Freire, 850 - Jardins, São Paulo/SP"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO 2: Identidade Visual */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B88A44]/15 text-[#B88A44] flex items-center justify-center shrink-0 border border-[#B88A44]/30">
                <span className="material-symbols-outlined text-2xl">palette</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  2. Identidade Visual
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personalize o banner de capa, logo, cor primária da marca, modo de tema e textos institucionais.
                </p>
              </div>
            </div>

            {/* Previews Visuais em Tempo Real */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cover Preview */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Banner de Capa (Cover URL)
                </label>
                <div className="relative h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-border-dark bg-neutral-950 flex items-center justify-center group">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="Preview da Capa"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-500 text-xs">
                      <span className="material-symbols-outlined text-3xl">image</span>
                      <span>Nenhuma capa configurada (usando padrão Atelier Obsidian)</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
                    <span className="text-xs font-black text-white drop-shadow">
                      {displayName || tenant?.name || 'Sua Barbearia'}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-neutral-950"
                      style={{ backgroundColor: sanitizeHexColor(primaryColor) }}
                    >
                      Agendar
                    </span>
                  </div>
                </div>
                <input
                  type="url"
                  value={coverUrl}
                  disabled={saving}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://exemplo.com/banner-barbearia.jpg"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors"
                />
              </div>

              {/* Logo/Avatar Preview */}
              <div className="space-y-2 flex flex-col items-center md:items-start">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Logo / Avatar (URL)
                </label>
                <div
                  className="size-24 rounded-full p-0.5 overflow-hidden bg-neutral-950 flex items-center justify-center shadow-md border-2"
                  style={{ borderColor: sanitizeHexColor(primaryColor) }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Preview Logo"
                      className="w-full h-full object-cover rounded-full"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span
                      className="material-symbols-outlined text-3xl"
                      style={{ color: sanitizeHexColor(primaryColor) }}
                    >
                      content_cut
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  value={logoUrl}
                  disabled={saving}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors"
                />
              </div>
            </div>

            {/* Cor Primária + Theme Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-white/5">
              {/* Primary Color Selector */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Cor Primária da Marca (Destaque & CTAs)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    aria-label="Selecionar cor primária"
                    value={sanitizeHexColor(primaryColor)}
                    disabled={saving}
                    onChange={(e) => setPrimaryColor(e.target.value.toUpperCase())}
                    className="size-11 rounded-xl border border-slate-200 dark:border-border-dark bg-transparent cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    disabled={saving}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    onBlur={() => setPrimaryColor(sanitizeHexColor(primaryColor))}
                    placeholder="#B88A44"
                    maxLength={7}
                    className="w-32 px-3.5 py-2.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white uppercase outline-none focus:ring-2 focus:ring-[#B88A44]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setPrimaryColor(DEFAULT_BRAND_PRIMARY_COLOR)}
                    className="text-xs font-bold text-[#B88A44] hover:underline cursor-pointer"
                  >
                    Restaurar Dourado
                  </button>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {BRAND_COLOR_PRESETS.map((preset) => {
                    const isCurrent = sanitizeHexColor(primaryColor) === preset.hex;
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setPrimaryColor(preset.hex)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'border-[#B88A44] bg-[#B88A44]/15 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-400 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="size-3 rounded-full border border-black/20"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Mode Selector */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Modo de Aparência da Vitrine
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setThemeMode('dark')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      themeMode === 'dark'
                        ? 'border-[#B88A44] bg-neutral-950 text-white ring-1 ring-[#B88A44]'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-surface-dark text-slate-600 dark:text-neutral-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl text-[#B88A44]">
                      dark_mode
                    </span>
                    <div>
                      <p className="text-xs font-extrabold">Dark Obsidian</p>
                      <p className="text-[10px] opacity-75">Padrão Atelier Tech</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setThemeMode('light')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      themeMode === 'light'
                        ? 'border-[#B88A44] bg-amber-50/60 dark:bg-white/10 text-slate-900 dark:text-white ring-1 ring-[#B88A44]'
                        : 'border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-surface-dark text-slate-600 dark:text-neutral-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl text-[#B88A44]">
                      light_mode
                    </span>
                    <div>
                      <p className="text-xs font-extrabold">Light Editorial</p>
                      <p className="text-[10px] opacity-75">Alto contraste claro</p>
                    </div>
                  </button>
                </div>
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Apresentação Institucional (Aba &ldquo;Sobre Nós&rdquo;)
                </label>
                <textarea
                  rows={3}
                  value={aboutText}
                  disabled={saving}
                  onChange={(e) => setAboutText(e.target.value)}
                  placeholder="Conte um pouco sobre a história da sua barbearia, experiência da equipe e diferenciais de atendimento..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors resize-none"
                />
              </div>
            </div>
          </section>

          {/* SEÇÃO 3: Vitrine de Produtos (Home Care) */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#B88A44]/15 text-[#B88A44] flex items-center justify-center shrink-0 border border-[#B88A44]/30">
                  <span className="material-symbols-outlined text-2xl">shopping_bag</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    3. Vitrine de Produtos (Home Care)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Destaque pomadas, óleos e produtos recomendados diretamente na página pública de agendamento.
                  </p>
                </div>
              </div>

              {/* Toggle show_products */}
              <label className="flex items-center gap-2.5 cursor-pointer self-start sm:self-auto">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showProducts}
                  onClick={() => setShowProducts(!showProducts)}
                  className={`relative inline-block w-12 h-6 rounded-full transition-colors cursor-pointer ${
                    showProducts ? 'bg-[#B88A44]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      showProducts ? 'left-[26px]' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {showProducts ? 'Vitrine de Produtos Ativa' : 'Ocultar Produtos'}
                </span>
              </label>
            </div>

            {showProducts && (
              <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                <ProductShowcaseSelector
                  selectedProducts={selectedProducts}
                  onChangeProducts={setSelectedProducts}
                  onSearchCatalog={handleSearchCatalog}
                  disabled={saving}
                />
              </div>
            )}
          </section>

          {/* SEÇÃO 4: Grade Semanal de Atendimento */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">calendar_month</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  4. Grade Semanal de Atendimento
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina os horários de abertura e fechamento para cada dia da semana disponíveis na vitrine pública.
                </p>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-200 dark:border-border-dark rounded-xl">
              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {WEEK_DAYS.map(({ key, label }) => {
                  const schedule = weeklySchedule[key] || {
                    enabled: false,
                    open: '08:00',
                    close: '18:00',
                  };
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
                        <span
                          className={`text-sm font-bold ${
                            schedule.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                          }`}
                        >
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

          {/* SEÇÃO 5: Canais de Atendimento e Localização */}
          <section className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">share_location</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  5. Canais de Atendimento e Localização
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure os atalhos diretos de WhatsApp, Instagram e Google Maps exibidos na vitrine.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Instagram */}
              <div className="space-y-2">
                <label
                  htmlFor="instagram-url"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="space-y-2">
                <label
                  htmlFor="whatsapp-number"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Google Maps */}
              <div className="space-y-2 sm:col-span-2">
                <label
                  htmlFor="maps-url"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
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
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#B88A44]/30 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            {/* Automações de Engajamento (ADR-029) */}
            <div className="pt-6 border-t border-slate-200 dark:border-border-dark space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <span className="material-symbols-outlined text-2xl">magic_button</span>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Automações de Engajamento
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#B88A44] text-neutral-950">
                      ADR-029
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Motores assíncronos que blindam a agenda contra no-shows e preenchem horários vagos automaticamente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#B88A44]">
                      <span className="material-symbols-outlined text-base">alarm</span>
                      Lembretes Pré-Agendamento
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Motor Ativo (15m)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Disparos automáticos programados para <strong>24h</strong> e <strong>2h</strong> antes do atendimento.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300">
                      <span className="material-symbols-outlined text-base">hourglass_top</span>
                      Fila de Espera Reativa
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
                      <span className="material-symbols-outlined text-xs">bolt</span>
                      Event-Driven
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Notificação instantânea para clientes em fila quando um agendamento for cancelado na Agenda.
                  </p>
                </div>
              </div>
            </div>

            {/* Feedback & Botão de Salvar */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200 dark:border-border-dark">
              <div className="min-h-[24px] flex items-center" role="status" aria-live="polite">
                {saveSuccess && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Configurações salvas e publicadas na vitrine com sucesso!
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
                className="w-full sm:w-auto px-7 py-3 bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-black text-sm rounded-xl transition-all shadow-md shadow-[#B88A44]/20 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-neutral-950/30 border-t-neutral-950 animate-spin" />
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
