import React from 'react';
import { LayoutDashboard, ShieldCheck, History, PieChart, User } from 'lucide-react';

export type StudentTab = 
  | 'dashboard'
  | 'mark-attendance'
  | 'history'
  | 'percentage'
  | 'profile';

interface StudentNavProps {
  currentTab: StudentTab;
  onSelectTab: (tab: StudentTab) => void;
  hasActiveSession?: boolean;
}

export const StudentNav: React.FC<StudentNavProps> = ({
  currentTab,
  onSelectTab,
  hasActiveSession = false
}) => {
  const tabs = [
    { id: 'dashboard' as StudentTab, label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { 
      id: 'mark-attendance' as StudentTab, 
      label: 'Active Attendance', 
      icon: <ShieldCheck size={16} />,
      badge: hasActiveSession ? <span className="pulse-dot" title="Attendance Open" /> : null
    },
    { id: 'history' as StudentTab, label: 'History', icon: <History size={16} /> },
    { id: 'percentage' as StudentTab, label: 'Percentage', icon: <PieChart size={16} /> },
    { id: 'profile' as StudentTab, label: 'Profile', icon: <User size={16} /> },
  ];

  return (
    <nav style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border-subtle)',
      overflowX: 'auto',
      whiteSpace: 'nowrap'
    }}>
      <div className="app-container" style={{ padding: '0 1rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-start' }}>
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.75rem 0.85rem',
                  fontSize: '0.825rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
