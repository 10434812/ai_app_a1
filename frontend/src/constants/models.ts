export type FrontendModelCategory = '对话' | '编程' | '视频' | '绘图' | '搜索' | '办公' | '语音'

export interface FrontendModel {
  id: string
  name: string
  category: FrontendModelCategory
  website: string
  description?: string
  logo?: string
}

export interface FrontendModelPublicStatus {
  id: string
  provider?: string | null
  isActive?: boolean
  isConfigured?: boolean
  status?: 'configured' | 'placeholder' | 'disabled' | string
  statusText?: string
  source?: 'custom' | 'default' | 'image-settings' | 'placeholder' | string
  upstreamModelId?: string | null
  baseURL?: string | null
}

export const AVAILABLE_MODELS: FrontendModel[] = [
  // --- 对话 (Chat) - 国内优先 ---
  {id: 'deepseek-v3', name: 'DeepSeek-V3', category: '对话', website: 'https://www.deepseek.com', description: '通用对话、写作与代码能力'},
  {id: 'deepseek-r1', name: 'DeepSeek-R1', category: '对话', website: 'https://www.deepseek.com', description: '深度推理、数学分析与复杂问题拆解'},
  {id: 'glm-4', name: '智谱 GLM', category: '对话', website: 'https://www.zhipuai.cn', description: '中文稳定，兼顾工具调用与复杂问答'},
  {id: 'qwen-turbo', name: '通义千问 Turbo', category: '对话', website: 'https://tongyi.aliyun.com', description: '低延迟日常问答与高并发场景'},
  {id: 'qwen-plus', name: '通义千问 Plus', category: '对话', website: 'https://tongyi.aliyun.com', description: '更强中文理解、工具使用与复杂任务'},
  {id: 'moonshot-v1', name: 'Kimi (月之暗面)', category: '对话', website: 'https://www.moonshot.cn'},
  {id: 'doubao-pro', name: '豆包 (字节跳动)', category: '对话', website: 'https://www.doubao.com'},
  {id: 'hunyuan', name: '腾讯混元', category: '对话', website: 'https://hunyuan.tencent.com'},
  {id: 'hailuo', name: '海螺AI (MiniMax)', category: '对话', website: 'https://www.hailuoai.com'},
  {id: 'yi', name: '零一万物 (Yi)', category: '对话', website: 'https://www.lingyiwanwu.com'},
  {id: 'step-1', name: '跃问 (阶跃星辰)', category: '对话', website: 'https://platform.stepfun.com'},
  {id: 'baichuan', name: '百川智能', category: '对话', website: 'https://baichuan-ai.com'},
  {id: 'tiangong', name: '天工AI', category: '对话', website: 'https://tiangong.cn'},
  {id: 'lingguang-ai', name: '灵光AI', category: '对话', website: 'https://www.lingguang.com/chat'},

  // --- 对话 (Chat) - 国外占位 ---
  {id: 'chatgpt', name: 'ChatGPT (OpenAI)', category: '对话', website: 'https://openai.com'},
  {id: 'claude', name: 'Claude (Anthropic)', category: '对话', website: 'https://anthropic.com'},
  {id: 'gemini', name: 'Gemini (Google)', category: '对话', website: 'https://gemini.google.com'},
  {id: 'grok', name: 'Grok (xAI)', category: '对话', website: 'https://x.ai'},

  // --- 编程 (Coding) - 国内优先 ---
  {id: 'qwen-coder', name: 'Qwen Coder', category: '编程', website: 'https://tongyi.aliyun.com', description: '代码生成、修复、重构与调试'},
  {id: 'marscode', name: '豆包 MarsCode', category: '编程', website: 'https://marscode.cn'},
  {id: 'codegeex', name: 'CodeGeeX', category: '编程', website: 'https://codegeex.cn'},
  {id: 'fitten', name: 'Fitten Code', category: '编程', website: 'https://fitten.ai'},
  {id: 'manus', name: 'Manus (Agent)', category: '编程', website: 'https://manus.im'},

  // --- 编程 (Coding) - 国外占位 ---
  {id: 'cursor', name: 'Cursor', category: '编程', website: 'https://cursor.com'},
  {id: 'github-copilot', name: 'GitHub Copilot', category: '编程', website: 'https://github.com/features/copilot'},

  // --- 视频 (Video) - 国内优先 ---
  {id: 'kling', name: '可灵AI (Kling)', category: '视频', website: 'https://klingai.com'},
  {id: 'vidu', name: 'Vidu (生数科技)', category: '视频', website: 'https://www.vidu.studio'},
  {id: 'jimeng', name: '即梦AI (字节)', category: '视频', website: 'https://jimeng.jianying.com'},

  // --- 视频 (Video) - 国外占位 ---
  {id: 'runway', name: 'Runway', category: '视频', website: 'https://runwayml.com'},
  {id: 'sora-luma', name: 'Luma Dream Machine', category: '视频', website: 'https://lumalabs.ai'},

  // --- 绘图 (Image) - 国内优先 ---
  {id: 'aliyun-image', name: '阿里万相 (直连)', category: '绘图', website: 'https://tongyi.aliyun.com/wanxiang'},
  {id: 'zhipu-image', name: '智谱 CogView (直连)', category: '绘图', website: 'https://www.zhipuai.cn'},
  {id: 'liblib', name: 'LiblibAI', category: '绘图', website: 'https://www.liblib.art'},
  {id: 'kolors', name: '可图 (Kolors)', category: '绘图', website: 'https://kolors.kuaishou.com'},
  {id: 'whee', name: 'WHEE (美图)', category: '绘图', website: 'https://www.whee.com'},

  // --- 绘图 (Image) - 国外占位 ---
  {id: 'midjourney', name: 'Midjourney', category: '绘图', website: 'https://midjourney.com'},
  {id: 'flux', name: 'FLUX.1', category: '绘图', website: 'https://blackforestlabs.ai'},

  // --- 搜索 (Search) - 国内优先 ---
  {id: 'metaso', name: '秘塔AI搜索', category: '搜索', website: 'https://metaso.cn'},
  {id: '360-gpt', name: '360AI搜索', category: '搜索', website: 'https://so.360.com'},

  // --- 搜索 (Search) - 国外占位 ---
  {id: 'perplexity', name: 'Perplexity', category: '搜索', website: 'https://perplexity.ai'},

  // --- 办公 (Office) ---
  {id: 'spark', name: '讯飞星火', category: '办公', website: 'https://xinghuo.xfyun.cn'},
  {id: 'notion', name: 'Notion AI', category: '办公', website: 'https://notion.so'},
  {id: 'gamma', name: 'Gamma (PPT)', category: '办公', website: 'https://gamma.app'},

  // --- 语音 (Audio) ---
  {id: 'suno', name: 'Suno', category: '语音', website: 'https://suno.com'},
  {id: 'udio', name: 'Udio', category: '语音', website: 'https://udio.com'},
]

export const DEFAULT_SELECTED_MODELS = ['deepseek-v3', 'glm-4', 'qwen-turbo']

export const MODEL_CATEGORY_ORDER = ['对话', '绘图', '编程', '办公', '视频', '语音', '搜索', '其他'] as const

const MODEL_BASE_INDEX = new Map(AVAILABLE_MODELS.map((model, index) => [model.id, index]))
const CONFIGURED_TAIL_MODEL_IDS = ['deepseek-r1', 'qwen-plus'] as const
const CONFIGURED_TAIL_INDEX: Map<string, number> = new Map(CONFIGURED_TAIL_MODEL_IDS.map((id, index) => [id, index]))

const MODEL_VENDOR_MAP: Record<string, string> = {
  'deepseek-v3': 'deepseek',
  'deepseek-r1': 'deepseek',
  'glm-4': 'zhipu',
  'zhipu-image': 'zhipu',
  'qwen-turbo': 'qwen',
  'qwen-plus': 'qwen',
  'qwen-coder': 'qwen',
  'aliyun-image': 'aliyun',
  wanxiang: 'aliyun',
  'moonshot-v1': 'moonshot',
  'doubao-pro': 'doubao',
  marscode: 'doubao',
  hunyuan: 'tencent',
  hailuo: 'minimax',
  yi: 'yi',
  'step-1': 'stepfun',
  baichuan: 'baichuan',
  tiangong: 'tiangong',
  'lingguang-ai': 'lingguang',
  liblib: 'liblib',
  kolors: 'kolors',
  whee: 'whee',
  metaso: 'metaso',
  '360-gpt': '360',
  spark: 'iflytek',
  suno: 'suno',
  udio: 'udio',
}

const MODEL_COST_PRIORITY: Record<string, number> = {
  'deepseek-v3': 10,
  'deepseek-r1': 80,
  'glm-4': 40,
  'qwen-turbo': 10,
  'qwen-plus': 30,
  'qwen-coder': 35,
  'moonshot-v1': 60,
  'doubao-pro': 20,
  hunyuan: 35,
  hailuo: 45,
  yi: 35,
  'step-1': 25,
  baichuan: 30,
  tiangong: 30,
  'lingguang-ai': 30,
  'aliyun-image': 20,
  wanxiang: 20,
  'zhipu-image': 35,
  kolors: 30,
  liblib: 40,
  whee: 35,
}

const getModelConfiguredRank = (status?: FrontendModelPublicStatus | null) => {
  if (!status) return 2
  if (status.status === 'disabled') return 3
  if (status.status === 'configured') return 0
  return 1
}

const getModelVendorKey = (model: FrontendModel) => MODEL_VENDOR_MAP[model.id] || model.id

const getModelCostRank = (model: FrontendModel) => MODEL_COST_PRIORITY[model.id] ?? 50

const getModelBaseIndex = (model: FrontendModel) => MODEL_BASE_INDEX.get(model.id) ?? Number.MAX_SAFE_INTEGER

export const sortModelsByDisplayPriority = (
  list: FrontendModel[],
  statusMap: Record<string, FrontendModelPublicStatus> = {},
) => {
  const vendorOrder = new Map<string, number>()
  let nextVendorOrder = 0

  for (const model of AVAILABLE_MODELS) {
    const vendorKey = getModelVendorKey(model)
    if (!vendorOrder.has(vendorKey)) {
      vendorOrder.set(vendorKey, nextVendorOrder)
      nextVendorOrder += 1
    }
  }

  return [...list].sort((a, b) => {
    const statusA = statusMap[a.id]
    const statusB = statusMap[b.id]

    const configuredRankDiff = getModelConfiguredRank(statusA) - getModelConfiguredRank(statusB)
    if (configuredRankDiff !== 0) return configuredRankDiff

    if (getModelConfiguredRank(statusA) === 0 && getModelConfiguredRank(statusB) === 0) {
      const tailRankA = CONFIGURED_TAIL_INDEX.has(a.id) ? 1 : 0
      const tailRankB = CONFIGURED_TAIL_INDEX.has(b.id) ? 1 : 0
      if (tailRankA !== tailRankB) return tailRankA - tailRankB

      if (tailRankA === 1 && tailRankB === 1) {
        return (CONFIGURED_TAIL_INDEX.get(a.id) ?? 0) - (CONFIGURED_TAIL_INDEX.get(b.id) ?? 0)
      }
    }

    const vendorA = getModelVendorKey(a)
    const vendorB = getModelVendorKey(b)
    const vendorRankDiff = (vendorOrder.get(vendorA) ?? 999) - (vendorOrder.get(vendorB) ?? 999)
    if (vendorRankDiff !== 0) return vendorRankDiff

    if (vendorA === vendorB) {
      const costRankDiff = getModelCostRank(a) - getModelCostRank(b)
      if (costRankDiff !== 0) return costRankDiff
    }

    return getModelBaseIndex(a) - getModelBaseIndex(b)
  })
}

const AVAILABLE_MODEL_ID_SET = new Set(AVAILABLE_MODELS.map((model) => model.id))

export const normalizeSelectedModelIds = (ids: string[]) => {
  const normalized: string[] = []
  for (const id of ids) {
    if (!AVAILABLE_MODEL_ID_SET.has(id) || normalized.includes(id)) continue
    normalized.push(id)
  }
  return normalized
}

export const isAvailableModelId = (id: string) => AVAILABLE_MODEL_ID_SET.has(id)
