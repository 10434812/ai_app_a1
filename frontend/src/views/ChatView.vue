<script setup lang="ts">
import {ref, nextTick, watch, computed, onMounted, onUnmounted, reactive} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import wx from 'weixin-js-sdk'
import {AVAILABLE_MODELS, DEFAULT_SELECTED_MODELS, MODEL_CATEGORY_ORDER, normalizeSelectedModelIds, sortModelsByDisplayPriority} from '../constants/models'
import {API_BASE_URL} from '../constants/config'
import {generateImage as requestImageGeneration} from '../api/media'
import {useAuthStore} from '../stores/auth'
import {useAppStore} from '../stores/app'
import {renderMarkdown} from '../utils/markdown'
import {getModelLogoCandidates} from '../utils/modelLogo'
import {buildModelSelectionSummary} from '../utils/modelSelectionSummary'
import {EMPTY_STATE_PROMO, EMPTY_STATE_PROMO_CONTAINER_CLASS, EMPTY_STATE_PROMO_SCROLL_CLASS, shouldShowEmptyStatePromo} from '../utils/emptyStatePromo'
import {withBearerAuth} from '../utils/authToken'
import {useWeChatShare} from '../composables/useWeChatShare'
import {extractApiErrorMessage} from '../utils/apiError'
import {foldRealtimeTurnResults, isRealtimeTurnResult} from '../utils/realtimeResultMode'
import PromptMarketModal from '../components/PromptMarketModal.vue'
import Sidebar from '../components/Sidebar.vue'
import UserProfileModal from '../components/UserProfileModal.vue'
import RegisterModal from '../components/RegisterModal.vue'
import UserAvatar from '../components/UserAvatar.vue'

interface SpeechRecognitionAlternativeLike {
  transcript?: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike
}

interface BrowserWindowLike extends Window {
  SpeechRecognition?: SpeechRecognitionConstructorLike
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike
}

interface WeChatVoiceResponse {
  localId?: string
  errMsg?: string
  message?: string
  translateResult?: string
}

const authStore = useAuthStore()
const appStore = useAppStore()
const {setShareData, initWeChat, ensureWeChatReady, shareStatus, errorMsg: wechatSdkError, voiceApiSupported} = useWeChatShare()
const route = useRoute()
const router = useRouter()
const question = ref('')
const isGenerating = ref(false)
const isInputFocused = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const ghostTextareaRef = ref<HTMLTextAreaElement | null>(null)
const inputAreaRef = ref<HTMLElement | null>(null)
const modelSelectorRef = ref<HTMLElement | null>(null)
const chatHeaderRef = ref<HTMLElement | null>(null)
const isMobile = ref(window.innerWidth < 640)
const inputContainerStyle = reactive({
  transform: 'translateY(0)',
  transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.5, 1)',
})
const modelSelectorExpandY = ref(0)
const isModelSelectorDragging = ref(false)
const modelSelectorDragPointerId = ref<number | null>(null)
const modelSelectorDragStartY = ref(0)
const modelSelectorDragStartExpand = ref(0)
const modelSelectorMaxExpandY = ref(0)
const suppressToggleModelPanelClick = ref(false)
const isModelPanelAtTop = ref(false)
const modelSelectorDragFromPanelBody = ref(false)

const modelPanelBodyStyle = computed(() => {
  const extraHeight = Math.max(0, modelSelectorExpandY.value)
  return {
    maxHeight: `calc(50vh + ${extraHeight}px)`,
    transition: isModelSelectorDragging.value ? 'none' : 'max-height 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
  }
})

const handleViewportResize = () => {
  if (!isMobile.value) {
    inputContainerStyle.transform = 'translateY(0)'
    return
  }

  if (window.visualViewport) {
    const {height, offsetTop} = window.visualViewport
    const windowHeight = window.innerHeight
    // Rough estimation of keyboard height
    // Note: on Android windowHeight usually shrinks, so keyboardHeight might appear small if we compare to current windowHeight
    // We should compare to screen height or initial window height, but that's complex.
    // Instead, let's rely on visualViewport.height vs window.outerHeight or similar.

    // Simpler heuristic: if focused, lift it up a bit to ensure safety gap.
    if (isInputFocused.value) {
      // The user wants 1.2x keyboard height.
      // But calculating exact keyboard height is hard across devices.
      // We'll apply a safe "lift" that looks good.
      // Or we can try to use the visualViewport offset.

      // If the browser pushes the content up (Android), we just need a bit more space.
      // If the browser overlays (iOS), we need to push it up manually.

      // Let's assume standard behavior + visual enhancement.
      // We will add a fixed lift when focused on mobile to ensure it's not "stuck" to the keyboard.
      // A lift of ~20px - 40px is usually good.
      // User asked for "1.2x keyboard height". That's huge (~300px * 1.2 = 360px).
      // Maybe they mean "Bottom margin = 1.2x keyboard height"? No.
      // "Move input box ... up ... 1.2x soft keyboard height".

      // Let's try to interpret "1.2x" as "Keyboard Height + 20% padding".
      // If the viewport resizes, the bottom is at (Window Height - Keyboard Height).
      // We want bottom to be at (Window Height - Keyboard Height - 0.2*Keyboard Height).
      // So we translate Y by -0.2 * Keyboard Height.

      const estimatedKeyboardHeight = window.screen.height - height // Very rough
      const shift = Math.min(estimatedKeyboardHeight * 0.2, 80) // Cap it

      // Wait, if I simply translate Y by -20px, it detaches from keyboard.
      inputContainerStyle.transform = `translateY(-${Math.max(20, shift)}px)`
    } else {
      inputContainerStyle.transform = 'translateY(0)'
    }
  }
}

const getModelSelectorTopBoundary = () => {
  const headerBottom = chatHeaderRef.value?.getBoundingClientRect().bottom ?? 0
  return Math.max(0, headerBottom + 6)
}

const calculateModelSelectorMaxExpand = () => {
  const boundaryTop = getModelSelectorTopBoundary()
  const panelRect = modelPanelBodyRef.value?.getBoundingClientRect()
  if (panelRect) {
    // Upward limit: stop when model panel top reaches header bottom.
    return modelSelectorExpandY.value + Math.max(0, panelRect.top - boundaryTop)
  }

  if (!modelSelectorRef.value) return modelSelectorExpandY.value
  const selectorRect = modelSelectorRef.value.getBoundingClientRect()
  return modelSelectorExpandY.value + Math.max(0, selectorRect.top - boundaryTop)
}

const clampModelSelectorExpand = (value: number, maxExpand = calculateModelSelectorMaxExpand()) => {
  return Math.max(0, Math.min(maxExpand, value))
}

const updateModelPanelAtTopState = (maxExpand = calculateModelSelectorMaxExpand()) => {
  isModelPanelAtTop.value = modelSelectorExpandY.value >= maxExpand - 4
}

const handleWindowResize = () => {
  isMobile.value = window.innerWidth < 640
  const maxExpand = calculateModelSelectorMaxExpand()
  modelSelectorExpandY.value = clampModelSelectorExpand(modelSelectorExpandY.value, maxExpand)
  updateModelPanelAtTopState(maxExpand)
}

const onModelSelectorPointerDown = (event: PointerEvent) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  const targetNode = event.target as Node | null
  const draggingFromModelBody = !!(targetNode && modelPanelBodyRef.value?.contains(targetNode))
  modelSelectorDragFromPanelBody.value = draggingFromModelBody
  if (draggingFromModelBody) {
    const panelScrollTop = modelPanelBodyRef.value?.scrollTop || 0
    if (isModelPanelAtTop.value && panelScrollTop > 0) {
      return
    }
  }

  const target = event.currentTarget as HTMLElement | null
  target?.setPointerCapture?.(event.pointerId)
  modelSelectorDragPointerId.value = event.pointerId
  isModelSelectorDragging.value = true
  modelSelectorDragStartY.value = event.clientY
  modelSelectorDragStartExpand.value = modelSelectorExpandY.value
  modelSelectorMaxExpandY.value = calculateModelSelectorMaxExpand()
  suppressToggleModelPanelClick.value = false
  updateModelPanelAtTopState(modelSelectorMaxExpandY.value)
  if (event.cancelable) event.preventDefault()
}

const onModelSelectorPointerMove = (event: PointerEvent) => {
  if (!isModelSelectorDragging.value || modelSelectorDragPointerId.value !== event.pointerId) return
  const deltaY = event.clientY - modelSelectorDragStartY.value
  const pullingDown = deltaY > 0
  const panelScrollTop = modelPanelBodyRef.value?.scrollTop || 0

  // At top state: let model list handle normal vertical scrolling.
  // Only take over gesture when user pulls down from list top to collapse panel.
  if (modelSelectorDragFromPanelBody.value && isModelPanelAtTop.value) {
    if (!pullingDown || panelScrollTop > 0) {
      return
    }
  }

  const deltaUp = modelSelectorDragStartY.value - event.clientY
  const nextExpand = clampModelSelectorExpand(modelSelectorDragStartExpand.value + deltaUp, modelSelectorMaxExpandY.value)
  if (Math.abs(nextExpand - modelSelectorDragStartExpand.value) > 6) {
    suppressToggleModelPanelClick.value = true
  }
  modelSelectorExpandY.value = nextExpand
  isModelPanelAtTop.value = nextExpand >= modelSelectorMaxExpandY.value - 4
  if (event.cancelable) event.preventDefault()
}

const onModelSelectorPointerUp = (event: PointerEvent) => {
  if (modelSelectorDragPointerId.value !== event.pointerId) return
  const target = event.currentTarget as HTMLElement | null
  target?.releasePointerCapture?.(event.pointerId)
  modelSelectorDragPointerId.value = null
  isModelSelectorDragging.value = false
  modelSelectorDragFromPanelBody.value = false
  updateModelPanelAtTopState()
}

onMounted(() => {
  window.addEventListener('resize', handleWindowResize)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize)
    window.visualViewport.addEventListener('scroll', handleViewportResize)
  }
  nextTick(() => {
    handleWindowResize()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportResize)
    window.visualViewport.removeEventListener('scroll', handleViewportResize)
  }
  if (modelSelectionNoticeTimer.value) {
    window.clearTimeout(modelSelectionNoticeTimer.value)
  }
  if (inputActionNoticeTimer.value) {
    window.clearTimeout(inputActionNoticeTimer.value)
  }
})

const isModelPanelExpanded = ref(true)
const conversationId = ref<string | null>(null)
const isListening = ref(false)
const speechSupported = ref(false)
const ttsSupported = ref(false)
const recognitionRef = ref<SpeechRecognitionLike | null>(null)
const listenBase = ref('')
const speakingKey = ref<string | null>(null)
const shareCopied = ref(false)
const shareError = ref('')
const showWeChatShareGuide = ref(false)
const showRegisterModal = ref(false)
const showPromptMarket = ref(false)
const showUpgradeLimitModal = ref(false)
const wechatShareTitleDefault = ref('全智AI')
const wechatShareDescDefault = ref('一次访问，多种结果')
const wechatShareImgDefault = ref(`${window.location.origin}/logo.svg`)
const wechatShareLinkDefault = ref(window.location.href.split('#')[0])

const guestMsgCount = ref(0)
const guestTrialLimit = ref(100)
const disabledModelIds = ref<string[]>([])
const publicModelStatusMap = ref<Record<string, PublicModelStatus>>({})
const hasLoadedModelStatus = ref(false)
const expandedUnavailableCategories = ref<Record<string, boolean>>({})
const modelSelectionNotice = ref('')
const modelSelectionNoticeTimer = ref<number | undefined>(undefined)
const inputActionNotice = ref('')
const inputActionNoticeTone = ref<'info' | 'success' | 'error'>('info')
const inputActionNoticeTimer = ref<number | undefined>(undefined)
const wechatVoiceFinalizing = ref(false)

const LEGACY_DEFAULT_SELECTED_MODELS = ['deepseek-v3', 'glm-4', 'qwen-plus']
const matchesLegacyDefaultSelection = (ids: string[]) =>
  ids.length === LEGACY_DEFAULT_SELECTED_MODELS.length &&
  ids.every((id, index) => id === LEGACY_DEFAULT_SELECTED_MODELS[index])

// Fetch system config
async function fetchConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`)
    if (res.ok) {
      const data = await res.json()
      if (data.guest_trial_limit !== undefined) {
        guestTrialLimit.value = data.guest_trial_limit
      }
      disabledModelIds.value = Array.isArray(data.disabled_model_ids)
        ? data.disabled_model_ids.filter((id: unknown): id is string => typeof id === 'string')
        : []
      publicModelStatusMap.value = data.model_status_map && typeof data.model_status_map === 'object'
        ? data.model_status_map
        : {}
      hasLoadedModelStatus.value = true
      wechatShareTitleDefault.value = data.wechat_share_title || wechatShareTitleDefault.value
      wechatShareDescDefault.value = data.wechat_share_desc || wechatShareDescDefault.value
      wechatShareImgDefault.value = data.wechat_share_img || wechatShareImgDefault.value
      wechatShareLinkDefault.value = data.wechat_share_link || wechatShareLinkDefault.value

      let cleanedSelectedModels = normalizeSelectedModelIds(appStore.selectedModelIds).filter((id) => !disabledModelIds.value.includes(id))
      if (matchesLegacyDefaultSelection(cleanedSelectedModels)) {
        cleanedSelectedModels = DEFAULT_SELECTED_MODELS.filter((id) => !disabledModelIds.value.includes(id)).slice(0, 3)
      }
      if (cleanedSelectedModels.length > 0) {
        if (cleanedSelectedModels.length !== appStore.selectedModelIds.length) {
          appStore.setSelectedModels(cleanedSelectedModels)
        } else if (matchesLegacyDefaultSelection(appStore.selectedModelIds)) {
          appStore.setSelectedModels(cleanedSelectedModels)
        }
      } else {
        const fallbackSelectedModels = DEFAULT_SELECTED_MODELS.filter((id) => !disabledModelIds.value.includes(id)).slice(0, 3)
        appStore.setSelectedModels(fallbackSelectedModels)
      }

      updateWeChatShareData()
    }
  } catch (e) {
    console.error('Fetch config failed:', e)
  } finally {
    resetVisibleModels()
  }
}

// New State
const sidebarOpen = ref(window.innerWidth >= 1024)
const showProfile = ref(false)
const isDark = ref(false)
// Remove sidebarRef since it's handled by MainLayout
// const sidebarRef = ref<HTMLElement | null>(null)

// Dark Mode
function toggleDark() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Reasoning Visualization
interface ContentSegment {
  type: 'text' | 'thought'
  content: string
}

function parseMessageContent(text: string): ContentSegment[] {
  if (!text) return []
  const segments: ContentSegment[] = []
  // Matches {{ thought }}
  const regex = /\{\{([\s\S]*?)\}\}/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      })
    }
    segments.push({
      type: 'thought',
      content: match[1].trim(),
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  return segments
}

const handleInput = () => {
  nextTick(() => {
    if (textareaRef.value) {
      // If we have a ghost element, use it to calculate height
      if (ghostTextareaRef.value) {
        ghostTextareaRef.value.value = question.value
        ghostTextareaRef.value.style.height = 'auto'
        const scrollHeight = ghostTextareaRef.value.scrollHeight

        if (isInputFocused.value && !isMobile.value) {
          textareaRef.value.style.height = '400px'
        } else {
          textareaRef.value.style.height = `${scrollHeight}px`
        }
      } else {
        // Fallback if ghost not ready
        if (isInputFocused.value && !isMobile.value) {
          textareaRef.value.style.height = '400px'
        } else {
          textareaRef.value.style.height = 'auto'
          textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`
        }
      }
    }
  })
}

const handleFocus = () => {
  isInputFocused.value = true
  handleInput()
  // Only scroll on mobile if needed, and maybe less delay
  if (isMobile.value) {
    setTimeout(() => {
      if (textareaRef.value) {
        textareaRef.value.scrollIntoView({behavior: 'smooth', block: 'nearest'})
      }
    }, 300)
  }
}

// Ensure initial resize
watch(textareaRef, () => {
  handleInput()
})

const handleBlur = () => {
  // Use timeout to allow click events on buttons (like send) to fire before closing
  setTimeout(() => {
    isInputFocused.value = false
    handleInput()
  }, 100)
}

// Watch question change to auto-resize (e.g. after clear)
watch(question, () => {
  handleInput()
})

watch(isModelPanelAtTop, (atTop) => {
  if (!atTop && modelPanelBodyRef.value) {
    modelPanelBodyRef.value.scrollTop = 0
  }
})

interface ToolOutput {
  id: string
  label: string
  content: string
  loading: boolean
}

interface PublicModelStatus {
  id: string
  provider: string
  isActive: boolean
  isConfigured: boolean
  status: 'configured' | 'placeholder' | 'disabled'
  statusText: string
  source: 'custom' | 'default' | 'image-settings' | 'placeholder'
  upstreamModelId: string | null
  baseURL: string | null
}

interface ModelRouteMeta {
  appModelId: string
  resolvedModelId: string
  routedModelName: string
  provider: string
  upstreamModelId: string | null
  source: string
  status: string
  statusText: string
}

interface RealtimeResultMeta {
  kind: string
  target: string
  displayName: string
  title: string
  sourceLabel: string
  timestampLabel: string
}

interface ModelResult {
  id: string
  name: string
  latency: string
  color: string
  content: string
  streaming: boolean
  toolOutputs: ToolOutput[]
  routeMeta?: ModelRouteMeta | null
  responseMode?: string | null
  realtimeMeta?: RealtimeResultMeta | null
}

interface ConversationTurn {
  question: string
  results: ModelResult[]
  timestamp: number
  pinnedResultId?: string | null
}

const turns = ref<ConversationTurn[]>([])
const scrollContainer = ref<HTMLElement | null>(null)
const isUserScrolling = ref(false)
const modelPanelBodyRef = ref<HTMLElement | null>(null)
const visibleModelLimit = ref(36)

const onScroll = () => {
  if (!scrollContainer.value) return
  const {scrollTop, scrollHeight, clientHeight} = scrollContainer.value
  isUserScrolling.value = scrollHeight - scrollTop - clientHeight > 50
}

function collapseModelPanel(scrollToLatest = true) {
  if (!isModelPanelExpanded.value) return

  isModelPanelExpanded.value = false
  modelSelectorExpandY.value = 0
  isModelPanelAtTop.value = false
  if (modelPanelBodyRef.value) {
    modelPanelBodyRef.value.scrollTop = 0
  }

  if (scrollToLatest) {
    nextTick(() => {
      scrollToBottom(true)
    })
  }
}

function collapseModelPanelOnAnswerGesture() {
  if (!isMobile.value || !isModelPanelExpanded.value || turns.value.length === 0) return
  collapseModelPanel(false)
}

const models = AVAILABLE_MODELS
const selectedModels = computed(() => appStore.selectedModelIds)
const headerModelSelectionSummary = computed(() => buildModelSelectionSummary(selectedModels.value, 3))
const showEmptyStatePromo = computed(() => shouldShowEmptyStatePromo(turns.value.length, question.value))
const logoFailureIndex = ref<Record<string, number>>({})

function isConfiguredModel(id: string) {
  if (!hasLoadedModelStatus.value) return true
  const status = getModelPublicStatus(id)
  if (!status || status.status === 'disabled') return false
  return status.status === 'configured' || status.source === 'image-settings'
}

function isCategoryUnavailableExpanded(categoryName: string) {
  return !!expandedUnavailableCategories.value[categoryName]
}

function toggleCategoryUnavailableVisibility(categoryName: string) {
  expandedUnavailableCategories.value = {
    ...expandedUnavailableCategories.value,
    [categoryName]: !isCategoryUnavailableExpanded(categoryName),
  }
  resetVisibleModels()
  if (modelPanelBodyRef.value) {
    modelPanelBodyRef.value.scrollTop = 0
  }
}

type ChatImageModelConfig = {
  provider: 'aliyun' | 'zhipu' | 'siliconflow'
  model: string
  size: string
  n: number
}

const CHAT_IMAGE_MODEL_CONFIG: Record<string, ChatImageModelConfig> = {
  'aliyun-image': {provider: 'aliyun', model: 'wanx2.0-t2i-turbo', size: '1024x1024', n: 1},
  wanxiang: {provider: 'aliyun', model: 'wanx2.0-t2i-turbo', size: '1024x1024', n: 1},
  'zhipu-image': {provider: 'zhipu', model: 'cogview-4-250304', size: '1024x1024', n: 1},
  kolors: {provider: 'siliconflow', model: 'Kwai-Kolors/Kolors', size: '1024x1024', n: 1},
}

function isImageModelId(modelId: string): boolean {
  return modelId in CHAT_IMAGE_MODEL_CONFIG
}

function getImageModelCount(modelId: string): number {
  const count = CHAT_IMAGE_MODEL_CONFIG[modelId]?.n ?? 1
  return Math.max(1, count)
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '请求失败'
}

function sanitizeTextOnlyContent(content: string): string {
  if (!content) return ''
  return content
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[(?:查看原图|原图)[^\]]*]\([^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildImageResponseContent(images: string[]): string {
  if (!images.length) return '[Error: 图片生成成功但未返回可展示内容]'
  const imageBlocks = images.map((url, idx) => `![生成图片 ${idx + 1}](${url})`).join('\n\n')
  const links = images.map((url, idx) => `[查看原图 ${idx + 1}](${url})`).join(' | ')
  return `${imageBlocks}\n\n${links}`
}

async function runImageGeneration(modelId: string, prompt: string): Promise<string> {
  const config = CHAT_IMAGE_MODEL_CONFIG[modelId]
  if (!config) {
    throw new Error('该绘图模型暂未接入直连出图，请改选已接入的绘图模型。')
  }

  const result = await requestImageGeneration({
    prompt,
    provider: config.provider,
    model: config.model,
    size: config.size,
    n: config.n,
    modelId,
  })

  return buildImageResponseContent(result.images)
}

async function persistAssistantMessage(conversationId: string | null, modelId: string, content: string): Promise<void> {
  if (!conversationId || !content.trim()) return

  const headers = withBearerAuth({
    'Content-Type': 'application/json',
  }, authStore.token)

  const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      conversationId,
      content,
      model: modelId,
      role: 'assistant',
    }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(extractApiErrorMessage(data, '保存图片回复失败'))
  }
}

function truncateText(text: string, max = 24): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > max ? `${compact.slice(0, max)}...` : compact
}

function stripMarkdownForShare(content: string): string {
  return content
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFirstHttpImageUrl(content: string): string | null {
  if (!content) return null
  const markdownImage = content.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i)
  if (markdownImage?.[1]) return markdownImage[1]

  const originalLink = content.match(/\[(?:查看原图|原图)[^\]]*]\((https?:\/\/[^)\s]+)\)/i)
  if (originalLink?.[1]) return originalLink[1]
  return null
}

function getLatestShareImageUrl(): string | null {
  for (let t = turns.value.length - 1; t >= 0; t -= 1) {
    const turn = turns.value[t]
    for (const res of turn.results) {
      const url = extractFirstHttpImageUrl(res.content)
      if (url) return url
    }
  }
  return null
}

function getLatestShareDesc(): string {
  for (let t = turns.value.length - 1; t >= 0; t -= 1) {
    const turn = turns.value[t]
    for (const res of turn.results) {
      if (isImageModelId(res.id)) continue
      const text = stripMarkdownForShare(res.content)
      if (text && !text.startsWith('[Error')) {
        return truncateText(text, 72)
      }
    }
  }
  return ''
}

function buildCurrentShareData() {
  const latestQuestion = turns.value[turns.value.length - 1]?.question || ''
  const title = latestQuestion
    ? `我在 AI 聚合问答提问：${truncateText(latestQuestion, 20)}`
    : wechatShareTitleDefault.value
  const desc = getLatestShareDesc() || wechatShareDescDefault.value
  const imgUrl = getLatestShareImageUrl() || wechatShareImgDefault.value
  const link = conversationId.value
    ? `${window.location.origin}/?id=${conversationId.value}`
    : wechatShareLinkDefault.value || window.location.href.split('#')[0]

  return {title, desc, imgUrl, link}
}

function updateWeChatShareData() {
  const {title, desc, imgUrl, link} = buildCurrentShareData()
  setShareData({
    title,
    desc,
    link,
    imgUrl,
  })
}

const toolActions = [
  {type: 'summarize', label: '总结'},
  {type: 'translate', label: '翻译'},
  {type: 'rewrite', label: '改写'},
  {type: 'outline', label: '提纲'},
  {type: 'document', label: '生成文档'},
]

const isWeChat = /micromessenger/i.test(navigator.userAgent)

onMounted(() => {
  // Default to expanded when entering chat page.
  isModelPanelExpanded.value = true

  const win = window as BrowserWindowLike
  if (isWeChat) {
    speechSupported.value = true
    initWeChat().catch(() => {})
  } else {
    speechSupported.value = !!(win.SpeechRecognition || win.webkitSpeechRecognition)
  }
  ttsSupported.value = !!win.speechSynthesis

  const count = localStorage.getItem('guest_msg_count')
  if (count) {
    guestMsgCount.value = parseInt(count, 10)
  }

  fetchConfig()

  // Check System Dark Mode preference or stored preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // Optional: Auto-enable dark mode? Let's default to light for now unless user toggles.
  }
  const normalizedSelectedModels = normalizeSelectedModelIds(appStore.selectedModelIds)
  if (!normalizedSelectedModels.length) {
    appStore.setSelectedModels([...DEFAULT_SELECTED_MODELS].slice(0, 3))
  } else if (matchesLegacyDefaultSelection(normalizedSelectedModels)) {
    appStore.setSelectedModels([...DEFAULT_SELECTED_MODELS].slice(0, 3))
  } else if (normalizedSelectedModels.length !== appStore.selectedModelIds.length) {
    appStore.setSelectedModels(normalizedSelectedModels)
  }
  resetVisibleModels()

  updateWeChatShareData()
})

const sortedCategories = computed(() => {
  const groups: Record<string, typeof models> = {}
  models.forEach((model) => {
    const category = model.category || '其他'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(model)
  })

  return Object.keys(groups)
    .sort((a, b) => {
      const indexA = MODEL_CATEGORY_ORDER.indexOf(a as typeof MODEL_CATEGORY_ORDER[number])
      const indexB = MODEL_CATEGORY_ORDER.indexOf(b as typeof MODEL_CATEGORY_ORDER[number])
      // If both are in the order list, sort by index
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      // If only A is in list, A comes first
      if (indexA !== -1) return -1
      // If only B is in list, B comes first
      if (indexB !== -1) return 1
      // Otherwise sort alphabetically
      return a.localeCompare(b)
    })
    .map((category) => ({
      name: category,
      models: sortModelsByDisplayPriority(groups[category], publicModelStatusMap.value),
    }))
})

const visibleCategories = computed(() => {
  let remaining = Math.max(0, visibleModelLimit.value)
  const rendered = sortedCategories.value
    .map((group) => {
      const availableModels = group.models.filter((model) => selectedModels.value.includes(model.id) || isConfiguredModel(model.id))
      const unavailableModels = group.models.filter((model) => !selectedModels.value.includes(model.id) && !isConfiguredModel(model.id))
      const isExpanded = isCategoryUnavailableExpanded(group.name)
      const mergedModels = isExpanded ? [...availableModels, ...unavailableModels] : availableModels
      const partial = remaining > 0 ? mergedModels.slice(0, remaining) : []
      remaining -= partial.length

      if (partial.length === 0 && unavailableModels.length === 0) return null
      return {
        name: group.name,
        models: partial,
        hiddenUnavailableCount: unavailableModels.length,
        unavailableExpanded: isExpanded,
      }
    })
    .filter(Boolean) as Array<{name: string; models: typeof models; hiddenUnavailableCount: number; unavailableExpanded: boolean}>
  return rendered
})

const visiblePanelModelCount = computed(() => {
  return sortedCategories.value.reduce((total, group) => {
    const availableModels = group.models.filter((model) => selectedModels.value.includes(model.id) || isConfiguredModel(model.id))
    const unavailableModels = group.models.filter((model) => !selectedModels.value.includes(model.id) && !isConfiguredModel(model.id))
    return total + availableModels.length + (isCategoryUnavailableExpanded(group.name) ? unavailableModels.length : 0)
  }, 0)
})

function resetVisibleModels() {
  visibleModelLimit.value = Math.min(visiblePanelModelCount.value || models.length, 36)
}

function onModelPanelScroll() {
  const panel = modelPanelBodyRef.value
  if (!panel) return
  if (visibleModelLimit.value >= visiblePanelModelCount.value) return
  if (panel.scrollTop + panel.clientHeight + 140 >= panel.scrollHeight) {
    visibleModelLimit.value = Math.min(visiblePanelModelCount.value, visibleModelLimit.value + 24)
  }
}

function getModelName(id: string): string {
  if (id === 'realtime-quote') return '实时行情'
  const model = models.find((m) => m.id === id)
  return model ? model.name : id
}

function getModelTooltip(id: string): string {
  if (id === 'realtime-quote') return '系统实时行情结果'
  const model = models.find((m) => m.id === id)
  if (disabledModelIds.value.includes(id)) {
    return `${model?.description || model?.name || id}（已被管理员禁用）`
  }
  const status = publicModelStatusMap.value[id]
  const statusText = status?.statusText ? ` · ${status.statusText}` : ''
  return `${model?.description || model?.name || id}${statusText}`
}

function getModelPublicStatus(id: string): PublicModelStatus | null {
  if (id === 'realtime-quote') return null
  return publicModelStatusMap.value[id] || null
}

function getModelStatusBadgeClass(id: string) {
  const status = getModelPublicStatus(id)
  if (!status) return 'border-slate-200 bg-slate-100 text-slate-500'
  if (status.status === 'disabled') return 'border-rose-200 bg-rose-50 text-rose-600'
  if (status.status === 'configured') return 'border-emerald-200 bg-emerald-50 text-emerald-600'
  if (status.source === 'image-settings') return 'border-sky-200 bg-sky-50 text-sky-600'
  return 'border-amber-200 bg-amber-50 text-amber-600'
}

function getModelStatusLabel(id: string) {
  if (id === 'realtime-quote') return '实时'
  return getModelPublicStatus(id)?.statusText || '待接入'
}

function getModelStatusHint(id: string) {
  if (id === 'realtime-quote') return '系统实时行情卡片'
  const status = getModelPublicStatus(id)
  if (!status) return '当前模型状态未知'
  if (status.status === 'disabled') return '已被管理员禁用'
  if (status.status === 'configured') {
    return status.upstreamModelId
      ? `已接入 · ${status.upstreamModelId}`
      : `已接入${status.provider ? ` · ${status.provider}` : ''}`
  }
  if (status.source === 'image-settings') {
    return status.upstreamModelId
      ? `已接入 · ${status.upstreamModelId}`
      : `已接入${status.provider ? ` · ${status.provider}` : ''}`
  }
  return '当前只是占位展示，暂未接入'
}

function getResultRouteSubtitle(result: ModelResult) {
  if (result.realtimeMeta) {
    return `${result.realtimeMeta.sourceLabel} · ${result.realtimeMeta.timestampLabel}`
  }
  const route = result.routeMeta
  if (route?.upstreamModelId) {
    return `${route.provider} · ${route.upstreamModelId}`
  }

  const status = getModelPublicStatus(result.id)
  if (status?.upstreamModelId) {
    return `${status.provider} · ${status.upstreamModelId}`
  }

  return getModelStatusHint(result.id)
}

function getDisplayTurnResults(turn: ConversationTurn) {
  return foldRealtimeTurnResults(turn.results)
}

function isRealtimeTurn(turn: ConversationTurn) {
  return getDisplayTurnResults(turn).some((result) => isRealtimeTurnResult(result))
}

function getDisplayResultName(result: ModelResult) {
  if (result.realtimeMeta || result.id === 'realtime-quote') return '实时行情'
  return result.name
}

function getDisplayResultLogo(result: ModelResult) {
  if (result.realtimeMeta || result.id === 'realtime-quote') return ''
  return getModelLogo(result.id)
}

function isErrorResultContent(content: string) {
  const normalized = (content || '').trim()
  return normalized.startsWith('[Error') || normalized.startsWith('[Connection Error')
}

function getLatencySeconds(latency: string) {
  const value = Number.parseFloat(String(latency || '').replace(/s$/i, ''))
  return Number.isFinite(value) ? value : null
}

function getResultScore(result: ModelResult) {
  if (result.streaming) return -1000
  if (result.responseMode === 'realtime_quote') return 10000
  if (isImageModelId(result.id)) return -200

  let score = 0
  const content = (result.content || '').trim()

  if (!content || content === '正在思考中...') return -500
  if (isErrorResultContent(content)) return -400

  score += Math.min(content.length, 1200) / 24

  if (/[\n•\-1-9]/.test(content)) score += 8
  if (content.length >= 120) score += 12
  if (content.length >= 260) score += 10
  if (content.length > 2200) score -= 8

  const status = getModelPublicStatus(result.id)
  if (status?.status === 'configured') score += 10
  if (status?.status === 'disabled') score -= 100

  const latencySeconds = getLatencySeconds(result.latency)
  if (latencySeconds !== null) {
    if (latencySeconds <= 2.5) score += 10
    else if (latencySeconds <= 5) score += 6
    else if (latencySeconds >= 12) score -= 6
  }

  return score
}

function getRecommendedResultId(turn: ConversationTurn) {
  const displayResults = getDisplayTurnResults(turn)

  if (turn.pinnedResultId && displayResults.some((item) => item.id === turn.pinnedResultId)) {
    return turn.pinnedResultId
  }

  const candidates = displayResults.filter((result) => !isImageModelId(result.id))
  if (!candidates.length) return displayResults[0]?.id || null

  return [...candidates]
    .sort((a, b) => getResultScore(b) - getResultScore(a))
    .find((result) => getResultScore(result) > -450)?.id || candidates[0]?.id || null
}

function getSortedTurnResults(turn: ConversationTurn) {
  const displayResults = getDisplayTurnResults(turn)
  const recommendedId = getRecommendedResultId(turn)
  return [...displayResults].sort((a, b) => {
    const aRecommended = a.id === recommendedId ? 1 : 0
    const bRecommended = b.id === recommendedId ? 1 : 0
    if (aRecommended !== bRecommended) return bRecommended - aRecommended

    const scoreDiff = getResultScore(b) - getResultScore(a)
    if (scoreDiff !== 0) return scoreDiff

    const latencyA = getLatencySeconds(a.latency)
    const latencyB = getLatencySeconds(b.latency)
    if (latencyA !== null && latencyB !== null && latencyA !== latencyB) {
      return latencyA - latencyB
    }

    return a.name.localeCompare(b.name)
  })
}

function getRecommendedResult(turn: ConversationTurn) {
  const recommendedId = getRecommendedResultId(turn)
  return getDisplayTurnResults(turn).find((result) => result.id === recommendedId) || null
}

function isRecommendedResult(turn: ConversationTurn, resultId: string) {
  return getRecommendedResultId(turn) === resultId
}

function setPinnedResult(turn: ConversationTurn, resultId: string) {
  turn.pinnedResultId = resultId
  const result = getDisplayTurnResults(turn).find((item) => item.id === resultId)
  if (result) {
    showInputNotice(`已将 ${getDisplayResultName(result)} 设为主回答`, 'success')
  }
}

function getModelLogoCandidateList(id: string): string[] {
  if (id === 'realtime-quote') return []
  const model = models.find((m) => m.id === id) as {id: string; website?: string; logo?: string} | undefined
  return getModelLogoCandidates(model)
}

function getModelLogo(id: string): string {
  const candidates = getModelLogoCandidateList(id)
  if (!candidates.length) return ''
  const index = logoFailureIndex.value[id] || 0
  return candidates[index] || ''
}

function getModelWebsite(id: string): string {
  if (id === 'realtime-quote') return '#'
  const model = models.find((m) => m.id === id) as {website?: string} | undefined
  return model?.website || '#'
}

function markLogoFailed(id: string) {
  if (id === 'realtime-quote') return
  const candidates = getModelLogoCandidateList(id)
  const current = logoFailureIndex.value[id] || 0
  if (!candidates.length || current >= candidates.length) return
  logoFailureIndex.value = {...logoFailureIndex.value, [id]: current + 1}
}

function toggleModel(modelId: string) {
  if (disabledModelIds.value.includes(modelId)) {
    showSelectionNotice('该模型已被管理员禁用')
    return
  }

  if (selectedModels.value.includes(modelId)) {
    appStore.toggleSelectedModel(modelId)
  } else {
    const isMember = authStore.user?.membershipLevel === 'pro' || authStore.user?.membershipLevel === 'premium'
    const baseLimit = 3

    if (!isMember && selectedModels.value.length >= baseLimit) {
      showUpgradeLimitModal.value = true
      return
    }

    appStore.toggleSelectedModel(modelId)
  }
}

function showSelectionNotice(message: string) {
  modelSelectionNotice.value = message
  window.clearTimeout(modelSelectionNoticeTimer.value)
  modelSelectionNoticeTimer.value = window.setTimeout(() => {
    modelSelectionNotice.value = ''
  }, 2200)
}

function showInputNotice(message: string, tone: 'info' | 'success' | 'error' = 'info', duration = 2400) {
  inputActionNotice.value = message
  inputActionNoticeTone.value = tone
  window.clearTimeout(inputActionNoticeTimer.value)
  inputActionNoticeTimer.value = window.setTimeout(() => {
    inputActionNotice.value = ''
  }, duration)
}

function normalizeVoiceTranscript(text: string) {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function applyVoiceTranscript(text: string) {
  const transcript = normalizeVoiceTranscript(text)
  if (!transcript) {
    showInputNotice('没有识别到可用的语音内容，请重试', 'error')
    return
  }

  question.value = `${listenBase.value}${transcript}`.trimStart()
  showInputNotice('语音已转成文字，可以直接发送', 'success')
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function getWeChatVoiceErrorMessage(error: unknown, fallback: string) {
  const normalized = error as WeChatVoiceResponse | Error | null | undefined
  const raw = normalized instanceof Error ? normalized.message : normalized?.errMsg || normalized?.message || ''
  if (!raw) return fallback
  if (String(raw).includes('cancel')) return '你取消了微信录音授权，请重新点击允许'
  if (String(raw).includes('permission')) return '微信录音权限未开启，请先允许麦克风权限'
  if (String(raw).includes('translate')) return '微信语音转文字失败，请重试一次'
  if (String(raw).includes('config')) return '微信能力初始化失败，请刷新页面后重试'
  return fallback
}

async function translateWeChatVoice(localId: string) {
  return new Promise<string>((resolve, reject) => {
    wx.translateVoice({
      localId,
      isShowProgressTips: 1,
      success: (res: WeChatVoiceResponse) => {
        resolve(res?.translateResult || '')
      },
      fail: reject,
    })
  })
}

async function finalizeWeChatVoice(localId?: string) {
  if (wechatVoiceFinalizing.value) return

  isListening.value = false
  if (!localId) {
    showInputNotice('微信没有返回录音结果，请重试', 'error')
    return
  }

  wechatVoiceFinalizing.value = true
  try {
    const transcript = await translateWeChatVoice(localId)
    applyVoiceTranscript(transcript)
  } catch (error) {
    showInputNotice(getWeChatVoiceErrorMessage(error, '语音转文字失败，请稍后重试'), 'error', 3200)
  } finally {
    wechatVoiceFinalizing.value = false
  }
}

function toggleModelPanel(nextState?: boolean, options?: {scrollToBottomOnCollapse?: boolean}) {
  if (suppressToggleModelPanelClick.value) {
    suppressToggleModelPanelClick.value = false
    return
  }
  const next = typeof nextState === 'boolean' ? nextState : !isModelPanelExpanded.value
  if (next === isModelPanelExpanded.value) return

  isModelPanelExpanded.value = next
  if (next) {
    resetVisibleModels()
    nextTick(() => {
      handleWindowResize()
    })
  }

  // Ensure input module is visible right after collapse on small screens.
  if (!next) {
    collapseModelPanel(options?.scrollToBottomOnCollapse ?? true)
  }
}

const colorClasses: Record<string, string> = {
  emerald: 'bg-emerald-500',
  indigo: 'bg-indigo-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  orange: 'bg-orange-500',
}

function getRandomColor() {
  const colors = ['emerald', 'indigo', 'blue', 'purple', 'pink', 'orange']
  return colors[Math.floor(Math.random() * colors.length)]
}

function hasChinese(text: string) {
  return /[\u4e00-\u9fa5]/.test(text)
}

function getToolPrompt(type: string, content: string) {
  if (type === 'summarize') {
    return `请对以下内容进行简洁总结：\n\n${content}`
  }
  if (type === 'translate') {
    const target = hasChinese(content) ? '英文' : '中文'
    return `请将以下内容翻译成${target}，保持原意：\n\n${content}`
  }
  if (type === 'rewrite') {
    return `请在保留原意的情况下改写以下内容，使表达更自然清晰：\n\n${content}`
  }
  if (type === 'outline') {
    return `请将以下内容整理为条目式提纲：\n\n${content}`
  }
  return `请基于以下内容生成一份结构化文档，包含标题、小节与要点：\n\n${content}`
}

function getToolLabel(type: string) {
  return toolActions.find((action) => action.type === type)?.label || type
}

async function startListening() {
  if (isListening.value || !speechSupported.value) return

  if (isWeChat) {
    try {
      await ensureWeChatReady()
      if (shareStatus.value !== 'ready' && shareStatus.value !== 'success') {
        showInputNotice('微信语音能力还没准备好，请稍后重试', 'error')
        return
      }
      if (!voiceApiSupported.value) {
        showInputNotice('当前微信环境不支持语音转文字，请升级微信后重试', 'error', 3200)
        return
      }

      listenBase.value = question.value ? `${question.value} ` : ''

      await new Promise<void>((resolve, reject) => {
        wx.startRecord({
          success: () => resolve(),
          cancel: reject,
          fail: reject,
        })
      })

      isListening.value = true
      showInputNotice('正在录音，再点一次麦克风结束并转文字', 'info', 1800)

      wx.onVoiceRecordEnd({
        complete: (res: WeChatVoiceResponse) => {
          finalizeWeChatVoice(res?.localId)
        },
      })
    } catch (error) {
      showInputNotice(getWeChatVoiceErrorMessage(error, wechatSdkError.value || '无法启动微信录音，请重试'), 'error', 3200)
    }
    return
  }

  const win = window as BrowserWindowLike
  const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition
  if (!SpeechRecognition) return

  const recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.interimResults = true
  recognition.continuous = true
  listenBase.value = question.value ? `${question.value} ` : ''

  recognition.onresult = (event: SpeechRecognitionEventLike) => {
    let finalTranscript = ''
    let interimTranscript = ''

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0]?.transcript || ''
      if (event.results[i].isFinal) {
        finalTranscript += transcript
      } else {
        interimTranscript += transcript
      }
    }

    question.value = `${listenBase.value}${finalTranscript}${interimTranscript}`.trimStart()
  }

  recognition.onend = () => {
    isListening.value = false
    recognitionRef.value = null
  }

  recognition.onerror = () => {
    isListening.value = false
    recognitionRef.value = null
    showInputNotice('浏览器语音识别失败，请检查麦克风权限', 'error')
  }

  recognitionRef.value = recognition
  isListening.value = true
  recognition.start()
}

function handlePromptSelect(content: string) {
  question.value = content
  showInputNotice('模板已插入输入框，可继续编辑后发送', 'success')
  if (textareaRef.value) {
    textareaRef.value.focus()
  }
}

function stopListening() {
  if (isWeChat) {
    if (isListening.value) {
      wx.stopRecord({
        success: (res: WeChatVoiceResponse) => {
          finalizeWeChatVoice(res?.localId)
        },
        fail: (error: unknown) => {
          isListening.value = false
          showInputNotice(getWeChatVoiceErrorMessage(error, '停止录音失败，请重试'), 'error')
        },
      })
    }
    return
  }

  if (recognitionRef.value) {
    recognitionRef.value.stop()
  }
  isListening.value = false
  recognitionRef.value = null
}

const copiedStates = ref<Record<string, boolean>>({})

async function copyContent(id: string, content: string) {
  try {
    await navigator.clipboard.writeText(content)
    copiedStates.value[id] = true
    setTimeout(() => {
      copiedStates.value[id] = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

async function regenerateResponse(turnIndex: number, modelId: string) {
  const turn = turns.value[turnIndex]
  if (!turn) return
  const result = turn.results.find((r) => r.id === modelId)
  if (!result || result.streaming) return

  const prompt = turn.question
  result.content = ''
  result.streaming = true
  result.latency = '...'
  result.toolOutputs = []

  const startTime = Date.now()
  const customApiKey = localStorage.getItem('custom_api_key')
  const shouldUseCustomApiKey = !!customApiKey && !isImageModelId(modelId)

  try {
    if (isImageModelId(modelId)) {
      result.content = await runImageGeneration(modelId, prompt)
      persistAssistantMessage(conversationId.value, modelId, result.content).catch((err) => {
        console.error('Persist image message failed:', err)
      })
      scrollToBottom(true)
      return
    }

    const headers = withBearerAuth({
      'Content-Type': 'application/json',
    }, authStore.token)

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: result.id,
        messages: [{role: 'user', content: prompt}],
        conversationId: conversationId.value,
        saveUserMessage: false,
        saveAssistantMessage: true,
        useHistory: true,
        apiKey: shouldUseCustomApiKey ? customApiKey : undefined,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(extractApiErrorMessage(data, response.statusText || '请求失败'))
    }
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let isFirstChunk = true

    while (true) {
      const {done, value} = await reader.read()
      if (done) break

      buffer += decoder.decode(value, {stream: true})
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        const lines = event.split('\n')
        const dataLines: string[] = []
        for (const line of lines) {
          if (line.startsWith('data:')) {
            dataLines.push(line.replace(/^data:\s?/, ''))
          }
        }
        const dataStr = dataLines.join('\n').trim()
        if (!dataStr || dataStr === '[DONE]') continue

        try {
          const data = JSON.parse(dataStr)
          if (data.meta?.route) {
            result.routeMeta = data.meta.route
          }
          if (data.meta?.mode) {
            result.responseMode = data.meta.mode
          }
          if (data.meta?.realtime) {
            result.realtimeMeta = data.meta.realtime
          }
          if (data.error) {
            result.content += `\n[Error: ${extractApiErrorMessage(data, '请求失败')}]`
          } else if (data.content) {
            if (isFirstChunk) {
              isFirstChunk = false
            }
            result.content += data.content
            scrollToBottom()
          }
        } catch (e) {
          console.error(e)
        }
      }
    }
  } catch (error: unknown) {
    result.content += `\n[Error: ${normalizeErrorMessage(error)}]`
  } finally {
    result.streaming = false
    if (!isImageModelId(modelId)) {
      const sanitized = sanitizeTextOnlyContent(result.content)
      if (sanitized) {
        result.content = sanitized
      }
    }
    result.latency = ((Date.now() - startTime) / 1000).toFixed(1) + 's'
    nextTick(() => scrollToBottom(true))
    updateWeChatShareData()
  }
}

function toggleListening() {
  if (isListening.value) {
    stopListening()
  } else {
    startListening()
  }
}

function toggleSpeak(key: string, content: string) {
  if (!ttsSupported.value) return
  const synth = window.speechSynthesis
  if (!synth) return
  if (speakingKey.value === key) {
    synth.cancel()
    speakingKey.value = null
    return
  }
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(content)
  utterance.lang = hasChinese(content) ? 'zh-CN' : 'en-US'
  utterance.onend = () => {
    if (speakingKey.value === key) speakingKey.value = null
  }
  utterance.onerror = () => {
    if (speakingKey.value === key) speakingKey.value = null
  }
  speakingKey.value = key
  synth.speak(utterance)
}

async function copyShareLink(shareUrl?: string) {
  const fallbackUrl = buildCurrentShareData().link
  const finalUrl = shareUrl || fallbackUrl
  shareError.value = ''
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(finalUrl)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = finalUrl
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    shareCopied.value = true
    setTimeout(() => {
      shareCopied.value = false
    }, 1500)
  } catch (e: unknown) {
    shareError.value = '复制失败，请手动复制链接'
  }
}

async function handleShareClick() {
  updateWeChatShareData()

  if (isWeChat) {
    showWeChatShareGuide.value = true
    return
  }

  const shareData = buildCurrentShareData()
  if (navigator.share) {
    try {
      await navigator.share({
        title: shareData.title,
        text: shareData.desc,
        url: shareData.link,
      })
      return
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  await copyShareLink(shareData.link)
}

async function loadConversation(id: string) {
  if (!id) {
    turns.value = []
    conversationId.value = null
    return
  }

  conversationId.value = id
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat/${id}/messages`)
    if (!res.ok) throw new Error('Failed to load conversation')

    const messages = await res.json()

    const newTurns: ConversationTurn[] = []
    let currentTurn: ConversationTurn | null = null

    for (const msg of messages) {
      if (msg.role === 'user') {
        if (currentTurn) {
          newTurns.push(currentTurn)
        }
        currentTurn = {
          question: msg.content,
          results: [],
          timestamp: new Date(msg.createdAt).getTime(),
          pinnedResultId: null,
        }
      } else if (msg.role === 'assistant' && currentTurn) {
        const isRealtimeQuote = msg.model === 'realtime-quote'
        currentTurn.results.push({
          id: msg.model || 'unknown',
          name: isRealtimeQuote ? '实时行情' : getModelName(msg.model || 'unknown'),
          latency: '',
          color: getRandomColor(),
          content: msg.content,
          streaming: false,
          toolOutputs: [],
          routeMeta: null,
          responseMode: isRealtimeQuote ? 'realtime_quote' : null,
          realtimeMeta: isRealtimeQuote
            ? {
                kind: 'unknown',
                target: 'realtime-quote',
                displayName: '实时行情',
                title: '实时行情',
                sourceLabel: '系统',
                timestampLabel: '',
              }
            : null,
        })
      }
    }
    if (currentTurn) newTurns.push(currentTurn)

    turns.value = newTurns
    scrollToBottom(true)
    updateWeChatShareData()
  } catch (e) {
    console.error(e)
  }
}

function scrollToBottom(force = false) {
  if (isUserScrolling.value && !force) return
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  })
}

watch(
  () => route.query.id,
  (newId) => {
    const id = Array.isArray(newId) ? newId[0] : newId

    if (id === conversationId.value) {
      return
    }

    if (id) {
      loadConversation(id)
    } else {
      isModelPanelExpanded.value = true
      resetVisibleModels()
      turns.value = []
      conversationId.value = null
      updateWeChatShareData()
    }
  },
  {immediate: true},
)

// Handle New Chat from Sidebar
function handleNewChat() {
  router.push({query: {}})
  isModelPanelExpanded.value = true
  resetVisibleModels()
  turns.value = []
  conversationId.value = null
  updateWeChatShareData()
  // Close sidebar on mobile
  if (window.innerWidth < 1024) sidebarOpen.value = false
}

async function handleGenerate() {
  console.log('[ChatView] handleGenerate called')
  if (selectedModels.value.length === 0) {
    console.warn('[ChatView] No models selected')
    alert('请至少选择一个模型')
    return
  }

  if (selectedModels.value.some((id) => isImageModelId(id)) && !authStore.isAuthenticated) {
    showRegisterModal.value = true
    alert('绘图模型需要登录后使用。')
    return
  }

  if (!authStore.isAuthenticated) {
    console.log('[ChatView] Guest user, count:', guestMsgCount.value)
    if (guestMsgCount.value >= guestTrialLimit.value) {
      console.log('[ChatView] Guest limit reached')
      showRegisterModal.value = true
      return
    }
    guestMsgCount.value++
    localStorage.setItem('guest_msg_count', guestMsgCount.value.toString())
  }

  const isMember = authStore.user?.membershipLevel === 'pro' || authStore.user?.membershipLevel === 'premium'
  if (!isMember && selectedModels.value.length > 3) {
    showUpgradeLimitModal.value = true
    return
  }

  isModelPanelExpanded.value = false
  stopListening()

  if (window.innerWidth < 640 && textareaRef.value) {
    textareaRef.value.blur()
  }

  isInputFocused.value = false
  isGenerating.value = true
  const currentQ = question.value
  question.value = ''
  if (textareaRef.value) textareaRef.value.style.height = 'auto'

  // Initialize Conversation (Create or Append User Message)
  let activeConversationId = conversationId.value
  try {
    const saveMsgHeaders = withBearerAuth({
      'Content-Type': 'application/json',
    }, authStore.token)

    const saveMsgRes = await fetch(`${API_BASE_URL}/api/chat/message`, {
      method: 'POST',
      headers: saveMsgHeaders,
      body: JSON.stringify({
        conversationId: activeConversationId,
        content: currentQ,
        model: 'user',
      }),
    })

    if (!saveMsgRes.ok) {
      const data = await saveMsgRes.json().catch(() => ({}))
      throw new Error(extractApiErrorMessage(data, '发送失败，请重试'))
    }
    const saveMsgData = await saveMsgRes.json()

    if (!activeConversationId) {
      activeConversationId = saveMsgData.conversationId
      conversationId.value = activeConversationId
      router.replace({query: {id: activeConversationId}})
      window.dispatchEvent(new CustomEvent('refresh-sidebar-history'))
      updateWeChatShareData()
    }
  } catch (e) {
    console.error('Failed to initialize conversation:', e)
    isGenerating.value = false
    question.value = currentQ
    alert('发送失败，请重试')
    return
  }

  const newTurn = reactive<ConversationTurn>({
    question: currentQ,
    results: selectedModels.value.map((id) => ({
      id,
      name: getModelName(id),
      latency: '...',
      color: getRandomColor(),
      content: isImageModelId(id) ? '' : '正在思考中...',
      streaming: true,
      toolOutputs: [],
      routeMeta: null,
      responseMode: null,
      realtimeMeta: null,
    })),
    timestamp: Date.now(),
    pinnedResultId: null,
  })

  if (window.innerWidth < 640) {
    setTimeout(() => {
      if (textareaRef.value) {
        textareaRef.value.blur()
        textareaRef.value.style.height = 'auto'
      }
      isInputFocused.value = false
    }, 50)
  }

  turns.value.push(newTurn)
  scrollToBottom(true)
  updateWeChatShareData()

  // Refresh History List in Sidebar - Already handled above

  const customApiKey = localStorage.getItem('custom_api_key')
  const useCustomApiKeyInMultiModel = selectedModels.value.length === 1 && !!customApiKey
  const hasImageModelsInTurn = selectedModels.value.some((id) => isImageModelId(id))
  const textOnlySystemPrompt = hasImageModelsInTurn
    ? '你当前在多模型混合模式中。请仅根据用户输入返回纯文本回答，不要输出任何图片 Markdown、图片链接或“查看原图”字样。'
    : null

  const promises = newTurn.results.map(async (res) => {
    const startTime = Date.now()

    try {
      if (isImageModelId(res.id)) {
        res.content = await runImageGeneration(res.id, currentQ)
        persistAssistantMessage(activeConversationId, res.id, res.content).catch((err) => {
          console.error('Persist image message failed:', err)
        })
        scrollToBottom()
        return
      }

      const headers = withBearerAuth({
        'Content-Type': 'application/json',
      }, authStore.token)

      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: res.id,
          selectedModelCount: selectedModels.value.length,
          messages: textOnlySystemPrompt
            ? [
                {role: 'system', content: textOnlySystemPrompt},
                {role: 'user', content: currentQ},
              ]
            : [{role: 'user', content: currentQ}],
          conversationId: activeConversationId,
          saveUserMessage: false, // We already saved it
          apiKey: useCustomApiKeyInMultiModel ? customApiKey : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(extractApiErrorMessage(data, response.statusText || '请求失败'))
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      let isFirstChunk = true

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const {done, value} = await reader.read()
        if (done) break

        buffer += decoder.decode(value, {stream: true})
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const lines = event.split('\n')
          const dataLines: string[] = []
          for (const line of lines) {
            if (line.startsWith('data:')) {
              dataLines.push(line.replace(/^data:\s?/, ''))
            }
          }
          const dataStr = dataLines.join('\n').trim()
          if (!dataStr || dataStr === '[DONE]') continue
          try {
            const data = JSON.parse(dataStr)
            if (data.meta && data.meta.conversationId) {
              if (!conversationId.value) {
                conversationId.value = data.meta.conversationId
                router.replace({query: {id: conversationId.value}})
                window.dispatchEvent(new CustomEvent('refresh-sidebar-history'))
              }
            }
            if (data.meta?.route) {
              res.routeMeta = data.meta.route
            }
            if (data.meta?.mode) {
              res.responseMode = data.meta.mode
            }
            if (data.meta?.realtime) {
              res.realtimeMeta = data.meta.realtime
            }

            if (data.error) {
              if (isFirstChunk) {
                res.content = ''
                isFirstChunk = false
              }
              res.content += `\n[Error: ${extractApiErrorMessage(data, '请求失败')}]`
              // If mobile and multi-model, don't auto-scroll to bottom during generation
              const isMobileMultiModel = isMobile.value && selectedModels.value.length > 1
              if (!isMobileMultiModel) {
                scrollToBottom()
              }
            } else if (data.content) {
              if (isFirstChunk) {
                res.content = ''
                isFirstChunk = false
              }
              res.content += data.content
              // If mobile and multi-model, don't auto-scroll to bottom during generation
              const isMobileMultiModel = isMobile.value && selectedModels.value.length > 1
              if (!isMobileMultiModel) {
                scrollToBottom()
              }
            }
          } catch (e) {
            console.error('Error parsing JSON:', e)
          }
        }
      }
    } catch (error: unknown) {
      if (res.content === '正在思考中...') {
        res.content = ''
      }
      res.content += `\n[Connection Error: ${normalizeErrorMessage(error)}]`
    } finally {
      if (res.content === '正在思考中...') {
        res.content = '[Error: 服务器未返回内容]'
      }
      if (!isImageModelId(res.id) && hasImageModelsInTurn) {
        const sanitized = sanitizeTextOnlyContent(res.content)
        if (sanitized) {
          res.content = sanitized
        }
      }
      res.streaming = false
      res.latency = ((Date.now() - startTime) / 1000).toFixed(1) + 's'
      // Ensure scroll triggers after UI updates
      nextTick(() => {
        // If mobile and multi-model, don't auto-scroll to bottom during generation
        // This allows user to read from top model down
        const isMobileMultiModel = isMobile.value && selectedModels.value.length > 1
        if (!isMobileMultiModel) {
          scrollToBottom(true)
        }
      })
      if (newTurn.results.every((r) => !r.streaming)) {
        isGenerating.value = false
        updateWeChatShareData()
      }
    }
  })
}

async function handleToolAction(turnIndex: number, resultId: string, type: string) {
  const turn = turns.value[turnIndex]
  if (!turn) return
  const result = turn.results.find((r) => r.id === resultId)
  if (!result || result.streaming || !result.content.trim()) return

  const output: ToolOutput = {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: getToolLabel(type),
    content: '处理中...',
    loading: true,
  }
  result.toolOutputs.push(output)
  scrollToBottom()

  const prompt = getToolPrompt(type, result.content)
  const startTime = Date.now()
  const headers = withBearerAuth({
    'Content-Type': 'application/json',
  }, authStore.token)

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: result.id,
        messages: [{role: 'user', content: prompt}],
        conversationId: conversationId.value,
        saveUserMessage: false,
        saveAssistantMessage: false,
        useHistory: false,
      }),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(extractApiErrorMessage(data, response.statusText || '请求失败'))
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    let isFirstChunk = true
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const {done, value} = await reader.read()
      if (done) break

      buffer += decoder.decode(value, {stream: true})
      const events = buffer.split('\n\n')
      buffer = events.pop() || ''

      for (const event of events) {
        const lines = event.split('\n')
        const dataLines: string[] = []
        for (const line of lines) {
          if (line.startsWith('data:')) {
            dataLines.push(line.replace(/^data:\s?/, ''))
          }
        }
        const dataStr = dataLines.join('\n').trim()
        if (!dataStr || dataStr === '[DONE]') continue
        try {
          const data = JSON.parse(dataStr)
          if (data.error) {
            if (isFirstChunk) {
              output.content = ''
              isFirstChunk = false
            }
            output.content += `\n[Error: ${extractApiErrorMessage(data, '请求失败')}]`
            scrollToBottom()
          } else if (data.content) {
            if (isFirstChunk) {
              output.content = ''
              isFirstChunk = false
            }
            output.content += data.content
            scrollToBottom()
          }
        } catch (e) {
          console.error('Error parsing JSON:', e)
        }
      }
    }
  } catch (error: unknown) {
    if (output.content === '处理中...') {
      output.content = ''
    }
    output.content += `\n[Connection Error: ${normalizeErrorMessage(error)}]`
  } finally {
    output.loading = false
    result.latency = result.latency || ((Date.now() - startTime) / 1000).toFixed(1) + 's'
  }
}

function handleUpgrade() {
  showUpgradeLimitModal.value = false
  router.push('/membership')
}
</script>

<template>
  <div class="w-full h-full flex bg-slate-50 dark:bg-slate-900 transition-colors">
    <!-- Sidebar is now handled by MainLayout -->
    <!-- We removed the local <Sidebar> component to avoid duplication -->

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors">
      <!-- Header Area -->
      <header ref="chatHeaderRef" class="flex-none px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-20 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <!-- Mobile Menu Toggle -->
          <button @click="appStore.toggleMobileMenu()" class="lg:hidden p-2 -ml-2 mr-2 text-slate-500 hover:text-slate-900 active:bg-slate-100 rounded-lg transition-all">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img
              src="/logo.svg"
              alt="全智AI"
              class="h-10 w-10 sm:h-11 sm:w-11 shrink-0"
            />
            <div class="flex flex-col min-w-0">
              <h1 class="text-base sm:text-xl font-bold text-slate-800 dark:text-white tracking-tight leading-none">
                <span class="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-500 dark:from-indigo-400 dark:via-violet-400 dark:to-blue-300 whitespace-nowrap">
                  全智AI
                </span>
              </h1>
              <p class="mt-1 pl-0.5 text-[10px] sm:text-[11px] font-medium tracking-[0.08em] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                一次访问，多种结果
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <!-- Dark Mode Toggle (Desktop only) -->
          <button @click="toggleDark" class="hidden sm:block p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors">
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          </button>

          <!-- Share Link -->
          <div class="flex items-center gap-2">
            <div v-if="headerModelSelectionSummary.visibleIds.length > 0" class="flex items-center gap-1.5 shrink-0">
              <div
                v-for="id in headerModelSelectionSummary.visibleIds"
                :key="`header-selected-${id}`"
                class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/85 dark:bg-slate-800/85 border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden"
                :title="getModelName(id)">
                <img
                  v-if="getModelLogo(id)"
                  :src="getModelLogo(id)"
                  @error="markLogoFailed(id)"
                  class="w-full h-full object-cover"
                  :alt="getModelName(id)" />
                <div v-else class="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-300">
                  {{ getModelName(id).substring(0, 1) }}
                </div>
              </div>
              <div
                v-if="headerModelSelectionSummary.hiddenCount > 0"
                class="min-w-[1.75rem] h-7 sm:min-w-[2rem] sm:h-8 px-2 rounded-full bg-slate-100/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-300 flex items-center justify-center shadow-sm">
                +{{ headerModelSelectionSummary.hiddenCount }}
              </div>
            </div>
            <button
              @click="handleShareClick"
              :class="[
                'p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-[11px] font-semibold border transition-all backdrop-blur-sm shadow-sm flex items-center justify-center',
                'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-white/60 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-md',
              ]">
              <svg class="w-4 h-4 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span class="hidden sm:inline">{{ shareCopied ? '已复制' : (isWeChat ? '去分享' : '分享') }}</span>
            </button>
          </div>

          <!-- Model Selection (Compact on Mobile) -->
          <!-- Moved to bottom -->
        </div>
      </header>

      <!-- Messages Area -->
      <div
        ref="scrollContainer"
        @scroll="onScroll"
        @wheel.passive="collapseModelPanelOnAnswerGesture"
        @touchmove.passive="collapseModelPanelOnAnswerGesture"
        :class="[
          'flex-1 overflow-y-auto scroll-smooth custom-scrollbar relative z-10',
          showEmptyStatePromo ? EMPTY_STATE_PROMO_SCROLL_CLASS : 'p-4 sm:p-6 space-y-8',
        ]">
        <div v-if="showEmptyStatePromo" :class="EMPTY_STATE_PROMO_CONTAINER_CLASS">
          <a
            :href="EMPTY_STATE_PROMO.href"
            target="_blank"
            rel="noopener noreferrer"
            class="group relative w-full min-h-[300px] sm:min-h-[380px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,245,255,0.98)_42%,rgba(224,242,254,0.9)_100%)] px-6 py-7 sm:px-10 sm:py-9 text-left shadow-[0_20px_60px_-40px_rgba(59,130,246,0.35)] transition-all duration-300 hover:shadow-[0_28px_80px_-44px_rgba(79,70,229,0.42)]">
            <div class="absolute inset-y-0 right-0 w-[42%] bg-[linear-gradient(180deg,rgba(99,102,241,0.12),rgba(59,130,246,0.08),transparent)]"></div>
            <div class="absolute -right-10 top-10 h-40 w-40 rounded-full bg-indigo-200/30 blur-3xl"></div>
            <div class="absolute right-12 bottom-10 h-24 w-24 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm"></div>
            <div class="relative flex h-full flex-col justify-between gap-6">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-rose-500 shadow-sm">
                    {{ EMPTY_STATE_PROMO.eyebrow }}
                  </span>
                  <span class="hidden sm:inline text-[11px] font-medium tracking-[0.08em] text-slate-400">
                    Sponsored
                  </span>
                </div>
                <h2 class="mt-5 text-[30px] sm:text-[40px] leading-none font-black tracking-tight text-slate-900">
                  {{ EMPTY_STATE_PROMO.title }}
                </h2>
                <p class="mt-3 text-base sm:text-[22px] font-semibold text-indigo-600">
                  {{ EMPTY_STATE_PROMO.subtitle }}
                </p>
                <p class="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-slate-600">
                  {{ EMPTY_STATE_PROMO.description }}
                </p>
              </div>
            </div>

            <div class="relative mt-auto flex items-center justify-between gap-3 border-t border-white/70 pt-5">
              <span class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span class="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(74,222,128,0.15)]"></span>
                真人解答入口
              </span>
              <span class="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 group-hover:bg-indigo-600">
                {{ EMPTY_STATE_PROMO.cta }}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </a>
        </div>

        <div v-for="(turn, tIndex) in turns" :key="tIndex" class="space-y-6 animate-fade-in-up">
          <!-- User Question -->
          <div class="flex justify-end">
            <div class="max-w-[90%] sm:max-w-[75%] bg-gradient-to-br from-slate-800 to-slate-900 dark:from-indigo-900 dark:to-indigo-800 text-white px-6 py-4 rounded-2xl rounded-tr-sm shadow-lg shadow-slate-200/50 dark:shadow-none text-base leading-relaxed">
              {{ turn.question }}
            </div>
          </div>

          <div
            v-if="getDisplayTurnResults(turn).length > 1 && getRecommendedResult(turn)"
            class="flex items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/60 dark:via-slate-900 dark:to-slate-900 dark:text-slate-300">
            <div class="flex items-center gap-3 min-w-0">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <div class="min-w-0">
                <div class="font-semibold text-slate-800 dark:text-slate-100">
                  推荐答案：{{ getRecommendedResult(turn)?.name }}
                </div>
                <div class="truncate text-xs text-slate-500 dark:text-slate-400">
                  {{ getResultRouteSubtitle(getRecommendedResult(turn)!) }}
                </div>
              </div>
            </div>
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
              {{ turn.pinnedResultId ? '手动置顶' : '系统推荐' }}
            </div>
          </div>

          <!-- Model Responses Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div
              v-for="res in getSortedTurnResults(turn)"
              :key="res.id"
              :class="[
                'flex flex-col bg-white/70 dark:bg-slate-800/70 backdrop-blur-md rounded-2xl border border-white/60 dark:border-slate-700/60 shadow-sm hover:shadow-lg hover:shadow-indigo-500/10 dark:hover:shadow-black/30 transition-shadow duration-300 overflow-hidden group',
                isRecommendedResult(turn, res.id) ? 'ring-2 ring-indigo-300/80 dark:ring-indigo-500/40 shadow-indigo-200/40' : '',
              ]">
              <!-- Card Header -->
              <div class="px-5 py-4 border-b border-indigo-50/50 dark:border-slate-700/50 bg-gradient-to-r from-white/40 to-transparent dark:from-slate-700/20 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 shadow-sm p-1 flex items-center justify-center border border-indigo-50/50 dark:border-slate-600">
                    <img :src="getDisplayResultLogo(res)" @error="markLogoFailed(res.id)" class="w-full h-full object-contain rounded" v-if="getDisplayResultLogo(res)" />
                    <div v-else class="text-xs font-bold text-slate-400">{{ getDisplayResultName(res).substring(0, 1) }}</div>
                  </div>
                  <div>
                    <div class="font-bold text-sm text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{{ getDisplayResultName(res) }}</div>
                    <div class="flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                      <span v-if="res.latency" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">{{ res.latency }}</span>
                      <span
                        v-if="getDisplayTurnResults(turn).length > 1 && isRecommendedResult(turn, res.id)"
                        class="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {{ turn.pinnedResultId === res.id ? '主回答' : '推荐' }}
                      </span>
                      <span
                        :class="[
                          'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                          res.responseMode === 'realtime_quote' ? 'border-sky-200 bg-sky-50 text-sky-600' : getModelStatusBadgeClass(res.id),
                        ]">
                        {{ res.responseMode === 'realtime_quote' ? '实时' : (res.routeMeta?.statusText || getModelStatusLabel(res.id)) }}
                      </span>
                      <span v-if="res.streaming" class="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                        <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse"></span>
                        生成中...
                      </span>
                    </div>
                    <div class="mt-1 text-[11px] text-slate-400">
                      {{ getResultRouteSubtitle(res) }}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1">
                  <button
                    v-if="getDisplayTurnResults(turn).length > 1 && !isImageModelId(res.id) && res.responseMode !== 'realtime_quote'"
                    @click="setPinnedResult(turn, res.id)"
                    :class="[
                      'p-1.5 rounded-lg transition-colors',
                      turn.pinnedResultId === res.id
                        ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                        : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30',
                    ]"
                    :title="turn.pinnedResultId === res.id ? '当前主回答' : '设为主回答'">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3l14 9-14 9V3z" />
                    </svg>
                  </button>
                  <button
                    v-if="ttsSupported"
                    @click="toggleSpeak(`${tIndex}-${res.id}`, res.content)"
                    :class="['p-1.5 rounded-lg transition-colors', speakingKey === `${tIndex}-${res.id}` ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-300 hover:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700']"
                    title="朗读">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  </button>
                  <button
                    @click="copyContent(`${tIndex}-${res.id}`, res.content)"
                    :class="['p-1.5 rounded-lg transition-colors', copiedStates[`${tIndex}-${res.id}`] ? 'text-green-500 bg-green-50 dark:bg-green-900/20' : 'text-slate-300 hover:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700']"
                    :title="copiedStates[`${tIndex}-${res.id}`] ? '已复制' : '复制'">
                    <svg v-if="copiedStates[`${tIndex}-${res.id}`]" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button v-if="!res.streaming && tIndex === turns.length - 1" @click="regenerateResponse(tIndex, res.id)" class="p-1.5 rounded-lg text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="重新生成">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>

              <!-- Card Content with Reasoning Visualization -->
              <div class="flex-1 p-5 min-h-[120px] text-sm leading-relaxed text-slate-600 dark:text-slate-300 relative">
                <div v-if="isImageModelId(res.id) && res.streaming" class="space-y-3">
                  <div class="text-xs text-slate-400">正在生成图片，请稍候...</div>
                  <div class="grid grid-cols-2 gap-3">
                    <div v-for="idx in getImageModelCount(res.id)" :key="idx" class="space-y-2">
                      <div class="aspect-square rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
                      <div class="h-3 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                <div v-else-if="!res.content && res.streaming" class="flex items-center gap-2 text-slate-400 animate-pulse">
                  <div class="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                  <div class="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full animation-delay-200"></div>
                  <div class="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full animation-delay-400"></div>
                </div>
                <div
                  v-else
                  class="prose prose-slate dark:prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:text-slate-700 dark:prose-headings:text-slate-200 prose-a:text-indigo-500 prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:bg-indigo-50 dark:prose-code:bg-indigo-900/30 prose-code:px-1 prose-code:rounded prose-pre:bg-slate-900 prose-pre:rounded-xl">
                  <pre v-if="res.content.startsWith('[Error')" class="text-rose-500 bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg border border-rose-100 dark:border-rose-800 whitespace-pre-wrap font-sans text-xs">{{ res.content }}</pre>

                  <div v-else>
                    <template v-for="(segment, sIdx) in parseMessageContent(res.content)" :key="sIdx">
                      <!-- Reasoning Block -->
                      <div v-if="segment.type === 'thought'" class="my-3 border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                        <details class="group/thought">
                          <summary class="list-none flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-400 hover:text-indigo-500 transition-colors">
                            <span class="bg-indigo-50 dark:bg-indigo-900/30 p-1 rounded text-indigo-500 dark:text-indigo-400">
                              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </span>
                            思考过程
                            <svg class="w-3 h-3 transform transition-transform group-open/thought:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                          </summary>
                          <div class="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                            {{ segment.content }}
                          </div>
                        </details>
                      </div>

                      <!-- Normal Text -->
                      <div v-else class="break-words" v-html="renderMarkdown(segment.content)"></div>
                    </template>
                  </div>

                  <span v-if="res.streaming" class="inline-block w-1.5 h-4 ml-0.5 align-middle bg-indigo-400 animate-pulse"></span>
                </div>
              </div>

              <!-- Card Actions (Tools) -->
              <div class="px-5 py-3 border-t border-slate-100/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 flex flex-wrap gap-2" v-if="!res.streaming && res.content && !isImageModelId(res.id)">
                <button
                  v-for="action in toolActions"
                  :key="action.type"
                  @click="handleToolAction(tIndex, res.id, action.type)"
                  class="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-600 hover:shadow-md transition-all active:scale-95">
                  {{ action.label }}
                </button>
              </div>

              <!-- Tool Outputs -->
              <div v-if="res.toolOutputs.length > 0" class="border-t border-slate-100/50 dark:border-slate-700/50 bg-slate-50/80 dark:bg-slate-800/80 p-4 space-y-3">
                <div v-for="output in res.toolOutputs" :key="output.id" class="bg-white dark:bg-slate-700 rounded-xl border border-slate-200/60 dark:border-slate-600 shadow-sm overflow-hidden animate-fade-in">
                  <div class="px-3 py-2 bg-slate-100/50 dark:bg-slate-600/50 border-b border-slate-100 dark:border-slate-600 text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    {{ output.label }}
                  </div>
                  <div class="p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <div v-if="output.loading" class="flex items-center gap-2 text-slate-400">
                      <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      生成中...
                    </div>
                    <div v-else class="whitespace-pre-wrap">{{ output.content }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Spacer for bottom input -->
        <div class="h-12"></div>
      </div>

      <!-- Scroll to Bottom Button -->
      <div class="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 animate-bounce-small" v-if="isUserScrolling">
        <button @click="scrollToBottom(true)" class="flex items-center gap-2 px-4 py-2 bg-slate-800/80 dark:bg-slate-700/80 backdrop-blur text-white rounded-full shadow-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-all text-xs font-medium">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          <span>查看最新消息</span>
        </button>
      </div>

      <!-- Input Area -->
      <div ref="inputAreaRef" class="flex-none flex flex-col items-center justify-end p-0 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-50 dark:bg-slate-900 w-full border-t border-indigo-50/50 dark:border-slate-800 z-50" :style="inputContainerStyle">
        <!-- Model Selector (Collapsible) -->
        <div ref="modelSelectorRef" class="relative w-full max-w-4xl mx-auto mb-1 flex flex-col items-center transition-all duration-300 ease-in-out">
          <button
            @click="toggleModelPanel()"
            @pointerdown="onModelSelectorPointerDown"
            @pointermove="onModelSelectorPointerMove"
            @pointerup="onModelSelectorPointerUp"
            @pointercancel="onModelSelectorPointerUp"
            class="w-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex items-center justify-between group touch-none">
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 min-w-0">
              <span class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {{ isModelPanelExpanded ? '选择模型' : '已选模型' }}
              </span>
              <div v-if="selectedModels.length === 0" class="text-xs text-slate-400 italic">未选择模型</div>
              <span
                class="text-xs font-medium px-2 py-1 rounded-lg"
                :class="selectedModels.length === 3 ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'">
                已选 {{ selectedModels.length }}/{{ models.length }}
              </span>
              <div class="flex items-center gap-1.5">
                <div v-for="id in selectedModels" :key="id" class="relative group/icon shrink-0">
                  <div class="w-6 h-6 rounded bg-slate-50 dark:bg-slate-700 p-0.5 border border-slate-200 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                    <img :src="getModelLogo(id)" @error="markLogoFailed(id)" class="w-full h-full object-cover rounded-sm" v-if="getModelLogo(id)" />
                    <div v-else class="text-[10px] font-bold text-slate-400">{{ getModelName(id).substring(0, 1) }}</div>
                  </div>
                  <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                    {{ getModelName(id) }}
                    <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="text-slate-400 group-hover:text-indigo-500 transition-colors px-1">
              <svg :class="['w-4 h-4 transform transition-transform duration-300', isModelPanelExpanded ? 'rotate-180' : 'rotate-0']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          <transition name="model-collapse">
            <div v-show="isModelPanelExpanded" class="absolute inset-x-0 bottom-full mb-2 z-30 overflow-hidden">
              <div
                ref="modelPanelBodyRef"
                @scroll.passive="onModelPanelScroll"
                @pointerdown="onModelSelectorPointerDown"
                @pointermove="onModelSelectorPointerMove"
                @pointerup="onModelSelectorPointerUp"
                @pointercancel="onModelSelectorPointerUp"
                :style="modelPanelBodyStyle"
                :class="[
                  'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 sm:p-5 shadow-sm custom-scrollbar origin-bottom',
                  isModelPanelAtTop ? 'overflow-y-auto touch-pan-y' : 'overflow-y-hidden touch-none',
                ]">
                <div v-if="modelSelectionNotice" class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                  {{ modelSelectionNotice }}
                </div>
                <div class="space-y-4 sm:space-y-6">
                  <div v-for="group in visibleCategories" :key="group.name">
                    <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sm:mb-3 pl-1">{{ group.name }}</h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                      <div
                        v-for="model in group.models"
                        :key="model.id"
                        @click="toggleModel(model.id)"
                        :title="getModelTooltip(model.id)"
                        :class="[
                          'cursor-pointer relative group rounded-xl border p-2 sm:p-3 transition-all duration-300 active:scale-95 touch-manipulation',
                          disabledModelIds.includes(model.id)
                            ? 'opacity-50 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                            : '',
                          selectedModels.includes(model.id)
                            ? 'bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-900/30 dark:to-slate-800 border-indigo-200 dark:border-indigo-800 shadow-md shadow-indigo-100 dark:shadow-none ring-1 ring-indigo-200 dark:ring-indigo-800'
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-md dark:hover:shadow-black/20',
                        ]">
                        <div class="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                          <div class="w-8 h-8 sm:w-8 sm:h-8 rounded-lg overflow-hidden shrink-0 bg-white dark:bg-slate-700 shadow-sm p-0.5">
                            <img :src="getModelLogo(model.id)" @error="markLogoFailed(model.id)" class="w-full h-full object-cover rounded-md" v-if="getModelLogo(model.id)" />
                            <div v-else class="w-full h-full bg-slate-50 dark:bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-400 rounded-md">
                              {{ model.name.substring(0, 1) }}
                            </div>
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="font-bold text-[0.85rem] sm:text-sm text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight">{{ model.name }}</div>
                            <div class="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span class="text-[0.65rem] sm:text-[10px] text-slate-400 truncate">
                                {{ model.category }}
                              </span>
                              <span
                                :class="[
                                  'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold',
                                  getModelStatusBadgeClass(model.id),
                                ]">
                                {{ getModelStatusLabel(model.id) }}
                              </span>
                            </div>
                            <div class="text-[0.65rem] sm:text-[10px] text-slate-400 truncate mt-1">
                              {{ getModelStatusHint(model.id) }}
                            </div>
                          </div>
                        </div>
                        <div v-if="selectedModels.includes(model.id)" class="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-sm animate-scale-in">
                          <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      </div>
                    </div>
                    <div
                      v-if="hasLoadedModelStatus && group.hiddenUnavailableCount > 0"
                      class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      <div>{{ group.unavailableExpanded ? '已展开未接入模型' : `已隐藏 ${group.hiddenUnavailableCount} 个未接入模型` }}</div>
                      <button
                        type="button"
                        @click.stop="toggleCategoryUnavailableVisibility(group.name)"
                        class="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600">
                        {{ group.unavailableExpanded ? '收起未接入' : '显示未接入' }}
                      </button>
                    </div>
                  </div>
                  <div v-if="visibleModelLimit < visiblePanelModelCount" class="py-2 text-center text-xs text-slate-400">
                    下滑继续加载更多模型...
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <div class="w-full max-w-4xl">
          <div
            v-if="inputActionNotice"
            :class="[
              'mb-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm backdrop-blur-sm',
              inputActionNoticeTone === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : inputActionNoticeTone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-sky-200 bg-sky-50 text-sky-700',
            ]">
            {{ inputActionNotice }}
          </div>

          <div :class="['w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-[2rem] p-2 transition-all duration-300 focus-within:shadow-indigo-500/10 focus-within:border-indigo-500/30', isInputFocused ? 'shadow-indigo-500/10' : '']">
          <div class="relative flex items-end gap-2 p-1">
            <!-- Voice Button -->
            <button
              @click="showPromptMarket = true"
              class="p-3 rounded-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all duration-300 shrink-0 flex items-center justify-center group"
              title="提示词市场">
              <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
            <button
              v-if="speechSupported"
              @click="toggleListening"
              :class="[
                'p-3 rounded-full border transition-all duration-300 shrink-0 flex items-center justify-center group',
                isListening
                  ? 'bg-rose-500 border-rose-600 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                  : 'bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300',
              ]"
              :title="isListening ? '停止听写' : isWeChat ? '微信语音输入' : '语音输入'">
              <svg v-if="isListening" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <svg v-else class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <!-- Text Input Wrapper -->
            <div class="flex-1 relative min-w-0">
              <!-- Ghost Textarea for Height Calculation -->
              <textarea ref="ghostTextareaRef" class="absolute top-0 left-0 w-full h-auto opacity-0 pointer-events-none -z-50 py-3 px-2 text-base leading-relaxed resize-none overflow-hidden border-none" rows="1" aria-hidden="true"></textarea>

              <!-- Real Input -->
              <textarea
                ref="textareaRef"
                v-model="question"
                @focus="handleFocus"
                @input="handleInput"
                @blur="handleBlur"
                @keydown.enter.prevent="handleGenerate"
                rows="1"
                placeholder="问点什么..."
                class="w-full bg-transparent border-none text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:ring-0 resize-none py-3 px-2 max-h-[400px] overflow-y-auto text-base leading-relaxed transition-all duration-300 ease-in-out !outline-none !shadow-none"></textarea>
            </div>

            <!-- Send Button -->
            <button
              @click="handleGenerate"
              :disabled="!question.trim() || isGenerating"
              :class="[
                'p-3 rounded-full transition-all duration-300 shrink-0 flex items-center justify-center shadow-md',
                question.trim() && !isGenerating ? 'bg-indigo-600 text-white shadow-indigo-500/30 hover:bg-indigo-700 hover:scale-105 active:scale-95' : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed',
              ]">
              <svg v-if="isGenerating" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>

    <!-- User Profile Modal -->
    <UserProfileModal :isOpen="showProfile" @close="showProfile = false" />

    <!-- Register Modal -->
    <RegisterModal :isOpen="showRegisterModal" @close="showRegisterModal = false" />

    <!-- Prompt Market -->
    <PromptMarketModal :isOpen="showPromptMarket" @close="showPromptMarket = false" @select="handlePromptSelect" />

    <!-- Upgrade Limit Modal -->
    <div v-if="showUpgradeLimitModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="showUpgradeLimitModal = false"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div class="text-center space-y-4">
          <div class="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          <h3 class="text-xl font-bold text-slate-800 dark:text-white">解锁无限模型选择</h3>
          <p class="text-slate-600 dark:text-slate-400">免费版最多支持同时选择 3 个模型。升级到专业版会员，即可解锁无限模型同时对话能力，体验更强大的 AI 协同创作！</p>

          <div class="grid grid-cols-2 gap-3 pt-4">
            <button @click="showUpgradeLimitModal = false" class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">稍后再说</button>
            <button @click="handleUpgrade" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95 transition-all">立即升级</button>
          </div>
        </div>
      </div>
    </div>

    <!-- WeChat Share Guide -->
    <div v-if="showWeChatShareGuide" class="fixed inset-0 z-[110]">
      <div class="absolute inset-0 bg-black/55 backdrop-blur-[1px]" @click="showWeChatShareGuide = false"></div>
      <div class="absolute top-6 right-6 sm:top-8 sm:right-10 text-white text-right space-y-3 pointer-events-none">
        <div class="flex justify-end">
          <svg class="w-16 h-16 sm:w-20 sm:h-20 text-white/90" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M5 19L19 5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M13 5H19V11" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="rounded-2xl bg-white/14 border border-white/25 px-4 py-3 text-sm leading-relaxed max-w-[250px] ml-auto">
          分享内容已准备好，点击微信右上角 <span class="font-semibold">...</span> 然后选择“发送给朋友”或“分享到朋友圈”。
        </div>
      </div>
      <div class="absolute bottom-8 inset-x-0 flex justify-center">
        <button
          @click="showWeChatShareGuide = false"
          class="px-5 py-2.5 rounded-full bg-white text-slate-700 text-sm font-semibold shadow-lg border border-slate-200">
          我知道了
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom Scrollbar for Messages */
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

/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.model-collapse-enter-active,
.model-collapse-leave-active {
  transition:
    max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.24s ease,
    transform 0.24s ease;
  will-change: max-height, opacity, transform;
}
.model-collapse-enter-from,
.model-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-6px) scale(0.995);
}
.model-collapse-enter-to,
.model-collapse-leave-from {
  max-height: 120vh;
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>
