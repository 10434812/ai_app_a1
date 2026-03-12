<script setup lang="ts">
import {ref, onMounted, computed, watch} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import {API_BASE_URL} from '../constants/config'
import {useAuthStore} from '../stores/auth'
import UserDropdown from './UserDropdown.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'new-chat'): void
}>()

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

interface Conversation {
  id: string
  title: string
  updatedAt: string
  isFavorite: boolean
  isArchived: boolean
  modelIds: string[]
}

const conversations = ref<Conversation[]>([])
const loading = ref(false)
const editingId = ref<string | null>(null)
const editTitle = ref('')
const searchQuery = ref('')
const filterMode = ref<'all' | 'favorites' | 'archived'>('all')
const modelFilter = ref('all')
const dateFilter = ref<'all' | 'today' | '7d' | '30d'>('all')
const selectionMode = ref(false)
const selectedConversationIds = ref<string[]>([])
const sidebarNotice = ref('')
const sidebarNoticeTimer = ref<number | undefined>(undefined)

const sortConversations = (list: Conversation[]) =>
  [...list].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return Number(a.isArchived) - Number(b.isArchived)
    if (a.isFavorite !== b.isFavorite) return Number(b.isFavorite) - Number(a.isFavorite)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

function showSidebarNotice(message: string) {
  sidebarNotice.value = message
  window.clearTimeout(sidebarNoticeTimer.value)
  sidebarNoticeTimer.value = window.setTimeout(() => {
    sidebarNotice.value = ''
  }, 2200)
}

async function fetchHistory() {
  if (!authStore.isAuthenticated || !authStore.token) {
    conversations.value = []
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/history`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
    })
    if (res.ok) {
      conversations.value = sortConversations(await res.json())
      selectedConversationIds.value = selectedConversationIds.value.filter((id) =>
        conversations.value.some((conv) => conv.id === id),
      )
      return
    }

    if (res.status === 401 || res.status === 403) {
      conversations.value = []
      authStore.clearAuth()
    }
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const searchedConversations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let list = conversations.value

  if (modelFilter.value !== 'all') {
    list = list.filter((conv) => conv.modelIds.includes(modelFilter.value))
  }

  if (dateFilter.value !== 'all') {
    const now = Date.now()
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()
    const sevenDaysAgo = now - 86400000 * 7
    const thirtyDaysAgo = now - 86400000 * 30
    list = list.filter((conv) => {
      const time = new Date(conv.updatedAt).getTime()
      if (dateFilter.value === 'today') return time >= todayStart
      if (dateFilter.value === '7d') return time >= sevenDaysAgo
      if (dateFilter.value === '30d') return time >= thirtyDaysAgo
      return true
    })
  }

  if (!query) return list

  return list.filter((conv) => {
    const modelText = conv.modelIds.join(' ').toLowerCase()
    return conv.title.toLowerCase().includes(query) || modelText.includes(query)
  })
})

const availableModelFilters = computed(() => {
  const ids = Array.from(new Set(conversations.value.flatMap((conv) => conv.modelIds || [])))
  return ids.sort((a, b) => a.localeCompare(b))
})

const favoriteConversations = computed(() => searchedConversations.value.filter((conv) => conv.isFavorite && !conv.isArchived))

const archivedConversations = computed(() => searchedConversations.value.filter((conv) => conv.isArchived))

const currentListConversations = computed(() => {
  if (filterMode.value === 'favorites') {
    return favoriteConversations.value
  }
  if (filterMode.value === 'archived') {
    return archivedConversations.value
  }
  return searchedConversations.value.filter((conv) => !conv.isFavorite && !conv.isArchived)
})

const visibleConversations = computed(() => {
  if (filterMode.value === 'all') {
    const ids = new Set<string>()
    return [...favoriteConversations.value, ...currentListConversations.value].filter((conv) => {
      if (ids.has(conv.id)) return false
      ids.add(conv.id)
      return true
    })
  }
  return currentListConversations.value
})

const groupedConversations = computed(() => {
  const groups: Record<string, Conversation[]> = {
    今天: [],
    昨天: [],
    过去7天: [],
    更早: [],
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const lastWeek = today - 86400000 * 7

  currentListConversations.value.forEach((conv) => {
      const time = new Date(conv.updatedAt).getTime()
      if (time >= today) {
        groups['今天'].push(conv)
      } else if (time >= yesterday) {
        groups['昨天'].push(conv)
      } else if (time >= lastWeek) {
        groups['过去7天'].push(conv)
      } else {
        groups['更早'].push(conv)
      }
    })

  return groups
})

const hasAnyConversation = computed(() => {
  if (filterMode.value === 'all') {
    return favoriteConversations.value.length > 0 || currentListConversations.value.length > 0
  }
  return currentListConversations.value.length > 0
})

async function selectChat(id: string) {
  router.push({query: {id}})
  if (window.innerWidth < 1024) {
    emit('close')
  }
}

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    selectedConversationIds.value = []
  }
}

function isSelected(id: string) {
  return selectedConversationIds.value.includes(id)
}

function toggleSelection(id: string) {
  if (isSelected(id)) {
    selectedConversationIds.value = selectedConversationIds.value.filter((item) => item !== id)
    return
  }
  selectedConversationIds.value = [...selectedConversationIds.value, id]
}

function handleConversationClick(conv: Conversation) {
  if (selectionMode.value) {
    toggleSelection(conv.id)
    return
  }
  selectChat(conv.id)
}

function toggleSelectAllVisible() {
  const visibleIds = visibleConversations.value.map((conv) => conv.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedConversationIds.value.includes(id))
  selectedConversationIds.value = allSelected ? [] : visibleIds
}

function handleMenuClick() {
  if (window.innerWidth < 1024) {
    emit('close')
  }
}

async function deleteChat(id: string, event: Event) {
  event.stopPropagation()
  if (!confirm('确定要删除这条对话吗？')) return

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/${id}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${authStore.token}`},
    })
    if (res.ok) {
      conversations.value = conversations.value.filter((c) => c.id !== id)
      showSidebarNotice('对话已删除')
      if (route.query.id === id) {
        emit('new-chat')
      }
    }
  } catch (err) {
    console.error(err)
  }
}

async function runBatchDelete() {
  if (selectedConversationIds.value.length === 0) return
  if (!confirm(`确定要删除选中的 ${selectedConversationIds.value.length} 条对话吗？`)) return

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/batch-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({conversationIds: selectedConversationIds.value}),
    })

    if (res.ok) {
      const data = await res.json()
      const affectedIds: string[] = data.affectedIds || selectedConversationIds.value
      conversations.value = conversations.value.filter((conv) => !affectedIds.includes(conv.id))
      if (route.query.id && affectedIds.includes(String(route.query.id))) {
        emit('new-chat')
      }
      showSidebarNotice(`已删除 ${affectedIds.length} 条对话`)
      selectedConversationIds.value = []
      selectionMode.value = false
    }
  } catch (err) {
    console.error(err)
  }
}

function startEdit(conv: Conversation, event: Event) {
  event.stopPropagation()
  editingId.value = conv.id
  editTitle.value = conv.title
}

async function saveEdit(conv: Conversation) {
  if (!editTitle.value.trim()) {
    editingId.value = null
    return
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/${conv.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({title: editTitle.value}),
    })

    if (res.ok) {
      conv.title = editTitle.value
      showSidebarNotice('标题已更新')
    }
  } catch (err) {
    console.error(err)
  } finally {
    editingId.value = null
  }
}

async function toggleFavorite(conv: Conversation, event: Event) {
  event.stopPropagation()
  const nextFavorite = !conv.isFavorite

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/${conv.id}/favorite`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({isFavorite: nextFavorite}),
    })

    if (res.ok) {
      conv.isFavorite = nextFavorite
      showSidebarNotice(nextFavorite ? '已收藏该对话' : '已取消收藏')
      conversations.value = sortConversations(conversations.value)
    }
  } catch (err) {
    console.error(err)
  }
}

async function toggleArchive(conv: Conversation, event: Event) {
  event.stopPropagation()
  const nextArchived = !conv.isArchived

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/${conv.id}/archive`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({isArchived: nextArchived}),
    })

    if (res.ok) {
      conv.isArchived = nextArchived
      if (nextArchived) {
        conv.isFavorite = false
      }
      showSidebarNotice(nextArchived ? '已归档该对话' : '已恢复到历史列表')
      conversations.value = sortConversations(conversations.value)
      if (route.query.id === conv.id && nextArchived && filterMode.value !== 'archived') {
        emit('new-chat')
      }
    }
  } catch (err) {
    console.error(err)
  }
}

async function runBatchArchive(isArchived: boolean) {
  if (selectedConversationIds.value.length === 0) return

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/batch/archive`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        conversationIds: selectedConversationIds.value,
        isArchived,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const affectedIds: string[] = data.affectedIds || selectedConversationIds.value
      conversations.value = sortConversations(
        conversations.value.map((conv) =>
          affectedIds.includes(conv.id)
            ? {
                ...conv,
                isArchived,
                isFavorite: isArchived ? false : conv.isFavorite,
              }
            : conv,
        ),
      )
      if (isArchived && route.query.id && affectedIds.includes(String(route.query.id)) && filterMode.value !== 'archived') {
        emit('new-chat')
      }
      showSidebarNotice(isArchived ? `已归档 ${affectedIds.length} 条对话` : `已恢复 ${affectedIds.length} 条对话`)
      selectedConversationIds.value = []
      selectionMode.value = false
    }
  } catch (err) {
    console.error(err)
  }
}

onMounted(() => {
  fetchHistory()
})

watch(
  () => route.fullPath,
  () => {
    if (window.innerWidth < 1024 && props.isOpen) {
      emit('close')
    }
  },
)

watch([filterMode, modelFilter, dateFilter, searchQuery], () => {
  selectedConversationIds.value = []
})

defineExpose({refresh: fetchHistory})
</script>

<template>
  <div :class="['fixed inset-y-0 left-0 z-[60] w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0', isOpen ? 'translate-x-0' : '-translate-x-full']">
    <div class="h-full flex flex-col">
      <div class="p-4 space-y-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/90">
        <button @click="$emit('new-chat')" class="w-full flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all group">
          <div class="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          </div>
          <span class="font-bold text-sm">新对话</span>
        </button>

        <div class="relative">
          <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索历史对话..."
            class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
          >
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="filterMode = 'all'"
            :class="[
              'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
              filterMode === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
            ]">
            全部
          </button>
          <button
            @click="filterMode = 'favorites'"
            :class="[
              'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
              filterMode === 'favorites'
                ? 'bg-amber-500 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
            ]">
            收藏
          </button>
          <button
            @click="filterMode = 'archived'"
            :class="[
              'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
              filterMode === 'archived'
                ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
            ]">
            归档
          </button>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-800/80">
          <div class="flex items-center gap-2">
            <button
              @click="toggleSelectionMode"
              :class="[
                'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
                selectionMode
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
              ]">
              {{ selectionMode ? '退出批量' : '批量管理' }}
            </button>
            <button
              v-if="selectionMode"
              @click="toggleSelectAllVisible"
              class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300">
              {{ visibleConversations.length > 0 && visibleConversations.every((conv) => selectedConversationIds.includes(conv.id)) ? '取消全选' : '全选当前' }}
            </button>
          </div>

          <div v-if="selectionMode" class="mt-2 space-y-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-900/60">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-slate-500 dark:text-slate-300">已选 {{ selectedConversationIds.length }} 条</span>
              <button
                @click="selectedConversationIds = []"
                class="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200">
                清空
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-if="filterMode !== 'archived'"
                @click="runBatchArchive(true)"
                :disabled="selectedConversationIds.length === 0"
                class="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900 dark:enabled:hover:bg-white">
                批量归档
              </button>
              <button
                v-if="filterMode === 'archived'"
                @click="runBatchArchive(false)"
                :disabled="selectedConversationIds.length === 0"
                class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition enabled:hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">
                批量恢复
              </button>
              <button
                @click="runBatchDelete"
                :disabled="selectedConversationIds.length === 0"
                class="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition enabled:hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40">
                批量删除
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <select
            v-model="modelFilter"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <option value="all">全部模型</option>
            <option v-for="modelId in availableModelFilters" :key="modelId" :value="modelId">
              {{ modelId }}
            </option>
          </select>

          <select
            v-model="dateFilter"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <option value="all">全部时间</option>
            <option value="today">今天</option>
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
          </select>
        </div>

        <div v-if="sidebarNotice" class="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {{ sidebarNotice }}
        </div>

        <div class="grid grid-cols-2 gap-2">
          <router-link
            to="/membership"
            @click="handleMenuClick"
            active-class="bg-indigo-50/80 border-indigo-200 text-indigo-700 shadow-sm"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 border border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200 group">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span class="truncate">会员</span>
          </router-link>

          <router-link
            to="/token-usage"
            @click="handleMenuClick"
            active-class="bg-indigo-50/80 border-indigo-200 text-indigo-700 shadow-sm"
            class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 border border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200 group">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span class="truncate">Token</span>
          </router-link>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
        <div v-if="loading" class="space-y-2 px-1">
          <div v-for="idx in 6" :key="idx" class="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
        </div>

        <template v-else>
          <div v-if="filterMode === 'all' && favoriteConversations.length > 0" class="mb-6">
            <div class="mb-2 flex items-center justify-between px-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-amber-500">收藏</h3>
              <span class="text-[11px] text-slate-400">{{ favoriteConversations.length }} 条</span>
            </div>
            <div class="space-y-1.5">
              <div
                v-for="conv in favoriteConversations"
                :key="`favorite-${conv.id}`"
                @click="handleConversationClick(conv)"
                :class="[
                  'group flex items-center gap-3 rounded-2xl px-3 py-3 cursor-pointer transition-all text-sm border',
                  route.query.id === conv.id
                    ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700/50 dark:text-amber-300'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-amber-200 hover:bg-amber-50/60 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/90',
                ]">
                <button
                  v-if="selectionMode"
                  @click.stop="toggleSelection(conv.id)"
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition"
                  :class="isSelected(conv.id) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-800'">
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                  <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="m9.049 2.927.951 1.928 2.13.31-1.54 1.5.364 2.121L10 7.764 8.096 8.786l.364-2.121-1.54-1.5 2.13-.31.95-1.928Z" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <input
                    v-if="editingId === conv.id"
                    v-model="editTitle"
                    @click.stop
                    @keydown.enter="saveEdit(conv)"
                    @blur="saveEdit(conv)"
                    class="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none dark:border-amber-700 dark:bg-slate-900 dark:text-slate-200"
                    autofocus
                  />
                    <template v-else>
                      <div class="truncate font-medium">{{ conv.title }}</div>
                      <div class="mt-1 text-[11px] text-slate-400">{{ new Date(conv.updatedAt).toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'}) }}</div>
                      <div v-if="conv.modelIds?.length" class="mt-1 flex flex-wrap gap-1">
                        <span
                          v-for="modelId in conv.modelIds.slice(0, 2)"
                          :key="modelId"
                          class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {{ modelId }}
                        </span>
                        <span v-if="conv.modelIds.length > 2" class="text-[10px] text-slate-400">+{{ conv.modelIds.length - 2 }}</span>
                      </div>
                    </template>
                  </div>
                <div v-if="editingId !== conv.id && !selectionMode" class="hidden items-center gap-1 group-hover:flex">
                  <button @click="toggleFavorite(conv, $event)" class="rounded p-1 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30" title="取消收藏">
                    <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="m9.049 2.927.951 1.928 2.13.31-1.54 1.5.364 2.121L10 7.764 8.096 8.786l.364-2.121-1.54-1.5 2.13-.31.95-1.928Z" /></svg>
                  </button>
                  <button @click="toggleArchive(conv, $event)" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700" title="归档对话">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8l1 11h12l1-11M9 8V5a1 1 0 011-1h4a1 1 0 011 1v3" />
                    </svg>
                  </button>
                  <button @click="startEdit(conv, $event)" class="p-1 hover:text-indigo-500 rounded">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-for="(list, group) in groupedConversations" :key="group">
            <div v-if="list.length > 0" class="mb-6">
              <div class="mb-2 flex items-center justify-between px-2">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">{{ group }}</h3>
                <span class="text-[11px] text-slate-400">{{ list.length }} 条</span>
              </div>
              <div class="space-y-1.5">
                <div
                  v-for="conv in list"
                  :key="conv.id"
                  @click="handleConversationClick(conv)"
                  :class="[
                    'group flex items-center gap-3 rounded-2xl px-3 py-3 cursor-pointer transition-all text-sm border',
                    route.query.id === conv.id
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700/50 dark:text-indigo-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/90',
                  ]">
                  <button
                    v-if="selectionMode"
                    @click.stop="toggleSelection(conv.id)"
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition"
                    :class="isSelected(conv.id) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-800'">
                    <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </div>

                  <div class="min-w-0 flex-1">
                    <input
                      v-if="editingId === conv.id"
                      v-model="editTitle"
                      @click.stop
                      @keydown.enter="saveEdit(conv)"
                      @blur="saveEdit(conv)"
                      class="w-full rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-slate-200"
                      autofocus
                    />
                    <template v-else>
                      <div class="truncate font-medium">{{ conv.title }}</div>
                      <div class="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{{ new Date(conv.updatedAt).toLocaleString('zh-CN', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'}) }}</span>
                        <span v-if="conv.isFavorite" class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">已收藏</span>
                        <span v-if="conv.isArchived" class="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">已归档</span>
                      </div>
                      <div v-if="conv.modelIds?.length" class="mt-1 flex flex-wrap gap-1">
                        <span
                          v-for="modelId in conv.modelIds.slice(0, 2)"
                          :key="modelId"
                          class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          {{ modelId }}
                        </span>
                        <span v-if="conv.modelIds.length > 2" class="text-[10px] text-slate-400">+{{ conv.modelIds.length - 2 }}</span>
                      </div>
                    </template>
                  </div>

                  <div v-if="editingId !== conv.id && !selectionMode" class="hidden group-hover:flex items-center gap-1">
                    <button
                      v-if="!conv.isArchived"
                      @click="toggleFavorite(conv, $event)"
                      class="p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30"
                      :class="conv.isFavorite ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'"
                      :title="conv.isFavorite ? '取消收藏' : '收藏对话'">
                      <svg class="h-3.5 w-3.5" :fill="conv.isFavorite ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 20 20">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m9.049 2.927.951 1.928 2.13.31-1.54 1.5.364 2.121L10 7.764 8.096 8.786l.364-2.121-1.54-1.5 2.13-.31.95-1.928Z" />
                      </svg>
                    </button>
                    <button
                      @click="toggleArchive(conv, $event)"
                      class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                      :class="conv.isArchived ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-400 hover:text-slate-600'"
                      :title="conv.isArchived ? '恢复对话' : '归档对话'">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8l1 11h12l1-11M9 8V5a1 1 0 011-1h4a1 1 0 011 1v3" />
                      </svg>
                    </button>
                    <button @click="startEdit(conv, $event)" class="p-1 hover:text-indigo-500 rounded">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button @click="deleteChat(conv.id, $event)" class="p-1 hover:text-rose-500 rounded">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!hasAnyConversation" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-500">
            {{ searchQuery ? '没有找到匹配的历史对话' : filterMode === 'favorites' ? '还没有收藏的对话' : filterMode === 'archived' ? '还没有归档的对话' : '暂无历史对话' }}
          </div>
        </template>
      </div>

      <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm mt-auto">
        <UserDropdown placement="top" />
      </div>
    </div>
  </div>

  <div v-if="isOpen" @click="$emit('close')" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[55] lg:hidden"></div>
</template>
