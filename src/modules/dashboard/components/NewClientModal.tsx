import React from 'react';
import Modal from '../../../../components/ui/Modal';
import type { NewClientFormState } from '../types';

interface NewClientModalProps {
  isOpen: boolean;
  form: NewClientFormState;
  setForm: React.Dispatch<React.SetStateAction<NewClientFormState>>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  form,
  setForm,
  onClose,
  onSubmit,
  isSubmitting,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Cadastrar Novo Cliente" maxWidth="md">
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
        <input
          type="text"
          required
          placeholder="Ex: Carlos Oliveira"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone / WhatsApp</label>
        <input
          type="tel"
          required
          placeholder="(11) 99999-9999"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">E-mail (Opcional)</label>
        <input
          type="email"
          placeholder="exemplo@email.com"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
        >
          {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </div>
    </form>
  </Modal>
);

