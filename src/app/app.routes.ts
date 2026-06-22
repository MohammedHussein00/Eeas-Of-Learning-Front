import { Routes } from '@angular/router';
import { authGuardFn } from './core/guards/auth-guard';

export const routes: Routes = [
  {
  path: '',
  loadComponent: () => import('./features/layout/layout/layout').then(m => m.Layout),
  children: [
    { path: '', loadComponent: () => import('./features/home/home/home').then(m => m.Home) },
    { path: 'courses', loadComponent: () => import('./features/home/courses/courses').then(m => m.Courses) },
    { path: 'courses/:id', loadComponent: () => import('./features/home/course-details/course-details').then(m => m.CourseDetails) },
    { path: 'checkout/:id', loadComponent: () => import('./features/home/course-checkout/course-checkout').then(m => m.CourseCheckout) },
  ],
},
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword),
  },
 
  {
    path: 'teacher',
    canActivate: [authGuardFn],
    data: { roles: ['Teacher'] },
    loadComponent: () => import('./features/Teacher/teacher-layout/teacher-layout').then(m => m.TeacherLayout),
    loadChildren: () => import('./core/Routes/teacher.routes').then(m => m.TEACHER_ROUTES),
  },
  {
    path: 'dash',
    canActivate: [authGuardFn],
    data: { roles: ['Admin'] },
    loadComponent: () => import('./features/Admin/admin-layout/admin-layout').then(m => m.AdminLayout),
    loadChildren: () => import('./core/Routes/admin.routes').then(m => m.TEACHER_ROUTES),
  },
  {
    path: 'student',
    canActivate: [authGuardFn],
    data: { roles: ['Student'] },
    loadComponent: () => import('./features/Student/student-layout/student-layout').then(m => m.StudentLayout),
    loadChildren: () => import('./core/Routes/student.routes').then(m => m.STUDENT_ROUTES),
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];