export const EMPTY_STATE_PROMO = {
  eyebrow: '广告推荐',
  title: '选择真人回答',
  subtitle: '欢迎进入有空帮',
  description: '遇到复杂问题时，直接切到真人服务，拿到更稳的结果。',
  cta: '立即前往',
  href: 'https://syxy.5zixi.com/#/',
}

export const EMPTY_STATE_PROMO_CONTAINER_CLASS =
  'min-h-[300px] sm:min-h-[380px] flex items-start justify-center pt-0 pb-4 sm:pb-6'

export const EMPTY_STATE_PROMO_SCROLL_CLASS =
  'px-4 pt-0 pb-44 sm:px-6 sm:pt-0 sm:pb-52'

export function shouldShowEmptyStatePromo(turnCount: number, draftQuestion: string): boolean {
  return turnCount === 0 && draftQuestion.trim().length === 0
}
