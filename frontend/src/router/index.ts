import {createRouter, createWebHistory} from 'vue-router'
import {useAuthStore} from '../stores/auth'

const LoginView = () => import('../views/LoginView.vue')
const RegisterView = () => import('../views/RegisterView.vue')
const ChatView = () => import('../views/ChatView.vue')
const MembershipView = () => import('../views/MembershipView.vue')
const TokenUsageView = () => import('../views/TokenUsageView.vue')
const MainLayout = () => import('../layouts/MainLayout.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: LoginView,
      meta: {guest: true},
    },
    {
      path: '/register',
      name: 'Register',
      component: RegisterView,
      meta: {guest: true},
    },
    {
      path: '/',
      component: MainLayout,
      // meta: { requiresAuth: true }, // Removed to allow guest access to Chat
      children: [
        {
          path: '',
          name: 'Chat',
          component: ChatView,
          meta: { hideLayoutHeader: true } 
        },
        {
          path: '/membership',
          name: 'Membership',
          component: MembershipView,
          meta: { requiresAuth: true }, // Moved here
        },
        {
          path: '/token-usage',
          name: 'TokenUsage',
          component: TokenUsageView,
          meta: { requiresAuth: true }, // Moved here
        },
      ],
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (!authStore.user) {
    await authStore.fetchUser()
  }

  // Handle protected routes
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!authStore.isAuthenticated) {
      next('/login')
      return
    }
  }

  // Handle guest routes (prevent logged-in users from seeing login/register)
  if (to.matched.some(record => record.meta.guest)) {
    if (authStore.isAuthenticated) {
      next('/')
      return
    }
  }

  next()
})

export default router
