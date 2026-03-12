<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import UserAvatar from './UserAvatar.vue'

const props = defineProps<{
  placement?: 'top' | 'bottom' | 'right' // Dropdown placement direction
}>()

const router = useRouter()
const authStore = useAuthStore()
const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const showLogoutConfirm = ref(false)

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const handleLogoutClick = () => {
  isOpen.value = false
  showLogoutConfirm.value = true
}

const confirmLogout = async () => {
  await authStore.logout()
  showLogoutConfirm.value = false
  router.push('/login')
}

const navigateToLogin = () => {
  router.push('/login')
}

const navigateToRegister = () => {
  router.push('/register')
}

// Calculate dropdown position classes based on placement prop
const dropdownClasses = {
  top: 'bottom-full mb-2 left-0 w-full origin-bottom',
  bottom: 'top-full mt-2 right-0 w-56 origin-top-right',
  right: 'left-full ml-2 bottom-0 w-56 origin-bottom-left'
}
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- Trigger Button (Logged In) -->
    <div 
      v-if="authStore.user" 
      @click="toggleDropdown"
      class="flex items-center gap-3 rounded-2xl p-2 sm:p-3 bg-white/50 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer border border-white/60 group select-none"
    >
      <div class="h-9 w-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 shadow-inner overflow-hidden shrink-0">
        <UserAvatar :user="authStore.user" size="sm" class="w-full h-full" />
      </div>
      
      <div class="flex-1 min-w-0 flex flex-col items-start text-left">
        <p class="text-sm font-bold text-slate-700 group-hover:text-slate-900 truncate w-full">{{ authStore.user.name }}</p>
        <div class="flex items-center gap-1.5 w-full">
           <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 truncate max-w-[80px]">
             {{ authStore.user.membershipLevel || 'Free' }}
           </span>
           <span class="text-[10px] text-slate-400 truncate">Token: {{ authStore.user.tokensBalance }}</span>
        </div>
      </div>
      
      <!-- Chevron Icon -->
      <svg 
        class="w-4 h-4 text-slate-400 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <!-- Trigger Buttons (Guest) -->
    <div v-else class="flex flex-col gap-2">
      <button
        @click="navigateToLogin"
        class="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
      >
        <span>登录账号</span>
      </button>
      <button 
        @click="navigateToRegister"
        class="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
      >
        <span>注册新用户</span>
      </button>
    </div>

    <!-- Dropdown Menu -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div 
        v-if="isOpen && authStore.user" 
        class="absolute z-50 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden min-w-[220px]"
        :class="dropdownClasses[props.placement || 'top']"
      >
        <!-- Header Info (Mobile/Compact view context) -->
        <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <p class="text-sm font-bold text-slate-800 truncate">{{ authStore.user.name }}</p>
          <p class="text-xs text-slate-500 truncate">{{ authStore.user.email }}</p>
        </div>

        <div class="p-1">
          <!-- Token Usage Link -->
          <router-link 
            to="/token-usage" 
            @click="isOpen = false"
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Token使用详情
          </router-link>

          <!-- Membership Link -->
          <router-link 
            to="/membership" 
            @click="isOpen = false"
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            会员中心
          </router-link>

          <!-- Divider -->
          <div class="h-px bg-slate-100 my-1"></div>

          <!-- Logout Button -->
          <button 
            @click="handleLogoutClick" 
            class="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </button>
        </div>
      </div>
    </Transition>

    <!-- Logout Confirmation Modal (Self-contained) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="showLogoutConfirm" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="showLogoutConfirm = false"></div>
          
          <!-- Modal Content -->
          <div class="relative bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm border border-slate-100">
            <div class="flex items-center gap-3 mb-4 text-slate-800">
              <div class="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 class="text-lg font-bold">确认退出登录?</h3>
            </div>
            
            <p class="text-slate-500 text-sm mb-6 pl-1">
              退出后您需要重新登录才能访问您的个人数据和历史记录。
            </p>
            
            <div class="flex justify-end gap-3">
              <button 
                @click="showLogoutConfirm = false" 
                class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                取消
              </button>
              <button 
                @click="confirmLogout" 
                class="px-4 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 rounded-xl transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                确认退出
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>