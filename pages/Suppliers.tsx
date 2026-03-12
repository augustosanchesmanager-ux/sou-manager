import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  document?: string;
  address?: string;
}

const defaultForm = {
  name: '',
  email: '',
  phone: '',
  category: 'Produtos',
  document: '',
  address: ''
};

const Suppliers: React.FC = () => {
  const { tenantId } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('suppliers').select('*').order('name');

    if (error) {
      setToast({ message: 'Erro ao carregar fornecedores.', type: 'error' });
      setSuppliers([]);
    } else {
      setSuppliers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filtered = useMemo(
    () =>
      suppliers.filter((s) =>
        `${s.name} ${s.email || ''} ${s.phone || ''} ${s.category || ''}`.toLowerCase().includes(search.toLowerCase())
      ),
    [suppliers, search]
  );

  const closeModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setForm(defaultForm);
  };

  const openNewModal = () => {
    setEditingSupplier(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      category: supplier.category || 'Produtos',
      document: supplier.document || '',
      address: supplier.address || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setToast({ message: 'Informe o nome do fornecedor.', type: 'error' });
      return;
    }

    if (editingSupplier) {
      const { error } = await supabase.from('suppliers').update(form).eq('id', editingSupplier.id);
      if (error) {
        setToast({ message: 'Erro ao atualizar fornecedor.', type: 'error' });
        return;
      }
      setToast({ message: 'Fornecedor atualizado com sucesso!', type: 'success' });
      closeModal();
      fetchSuppliers();
      return;
    }

    const { error } = await supabase.from('suppliers').insert([{ ...form, tenant_id: tenantId }]);
    if (error) {
      setToast({ message: 'Erro ao cadastrar fornecedor.', type: 'error' });
      return;
    }
    setToast({ message: 'Fornecedor cadastrado com sucesso!', type: 'success' });
    closeModal();
    fetchSuppliers();
  };

  const handleDelete = async (supplierId: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', supplierId);
    if (error) {
      setToast({ message: 'Erro ao excluir fornecedor.', type: 'error' });
      return;
    }
    setToast({ message: 'Fornecedor excluído.', type: 'info' });
    fetchSuppliers();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Fornecedores</h2>
          <p className="text-slate-500 mt-1">Gerencie parceiros e contatos de compras.</p>
        </div>
        <Button onClick={openNewModal} leftIcon="add_business">
          Novo Fornecedor
        </Button>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-border-dark">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              placeholder="Buscar fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-widest">
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Documento</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-border-dark text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Carregando...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Nenhum fornecedor encontrado.</td>
                </tr>
              ) : (
                filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 dark:text-white">{supplier.name}</p>
                      <p className="text-[11px] text-slate-500">{supplier.address || 'Sem endereço cadastrado'}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <p>{supplier.phone || 'Sem telefone'}</p>
                      <p className="text-[11px] text-slate-500">{supplier.email || 'Sem e-mail'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                        {supplier.category || 'Outros'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{supplier.document || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(supplier)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(supplier.id)}
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

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-500">Nome</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-500">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="Produtos">Produtos de Revenda</option>
                <option value="Uso Profissional">Uso Profissional</option>
                <option value="Equipamentos">Equipamentos</option>
                <option value="Limpeza">Limpeza</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-500">Telefone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-500">Documento</label>
              <input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
                placeholder="CNPJ/CPF"
                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-500">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-500">Endereço</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {editingSupplier ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Suppliers;
