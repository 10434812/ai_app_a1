<script setup lang="ts">
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {useAuthStore} from '../stores/auth'
import {API_BASE_URL} from '../constants/config'
import {extractApiErrorMessage, extractThrownErrorMessage} from '../utils/apiError'

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const router = useRouter()
const authStore = useAuthStore()

async function handleRegister() {
  error.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'include',
      body: JSON.stringify({name: name.value, email: email.value, password: password.value}),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(extractApiErrorMessage(data, '注册失败，请稍后重试'))

    authStore.setAuth('cookie', data.user)
    router.push('/')
  } catch (e: unknown) {
    error.value = extractThrownErrorMessage(e, '注册失败，请稍后重试')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <!-- Decorative Background Elements -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
      <div class="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-100/50 blur-3xl opacity-50 lg:opacity-100"></div>
      <div class="absolute top-[30%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-3xl opacity-50 lg:opacity-100"></div>
    </div>

    <div class="max-w-md w-full space-y-6 lg:space-y-8 bg-white p-5 sm:p-6 lg:p-10 rounded-2xl lg:rounded-3xl shadow-xl shadow-slate-200/50 relative z-10 border border-slate-100">
      <div>
        <div class="mx-auto h-12 w-12 lg:h-14 lg:w-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl lg:rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/30 transform -rotate-3 hover:rotate-0 transition-all duration-500">
          <svg class="w-6 h-6 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h2 class="mt-4 lg:mt-6 text-center text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">创建新账号</h2>
        <p class="mt-2 text-center text-sm text-slate-500">加入 AI 聚合问答平台，体验多模型并发对比</p>
      </div>
      <form class="mt-6 lg:mt-8 space-y-5 lg:space-y-6" @submit.prevent="handleRegister">
        <div class="space-y-4 lg:space-y-5">
          <div>
            <label for="name" class="block text-sm font-semibold text-slate-700 mb-1.5">您的昵称</label>
            <input
              id="name"
              name="name"
              type="text"
              v-model="name"
              required
              class="appearance-none block w-full px-4 py-3 lg:py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all duration-200 sm:text-sm"
              placeholder="怎么称呼您？" />
          </div>
          <div>
            <label for="email-address" class="block text-sm font-semibold text-slate-700 mb-1.5">邮箱地址</label>
            <input
              id="email-address"
              name="email"
              type="email"
              v-model="email"
              required
              class="appearance-none block w-full px-4 py-3 lg:py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all duration-200 sm:text-sm"
              placeholder="name@example.com" />
          </div>
          <div>
            <label for="password" class="block text-sm font-semibold text-slate-700 mb-1.5">设置密码</label>
            <input
              id="password"
              name="password"
              type="password"
              v-model="password"
              required
              class="appearance-none block w-full px-4 py-3 lg:py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all duration-200 sm:text-sm"
              placeholder="••••••••" />
          </div>
        </div>

        <div v-if="error" class="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
          <svg class="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {{ error }}
        </div>

        <div>
          <button
            type="submit"
            class="group relative w-full flex justify-center py-3 lg:py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5">
            注册账号
          </button>
        </div>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-slate-200"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white text-slate-400">或者</span>
          </div>
        </div>

        <div class="text-center text-sm">
          <span class="text-slate-500">已有账号？</span>
          <router-link to="/login" class="font-bold text-indigo-600 hover:text-indigo-500 ml-1 transition-colors hover:underline decoration-2 underline-offset-4"> 立即登录 </router-link>
        </div>
      </form>
    </div>
  </div>
</template>
