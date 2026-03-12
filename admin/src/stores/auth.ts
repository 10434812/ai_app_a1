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

const ADMIN_TOKEN_KEY = 'admin_token'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem(ADMIN_TOKEN_KEY))

  const isAuthenticated = computed(() => !!token.value && !!user.value?.role && ADMIN_ROLES.has(user.value.role))

  function setAuth(newToken: string, newUser: User) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem(ADMIN_TOKEN_KEY, newToken)
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const res = await fetch('/api/auth/me', {
        headers: {Authorization: `Bearer ${token.value}`},
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.user?.role && ADMIN_ROLES.has(data.user.role)) {
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
