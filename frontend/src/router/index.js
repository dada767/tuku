import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'gallery',
    component: () => import('../views/GalleryView.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guest: true },
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/admin/DashboardView.vue') },
      { path: 'users', name: 'users', component: () => import('../views/admin/UsersView.vue') },
      { path: 'images', name: 'admin-images', component: () => import('../views/admin/ImagesView.vue') },
      { path: 'settings', name: 'settings', component: () => import('../views/admin/SettingsView.vue') },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('access_token')
  if (to.meta.requiresAuth && !token) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }
  if (to.meta.requiresAuth && to.path.startsWith('/admin')) {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        if (!user.is_admin) {
          return next({ name: 'gallery' })
        }
      } catch {}
    }
  }
  if (to.meta.guest && token) {
    return next({ name: 'gallery' })
  }
  next()
})

export default router
