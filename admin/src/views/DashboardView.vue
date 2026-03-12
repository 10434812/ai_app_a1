<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">仪表盘</h1>
      <button @click="refreshData" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2 text-sm">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        刷新数据
      </button>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-6">
      <div v-for="stat in stats" :key="stat.title" class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 transition-all hover:shadow-md">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-gray-500">{{ stat.title }}</h3>
          <div :class="`p-2 rounded-lg ${stat.colorBg} ${stat.colorText}`">
            <component :is="stat.icon" class="w-5 h-5" />
          </div>
        </div>
        <div class="flex items-baseline">
          <p class="text-2xl font-bold text-gray-900">{{ stat.value }}</p>
          <span v-if="stat.change" :class="`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${stat.changeType === 'increase' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`">
            {{ stat.change }}
          </span>
        </div>
      </div>
    </div>

    <!-- Retention Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-500 mb-2">日活跃用户 (DAU)</h3>
        <p class="text-3xl font-bold text-indigo-600">{{ retention.dau }}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-500 mb-2">周活跃用户 (WAU)</h3>
        <p class="text-3xl font-bold text-purple-600">{{ retention.wau }}</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-500 mb-2">月活跃用户 (MAU)</h3>
        <p class="text-3xl font-bold text-blue-600">{{ retention.mau }}</p>
      </div>
    </div>

    <!-- Observability -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-500 mb-2">支付成功率</h3>
        <p class="text-3xl font-bold text-emerald-600">{{ observability.paymentSuccessRate }}%</p>
        <p class="text-xs text-gray-500 mt-2">
          成功 {{ observability.paymentSuccessTotal }} / 发起 {{ observability.paymentAttemptTotal }}
        </p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-500 mb-2">聊天扣费失败率</h3>
        <p class="text-3xl font-bold text-amber-600">{{ observability.tokenDeductFailureRate }}%</p>
        <p class="text-xs text-gray-500 mt-2">
          失败 {{ observability.tokenDeductFailedTotal }} / 总扣费 {{ observability.tokenDeductSuccessTotal + observability.tokenDeductFailedTotal }}
        </p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h3 class="text-sm font-medium text-gray-500 mb-2">图片扣费失败率</h3>
        <p class="text-3xl font-bold text-rose-600">{{ observability.imageDeductFailureRate }}%</p>
        <p class="text-xs text-gray-500 mt-2">
          失败 {{ observability.imageDeductFailedTotal }} / 总扣费 {{ observability.imageDeductSuccessTotal + observability.imageDeductFailedTotal }}
        </p>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Cost/Token Trend -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 min-h-[400px]">
        <h3 class="text-lg font-bold text-gray-900 mb-6">近7日消耗趋势 ($)</h3>
        <div class="h-[300px] w-full relative">
          <Bar v-if="costChartData" :data="costChartData" :options="chartOptions" />
          <div v-else class="flex items-center justify-center h-full text-gray-400">加载中...</div>
        </div>
      </div>
      <!-- Model Usage Distribution -->
      <div class="bg-white rounded-xl shadow-sm p-6 border border-gray-100 min-h-[400px]">
        <h3 class="text-lg font-bold text-gray-900 mb-6">模型调用分布</h3>
        <div class="h-[300px] w-full relative flex items-center justify-center">
          <Doughnut v-if="modelChartData" :data="modelChartData" :options="doughnutOptions" />
          <div v-else class="flex items-center justify-center h-full text-gray-400">加载中...</div>
        </div>
      </div>
    </div>

    <!-- Recent Questions -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h3 class="text-lg font-bold text-gray-900">最近提问</h3>
        <router-link to="/conversations" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">查看全部 &rarr;</router-link>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模型</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内容摘要</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="q in recentQuestions" :key="q.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ q.conversation?.user?.email || 'Unknown' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {{ q.model }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                {{ q.content }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(q.createdAt).toLocaleString() }}
              </td>
            </tr>
            <tr v-if="recentQuestions.length === 0">
              <td colspan="4" class="px-6 py-4 text-center text-gray-500 text-sm">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, type Component} from 'vue'
import {Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement} from 'chart.js'
import {Bar, Doughnut} from 'vue-chartjs'
import {getMetrics, getCostDashboard, getRetentionStats, getRecentQuestions, getObservabilitySummary} from '../api/admin'
import type {SystemMetrics, CostDashboard, RetentionStats, RecentQuestion, ObservabilitySummary} from '../api/admin'
import {UsersIcon, CpuChipIcon, ChatBubbleLeftRightIcon, BoltIcon, EyeIcon, UserIcon} from '@heroicons/vue/24/outline'

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

// Data State
const metrics = ref<SystemMetrics>({
  activeUsers: 0,
  totalTokens: 0,
  totalRequests: 0,
  totalVisits: 0,
  guestVisits: 0,
  uniqueVisitors: 0,
  guestUniqueVisitors: 0,
  todayVisits: 0,
  activeModels: 0,
})

const retention = ref<RetentionStats>({
  dau: 0,
  wau: 0,
  mau: 0,
})

const observability = ref<ObservabilitySummary>({
  paymentAttemptTotal: 0,
  paymentSuccessTotal: 0,
  paymentFailedTotal: 0,
  paymentSuccessRate: 0,
  chatRequestTotal: 0,
  tokenDeductSuccessTotal: 0,
  tokenDeductFailedTotal: 0,
  tokenDeductFailureRate: 0,
  imageDeductSuccessTotal: 0,
  imageDeductFailedTotal: 0,
  imageDeductFailureRate: 0,
})

const recentQuestions = ref<RecentQuestion[]>([])

// Chart Data State
const costChartData = ref<any>(null)
const modelChartData = ref<any>(null)

interface StatItem {
  title: string
  value: string
  icon: Component
  colorBg: string
  colorText: string
  change?: string
  changeType?: 'increase' | 'decrease'
}

// Stats Cards Configuration
const stats = ref<StatItem[]>([
  {
    title: '总用户数',
    value: '0',
    icon: UsersIcon,
    colorBg: 'bg-blue-50',
    colorText: 'text-blue-600',
  },
  {
    title: '总访问量',
    value: '0',
    icon: EyeIcon,
    colorBg: 'bg-emerald-50',
    colorText: 'text-emerald-600',
    change: '独立 0',
    changeType: 'increase',
  },
  {
    title: '游客访问',
    value: '0',
    icon: UserIcon,
    colorBg: 'bg-cyan-50',
    colorText: 'text-cyan-600',
    change: '独立 0',
    changeType: 'increase',
  },
  {
    title: '总调用次数',
    value: '0',
    icon: ChatBubbleLeftRightIcon,
    colorBg: 'bg-green-50',
    colorText: 'text-green-600',
    change: '今日 0',
    changeType: 'increase',
  },
  {
    title: '消耗 Token',
    value: '0',
    icon: BoltIcon,
    colorBg: 'bg-yellow-50',
    colorText: 'text-yellow-600',
  },
  {
    title: '可用模型',
    value: '0',
    icon: CpuChipIcon,
    colorBg: 'bg-purple-50',
    colorText: 'text-purple-600',
  },
])

// Chart Options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
  },
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
    },
  },
}

const refreshData = async () => {
  try {
    const [metricsData, costData, retentionData, questionsData, observabilityData] = await Promise.all([
      getMetrics(),
      getCostDashboard(),
      getRetentionStats(),
      getRecentQuestions(),
      getObservabilitySummary(),
    ])

    // Update Metrics
    metrics.value = metricsData
    stats.value[0].value = metricsData.activeUsers.toString()
    stats.value[1].value = metricsData.totalVisits.toString()
    stats.value[1].change = `独立 ${metricsData.uniqueVisitors}`
    stats.value[2].value = metricsData.guestVisits.toString()
    stats.value[2].change = `独立 ${metricsData.guestUniqueVisitors}`
    stats.value[3].value = metricsData.totalRequests.toString()
    stats.value[3].change = `今日 ${metricsData.todayVisits}`
    stats.value[4].value = (metricsData.totalTokens / 1000).toFixed(1) + 'k'
    stats.value[5].value = metricsData.activeModels.toString()

    // Update Retention
    retention.value = retentionData
    observability.value = observabilityData

    // Update Questions
    recentQuestions.value = questionsData.slice(0, 5) // Show top 5

    // Update Charts
    // 1. Cost Bar Chart
    costChartData.value = {
      labels: costData.dailyCosts.map((d) => d.date.slice(5)), // MM-DD
      datasets: [
        {
          label: '每日消耗 ($)',
          backgroundColor: '#4f46e5',
          data: costData.dailyCosts.map((d) => d.cost),
          borderRadius: 4,
        },
      ],
    }

    // 2. Model Distribution Doughnut
    const models = costData.modelBreakdown
    modelChartData.value = {
      labels: models.map((m) => m.model),
      datasets: [
        {
          backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
          data: models.map((m) => m.requests),
        },
      ],
    }
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error)
  }
}

onMounted(() => {
  refreshData()
})
</script>
