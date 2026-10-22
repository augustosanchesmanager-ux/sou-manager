/**
 * StaffSelectionModal - Modal / Bottom Sheet for Phase 2 of Booking:
 * Professional selection with 'Any Staff Available' card and active barbers.
 */

import type React from 'react';
import { Zap, Check, ArrowLeft, X, User } from 'lucide-react';
import type { PublicStaff } from '../hooks/types';

interface StaffSelectionModalProps {
  isOpen: boolean;
  staffList: PublicStaff[];
  selectedStaffId: string | null;
  anyStaffId: string;
  onSelectStaff: (staffId: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export const StaffSelectionModal: React.FC<StaffSelectionModalProps> = ({
  isOpen,
  staffList,
  selectedStaffId,
  anyStaffId,
  onSelectStaff,
  onBack,
  onClose,
}) => {
  if (!isOpen) return null;

  const activeStaff = staffList.filter((s) => s.status === 'active');

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-modal-title"
    >
      {/* Backdrop dismiss */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      {/* Modal Card */}
      <div className="w-full max-w-md bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200">
        
        {/* Mobile handle */}
        <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" aria-hidden="true" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="size-8 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Voltar ao serviço"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">Fase 2 de 3</span>
              <h2 id="staff-modal-title" className="text-white font-bold text-base sm:text-lg tracking-tight">
                Escolha o Profissional
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          <p className="text-xs text-neutral-400">
            Selecione quem você deseja que realize seu atendimento:
          </p>

          {/* Option: Qualquer Profissional Disponível */}
          <button
            type="button"
            onClick={() => onSelectStaff(anyStaffId)}
            className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${
              selectedStaffId === anyStaffId
                ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/50 shadow-md'
                : 'bg-neutral-950 border-neutral-800 hover:border-amber-500/40'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="size-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Zap size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold text-sm truncate">Qualquer Profissional</h3>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950">
                    Mais Rápido
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  O sistema escolhe o primeiro barbeiro com horário livre.
                </p>
              </div>
            </div>

            <div
              className={`size-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedStaffId === anyStaffId
                  ? 'border-amber-500 bg-amber-500 text-neutral-950'
                  : 'border-neutral-700 bg-neutral-900'
              }`}
            >
              {selectedStaffId === anyStaffId && <Check size={12} strokeWidth={3} />}
            </div>
          </button>

          {/* Individual Barbers */}
          <div className="space-y-2 pt-2">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
              Ou escolha o barbeiro:
            </span>

            {activeStaff.map((barber) => {
              const isSelected = selectedStaffId === barber.id;

              return (
                <button
                  key={barber.id}
                  type="button"
                  onClick={() => onSelectStaff(barber.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/50 shadow-md'
                      : 'bg-neutral-950 border-neutral-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className="size-12 rounded-xl overflow-hidden bg-neutral-800 border border-neutral-700 flex items-center justify-center flex-shrink-0">
                      {barber.avatar_url ? (
                        <img
                          src={barber.avatar_url}
                          alt={barber.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-display font-bold text-sm text-amber-400">
                          {getInitials(barber.name)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-bold text-sm truncate">{barber.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <span className="size-1 rounded-full bg-emerald-400 animate-pulse" />
                          Disponível
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`size-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-neutral-950'
                        : 'border-neutral-700 bg-neutral-900'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}

            {activeStaff.length === 0 && (
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center text-xs text-neutral-400">
                <User className="size-6 text-neutral-500 mx-auto mb-1" />
                Nenhum profissional com agenda online ativa no momento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
