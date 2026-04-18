import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Toast from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  active: boolean;
}

const categories = ['Cabelo', 'Barba', 'Combo', 'Quimica', 'Acabamento', 'Outros'];

const Services: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId, requireModuleAccess } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', category: 'Cabelo', price: '', duration: '30', active: true });

  const resetForm = () => {
    setForm({ name: '', category: 'Cabelo', price: '', duration: '30', active: true });
  };

  const fetchServices = useCallback(async () => {
    if (!tenantId) {
      setServices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { tenantId: resolvedTenantId, client } = requireModuleAccess(
        'services',
        'services',
        'load services',
      );

      const { data, error } = await client
        .from('services')
        .select('*')
        .eq('tenant_id', resolvedTenantId)
        .order('name');

      if (error) throw error;

      setServices(data || []);
    } catch (error) {
      console.error('Erro ao carregar servicos:', error);
      setToast({ message: 'Erro ao carregar servicos.', type: 'error' });
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [requireModuleAccess, tenantId]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    const shouldOpenNew = Boolean((location.state as { openNewService?: boolean } | null)?.openNewService);
    if (!shouldOpenNew) return;
    openNewForm();
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const filtered = services.filter((service) => {
    const matchSearch = service.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || service.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? service.active : !service.active);
    return matchSearch && matchCategory && matchStatus;
  });

  const openNewForm = () => {
    setEditingService(null);
    resetForm();
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
    });
    setView('form');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { tenantId: resolvedTenantId, client } = requireModuleAccess(
        'services',
        'services',
        editingService ? 'update service' : 'create service',
      );

      const payload = {
        name: form.name,
        category: form.category,
        price: parseFloat(form.price) || 0,
        duration: parseInt(form.duration, 10) || 30,
        active: form.active,
        tenant_id: resolvedTenantId
      };

      if (editingService) {
        const { error } = await client
          .from('services')
          .update(payload)
          .eq('id', editingService.id)
          .eq('tenant_id', resolvedTenantId);

        if (error) throw error;

        setToast({ message: 'Servico atualizado!', type: 'success' });
      } else {
        const { error } = await client.from('services').insert(payload);

        if (error) throw error;

        setToast({ message: 'Servico criado!', type: 'success' });
      }

      setView('list');
      setEditingService(null);
      resetForm();
      void fetchServices();
    } catch (error) {
      console.error('Erro ao salvar servico:', error);
      setToast({ message: editingService ? 'Erro ao atualizar.' : 'Erro ao salvar.', type: 'error' });
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      const { tenantId: resolvedTenantId, client } = requireModuleAccess(
        'services',
        'services',
        'toggle service status',
      );

      const { error } = await client
        .from('services')
        .update({ active: !service.active })
        .eq('id', service.id)
        .eq('tenant_id', resolvedTenantId);

      if (error) throw error;

      setServices((previous) => previous.map((item) => (
        item.id === service.id ? { ...item, active: !service.active } : item
      )));
      setToast({ message: service.active ? 'Servico desativado.' : 'Servico ativado!', type: 'info' });
    } catch (error) {
      console.error('Erro ao alterar status do servico:', error);
      setToast({ message: 'Erro ao alterar status do servico.', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { tenantId: resolvedTenantId, client } = requireModuleAccess(
        'services',
        'services',
        'delete service',
      );

      const { error } = await client
        .from('services')
        .delete()
        .eq('id', id)
        .eq('tenant_id', resolvedTenantId);

      if (error) throw error;

      setToast({ message: 'Servico excluido.', type: 'info' });
      void fetchServices();
    } catch (error) {
      console.error('Erro ao excluir servico:', error);
      setToast({ message: 'Erro ao excluir servico.', type: 'error' });
    }
  };

  const formatPrice = (price: number) => `R$ ${price.toFixed(2)}`;

  if (view === 'form') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto w-full animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView('list'); setEditingService(null); resetForm(); }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingService ? 'Editar Servico' : 'Novo Servico'}</h2>
        </div>

        <form onSubmit={handleSave} className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome do Servico</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                placeholder="Ex: Corte Degrade"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {categories.map((category) => (
                    <option key={category} value={category} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Preco (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  placeholder="45.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Duracao (min)</label>
                <input
                  type="number"
                  required
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  placeholder="30"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                    onClick={() => setForm({ ...form, active: !form.active })}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'left-[26px]' : 'left-0.5'}`}></div>
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{form.active ? 'Ativo' : 'Inativo'}</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setView('list'); setEditingService(null); resetForm(); }}
                className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
              >
                {editingService ? 'Salvar Alteracoes' : 'Criar Servico'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Servicos</h2>
          <p className="text-slate-500 text-sm">{services.filter((service) => service.active).length} servico(s) ativo(s)</p>
        </div>
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Novo Servico
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar servico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 outline-none [color-scheme:light] dark:[color-scheme:dark]"
        >
          <option value="all" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Todas Categorias</option>
          {categories.map((category) => (
            <option key={category} value={category} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
              {category}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === status ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {status === 'all' ? 'Todos' : status === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-500">Nenhum servico encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <div key={service.id} className={`bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-5 hover:shadow-md transition-all group ${!service.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{service.name}</h4>
                  <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">{service.category}</span>
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
                  onClick={() => handleToggleActive(service)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${service.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${service.active ? 'left-[26px]' : 'left-0.5'}`}></div>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Services;
