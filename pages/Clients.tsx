import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Papa from 'papaparse';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
    last_visit: string;
    last_service: string;
    total_spent: number;
    status: string;
    avatar: string;
    birthday: string;
}

interface ParsedClient {
    name: string;
    phone: string;
    email: string;
    birthday: string;
}

type SortKey = 'name' | 'last_visit' | 'total_spent';
type SortDir = 'asc' | 'desc';

const Clients: React.FC = () => {
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Client>>({});

    // New Client Modal
    const [showModal, setShowModal] = useState(false);
    const [newForm, setNewForm] = useState({ name: '', email: '', phone: '', birthday: '' });

    // Import/Export states
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedClient[]>([]);

    // Delete Confirmation
    const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

    // Detail View
    const [detailClient, setDetailClient] = useState<Client | null>(null);

    const fetchClients = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('clients').select('*').order('name');
        if (data) setClients(data);
        if (error) setToast({ message: 'Erro ao carregar clientes.', type: 'error' });
        setLoading(false);
    }, []);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    // Filtering & Sorting
    const processed = clients
        .filter(c => {
            const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.email.toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === 'all' || c.status === statusFilter;
            return matchSearch && matchStatus;
        })
        .sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortKey === 'last_visit') cmp = new Date(a.last_visit).getTime() - new Date(b.last_visit).getTime();
            else if (sortKey === 'total_spent') cmp = (a.total_spent || 0) - (b.total_spent || 0);
            return sortDir === 'asc' ? cmp : -cmp;
        });

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortIcon = (key: SortKey) => {
        if (sortKey !== key) return 'sort';
        return sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
    };

    // CRUD
    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await supabase.from('clients').insert({
            name: newForm.name,
            email: newForm.email,
            phone: newForm.phone,
            birthday: newForm.birthday,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newForm.name)}&background=random`,
            tenant_id: tenantId,
        });
        if (error) {
            console.error('Erro ao salvar cliente:', error);
            setToast({ message: `Erro ao salvar: ${error.message}`, type: 'error' });
            return;
        }
        setShowModal(false);
        setNewForm({ name: '', email: '', phone: '', birthday: '' });
        setToast({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
        fetchClients();
    };

    const handleEditClick = (client: Client) => {
        setEditingId(client.id);
        setEditForm({ name: client.name, email: client.email, phone: client.phone, status: client.status, birthday: client.birthday });
    };

    const handleSaveEdit = async () => {
        if (!editingId) return;
        const { error } = await supabase.from('clients').update(editForm).eq('id', editingId);
        if (error) { setToast({ message: 'Erro ao atualizar.', type: 'error' }); return; }
        setEditingId(null);
        setEditForm({});
        setToast({ message: 'Cliente atualizado!', type: 'success' });
        fetchClients();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const { error } = await supabase.from('clients').delete().eq('id', deleteTarget.id);
        if (error) { setToast({ message: 'Erro ao excluir.', type: 'error' }); return; }
        setDeleteTarget(null);
        setToast({ message: 'Cliente excluído.', type: 'info' });
        fetchClients();
    };

    const formatDate = (d: string) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('pt-BR');
    };

    const handleExportCSV = () => {
        if (processed.length === 0) {
            setToast({ message: 'Nenhum cliente para exportar.', type: 'info' });
            return;
        }

        const dataToExport = processed.map(c => ({
            Nome: c.name,
            Telefone: c.phone || '',
            Email: c.email || '',
            Aniversário: c.birthday ? formatDate(c.birthday) : '',
            Última_Visita: c.last_visit ? formatDate(c.last_visit) : '',
            Total_Gasto: c.total_spent ? c.total_spent.toFixed(2).replace('.', ',') : '0,00',
            Status: c.status === 'active' ? 'Ativo' : 'Inativo'
        }));

        const csvString = Papa.unparse(dataToExport);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `base_clientes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const mapped: ParsedClient[] = [];

                data.forEach(row => {
                    const nameStr = row.Nome || row.nome || row.Name || row.name || row.Cliente;
                    const phoneStr = row.Telefone || row.telefone || row.Phone || row.phone || row.Celular || '';
                    const emailStr = row.Email || row.email || row['E-mail'] || '';
                    const bdayStr = row.Aniversário || row.aniversário || row.Aniversario || row.nascimento || row.Birthday || '';

                    if (nameStr) {
                        // parse pt-BR date
                        let isoDate = '';
                        if (bdayStr.includes('/')) {
                            const parts = bdayStr.split('/');
                            if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        } else if (bdayStr.includes('-')) {
                            isoDate = bdayStr;
                        }

                        mapped.push({
                            name: nameStr,
                            phone: String(phoneStr).trim(),
                            email: String(emailStr).trim(),
                            birthday: isoDate,
                        });
                    }
                });

                if (mapped.length > 0) {
                    setParsedData(mapped);
                    setIsImportModalOpen(true);
                } else {
                    setToast({ message: 'Nenhum cliente válido encontrado no CSV.', type: 'error' });
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (error) => {
                setToast({ message: `Erro ao ler CSV: ${error.message}`, type: 'error' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        });
    };

    const handleConfirmImport = async () => {
        setLoading(true);
        const toInsert = parsedData.map(c => ({
            name: c.name,
            phone: c.phone,
            email: c.email,
            birthday: c.birthday ? c.birthday : null,
            status: 'active',
            tenant_id: tenantId,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`
        }));

        const { error } = await supabase.from('clients').insert(toInsert);

        if (error) {
            setToast({ message: `Erro ao importar: ${error.message}`, type: 'error' });
        } else {
            setToast({ message: `${toInsert.length} clientes importados com sucesso!`, type: 'success' });
            setIsImportModalOpen(false);
            setParsedData([]);
            fetchClients();
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h2>
                    <p className="text-slate-500 text-sm">{clients.length} cliente(s) cadastrado(s)</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        Importar CSV
                    </button>
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileUpload} />
                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                        <span className="material-symbols-outlined text-sm">download</span>
                        Exportar Base
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, telefone ou e-mail..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'active', 'inactive'] as const).map(s => (
                        <button key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === s ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-10 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                        <p className="text-slate-500 text-sm mt-3">Carregando clientes...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-white/5">
                                <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="px-5 py-3">
                                        <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            Cliente <span className="material-symbols-outlined text-sm">{sortIcon('name')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3 hidden md:table-cell">Telefone</th>
                                    <th className="px-5 py-3 hidden lg:table-cell">
                                        <button onClick={() => handleSort('last_visit')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            Última Visita <span className="material-symbols-outlined text-sm">{sortIcon('last_visit')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3 hidden lg:table-cell">
                                        <button onClick={() => handleSort('total_spent')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            Total Gasto <span className="material-symbols-outlined text-sm">{sortIcon('total_spent')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                                {processed.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-slate-500 text-sm">Nenhum cliente encontrado.</td>
                                    </tr>
                                )}
                                {processed.map(client => (
                                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-5 py-4">
                                            {editingId === client.id ? (
                                                <input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                    className="bg-slate-50 dark:bg-white/5 border border-primary rounded-lg px-2 py-1 text-sm w-full text-slate-900 dark:text-white outline-none" />
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center shrink-0" style={{ backgroundImage: `url(${client.avatar || ''})` }}></div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</p>
                                                        <p className="text-[10px] text-slate-500 hidden sm:block">{client.email || 'Sem e-mail'}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 hidden md:table-cell">
                                            {editingId === client.id ? (
                                                <input value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                    className="bg-slate-50 dark:bg-white/5 border border-primary rounded-lg px-2 py-1 text-sm w-full text-slate-900 dark:text-white outline-none" />
                                            ) : (
                                                <span className="text-sm text-slate-700 dark:text-slate-300">{client.phone || '-'}</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300 hidden lg:table-cell">{formatDate(client.last_visit)}</td>
                                        <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white hidden lg:table-cell">R$ {(client.total_spent || 0).toFixed(2)}</td>
                                        <td className="px-5 py-4">
                                            {editingId === client.id ? (
                                                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                                    className="bg-slate-50 dark:bg-[#1A1A1A] border border-primary rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]">
                                                    <option value="active" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Ativo</option>
                                                    <option value="inactive" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Inativo</option>
                                                </select>
                                            ) : (
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${client.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                    {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {editingId === client.id ? (
                                                    <>
                                                        <button onClick={handleSaveEdit} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Salvar">
                                                            <span className="material-symbols-outlined text-lg">check</span>
                                                        </button>
                                                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Cancelar">
                                                            <span className="material-symbols-outlined text-lg">close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setDetailClient(client)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Ver Detalhes">
                                                            <span className="material-symbols-outlined text-lg">visibility</span>
                                                        </button>
                                                        <button onClick={() => handleEditClick(client)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Editar">
                                                            <span className="material-symbols-outlined text-lg">edit</span>
                                                        </button>
                                                        <button onClick={() => setDeleteTarget(client)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <Modal
                isOpen={!!detailClient}
                onClose={() => setDetailClient(null)}
                title="Detalhes do Cliente"
                maxWidth="md"
            >
                {detailClient && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="size-16 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center" style={{ backgroundImage: `url(${detailClient.avatar || ''})` }}></div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white">{detailClient.name}</h4>
                                <p className={`text-xs font-bold uppercase ${detailClient.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>{detailClient.status === 'active' ? 'Ativo' : 'Inativo'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Telefone</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{detailClient.phone || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Email</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{detailClient.email || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Aniversário</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{detailClient.birthday ? formatDate(detailClient.birthday) : '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Gasto</p>
                                <p className="text-sm font-bold text-emerald-500">R$ {(detailClient.total_spent || 0).toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Última Visita</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{formatDate(detailClient.last_visit)}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Último Serviço</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{detailClient.last_service || '-'}</p>
                            </div>
                        </div>
                        <button onClick={() => { setDetailClient(null); navigate('/schedule'); }}
                            className="w-full py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors mt-2">
                            Agendar para este Cliente
                        </button>
                    </div>
                )}
            </Modal>

            {/* New Client Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Novo Cliente"
                maxWidth="md"
            >
                <form onSubmit={handleCreateClient} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
                        <input type="text" required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="Ex: Carlos Oliveira" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone</label>
                        <input type="tel" required value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="(11) 99999-9999" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email (Opcional)</label>
                        <input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="email@exemplo.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data de Nascimento</label>
                        <input type="date" value={newForm.birthday} onChange={(e) => setNewForm({ ...newForm, birthday: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowModal(false)}
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
                        <button type="submit"
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">Salvar</button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Confirmar Exclusão"
                maxWidth="sm"
            >
                {deleteTarget && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">warning</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja excluir <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
                            <button onClick={handleDelete} className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">Excluir</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* IMPORT PREVIEW MODAL */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => { setIsImportModalOpen(false); setParsedData([]); }}
                title="Conciliação de Base de Clientes"
                maxWidth="3xl"
            >
                <div className="space-y-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Revisão de Dados</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Encontramos <strong>{parsedData.length} clientes</strong> prontos para cadastro. Modifique os detalhes listados caso precise de algum ajuste fino, ou descarte para abortar a inserção no banco de dados.</p>
                    </div>

                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                        <div className="overflow-x-auto max-h-[50vh] custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-200 dark:border-border-dark">
                                    <tr>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Nome Completo</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Telefone</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Email</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Nascimento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-sm">
                                    {parsedData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="text"
                                                    value={row.name}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].name = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-full min-w-[150px]"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="text"
                                                    value={row.phone}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].phone = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-full min-w-[130px]"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="email"
                                                    value={row.email}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].email = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-full min-w-[160px]"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="date"
                                                    value={row.birthday}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].birthday = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-slate-50 dark:bg-[#1A1A1A] text-xs font-bold rounded p-1 outline-none text-slate-700 dark:text-slate-300"
                                                    style={{ colorScheme: 'dark' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-border-dark mt-6">
                        <button type="button" onClick={() => { setIsImportModalOpen(false); setParsedData([]); }} className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                            Descartar Arquivo
                        </button>
                        <button type="button" onClick={handleConfirmImport} disabled={loading} className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                            {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `Salvar ${parsedData.length} Clientes`}
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Clients;