<script setup lang="ts">
import { ref, computed } from 'vue'

interface TokenRecord {
  id: string
  amount: number
  type: string
  model?: string
  balanceAfter: number
  createdAt: string
  meta?: string
}

const props = defineProps<{
  data: TokenRecord[]
  loading: boolean
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits(['update:page', 'update:pageSize', 'filter', 'sort', 'export-row'])

const modelFilter = ref('')
const dateRange = ref<{start: string, end: string}>({ start: '', end: '' })

// Helper to parse meta
const parseMeta = (metaStr?: string) => {
  if (!metaStr) return { input: '-', output: '-', cost: '-' }
  try {
    const meta = JSON.parse(metaStr)
    const legacyInput = meta.inputLen ? Math.max(1, Math.ceil(Number(meta.inputLen) / 4)) : undefined
    const legacyOutput = meta.outputLen ? Math.max(0, Math.ceil(Number(meta.outputLen) / 4)) : undefined
    return {
      input: meta.prompt_tokens ?? legacyInput ?? '-',
      output: meta.completion_tokens ?? legacyOutput ?? '-',
      cost: meta.total_cost ?? meta.cost ?? '-'
    }
  } catch (e) {
    return { input: '-', output: '-', cost: '-' }
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handlePageChange = (newPage: number) => {
  emit('update:page', newPage)
}

const handleFilter = () => {
  emit('filter', { model: modelFilter.value, dateRange: dateRange.value })
}

const handleSort = (field: string) => {
  emit('sort', field)
}

const exportRow = (row: TokenRecord) => {
  emit('export-row', row)
}

const totalPages = computed(() => Math.ceil(props.total / props.pageSize))
const modelOptions = computed(() => {
  const values = new Set<string>()
  props.data.forEach((row) => {
    if (row.model) values.add(row.model)
  })
  return Array.from(values).sort((a, b) => a.localeCompare(b))
})
</script>

<template>
  <div class="bg-white dark:bg-slate-800 rounded-lg shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
    <!-- Filters -->
    <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-500">模型筛选:</span>
          <select v-model="modelFilter" @change="handleFilter" aria-label="按模型筛选" class="text-sm border-slate-200 rounded-md focus:ring-primary-500 focus:border-primary-500 dark:bg-slate-700 dark:border-slate-600">
            <option value="">全部</option>
            <option v-for="model in modelOptions" :key="model" :value="model">{{ model }}</option>
          </select>
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-500">时间范围:</span>
          <input type="date" v-model="dateRange.start" @change="handleFilter" aria-label="开始日期" class="text-sm border-slate-200 rounded-md dark:bg-slate-700 dark:border-slate-600">
          <span class="text-slate-400">-</span>
          <input type="date" v-model="dateRange.end" @change="handleFilter" aria-label="结束日期" class="text-sm border-slate-200 rounded-md dark:bg-slate-700 dark:border-slate-600">
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium">
          <tr>
            <th class="px-6 py-4" scope="col">时间</th>
            <th class="px-6 py-4" scope="col">用户</th>
            <th class="px-6 py-4" scope="col">模型</th>
            <th class="px-6 py-4 text-right" scope="col">输入 Tokens</th>
            <th class="px-6 py-4 text-right" scope="col">输出 Tokens</th>
            <th class="px-6 py-4 text-right" scope="col" aria-sort="none">
              <button type="button" @click="handleSort('amount')" class="inline-flex items-center justify-end gap-1 text-right cursor-pointer hover:text-primary-600" aria-label="按总费用排序">
                总费用
                <span aria-hidden="true">↕</span>
              </button>
            </th>
            <th class="px-6 py-4 text-center" scope="col">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
          <template v-if="loading">
            <tr v-for="i in 5" :key="i">
              <td class="px-6 py-4"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12 ml-auto animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12 ml-auto animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mx-auto animate-pulse"></div></td>
            </tr>
          </template>
          
          <template v-else-if="data.length === 0">
            <tr>
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center text-slate-400">
                  <svg class="w-16 h-16 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>暂无数据记录</p>
                </div>
              </td>
            </tr>
          </template>
          
          <template v-else>
            <tr v-for="row in data" :key="row.id" class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
              <td class="px-6 py-4 text-slate-600 dark:text-slate-300">{{ formatDate(row.createdAt) }}</td>
              <td class="px-6 py-4 text-slate-600 dark:text-slate-300">当前用户</td>
              <td class="px-6 py-4">
                <span v-if="row.model" class="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300">{{ row.model }}</span>
                <span v-else class="text-slate-400">-</span>
              </td>
              <td class="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{{ parseMeta(row.meta).input }}</td>
              <td class="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-400">{{ parseMeta(row.meta).output }}</td>
              <td class="px-6 py-4 text-right font-mono font-medium text-slate-900 dark:text-white">
                {{ row.amount }}
              </td>
              <td class="px-6 py-4 text-center">
                <button @click="exportRow(row)" type="button" :aria-label="`导出 ${row.model || '当前记录'} CSV`" class="text-primary-600 hover:text-primary-700 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
                  导出CSV
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
      <div class="text-sm text-slate-500">
        显示 {{ (page - 1) * pageSize + 1 }} 到 {{ Math.min(page * pageSize, total) }} 条，共 {{ total }} 条
      </div>
      <div class="flex gap-2">
        <button 
          @click="handlePageChange(page - 1)" 
          type="button"
          :disabled="page <= 1"
          aria-label="上一页"
          class="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          上一页
        </button>
        <button 
          @click="handlePageChange(page + 1)" 
          type="button"
          :disabled="page >= totalPages"
          aria-label="下一页"
          class="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          下一页
        </button>
      </div>
    </div>
  </div>
</template>
