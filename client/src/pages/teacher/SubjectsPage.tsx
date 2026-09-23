import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import type { Subject } from '../../types/index.js';
import { Badge } from '../../components/ui/Badge.js';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs.js';
import { BookOpen } from 'lucide-react';

interface SubjectsPageProps {
  onBack: () => void;
}

export const SubjectsPage: React.FC<SubjectsPageProps> = ({ onBack }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ subjects: Subject[] }>('/academic/subjects');
      setSubjects(data.subjects);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      
      <Breadcrumbs items={[
        { label: 'Dashboard', onClick: onBack },
        { label: 'Academic Curriculum', active: true }
      ]} />

      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1>Academic Curriculum Courses</h1>
          <p>Official course offerings registered in institutional curriculum records.</p>
        </div>
      </div>

      <div className="card">
        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Semester</th>
                <th>Credits</th>
                <th>Department</th>
                <th>Format</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub) => (
                <tr key={sub.id}>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} color="var(--brand-primary)" />
                      <span>{sub.code}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {sub.name}
                  </td>
                  <td className="mono">Semester {sub.semester}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{sub.credits || 4}</td>
                  <td>Computer Science & Engineering</td>
                  <td>
                    <Badge variant="info">THEORY + LAB</Badge>
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
