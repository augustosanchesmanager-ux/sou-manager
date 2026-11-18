import React from 'react';
import {
    Package,
    Plus,
    Truck,
    ShoppingCart,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';
import { useProductsController } from '../hooks/useProductsController';
import { ProductsKpiCards } from '../components/products/ProductsKpiCards';
import { ProductsToolbar } from '../components/products/ProductsToolbar';
import { ProductFormModal } from '../components/products/modals/ProductFormModal';
import { PurchaseEntryModal } from '../components/products/modals/PurchaseEntryModal';
import { InternalConsumptionModal } from '../components/products/modals/InternalConsumptionModal';
import { InventoryAuditPinModal } from '../components/products/modals/InventoryAuditPinModal';
import { SuppliersModal } from '../components/products/modals/SuppliersModal';
import { SaleProductsTable } from '../components/products/tables/SaleProductsTable';
import { InternalUseProductsTable } from '../components/products/tables/InternalUseProductsTable';
import { CombosTable } from '../components/products/tables/CombosTable';
import { InventoryAuditSection } from '../components/products/tables/InventoryAuditSection';

export const Products: React.FC = () => {
    const controller = useProductsController();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {controller.toast && (
                <Toast
                    message={controller.toast.message}
                    type={controller.toast.type}
                    onClose={() => controller.setToast(null)}
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
                        onClick={() => controller.setIsSuppliersModalOpen(true)}
                        leftIcon="truck"
                        className="border border-slate-700 hover:border-amber-500/50"
                    >
                        <Truck className="w-4 h-4 mr-1 text-amber-400" />
                        Fornecedores
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={() => controller.handleOpenPurchase()}
                        className="border border-slate-700 hover:border-emerald-500/50"
                    >
                        <ShoppingCart className="w-4 h-4 mr-1 text-emerald-400" />
                        Adicionar compra ao estoque
                    </Button>

                    <Button
                        variant="primary"
                        onClick={controller.handleOpenNewProduct}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-semibold"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        + Produto
                    </Button>
                </div>
            </div>

            {/* Cards de Métricas (Atelier Tech) */}
            <ProductsKpiCards
                metrics={controller.metrics}
                potentialSaleValue={controller.potentialSaleValue}
                stockStatusFilter={controller.stockStatusFilter}
                onToggleLowStockFilter={controller.handleToggleLowStockFilter}
            />

            {/* Abas e Barra de Filtros (Atelier Tech) */}
            <ProductsToolbar
                activeTab={controller.activeTab}
                onTabChange={controller.handleTabChange}
                auditDiscrepanciesCount={controller.auditDiscrepanciesCount}
                searchTerm={controller.searchTerm}
                onSearchChange={controller.setSearchTerm}
                stockStatusFilter={controller.stockStatusFilter}
                onStockStatusFilterChange={controller.setStockStatusFilter}
                categoryFilter={controller.categoryFilter}
                onCategoryFilterChange={controller.setCategoryFilter}
                categories={controller.categories}
                onOpenNewConsumption={() => controller.handleOpenConsumption()}
            />

            {/* Conteúdo da Aba 1: DISPONÍVEL PRA VENDA */}
            {controller.activeTab === 'sale' && (
                <SaleProductsTable
                    products={controller.filteredProducts}
                    loading={controller.loading}
                    onOpenPurchase={(prod) => controller.handleOpenPurchase(prod.id)}
                    onOpenEdit={controller.handleOpenEditProduct}
                    onDelete={controller.handleDeleteProduct}
                />
            )}

            {/* Conteúdo da Aba 2: APENAS PARA USO (BANCADA & LAVATÓRIO) */}
            {controller.activeTab === 'internal_use' && (
                <InternalUseProductsTable
                    products={controller.filteredProducts}
                    onOpenConsumption={(prod) => controller.handleOpenConsumption(prod.id)}
                    onOpenPurchase={(prod) => controller.handleOpenPurchase(prod.id)}
                    onOpenEdit={controller.handleOpenEditProduct}
                />
            )}

            {/* Conteúdo da Aba 3: COMBOS */}
            {controller.activeTab === 'combos' && (
                <CombosTable
                    combos={controller.filteredProducts}
                    onOpenEdit={controller.handleOpenEditProduct}
                />
            )}

            {/* Conteúdo da Aba 4: CONFERÊNCIA FÍSICA & INVENTÁRIO COM PIN */}
            {controller.activeTab === 'audit' && (
                <InventoryAuditSection
                    auditItems={controller.auditItems}
                    auditCounts={controller.auditCounts}
                    discrepanciesCount={controller.auditDiscrepanciesCount}
                    totalDifferenceValue={controller.totalAuditDifferenceValue}
                    onCountChange={controller.handleAuditCountChange}
                    onApplyAudit={controller.handleStartAuditApply}
                />
            )}

            {/* MODAL 1: Cadastrar / Editar Produto */}
            <ProductFormModal
                isOpen={controller.isProductModalOpen}
                isEditing={Boolean(controller.editingProduct)}
                form={controller.productForm}
                onClose={() => controller.setIsProductModalOpen(false)}
                onChange={controller.setProductForm}
                onSubmit={controller.handleSaveProduct}
            />

            {/* MODAL 2: Adicionar Compra ao Estoque (Recálculo de Custo Médio Ponderado) */}
            <PurchaseEntryModal
                isOpen={controller.isPurchaseModalOpen}
                products={controller.products}
                form={controller.purchaseForm}
                selectedProduct={controller.selectedPurchaseProduct}
                previewNewCost={controller.previewNewCost}
                onClose={() => controller.setIsPurchaseModalOpen(false)}
                onChange={controller.setPurchaseForm}
                onSubmit={controller.handleSavePurchase}
            />

            {/* MODAL 3: Registrar Retirada / Consumo de Bancada */}
            <InternalConsumptionModal
                isOpen={controller.isConsumptionModalOpen}
                products={controller.products}
                staffList={controller.staffList}
                form={controller.consumptionForm}
                onClose={() => controller.setIsConsumptionModalOpen(false)}
                onChange={controller.setConsumptionForm}
                onSubmit={controller.handleSaveConsumption}
            />

            {/* MODAL 4: Autorização por PIN do Gestor para Ajuste de Conferência */}
            <InventoryAuditPinModal
                isOpen={controller.isPinModalOpen}
                discrepanciesCount={controller.auditDiscrepanciesCount}
                totalDifferenceValue={controller.totalAuditDifferenceValue}
                managerPin={controller.managerPin}
                pinError={controller.pinError}
                isSubmitting={controller.isSubmittingAudit}
                onClose={() => controller.setIsPinModalOpen(false)}
                onPinChange={(pin) => {
                    controller.setManagerPin(pin);
                    controller.setPinError('');
                }}
                onSubmit={controller.handleConfirmAuditWithPin}
            />

            {/* MODAL 5: Fornecedores Parceiros */}
            <SuppliersModal
                isOpen={controller.isSuppliersModalOpen}
                products={controller.products}
                onClose={() => controller.setIsSuppliersModalOpen(false)}
            />
        </div>
    );
};

export default Products;
