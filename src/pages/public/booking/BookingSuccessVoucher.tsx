/**
 * BookingSuccessVoucher - Ticket-style receipt with perforation detail.
 * Formats structured confirmation for WhatsApp and Google Calendar.
 * Designed with SMG Barber dark luxury palette with high-contrast typography.
 */

import type React from 'react';
import { useCallback } from 'react';
import { Calendar, MessageCircle, CheckCircle, Clock, MapPin, User, Scissors, RotateCw } from 'lucide-react';
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

export const buildStructuredWhatsAppConfirmationUrl = (
  tenant: PublicTenantProfile,
  result: CreatePublicBookingResult,
  clientName: string,
  formattedDate: string,
  formattedTime: string
): string => {
  const phone = tenant.whatsapp_number || tenant.social_links?.whatsapp || tenant.phone || '';
  const digits = phone.replace(/\D/g, '');
  const targetNumber = digits.startsWith('55')
    ? digits
    : digits.length >= 10
    ? `55${digits}`
    : digits;

  const servicesList = result.services.map((s) => s.name).join(', ');
  const code = result.appointment_id.slice(0, 8).toUpperCase();

  const message = [
    'Olá, acabei de agendar pelo SMG!',
    `Cliente: ${clientName || 'Não informado'}`,
    `Serviço(s): ${servicesList}`,
    `Profissional: ${result.staff.name}`,
    `Data: ${formattedDate} às ${formattedTime}`,
    `Código: ${code}`,
  ].join('\n');

  return `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
};

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
  const timezone = tenant.booking_rules?.timezone || 'America/Sao_Paulo';

  const timeStr = startDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });
  const endTimeStr = endDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  });

  const formattedDate = dateDisplay.dayLabel
    ? `${dateDisplay.dayLabel} (${dateDisplay.weekday}, ${dateDisplay.day})`
    : `${dateDisplay.weekday}, ${dateDisplay.day}`;

  const bookingCode = result.appointment_id.slice(0, 8).toUpperCase();

  // WhatsApp link
  const whatsAppUrl = buildStructuredWhatsAppConfirmationUrl(
    tenant,
    result,
    clientName,
    formattedDate,
    timeStr
  );

  // Google Calendar link
  const buildGoogleCalendarUrl = useCallback(() => {
    const title = encodeURIComponent(`${result.services.map((s) => s.name).join(', ')} - ${tenant.name}`);
    const details = encodeURIComponent(
      `Serviços: ${result.services.map((s) => s.name).join(', ')}\n` +
      `Profissional: ${result.staff.name}\n` +
      `Cliente: ${clientName || 'Não informado'}\n` +
      `Código: ${bookingCode}\n` +
      `Local: ${tenant.address || 'Não informado'}`
    );
    const location = encodeURIComponent(tenant.address || '');

    const formatForGCal = (date: Date) => {
      return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    };

    const start = formatForGCal(startDate);
    const end = formatForGCal(endDate);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  }, [result, tenant, clientName, startDate, endDate, bookingCode]);

  // Cancel window info
  const cancelWindowMinutes = tenant.booking_rules?.public_cancel_window_minutes || 120;
  const cancelHours = Math.floor(cancelWindowMinutes / 60);
  const cancelMins = cancelWindowMinutes % 60;
  const cancelText = cancelHours > 0
    ? `${cancelHours}h${cancelMins > 0 ? ` ${cancelMins}min` : ''}`
    : `${cancelMins}min`;

  return (
    <div className="w-full max-w-sm mx-auto px-4 py-6 space-y-5 animate-in fade-in duration-300">
      {/* Success Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center size-14 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-400 shadow-xl shadow-emerald-950/60">
          <CheckCircle className="w-7 h-7" />
        </div>
        <h2 className="font-display font-black text-xl text-white tracking-tight">Agendamento Confirmado!</h2>
        <p className="text-xs text-neutral-300">
          Sua reserva foi gravada com sucesso em nosso sistema.
        </p>
      </div>

      {/* Ticket Container */}
      <div className="relative bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Ticket Header */}
        <div className="p-4 bg-gradient-to-r from-neutral-950 to-neutral-900 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Comprovante Digital</span>
            <p className="font-bold text-sm text-white truncate">{tenant.name}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Código</span>
            <p className="font-mono font-black text-xs text-amber-400">{bookingCode}</p>
          </div>
        </div>

        {/* Ticket Body */}
        <div className="p-4 space-y-4">
          {/* Date & Time Highlight */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
            <div className="size-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Data e Horário</span>
              <p className="font-bold text-sm text-white capitalize">
                {formattedDate} · {timeStr} - {endTimeStr}
              </p>
            </div>
          </div>

          {/* Services List */}
          <div>
            <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider mb-2 block">
              Serviço(s) Selecionado(s)
            </span>
            <div className="space-y-1.5">
              {result.services.map((service) => (
                <div key={service.service_id || service.name} className="flex items-center justify-between text-xs py-1.5 border-b border-neutral-800/80 last:border-0">
                  <span className="font-semibold text-white truncate flex-1 pr-2">{service.name}</span>
                  <span className="text-neutral-300 pr-3">{service.duration} min</span>
                  <span className="font-bold text-amber-400 tabular-nums">{formatPriceBRL(service.price)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Professional & Client */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider flex items-center gap-1 mb-0.5">
                <User className="w-3 h-3 text-amber-400" />
                Profissional
              </span>
              <p className="font-bold text-white truncate">{result.staff.name}</p>
            </div>
            <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider flex items-center gap-1 mb-0.5">
                <User className="w-3 h-3 text-amber-400" />
                Cliente
              </span>
              <p className="font-bold text-white truncate">{clientName || 'Não informado'}</p>
              {clientPhone && <p className="text-[10px] text-neutral-400 truncate">{clientPhone}</p>}
            </div>
          </div>

          {/* Location */}
          {tenant.address && (
            <div className="flex items-start gap-2 p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
              <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider block">Endereço</span>
                <p className="text-xs text-neutral-200 truncate">{tenant.address}</p>
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="flex items-center justify-between pt-2 border-t border-dashed border-neutral-800">
            <span className="text-xs text-neutral-300">
              Duração: <strong className="text-white font-bold">{formatDuration(totalDuration)}</strong>
            </span>
            <div className="text-right">
              <span className="text-[10px] text-neutral-400 uppercase font-bold block">Valor Total</span>
              <span className="font-black text-base text-amber-400 tabular-nums">{formatPriceBRL(totalPrice)}</span>
            </div>
          </div>

          {/* Cancellation Notice */}
          <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-2 text-[11px] text-neutral-300">
            <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p>
              Cancelamento gratuito em até <strong className="text-white font-bold">{cancelText}</strong> antes do horário.
            </p>
          </div>
        </div>

        {/* Scissors watermark decoration */}
        <div className="absolute bottom-2 right-2 opacity-5 pointer-events-none" aria-hidden="true">
          <Scissors className="w-12 h-12 text-white" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-1">
        {/* Primary Action: Reenviar no WhatsApp */}
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-[0.99] cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          Reenviar confirmação no WhatsApp
        </a>

        {/* Secondary: Google Calendar */}
        <a
          href={buildGoogleCalendarUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-white hover:border-amber-500/50 transition-all text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-amber-400" />
          Adicionar ao Google Agenda
        </a>

        {/* Tertiary: Novo Agendamento */}
        <button
          type="button"
          onClick={onNewBooking}
          className="w-full py-2.5 px-4 rounded-xl text-neutral-400 hover:text-white transition-colors text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Fazer outro agendamento
        </button>
      </div>
    </div>
  );
};

export default BookingSuccessVoucher;
