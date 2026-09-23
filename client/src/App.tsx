import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { apiRequest } from './utils/api.js';

// Layout & Navigation Components
import { AppHeader } from './components/layout/AppHeader.js';
import { AdminNav, type AdminTab } from './components/layout/AdminNav.js';
import { TeacherNav, type TeacherTab } from './components/layout/TeacherNav.js';
import { StudentNav, type StudentTab } from './components/layout/StudentNav.js';
import { Login } from './pages/Login.js';

// Super Admin Pages
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.js';
import { AdminClassroomsPage } from './pages/admin/AdminClassroomsPage.js';
import { AdminDevicesPage } from './pages/admin/AdminDevicesPage.js';
import { AdminSubjectsPage } from './pages/admin/AdminSubjectsPage.js';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage.js';
import { AdminDivisionsPage } from './pages/admin/AdminDivisionsPage.js';
import { AdminTeachersPage } from './pages/admin/AdminTeachersPage.js';
import { AdminStudentsPage } from './pages/admin/AdminStudentsPage.js';
import { AdminAssignmentsPage } from './pages/admin/AdminAssignmentsPage.js';

// Teacher Pages
import { TeacherDashboardPage } from './pages/teacher/TeacherDashboardPage.js';
import { StartAttendancePage } from './pages/teacher/StartAttendancePage.js';
import { ActiveSessionPage } from './pages/teacher/ActiveSessionPage.js';
import { TeacherRosterPage } from './pages/teacher/TeacherRosterPage.js';
import { TeacherHistoryPage } from './pages/teacher/TeacherHistoryPage.js';
import { StudentsPage } from './pages/teacher/StudentsPage.js';
import { SubjectsPage } from './pages/teacher/SubjectsPage.js';
import { ErpExportPage } from './pages/teacher/ErpExportPage.js';
import { TeacherProfilePage } from './pages/teacher/TeacherProfilePage.js';

// Student Pages
import { StudentDashboardPage } from './pages/student/StudentDashboardPage.js';
import { MarkAttendancePage } from './pages/student/MarkAttendancePage.js';
import { StudentHistoryPage } from './pages/student/StudentHistoryPage.js';
import { StudentPercentagePage } from './pages/student/StudentPercentagePage.js';
import { StudentProfilePage } from './pages/student/StudentProfilePage.js';

import './styles/tokens.css';
import './styles/main.css';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();

  // Role-Specific Navigation State
  const [adminTab, setAdminTab] = useState<AdminTab>('overview');
  const [teacherTab, setTeacherTab] = useState<TeacherTab>('dashboard');
  const [studentTab, setStudentTab] = useState<StudentTab>('dashboard');

  // Shared Navigation Context (e.g. Opening specific active session or roster)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Background active session monitor for navigation indicator
  useEffect(() => {
    if (!user) return;

    const checkActiveSession = async () => {
      try {
        if (user.role === 'STUDENT') {
          const res = await apiRequest<any>('/sessions/active/for-student').catch(() => null);
          setHasActiveSession(!!(res?.hasActiveSession && !res?.alreadyMarked));
        } else {
          const res = await apiRequest<any>('/sessions?status=ACTIVE&limit=1').catch(() => null);
          const active = res?.sessions?.some((s: any) => s.status === 'ACTIVE');
          setHasActiveSession(!!active);
        }
      } catch (err) {
        setHasActiveSession(false);
      }
    };

    checkActiveSession();
    const interval = setInterval(checkActiveSession, 12000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle Loading Auth State
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-canvas)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-dot" style={{ width: '18px', height: '18px', margin: '0 auto 1.25rem' }} />
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading Enterprise Attendance System...</div>
        </div>
      </div>
    );
  }

  // Unauthenticated Users: Direct Login
  if (!user) {
    return <Login />;
  }

  // Navigation Handlers for Teacher
  const handleStartSession = () => {
    setTeacherTab('start-attendance');
  };

  const handleSessionCreated = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setTeacherTab('active-session');
  };

  const handleOpenActiveSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setTeacherTab('active-session');
  };

  const handleOpenRoster = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setTeacherTab('roster');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-canvas)' }}>
      {/* Top Application Header */}
      <AppHeader
        onNavigateProfile={() => {
          if (user.role === 'ADMIN') {
            setAdminTab('overview');
          } else if (user.role === 'STUDENT') {
            setStudentTab('profile');
          } else {
            setTeacherTab('profile');
          }
        }}
      />

      {/* Role-Specific Sub-Navigation */}
      {user.role === 'ADMIN' ? (
        <AdminNav
          currentTab={adminTab}
          onSelectTab={(tab) => setAdminTab(tab)}
        />
      ) : user.role === 'STUDENT' ? (
        <StudentNav
          currentTab={studentTab}
          onSelectTab={(tab) => setStudentTab(tab)}
          hasActiveSession={hasActiveSession}
        />
      ) : (
        <TeacherNav
          currentTab={teacherTab}
          onSelectTab={(tab) => setTeacherTab(tab)}
          hasActiveSession={hasActiveSession}
        />
      )}

      {/* Main Role-Guarded Content Area */}
      <main style={{ flex: 1, padding: '1.5rem 0' }}>
        {user.role === 'ADMIN' ? (
          // ==================== SUPER ADMIN ROUTES ====================
          <>
            {adminTab === 'overview' && (
              <AdminOverviewPage onNavigate={(tab) => setAdminTab(tab)} />
            )}
            {adminTab === 'classrooms' && (
              <AdminClassroomsPage />
            )}
            {adminTab === 'devices' && (
              <AdminDevicesPage />
            )}
            {adminTab === 'subjects' && (
              <AdminSubjectsPage />
            )}
            {adminTab === 'departments' && (
              <AdminDepartmentsPage />
            )}
            {adminTab === 'divisions' && (
              <AdminDivisionsPage />
            )}
            {adminTab === 'teachers' && (
              <AdminTeachersPage />
            )}
            {adminTab === 'students' && (
              <AdminStudentsPage />
            )}
            {adminTab === 'assignments' && (
              <AdminAssignmentsPage />
            )}
          </>
        ) : user.role === 'STUDENT' ? (
          // ==================== STUDENT ROUTES ====================
          <>
            {studentTab === 'dashboard' && (
              <StudentDashboardPage
                user={user}
                onNavigateAttendance={(sessId) => {
                  setSelectedSessionId(sessId || null);
                  setStudentTab('mark-attendance');
                }}
              />
            )}

            {studentTab === 'mark-attendance' && (
              <MarkAttendancePage
                user={user}
                sessionId={selectedSessionId}
                onNavigateBack={() => {
                  setSelectedSessionId(null);
                  setStudentTab('dashboard');
                }}
                onNavigateHistory={() => setStudentTab('history')}
              />
            )}

            {studentTab === 'history' && (
              <StudentHistoryPage
                user={user}
                onNavigateAttendance={() => setStudentTab('mark-attendance')}
              />
            )}

            {studentTab === 'percentage' && (
              <StudentPercentagePage
                user={user}
              />
            )}

            {studentTab === 'profile' && (
              <StudentProfilePage
                user={user}
              />
            )}
          </>
        ) : (
          // ==================== TEACHER ROUTES ====================
          <>
            {teacherTab === 'dashboard' && (
              <TeacherDashboardPage
                user={user}
                onNavigateStart={handleStartSession}
                onNavigateActive={handleOpenActiveSession}
                onNavigateRoster={handleOpenRoster}
                onNavigateHistory={() => setTeacherTab('history')}
              />
            )}

            {teacherTab === 'start-attendance' && (
              <StartAttendancePage
                onSessionCreated={handleSessionCreated}
                onCancel={() => setTeacherTab('dashboard')}
              />
            )}

            {teacherTab === 'active-session' && (
              <ActiveSessionPage
                sessionId={selectedSessionId}
                onSessionClosed={() => {
                  setSelectedSessionId(null);
                  setTeacherTab('dashboard');
                }}
                onBack={() => setTeacherTab('dashboard')}
                onNavigateStart={() => setTeacherTab('start-attendance')}
              />
            )}

            {teacherTab === 'roster' && (
              <TeacherRosterPage
                initialSessionId={selectedSessionId || undefined}
                onBack={() => setTeacherTab('dashboard')}
              />
            )}

            {teacherTab === 'history' && (
              <TeacherHistoryPage
                onSelectSession={(sessId) => {
                  setSelectedSessionId(sessId);
                  setTeacherTab('roster');
                }}
                onBack={() => setTeacherTab('dashboard')}
              />
            )}

            {teacherTab === 'students' && (
              <StudentsPage
                onBack={() => setTeacherTab('dashboard')}
              />
            )}

            {teacherTab === 'subjects' && (
              <SubjectsPage
                onBack={() => setTeacherTab('dashboard')}
              />
            )}

            {teacherTab === 'erp' && (
              <ErpExportPage
                onBack={() => setTeacherTab('dashboard')}
              />
            )}

            {teacherTab === 'profile' && (
              <TeacherProfilePage
                user={user}
                onBack={() => setTeacherTab('dashboard')}
              />
            )}
          </>
        )}
      </main>

      {/* Enterprise Institutional Footer */}
      <footer style={{
        backgroundColor: '#ffffff',
        borderTop: '1px solid var(--border-subtle)',
        padding: '1.25rem 1rem',
        marginTop: 'auto'
      }}>
        <div className="app-container flex items-center justify-between" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong>GeoPresence™ Enterprise</strong> • Higher Education Academic Attendance System
          </div>
          <div className="flex items-center gap-4">
            <span>Dual-Factor Verification: Haversine Geofence + Cryptographic OTP</span>
            <span style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span className="pulse-dot" style={{ width: '6px', height: '6px' }} /> Engine Active
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
