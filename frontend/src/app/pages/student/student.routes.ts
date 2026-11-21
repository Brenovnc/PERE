import { Routes } from '@angular/router';
import { STUDY_SOURCE } from '../../core/study-source';
import { StudyService } from '../../core/study.service';
import { studyScreenRoutes } from './study-screen.routes';

export const studentRoutes: Routes = [
  {
    path: '',
    providers: [{ provide: STUDY_SOURCE, useExisting: StudyService }],
    children: [
      {
        path: '',
        loadComponent: () => import('./student-modules-page').then((m) => m.StudentModulesPage),
      },
      ...studyScreenRoutes,
      { path: '**', redirectTo: '' },
    ],
  },
];
