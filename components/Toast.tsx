import React, { useEffect, useState } from 'react';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    onClose: () => void;
    duration?: number;
    action?: ToastAction;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 3000, action }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // Se houver ação interativa, concede um tempo ligeiramente maior para o usuário clicar
        const effectiveDuration = action ? Math.max(duration, 5000) : duration;
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, effectiveDuration);
        return () => clearTimeout(timer);
    }, [duration, onClose, action]);

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-primary',
        warning: 'bg-amber-500'
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };

    return (
        <div className={`fixed bottom-6 right-6 z-[100] flex max-w-[90vw] sm:max-w-md items-center gap-3 px-5 py-3 rounded-xl text-white shadow-2xl transition-all duration-300 ${colors[type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <span className="material-symbols-outlined text-lg shrink-0">{icons[type]}</span>
            <span className="text-sm font-bold flex-1 leading-snug">{message}</span>
            {action && (
                <button
                    type="button"
                    onClick={() => {
                        action.onClick();
                        setVisible(false);
                        setTimeout(onClose, 300);
                    }}
                    className="shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition-colors shadow-sm"
                >
                    {action.label}
                </button>
            )}
            <button
                type="button"
                onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
                className="ml-1 opacity-70 hover:opacity-100 shrink-0"
                aria-label="Fechar notificação"
            >
                <span className="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    );
};

export default Toast;
