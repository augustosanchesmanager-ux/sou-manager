import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Trophy } from 'lucide-react';
import Modal from '../ui/Modal';
import {
  deleteProductGoalTemplate,
  fetchProductGoalTemplates,
  upsertProductGoalTemplate,
} from '../../domain/productGoals/productGoalsRepository';
import type {
  ProductGoalPeriod,
  ProductGoalTargetRole,
  ProductGoalTemplate,
  ProductGoalTier,
} from '../../domain/productGoals/types';
import { createEmptyTier, ProductGoalTiersEditor } from './ProductGoalTiersEditor';

interface ProductGoalTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  onChanged?: (templates: ProductGoalTemplate[]) => void;
  onNotify?: (message: string, type: 'success' | 'error') => void;
}

const ROLE_LABELS: Record<ProductGoalTargetRole, string> = {
  receptionist: 'Recepção',
  barber: 'Barbeiros',
  all: 'Todos os Cargos',
};

const PERIOD_LABELS: Record<ProductGoalPeriod, string> = {
  monthly: 'Mensal',
  biweekly: 'Quinzenal',
  weekly: 'Semanal',
};

export const ProductGoalTemplatesModal: React.FC<ProductGoalTemplatesModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onChanged,
  onNotify,
}) => {
  const [templates, setTemplates] = useState<ProductGoalTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState<ProductGoalTargetRole>('receptionist');
  const [periodType, setPeriodType] = useState<ProductGoalPeriod>('monthly');
  const [baseGoalAmount, setBaseGoalAmount] = useState('1500');
  const [tiers, setTiers] = useState<ProductGoalTier[]>([createEmptyTier(0)]);
  const [active, setActive] = useState(true);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const list = await fetchProductGoalTemplates(tenantId);
      setTemplates(list);
      onChanged?.(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && tenantId) {
      load();
    }
  }, [isOpen, tenantId]);

  const resetForm = () => {
    setEditingId(undefined);
    setName('');
    setTargetRole('receptionist');
    setPeriodType('monthly');
    setBaseGoalAmount('1500');
    setTiers([createEmptyTier(0)]);
    setActive(true);
  };

  const handleEdit = (tpl: ProductGoalTemplate) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setTargetRole(tpl.targetRole);
    setPeriodType(tpl.periodType);
    setBaseGoalAmount(String(tpl.baseGoalAmount || 0));
    setTiers(tpl.tiers.length > 0 ? tpl.tiers : [createEmptyTier(0)]);
    setActive(tpl.active);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onNotify?.('Informe um nome para o modelo de meta.', 'error');
      return;
    }
    setSaving(true);
    try {
      await upsertProductGoalTemplate(tenantId, {
        id: editingId,
        name: name.trim(),
        targetRole,
        periodType,
        baseGoalAmount: parseFloat(baseGoalAmount) || 0,
        tiers,
        active,
      });
      onNotify?.('Modelo de meta salvo com sucesso.', 'success');
      resetForm();
      await load();
    } catch (err: any) {
      onNotify?.(err?.message || 'Erro ao salvar modelo de meta.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProductGoalTemplate(tenantId, id);
      onNotify?.('Modelo removido.', 'success');
      if (editingId === id) resetForm();
      await load();
    } catch (err: any) {
      onNotify?.(err?.message || 'Erro ao remover modelo.', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Modelos de Metas de Produtos"
      maxWidth="2xl"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Lista de modelos existentes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400">
              Modelos Cadastrados ({templates.length})
            </h4>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#B88A44] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Modelo
              </button>
            )}
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 py-2">Carregando modelos...</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
              Nenhum modelo criado ainda. Crie um modelo padrão para Recepção ou Barbeiros abaixo.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleEdit(tpl)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2 ${
                    editingId === tpl.id
                      ? 'border-[#B88A44] bg-[#B88A44]/10'
                      : 'border-slate-200 dark:border-[#2D2A26] bg-slate-50/70 dark:bg-[#141210] hover:border-[#B88A44]/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-[#B88A44]" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {tpl.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-stone-400 mt-1">
                      {ROLE_LABELS[tpl.targetRole]} · {PERIOD_LABELS[tpl.periodType]} · {tpl.tiers.length} faixa(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tpl.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500"
                    title="Excluir modelo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulário de criação/edição */}
        <form
          onSubmit={handleSave}
          className="p-4 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] space-y-3"
        >
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-stone-200">
            {editingId ? 'Editar Modelo' : 'Criar Novo Modelo de Meta'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Nome do Modelo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Meta Padrão Recepção"
                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Cargo Alvo
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as ProductGoalTargetRole)}
                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
              >
                <option value="receptionist">Recepção</option>
                <option value="barber">Barbeiros</option>
                <option value="all">Todos os Cargos</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Periodicidade
              </label>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as ProductGoalPeriod)}
                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
              >
                <option value="monthly">Mensal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Meta Base de Referência (R$)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={baseGoalAmount}
                onChange={(e) => setBaseGoalAmount(e.target.value)}
                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
                placeholder="Ex: 1500 (usado para gatilhos em % da meta)"
              />
            </div>

            <label className="flex items-center gap-2 pt-4 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="size-4 rounded text-[#B88A44] focus:ring-[#B88A44]"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-stone-300">
                Modelo ativo
              </span>
            </label>
          </div>

          <ProductGoalTiersEditor
            tiers={tiers}
            onChange={setTiers}
            roleHint={targetRole}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-stone-300 hover:bg-slate-200/50 dark:hover:bg-white/5"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#B88A44] text-[#0E0C0A] text-xs font-black hover:bg-[#a67b3a] disabled:opacity-50"
            >
              {saving ? 'Salvando...' : editingId ? 'Atualizar Modelo' : 'Salvar Modelo'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
