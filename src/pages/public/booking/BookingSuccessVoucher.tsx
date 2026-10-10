/**
 * BookingSuccessVoucher - Ticket-style receipt with perforation detail.
 * Buttons: "Adicionar ao Google Agenda" and "Confirmar no WhatsApp".
 * Shows cancel window info line.
 */

import React, { useCallback } from 'react';
import { Calendar, MessageCircle, CheckCircle, Clock, MapPin, User, Scissors, Plus } from 'lucide-react';
import type { CreatePublicBookingResult, PublicTenantProfile } from './hooks/types';

interface BookingSuccessVoucherProps {
  result: CreatePublicBookingResult;
  tenant: PublicTenantProfile;
  clientName: string;
  clientPhone: string;
  onNewBooking: () => void;
  formatDuration: (minutes: number) => string;
  formatPriceBRL: (price: number) => string;
  formatDateForDisplay: (dateStr: string) => { dayLabel: string; weekday: string; day: string };
}

const BookingSuccessVoucher: React.FC<BookingSuccessVoucherProps> = ({
  result,
  tenant,
  clientName,
  clientPhone,
  onNewBooking,
  formatDuration,
  formatPriceBRL,
  formatDateForDisplay,
}) => {
  // Calculate total duration and price
  const totalDuration = result.services.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = result.services.reduce((sum, s) => sum + s.price, 0);

  // Format date/time for display
  const startDate = new Date(result.start_time);
  const endDate = new Date(result.end_time);
  const dateStr = result.start_time.split('T')[0];
  const dateDisplay = formatDateForDisplay(dateStr);
  const timeStr = startDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  });
  const endTimeStr = endDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  });

  // Google Calendar link
  const buildGoogleCalendarUrl = useCallback(() => {
    const title = encodeURIComponent(`${result.services.map(s => s.name).join(', ')} - ${tenant.name}`);
    const details = encodeURIComponent(
      `Serviços: ${result.services.map(s => s.name).join(', ')}\n` +
      `Profissional: ${result.staff.name}\n` +
      `Cliente: ${clientName || 'Não informado'}\n` +
      `Local: ${tenant.address || 'Não informado'}`
    );
    const location = encodeURIComponent(tenant.address || '');

    // Format dates as YYYYMMDDTHHmmssZ (UTC)
    const formatForGCal = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const start = formatForGCal(startDate);
    const end = formatForGCal(endDate);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  }, [result, tenant, clientName, startDate, endDate]);

  // WhatsApp link
  const buildWhatsAppUrl = useCallback(() => {
    const servicesText = result.services.map(s => s.name).join(', ');
    const message = `Olá! Acabei de agendar ${servicesText} para ${dateDisplay.dayLabel ? `${dateDisplay.dayLabel} (${dateDisplay.weekday}, ${dateDisplay.day})` : `${dateDisplay.weekday}, ${dateDisplay.day}`} às ${timeStr} com ${result.staff.name} pelo site. Nome: ${clientName || 'Não informado'}.`;
    const phone = tenant.social_links?.whatsapp || tenant.phone || '';
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }, [result, tenant, clientName, dateDisplay, timeStr]);

  // Cancel window info
  const cancelWindowMinutes = tenant.booking_rules.public_cancel_window_minutes;
  const cancelHours = Math.floor(cancelWindowMinutes / 60);
  const cancelMins = cancelWindowMinutes % 60;
  const cancelText = cancelHours > 0
    ? `${cancelHours}h${cancelMins > 0 ? ` ${cancelMins}min` : ''}`
    : `${cancelMins}min`;

  return (
      <div className="max-w-2xl mx-auto px-4 pb-8 space-y-6">
      {/* Success Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="font-display font-black text-2xl text-ink">Agendamento Confirmado!</h2>
        <p className="text-ink-soft">Seu horário está garantido. Enviamos os detalhes para seu WhatsApp.</p>
      </div>

      {/* Voucher Ticket */}
      <div className="relative bg-white dark:bg-card-dark border border-line rounded-3xl overflow-hidden shadow-smg-shell">
        {/* Perforation top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 translate-y-[-4px] flex gap-1" aria-hidden="true">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-1 h-8 bg-gradient-to-b from-transparent via-line to-transparent rounded-full" />
          ))}
        </div>

        {/* Ticket content */}
        <div className="p-6 space-y-5 relative">
          {/* Confirmation badge */}
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
              <CheckCircle className="w-4 h-4" />
              Confirmado
            </span>
            {result.public_token && (
              <span className="px-2 py-1 rounded text-[10px] font-mono text-ink-soft bg-line/40" title="Token de acesso">
                {result.public_token.slice(0, 12)}...
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-line my-2" role="separator" />

          {/* Date & Time */}
          <div className="flex items-center gap-4 p-4 bg-cream dark:bg-smg-ink rounded-2xl border border-line/50">
            <div className="flex-shrink-0 size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-soft uppercase tracking-wide">Data e Horário</p>
              <p className="font-bold text-ink leading-snug">
                {dateDisplay.dayLabel ? `${dateDisplay.dayLabel}, ` : ''}
                {dateDisplay.weekday}, {dateDisplay.day} · {timeStr} - {endTimeStr}
              </p>
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-xs text-ink-soft uppercase tracking-wide mb-3">Serviços</p>
            <div className="space-y-2">
              {result.services.map((service, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-line/50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-medium text-ink truncate">{service.name}</span>
                    <span className="text-xs text-ink-soft whitespace-nowrap">{service.duration} min</span>
                  </div>
                  <span className="font-bold text-ink tabular-nums whitespace-nowrap">{formatPriceBRL(service.price)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-line my-2" role="separator" />

          {/* Professional & Client */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-cream dark:bg-smg-ink rounded-xl border border-line/50">
              <p className="text-xs text-ink-soft uppercase tracking-wide mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                Profissional
              </p>
              <p className="font-bold text-ink truncate">{result.staff.name}</p>
            </div>
            <div className="p-3 bg-cream dark:bg-smg-ink rounded-xl border border-line/50">
              <p className="text-xs text-ink-soft uppercase tracking-wide mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                Cliente
              </p>
              <p className="font-bold text-ink truncate">{clientName || 'Não informado'}</p>
              {clientPhone && (
                <p className="text-xs text-ink-soft truncate mt-0.5">{clientPhone}</p>
              )}
            </div>
          </div>

          {/* Location */}
          {tenant.address && (
            <div className="flex items-center gap-3 p-3 bg-cream dark:bg-smg-ink rounded-xl border border-line/50">
              <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-ink-soft uppercase tracking-wide">Local</p>
                <p className="font-medium text-ink truncate">{tenant.address}</p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-dashed border-line my-2" role="separator" />

          {/* Total */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <Clock className="w-4 h-4" />
              <span>Duração total: <span className="font-bold text-ink">{formatDuration(totalDuration)}</span></span>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-soft">Total</p>
              <p className="font-black text-xl text-ink tabular-nums">{formatPriceBRL(totalPrice)}</p>
            </div>
          </div>

          {/* Cancel window info */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-bold">Cancelamento gratuito até {cancelText} antes do horário.</span>{' '}
              Após isso, pode haver cobrança.
            </p>
          </div>
        </div>

        {/* Perforation bottom */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-[4px] flex gap-1" aria-hidden="true">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="w-1 h-8 bg-gradient-to-t from-transparent via-line to-transparent rounded-full" />
          ))}
        </div>

        {/* Scissors decoration */}
        <div className="absolute bottom-4 right-4 opacity-20" aria-hidden="true">
          <Scissors className="w-6 h-6 text-line" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <a
          href={buildGoogleCalendarUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 border-line bg-white dark:bg-card-dark text-ink font-bold text-sm transition-all hover:border-primary/50 hover:bg-gold-pale/50"
        >
          <Calendar className="w-5 h-5" />
          Adicionar ao Google Agenda
        </a>

        <a
          href={buildWhatsAppUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 font-bold text-sm transition-all hover:bg-green-500/20"
        >
          <MessageCircle className="w-5 h-5" />
          Confirmar no WhatsApp
        </a>
      </div>

      {/* New booking button */}
      <button
        type="button"
        onClick={onNewBooking}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-line bg-white dark:bg-card-dark text-ink-soft font-medium text-sm transition-all hover:border-primary/50 hover:text-primary"
      >
        <Plus className="w-5 h-5" />
        Novo agendamento
      </button>

      {/* Share / Save hint */}
        <p className="text-center text-xs text-ink-soft">
        Guarde este comprovante. Token: <code className="font-mono text-ink">{result.public_token?.slice(0, 16) || 'N/A'}</code>
      </p>
    </div>
  );
};

export default BookingSuccessVoucher;