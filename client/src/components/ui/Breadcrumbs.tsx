import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight size={13} style={{ opacity: 0.5 }} />}
          {item.onClick && !item.active ? (
            <button
              type="button"
              onClick={item.onClick}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {item.label}
            </button>
          ) : (
            <span className={`breadcrumb-item ${item.active ? 'active' : ''}`}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
