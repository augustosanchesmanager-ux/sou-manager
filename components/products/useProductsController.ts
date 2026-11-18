import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenantOptional } from '../../src/context/TenantContext';
import { staffRepository } from '../../domain/staff/repository';
import type { StaffMember } from '../../domain/staff/types';
import { stockRepository } from '../../domain/stock/stockRepository';
import {
    calculateWeightedAverageCost,
    calculateInventoryDiscrepancy,
    filterStockByTab,
    isStockLow,
} from '../../domain/stock/stockEngine';
import type {
    ProductStockItem,
    InventoryAuditItem,
} from '../../domain/stock/types';
import type {
    StockTab,
    StockStatusFilter,
    ProductsMetrics,
    ProductFormState,
    PurchaseFormState,
    ConsumptionFormState,
} from './types';

export interface ToastMessage {
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface UseProductsControllerReturn {
    activeTab: StockTab;
    products: ProductStockItem[];
    staffList: StaffMember[];
    loading: boolean;
    searchTerm: string;
    categoryFilter: string;
    toast: ToastMessage | null;
    stockStatusFilter: StockStatusFilter;
    categories: string[];
    filteredProducts: ProductStockItem[];
    potentialSaleValue: number;
    metrics: ProductsMetrics;
    isProductModalOpen: boolean;
    isPurchaseModalOpen: boolean;
    isConsumptionModalOpen: boolean;
    isSuppliersModalOpen: boolean;
    isPinModalOpen: boolean;
    editingProduct: ProductStockItem | null;
    productForm: ProductFormState;
    purchaseForm: PurchaseFormState;
    consumptionForm: ConsumptionFormState;
    selectedPurchaseProduct: ProductStockItem | undefined;
    previewNewCost: number;
    auditItems: InventoryAuditItem[];
    auditCounts: Record<string, number>;
    auditDiscrepanciesCount: number;
    totalAuditDifferenceValue: number;
    managerPin: string;
    pinError: string;
    isSubmittingAudit: boolean;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    setCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
    setToast: React.Dispatch<React.SetStateAction<ToastMessage | null>>;
    setStockStatusFilter: React.Dispatch<React.SetStateAction<StockStatusFilter>>;
    setIsProductModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsPurchaseModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsConsumptionModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsSuppliersModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsPinModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setProductForm: React.Dispatch<React.SetStateAction<ProductFormState>>;
    setPurchaseForm: React.Dispatch<React.SetStateAction<PurchaseFormState>>;
    setConsumptionForm: React.Dispatch<React.SetStateAction<ConsumptionFormState>>;
    setManagerPin: React.Dispatch<React.SetStateAction<string>>;
    setPinError: React.Dispatch<React.SetStateAction<string>>;
    handleTabChange: (tab: StockTab) => void;
    handleToggleLowStockFilter: () => void;
    handleOpenNewProduct: () => void;
    handleOpenEditProduct: (prod: ProductStockItem) => void;
    handleSaveProduct: (e: React.FormEvent) => Promise<void>;
    handleDeleteProduct: (prod: ProductStockItem) => Promise<void>;
    handleOpenPurchase: (defaultProductId?: string) => void;
    handleSavePurchase: (e: React.FormEvent) => Promise<void>;
    handleOpenConsumption: (defaultProductId?: string) => void;
    handleSaveConsumption: (e: React.FormEvent) => Promise<void>;
    handleAuditCountChange: (productId: string, val: string) => void;
    handleStartAuditApply: () => void;
    handleConfirmAuditWithPin: (e: React.FormEvent) => Promise<void>;
}

const getErrorMessage = (err: unknown, fallback: string): string => {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
        const msg = (err as { message?: unknown }).message;
        if (typeof msg === 'string' && msg) return msg;
    }
    return fallback;
};

export function useProductsController(): UseProductsControllerReturn {
    const { tenantId: authTenantId } = useAuth();
    const tenantCtx = useTenantOptional();
    const activeTenantId = authTenantId || tenantCtx?.tenant?.id || 'demo-tenant';

    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as StockTab) || 'sale';

    // Estados principais
    const [activeTab, setActiveTab] = useState<StockTab>(initialTab);
    const [products, setProducts] = useState<ProductStockItem[]>([]);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('all');

    // Modais
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
    const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductStockItem | null>(null);

    // Formulário de Produto
    const [productForm, setProductForm] = useState<ProductFormState>({
        name: '',
        description: '',
        category: 'Geral',
        brand: '',
        cost_price: 0,
        sale_price: 0,
        commission_rate: 0,
        stock_quantity: 0,
        minimum_stock: 5,
        purpose: 'sale',
        supplier_name: '',
        active: true,
    });

    // Formulário de Compra
    const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>({
        productId: '',
        quantity: 1,
        unitCost: 0,
        supplierName: '',
        invoiceNumber: '',
        notes: '',
    });

    // Formulário de Consumo Interno de Bancada
    const [consumptionForm, setConsumptionForm] = useState<ConsumptionFormState>({
        productId: '',
        staffId: '',
        quantity: 1,
        notes: '',
    });

    // Estado da Conferência / Auditoria Física
    const [auditCounts, setAuditCounts] = useState<Record<string, number>>({});
    const [managerPin, setManagerPin] = useState('');
    const [pinError, setPinError] = useState('');
    const [isSubmittingAudit, setIsSubmittingAudit] = useState(false);

    // Carregamento de dados
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [prods, staff] = await Promise.all([
                stockRepository.listProducts(activeTenantId),
                staffRepository.list(activeTenantId).catch(() => []),
            ]);
            setProducts(prods);
            setStaffList(staff);

            // Inicializa contagem de auditoria com os valores atuais de estoque
            const initialAudit: Record<string, number> = {};
            prods.forEach(p => {
                initialAudit[p.id] = p.stock_quantity;
            });
            setAuditCounts(initialAudit);
        } catch (err) {
            console.error('Erro ao carregar dados do estoque:', err);
            setToast({ message: 'Erro ao carregar dados do estoque', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeTenantId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleTabChange = (tab: StockTab) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    const handleToggleLowStockFilter = () => {
        setStockStatusFilter((prev) => (prev === 'low' ? 'all' : 'low'));
    };

    // Filtros e Derivações
    const categories = useMemo(() => {
        const set = new Set<string>();
        products.forEach(p => {
            if (p.category) set.add(p.category);
        });
        return Array.from(set);
    }, [products]);

    const filteredProducts = useMemo(() => {
        let list = filterStockByTab(products, activeTab);

        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase();
            list = list.filter(p =>
                p.name.toLowerCase().includes(query) ||
                (p.brand && p.brand.toLowerCase().includes(query)) ||
                (p.supplier_name && p.supplier_name.toLowerCase().includes(query))
            );
        }

        if (categoryFilter !== 'all') {
            list = list.filter(p => p.category === categoryFilter);
        }

        if (stockStatusFilter === 'out') {
            list = list.filter(p => p.stock_quantity <= 0);
        } else if (stockStatusFilter === 'low') {
            list = list.filter(p => p.stock_quantity > 0 && isStockLow(p));
        }

        return list;
    }, [products, activeTab, searchTerm, categoryFilter, stockStatusFilter]);

    const potentialSaleValue = useMemo(() => {
        return products.reduce((sum, p) => {
            if (p.purpose === 'internal_use') return sum;
            return sum + Math.max(0, p.stock_quantity) * Number(p.sale_price || 0);
        }, 0);
    }, [products]);

    // Métricas Resumo
    const metrics: ProductsMetrics = useMemo(() => {
        const totalItems = products.length;
        const totalStockValue = products.reduce((acc, p) => acc + (p.stock_quantity * p.cost_price), 0);
        const internalUseCount = products.filter(p => p.purpose === 'internal_use' || p.purpose === 'both').length;
        const lowStockCount = products.filter(p => isStockLow(p)).length;

        return { totalItems, totalStockValue, internalUseCount, lowStockCount };
    }, [products]);

    // Handlers do Modal de Produto
    const handleOpenNewProduct = () => {
        setEditingProduct(null);
        setProductForm({
            name: '',
            description: '',
            category: 'Geral',
            brand: '',
            cost_price: 0,
            sale_price: 0,
            commission_rate: 0,
            stock_quantity: 0,
            minimum_stock: 5,
            purpose: activeTab === 'internal_use' ? 'internal_use' : 'sale',
            supplier_name: '',
            active: true,
        });
        setIsProductModalOpen(true);
    };

    const handleOpenEditProduct = (prod: ProductStockItem) => {
        setEditingProduct(prod);
        setProductForm({
            name: prod.name,
            description: prod.description || '',
            category: prod.category || 'Geral',
            brand: prod.brand || '',
            cost_price: prod.cost_price,
            sale_price: prod.sale_price,
            commission_rate: prod.commission_rate || 0,
            stock_quantity: prod.stock_quantity,
            minimum_stock: prod.minimum_stock,
            purpose: prod.purpose,
            supplier_name: prod.supplier_name || '',
            active: prod.active,
        });
        setIsProductModalOpen(true);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!productForm.name.trim()) {
            setToast({ message: 'Nome do produto é obrigatório', type: 'error' });
            return;
        }

        try {
            await stockRepository.saveProduct({
                id: editingProduct?.id,
                tenant_id: activeTenantId,
                name: productForm.name.trim(),
                description: productForm.description,
                category: productForm.category,
                brand: productForm.brand,
                cost_price: Number(productForm.cost_price),
                sale_price: Number(productForm.sale_price),
                commission_rate: Number(productForm.commission_rate),
                stock_quantity: Number(productForm.stock_quantity),
                minimum_stock: Number(productForm.minimum_stock),
                purpose: productForm.purpose,
                supplier_name: productForm.supplier_name,
                active: productForm.active,
            });

            setToast({
                message: editingProduct ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!',
                type: 'success',
            });
            setIsProductModalOpen(false);
            loadData();
        } catch (err: unknown) {
            setToast({ message: getErrorMessage(err, 'Erro ao salvar produto'), type: 'error' });
        }
    };

    const handleDeleteProduct = async (prod: ProductStockItem) => {
        if (!window.confirm(`Tem certeza que deseja remover o produto "${prod.name}"?`)) {
            return;
        }
        try {
            await stockRepository.deleteProduct(activeTenantId, prod.id);
            setToast({ message: 'Produto removido com sucesso', type: 'success' });
            loadData();
        } catch (err: unknown) {
            setToast({ message: getErrorMessage(err, 'Erro ao excluir produto'), type: 'error' });
        }
    };

    // Handlers de Entrada de Compra
    const handleOpenPurchase = (defaultProductId?: string) => {
        const prod = products.find(p => p.id === defaultProductId) || products[0];
        setPurchaseForm({
            productId: prod ? prod.id : '',
            quantity: 1,
            unitCost: prod ? prod.cost_price : 0,
            supplierName: prod?.supplier_name || '',
            invoiceNumber: '',
            notes: '',
        });
        setIsPurchaseModalOpen(true);
    };

    const selectedPurchaseProduct = useMemo(() => {
        return products.find(p => p.id === purchaseForm.productId);
    }, [products, purchaseForm.productId]);

    const previewNewCost = useMemo(() => {
        if (!selectedPurchaseProduct || purchaseForm.quantity <= 0) return 0;
        return calculateWeightedAverageCost(
            selectedPurchaseProduct.stock_quantity,
            selectedPurchaseProduct.cost_price,
            purchaseForm.quantity,
            purchaseForm.unitCost
        );
    }, [selectedPurchaseProduct, purchaseForm.quantity, purchaseForm.unitCost]);

    const handleSavePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!purchaseForm.productId) {
            setToast({ message: 'Selecione um produto para a compra', type: 'error' });
            return;
        }
        if (purchaseForm.quantity <= 0) {
            setToast({ message: 'A quantidade deve ser maior que zero', type: 'error' });
            return;
        }

        try {
            await stockRepository.recordPurchaseEntry({
                tenantId: activeTenantId,
                productId: purchaseForm.productId,
                quantity: Number(purchaseForm.quantity),
                unitCost: Number(purchaseForm.unitCost),
                supplierName: purchaseForm.supplierName,
                invoiceNumber: purchaseForm.invoiceNumber,
                notes: purchaseForm.notes,
            });

            setToast({ message: 'Entrada de compra registrada com recálculo de custo médio!', type: 'success' });
            setIsPurchaseModalOpen(false);
            loadData();
        } catch (err: unknown) {
            setToast({ message: getErrorMessage(err, 'Erro ao registrar compra'), type: 'error' });
        }
    };

    // Handlers de Consumo Interno de Bancada
    const handleOpenConsumption = (defaultProductId?: string) => {
        const internalProds = products.filter(p => p.purpose === 'internal_use' || p.purpose === 'both');
        const prod = internalProds.find(p => p.id === defaultProductId) || internalProds[0];
        setConsumptionForm({
            productId: prod ? prod.id : '',
            staffId: staffList[0]?.id || '',
            quantity: 1,
            notes: '',
        });
        setIsConsumptionModalOpen(true);
    };

    const handleSaveConsumption = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!consumptionForm.productId) {
            setToast({ message: 'Selecione o insumo retirado', type: 'error' });
            return;
        }
        if (!consumptionForm.staffId) {
            setToast({ message: 'Selecione o barbeiro / colaborador responsável', type: 'error' });
            return;
        }
        if (consumptionForm.quantity <= 0) {
            setToast({ message: 'A quantidade deve ser maior que zero', type: 'error' });
            return;
        }

        const staffMember = staffList.find(s => s.id === consumptionForm.staffId);
        const staffName = staffMember ? staffMember.name : 'Colaborador';

        try {
            await stockRepository.recordInternalConsumption({
                tenantId: activeTenantId,
                productId: consumptionForm.productId,
                staffId: consumptionForm.staffId,
                staffName,
                quantity: Number(consumptionForm.quantity),
                notes: consumptionForm.notes,
            });

            setToast({ message: `Retirada registrada para ${staffName}! Estoque atualizado.`, type: 'success' });
            setIsConsumptionModalOpen(false);
            loadData();
        } catch (err: unknown) {
            setToast({ message: getErrorMessage(err, 'Erro ao registrar retirada de bancada'), type: 'error' });
        }
    };

    // Handlers de Conferência / Auditoria com PIN
    const auditItems: InventoryAuditItem[] = useMemo(() => {
        return products.map(prod => {
            const counted = auditCounts[prod.id] !== undefined ? auditCounts[prod.id] : prod.stock_quantity;
            const { difference, divergenceValue } = calculateInventoryDiscrepancy(
                prod.stock_quantity,
                counted,
                prod.cost_price
            );
            return {
                product_id: prod.id,
                product_name: prod.name,
                category: prod.category,
                purpose: prod.purpose,
                system_quantity: prod.stock_quantity,
                counted_quantity: counted,
                difference,
                unit_cost: prod.cost_price,
                divergence_value: divergenceValue,
            };
        });
    }, [products, auditCounts]);

    const auditDiscrepancies = useMemo(() => {
        return auditItems.filter(item => item.difference !== 0);
    }, [auditItems]);

    const totalAuditDifferenceValue = useMemo(() => {
        return auditDiscrepancies.reduce((acc, item) => acc + item.divergence_value, 0);
    }, [auditDiscrepancies]);

    const handleAuditCountChange = (productId: string, val: string) => {
        const num = parseFloat(val) || 0;
        setAuditCounts(prev => ({
            ...prev,
            [productId]: num,
        }));
    };

    const handleStartAuditApply = () => {
        if (auditDiscrepancies.length === 0) {
            setToast({ message: 'Nenhuma divergência encontrada na contagem física.', type: 'info' });
            return;
        }
        setManagerPin('');
        setPinError('');
        setIsPinModalOpen(true);
    };

    const handleConfirmAuditWithPin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!managerPin || managerPin.length < 4) {
            setPinError('Informe o PIN do Gestor (mínimo 4 dígitos)');
            return;
        }

        setIsSubmittingAudit(true);
        setPinError('');

        try {
            const result = await stockRepository.applyInventoryAdjustment({
                tenantId: activeTenantId,
                items: auditDiscrepancies.map(item => ({
                    productId: item.product_id,
                    countedQuantity: item.counted_quantity,
                    reason: `Ajuste de inventário físico: ${item.difference > 0 ? 'Sobra' : 'Falta'} de ${Math.abs(item.difference)} un`,
                })),
                managerPin,
            });

            if (result.success) {
                setToast({ message: result.message, type: 'success' });
                setIsPinModalOpen(false);
                loadData();
            } else {
                setPinError(result.message || 'PIN inválido ou não autorizado.');
            }
        } catch (err: unknown) {
            setPinError(getErrorMessage(err, 'Erro ao aplicar ajuste de conferência'));
        } finally {
            setIsSubmittingAudit(false);
        }
    };

    return {
        activeTab,
        products,
        staffList,
        loading,
        searchTerm,
        categoryFilter,
        toast,
        stockStatusFilter,
        categories,
        filteredProducts,
        potentialSaleValue,
        metrics,
        isProductModalOpen,
        isPurchaseModalOpen,
        isConsumptionModalOpen,
        isSuppliersModalOpen,
        isPinModalOpen,
        editingProduct,
        productForm,
        purchaseForm,
        consumptionForm,
        selectedPurchaseProduct,
        previewNewCost,
        auditItems,
        auditCounts,
        auditDiscrepanciesCount: auditDiscrepancies.length,
        totalAuditDifferenceValue,
        managerPin,
        pinError,
        isSubmittingAudit,
        setSearchTerm,
        setCategoryFilter,
        setToast,
        setStockStatusFilter,
        setIsProductModalOpen,
        setIsPurchaseModalOpen,
        setIsConsumptionModalOpen,
        setIsSuppliersModalOpen,
        setIsPinModalOpen,
        setProductForm,
        setPurchaseForm,
        setConsumptionForm,
        setManagerPin,
        setPinError,
        handleTabChange,
        handleToggleLowStockFilter,
        handleOpenNewProduct,
        handleOpenEditProduct,
        handleSaveProduct,
        handleDeleteProduct,
        handleOpenPurchase,
        handleSavePurchase,
        handleOpenConsumption,
        handleSaveConsumption,
        handleAuditCountChange,
        handleStartAuditApply,
        handleConfirmAuditWithPin,
    };
}
