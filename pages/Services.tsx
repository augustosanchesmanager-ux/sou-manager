import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;
  active: boolean;
}

const categories = ['Cabelo', 'Barba', 'Combo', 'Química', 'Acabamento', 'Outros'];

const Services: React.FC = () => {
  const { tenantId } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', category: 'Cabelo', price: '', duration: '30', active: true });

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('services').select('*').order('name');
    if (data) setServices(data);
    if (error) setToast({ message: 'Erro ao carregar serviços.', type: 'error' });
    setLoading(false);
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const filtered = services.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? s.active : !s.active);
    return matchSearch && matchCategory && matchStatus;
  });

  const openNewForm = () => {
    setEditingService(null);
    setForm({ name: '', category: 'Cabelo', price: '', duration: '30', active: true });
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
    const payload = {
      name: form.name,
      category: form.category,
      price: parseFloat(form.price) || 0,
      duration: parseInt(form.duration) || 30,
      active: form.active,
      tenant_id: tenantId
    };

    if (editingService) {
      const { error } = await supabase.from('services').update(payload).eq('id', editingService.id);
      if (error) { setToast({ message: 'Erro ao atualizar.', type: 'error' }); return; }
      setToast({ message: 'Serviço atualizado!', type: 'success' });
    } else {
      const { error } = await supabase.from('services').insert(payload);
      if (error) { setToast({ message: 'Erro ao salvar.', type: 'error' }); return; }
      setToast({ message: 'Serviço criado!', type: 'success' });
    }

    setView('list');
    setEditingService(null);
    fetchServices();
  };

  const handleToggleActive = async (service: Service) => {
    const { error } = await supabase.from('services').update({ active: !service.active }).eq('id', service.id);
    if (!error) {
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, active: !s.active } : s));
      setToast({ message: service.active ? 'Serviço desativado.' : 'Serviço ativado!', type: 'info' });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (!error) {
      setToast({ message: 'Serviço excluído.', type: 'info' });
      fetchServices();
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingService ? 'Editar Serviço' : 'Novo Serviço'}</h2>
        </div>

        <form onSubmit={handleSave} className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome do Serviço</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                placeholder="Ex: Corte Degradê" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Categoria</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]">
                  {categories.map(c => <option key={c} value={c} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{c}</option>)}
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

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setView('list'); setEditingService(null); }}
                className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
              <button type="submit"
                className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">
                {editingService ? 'Salvar Alterações' : 'Criar Serviço'}
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Serviços</h2>
          <p className="text-slate-500 text-sm">{services.filter(s => s.active).length} serviço(s) ativo(s)</p>
        </div>
        <button onClick={openNewForm}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all">
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Novo Serviço
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input type="text" placeholder="Buscar serviço..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 outline-none [color-scheme:light] dark:[color-scheme:dark]">
          <option value="all" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Todas Categorias</option>
          {categories.map(c => <option key={c} value={c} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">{c}</option>)}
        </select>
        <div className="flex gap-2">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === s ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>
              {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Service Cards */}
      {loading ? (
        <div className="p-10 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-500">Nenhum serviço encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(service => (
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
                <button onClick={() => handleToggleActive(service)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${service.active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
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