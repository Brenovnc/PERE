import { Routes } from '@angular/router';

/**
 * Module, study session and crossword screens. Students (API) and visitors (browser engine) share
 * them; each area provides its STUDY_SOURCE.
 */
export const studyScreenRoutes: Routes = [
  {
    path: 'modules/:moduleId',
    loadComponent: () => import('./student-module-page').then((m) => m.StudentModulePage),
  },
  {
    path: 'modules/:moduleId/crossword',
    loadComponent: () => import('./student-crossword-page').then((m) => m.StudentCrosswordPage),
  },
  {
    path: 'sessions/:sessionId',
    loadComponent: () => import('./study-session-page').then((m) => m.StudySessionPage),
  },
];
