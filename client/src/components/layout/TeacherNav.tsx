import React from 'react';
import { 
  LayoutDashboard, PlayCircle, Radio, Users, History, 
  School, GraduationCap, BookOpen, Database, UserCheck
} from 'lucide-react';

export type TeacherTab = 
  | 'dashboard'
  | 'start-attendance'
  | 'active-session'
  | 'roster'
  | 'history'
  | 'students'
  | 'subjects'
  | 'erp'
  | 'profile';

interface TeacherNavProps {
  currentTab: TeacherTab;
  onSelectTab: (tab: TeacherTab) => void;
  hasActiveSession?: boolean;
}

export const TeacherNav: React.FC<TeacherNavProps> = ({
  currentTab,
  onSelectTab,
  hasActiveSession = false
}) => {
  const tabs = [
    { id: 'dashboard' as TeacherTab, label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
    { id: 'start-attendance' as TeacherTab, label: 'Start Attendance', icon: <PlayCircle size={15} /> },
    { 
      id: 'active-session' as TeacherTab, 
      label: 'Active Session', 
      icon: <Radio size={15} />,
      badge: hasActiveSession ? <span className="pulse-dot" title="Session Active" /> : null
    },
    { id: 'roster' as TeacherTab, label: 'Attendance Roster', icon: <Users size={15} /> },
    { id: 'history' as TeacherTab, label: 'Attendance History', icon: <History size={15} /> },
    { id: 'students' as TeacherTab, label: 'Students', icon: <GraduationCap size={15} /> },
    { id: 'subjects' as TeacherTab, label: 'Subjects', icon: <BookOpen size={15} /> },
    { id: 'erp' as TeacherTab, label: 'ERP / Export', icon: <Database size={15} /> },
    { id: 'profile' as TeacherTab, label: 'Profile', icon: <UserCheck size={15} /> },
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
                {tab.badge}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
