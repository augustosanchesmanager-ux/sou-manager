import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { getDefaultCommissionRateForRole } from '../src/lib/staff/roles';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { staffRepository, RepositoryError } from '../domain/staff';
import { teamInvitationService } from '../application/teamInvitation';
import type { InvitationView } from '../domain/invitation/types';
import { useBarberPayoutConfig } from '../src/hooks/usePayoutService';
import type { PayoutFrequency } from '../domain/payout/types';
import { PayoutCycleConfigFields } from '../components/payroll/PayoutCycleConfigModal';

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

const roles = ['manager', 'admin', 'barber', 'receptionist'];
const inviteRoles = ['barber', 'receptionist'];
const roleIcons: Record<string, string> = { manager: 'admin_panel_settings', admin: 'shield', barber: 'content_cut', receptionist: 'support_agent' };

const Team: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { tenantId, appSlug, isSuperAdmin } = useAuth();
    const labels = getBusinessLabels(appSlug);
    const isEsteticaApp = appSlug === 'estetica';
    const memberLabel = isEsteticaApp ? labels.professional : 'Colaborador';
    const memberLabelLower = memberLabel.toLowerCase();
    const memberPluralLabel = isEsteticaApp ? labels.professionalPlural : 'Equipe';
    const memberPluralLower = isEsteticaApp ? labels.professionalPlural.toLowerCase() : 'membros';
    const commissionLabel = isEsteticaApp ? 'Repasse' : 'Comissão';
    const roleLabels: Record<string, string> = isEsteticaApp
        ? { manager: 'Gestor Operacional', admin: 'Gestor Administrativo', barber: labels.professional, receptionist: 'Recepção' }
        : { manager: 'Gerente Operacional', admin: 'Gerente Administrativo', barber: 'Barbeiro', receptionist: 'Recepcionista' };
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [invitations, setInvitations] = useState<InvitationView[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingInvites, setLoadingInvites] = useState(false);
    const [copyingId, setCopyingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

    const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
        try {
            const saved = localStorage.getItem('smg_team_view_mode');
            return saved === 'table' ? 'table' : 'grid';
        } catch {
            return 'grid';
        }
    });

    const handleViewModeChange = (mode: 'grid' | 'table') => {
        setViewMode(mode);
        try {
            localStorage.setItem('smg_team_view_mode', mode);
        } catch {
            // ignore
        }
    };

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'manager', commission_rate: String(getDefaultCommissionRateForRole('manager')), status: 'active', password: '' });
    const [commissionEditedManually, setCommissionEditedManually] = useState(false);

    // Política de Repasse & Vales (G2 — ADR-030)
    const { getConfigByStaff, upsertConfig } = useBarberPayoutConfig();
    const [payoutForm, setPayoutForm] = useState<{
        frequency: PayoutFrequency;
        payoutWeekday: number;
        payoutMonthDay: number;
        allowAdvances: boolean;
    }>({
        frequency: 'weekly',
        payoutWeekday: 2,
        payoutMonthDay: 5,
        allowAdvances: true,
    });
    const [loadingPayoutConfig, setLoadingPayoutConfig] = useState(false);

    // F2.1 (SEC-AUTHZ-CREATE-USER): somente superadmin pode atribuir o papel `admin`.
    // Gerentes criam apenas barber/receptionist (hierarquia enforcement no backend —
    // edge function admin-create-user). `admin` fica oculto no seletor para não-superadmins.
    const assignableRoles = isSuperAdmin ? roles : roles.filter(r => r !== 'admin');
    // Na edição, preserva o papel atual do membro (ex.: admin editado por não-superadmin)
    // para o select não ficar com valor fora das opções.
    const roleOptions = assignableRoles.includes(form.role) ? assignableRoles : [...assignableRoles, form.role];

    const fetchTeam = useCallback(async () => {
        if (!tenantId) {
            setTeam([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await staffRepository.list(tenantId);
            setTeam(data);
        } catch (error) {
            console.error('Erro ao carregar equipe:', error);
            setToast({ message: `Erro ao carregar ${isEsteticaApp ? 'profissionais' : 'equipe'}.`, type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [isEsteticaApp, tenantId]);

    useEffect(() => { fetchTeam(); }, [fetchTeam]);

    const fetchInvitations = useCallback(async () => {
        if (!tenantId) return;
        setLoadingInvites(true);
        try {
            const data = await teamInvitationService.list();
            setInvitations(data.filter(i => i.status === 'pending'));
        } catch (error) {
            console.error('Erro ao carregar convites:', error);
        } finally {
            setLoadingInvites(false);
        }
    }, [tenantId]);

    useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

    useEffect(() => {
        const shouldOpenNew = Boolean((location.state as { openNewTeamMember?: boolean } | null)?.openNewTeamMember);
        if (!shouldOpenNew) return;
        openNewModal();
        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    const filtered = team.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all'
            ? true
            : statusFilter === 'active'
                ? m.status === 'active'
                : m.status !== 'active';
        return matchesSearch && matchesStatus;
    });

    const openNewModal = () => {
        setEditingMember(null);
        setCommissionEditedManually(false);
        setForm({ name: '', email: '', phone: '', role: 'manager', commission_rate: String(getDefaultCommissionRateForRole('manager')), status: 'active', password: '' });
        setShowModal(true);
    };

    const openEditModal = (member: TeamMember) => {
        setEditingMember(member);
        setCommissionEditedManually(false);
        setForm({
            name: member.name,
            email: member.email,
            phone: member.phone,
            role: member.role,
            commission_rate: member.commission_rate.toString(),
            status: member.status,
            password: '', // Não editamos senha por aqui
        });
        setPayoutForm({
            frequency: 'weekly',
            payoutWeekday: 2,
            payoutMonthDay: 5,
            allowAdvances: true,
        });
        setShowModal(true);
        setLoadingPayoutConfig(true);
        getConfigByStaff(member.id)
            .then((cfg) => {
                if (cfg) {
                    setPayoutForm({
                        frequency: cfg.frequency,
                        payoutWeekday: cfg.payoutWeekday ?? 2,
                        payoutMonthDay: cfg.payoutMonthDay ?? 5,
                        allowAdvances: cfg.allowAdvances,
                    });
                }
            })
            .catch((err) => {
                console.warn('Falha ao carregar política de repasse na equipe:', err);
            })
            .finally(() => {
                setLoadingPayoutConfig(false);
            });
    };

    const handleRoleChange = (role: string) => {
        setForm((current) => ({
            ...current,
            role,
            commission_rate: commissionEditedManually
                ? current.commission_rate
                : String(getDefaultCommissionRateForRole(role)),
        }));
    };

    const handleCommissionRateChange = (value: string) => {
        setCommissionEditedManually(true);
        setForm((current) => ({ ...current, commission_rate: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const editableFields = {
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            commission_rate: parseInt(form.commission_rate) || 0,
            status: form.status,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=random`,
        };

        if (editingMember) {
            if (!tenantId) {
                setToast({ message: 'Tenant inválido para atualizar colaborador.', type: 'error' });
                return;
            }
            try {
                await staffRepository.update(editingMember.id, editableFields, tenantId);
                if (editableFields.commission_rate > 0 || editingMember.role === 'barber') {
                    try {
                        await upsertConfig({
                            staffId: editingMember.id,
                            frequency: payoutForm.frequency,
                            payoutWeekday:
                                payoutForm.frequency === 'weekly' || payoutForm.frequency === 'biweekly'
                                    ? payoutForm.payoutWeekday
                                    : null,
                            payoutMonthDay:
                                payoutForm.frequency === 'monthly' ? payoutForm.payoutMonthDay : null,
                            allowAdvances: payoutForm.allowAdvances,
                        });
                    } catch (cfgErr) {
                        console.warn('Aviso ao salvar política de repasse:', cfgErr);
                    }
                }
                setToast({ message: 'Colaborador e política de repasse atualizados!', type: 'success' });
            } catch (error) {
                console.error('UPDATE ERROR:', error);
                let friendlyMsg = 'Erro ao atualizar.';
                if (error instanceof RepositoryError) {
                    friendlyMsg = error.message;
                    if (error.code === '23514') friendlyMsg = 'Valor de cargo inválido. Use: Gerente, Barbeiro ou Recepcionista.';
                }
                setToast({ message: `Erro ao atualizar: ${friendlyMsg}`, type: 'error' });
                return;
            }
        } else {
            if (!tenantId) {
                setToast({ message: 'Tenant inválido para criar colaborador.', type: 'error' });
                return;
            }

            // Fluxo de convite (D1/D2): barber/receptionist recebem link + definem a própria senha.
            if (inviteRoles.includes(form.role)) {
                if (!form.email || !form.email.includes('@')) {
                    setToast({ message: 'Informe um e-mail válido para o convite.', type: 'error' });
                    return;
                }
                const { data: sessionData } = await supabase.auth.getSession();
                const accessToken = sessionData?.session?.access_token;
                if (!accessToken) {
                    setToast({ message: 'Sessão expirada. Por favor, faça login novamente.', type: 'error' });
                    return;
                }
                const { data: edgeData, error: edgeError } = await supabase.functions.invoke('invite-team-member', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: {
                        email: form.email,
                        role: form.role,
                        tenant_id: tenantId,
                        redirect_url: window.location.origin,
                    },
                });
                if (edgeError || edgeData?.error) {
                    let msg = edgeData?.error || edgeError?.message || 'Erro ao enviar convite.';
                    if (msg.includes('already invited') || msg.includes('pending')) {
                        msg = 'Já existe um convite pendente para este e-mail.';
                    } else if (msg.includes('limit') || msg.includes('plan') || msg.includes('Team limit')) {
                        msg = 'Limite de profissionais do seu plano atingido.';
                    }
                    setToast({ message: `Erro ao convidar: ${msg}`, type: 'error' });
                    return;
                }
                setToast({ message: `Convite enviado para ${form.email}!`, type: 'success' });
                setShowModal(false);
                setEditingMember(null);
                fetchInvitations();
                return;
            }

            // Check for password
            if (!form.password || form.password.length < 6) {
                setToast({ message: 'A senha inicial deve ter pelo menos 6 caracteres.', type: 'error' });
                return;
            }

            // Get the current session token to authenticate with the Edge Function
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) {
                setToast({ message: 'Sessão expirada. Por favor, faça login novamente.', type: 'error' });
                return;
            }

            // Create via our edge function (which inserts cleanly and securely)
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('admin-create-user', {
                headers: { Authorization: `Bearer ${accessToken}` },
                body: {
                    email: form.email,
                    password: form.password,
                    name: form.name,
                    role: form.role,
                    tenant_id: tenantId
                }
            });

            if (edgeError || edgeData?.error) {
                // Try to extract the real message from the Edge Function response body
                let msg = edgeData?.error || edgeData?.message || edgeError?.message || 'Erro desconhecido';
                let code = edgeData?.code || null;
                let details = edgeData?.details || null;
                let hint = edgeData?.hint || null;

                // Also check staff_error for additional context
                const staffError = edgeData?.staff_error;
                if (staffError?.message) {
                    details = details || `Staff error: ${staffError.message}`;
                    code = code || staffError.code || null;
                }

                // FunctionsHttpError wraps the response; try to parse the body
                if (edgeError && typeof (edgeError as any).context?.json === 'function') {
                    try {
                        const body = await (edgeError as any).context.json();
                        if (body?.error) msg = body.error;
                        else if (body?.message) msg = body.message;
                        if (body?.code) code = body.code;
                        if (body?.details) details = body.details;
                        if (body?.hint) hint = body.hint;
                        if (body?.staff_error?.message) {
                            details = details || `Staff error: ${body.staff_error.message}`;
                        }
                    } catch (_) { }
                }

                console.error('Edge function error:', { edgeError, edgeData, msg, code, details, hint });

                // Translate common errors to pt-br
                let friendlyMsg = msg;
                if (msg.includes('already registered') || msg.includes('User already registered')) {
                    friendlyMsg = 'Este e-mail já está cadastrado no sistema.';
                } else if (msg.includes('invalid email')) {
                    friendlyMsg = 'E-mail inválido.';
                } else if (msg.includes('Password should') || msg.includes('password')) {
                    friendlyMsg = 'A senha deve ter pelo menos 6 caracteres.';
                } else if (msg.includes('email_exists') || msg.includes('duplicate')) {
                    friendlyMsg = 'Este e-mail já está cadastrado.';
                } else if (msg.includes('not authorized') || msg.includes('Unauthorized') || msg.includes('403')) {
                    friendlyMsg = `Sem permissão. Certifique-se de estar logado como ${isEsteticaApp ? 'Gestor' : 'Gerente'}.`;
                }
                setToast({ message: `Erro ao criar ${memberLabelLower}: ${friendlyMsg}`, type: 'error' });
                console.error('Detalhe completo do erro:', msg);
                return;
            }

            // After creation, optionally update the extra operational details on the staff table that the function didn't set
            if (edgeData?.warning || edgeData?.staff_error) {
                const staffErrMsg = edgeData.staff_error?.message || edgeData.warning || 'Registro de equipe não criado.';
                console.warn('Staff record warning:', edgeData.staff_error || edgeData.warning);
                setToast({ message: `${memberLabel} criado no sistema, mas houve erro ao criar registro de equipe: ${staffErrMsg}`, type: 'error' });
            } else if (edgeData?.user?.id) {
                try {
                    await staffRepository.update(edgeData.user.id, {
                        phone: form.phone,
                        commission_rate: editableFields.commission_rate
                    }, tenantId);
                } catch (updateErr) {
                    console.warn('Supplementary staff update failed:', updateErr);
                }
                setToast({ message: `${memberLabel} cadastrado com sucesso!`, type: 'success' });
            } else {
                setToast({ message: `${memberLabel} cadastrado com sucesso!`, type: 'success' });
            }
        }

        setShowModal(false);
        setEditingMember(null);
        fetchTeam();
    };

    const handleDelete = async (id: string) => {
        if (!tenantId) {
            setToast({ message: 'Tenant inválido para remover colaborador.', type: 'error' });
            return;
        }
        try {
            await staffRepository.delete(id, tenantId);
            setToast({ message: `${memberLabel} removido.`, type: 'info' });
            fetchTeam();
        } catch (error) {
            let message = 'Erro ao deletar colaborador.';
            if (error instanceof RepositoryError) {
                if (error.code === '23503' || error.message.includes('foreign key constraint') || error.message.includes('violates foreign key')) {
                    message = `Não é possível excluir este ${memberLabelLower} porque ele possui histórico de atendimentos ou comissões registradas. Para desativá-lo, altere o status para "Inativo" no botão Editar.`;
                } else {
                    message = `Erro ao deletar: ${error.message} (${error.code || 'sem-codigo'})`;
                }
            }
            console.error('DELETE ERROR:', error);
            setToast({ message, type: 'error' });
        }
    };

    const handleRevokeInvite = async (id: string) => {
        try {
            await teamInvitationService.revoke(id);
            setToast({ message: 'Convite revogado.', type: 'info' });
            fetchInvitations();
        } catch (error) {
            console.error('REVOKE INVITE ERROR:', error);
            setToast({ message: 'Erro ao revogar o convite.', type: 'error' });
        }
    };

    const handleCopyInviteLink = async (invitationId: string) => {
        try {
            setCopyingId(invitationId);
            const { data: token, error } = await supabase.rpc('get_team_invitation_token', {
                p_invitation_id: invitationId,
            });
            if (error || !token) {
                console.error('COPY INVITE LINK ERROR:', error);
                setToast({ message: 'Não foi possível obter o link do convite.', type: 'error' });
                return;
            }
            const inviteUrl = `${window.location.origin}/#/accept-invite/${token}`;
            await navigator.clipboard.writeText(inviteUrl);
            setToast({ message: 'Link do convite copiado!', type: 'success' });
        } catch (err) {
            console.error('CLIPBOARD ERROR:', err);
            setToast({ message: 'Erro ao copiar o link para a área de transferência.', type: 'error' });
        } finally {
            setCopyingId(null);
        }
    };

    const handleResendInvite = async (id: string, email: string) => {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;
            if (!accessToken) {
                setToast({ message: 'Sessão expirada. Por favor, faça login novamente.', type: 'error' });
                return;
            }
            await teamInvitationService.resend(id);
            // Reenvio do e-mail pelo canal SMTP (Auth), como no convite original.
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('invite-team-member', {
                headers: { Authorization: `Bearer ${accessToken}` },
                body: { email, role: invitations.find(i => i.id === id)?.role || 'barber', tenant_id: tenantId, redirect_url: window.location.origin },
            });
            if (edgeError || edgeData?.error) {
                setToast({ message: `Convite renovado, mas o e-mail não pôde ser reenviado.`, type: 'error' });
                return;
            }
            setToast({ message: `Convite reenviado para ${email}.`, type: 'success' });
            fetchInvitations();
        } catch (error) {
            console.error('RESEND INVITE ERROR:', error);
            setToast({ message: 'Erro ao reenviar o convite.', type: 'error' });
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight display-font">{memberPluralLabel}</h2>
                    <p className="text-slate-500 text-sm">{team.filter(m => m.status === 'active').length} {memberPluralLower} ativo(s)</p>
                </div>
                <button onClick={openNewModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-night rounded-xl text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all">
                    <span className="material-symbols-outlined text-lg">person_add</span>
                    {isEsteticaApp ? `Novo ${labels.professional}` : 'Novo Colaborador'}
                </button>
            </div>

            {/* Convites pendentes */}
            {!loadingInvites && invitations.length > 0 && (
                <div className="bg-white dark:bg-card-dark border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="material-symbols-outlined text-amber-500 text-lg">mail</span>
                        <h3 className="font-bold text-slate-900 dark:text-white">Convites pendentes</h3>
                        <span className="ml-auto text-xs text-slate-500">
                            {invitations.length} aguardando aceite
                        </span>
                    </div>
                    <div className="space-y-2">
                        {invitations.map(inv => {
                            const expired = new Date(inv.expiresAt) < new Date();
                            return (
                                <div key={inv.id} className="flex items-center gap-3 bg-amber-50/60 dark:bg-[#141414] border border-amber-100 dark:border-amber-900/30 rounded-xl px-4 py-3">
                                    <span className="material-symbols-outlined text-slate-400">person</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{inv.email}</p>
                                        <p className="text-xs text-slate-500">
                                            {roleLabels[inv.role] || inv.role} · {expired ? 'Expirado' : `Expira em ${new Date(inv.expiresAt).toLocaleDateString('pt-BR')}`}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleCopyInviteLink(inv.id)}
                                            disabled={copyingId === inv.id}
                                            className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Copiar link do convite">
                                            <span className="material-symbols-outlined text-lg">{copyingId === inv.id ? 'hourglass_empty' : 'content_copy'}</span>
                                        </button>
                                        <button onClick={() => handleResendInvite(inv.id, inv.email)}
                                            className="p-2 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Reenviar convite">
                                            <span className="material-symbols-outlined text-lg">refresh</span>
                                        </button>
                                        <button onClick={() => handleRevokeInvite(inv.id)}
                                            className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Revogar convite">
                                            <span className="material-symbols-outlined text-lg">link_off</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Search, Filter and View Mode */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input type="text" placeholder={`Buscar ${memberLabelLower}...`} value={search} onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#262626] rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white transition-all shadow-sm" />
                    </div>

                    {/* Status Tabs */}
                    <div className="inline-flex self-start sm:self-auto items-center bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] p-1 rounded-xl text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('active')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'active'
                                    ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Ativos ({team.filter(m => m.status === 'active').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('inactive')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'inactive'
                                    ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Inativos ({team.filter(m => m.status !== 'active').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'all'
                                    ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            Todos ({team.length})
                        </button>
                    </div>
                </div>

                <div className="flex items-center self-end sm:self-auto bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl p-1 shadow-sm">
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('grid')}
                        aria-label="Visualização em Grade"
                        title="Visualização em Grade"
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-night shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
                        <span className="material-symbols-outlined text-base block">grid_view</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleViewModeChange('table')}
                        aria-label="Visualização em Tabela"
                        title="Visualização em Tabela"
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-primary text-night shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
                        <span className="material-symbols-outlined text-base block">view_list</span>
                    </button>
                </div>
            </div>

            {/* Team Cards or Table */}
            {loading ? (
                <div className="p-10 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                    {search || statusFilter !== 'all'
                        ? `Nenhum ${memberLabelLower} encontrado com os filtros aplicados.`
                        : isEsteticaApp
                            ? 'Cadastre profissionais para organizar agenda e atendimentos.'
                            : 'Nenhum membro encontrado.'}
                </div>
            ) : viewMode === 'table' ? (
                <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500 font-bold">
                                    <th className="py-3.5 px-4">{memberLabel}</th>
                                    <th className="py-3.5 px-4">Função</th>
                                    <th className="py-3.5 px-4">{commissionLabel}</th>
                                    <th className="py-3.5 px-4">Contato</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filtered.map(member => (
                                    <tr key={member.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                    <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center"
                                                        style={{ backgroundImage: `url(${member.avatar || ''})` }}></div>
                                                    <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white dark:border-card-dark ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className="font-semibold text-slate-900 dark:text-white block truncate">{member.name}</span>
                                                    <span className="text-xs text-slate-400 block truncate sm:hidden">{member.email || 'Sem e-mail'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                                                <span className="material-symbols-outlined text-xs text-slate-400">{roleIcons[member.role] || 'person'}</span>
                                                {roleLabels[member.role] || member.role}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                            {member.commission_rate}%
                                        </td>
                                        <td className="py-3 px-4 text-xs text-slate-500">
                                            <div className="space-y-0.5">
                                                {member.email && <div className="truncate max-w-[200px]">{member.email}</div>}
                                                {member.phone && <div className="text-slate-400">{member.phone}</div>}
                                                {!member.email && !member.phone && <span className="text-slate-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                member.status === 'active'
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                                            }`}>
                                                {member.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => navigate('/schedule')}
                                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Ver Agenda">
                                                    <span className="material-symbols-outlined text-lg">calendar_month</span>
                                                </button>
                                                <button onClick={() => openEditModal(member)}
                                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Editar">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(member.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filtered.map(member => (
                        <div key={member.id} className="card-boutique p-6 group relative">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="relative">
                                    <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${member.avatar || ''})` }}></div>
                                    <span className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white dark:border-card-dark ${member.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors display-font">{member.name}</h4>
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
                                <div className="bg-slate-50 dark:bg-[#141414] border border-slate-100 dark:border-[#262626] p-3 rounded-xl">
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{commissionLabel}</p>
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
                                <button onClick={() => navigate('/schedule')}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-night rounded-lg text-xs font-bold transition-all">
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
            <Modal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingMember(null); }}
                title={editingMember ? `Editar ${memberLabel}` : `Novo ${memberLabel}`}
                maxWidth="md"
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
                        <input type="text" required={Boolean(editingMember) || !inviteRoles.includes(form.role)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="Ex: João Silva" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email</label>
                            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" placeholder={isEsteticaApp ? 'email@studio.com' : 'email@barber.com'} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone</label>
                            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" placeholder="(11) 99999-0000" />
                        </div>
                    </div>
                    {!editingMember && inviteRoles.includes(form.role) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900/40 rounded-lg px-3 py-2">
                            {isEsteticaApp ? 'O profissional' : 'O colaborador'} receberá um convite por e-mail e definirá a própria senha ao aceitar.
                        </div>
                    )}
                    {!editingMember && !inviteRoles.includes(form.role) && (
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Senha de Acesso (Inicial)</label>
                            <input type="password" required autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none" placeholder="Mínimo 6 caracteres" />
                            <p className="text-[10px] text-slate-400 mt-1">Essa será a senha que {isEsteticaApp ? 'o profissional' : 'o colaborador'} usará para logar no sistema.</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Função</label>
                            <select value={form.role} onChange={(e) => handleRoleChange(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]">
                                {roleOptions.map(r => <option key={r} value={r} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{roleLabels[r]}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{commissionLabel} (%)</label>
                            <input type="number" min="0" max="100" value={form.commission_rate} onChange={(e) => handleCommissionRateChange(e.target.value)}
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
                    {editingMember && (Number(form.commission_rate) > 0 || form.role === 'barber') && (
                        <div className="pt-3 border-t border-slate-200 dark:border-border-dark space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                    Política de Repasse & Vales (Lei Salão-Parceiro)
                                </span>
                                {loadingPayoutConfig && (
                                    <span className="text-[11px] text-slate-400">Carregando...</span>
                                )}
                            </div>
                            <PayoutCycleConfigFields
                                frequency={payoutForm.frequency}
                                payoutWeekday={payoutForm.payoutWeekday}
                                payoutMonthDay={payoutForm.payoutMonthDay}
                                allowAdvances={payoutForm.allowAdvances}
                                disabled={loadingPayoutConfig}
                                onChange={(next) => setPayoutForm(next)}
                            />
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => { setShowModal(false); setEditingMember(null); }}
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
                        <button type="submit"
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-night bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                            {editingMember ? 'Salvar Alterações' : inviteRoles.includes(form.role) ? 'Enviar Convite' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Team;
