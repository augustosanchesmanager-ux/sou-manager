import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../components/ui/Modal';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

interface StaffMember {
    id: string;
    name: string;
    role: string;
    avatar: string;
    commission_rate: number | null;
}

interface CommissionItem {
    id: string;
    staff_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    created_at: string;
}

interface CommissionRow {
    id: string;
    professionalName: string;
    role: string;
    avatar: string;
    commissionRate: number;
    servicesCount: number;
    grossSales: number;
    commissionValue: number;
    lastServiceDate: string | null;
    items: CommissionItem[];
}

const Commissions: React.FC = () => {
    const { tenantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [rows, setRows] = useState<CommissionRow[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRow, setSelectedRow] = useState<CommissionRow | null>(null);
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterMonth) {
            setRows([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const [yearStr, monthStr] = filterMonth.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

        try {
            const [staffRes, itemsRes] = await Promise.all([
                supabase
                    .from('staff')
                    .select('id, name, role, avatar, commission_rate')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active'),
                supabase
                    .from('comanda_items')
                    .select(`
                        id,
                        staff_id,
                        product_name,
                        quantity,
                        unit_price,
                        comandas!inner(created_at, status, staff_id)
                    `)
                    .eq('tenant_id', tenantId)
                    .eq('comandas.status', 'paid')
                    .gte('comandas.created_at', startOfMonth)
                    .lte('comandas.created_at', endOfMonth),
            ]);

            if (staffRes.error) throw staffRes.error;
            if (itemsRes.error) throw itemsRes.error;

            const staffList = (staffRes.data || []) as StaffMember[];
            const items = (itemsRes.data || []).map((item: any) => ({
                id: item.id,
                staff_id: item.staff_id || item.comandas?.staff_id || null,
                product_name: item.product_name,
                quantity: Number(item.quantity || 0),
                unit_price: Number(item.unit_price || 0),
                created_at: item.comandas?.created_at || '',
            })) as CommissionItem[];

            const grouped = staffList.map((member) => {
                const memberItems = items.filter((item) => item.staff_id === member.id);
                const grossSales = memberItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
                const servicesCount = memberItems.reduce((sum, item) => sum + item.quantity, 0);
                const commissionRate = Number(member.commission_rate || 0);
                const lastServiceDate = memberItems.length > 0
                    ? memberItems
                        .map((item) => item.created_at)
                        .sort()
                        .slice(-1)[0]
                    : null;

                return {
                    id: member.id,
                    professionalName: member.name,
                    role: member.role || 'Profissional',
                    avatar: member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`,
                    commissionRate,
                    servicesCount,
                    grossSales,
                    commissionValue: grossSales * (commissionRate / 100),
                    lastServiceDate,
                    items: memberItems,
                };
            });

            setRows(grouped);
        } catch (error) {
            console.error('Erro ao carregar comissoes:', error);
            setToast({ message: 'Erro ao carregar dados de comissoes.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filterMonth, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredRows = useMemo(
        () =>
            rows.filter((row) =>
                row.professionalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.role.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [rows, searchTerm]
    );

    const totalCommissions = filteredRows.reduce((sum, row) => sum + row.commissionValue, 0);
    const totalSales = filteredRows.reduce((sum, row) => sum + row.grossSales, 0);
    const totalServices = filteredRows.reduce((sum, row) => sum + row.servicesCount, 0);
    const averageRate = filteredRows.length > 0
        ? filteredRows.reduce((sum, row) => sum + row.commissionRate, 0) / filteredRows.length
        : 0;
    const topPerformer = filteredRows.reduce<CommissionRow | null>(
        (best, current) => (!best || current.commissionValue > best.commissionValue ? current : best),
        null
    );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Comissoes</h2>
                    <p className="text-slate-500 mt-1">Acompanhe a producao variavel por profissional e o valor previsto para repasse.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" leftIcon="download" onClick={() => setToast({ message: 'Exportacao de comissoes sera adicionada em breve.', type: 'info' })}>
                        Exportar
                    </Button>
                    <Button leftIcon="refresh" onClick={fetchData}>
                        Recalcular
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissao prevista</p>
                    <h3 className="text-2xl font-black text-emerald-500">
                        {totalCommissions.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vendas vinculadas</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                        {totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Itens comissionados</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{totalServices}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Taxa media</p>
                    <h3 className="text-2xl font-black text-primary">{averageRate.toFixed(1)}%</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-64">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Mes de referencia</label>
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-4 text-sm focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Buscar profissional</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Nome ou cargo..."
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>
                <div className="w-full md:w-72 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Destaque do periodo</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
                        {topPerformer ? topPerformer.professionalName : 'Sem dados'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {topPerformer
                            ? `${topPerformer.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em comissao prevista`
                            : 'Nenhuma comissao encontrada no periodo.'}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Profissional</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Cargo</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Taxa</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Itens</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Vendas</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Comissao</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Ultimo lancamento</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Acao</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Carregando comissoes...
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        Nenhum profissional com dados de comissao neste periodo.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={row.avatar} alt={row.professionalName} className="size-10 rounded-full border border-slate-200 dark:border-border-dark object-cover" />
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">{row.professionalName}</p>
                                                    <p className="text-xs text-slate-500">{row.items.length} lancamentos vinculados</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.role}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                                {row.commissionRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{row.servicesCount}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {row.grossSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 font-black text-emerald-500">
                                            {row.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {row.lastServiceDate ? new Date(row.lastServiceDate).toLocaleDateString('pt-BR') : 'Sem movimento'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedRow(row)}
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base">visibility</span>
                                                Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={!!selectedRow}
                onClose={() => setSelectedRow(null)}
                title={selectedRow ? `Detalhes de comissao - ${selectedRow.professionalName}` : 'Detalhes de comissao'}
                maxWidth="xl"
            >
                {selectedRow && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Taxa aplicada</p>
                                <p className="text-xl font-black text-primary mt-1">{selectedRow.commissionRate.toFixed(1)}%</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Total de vendas</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                    {selectedRow.grossSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Comissao prevista</p>
                                <p className="text-xl font-black text-emerald-500 mt-1">
                                    {selectedRow.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden">
                            <div className="overflow-x-auto max-h-[360px]">
                                <table className="w-full min-w-[720px]">
                                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Data</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Item</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Qtd</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Valor</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Base</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                                        {selectedRow.items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{item.product_name}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                                                    {(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Commissions;
