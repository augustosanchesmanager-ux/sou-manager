import React, { useCallback, useEffect, useState } from 'react';
import { FileCheck2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import {
  CURRENT_LEGAL_DOCUMENTS,
  type LegalDocumentSpec,
} from '../src/lib/legal/documents';
import { legalRepository, type LegalAcceptanceRecord } from '../domain/legal/repository';

const LegalCenter: React.FC = () => {
  const { tenantId, user } = useAuth();
  const [acceptances, setAcceptances] = useState<LegalAcceptanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingDoc, setSubmittingDoc] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadAcceptances = useCallback(async () => {
    if (!tenantId) {
      setAcceptances([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await legalRepository.listByTenant(tenantId);
      setAcceptances(rows);
    } catch (err) {
      console.error('[LegalCenter] Erro ao carregar aceites:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadAcceptances();
  }, [loadAcceptances]);

  const getAcceptanceForDoc = (doc: LegalDocumentSpec) =>
    acceptances.find(
      (a) => a.document_type === doc.type && a.document_version === doc.version
    );

  const handleAccept = async (doc: LegalDocumentSpec) => {
    if (!user || !tenantId) return;
    setSubmittingDoc(doc.type);
    try {
      await legalRepository.recordAcceptance(doc.type, doc.version);
      setToast({ message: `Aceite de "${doc.title}" (v${doc.version}) registrado.`, type: 'success' });
      await loadAcceptances();
    } catch (err) {
      console.error('[LegalCenter] Erro ao registrar aceite:', err);
      setToast({ message: 'Não foi possível registrar o aceite no servidor.', type: 'error' });
    } finally {
      setSubmittingDoc(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-border-dark pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
            <ShieldCheck className="h-4 w-4" />
            Compliance & LGPD
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Centro Jurídico
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Documentos vigentes versionados e trilha imutável de aceite eletrônico da unidade.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {CURRENT_LEGAL_DOCUMENTS.map((doc) => {
          const accepted = getAcceptanceForDoc(doc);
          return (
            <section
              key={doc.type}
              className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 space-y-4 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{doc.title}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Versão {doc.version} • Vigência: {doc.effectiveDate}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{doc.summary}</p>
                </div>

                {tenantId && (
                  <div className="shrink-0">
                    {accepted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                        <CheckCircle2 className="h-4 w-4" />
                        Aceito em {new Date(accepted.accepted_at).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={submittingDoc !== null}
                        onClick={() => void handleAccept(doc)}
                      >
                        {submittingDoc === doc.type ? 'Registrando...' : 'Registrar Aceite'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-white/5">
                {doc.sections.map((section) => (
                  <div key={section.heading} className="space-y-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {section.heading}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {tenantId && (
        <section className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-6 space-y-3 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Histórico Imutável de Aceites da Unidade
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">Carregando histórico...</p>
          ) : acceptances.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum aceite registrado para esta unidade ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-border-dark text-slate-500 uppercase">
                    <th className="py-2 pr-4">Documento</th>
                    <th className="py-2 pr-4">Versão</th>
                    <th className="py-2 pr-4">Data / Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {acceptances.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 font-semibold text-slate-800 dark:text-slate-100">
                        {row.document_type}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{row.document_version}</td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                        {new Date(row.accepted_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default LegalCenter;
