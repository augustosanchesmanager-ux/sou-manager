import React, { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useViaCep } from '../../../src/hooks/useViaCep';

export interface ShopDetailsForm {
  phone: string;
  cnpj: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressCity: string;
  addressState: string;
  chairCount: number;
  timezone: string;
  currency: string;
}

export const CHAIR_OPTIONS = [
  { value: 2, label: '1 a 3 Cadeiras' },
  { value: 5, label: '4 a 7 Cadeiras' },
  { value: 10, label: '8+ Cadeiras' },
];

export const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Recife', label: 'Recife (UTC-3)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Bahia', label: 'Salvador (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
];

const INPUT_CLASS =
  'w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium';

const SELECT_CLASS =
  'w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-xl py-4 px-4 text-sm text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-medium appearance-none [color-scheme:light] dark:[color-scheme:dark]';

interface ShopDetailsStepProps {
  shopName: string;
  tenantSlug: string | null;
  form: ShopDetailsForm;
  onChange: (patch: Partial<ShopDetailsForm>) => void;
  onContinue: () => void;
  loading: boolean;
}

/**
 * Passo 1 — "Sua Barbearia".
 * Dados da empresa + link público + autofill de CEP via ViaCEP.
 */
const ShopDetailsStep: React.FC<ShopDetailsStepProps> = ({
  shopName,
  tenantSlug,
  form,
  onChange,
  onContinue,
  loading,
}) => {
  const { loading: cepLoading, message: cepMessage, fetchAddress } = useViaCep();
  const [lastFetchedCep, setLastFetchedCep] = useState('');
  const [copied, setCopied] = useState(false);

  const publicLink = `${window.location.origin}/#/c/${tenantSlug ?? ''}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Autofill de CEP: só dispara com 8 dígitos e preenche apenas campos vazios.
  // Regra de estado igual à de Settings.tsx: mantém UF digitada diferente de SP.
  useEffect(() => {
    const zipDigits = form.addressZip.replace(/\D/g, '');
    if (zipDigits.length !== 8 || zipDigits === lastFetchedCep) return;

    let cancelled = false;
    void (async () => {
      const address = await fetchAddress(zipDigits);
      if (cancelled || !address) return;
      onChange({
        addressStreet: form.addressStreet || address.street || '',
        addressCity: form.addressCity || address.city || '',
        addressState:
          form.addressState && form.addressState !== 'SP'
            ? form.addressState
            : address.state || form.addressState || 'SP',
      });
      setLastFetchedCep(zipDigits);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.addressZip, lastFetchedCep]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Nome fantasia</label>
        <input
          type="text"
          readOnly
          value={shopName}
          className="w-full bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-400 dark:text-slate-500 font-medium cursor-not-allowed"
        />
        <p className="text-[10px] text-slate-400 ml-1">Definido no cadastro. Pode ser alterado depois nas configurações.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Link público</label>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            readOnly
            value={publicLink}
            className="flex-1 bg-slate-50 dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-4 px-4 text-sm text-slate-500 dark:text-slate-400 font-medium cursor-not-allowed truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors rounded-xl px-4 flex items-center gap-1.5 text-xs font-bold"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="text-[10px] text-slate-400 ml-1">Seus clientes agendam por este link.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Telefone / WhatsApp</label>
        <input
          type="tel"
          required
          placeholder="(11) 99999-9999"
          value={form.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">CNPJ (Opcional)</label>
        <input
          type="text"
          placeholder="00.000.000/0001-00"
          value={form.cnpj}
          onChange={(e) => onChange({ cnpj: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">CEP</label>
        <input
          type="text"
          placeholder="00000-000"
          value={form.addressZip}
          onChange={(e) => onChange({ addressZip: e.target.value })}
          className={INPUT_CLASS}
        />
        {cepLoading && <p className="text-[10px] text-slate-400 ml-1">Consultando CEP...</p>}
        {!cepLoading && cepMessage && <p className="text-[10px] text-slate-400 ml-1">{cepMessage}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="col-span-1 sm:col-span-2 space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Rua</label>
          <input
            type="text"
            placeholder="Rua..."
            value={form.addressStreet}
            onChange={(e) => onChange({ addressStreet: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Número</label>
          <input
            type="text"
            placeholder="123"
            value={form.addressNumber}
            onChange={(e) => onChange({ addressNumber: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Cidade</label>
          <input
            type="text"
            placeholder="São Paulo"
            value={form.addressCity}
            onChange={(e) => onChange({ addressCity: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Estado</label>
          <input
            type="text"
            placeholder="SP"
            maxLength={2}
            value={form.addressState}
            onChange={(e) => onChange({ addressState: e.target.value.toUpperCase() })}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Quantidade de Cadeiras</label>
        <select
          value={form.chairCount}
          onChange={(e) => onChange({ chairCount: Number(e.target.value) })}
          className={SELECT_CLASS}
        >
          {CHAIR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Fuso Horário</label>
        <select
          value={form.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className={SELECT_CLASS}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value} className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Moeda</label>
        <select
          value={form.currency}
          onChange={(e) => onChange({ currency: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="BRL" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Real (R$)</option>
        </select>
      </div>

      <button
        onClick={onContinue}
        disabled={loading}
        className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
      >
        {loading ? 'Salvando...' : 'Continuar'}
        {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
      </button>
    </div>
  );
};

export default ShopDetailsStep;