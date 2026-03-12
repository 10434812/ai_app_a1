<script setup lang="ts">
import {ref, onMounted, watch} from 'vue'
import {API_BASE_URL} from '../constants/config'
import {useAuthStore} from '../stores/auth'
import {getTokenStats, getTokenHistory, getTokenTrend, exportTokenHistory} from '../api/token'
import TokenUsageChart from './TokenUsageChart.vue'
import UserAvatar from './UserAvatar.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()
const customApiKey = ref('')
const loading = ref(false)
const activeTab = ref('profile')
const isDark = ref(document.documentElement.classList.contains('dark'))

// Token Data
const tokenStats = ref<any>(null)
const tokenHistory = ref<any[]>([])
const tokenTrend = ref<any[]>([])
const historyPage = ref(1)
const historyTotal = ref(0)
const historyLoading = ref(false)

onMounted(() => {
  const storedKey = localStorage.getItem('custom_api_key')
  if (storedKey) customApiKey.value = storedKey
  if (props.isOpen) initData()
  
  // Watch for dark mode changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        isDark.value = document.documentElement.classList.contains('dark')
      }
    })
  })
  observer.observe(document.documentElement, {attributes: true})
})

watch(() => props.isOpen, (val) => {
  if (val) initData()
})

watch(activeTab, (val) => {
  if (val === 'token') fetchTokenData()
})

function initData() {
  fetchUserStats()
  if (activeTab.value === 'token') fetchTokenData()
}

async function fetchUserStats() {
  if (!authStore.isAuthenticated) return
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {Authorization: `Bearer ${authStore.token}`},
    })
    if (res.ok) {
      const data = await res.json()
      authStore.user = data.user
    }
  } catch (e) {
    console.error(e)
  }
}

async function fetchTokenData() {
  loading.value = true
  try {
    const [stats, trend, history] = await Promise.all([
      getTokenStats(),
      getTokenTrend(30),
      getTokenHistory(1, 10)
    ])
    tokenStats.value = stats
    tokenTrend.value = trend
    tokenHistory.value = history.records
    historyTotal.value = history.total
    historyPage.value = 1
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadHistoryPage(page: number) {
  if (page < 1) return
  historyLoading.value = true
  try {
    const res = await getTokenHistory(page, 10)
    tokenHistory.value = res.records
    historyPage.value = page
    historyTotal.value = res.total
  } catch (e) {
    console.error(e)
  } finally {
    historyLoading.value = false
  }
}

async function handleExport() {
  try {
    const blob = await exportTokenHistory()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `token_usage_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败')
  }
}

function saveApiKey() {
  if (customApiKey.value.trim()) {
    localStorage.setItem('custom_api_key', customApiKey.value.trim())
    alert('API Key 已保存，后续请求将优先使用此 Key')
  } else {
    localStorage.removeItem('custom_api_key')
    alert('API Key 已移除，将使用系统默认配置')
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" @click="$emit('close')"></div>

    <!-- Modal -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all relative z-10 animate-scale-in border border-slate-100 dark:border-slate-700 flex flex-col max-h-[90vh]">
      
      <!-- Header -->
      <div class="p-6 pb-0 flex-none">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            个人中心
          </h2>
          <button @click="$emit('close')" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex gap-6 border-b border-slate-100 dark:border-slate-700">
          <button 
            @click="activeTab = 'profile'"
            class="pb-3 text-sm font-medium transition-colors relative"
            :class="activeTab === 'profile' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          >
            概览
            <div v-if="activeTab === 'profile'" class="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>
          </button>
          <button 
            @click="activeTab = 'token'"
            class="pb-3 text-sm font-medium transition-colors relative"
            :class="activeTab === 'token' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          >
            Token 统计
            <div v-if="activeTab === 'token'" class="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
        
        <!-- Profile Tab -->
        <div v-show="activeTab === 'profile'" class="space-y-6 animate-fade-in">
          <!-- User Card -->
          <div class="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
            <div class="flex items-center gap-4 mb-4">
              <UserAvatar :user="authStore.user" size="md" />
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-100">{{ authStore.user?.name }}</div>
                <div class="text-xs text-slate-500">
                  {{ (authStore.user?.email && (authStore.user.email.startsWith('wechat_') || authStore.user.email.startsWith('wx_'))) ? '微信用户' : authStore.user?.email }}
                </div>
              </div>
              <div class="ml-auto">
                <span class="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider" :class="authStore.user?.membershipLevel === 'premium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'">
                  {{ authStore.user?.membershipLevel || 'FREE' }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <div class="text-xs text-slate-400 mb-1">Token 余额</div>
                <div class="text-lg font-bold text-slate-800 dark:text-white font-mono">{{ authStore.user?.tokensBalance?.toLocaleString() || 0 }}</div>
              </div>
              <div class="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                <div class="text-xs text-slate-400 mb-1">会员到期</div>
                <div class="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {{ authStore.user?.membershipExpireAt ? new Date(authStore.user.membershipExpireAt).toLocaleDateString() : '永久有效' }}
                </div>
              </div>
            </div>
          </div>

          <!-- API Key Settings -->
          <div>
            <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              自定义 API Key
            </h3>
            <p class="text-xs text-slate-500 mb-3">如果您有自己的 OpenAI/兼容 Key，可在此填入。系统将优先使用您的 Key。</p>
            <div class="flex gap-2">
              <input v-model="customApiKey" type="password" placeholder="sk-..." class="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              <button @click="saveApiKey" class="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors">保存</button>
            </div>
          </div>
        </div>

        <!-- Token Tab -->
        <div v-show="activeTab === 'token'" class="space-y-6 animate-fade-in">
          <div v-if="loading && !tokenStats" class="flex justify-center py-10">
            <svg class="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>

          <template v-else>
            <!-- Stats Cards -->
            <div class="grid grid-cols-3 gap-3">
              <div class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <div class="text-xs text-indigo-600 dark:text-indigo-400 mb-1 font-medium">累计消耗</div>
                <div class="text-lg font-bold text-slate-800 dark:text-white font-mono">{{ tokenStats?.totalUsage?.toLocaleString() }}</div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-900/50">
                <div class="text-xs text-purple-600 dark:text-purple-400 mb-1 font-medium">本月消耗</div>
                <div class="text-lg font-bold text-slate-800 dark:text-white font-mono">{{ tokenStats?.monthUsage?.toLocaleString() }}</div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <div class="text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium">今日消耗</div>
                <div class="text-lg font-bold text-slate-800 dark:text-white font-mono">{{ tokenStats?.todayUsage?.toLocaleString() }}</div>
              </div>
            </div>

            <!-- Chart -->
            <div class="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-700 h-64">
               <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">近30天趋势</h3>
               <div class="h-48">
                 <TokenUsageChart v-if="tokenTrend.length > 0" :data="tokenTrend" :isDark="isDark" />
                 <div v-else class="h-full flex items-center justify-center text-slate-400 text-xs">暂无数据</div>
               </div>
            </div>

            <!-- History Table -->
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200">使用明细</h3>
                <button @click="handleExport" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  导出
                </button>
              </div>
              
              <div class="overflow-x-auto">
                <table class="w-full text-xs text-left whitespace-nowrap">
                  <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium">
                    <tr>
                      <th class="px-4 py-2">时间</th>
                      <th class="px-4 py-2">类型</th>
                      <th class="px-4 py-2">模型</th>
                      <th class="px-4 py-2 text-right">数量</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr v-for="record in tokenHistory" :key="record.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td class="px-4 py-2.5 text-slate-600 dark:text-slate-300">{{ formatDate(record.createdAt) }}</td>
                      <td class="px-4 py-2.5">
                        <span class="px-1.5 py-0.5 rounded text-[10px]" :class="record.type === 'chat' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'">
                          {{ record.type === 'chat' ? '对话' : (record.type === 'topup' ? '充值' : record.type) }}
                        </span>
                      </td>
                      <td class="px-4 py-2.5 text-slate-500 dark:text-slate-400">{{ record.model || '-' }}</td>
                      <td class="px-4 py-2.5 text-right font-mono" :class="['chat', 'image'].includes(record.type) ? 'text-rose-500' : 'text-green-500'">
                        {{ ['chat', 'image'].includes(record.type) ? '-' : '+' }}{{ record.amount }}
                      </td>
                    </tr>
                    <tr v-if="tokenHistory.length === 0">
                      <td colspan="4" class="px-4 py-8 text-center text-slate-400">暂无记录</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Pagination -->
              <div v-if="historyTotal > 10" class="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <button 
                  @click="loadHistoryPage(historyPage - 1)" 
                  :disabled="historyPage <= 1 || historyLoading"
                  class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span class="text-xs text-slate-500">{{ historyPage }} / {{ Math.ceil(historyTotal / 10) }}</span>
                <button 
                  @click="loadHistoryPage(historyPage + 1)" 
                  :disabled="historyPage >= Math.ceil(historyTotal / 10) || historyLoading"
                  class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </template>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(203, 213, 225, 0.4);
  border-radius: 20px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(71, 85, 105, 0.4);
}
</style>
