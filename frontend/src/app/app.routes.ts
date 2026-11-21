import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [guestGuard],
    title: 'PERE — Entrar',
    loadComponent: () => import('./pages/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'teacher',
    canMatch: [roleGuard('TEACHER')],
    title: 'PERE — Área do professor',
    loadComponent: () => import('./layouts/teacher-layout').then((m) => m.TeacherLayout),
    loadChildren: () => import('./pages/teacher/teacher.routes').then((m) => m.teacherRoutes),
  },
  {
    path: 'student',
    canMatch: [roleGuard('STUDENT')],
    title: 'PERE — Área do aluno',
    loadChildren: () => import('./pages/student/student.routes').then((m) => m.studentRoutes),
  },
  {
    path: 'visitor',
    title: 'PERE — Modo visitante',
    loadChildren: () => import('./visitor/visitor.routes').then((m) => m.visitorRoutes),
  },
  { path: '**', redirectTo: '' },
];
