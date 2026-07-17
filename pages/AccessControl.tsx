import React, { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../src/lib/permissions/usePermissions';
import { PERMISSION_DEFINITIONS, MODULE_LABELS } from '../src/lib/permissions/definitions';
import type { PermissionModule } from '../src/lib/permissions/types';
import ProfileColumn from '../src/components/access-control/ProfileColumn';
import PresetSelector from '../src/components/access-control/PresetSelector';
import PermissionPreview from '../src/components/access-control/PermissionPreview';
import Button from '../components/ui/Button';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';

const ALL_MODULES: PermissionModule[] = [
  'schedule', 'clients', 'services', 'financial', 'team', 'reports', 'communication',
];

const TOTAL_PERMISSIONS = PERMISSION_DEFINITIONS.length;

const AccessControl: React.FC = () => {
  const { accessRole, canAccessSuperAdmin } = useAuth();
  const {
    Barber: barberPerms,
    Receptionist: receptionistPerms,
    loading,
    saving,
    error,
    updatePermission,
    applyPreset,
    copyPermissions,
    saveAll,
    resetToDefault,
    hasUnsavedChanges,
    getActiveCount,
  } = usePermissions();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeModuleFilter, setActiveModuleFilter] = useState<PermissionModule | 'all'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [isCopyConfirmOpen, setIsCopyConfirmOpen] = useState(false);
  const [copyDirection, setCopyDirection] = useState<'Barber_to_Receptionist' | 'Receptionist_to_Barber'>('Barber_to_Receptionist');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewRole, setPreviewRole] = useState<'Barber' | 'Receptionist'>('Barber');

  const canManage = canAccessSuperAdmin || accessRole === 'manager';

  const filteredModules = useMemo(() => {
    if (activeModuleFilter !== 'all') return [activeModuleFilter];
    return ALL_MODULES;
  }, [activeModuleFilter]);

  const filteredSearchKeys = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return PERMISSION_DEFINITIONS.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        MODULE_LABELS[p.module].toLowerCase().includes(q)
    ).map((p) => p.key);
  }, [searchQuery]);

  const barberActiveCount = getActiveCount('Barber');
  const receptionistActiveCount = getActiveCount('Receptionist');

  const handleSave = useCallback(async () => {
    try {
      await saveAll();
      setToast({ message: 'Permissoes salvas com sucesso!', type: 'success' });
      setIsSaveConfirmOpen(false);
    } catch {
      setToast({ message: 'Erro ao salvar permissoes.', type: 'error' });
    }
  }, [saveAll]);

  const handleResetBarber = useCallback(async () => {
    try {
      await resetToDefault('Barber');
      setToast({ message: 'Permissoes do Barbeiro redefinidas.', type: 'success' });
    } catch {
      setToast({ message: 'Erro ao redefinir permissoes.', type: 'error' });
    }
  }, [resetToDefault]);

  const handleResetReceptionist = useCallback(async () => {
    try {
      await resetToDefault('Receptionist');
      setToast({ message: 'Permissoes da Recepcionista redefinidas.', type: 'success' });
    } catch {
      setToast({ message: 'Erro ao redefinir permissoes.', type: 'error' });
    }
  }, [resetToDefault]);

  const handleCopyPermissions = useCallback(() => {
    const [from, to] = copyDirection === 'Barber_to_Receptionist'
      ? (['Barber', 'Receptionist'] as const)
      : (['Receptionist', 'Barber'] as const);
    copyPermissions(from, to);
    setIsCopyConfirmOpen(false);
    setToast({
      message: `Permissoes copiadas de ${from === 'Barber' ? 'Barbeiro' : 'Recepcionista'} para ${to === 'Barber' ? 'Barbeiro' : 'Recepcionista'}.`,
      type: 'success',
    });
  }, [copyDirection, copyPermissions]);

  if (!canManage) {
    return (
      <div className="animate-fade-in p-6">
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">lock</span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Acesso Restrito</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Apenas gestores podem acessar o controle de perfis de acesso.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-fade-in p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Carregando permissoes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-4 sm:p-6 space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white display-font">
            Controle de Perfis de Acesso
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure as permissoes de acesso para os perfis de Recepcionista e Barbeiro.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon="visibility"
            onClick={() => { setPreviewRole('Barber'); setIsPreviewOpen(true); }}
          >
            Preview
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon="content_copy"
            onClick={() => setIsCopyConfirmOpen(true)}
          >
            Copiar
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon="save"
            isLoading={saving}
            disabled={!hasUnsavedChanges}
            onClick={() => setIsSaveConfirmOpen(true)}
          >
            Salvar
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">error</span>
          {error}
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">warning</span>
          Voce tem alteracoes nao salvas.
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar funcionalidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => setActiveModuleFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeModuleFilter === 'all'
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            Todos
          </button>
          {ALL_MODULES.map((mod) => (
            <button
              key={mod}
              type="button"
              onClick={() => setActiveModuleFilter(mod)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeModuleFilter === mod
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {MODULE_LABELS[mod]}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Presets - Barbeiro
            </h3>
            <Button
              variant="ghost"
              size="sm"
              leftIcon="restart_alt"
              onClick={handleResetBarber}
            >
              Redefinir
            </Button>
          </div>
          <PresetSelector role="Barber" onApply={(keys) => applyPreset('Barber', keys)} />
        </div>
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Presets - Recepcionista
            </h3>
            <Button
              variant="ghost"
              size="sm"
              leftIcon="restart_alt"
              onClick={handleResetReceptionist}
            >
              Redefinir
            </Button>
          </div>
          <PresetSelector role="Receptionist" onApply={(keys) => applyPreset('Receptionist', keys)} />
        </div>
      </div>

      {/* Permission Matrix - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-5">
          <ProfileColumn
            role="Barber"
            label="Barbeiro"
            subtitle="Perfil profissional de barbearia"
            icon="content_cut"
            color="bg-primary"
            permissions={barberPerms}
            onToggle={(key, enabled) => updatePermission('Barber', key, enabled)}
            modules={filteredModules}
            activeCount={barberActiveCount}
            totalCount={TOTAL_PERMISSIONS}
          />
        </div>

        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark p-5">
          <ProfileColumn
            role="Receptionist"
            label="Recepcionista"
            subtitle="Perfil de atendimento e agendamento"
            icon="front_desk"
            color="bg-emerald-500"
            permissions={receptionistPerms}
            onToggle={(key, enabled) => updatePermission('Receptionist', key, enabled)}
            modules={filteredModules}
            activeCount={receptionistActiveCount}
            totalCount={TOTAL_PERMISSIONS}
          />
        </div>
      </div>

      {/* Bottom Save Bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-card-dark border-t border-slate-200 dark:border-border-dark shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">
              Alteracoes nao salvas
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Descartar
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon="save"
                isLoading={saving}
                onClick={() => setIsSaveConfirmOpen(true)}
              >
                Salvar Alteracoes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal */}
      <Modal
        isOpen={isSaveConfirmOpen}
        onClose={() => setIsSaveConfirmOpen(false)}
        title="Confirmar Alteracoes"
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsSaveConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" isLoading={saving} onClick={handleSave}>
              Confirmar e Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Voce esta prestes a salvar as seguintes configuracoes:
          </p>
          <div className="bg-slate-50 dark:bg-background-dark rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Barbeiro</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{barberActiveCount} permissoes ativas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Recepcionista</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{receptionistActiveCount} permissoes ativas</span>
            </div>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            As alteracoes serao aplicadas imediatamente aos perfis afetados.
          </p>
        </div>
      </Modal>

      {/* Copy Confirmation Modal */}
      <Modal
        isOpen={isCopyConfirmOpen}
        onClose={() => setIsCopyConfirmOpen(false)}
        title="Copiar Permissoes"
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsCopyConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleCopyPermissions}>
              Copiar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Selecione de qual perfil copiar as permissoes:
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-border-dark cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
              <input
                type="radio"
                name="copyDirection"
                checked={copyDirection === 'Barber_to_Receptionist'}
                onChange={() => setCopyDirection('Barber_to_Receptionist')}
                className="text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Barbeiro → Recepcionista
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Copia as permissoes do Barbeiro para a Recepcionista
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-border-dark cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
              <input
                type="radio"
                name="copyDirection"
                checked={copyDirection === 'Receptionist_to_Barber'}
                onChange={() => setCopyDirection('Receptionist_to_Barber')}
                className="text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Recepcionista → Barbeiro
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Copia as permissoes da Recepcionista para o Barbeiro
                </p>
              </div>
            </label>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Esta acao ira substituir todas as permissoes do perfil de destino.
          </p>
        </div>
      </Modal>

      {/* Permission Preview Modal */}
      <PermissionPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        role={previewRole}
        permissions={previewRole === 'Barber' ? barberPerms : receptionistPerms}
      />

      {/* Spacer for bottom bar */}
      {hasUnsavedChanges && <div className="h-16" />}
    </div>
  );
};

export default AccessControl;
