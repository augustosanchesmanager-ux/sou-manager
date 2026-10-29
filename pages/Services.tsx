import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, getClientForTable } from '../services/supabaseClient';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { getCatalogDisplayName } from '../src/lib/catalog/display';

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  active: boolean;
  show_in_booking?: boolean;
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
  const [form, setForm] = useState({ name: '', category: 'Cabelo', price: '', duration: '30', active: true, show_in_booking: true });

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
    setForm({ name: '', category: 'Cabelo', price: '', duration: '30', active: true, show_in_booking: true });
    setView('form');
  };

  const openEditForm = (service: Service) => {
    setEditingService(service);
    setForm({
      name: service.name,
      category: service.category,
      price: service.price.toString(),
      duration: service.duration.toString(),
      active: service.active,
      show_in_booking: service.show_in_booking ?? true,
    });
    setView('form');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      category: form.category,
      price: parseFloat(form.price) || 0,
      duration: parseInt(form.duration) || 30,
      active: form.active,
      show_in_booking: form.show_in_booking,
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
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
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
                  return (
                    <tr key={service.id} className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors ${!service.active ? 'opacity-60' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            <span className="material-symbols-outlined text-sm">content_cut</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white block">{displayName}</span>
                            {service.description && (
                              <span className="text-xs text-slate-400 truncate max-w-xs block">{service.description}</span>
                            )}
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
            return (
            <div key={service.id} className={`bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-5 hover:shadow-md transition-all group ${!service.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{displayName}</h4>
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
