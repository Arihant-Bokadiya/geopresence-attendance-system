import React from 'react';

export type BadgeVariant = 'present' | 'absent' | 'override' | 'active' | 'closed' | 'neutral' | 'info' | 'danger' | 'success' | 'warning';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  icon,
  className = '',
  style,
  title
}) => {
  const resolvedVariant = variant === 'danger' ? 'absent' : (variant === 'success' ? 'present' : variant);

  return (
    <span className={`badge badge-${resolvedVariant} ${className}`} style={style} title={title}>
      {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
