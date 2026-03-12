import {createRouter, createWebHistory} from 'vue-router'
import {useAuthStore} from '../stores/auth'
import MainLayout from '../layouts/MainLayout.vue'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import UserManagementView from '../views/UserManagementView.vue'
import ModelManagementView from '../views/ModelManagementView.vue'
import OrderManagementView from '../views/OrderManagementView.vue'
import UserPortraitView from '../views/UserPortraitView.vue'
import DataAnalysisView from '../views/DataAnalysisView.vue'
import ConversationManagementView from '../views/ConversationManagementView.vue'
import SystemSettingsView from '../views/SystemSettingsView.vue'
import ImageGenerationSettingsView from '../views/ImageGenerationSettingsView.vue'
import BillingSettingsView from '../views/BillingSettingsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: {guest: true},
    },
    {
      path: '/',
      component: MainLayout,
      meta: {requiresAuth: true},
      children: [
        {
          path: '',
          name: 'dashboard2',
          component: DashboardView,
        },
        {
          path: 'users',
          name: 'users',
          component: UserManagementView,
        },
        {
          path: 'models',
          name: 'models',
          component: ModelManagementView,
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrderManagementView,
        },
        {
          path: 'conversations',
          name: 'conversations',
          component: ConversationManagementView,
        },
        {
          path: 'settings',
          name: 'settings',
          component: SystemSettingsView,
        },
        {
          path: 'settings/image-generation',
          name: 'image-generation-settings',
          component: ImageGenerationSettingsView,
        },
        {
          path: 'settings/billing',
          name: 'billing-settings',
          component: BillingSettingsView,
        },
        {
          path: 'analysis/portraits',
          name: 'user-portraits',
          component: UserPortraitView,
        },
        {
          path: 'analysis/stats',
          name: 'data-analysis',
          component: DataAnalysisView,
        },
      ],
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (!authStore.user && authStore.token) {
    await authStore.fetchUser()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
  } else if (to.meta.guest && authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
