<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  user: {
    name: string
    avatar?: string
    email?: string
  } | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const imageError = ref(false)
const isLoading = ref(true)
const retryCount = ref(0)

// Reset error state when avatar url changes
watch(() => props.user?.avatar, () => {
  imageError.value = false
  isLoading.value = true
  retryCount.value = 0
})

const avatarUrl = computed(() => {
  if (!props.user?.avatar) return ''
  // Force HTTPS for WeChat avatars to avoid Mixed Content issues
  let url = props.user.avatar
  if (url.startsWith('http://thirdwx.qlogo.cn')) {
    url = url.replace('http://', 'https://')
  }
  return url
})

const initial = computed(() => {
  return props.user?.name?.substring(0, 1)?.toUpperCase() || 'U'
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-8 h-8 text-xs'
    case 'lg': return 'w-20 h-20 text-3xl'
    case 'xl': return 'w-24 h-24 text-4xl'
    case 'md':
    default: return 'w-12 h-12 text-lg'
  }
})

const onLoad = () => {
  isLoading.value = false
  imageError.value = false
}

const onError = () => {
  if (retryCount.value < 1) {
    retryCount.value++
    // Simple retry by triggering a re-render or re-fetch attempt could be complex
    // For now, we accept failure and show fallback, as network retries for images are handled by browser mostly
    // But we can try to force a reload if needed, but usually 403/404 won't change.
    // Let's just fall back immediately to be safe, as requested by "downgrade mechanism"
  }
  isLoading.value = false
  imageError.value = true
}
</script>

<template>
  <div 
    :class="[
      'rounded-full flex items-center justify-center font-bold overflow-hidden relative shrink-0 transition-all duration-300',
      sizeClasses,
      imageError || !avatarUrl ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-100 dark:bg-slate-800'
    ]"
  >
    <!-- Image -->
    <img 
      v-if="avatarUrl && !imageError" 
      :src="avatarUrl" 
      alt="Avatar" 
      class="w-full h-full object-cover transition-opacity duration-300"
      :class="{ 'opacity-0': isLoading, 'opacity-100': !isLoading }"
      loading="lazy"
      referrerpolicy="no-referrer"
      @load="onLoad"
      @error="onError"
    />

    <!-- Loading Skeleton (overlay on top of image until loaded) -->
    <div 
      v-if="avatarUrl && !imageError && isLoading" 
      class="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse"
    ></div>

    <!-- Fallback Initial -->
    <span 
      v-if="imageError || !avatarUrl" 
      class="absolute inset-0 flex items-center justify-center select-none"
    >
      {{ initial }}
    </span>
  </div>
</template>
