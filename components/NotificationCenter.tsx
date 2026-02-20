import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';

export interface Notification {
    id: string;
    type: 'appointment_reminder' | 'stock_low' | 'purchase_request' | 'transaction' | 'system_alert' | 'admin_message';
    title: string;
    description: string;
    read: boolean;
    created_at: string;
}

interface NotificationCenterProps {
    onClose?: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filter, setFilter] = useState<'all' | 'unread'>('unread');
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotifications = async () => {
        if (!user) return;
        setIsLoading(true);

        let query = supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (filter === 'unread') {
            query = query.eq('read', false);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching notifications:', error);
        } else {
            setNotifications(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchNotifications();

        if (!user) return;

        // Realtime Subscription
        const channel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    setNotifications(prev => [newNotification, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, filter]);

    const markAsRead = async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', id);

        if (!error) {
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        }
    };

    const markAllAsRead = async () => {
        if (!user) return;
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('read', false);

        if (!error) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'appointment_reminder': return 'calendar_today';
            case 'stock_low': return 'inventory_2';
            case 'purchase_request': return 'shopping_cart';
            case 'transaction': return 'payments';
            case 'admin_message': return 'campaign';
            default: return 'notifications';
        }
    };

    const getIconColor = (type: Notification['type']) => {
        switch (type) {
            case 'appointment_reminder': return 'text-blue-500 bg-blue-500/10';
            case 'stock_low': return 'text-amber-500 bg-amber-500/10';
            case 'purchase_request': return 'text-primary bg-primary/10';
            case 'transaction': return 'text-emerald-500 bg-emerald-500/10';
            case 'admin_message': return 'text-purple-500 bg-purple-500/10';
            default: return 'text-slate-500 bg-slate-500/10';
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filter === 'unread' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                        Não lidas
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${filter === 'all' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                        Todas
                    </button>
                </div>
                <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:underline font-bold"
                >
                    Marcar todas como lidas
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {isLoading ? (
                    <div className="flex flex-col gap-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 animate-pulse rounded-xl"></div>
                        ))}
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">notifications_off</span>
                        <p className="text-slate-500 text-sm">Nenhum aviso por aqui.</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <div
                            key={n.id}
                            className={`p-4 rounded-xl border transition-all flex gap-3 relative overflow-hidden group ${n.read ? 'bg-white dark:bg-card-dark border-slate-100 dark:border-border-dark opacity-70' : 'bg-slate-50 dark:bg-white/5 border-primary/20 shadow-sm'}`}
                        >
                            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${getIconColor(n.type)}`}>
                                <span className="material-symbols-outlined text-xl">{getIcon(n.type)}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className={`text-sm font-bold truncate pr-6 ${n.read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>
                                        {n.title}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                    {n.description}
                                </p>
                            </div>

                            {!n.read && (
                                <button
                                    onClick={() => markAsRead(n.id)}
                                    className="absolute right-2 bottom-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-primary/10 rounded"
                                    title="Marcar como lida"
                                >
                                    <span className="material-symbols-outlined text-sm">done_all</span>
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {onClose && (
                <div className="pt-4 mt-auto">
                    <Button variant="secondary" className="w-full" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
