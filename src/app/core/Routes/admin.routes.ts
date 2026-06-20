import { Routes } from '@angular/router';

export const TEACHER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../../features/Admin/admin-dashboard/admin-dashboard')
        .then(m => m.AdminDashboard),
  },
  {
    path: 'academics',
    loadComponent: () =>
      import('../../features/Admin/academic-management/academic-management')
        .then(m => m.AcademicManagement),
  },
  {
    path: 'add-section',
    loadComponent: () =>
      import('../../features/Admin/academic-section-form/academic-section-form')
        .then(m => m.AcademicSectionForm),
  },
  {
    path: 'add-stage',
    loadComponent: () =>
      import('../../features/Admin/academic-stage-form/academic-stage-form')
        .then(m => m.AcademicStageForm),
  },
  {
    path: 'stages/:id',
    loadComponent: () =>
      import('../../features/Admin/academic-stage-form/academic-stage-form')
        .then(m => m.AcademicStageForm),
  },
  {
    path: 'add-year',
    loadComponent: () =>
      import('../../features/Admin/academic-year-form/academic-year-form')
        .then(m => m.AcademicYearForm),
  },
  {
    path: 'years/:id',
    loadComponent: () =>
      import('../../features/Admin/academic-year-form/academic-year-form')
        .then(m => m.AcademicYearForm),
  },
  {
    path: 'sections/:id',
    loadComponent: () =>
      import('../../features/Admin/academic-section-form/academic-section-form')
        .then(m => m.AcademicSectionForm),
  },

  {
    path: 'plans',
    loadComponent: () =>
      import('../../features/Admin/plans-list/plans-list')
        .then(m => m.PlansList),
  },
  {
    path: 'add-plan',
    loadComponent: () =>
      import('../../features/Admin/add-edit-plan/add-edit-plan')
        .then(m => m.AddEditPlan),
  },
  {
    path: 'plans/:id',
    loadComponent: () =>
      import('../../features/Admin/add-edit-plan/add-edit-plan')
        .then(m => m.AddEditPlan),
  },
  {
    path: 'referrals',
    loadComponent: () =>
      import('../../features/Admin/referral-management/referral-management')
        .then(m => m.ReferralManagement),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];