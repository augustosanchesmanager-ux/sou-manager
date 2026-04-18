import React, { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

interface Category {
  id: string;
  name: string;
  description: string;
  active: boolean;
  created_at: string;
}

const Categories: React.FC = () => {
  const { tenantId } = useAuth();
  const storageKey = `categories_${tenantId || 'default'}`;

  const [categories, setCategories] = useState<Category[]>(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Category[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const persist = (next: Category[]) => {
    setCategories(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setToast({ message: 'Informe o nome da categoria.', type: 'error' });
      return;
    }

    if (editingId) {
      const next = categories.map((c) =>
        c.id === editingId ? { ...c, name: name.trim(), description: description.trim() } : c
      );
      persist(next);
      setToast({ message: 'Categoria atualizada com sucesso!', type: 'success' });
      resetForm();
      return;
    }

    const newCategory: Category = {
      id: window.crypto?.randomUUID?.() || `${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      active: true,
      created_at: new Date().toISOString()
    };
    persist([newCategory, ...categories]);
    setToast({ message: 'Categoria criada com sucesso!', type: 'success' });
    resetForm();
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setDescription(category.description);
  };

  const handleToggle = (id: string) => {
    const next = categories.map((c) => (c.id === id ? { ...c, active: !c.active } : c));
    persist(next);
    setToast({ message: 'Status atualizado.', type: 'info' });
  };

  const handleDelete = (id: string) => {
    const next = categories.filter((c) => c.id !== id);
    persist(next);
    if (editingId === id) resetForm();
    setToast({ message: 'Categoria removida.', type: 'info' });
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
                {filtered.length === 0 ? (
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
                          onClick={() => handleToggle(category.id)}
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
                            onClick={() => handleEdit(category)}
                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
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
            Cadastro local por tenant para ativar o fluxo dessa tela.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button variant="secondary" className="flex-1" onClick={resetForm}>
                Limpar
              </Button>
              <Button type="submit" className="flex-1">
                {editingId ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Categories;
