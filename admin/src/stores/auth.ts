import {defineStore} from 'pinia'
import {ref, computed} from 'vue'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin' | 'super_admin' | 'ops' | 'finance' | 'support'
  isActive: boolean
}

const ADMIN_ROLES = new Set<User['role']>(['admin', 'super_admin', 'ops', 'finance', 'support'])

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)

  const isAuthenticated = computed(() => !!user.value?.role && ADMIN_ROLES.has(user.value.role))

  function setAuth(newToken: string, newUser: User) {
    token.value = newToken || 'cookie'
    user.value = newUser
  }

  function clearAuth() {
    token.value = null
    user.value = null
  }

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.user?.role && ADMIN_ROLES.has(data.user.role)) {
          token.value = 'cookie'
          user.value = data.user
        } else {
          clearAuth()
        }
      } else {
        clearAuth()
      }
    } catch (e) {
      clearAuth()
    }
  }

  return {user, token, isAuthenticated, setAuth, clearAuth, fetchUser}
})
