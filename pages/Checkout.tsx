import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    ensureAppSupportsModule,
    getScopedClient,
    requireTenantContext,
    supabase,
} from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import {
    type ServiceBalanceEntry,
    getAvailableCreditsForService,
    getTotalAvailableCredits,
    normalizeCreditBalances,
} from '../src/utils/chefClubCredits';
import { settleCheckoutComanda } from '../src/lib/finance/settlement';
import {
    buildZeroCloseAuditNote,
    closeZeroAmountComanda,
    isManagerLikeRole,
    type ZeroCloseOrigin,
} from '../src/lib/finance/zeroClose';
import { receivesCommission } from '../src/lib/staff/roles';
import {
    DISCOUNT_REASON_LABELS,
    DISCOUNT_TYPE_LABELS,
    type DiscountAuditDraft,
    type DiscountAuditType,
    type DiscountReasonType,
    formatDiscountAuditNote,
} from '../src/lib/finance/discountAudit';
import {
    getCatalogDisplayName,
    getCatalogInternalName,
    getCatalogSearchText,
    usesCommercialName,
} from '../src/lib/catalog/display';

type ExecutionRole = 'primary' | 'assistant' | 'co_executor';
type PayoutType = 'percentage' | 'fixed';
type ClosureMode = 'standard' | 'legacy_membership';

interface CartParticipant {
  id: string;
  professional_id: string;
  professional_name?: string;
  role: ExecutionRole;
  payout_type: PayoutType;
  payout_value: number;
  affects_revenue: boolean;
  affects_commission: boolean;
}

// Types
interface CartItem {
    id: string; // for UI tracking
    dbId?: string; // from database if editing
    type: 'service' | 'product';
    name: string;
    internal_name?: string;
    display_name?: string;
    description?: string;
    price: number;
    quantity: number;
    service_id?: string;
    product_id?: string;
    staff_id?: string;
    usedCredit?: boolean;
    execution_participants?: CartParticipant[];
}

interface PendingCreditItem {
    item: any;
    type: 'service' | 'product';
    finalPrice: number;
}

interface Client {
    id: string;
    name: string;
    avatar: string;
    phone?: string;
}

interface QuickOpenComanda {
    id: string;
    client_id?: string | null;
    created_at: string;
    status: string;
    total?: number | string | null;
    clients?: { name?: string | null; phone?: string | null } | { name?: string | null; phone?: string | null }[] | null;
}

interface Promotion {
    id: string;
    title: string;
    target_type: 'service' | 'product' | 'all';
    target_id: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    start_date: string;
    end_date: string;
    active: boolean;
}

interface Staff {
    id: string;
    name: string;
    role?: string | null;
}

interface QuickProductForm {
    name: string;
    commercial_name: string;
    description: string;
    cost_price: string;
    sale_price: string;
    stock_quantity: string;
    minimum_stock: string;
    auto_generate_purchase_order: boolean;
}

interface QuickServiceForm {
    name: string;
    commercial_name: string;
    description: string;
    category: string;
    price: string;
    duration: string;
    active: boolean;
}

interface CheckoutLocationState {
    fromAppointment?: boolean;
    appointmentId?: string;
    clientId?: string;
    clientName?: string;
    serviceName?: string;
    staffId?: string;
    price?: number;
}

type CheckoutEntryMode = 'edit_comanda' | 'open_comanda' | 'pdv';

const generateIdempotencyKey = (prefix = 'req') => {
    const randomPart = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${randomPart}`;
};

const createInitialQuickProductForm = (): QuickProductForm => ({
    name: '',
    commercial_name: '',
    description: '',
    cost_price: '0',
    sale_price: '0',
    stock_quantity: '0',
    minimum_stock: '0',
    auto_generate_purchase_order: false,
});

const createInitialQuickServiceForm = (serviceName = ''): QuickServiceForm => ({
    name: serviceName,
    commercial_name: '',
    description: '',
    category: 'Cabelo',
    price: '0',
    duration: '30',
    active: true,
});

const toMonthInputValue = (value?: string | null) => {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const normalizePercentageValue = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return value > 1 ? value / 100 : value;
};

const formatPayoutValue = (participant: Pick<CartParticipant, 'payout_type' | 'payout_value'>) => {
    if (participant.payout_type === 'percentage') {
        return `${(normalizePercentageValue(participant.payout_value) * 100).toFixed(0)}%`;
    }
    return `R$ ${Number(participant.payout_value || 0).toFixed(2)}`;
};

const isSharedExecution = (item: Pick<CartItem, 'staff_id' | 'execution_participants'>) => {
    const participants = item.execution_participants || [];
    if (participants.length === 0) return false;
    if (participants.length > 1) return true;
    const [participant] = participants;
    return participant.role !== 'primary' || participant.professional_id !== item.staff_id;
};

const getParticipantStaffId = (participant: any) => participant?.staff_id || participant?.professional_id || '';

const isFutureOrOpenDate = (value?: string | null) => {
    if (!value) return true;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) || parsed.getTime() >= Date.now();
};

const DIRECT_SETTLEMENT_BLOCK_MESSAGE = 'Esta comanda pertence a um atendimento anterior ou foi cadastrada fora da data do agendamento. Para proteger o caixa e os relatórios, a baixa deve ser feita pelo financeiro.';

const getQuickComandaClient = (comanda: QuickOpenComanda) => {
    const client = Array.isArray(comanda.clients) ? comanda.clients[0] : comanda.clients;
    return {
        name: client?.name || 'Cliente não identificado',
        phone: client?.phone || null,
    };
};

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isBeforeTodayLocal = (value?: string | null) => {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    return startOfLocalDay(parsed).getTime() < startOfLocalDay(new Date()).getTime();
};

const isCreatedAfterAppointmentDay = (createdAt?: string | null, appointmentStartTime?: string | null) => {
    if (!createdAt || !appointmentStartTime) return false;
    const created = new Date(createdAt);
    const appointment = new Date(appointmentStartTime);
    if (Number.isNaN(created.getTime()) || Number.isNaN(appointment.getTime())) return false;
    return startOfLocalDay(created).getTime() > startOfLocalDay(appointment).getTime();
};

const serviceCategories = ['Cabelo', 'Barba', 'Combo', 'Quimica', 'Acabamento', 'Outros'];

const Checkout: React.FC = () => {
    const { id: comandaId } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { appSlug, schema, tenantId, user, accessRole, canAccessSuperAdmin } = useAuth();
    const checkoutState = (location.state as CheckoutLocationState | null) || null;
    const searchParams = new URLSearchParams(location.search);
    const requestedMode = searchParams.get('mode');
    const checkoutEntryMode: CheckoutEntryMode = comandaId
        ? 'edit_comanda'
        : checkoutState?.fromAppointment || requestedMode === 'comanda'
            ? 'open_comanda'
            : 'pdv';
    const checkoutCopy = checkoutEntryMode === 'edit_comanda'
        ? {
            title: 'Fechamento de Comanda',
            subtitle: 'Revise os itens, ajuste o consumo e conclua a cobrança.',
            orderLabel: 'Comanda',
            clientRequiredError: 'Selecione o cliente vinculado a esta comanda.',
            clientEmptyTitle: 'Cliente da comanda',
            clientEmptyHelper: 'Selecione o cliente responsável por esta comanda.',
            itemSectionTitle: 'Itens da Comanda',
            actionToggleLabel: 'Ação da comanda',
            primaryPaidLabel: 'Fechar agora',
            primaryOpenLabel: 'Manter aberta',
            successPaid: 'Comanda fechada com sucesso!',
            successOpen: 'Comanda atualizada e mantida em aberto!',
            emptyCartMessage: 'Nenhum item lançado na comanda',
            itemRequiredError: 'Adicione pelo menos um item antes de finalizar a comanda.',
            finalButtonPaidLabel: 'Confirmar e fechar',
            finalButtonOpenLabel: 'Atualizar e manter aberta',
            summaryTitle: 'Resumo da cobrança',
            redirectPath: '/comandas',
        }
        : checkoutEntryMode === 'open_comanda'
            ? {
                title: 'Abrir Comanda',
                subtitle: 'Inicie uma comanda operacional para acompanhar consumo e fechar depois.',
                orderLabel: 'Nova comanda',
                clientRequiredError: 'Selecione o cliente antes de abrir a comanda.',
                clientEmptyTitle: 'Cliente da comanda',
                clientEmptyHelper: 'Obrigatório para abrir a comanda.',
                itemSectionTitle: 'Itens iniciais da Comanda',
                actionToggleLabel: 'Destino da comanda',
                primaryPaidLabel: 'Fechar agora',
                primaryOpenLabel: 'Salvar aberta',
                successPaid: 'Comanda fechada com sucesso!',
                successOpen: 'Comanda aberta com sucesso!',
                emptyCartMessage: 'Adicione os primeiros itens para abrir a comanda',
                itemRequiredError: 'Adicione pelo menos um item antes de salvar a comanda.',
                finalButtonPaidLabel: 'Abrir e fechar agora',
                finalButtonOpenLabel: 'Abrir comanda',
                summaryTitle: 'Resumo da comanda',
                redirectPath: '/comandas',
            }
            : {
                title: 'Checkout / PDV',
                subtitle: 'Lance produtos e serviços para uma venda imediata no caixa ou mantenha uma comanda aberta.',
                orderLabel: 'Operação',
                clientRequiredError: 'Selecione um cliente para concluir a operação.',
                clientEmptyTitle: 'Cliente não selecionado',
                clientEmptyHelper: 'Obrigatório para concluir a operação no fluxo atual.',
                itemSectionTitle: 'Itens da Operação',
                actionToggleLabel: 'Ação da operação',
                primaryPaidLabel: 'Concluir venda',
                primaryOpenLabel: 'Manter aberta',
                successPaid: 'Venda realizada com sucesso!',
                successOpen: 'Operação mantida em aberto!',
                emptyCartMessage: 'Nenhum item lançado na operação',
                itemRequiredError: 'Adicione pelo menos um item antes de concluir a operação.',
                finalButtonPaidLabel: 'Concluir venda',
                finalButtonOpenLabel: 'Manter aberta',
                summaryTitle: 'Resumo financeiro',
                redirectPath: '/checkout?mode=pdv',
            };
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // State
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
    const [paymentMethod, setPaymentMethod] = useState<'credit' | 'debit' | 'cash' | 'pix' | 'other'>('credit');
    const [paymentDescription, setPaymentDescription] = useState<string>('');
    const [closureMode, setClosureMode] = useState<ClosureMode>('standard');
    const [closureNote, setClosureNote] = useState('');
    const [legacyReferenceMonth, setLegacyReferenceMonth] = useState('');
    const [zeroCloseOrigin, setZeroCloseOrigin] = useState<ZeroCloseOrigin>('club_credit');
    const [zeroCloseReason, setZeroCloseReason] = useState('');
    const [discount, setDiscount] = useState<string>('0');
    const [discountType, setDiscountType] = useState<DiscountAuditType>('barber_discount');
    const [discountReasonType, setDiscountReasonType] = useState<DiscountReasonType>('fidelizacao');
    const [discountReasonNote, setDiscountReasonNote] = useState('');
    const [discountResponsibleStaffId, setDiscountResponsibleStaffId] = useState('');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isSharedExecutionModalOpen, setIsSharedExecutionModalOpen] = useState(false);
    const [sharedExecutionItemId, setSharedExecutionItemId] = useState<string | null>(null);
    const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
    const [isQuickServiceModalOpen, setIsQuickServiceModalOpen] = useState(false);
    const [itemModalTab, setItemModalTab] = useState<'services' | 'products'>('services');
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingCreditItem, setPendingCreditItem] = useState<PendingCreditItem | null>(null);
    const [quickProductForm, setQuickProductForm] = useState<QuickProductForm>(createInitialQuickProductForm);
    const [quickServiceForm, setQuickServiceForm] = useState<QuickServiceForm>(createInitialQuickServiceForm);
    const [isSavingQuickProduct, setIsSavingQuickProduct] = useState(false);
    const [isSavingQuickService, setIsSavingQuickService] = useState(false);

    // Duplicate comanda guard
    const [duplicateComanda, setDuplicateComanda] = useState<{ id: string; created_at: string } | null>(null);
    const [pendingClient, setPendingClient] = useState<Client | null>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [isOpenComandaModalOpen, setIsOpenComandaModalOpen] = useState(false);
    const [openComandaSearchTerm, setOpenComandaSearchTerm] = useState('');
    const [quickOpenComandas, setQuickOpenComandas] = useState<QuickOpenComanda[]>([]);
    const [loadingQuickOpenComandas, setLoadingQuickOpenComandas] = useState(false);
    const [quickOpenComandaError, setQuickOpenComandaError] = useState<string | null>(null);

    // DB Data
    const [clients, setClients] = useState<Client[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
    const [chefClubInfo, setChefClubInfo] = useState<{
        id: string;
        planName: string;
        credits: number;
        serviceBalances: ServiceBalanceEntry[];
    } | null>(null);
    const [relatedAppointmentId, setRelatedAppointmentId] = useState<string | null>(checkoutState?.appointmentId || null);
    const [loading, setLoading] = useState(true);
    const finishLockRef = React.useRef(false);
    const comandaRequestKeyRef = React.useRef(generateIdempotencyKey('comanda'));
    const supportsOpenComandaState = true;
    const incomeCategory = checkoutEntryMode === 'pdv'
        ? 'Venda de Balcao'
        : checkoutEntryMode === 'open_comanda'
            ? 'Fechamento de Comanda'
            : 'Fechamento de Atendimento';
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const discountValue = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - discountValue);
    const assignedStaffIds = useMemo(
        () => Array.from(new Set(cart.map(item => item.staff_id).filter(Boolean))) as string[],
        [cart],
    );
    const assignedCommissionStaff = useMemo(
        () => staff.filter(pro => assignedStaffIds.includes(pro.id) && receivesCommission(pro)),
        [assignedStaffIds, staff],
    );
    const discountStaffOptions = assignedCommissionStaff.length > 0
        ? assignedCommissionStaff
        : staff.filter(pro => receivesCommission(pro));
    const discountResponsibleStaff = staff.find(pro => pro.id === discountResponsibleStaffId) || null;
    const shouldCollectDiscountAudit = discountValue > 0;
    const creditItems = cart.filter(item => item.usedCredit && item.type === 'service' && item.service_id);
    const isZeroPaidCheckout = paymentStatus === 'paid' && total <= 0;
    const canCloseWithClubCredit = isZeroPaidCheckout && creditItems.length > 0 && Boolean(chefClubInfo);
    const canCloseWithAdministrativeOrigin = isManagerLikeRole(accessRole, canAccessSuperAdmin);
    const isLegacyClubSettlement = paymentStatus === 'paid' && closureMode === 'legacy_membership';
    const shouldShowPaymentMethod = paymentStatus === 'paid' && !isZeroPaidCheckout;
    const isZeroAuditSettlement = isZeroPaidCheckout && (
        zeroCloseOrigin === 'club_credit'
            ? canCloseWithClubCredit
            : zeroCloseOrigin === 'house_courtesy' || zeroCloseOrigin === 'administrative_adjustment'
    );
    const shouldSettleZeroWithAudit = isZeroAuditSettlement && !isLegacyClubSettlement;
    const shouldApplyFinancialEffects = paymentStatus === 'paid' && !isLegacyClubSettlement && !shouldSettleZeroWithAudit;
    const shouldDeductMembershipCredits = paymentStatus === 'paid' && !isLegacyClubSettlement && !shouldSettleZeroWithAudit;

    const resetComandaRequestKey = () => {
        comandaRequestKeyRef.current = generateIdempotencyKey('comanda');
    };

    const resetOperationalState = useCallback(() => {
        if (comandaId) return;

        setSelectedClient(null);
        setCart([]);
        setDiscount('0');
        setDiscountType('barber_discount');
        setDiscountReasonType('fidelizacao');
        setDiscountReasonNote('');
        setDiscountResponsibleStaffId('');
        setPaymentMethod('credit');
        setPaymentDescription('');
        setClosureMode('standard');
        setClosureNote('');
        setLegacyReferenceMonth('');
        setZeroCloseOrigin('club_credit');
        setZeroCloseReason('');
        setChefClubInfo(null);
        setDuplicateComanda(null);
        setPendingClient(null);
        setShowDuplicateModal(false);
        setSearchTerm('');
        setRelatedAppointmentId(null);
        setPaymentStatus(checkoutEntryMode === 'open_comanda' ? 'pending' : 'paid');
        resetComandaRequestKey();
    }, [checkoutEntryMode, comandaId]);

    const loadChefClubForClient = useCallback(async (clientId: string, resolvedTenantId: string) => {
        const clientDb = getScopedClient('barber');
        const nowIso = new Date().toISOString();
        const { data: sub, error: subError } = await clientDb
            .from('customer_subscriptions')
            .select('id, plan_id, cycle_start, cycle_end, next_billing_date, created_at')
            .eq('client_id', clientId)
            .eq('tenant_id', resolvedTenantId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (subError) throw subError;

        if (!sub || !isFutureOrOpenDate(sub.cycle_end || sub.next_billing_date)) {
            setChefClubInfo(null);
            return null;
        }

        const { data: paidCycle, error: paidCycleError } = await clientDb
            .from('customer_subscription_receivables')
            .select('id')
            .eq('tenant_id', resolvedTenantId)
            .eq('subscription_id', sub.id)
            .eq('status', 'paid')
            .not('transaction_id', 'is', null)
            .lte('billing_cycle_start', nowIso)
            .gte('billing_cycle_end', nowIso)
            .limit(1)
            .maybeSingle();

        if (paidCycleError) throw paidCycleError;

        if (!paidCycle) {
            setChefClubInfo(null);
            return null;
        }

        const [{ data: plan, error: planError }, { data: credits, error: creditsError }] = await Promise.all([
            clientDb
                .from('customer_plans')
                .select('name')
                .eq('id', sub.plan_id)
                .eq('tenant_id', resolvedTenantId)
                .maybeSingle(),
            clientDb
                .from('customer_credits')
                .select('available_credits, used_credits, service_balance_map, period_end')
                .eq('subscription_id', sub.id)
                .eq('tenant_id', resolvedTenantId)
                .maybeSingle(),
        ]);

        if (planError) throw planError;
        if (creditsError) throw creditsError;

        if (!credits || !isFutureOrOpenDate(credits.period_end)) {
            setChefClubInfo(null);
            return null;
        }

        const serviceBalances = normalizeCreditBalances(
            credits.service_balance_map,
            credits.available_credits || 0,
            credits.used_credits || 0,
        );

        const nextInfo = {
            id: sub.id,
            planName: plan?.name || 'Plano ativo',
            credits: getTotalAvailableCredits(serviceBalances),
            serviceBalances,
        };
        setChefClubInfo(nextInfo);
        return nextInfo;
    }, []);

    // Fetch initial data
    const fetchData = useCallback(async () => {
        if (!tenantId) {
            setClients([]);
            setStaff([]);
            setServices([]);
            setProducts([]);
            setActivePromotions([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug, 'checkout', ['barber']);
            const { tenantId: resolvedTenantId } = requireTenantContext({
                tenantId,
                appSlug: currentAppSlug,
                schema,
                table: 'comandas',
                operation: 'load checkout data',
            });
            const client = getScopedClient('barber');

            const [clientsRes, staffRes, servicesRes, productsRes, promoRes] = await Promise.all([
                client.from('clients').select('id, name, avatar, phone').eq('tenant_id', resolvedTenantId).order('name'),
                client.from('staff').select('id, name, role').eq('tenant_id', resolvedTenantId).eq('status', 'active'),
                client.from('services').select('*').eq('tenant_id', resolvedTenantId).or('active.is.null,active.eq.true'),
                client.from('products').select('*').eq('tenant_id', resolvedTenantId).or('active.is.null,active.eq.true'),
                client.from('promotions').select('*').eq('tenant_id', resolvedTenantId).eq('active', true),
            ]);

            if (clientsRes.error) throw clientsRes.error;
            if (staffRes.error) throw staffRes.error;
            if (servicesRes.error) throw servicesRes.error;
            if (productsRes.error) throw productsRes.error;
            if (promoRes.error) throw promoRes.error;

            setClients((clientsRes.data || []) as Client[]);
            setStaff((staffRes.data || []) as Staff[]);
            setServices(servicesRes.data || []);
            setProducts(productsRes.data || []);

            const now = new Date();
            const validPromos = (promoRes.data || []).filter((p: any) => {
                const start = new Date(p.start_date);
                const end = new Date(p.end_date);
                end.setHours(23, 59, 59, 999);
                return now >= start && now <= end;
            });
            setActivePromotions(validPromos);

            if (comandaId) {
                const { data: comanda, error: comError } = await client
                    .from('comandas')
                    .select('*')
                    .eq('id', comandaId)
                    .eq('tenant_id', resolvedTenantId)
                    .single();

                if (comError) throw comError;

                if (comanda) {
                    const [{ data: selectedClientData, error: selectedClientError }, { data: comandaItems, error: itemsError }] = await Promise.all([
                        comanda.client_id
                            ? client
                                .from('clients')
                                .select('id, name, avatar, phone')
                                .eq('id', comanda.client_id)
                                .eq('tenant_id', resolvedTenantId)
                                .maybeSingle()
                            : Promise.resolve({ data: null, error: null }),
                        client
                            .from('comanda_items')
                            .select('*')
                            .eq('comanda_id', comanda.id)
                            .eq('tenant_id', resolvedTenantId),
                    ]);

                    if (selectedClientError) throw selectedClientError;
                    if (itemsError) throw itemsError;

                    setSelectedClient(selectedClientData || null);
                    setPaymentStatus(comanda.status === 'paid' ? 'paid' : 'pending');
                    setPaymentMethod(comanda.payment_method || 'credit');
                    setDiscount(String(comanda.discount || 0));
                    setClosureMode(comanda.closure_mode === 'legacy_membership' ? 'legacy_membership' : 'standard');
                    setClosureNote(comanda.closure_note || '');
                    setLegacyReferenceMonth(toMonthInputValue(comanda.legacy_reference_month));
                    setRelatedAppointmentId(comanda.appointment_id || null);

                    const itemIds = (comandaItems || []).map((item: any) => item.id);
                    const { data: participantRows, error: participantsError } = itemIds.length > 0
                        ? await client
                            .from('service_execution_participants')
                            .select('*')
                            .eq('tenant_id', resolvedTenantId)
                            .in('comanda_item_id', itemIds)
                        : { data: [] as any[], error: null };

                    if (participantsError) throw participantsError;

                    const participantProfessionalIds = Array.from(new Set(
                        ((participantRows || []) as any[])
                            .map(getParticipantStaffId)
                            .filter(Boolean),
                    ));
                    const { data: participantStaffRows } = participantProfessionalIds.length > 0
                        ? await client
                            .from('staff')
                            .select('id, name, role')
                            .eq('tenant_id', resolvedTenantId)
                            .in('id', participantProfessionalIds)
                        : { data: [] as any[] };
                    const participantStaffById = ((participantStaffRows || []) as any[]).reduce((acc, professional) => {
                        acc[professional.id] = professional.name;
                        return acc;
                    }, {} as Record<string, string>);
                    const participantsByItemId = ((participantRows || []) as any[]).reduce((acc, participant) => {
                        if (!acc[participant.comanda_item_id]) acc[participant.comanda_item_id] = [];
                        const professionalId = getParticipantStaffId(participant);
                        acc[participant.comanda_item_id].push({
                            id: participant.id,
                            professional_id: professionalId,
                            professional_name: participantStaffById[professionalId],
                            role: participant.role,
                            payout_type: participant.payout_type,
                            payout_value: Number(participant.payout_value || 0),
                            affects_revenue: participant.affects_revenue !== false,
                            affects_commission: participant.affects_commission !== false,
                        });
                        return acc;
                    }, {} as Record<string, CartParticipant[]>);

                    const mappedItems: CartItem[] = (comandaItems || []).map((item: any) => ({
                        id: item.id,
                        dbId: item.id,
                        type: item.service_id ? 'service' : 'product',
                        name: item.product_name,
                        price: item.unit_price,
                        quantity: item.quantity,
                        service_id: item.service_id,
                        product_id: item.product_id,
                        staff_id: item.staff_id,
                        execution_participants: participantsByItemId[item.id] || undefined,
                    }));
                    setCart(mappedItems);

                    if (selectedClientData?.id) {
                        await loadChefClubForClient(selectedClientData.id, resolvedTenantId);
                    } else {
                        setChefClubInfo(null);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading checkout data:', error);
            setToast({ message: 'Erro ao carregar dados do checkout.', type: 'error' });
            setClients([]);
            setStaff([]);
            setServices([]);
            setProducts([]);
            setActivePromotions([]);
        }
        setLoading(false);
    }, [appSlug, comandaId, loadChefClubForClient, schema, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (comandaId) return;
        setPaymentStatus(checkoutEntryMode === 'open_comanda' ? 'pending' : 'paid');
    }, [checkoutEntryMode, comandaId]);

    useEffect(() => {
        if (comandaId || chefClubInfo || closureMode !== 'legacy_membership') return;
        setClosureMode('standard');
        setClosureNote('');
        setLegacyReferenceMonth('');
    }, [chefClubInfo, closureMode, comandaId]);

    useEffect(() => {
        if (!shouldCollectDiscountAudit || discountType !== 'barber_discount') return;
        if (discountResponsibleStaffId) return;
        if (assignedCommissionStaff.length === 1) {
            setDiscountResponsibleStaffId(assignedCommissionStaff[0].id);
        }
    }, [assignedCommissionStaff, discountResponsibleStaffId, discountType, shouldCollectDiscountAudit]);

    useEffect(() => {
        if (comandaId || !checkoutState?.fromAppointment || loading) return;

        if (checkoutState.appointmentId) {
            setRelatedAppointmentId(checkoutState.appointmentId);
        }

        if (!selectedClient) {
            const matchedClient =
                clients.find((client) => client.id === checkoutState.clientId) ||
                clients.find((client) =>
                    (checkoutState.clientName && client.name.toLowerCase() === checkoutState.clientName.toLowerCase())
                ) ||
                null;

            if (matchedClient) {
                setSelectedClient(matchedClient);
            }
        }

        if (cart.length === 0 && checkoutState.serviceName) {
            const matchedService = services.find((service) =>
                service.name === checkoutState.serviceName ||
                getCatalogDisplayName(service) === checkoutState.serviceName
            );

            if (matchedService) {
                const finalPrice = typeof checkoutState.price === 'number' && checkoutState.price > 0
                    ? checkoutState.price
                    : calculateItemPrice(matchedService, 'service');

                setCart([{
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'service',
                    name: getCatalogDisplayName(matchedService, checkoutState.serviceName),
                    internal_name: getCatalogInternalName(matchedService, checkoutState.serviceName),
                    display_name: getCatalogDisplayName(matchedService, checkoutState.serviceName),
                    description: matchedService.description || '',
                    price: finalPrice,
                    quantity: 1,
                    service_id: matchedService.id,
                    staff_id: checkoutState.staffId || '',
                }]);
            }
        }
    }, [
        cart.length,
        checkoutState,
        clients,
        comandaId,
        loading,
        selectedClient,
        services,
    ]);

    // Calculations
    const appliedCreditsCount = cart.filter(item => item.usedCredit).length;

    // Duplicate client check
    const handleSelectClient = async (client: Client) => {
        setIsClientModalOpen(false);
        if (!tenantId) {
            setToast({ message: 'Tenant inválido para selecionar cliente.', type: 'error' });
            finishLockRef.current = false;
            return;
        }

        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug, 'checkout', ['barber']);
            const { tenantId: resolvedTenantId } = requireTenantContext({
                tenantId,
                appSlug: currentAppSlug,
                schema,
                table: 'comandas',
                operation: 'select checkout client',
            });
            const clientDb = getScopedClient('barber');

            if (!comandaId && supportsOpenComandaState) {
                const { data: openComandas, error: openComandasError } = await clientDb
                    .from('comandas')
                    .select('id, created_at, status')
                    .eq('client_id', client.id)
                    .eq('tenant_id', resolvedTenantId)
                    .in('status', ['open', 'blocked'])
                    .limit(1);

                if (openComandasError) throw openComandasError;

                if (openComandas && openComandas.length > 0) {
                    const existingComanda = openComandas[0];
                    if (existingComanda.status === 'blocked') {
                        setToast({ message: `Este cliente já tem uma comanda bloqueada para este dia.`, type: 'error' });
                        setPendingClient(null);
                        return;
                    }
                    setPendingClient(client);
                    setDuplicateComanda(existingComanda);
                    setShowDuplicateModal(true);
                    return;
                }
            }

            const targetClient = pendingClient || client;
            setSelectedClient(targetClient);
            await loadChefClubForClient(targetClient.id, resolvedTenantId);
        } catch (error) {
            console.error('Error selecting checkout client:', error);
            setToast({ message: 'Erro ao carregar dados do cliente.', type: 'error' });
        }
    };

    const handleConfirmDuplicate = async () => {
        // User chose to proceed anyway
        if (pendingClient) {
            setSelectedClient(pendingClient);
            if (tenantId) {
                try {
                    const currentAppSlug = ensureAppSupportsModule(appSlug, 'checkout', ['barber']);
                    const { tenantId: resolvedTenantId } = requireTenantContext({
                        tenantId,
                        appSlug: currentAppSlug,
                        schema,
                        table: 'comandas',
                        operation: 'confirm duplicate checkout client',
                    });
                    await loadChefClubForClient(pendingClient.id, resolvedTenantId);
                } catch (error) {
                    console.error('Error loading duplicate client club info:', error);
                    setToast({ message: 'Cliente selecionado, mas não foi possível carregar créditos do Clube.', type: 'info' });
                }
            }
        }
        setShowDuplicateModal(false);
        setDuplicateComanda(null);
        setPendingClient(null);
    };

    const handleGoToExisting = () => {
        setShowDuplicateModal(false);
        setDuplicateComanda(null);
        setPendingClient(null);
        if (duplicateComanda) navigate(`/checkout/${duplicateComanda.id}`);
    };

    const fetchQuickOpenComandas = useCallback(async () => {
        if (!tenantId) {
            setQuickOpenComandaError('Tenant inválido para buscar comandas abertas.');
            return;
        }

        setLoadingQuickOpenComandas(true);
        setQuickOpenComandaError(null);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug, 'checkout', ['barber']);
            const { tenantId: resolvedTenantId } = requireTenantContext({
                tenantId,
                appSlug: currentAppSlug,
                schema,
                table: 'comandas',
                operation: 'quick search open comandas',
            });
            const clientDb = getScopedClient('barber');
            const { data, error } = await clientDb
                .from('comandas')
                .select('id, client_id, created_at, status, total')
                .eq('tenant_id', resolvedTenantId)
                .in('status', ['open', 'blocked'])
                .order('created_at', { ascending: false })
                .limit(40);

            if (error) throw error;
            const comandas = (data || []) as QuickOpenComanda[];
            const clientIds = Array.from(new Set(comandas.map((comanda) => comanda.client_id).filter(Boolean))) as string[];
            const { data: clientRows, error: clientError } = clientIds.length > 0
                ? await clientDb
                    .from('clients')
                    .select('id, name, phone')
                    .eq('tenant_id', resolvedTenantId)
                    .in('id', clientIds)
                : { data: [] as { id: string; name?: string | null; phone?: string | null }[], error: null };

            if (clientError) {
                console.warn('Não foi possível carregar clientes das comandas abertas:', clientError);
            }

            const clientsById = ((clientRows || []) as { id: string; name?: string | null; phone?: string | null }[]).reduce((acc, client) => {
                acc[client.id] = { name: client.name || 'Cliente não identificado', phone: client.phone || null };
                return acc;
            }, {} as Record<string, { name: string; phone: string | null }>);

            setQuickOpenComandas(comandas.map((comanda) => ({
                ...comanda,
                clients: comanda.client_id ? clientsById[comanda.client_id] || null : null,
            })));
        } catch (error) {
            console.error('Erro ao buscar comandas abertas no checkout:', error);
            setQuickOpenComandaError('Não foi possível carregar as comandas abertas. Tente novamente.');
        } finally {
            setLoadingQuickOpenComandas(false);
        }
    }, [appSlug, schema, tenantId]);

    const openQuickComandaSearch = () => {
        setIsOpenComandaModalOpen(true);
        setOpenComandaSearchTerm('');
        void fetchQuickOpenComandas();
    };

    const filteredQuickOpenComandas = useMemo(() => {
        const query = openComandaSearchTerm.trim().toLowerCase();
        if (!query) return quickOpenComandas;

        return quickOpenComandas.filter((comanda) => {
            const client = getQuickComandaClient(comanda);
            const shortId = comanda.id.slice(0, 8).toLowerCase();
            return client.name.toLowerCase().includes(query)
                || (client.phone || '').toLowerCase().includes(query)
                || comanda.id.toLowerCase().includes(query)
                || shortId.includes(query)
                || comanda.status.toLowerCase().includes(query);
        });
    }, [openComandaSearchTerm, quickOpenComandas]);

    // Handlers
    const calculateItemPrice = (item: any, type: 'service' | 'product') => {
        let basePrice = Number(item.price ?? item.sale_price ?? 0);
        if (isNaN(basePrice)) return 0;

        // Find applicable promotion
        const promo = activePromotions.find(p =>
            (p.target_type === 'all') ||
            (p.target_type === 'service' && type === 'service' && p.target_id === item.id) ||
            (p.target_type === 'product' && type === 'product' && p.target_id === item.id)
        );

        if (promo) {
            if (promo.discount_type === 'fixed') {
                return Math.max(0, basePrice - promo.discount_value);
            } else {
                return basePrice * (1 - (promo.discount_value / 100));
            }
        }

        return basePrice;
    };

    const addCartItem = (item: any, type: 'service' | 'product', finalPrice: number, shouldUseCredit: boolean) => {
        const internalName = getCatalogInternalName(item);
        const displayName = getCatalogDisplayName(item);
        const newItem: CartItem = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            name: displayName,
            internal_name: internalName,
            display_name: displayName,
            description: item.description || '',
            price: shouldUseCredit ? 0 : finalPrice,
            quantity: 1,
            service_id: type === 'service' ? item.id : undefined,
            product_id: type === 'product' ? item.id : undefined,
            staff_id: staff.length > 0 ? staff[0].id : '',
            usedCredit: shouldUseCredit
        };

        if (shouldUseCredit) {
            setToast({ message: 'Crédito aplicado automaticamente neste item. Você pode ajustar manualmente se quiser.', type: 'info' });
        }

        setCart((currentCart) => [...currentCart, newItem]);
        setSearchTerm('');
        setIsItemModalOpen(false);
    };

    const handleAddItem = (item: any, type: 'service' | 'product') => {
        const finalPrice = calculateItemPrice(item, type);
        const canSuggestCredit = type === 'service' && !!chefClubInfo;
        const creditsForService = canSuggestCredit
            ? getAvailableCreditsForService(chefClubInfo?.serviceBalances || [], item.id)
            : 0;
        const usedCreditsForService = cart.filter((cartItem) => cartItem.usedCredit && cartItem.service_id === item.id).length;
        const hasCreditsAvailable = canSuggestCredit && usedCreditsForService < creditsForService;

        if (hasCreditsAvailable) {
            setPendingCreditItem({ item, type, finalPrice });
            return;
        }

        addCartItem(item, type, finalPrice, false);
    };

    const handleResolveCreditSuggestion = (shouldUseCredit: boolean) => {
        if (!pendingCreditItem) return;
        const { item, type, finalPrice } = pendingCreditItem;
        setPendingCreditItem(null);
        addCartItem(item, type, finalPrice, shouldUseCredit);
    };

    const handleRemoveItem = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const handleOpenQuickProductModal = () => {
        setQuickProductForm(createInitialQuickProductForm());
        setIsQuickProductModalOpen(true);
    };

    const handleOpenQuickServiceModal = () => {
        setQuickServiceForm(createInitialQuickServiceForm(searchTerm.trim()));
        setIsQuickServiceModalOpen(true);
    };

    const handleCloseQuickProductModal = () => {
        if (isSavingQuickProduct) return;
        setIsQuickProductModalOpen(false);
        setQuickProductForm(createInitialQuickProductForm());
    };

    const handleCloseQuickServiceModal = () => {
        if (isSavingQuickService) return;
        setIsQuickServiceModalOpen(false);
        setQuickServiceForm(createInitialQuickServiceForm());
    };

    const handleCreateProductDuringCheckout = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!tenantId) {
            setToast({ message: 'Tenant inválido para cadastrar produto.', type: 'error' });
            return;
        }

        setIsSavingQuickProduct(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug, 'products', ['barber']);
            const { tenantId: resolvedTenantId } = requireTenantContext({
                tenantId,
                appSlug: currentAppSlug,
                schema,
                table: 'products',
                operation: 'create product during checkout',
            });
            const client = getScopedClient('barber');

            const payload = {
                tenant_id: resolvedTenantId,
                name: quickProductForm.name.trim(),
                commercial_name: quickProductForm.commercial_name.trim() || null,
                description: quickProductForm.description.trim(),
                cost_price: Number(quickProductForm.cost_price) || 0,
                sale_price: Number(quickProductForm.sale_price) || 0,
                stock_quantity: parseInt(quickProductForm.stock_quantity, 10) || 0,
                minimum_stock: parseInt(quickProductForm.minimum_stock, 10) || 0,
                auto_generate_purchase_order: quickProductForm.auto_generate_purchase_order,
                active: true,
            };

            const { data: createdProduct, error } = await client
                .from('products')
                .insert([payload])
                .select('*')
                .single();

            if (error) throw error;

            setProducts(prev => {
                const nextProducts = [...prev, createdProduct];
                nextProducts.sort((a, b) => getCatalogDisplayName(a).localeCompare(getCatalogDisplayName(b), 'pt-BR'));
                return nextProducts;
            });

            setToast({ message: 'Produto criado e adicionado a venda.', type: 'success' });
            handleAddItem(createdProduct, 'product');
            setQuickProductForm(createInitialQuickProductForm());
            setIsQuickProductModalOpen(false);
        } catch (error) {
            console.error('Error creating product during checkout:', error);
            setToast({ message: 'Erro ao cadastrar produto durante a venda.', type: 'error' });
        } finally {
            setIsSavingQuickProduct(false);
        }
    };

    const handleCreateServiceDuringCheckout = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!tenantId) {
            setToast({ message: 'Tenant inválido para cadastrar serviço.', type: 'error' });
            return;
        }

        setIsSavingQuickService(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug, 'services', ['barber']);
            const { tenantId: resolvedTenantId } = requireTenantContext({
                tenantId,
                appSlug: currentAppSlug,
                schema,
                table: 'services',
                operation: 'create service during checkout',
            });
            const client = getScopedClient('barber');

            const payload = {
                tenant_id: resolvedTenantId,
                name: quickServiceForm.name.trim(),
                commercial_name: quickServiceForm.commercial_name.trim() || null,
                description: quickServiceForm.description.trim() || null,
                category: quickServiceForm.category,
                price: Number(quickServiceForm.price) || 0,
                duration: parseInt(quickServiceForm.duration, 10) || 30,
                active: quickServiceForm.active,
            };

            const { data: createdService, error } = await client
                .from('services')
                .insert([payload])
                .select('*')
                .single();

            if (error) throw error;

            setServices(prev => {
                const nextServices = [...prev, createdService];
                nextServices.sort((a, b) => getCatalogDisplayName(a).localeCompare(getCatalogDisplayName(b), 'pt-BR'));
                return nextServices;
            });

            setToast({ message: 'Serviço criado e adicionado à venda.', type: 'success' });
            handleAddItem(createdService, 'service');
            setQuickServiceForm(createInitialQuickServiceForm());
            setIsQuickServiceModalOpen(false);
        } catch (error) {
            console.error('Error creating service during checkout:', error);
            setToast({ message: 'Erro ao cadastrar serviço durante a venda.', type: 'error' });
        } finally {
            setIsSavingQuickService(false);
        }
    };

    const handleStaffChange = (itemId: string, proId: string) => {
        setCart(cart.map(item => item.id === itemId ? { ...item, staff_id: proId } : item));
    };

    const handlePriceChange = (itemId: string, newPrice: string) => {
        const floatPrice = parseFloat(newPrice);
        setCart(cart.map(item => item.id === itemId ? { ...item, price: isNaN(floatPrice) ? 0 : floatPrice } : item));
    };

    const calculateParticipantPayout = (itemUnitPrice: number, participant: CartParticipant): number => {
        if (participant.payout_type === 'percentage') {
            return itemUnitPrice * normalizePercentageValue(participant.payout_value);
        }
        return participant.payout_value;
    };

    const calculateTotalPayouts = (itemUnitPrice: number, participants: CartParticipant[]): number => {
        return participants
            .filter(p => p.affects_commission)
            .reduce((sum, p) => sum + calculateParticipantPayout(itemUnitPrice, p), 0);
    };

    const addParticipant = (itemId: string, professionalId: string, professionalName: string, role: ExecutionRole, payoutType: PayoutType, payoutValue: number) => {
        setCart(cart.map(item => {
            if (item.id !== itemId) return item;
            
            const existingParticipants = item.execution_participants || [];
            if (existingParticipants.some((participant) => participant.professional_id === professionalId)) {
                setToast({ message: 'Este profissional já participa deste serviço.', type: 'info' });
                return item;
            }
            const isPrimary = role === 'primary';
            
            const newParticipant: CartParticipant = {
                id: `temp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                professional_id: professionalId,
                professional_name: professionalName,
                role,
                payout_type: payoutType,
                payout_value: payoutValue,
                affects_revenue: isPrimary,
                affects_commission: true,
            };
            
            if (isPrimary) {
                const updatedParticipants = existingParticipants.map(p => ({ ...p, affects_revenue: false, role: 'assistant' as ExecutionRole }));
                return { ...item, execution_participants: [...updatedParticipants, newParticipant] };
            }
            
            return { ...item, execution_participants: [...existingParticipants, newParticipant] };
        }));
    };

    const removeParticipant = (itemId: string, participantId: string) => {
        setCart(cart.map(item => {
            if (item.id !== itemId) return item;
            const participants = (item.execution_participants || []).filter(p => p.id !== participantId);
            
            if (participants.length === 0) {
                const { execution_participants: _, ...itemWithoutParticipants } = item;
                return itemWithoutParticipants;
            }
            
            return { ...item, execution_participants: participants };
        }));
    };

    const updateParticipant = (itemId: string, participantId: string, updates: Partial<CartParticipant>) => {
        setCart(cart.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                execution_participants: (item.execution_participants || []).map(p => 
                    p.id === participantId ? { ...p, ...updates } : p
                )
            };
        }));
    };

    const handleFinish = async () => {
        if (finishLockRef.current) return;
        finishLockRef.current = true;
        if (!selectedClient) {
            setToast({ message: checkoutCopy.clientRequiredError, type: 'error' });
            finishLockRef.current = false;
            return;
        }
        if (cart.length === 0) {
            setToast({ message: checkoutCopy.itemRequiredError, type: 'error' });
            finishLockRef.current = false;
            return;
        }
        if (isLegacyClubSettlement && !canCloseWithAdministrativeOrigin) {
            setToast({ message: 'Baixa administrativa exige permissão de gerente, admin ou superadmin.', type: 'error' });
            finishLockRef.current = false;
            return;
        }
        if (isLegacyClubSettlement && !legacyReferenceMonth) {
            setToast({ message: 'Informe o mes de referencia para a baixa administrativa do Clube.', type: 'info' });
            finishLockRef.current = false;
            return;
        }
        if (isLegacyClubSettlement && !closureNote.trim()) {
            setToast({ message: 'Informe o motivo obrigatório para a baixa administrativa.', type: 'error' });
            finishLockRef.current = false;
            return;
        }
        if (isZeroPaidCheckout) {
            if (zeroCloseOrigin === 'club_credit' && !canCloseWithClubCredit) {
                setToast({ message: 'Comanda zero só pode fechar por crédito quando há crédito do Clube aplicado e disponível.', type: 'error' });
                finishLockRef.current = false;
                return;
            }
            if (zeroCloseOrigin === 'administrative_adjustment' && !canCloseWithAdministrativeOrigin) {
                setToast({ message: 'Baixa administrativa zero exige permissão de gerente, admin ou superadmin.', type: 'error' });
                finishLockRef.current = false;
                return;
            }
            if ((zeroCloseOrigin === 'house_courtesy' || zeroCloseOrigin === 'administrative_adjustment') && !zeroCloseReason.trim()) {
                setToast({ message: 'Informe o motivo obrigatório para fechar comanda zero.', type: 'error' });
                finishLockRef.current = false;
                return;
            }
        }
        let discountAuditDraft: DiscountAuditDraft | null = null;
        if (shouldCollectDiscountAudit) {
            if (discountType === 'barber_discount' && !discountResponsibleStaffId) {
                setToast({ message: 'Selecione o barbeiro responsável pelo desconto.', type: 'error' });
                finishLockRef.current = false;
                return;
            }
            if (!discountReasonNote.trim()) {
                setToast({ message: 'Informe uma observação para auditar o desconto.', type: 'error' });
                finishLockRef.current = false;
                return;
            }

            discountAuditDraft = {
                amount: discountValue,
                type: discountType,
                reasonType: discountReasonType,
                reasonNote: discountReasonNote.trim(),
                responsibleStaffId: discountType === 'barber_discount' ? discountResponsibleStaffId : null,
                responsibleStaffName: discountType === 'barber_discount' ? discountResponsibleStaff?.name : null,
                commissionImpact: 'pending_review',
            };
        }
        if (!tenantId) {
            setToast({ message: 'Tenant inválido para finalizar operação.', type: 'error' });
            finishLockRef.current = false;
            return;
        }

        setLoading(true);
        try {
            const currentAppSlug = ensureAppSupportsModule(appSlug, 'checkout', ['barber']);
            const { tenantId: resolvedTenantId } = requireTenantContext({
                tenantId,
                appSlug: currentAppSlug,
                schema,
                table: 'comandas',
                operation: 'finish checkout',
            });
            const client = getScopedClient('barber');
            let currentComandaId = comandaId;
            const assignedStaffIds = Array.from(new Set(cart.map(item => item.staff_id).filter(Boolean))) as string[];
            const comandaStaffId = assignedStaffIds.length === 1 ? assignedStaffIds[0] : null;
            const shouldSettleViaRpc = paymentStatus === 'paid' && !isLegacyClubSettlement && !shouldSettleZeroWithAudit;
            const shouldCloseAfterComandaSync = shouldSettleViaRpc || shouldSettleZeroWithAudit;
            const paymentDateReal = new Date().toISOString();
            const discountAuditNote = discountAuditDraft ? formatDiscountAuditNote(discountAuditDraft) : null;
            const legacyClosureAuditNote = isLegacyClubSettlement
                ? buildZeroCloseAuditNote({
                    origin: 'administrative_adjustment',
                    source: 'checkout',
                    authorizedBy: user?.id || null,
                    userId: user?.id || null,
                    reason: closureNote.trim(),
                })
                : null;
            const settlementNotes = [
                paymentMethod === 'other' && paymentDescription ? `Forma de pagamento: ${paymentDescription}` : null,
                discountAuditNote,
            ].filter(Boolean).join('\n\n') || null;

            if (paymentStatus === 'paid' && relatedAppointmentId) {
                const [{ data: appointmentForSettlement }, { data: comandaForSettlement }] = await Promise.all([
                    client
                        .from('appointments')
                        .select('id, start_time')
                        .eq('id', relatedAppointmentId)
                        .eq('tenant_id', resolvedTenantId)
                        .maybeSingle(),
                    currentComandaId
                        ? client
                            .from('comandas')
                            .select('id, created_at')
                            .eq('id', currentComandaId)
                            .eq('tenant_id', resolvedTenantId)
                            .maybeSingle()
                        : client
                            .from('comandas')
                            .select('id, created_at')
                            .eq('appointment_id', relatedAppointmentId)
                            .eq('tenant_id', resolvedTenantId)
                            .maybeSingle(),
                ]);

                if (
                    isBeforeTodayLocal(appointmentForSettlement?.start_time) ||
                    isCreatedAfterAppointmentDay(comandaForSettlement?.created_at, appointmentForSettlement?.start_time)
                ) {
                    setToast({ message: DIRECT_SETTLEMENT_BLOCK_MESSAGE, type: 'error' });
                    return;
                }
            }

            // 1. Create or Update Comanda
            const comandaData: any = {
                client_id: selectedClient.id,
                staff_id: comandaStaffId,
                appointment_id: relatedAppointmentId,
                status: shouldCloseAfterComandaSync ? 'open' : (paymentStatus === 'paid' ? 'paid' : 'open'),
                total: total,
                discount: discountValue,
                payment_method: shouldCloseAfterComandaSync ? null : (paymentStatus === 'paid' ? paymentMethod : null),
                closure_mode: paymentStatus === 'paid' ? closureMode : 'standard',
                closure_note: paymentStatus === 'paid' && isLegacyClubSettlement ? legacyClosureAuditNote : null,
                financial_effect: paymentStatus === 'paid' ? shouldApplyFinancialEffects : true,
                membership_credit_effect: paymentStatus === 'paid' ? shouldDeductMembershipCredits : true,
                legacy_reference_month: paymentStatus === 'paid' && isLegacyClubSettlement
                    ? `${legacyReferenceMonth}-01`
                    : null,
                closed_at: shouldCloseAfterComandaSync ? null : (paymentStatus === 'paid' ? paymentDateReal : null),
                tenant_id: resolvedTenantId
            };

            if (currentComandaId) {
                const { error: updateError } = await client
                    .from('comandas')
                    .update(comandaData)
                    .eq('id', currentComandaId)
                    .eq('tenant_id', resolvedTenantId);
                if (updateError) throw updateError;
                // Delete existing items to re-insert (simple sync strategy)
                const { error: delError } = await client
                    .from('comanda_items')
                    .delete()
                    .eq('comanda_id', currentComandaId)
                    .eq('tenant_id', resolvedTenantId);
                if (delError) throw delError;
            } else {
                let existingComanda: { id: string } | null = null;

                if (relatedAppointmentId) {
                    const { data } = await client
                        .from('comandas')
                        .select('id')
                        .eq('tenant_id', resolvedTenantId)
                        .eq('appointment_id', relatedAppointmentId)
                        .limit(1)
                        .maybeSingle();
                    existingComanda = data;
                }

                if (!existingComanda && paymentStatus === 'pending') {
                    const { data } = await client
                        .from('comandas')
                        .select('id')
                        .eq('tenant_id', resolvedTenantId)
                        .eq('client_id', selectedClient.id)
                        .eq('status', 'open')
                        .limit(1)
                        .maybeSingle();
                    existingComanda = data;
                }

                if (existingComanda) {
                    currentComandaId = existingComanda.id;
                    const { error: syncError } = await client
                        .from('comandas')
                        .update(comandaData)
                        .eq('id', currentComandaId)
                        .eq('tenant_id', resolvedTenantId);
                    if (syncError) throw syncError;

                    const { error: delError } = await client
                        .from('comanda_items')
                        .delete()
                        .eq('comanda_id', currentComandaId)
                        .eq('tenant_id', resolvedTenantId);
                    if (delError) throw delError;
                } else {
                    const { data: newC, error: insertError } = await client
                        .from('comandas')
                        .insert({ ...comandaData, idempotency_key: comandaRequestKeyRef.current })
                        .select()
                        .single();

                    if (insertError) {
                        if (insertError.code === '23505') {
                            const { data: duplicatedComanda } = await client
                                .from('comandas')
                                .select('id')
                                .eq('tenant_id', resolvedTenantId)
                                .eq('idempotency_key', comandaRequestKeyRef.current)
                                .limit(1)
                                .maybeSingle();

                            if (!duplicatedComanda) throw insertError;
                            currentComandaId = duplicatedComanda.id;
                        } else {
                            throw insertError;
                        }
                    } else {
                        currentComandaId = newC.id;
                    }
                }
            }

            // 2. Insert Items
            const itemsToInsert = cart.map(item => ({
                comanda_id: currentComandaId,
                service_id: item.service_id || null,
                product_id: item.product_id || null,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                staff_id: item.staff_id || null,
                tenant_id: resolvedTenantId
            }));

            const { data: insertedItems, error: itemsError } = await client.from('comanda_items').insert(itemsToInsert).select('id');
            if (itemsError) throw itemsError;

            // 3. Insert execution participants if any
            if (insertedItems && insertedItems.length > 0) {
                const allParticipantsToInsert: any[] = [];
                
                cart.forEach((item, index) => {
                    const itemId = insertedItems[index]?.id;
                    if (!itemId) return;
                    
                    const participants = item.execution_participants || [];
                    
                    if (participants.length > 0) {
                        participants.forEach(p => {
                            allParticipantsToInsert.push({
                                comanda_item_id: itemId,
                                staff_id: p.professional_id,
                                role: p.role,
                                payout_type: p.payout_type,
                                payout_value: p.payout_value,
                                affects_revenue: p.affects_revenue,
                                affects_commission: p.affects_commission,
                                tenant_id: resolvedTenantId
                            });
                        });
                    } else if (item.staff_id) {
                        allParticipantsToInsert.push({
                            comanda_item_id: itemId,
                            staff_id: item.staff_id,
                            role: 'primary',
                            payout_type: 'percentage',
                            // payout_value represents service participation, not the barber commission rate.
                            payout_value: 100,
                            affects_revenue: true,
                            affects_commission: true,
                            tenant_id: resolvedTenantId
                        });
                    }
                });

                if (allParticipantsToInsert.length > 0) {
                    const { error: participantsError } = await client.from('service_execution_participants').insert(allParticipantsToInsert);
                    if (participantsError) {
                        console.warn('Error inserting execution participants:', participantsError);
                    }
                }
            }

            // 4. If PAID, mark comanda as paid
            if (shouldSettleViaRpc) {
                await settleCheckoutComanda({
                    client: selectedClient,
                    comandaId: currentComandaId,
                    appointmentId: relatedAppointmentId,
                    tenantId: resolvedTenantId,
                    supabase,
                    clientDb: client,
                    paymentMethod,
                    paidAmount: total,
                    paymentDateReal,
                    source: 'checkout',
                    notes: settlementNotes,
                    idempotencyKey: `finance-settle-${currentComandaId}-${comandaRequestKeyRef.current}`,
                    incomeCategory,
                    description: paymentMethod === 'other' && paymentDescription
                        ? `${checkoutCopy.title} - Cliente: ${selectedClient.name} (${paymentDescription})`
                        : `${checkoutCopy.title} - Cliente: ${selectedClient.name}`,
                    shouldApplyFinancialEffects,
                    closure: {
                        mode: closureMode,
                        note: isLegacyClubSettlement ? (closureNote.trim() || null) : null,
                        financialEffect: shouldApplyFinancialEffects,
                        membershipCreditEffect: shouldDeductMembershipCredits,
                        legacyReferenceMonth: isLegacyClubSettlement ? `${legacyReferenceMonth}-01` : null,
                    },
                    clientStats: {
                        lastService: cart.length > 0 ? cart[0].name : '',
                    },
                });
            }

            // 5. Deduct Chef Club Credits if used
            if (shouldSettleZeroWithAudit) {
                await closeZeroAmountComanda({
                    comandaId: currentComandaId,
                    tenantId: resolvedTenantId,
                    supabase: client,
                    origin: zeroCloseOrigin,
                    source: 'checkout',
                    authorizedBy: user?.id || null,
                    userId: user?.id || null,
                    reason: zeroCloseOrigin === 'club_credit'
                        ? `Crédito do Clube consumido no checkout: ${creditItems.length} serviço(s).`
                        : zeroCloseReason.trim(),
                    legacyReferenceMonth: zeroCloseOrigin === 'administrative_adjustment' && legacyReferenceMonth
                        ? `${legacyReferenceMonth}-01`
                        : null,
                });
            }

            if (shouldDeductMembershipCredits && creditItems.length > 0 && chefClubInfo) {
                for (const creditItem of creditItems) {
                    const { error: creditErr } = await client.rpc('deduct_chef_club_credits', {
                        p_subscription_id: chefClubInfo.id,
                        p_service_id: creditItem.service_id,
                        p_amount: 1,
                        p_reference: `Comanda #${currentComandaId} - ${creditItem.name}`,
                    });

                    if (creditErr) {
                        console.error('Error deducting credits:', creditErr);
                    }
                }
            }

            setToast({
                message: isLegacyClubSettlement
                    ? 'Comanda baixada no modo administrativo do Clube sem impactar financeiro nem créditos atuais.'
                    : paymentStatus === 'paid'
                        ? checkoutCopy.successPaid
                        : checkoutCopy.successOpen,
                type: 'success'
            });

            if (paymentStatus === 'paid' && !isLegacyClubSettlement) {
                navigate('/operation-success', {
                    state: {
                        operationType: 'comanda',
                        comanda: {
                            id: currentComandaId,
                            client: selectedClient.name,
                            total,
                            paymentMethod,
                            itemsCount: cart.length,
                            status: 'paid',
                        },
                    },
                    replace: true,
                });
            } else {
                setTimeout(() => {
                    if (checkoutEntryMode === 'pdv' && !comandaId && !isLegacyClubSettlement) {
                        resetOperationalState();
                    }
                    navigate(checkoutCopy.redirectPath, { replace: true });
                }, 1500);
            }

        } catch (err: any) {
            console.error('Save error details:', err);
            setToast({ message: err?.message ? `Erro: ${err.message}` : 'Erro ao salvar operação.', type: 'error' });
        } finally {
            finishLockRef.current = false;
            setLoading(false);
        }
    };

    const normalizedItemSearch = searchTerm.trim().toLowerCase();
    const filteredItems = itemModalTab === 'services'
        ? services.filter(s => getCatalogSearchText(s).includes(normalizedItemSearch))
        : products.filter(p => getCatalogSearchText(p).includes(normalizedItemSearch));

    return (
        <div className="max-w-7xl mx-auto w-full animate-fade-in pb-20">
            {/* Header */}
            <div className="mb-6 rounded-3xl border border-[#D9EAF5] bg-[#EAF7FF]/70 p-5 shadow-sm dark:border-[#14304A] dark:bg-[#071426]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="size-12 rounded-2xl bg-gradient-to-br from-[#00D2FF] to-[#007BFF] text-white shadow-[0_0_28px_rgba(0,210,255,0.22)] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-3xl">point_of_sale</span>
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase text-[#007BFF] dark:text-[#00D2FF]">
                                {checkoutEntryMode === 'edit_comanda' ? 'Fechamento da cadeira' : checkoutEntryMode === 'open_comanda' ? 'Comanda em atendimento' : 'Balcao da barbearia'}
                            </p>
                            <h1 className="mt-1 text-3xl font-black text-[#003366] dark:text-white flex items-center gap-2">
                                {checkoutCopy.title}
                            </h1>
                            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{checkoutCopy.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <span className="rounded-xl border border-[#00D2FF]/30 bg-white/80 px-3 py-2 text-xs font-bold text-[#003366] dark:bg-[#0B1828] dark:text-[#EAF7FF]">
                            {checkoutCopy.orderLabel}: #{comandaId ? comandaId.slice(0, 8) : 'NOVO'}
                        </span>
                        <span className={`rounded-xl px-3 py-2 text-xs font-bold ${selectedClient ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                            {selectedClient ? 'Cliente selecionado' : 'Cliente pendente'}
                        </span>
                        <span className={`rounded-xl px-3 py-2 text-xs font-bold ${cart.length > 0 ? 'bg-[#007BFF]/10 text-[#007BFF] dark:text-[#00D2FF]' : 'bg-slate-500/10 text-slate-500 dark:text-slate-300'}`}>
                            {cart.length} {cart.length === 1 ? 'item' : 'itens'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">

                {/* LEFT COLUMN: Client & Cart */}
                <div className="md:col-span-2 space-y-4 lg:space-y-6">

                    {/* 1. Client Selection */}
                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-[#D9EAF5] dark:border-[#14304A] p-4 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="size-10 bg-[#EAF7FF] dark:bg-[#0D2238] rounded-xl flex items-center justify-center shrink-0 border border-[#00D2FF]/25">
                                <span className="material-symbols-outlined text-[#007BFF] dark:text-[#00D2FF]">person</span>
                            </div>
                            {selectedClient ? (
                                <div className="flex-1 flex items-center gap-3">
                                    <img src={selectedClient.avatar} alt={selectedClient.name} className="size-10 rounded-full border border-slate-200 dark:border-slate-700" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{selectedClient.name}</p>
                                        <p className="text-xs text-slate-500">{selectedClient.phone || 'Sem telefone'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{checkoutCopy.clientEmptyTitle}</p>
                                    <p className="text-xs text-slate-500">{checkoutCopy.clientEmptyHelper}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                            {!comandaId && (
                                <button
                                    onClick={openQuickComandaSearch}
                                    className="px-3 py-2 bg-[#F7FBFE] text-[#003366] hover:bg-[#EAF7FF] border border-[#D9EAF5] dark:bg-[#0B1828] dark:border-[#14304A] dark:text-slate-300 dark:hover:bg-[#102033] rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                    title="Buscar uma comanda aberta sem sair do Checkout"
                                >
                                    <span className="material-symbols-outlined text-sm">manage_search</span>
                                    Comandas abertas
                                </button>
                            )}
                            {!selectedClient ? (
                                <button
                                    onClick={() => setIsClientModalOpen(true)}
                                    className="px-4 py-2 bg-[#007BFF] text-white hover:bg-[#003366] rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-[0_8px_22px_rgba(0,123,255,0.20)]"
                                >
                                    <span className="material-symbols-outlined text-sm">search</span>
                                    Buscar
                                </button>
                            ) : (
                                !comandaId && (
                                    <button
                                        onClick={() => setSelectedClient(null)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center"
                                        title="Remover cliente"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                )
                            )}
                        </div>
                    </div>

                    {/* 2. Cart Items */}
                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-[#D9EAF5] dark:border-[#14304A] p-6 shadow-sm min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#007BFF] dark:text-[#00D2FF]">shopping_cart</span>
                                {checkoutCopy.itemSectionTitle}
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setItemModalTab('services'); setIsItemModalOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#EAF7FF] text-[#007BFF] hover:bg-[#007BFF] hover:text-white rounded-lg text-xs font-bold transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm">content_cut</span>
                                    + Serviço
                                </button>
                                <button
                                    onClick={() => { setItemModalTab('products'); setIsItemModalOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition-all"
                                >
                                    <span className="material-symbols-outlined text-sm">shopping_bag</span>
                                    + Produto
                                </button>
                            </div>
                        </div>

                        <div className="flex-1">
                            {cart.length > 0 ? (
                                <div className="space-y-3">
                                    {cart.map((item) => (
                                        <div key={item.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 dark:border-border-dark bg-white dark:bg-background-dark group hover:border-[#00D2FF]/35 transition-all">
                                            {/* Icon */}
                                            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'service' ? 'bg-[#EAF7FF] text-[#007BFF] dark:bg-[#0D2238] dark:text-[#00D2FF]' : 'bg-amber-500/10 text-amber-500'}`}>
                                                <span className="material-symbols-outlined">{item.type === 'service' ? 'content_cut' : 'package_2'}</span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{item.display_name || item.name}</p>
                                                {item.internal_name && item.internal_name !== item.name && (
                                                    <p className="text-[10px] font-semibold text-slate-400 truncate">Interno: {item.internal_name}</p>
                                                )}

                                                {/* Professional Selector (Commission logic) */}
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">Responsável:</span>
                                                    <select
                                                        value={item.staff_id || ''}
                                                        onChange={(e) => handleStaffChange(item.id, e.target.value)}
                                                        className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 border-none outline-none p-0 cursor-pointer hover:text-[#007BFF] [color-scheme:light] dark:[color-scheme:dark]"
                                                    >
                                                        <option value="" className="bg-white dark:bg-[#1A1A1A] text-slate-400">Nenhum</option>
                                                        {staff.map(pro => (
                                                            <option key={pro.id} value={pro.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{pro.name}</option>
                                                        ))}
                                                    </select>
                                                    {item.type === 'service' && (
                                                        <button
                                                            onClick={() => { setSharedExecutionItemId(item.id); setIsSharedExecutionModalOpen(true); }}
                                                            className={`ml-1 inline-flex items-center gap-1 rounded px-1.5 py-1 transition-all ${isSharedExecution(item) ? 'bg-[#EAF7FF] text-[#007BFF] dark:bg-[#0D2238] dark:text-[#00D2FF]' : 'text-slate-400 hover:text-[#007BFF] hover:bg-[#EAF7FF]'}`}
                                                            title="Execução compartilhada"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">group_add</span>
                                                            <span className="text-[10px] font-black uppercase">
                                                                {isSharedExecution(item) ? 'Compartilhado' : 'Compartilhar'}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Shared Execution Preview */}
                                                {(item.execution_participants?.length ?? 0) > 0 && (
                                                    <div className="mt-2 p-2 rounded bg-slate-50 dark:bg-white/5 space-y-1">
                                                        <p className="text-[9px] text-slate-500 uppercase font-bold">Rateio</p>
                                                        {item.execution_participants?.map(p => (
                                                            <div key={p.id} className="flex justify-between text-[10px]">
                                                                <span className="text-slate-600 dark:text-slate-300">
                                                                    {p.professional_name || 'Profissional'} ({p.role === 'primary' ? 'Principal' : p.role === 'assistant' ? 'Apoio' : 'Coexec.'})
                                                                </span>
                                                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                    R$ {calculateParticipantPayout(item.price, p).toFixed(2)}
                                                                    {p.payout_type === 'percentage' && ` (${formatPayoutValue(p)})`}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Price */}
                                            <div className="text-right flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-1">
                                                    {activePromotions.some(p =>
                                                        (p.target_type === 'all') ||
                                                        (p.target_type === 'service' && item.type === 'service' && p.target_id === item.service_id) ||
                                                        (p.target_type === 'product' && item.type === 'product' && p.target_id === item.product_id)
                                                    ) && (
                                                            <span className="bg-rose-500 text-white text-[9px] font-black px-1 rounded mr-1 animate-pulse">PROMO</span>
                                                        )}
                                                    <span className="text-sm font-bold text-slate-500">R$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.price}
                                                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                                        className="w-20 text-right bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-border-dark rounded px-2 py-1 text-sm font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                                    />
                                                </div>
                                                {item.quantity > 1 && <p className="text-xs text-slate-500">x{item.quantity}</p>}
                                                {item.type === 'service' && chefClubInfo && getAvailableCreditsForService(chefClubInfo.serviceBalances, item.service_id) > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            const isUsed = !(item as any).usedCredit;
                                                            const currentUsedForService = cart.filter(c => c.usedCredit && c.service_id === item.service_id && c.id !== item.id).length;
                                                            const availableForService = getAvailableCreditsForService(chefClubInfo.serviceBalances, item.service_id);
                                                            if (isUsed && currentUsedForService >= availableForService) {
                                                                setToast({ message: 'Sem créditos suficientes para aplicar em mais serviços.', type: 'error' });
                                                                return;
                                                            }
                                                            setCart(cart.map(c => c.id === item.id ? { ...c, usedCredit: isUsed, price: isUsed ? 0 : calculateItemPrice(services.find(s => s.id === item.service_id), 'service') } : c));
                                                        }}
                                                        className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all ${(item as any).usedCredit ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-xs">workspace_premium</span>
                                                        {(item as any).usedCredit ? 'Usando Crédito' : 'Usar Crédito'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Remove Action */}
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9EAF5] bg-[#F7FBFE] text-slate-500 dark:border-[#14304A] dark:bg-[#0B1828] p-8 text-center">
                                    <span className="material-symbols-outlined text-5xl mb-4 text-[#007BFF] dark:text-[#00D2FF]">content_cut</span>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{checkoutCopy.emptyCartMessage}</p>
                                    <p className="mt-1 text-xs text-slate-500">Adicione serviços ou produtos para montar a comanda com dados reais da barbearia.</p>
                                    <p className="hidden text-sm font-medium">O carrinho está vazio</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {chefClubInfo && (
                        <div className="mt-4 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20 flex items-center justify-between animate-fade-in">
                            <div className="flex items-center gap-3">
                                <div className="size-10 bg-amber-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                                    <span className="material-symbols-outlined">workspace_premium</span>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-amber-600 uppercase">Clube do Chefe - {chefClubInfo.planName}</p>
                                    <p className="text-[10px] text-slate-500 font-bold">Cliente possui créditos disponíveis para resgate.</p>
                                    <p className="text-[10px] text-amber-700 font-black">Aplicados nesta comanda: {appliedCreditsCount}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-amber-600">{chefClubInfo.credits}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Disponíveis</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Payment */}
                <div className="space-y-6 md:col-span-1">
                    <div className="bg-white dark:bg-card-dark rounded-2xl border border-[#D9EAF5] dark:border-[#14304A] p-6 shadow-[0_18px_45px_rgba(0,51,102,0.10)] sticky top-24">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#007BFF] dark:text-[#00D2FF]">receipt_long</span>
                            {checkoutCopy.summaryTitle}
                        </h3>

                        {/* Payment Status Toggle */}
                        <div className="mb-6">
                            <label className="hidden text-xs font-bold text-slate-500 uppercase mb-3 block">Ação do Pedido</label>
                            <p className="mb-3 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">{checkoutCopy.actionToggleLabel}</p>
                            <div className="flex bg-[#F7FBFE] dark:bg-background-dark p-1 rounded-xl border border-[#D9EAF5] dark:border-[#14304A]">
                                <button
                                    onClick={() => setPaymentStatus('paid')}
                                    className={`${supportsOpenComandaState ? 'flex-1' : 'w-full'} py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${paymentStatus === 'paid'
                                        ? 'bg-emerald-500 text-white shadow-md'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    {checkoutCopy.primaryPaidLabel}
                                </button>
                                {supportsOpenComandaState && (
                                    <button
                                        onClick={() => setPaymentStatus('pending')}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${paymentStatus === 'pending'
                                            ? 'bg-amber-500 text-white shadow-md'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">save</span>
                                        {checkoutCopy.primaryOpenLabel}
                                    </button>
                                )}
                            </div>
                        </div>

                        {paymentStatus === 'paid' && (chefClubInfo || closureMode === 'legacy_membership') && (
                            <div className="mb-6 space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div>
                                    <p className="text-[11px] font-black uppercase text-amber-700 dark:text-amber-300">Modo de fechamento</p>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                        Use a baixa administrativa para comandas antigas de clientes do Clube que ja pagaram em outro ciclo.
                                    </p>
                                </div>

                                <div className="grid gap-2">
                                    <button
                                        onClick={() => setClosureMode('standard')}
                                        className={`rounded-xl border px-4 py-3 text-left transition-all ${closureMode === 'standard'
                                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                            : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-background-dark dark:text-slate-300'
                                            }`}
                                    >
                                        <p className="text-sm font-black">Fechamento padrão</p>
                                        <p className="mt-1 text-xs">Lança o financeiro normalmente e consome os créditos aplicados nesta comanda.</p>
                                    </button>
                                    <button
                                        onClick={() => setClosureMode('legacy_membership')}
                                        className={`rounded-xl border px-4 py-3 text-left transition-all ${closureMode === 'legacy_membership'
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                            : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-background-dark dark:text-slate-300'
                                            }`}
                                    >
                                        <p className="text-sm font-black">Baixa administrativa do Clube</p>
                                        <p className="mt-1 text-xs">Fecha a comanda sem gerar nova receita e sem afetar os créditos atuais do assinante.</p>
                                    </button>
                                </div>

                                {closureMode === 'legacy_membership' && (
                                    <div className="space-y-3 rounded-xl border border-amber-500/20 bg-white/80 p-3 dark:bg-white/5">
                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                            Esse modo e indicado para regularizar comandas abertas de clientes que ja estavam no Clube em um ciclo anterior.
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Mes de referencia</label>
                                            <input
                                                type="month"
                                                value={legacyReferenceMonth}
                                                onChange={(e) => setLegacyReferenceMonth(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Motivo obrigatório</label>
                                            <textarea
                                                value={closureNote}
                                                onChange={(e) => setClosureNote(e.target.value)}
                                                rows={3}
                                                placeholder="Ex.: baixa do plano do mes anterior"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                <span>Subtotal</span>
                                <span className="font-bold text-slate-900 dark:text-white">R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                                <span>Desconto (R$)</span>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    className="w-20 text-right bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            {shouldCollectDiscountAudit && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-3 text-xs text-slate-700 dark:text-slate-200">
                                    <div>
                                        <p className="font-bold text-amber-700 dark:text-amber-300">Controle do desconto</p>
                                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                                            Registra a origem do desconto nas observações da baixa. A comissão ainda não será recalculada automaticamente.
                                        </p>
                                    </div>

                                    <label className="block">
                                        <span className="font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Origem</span>
                                        <select
                                            value={discountType}
                                            onChange={(e) => {
                                                const nextType = e.target.value as DiscountAuditType;
                                                setDiscountType(nextType);
                                                if (nextType !== 'barber_discount') setDiscountResponsibleStaffId('');
                                            }}
                                            className="mt-1 w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            {Object.entries(DISCOUNT_TYPE_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </label>

                                    {discountType === 'barber_discount' && (
                                        <label className="block">
                                            <span className="font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Barbeiro responsável</span>
                                            <select
                                                value={discountResponsibleStaffId}
                                                onChange={(e) => setDiscountResponsibleStaffId(e.target.value)}
                                                className="mt-1 w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                            >
                                                <option value="">Selecione o barbeiro</option>
                                                {discountStaffOptions.map(pro => (
                                                    <option key={pro.id} value={pro.id}>{pro.name}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}

                                    <label className="block">
                                        <span className="font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Motivo</span>
                                        <select
                                            value={discountReasonType}
                                            onChange={(e) => setDiscountReasonType(e.target.value as DiscountReasonType)}
                                            className="mt-1 w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                        >
                                            {Object.entries(DISCOUNT_REASON_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="block">
                                        <span className="font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Observação obrigatória</span>
                                        <textarea
                                            value={discountReasonNote}
                                            onChange={(e) => setDiscountReasonNote(e.target.value)}
                                            placeholder="Explique o contexto do desconto..."
                                            className="mt-1 min-h-20 w-full resize-none bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </label>
                                </div>
                            )}
                            <div className="h-px bg-slate-200 dark:bg-border-dark border-dashed"></div>
                            <div className="flex justify-between items-end">
                                <span className="font-bold text-lg text-slate-900 dark:text-white">Total</span>
                                <span className="font-black text-3xl text-[#003366] dark:text-[#00D2FF]">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {isZeroPaidCheckout && !isLegacyClubSettlement && (
                            <div className="mb-8 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm">
                                <div className="mb-3">
                                    <p className="text-[11px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">Fechamento zero auditado</p>
                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                        Comanda com valor financeiro zero precisa de origem válida. Não será criada entrada de caixa.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setZeroCloseOrigin('club_credit')}
                                        disabled={!canCloseWithClubCredit}
                                        className={`rounded-xl border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                            zeroCloseOrigin === 'club_credit'
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-background-dark dark:text-slate-300'
                                        }`}
                                    >
                                        <span className="block font-black">Pagamento via Clube do Chefe</span>
                                        <span>Crédito será consumido e não gera nova entrada no caixa.</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setZeroCloseOrigin('house_courtesy')}
                                        className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                                            zeroCloseOrigin === 'house_courtesy'
                                                ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                                : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-background-dark dark:text-slate-300'
                                        }`}
                                    >
                                        <span className="block font-black">Cortesia da casa</span>
                                        <span>Exige motivo e fica registrada como fechamento sem pagamento real.</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setZeroCloseOrigin('administrative_adjustment')}
                                        disabled={!canCloseWithAdministrativeOrigin}
                                        className={`rounded-xl border px-3 py-2 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                            zeroCloseOrigin === 'administrative_adjustment'
                                                ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                                : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-background-dark dark:text-slate-300'
                                        }`}
                                    >
                                        <span className="block font-black">Baixa administrativa auditada</span>
                                        <span>Restrita a gerente, admin ou superadmin, com motivo obrigatório.</span>
                                    </button>
                                </div>
                                {(zeroCloseOrigin === 'house_courtesy' || zeroCloseOrigin === 'administrative_adjustment') && (
                                    <label className="mt-3 block">
                                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Motivo obrigatório</span>
                                        <textarea
                                            value={zeroCloseReason}
                                            onChange={(event) => setZeroCloseReason(event.target.value)}
                                            rows={3}
                                            placeholder="Explique quem autorizou e por que a comanda será fechada sem pagamento."
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                        />
                                    </label>
                                )}
                            </div>
                        )}

                        {shouldShowPaymentMethod && (
                            <div className="mb-8 animate-fade-in">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Forma de Pagamento</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'credit', icon: 'credit_card', label: 'Crédito' },
                                        { id: 'debit', icon: 'payments', label: 'Débito' },
                                        { id: 'pix', icon: 'qr_code_2', label: 'Pix' },
                                        { id: 'cash', icon: 'attach_money', label: 'Dinheiro' },
                                        { id: 'other', icon: 'more_horiz', label: 'Outros' }
                                    ].map(method => (
                                        <button
                                            key={method.id}
                                            onClick={() => setPaymentMethod(method.id as any)}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === method.id ? 'bg-[#007BFF] text-white border-[#007BFF] shadow-[0_10px_24px_rgba(0,123,255,0.22)]' : 'bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-border-dark text-slate-500 hover:border-[#00D2FF]/50'}`}
                                        >
                                            <span className="material-symbols-outlined">{method.icon}</span>
                                            <span className="text-xs font-bold">{method.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {paymentMethod === 'other' && (
                                    <div className="mt-3 animate-fade-in">
                                        <input
                                            type="text"
                                            placeholder="Descreva a forma de pagamento..."
                                            value={paymentDescription}
                                            onChange={(e) => setPaymentDescription(e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {isLegacyClubSettlement && (
                            <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
                                O fechamento será apenas operacional. Nenhum lançamento novo será enviado ao financeiro e nenhum crédito atual será abatido.
                            </div>
                        )}

                        <button
                            onClick={handleFinish}
                            disabled={cart.length === 0 || loading}
                            className={`w-full py-4 text-white rounded-xl font-bold text-lg shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group ${paymentStatus === 'paid'
                                ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                                : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                }`}
                        >
                            {loading ? (
                                <div className="animate-spin size-6 border-2 border-white/30 border-t-white rounded-full"></div>
                            ) : (
                                <>
                                    <span>{paymentStatus === 'paid' ? checkoutCopy.finalButtonPaidLabel : checkoutCopy.finalButtonOpenLabel}</span>
                                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                                        {paymentStatus === 'paid' ? 'check_circle' : 'save_as'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div> {/* END GRID */}

            {/* --- MODALS --- */}

            {/* Client Selection Modal */}
            <Modal
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                title="Selecionar Cliente"
                maxWidth="md"
            >
                <div className="space-y-2">
                    <div className="relative mb-3">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar cliente..."
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                    {clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(client => (
                        <button
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
                        >
                            <img src={client.avatar} className="size-10 rounded-full" />
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{client.name}</p>
                                <p className="text-xs text-slate-500">{client.phone || 'Sem telefone'}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </Modal>

            <Modal
                isOpen={isOpenComandaModalOpen}
                onClose={() => setIsOpenComandaModalOpen(false)}
                title="Comandas abertas"
                maxWidth="lg"
            >
                <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        Selecione uma comanda para continuar o atendimento no Checkout. Esta busca não altera status, pagamento ou financeiro.
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                autoFocus
                                type="text"
                                value={openComandaSearchTerm}
                                placeholder="Buscar por cliente, telefone ou #comanda..."
                                onChange={(event) => setOpenComandaSearchTerm(event.target.value)}
                                className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        <button
                            onClick={() => void fetchQuickOpenComandas()}
                            disabled={loadingQuickOpenComandas}
                            className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:text-slate-300 dark:hover:bg-white/5"
                        >
                            {loadingQuickOpenComandas ? 'Atualizando...' : 'Atualizar'}
                        </button>
                    </div>

                    {quickOpenComandaError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                            {quickOpenComandaError}
                        </div>
                    )}

                    <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {loadingQuickOpenComandas ? (
                            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-border-dark">
                                Carregando comandas abertas...
                            </div>
                        ) : filteredQuickOpenComandas.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-border-dark">
                                Nenhuma comanda aberta encontrada para a busca atual.
                            </div>
                        ) : (
                            filteredQuickOpenComandas.map((comanda) => {
                                const client = getQuickComandaClient(comanda);
                                const isBlocked = comanda.status === 'blocked';
                                return (
                                    <button
                                        key={comanda.id}
                                        onClick={() => {
                                            setIsOpenComandaModalOpen(false);
                                            navigate(`/checkout/${comanda.id}`);
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary hover:bg-primary/5 dark:border-border-dark dark:bg-card-dark dark:hover:bg-primary/10"
                                    >
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-black text-slate-900 dark:text-white">{client.name}</p>
                                                <p className="mt-0.5 text-xs text-slate-500">
                                                    Comanda #{comanda.id.slice(0, 8)}
                                                    {client.phone ? ` · ${client.phone}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${isBlocked
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                                                    }`}
                                                >
                                                    {isBlocked ? 'Bloqueada' : 'Aberta'}
                                                </span>
                                                <span className="text-xs font-bold text-slate-500">
                                                    {Number(comanda.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </Modal>

            {/* Add Item Modal */}
            <Modal
                isOpen={isItemModalOpen}
                onClose={() => { setIsItemModalOpen(false); setSearchTerm(''); }}
                title="Adicionar Item"
                maxWidth="lg"
            >
                <div className="space-y-4">
                    {/* Tabs — switch between services and products INSIDE the modal */}
                    <div className="flex bg-slate-100 dark:bg-background-dark p-1 rounded-xl">
                        <button
                            onClick={() => { setItemModalTab('services'); setSearchTerm(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${itemModalTab === 'services'
                                ? 'bg-primary text-white shadow-md'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm">content_cut</span>
                            Serviços
                        </button>
                        <button
                            onClick={() => { setItemModalTab('products'); setSearchTerm(''); }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${itemModalTab === 'products'
                                ? 'bg-amber-500 text-white shadow-md'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm">shopping_bag</span>
                            Produtos
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            autoFocus
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={`Buscar ${itemModalTab === 'services' ? 'serviço' : 'produto'}...`}
                            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>

                    {itemModalTab === 'products' && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/5">
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Não encontrou o produto?</p>
                                <p className="text-xs text-slate-500">Cadastre agora e ele já entra na venda.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenQuickProductModal}
                                className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600"
                            >
                                + Novo Produto
                            </button>
                        </div>
                    )}

                    {itemModalTab === 'services' && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
                            <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Não encontrou o serviço?</p>
                                <p className="text-xs text-slate-500">Cadastre agora e ele já entra na venda.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenQuickServiceModal}
                                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
                            >
                                + Novo Serviço
                            </button>
                        </div>
                    )}

                    {/* Items List */}
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                        {filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2">
                                    {itemModalTab === 'services' ? 'content_cut' : 'inventory_2'}
                                </span>
                                <p className="text-sm font-medium">
                                    {searchTerm
                                        ? 'Nenhum resultado encontrado.'
                                        : itemModalTab === 'services'
                                            ? 'Nenhum serviço ativo cadastrado.'
                                            : 'Nenhum produto ativo cadastrado.'}
                                </p>
                                {itemModalTab === 'services' && (
                                    <button
                                        type="button"
                                        onClick={handleOpenQuickServiceModal}
                                        className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary/90"
                                    >
                                        Cadastrar serviço agora
                                    </button>
                                )}
                                {itemModalTab === 'products' && (
                                    <button
                                        type="button"
                                        onClick={handleOpenQuickProductModal}
                                        className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-600"
                                    >
                                        Cadastrar produto agora
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredItems.map((item: any) => {
                                    const displayName = getCatalogDisplayName(item);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleAddItem(item, itemModalTab === 'services' ? 'service' : 'product')}
                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors group"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className={`size-9 rounded-lg flex items-center justify-center ${itemModalTab === 'services' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                    <span className="material-symbols-outlined text-lg">
                                                        {itemModalTab === 'services' ? 'content_cut' : 'package_2'}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 text-left">
                                                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{displayName}</p>
                                                    {usesCommercialName(item) && (
                                                        <p className="truncate text-[10px] font-semibold text-slate-400">Interno: {item.name}</p>
                                                    )}
                                                    {item.description && <p className="text-xs text-slate-500 truncate max-w-[220px]">{item.description}</p>}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-bold text-slate-900 dark:text-white">
                                                    R$ {Number(item.price ?? item.sale_price ?? 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {pendingCreditItem && (
                <Modal
                    isOpen={!!pendingCreditItem}
                    onClose={() => handleResolveCreditSuggestion(false)}
                    title="Aplicar crédito do Clube?"
                    maxWidth="sm"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={() => handleResolveCreditSuggestion(false)}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:border-border-dark dark:text-slate-300 dark:hover:bg-white/5"
                            >
                                Adicionar sem crédito
                            </button>
                            <button
                                type="button"
                                onClick={() => handleResolveCreditSuggestion(true)}
                                className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600"
                            >
                                Aplicar crédito
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                            <span className="material-symbols-outlined mt-0.5 text-2xl">workspace_premium</span>
                            <div className="min-w-0">
                                <p className="text-sm font-black">Cliente assinante com crédito disponível.</p>
                                <p className="mt-1 text-xs font-semibold opacity-80">
                                    Use 1 crédito do Clube do Chefe para zerar este serviço na comanda.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-border-dark dark:bg-white/5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Serviço</p>
                            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{getCatalogDisplayName(pendingCreditItem.item, 'Serviço selecionado')}</p>
                            <p className="mt-1 text-xs text-slate-500">
                                Valor original: R$ {pendingCreditItem.finalPrice.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </Modal>
            )}

            <Modal
                isOpen={isQuickProductModalOpen}
                onClose={handleCloseQuickProductModal}
                title="Cadastrar Produto"
                maxWidth="lg"
            >
                <form onSubmit={handleCreateProductDuringCheckout} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Nome interno</label>
                        <input
                            autoFocus
                            required
                            type="text"
                            value={quickProductForm.name}
                            onChange={(e) => setQuickProductForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Nome comercial</label>
                        <input
                            type="text"
                            value={quickProductForm.commercial_name}
                            onChange={(e) => setQuickProductForm((prev) => ({ ...prev, commercial_name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Descrição</label>
                        <textarea
                            rows={2}
                            value={quickProductForm.description}
                            onChange={(e) => setQuickProductForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500">Custo (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={quickProductForm.cost_price}
                                onChange={(e) => setQuickProductForm((prev) => ({ ...prev, cost_price: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500">Venda (R$)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                min="0"
                                value={quickProductForm.sale_price}
                                onChange={(e) => setQuickProductForm((prev) => ({ ...prev, sale_price: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500">Qtd em Estoque</label>
                            <input
                                type="number"
                                min="0"
                                value={quickProductForm.stock_quantity}
                                onChange={(e) => setQuickProductForm((prev) => ({ ...prev, stock_quantity: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500">Estoque Minimo</label>
                            <input
                                type="number"
                                min="0"
                                value={quickProductForm.minimum_stock}
                                onChange={(e) => setQuickProductForm((prev) => ({ ...prev, minimum_stock: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 pt-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                        <input
                            type="checkbox"
                            checked={quickProductForm.auto_generate_purchase_order}
                            onChange={(e) => setQuickProductForm((prev) => ({ ...prev, auto_generate_purchase_order: e.target.checked }))}
                            className="size-4 accent-primary"
                        />
                        Gerar pedido de compra automaticamente
                    </label>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCloseQuickProductModal}
                            disabled={isSavingQuickProduct}
                            className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:text-slate-300 dark:hover:bg-white/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingQuickProduct}
                            className="flex-1 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSavingQuickProduct ? 'Salvando...' : 'Salvar e Adicionar'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isQuickServiceModalOpen}
                onClose={handleCloseQuickServiceModal}
                title="Cadastrar Serviço"
                maxWidth="lg"
            >
                <form onSubmit={handleCreateServiceDuringCheckout} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Nome interno</label>
                        <input
                            autoFocus
                            required
                            type="text"
                            value={quickServiceForm.name}
                            onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Nome comercial</label>
                        <input
                            type="text"
                            value={quickServiceForm.commercial_name}
                            onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, commercial_name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Descrição comercial</label>
                        <textarea
                            rows={2}
                            value={quickServiceForm.description}
                            onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500">Categoria</label>
                            <select
                                value={quickServiceForm.category}
                                onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, category: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:[color-scheme:dark]"
                            >
                                {serviceCategories.map((category) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500">Preco (R$)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                min="0"
                                value={quickServiceForm.price}
                                onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, price: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase text-slate-500">Duração (min)</label>
                            <input
                                required
                                type="number"
                                min="1"
                                value={quickServiceForm.duration}
                                onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, duration: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                            />
                        </div>
                        <label className="flex items-center gap-2 pt-7 text-sm font-medium text-slate-600 dark:text-slate-400">
                            <input
                                type="checkbox"
                                checked={quickServiceForm.active}
                                onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, active: e.target.checked }))}
                                className="size-4 accent-primary"
                            />
                            Serviço ativo
                        </label>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCloseQuickServiceModal}
                            disabled={isSavingQuickService}
                            className="flex-1 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border-dark dark:text-slate-300 dark:hover:bg-white/5"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSavingQuickService}
                            className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSavingQuickService ? 'Salvando...' : 'Salvar e Adicionar'}
                        </button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* === DUPLICATE CLIENT WARNING MODAL === */}
            <Modal
                isOpen={showDuplicateModal}
                onClose={() => { setShowDuplicateModal(false); setPendingClient(null); setDuplicateComanda(null); }}
                title="Comanda em Aberto Detectada"
                maxWidth="sm"
            >
                <div className="space-y-5">
                    {/* Warning Banner */}
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                        <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5">warning</span>
                        <div>
                            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Atenção!</p>
                            <p className="text-xs text-amber-600 dark:text-amber-300 mt-0.5">
                                O cliente <strong>{pendingClient?.name}</strong> já possui uma comanda em aberto.
                                Revise antes de criar uma nova.
                            </p>
                        </div>
                    </div>

                    {/* Existing Comanda Info */}
                    {duplicateComanda && (
                        <div className="bg-slate-50 dark:bg-background-dark rounded-xl p-4 border border-slate-200 dark:border-border-dark">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Comanda Existente</p>
                            <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-primary">#{duplicateComanda.id.slice(0, 8)}</span>
                                <span className="text-xs text-slate-500">
                                    {new Date(duplicateComanda.created_at).toLocaleDateString('pt-BR')} às{' '}
                                    {new Date(duplicateComanda.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleGoToExisting}
                            className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                            Ir para Comanda Existente
                        </button>
                        <button
                            onClick={handleConfirmDuplicate}
                            className="w-full py-3 rounded-xl text-sm font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">add_circle</span>
                            Criar Nova Mesmo Assim
                        </button>
                    </div>
                </div>
            </Modal>

            {/* === SHARED EXECUTION MODAL === */}
            <Modal
                isOpen={isSharedExecutionModalOpen}
                onClose={() => { setIsSharedExecutionModalOpen(false); setSharedExecutionItemId(null); }}
                title="Execução Compartilhada"
                maxWidth="md"
            >
                {sharedExecutionItemId && (() => {
                    const item = cart.find(i => i.id === sharedExecutionItemId);
                    if (!item) return null;
                    return (
                        <div className="space-y-4">
                            <div className="bg-slate-50 dark:bg-white/5 rounded-lg p-3">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{item.display_name || item.name}</p>
                                <p className="text-xs text-slate-500">Valor: R$ {item.price.toFixed(2)}</p>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase">Participantes</p>
                                
                                {item.execution_participants?.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-white/5 rounded-lg">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">{p.professional_name || 'Profissional'}</p>
                                            <p className="text-[10px] text-slate-500">{p.role === 'primary' ? 'Principal' : p.role === 'assistant' ? 'Apoio' : 'Coexecutor'} • {formatPayoutValue(p)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-emerald-600">R$ {calculateParticipantPayout(item.price, p).toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={() => removeParticipant(item.id, p.id)}
                                            className="p-1 text-slate-400 hover:text-red-500"
                                        >
                                            <span className="material-symbols-outlined text-sm">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Adicionar Participante</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        id="newParticipantProfessional"
                                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                    >
                                        <option value="">Selecionar...</option>
                                        {staff.filter(s => s.id !== item.staff_id).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <select
                                        id="newParticipantRole"
                                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                    >
                                        <option value="assistant">Apoio</option>
                                        <option value="co_executor">Coexecutor</option>
                                    </select>
                                    <select
                                        id="newParticipantPayoutType"
                                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                    >
                                        <option value="percentage">Porcentagem</option>
                                        <option value="fixed">Valor Fixo</option>
                                    </select>
                                    <input
                                        id="newParticipantPayoutValue"
                                        type="number"
                                        placeholder="Valor"
                                        className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A1A1A] text-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        const proId = (document.getElementById('newParticipantProfessional') as HTMLSelectElement).value;
                                        const proName = staff.find(s => s.id === proId)?.name || 'Profissional';
                                        const role = (document.getElementById('newParticipantRole') as HTMLSelectElement).value as ExecutionRole;
                                        const payoutType = (document.getElementById('newParticipantPayoutType') as HTMLSelectElement).value as PayoutType;
                                        const payoutValue = parseFloat((document.getElementById('newParticipantPayoutValue') as HTMLInputElement).value) || 0;
                                        
                                        if (proId && payoutValue > 0) {
                                            addParticipant(item.id, proId, proName, role, payoutType, payoutValue);
                                        }
                                    }}
                                    className="w-full mt-3 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90"
                                >
                                    Adicionar
                                </button>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-3">
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">Resumo Financeiro</p>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-300">Valor total do serviço</span>
                                        <span className="font-bold text-slate-900 dark:text-white">R$ {item.price.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-300">Total rateio</span>
                                        <span className="font-bold text-slate-900 dark:text-white">R$ {calculateTotalPayouts(item.price, item.execution_participants || []).toFixed(2)}</span>
                                    </div>
                                    {(item.execution_participants?.length ?? 0) > 0 && (
                                        <div className="flex justify-between text-sm border-t border-emerald-200 dark:border-emerald-500/20 pt-1 mt-1">
                                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Receita única (sem duplicar)</span>
                                            <span className="font-bold text-emerald-600">R$ {item.price.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => { setIsSharedExecutionModalOpen(false); setSharedExecutionItemId(null); }}
                                className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold"
                            >
                                Fechar
                            </button>
                        </div>
                    );
                })()}
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Checkout;
