import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    onClose: () => void;
    duration?: number;
    action?: ToastAction;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 4000, action }) => {
    const [visible, setVisible] = useState(true);
    const [progress, setProgress] = useState(100);
    const [isPaused, setIsPaused] = useState(false);

    // Duração efetiva: se houver botão de ação interativa, concede um tempo maior
    const effectiveDuration = action ? Math.max(duration, 5500) : duration;

    // Controle fino de tempo decorrido para auto-dismiss e barra regressiva com suporte a pause on hover/touch
    const remainingTimeRef = useRef(effectiveDuration);
    const lastTickRef = useRef<number>(Date.now());
    const animFrameRef = useRef<number | null>(null);

    const handleClose = useCallback(() => {
        setVisible(false);
        setTimeout(onClose, 250);
    }, [onClose]);

    useEffect(() => {
        lastTickRef.current = Date.now();

        const updateTimer = () => {
            if (!isPaused) {
                const now = Date.now();
                const delta = now - lastTickRef.current;
                lastTickRef.current = now;

                remainingTimeRef.current -= delta;

                if (remainingTimeRef.current <= 0) {
                    setProgress(0);
                    handleClose();
                    return;
                }

                const newPercent = Math.max(0, (remainingTimeRef.current / effectiveDuration) * 100);
                setProgress(newPercent);
            } else {
                lastTickRef.current = Date.now();
            }

            animFrameRef.current = requestAnimationFrame(updateTimer);
        };

        animFrameRef.current = requestAnimationFrame(updateTimer);

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [isPaused, effectiveDuration, handleClose]);

    const colors = {
        success: 'bg-emerald-600 border-emerald-500 text-white',
        error: 'bg-red-600 border-red-500 text-white',
        info: 'bg-zinc-900 border-zinc-700 text-white',
        warning: 'bg-amber-600 border-amber-500 text-white'
    };

    const progressColors = {
        success: 'bg-emerald-300/80',
        error: 'bg-red-300/80',
        info: 'bg-primary/80',
        warning: 'bg-amber-300/80'
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };

    const content = (
        <aside
            aria-live="polite"
            role="status"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            className={`fixed bottom-6 right-6 z-[9999] flex flex-col overflow-hidden max-w-[90vw] sm:max-w-md rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 ${colors[type]} ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
        >
            <div className="flex items-center gap-3 px-5 py-3.5">
                <span className="material-symbols-outlined text-xl shrink-0 select-none">{icons[type]}</span>
                <span className="text-sm font-semibold flex-1 leading-snug tracking-tight select-text">{message}</span>
                {action && (
                    <button
                        type="button"
                        onClick={() => {
                            action.onClick();
                            handleClose();
                        }}
                        className="shrink-0 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-all shadow-sm"
                    >
                        {action.label}
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleClose}
                    className="ml-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1 transition-colors shrink-0 flex items-center justify-center"
                    aria-label="Fechar notificação"
                >
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            {/* Barra de progresso regressiva de auto-dismiss */}
            <div className="w-full h-1 bg-black/20 overflow-hidden">
                <div
                    className={`h-full transition-all ease-linear ${progressColors[type]}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
        </aside>
    );

    // Se estiver em ambiente Node/SSR sem document.body, renderiza inline defensivamente
    if (typeof document === 'undefined' || !document.body) {
        return content;
    }

    return createPortal(content, document.body);
};

export default Toast;
