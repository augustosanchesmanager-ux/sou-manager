import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatar: string;
    commission_rate: number;
    status: string;
}

const roles = ['Manager', 'Barber', 'Receptionist'];
const roleLabels: Record<string, string> = { Manager: 'Gerente', Barber: 'Barbeiro', Receptionist: 'Recepcionista' };
const roleIcons: Record<string, string> = { Manager: 'admin_panel_settings', Barber: 'content_cut', Receptionist: 'support_agent' };

const Team: React.FC = () => {
    const navigate = useNavigate();
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const [search, setSearch] = useState('');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Barber', commission_rate: '40', status: 'active' });

    const fetchTeam = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from('staff').select('*').order('name');
        if (data) setTeam(data);
        if (error) setToast({ message: 'Erro ao carregar equipe.', type: 'error' });
        setLoading(false);
    }, []);

    useEffect(() => { fetchTeam(); }, [fetchTeam]);

    const filtered = team.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

    const openNewModal = () => {
        setEditingMember(null);
        setForm({ name: '', email: '', phone: '', role: 'Barber', commission_rate: '40', status: 'active' });
        setShowModal(true);
    };

    const openEditModal = (member: TeamMember) => {
        setEditingMember(member);
        setForm({
            name: member.name,
            email: member.email,
            phone: member.phone,
            role: member.role,
            commission_rate: member.commission_rate.toString(),
            status: member.status,
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            commission_rate: parseInt(form.commission_rate) || 0,
            status: form.status,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=random`,
        };

        if (editingMember) {
            const { error } = await supabase.from('staff').update(payload).eq('id', editingMember.id);
            if (error) { setToast({ message: 'Erro ao atualizar.', type: 'error' }); return; }
            setToast({ message: 'Colaborador atualizado!', type: 'success' });
        } else {
            const { error } = await supabase.from('staff').insert(payload);
            if (error) { setToast({ message: 'Erro ao salvar.', type: 'error' }); return; }
            setToast({ message: 'Colaborador adicionado!', type: 'success' });
        }

        setShowModal(false);
        setEditingMember(null);
        fetchTeam();
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('staff').delete().eq('id', id);
        if (!error) {
            setToast({ message: 'Colaborador removido.', type: 'info' });
            fetchTeam();
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Equipe</h2>
                    <p className="text-slate-500 text-sm">{team.filter(m => m.status === 'active').length} membro(s) ativo(s)</p>
                </div>
                <button onClick={openNewModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all">
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    Novo Colaborador
                </button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input type="text" placeholder="Buscar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white" />
            </div>

            {/* Team Cards */}
            {loading ? (
                <div className="p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-500">Nenhum membro encontrado.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(member => (
                        <div key={member.id} className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 hover:shadow-lg transition-all group">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="relative">
                                    <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${member.avatar || ''})` }}></div>
                                    <span className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white dark:border-card-dark ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{member.name}</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="material-symbols-outlined text-sm text-slate-400">{roleIcons[member.role] || 'person'}</span>
                                        <span className="text-xs text-slate-500 font-bold">{roleLabels[member.role] || member.role}</span>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(member.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="Remover">
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Comissão</p>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{member.commission_rate}%</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Status</p>
                                    <p className={`text-sm font-bold ${member.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>
                                        {member.status === 'active' ? 'Ativo' : 'Inativo'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs mb-4">
                                <span className="material-symbols-outlined text-slate-400 text-sm">mail</span>
                                <span className="text-slate-500 truncate">{member.email || 'Sem e-mail'}</span>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => navigate('/schedule')}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all">
                                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                                    Agenda
                                </button>
                                <button onClick={() => openEditModal(member)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition-all">
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                    Editar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-white/5 shrink-0">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">{editingMember ? 'edit' : 'person_add'}</span>
                                {editingMember ? 'Editar Colaborador' : 'Novo Colaborador'}
                            </h3>
                            <button onClick={() => { setShowModal(false); setEditingMember(null); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
                                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="Ex: João Silva" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email</label>
                                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" placeholder="email@barber.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone</label>
                                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" placeholder="(11) 99999-0000" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Função</label>
                                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]">
                                        {roles.map(r => <option key={r} value={r} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{roleLabels[r]}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Comissão (%)</label>
                                    <input type="number" min="0" max="100" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Status</label>
                                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]">
                                    <option value="active" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Ativo</option>
                                    <option value="inactive" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Inativo</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowModal(false); setEditingMember(null); }}
                                    className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
                                <button type="submit"
                                    className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                                    {editingMember ? 'Salvar Alterações' : 'Adicionar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Team;