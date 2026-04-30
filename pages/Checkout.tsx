import React, { useState, useEffect, useCallback } from 'react';
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
    price: number;
    quantity: number;
    service_id?: string;
    product_id?: string;
    staff_id?: string;
    usedCredit?: boolean;
    execution_participants?: CartParticipant[];
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

interface Staff {
    id: string;
    name: string;
}

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

const toMonthInputValue = (value?: string | null) => {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const serviceCategories = ['Cabelo', 'Barba', 'Combo', 'Quimica', 'Acabamento', 'Outros'];

const Checkout: React.FC = () => {
    const { id: comandaId } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { appSlug, schema, tenantId } = useAuth();
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
                orderLabel: 'Operação',
                clientRequiredError: 'Selecione um cliente para concluir a operação.',
                clientEmptyTitle: 'Cliente não selecionado',
                clientEmptyHelper: 'Obrigatório para concluir a operação no fluxo atual.',
                itemSectionTitle: 'Itens da Operação',
                actionToggleLabel: 'Ação da operação',
                primaryPaidLabel: 'Concluir venda',
                primaryOpenLabel: 'Salvar aberta',
                successPaid: 'Venda realizada com sucesso!',
                successOpen: 'Operação salva em aberto!',
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
    const [closureMode, setClosureMode] = useState<ClosureMode>('standard');
    const [closureNote, setClosureNote] = useState('');
    const [legacyReferenceMonth, setLegacyReferenceMonth] = useState('');
    const [discount, setDiscount] = useState<string>('0');
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [isSharedExecutionModalOpen, setIsSharedExecutionModalOpen] = useState(false);
    const [sharedExecutionItemId, setSharedExecutionItemId] = useState<string | null>(null);
    const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
    const [isQuickServiceModalOpen, setIsQuickServiceModalOpen] = useState(false);
    const [itemModalTab, setItemModalTab] = useState<'services' | 'products'>('services');
    const [searchTerm, setSearchTerm] = useState('');
    const [quickProductForm, setQuickProductForm] = useState<QuickProductForm>(createInitialQuickProductForm);
    const [quickServiceForm, setQuickServiceForm] = useState<QuickServiceForm>(createInitialQuickServiceForm);
    const [isSavingQuickProduct, setIsSavingQuickProduct] = useState(false);
    const [isSavingQuickService, setIsSavingQuickService] = useState(false);

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
    const supportsOpenComandaState = checkoutEntryMode !== 'pdv';
    const incomeCategory = checkoutEntryMode === 'pdv'
        ? 'Venda de Balcao'
        : checkoutEntryMode === 'open_comanda'
            ? 'Fechamento de Comanda'
            : 'Fechamento de Atendimento';
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const discountValue = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - discountValue);
    const isLegacyClubSettlement = paymentStatus === 'paid' && closureMode === 'legacy_membership';
    const shouldApplyFinancialEffects = paymentStatus === 'paid' && !isLegacyClubSettlement;
    const shouldDeductMembershipCredits = paymentStatus === 'paid' && !isLegacyClubSettlement;

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
        setClosureMode('standard');
        setClosureNote('');
        setLegacyReferenceMonth('');
        setChefClubInfo(null);
        setDuplicateComanda(null);
        setPendingClient(null);
        setShowDuplicateModal(false);
        setSearchTerm('');
        setRelatedAppointmentId(null);
        setPaymentStatus(checkoutEntryMode === 'open_comanda' ? 'pending' : 'paid');
        resetComandaRequestKey();
    }, [checkoutEntryMode, comandaId]);

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
            const client = getScopedClient(currentAppSlug);

            const [clientsRes, staffRes, servicesRes, productsRes, promoRes] = await Promise.all([
                client.from('clients').select('id, name, avatar, phone').eq('tenant_id', resolvedTenantId).order('name'),
                client.from('staff').select('id, name').eq('tenant_id', resolvedTenantId).eq('status', 'active'),
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

                    const mappedItems: CartItem[] = (comandaItems || []).map((item: any) => ({
                        id: item.id,
                        dbId: item.id,
                        type: item.service_id ? 'service' : 'product',
                        name: item.product_name,
                        price: item.unit_price,
                        quantity: item.quantity,
                        service_id: item.service_id,
                        product_id: item.product_id,
                        staff_id: item.staff_id
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
    }, [appSlug, comandaId, schema, tenantId]);

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

    // Calculations
    const appliedCreditsCount = cart.filter(item => item.usedCredit).length;

    // Duplicate client check
    const handleSelectClient = async (client: Client) => {
        setIsClientModalOpen(false);
        if (!tenantId) {
            setToast({ message: 'Tenant invalido para selecionar cliente.', type: 'error' });
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
            const clientDb = getScopedClient(currentAppSlug);

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

            if (pendingClient) setSelectedClient(pendingClient);

        const targetClient = pendingClient || client;
        setSelectedClient(targetClient);
        const { data: sub, error: subError } = await clientDb
            .from('customer_subscriptions')
            .select('id, plan_id')
                .eq('client_id', targetClient.id)
                .eq('tenant_id', resolvedTenantId)
                .eq('status', 'active')
                .maybeSingle();

            if (subError) throw subError;

            if (sub) {
                const [{ data: plan, error: planError }, { data: credits, error: creditsError }] = await Promise.all([
                    clientDb
                        .from('customer_plans')
                        .select('name')
                        .eq('id', sub.plan_id)
                        .eq('tenant_id', resolvedTenantId)
                        .maybeSingle(),
                    clientDb
                        .from('customer_credits')
                        .select('available_credits, used_credits, service_balance_map')
                        .eq('subscription_id', sub.id)
                        .eq('tenant_id', resolvedTenantId)
                        .maybeSingle(),
                ]);

                if (planError) throw planError;
                if (creditsError) throw creditsError;

                const serviceBalances = normalizeCreditBalances(
                    credits?.service_balance_map,
                    credits?.available_credits || 0,
                    credits?.used_credits || 0,
                );

                setChefClubInfo({
                    id: sub.id,
                    planName: plan?.name || 'Plano ativo',
                    credits: getTotalAvailableCredits(serviceBalances),
                    serviceBalances,
                });
            } else {
                setChefClubInfo(null);
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
        const canSuggestCredit = type === 'service' && !!chefClubInfo;
        const creditsForService = canSuggestCredit
            ? getAvailableCreditsForService(chefClubInfo?.serviceBalances || [], item.id)
            : 0;
        const usedCreditsForService = cart.filter((cartItem) => cartItem.usedCredit && cartItem.service_id === item.id).length;
        const hasCreditsAvailable = canSuggestCredit && usedCreditsForService < creditsForService;
        const shouldUseCredit = !!(hasCreditsAvailable && window.confirm('Cliente assinante detectado. Aplicar 1 crédito neste serviço agora?'));

        const newItem: CartItem = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            name: item.name || 'Item sem nome',
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

        setCart([...cart, newItem]);
        setSearchTerm('');
        setIsItemModalOpen(false);
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
            setToast({ message: 'Tenant invalido para cadastrar produto.', type: 'error' });
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
            const client = getScopedClient(currentAppSlug);

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
            const currentAppSlug = ensureAppSupportsModule(appSlug, 'services', ['barber']);
            const { tenantId: resolvedTenantId } = requireTenantContext({
                tenantId,
                appSlug: currentAppSlug,
                schema,
                table: 'services',
                operation: 'create service during checkout',
            });
            const client = getScopedClient(currentAppSlug);

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
        setCart(cart.map(item => item.id === itemId ? { ...item, staff_id: proId } : item));
    };

    const handlePriceChange = (itemId: string, newPrice: string) => {
        const floatPrice = parseFloat(newPrice);
        setCart(cart.map(item => item.id === itemId ? { ...item, price: isNaN(floatPrice) ? 0 : floatPrice } : item));
    };

    const calculateParticipantPayout = (itemUnitPrice: number, participant: CartParticipant): number => {
        if (participant.payout_type === 'percentage') {
            return itemUnitPrice * (participant.payout_value / 100);
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
        if (isLegacyClubSettlement && !legacyReferenceMonth) {
            setToast({ message: 'Informe o mes de referencia para a baixa administrativa do Clube.', type: 'info' });
            finishLockRef.current = false;
            return;
        }
        if (!tenantId) {
            setToast({ message: 'Tenant inválido para finalizar operação.', type: 'error' });
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
            const client = getScopedClient(currentAppSlug);
            let currentComandaId = comandaId;
            const assignedStaffIds = Array.from(new Set(cart.map(item => item.staff_id).filter(Boolean))) as string[];
            const comandaStaffId = assignedStaffIds.length === 1 ? assignedStaffIds[0] : null;

            // 1. Create or Update Comanda
            const comandaData: any = {
                client_id: selectedClient.id,
                staff_id: comandaStaffId,
                appointment_id: relatedAppointmentId,
                status: paymentStatus === 'paid' ? 'paid' : 'open',
                total: total,
                discount: discountValue,
                payment_method: paymentStatus === 'paid'
                    ? (shouldApplyFinancialEffects ? paymentMethod : 'other')
                    : null,
                closure_mode: paymentStatus === 'paid' ? closureMode : 'standard',
                closure_note: paymentStatus === 'paid' && isLegacyClubSettlement ? (closureNote.trim() || null) : null,
                financial_effect: paymentStatus === 'paid' ? shouldApplyFinancialEffects : true,
                membership_credit_effect: paymentStatus === 'paid' ? shouldDeductMembershipCredits : true,
                legacy_reference_month: paymentStatus === 'paid' && isLegacyClubSettlement
                    ? `${legacyReferenceMonth}-01`
                    : null,
                closed_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
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
                                professional_id: p.professional_id,
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
                            professional_id: item.staff_id,
                            role: 'primary',
                            payout_type: 'percentage',
                            payout_value: 40,
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
            if (paymentStatus === 'paid') {
                const { error: updateError } = await client
                    .from('comandas')
                    .update({
                        status: 'paid',
                        closure_mode: closureMode,
                        closure_note: isLegacyClubSettlement ? (closureNote.trim() || null) : null,
                        financial_effect: shouldApplyFinancialEffects,
                        membership_credit_effect: shouldDeductMembershipCredits,
                        legacy_reference_month: isLegacyClubSettlement ? `${legacyReferenceMonth}-01` : null,
                        closed_at: new Date().toISOString(),
                    })
                    .eq('id', currentComandaId);

                if (updateError) {
                    console.warn('Error updating comanda status:', updateError);
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

                if (shouldApplyFinancialEffects) {
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
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
                            tenant_id: resolvedTenantId
                        });
                        if (transError) {
                            console.warn('Checkout finalized without transaction record:', transError);
                        }
                    } catch (transactionError) {
                        console.warn('Checkout finalized but transaction logging failed:', transactionError);
                    }

                    try {
                        const { data: clientData, error: clientFetchErr } = await client
                            .from('clients')
                            .select('total_spent')
                            .eq('id', selectedClient.id)
                            .eq('tenant_id', resolvedTenantId)
                            .single();

                        if (!clientFetchErr) {
                            const newTotal = (clientData?.total_spent || 0) + total;
                            const lastServiceStr = cart.length > 0 ? cart[0].name : '';

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
            }

            // 5. Deduct Chef Club Credits if used
            const creditItems = cart.filter(item => item.usedCredit && item.type === 'service' && item.service_id);
            if (shouldDeductMembershipCredits && creditItems.length > 0 && chefClubInfo) {
                for (const creditItem of creditItems) {
                    const { error: creditErr } = await supabase.rpc('deduct_chef_club_credits', {
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
                    ? 'Comanda baixada no modo administrativo do Clube sem impactar financeiro nem creditos atuais.'
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
                                                    {item.type === 'service' && (
                                                        <button
                                                            onClick={() => { setSharedExecutionItemId(item.id); setIsSharedExecutionModalOpen(true); }}
                                                            className={`ml-1 p-1 rounded transition-all ${(item.execution_participants?.length ?? 0) > 0 ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-primary hover:bg-primary/10'}`}
                                                            title="Execução compartilhada"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">group_add</span>
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
                                                                    {p.payout_type === 'percentage' && ` (${p.payout_value}%)`}
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
                                                        className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter transition-all ${(item as any).usedCredit ? 'bg-amber-500 text-white' : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'}`}
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
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <span className="material-symbols-outlined text-6xl mb-4">remove_shopping_cart</span>
                                    <p className="text-sm font-medium">{checkoutCopy.emptyCartMessage}</p>
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

                        {paymentStatus === 'paid' && (chefClubInfo || closureMode === 'legacy_membership') && (
                            <div className="mb-6 space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Modo de fechamento</p>
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
                                        <p className="text-sm font-black">Fechamento padrao</p>
                                        <p className="mt-1 text-xs">Lanca o financeiro normalmente e consome os creditos aplicados nesta comanda.</p>
                                    </button>
                                    <button
                                        onClick={() => setClosureMode('legacy_membership')}
                                        className={`rounded-xl border px-4 py-3 text-left transition-all ${closureMode === 'legacy_membership'
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                            : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-background-dark dark:text-slate-300'
                                            }`}
                                    >
                                        <p className="text-sm font-black">Baixa administrativa do Clube</p>
                                        <p className="mt-1 text-xs">Fecha a comanda sem gerar nova receita e sem afetar os creditos atuais do assinante.</p>
                                    </button>
                                </div>

                                {closureMode === 'legacy_membership' && (
                                    <div className="space-y-3 rounded-xl border border-amber-500/20 bg-white/80 p-3 dark:bg-white/5">
                                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                            Esse modo e indicado para regularizar comandas abertas de clientes que ja estavam no Clube em um ciclo anterior.
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Mes de referencia</label>
                                            <input
                                                type="month"
                                                value={legacyReferenceMonth}
                                                onChange={(e) => setLegacyReferenceMonth(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Observacao interna</label>
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
                            <div className="h-px bg-slate-200 dark:bg-border-dark border-dashed"></div>
                            <div className="flex justify-between items-end">
                                <span className="font-bold text-lg text-slate-900 dark:text-white">Total</span>
                                <span className="font-black text-3xl text-primary tracking-tighter">R$ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        {shouldApplyFinancialEffects && (
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

                        {isLegacyClubSettlement && (
                            <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
                                O fechamento sera apenas operacional. Nenhum lancamento novo sera enviado ao financeiro e nenhum credito atual sera abatido.
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
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                                <p className="text-xs text-slate-500">Valor: R$ {item.price.toFixed(2)}</p>
                            </div>

                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase">Participantes</p>
                                
                                {item.execution_participants?.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-white/5 rounded-lg">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white">{p.professional_name || 'Profissional'}</p>
                                            <p className="text-[10px] text-slate-500">{p.role === 'primary' ? 'Principal' : p.role === 'assistant' ? 'Apoio' : 'Coexecutor'} • {p.payout_value}{p.payout_type === 'percentage' ? '%' : 'R$'}</p>
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
