import type React from 'react';
import { useState, useRef, useMemo } from 'react';
import QRCode from 'react-qr-code';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  Maximize2,
  X,
  User,
  ExternalLink,
} from 'lucide-react';
import {
  buildTenantPublicBookingUrl,
  downloadQrSvgAsPng,
  printCounterPlacard,
  serializeSvgElement,
} from '../../lib/qrcode/bookingQrExport';

export interface BookingQrStaffOption {
  id: string;
  name: string;
  role?: string | null;
}

export interface BookingQrCodePanelProps {
  tenantSlug: string;
  shopDisplayName: string;
  primaryColor?: string;
  slogan?: string | null;
  address?: string | null;
  staffOptions?: BookingQrStaffOption[];
  variant?: 'section' | 'modal';
  onCloseModal?: () => void;
}

export const BookingQrCodePanel: React.FC<BookingQrCodePanelProps> = ({
  tenantSlug,
  shopDisplayName,
  primaryColor = '#B88A44',
  slogan,
  address,
  staffOptions = [],
  variant = 'section',
  onCloseModal,
}) => {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);

  const qrContainerRef = useRef<HTMLDivElement | null>(null);

  const selectedStaff = useMemo(() => {
    if (selectedStaffId === 'all') return null;
    return staffOptions.find((s) => s.id === selectedStaffId) || null;
  }, [selectedStaffId, staffOptions]);

  const effectiveBookingUrl = useMemo(() => {
    return buildTenantPublicBookingUrl({
      slug: tenantSlug,
      staffId: selectedStaffId === 'all' ? null : selectedStaffId,
    });
  }, [tenantSlug, selectedStaffId]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(effectiveBookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
    }
  };

  const handleDownloadPng = async () => {
    const svgEl = qrContainerRef.current?.querySelector('svg');
    if (!svgEl) return;

    setDownloading(true);
    try {
      const safeSlug = (tenantSlug || 'barbearia').replace(/[^a-z0-9-_]/gi, '-');
      const staffSuffix = selectedStaff
        ? `-${selectedStaff.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
        : '';
      await downloadQrSvgAsPng(svgEl, `qrcode-agendamento-${safeSlug}${staffSuffix}.png`);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPlacard = () => {
    const svgEl = qrContainerRef.current?.querySelector('svg');
    if (!svgEl) return;

    const svgMarkup = serializeSvgElement(svgEl);
    printCounterPlacard({
      shopName: shopDisplayName || 'Barbearia',
      bookingUrl: effectiveBookingUrl,
      svgMarkup,
      barberName: selectedStaff?.name ?? null,
      primaryColor,
      slogan,
      address,
    });
  };

  return (
    <>
      <div
        className={
          variant === 'modal'
            ? 'space-y-5'
            : 'mt-4 pt-5 border-t border-slate-200 dark:border-border-dark'
        }
      >
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* QR Code Preview Box */}
          <div className="flex flex-col items-center shrink-0">
            <div
              ref={qrContainerRef}
              className="bg-white p-4 rounded-2xl border-2 border-[#B88A44]/40 shadow-md flex items-center justify-center"
              data-testid="tenant-booking-qrcode-box"
            >
              <QRCode
                value={effectiveBookingUrl}
                size={156}
                bgColor="#FFFFFF"
                fgColor="#0A0A0A"
                level="M"
              />
            </div>
            <span className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {selectedStaff ? `Agenda: ${selectedStaff.name}` : 'Link Geral da Barbearia'}
            </span>
          </div>

          {/* Controls & Actions */}
          <div className="flex-1 w-full space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#B88A44]">
                  <QrCode className="w-4 h-4" />
                  <span>QR Code Automático de Agendamento</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Gere o QR Code geral da barbearia ou exclusivo por profissional para colocar na bancada, recepção ou espelho.
                </p>
              </div>
              {variant === 'modal' && onCloseModal && (
                <button
                  type="button"
                  onClick={onCloseModal}
                  aria-label="Fechar modal de QR Code"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Destination Selector: General vs Specific Barber (Option 3) */}
            {staffOptions.length > 0 && (
              <div className="space-y-1.5">
                <label
                  htmlFor="booking-qr-staff-select"
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  <User className="w-3.5 h-3.5 text-[#B88A44]" />
                  <span>Destino do QR Code (Escolha da Barbearia)</span>
                </label>
                <select
                  id="booking-qr-staff-select"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full sm:max-w-xs px-3.5 py-2.5 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#B88A44]/30"
                >
                  <option value="all">Geral da Barbearia (Cliente escolhe o profissional)</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      Profissional: {staff.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic URL display */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={effectiveBookingUrl}
                aria-label="URL codificada no QR Code"
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-border-dark rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 select-all outline-none"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark hover:border-[#B88A44] text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                title="Copiar link do QR Code"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
              <a
                href={effectiveBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark hover:border-[#B88A44] text-slate-600 dark:text-slate-300 transition-colors"
                title="Testar link em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Action Buttons: Print Counter Placard, Download PNG, Fullscreen */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handlePrintPlacard}
                className="px-4 py-2.5 rounded-xl bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-extrabold text-xs flex items-center gap-2 shadow-sm shadow-[#B88A44]/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Placa de Balcão</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={downloading}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark hover:border-[#B88A44] text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-[#B88A44]" />
                <span>{downloading ? 'Gerando PNG...' : 'Baixar PNG'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreenOpen(true)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark hover:border-[#B88A44] text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Mostrar na Tela</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Counter Display Modal */}
      {isFullscreenOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="QR Code de Agendamento em Tela Cheia"
        >
          <div className="relative w-full max-w-sm bg-neutral-950 border-2 border-[#B88A44] rounded-3xl p-7 text-center shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setIsFullscreenOpen(false)}
              aria-label="Fechar visualização ampliada"
              className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="inline-block px-3 py-1 rounded-full bg-[#B88A44]/15 border border-[#B88A44]/40 text-[#B88A44] text-[10px] font-black uppercase tracking-widest">
              Agendamento Online
            </span>

            <h3 className="text-2xl font-black text-white tracking-tight">
              {shopDisplayName || 'Barbearia'}
            </h3>

            {selectedStaff && (
              <p className="text-xs font-bold text-amber-300">
                Profissional: {selectedStaff.name}
              </p>
            )}

            <div className="bg-white p-5 rounded-2xl inline-flex items-center justify-center border-4 border-[#B88A44] shadow-lg mx-auto">
              <QRCode
                value={effectiveBookingUrl}
                size={220}
                bgColor="#FFFFFF"
                fgColor="#0A0A0A"
                level="M"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-extrabold text-white">
                Aponte a câmera do seu celular
              </p>
              <p className="text-xs text-neutral-400">
                Agende seu horário em segundos, sem precisar baixar aplicativo.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
