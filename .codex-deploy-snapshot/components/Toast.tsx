import React, { useEffect, useState } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 3000 }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-primary'
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info'
    };

    return (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl text-white shadow-2xl transition-all duration-300 ${colors[type]} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <span className="material-symbols-outlined text-lg">{icons[type]}</span>
            <span className="text-sm font-bold">{message}</span>
            <button onClick={() => { setVisible(false); setTimeout(onClose, 300); }} className="ml-2 opacity-70 hover:opacity-100">
                <span className="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    );
};

export default Toast;
