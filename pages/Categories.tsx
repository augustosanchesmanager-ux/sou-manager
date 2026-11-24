import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { categoriesRepository, type CategoryRecord } from '../domain/categories/repository';

const Categories: React.FC = () => {
  const { tenantId } = useAuth();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadCategories = useCallback(async () => {
    if (!tenantId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await categoriesRepository.listByTenant(tenantId);
      setCategories(rows);
    } catch (err) {
      console.error('[Categories] Erro ao carregar categorias:', err);
      setToast({ message: 'Não foi possível carregar as categorias.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const filtered = useMemo(
    () =>
      categories.filter((c) =>
        `${c.name} ${c.description}`.toLowerCase().includes(search.toLowerCase())
      ),
    [categories, search]
  );

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setToast({ message: 'Unidade não identificada para salvar categoria.', type: 'error' });
      return;
    }
    if (!name.trim()) {
      setToast({ message: 'Informe o nome da categoria.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const updated = await categoriesRepository.update(tenantId, editingId, {
          name: name.trim(),
          description: description.trim(),
        });
        setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        setToast({ message: 'Categoria atualizada com sucesso!', type: 'success' });
        resetForm();
        return;
      }

      const created = await categoriesRepository.create(tenantId, {
        name: name.trim(),
        description: description.trim(),
      });
      setCategories((prev) => [created, ...prev]);
      setToast({ message: 'Categoria criada com sucesso!', type: 'success' });
      resetForm();
    } catch (err) {
      console.error('[Categories] Erro ao salvar categoria:', err);
      setToast({ message: 'Erro ao salvar categoria no servidor.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: CategoryRecord) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description);
  };

  const handleToggle = async (category: CategoryRecord) => {
    if (!tenantId) return;
    try {
      const updated = await categoriesRepository.toggleActive(tenantId, category.id, !category.active);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
      setToast({ message: 'Status atualizado.', type: 'info' });
    } catch (err) {
      console.error('[Categories] Erro ao alterar status da categoria:', err);
      setToast({ message: 'Não foi possível atualizar o status.', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantId) return;
    try {
      await categoriesRepository.remove(tenantId, id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) resetForm();
      setToast({ message: 'Categoria removida.', type: 'info' });
    } catch (err) {
      console.error('[Categories] Erro ao remover categoria:', err);
      setToast({ message: 'Não foi possível remover a categoria.', type: 'error' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Categorias</h2>
          <p className="text-slate-500 mt-1">Organize classificações para cadastros e operação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-border-dark">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar categoria..."
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-border-dark text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Carregando categorias...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      Nenhuma categoria encontrada.
                    </td>
                  </tr>
                ) : (
                  filtered.map((category) => (
                    <tr key={category.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{category.name}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {category.description || 'Sem descrição'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => void handleToggle(category)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                            category.active
                              ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 border-emerald-200 dark:border-emerald-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {category.active ? 'Ativa' : 'Inativa'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(category)}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(category.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm p-5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {editingId ? 'Editar Categoria' : 'Nova Categoria'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Sincronizado na nuvem com isolamento por unidade.
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Uso Profissional"
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da categoria..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={resetForm} disabled={submitting}>
                Limpar
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Categories;
