import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';

interface Comanda {
    id: string;
    client_id: string;
    appointment_id?: string;
    status: 'open' | 'paid' | 'cancelled';
    total: number;
    created_at: string;
    clients: {
        name: string;
        avatar: string;
    };
    staff?: {
        name: string;
    };
    comanda_items: {
        id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
    }[];
}

const Comandas: React.FC = () => {
    const navigate = useNavigate();
    const [comandas, setComandas] = useState<Comanda[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'paid' | 'cancelled'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Modal states
    const [viewComanda, setViewComanda] = useState<Comanda | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('comandas')
                .select(`
                    *,
                    clients(name, avatar),
                    staff(name),
                    comanda_items(id, product_name, quantity, unit_price)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setComandas(data as any);
        } catch (err) {
            console.error(err);
            setToast({ message: 'Erro ao carregar comandas.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredComandas = comandas.filter(comanda => {
        const matchesStatus = filterStatus === 'all' || comanda.status === filterStatus;
        const matchesSearch =
            comanda.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comanda.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comanda.staff?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    // KPIs
    const openCount = comandas.filter(c => c.status === 'open').length;
    const paidToday = comandas.filter(c => c.status === 'paid' && new Date(c.created_at).toDateString() === new Date().toDateString()).length;
    const totalOpen = comandas.filter(c => c.status === 'open').reduce((sum, c) => sum + (c.total || 0), 0);
    const avgTicket = comandas.length > 0 ? comandas.reduce((sum, c) => sum + (c.total || 0), 0) / comandas.length : 0;

    // Export Functions
    const generateCSV = () => {
        const headers = ["ID", "Cliente", "Profissional", "Serviços", "Total", "Status", "Data"];
        const rows = filteredComandas.map(c => [
            c.id,
            c.clients?.name,
            c.staff?.name || 'N/A',
            c.comanda_items.map(i => i.product_name).join(" + "),
            (c.total || 0).toFixed(2),
            c.status,
            new Date(c.created_at).toLocaleDateString('pt-BR')
        ]);
        const csvContent = "data:text/csv;charset=utf-8,"
            + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `relatorio_comandas_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const copyToClipboard = () => {
        const headers = ["ID", "Cliente", "Profissional", "Serviços", "Total", "Status", "Data"];
        const rows = filteredComandas.map(c => [
            c.id,
            c.clients?.name,
            c.staff?.name || 'N/A',
            c.comanda_items.map(i => i.product_name).join(" + "),
            (c.total || 0).toFixed(2).replace('.', ','),
            c.status === 'open' ? 'Aberta' : c.status === 'paid' ? 'Paga' : 'Cancelada',
            new Date(c.created_at).toLocaleDateString('pt-BR')
        ]);
        const tsvContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
        navigator.clipboard.writeText(tsvContent);
        setToast({ message: 'Dados copiados! Cole no Excel ou Google Sheets (Ctrl+V).', type: 'success' });
    };

    const handlePrint = (comanda: Comanda) => {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) return;
        printWindow.document.write(`
      <html>
        <head><title>Comanda ${comanda.id.slice(0, 8)}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 20px; max-width: 350px; margin: 0 auto; }
          h1 { font-size: 18px; text-align: center; border-bottom: 2px dashed #333; padding-bottom: 10px; }
          .info { margin: 10px 0; font-size: 13px; }
          .info strong { display: inline-block; width: 100px; }
          .services { margin: 15px 0; }
          .services li { padding: 4px 0; font-size: 13px; border-bottom: 1px dotted #ccc; }
          .total { font-size: 20px; font-weight: bold; text-align: right; margin-top: 15px; border-top: 2px dashed #333; padding-top: 10px; }
          .footer { text-align: center; font-size: 10px; color: #666; margin-top: 20px; }
        </style></head>
        <body>
          <h1>☆ COMANDA #${comanda.id.slice(0, 8)} ☆</h1>
          <div class="info"><strong>Cliente:</strong> ${comanda.clients?.name}</div>
          <div class="info"><strong>Profissional:</strong> ${comanda.staff?.name || 'N/A'}</div>
          <div class="info"><strong>Data:</strong> ${new Date(comanda.created_at).toLocaleDateString('pt-BR')}</div>
          <div class="info"><strong>Hora:</strong> ${new Date(comanda.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="info"><strong>Status:</strong> ${comanda.status === 'open' ? 'Aberta' : comanda.status === 'paid' ? 'Paga' : 'Cancelada'}</div>
          <div class="services">
            <strong>Serviços / Consumo:</strong>
            <ul>${comanda.comanda_items.map(s => `<li>• ${s.product_name} (x${s.quantity})</li>`).join('')}</ul>
          </div>
          <div class="total">TOTAL: R$ ${(comanda.total || 0).toFixed(2)}</div>
          <div class="footer">SOU MANA.GER — Impresso em ${new Date().toLocaleString('pt-BR')}</div>
        </body>
      </html>
    `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Gestão de Comandas</h2>
                    <p className="text-slate-500 mt-1">Controle de atendimentos, consumos e fechamento de conta.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={generateCSV}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-green-600">table_view</span>
                        Excel / CSV
                    </button>
                    <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-blue-600">content_copy</span>
                        Google Sheets
                    </button>
                    <button
                        onClick={() => navigate('/checkout')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Nova Venda
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-blue-500">receipt_long</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Comandas Abertas</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{loading ? '...' : String(openCount).padStart(2, '0')}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Finalizadas (Hoje)</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{loading ? '...' : String(paidToday).padStart(2, '0')}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-primary">payments</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total em Aberto</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {loading ? '...' : totalOpen.toFixed(2).replace('.', ',')}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-purple-500">person</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Médio</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {loading ? '...' : avgTicket.toFixed(2).replace('.', ',')}</h3>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-border-dark flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 dark:bg-white/5">
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                        {(['all', 'open', 'paid', 'cancelled'] as const).map(status => {
                            const labels: Record<string, string> = { all: 'Todas', open: 'Abertas', paid: 'Pagas', cancelled: 'Canceladas' };
                            const colors: Record<string, string> = { all: 'bg-primary', open: 'bg-blue-500', paid: 'bg-emerald-500', cancelled: 'bg-slate-500' };
                            return (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterStatus === status ? `${colors[status]} text-white shadow-md` : 'bg-white dark:bg-transparent border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    {labels[status]}
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative w-full md:w-80">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar comanda, cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-border-dark">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Comanda</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Cliente</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Consumo</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Responsável</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">Carregando...</td></tr>
                            ) : filteredComandas.length > 0 ? (
                                filteredComandas.map((comanda) => (
                                    <tr key={comanda.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-primary text-sm">#{comanda.id.slice(0, 8)}</span>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{new Date(comanda.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={comanda.clients?.avatar} alt={comanda.clients?.name} className="size-8 rounded-full border border-slate-200 dark:border-border-dark" />
                                                <span className="font-bold text-sm text-slate-900 dark:text-white">{comanda.clients?.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {comanda.comanda_items.slice(0, 2).map((item, idx) => (
                                                    <span key={idx} className="text-xs font-medium text-slate-600 dark:text-slate-300">• {item.product_name}</span>
                                                ))}
                                                {comanda.comanda_items.length > 2 && <span className="text-[10px] text-primary font-bold">+ {comanda.comanda_items.length - 2} itens</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-600 dark:text-slate-300">{comanda.staff?.name || '---'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-900 dark:text-white">R$ {(comanda.total || 0).toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${comanda.status === 'paid'
                                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                : comanda.status === 'open'
                                                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-border-dark'
                                                }`}>
                                                <span className={`size-1.5 rounded-full ${comanda.status === 'paid' ? 'bg-emerald-500' : comanda.status === 'open' ? 'bg-blue-500' : 'bg-slate-500'
                                                    }`}></span>
                                                {comanda.status === 'paid' ? 'Paga' : comanda.status === 'open' ? 'Aberta' : 'Cancelada'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setViewComanda(comanda)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                                    title="Ver Detalhes"
                                                >
                                                    <span className="material-symbols-outlined text-lg">visibility</span>
                                                </button>
                                                {comanda.status === 'open' && (
                                                    <button
                                                        onClick={() => navigate(`/checkout/${comanda.id}`)}
                                                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                                        title="Fechar Conta / Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">point_of_sale</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handlePrint(comanda)}
                                                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
                                                    title="Imprimir"
                                                >
                                                    <span className="material-symbols-outlined text-lg">print</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-sm">Nenhuma comanda encontrada.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-border-dark flex items-center justify-between bg-slate-50 dark:bg-white/5">
                    <p className="text-xs text-slate-500 font-medium">Mostrando {filteredComandas.length} registros</p>
                </div>
            </div>

            {/* === VIEW DETAILS MODAL === */}
            {viewComanda && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">receipt_long</span>
                                #{viewComanda.id.slice(0, 8)}
                            </h3>
                            <button onClick={() => setViewComanda(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <img src={viewComanda.clients?.avatar} alt="" className="size-14 rounded-full border-2 border-slate-200 dark:border-border-dark" />
                                <div>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{viewComanda.clients?.name}</p>
                                    <p className="text-xs text-slate-500">Atendido por {viewComanda.staff?.name || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-background-dark rounded-lg p-4 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Itens</p>
                                {viewComanda.comanda_items.map((s, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm text-slate-700 dark:text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary text-sm">check</span>
                                            {s.product_name} (x{s.quantity})
                                        </div>
                                        <span className="font-bold">R$ {(s.unit_price * s.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-background-dark rounded-lg p-3">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Data</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date(viewComanda.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-background-dark rounded-lg p-3">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Horário</p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{new Date(viewComanda.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-border-dark">
                                <span className="text-sm font-bold text-slate-500 uppercase">Total</span>
                                <span className="text-2xl font-black text-primary">R$ {(viewComanda.total || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => handlePrint(viewComanda)} className="flex-1 py-3 rounded-lg text-sm font-bold bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-sm">print</span>
                                    Imprimir
                                </button>
                                {viewComanda.status === 'open' && (
                                    <button onClick={() => { setViewComanda(null); navigate(`/checkout/${viewComanda.id}`); }} className="flex-1 py-3 rounded-lg text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors">
                                        Editar / Pagar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Comandas;