import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, getClientForTable } from '../services/supabaseClient';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { getCatalogDisplayName } from '../src/lib/catalog/display';
import {
  calculateComboTotals,
  formatComboSummary,
  type ComboDiscountType,
  type ServiceItemForCombo,
} from '../src/utils/comboCalculation';

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  active: boolean;
  show_in_booking?: boolean;
  description?: string;
  is_combo?: boolean;
  combo_service_ids?: string[];
  combo_discount_amount?: number;
  combo_discount_type?: ComboDiscountType;
}

const categories = ['Cabelo', 'Barba', 'Combo', 'Química', 'Acabamento', 'Outros'];
const esteticaCategoryLabels: Record<string, string> = {
  Corte: 'Facial',
  Cabelo: 'Facial',
  Barba: 'Corporal',
  Combo: 'Pacotes',
  Química: 'Cílios',
  Acabamento: 'Sobrancelhas',
  Outros: 'Outros',
};

const Services: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId, appSlug } = useAuth();
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';
  const serviceLabel = labels.service;
  const serviceLabelLower = serviceLabel.toLowerCase();
  const servicePluralLabel = labels.servicePlural;
  const servicePluralLower = servicePluralLabel.toLowerCase();
  const getCategoryLabel = (category: string) => isEsteticaApp ? (esteticaCategoryLabels[category] || category) : category;
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Form
  const [view, setView] = useState<'list' | 'form'>('list');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('smg_services_view_mode');
      return saved === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleViewModeChange = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('smg_services_view_mode', mode);
    } catch {
      // ignore
    }
  };

  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'Cabelo',
    price: '',
    duration: '30',
    active: true,
    show_in_booking: true,
    is_combo: false,
    combo_service_ids: [] as string[],
    combo_discount_amount: '0',
    combo_discount_type: 'fixed' as ComboDiscountType,
  });

  const isComboMode = form.category === 'Combo' || form.is_combo;

  const availableServicesForCombo = useMemo(() => {
    return services.filter(s => {
      if (!s.active) return false;
      if (s.is_combo || s.category === 'Combo') return false;
      if (editingService && s.id === editingService.id) return false;
      return true;
    });
  }, [services, editingService]);

  const selectedServicesForCombo = useMemo(() => {
    return services
      .filter(s => form.combo_service_ids.includes(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        price: Number(s.price) || 0,
        duration: Number(s.duration) || 0,
      }));
  }, [services, form.combo_service_ids]);

  const comboTotals = useMemo(() => {
    if (!isComboMode) {
      return { sumPrice: 0, sumDuration: 0, discountValue: 0, finalPrice: 0, savings: 0 };
    }
    return calculateComboTotals({
      services: selectedServicesForCombo,
      discountAmount: parseFloat(form.combo_discount_amount) || 0,
      discountType: form.combo_discount_type,
    });
  }, [isComboMode, selectedServicesForCombo, form.combo_discount_amount, form.combo_discount_type]);

  const applyComboSuggestions = () => {
    if (selectedServicesForCombo.length === 0) return;
    setForm(prev => ({
      ...prev,
      price: comboTotals.finalPrice.toFixed(2),
      duration: comboTotals.sumDuration.toString(),
    }));
  };

  const handleToggleComboService = (serviceId: string) => {
    setForm(prev => {
      const exists = prev.combo_service_ids.includes(serviceId);
      const nextIds = exists
        ? prev.combo_service_ids.filter(id => id !== serviceId)
        : [...prev.combo_service_ids, serviceId];
      return { ...prev, combo_service_ids: nextIds };
    });
  };

  const getComboDetails = useCallback((service: Service) => {
    if (!service.is_combo && service.category !== 'Combo') return null;
    const itemIds = service.combo_service_ids || [];
    if (!Array.isArray(itemIds) || itemIds.length === 0) return null;
    const included = services.filter(s => itemIds.includes(s.id));
    if (included.length === 0) return null;
    const names = included.map(s => s.name);
    const sumPrice = included.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
    const savings = Math.max(0, sumPrice - Number(service.price));
    return {
      names,
      sumPrice,
      savings,
      summary: formatComboSummary({ includedServiceNames: names, savings }),
    };
  }, [services]);

  const fetchServices = useCallback(async () => {
    if (!tenantId) {
      setServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const servicesClient = getClientForTable('services', 'barber');
    const { data, error } = await servicesClient
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (data) setServices(data);
    if (error) setToast({ message: `Erro ao carregar ${servicePluralLower}.`, type: 'error' });
    setLoading(false);
  }, [servicePluralLower, tenantId]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  useEffect(() => {
    const shouldOpenNew = Boolean((location.state as { openNewService?: boolean } | null)?.openNewService);
    if (!shouldOpenNew) return;
    openNewForm();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const filtered = services.filter(s => {
    const displayName = getCatalogDisplayName(s, appSlug);
    const matchSearch = `${s.name} ${displayName}`.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? s.active : !s.active);
    return matchSearch && matchCategory && matchStatus;
  });

  const openNewForm = () => {
    setEditingService(null);
    setForm({
      name: '',
      category: 'Cabelo',
      price: '',
      duration: '30',
      active: true,
      show_in_booking: true,
      is_combo: false,
      combo_service_ids: [],
      combo_discount_amount: '0',
      combo_discount_type: 'fixed',
    });
    setView('form');
  };

  const openEditForm = (service: Service) => {
    setEditingService(service);
    const isCombo = Boolean(service.is_combo || service.category === 'Combo');
    setForm({
      name: service.name,
      category: service.category,
      price: service.price.toString(),
      duration: service.duration.toString(),
      active: service.active,
      show_in_booking: service.show_in_booking ?? true,
      is_combo: isCombo,
      combo_service_ids: Array.isArray(service.combo_service_ids) ? service.combo_service_ids : [],
      combo_discount_amount: (service.combo_discount_amount ?? 0).toString(),
      combo_discount_type: (service.combo_discount_type as ComboDiscountType) || 'fixed',
    });
    setView('form');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCombo = form.category === 'Combo' || form.is_combo;
    const payload = {
      name: form.name,
      category: form.category,
      price: parseFloat(form.price) || 0,
      duration: parseInt(form.duration) || 30,
      active: form.active,
      show_in_booking: form.show_in_booking,
      is_combo: isCombo,
      combo_service_ids: isCombo ? form.combo_service_ids : [],
      combo_discount_amount: isCombo ? (parseFloat(form.combo_discount_amount) || 0) : 0,
      combo_discount_type: isCombo ? form.combo_discount_type : 'fixed',
      tenant_id: tenantId
    };

    if (editingService) {
      const servicesClient = getClientForTable('services', 'barber');
      const { error } = await servicesClient
        .from('services')
        .update(payload)
        .eq('id', editingService.id)
        .eq('tenant_id', tenantId);
      if (error) { setToast({ message: 'Erro ao atualizar.', type: 'error' }); return; }
      setToast({ message: `${serviceLabel} atualizado!`, type: 'success' });
    } else {
      const servicesClient = getClientForTable('services', 'barber');
      const { error } = await servicesClient.from('services').insert(payload);
      if (error) { setToast({ message: 'Erro ao salvar.', type: 'error' }); return; }
      setToast({ message: `${serviceLabel} criado!`, type: 'success' });
    }

    setView('list');
    setEditingService(null);
    fetchServices();
  };

  const handleToggleActive = async (service: Service) => {
    if (!tenantId) return;

    const servicesClient = getClientForTable('services', 'barber');
    const { error } = await servicesClient
      .from('services')
      .update({ active: !service.active })
      .eq('id', service.id)
      .eq('tenant_id', tenantId);
    if (!error) {
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s));
      setToast({ message: service.active ? `${serviceLabel} desativado.` : `${serviceLabel} ativado!`, type: 'info' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;

    try {
      const servicesClient = getClientForTable('services', 'barber');
      const { error } = await servicesClient
        .from('services')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);
      if (error) {
        let message = `Erro ao excluir ${serviceLabelLower}.`;
        if (error.code === '23503' || error.message.includes('foreign key constraint') || error.message.includes('violates foreign key')) {
          message = `Não é possível excluir este ${serviceLabelLower} porque ele está vinculado a agendamentos ou comandas registradas. Para desativá-lo, utilize o interruptor Ativo/Inativo.`;
        } else {
          message = `Erro ao excluir ${serviceLabelLower}: ${error.message} (${error.code || 'sem-codigo'})`;
        }
        setToast({ message, type: 'error' });
      } else {
        setToast({ message: `${serviceLabel} excluído.`, type: 'info' });
        fetchServices();
      }
    } catch (err: any) {
      console.error('DELETE SERVICE ERROR:', err);
      let message = `Erro ao excluir ${serviceLabelLower}.`;
      if (err?.code === '23503' || err?.message?.includes('foreign key')) {
        message = `Não é possível excluir este ${serviceLabelLower} porque ele está vinculado a agendamentos ou comandas registradas. Para desativá-lo, utilize o interruptor Ativo/Inativo.`;
      }
      setToast({ message, type: 'error' });
    }
  };

  const formatPrice = (p: number) => `R$ ${p.toFixed(2)}`;

  if (view === 'form') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto w-full animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setEditingService(null); }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingService ? `Editar ${serviceLabel}` : `Novo ${serviceLabelLower}`}</h2>
        </div>

        <form onSubmit={handleSave} className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome do {serviceLabel}</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                placeholder={isEsteticaApp ? 'Ex: Limpeza de pele' : 'Ex: Corte Degradê'} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const nextCat = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      category: nextCat,
                      is_combo: nextCat === 'Combo' ? true : prev.is_combo,
                    }));
                  }}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]">
                  {categories.map(c => <option key={c} value={c} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{getCategoryLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Preço (R$)</label>
                <input type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  placeholder="45.00" />
              </div>
            </div>

            {/* Alternar modo Combo quando categoria não for Combo */}
            {form.category !== 'Combo' && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-primary">layers</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Definir este item como um Pacote Promocional / Combo
                  </span>
                </div>
                <label className="flex items-center cursor-pointer">
                  <div
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.is_combo ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                    onClick={() => setForm(prev => ({ ...prev, is_combo: !prev.is_combo }))}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_combo ? 'left-[22px]' : 'left-0.5'}`}></div>
                  </div>
                </label>
              </div>
            )}

            {/* Seção de Composição do Combo Inteligente */}
            {isComboMode && (
              <div className="p-4 sm:p-5 rounded-xl border border-primary/25 bg-primary/[0.03] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">layers</span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Procedimentos do Combo</h3>
                      <p className="text-xs text-slate-500">Selecione os procedimentos inclusos e defina o desconto promocional</p>
                    </div>
                  </div>
                  {selectedServicesForCombo.length > 0 && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary">
                      {selectedServicesForCombo.length} item(ns)
                    </span>
                  )}
                </div>

                {/* Lista de Procedimentos Disponíveis */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-500">
                    Serviços Disponíveis para o Pacote
                  </label>
                  {availableServicesForCombo.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                      Nenhum outro serviço individual cadastrado para compor o combo.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 p-1 border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-background-dark">
                      {availableServicesForCombo.map(item => {
                        const isSelected = form.combo_service_ids.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleComboService(item.id)}
                            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-xs select-none ${
                              isSelected
                                ? 'bg-primary/15 border border-primary/40 text-slate-900 dark:text-white'
                                : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // tratado no div container
                                className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300 dark:border-white/20 pointer-events-none"
                              />
                              <span className="font-medium">{item.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500">
                                {getCategoryLabel(item.category)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <span className="text-slate-400">{item.duration} min</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">R$ {Number(item.price).toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Painel de Cálculo e Desconto */}
                {selectedServicesForCombo.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Soma de Tabela:</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          R$ {comboTotals.sumPrice.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Duração Agregada:</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {comboTotals.sumDuration} min
                        </span>
                      </div>
                    </div>

                    {/* Desconto de Pacote */}
                    <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                        Desconto do Pacote
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.combo_discount_amount}
                          onChange={(e) => setForm({ ...form, combo_discount_amount: e.target.value })}
                          className="flex-1 bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                          placeholder="0.00"
                        />
                        <div className="flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, combo_discount_type: 'fixed' })}
                            className={`px-3 py-2 font-bold transition-colors ${
                              form.combo_discount_type === 'fixed'
                                ? 'bg-primary text-night'
                                : 'bg-white dark:bg-card-dark text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                          >
                            R$
                          </button>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, combo_discount_type: 'percentage' })}
                            className={`px-3 py-2 font-bold transition-colors ${
                              form.combo_discount_type === 'percentage'
                                ? 'bg-primary text-night'
                                : 'bg-white dark:bg-card-dark text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                          >
                            %
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Resumo da Sugestão & Botão de Aplicar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Preço Sugerido:</span>
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            R$ {comboTotals.finalPrice.toFixed(2)}
                          </span>
                        </div>
                        {comboTotals.savings > 0 && (
                          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block">
                            Economia de R$ {comboTotals.savings.toFixed(2)} ({((comboTotals.savings / (comboTotals.sumPrice || 1)) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={applyComboSuggestions}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary font-bold text-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                        Aplicar ao Preço e Duração
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Duração (min)</label>
                <input type="number" required value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  placeholder="30" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-12 h-6 rounded-full transition-colors ${form.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                    onClick={() => setForm({ ...form, active: !form.active })}>
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'left-[26px]' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{form.active ? 'Ativo' : 'Inativo'}</span>
                </label>
              </div>
            </div>

            {/* Visibilidade no Agendamento Online */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-lg">public</span>
                  Disponível no Agendamento Online
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Se desativado, o serviço não aparecerá na vitrine pública para clientes.
                </p>
              </div>
              <label className="flex items-center cursor-pointer ml-4">
                <div
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.show_in_booking ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                  onClick={() => setForm({ ...form, show_in_booking: !form.show_in_booking })}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.show_in_booking ? 'left-[26px]' : 'left-0.5'}`}></div>
                </div>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setView('list'); setEditingService(null); }}
                className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
              <button type="submit"
                className="flex-1 py-3 rounded-lg text-sm font-bold text-night bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                {editingService ? 'Salvar Alterações' : `Criar ${serviceLabel}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{servicePluralLabel}</h2>
          <p className="text-slate-500 text-sm">{services.filter(s => s.active).length} {servicePluralLower} ativo(s)</p>
        </div>
        <button onClick={openNewForm}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-night rounded-xl text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all">
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Novo {serviceLabelLower}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input type="text" placeholder={`Buscar ${serviceLabelLower}...`} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 outline-none [color-scheme:light] dark:[color-scheme:dark]">
          <option value="all" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Todas Categorias</option>
          {categories.map(c => <option key={c} value={c} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{getCategoryLabel(c)}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Ativos ({services.filter(s => s.active).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'inactive'
                  ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Inativos ({services.filter(s => !s.active).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Todos ({services.length})
            </button>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:border-border-dark mx-1 hidden sm:block"></div>
          <div className="flex items-center bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              aria-label="Visualização em Grade"
              title="Visualização em Grade"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-night shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
              <span className="material-symbols-outlined text-base block">grid_view</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('table')}
              aria-label="Visualização em Tabela"
              title="Visualização em Tabela"
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-primary text-night shadow-sm' : 'text-slate-400 hover:text-slate-700 dark:hover:text-white'}`}>
              <span className="material-symbols-outlined text-base block">view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Service Cards or Table */}
      {loading ? (
        <div className="p-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-500">
          {search || categoryFilter !== 'all' || statusFilter !== 'all'
            ? `Nenhum ${serviceLabelLower} encontrado com os filtros aplicados.`
            : isEsteticaApp
              ? 'Cadastre seu primeiro procedimento.'
              : 'Nenhum serviço encontrado.'}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-border-dark bg-slate-50/70 dark:bg-white/[0.02] text-xs uppercase tracking-wider text-slate-500 font-bold">
                  <th className="py-3.5 px-4">{serviceLabel}</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Duração</th>
                  <th className="py-3.5 px-4">Preço</th>
                  <th className="py-3.5 px-4">Agendamento Online</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map(service => {
                  const displayName = getCatalogDisplayName(service, appSlug);
                  const isOnline = service.show_in_booking ?? true;
                  const comboDetails = getComboDetails(service);
                  return (
                    <tr key={service.id} className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors ${!service.active ? 'opacity-60' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            comboDetails ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'
                          }`}>
                            <span className="material-symbols-outlined text-sm">
                              {comboDetails ? 'layers' : 'content_cut'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white block">{displayName}</span>
                              {comboDetails && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500">
                                  Combo
                                </span>
                              )}
                            </div>
                            {comboDetails ? (
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                <span className="text-xs text-slate-400">
                                  {comboDetails.names.join(' + ')}
                                </span>
                                {comboDetails.savings > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                    Economia: R$ {comboDetails.savings.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            ) : service.description ? (
                              <span className="text-xs text-slate-400 truncate max-w-xs block">{service.description}</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                          {getCategoryLabel(service.category)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <span className="material-symbols-outlined text-xs text-slate-400">schedule</span>
                          {service.duration} min
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-500">
                        {formatPrice(service.price)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isOnline ? 'text-primary bg-primary/10' : 'text-amber-500 bg-amber-500/10'
                        }`}>
                          <span className="material-symbols-outlined text-xs">{isOnline ? 'public' : 'lock'}</span>
                          {isOnline ? 'Disponível' : 'Oculto'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(service)}
                          aria-label={service.active ? `Desativar ${service.name}` : `Ativar ${service.name}`}
                          title={service.active ? `Desativar ${service.name}` : `Ativar ${service.name}`}
                          className={`relative inline-block w-11 h-6 rounded-full transition-colors cursor-pointer ${service.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${service.active ? 'left-[22px]' : 'left-0.5'}`}></span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditForm(service)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Editar">
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button onClick={() => handleDelete(service.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(service => {
            const displayName = getCatalogDisplayName(service, appSlug);
            const comboDetails = getComboDetails(service);
            return (
            <div key={service.id} className={`bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-5 hover:shadow-md transition-all group ${!service.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{displayName}</h4>
                    {comboDetails && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
                        <span className="material-symbols-outlined text-[11px]">layers</span>
                        Combo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{getCategoryLabel(service.category)}</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        (service.show_in_booking ?? true)
                          ? 'text-primary bg-primary/10'
                          : 'text-amber-500 bg-amber-500/10'
                      }`}
                      title={(service.show_in_booking ?? true) ? 'Visível no agendamento online' : 'Oculto no agendamento online'}>
                      <span className="material-symbols-outlined text-[13px]">
                        {(service.show_in_booking ?? true) ? 'public' : 'lock'}
                      </span>
                      {(service.show_in_booking ?? true) ? 'Online' : 'Interno'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditForm(service)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Editar">
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button onClick={() => handleDelete(service.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>

              {/* Detalhes do Combo no Card */}
              {comboDetails && (
                <div className="mb-3 p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <span className="material-symbols-outlined text-xs text-primary">layers</span>
                    <span>Itens inclusos:</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {comboDetails.names.join(' + ')}
                  </p>
                  {comboDetails.savings > 0 && (
                    <div className="pt-0.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="material-symbols-outlined text-xs">savings</span>
                        Economia: R$ {comboDetails.savings.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end justify-between mt-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-slate-400 text-sm">payments</span>
                    <span className="font-bold text-emerald-500">{formatPrice(service.price)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-slate-400 text-sm">schedule</span>
                    <span className="text-slate-700 dark:text-slate-300">{service.duration} min</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleActive(service)}
                  aria-label={service.active ? `Desativar ${service.name}` : `Ativar ${service.name}`}
                  title={service.active ? `Desativar ${service.name}` : `Ativar ${service.name}`}
                  className={`relative w-12 h-6 rounded-full transition-colors ${service.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${service.active ? 'left-[26px]' : 'left-0.5'}`}></div>
                </button>
              </div>
            </div>
          )})}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Services;
