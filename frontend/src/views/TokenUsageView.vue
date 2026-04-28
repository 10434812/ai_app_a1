<script setup lang="ts">
import { ref, onMounted, computed, watch, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getTokenStats,
  getTokenHistory,
  getTokenTrend,
  exportTokenHistory,
  type TokenRecord,
  type TokenStats,
  type TokenTrendItem,
} from '../api/token'
import KpiCard from '../components/token-usage/KpiCard.vue'
import UsageTable from '../components/token-usage/UsageTable.vue'
import ExportPanel from '../components/token-usage/ExportPanel.vue'

const LineChart = defineAsyncComponent(() => import('../components/token-usage/LineChart.vue'))
const BarChart = defineAsyncComponent(() => import('../components/token-usage/BarChart.vue'))

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const refreshing = ref(false)
const lastUpdated = ref(new Date())

// Data
const tokenStats = ref<TokenStats | null>(null)
const tokenHistory = ref<TokenRecord[]>([])
const tokenTrend = ref<{date: string, value: number}[]>([])
const tokenHistoryTotal = ref(0)
const historyLoading = ref(false)
const chartSectionRef = ref<HTMLElement | null>(null)
const chartsVisible = ref(false)

interface TokenHistoryFilterPayload {
  model?: string
  dateRange?: {
    start?: string
    end?: string
  }
}

// Params
const currentPage = ref(Number(route.query.page) || 1)
const pageSize = ref(Number(route.query.pageSize) || 20)
const chartDimension = ref<'user' | 'model'>('user')
const historyFilters = ref<{
  model?: string
  start?: string
  end?: string
}>({
  model: (route.query.model as string) || '',
  start: (route.query.start as string) || '',
  end: (route.query.end as string) || '',
})
const sortField = ref<'createdAt' | 'amount'>('createdAt')
const sortDirection = ref<'asc' | 'desc'>('desc')

// Derived Data
const trendValues = computed(() => tokenTrend.value.map(t => t.value))
const modelShareData = computed(() => {
  // Aggregate from history (Sampled)
  const map = new Map<string, number>()
  tokenHistory.value.forEach(r => {
    if (r.model) {
      map.set(r.model, (map.get(r.model) || 0) + r.amount)
    }
  })
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
})

const sortedTokenHistory = computed(() => {
  const list = [...tokenHistory.value]
  list.sort((a, b) => {
    const aValue = sortField.value === 'amount' ? Number(a.amount || 0) : new Date(a.createdAt).getTime()
    const bValue = sortField.value === 'amount' ? Number(b.amount || 0) : new Date(b.createdAt).getTime()
    return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue
  })
  return list
})

const ringChange = computed(() => {
  if (!tokenStats.value || tokenTrend.value.length < 2) return 0
  const today = tokenStats.value.todayUsage
  // Find yesterday's data from trend
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterdayData = tokenTrend.value.find(t => {
    const date = new Date(t.date)
    const yest = new Date()
    yest.setDate(yest.getDate() - 1)
    return date.toISOString().split('T')[0] === yest.toISOString().split('T')[0]
  })
  
  const yesterday = yesterdayData ? yesterdayData.value : 0
  if (yesterday === 0) return today > 0 ? 100 : 0
  return Number(((today - yesterday) / yesterday * 100).toFixed(1))
})

onMounted(() => {
  fetchData()

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        chartsVisible.value = true
        observer.disconnect()
      }
    },
    {rootMargin: '160px 0px'},
  )
  if (chartSectionRef.value) {
    observer.observe(chartSectionRef.value)
  } else {
    chartsVisible.value = true
  }
})

async function fetchData(isRefresh = false) {
  if (isRefresh) {
    refreshing.value = true
    // Minimum 1s spin
    const start = Date.now()
    try {
      await loadAll()
      const duration = Date.now() - start
      if (duration < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - duration))
      }
    } finally {
      refreshing.value = false
      lastUpdated.value = new Date()
    }
  } else {
    loading.value = true
    try {
      await loadAll()
    } finally {
      loading.value = false
      lastUpdated.value = new Date()
    }
  }
}

async function loadAll() {
  const [stats, trend, history] = await Promise.all([
    getTokenStats(),
    getTokenTrend(30),
    getTokenHistory(currentPage.value, pageSize.value, historyFilters.value)
  ])
  tokenStats.value = stats
  tokenTrend.value = trend.map((t: TokenTrendItem) => ({date: t.date, value: Number(t.count)}))
  tokenHistory.value = history.records
  tokenHistoryTotal.value = history.total
}

async function handlePageChange(page: number) {
  currentPage.value = page
  updateUrl()
  await loadHistory()
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await getTokenHistory(currentPage.value, pageSize.value, historyFilters.value)
    tokenHistory.value = res.records
    tokenHistoryTotal.value = res.total
  } finally {
    historyLoading.value = false
  }
}

function updateUrl() {
  router.replace({
    query: {
      ...route.query,
      page: currentPage.value,
      pageSize: pageSize.value,
      model: historyFilters.value.model || undefined,
      start: historyFilters.value.start || undefined,
      end: historyFilters.value.end || undefined,
    }
  })
}

async function handleExport(format: 'csv' | 'excel') {
  try {
    const blob = await exportTokenHistory()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `token_usage_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Export failed', e)
    alert('导出失败')
  }
}

function handleFilter(filters: TokenHistoryFilterPayload) {
  historyFilters.value = {
    model: filters?.model || '',
    start: filters?.dateRange?.start || '',
    end: filters?.dateRange?.end || '',
  }
  currentPage.value = 1
  updateUrl()
  loadHistory()
}

function handleSort(field: string) {
  const nextField = field === 'amount' ? 'amount' : 'createdAt'
  if (sortField.value === nextField) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortField.value = nextField
  sortDirection.value = nextField === 'createdAt' ? 'desc' : 'asc'
}

function handleExportRow(row: TokenRecord) {
  const escapeCell = (value: unknown) => {
    const normalized = String(value ?? '')
    const safeValue = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized
    return `"${safeValue.replace(/"/g, '""')}"`
  }
  const csvContent = `data:text/csv;charset=utf-8,${[
    ['Time', 'User', 'Model', 'Amount'],
    [row.createdAt, 'Current User', row.model || '-', row.amount],
  ].map((line) => line.map(escapeCell).join(',')).join('\n')}`
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  link.setAttribute("download", `token_record_${row.id}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 sm:p-8 transition-colors duration-300">
    <div class="max-w-7xl mx-auto space-y-6">
      
      <!-- Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <nav class="flex text-sm text-slate-500 mb-1">
            <span class="hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer">首页</span>
            <span class="mx-2">/</span>
            <span class="text-slate-800 dark:text-white font-medium">Token 用量</span>
          </nav>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Token 用量统计</h1>
        </div>
        
        <button 
          @click="fetchData(true)"
          :disabled="refreshing"
          class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all disabled:opacity-70"
        >
          <svg 
            class="w-4 h-4" 
            :class="{'animate-spin': refreshing}" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ refreshing ? '刷新中...' : '刷新数据' }}
          <span class="text-xs text-slate-400 ml-1" v-if="!refreshing">{{ lastUpdated.toLocaleTimeString() }}</span>
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          title="今日消耗" 
          :value="tokenStats?.todayUsage?.toLocaleString() || '0'" 
          :trend-data="trendValues.slice(-7)" 
          color="#10B981"
          :loading="loading"
        />
        <KpiCard 
          title="本月累计" 
          :value="tokenStats?.monthUsage?.toLocaleString() || '0'" 
          :trend-data="trendValues" 
          color="#8B5CF6"
          :loading="loading"
        />
        <KpiCard 
          title="剩余额度" 
          :value="tokenStats?.balance?.toLocaleString() || '0'" 
          :trend-data="[]" 
          suffix="Tokens"
          color="#F59E0B"
          :loading="loading"
        />
        <KpiCard 
          title="环比变化" 
          :value="Math.abs(ringChange) + '%'" 
          :change="ringChange"
          change-label="较昨日"
          :trend-data="trendValues.slice(-7)" 
          color="#0EA5E9"
          :loading="loading"
        />
      </div>

      <!-- Charts -->
      <div ref="chartSectionRef" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 h-96">
          <div v-if="!chartsVisible" class="h-full rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 animate-pulse">
            <div class="h-6 w-40 rounded bg-slate-100 dark:bg-slate-700"></div>
            <div class="mt-4 h-72 rounded-xl bg-slate-100 dark:bg-slate-700"></div>
          </div>
          <LineChart
            v-else
            :data="tokenTrend" 
            v-model:dimension="chartDimension"
            :loading="loading"
          />
        </div>
        <div class="h-96">
          <div v-if="!chartsVisible" class="h-full rounded-2xl border border-slate-200/70 bg-white dark:bg-slate-800 dark:border-slate-700 p-5 animate-pulse">
            <div class="h-6 w-32 rounded bg-slate-100 dark:bg-slate-700"></div>
            <div class="mt-4 h-72 rounded-xl bg-slate-100 dark:bg-slate-700"></div>
          </div>
          <BarChart
            v-else
            :data="modelShareData"
            :loading="loading"
          />
        </div>
      </div>

      <!-- Table -->
        <UsageTable 
          :data="sortedTokenHistory" 
        :total="tokenHistoryTotal"
        v-model:page="currentPage"
        v-model:page-size="pageSize"
        :loading="historyLoading || loading"
        @filter="handleFilter"
        @sort="handleSort"
        @export-row="handleExportRow"
      />

      <!-- Footer -->
      <ExportPanel 
        :loading="loading" 
        @export="handleExport"
      />
      
      <div class="text-center text-xs text-slate-400 pb-8">
        数据统计截止至 {{ new Date().toLocaleString() }} • 如有疑问请联系管理员
      </div>

    </div>
  </div>
</template>
