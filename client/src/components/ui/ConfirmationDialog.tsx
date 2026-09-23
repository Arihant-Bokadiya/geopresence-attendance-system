import React from 'react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="460px">
      <div className="flex items-start gap-3" style={{ marginBottom: '1.25rem' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: variant === 'danger' ? 'var(--color-danger-bg)' : 'var(--brand-primary-light)',
          color: variant === 'danger' ? 'var(--color-danger)' : 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <AlertTriangle size={18} />
        </div>

        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {message}
        </div>
      </div>

      <div className="flex justify-end gap-2" style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
