import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import {
  findActiveOpenComanda,
  getTopFrequentItems,
  resolveItemCommission,
  type QuickComandaSummary,
  type CatalogItem,
  type HistoricalItemUsage,
} from '@/src/utils/comandaQuickActions';
import { formatBrlCurrency } from '@/src/utils/checkoutQuickPay';

export interface QuickOpenClient {
  id: string;
  name: string;
  avatar?: string;
  phone?: string;
}

export interface QuickOpenStaff {
  id: string;
  name: string;
  role?: string;
}

export interface QuickOpenComandaPayload {
  clientId: string | null;
  clientName: string;
  staffId: string | null;
  items: Array<{
    item: CatalogItem;
    quantity: number;
    staffId: string | null;
  }>;
}

export interface QuickOpenComandaModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: QuickOpenClient[];
  staffList: QuickOpenStaff[];
  currentUserId?: string | null;
  currentUserRole?: string | null;
  existingOpenComandas: QuickComandaSummary[];
  catalogItems: CatalogItem[];
  itemsHistory?: HistoricalItemUsage[];
  onSubmit: (payload: QuickOpenComandaPayload) => Promise<void>;
  onRedirectToExistingComanda: (comandaId: string) => void;
  orderLabel?: string;
}

export const QuickOpenComandaModal: React.FC<QuickOpenComandaModalProps> = ({
  isOpen,
  onClose,
  clients,
  staffList,
  currentUserId,
  currentUserRole,
  existingOpenComandas,
  catalogItems,
  itemsHistory = [],
  onSubmit,
  onRedirectToExistingComanda,
  orderLabel = 'Comanda',
}) => {
  // Estado de seleção do cliente
  const [selectedClient, setSelectedClient] = useState<QuickOpenClient | null>(null);
  const [isFinalConsumer, setIsFinalConsumer] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Profissional responsável
  const [selectedStaffId, setSelectedStaffId] = useState<string>('house');

  // Cesta de itens da abertura rápida
  const [selectedItems, setSelectedItems] = useState<
    Array<{ item: CatalogItem; quantity: number; staffId: string | null }>
  >([]);

  // Submissão & Lock
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicialização inteligente do profissional responsável baseado na role
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsSubmitting(false);
      setSelectedItems([]);
      setSelectedClient(null);
      setIsFinalConsumer(false);
      setSearchTerm('');

      // Se for barbeiro logado, pré-seleciona ele mesmo
      if (currentUserRole === 'barber' && currentUserId) {
        setSelectedStaffId(currentUserId);
      } else {
        setSelectedStaffId('house');
      }
    }
  }, [isOpen, currentUserRole, currentUserId]);

  // Top 4 itens frequentes
  const frequentItems = useMemo(() => {
    return getTopFrequentItems(itemsHistory, catalogItems, 4);
  }, [itemsHistory, catalogItems]);

  // Detecção ativa de comanda concorrente aberta hoje
  const concurrentComanda = useMemo(() => {
    if (isFinalConsumer || !selectedClient) return null;
    return findActiveOpenComanda(existingOpenComandas, selectedClient.id);
  }, [isFinalConsumer, selectedClient, existingOpenComandas]);

  // Filtro de clientes
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return clients
      .filter((c) => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)))
      .slice(0, 5);
  }, [clients, searchTerm]);

  // Manipulação de itens rápidos
  const handleAddItem = (item: CatalogItem) => {
    setSelectedItems((prev) => {
      const idx = prev.findIndex((pi) => pi.item.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          item,
          quantity: 1,
          staffId: selectedStaffId === 'house' ? null : selectedStaffId,
        },
      ];
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((pi) => pi.item.id !== itemId));
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((pi) => {
          if (pi.item.id === itemId) {
            const newQty = pi.quantity + delta;
            return newQty > 0 ? { ...pi, quantity: newQty } : null;
          }
          return pi;
        })
        .filter(Boolean) as Array<{ item: CatalogItem; quantity: number; staffId: string | null }>
    );
  };

  const handleSelectFinalConsumer = () => {
    setIsFinalConsumer(true);
    setSelectedClient(null);
    setSearchTerm('');
  };

  const handleSelectClient = (client: QuickOpenClient) => {
    setSelectedClient(client);
    setIsFinalConsumer(false);
    setSearchTerm('');
  };

  // Cálculo total rápido
  const subtotal = useMemo(() => {
    return selectedItems.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);
  }, [selectedItems]);

  const handleSubmit = async (bypassConcurrent: boolean = false) => {
    if (isSubmitting) return;

    if (!isFinalConsumer && !selectedClient) {
      setErrorMsg('Selecione um cliente ou opte por Consumidor Final.');
      return;
    }

    if (concurrentComanda && !bypassConcurrent) {
      // Deixa o alerta visível na UI
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const clientName = isFinalConsumer ? 'Consumidor Final / Balcão' : selectedClient!.name;
      const clientId = isFinalConsumer ? null : selectedClient!.id;

      await onSubmit({
        clientId,
        clientName,
        staffId: selectedStaffId === 'house' ? null : selectedStaffId,
        items: selectedItems,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao abrir comanda rápida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Abertura Rápida de ${orderLabel}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* 1. SELEÇÃO DE CLIENTE / CONSUMIDOR FINAL */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
            Cliente ou Balcão
          </label>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              type="button"
              onClick={handleSelectFinalConsumer}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                isFinalConsumer
                  ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-base">bolt</span>
              <span>Consumidor Final / Balcão</span>
            </button>

            {selectedClient && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs font-bold">
                <span className="material-symbols-outlined text-base">person</span>
                <span>{selectedClient.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="hover:text-red-500 ml-1 p-0.5"
                  title="Remover seleção"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            )}
          </div>

          {!isFinalConsumer && !selectedClient && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente por nome ou telefone..."
                autoFocus
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-sky-500 transition-colors"
              />

              {filteredClients.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelectClient(client)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{client.name}</span>
                      </div>
                      {client.phone && <span className="text-[11px] text-slate-400">{client.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ⚠️ ALERTA DE COMANDA CONCORRENTE ABERTA HOJE */}
        {concurrentComanda && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 animate-fade-in">
            <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
              <span className="material-symbols-outlined text-lg shrink-0 text-amber-500">warning</span>
              <div className="text-xs">
                <p className="font-black">
                  O cliente já possui a {orderLabel} #{concurrentComanda.id.slice(0, 8)} aberta hoje.
                </p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  Adicione produtos/serviços diretamente na {orderLabel.toLowerCase()} existente para evitar cobranças duplicadas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onRedirectToExistingComanda(concurrentComanda.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm transition-all"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                <span>Abrir {orderLabel} Existente</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
              >
                Criar {orderLabel} Separada Mesmo Assim
              </button>
            </div>
          </div>
        )}

        {/* 2. PROFISSIONAL RESPONSÁVEL / ATRIBUIÇÃO */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 block">
            Atribuição / Profissional
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedStaffId('house')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-left flex items-center gap-2 ${
                selectedStaffId === 'house'
                  ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                  : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span className="truncate">Venda Balcão / Casa</span>
            </button>

            {staffList.map((pro) => (
              <button
                key={pro.id}
                type="button"
                onClick={() => setSelectedStaffId(pro.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border text-left flex items-center gap-2 ${
                  selectedStaffId === pro.id
                    ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-sm">person</span>
                <span className="truncate">{pro.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. BARRA DE ITENS FREQUENTES (TOP 4) */}
        {frequentItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Mais Vendidos (1 Toque)
              </label>
              <span className="text-[10px] text-slate-400">Clique para adicionar</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {frequentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddItem(item)}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 hover:bg-sky-50 dark:bg-white/5 dark:hover:bg-sky-950/20 hover:border-sky-500/30 transition-all text-left flex flex-col justify-between group active:scale-95"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-sky-500 text-sm">
                      {item.type === 'service' ? 'content_cut' : 'package_2'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {formatBrlCurrency(item.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. ITENS INCLUÍDOS */}
        {selectedItems.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 bg-slate-50/50 dark:bg-white/[0.02] space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Itens da Abertura ({selectedItems.length})
            </span>

            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {selectedItems.map(({ item, quantity }) => (
                <div key={item.id} className="py-1.5 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{formatBrlCurrency(item.price)} cada</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden bg-white dark:bg-background-dark">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, -1)}
                        className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold"
                      >
                        -
                      </button>
                      <span className="px-2 font-black text-slate-800 dark:text-slate-200 text-xs">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, 1)}
                        className="px-2 py-0.5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 font-bold"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-black text-slate-900 dark:text-white w-16 text-right">
                      {formatBrlCurrency(item.price * quantity)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-400 hover:text-red-500 p-0.5"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-white/10 pt-2 flex items-center justify-between font-black text-sm">
              <span className="text-slate-600 dark:text-slate-400">Total Previsto:</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-base">
                {formatBrlCurrency(subtotal)}
              </span>
            </div>
          </div>
        )}

        {errorMsg && (
          <p className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-2.5 rounded-xl border border-red-200 dark:border-red-500/20">
            {errorMsg}
          </p>
        )}

        {/* 5. AÇÕES DO RODAPÉ */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting || (!isFinalConsumer && !selectedClient)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md shadow-amber-400/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin size-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full" />
                <span>Abrindo...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">receipt_long</span>
                <span>Abrir {orderLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
