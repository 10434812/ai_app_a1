<script setup lang="ts">
import {useAuthStore} from '../stores/auth'
import {useRouter, useRoute} from 'vue-router'
import {ref} from 'vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const isMobileMenuOpen = ref(false)

const handleLogout = () => {
  authStore.clearAuth()
  router.push('/login')
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const isActive = (path: string) => {
  return route.path === path
}
</script>

<template>
  <div class="flex h-screen bg-white text-slate-800 font-sans overflow-hidden">
    <!-- Mobile Sidebar Backdrop -->
    <Transition enter-active-class="transition-opacity ease-linear duration-300" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition-opacity ease-linear duration-300" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="isMobileMenuOpen" class="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden" @click="closeMobileMenu"></div>
    </Transition>

    <!-- Sidebar (Responsive) -->
    <aside
      :class="[
        'fixed lg:static inset-y-0 left-0 z-40 w-[280px] sm:w-[300px] lg:w-[280px] flex flex-col border-r border-slate-100 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]">
      <div class="p-4 lg:p-5 flex items-center justify-between">
        <div class="flex items-center gap-3 px-2 py-1">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <span class="text-xl font-bold text-white tracking-tight">后台管理系统</span>
        </div>
        <button @click="closeMobileMenu" class="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
        <div class="px-3 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Main Menu</div>

        <router-link to="/" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          仪表盘
        </router-link>

        <router-link to="/users" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/users') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          用户管理
        </router-link>

        <router-link to="/models" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/models') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          模型管理
        </router-link>

        <router-link to="/orders" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/orders') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          订单管理
        </router-link>

        <router-link to="/conversations" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/conversations') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          对话日志
        </router-link>

        <router-link to="/settings" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/settings') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          系统设置
        </router-link>

        <router-link to="/settings/image-generation" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/settings/image-generation') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          图片生成配置
        </router-link>

        <router-link to="/settings/billing" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/settings/billing') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 1.343-3 3m0 0c0 1.657 1.343 3 3 3m-3-3h6m2 9H7a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2z" />
          </svg>
          Token 计费中心
        </router-link>

        <div class="px-3 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-slate-500">Analysis</div>

        <router-link to="/analysis/portraits" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/analysis/portraits') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          用户画像
        </router-link>

        <router-link to="/analysis/stats" @click="closeMobileMenu" :class="['flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all', isActive('/analysis/stats') ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white']">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          数据分析
        </router-link>

        <div class="my-4 border-t border-slate-800 mx-3"></div>

        <a href="http://localhost:5173" class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          返回前台
        </a>
      </div>

      <div class="p-4 border-t border-slate-800 bg-slate-900">
        <div class="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-800 transition-all cursor-pointer group">
          <div class="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white">
            {{ authStore.user?.name.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-slate-200 group-hover:text-white truncate">{{ authStore.user?.name }}</p>
            <p class="text-xs text-slate-500 truncate">管理员</p>
          </div>
          <button @click="handleLogout" class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors" title="退出登录">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative">
      <!-- Top Header (Mobile mainly) -->
      <header class="h-14 lg:h-16 flex items-center justify-between px-4 border-b border-slate-200 bg-white lg:hidden sticky top-0 z-20">
        <div class="font-bold text-slate-900 flex items-center gap-2.5">
          <span class="text-lg tracking-tight">后台管理</span>
        </div>
        <button @click="toggleMobileMenu" class="p-2 -mr-2 text-slate-500 hover:text-slate-900 active:bg-slate-100 rounded-xl transition-all">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      <!-- Content Area -->
      <div class="flex-1 overflow-auto p-4 lg:p-8">
        <router-view />
      </div>
    </main>
  </div>
</template>
