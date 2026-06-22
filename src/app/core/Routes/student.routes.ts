import { Routes } from '@angular/router';

export const STUDENT_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../../features/Student/student-dashboard/student-dashboard')
        .then(m => m.StudentDashboard),
  },
  {
    path: 'courses',
    loadComponent: () =>
      import('../../features/Student/student-my-courses/student-my-courses')
        .then(m => m.StudentMyCourses),
  },
  {
    path: 'courses/:courseId/learn',
    loadComponent: () =>
      import('../../features/Student/student-course-player/student-course-player')
        .then(m => m.StudentCoursePlayer),
  },
  {
    path: 'courses/:courseId/learn/:lectureId',
    loadComponent: () =>
      import('../../features/Student/student-course-player/student-course-player')
        .then(m => m.StudentCoursePlayer),
  },
  {
    path: 'quizzes/:quizId',
    loadComponent: () =>
      import('../../features/Student/student-quiz/student-quiz')
        .then(m => m.StudentQuiz),
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('../../features/Student/student-reviews/student-reviews')
        .then(m => m.StudentReviews),
  },
  {
    path: 'courses/:courseId/community',
    loadComponent: () =>
      import('../../features/Student/student-community/student-community')
        .then(m => m.StudentCommunity),
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('../../features/Student/student-chat/student-chat')
        .then(m => m.StudentChat),
  },
  {
    path: 'chat/:conversationId',
    loadComponent: () =>
      import('../../features/Student/student-chat/student-chat')
        .then(m => m.StudentChat),
  },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('../../features/Student/student-leaderboard/student-leaderboard')
        .then(m => m.StudentLeaderboard),
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('../../features/Student/student-notifications/student-notifications')
        .then(m => m.StudentNotifications),
  },
  {
    path: 'subscription',
    loadComponent: () =>
      import('../../features/Student/student-subscription/student-subscription')
        .then(m => m.StudentSubscription),
  },
  {
    path: 'referral',
    loadComponent: () =>
      import('../../features/Student/student-referral/student-referral')
        .then(m => m.StudentReferral),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('../../features/Student/student-profile/student-profile')
        .then(m => m.StudentProfile),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
