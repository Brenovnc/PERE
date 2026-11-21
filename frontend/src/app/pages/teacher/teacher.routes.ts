import { Routes } from '@angular/router';

/** Teacher area (rendered inside TeacherLayout). */
export const teacherRoutes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./teacher-home-page').then((m) => m.TeacherHomePage),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./teacher-dashboard-page').then((m) => m.TeacherDashboardPage),
  },
  {
    path: 'classrooms/:classroomId/students/:studentId/progress',
    loadComponent: () => import('./student-progress-page').then((m) => m.StudentProgressPage),
  },
  {
    path: 'modules',
    loadComponent: () => import('./modules/modules-page').then((m) => m.ModulesPage),
  },
  {
    path: 'classrooms',
    loadComponent: () => import('./classrooms-page').then((m) => m.ClassroomsPage),
  },
  {
    path: 'community',
    loadComponent: () => import('./community-page').then((m) => m.CommunityPage),
  },
  {
    path: 'account',
    loadComponent: () => import('./account-page').then((m) => m.AccountPage),
  },
  { path: '**', redirectTo: 'home' },
];
