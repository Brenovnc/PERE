import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ClassroomDetails,
  ClassroomProgress,
  ClassroomStatistics,
  ClassroomSummary,
  CommunityMineItem,
  CommunityPage,
  Concept,
  ConceptInput,
  Enrollment,
  ModuleDetails,
  ModuleInput,
  ModuleSummary,
  PublicationValidation,
  StatisticsFilters,
  StudentProgress,
  StudentStatistics,
  TeacherDashboard,
  TeacherProfile,
} from './teacher.models';

function statisticsParams(filters: StatisticsFilters): HttpParams {
  let params = new HttpParams();
  if (filters.custom) {
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
  } else {
    params = params.set('days', filters.days ?? 30);
  }
  if (filters.moduleId) params = params.set('moduleId', filters.moduleId);
  if (filters.activityType) params = params.set('activityType', filters.activityType);
  if (filters.minAttempts !== undefined) params = params.set('minAttempts', filters.minAttempts);
  return params;
}

/** Client for the teacher endpoints: modules, classrooms, progress, community and profile. */
@Injectable({ providedIn: 'root' })
export class TeacherService {
  private readonly http = inject(HttpClient);

  private get<T>(url: string, params?: HttpParams): Promise<T> {
    return firstValueFrom(this.http.get<T>(url, { params }));
  }

  private post<T>(url: string, body: unknown = null): Promise<T> {
    return firstValueFrom(this.http.post<T>(url, body));
  }

  private put<T>(url: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(url, body));
  }

  private delete(url: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(url));
  }

  // Modules
  listModules = () => this.get<ModuleSummary[]>('/api/modules');
  getModule = (id: string) => this.get<ModuleDetails>(`/api/modules/${id}`);
  createModule = (input: ModuleInput) => this.post<ModuleDetails>('/api/modules', input);
  updateModule = (id: string, input: ModuleInput) =>
    this.put<ModuleDetails>(`/api/modules/${id}`, input);
  duplicateModule = (id: string) => this.post<ModuleDetails>(`/api/modules/${id}/duplicate`);
  archiveModule = (id: string) => this.post(`/api/modules/${id}/archive`);
  validateModule = (id: string) =>
    this.get<PublicationValidation>(`/api/modules/${id}/publication-validation`);
  publishModule = (id: string) => this.post<ModuleDetails>(`/api/modules/${id}/publish`);
  createConcept = (moduleId: string, input: ConceptInput) =>
    this.post<Concept>(`/api/modules/${moduleId}/concepts`, input);
  updateConcept = (moduleId: string, conceptId: string, input: ConceptInput) =>
    this.put<Concept>(`/api/modules/${moduleId}/concepts/${conceptId}`, input);
  duplicateConcept = (moduleId: string, conceptId: string) =>
    this.post<Concept>(`/api/modules/${moduleId}/concepts/${conceptId}/duplicate`);
  deactivateConcept = (moduleId: string, conceptId: string) =>
    this.post(`/api/modules/${moduleId}/concepts/${conceptId}/deactivate`);

  /** The API reads the raw request body, so the file text goes as-is with a JSON content type. */
  importModule = (json: string) =>
    firstValueFrom(
      this.http.post<ModuleDetails>('/api/modules/import', json, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  async exportModule(id: string): Promise<{ blob: Blob; fileName: string }> {
    const response = await firstValueFrom(
      this.http.get(`/api/modules/${id}/export`, { observe: 'response', responseType: 'blob' }),
    );
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const fileName = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `module-${id}.json`;
    return { blob: response.body ?? new Blob(), fileName };
  }

  // Classrooms and enrollments
  listClassrooms = () => this.get<ClassroomSummary[]>('/api/classrooms');
  getClassroom = (id: string) => this.get<ClassroomDetails>(`/api/classrooms/${id}`);
  createClassroom = (name: string, code: string) =>
    this.post<ClassroomDetails>('/api/classrooms', { name, code });
  updateClassroom = (id: string, name: string, code: string) =>
    this.put<ClassroomDetails>(`/api/classrooms/${id}`, { name, code });
  regenerateCode = (id: string) =>
    this.post<ClassroomDetails>(`/api/classrooms/${id}/regenerate-code`);
  archiveClassroom = (id: string) => this.post(`/api/classrooms/${id}/archive`);
  assignModule = (classroomId: string, moduleId: string) =>
    this.post(`/api/classrooms/${classroomId}/modules/${moduleId}`);
  unassignModule = (classroomId: string, moduleId: string) =>
    this.delete(`/api/classrooms/${classroomId}/modules/${moduleId}`);
  listEnrollments = (classroomId: string) =>
    this.get<Enrollment[]>(`/api/classrooms/${classroomId}/enrollments`);
  approveEnrollment = (classroomId: string, studentId: string) =>
    this.post(`/api/classrooms/${classroomId}/enrollments/${studentId}/approve`);
  rejectEnrollment = (classroomId: string, studentId: string) =>
    this.post(`/api/classrooms/${classroomId}/enrollments/${studentId}/reject`);
  approveAll = (classroomId: string) =>
    this.post<{ approved: number }>(`/api/classrooms/${classroomId}/enrollments/approve-all`);
  removeEnrollment = (classroomId: string, studentId: string) =>
    this.delete(`/api/classrooms/${classroomId}/enrollments/${studentId}`);

  // Progress and statistics
  dashboard = () => this.get<TeacherDashboard>('/api/teacher/dashboard');
  classroomProgress = (classroomId: string) =>
    this.get<ClassroomProgress>(`/api/classrooms/${classroomId}/progress`);
  studentProgress = (classroomId: string, studentId: string) =>
    this.get<StudentProgress>(`/api/classrooms/${classroomId}/students/${studentId}/progress`);
  classroomStatistics = (classroomId: string, filters: StatisticsFilters) =>
    this.get<ClassroomStatistics>(
      `/api/classrooms/${classroomId}/statistics`,
      statisticsParams(filters),
    );
  studentStatistics = (classroomId: string, studentId: string, filters: StatisticsFilters) =>
    this.get<StudentStatistics>(
      `/api/classrooms/${classroomId}/students/${studentId}/statistics`,
      statisticsParams(filters),
    );

  // Community
  myCommunityModules = () => this.get<CommunityMineItem[]>('/api/community/modules/mine');
  searchCommunity = (search: string, subject: string, page: number) =>
    this.get<CommunityPage>(
      '/api/community/modules',
      new HttpParams()
        .set('search', search)
        .set('subject', subject)
        .set('page', page)
        .set('pageSize', 24),
    );
  shareModule = (moduleId: string) =>
    this.post<CommunityMineItem>('/api/community/modules', { moduleId });
  downloadCommunityModule = (id: string) =>
    this.post<ModuleDetails>(`/api/community/modules/${id}/download`);
  removeCommunityModule = (id: string) => this.delete(`/api/community/modules/${id}`);

  // Profile
  getProfile = () => this.get<TeacherProfile>('/api/teacher/profile');
  updateProfile = (input: Pick<TeacherProfile, 'name' | 'education' | 'institution'>) =>
    this.put<TeacherProfile>('/api/teacher/profile', input);
  changePassword = (input: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) => this.put('/api/teacher/profile/password', input);
}
