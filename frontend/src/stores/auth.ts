import {defineStore} from 'pinia'
import {ref, computed} from 'vue'
import {API_BASE_URL} from '../constants/config'
import {extractApiErrorMessage} from '../utils/apiError'
import {normalizeAuthToken} from '../utils/authToken'

export interface User {
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

    const isAuthenticated = computed(() => !!user.value)

    function setAuth(newToken: string | null | undefined, newUser: User) {
      token.value = normalizeAuthToken(newToken)
      user.value = newUser
    }

    function clearAuth() {
      token.value = null
      user.value = null
    }

    async function loginWithWeChat(code: string) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/wechat/login`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'include',
          body: JSON.stringify({code}),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(extractApiErrorMessage(data, '微信登录失败'))
        setAuth(null, data.user)
        return true
      } catch (e) {
        console.error('WeChat login failed:', e)
        throw e
      }
    }

    async function fetchUser() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          token.value = null
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
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          credentials: 'include',
        })
      } catch (e) {
        console.error('Logout API error:', e)
      } finally {
        clearAuth()
      }
    }

    return {user, token, isAuthenticated, setAuth, clearAuth, fetchUser, loginWithWeChat, logout}
  },
)
