/**
 * Minimal Toast component for inline error/success messages.
 * No external dependencies - pure React + Tailwind.
 */

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export type ToastVariant = 'error' | 'warning' | 'success' | 'info';

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onClose: () => void;
  autoCloseMs?: number;
}

const variantStyles: Record<ToastVariant, string> = {
  error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
  warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
};

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  error: <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  warning: <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  success: <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  info: <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

export const Toast: React.FC<ToastProps> = ({
  message,
  variant = 'error',
  onClose,
  autoCloseMs = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoCloseMs) return;
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Call onClose after animation
      setTimeout(onClose, 200);
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border ${variantStyles[variant]} animate-fade-in`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">{variantIcons[variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 200);
        }}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast container for multiple toasts (though we only need one at a time)
export interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; variant?: ToastVariant }>;
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            message={toast.message}
            variant={toast.variant}
            onClose={() => onClose(toast.id)}
            autoCloseMs={5000}
          />
        </div>
      ))}
    </div>
  );
};