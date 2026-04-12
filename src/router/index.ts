import { createRouter, createWebHistory } from 'vue-router'
import { getCurrentSession } from '../services/auth.service'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../pages/DashboardPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/farms',
      name: 'farms',
      component: () => import('../pages/FarmsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/farms/:farmId',
      name: 'farm-detail',
      component: () => import('../pages/FarmDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/flocks/:flockId',
      name: 'flock-detail',
      component: () => import('../pages/FlockDetailPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/input',
      name: 'input',
      component: () => import('../pages/DailyLogPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/flocks/:flockId/logs/new',
      name: 'daily-log',
      component: () => import('../pages/DailyLogPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../pages/HistoryPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/feed',
      name: 'feed',
      component: () => import('../pages/FeedManagementPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/egg-report',
      name: 'egg-report',
      component: () => import('../pages/EggReportPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../pages/ProfilePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const session = await getCurrentSession()
  const isAuthenticated = Boolean(session)

  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
