import type { User, University, Course, Exam, ExamFile, Report } from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '';

const getInitData = (): string => {
  if (window.Telegram?.WebApp) {
    return window.Telegram.WebApp.initData;
  }
  return '';
};

const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const initData = getInitData();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': initData,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

const mapExamFiles = (exam: Exam & { exam_files?: ExamFile[] }) => {
  if (!exam) return exam;
  if (exam.exam_files && !exam.files) {
    return { ...exam, files: exam.exam_files };
  }
  return exam;
};

const normalizeExamType = (value?: string) => {
  if (!value) return 'Other';
  const normalized = value.toLowerCase();
  if (normalized === 'mid') return 'Mid';
  if (normalized === 'final') return 'Final';
  if (normalized === 'quiz') return 'Quiz';
  return 'Other';
};

const mapExamTypeForApi = (value: string) => {
  return value.toLowerCase();
};

// ============== AUTH API ==============

export const verifyAuth = async (): Promise<{ user: User }> => {
  const initData = getInitData();
  const response = await fetch(`${API_URL}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Authentication failed' }));
    throw new Error(error.error || 'Authentication failed');
  }

  return response.json();
};

// ============== USER API ==============

export const getProfile = async (): Promise<{ user: User }> => {
  return fetchWithAuth('/users/me');
};

export const getUserProfile = async (userId: string): Promise<{ user: User }> => {
  return fetchWithAuth(`/users/${userId}`);
};

export const updateProfile = async (updates: Partial<User>): Promise<{ user: User }> => {
  return fetchWithAuth('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

// ============== FOLLOW API ==============

export const followUser = async (userId: string): Promise<{ ok: boolean }> => {
  return fetchWithAuth(`/users/${userId}/follow`, { method: 'POST' });
};

export const unfollowUser = async (userId: string): Promise<{ ok: boolean }> => {
  return fetchWithAuth(`/users/${userId}/follow`, { method: 'DELETE' });
};

// ============== UNIVERSITY API ==============

export const getUniversities = async (): Promise<{ universities: University[] }> => {
  return fetchWithAuth('/universities');
};

export const createUniversity = async (name: string): Promise<{ university: University }> => {
  return fetchWithAuth('/universities', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
};

// ============== COURSE API ==============

export const getCourses = async (): Promise<{ courses: Course[] }> => {
  return fetchWithAuth('/courses');
};

export const createCourse = async (name: string): Promise<{ course: Course }> => {
  return fetchWithAuth('/courses', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
};

// ============== EXAM API ==============

interface ExamFilters {
  university_id?: string;
  course_id?: string;
  year?: number;
  search?: string;
  user_id?: string;
  followed?: boolean;
}

export const getExams = async (filters: ExamFilters = {}): Promise<{ exams: Exam[] }> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.append(key, String(value));
  });

  const data = await fetchWithAuth(`/exams?${params.toString()}`);
  const exams = (data.exams || []).map((exam: Exam) => {
    const mapped = mapExamFiles(exam as Exam & { exam_files?: ExamFile[] });
    return { ...mapped, exam_type: normalizeExamType(mapped.exam_type) } as Exam;
  });

  return { exams };
};

export const getExam = async (examId: string): Promise<{ exam: Exam }> => {
  const data = await fetchWithAuth(`/exams/${examId}`);
  const mapped = mapExamFiles(data.exam as Exam & { exam_files?: ExamFile[] });
  return { exam: { ...mapped, exam_type: normalizeExamType(mapped.exam_type) } as Exam };
};

export const createExam = async (examData: {
  university_id: string;
  course_id: string;
  year: number;
  exam_type: string;
  teacher_name?: string;
}): Promise<{ exam: Exam }> => {
  const payload = {
    ...examData,
    exam_type: mapExamTypeForApi(examData.exam_type),
  };

  const data = await fetchWithAuth('/exams', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return data;
};

export const likeExam = async (examId: string): Promise<{ ok: boolean }> => {
  return fetchWithAuth(`/exams/${examId}/like`, { method: 'POST' });
};

export const unlikeExam = async (examId: string): Promise<{ ok: boolean }> => {
  return fetchWithAuth(`/exams/${examId}/like`, { method: 'DELETE' });
};

export const uploadExamFiles = (examId: string, files: File[], onProgress?: (percent: number) => void) => {
  const initData = getInitData();
  const form = new FormData();
  files.forEach((file) => form.append('files', file));

  return new Promise<{ files: ExamFile[] }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/exams/${examId}/files`);
    xhr.setRequestHeader('x-telegram-init-data', initData);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data?.error || 'upload_failed'));
        }
      } catch (err) {
        reject(new Error('upload_failed'));
      }
    };

    xhr.onerror = () => reject(new Error('upload_failed'));
    xhr.send(form);
  });
};

// ============== REPORT API ==============

export const createReport = async (reportData: {
  report_type: 'exam' | 'user';
  reported_id: string;
  reason: 'wrong_content' | 'spam' | 'copyright_issue';
}): Promise<{ report: Report }> => {
  return fetchWithAuth('/reports', {
    method: 'POST',
    body: JSON.stringify({
      target_type: reportData.report_type,
      target_id: reportData.reported_id,
      reason: reportData.reason,
    }),
  });
};
