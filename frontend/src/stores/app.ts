import {defineStore} from 'pinia'
import {ref} from 'vue'

const DEFAULT_ACTIVE_MODELS = ['DeepSeek-V3', '通义千问 Plus', '智谱 GLM', '腾讯混元']

export const useAppStore = defineStore('app', () => {
  const activeModels = ref<string[]>([...DEFAULT_ACTIVE_MODELS])
  const prompt = ref('')
  const isMobileMenuOpen = ref(false)
  const selectedModelIds = ref<string[]>([])

  function toggleMobileMenu() {
    isMobileMenuOpen.value = !isMobileMenuOpen.value
  }

  function closeMobileMenu() {
    isMobileMenuOpen.value = false
  }

  function setPrompt(value: string) {
    prompt.value = value
  }

  function toggleModel(model: string) {
    if (activeModels.value.includes(model)) {
      activeModels.value = activeModels.value.filter((item) => item !== model)
      return
    }

    activeModels.value = [...activeModels.value, model]
  }

  function setSelectedModels(ids: string[]) {
    selectedModelIds.value = ids
  }

  function toggleSelectedModel(id: string) {
    if (selectedModelIds.value.includes(id)) {
      selectedModelIds.value = selectedModelIds.value.filter((modelId) => modelId !== id)
      return
    }

    selectedModelIds.value = [...selectedModelIds.value, id]
  }

  return {
    activeModels,
    prompt,
    isMobileMenuOpen,
    selectedModelIds,
    toggleMobileMenu,
    closeMobileMenu,
    setPrompt,
    toggleModel,
    setSelectedModels,
    toggleSelectedModel,
  }
})
