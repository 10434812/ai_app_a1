import {defineStore} from 'pinia'
import {ref, computed} from 'vue'
import {API_BASE_URL} from '../constants/config'

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin' | 'super_admin' | 'ops' | 'finance' | 'support'
  isActive: boolean
  membershipLevel?: 'free' | 'pro' | 'premium'
  membershipExpireAt?: string
  tokensBalance?: number
  referralCode?: string
  multiModelUsageCount?: number
  avatar?: string
}

export const useAuthStore = defineStore(
  'auth',
  () => {
    const user = ref<User | null>(null)
    const token = ref<string | null>(null)

    const isAuthenticated = computed(() => !!token.value)

    function setAuth(newToken: string, newUser: User) {
      token.value = newToken
      user.value = newUser
    }

    function clearAuth() {
      token.value = null
      user.value = null
    }

    const extractApiErrorMessage = (payload: any, fallback: string) => {
      if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) {
        return payload.error.message.trim()
      }
      if (typeof payload?.error === 'string' && payload.error.trim()) {
        return payload.error.trim()
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message.trim()
      }
      return fallback
    }

    async function loginWithWeChat(code: string) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/wechat/login`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({code}),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(extractApiErrorMessage(data, '微信登录失败'))
        setAuth(data.token, data.user)
        return true
      } catch (e) {
        console.error('WeChat login failed:', e)
        throw e
      }
    }

    async function fetchUser() {
      if (!token.value) return
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {Authorization: `Bearer ${token.value}`},
        })
        if (res.ok) {
          const data = await res.json()
          user.value = data.user
        } else {
          if (res.status === 401 || res.status === 403) {
            clearAuth()
          }
        }
      } catch (e) {
        console.error('Fetch user failed:', e)
        // Do not clear auth on network error, allow retry
      }
    }

    async function logout() {
      try {
        if (token.value) {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.value}`,
              'Content-Type': 'application/json'
            }
          })
        }
      } catch (e) {
        console.error('Logout API error:', e)
      } finally {
        clearAuth()
      }
    }

    return {user, token, isAuthenticated, setAuth, clearAuth, fetchUser, loginWithWeChat, logout}
  },
  {
    persist: {
      paths: ['user', 'token'],
    },
  },
)
