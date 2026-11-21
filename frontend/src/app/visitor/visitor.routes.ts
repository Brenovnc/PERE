import { Routes } from '@angular/router';
import { STUDY_SOURCE } from '../core/study-source';
import { studyScreenRoutes } from '../pages/student/study-screen.routes';
import { VisitorStudySource } from './visitor-study-source';

/** Visitor mode, open to everyone: the study screens run on the engine in the browser. */
export const visitorRoutes: Routes = [
  {
    path: '',
    providers: [{ provide: STUDY_SOURCE, useExisting: VisitorStudySource }],
    children: [
      {
        path: '',
        loadComponent: () => import('./visitor-home-page').then((m) => m.VisitorHomePage),
      },
      ...studyScreenRoutes,
      { path: '**', redirectTo: '' },
    ],
  },
];
