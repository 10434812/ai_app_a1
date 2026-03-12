<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import {useAuthStore} from '../stores/auth'
import {API_BASE_URL} from '../constants/config'

const email = ref('')
const password = ref('')
const error = ref('')
const showForgotPasswordModal = ref(false)
const forgotEmail = ref('')
const forgotStatus = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
const forgotMessage = ref('')
const isWeChat = /micromessenger/i.test(navigator.userAgent)
const wechatLoading = ref(false)

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

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

const humanizeLoginError = (status: number, rawMessage: string) => {
  if (status === 401 || status === 404) return '账号不存在或密码错误'
  if (status === 403) return '账号无权限登录或已被禁用'
  if (status === 429) return '登录过于频繁，请稍后再试'
  if (status >= 500) return '服务器开小差了，请稍后重试'
  return rawMessage || '登录失败，请稍后重试'
}

const extractThrownErrorMessage = (err: unknown, fallback: string) => {
  if (typeof err === 'string' && err.trim()) return err.trim()
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof (err as any)?.message === 'string' && (err as any).message.trim()) {
    return (err as any).message.trim()
  }
  return extractApiErrorMessage(err, fallback)
}

onMounted(async () => {
  const code = route.query.code as string
  if (code && isWeChat) {
    wechatLoading.value = true
    try {
      await authStore.loginWithWeChat(code)
      // Clear query params
      router.replace({query: {}})
      router.push('/')
    } catch (e) {
      error.value = '微信登录失败：' + extractThrownErrorMessage(e, '未知错误')
    } finally {
      wechatLoading.value = false
    }
  }
})

async function handleWeChatLogin() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`)
    const config = await res.json()
    const appId = config.wechat_app_id
    
    if (!appId) {
      error.value = '未配置微信 AppID'
      return
    }

    const redirectUri = encodeURIComponent(window.location.href.split('?')[0])
    const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_userinfo#wechat_redirect`
    window.location.href = url
  } catch (e) {
    error.value = '获取配置失败'
  }
}

async function handleForgotPassword() {
  if (!forgotEmail.value) return

  forgotStatus.value = 'loading'
  forgotMessage.value = ''

  try {
    // Mock API call - in production this would be a real endpoint
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Simulate success
    forgotStatus.value = 'success'
    forgotMessage.value = '重置密码链接已发送至您的邮箱，请查收。'

    // Close modal after 3 seconds
    setTimeout(() => {
      showForgotPasswordModal.value = false
      forgotStatus.value = 'idle'
      forgotEmail.value = ''
      forgotMessage.value = ''
    }, 3000)
  } catch (err) {
    forgotStatus.value = 'error'
    forgotMessage.value = '发送失败，请稍后重试。'
  }
}

async function handleLogin() {
  error.value = ''
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email.value, password: password.value}),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const rawMessage = extractApiErrorMessage(data, '登录失败')
      throw new Error(humanizeLoginError(res.status, rawMessage))
    }

    authStore.setAuth(data.token, data.user)
    router.push('/')
  } catch (e) {
    error.value = extractThrownErrorMessage(e, '登录失败，请稍后重试')
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 py-6 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
    <!-- Decorative Background Elements -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
      <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-100/50 blur-3xl opacity-50 lg:opacity-100"></div>
      <div class="absolute top-[30%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-3xl opacity-50 lg:opacity-100"></div>
    </div>

    <div class="max-w-md w-full space-y-6 lg:space-y-8 bg-white p-5 sm:p-6 lg:p-10 rounded-2xl lg:rounded-3xl shadow-xl shadow-slate-200/50 relative z-10 border border-slate-100">
      <div>
        <div class="mx-auto h-12 w-12 lg:h-14 lg:w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl lg:rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-all duration-500">
          <svg class="w-6 h-6 lg:w-8 lg:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 class="mt-4 lg:mt-6 text-center text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">欢迎回来</h2>
        <p class="mt-2 text-center text-sm text-slate-500">登录您的 AI 聚合问答账号</p>
      </div>
      <form class="mt-6 lg:mt-8 space-y-5 lg:space-y-6" @submit.prevent="handleLogin">
        <!-- WeChat Login Button -->
        <div v-if="isWeChat">
          <button
            type="button"
            @click="handleWeChatLogin"
            :disabled="wechatLoading"
            class="w-full flex items-center justify-center gap-2 py-3 lg:py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-[#07C160] hover:bg-[#06ad56] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#07C160] transition-all shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
            <svg v-if="wechatLoading" class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8.69 14.3c-3.64 0-6.6-2.67-6.6-5.96 0-3.3 2.97-5.97 6.6-5.97 3.65 0 6.61 2.67 6.61 5.97 0 3.29-2.96 5.96-6.61 5.96zM18.8 13.06c0-2.83-2.77-5.13-6.18-5.13-.26 0-.52.02-.78.05.5.42 1.05.89 1.63 1.41.29.26.56.54.81.82 2.76.53 4.85 2.59 4.85 5.06 0 .37-.05.73-.14 1.08.38-.05.77-.08 1.17-.08.64 0 1.25.08 1.84.22.42-.36.95-.61 1.54-.73-.14.5-.16 1.03-.04 1.54.96.67 1.58 1.68 1.58 2.81 0 2.51-2.45 4.54-5.47 4.54-3.02 0-5.47-2.03-5.47-4.54 0-.46.08-.91.24-1.33 1.14-.66 2.37-1.15 3.66-1.47-.38-.63-.82-1.2-1.32-1.7-.68-.68-1.46-1.25-2.31-1.68-.34.34-.69.67-1.06.98-.67.56-1.4.98-2.18 1.28l-.75.29c.67 2.15 2.91 3.73 5.54 3.73 3.32 0 6.01-2.43 6.01-5.43 0-.15 0-.3-.02-.45z"/>
            </svg>
            {{ wechatLoading ? '登录中...' : '微信一键登录' }}
          </button>
          <div class="relative my-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-200"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-slate-400">或使用邮箱登录</span>
            </div>
          </div>
        </div>

        <div class="space-y-4 lg:space-y-5">
          <div>
            <label for="email-address" class="block text-sm font-semibold text-slate-700 mb-1.5">邮箱地址</label>
            <input
              id="email-address"
              name="email"
              type="email"
              v-model="email"
              required
              class="appearance-none block w-full px-4 py-3 lg:py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all duration-200 sm:text-sm"
              placeholder="name@example.com" />
          </div>
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="password" class="block text-sm font-semibold text-slate-700">密码</label>
              <button type="button" @click="showForgotPasswordModal = true" class="text-xs font-medium text-blue-600 hover:text-blue-500">忘记密码？</button>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              v-model="password"
              required
              class="appearance-none block w-full px-4 py-3 lg:py-3.5 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all duration-200 sm:text-sm"
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
            class="group relative w-full flex justify-center py-3 lg:py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-0.5">
            登录
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
          <span class="text-slate-500">还没有账号？</span>
          <router-link to="/register" class="font-bold text-blue-600 hover:text-blue-500 ml-1 transition-colors hover:underline decoration-2 underline-offset-4"> 立即注册 </router-link>
        </div>
      </form>
    </div>

    <!-- Forgot Password Modal -->
    <Transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showForgotPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-white/50 relative">
          <!-- Close Button -->
          <button @click="showForgotPasswordModal = false" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div class="text-center mb-6">
            <div class="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.536 9.464l-2.828 2.828-2.828-2.828 2.828-2.828 5.656-5.656A6 6 0 1120 17H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2v-6a2 2 0 00-2-2h-.586M15 7V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900">重置密码</h3>
            <p class="text-sm text-slate-500 mt-2">请输入您的注册邮箱，我们将向您发送重置链接。</p>
          </div>

          <form @submit.prevent="handleForgotPassword" class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1.5">邮箱地址</label>
              <input
                type="email"
                v-model="forgotEmail"
                required
                class="appearance-none block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all sm:text-sm"
                placeholder="name@example.com" />
            </div>

            <div v-if="forgotMessage" :class="['text-sm p-3 rounded-xl border flex items-center gap-2', forgotStatus === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100']">
              <svg v-if="forgotStatus === 'success'" class="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              <svg v-else class="w-5 h-5 flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {{ forgotMessage }}
            </div>

            <button
              type="submit"
              :disabled="forgotStatus === 'loading' || forgotStatus === 'success'"
              class="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20">
              <svg v-if="forgotStatus === 'loading'" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ forgotStatus === 'loading' ? '发送中...' : '发送重置链接' }}
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>
