export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface Batch {
  id: string;
  name: string;
  divisionId: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  _count?: {
    teachers: number;
    students: number;
    subjects: number;
    divisions: number;
  };
}

export interface User {
  id: string;
  role: Role;
  email: string;
  fullName: string;
  prn?: string;
  rollNumber?: string;
  department?: string;
  phone?: string | null;
  academicYear?: string;
  teacherCode?: string;
  activeDivision?: {
    id: string;
    name: string;
  };
  activeBatch?: {
    id: string;
    name: string;
  };
  isAuthenticationRegistered?: boolean;
  assignments?: Array<{
    id: string;
    subject: { id: string; code: string; name: string };
    division: { id: string; name: string };
    batch?: { id: string; name: string } | null;
  }>;
}

export interface ClassroomDevice {
  id: string;
  deviceId: string;
  classroomId: string;
  bleIdentifier: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  isSimulated?: boolean;
  classroom?: {
    id: string;
    roomCode: string;
    buildingName: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Classroom {
  id: string;
  roomCode: string;
  buildingName: string;
  floorNumber: number;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  locationAccuracyMeters?: number | null;
  hardwareBeaconId?: string;
  isActive: boolean;
  device?: ClassroomDevice;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  department?: Department;
  semester: number;
  credits?: number;
  isActive?: boolean;
}

export interface Division {
  id: string;
  name: string;
  academicYear: string;
  semester: number;
  departmentId?: string;
  department?: Department;
  batches?: Batch[];
  _count?: { enrollments: number };
}

export interface AttendanceSession {
  id: string;
  sessionCode: string;
  status: 'ACTIVE' | 'CLOSED' | 'EXPIRED';
  startedAt: string;
  closedAt?: string;
  expiresAt: string;
  durationSeconds: number;
  rawOtp?: string; // Visible to teacher
  subject: { id?: string; code: string; name: string };
  division: { id?: string; name: string };
  batch?: { id?: string; name: string } | null;
  classroom: Classroom;
  teacher: { fullName: string; teacherCode?: string };
  stats?: {
    totalEnrolled?: number;
    presentCount: number;
    absentCount?: number;
    rejectedCount?: number;
    attendancePercentage?: number;
    totalSubmissions?: number;
  };
  isErpSynced?: boolean;
  records?: Array<{
    id: string;
    studentPrn: string;
    studentName: string;
    rollNumber: string;
    status: string;
    failureReason?: string;
    distanceMeters?: number;
    markedAt: string;
  }>;
}

export interface RosterStudent {
  prn: string;
  rollNumber: string;
  studentName: string;
  email: string;
  department: string;
  subjectCode: string;
  subjectName: string;
  classroomCode: string;
  building: string;
  teacherName: string;
  teacherCode: string;
  sessionCode: string;
  sessionId: string;
  date: string;
  status: string; // 'PRESENT', 'ABSENT', 'REJECTED', 'MANUAL_OVERRIDE'
  markedTimestamp: string | null;
  verificationMode: string;
  locationDistanceMeters: number | null;
  gpsAccuracyMeters: number | null;
  failureReason: string | null;
}

export interface RosterResponse {
  session: {
    id: string;
    code: string;
    subject: string;
    subjectCode: string;
    division: string;
    classroom: string;
    teacher: string;
    startedAt: string;
    status: string;
  };
  summary: {
    totalEnrolled: number;
    presentCount: number;
    absentCount: number;
    attendancePercentage: number;
  };
  roster: RosterStudent[];
}

export interface StudentDirectoryItem {
  prn: string;
  rollNumber: string;
  fullName: string;
  email: string;
  department: string;
  academicYear: string;
  division: string;
  divisionId: string | null;
  isActive: boolean;
}

export interface StudentHistoryRecord {
  sessionId: string;
  sessionCode: string;
  date: string;
  time: string;
  subjectCode: string;
  subjectName: string;
  classroom: string;
  teacherName: string;
  status: string; // 'PRESENT', 'ABSENT', 'REJECTED', 'MANUAL_OVERRIDE'
  distanceMeters: number | null;
  markedAt: string | null;
  failureReason: string | null;
}

export interface SubjectAttendanceStat {
  code: string;
  name: string;
  conducted: number;
  attended: number;
  percentage: number;
}

export interface StudentAttendanceHistoryResponse {
  summary: {
    totalConducted: number;
    totalAttended: number;
    overallPercentage: number;
  };
  subjectStats: SubjectAttendanceStat[];
  history: StudentHistoryRecord[];
}

export interface VerifyLocationResponse {
  verified: boolean;
  status: 'LOCATION_VERIFIED' | 'OUTSIDE_CLASSROOM' | 'ACCURACY_TOO_LOW' | 'SESSION_EXPIRED';
  message: string;
  distanceMeters?: number;
  allowedRadiusMeters?: number;
  classroom?: string;
  accuracy?: number;
  threshold?: number;
}
