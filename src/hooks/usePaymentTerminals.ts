/**
 * [SMG][HOOKS] usePaymentTerminals
 *
 * Hook para gerenciamento de maquininhas de cartão, taxas de operadoras
 * e seleção de terminal padrão (ADR-036).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSharedClient } from '../../services/supabaseClient';
import type {
  PaymentTerminal,
  PaymentTerminalRate,
  PaymentTerminalWithRates,
  TerminalAcquirer,
  TerminalRateMethod,
} from '../../domain/paymentTerminal/types';

export interface CreateTerminalInput {
  name: string;
  acquirer: TerminalAcquirer | string;
  is_default?: boolean;
  rates?: Array<{
    method: TerminalRateMethod;
    installments_min?: number;
    installments_max?: number;
    rate_percentage: number;
    fixed_fee?: number;
    settlement_days?: number;
  }>;
}

export const usePaymentTerminals = () => {
  const { tenantId } = useAuth();
  const [terminals, setTerminals] = useState<PaymentTerminalWithRates[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTerminals = useCallback(async () => {
    if (!tenantId) {
      setTerminals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const client = getSharedClient();

      const [terminalsRes, ratesRes] = await Promise.all([
        client
          .from('payment_terminals')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('is_default', { ascending: false })
          .order('name', { ascending: true }),
        client
          .from('payment_terminal_rates')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('method', { ascending: true })
          .order('installments_min', { ascending: true }),
      ]);

      if (terminalsRes.error) {
        throw new Error(terminalsRes.error.message);
      }
      if (ratesRes.error) {
        throw new Error(ratesRes.error.message);
      }

      const terminalRows: PaymentTerminal[] = terminalsRes.data || [];
      const rateRows: PaymentTerminalRate[] = ratesRes.data || [];

      const ratesByTerminalId = new Map<string, PaymentTerminalRate[]>();
      for (const rate of rateRows) {
        const list = ratesByTerminalId.get(rate.terminal_id) || [];
        list.push(rate);
        ratesByTerminalId.set(rate.terminal_id, list);
      }

      const combined: PaymentTerminalWithRates[] = terminalRows.map((terminal) => ({
        ...terminal,
        rates: ratesByTerminalId.get(terminal.id) || [],
      }));

      setTerminals(combined);
    } catch (err: any) {
      console.error('[usePaymentTerminals] Erro ao carregar maquininhas:', err);
      setError(err?.message || 'Erro ao carregar maquininhas');
      setTerminals([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTerminals();
  }, [fetchTerminals]);

  const defaultTerminal = useMemo(() => {
    return terminals.find((t) => t.is_default) || terminals[0] || null;
  }, [terminals]);

  const createTerminal = useCallback(
    async (input: CreateTerminalInput): Promise<PaymentTerminalWithRates> => {
      if (!tenantId) throw new Error('tenant_id obrigatório');
      const client = getSharedClient();

      // Se for padrão, remove padrão dos outros primeiro
      if (input.is_default) {
        await client
          .from('payment_terminals')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId);
      }

      const { data: newTerminal, error: termError } = await client
        .from('payment_terminals')
        .insert({
          tenant_id: tenantId,
          name: input.name.trim(),
          acquirer: input.acquirer,
          is_default: Boolean(input.is_default),
          is_active: true,
        })
        .select()
        .single();

      if (termError || !newTerminal) {
        throw new Error(termError?.message || 'Erro ao criar maquininha');
      }

      const createdRates: PaymentTerminalRate[] = [];

      if (input.rates && input.rates.length > 0) {
        const ratesToInsert = input.rates.map((r) => ({
          tenant_id: tenantId,
          terminal_id: newTerminal.id,
          method: r.method,
          installments_min: r.installments_min ?? 1,
          installments_max: r.installments_max ?? 1,
          rate_percentage: Number(r.rate_percentage) || 0,
          fixed_fee: Number(r.fixed_fee) || 0,
          settlement_days: Number(r.settlement_days) || 1,
        }));

        const { data: rateData, error: ratesErr } = await client
          .from('payment_terminal_rates')
          .insert(ratesToInsert)
          .select();

        if (ratesErr) {
          console.error('[usePaymentTerminals] Erro ao salvar taxas da maquininha:', ratesErr);
        } else if (rateData) {
          createdRates.push(...rateData);
        }
      }

      await fetchTerminals();

      return {
        ...newTerminal,
        rates: createdRates,
      };
    },
    [tenantId, fetchTerminals],
  );

  const setDefaultTerminal = useCallback(
    async (terminalId: string): Promise<void> => {
      if (!tenantId) return;
      const client = getSharedClient();

      // Desmarca todos
      await client
        .from('payment_terminals')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);

      // Marca o escolhido
      const { error: updErr } = await client
        .from('payment_terminals')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', terminalId);

      if (updErr) {
        throw new Error(updErr.message);
      }

      await fetchTerminals();
    },
    [tenantId, fetchTerminals],
  );

  const deleteTerminal = useCallback(
    async (terminalId: string): Promise<void> => {
      if (!tenantId) return;
      const client = getSharedClient();

      // Soft delete: is_active = false
      const { error: delErr } = await client
        .from('payment_terminals')
        .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', terminalId);

      if (delErr) {
        throw new Error(delErr.message);
      }

      await fetchTerminals();
    },
    [tenantId, fetchTerminals],
  );

  const saveRates = useCallback(
    async (
      terminalId: string,
      rates: Array<Omit<PaymentTerminalRate, 'id' | 'tenant_id' | 'terminal_id'>>,
    ): Promise<void> => {
      if (!tenantId) return;
      const client = getSharedClient();

      // Remove taxas existentes do terminal
      await client
        .from('payment_terminal_rates')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('terminal_id', terminalId);

      // Insere novas
      if (rates.length > 0) {
        const ratesToInsert = rates.map((r) => ({
          tenant_id: tenantId,
          terminal_id: terminalId,
          method: r.method,
          installments_min: r.installments_min ?? 1,
          installments_max: r.installments_max ?? 1,
          rate_percentage: Number(r.rate_percentage) || 0,
          fixed_fee: Number(r.fixed_fee) || 0,
          settlement_days: Number(r.settlement_days) || 1,
        }));

        const { error: insertErr } = await client
          .from('payment_terminal_rates')
          .insert(ratesToInsert);

        if (insertErr) {
          throw new Error(insertErr.message);
        }
      }

      await fetchTerminals();
    },
    [tenantId, fetchTerminals],
  );

  return {
    terminals,
    loading,
    error,
    defaultTerminal,
    refreshTerminals: fetchTerminals,
    createTerminal,
    setDefaultTerminal,
    deleteTerminal,
    saveRates,
  };
};
