<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getUserPortraits, type UserPortrait } from '../api/admin'

const portraits = ref<UserPortrait[]>([])
const loading = ref(true)

const loadData = async () => {
  loading.value = true
  try {
    portraits.value = await getUserPortraits()
  } catch (error) {
    console.error('Failed to load user portraits', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-slate-800">用户画像</h1>
      <button @click="loadData" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        刷新数据
      </button>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50">
              <th class="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">用户</th>
              <th class="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">提问总数</th>
              <th class="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">用户标签</th>
              <th class="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">最后活跃</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading" class="animate-pulse">
              <td colspan="4" class="p-4 text-center text-slate-400">加载中...</td>
            </tr>
            <tr v-else-if="portraits.length === 0">
              <td colspan="4" class="p-4 text-center text-slate-400">暂无数据</td>
            </tr>
            <tr v-else v-for="user in portraits" :key="user.userId" class="hover:bg-slate-50 transition-colors">
              <td class="p-4">
                <div class="flex items-center gap-3">
                  <div class="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {{ user.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-medium text-slate-900">{{ user.name }}</div>
                    <div class="text-xs text-slate-500">{{ user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="p-4 text-slate-600 font-medium">{{ user.totalQuestions }}</td>
              <td class="p-4">
                <div class="flex flex-wrap gap-2">
                  <span v-for="tag in user.tags" :key="tag" class="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                    {{ tag }}
                  </span>
                </div>
              </td>
              <td class="p-4 text-sm text-slate-500">{{ formatDate(user.lastActive) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
