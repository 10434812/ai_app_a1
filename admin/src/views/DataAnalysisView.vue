<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {
  getAnalysisStats,
  getRecentQuestions,
  getTokenEconomicsDashboard,
  type AnalysisStats,
  type RecentQuestion,
  type TokenEconomicsDashboard,
} from '../api/admin'

const stats = ref<AnalysisStats>({totalConversations: 0, totalMessages: 0, totalUsers: 0})
const questions = ref<RecentQuestion[]>([])
const economics = ref<TokenEconomicsDashboard | null>(null)
const loading = ref(true)
const days = ref(30)

const loadData = async () => {
  loading.value = true
  try {
    const [statsData, questionsData, economicsData] = await Promise.all([
      getAnalysisStats(),
      getRecentQuestions(80),
      getTokenEconomicsDashboard(days.value),
    ])
    stats.value = statsData
    questions.value = questionsData
    economics.value = economicsData
  } catch (error) {
    console.error('Failed to load analysis data', error)
  } finally {
    loading.value = false
  }
}

const formatDateTime = (date: string) => new Date(date).toLocaleString()

const formatMoney = (value: number | undefined) => {
  const amount = Number(value || 0)
  return `¥${amount.toFixed(2)}`
}

const formatNumber = (value: number | undefined) => Number(value || 0).toLocaleString()

const costRate = computed(() => {
  const total = economics.value?.totals
  if (!total || total.netRevenue <= 0) return '-'
  return `${((total.modelTokenCost / total.netRevenue) * 100).toFixed(1)}%`
})

const grossProfit = computed(() => {
  const total = economics.value?.totals
  if (!total) return 0
  if (typeof total.grossProfit === 'number') return total.grossProfit
  return Number((total.netRevenue - total.modelTokenCost).toFixed(2))
})

const refundRate = computed(() => Number(economics.value?.totals.refundRate || 0))
const arppu = computed(() => Number(economics.value?.totals.arppu || economics.value?.totals.revenuePerPaidUser || 0))

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-slate-800">数据分析</h1>
      <div class="flex items-center gap-2">
        <select
          v-model.number="days"
          @change="loadData"
          class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option :value="7">近 7 天</option>
          <option :value="30">近 30 天</option>
          <option :value="90">近 90 天</option>
          <option :value="180">近 180 天</option>
        </select>
        <button
          @click="loadData"
          class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          :disabled="loading">
          {{ loading ? '刷新中...' : '刷新数据' }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div class="mb-2 text-sm font-medium text-slate-500">总对话数</div>
        <div class="text-3xl font-bold text-slate-900">{{ formatNumber(stats.totalConversations) }}</div>
      </div>
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div class="mb-2 text-sm font-medium text-slate-500">总消息数</div>
        <div class="text-3xl font-bold text-slate-900">{{ formatNumber(stats.totalMessages) }}</div>
      </div>
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div class="mb-2 text-sm font-medium text-slate-500">总用户数</div>
        <div class="text-3xl font-bold text-slate-900">{{ formatNumber(stats.totalUsers) }}</div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 class="mb-4 text-lg font-bold text-slate-900">会员与 Token 经营面板</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">收入（净）</div>
          <div class="mt-2 text-2xl font-bold text-slate-900">{{ formatMoney(economics?.totals.netRevenue) }}</div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">模型成本 (Token)</div>
          <div class="mt-2 text-2xl font-bold text-slate-900">{{ formatNumber(economics?.totals.modelTokenCost) }}</div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">毛利</div>
          <div class="mt-2 text-2xl font-bold text-slate-900">{{ formatMoney(grossProfit) }}</div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">退款率</div>
          <div class="mt-2 text-2xl font-bold text-slate-900">{{ refundRate }}%</div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">ARPPU</div>
          <div class="mt-2 text-2xl font-bold text-slate-900">{{ formatMoney(arppu) }}</div>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div class="text-xs text-slate-500">成本率</div>
          <div class="mt-2 text-2xl font-bold text-slate-900">{{ costRate }}</div>
          <div class="mt-1 text-xs text-slate-500">
            provider={{ economics?.totals.providerUsageCount || 0 }} / total={{ economics?.totals.usageTrackedCount || 0 }}
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-4 py-3">
          <h2 class="font-bold text-slate-800">Top 用户消耗 ({{ days }} 天)</h2>
        </div>
        <div class="max-h-[360px] overflow-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-4 py-3">用户</th>
                <th class="px-4 py-3 text-right">请求数</th>
                <th class="px-4 py-3 text-right">消耗</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!economics?.topUsers?.length">
                <td colspan="3" class="px-4 py-8 text-center text-slate-400">暂无数据</td>
              </tr>
              <tr v-for="item in economics?.topUsers || []" :key="item.userId">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-800">{{ item.name || item.email || item.userId }}</div>
                  <div class="text-xs text-slate-500">{{ item.email }}</div>
                </td>
                <td class="px-4 py-3 text-right text-slate-600">{{ formatNumber(item.requests) }}</td>
                <td class="px-4 py-3 text-right font-semibold text-slate-900">{{ formatNumber(item.totalCost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-4 py-3">
          <h2 class="font-bold text-slate-800">Top 模型消耗 ({{ days }} 天)</h2>
        </div>
        <div class="max-h-[360px] overflow-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-4 py-3">模型</th>
                <th class="px-4 py-3 text-right">请求数</th>
                <th class="px-4 py-3 text-right">消耗</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="!economics?.topModels?.length">
                <td colspan="3" class="px-4 py-8 text-center text-slate-400">暂无数据</td>
              </tr>
              <tr v-for="item in economics?.topModels || []" :key="item.model">
                <td class="px-4 py-3 font-medium text-slate-800">{{ item.model }}</td>
                <td class="px-4 py-3 text-right text-slate-600">{{ formatNumber(item.requests) }}</td>
                <td class="px-4 py-3 text-right font-semibold text-slate-900">{{ formatNumber(item.totalCost) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div class="border-b border-slate-100 px-4 py-3">
        <h2 class="font-bold text-slate-800">套餐收入结构 ({{ days }} 天)</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-3">套餐</th>
              <th class="px-4 py-3 text-right">完成订单</th>
              <th class="px-4 py-3 text-right">退款订单</th>
              <th class="px-4 py-3 text-right">完成收入</th>
              <th class="px-4 py-3 text-right">退款金额</th>
              <th class="px-4 py-3 text-right">净收入</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="!economics?.membershipPlans?.length">
              <td colspan="6" class="px-4 py-8 text-center text-slate-400">暂无数据</td>
            </tr>
            <tr v-for="item in economics?.membershipPlans || []" :key="item.planKey">
              <td class="px-4 py-3 font-medium text-slate-800">{{ item.planKey }}</td>
              <td class="px-4 py-3 text-right">{{ formatNumber(item.completedOrders) }}</td>
              <td class="px-4 py-3 text-right">{{ formatNumber(item.refundedOrders) }}</td>
              <td class="px-4 py-3 text-right">{{ formatMoney(item.completedRevenue) }}</td>
              <td class="px-4 py-3 text-right">{{ formatMoney(item.refundedRevenue) }}</td>
              <td class="px-4 py-3 text-right font-semibold text-slate-900">{{ formatMoney(item.netRevenue) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div class="border-b border-slate-100 px-4 py-3">
        <h2 class="font-bold text-slate-800">最近提问</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-3 w-1/4">提问时间</th>
              <th class="px-4 py-3 w-1/4">模型</th>
              <th class="px-4 py-3 w-2/4">内容</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading">
              <td colspan="3" class="px-4 py-8 text-center text-slate-400">加载中...</td>
            </tr>
            <tr v-else-if="questions.length === 0">
              <td colspan="3" class="px-4 py-8 text-center text-slate-400">暂无数据</td>
            </tr>
            <tr v-else v-for="q in questions" :key="q.id" class="hover:bg-slate-50">
              <td class="px-4 py-3 text-slate-500">{{ formatDateTime(q.createdAt) }}</td>
              <td class="px-4 py-3 font-medium text-slate-800">{{ q.model || 'Unknown' }}</td>
              <td class="px-4 py-3 text-slate-600">{{ q.content }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
