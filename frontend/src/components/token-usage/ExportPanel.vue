<script setup lang="ts">
defineProps<{
  loading?: boolean
}>()

const emit = defineEmits(['export'])

const handleExport = (format: 'csv' | 'excel') => {
  emit('export', format)
}
</script>

<template>
  <div class="bg-indigo-50 dark:bg-slate-800/50 rounded-lg p-6 flex flex-col md:flex-row justify-between items-center gap-4 border border-indigo-100 dark:border-slate-700">
    <div>
      <h4 class="text-base font-semibold text-slate-800 dark:text-white mb-1">数据导出</h4>
      <p class="text-sm text-slate-500 dark:text-slate-400">导出完整的 Token 使用记录以进行进一步分析。支持 CSV 和 Excel 格式。</p>
    </div>
    
    <div class="flex gap-3">
      <button 
        @click="handleExport('csv')"
        type="button"
        :disabled="loading"
        aria-label="导出 CSV 文件"
        class="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        导出 CSV
      </button>
      <button 
        @click="handleExport('excel')"
        type="button"
        :disabled="loading"
        aria-label="导出 Excel 文件"
        class="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出 Excel
      </button>
    </div>
  </div>
</template>
