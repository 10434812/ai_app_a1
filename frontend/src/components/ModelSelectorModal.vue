<script setup lang="ts">
import {computed, ref, watch, onMounted, onUnmounted, nextTick, shallowRef} from 'vue'
import {useAuthStore} from '../stores/auth'
import {useAppStore} from '../stores/app'
import {AVAILABLE_MODELS, MODEL_CATEGORY_ORDER, sortModelsByDisplayPriority, type FrontendModelPublicStatus} from '../constants/models'
import {API_BASE_URL} from '../constants/config'
import {getModelLogoCandidates} from '../utils/modelLogo'

const props = defineProps<{
  isOpen: boolean
  triggerRect?: DOMRect | null
}>()
const emit = defineEmits<{(e: 'close'): void}>()

const authStore = useAuthStore()
const appStore = useAppStore()
const modalRef = ref<HTMLElement | null>(null)
const modalStyle = ref({})
const panelBodyRef = ref<HTMLElement | null>(null)
const visibleModelLimit = ref(36)

// Update position based on trigger element
const updatePosition = () => {
  if (!props.isOpen || !props.triggerRect || !modalRef.value) return

  const gap = 12
  const modalHeight = Math.min(window.innerHeight * 0.6, 500) // Max height estimate or actual
  const modalWidth = Math.min(window.innerWidth - 32, 768) // Max width constraint

  const {top, bottom, left, width} = props.triggerRect
  const windowHeight = window.innerHeight

  // Default: Show above
  let newTop = top - modalHeight - gap
  let isAbove = true

  // If not enough space above, show below
  if (newTop < 80) {
    // 80px for header/safe area
    newTop = bottom + gap
    isAbove = false
  }

  // Horizontal centering
  let newLeft = left + width / 2 - modalWidth / 2

  // Boundary checks
  if (newLeft < 16) newLeft = 16
  if (newLeft + modalWidth > window.innerWidth - 16) {
    newLeft = window.innerWidth - 16 - modalWidth
  }

  modalStyle.value = {
    top: `${newTop}px`,
    left: `${newLeft}px`,
    width: `${modalWidth}px`,
    maxHeight: `${modalHeight}px`,
    position: 'fixed',
    transformOrigin: isAbove ? 'bottom center' : 'top center',
  }
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      nextTick(() => {
        resetVisibleModels()
        updatePosition()
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
      })
    } else {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})

const models = AVAILABLE_MODELS
const selectedModels = computed(() => appStore.selectedModelIds)
const notice = ref('')
const logoFailureIndex = ref<Record<string, number>>({})
const publicModelStatusMap = ref<Record<string, FrontendModelPublicStatus>>({})

async function fetchModelStatusMap() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`)
    if (!res.ok) return
    const data = await res.json()
    publicModelStatusMap.value = data?.model_status_map && typeof data.model_status_map === 'object'
      ? data.model_status_map
      : {}
  } catch (error) {
    console.error('Fetch model status map failed:', error)
  }
}

onMounted(() => {
  fetchModelStatusMap()
})

const groups = computed(() => {
  const g: Record<string, typeof models> = {}
  models.forEach((m) => {
    const c = m.category || '其他'
    if (!g[c]) g[c] = []
    g[c].push(m)
  })
  return Object.keys(g)
    .sort((a, b) => {
      const ia = MODEL_CATEGORY_ORDER.indexOf(a as typeof MODEL_CATEGORY_ORDER[number])
      const ib = MODEL_CATEGORY_ORDER.indexOf(b as typeof MODEL_CATEGORY_ORDER[number])
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })
    .map((name) => ({name, models: sortModelsByDisplayPriority(g[name], publicModelStatusMap.value)}))
})

const visibleGroups = computed(() => {
  let remaining = Math.max(0, visibleModelLimit.value)
  return groups.value
    .map((group) => {
      if (remaining <= 0) return null
      const current = group.models.slice(0, remaining)
      remaining -= current.length
      return {
        name: group.name,
        models: current,
      }
    })
    .filter(Boolean) as Array<{name: string; models: typeof models}>
})

function resetVisibleModels() {
  visibleModelLimit.value = Math.min(models.length, 36)
}

function onPanelScroll() {
  const panel = panelBodyRef.value
  if (!panel) return
  if (visibleModelLimit.value >= models.length) return
  if (panel.scrollTop + panel.clientHeight + 120 >= panel.scrollHeight) {
    visibleModelLimit.value = Math.min(models.length, visibleModelLimit.value + 24)
  }
}

function getLogo(id: string) {
  const model = models.find((mm) => mm.id === id) as {id: string; name?: string; website?: string; logo?: string} | undefined
  const candidates = getModelLogoCandidates(model)
  if (!candidates.length) return ''
  const index = logoFailureIndex.value[id] || 0
  return candidates[index] || ''
}

function markLogoFailed(id: string) {
  const model = models.find((mm) => mm.id === id) as {id: string; name?: string; website?: string; logo?: string} | undefined
  const candidates = getModelLogoCandidates(model)
  const current = logoFailureIndex.value[id] || 0
  if (!candidates.length || current >= candidates.length) return
  logoFailureIndex.value = {...logoFailureIndex.value, [id]: current + 1}
}

function toggle(id: string) {
  const isMember = authStore.user?.membershipLevel === 'pro' || authStore.user?.membershipLevel === 'premium'
  if (!isMember && !selectedModels.value.includes(id) && selectedModels.value.length >= 3) {
    notice.value = '免费版最多选择 3 个模型'
    setTimeout(() => {
      notice.value = ''
    }, 2000)
    return
  }
  appStore.toggleSelectedModel(id)
}
</script>

<template>
  <div v-if="props.isOpen" class="fixed inset-0 z-[100] flex flex-col justify-end sm:block">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/20 transition-opacity" @click="emit('close')"></div>

    <!-- Modal Content -->
    <div
      ref="modalRef"
      :style="modalStyle"
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-out origin-bottom scale-100 opacity-100"
      :class="[!props.triggerRect && 'fixed bottom-0 inset-x-0 sm:static sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-3xl sm:w-full sm:h-auto']">
      <div class="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex-none">
        <div class="text-sm font-bold text-slate-700 dark:text-slate-200">选择模型</div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-slate-500 dark:text-slate-400">已选 {{ selectedModels.length }}</span>
          <button @click="emit('close')" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs">完成</button>
        </div>
      </div>
      <div v-if="notice" class="px-4 sm:px-6 py-2 text-xs text-amber-700 bg-amber-50 border-t border-b border-amber-200 flex-none">{{ notice }}</div>
      <div ref="panelBodyRef" @scroll.passive="onPanelScroll" class="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
        <div class="space-y-5">
          <div v-for="group in visibleGroups" :key="group.name">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{{ group.name }}</div>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <button
                v-for="m in group.models"
                :key="m.id"
                @click="toggle(m.id)"
                :class="[
                  'flex items-center gap-2 rounded-xl border p-2 transition-all text-left',
                  selectedModels.includes(m.id) ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-300' : 'border-slate-200 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200',
                ]">
                <div class="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-700 shrink-0">
                  <img v-if="getLogo(m.id)" :src="getLogo(m.id)" loading="lazy" decoding="async" @error="markLogoFailed(m.id)" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">
                    {{ m.name.substring(0, 1) }}
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold truncate">{{ m.name }}</div>
                  <div class="text-[11px] text-slate-400 truncate">{{ m.category }}</div>
                </div>
                <div v-if="selectedModels.includes(m.id)" class="ml-auto w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                </div>
              </button>
            </div>
          </div>
          <div v-if="visibleModelLimit < models.length" class="py-2 text-center text-xs text-slate-400">
            下滑继续加载更多模型...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(203, 213, 225, 0.4);
  border-radius: 20px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(203, 213, 225, 0.8);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(71, 85, 105, 0.4);
}
.dark .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(71, 85, 105, 0.8);
}
</style>
