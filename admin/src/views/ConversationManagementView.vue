<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">对话日志</h1>
        <p class="text-sm text-slate-500 mt-1">查看和管理系统内的所有用户对话记录</p>
      </div>
      <div class="flex gap-3">
        <button
          @click="handleBatchDeleteConversations"
          :disabled="selectedConversationIds.length === 0 || batchDeleting"
          class="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium transition-all shadow-sm">
          <svg class="w-4 h-4" :class="{'animate-spin': batchDeleting}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 7h12m-1 0-.867 12.142A2 2 0 0114.138 21H9.862a2 2 0 01-1.995-1.858L7 7m4 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
          批量删除（{{ selectedConversationIds.length }}）
        </button>
        <select v-model="limit" @change="fetchQuestions" class="rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-2 px-3 text-slate-600 bg-white hover:bg-slate-50 transition-colors cursor-pointer outline-none">
          <option :value="50">最近 50 条</option>
          <option :value="100">最近 100 条</option>
          <option :value="200">最近 200 条</option>
          <option :value="500">最近 500 条</option>
        </select>
        <button @click="fetchQuestions" class="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 text-sm font-medium transition-all shadow-sm">
          <svg class="w-4 h-4" :class="{'animate-spin': loading}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          刷新
        </button>
      </div>
    </div>

    <!-- Main Content Card -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100">
          <thead class="bg-slate-50/50">
            <tr>
              <th scope="col" class="px-4 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  :checked="allVisibleSelected"
                  @change="toggleSelectAllVisible"
                  class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              </th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-40">时间</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-48">用户</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-32">模型</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">内容</th>
              <th scope="col" class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-32">ID</th>
              <th scope="col" class="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider w-24">操作</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-100">
            <tr v-if="loading" class="animate-pulse">
              <td colspan="7" class="px-6 py-8 text-center text-sm text-slate-400">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                  <div class="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-75"></div>
                  <div class="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-150"></div>
                </div>
              </td>
            </tr>
            <tr v-else-if="questions.length === 0">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center text-slate-400">
                  <svg class="w-12 h-12 mb-3 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p class="text-sm font-medium">暂无对话记录</p>
                </div>
              </td>
            </tr>
            <tr v-else v-for="q in questions" :key="q.id" class="group hover:bg-slate-50/80 transition-all duration-200">
              <td class="px-4 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  :checked="selectedConversationSet.has(q.conversationId)"
                  @change="toggleConversationSelection(q.conversationId)"
                  class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                <div class="flex flex-col">
                  <span class="font-medium text-slate-700">{{ new Date(q.createdAt).toLocaleTimeString() }}</span>
                  <span class="text-xs text-slate-400">{{ new Date(q.createdAt).toLocaleDateString() }}</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-xs font-bold text-indigo-600 border border-indigo-200/50 shadow-sm">
                    {{ (q.conversation?.user?.email || 'G').charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-slate-700">{{ q.conversation?.user?.email ? q.conversation.user.email.split('@')[0] : 'Guest' }}</span>
                    <span class="text-xs text-slate-400 max-w-[120px] truncate" :title="q.conversation?.user?.email || 'Unknown User'">{{ q.conversation?.user?.email || 'Unknown User' }}</span>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2.5 py-1 text-xs font-medium rounded-full border shadow-sm" :class="getModelBadgeClass(q.model)">
                  {{ q.model || 'Default' }}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-slate-600 max-w-xl">
                <div class="line-clamp-2 leading-relaxed group-hover:text-slate-900 transition-colors" :title="q.content">
                  {{ q.content }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded select-all hover:bg-slate-200 transition-colors cursor-pointer" :title="q.conversationId">
                  {{ q.conversationId.slice(0, 8) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right">
                <button
                  @click="handleDeleteConversation(q.conversationId)"
                  :disabled="deletingConversationId === q.conversationId"
                  class="text-sm font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50 disabled:cursor-not-allowed">
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer Info -->
      <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400 flex justify-between items-center">
        <span>共 {{ questions.length }} 条记录</span>
        <span>仅展示最近 {{ limit }} 条</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref, onMounted} from 'vue'
import {batchDeleteConversationLogs, deleteConversationLog, getRecentQuestions} from '../api/admin'
import type {RecentQuestion} from '../api/admin'

const questions = ref<RecentQuestion[]>([])
const loading = ref(false)
const limit = ref(100)
const deletingConversationId = ref<string | null>(null)
const batchDeleting = ref(false)
const selectedConversationIds = ref<string[]>([])

const selectedConversationSet = computed(() => new Set(selectedConversationIds.value))
const visibleConversationIds = computed(() => Array.from(new Set(questions.value.map((item) => item.conversationId))))
const allVisibleSelected = computed(
  () => visibleConversationIds.value.length > 0 && visibleConversationIds.value.every((id) => selectedConversationSet.value.has(id)),
)

const extractAdminErrorMessage = (error: any, fallback: string) => {
  const payload = error?.response?.data
  if (typeof payload?.error?.message === 'string' && payload.error.message.trim()) return payload.error.message.trim()
  if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim()
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim()
  return fallback
}

const fetchQuestions = async () => {
  loading.value = true
  try {
    questions.value = await getRecentQuestions(limit.value)
    const visibleSet = new Set(questions.value.map((item) => item.conversationId))
    selectedConversationIds.value = selectedConversationIds.value.filter((id) => visibleSet.has(id))
  } catch (error) {
    console.error('Failed to fetch questions:', error)
  } finally {
    loading.value = false
  }
}

const toggleConversationSelection = (conversationId: string) => {
  const set = new Set(selectedConversationIds.value)
  if (set.has(conversationId)) {
    set.delete(conversationId)
  } else {
    set.add(conversationId)
  }
  selectedConversationIds.value = Array.from(set)
}

const toggleSelectAllVisible = () => {
  if (allVisibleSelected.value) {
    selectedConversationIds.value = selectedConversationIds.value.filter(
      (id) => !visibleConversationIds.value.includes(id),
    )
    return
  }

  const set = new Set(selectedConversationIds.value)
  for (const conversationId of visibleConversationIds.value) {
    set.add(conversationId)
  }
  selectedConversationIds.value = Array.from(set)
}

const getModelBadgeClass = (model: string) => {
  if (!model) return 'bg-slate-100 text-slate-600 border-slate-200'
  if (model.includes('gpt') || model.includes('openai')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (model.includes('claude')) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (model.includes('deepseek')) return 'bg-blue-50 text-blue-700 border-blue-200'
  if (model.includes('moonshot') || model.includes('kimi')) return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (model.includes('glm')) return 'bg-cyan-50 text-cyan-700 border-cyan-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

const handleDeleteConversation = async (conversationId: string) => {
  const confirmed = window.confirm(`确定删除会话 ${conversationId.slice(0, 8)} 的全部日志吗？\n该操作不可撤销。`)
  if (!confirmed) return

  deletingConversationId.value = conversationId
  try {
    await deleteConversationLog(conversationId)
    questions.value = questions.value.filter((item) => item.conversationId !== conversationId)
    selectedConversationIds.value = selectedConversationIds.value.filter((id) => id !== conversationId)
  } catch (error) {
    alert(extractAdminErrorMessage(error, '删除对话日志失败'))
  } finally {
    deletingConversationId.value = null
  }
}

const handleBatchDeleteConversations = async () => {
  if (selectedConversationIds.value.length === 0) return
  const total = selectedConversationIds.value.length
  const confirmed = window.confirm(`确定批量删除 ${total} 个会话的全部日志吗？\n该操作不可撤销。`)
  if (!confirmed) return

  batchDeleting.value = true
  try {
    const ids = [...selectedConversationIds.value]
    await batchDeleteConversationLogs(ids)
    const toDelete = new Set(ids)
    questions.value = questions.value.filter((item) => !toDelete.has(item.conversationId))
    selectedConversationIds.value = []
  } catch (error) {
    alert(extractAdminErrorMessage(error, '批量删除对话日志失败'))
  } finally {
    batchDeleting.value = false
  }
}

onMounted(() => {
  fetchQuestions()
})
</script>
