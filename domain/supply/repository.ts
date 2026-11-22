/**
 * [SMG][DOMAIN][SUPPLY] repository
 *
 * RESPONSABILIDADE: Acesso a dados de suprimentos e compras
 * (tabelas suppliers, purchase_orders e products).
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import type { IRepository } from '../shared/repository';
import type { AppSlug } from '../shared/app';
import type { OrderStatus } from '../../shared/status/order';

export interface SupplierRecord {
  id: string;
  tenant_id?: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  document?: string;
  address?: string;
}

export interface SupplierInput {
  name: string;
  email: string;
  phone: string;
  category: string;
  document?: string;
  address?: string;
}

export interface ProductOptionRecord {
  id: string;
  name: string;
  cost_price?: number;
}

export interface PurchaseOrderRecord {
  id: string;
  tenant_id?: string;
  product_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  status: OrderStatus;
  created_at: string;
  notes?: string;
  products?: { name: string; cost_price: number };
  suppliers?: { name: string; phone: string; email: string; document: string; address: string };
}

export interface CreatePurchaseOrderInput {
  product_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  status: OrderStatus;
  notes?: string;
}

class SupplyRepositoryImpl extends SupabaseRepository {
  constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
    super('suppliers', db ?? createSupabaseClient('suppliers', appSlug));
  }

  async listSuppliers(tenantId: string): Promise<SupplierRecord[]> {
    try {
      const result = await this.db
        .from('suppliers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');
      return this.extractData<SupplierRecord[]>(result, 'list suppliers') ?? [];
    } catch (err) {
      this.throwOnError(err, 'list suppliers');
    }
  }

  async createSupplier(tenantId: string, payload: SupplierInput): Promise<void> {
    try {
      const result = await this.db
        .from('suppliers')
        .insert([{ ...payload, tenant_id: tenantId }]);
      this.extractData(result, 'create supplier');
    } catch (err) {
      this.throwOnError(err, 'create supplier');
    }
  }

  async updateSupplier(id: string, tenantId: string, payload: Partial<SupplierInput>): Promise<void> {
    try {
      const result = await this.db
        .from('suppliers')
        .update(payload)
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'update supplier');
    } catch (err) {
      this.throwOnError(err, 'update supplier');
    }
  }

  async deleteSupplier(id: string, tenantId: string): Promise<void> {
    try {
      const result = await this.db
        .from('suppliers')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'delete supplier');
    } catch (err) {
      this.throwOnError(err, 'delete supplier');
    }
  }

  async listPurchaseOrders(tenantId: string): Promise<PurchaseOrderRecord[]> {
    try {
      const result = await this.db
        .from('purchase_orders')
        .select('*, products(name, cost_price), suppliers(*)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return this.extractData<PurchaseOrderRecord[]>(result, 'list purchase orders') ?? [];
    } catch (err) {
      this.throwOnError(err, 'list purchase orders');
    }
  }

  async createPurchaseOrder(tenantId: string, payload: CreatePurchaseOrderInput): Promise<void> {
    try {
      const result = await this.db
        .from('purchase_orders')
        .insert([{ ...payload, tenant_id: tenantId }]);
      this.extractData(result, 'create purchase order');
    } catch (err) {
      this.throwOnError(err, 'create purchase order');
    }
  }

  async updatePurchaseOrderStatus(id: string, tenantId: string, status: OrderStatus): Promise<void> {
    try {
      const result = await this.db
        .from('purchase_orders')
        .update({ status })
        .eq('id', id)
        .eq('tenant_id', tenantId);
      this.extractData(result, 'update purchase order status');
    } catch (err) {
      this.throwOnError(err, 'update purchase order status');
    }
  }

  async receivePurchaseOrder(orderId: string): Promise<void> {
    try {
      const result = await this.db.rpc('receive_purchase_order', { p_order_id: orderId });
      this.extractData(result, 'receive purchase order');
    } catch (err) {
      this.throwOnError(err, 'receive purchase order');
    }
  }

  async listProductOptions(tenantId: string): Promise<ProductOptionRecord[]> {
    try {
      const result = await this.db
        .from('products')
        .select('id, name, cost_price')
        .eq('tenant_id', tenantId)
        .order('name');
      return this.extractData<ProductOptionRecord[]>(result, 'list product options') ?? [];
    } catch (err) {
      this.throwOnError(err, 'list product options');
    }
  }

  async listActiveProducts(tenantId: string): Promise<any[]> {
    try {
      const result = await this.db
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .or('active.is.null,active.eq.true');
      return this.extractData<any[]>(result, 'list active products') ?? [];
    } catch (err) {
      this.throwOnError(err, 'list active products');
    }
  }

  async createProductAndReturn(payload: Record<string, unknown>): Promise<any> {
    try {
      const result = await this.db
        .from('products')
        .insert([payload])
        .select('*')
        .single();
      return this.extractData<any>(result, 'create product and return');
    } catch (err) {
      this.throwOnError(err, 'create product and return');
    }
  }
}

export interface SupplyRepository extends IRepository<SupplierRecord> {
  listSuppliers(tenantId: string): Promise<SupplierRecord[]>;
  createSupplier(tenantId: string, payload: SupplierInput): Promise<void>;
  updateSupplier(id: string, tenantId: string, payload: Partial<SupplierInput>): Promise<void>;
  deleteSupplier(id: string, tenantId: string): Promise<void>;
  listPurchaseOrders(tenantId: string): Promise<PurchaseOrderRecord[]>;
  createPurchaseOrder(tenantId: string, payload: CreatePurchaseOrderInput): Promise<void>;
  updatePurchaseOrderStatus(id: string, tenantId: string, status: OrderStatus): Promise<void>;
  receivePurchaseOrder(orderId: string): Promise<void>;
  listProductOptions(tenantId: string): Promise<ProductOptionRecord[]>;
  listActiveProducts(tenantId: string): Promise<any[]>;
  createProductAndReturn(payload: Record<string, unknown>): Promise<any>;
}

export const supplyRepository = new SupplyRepositoryImpl();
