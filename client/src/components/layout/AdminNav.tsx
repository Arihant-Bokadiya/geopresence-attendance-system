import React from 'react';
import { 
  LayoutDashboard, School, BookOpen, Building2, 
  Layers, Users, GraduationCap, UserCheck, Shield, Radio
} from 'lucide-react';

export type AdminTab = 
  | 'overview'
  | 'classrooms'
  | 'devices'
  | 'subjects'
  | 'departments'
  | 'divisions'
  | 'teachers'
  | 'students'
  | 'assignments';

interface AdminNavProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
}

export const AdminNav: React.FC<AdminNavProps> = ({
  currentTab,
  onSelectTab
}) => {
  const tabs = [
    { id: 'overview' as AdminTab, label: 'Overview', icon: <LayoutDashboard size={15} /> },
    { id: 'classrooms' as AdminTab, label: 'Classrooms', icon: <School size={15} /> },
    { id: 'devices' as AdminTab, label: 'Classroom Devices', icon: <Radio size={15} /> },
    { id: 'subjects' as AdminTab, label: 'Subjects', icon: <BookOpen size={15} /> },
    { id: 'departments' as AdminTab, label: 'Departments', icon: <Building2 size={15} /> },
    { id: 'divisions' as AdminTab, label: 'Divisions & Batches', icon: <Layers size={15} /> },
    { id: 'teachers' as AdminTab, label: 'Teachers', icon: <Users size={15} /> },
    { id: 'students' as AdminTab, label: 'Students', icon: <GraduationCap size={15} /> },
    { id: 'assignments' as AdminTab, label: 'Teacher Allocations', icon: <UserCheck size={15} /> },
  ];

  return (
    <nav style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid var(--border-subtle)',
      overflowX: 'auto',
      whiteSpace: 'nowrap'
    }}>
      <div className="app-container" style={{ padding: '0 1rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
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
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
