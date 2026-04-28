<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {PROMPTS, PROMPT_CATEGORY_META, type Prompt} from '../constants/prompts'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', content: string): void
}>()

type PromptRecord = Prompt & {
  isCustom?: boolean
  createdAt?: string
}

const activeCategory = ref('全部')
const searchQuery = ref('')
const usageMap = ref<Record<string, number>>({})
const recentPromptIds = ref<string[]>([])
const favoritePromptIds = ref<string[]>([])
const customPrompts = ref<PromptRecord[]>([])
const showCreateForm = ref(false)
const editingPromptId = ref<string | null>(null)
const customPromptForm = ref({
  title: '',
  description: '',
  content: '',
  category: '写作',
  tags: '',
})
const formError = ref('')
const dialogTitleId = 'prompt-market-title'

const PROMPT_USAGE_KEY = 'prompt_market_usage'
const PROMPT_RECENT_KEY = 'prompt_market_recent'
const PROMPT_FAVORITE_KEY = 'prompt_market_favorites'
const PROMPT_CUSTOM_KEY = 'prompt_market_custom'

const allPrompts = computed<PromptRecord[]>(() => [...customPrompts.value, ...PROMPTS])

const categoryOptions = computed(() => {
  const categories = Array.from(new Set(allPrompts.value.map((prompt) => prompt.category))).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return ['全部', ...categories]
})

const filteredPrompts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return allPrompts.value
    .filter((prompt) => {
      const matchesCategory = activeCategory.value === '全部' || prompt.category === activeCategory.value
      if (!matchesCategory) return false
      if (!query) return true

      const haystack = [prompt.title, prompt.description, prompt.content, prompt.category, ...prompt.tags]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
    .sort((a, b) => {
      if (a.isCustom !== b.isCustom) return Number(!!b.isCustom) - Number(!!a.isCustom)
      const favoriteDelta = Number(favoritePromptIds.value.includes(b.id)) - Number(favoritePromptIds.value.includes(a.id))
      if (favoriteDelta !== 0) return favoriteDelta
      const usageDelta = (usageMap.value[b.id] || 0) - (usageMap.value[a.id] || 0)
      if (usageDelta !== 0) return usageDelta
      if (a.createdAt || b.createdAt) {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      }
      return Number(!!b.featured) - Number(!!a.featured)
    })
})

const featuredPrompts = computed(() => PROMPTS.filter((prompt) => prompt.featured).slice(0, 4))

const favoritePrompts = computed(() => {
  return favoritePromptIds.value
    .map((id) => allPrompts.value.find((prompt) => prompt.id === id))
    .filter(Boolean) as PromptRecord[]
})

const myPrompts = computed(() => {
  return [...customPrompts.value].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  )
})

const frequentlyUsedPrompts = computed(() => {
  return allPrompts.value
    .filter((prompt) => usageMap.value[prompt.id] > 0)
    .sort((a, b) => (usageMap.value[b.id] || 0) - (usageMap.value[a.id] || 0))
    .slice(0, 4)
})

const recentPrompts = computed(() => {
  return recentPromptIds.value
    .map((id) => allPrompts.value.find((prompt) => prompt.id === id))
    .filter(Boolean) as PromptRecord[]
})

const totalUseCount = computed(() => Object.values(usageMap.value).reduce((sum, count) => sum + count, 0))

const promptStats = computed(() => {
  return [
    {label: '模板总数', value: String(allPrompts.value.length).padStart(2, '0')},
    {label: '已收藏', value: String(favoritePromptIds.value.length).padStart(2, '0')},
    {label: '我的模板', value: String(myPrompts.value.length).padStart(2, '0')},
    {label: '累计使用', value: String(totalUseCount.value).padStart(2, '0')},
  ]
})

const mobileSummary = computed(() => {
  const summaryParts = []
  summaryParts.push(`${allPrompts.value.length} 个模板`)
  if (favoritePromptIds.value.length) summaryParts.push(`${favoritePromptIds.value.length} 个收藏`)
  if (myPrompts.value.length) summaryParts.push(`${myPrompts.value.length} 个我的模板`)
  return summaryParts.join(' · ')
})

function lockBodyScroll(locked: boolean) {
  if (typeof document === 'undefined') return
  document.body.style.overflow = locked ? 'hidden' : ''
}

function getPromptById(id: string) {
  return allPrompts.value.find((prompt) => prompt.id === id)
}

function loadPromptAssets() {
  try {
    usageMap.value = JSON.parse(localStorage.getItem(PROMPT_USAGE_KEY) || '{}')
    recentPromptIds.value = JSON.parse(localStorage.getItem(PROMPT_RECENT_KEY) || '[]')
    favoritePromptIds.value = JSON.parse(localStorage.getItem(PROMPT_FAVORITE_KEY) || '[]')
    customPrompts.value = JSON.parse(localStorage.getItem(PROMPT_CUSTOM_KEY) || '[]')
  } catch (error) {
    console.error('Failed to load prompt assets:', error)
    usageMap.value = {}
    recentPromptIds.value = []
    favoritePromptIds.value = []
    customPrompts.value = []
  }

  favoritePromptIds.value = favoritePromptIds.value.filter((id) => !!getPromptById(id))
  recentPromptIds.value = recentPromptIds.value.filter((id) => !!getPromptById(id))
}

function persistPromptAssets() {
  localStorage.setItem(PROMPT_USAGE_KEY, JSON.stringify(usageMap.value))
  localStorage.setItem(PROMPT_RECENT_KEY, JSON.stringify(recentPromptIds.value))
  localStorage.setItem(PROMPT_FAVORITE_KEY, JSON.stringify(favoritePromptIds.value))
  localStorage.setItem(PROMPT_CUSTOM_KEY, JSON.stringify(customPrompts.value))
}

function markPromptUsed(prompt: PromptRecord) {
  usageMap.value = {
    ...usageMap.value,
    [prompt.id]: (usageMap.value[prompt.id] || 0) + 1,
  }
  recentPromptIds.value = [prompt.id, ...recentPromptIds.value.filter((id) => id !== prompt.id)].slice(0, 8)
  persistPromptAssets()
}

function selectPrompt(prompt: PromptRecord) {
  markPromptUsed(prompt)
  emit('select', prompt.content)
  emit('close')
}

function isFavorite(promptId: string) {
  return favoritePromptIds.value.includes(promptId)
}

function toggleFavorite(prompt: PromptRecord, event?: Event) {
  event?.stopPropagation()
  favoritePromptIds.value = isFavorite(prompt.id)
    ? favoritePromptIds.value.filter((id) => id !== prompt.id)
    : [prompt.id, ...favoritePromptIds.value.filter((id) => id !== prompt.id)]
  persistPromptAssets()
}

function openCreateForm() {
  formError.value = ''
  editingPromptId.value = null
  showCreateForm.value = true
}

function openEditForm(prompt: PromptRecord, event?: Event) {
  event?.stopPropagation()
  editingPromptId.value = prompt.id
  customPromptForm.value = {
    title: prompt.title,
    description: prompt.description,
    content: prompt.content,
    category: prompt.category,
    tags: prompt.tags.join(', '),
  }
  formError.value = ''
  showCreateForm.value = true
}

function resetCreateForm() {
  editingPromptId.value = null
  customPromptForm.value = {
    title: '',
    description: '',
    content: '',
    category: '写作',
    tags: '',
  }
  formError.value = ''
}

function closeCreateForm() {
  showCreateForm.value = false
  resetCreateForm()
}

function buildPromptId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom-${crypto.randomUUID()}`
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createCustomPrompt() {
  const title = customPromptForm.value.title.trim()
  const description = customPromptForm.value.description.trim()
  const content = customPromptForm.value.content.trim()
  const category = customPromptForm.value.category.trim() || '写作'
  const tags = customPromptForm.value.tags
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6)

  if (!title || !description || !content) {
    formError.value = '标题、描述和内容都不能为空'
    return
  }

  if (editingPromptId.value) {
    customPrompts.value = customPrompts.value.map((prompt) =>
      prompt.id === editingPromptId.value
        ? {
            ...prompt,
            title,
            description,
            content,
            category,
            tags,
          }
        : prompt,
    )
  } else {
    const prompt: PromptRecord = {
      id: buildPromptId(),
      title,
      description,
      content,
      category,
      tags,
      isCustom: true,
      createdAt: new Date().toISOString(),
    }

    customPrompts.value = [prompt, ...customPrompts.value]
    favoritePromptIds.value = [prompt.id, ...favoritePromptIds.value]
  }
  persistPromptAssets()
  closeCreateForm()
}

function removeCustomPrompt(prompt: PromptRecord, event?: Event) {
  event?.stopPropagation()
  customPrompts.value = customPrompts.value.filter((item) => item.id !== prompt.id)
  favoritePromptIds.value = favoritePromptIds.value.filter((id) => id !== prompt.id)
  recentPromptIds.value = recentPromptIds.value.filter((id) => id !== prompt.id)
  const nextUsageMap = {...usageMap.value}
  delete nextUsageMap[prompt.id]
  usageMap.value = nextUsageMap
  persistPromptAssets()
}

function resetFilters() {
  activeCategory.value = '全部'
  searchQuery.value = ''
}

function getCategoryMeta(category: string) {
  return PROMPT_CATEGORY_META[category] || PROMPT_CATEGORY_META['全部']
}

onMounted(() => {
  loadPromptAssets()
})

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      loadPromptAssets()
      lockBodyScroll(true)
    } else {
      resetFilters()
      closeCreateForm()
      lockBodyScroll(false)
    }
  },
)

onBeforeUnmount(() => {
  lockBodyScroll(false)
})
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="dialogTitleId">
    <div class="absolute inset-0 bg-slate-900/28" @click="$emit('close')"></div>

    <div class="relative z-10 flex h-[min(92vh,980px)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-slate-800 shadow-[0_20px_48px_rgba(15,23,42,0.14)] overscroll-contain">
      <div class="relative border-b border-slate-200 bg-white">
        <div class="relative grid gap-3 px-5 py-3 sm:px-7 sm:py-5 lg:grid-cols-[minmax(0,1.5fr)_320px]">
          <div class="space-y-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="space-y-1.5">
                <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
                  模板库
                </div>
                <div>
                  <h2 :id="dialogTitleId" class="text-[1.9rem] font-black tracking-tight text-slate-900 sm:text-[2rem]">提示词市场</h2>
                  <p class="mt-2 hidden max-w-2xl text-sm leading-6 text-slate-600 sm:block sm:text-[15px]">
                    官方模板负责覆盖高频场景，你自己的模板负责沉淀复用。先收藏，再抽成自己的资产库。
                  </p>
                  <p class="mt-2 text-sm text-slate-500 sm:hidden">{{ mobileSummary }}</p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                <button
                  @click="openCreateForm"
                  type="button"
                  aria-label="新建提示词模板"
                  class="whitespace-nowrap rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100">
                  新建模板
                </button>
                <button
                  @click="$emit('close')"
                  type="button"
                  aria-label="关闭提示词市场"
                  class="shrink-0 rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-4">
              <div
                v-for="item in promptStats"
                :key="item.label"
                class="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:block">
                <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400">{{ item.label }}</div>
                <div class="mt-2 text-2xl font-black text-slate-900">{{ item.value }}</div>
              </div>
            </div>
          </div>

          <div class="hidden rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4 lg:block">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs uppercase tracking-[0.22em] text-slate-400">当前分类</div>
                <div class="mt-1 text-lg font-bold text-slate-900">{{ activeCategory }}</div>
              </div>
              <div class="h-12 w-12 rounded-2xl border border-slate-200 bg-white"></div>
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-600">{{ getCategoryMeta(activeCategory).desc }}</p>
            <div class="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              <div class="font-semibold text-slate-900">本轮新增</div>
              <div class="mt-2 space-y-1 text-xs leading-5 text-slate-500">
                <div>1. 模板可收藏，优先沉淀高频场景</div>
                <div>2. 支持自建“我的模板”，直接插入对话框</div>
              </div>
            </div>
            <button
              v-if="activeCategory !== '全部' || searchQuery"
              @click="resetFilters"
              type="button"
              class="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600">
              重置筛选
            </button>
          </div>
        </div>
      </div>

      <div class="border-b border-slate-200 bg-white px-5 py-3 sm:px-7 sm:py-4">
        <div class="flex flex-col gap-3">
          <div class="relative">
            <svg class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              aria-label="搜索提示词模板"
              placeholder="搜索模板标题、描述、标签，例如：周报 / 面试 / 调试"
              class="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]"
            >
          </div>

          <div class="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              v-for="category in categoryOptions"
              :key="category"
              @click="activeCategory = category"
              type="button"
              :aria-pressed="activeCategory === category"
              :class="[
                'shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
                activeCategory === category
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/60 hover:text-indigo-600',
              ]">
              {{ category }}
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-5 py-4 sm:px-7 sm:py-5 custom-scrollbar">
        <div class="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[11px] uppercase tracking-[0.22em] text-slate-400">当前分类</div>
              <div class="mt-1 flex items-center gap-2">
                <div class="text-base font-bold text-slate-900">{{ activeCategory }}</div>
                <div class="truncate text-sm text-slate-500">{{ getCategoryMeta(activeCategory).desc }}</div>
              </div>
            </div>
            <button
              v-if="activeCategory !== '全部' || searchQuery"
              @click="resetFilters"
              type="button"
              class="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600">
              重置
            </button>
          </div>
        </div>

        <div v-if="!searchQuery && activeCategory === '全部'" class="space-y-6">
          <section class="space-y-3">
            <div class="flex items-end justify-between gap-4">
              <div>
                <div class="text-xs uppercase tracking-[0.22em] text-slate-400">精选模板</div>
                <h3 class="mt-1 text-xl font-black text-slate-900">先用高频场景把效率拉起来</h3>
              </div>
              <div class="text-xs text-slate-500">点击卡片直接插入</div>
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
              <div
                v-for="prompt in featuredPrompts"
                :key="prompt.id"
                class="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left transition hover:border-indigo-200">
                <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80" :class="getCategoryMeta(prompt.category).accent"></div>
                <div class="flex items-start justify-between gap-3">
                  <button type="button" @click="selectPrompt(prompt)" class="min-w-0 flex-1 text-left">
                    <div class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {{ prompt.category }}
                    </div>
                    <h4 class="mt-3 text-lg font-bold text-slate-900">{{ prompt.title }}</h4>
                    <p class="mt-2 text-sm leading-6 text-slate-600">{{ prompt.description }}</p>
                  </button>
                  <button
                    type="button"
                    @click="toggleFavorite(prompt, $event)"
                    :aria-label="isFavorite(prompt.id) ? `取消收藏 ${prompt.title}` : `收藏 ${prompt.title}`"
                    :aria-pressed="isFavorite(prompt.id)"
                    class="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-500"
                    :class="isFavorite(prompt.id) ? 'border-amber-200 bg-amber-50 text-amber-500' : ''">
                    <svg class="h-4 w-4" :fill="isFavorite(prompt.id) ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 20 20">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m9.049 2.927.951 1.928 2.13.31-1.54 1.5.364 2.121L10 7.764 8.096 8.786l.364-2.121-1.54-1.5 2.13-.31.95-1.928Z" />
                    </svg>
                  </button>
                </div>
                <button type="button" @click="selectPrompt(prompt)" class="mt-4 block w-full text-left">
                  <div class="line-clamp-4 text-sm leading-6 text-slate-500">{{ prompt.content }}</div>
                </button>
                <div class="mt-4 flex flex-wrap gap-2">
                  <span v-for="tag in prompt.tags" :key="tag" class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section v-if="favoritePrompts.length || myPrompts.length" class="grid gap-4 lg:grid-cols-2">
            <div v-if="favoritePrompts.length" class="rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-xs uppercase tracking-[0.22em] text-slate-400">收藏模板</div>
                  <h3 class="mt-1 text-lg font-bold text-slate-900">你常驻使用的模版库</h3>
                </div>
                <div class="text-xs text-slate-500">{{ favoritePrompts.length }} 项</div>
              </div>
              <div class="mt-4 space-y-3">
                <div
                  v-for="prompt in favoritePrompts.slice(0, 4)"
                  :key="prompt.id"
                  class="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-white">
                  <button type="button" @click="selectPrompt(prompt)" class="min-w-0 flex-1 text-left">
                    <div class="flex items-center gap-2">
                      <div class="font-semibold text-slate-900">{{ prompt.title }}</div>
                      <span v-if="prompt.isCustom" class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">我的</span>
                    </div>
                    <div class="mt-1 truncate text-sm text-slate-500">{{ prompt.description }}</div>
                  </button>
                  <button
                    type="button"
                    @click="toggleFavorite(prompt, $event)"
                    :aria-label="`取消收藏 ${prompt.title}`"
                    aria-pressed="true"
                    class="rounded-full border border-amber-200 bg-amber-50 p-2 text-amber-500">
                    <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="m9.049 2.927.951 1.928 2.13.31-1.54 1.5.364 2.121L10 7.764 8.096 8.786l.364-2.121-1.54-1.5 2.13-.31.95-1.928Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div class="rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-xs uppercase tracking-[0.22em] text-slate-400">我的模板</div>
                  <h3 class="mt-1 text-lg font-bold text-slate-900">你自己沉淀的专属提示词</h3>
                </div>
                <button type="button" @click="openCreateForm" aria-label="新建我的模板" class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600">
                  新建
                </button>
              </div>
              <div v-if="myPrompts.length" class="mt-4 space-y-3">
                <div
                  v-for="prompt in myPrompts.slice(0, 4)"
                  :key="prompt.id"
                  class="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-white">
                  <button type="button" @click="selectPrompt(prompt)" class="min-w-0 flex-1 text-left">
                    <div class="font-semibold text-slate-900">{{ prompt.title }}</div>
                    <div class="mt-1 truncate text-sm text-slate-500">{{ prompt.description }}</div>
                  </button>
                  <div class="flex items-center gap-2">
                    <button type="button" @click="openEditForm(prompt, $event)" :aria-label="`编辑 ${prompt.title}`" class="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-indigo-200 hover:text-indigo-500">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button type="button" @click="removeCustomPrompt(prompt, $event)" :aria-label="`删除 ${prompt.title}`" class="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:border-rose-200 hover:text-rose-500">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-500">
                还没有自建模板，先把你最常复用的一条沉淀下来。
              </div>
            </div>
          </section>

          <section v-if="frequentlyUsedPrompts.length || recentPrompts.length" class="grid gap-4 lg:grid-cols-2">
            <div v-if="frequentlyUsedPrompts.length" class="rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs uppercase tracking-[0.22em] text-slate-400">常用模板</div>
                  <h3 class="mt-1 text-lg font-bold text-slate-900">你最常点的几项</h3>
                </div>
                <div class="text-xs text-slate-500">按使用次数排序</div>
              </div>
              <div class="mt-4 space-y-3">
                <button
                  v-for="prompt in frequentlyUsedPrompts"
                  :key="prompt.id"
                  @click="selectPrompt(prompt)"
                  class="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-white">
                  <div class="min-w-0">
                    <div class="font-semibold text-slate-900">{{ prompt.title }}</div>
                    <div class="mt-1 truncate text-sm text-slate-500">{{ prompt.description }}</div>
                  </div>
                  <div class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                    {{ usageMap[prompt.id] }} 次
                  </div>
                </button>
              </div>
            </div>

            <div v-if="recentPrompts.length" class="rounded-[1.75rem] border border-slate-200 bg-white p-4 sm:p-5">
              <div class="text-xs uppercase tracking-[0.22em] text-slate-400">最近使用</div>
              <h3 class="mt-1 text-lg font-bold text-slate-900">刚刚插入过的模板</h3>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  v-for="prompt in recentPrompts"
                  :key="prompt.id"
                  @click="selectPrompt(prompt)"
                  class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-indigo-200 hover:bg-white">
                  <div class="font-semibold text-slate-900">{{ prompt.title }}</div>
                  <div class="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{{ prompt.description }}</div>
                </button>
              </div>
            </div>
          </section>
        </div>

        <section class="space-y-3" :class="!searchQuery && activeCategory === '全部' ? 'mt-8' : 'mt-0'">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-xs uppercase tracking-[0.22em] text-slate-400">模板列表</div>
              <h3 class="mt-1 text-lg font-bold text-slate-900">{{ activeCategory === '全部' ? '全部模板' : `${activeCategory}模板` }}</h3>
            </div>
            <div class="text-sm text-slate-500">共 {{ filteredPrompts.length }} 项</div>
          </div>

          <div v-if="filteredPrompts.length === 0" class="rounded-[1.75rem] border border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
              <svg class="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />
              </svg>
            </div>
            <div class="mt-4 text-lg font-bold text-slate-900">没有找到匹配模板</div>
            <p class="mt-2 text-sm leading-6 text-slate-500">换个关键词，或者先点上方分类缩小范围。</p>
          </div>

          <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div
              v-for="prompt in filteredPrompts"
              :key="prompt.id"
              class="group flex h-full flex-col rounded-[1.6rem] border border-slate-200 bg-white p-5 text-left transition hover:border-indigo-200">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{{ prompt.category }}</span>
                    <span v-if="prompt.isCustom" class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">我的模板</span>
                    <span v-else-if="prompt.featured" class="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">精选</span>
                  </div>
                  <h4 class="mt-3 text-lg font-bold text-slate-900">{{ prompt.title }}</h4>
                  <p class="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{{ prompt.description }}</p>
                </div>
                <div class="flex flex-col items-end gap-2">
                  <div class="mt-1 h-10 w-10 shrink-0 rounded-2xl border border-slate-200 bg-slate-50"></div>
                  <button
                    @click="toggleFavorite(prompt, $event)"
                    type="button"
                    :aria-label="isFavorite(prompt.id) ? `取消收藏 ${prompt.title}` : `收藏 ${prompt.title}`"
                    :aria-pressed="isFavorite(prompt.id)"
                    class="rounded-full border border-slate-200 bg-white p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-500"
                    :class="isFavorite(prompt.id) ? 'border-amber-200 bg-amber-50 text-amber-500' : ''">
                    <svg class="h-4 w-4" :fill="isFavorite(prompt.id) ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 20 20">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m9.049 2.927.951 1.928 2.13.31-1.54 1.5.364 2.121L10 7.764 8.096 8.786l.364-2.121-1.54-1.5 2.13-.31.95-1.928Z" />
                    </svg>
                  </button>
                </div>
              </div>

              <button type="button" @click="selectPrompt(prompt)" class="mt-4 flex-1 text-left">
                <div class="line-clamp-5 text-sm leading-6 text-slate-500">{{ prompt.content }}</div>
              </button>

              <div class="mt-4 flex flex-wrap gap-2">
                <span v-for="tag in prompt.tags" :key="tag" class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">{{ tag }}</span>
              </div>

                <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div class="text-xs text-slate-400">已使用 {{ usageMap[prompt.id] || 0 }} 次</div>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="prompt.isCustom"
                      @click="openEditForm(prompt, $event)"
                      type="button"
                      :aria-label="`编辑 ${prompt.title}`"
                      class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600">
                      编辑
                    </button>
                    <button
                      v-if="prompt.isCustom"
                      @click="removeCustomPrompt(prompt, $event)"
                      type="button"
                      :aria-label="`删除 ${prompt.title}`"
                    class="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-500">
                    删除
                  </button>
                  <button
                    @click="selectPrompt(prompt)"
                    type="button"
                    class="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500">
                    一键插入
                    <svg class="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div v-if="showCreateForm" class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/24 p-4">
        <div class="max-h-[82vh] w-full max-w-2xl overflow-y-auto rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.14)] overscroll-contain">
          <div class="flex items-center justify-between gap-4">
            <div>
              <div class="text-xs uppercase tracking-[0.22em] text-slate-400">My Prompt</div>
              <h3 class="mt-1 text-2xl font-black text-slate-900">{{ editingPromptId ? '编辑我的模板' : '新建我的模板' }}</h3>
            </div>
            <button type="button" @click="closeCreateForm" aria-label="关闭模板编辑" class="rounded-full border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-slate-700">标题</label>
              <input v-model="customPromptForm.title" type="text" placeholder="比如：日报压缩版" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]" >
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-slate-700">分类</label>
              <input v-model="customPromptForm.category" type="text" placeholder="写作 / 编程 / 办公" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]" >
            </div>
            <div class="sm:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-slate-700">描述</label>
              <input v-model="customPromptForm.description" type="text" placeholder="一句话说明这个模板用来干什么" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]" >
            </div>
            <div class="sm:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-slate-700">模板内容</label>
              <textarea v-model="customPromptForm.content" rows="8" placeholder="请输入完整提示词模板" class="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]"></textarea>
            </div>
            <div class="sm:col-span-2">
              <label class="mb-2 block text-sm font-semibold text-slate-700">标签</label>
              <input v-model="customPromptForm.tags" type="text" placeholder="用逗号分隔，例如：周报, 汇报, 精简" class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.08)]" >
            </div>
          </div>

          <div v-if="formError" class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{{ formError }}</div>

          <div class="mt-5 flex items-center justify-end gap-3">
            <button type="button" @click="closeCreateForm" class="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              取消
            </button>
            <button type="button" @click="createCustomPrompt" class="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600">
              {{ editingPromptId ? '保存修改' : '保存模板' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
