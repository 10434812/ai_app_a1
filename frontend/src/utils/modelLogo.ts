type ModelLogoMeta = {
  id: string
  name?: string
  website?: string
  logo?: string
}

const DUCKDUCKGO_ICON_PREFIX = 'https://icons.duckduckgo.com/ip3/'

const FALLBACK_PALETTE = [
  ['#4f46e5', '#818cf8'],
  ['#0f766e', '#5eead4'],
  ['#b45309', '#fcd34d'],
  ['#be185d', '#f9a8d4'],
  ['#1d4ed8', '#93c5fd'],
  ['#7c3aed', '#c4b5fd'],
  ['#047857', '#6ee7b7'],
  ['#c2410c', '#fdba74'],
]

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const getDisplayLabel = (model: ModelLogoMeta) => {
  const source = (model.name || model.id).trim()
  if (!source) return '?'
  const chineseMatch = source.match(/[\u4e00-\u9fff]/)
  if (chineseMatch?.[0]) return chineseMatch[0]
  const latinMatch = source.match(/[A-Za-z0-9]/)
  if (latinMatch?.[0]) return latinMatch[0].toUpperCase()
  return source[0].toUpperCase()
}

const hashString = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

const getWebsiteIconHosts = (website?: string) => {
  if (!website) return [] as string[]

  try {
    const host = new URL(website).hostname.trim().toLowerCase()
    if (!host) return []

    const normalizedHost = host.startsWith('www.') ? host.slice(4) : host
    return Array.from(new Set([host, normalizedHost].filter(Boolean)))
  } catch {
    return []
  }
}

const buildDuckDuckGoLogoCandidates = (model: ModelLogoMeta) =>
  getWebsiteIconHosts(model.website).map((host) => `${DUCKDUCKGO_ICON_PREFIX}${host}.ico`)

const buildFallbackLogoDataUrl = (model: ModelLogoMeta) => {
  const label = getDisplayLabel(model)
  const palette = FALLBACK_PALETTE[hashString(model.id) % FALLBACK_PALETTE.length]
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${escapeXml(model.name || model.id)}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="100%" stop-color="${palette[1]}" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#g)" />
      <circle cx="32" cy="32" r="25" fill="rgba(255,255,255,0.14)" />
      <text x="32" y="40" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#ffffff">${escapeXml(label)}</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`
}

export const getModelLogoCandidates = (model?: ModelLogoMeta | null) => {
  if (!model) return [] as string[]

  const candidates: string[] = []

  if (model.logo) candidates.push(model.logo)
  candidates.push(...buildDuckDuckGoLogoCandidates(model))
  candidates.push(buildFallbackLogoDataUrl(model))

  return Array.from(new Set(candidates.filter(Boolean)))
}
