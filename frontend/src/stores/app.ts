import {defineStore} from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    activeModels: ['DeepSeek-V3', '通义千问 Plus', '智谱 GLM', '腾讯混元'],
    prompt: '',
    isMobileMenuOpen: false,
    selectedModelIds: [] as string[],
  }),
  actions: {
    toggleMobileMenu() {
      this.isMobileMenuOpen = !this.isMobileMenuOpen
    },
    closeMobileMenu() {
      this.isMobileMenuOpen = false
    },
    setPrompt(value: string) {
      this.prompt = value
    },
    toggleModel(model: string) {
      if (this.activeModels.includes(model)) {
        this.activeModels = this.activeModels.filter((item) => item !== model)
        return
      }
      this.activeModels = [...this.activeModels, model]
    },
    setSelectedModels(ids: string[]) {
      this.selectedModelIds = ids
    },
    toggleSelectedModel(id: string) {
      if (this.selectedModelIds.includes(id)) {
        this.selectedModelIds = this.selectedModelIds.filter((m) => m !== id)
      } else {
        this.selectedModelIds = [...this.selectedModelIds, id]
      }
    },
  },
})
