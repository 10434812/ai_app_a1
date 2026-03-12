<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()

function goToRegister() {
  emit('close')
  router.push('/register')
}

function goToLogin() {
  emit('close')
  router.push('/login')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

    <!-- Modal -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all relative z-10 animate-scale-in border border-slate-100 dark:border-slate-700">
      <div class="p-6 text-center">
        <div class="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>

        <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-2">注册开启更多功能</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          您正在使用游客模式，为了保存您的对话记录并获得更多 Token，请注册账号继续使用。
        </p>

        <div class="space-y-3">
          <button @click="goToRegister" class="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 hover:-translate-y-0.5 transition-all">
            立即注册
          </button>
          <button @click="goToLogin" class="w-full py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-all">
            已有账号？登录
          </button>
        </div>
        
        <button @click="$emit('close')" class="mt-4 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          暂不注册 (仅浏览)
        </button>
      </div>
    </div>
  </div>
</template>
