import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    supabase,
} from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import ChefClubSummary from '@/src/apps/barber/components/chef-club/ChefClubSummary';
import {
    applyChefClubBenefitsToCart,
    buildChefClubConsumptionRecords,
    getChefClubCheckoutSummary,
} from '@/src/apps/barber/services/chefClubIntegration';
import type {
    ChefClubAppliedBenefit,
    ChefClubBenefitBalance,
    ChefClubContext,
    ChefClubItemInput,
    ChefClubItemResult,
    ChefClubPlanBenefit,
} from '@/src/apps/barber/contracts/chefClub';

// Types
interface CartItem {
    id: string; // for UI tracking
    dbId?: string; // from database if editing
    type: 'service' | 'product';
    name: string;
    price: number;
    quantity: number;
    service_id?: string;
    product_id?: string;
    staff_id?: string;
    category?: string;
    chefClubApplied?: ChefClubAppliedBenefit | null;
    participants?: ServiceExecutionParticipant[];
}

interface Client {
    id: string;
    name: string;
    avatar: string;
    phone?: string;
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

interface ChefClubSubscriptionRelation {
    id: string;
    plan_id: string;
    status: 'active' | 'past_due' | 'canceled' | 'paused';
    cycle_start: string | null;
    cycle_end: string | null;
    next_billing_date: string | null;
}

interface Staff {
    id: string;
    name: string;
}

interface ServiceExecutionParticipant {
    id: string;
    comanda_item_id?: string;
    staff_id: string;
    role: 'primary' | 'assistant' | 'co_executor';
    payout_type: 'percentage' | 'fixed';
    payout_value: number;
    payout_amount_calculated?: number;
    affects_revenue: boolean;
    affects_commission: boolean;
}

const isRecordActive = (record: any) => {
    if (typeof record?.active === 'boolean') return record.active;
    if (typeof record?.is_active === 'boolean') return record.is_active;
    return true;
};

const normalizeServiceRecord = (service: any) => ({
    ...service,
    active: isRecordActive(service),
    duration: Number(service?.duration ?? service?.duration_minutes) || 30,
    price: Number(service?.price) || 0,
});

const normalizeProductRecord = (product: any) => ({
    ...product,
    active: isRecordActive(product),
    sale_price: Number(product?.sale_price ?? product?.price) || 0,
});

interface QuickProductForm {
    name: string;
    description: string;
    cost_price: string;
    sale_price: string;
    stock_quantity: string;
    minimum_stock: string;
    auto_generate_purchase_order: boolean;
}

interface QuickServiceForm {
    name: string;
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
    description: '',
    cost_price: '0',
    sale_price: '0',
    stock_quantity: '0',
    minimum_stock: '0',
    auto_generate_purchase_order: false,
});

const createInitialQuickServiceForm = (serviceName = ''): QuickServiceForm => ({
    name: serviceName,
    category: 'Cabelo',
    price: '0',
    duration: '30',
    active: true,
});

const serviceCategories = ['Cabelo', 'Barba', 'Combo', 'Quimica', 'Acabamento', 'Outros'];

const Checkout: React.FC = () => {
    const { id: comandaId } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { tenantId, requireModuleAccess } = useAuth();
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
            subtitle: 'Revise os itens, ajuste o consumo e conclua a cobranca.',
            orderLabel: 'Comanda',
            clientRequiredError: 'Selecione o cliente vinculado a esta comanda.',
            clientEmptyTitle: 'Cliente da comanda',
            clientEmptyHelper: 'Selecione o cliente responsavel por esta comanda.',
            itemSectionTitle: 'Itens da Comanda',
            actionToggleLabel: 'Acao da comanda',
            primaryPaidLabel: 'Fechar agora',
            primaryOpenLabel: 'Manter aberta',
            successPaid: 'Comanda fechada com sucesso!',
            successOpen: 'Comanda atualizada e mantida em aberto!',
            emptyCartMessage: 'Nenhum item lancado na comanda',
            itemRequiredError: 'Adicione pelo menos um item antes de finalizar a comanda.',
            finalButtonPaidLabel: 'Confirmar e fechar',
            finalButtonOpenLabel: 'Atualizar e manter aberta',
            summaryTitle: 'Resumo da cobranca',
            redirectPath: '/comandas',
        }
        : checkoutEntryMode === 'open_comanda'
            ? {
                title: 'Abrir Comanda',
                subtitle: 'Inicie uma comanda operacional para acompanhar consumo e fechar depois.',
                orderLabel: 'Nova comanda',
                clientRequiredError: 'Selecione o cliente antes de abrir a comanda.',
                clientEmptyTitle: 'Cliente da comanda',
                clientEmptyHelper: 'Obrigatorio para abrir a comanda.',
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
                subtitle: 'Lance produtos e servicos para uma venda imediata no caixa.',
                orderLabel: 'Operacao',
                clientRequiredError: 'Selecione um cliente para concluir a operacao.',
                clientEmptyTitle: 'Cliente nao selecionado',
                clientEmptyHelper: 'Obrigatorio para concluir a operacao no fluxo atual.',
                itemSectionTitle: 'Itens da Operacao',
                actionToggleLabel: 'Acao da operacao',
                primaryPaidLabel: 'Concluir venda',
                primaryOpenLabel: 'Salvar aberta',
                successPaid: 'Venda realizada com sucesso!',
                successOpen: 'Operacao salva em aberto!',
                emptyCartMessage: 'Nenhum item lancado na operacao',
                itemRequiredError: 'Adicione pelo menos um item antes de concluir a operacao.',
                finalButtonPaidLabel: 'Concluir venda',
                finalButtonOpenLabel: 'Salvar operacao',
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
    const [discount, setDiscount] = useState<string>('0');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
    const [isQuickServiceModalOpen, setIsQuickServiceModalOpen] = useState(false);
    const [itemModalTab, setItemModalTab] = useState<'services' | 'products'>('services');
    const [searchTerm, setSearchTerm] = useState('');
    const [quickProductForm, setQuickProductForm] = useState<QuickProductForm>(createInitialQuickProductForm);
    const [quickServiceForm, setQuickServiceForm] = useState<QuickServiceForm>(createInitialQuickServiceForm);
    const [isSavingQuickProduct, setIsSavingQuickProduct] = useState(false);
    const [isSavingQuickService, setIsSavingQuickService] = useState(false);
    const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
    const [selectedItemForParticipants, setSelectedItemForParticipants] = useState<string | null>(null);

    // Duplicate comanda guard
    const [duplicateComanda, setDuplicateComanda] = useState<{ id: string; created_at: string } | null>(null);
    const [pendingClient, setPendingClient] = useState<Client | null>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // DB Data
    const [clients, setClients] = useState<Client[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
    const [chefClubContext, setChefClubContext] = useState<ChefClubContext | null>(null);
    const [chefClubOverrideMap, setChefClubOverrideMap] = useState<Record<string, boolean>>({});
    const [skipChefClubConsumption, setSkipChefClubConsumption] = useState(false);
    const [relatedAppointmentId, setRelatedAppointmentId] = useState<string | null>(checkoutState?.appointmentId || null);
    const [loading, setLoading] = useState(true);
    const finishLockRef = React.useRef(false);
    const comandaRequestKeyRef = React.useRef(generateIdempotencyKey('comanda'));
    const supportsOpenComandaState = checkoutEntryMode !== 'pdv';
    const incomeCategory = checkoutEntryMode === 'pdv'
        ? 'Venda de Balcao'
        : checkoutEntryMode === 'open_comanda'
            ? 'Fechamento de Comanda'
            : 'Fechamento de Atendimento';

    const resetComandaRequestKey = () => {
        comandaRequestKeyRef.current = generateIdempotencyKey('comanda');
    };

    const resetOperationalState = useCallback(() => {
        if (comandaId) return;

        setSelectedClient(null);
        setCart([]);
        setDiscount('0');
        setPaymentMethod('credit');
        setPaymentDescription('');
        setChefClubContext(null);
        setChefClubOverrideMap({});
        setSkipChefClubConsumption(false);
        setDuplicateComanda(null);
        setPendingClient(null);
        setShowDuplicateModal(false);
        setSearchTerm('');
        setRelatedAppointmentId(null);
        setPaymentStatus(checkoutEntryMode === 'open_comanda' ? 'pending' : 'paid');
        resetComandaRequestKey();
    }, [checkoutEntryMode, comandaId]);

    const loadChefClubContext = useCallback(async (clientId: string, resolvedTenantId: string, clientDb: any) => {
        const { data: subscription, error: subscriptionError } = await clientDb
            .from('customer_subscriptions')
            .select('id, plan_id, status, cycle_start, cycle_end, next_billing_date')
            .eq('client_id', clientId)
            .eq('tenant_id', resolvedTenantId)
            .eq('status', 'active')
            .maybeSingle();

        if (subscriptionError) throw subscriptionError;

        if (!subscription?.id) {
            setChefClubContext(null);
            return;
        }

        const [balancesRes, benefitsRes, planRes] = await Promise.all([
            clientDb
                .from('customer_credits')
                .select('id, subscription_id, client_id, benefit_code, benefit_label, available_credits, used_credits, source_plan_benefit_id')
                .eq('tenant_id', resolvedTenantId)
                .eq('subscription_id', subscription.id)
                .order('benefit_label'),
            clientDb
                .from('customer_plan_benefits')
                .select('id, tenant_id, plan_id, benefit_code, benefit_label, monthly_quantity, eligible_service_ids, eligible_service_names, eligible_service_categories, active, priority')
                .eq('tenant_id', resolvedTenantId)
                .eq('plan_id', subscription.plan_id)
                .eq('active', true)
                .order('priority', { ascending: false }),
            clientDb
                .from('customer_plans')
                .select('name')
                .eq('tenant_id', resolvedTenantId)
                .eq('id', subscription.plan_id)
                .maybeSingle(),
        ]);

        if (balancesRes.error) throw balancesRes.error;
        if (benefitsRes.error) throw benefitsRes.error;
        if (planRes.error) throw planRes.error;

        const planName = planRes.data?.name || 'Plano ativo';

        setChefClubContext({
            subscription: {
                id: subscription.id,
                plan_id: subscription.plan_id,
                plan_name: planName,
                status: subscription.status,
                cycle_start: subscription.cycle_start,
                cycle_end: subscription.cycle_end,
                next_billing_date: subscription.next_billing_date,
            },
            balances: (balancesRes.data || []) as ChefClubBenefitBalance[],
            planBenefits: (benefitsRes.data || []) as ChefClubPlanBenefit[],
        });
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
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'checkout',
                'comandas',
                'load checkout data',
            );

            const [clientsRes, staffRes, servicesRes, productsRes, promoRes] = await Promise.all([
                client.from('clients').select('id, name, avatar, phone').eq('tenant_id', resolvedTenantId).order('name'),
                client.from('staff').select('id, name').eq('tenant_id', resolvedTenantId).eq('status', 'active'),
                client.from('services').select('*').eq('tenant_id', resolvedTenantId).order('name'),
                client.from('products').select('*').eq('tenant_id', resolvedTenantId).order('name'),
                client.from('promotions').select('*').eq('tenant_id', resolvedTenantId).eq('active', true),
            ]);

            if (clientsRes.error) throw clientsRes.error;
            if (staffRes.error) throw staffRes.error;
            if (servicesRes.error) throw servicesRes.error;
            if (productsRes.error) throw productsRes.error;
            if (promoRes.error) throw promoRes.error;

            setClients((clientsRes.data || []) as Client[]);
            setStaff((staffRes.data || []) as Staff[]);
            setServices((servicesRes.data || []).map(normalizeServiceRecord).filter(isRecordActive));
            setProducts((productsRes.data || []).map(normalizeProductRecord).filter(isRecordActive));

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
                    setRelatedAppointmentId(comanda.appointment_id || null);

                    if (selectedClientData) {
                        await loadChefClubContext(selectedClientData.id, resolvedTenantId, client);
                    }

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
                        category: item.service_category || item.category || undefined,
                        chefClubApplied: item.chef_club_benefit_code
                            ? {
                                benefitCode: item.chef_club_benefit_code,
                                benefitLabel: item.chef_club_benefit_label || 'Clube do Chefe',
                                quantity: Number(item.chef_club_applied_quantity || item.quantity || 1),
                                overrideMode: item.chef_club_override_mode || 'none',
                                overrideReason: item.chef_club_override_reason || '',
                                balanceId: null,
                                planBenefitId: item.chef_club_plan_benefit_id || null,
                            }
                            : null,
                    }));
                    setCart(mappedItems);
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
    }, [comandaId, requireModuleAccess, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (comandaId) return;
        setPaymentStatus(checkoutEntryMode === 'open_comanda' ? 'pending' : 'paid');
    }, [checkoutEntryMode, comandaId]);

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
            const matchedService = services.find((service) => service.name === checkoutState.serviceName);

            if (matchedService) {
                const finalPrice = typeof checkoutState.price === 'number' && checkoutState.price > 0
                    ? checkoutState.price
                    : calculateItemPrice(matchedService, 'service');

                setCart([{
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'service',
                    name: matchedService.name || checkoutState.serviceName,
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

    const resolvedCart: ChefClubItemResult[] = React.useMemo(() => {
        const input = cart.map((item) => ({
            id: item.id,
            type: item.type,
            name: item.name,
            service_id: item.service_id || null,
            product_id: item.product_id || null,
            category: item.category || null,
            quantity: item.quantity,
            unitPrice: item.price,
        })) satisfies ChefClubItemInput[];

        if (!chefClubContext) {
            return input.map((item) => ({
                ...item,
                appliedBenefit: null,
                finalUnitPrice: item.unitPrice,
                savings: 0,
                isEligible: false,
                eligibilityReason: 'Sem contexto do Clube do Chefe.',
            }));
        }

        return applyChefClubBenefitsToCart(input, chefClubContext, chefClubOverrideMap, {
            allowWithoutBalance: skipChefClubConsumption,
            autoApplyWithoutBalance: false,
        });
    }, [cart, chefClubContext, chefClubOverrideMap, skipChefClubConsumption]);

    // Calculations
    const chefClubSummary = React.useMemo(() => getChefClubCheckoutSummary(resolvedCart), [resolvedCart]);
    const subtotal = chefClubSummary.originalSubtotal;
    const savingsTotal = chefClubSummary.savingsTotal;
    const discountValue = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - savingsTotal - discountValue);

    // Duplicate client check
    const handleSelectClient = async (client: Client) => {
        setIsClientModalOpen(false);
        if (!tenantId) {
            setToast({ message: 'Tenant invalido para selecionar cliente.', type: 'error' });
            finishLockRef.current = false;
            return;
        }

        try {
            const { tenantId: resolvedTenantId, client: clientDb } = requireModuleAccess(
                'checkout',
                'comandas',
                'select checkout client',
            );

            if (!comandaId && supportsOpenComandaState) {
                const { data: openComandas, error: openComandasError } = await clientDb
                    .from('comandas')
                    .select('id, created_at')
                    .eq('client_id', client.id)
                    .eq('tenant_id', resolvedTenantId)
                    .eq('status', 'open')
                    .limit(1);

                if (openComandasError) throw openComandasError;

                if (openComandas && openComandas.length > 0) {
                    setPendingClient(client);
                    setDuplicateComanda(openComandas[0]);
                    setShowDuplicateModal(true);
                    return;
                }
            }

            const targetClient = pendingClient || client;
            if (pendingClient) setSelectedClient(pendingClient);
            setSelectedClient(targetClient);

            try {
                await loadChefClubContext(targetClient.id, resolvedTenantId, clientDb);
            } catch (chefClubError) {
                console.warn('Nao foi possivel carregar contexto do Clube do Chefe:', chefClubError);
                setChefClubContext(null);
            }
        } catch (error) {
            console.error('Error selecting checkout client:', error);
            setToast({ message: 'Erro ao carregar dados do cliente.', type: 'error' });
        }
    };

    const handleConfirmDuplicate = () => {
        // User chose to proceed anyway
        if (pendingClient) setSelectedClient(pendingClient);
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

    const handleAddItem = (item: any, type: 'service' | 'product') => {
        const finalPrice = calculateItemPrice(item, type);

        const newItem: CartItem = {
            id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            type,
            name: item.name || 'Item sem nome',
            price: finalPrice,
            quantity: 1,
            service_id: type === 'service' ? item.id : undefined,
            product_id: type === 'product' ? item.id : undefined,
            staff_id: staff.length > 0 ? staff[0].id : '',
            category: item.category || item.service_category || item.group || '',
            chefClubApplied: null,
        };

        setCart([...cart, newItem]);
        setSearchTerm('');
        setIsItemModalOpen(false);
    };

    const handleRemoveItem = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
        setChefClubOverrideMap((prev) => {
            if (!prev[id] && prev[id] !== false) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const handleToggleChefClubBenefit = (itemId: string) => {
        const resolvedItem = resolvedCart.find((item) => item.id === itemId);
        setChefClubOverrideMap((prev) => {
            const next = { ...prev };

            if (resolvedItem?.appliedBenefit) {
                next[itemId] = false;
                return next;
            }

            if (skipChefClubConsumption && resolvedItem?.isEligible) {
                if (next[itemId] === true) {
                    delete next[itemId];
                } else {
                    next[itemId] = true;
                }
                return next;
            }

            if (next[itemId] === false) {
                delete next[itemId];
            } else {
                next[itemId] = false;
            }
            return next;
        });
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
            setToast({ message: 'Tenant invalido para cadastrar produto.', type: 'error' });
            return;
        }

        setIsSavingQuickProduct(true);
        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'products',
                'products',
                'create product during checkout',
            );

            const payload = {
                tenant_id: resolvedTenantId,
                name: quickProductForm.name.trim(),
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
                nextProducts.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
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
            setToast({ message: 'Tenant invalido para cadastrar servico.', type: 'error' });
            return;
        }

        setIsSavingQuickService(true);
        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'services',
                'services',
                'create service during checkout',
            );

            const payload = {
                tenant_id: resolvedTenantId,
                name: quickServiceForm.name.trim(),
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
                nextServices.sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
                return nextServices;
            });

            setToast({ message: 'Servico criado e adicionado a venda.', type: 'success' });
            handleAddItem(createdService, 'service');
            setQuickServiceForm(createInitialQuickServiceForm());
            setIsQuickServiceModalOpen(false);
        } catch (error) {
            console.error('Error creating service during checkout:', error);
            setToast({ message: 'Erro ao cadastrar servico durante a venda.', type: 'error' });
        } finally {
            setIsSavingQuickService(false);
        }
    };

    const handleStaffChange = (itemId: string, proId: string) => {
        setCart(cart.map(item => {
            if (item.id !== itemId) return item;
            
            const updatedItem = { ...item, staff_id: proId };
            
            if (updatedItem.participants && updatedItem.participants.length > 0) {
                updatedItem.participants = updatedItem.participants.map(p => 
                    p.role === 'primary' ? { ...p, staff_id: proId } : p
                );
            }
            
            return updatedItem;
        }));
    };

    const handlePriceChange = (itemId: string, newPrice: string) => {
        const floatPrice = parseFloat(newPrice);
        setCart(cart.map(item => item.id === itemId ? { ...item, price: isNaN(floatPrice) ? 0 : floatPrice } : item));
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
        if (!tenantId) {
            setToast({ message: 'Tenant inválido para finalizar operação.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const { tenantId: resolvedTenantId, client } = requireModuleAccess(
                'checkout',
                'comandas',
                'finish checkout',
            );
let currentComandaId = comandaId;
            const assignedStaffIds = Array.from(new Set(resolvedCart.map(item => item.staff_id).filter(Boolean))) as string[];
            const comandaStaffId = assignedStaffIds.length === 1 ? assignedStaffIds[0] : null;

            // 1. Create or Update Comanda - campos mínimos para evitar schema cache issues
            const comandaData: any = {
                client_id: selectedClient.id,
                staff_id: comandaStaffId,
                appointment_id: relatedAppointmentId,
                status: paymentStatus === 'paid' ? 'paid' : 'open',
                total,
                tenant_id: resolvedTenantId,
            };

            // Campos Chef Club removidos temporariamente para evitar PGRST204
            // Os dados são armazenados na tabela customer_benefit_consumptions

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
            const itemsToInsert = resolvedCart.map(item => ({
                id: item.id,
                comanda_id: currentComandaId,
                service_id: item.service_id || null,
                product_id: item.product_id || null,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                staff_id: item.staff_id || null,
                tenant_id: resolvedTenantId,
                chef_club_benefit_code: item.appliedBenefit?.benefitCode || null,
                chef_club_benefit_label: item.appliedBenefit?.benefitLabel || null,
                chef_club_applied_quantity: item.appliedBenefit?.quantity || 0,
                chef_club_original_unit_price: item.unitPrice,
                chef_club_final_unit_price: item.finalUnitPrice,
                chef_club_override_mode: item.appliedBenefit?.overrideMode || 'none',
                chef_club_override_reason: item.appliedBenefit?.overrideReason || '',
                chef_club_plan_benefit_id: item.appliedBenefit?.planBenefitId || null,
            }));

const { error: itemsError } = await client.from('comanda_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            // Small delay to ensure items are committed
            await new Promise(resolve => setTimeout(resolve, 100));

            // 2.1. Insert participants for items with execution sharing
            const itemsWithParticipants = cart.filter(item => 
                item.participants && item.participants.length > 0
            );
            
            if (itemsWithParticipants.length > 0) {
                try {
                    const participantsToInsert = itemsWithParticipants.flatMap(item => {
                        const resolvedItem = resolvedCart.find(r => r.id === item.id);
                        const itemTotal = (resolvedItem?.finalUnitPrice || item.price) * item.quantity;
                        return item.participants!.map(p => {
                            const calculatedAmount = p.payout_type === 'percentage'
                                ? itemTotal * (p.payout_value / 100)
                                : p.payout_value;
                            return {
                                id: p.id || crypto.randomUUID(),
                                comanda_item_id: item.id,
                                staff_id: p.staff_id,
                                role: p.role,
                                payout_type: p.payout_type,
                                payout_value: p.payout_value,
                                payout_amount_calculated: calculatedAmount,
                                affects_revenue: p.affects_revenue,
                                affects_commission: p.affects_commission,
                                tenant_id: resolvedTenantId,
                            };
                        });
                    });

                    if (participantsToInsert.length > 0) {
                        const { error: participantsError } = await client
                            .from('service_execution_participants')
                            .upsert(participantsToInsert, { onConflict: 'id' });
                        
                        if (participantsError) {
                            console.warn('Failed to save participants:', participantsError);
                        }
                    }
                } catch (participantsErr) {
                    console.warn('Error saving participants (non-blocking):', participantsErr);
                }
            }

            // 3. If PAID, finalize via RPC (this reduces stock and marks as paid in DB)
            if (paymentStatus === 'paid') {
                const chefClubConsumptionPayload = chefClubContext?.subscription?.id
                    ? buildChefClubConsumptionRecords(resolvedCart, {
                        subscriptionId: chefClubContext.subscription.id,
                        clientId: selectedClient.id,
                        comandaId: currentComandaId,
                    })
                    : [];
                const { data: { user } } = await supabase.auth.getUser();
                const shouldConsumeChefClub = !skipChefClubConsumption && chefClubConsumptionPayload.length > 0;
                const { error: rpcError } = shouldConsumeChefClub
                    ? await supabase.rpc('close_order_with_chef_club', {
                        p_comanda_id: currentComandaId,
                        p_tenant_id: resolvedTenantId,
                        p_consumptions: chefClubConsumptionPayload,
                        p_actor_id: user?.id || null,
                    })
                    : await supabase.rpc('close_order', { p_comanda_id: currentComandaId });

                if (rpcError) {
                    throw rpcError;
                }

                if (relatedAppointmentId) {
                    const { error: appointmentSyncError } = await client
                        .from('appointments')
                        .update({ status: 'completed' })
                        .eq('id', relatedAppointmentId)
                        .eq('tenant_id', resolvedTenantId);

                    if (appointmentSyncError) {
                        console.warn('Checkout finalized without appointment sync:', appointmentSyncError);
                    }
                }

                try {
                    const { error: transError } = await client.from('transactions').insert({
                        user_id: user?.id,
                        type: 'income',
                        category: incomeCategory,
                        amount: total,
                        description: paymentMethod === 'other' && paymentDescription
                            ? `${checkoutCopy.title} - Cliente: ${selectedClient.name} (${paymentDescription})`
                            : `${checkoutCopy.title} - Cliente: ${selectedClient.name}`,
                        payment_method: paymentMethod,
                        date: new Date().toISOString(),
                        tenant_id: resolvedTenantId,
                    });
                    if (transError) {
                        console.warn('Checkout finalized without transaction record:', transError);
                    }
                } catch (transactionError) {
                    console.warn('Checkout finalized but transaction logging failed:', transactionError);
                }

                // 4. Update Client Stats (Total Spent, Last Visit, Last Service)
                try {
                    const { data: clientData, error: clientFetchErr } = await client
                    .from('clients')
                    .select('total_spent')
                    .eq('id', selectedClient.id)
                    .eq('tenant_id', resolvedTenantId)
                    .single();

                    if (!clientFetchErr) {
                    const newTotal = (clientData?.total_spent || 0) + total;
                    const lastServiceStr = resolvedCart.length > 0 ? resolvedCart[0].name : '';

                    const { error: clientUpdateError } = await client.from('clients').update({
                        total_spent: newTotal,
                        last_visit: new Date().toISOString(),
                        last_service: lastServiceStr
                    }).eq('id', selectedClient.id).eq('tenant_id', resolvedTenantId);

                    if (clientUpdateError) {
                        console.warn('Checkout finalized without client stats update:', clientUpdateError);
                    }
                    } else {
                    console.warn('Checkout finalized without loading client stats:', clientFetchErr);
                    }
                } catch (clientStatsError) {
                    console.warn('Checkout finalized but client stats update failed:', clientStatsError);
                }
            }

            setToast({ message: paymentStatus === 'paid' ? checkoutCopy.successPaid : checkoutCopy.successOpen, type: 'success' });

            setTimeout(() => {
                if (checkoutEntryMode === 'pdv' && !comandaId) {
                    resetOperationalState();
                }
                navigate(checkoutCopy.redirectPath, { replace: true });
            }, 1500);

        } catch (err: any) {
            console.error('Save error details:', err);
            setToast({ message: err?.message ? `Erro: ${err.message}` : 'Erro ao salvar operação.', type: 'error' });
        } finally {
            finishLockRef.current = false;
            setLoading(false);
        }
    };

    const filteredItems = itemModalTab === 'services'
        ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="max-w-7xl mx-auto w-full animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span className="material-symbols-outlined text-4xl text-primary">point_of_sale</span>
                        {checkoutCopy.title}
                    </h1>
                    <p className="text-slate-500 mt-1">{checkoutCopy.subtitle}</p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{checkoutCopy.orderLabel}</p>
                    <p className="text-xl font-mono font-bold text-slate-900 dark:text-white">#{comandaId ? comandaId.slice(0, 8) : 'NOVO'}</p>
                </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-border-dark dark:bg-card-dark dark:text-slate-300">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    {checkoutEntryMode === 'edit_comanda' ? 'Fluxo de fechamento' : checkoutEntryMode === 'open_comanda' ? 'Fluxo de abertura de comanda' : 'Fluxo de caixa / pdv'}
                </p>
                <p className="mt-1 font-semibold text-slate-900 dark:text-white">{checkoutCopy.title}</p>
                <p className="mt-1">{checkoutCopy.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">

                {/* LEFT COLUMN: Client & Cart */}
                <div className="md:col-span-2 space-y-4 lg:space-y-6">

                    {/* 1. Client Selection */}
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="size-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-slate-400">person</span>
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

                        <div className="flex items-center gap-3 shrink-0">
                            {!selectedClient ? (
                                <button
                                    onClick={() => setIsClientModalOpen(true)}
                                    className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
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
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-sm min-h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">shopping_cart</span>
                                {checkoutCopy.itemSectionTitle}
                            </h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setItemModalTab('services'); setIsItemModalOpen(true); }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-bold transition-all"
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
                                        <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 dark:border-border-dark bg-white dark:bg-background-dark group hover:border-primary/30 transition-all">
                                            {/* Icon */}
                                            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'service' ? 'bg-blue-500/10 text-primary' : 'bg-amber-500/10 text-amber-500'}`}>
                                                <span className="material-symbols-outlined">{item.type === 'service' ? 'content_cut' : 'package_2'}</span>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{item.name}</p>

                                                {/* Professional Selector (Commission logic) */}
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold">Responsável:</span>
                                                    <select
                                                        value={item.staff_id || ''}
                                                        onChange={(e) => handleStaffChange(item.id, e.target.value)}
                                                        className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-300 border-none outline-none p-0 cursor-pointer hover:text-primary [color-scheme:light] dark:[color-scheme:dark]"
                                                    >
                                                        <option value="" className="bg-white dark:bg-[#1A1A1A] text-slate-400">Nenhum</option>
                                                        {staff.map(pro => (
                                                            <option key={pro.id} value={pro.id} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{pro.name}</option>
                                                        ))}
                                                    </select>
                                                    {(item.participants && item.participants.length > 0) ? (
                                                        <button
                                                            onClick={() => { setSelectedItemForParticipants(item.id); setIsParticipantsModalOpen(true); }}
                                                            className="ml-1 p-1 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                                                            title="Execução compartilhada"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">group</span>
                                                        </button>
                                                    ) : item.type === 'service' ? (
                                                        <button
                                                            onClick={() => { setSelectedItemForParticipants(item.id); setIsParticipantsModalOpen(true); }}
                                                            className="ml-1 p-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-primary hover:bg-primary/10"
                                                            title="Adicionar execução compartilhada"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">person_add</span>
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Price */}
                                            <div className="text-right flex flex-col items-end gap-1">
                                                {resolvedCart.find((resolvedItem) => resolvedItem.id === item.id)?.eligibilityReason && (
                                                    <p className="max-w-[180px] text-right text-[10px] font-bold text-slate-400">
                                                        {resolvedCart.find((resolvedItem) => resolvedItem.id === item.id)?.eligibilityReason}
                                                    </p>
                                                )}
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
                                                {resolvedCart.find((resolvedItem) => resolvedItem.id === item.id)?.appliedBenefit && (
                                                    <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                                                        <span className="material-symbols-outlined text-[12px]">workspace_premium</span>
                                                        {resolvedCart.find((resolvedItem) => resolvedItem.id === item.id)?.appliedBenefit?.benefitLabel}
                                                    </div>
                                                )}
                                                {item.type === 'service' && chefClubContext?.subscription && (
                                                    <button
                                                        onClick={() => handleToggleChefClubBenefit(item.id)}
                                                        disabled={!resolvedCart.find((resolvedItem) => resolvedItem.id === item.id)?.isEligible}
                                                        className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${resolvedCart.find((resolvedItem) => resolvedItem.id === item.id)?.appliedBenefit ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-xs">workspace_premium</span>
                                                        {resolvedCart.find((resolvedItem) => resolvedItem.id === item.id)?.appliedBenefit ? 'Usando Benefício' : 'Usar Benefício'}
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
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <span className="material-symbols-outlined text-6xl mb-4">remove_shopping_cart</span>
                                    <p className="text-sm font-medium">{checkoutCopy.emptyCartMessage}</p>
                                    <p className="hidden text-sm font-medium">O carrinho está vazio</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <ChefClubSummary
                        context={chefClubContext}
                        appliedItems={chefClubSummary.appliedItems}
                        savingsTotal={savingsTotal}
                    />
                </div>

                {/* RIGHT COLUMN: Payment */}
                <div className="space-y-6 md:col-span-1">
                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 shadow-xl sticky top-24">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400">receipt_long</span>
                            {checkoutCopy.summaryTitle}
                        </h3>

                        {/* Payment Status Toggle */}
                        <div className="mb-6">
                            <label className="hidden text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Ação do Pedido</label>
                            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{checkoutCopy.actionToggleLabel}</p>
                            <div className="flex bg-slate-100 dark:bg-background-dark p-1 rounded-xl">
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

                        <div className="space-y-4 mb-6">
                            {chefClubContext?.subscription && paymentStatus === 'paid' && (
                                <label className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                                    <input
                                        type="checkbox"
                                        checked={skipChefClubConsumption}
                                        onChange={(e) => setSkipChefClubConsumption(e.target.checked)}
                                        className="mt-0.5 size-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                    />
                                    <span>
                                        <span className="block text-xs font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                                            Fechamento retroativo
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">
                                            Fecha a comanda com beneficios do plano sem consumir o saldo atual do cliente. Use para comandas antigas de ciclos anteriores.
                                        </span>
                                    </span>
                                </label>
                            )}
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                <span>Subtotal original</span>
                                <span className="font-bold text-slate-900 dark:text-white">R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                                <span>Benefícios Clube do Chefe</span>
                                <span className="font-bold text-amber-600">- R$ {savingsTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                                <span>Desconto manual (R$)</span>
                                <input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    className="w-20 text-right bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded px-2 py-1 text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="h-px bg-slate-200 dark:bg-border-dark border-dashed"></div>
                            <div className="flex justify-between items-end">
                                <span className="font-bold text-lg text-slate-900 dark:text-white">Total a pagar</span>
                                <span className="font-black text-3xl text-primary tracking-tighter">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {paymentStatus === 'paid' && (
                            <div className="mb-8 animate-fade-in">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Forma de Pagamento</label>
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
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${paymentMethod === method.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25' : 'bg-slate-50 dark:bg-background-dark border-slate-200 dark:border-border-dark text-slate-500 hover:border-primary/50'}`}
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
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Nao encontrou o produto?</p>
                                <p className="text-xs text-slate-500">Cadastre agora e ele ja entra na venda.</p>
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
                                <p className="text-sm font-bold text-slate-900 dark:text-white">Nao encontrou o servico?</p>
                                <p className="text-xs text-slate-500">Cadastre agora e ele ja entra na venda.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenQuickServiceModal}
                                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90"
                            >
                                + Novo Servico
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
                                        Cadastrar servico agora
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
                                {filteredItems.map((item: any) => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleAddItem(item, itemModalTab === 'services' ? 'service' : 'product')}
                                        className="w-full flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`size-9 rounded-lg flex items-center justify-center ${itemModalTab === 'services' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500'
                                                }`}>
                                                <span className="material-symbols-outlined text-lg">
                                                    {itemModalTab === 'services' ? 'content_cut' : 'package_2'}
                                                </span>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-slate-900 dark:text-white text-sm">{item.name}</p>
                                                {item.description && <p className="text-xs text-slate-500 truncate max-w-[220px]">{item.description}</p>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                R$ {Number(item.price ?? item.sale_price ?? 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isQuickProductModalOpen}
                onClose={handleCloseQuickProductModal}
                title="Cadastrar Produto"
                maxWidth="lg"
            >
                <form onSubmit={handleCreateProductDuringCheckout} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Nome do Produto</label>
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
                        <label className="text-xs font-bold uppercase text-slate-500">Descricao</label>
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
                title="Cadastrar Servico"
                maxWidth="lg"
            >
                <form onSubmit={handleCreateServiceDuringCheckout} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase text-slate-500">Nome do Servico</label>
                        <input
                            autoFocus
                            required
                            type="text"
                            value={quickServiceForm.name}
                            onChange={(e) => setQuickServiceForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
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
                            <label className="text-xs font-bold uppercase text-slate-500">Duracao (min)</label>
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
                            Servico ativo
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

            <Modal
                isOpen={isParticipantsModalOpen}
                onClose={() => { setIsParticipantsModalOpen(false); setSelectedItemForParticipants(null); }}
                title="Execução Compartilhada"
                maxWidth="md"
            >
                {selectedItemForParticipants && (
                    <ParticipantsEditor
                        item={cart.find(i => i.id === selectedItemForParticipants)}
                        staff={staff}
                        onSave={(participants) => {
                            setCart(prev => prev.map(item => 
                                item.id === selectedItemForParticipants 
                                    ? { ...item, participants }
                                    : item
                            ));
                            setIsParticipantsModalOpen(false);
                            setSelectedItemForParticipants(null);
                        }}
                        onCancel={() => { setIsParticipantsModalOpen(false); setSelectedItemForParticipants(null); }}
                    />
                )}
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

interface ParticipantsEditorProps {
    item?: CartItem;
    staff: Staff[];
    onSave: (participants: ServiceExecutionParticipant[]) => void;
    onCancel: () => void;
}

const ParticipantsEditor: React.FC<ParticipantsEditorProps> = ({ item, staff, onSave, onCancel }) => {
    const [participants, setParticipants] = useState<ServiceExecutionParticipant[]>([]);
    const [primaryStaffId, setPrimaryStaffId] = useState(item?.staff_id || '');

    useEffect(() => {
        if (item?.participants && item.participants.length > 0) {
            setParticipants(item.participants);
            const primary = item.participants.find(p => p.role === 'primary');
            if (primary) setPrimaryStaffId(primary.staff_id);
        } else if (item?.staff_id) {
            setParticipants([{
                id: crypto.randomUUID(),
                staff_id: item.staff_id,
                role: 'primary',
                payout_type: 'percentage',
                payout_value: 100,
                affects_revenue: true,
                affects_commission: true,
            }]);
        }
    }, [item]);

    const handleAddParticipant = () => {
        setParticipants(prev => [...prev, {
            id: crypto.randomUUID(),
            staff_id: '',
            role: 'assistant',
            payout_type: 'percentage',
            payout_value: 0,
            affects_revenue: false,
            affects_commission: true,
        }]);
    };

    const handleRemoveParticipant = (id: string) => {
        setParticipants(prev => prev.filter(p => p.id !== id));
    };

    const handleUpdateParticipant = (id: string, field: keyof ServiceExecutionParticipant, value: any) => {
        setParticipants(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const calculatePreview = () => {
        if (!item) return { total: 0, breakdown: [] as { name: string; value: number; role: string }[] };
        
        const total = item.price * item.quantity;
        const breakdown = participants.map(p => {
            const amount = p.payout_type === 'percentage' 
                ? total * (p.payout_value / 100)
                : p.payout_value;
            const staffMember = staff.find(s => s.id === p.staff_id);
            return {
                name: staffMember?.name || 'Profissional',
                value: amount,
                role: p.role,
            };
        });
        
        return { total, breakdown };
    };

    const preview = calculatePreview();
    const totalPercentage = participants.reduce((sum, p) => p.payout_type === 'percentage' ? sum + p.payout_value : sum, 0);

    return (
        <div className="space-y-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-bold">{item?.name}</span> - {item?.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} x {item?.quantity}
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500">Profissional Principal</label>
                <select
                    value={primaryStaffId}
                    onChange={(e) => {
                        setPrimaryStaffId(e.target.value);
                        setParticipants(prev => {
                            const primaryExists = prev.find(p => p.role === 'primary');
                            if (primaryExists) {
                                return prev.map(p => p.role === 'primary' ? { ...p, staff_id: e.target.value } : p);
                            }
                            return [...prev, {
                                id: crypto.randomUUID(),
                                staff_id: e.target.value,
                                role: 'primary',
                                payout_type: 'percentage',
                                payout_value: 100,
                                affects_revenue: true,
                                affects_commission: true,
                            }];
                        });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark"
                >
                    <option value="">Selecione...</option>
                    {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            <div className="border-t border-slate-200 dark:border-border-dark pt-4">
                <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold uppercase text-slate-500">Participantes</label>
                    <button
                        type="button"
                        onClick={handleAddParticipant}
                        className="text-xs text-primary hover:text-primary/80 font-bold flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Adicionar
                    </button>
                </div>

                {participants.filter(p => p.role !== 'primary').map((participant, idx) => (
                    <div key={participant.id} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-white/5 rounded-lg mb-2">
                        <select
                            value={participant.staff_id}
                            onChange={(e) => handleUpdateParticipant(participant.id, 'staff_id', e.target.value)}
                            className="flex-1 rounded border border-slate-200 bg-white p-2 text-sm dark:border-border-dark dark:bg-background-dark"
                        >
                            <option value="">Selecione...</option>
                            {staff.filter(s => s.id !== primaryStaffId).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <select
                            value={participant.payout_type}
                            onChange={(e) => handleUpdateParticipant(participant.id, 'payout_type', e.target.value)}
                            className="w-24 rounded border border-slate-200 bg-white p-2 text-xs dark:border-border-dark dark:bg-background-dark"
                        >
                            <option value="percentage">%</option>
                            <option value="fixed">R$</option>
                        </select>
                        <input
                            type="number"
                            value={participant.payout_value}
                            onChange={(e) => handleUpdateParticipant(participant.id, 'payout_value', Number(e.target.value))}
                            className="w-20 rounded border border-slate-200 bg-white p-2 text-sm text-right dark:border-border-dark dark:bg-background-dark"
                            placeholder="0"
                        />
                        <button
                            type="button"
                            onClick={() => handleRemoveParticipant(participant.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                            <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                ))}
            </div>

            {totalPercentage > 100 && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    Atenção: O total de percentuais excede 100%
                </div>
            )}

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-xs font-bold uppercase text-emerald-700 mb-2">Preview Financeiro</p>
                <div className="space-y-1">
                    {preview.breakdown.map((b, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-600">{b.name} ({b.role})</span>
                            <span className="font-bold text-slate-900">{b.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    ))}
                    <div className="border-t border-emerald-200 mt-2 pt-2 flex justify-between">
                        <span className="font-bold text-emerald-800">Total</span>
                        <span className="font-bold text-emerald-800">{preview.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 dark:border-border-dark dark:text-slate-300 dark:hover:bg-white/5"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={() => onSave(participants)}
                    className="flex-1 py-3 rounded-lg bg-primary text-white font-bold hover:bg-primary/90"
                    disabled={!primaryStaffId}
                >
                    Salvar
                </button>
            </div>
        </div>
    );
};

export default Checkout;
