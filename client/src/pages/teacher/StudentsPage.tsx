import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { StudentDirectoryItem } from '../../types/index.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { Search, GraduationCap, Mail, ArrowLeft } from 'lucide-react';

interface StudentsPageProps {
  onBack: () => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({ onBack }) => {
  const [students, setStudents] = useState<StudentDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ students: StudentDirectoryItem[] }>('/academic/students');
      setStudents(data.students);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = students.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.prn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.rollNumber.includes(searchQuery)
  );

  return (
    <div className="app-container">
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onBack },
        { label: 'Enrolled Students', active: true }
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1>Student Directory & PRN Registry</h1>
          <p>Verified institutional student roster with permanent registration keys.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', paddingLeft: '2.2rem' }}
            placeholder="Search by student PRN, full name, or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Roll</th>
                <th>Permanent Reg. No (PRN)</th>
                <th>Student Full Name</th>
                <th>Institutional Email</th>
                <th>Academic Division</th>
                <th>Academic Year</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.prn}>
                  <td className="mono" style={{ fontWeight: 600 }}>{s.rollNumber}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                    {s.prn}
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.fullName}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1">
                      <Mail size={12} color="var(--text-muted)" />
                      <span>{s.email}</span>
                    </div>
                  </td>
                  <td>{s.division}</td>
                  <td className="mono" style={{ fontSize: '0.8rem' }}>{s.academicYear}</td>
                  <td>
                    <Badge variant={s.isActive ? 'present' : 'neutral'}>
                      {s.isActive ? 'ENROLLED' : 'SUSPENDED'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
