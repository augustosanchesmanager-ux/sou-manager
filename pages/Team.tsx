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
import { StaffScheduleModal } from '../components/staff/StaffScheduleModal';
import type { StaffWorkingHours, StaffProfileDetails, PixKeyType } from '../domain/staff/types';
import { cardFeeRepository } from '../domain/paymentTerminal/cardFeeRepository';
import type { CardFeePolicy } from '../domain/paymentTerminal/cardFeeSplitEngine';
import { sanitizeOptionalFields, sanitizeNullableString } from '../src/utils/sanitization';

interface TeamMember {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatar: string;
    commission_rate: number;
    product_commission_rate?: number;
    status: string;
    working_hours?: StaffWorkingHours;
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
    type StaffModalTab = 'essential' | 'financial' | 'personal' | 'schedule';
    const [modalTab, setModalTab] = useState<StaffModalTab>('essential');
    const [showModal, setShowModal] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [form, setForm] = useState({
        // Aba 1: Essencial & Operação
        name: '',
        nickname: '',
        email: '',
        phone: '',
        role: 'barber',
        commission_rate: String(getDefaultCommissionRateForRole('barber')),
        product_commission_rate: '0',
        comissiona_produtos: false,
        status: 'active',
        password: '',

        // Aba 2: Financeiro & Repasse
        pix_key: '',
        pix_type: 'cpf' as PixKeyType,
        bank: '',
        fixed_salary: '',

        // Aba 3: Dados Pessoais & Documento
        cpf: '',
        rg: '',
        birth_date: '',
        hire_date: '',
        address: '',
        notes: '',

        // Aba 4: Agenda & Serviços
        show_in_calendar: true,
    });
    const [commissionEditedManually, setCommissionEditedManually] = useState(false);

    const isProfileComplete = (member: TeamMember): boolean => {
        const profile = member.working_hours?._profile;
        const hasPix = Boolean(profile?.pix_key && profile.pix_key.trim());
        const hasDoc = Boolean(profile?.cpf && profile.cpf.trim());
        return hasPix || hasDoc;
    };

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
    const [cardFeePolicy, setCardFeePolicy] = useState<CardFeePolicy>('gross');
    const [scheduleModalMember, setScheduleModalMember] = useState<TeamMember | null>(null);

    const handleSaveStaffSchedule = async (workingHours: StaffWorkingHours) => {
        if (!scheduleModalMember || !tenantId) return;
        try {
            await staffRepository.update(scheduleModalMember.id, { working_hours: workingHours }, tenantId);
            setToast({ message: 'Horários de atendimento atualizados com sucesso!', type: 'success' });
            fetchTeam();
        } catch (err) {
            console.error('Erro ao salvar horários:', err);
            setToast({ message: 'Erro ao salvar horários de atendimento.', type: 'error' });
        }
    };

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
        setModalTab('essential');
        setForm({
            name: '',
            nickname: '',
            email: '',
            phone: '',
            role: 'barber',
            commission_rate: String(getDefaultCommissionRateForRole('barber')),
            product_commission_rate: '0',
            comissiona_produtos: false,
            status: 'active',
            password: '',
            pix_key: '',
            pix_type: 'cpf',
            bank: '',
            fixed_salary: '',
            cpf: '',
            rg: '',
            birth_date: '',
            hire_date: '',
            address: '',
            notes: '',
            show_in_calendar: true,
        });
        setCardFeePolicy('gross');
        setShowModal(true);
    };

    const openEditModal = (member: TeamMember, initialTab: StaffModalTab = 'essential') => {
        setEditingMember(member);
        setCommissionEditedManually(false);
        setModalTab(initialTab);
        const prodRate = Number(member.product_commission_rate || 0);
        const profile = member.working_hours?._profile || {};

        setForm({
            name: member.name || '',
            nickname: profile.nickname || '',
            email: member.email || '',
            phone: member.phone || '',
            role: member.role || 'barber',
            commission_rate: (member.commission_rate ?? 40).toString(),
            product_commission_rate: prodRate.toString(),
            comissiona_produtos: prodRate > 0,
            status: member.status || 'active',
            password: '',

            pix_key: profile.pix_key || '',
            pix_type: (profile.pix_type as PixKeyType) || 'cpf',
            bank: profile.bank || '',
            fixed_salary: profile.fixed_salary != null ? String(profile.fixed_salary) : '',

            cpf: profile.cpf || '',
            rg: profile.rg || '',
            birth_date: profile.birth_date || '',
            hire_date: profile.hire_date || '',
            address: profile.address || '',
            notes: profile.notes || '',

            show_in_calendar: profile.show_in_calendar !== false,
        });
        setPayoutForm({
            frequency: 'weekly',
            payoutWeekday: 2,
            payoutMonthDay: 5,
            allowAdvances: true,
        });
        if (tenantId) {
            cardFeeRepository.getStaffPolicy(tenantId, member.id)
                .then((pol) => setCardFeePolicy(pol))
                .catch(() => setCardFeePolicy('gross'));
        }
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

        if (!form.name.trim()) {
            setToast({ message: 'O Nome Completo é obrigatório.', type: 'error' });
            setModalTab('essential');
            return;
        }

        const sanitizedProfile: StaffProfileDetails = sanitizeOptionalFields({
            nickname: form.nickname,
            pix_key: form.pix_key,
            pix_type: form.pix_type,
            bank: form.bank,
            fixed_salary: form.fixed_salary ? parseFloat(form.fixed_salary) : null,
            cpf: form.cpf,
            rg: form.rg,
            birth_date: form.birth_date,
            hire_date: form.hire_date,
            address: form.address,
            notes: form.notes,
            show_in_calendar: form.show_in_calendar,
        });

        const existingWorkingHours = (editingMember?.working_hours && typeof editingMember.working_hours === 'object')
            ? editingMember.working_hours
            : {};

        const updatedWorkingHours: StaffWorkingHours = {
            ...existingWorkingHours,
            _profile: sanitizedProfile,
        };

        const editableFields = {
            name: form.name.trim(),
            email: sanitizeNullableString(form.email) || '',
            phone: sanitizeNullableString(form.phone) || '',
            role: form.role,
            commission_rate: parseInt(form.commission_rate) || 0,
            product_commission_rate: form.comissiona_produtos ? (parseInt(form.product_commission_rate) || 0) : 0,
            status: form.status,
            avatar: form.name
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name.trim())}&background=random`
                : '',
            working_hours: updatedWorkingHours,
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
                    try {
                        await cardFeeRepository.setStaffPolicy(tenantId, editingMember.id, cardFeePolicy);
                    } catch (feeErr) {
                        console.warn('Aviso ao salvar política de taxa de cartão:', feeErr);
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
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-900 dark:text-white block truncate">{member.name}</span>
                                                        {isProfileComplete(member) ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Cadastro Completo">
                                                                Completo
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(member, 'financial')}
                                                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                                                title="Cadastro Básico · Clique para adicionar PIX e documentos"
                                                            >
                                                                Básico
                                                                <span className="material-symbols-outlined text-[10px]">edit</span>
                                                            </button>
                                                        )}
                                                    </div>
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
                                                <button onClick={() => setScheduleModalMember(member)}
                                                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Horários de Atendimento">
                                                    <span className="material-symbols-outlined text-lg">schedule</span>
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
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors display-font truncate">{member.name}</h4>
                                        {isProfileComplete(member) ? (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Cadastro Completo">
                                                Completo
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(member, 'financial')}
                                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                                                title="Cadastro Básico · Clique para adicionar PIX e documentos"
                                            >
                                                Básico
                                                <span className="material-symbols-outlined text-[10px]">edit</span>
                                            </button>
                                        )}
                                    </div>
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
                                <button onClick={() => setScheduleModalMember(member)}
                                    className="p-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                                    title="Horários de Atendimento">
                                    <span className="material-symbols-outlined text-sm">schedule</span>
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

            {/* Staff Schedule Modal */}
            <StaffScheduleModal
                isOpen={Boolean(scheduleModalMember)}
                onClose={() => setScheduleModalMember(null)}
                memberName={scheduleModalMember?.name || ''}
                workingHours={scheduleModalMember?.working_hours || null}
                onSave={handleSaveStaffSchedule}
            />

            {/* Add/Edit Modal (Cadastro Progressivo Desbloqueado) */}
            <Modal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingMember(null); }}
                title={editingMember ? `Editar ${memberLabel}` : `Novo ${memberLabel}`}
                maxWidth="2xl"
            >
                <form onSubmit={handleSave} className="flex flex-col gap-4">
                    {/* Barra de Abas do Cadastro Progressivo */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#141210] border border-slate-200 dark:border-[#2D2A26] rounded-xl overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => setModalTab('essential')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                modalTab === 'essential'
                                    ? 'bg-white dark:bg-[#0E0C0A] text-slate-900 dark:text-[#F5F5F0] border border-slate-200 dark:border-[#2D2A26] shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm text-[#B88A44]">badge</span>
                            1. Essencial & Operação <span className="text-[#B88A44] font-black">*</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setModalTab('financial')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                modalTab === 'financial'
                                    ? 'bg-white dark:bg-[#0E0C0A] text-slate-900 dark:text-[#F5F5F0] border border-slate-200 dark:border-[#2D2A26] shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm text-slate-400">account_balance_wallet</span>
                            2. Financeiro & Repasse
                            {Boolean(form.pix_key) && <span className="size-1.5 rounded-full bg-emerald-500" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => setModalTab('personal')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                modalTab === 'personal'
                                    ? 'bg-white dark:bg-[#0E0C0A] text-slate-900 dark:text-[#F5F5F0] border border-slate-200 dark:border-[#2D2A26] shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                            3. Dados & Documentos
                            {Boolean(form.cpf) && <span className="size-1.5 rounded-full bg-emerald-500" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => setModalTab('schedule')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${
                                modalTab === 'schedule'
                                    ? 'bg-white dark:bg-[#0E0C0A] text-slate-900 dark:text-[#F5F5F0] border border-slate-200 dark:border-[#2D2A26] shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                            4. Agenda & Serviços
                        </button>
                    </div>

                    {/* Conteúdo das Abas (Rolável com altura confortável) */}
                    <div className="max-h-[62vh] overflow-y-auto px-1 py-1 space-y-4">
                        {/* ======================================================== */}
                        {/* ABA 1: ESSENCIAL & OPERAÇÃO (ÚNICA OBRIGATÓRIA)           */}
                        {/* ======================================================== */}
                        {modalTab === 'essential' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-base">info</span>
                                    <span>
                                        <strong>Balcão ágil:</strong> Apenas os campos marcados com <span className="font-bold">*</span> são necessários para salvar e começar a operar agora. Os demais são opcionais.
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                                            Nome Completo <span className="text-[#B88A44]">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Ex: João Silva"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                                            Apelido / Nome de Exibição <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.nickname}
                                            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Ex: Silva Barber, Dan"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                                            Função / Cargo <span className="text-[#B88A44]">*</span>
                                        </label>
                                        <select
                                            value={form.role}
                                            onChange={(e) => handleRoleChange(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                        >
                                            {roleOptions.map((r) => (
                                                <option key={r} value={r} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                                                    {roleLabels[r]}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                                            Telefone / WhatsApp <span className="text-[#B88A44]">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={form.phone}
                                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="(11) 99999-0000"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                                            {commissionLabel} de Serviços (%) <span className="text-[#B88A44]">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            required
                                            value={form.commission_rate}
                                            onChange={(e) => handleCommissionRateChange(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                                            E-mail {inviteRoles.includes(form.role) && !editingMember ? <span className="text-[#B88A44]">* (Convite)</span> : <span className="text-slate-400 font-normal lowercase">(opcional)</span>}
                                        </label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                            placeholder={isEsteticaApp ? 'email@studio.com' : 'email@barber.com'}
                                        />
                                    </div>
                                </div>

                                {!editingMember && inviteRoles.includes(form.role) && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900/40 rounded-lg px-3 py-2.5">
                                        {isEsteticaApp ? 'O profissional' : 'O colaborador'} receberá um convite por e-mail e definirá a própria senha ao aceitar.
                                    </div>
                                )}

                                {!editingMember && !inviteRoles.includes(form.role) && (
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Senha de Acesso (Inicial) *</label>
                                        <input
                                            type="password"
                                            required
                                            autoComplete="new-password"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none"
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Essa será a senha inicial para login no painel.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ======================================================== */}
                        {/* ABA 2: FINANCEIRO & REPASSE (OPCIONAL)                    */}
                        {/* ======================================================== */}
                        {modalTab === 'financial' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] space-y-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm text-[#B88A44]">credit_card</span>
                                        Dados de Repasse & PIX (Opcional)
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Tipo de Chave PIX</label>
                                            <select
                                                value={form.pix_type}
                                                onChange={(e) => setForm({ ...form, pix_type: e.target.value as PixKeyType })}
                                                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none"
                                            >
                                                <option value="cpf">CPF</option>
                                                <option value="cnpj">CNPJ</option>
                                                <option value="phone">Telefone / Celular</option>
                                                <option value="email">E-mail</option>
                                                <option value="random">Chave Aleatória</option>
                                            </select>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Chave PIX</label>
                                            <input
                                                type="text"
                                                value={form.pix_key}
                                                onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
                                                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none"
                                                placeholder="Informe a chave PIX do profissional"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Banco / Instituição</label>
                                            <input
                                                type="text"
                                                value={form.bank}
                                                onChange={(e) => setForm({ ...form, bank: e.target.value })}
                                                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none"
                                                placeholder="Ex: Nubank, Inter, Itaú"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Salário Fixo / Ajuda de Custo (R$)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={form.fixed_salary}
                                                onChange={(e) => setForm({ ...form, fixed_salary: e.target.value })}
                                                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none"
                                                placeholder="0,00 (se aplicável)"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bloco de Comissão de Produtos */}
                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] space-y-2.5">
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={form.comissiona_produtos}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setForm((prev) => ({
                                                    ...prev,
                                                    comissiona_produtos: checked,
                                                    product_commission_rate: checked ? (prev.product_commission_rate !== '0' ? prev.product_commission_rate : '10') : '0',
                                                }));
                                            }}
                                            className="size-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 dark:border-slate-600"
                                        />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            Comissionar sobre Venda de Produtos
                                        </span>
                                    </label>
                                    {form.comissiona_produtos ? (
                                        <div className="pl-6 pt-1">
                                            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                                                Alíquota sobre Produtos (%)
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={form.product_commission_rate}
                                                onChange={(e) => setForm((prev) => ({ ...prev, product_commission_rate: e.target.value }))}
                                                className="w-full sm:w-48 bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
                                                placeholder="Ex: 10"
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                                            Nenhum produto vendido gerará comissão para este colaborador.
                                        </p>
                                    )}
                                </div>

                                {/* Bloco de Política de Taxa de Maquininha / Cartão */}
                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-bold uppercase text-slate-500">
                                            Taxa da Maquininha de Cartão
                                        </label>
                                        <span className="text-[10px] text-amber-500 font-bold uppercase">
                                            Rateio Inteligente
                                        </span>
                                    </div>

                                    <select
                                        value={cardFeePolicy}
                                        onChange={(e) => setCardFeePolicy(e.target.value as CardFeePolicy)}
                                        className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none"
                                    >
                                        <option value="gross">Bruto (Barbearia absorve 100% da taxa - Isento)</option>
                                        <option value="split">Dividido (Rateio proporcional à comissão)</option>
                                        <option value="deducted">Descontado (Taxa deduzida da comissão do barbeiro)</option>
                                    </select>
                                </div>

                                {/* Política de Repasse & Vales */}
                                {editingMember && (Number(form.commission_rate) > 0 || form.role === 'barber') && (
                                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                                Ciclo de Repasse & Vales (Lei Salão-Parceiro)
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
                            </div>
                        )}

                        {/* ======================================================== */}
                        {/* ABA 3: DADOS PESSOAIS & DOCUMENTOS (OPCIONAL)            */}
                        {/* ======================================================== */}
                        {modalTab === 'personal' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">CPF</label>
                                        <input
                                            type="text"
                                            value={form.cpf}
                                            onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="000.000.000-00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">RG</label>
                                        <input
                                            type="text"
                                            value={form.rg}
                                            onChange={(e) => setForm({ ...form, rg: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Registro Geral"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data de Nascimento</label>
                                        <input
                                            type="date"
                                            value={form.birth_date}
                                            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data de Admissão / Início</label>
                                        <input
                                            type="date"
                                            value={form.hire_date}
                                            onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Endereço Completo</label>
                                    <input
                                        type="text"
                                        value={form.address}
                                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="Rua, número, complemento, bairro, cidade"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Observações / Notas Internas</label>
                                    <textarea
                                        rows={3}
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="Histórico, especialidades extras, termos acordados..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* ======================================================== */}
                        {/* ABA 4: AGENDA & SERVIÇOS (OPCIONAL)                       */}
                        {/* ======================================================== */}
                        {modalTab === 'schedule' && (
                            <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Status Cadastral</label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                    >
                                        <option value="active" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Ativo (Permitido operar e agendar)</option>
                                        <option value="inactive" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Inativo (Bloqueado temporariamente)</option>
                                    </select>
                                </div>

                                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] space-y-2">
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={form.show_in_calendar}
                                            onChange={(e) => setForm({ ...form, show_in_calendar: e.target.checked })}
                                            className="size-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300 dark:border-slate-600"
                                        />
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                            Exibir na Agenda & Agendamento Público Online
                                        </span>
                                    </label>
                                    <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                                        Quando ativado, os clientes poderão escolher este profissional diretamente no portal de agendamento online.
                                    </p>
                                </div>

                                {editingMember && (
                                    <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <h5 className="text-xs font-bold text-slate-900 dark:text-white">Jornada Semanal e Horários</h5>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                {editingMember.working_hours && Object.keys(editingMember.working_hours).some((k) => k !== '_profile' && editingMember.working_hours?.[k])
                                                    ? 'Jornada personalizada ativa para este profissional.'
                                                    : 'Atualmente herda os horários gerais da barbearia.'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setScheduleModalMember(editingMember)}
                                            className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-night rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                                        >
                                            <span className="material-symbols-outlined text-sm">schedule</span>
                                            Configurar Horários
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rodapé Fixo com Botão de Salvar Desbloqueado */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-[#2D2A26]">
                        <button
                            type="button"
                            onClick={() => { setShowModal(false); setEditingMember(null); }}
                            className="px-5 py-2.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold text-night bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                        >
                            <span className="material-symbols-outlined text-base">save</span>
                            {editingMember ? 'Salvar Colaborador' : inviteRoles.includes(form.role) ? 'Enviar Convite' : 'Adicionar Colaborador'}
                        </button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Team;
