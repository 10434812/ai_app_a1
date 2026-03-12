<script setup lang="ts">
import {useAuthStore} from '../stores/auth'
import {useAppStore} from '../stores/app'
import {useRouter, useRoute} from 'vue-router'
import {ref, watch, onMounted, computed} from 'vue'
import Sidebar from '../components/Sidebar.vue'

const authStore = useAuthStore()
const appStore = useAppStore()
const router = useRouter()
const route = useRoute()
// const isMobileMenuOpen = ref(false) // Moved to appStore
const sidebarRef = ref<InstanceType<typeof Sidebar> | null>(null)

// Refresh history when user changes
watch(
  () => authStore.user?.id,
  (newId) => {
    if (newId && sidebarRef.value) {
      sidebarRef.value.refresh()
    }
  },
)

onMounted(() => {
  window.addEventListener('refresh-sidebar-history', () => {
    if (sidebarRef.value) {
      sidebarRef.value.refresh()
    }
  })
})

const toggleMobileMenu = () => {
  appStore.toggleMobileMenu()
}

const closeMobileMenu = () => {
  appStore.closeMobileMenu()
}

const handleNewChat = () => {
  router.push({name: 'Chat'})
  closeMobileMenu()
}
</script>

<template>
  <div class="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-slate-800 font-sans overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
    <!-- Sidebar Component -->
    <Sidebar
      v-if="!$route.meta.hideSidebar"
      ref="sidebarRef"
      :is-open="appStore.isMobileMenuOpen"
      @close="closeMobileMenu"
      @new-chat="handleNewChat"
    />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10 lg:py-4 lg:pr-4">
      <!-- Top Header (Mobile mainly) -->
      <header v-if="!$route.meta.hideLayoutHeader" class="h-14 lg:hidden flex items-center justify-between px-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 transition-all">
        <div class="font-bold text-slate-900 flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <span class="text-base font-bold tracking-tight">AI 聚合问答</span>
        </div>
        <button @click="toggleMobileMenu" class="p-2 -mr-2 text-slate-500 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-all">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      <!-- Content Area -->
      <div class="flex-1 flex flex-col min-h-0 overflow-y-auto relative lg:rounded-2xl bg-white/40 backdrop-blur-sm lg:border border-white/50 shadow-sm lg:shadow-[0_0_40px_-10px_rgba(0,0,0,0.05)]">
        <router-view />
      </div>
    </main>
  </div>
</template>
