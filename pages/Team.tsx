import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

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
const roleLabels: Record<string, string> = {
    Manager: 'Gerente',
    Barber: 'Barbeiro',
    Receptionist: 'Recepcionista',
};
const roleIcons: Record<string, string> = {
    Manager: 'admin_panel_settings',
    Barber: 'content_cut',
    Receptionist: 'support_agent',
};

const Team: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { tenantId, requireModuleAccess } = useAuth();
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'Barber',
        commission_rate: '40',
        status: 'active',
        password: '',
    });

    const getTeamAccess = useCallback((operation: string) => requireModuleAccess(
        'team',
        'staff',
        operation,
    ), [requireModuleAccess]);

    const fetchTeam = useCallback(async () => {
        if (!tenantId) {
            setTeam([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const { tenantId: resolvedTenantId, client } = getTeamAccess('load team members');
            const { data, error } = await client
                .from('staff')
                .select('*')
                .eq('tenant_id', resolvedTenantId)
                .order('name');

            if (error) throw error;
            setTeam((data || []) as TeamMember[]);
        } catch (error) {
            console.error('Erro ao carregar equipe:', error);
            setToast({ message: 'Erro ao carregar equipe.', type: 'error' });
            setTeam([]);
        } finally {
            setLoading(false);
        }
    }, [getTeamAccess, tenantId]);

    useEffect(() => {
        void fetchTeam();
    }, [fetchTeam]);

    useEffect(() => {
        const shouldOpenNew = Boolean((location.state as { openNewTeamMember?: boolean } | null)?.openNewTeamMember);
        if (!shouldOpenNew) return;
        openNewModal();
        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    const filtered = team.filter((member) => member.name.toLowerCase().includes(search.toLowerCase()));

    const openNewModal = () => {
        setEditingMember(null);
        setForm({
            name: '',
            email: '',
            phone: '',
            role: 'Barber',
            commission_rate: '40',
            status: 'active',
            password: '',
        });
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
            password: '',
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const editableFields = {
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            commission_rate: parseInt(form.commission_rate, 10) || 0,
            status: form.status,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=random`,
        };

        try {
            if (editingMember) {
                const { tenantId: resolvedTenantId, client } = getTeamAccess('update team member');
                const { error } = await client
                    .from('staff')
                    .update(editableFields)
                    .eq('id', editingMember.id)
                    .eq('tenant_id', resolvedTenantId);

                if (error) {
                    console.error('UPDATE ERROR:', JSON.stringify(error));
                    setToast({ message: `Erro ao atualizar: ${error.message}`, type: 'error' });
                    return;
                }

                setToast({ message: 'Colaborador atualizado!', type: 'success' });
            } else {
                if (!tenantId) {
                    setToast({ message: 'Tenant invalido para criar colaborador.', type: 'error' });
                    return;
                }

                if (!form.password || form.password.length < 6) {
                    setToast({ message: 'A senha inicial deve ter pelo menos 6 caracteres.', type: 'error' });
                    return;
                }

                const { tenantId: resolvedTenantId, client } = getTeamAccess('create team member');
                const { data: sessionData } = await supabase.auth.getSession();
                const accessToken = sessionData?.session?.access_token;

                if (!accessToken) {
                    setToast({ message: 'Sessao expirada. Faca login novamente.', type: 'error' });
                    return;
                }

                const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-create-user', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: {
                        email: form.email,
                        password: form.password,
                        name: form.name,
                        role: form.role,
                        tenant_id: resolvedTenantId,
                    },
                });

                if (edgeError || edgeData?.error) {
                    let msg = edgeData?.error || edgeData?.message || edgeError?.message || 'Erro desconhecido';

                    if (edgeError && typeof (edgeError as any).context?.json === 'function') {
                        try {
                            const body = await (edgeError as any).context.json();
                            if (body?.error) msg = body.error;
                            else if (body?.message) msg = body.message;
                        } catch {
                            // noop
                        }
                    }

                    console.error('Edge function error:', { edgeError, edgeData, msg });

                    let friendlyMsg = msg;
                    if (msg.includes('already registered') || msg.includes('User already registered')) {
                        friendlyMsg = 'Este e-mail ja esta cadastrado no sistema.';
                    } else if (msg.includes('invalid email')) {
                        friendlyMsg = 'E-mail invalido.';
                    } else if (msg.includes('Password should') || msg.includes('password')) {
                        friendlyMsg = 'A senha deve ter pelo menos 6 caracteres.';
                    } else if (msg.includes('email_exists') || msg.includes('duplicate')) {
                        friendlyMsg = 'Este e-mail ja esta cadastrado.';
                    } else if (msg.includes('not authorized') || msg.includes('Unauthorized') || msg.includes('403')) {
                        friendlyMsg = 'Sem permissao. Certifique-se de estar logado como Gerente.';
                    }

                    setToast({ message: `Erro ao criar colaborador: ${friendlyMsg}`, type: 'error' });
                    console.error('Detalhe completo do erro:', msg);
                    return;
                }

                if (edgeData?.user?.id) {
                    const { error } = await client
                        .from('staff')
                        .update({
                            phone: form.phone,
                            commission_rate: editableFields.commission_rate,
                        })
                        .eq('id', edgeData.user.id)
                        .eq('tenant_id', resolvedTenantId);

                    if (error) {
                        console.error('POST CREATE STAFF UPDATE ERROR:', JSON.stringify(error));
                        setToast({ message: `Usuario criado, mas houve erro ao ajustar dados operacionais: ${error.message}`, type: 'error' });
                        return;
                    }
                }

                setToast({ message: 'Login cadastrado com sucesso!', type: 'success' });
            }

            setShowModal(false);
            setEditingMember(null);
            void fetchTeam();
        } catch (error: any) {
            console.error('SAVE TEAM ERROR:', error);
            setToast({ message: error?.message || 'Erro ao salvar colaborador.', type: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!tenantId) {
            setToast({ message: 'Tenant invalido para remover colaborador.', type: 'error' });
            return;
        }

        try {
            const { tenantId: resolvedTenantId, client } = getTeamAccess('delete team member');
            const { error } = await client
                .from('staff')
                .delete()
                .eq('id', id)
                .eq('tenant_id', resolvedTenantId);

            if (error) {
                console.error('DELETE ERROR:', JSON.stringify(error));
                setToast({ message: `Erro ao deletar: ${error.message} (${error.code})`, type: 'error' });
                return;
            }

            setToast({ message: 'Colaborador removido.', type: 'info' });
            void fetchTeam();
        } catch (error: any) {
            console.error('DELETE TEAM ERROR:', error);
            setToast({ message: error?.message || 'Erro ao remover colaborador.', type: 'error' });
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight display-font">Equipe</h2>
                    <p className="text-slate-500 text-sm">{team.filter((member) => member.status === 'active').length} membro(s) ativo(s)</p>
                </div>
                <button
                    onClick={openNewModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all"
                >
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    Novo Colaborador
                </button>
            </div>

            <div className="relative max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                    type="text"
                    placeholder="Buscar colaborador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#262626] rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white transition-all shadow-sm"
                />
            </div>

            {loading ? (
                <div className="p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-500">Nenhum membro encontrado.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map((member) => (
                        <div key={member.id} className="card-boutique p-6 group relative">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="relative">
                                    <div
                                        className="size-14 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${member.avatar || ''})` }}
                                    ></div>
                                    <span className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white dark:border-card-dark ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors display-font">{member.name}</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="material-symbols-outlined text-sm text-slate-400">{roleIcons[member.role] || 'person'}</span>
                                        <span className="text-xs text-slate-500 font-bold">{roleLabels[member.role] || member.role}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(member.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remover"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-slate-50 dark:bg-[#141414] border border-slate-100 dark:border-[#262626] p-3 rounded-xl">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Comissao</p>
                                    <p className="text-xl mt-0.5 font-bold text-slate-900 dark:text-white display-font">{member.commission_rate}%</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-[#141414] border border-slate-100 dark:border-[#262626] p-3 rounded-xl">
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
                                <button
                                    onClick={() => navigate('/schedule')}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm">calendar_month</span>
                                    Agenda
                                </button>
                                <button
                                    onClick={() => openEditModal(member)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                    Editar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingMember(null);
                }}
                title={editingMember ? 'Editar Colaborador' : 'Novo Colaborador'}
                maxWidth="md"
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Ex: Joao Silva"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
                                placeholder="email@barber.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
                                placeholder="(11) 99999-0000"
                            />
                        </div>
                    </div>
                    {!editingMember && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Senha de Acesso (Inicial)</label>
                            <input
                                type="password"
                                required
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
                                placeholder="Minimo 6 caracteres"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Essa sera a senha que o colaborador usara para logar no sistema.</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Funcao</label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                            >
                                {roles.map((role) => (
                                    <option key={role} value={role} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                                        {roleLabels[role]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Comissao (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={form.commission_rate}
                                onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Status</label>
                        <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        >
                            <option value="active" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Ativo</option>
                            <option value="inactive" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Inativo</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowModal(false);
                                setEditingMember(null);
                            }}
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                        >
                            {editingMember ? 'Salvar Alteracoes' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Team;
