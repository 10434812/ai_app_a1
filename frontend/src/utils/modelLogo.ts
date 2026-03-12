type ModelLogoMeta = {
  id: string
  website?: string
  logo?: string
}

const LOGO_OVERRIDES: Record<string, string> = {
  'deepseek-r1': 'https://www.deepseek.com/favicon.ico',
  'glm-4': 'https://www.zhipuai.cn/favicon.ico',
  'zhipu-image': 'https://www.zhipuai.cn/favicon.ico',
  'moonshot-v1': 'https://www.moonshot.cn/favicon.ico',
  'doubao-pro': 'https://www.doubao.com/favicon.ico',
  yi: 'https://www.lingyiwanwu.com/favicon.ico',
  'qwen-plus': 'https://tongyi.aliyun.com/favicon.ico',
  'qwen-coder': 'https://tongyi.aliyun.com/favicon.ico',
}

const normalizeHostname = (website?: string) => {
  if (!website) return ''
  try {
    return new URL(website).hostname
  } catch {
    const normalized = website.startsWith('http://') || website.startsWith('https://') ? website : `https://${website}`
    try {
      return new URL(normalized).hostname
    } catch {
      return ''
    }
  }
}

export const getModelLogoCandidates = (model?: ModelLogoMeta | null) => {
  if (!model) return [] as string[]

  const candidates: string[] = []

  const override = LOGO_OVERRIDES[model.id]
  if (override) candidates.push(override)

  if (model.logo) candidates.push(model.logo)

  const hostname = normalizeHostname(model.website)
  if (hostname) {
    candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`)
    candidates.push(`https://icon.horse/icon/${hostname}`)
    candidates.push(`https://${hostname}/favicon.ico`)
  }

  return Array.from(new Set(candidates.filter(Boolean)))
}
