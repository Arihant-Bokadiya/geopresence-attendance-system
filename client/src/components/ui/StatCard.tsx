import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
  helpText?: string;
  indicator?: 'up' | 'down' | 'neutral' | string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  valueColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  helper,
  helpText,
  indicator,
  icon,
  badge,
  valueColor
}) => {
  const displayHelper = helpText || helper;

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between" style={{ marginBottom: '0.35rem' }}>
        <div className="stat-label">{label}</div>
        {icon && <span style={{ color: 'var(--text-muted)' }}>{icon}</span>}
      </div>

      <div className="flex items-baseline gap-2">
        <div className="stat-value mono" style={{ color: valueColor || 'var(--text-primary)' }}>
          {value}
        </div>
        {indicator === 'up' && (
          <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center' }}>
            <TrendingUp size={16} />
          </span>
        )}
        {indicator === 'down' && (
          <span style={{ color: 'var(--color-danger)', display: 'inline-flex', alignItems: 'center' }}>
            <TrendingDown size={16} />
          </span>
        )}
        {badge}
      </div>

      {displayHelper && <div className="stat-helper">{displayHelper}</div>}
    </div>
  );
};
