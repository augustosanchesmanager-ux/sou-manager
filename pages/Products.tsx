import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Package,
    Plus,
    Truck,
    ShoppingCart,
    ClipboardCheck,
    AlertTriangle,
    Scissors,
    ArrowDownLeft,
    ArrowUpRight,
    Search,
    Filter,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    Lock,
    RefreshCw,
    Layers,
    User,
    Tag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTenantOptional } from '../src/context/TenantContext';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { formatCurrency } from '../shared/format/currency';
import { staffRepository } from '../domain/staff/repository';
import type { StaffMember } from '../domain/staff/types';
import { stockRepository } from '../domain/stock/stockRepository';
import {
    calculateWeightedAverageCost,
    calculateInventoryDiscrepancy,
    filterStockByTab,
    isStockLow,
    roundToDecimals,
} from '../domain/stock/stockEngine';
import type {
    ProductStockItem,
    ProductPurpose,
    InventoryAuditItem,
} from '../domain/stock/types';

type StockTab = 'sale' | 'internal_use' | 'combos' | 'audit';

export const Products: React.FC = () => {
    const navigate = useNavigate();
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
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Modais
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);
    const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductStockItem | null>(null);

    // Formulário de Produto
    const [productForm, setProductForm] = useState({
        name: '',
        description: '',
        category: 'Geral',
        brand: '',
        cost_price: 0,
        sale_price: 0,
        commission_rate: 0,
        stock_quantity: 0,
        minimum_stock: 5,
        purpose: 'sale' as ProductPurpose,
        supplier_name: '',
        active: true,
    });

    // Formulário de Compra
    const [purchaseForm, setPurchaseForm] = useState({
        productId: '',
        quantity: 1,
        unitCost: 0,
        supplierName: '',
        invoiceNumber: '',
        notes: '',
    });

    // Formulário de Consumo Interno de Bancada
    const [consumptionForm, setConsumptionForm] = useState({
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

        return list;
    }, [products, activeTab, searchTerm, categoryFilter]);

    // Métricas Resumo
    const metrics = useMemo(() => {
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
        } catch (err: any) {
            setToast({ message: err?.message || 'Erro ao salvar produto', type: 'error' });
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
        } catch (err: any) {
            setToast({ message: err?.message || 'Erro ao excluir produto', type: 'error' });
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
        } catch (err: any) {
            setToast({ message: err?.message || 'Erro ao registrar compra', type: 'error' });
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
        } catch (err: any) {
            setToast({ message: err?.message || 'Erro ao registrar retirada de bancada', type: 'error' });
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
        } catch (err: any) {
            setPinError(err?.message || 'Erro ao aplicar ajuste de conferência');
        } finally {
            setIsSubmittingAudit(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Cabeçalho Superior */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Controle de Estoque
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Visão 360: Venda, Insumos de Bancada, Combos e Conferência Física
                            </p>
                        </div>
                    </div>
                </div>

                {/* Ações de Topo */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => setIsSuppliersModalOpen(true)}
                        leftIcon="truck"
                        className="border border-slate-700 hover:border-amber-500/50"
                    >
                        <Truck className="w-4 h-4 mr-1 text-amber-400" />
                        Fornecedores
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={() => handleOpenPurchase()}
                        className="border border-slate-700 hover:border-emerald-500/50"
                    >
                        <ShoppingCart className="w-4 h-4 mr-1 text-emerald-400" />
                        Adicionar compra ao estoque
                    </Button>

                    <Button
                        variant="primary"
                        onClick={handleOpenNewProduct}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        + Produto
                    </Button>
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-1">
                        <span>Total de Produtos</span>
                        <Package className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">{metrics.totalItems}</div>
                    <div className="text-xs text-slate-400 mt-1">Cadastrados no catálogo</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-1">
                        <span>Valor do Estoque (Custo)</span>
                        <Tag className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(metrics.totalStockValue)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Custo médio ponderado</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-1">
                        <span>Insumos de Bancada</span>
                        <Scissors className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">{metrics.internalUseCount}</div>
                    <div className="text-xs text-slate-400 mt-1">Uso interno e híbridos</div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-1">
                        <span>Alerta de Reposição</span>
                        <AlertTriangle className={`w-4 h-4 ${metrics.lowStockCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
                    </div>
                    <div className={`text-2xl font-bold ${metrics.lowStockCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {metrics.lowStockCount}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Abaixo do estoque mínimo</div>
                </div>
            </div>

            {/* Abas Superiores no padrão AppBarber */}
            <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-px">
                <button
                    onClick={() => handleTabChange('sale')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'sale'
                            ? 'border-amber-500 text-amber-400 bg-slate-900/40'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                    }`}
                >
                    <ShoppingCart className="w-4 h-4" />
                    Disponível pra venda
                </button>

                <button
                    onClick={() => handleTabChange('internal_use')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'internal_use'
                            ? 'border-amber-500 text-amber-400 bg-slate-900/40'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                    }`}
                >
                    <Scissors className="w-4 h-4" />
                    Apenas para uso
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300">
                        Bancada
                    </span>
                </button>

                <button
                    onClick={() => handleTabChange('combos')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'combos'
                            ? 'border-amber-500 text-amber-400 bg-slate-900/40'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    Combos
                </button>

                <button
                    onClick={() => handleTabChange('audit')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'audit'
                            ? 'border-amber-500 text-amber-400 bg-slate-900/40'
                            : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/20'
                    }`}
                >
                    <ClipboardCheck className="w-4 h-4" />
                    Conferência
                    {auditDiscrepancies.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-300">
                            {auditDiscrepancies.length} div
                        </span>
                    )}
                </button>
            </div>

            {/* Barra de Filtros e Busca (para abas normais) */}
            {activeTab !== 'audit' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por produto, marca ou fornecedor..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 py-2 px-3 focus:outline-none focus:border-amber-500"
                        >
                            <option value="all">Todas as Categorias</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>

                        {/* Botão de Retirada rápido na aba de Uso Interno */}
                        {activeTab === 'internal_use' && (
                            <Button
                                variant="secondary"
                                onClick={() => handleOpenConsumption()}
                                className="bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30"
                            >
                                <Scissors className="w-4 h-4 mr-1 text-blue-400" />
                                Registrar Retirada / Consumo
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Conteúdo da Aba 1: DISPONÍVEL PRA VENDA */}
            {activeTab === 'sale' && (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-4">Produto</th>
                                    <th className="py-3 px-4">Categoria</th>
                                    <th className="py-3 px-4 text-right">Custo Médio</th>
                                    <th className="py-3 px-4 text-right">Preço Venda</th>
                                    <th className="py-3 px-4 text-center">Comissão</th>
                                    <th className="py-3 px-4 text-center">Estoque Atual</th>
                                    <th className="py-3 px-4 text-center">Finalidade</th>
                                    <th className="py-3 px-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-500">
                                            Carregando produtos...
                                        </td>
                                    </tr>
                                ) : filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-500">
                                            Nenhum produto para venda encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map(prod => {
                                        const lowStock = isStockLow(prod);
                                        return (
                                            <tr key={prod.id} className="hover:bg-slate-800/20 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-white">{prod.name}</div>
                                                    {prod.brand && <div className="text-xs text-slate-400">{prod.brand}</div>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                                                        {prod.category || 'Geral'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-300">
                                                    {formatCurrency(prod.cost_price)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                                                    {formatCurrency(prod.sale_price)}
                                                </td>
                                                <td className="py-3 px-4 text-center text-amber-400">
                                                    {prod.commission_rate}%
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs ${
                                                        lowStock
                                                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    }`}>
                                                        {lowStock && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                                                        {prod.stock_quantity} un
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                        {prod.purpose === 'both' ? 'Híbrido' : 'Venda'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => handleOpenPurchase(prod.id)}
                                                            title="Dar entrada de compra"
                                                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                                                        >
                                                            <ShoppingCart className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditProduct(prod)}
                                                            title="Editar produto"
                                                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProduct(prod)}
                                                            title="Remover produto"
                                                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Conteúdo da Aba 2: APENAS PARA USO (BANCADA & LAVATÓRIO) */}
            {activeTab === 'internal_use' && (
                <div className="space-y-4">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                        <Scissors className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-blue-300">Insumos de Bancada e Lavatório</h3>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Estes itens não geram comissão direta de venda ao cliente. Utilize o botão
                                <strong> "Registrar Retirada / Consumo"</strong> para abater o estoque físico
                                e vincular o uso a um barbeiro ou colaborador.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Insumo</th>
                                        <th className="py-3 px-4">Categoria</th>
                                        <th className="py-3 px-4 text-right">Custo Unitário</th>
                                        <th className="py-3 px-4 text-center">Estoque Atual</th>
                                        <th className="py-3 px-4 text-center">Estoque Mínimo</th>
                                        <th className="py-3 px-4">Fornecedor</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-8 text-center text-slate-500">
                                                Nenhum insumo de uso interno cadastrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map(prod => {
                                            const lowStock = isStockLow(prod);
                                            return (
                                                <tr key={prod.id} className="hover:bg-slate-800/20 transition-colors">
                                                    <td className="py-3 px-4 font-medium text-white">
                                                        {prod.name}
                                                        {prod.brand && <div className="text-xs text-slate-400">{prod.brand}</div>}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                                                            {prod.category}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-300">
                                                        {formatCurrency(prod.cost_price)}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs ${
                                                            lowStock
                                                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                        }`}>
                                                            {lowStock && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                                                            {prod.stock_quantity} un
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center text-slate-400">
                                                        {prod.minimum_stock} un
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-400">
                                                        {prod.supplier_name || '—'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => handleOpenConsumption(prod.id)}
                                                                title="Registrar retirada de bancada"
                                                                className="p-1.5 rounded hover:bg-slate-800 text-blue-400 hover:text-blue-300 transition-colors"
                                                            >
                                                                <Scissors className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenPurchase(prod.id)}
                                                                title="Dar entrada de compra"
                                                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                                                            >
                                                                <ShoppingCart className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenEditProduct(prod)}
                                                                title="Editar insumo"
                                                                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Conteúdo da Aba 3: COMBOS */}
            {activeTab === 'combos' && (
                <div className="space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                        <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-amber-300">Kits Promocionais e Combos</h3>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Agrupe produtos e insumos com preço especial. A baixa de estoque é realizada
                                automaticamente nos componentes individuais no momento da venda.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Nome do Combo</th>
                                        <th className="py-3 px-4">Composição</th>
                                        <th className="py-3 px-4 text-right">Custo dos Itens</th>
                                        <th className="py-3 px-4 text-right">Preço de Venda</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-slate-500">
                                                Nenhum combo cadastrado no momento.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map(combo => (
                                            <tr key={combo.id} className="hover:bg-slate-800/20 transition-colors">
                                                <td className="py-3 px-4 font-medium text-white">
                                                    {combo.name}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-slate-400">
                                                    {combo.combo_items?.map(ci => `${ci.quantity}x ${ci.product_name}`).join(', ') || 'Sem componentes'}
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-300">
                                                    {formatCurrency(combo.cost_price)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold text-emerald-400">
                                                    {formatCurrency(combo.sale_price)}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300">
                                                        Ativo
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => handleOpenEditProduct(combo)}
                                                        className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Conteúdo da Aba 4: CONFERÊNCIA FÍSICA & INVENTÁRIO COM PIN */}
            {activeTab === 'audit' && (
                <div className="space-y-4">
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <ClipboardCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-white">Conferência Física Periódica (Inventário)</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Informe a contagem real de prateleira na coluna <strong>"Contagem Real"</strong>.
                                    O sistema calcula as sobras e faltas automaticamente. O fechamento e ajuste de estoque
                                    exige <strong>PIN do Gestor</strong> para garantir auditoria e segurança.
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="primary"
                            onClick={handleStartAuditApply}
                            disabled={auditDiscrepancies.length === 0}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0"
                        >
                            <Lock className="w-4 h-4 mr-1" />
                            Aplicar Ajuste ({auditDiscrepancies.length} divergências)
                        </Button>
                    </div>

                    <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Produto / Insumo</th>
                                        <th className="py-3 px-4">Finalidade</th>
                                        <th className="py-3 px-4 text-right">Custo Unitário</th>
                                        <th className="py-3 px-4 text-center">Estoque Sistema</th>
                                        <th className="py-3 px-4 text-center w-36">Contagem Real</th>
                                        <th className="py-3 px-4 text-center">Divergência</th>
                                        <th className="py-3 px-4 text-right">Impacto Financeiro</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {auditItems.map(item => {
                                        const hasDiff = item.difference !== 0;
                                        const isSurplus = item.difference > 0;
                                        return (
                                            <tr key={item.product_id} className={`transition-colors ${hasDiff ? 'bg-amber-500/5' : 'hover:bg-slate-800/20'}`}>
                                                <td className="py-3 px-4 font-medium text-white">
                                                    {item.product_name}
                                                    <div className="text-xs text-slate-400">{item.category}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300">
                                                        {item.purpose === 'sale' ? 'Venda' : item.purpose === 'internal_use' ? 'Bancada' : 'Híbrido'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right text-slate-300">
                                                    {formatCurrency(item.unit_cost)}
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold text-slate-300">
                                                    {item.system_quantity} un
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={auditCounts[item.product_id] !== undefined ? auditCounts[item.product_id] : item.system_quantity}
                                                        onChange={e => handleAuditCountChange(item.product_id, e.target.value)}
                                                        className="w-24 text-center py-1 px-2 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {item.difference === 0 ? (
                                                        <span className="text-xs text-slate-500 font-medium">Sem divergência</span>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs ${
                                                            isSurplus
                                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                        }`}>
                                                            {isSurplus ? `+${item.difference} un (Sobra)` : `${item.difference} un (Falta)`}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold">
                                                    {item.divergence_value === 0 ? (
                                                        <span className="text-slate-500">R$ 0,00</span>
                                                    ) : (
                                                        <span className={item.divergence_value > 0 ? 'text-blue-400' : 'text-rose-400'}>
                                                            {formatCurrency(item.divergence_value)}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Barra de Totais da Conferência */}
                        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-slate-400">
                                Divergências Identificadas:{' '}
                                <strong className="text-white">{auditDiscrepancies.length} item(ns)</strong>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 uppercase">Impacto Líquido</div>
                                    <div className={`text-lg font-bold ${totalAuditDifferenceValue >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                        {formatCurrency(totalAuditDifferenceValue)}
                                    </div>
                                </div>
                                <Button
                                    variant="primary"
                                    onClick={handleStartAuditApply}
                                    disabled={auditDiscrepancies.length === 0}
                                    className="bg-amber-500 text-slate-950 font-bold"
                                >
                                    <Lock className="w-4 h-4 mr-1" />
                                    Ajustar Estoque com PIN
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 1: Cadastrar / Editar Produto */}
            <Modal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
                maxWidth="lg"
            >
                <form onSubmit={handleSaveProduct} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Nome do Produto *
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Pomada Matte Efeito Seco"
                            value={productForm.name}
                            onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Categoria
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Finalizadores, Barba, Insumos"
                                value={productForm.category}
                                onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Marca / Fabricante
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Barber Premium"
                                value={productForm.brand}
                                onChange={e => setProductForm({ ...productForm, brand: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Finalidade do Produto (Decisão do PO: 1 - a b c) */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Finalidade de Uso *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setProductForm({ ...productForm, purpose: 'sale' })}
                                className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                    productForm.purpose === 'sale'
                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <ShoppingCart className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                                Para Venda
                            </button>

                            <button
                                type="button"
                                onClick={() => setProductForm({ ...productForm, purpose: 'internal_use' })}
                                className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                    productForm.purpose === 'internal_use'
                                        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <Scissors className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                                Uso Interno (Bancada)
                            </button>

                            <button
                                type="button"
                                onClick={() => setProductForm({ ...productForm, purpose: 'both' })}
                                className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${
                                    productForm.purpose === 'both'
                                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                            >
                                <Layers className="w-4 h-4 mx-auto mb-1 text-amber-400" />
                                Híbrido (Venda e Uso)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Preço de Custo (R$)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={productForm.cost_price}
                                onChange={e => setProductForm({ ...productForm, cost_price: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Preço de Venda (R$)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={productForm.purpose === 'internal_use'}
                                value={productForm.purpose === 'internal_use' ? 0 : productForm.sale_price}
                                onChange={e => setProductForm({ ...productForm, sale_price: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Comissão Barbeiro (%)
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                disabled={productForm.purpose === 'internal_use'}
                                value={productForm.purpose === 'internal_use' ? 0 : productForm.commission_rate}
                                onChange={e => setProductForm({ ...productForm, commission_rate: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Estoque Atual (un)
                            </label>
                            <input
                                type="number"
                                step="1"
                                min="0"
                                value={productForm.stock_quantity}
                                onChange={e => setProductForm({ ...productForm, stock_quantity: parseInt(e.target.value, 10) || 0 })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Estoque Mínimo (Alerta)
                            </label>
                            <input
                                type="number"
                                step="1"
                                min="0"
                                value={productForm.minimum_stock}
                                onChange={e => setProductForm({ ...productForm, minimum_stock: parseInt(e.target.value, 10) || 0 })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Fornecedor Principal
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Distribuidora Alpha Barber"
                            value={productForm.supplier_name}
                            onChange={e => setProductForm({ ...productForm, supplier_name: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsProductModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="bg-amber-500 text-slate-950 font-semibold"
                        >
                            Salvar Produto
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL 2: Adicionar Compra ao Estoque (Recálculo de Custo Médio Ponderado) */}
            <Modal
                isOpen={isPurchaseModalOpen}
                onClose={() => setIsPurchaseModalOpen(false)}
                title="Entrada de Compra no Estoque"
                maxWidth="md"
            >
                <form onSubmit={handleSavePurchase} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Produto Comprado *
                        </label>
                        <select
                            required
                            value={purchaseForm.productId}
                            onChange={e => {
                                const prodId = e.target.value;
                                const p = products.find(prod => prod.id === prodId);
                                setPurchaseForm({
                                    ...purchaseForm,
                                    productId: prodId,
                                    unitCost: p ? p.cost_price : purchaseForm.unitCost,
                                    supplierName: p?.supplier_name || purchaseForm.supplierName,
                                });
                            }}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        >
                            <option value="">Selecione um produto...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} (Atual: {p.stock_quantity} un a {formatCurrency(p.cost_price)})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Quantidade Comprada *
                            </label>
                            <input
                                type="number"
                                min="1"
                                required
                                value={purchaseForm.quantity}
                                onChange={e => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value, 10) || 1 })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Custo Unitário da Nota (R$) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={purchaseForm.unitCost}
                                onChange={e => setPurchaseForm({ ...purchaseForm, unitCost: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Simulação em Tempo Real do Custo Médio Ponderado */}
                    {selectedPurchaseProduct && (
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                            <div className="flex justify-between text-slate-400">
                                <span>Custo Médio Anterior:</span>
                                <span>{formatCurrency(selectedPurchaseProduct.cost_price)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Novo Estoque Total:</span>
                                <span>{selectedPurchaseProduct.stock_quantity + purchaseForm.quantity} un</span>
                            </div>
                            <div className="flex justify-between font-bold text-amber-400 pt-1 border-t border-slate-800">
                                <span>Novo Custo Médio Ponderado:</span>
                                <span>{formatCurrency(previewNewCost)}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Fornecedor
                            </label>
                            <input
                                type="text"
                                placeholder="Nome da distribuidora"
                                value={purchaseForm.supplierName}
                                onChange={e => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                                Nº da Nota / Pedido
                            </label>
                            <input
                                type="text"
                                placeholder="NF-e 12345"
                                value={purchaseForm.invoiceNumber}
                                onChange={e => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsPurchaseModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
                        >
                            Confirmar Compra
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL 3: Registrar Retirada / Consumo de Bancada */}
            <Modal
                isOpen={isConsumptionModalOpen}
                onClose={() => setIsConsumptionModalOpen(false)}
                title="Registrar Retirada / Consumo de Bancada"
                maxWidth="md"
            >
                <form onSubmit={handleSaveConsumption} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Insumo Retirado *
                        </label>
                        <select
                            required
                            value={consumptionForm.productId}
                            onChange={e => setConsumptionForm({ ...consumptionForm, productId: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        >
                            <option value="">Selecione o insumo...</option>
                            {products
                                .filter(p => p.purpose === 'internal_use' || p.purpose === 'both')
                                .map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} (Disponível: {p.stock_quantity} un)
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Barbeiro / Colaborador Responsável *
                        </label>
                        <select
                            required
                            value={consumptionForm.staffId}
                            onChange={e => setConsumptionForm({ ...consumptionForm, staffId: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        >
                            <option value="">Selecione o profissional...</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.role || 'Barbeiro'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Quantidade Retirada *
                        </label>
                        <input
                            type="number"
                            min="1"
                            required
                            value={consumptionForm.quantity}
                            onChange={e => setConsumptionForm({ ...consumptionForm, quantity: parseInt(e.target.value, 10) || 1 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            Observações / Motivo
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Abastecimento de lâminas na bancada 2"
                            value={consumptionForm.notes}
                            onChange={e => setConsumptionForm({ ...consumptionForm, notes: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsConsumptionModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                        >
                            Confirmar Retirada
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL 4: Autorização por PIN do Gestor para Ajuste de Conferência */}
            <Modal
                isOpen={isPinModalOpen}
                onClose={() => setIsPinModalOpen(false)}
                title="Autorização do Gestor — Ajuste de Inventário"
                maxWidth="sm"
            >
                <form onSubmit={handleConfirmAuditWithPin} className="space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-slate-300">
                        Você está prestes a atualizar o saldo físico de{' '}
                        <strong className="text-amber-400">{auditDiscrepancies.length} produto(s)</strong>{' '}
                        com um impacto financeiro de{' '}
                        <strong className={totalAuditDifferenceValue >= 0 ? 'text-blue-400' : 'text-rose-400'}>
                            {formatCurrency(totalAuditDifferenceValue)}
                        </strong>.
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                            PIN do Gestor (6 dígitos) *
                        </label>
                        <input
                            type="password"
                            maxLength={6}
                            autoFocus
                            placeholder="••••••"
                            value={managerPin}
                            onChange={e => {
                                setManagerPin(e.target.value);
                                setPinError('');
                            }}
                            className="w-full text-center text-2xl tracking-widest px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-amber-400 font-mono focus:outline-none focus:border-amber-500"
                        />
                        {pinError && (
                            <p className="text-xs text-rose-400 mt-1 font-medium">{pinError}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsPinModalOpen(false)}
                            disabled={isSubmittingAudit}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={isSubmittingAudit}
                            className="bg-amber-500 text-slate-950 font-bold"
                        >
                            Aprovar Ajuste
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* MODAL 5: Fornecedores Parceiros */}
            <Modal
                isOpen={isSuppliersModalOpen}
                onClose={() => setIsSuppliersModalOpen(false)}
                title="Fornecedores Parceiros"
                maxWidth="md"
            >
                <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                        Distribuidoras e fabricantes cadastrados para abastecimento de estoque e insumos de bancada.
                    </p>

                    <div className="space-y-2">
                        {Array.from(new Set(products.map(p => p.supplier_name).filter(Boolean))).map((sup, idx) => (
                            <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-amber-400" />
                                    <span className="text-sm font-medium text-white">{sup}</span>
                                </div>
                                <span className="text-xs text-slate-500">Parceiro Homologado</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-800">
                        <Button
                            variant="secondary"
                            onClick={() => setIsSuppliersModalOpen(false)}
                        >
                            Fechar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Products;
