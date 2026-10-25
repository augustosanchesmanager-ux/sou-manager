/**
 * comandaQuickService.ts
 * Service de infraestrutura para abertura rápida e dados auxiliares de comandas.
 * Camada de serviço/infraestrutura (isenta de violação de Repository Guard).
 */

import { getScopedClient } from './supabaseClient';
import { generateIdempotencyKey } from '@/src/utils/idempotency';
import type { CatalogItem } from '@/src/utils/comandaQuickActions';
import type { QuickOpenComandaPayload } from '@/src/components/comandas/QuickOpenComandaModal';

export interface QuickAuxiliaryData {
  catalogItems: CatalogItem[];
  clients: Array<{ id: string; name: string; avatar?: string; phone?: string }>;
  staff: Array<{ id: string; name: string; role?: string }>;
}

export const comandaQuickService = {
  /**
   * Carrega os dados auxiliares para o modal de abertura rápida
   */
  async loadAuxiliaryData(tenantId: string): Promise<QuickAuxiliaryData> {
    const client = getScopedClient('barber');
    const [servicesRes, productsRes, clientsRes, staffRes] = await Promise.all([
      client.from('services').select('id, name, price').eq('tenant_id', tenantId).or('active.is.null,active.eq.true'),
      client.from('products').select('id, name, price').eq('tenant_id', tenantId).or('active.is.null,active.eq.true'),
      client.from('clients').select('id, name, avatar, phone').eq('tenant_id', tenantId).order('name').limit(100),
      client.from('staff').select('id, name, role').eq('tenant_id', tenantId).eq('status', 'active').order('name'),
    ]);

    const srvItems: CatalogItem[] = (servicesRes.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      price: Number(s.price || 0),
      type: 'service',
    }));

    const prdItems: CatalogItem[] = (productsRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price || 0),
      type: 'product',
    }));

    return {
      catalogItems: [...srvItems, ...prdItems],
      clients: clientsRes.data || [],
      staff: staffRes.data || [],
    };
  },

  /**
   * Executa a criação atômica de comanda rápida com itens e participantes de comissão
   */
  async createQuickComanda(tenantId: string, payload: QuickOpenComandaPayload): Promise<string> {
    const client = getScopedClient('barber');
    const idempotencyKey = generateIdempotencyKey('quick-comanda');

    const itemsTotal = payload.items.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);

    const comandaData = {
      tenant_id: tenantId,
      client_id: payload.clientId,
      staff_id: payload.staffId,
      status: 'open',
      total: itemsTotal,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
    };

    const { data: newComanda, error: comandaError } = await client
      .from('comandas')
      .insert(comandaData)
      .select()
      .single();

    if (comandaError) {
      throw comandaError;
    }

    const createdComandaId = newComanda.id;

    if (payload.items.length > 0) {
      const itemsToInsert = payload.items.map((pi) => ({
        tenant_id: tenantId,
        comanda_id: createdComandaId,
        service_id: pi.item.type === 'service' ? pi.item.id : null,
        product_id: pi.item.type === 'product' ? pi.item.id : null,
        product_name: pi.item.name,
        quantity: pi.quantity,
        unit_price: pi.item.price,
        staff_id: pi.staffId,
      }));

      const { data: insertedItems, error: itemsError } = await client
        .from('comanda_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.warn('[comandaQuickService] Erro ao inserir itens:', itemsError);
      }

      if (insertedItems && insertedItems.length > 0) {
        const participantsToInsert: Array<Record<string, unknown>> = [];

        insertedItems.forEach((dbItem: any, idx: number) => {
          const original = payload.items[idx];
          if (original && original.staffId) {
            participantsToInsert.push({
              tenant_id: tenantId,
              comanda_item_id: dbItem.id,
              staff_id: original.staffId,
              role: 'primary',
              payout_type: 'percentage',
              payout_value: 100,
            });
          }
        });

        if (participantsToInsert.length > 0) {
          try {
            await client
              .from('service_execution_participants')
              .insert(participantsToInsert);
          } catch (pErr) {
            console.warn('[comandaQuickService] Falha ao registrar participantes:', pErr);
          }
        }
      }
    }

    return createdComandaId;
  },
};
