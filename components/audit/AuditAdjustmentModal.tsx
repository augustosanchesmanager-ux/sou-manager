import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import AuditAdjustmentHistory from './AuditAdjustmentHistory';
import {
    AUDIT_ADJUSTMENT_PHASE_NOTICE,
    AUDIT_ADJUSTMENT_REASON_LABELS,
    AUDIT_ADJUSTMENT_RPC_NOTICE,
    AUDIT_ADJUSTMENT_TYPE_LABELS,
    DEFAULT_AUDIT_ADJUSTMENT_TYPES,
    type AuditAdjustmentContext,
    type AuditAdjustmentDraft,
    type AuditAdjustmentReasonType,
    type AuditAdjustmentType,
} from '../../src/lib/audit-adjustments';

interface AuditAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    context: AuditAdjustmentContext;
    requestedByUserId?: string | null;
    defaultAdjustmentType?: AuditAdjustmentType;
    onPrepared?: (draft: AuditAdjustmentDraft) => void;
}

const reasonOptions = Object.entries(AUDIT_ADJUSTMENT_REASON_LABELS) as [AuditAdjustmentReasonType, string][];

const formatSnapshot = (snapshot?: Record<string, unknown> | null) => {
    if (!snapshot || Object.keys(snapshot).length === 0) {
        return 'Snapshot não informado nesta tela.';
    }

    return JSON.stringify(snapshot, null, 2);
};

const AuditAdjustmentModal: React.FC<AuditAdjustmentModalProps> = ({
    isOpen,
    onClose,
    context,
    requestedByUserId,
    defaultAdjustmentType,
    onPrepared,
}) => {
    const allowedTypes = context.allowedAdjustmentTypes?.length
        ? context.allowedAdjustmentTypes
        : DEFAULT_AUDIT_ADJUSTMENT_TYPES;

    const [adjustmentType, setAdjustmentType] = useState<AuditAdjustmentType>(
        defaultAdjustmentType && allowedTypes.includes(defaultAdjustmentType) ? defaultAdjustmentType : allowedTypes[0],
    );
    const [reasonType, setReasonType] = useState<AuditAdjustmentReasonType>('operational_error');
    const [reasonNote, setReasonNote] = useState('');
    const [confirmationChecked, setConfirmationChecked] = useState(false);
    const [preparedDraft, setPreparedDraft] = useState<AuditAdjustmentDraft | null>(null);

    const typeOptions = useMemo(
        () => allowedTypes.map((type) => [type, AUDIT_ADJUSTMENT_TYPE_LABELS[type]] as [AuditAdjustmentType, string]),
        [allowedTypes],
    );

    const resetAndClose = () => {
        setReasonNote('');
        setConfirmationChecked(false);
        setPreparedDraft(null);
        onClose();
    };

    const canPrepare = Boolean(adjustmentType && reasonType && reasonNote.trim().length > 0 && confirmationChecked);

    const handlePrepare = () => {
        if (!canPrepare) return;

        const draft: AuditAdjustmentDraft = {
            context,
            adjustmentType,
            reasonType,
            reasonNote: reasonNote.trim(),
            requestedAt: new Date().toISOString(),
            requestedByUserId,
        };

        setPreparedDraft(draft);
        onPrepared?.(draft);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={resetAndClose}
            title="Ajuste auditado"
            maxWidth="2xl"
            footer={
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={resetAndClose}>
                        Fechar
                    </Button>
                    <Button
                        leftIcon="verified_user"
                        onClick={handlePrepare}
                        disabled={!canPrepare}
                    >
                        Preparar ajuste
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-500/10">
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                        {AUDIT_ADJUSTMENT_PHASE_NOTICE}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                        {AUDIT_ADJUSTMENT_RPC_NOTICE}
                    </p>
                </div>

                {preparedDraft && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-500/10">
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            Proposta validada localmente. Nenhum dado foi gravado ou alterado.
                        </p>
                        <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                            Próximo passo futuro: persistir a solicitação em audit_adjustments e aplicar impacto financeiro via RPC transacional.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Registro
                        </label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-border-dark dark:bg-white/5 dark:text-white">
                            {context.sourceLabel}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Impacto financeiro estimado
                        </label>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-border-dark dark:bg-white/5 dark:text-white">
                            {context.financialImpactLabel || 'A avaliar na RPC transacional futura'}
                        </div>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Tipo de ajuste
                        </label>
                        <select
                            value={adjustmentType}
                            onChange={(event) => setAdjustmentType(event.target.value as AuditAdjustmentType)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                        >
                            {typeOptions.map(([type, label]) => (
                                <option key={type} value={type}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                            Motivo obrigatório
                        </label>
                        <select
                            value={reasonType}
                            onChange={(event) => setReasonType(event.target.value as AuditAdjustmentReasonType)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                        >
                            {reasonOptions.map(([type, label]) => (
                                <option key={type} value={type}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                        Observação obrigatória
                    </label>
                    <textarea
                        value={reasonNote}
                        onChange={(event) => setReasonNote(event.target.value)}
                        rows={3}
                        placeholder="Explique o erro localizado e o ajuste esperado."
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-background-dark dark:text-white"
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Antes</p>
                        <pre className="max-h-52 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100 dark:border-white/10">
                            {formatSnapshot(context.beforeSnapshot)}
                        </pre>
                    </div>
                    <div>
                        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Depois proposto</p>
                        <pre className="max-h-52 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100 dark:border-white/10">
                            {formatSnapshot(context.proposedAfterSnapshot)}
                        </pre>
                    </div>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-border-dark">
                    <input
                        type="checkbox"
                        checked={confirmationChecked}
                        onChange={(event) => setConfirmationChecked(event.target.checked)}
                        className="mt-1"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                        Confirmo que este ajuste é apenas uma proposta auditada nesta etapa, exige motivo e não apaga histórico nem altera dados financeiros reais.
                    </span>
                </label>

                <AuditAdjustmentHistory sourceLabel={context.sourceLabel} />
            </div>
        </Modal>
    );
};

export default AuditAdjustmentModal;
