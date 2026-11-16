import type React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTenantCommunicationConfig } from '../../hooks/useTenantCommunicationConfig';
import {
  buildAppointmentWhatsAppTemplates,
  generateWhatsAppLink,
  isValidWhatsAppPhone,
  type WhatsAppTemplateOption,
} from '../../utils/whatsappHub';

export interface WhatsAppTemplateDropdownProps {
  clientName: string;
  clientPhone?: string | null;
  serviceName: string;
  timeLabel: string;
  tenantId?: string | null;
  bookingUrlOverride?: string | null;
  className?: string;
  buttonClassName?: string;
  label?: string;
  align?: 'left' | 'right';
}

interface FloatingMenuPosition {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
}

export const WhatsAppTemplateDropdown: React.FC<WhatsAppTemplateDropdownProps> = ({
  clientName,
  clientPhone,
  serviceName,
  timeLabel,
  tenantId,
  bookingUrlOverride,
  className = '',
  buttonClassName = '',
  label = 'WhatsApp',
  align = 'left',
}) => {
  const { bookingUrl } = useTenantCommunicationConfig(tenantId);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const effectiveBookingUrl = bookingUrlOverride?.trim() || bookingUrl;
  const phoneValid = isValidWhatsAppPhone(clientPhone);

  const templates = useMemo(
    () =>
      buildAppointmentWhatsAppTemplates({
        clientName,
        serviceName,
        timeLabel,
        bookingUrl: effectiveBookingUrl,
      }),
    [clientName, serviceName, timeLabel, effectiveBookingUrl],
  );

  const updateMenuPosition = useCallback(() => {
    if (typeof window === 'undefined' || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const desiredWidth = Math.min(320, Math.max(264, rect.width));
    const estimatedHeight = 292;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

    let left = align === 'right' ? rect.right - desiredWidth : rect.left;
    const maxLeft = window.innerWidth - desiredWidth - 12;
    left = Math.max(12, Math.min(left, maxLeft));

    const top = openUpward ? Math.max(12, rect.top - 8) : rect.bottom + 8;

    setMenuPosition({
      top,
      left,
      width: desiredWidth,
      openUpward,
    });
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      if (!items || items.length === 0) return;

      event.preventDefault();
      const activeIndex = Array.from(items).indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        activeIndex === -1
          ? 0
          : (activeIndex + delta + items.length) % items.length;
      items[nextIndex]?.focus();
    };

    const handleReposition = () => {
      updateMenuPosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updateMenuPosition]);

  const handleToggle = () => {
    if (!phoneValid) return;
    setIsOpen((prev) => !prev);
  };

  const handleSelectTemplate = (template: WhatsAppTemplateOption) => {
    const link = generateWhatsAppLink(clientPhone, template.message);
    setIsOpen(false);
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={!phoneValid}
        aria-haspopup="menu"
        aria-expanded={phoneValid ? isOpen : false}
        aria-controls={phoneValid && isOpen ? menuId : undefined}
        title={
          phoneValid
            ? 'Abrir opções de mensagem WhatsApp'
            : 'Cliente sem telefone cadastrado'
        }
        aria-label={
          phoneValid
            ? `${label}: escolher modelo de mensagem`
            : `${label} indisponível: cliente sem telefone cadastrado`
        }
        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#B88A44]/60 bg-[#141414] px-4 py-2.5 text-sm font-bold text-[#F5F2EB] shadow-sm transition-all hover:border-[#B88A44] hover:bg-[#1E1A14] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B88A44]/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:border-[#262626] disabled:hover:bg-[#141414] ${buttonClassName}`}
      >
        <span className="material-symbols-outlined text-base text-[#B88A44]">
          chat
        </span>
        <span>{label}</span>
        {phoneValid && (
          <span
            className={`material-symbols-outlined text-base text-[#B88A44] transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        )}
      </button>

      {phoneValid &&
        isOpen &&
        menuPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Modelos de mensagem WhatsApp"
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              transform: menuPosition.openUpward ? 'translateY(-100%)' : 'none',
            }}
            className="z-[130] rounded-2xl border border-[#262626] bg-[#141414] p-2 text-[#F5F2EB] shadow-2xl shadow-black/70 ring-1 ring-[#B88A44]/25 animate-fade-in"
          >
            <div className="px-2.5 py-2 border-b border-[#262626] flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#B88A44]">
                Hub WhatsApp · Templates
              </span>
              <span className="text-[10px] font-medium text-[#A39E93] truncate max-w-[140px]">
                {clientName}
              </span>
            </div>

            <div className="mt-1.5 space-y-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-[#1E1A14] focus:bg-[#1E1A14] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B88A44] flex items-start gap-2.5 group cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg text-[#B88A44] shrink-0 mt-0.5">
                    {template.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#F5F2EB] group-hover:text-[#B88A44] transition-colors">
                      {template.label}
                    </p>
                    <p className="text-[11px] text-[#A39E93] leading-snug mt-0.5">
                      {template.description}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-sm text-[#A39E93] group-hover:text-[#B88A44] shrink-0 mt-1">
                    open_in_new
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default WhatsAppTemplateDropdown;
