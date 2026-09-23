import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  type?: 'info' | 'success' | 'warning' | 'error' | 'danger';
  title?: string;
  message?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Alert: React.FC<AlertProps> = ({
  variant,
  type,
  title,
  message,
  children,
  onClose,
  className = '',
  style
}) => {
  // Normalize type/variant
  const effectiveVariant: 'info' | 'success' | 'warning' | 'danger' =
    variant || (type === 'error' ? 'danger' : (type as any)) || 'info';

  const getIcon = () => {
    switch (effectiveVariant) {
      case 'success': return <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />;
      case 'warning': return <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />;
      case 'danger': return <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />;
      default: return <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />;
    }
  };

  const content = message || children;

  return (
    <div className={`alert alert-${variant} ${className}`}>
      {getIcon()}
      <div className="flex-1">
        {title && <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{title}</div>}
        {content && <div>{content}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
};
