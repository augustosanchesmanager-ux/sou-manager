import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface AlertItem {
    id: string;
    type: 'appointment' | 'stock' | 'comanda' | 'promotion';
    title: string;
    description: string;
    time?: string;
    actionPath: string;
    priority: 'high' | 'medium' | 'low';
}

const DashboardAlerts: React.FC = () => {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            fetchAlerts();
        }
    }, [user]);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const startOfDay = new Date(`${todayStr}T00:00:00`).toISOString();
            const endOfDay = new Date(`${todayStr}T23:59:59`).toISOString();

            // Fetch upcoming appointments for today
            const { data: appts } = await supabase
                .from('appointments')
                .select('id, client_name, start_time')
                .eq('status', 'confirmed')
                .gte('start_time', startOfDay)
                .lte('start_time', endOfDay)
                .order('start_time', { ascending: true });

            // Fetch low stock products (stock <= min_stock)
            const { data: products } = await supabase
                .from('products')
                .select('id, name, stock, min_stock')
                .lte('stock', 5); // Fallback logic for low stock

            // Fetch open comandas from previous days (pending payment)
            const { data: comandas } = await supabase
                .from('comandas')
                .select('id, client_id, created_at')
                .eq('status', 'open')
                .lt('created_at', startOfDay);

            // Fetch active promotions
            const { data: promos } = await supabase
                .from('promotions')
                .select('id, title, end_date')
                .eq('active', true);

            const newAlerts: AlertItem[] = [];

            appts?.forEach(apt => {
                newAlerts.push({
                    id: `apt-${apt.id}`,
                    type: 'appointment',
                    title: `Agendamento: ${apt.client_name}`,
                    description: 'Hoje',
                    time: new Date(apt.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    actionPath: '/schedule',
                    priority: 'medium'
                });
            });

            products?.filter(p => p.stock <= (p.min_stock || 5)).forEach(prod => {
                newAlerts.push({
                    id: `prod-${prod.id}`,
                    type: 'stock',
                    title: 'Estoque Baixo',
                    description: `${prod.name} (${prod.stock} restam)`,
                    actionPath: '/products',
                    priority: prod.stock === 0 ? 'high' : 'medium'
                });
            });

            comandas?.forEach(com => {
                newAlerts.push({
                    id: `com-${com.id}`,
                    type: 'comanda',
                    title: 'Comanda Aberta Atrasada',
                    description: `Aberta em ${new Date(com.created_at).toLocaleDateString('pt-BR')}`,
                    actionPath: '/comandas',
                    priority: 'high'
                });
            });

            promos?.forEach(pro => {
                newAlerts.push({
                    id: `pro-${pro.id}`,
                    type: 'promotion',
                    title: 'Promoção Ativa',
                    description: `${pro.title} (Até ${new Date(pro.end_date).toLocaleDateString('pt-BR')})`,
                    actionPath: '/promotions',
                    priority: 'low'
                });
            });

            // Sort by priority and time
            newAlerts.sort((a, b) => {
                if (a.priority === 'high' && b.priority !== 'high') return -1;
                if (a.priority !== 'high' && b.priority === 'high') return 1;
                return 0;
            });

            setAlerts(newAlerts);
        } catch (error) {
            console.error('Error fetching alerts', error);
        }
        setLoading(false);
    };

    if (loading) return null;

    return (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden mb-6 animate-fade-in">
            <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-3 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-lg">notifications_active</span>
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">Lembretes e Alertas</h3>
                </div>
                <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {alerts.length}
                </span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-border-dark max-h-60 overflow-y-auto">
                {alerts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                        Nenhum alerta pendente no momento.
                    </div>
                ) : (
                    alerts.map(alert => (
                        <div
                            key={alert.id}
                            onClick={() => navigate(alert.actionPath)}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors flex items-center gap-3"
                        >
                            <div className={`p-2 rounded-lg shrink-0 ${alert.type === 'appointment' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                alert.type === 'stock' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                                    alert.type === 'promotion' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                        'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                                }`}>
                                <span className="material-symbols-outlined text-sm">
                                    {alert.type === 'appointment' ? 'event' : alert.type === 'stock' ? 'inventory_2' : alert.type === 'promotion' ? 'discount' : 'receipt_long'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{alert.title}</p>
                                    {alert.time && <span className="text-[10px] font-bold text-slate-500">{alert.time}</span>}
                                </div>
                                <p className="text-xs text-slate-500 truncate">{alert.description}</p>
                            </div>
                            {alert.priority === 'high' && (
                                <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DashboardAlerts;
