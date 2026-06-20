import { Routes } from '@angular/router';

export const TEACHER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../../features/Teacher/teacher-dashboard/teacher-dashboard')
        .then(m => m.TeacherDashboard),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('../../features/Teacher/teacher-profile/teacher-profile')
        .then(m => m.TeacherProfile),
  },
  {
    path: 'my-plan',
    loadComponent: () =>
      import('../../features/Teacher/teacher-plan/teacher-plan')
        .then(m => m.TeacherPlan),
  },
  {
    path: 'choose-plan',
    loadComponent: () =>
      import('../../features/Teacher/teacher-choose-plan/teacher-choose-plan')
        .then(m => m.TeacherChoosePlan),
  },
  {
    path: 'courses',
    loadComponent: () =>
      import('../../features/Teacher/teacher-courses/teacher-courses')
        .then(m => m.TeacherCourses),
  },
  {
    path: 'add-course',
    loadComponent: () =>
      import('../../features/Teacher/teacher-add-edit-course/teacher-add-edit-course')
        .then(m => m.TeacherAddEditCourse),
  },
  {
    path: 'students/:studentId/courses/:courseId',
    loadComponent: () =>
      import('../../features/Teacher/teacher-student-analytics/teacher-student-analytics')
        .then(m => m.TeacherStudentAnalytics),
  },
  {
    path: 'courses/:id',
    loadComponent: () =>
      import('../../features/Teacher/teacher-add-edit-course/teacher-add-edit-course')
        .then(m => m.TeacherAddEditCourse),
  },
  {
    path: 'courses/:id/builder',
    loadComponent: () =>
      import('../../features/Teacher/teacher-course-builder/teacher-course-builder')
        .then(m => m.TeacherCourseBuilder),
  },
  {
    path: 'students',
    loadComponent: () =>
      import('../../features/Teacher/teacher-all-students/teacher-all-students')
        .then(m => m.TeacherAllStudents),
  },
  {
    path: 'quizzes/:id',
    loadComponent: () =>
      import('../../features/Teacher/teacher-quiz-manager/teacher-quiz-manager')
        .then(m => m.TeacherQuizManager),
  },
  {
    path: 'quiz-attempts/:id',
    loadComponent: () =>
      import('../../features/Teacher/teacher-quiz-attempts/teacher-quiz-attempts')
        .then(m => m.TeacherQuizAttempts),
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('../../features/Teacher/teacher-reviews/teacher-reviews')
        .then(m => m.TeacherReviews),
  },
  {
    path: 'earnings',
    loadComponent: () =>
      import('../../features/Teacher/teacher-earnings/teacher-earnings')
        .then(m => m.TeacherEarnings),
  },
  // {
  //   path: 'my-plan',
  //   loadComponent: () =>
  //     import('../../features/Teacher/teacher-plan/teacher-plan')
  //       .then(m => m.TeacherPlan),
  // },
  {
    path: 'notifications',
    loadComponent: () =>
      import('../../features/Teacher/teacher-notifications/teacher-notifications')
        .then(m => m.TeacherNotifications),
  },
  {
    path: 'chats',
    loadComponent: () =>
      import('../../features/Teacher/teacher-private-chat/teacher-private-chat')
        .then(m => m.TeacherPrivateChat),
  },
  {
    path: 'chats/:studentId',
    loadComponent: () =>
      import('../../features/Teacher/teacher-private-chat/teacher-private-chat')
        .then(m => m.TeacherPrivateChat),
  },
  {
    path: 'courses/:courseId/students',
    loadComponent: () =>
      import('../../features/Teacher/teacher-course-students/teacher-course-students')
        .then(m => m.TeacherCourseStudents),
  },
  {
    path: 'rooms',
    loadComponent: () =>
      import('../../features/Teacher/teacher-course-rooms/teacher-course-rooms')
        .then(m => m.TeacherCourseRooms),
  },
  {
    path: 'students/:studentId/courses/:courseId',
    loadComponent: () =>
      import('../../features/Teacher/teacher-student-analytics/teacher-student-analytics')
        .then(m => m.TeacherStudentAnalytics ),
  },
  {
    path: 'lectures/:id',
    loadComponent: () =>
      import('../../features/Teacher/teacher-lecture-details/teacher-lecture-details')
        .then(m => m.TeacherLectureDetails  ),
  },
  {
    path: 'advertisements',
    loadComponent: () =>
      import('../../features/Teacher/teacher-advertisements/teacher-advertisements')
        .then(m => m.TeacherAdvertisements),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];