export type ModelCategory = '对话' | '编程' | '视频' | '绘图' | '搜索' | '办公' | '语音' | '其他'

export interface ModelConfig {
  id: string
  name: string
  category: ModelCategory
  provider: 'openai' | 'mock' | 'other'
  apiConfig?: {
    apiKeyEnv: string
    baseURL: string
    modelId: string
  }
  description?: string
}

export const ALL_MODELS: ModelConfig[] = [
  // 对话 - 国内
  {
    id: 'deepseek-v3',
    name: 'DeepSeek-V3',
    category: '对话',
    provider: 'openai',
    apiConfig: {apiKeyEnv: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com', modelId: 'deepseek-chat'},
    description: '通用对话、写作与代码能力',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek-R1',
    category: '对话',
    provider: 'openai',
    apiConfig: {apiKeyEnv: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com', modelId: 'deepseek-reasoner'},
    description: '深度推理、数学分析与复杂问题拆解',
  },
  {
    id: 'glm-4',
    name: '智谱 GLM',
    category: '对话',
    provider: 'openai',
    apiConfig: {apiKeyEnv: 'ZHIPU_API_KEY', baseURL: 'https://open.bigmodel.cn/api/paas/v4', modelId: 'glm-4'},
    description: '中文表现稳定，兼顾工具调用与复杂问答',
  },
  {
    id: 'qwen-turbo',
    name: '通义千问 Turbo',
    category: '对话',
    provider: 'openai',
    apiConfig: {apiKeyEnv: 'DASHSCOPE_API_KEY', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelId: 'qwen-turbo'},
    description: '低延迟日常问答与高并发场景',
  },
  {
    id: 'qwen-plus',
    name: '通义千问 Plus',
    category: '对话',
    provider: 'openai',
    apiConfig: {apiKeyEnv: 'DASHSCOPE_API_KEY', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelId: 'qwen-plus'},
    description: '更强中文理解、工具使用与复杂任务',
  },
  {
    id: 'moonshot-v1',
    name: 'Kimi (月之暗面)',
    category: '对话',
    provider: 'openai',
    apiConfig: {apiKeyEnv: 'MOONSHOT_API_KEY', baseURL: 'https://api.moonshot.cn/v1', modelId: 'moonshot-v1-8k'},
    description: '长文本阅读与资料整理',
  },
  {id: 'doubao-pro', name: '豆包 (字节跳动)', category: '对话', provider: 'mock', description: '字节系通用对话模型，占位保留待接入'},
  {id: 'hunyuan', name: '腾讯混元', category: '对话', provider: 'mock', description: '腾讯全链路自研，占位保留待接入'},
  {id: 'hailuo', name: '海螺AI (MiniMax)', category: '对话', provider: 'mock', description: 'MiniMax 通用文本能力，占位保留待接入'},
  {id: 'yi', name: '零一万物 (Yi)', category: '对话', provider: 'mock', description: '零一万物文本模型，占位保留待接入'},
  {id: 'step-1', name: '跃问 (阶跃星辰)', category: '对话', provider: 'mock', description: '阶跃星辰通用模型，占位保留待接入'},
  {id: 'baichuan', name: '百川智能', category: '对话', provider: 'mock', description: '百川大模型，占位保留待接入'},
  {id: 'tiangong', name: '天工AI', category: '对话', provider: 'mock', description: '昆仑万维天工，占位保留待接入'},
  {id: 'lingguang-ai', name: '灵光AI', category: '对话', provider: 'mock', description: '灵光AI官方大模型，占位保留待接入'},

  // 对话 - 国外占位
  {id: 'chatgpt', name: 'ChatGPT (OpenAI)', category: '对话', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'claude', name: 'Claude (Anthropic)', category: '对话', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'gemini', name: 'Gemini (Google)', category: '对话', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'grok', name: 'Grok (xAI)', category: '对话', provider: 'mock', description: '占位保留，后续可接入'},

  // 编程
  {
    id: 'qwen-coder',
    name: 'Qwen Coder',
    category: '编程',
    provider: 'openai',
    apiConfig: {apiKeyEnv: 'DASHSCOPE_API_KEY', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelId: 'qwen3-coder-plus'},
    description: '代码生成、修复、重构与调试',
  },
  {id: 'marscode', name: '豆包 MarsCode', category: '编程', provider: 'mock', description: '产品型编程助手，占位保留待接入'},
  {id: 'codegeex', name: 'CodeGeeX', category: '编程', provider: 'mock', description: '多语言代码生成，占位保留待接入'},
  {id: 'fitten', name: 'Fitten Code', category: '编程', provider: 'mock', description: '编程插件能力，占位保留待接入'},
  {id: 'manus', name: 'Manus (Agent)', category: '编程', provider: 'mock', description: 'Agent 产品，占位保留待接入'},
  {id: 'cursor', name: 'Cursor', category: '编程', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'github-copilot', name: 'GitHub Copilot', category: '编程', provider: 'mock', description: '占位保留，后续可接入'},

  // 视频
  {id: 'kling', name: '可灵AI (Kling)', category: '视频', provider: 'mock', description: '视频生成，占位保留待接入'},
  {id: 'vidu', name: 'Vidu (生数科技)', category: '视频', provider: 'mock', description: '视频生成，占位保留待接入'},
  {id: 'jimeng', name: '即梦AI (字节)', category: '视频', provider: 'mock', description: '视频创作，占位保留待接入'},
  {id: 'runway', name: 'Runway', category: '视频', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'sora-luma', name: 'Luma Dream Machine', category: '视频', provider: 'mock', description: '占位保留，后续可接入'},

  // 绘图
  {id: 'aliyun-image', name: '阿里万相 (直连)', category: '绘图', provider: 'mock', description: '阿里图片模型，占位保留待接入'},
  {id: 'zhipu-image', name: '智谱 CogView (直连)', category: '绘图', provider: 'mock', description: '智谱图片模型，占位保留待接入'},
  {id: 'liblib', name: 'LiblibAI', category: '绘图', provider: 'mock', description: '绘图社区与模型，占位保留待接入'},
  {id: 'wanxiang', name: '通义万相', category: '绘图', provider: 'mock', description: '阿里文生图，占位保留待接入'},
  {id: 'kolors', name: '可图 (Kolors)', category: '绘图', provider: 'mock', description: '可图文生图，占位保留待接入'},
  {id: 'whee', name: 'WHEE (美图)', category: '绘图', provider: 'mock', description: '美图创作模型，占位保留待接入'},
  {id: 'midjourney', name: 'Midjourney', category: '绘图', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'flux', name: 'FLUX.1', category: '绘图', provider: 'mock', description: '占位保留，后续可接入'},

  // 搜索
  {id: 'metaso', name: '秘塔AI搜索', category: '搜索', provider: 'mock', description: '搜索产品，占位保留待接入'},
  {id: '360-gpt', name: '360AI搜索', category: '搜索', provider: 'mock', description: '搜索产品，占位保留待接入'},
  {id: 'perplexity', name: 'Perplexity', category: '搜索', provider: 'mock', description: '占位保留，后续可接入'},

  // 办公
  {id: 'spark', name: '讯飞星火', category: '办公', provider: 'mock', description: '办公与文档问答，占位保留待接入'},
  {id: 'notion', name: 'Notion AI', category: '办公', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'gamma', name: 'Gamma (PPT)', category: '办公', provider: 'mock', description: '占位保留，后续可接入'},

  // 语音
  {id: 'suno', name: 'Suno', category: '语音', provider: 'mock', description: '占位保留，后续可接入'},
  {id: 'udio', name: 'Udio', category: '语音', provider: 'mock', description: '占位保留，后续可接入'},
]
