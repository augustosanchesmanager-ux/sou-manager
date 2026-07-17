import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import AuditAdjustmentModal from './AuditAdjustmentModal';
import {
    canRequestAuditAdjustment,
    type AuditAdjustmentContext,
    type AuditAdjustmentDraft,
    type AuditAdjustmentType,
} from '../../src/lib/audit-adjustments';

interface AuditAdjustmentButtonProps {
    context: AuditAdjustmentContext;
    defaultAdjustmentType?: AuditAdjustmentType;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'ghost' | 'warning';
    className?: string;
    onPrepared?: (draft: AuditAdjustmentDraft) => void;
}

const AuditAdjustmentButton: React.FC<AuditAdjustmentButtonProps> = ({
    context,
    defaultAdjustmentType,
    label = 'Ajuste auditado',
    size = 'sm',
    variant = 'secondary',
    className,
    onPrepared,
}) => {
    const { accessRole, canAccessSuperAdmin, user, tenantId } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    if (!canRequestAuditAdjustment(accessRole, canAccessSuperAdmin)) {
        return null;
    }

    const safeContext: AuditAdjustmentContext = {
        ...context,
        tenantId: context.tenantId ?? tenantId,
    };

    return (
        <>
            <Button
                type="button"
                variant={variant}
                size={size}
                leftIcon="rule_settings"
                className={className}
                onClick={() => setIsOpen(true)}
            >
                {label}
            </Button>
            <AuditAdjustmentModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                context={safeContext}
                requestedByUserId={user?.id}
                defaultAdjustmentType={defaultAdjustmentType}
                onPrepared={onPrepared}
            />
        </>
    );
};

export default AuditAdjustmentButton;
