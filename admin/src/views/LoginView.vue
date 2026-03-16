<script setup lang="ts">
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {useAuthStore} from '../stores/auth'
import {extractApiErrorMessage, extractThrownErrorMessage} from '../utils/apiError'

const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()
const authStore = useAuthStore()

const humanizeAdminLoginError = (status: number, rawMessage: string) => {
  if (status === 401 || status === 404) return '账号不存在或密码错误'
  if (status === 403) return '当前账号无后台权限'
  if (status === 429) return '登录过于频繁，请稍后再试'
  if (status >= 500) return '服务器开小差了，请稍后重试'
  return rawMessage || '登录失败，请稍后重试'
}

async function handleLogin() {
  error.value = ''
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'include',
      body: JSON.stringify({email: email.value, password: password.value}),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const rawMessage = extractApiErrorMessage(data, '登录失败')
      throw new Error(humanizeAdminLoginError(res.status, rawMessage))
    }

    const allowedRoles = new Set(['admin', 'super_admin', 'ops', 'finance', 'support'])
    if (!allowedRoles.has(data.user.role)) {
      throw new Error('当前账号无后台权限')
    }

    authStore.setAuth('cookie', data.user)
    router.push('/')
  } catch (e) {
    error.value = extractThrownErrorMessage(e, '登录失败，请稍后重试')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <!-- Decorative Background Elements -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
      <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-3xl"></div>
      <div class="absolute top-[30%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-3xl"></div>
    </div>

    <div class="max-w-md w-full space-y-8 bg-slate-800/50 p-8 rounded-3xl shadow-2xl backdrop-blur-xl border border-slate-700/50 relative z-10">
      <div>
        <div class="mx-auto h-16 w-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/30">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">后台管理登录</h2>
        <p class="mt-2 text-center text-sm text-slate-400">仅限管理员访问</p>
      </div>
      <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <div class="space-y-5">
          <div>
            <label for="email-address" class="block text-sm font-medium text-slate-300 mb-1.5">邮箱地址</label>
            <input
              id="email-address"
              name="email"
              type="email"
              v-model="email"
              required
              class="appearance-none block w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-slate-900 transition-all duration-200 sm:text-sm"
              placeholder="admin@example.com" />
          </div>
          <div>
            <label for="password" class="block text-sm font-medium text-slate-300 mb-1.5">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              v-model="password"
              required
              class="appearance-none block w-full px-4 py-3.5 bg-slate-900/50 border border-slate-600 rounded-xl placeholder-slate-500 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-slate-900 transition-all duration-200 sm:text-sm"
              placeholder="••••••••" />
          </div>
        </div>

        <div v-if="error" class="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/20">
          <svg class="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {{ error }}
        </div>

        <div>
          <button
            type="submit"
            class="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-0.5">
            进入后台
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
