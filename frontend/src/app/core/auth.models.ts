export type Role = 'TEACHER' | 'STUDENT';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export type AuthMode = 'teacher-login' | 'teacher-register' | 'student-login' | 'student-register';
