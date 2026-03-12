<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  plan: {
    id: string
    name: string
    price: string
    period: string
    features: string[]
    current: boolean
    popular?: boolean
    color: string
    description?: string
  }
  billingCycle: 'monthly' | 'yearly'
}>()

const emit = defineEmits(['subscribe'])

const displayPrice = computed(() => {
  if (props.plan.price === '0') return '0'
  if (props.plan.period && props.plan.period !== '月') return props.plan.price
  return props.billingCycle === 'yearly' 
    ? (Number(props.plan.price) * 10).toString() // 2 months free
    : props.plan.price
})

const periodLabel = computed(() => {
  if (props.plan.price === '0') return '永久'
  if (props.plan.period && props.plan.period !== '月') return props.plan.period
  return props.billingCycle === 'yearly' ? '年' : '月'
})

const buttonClass = computed(() => {
  if (props.plan.current) {
    return 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
  }
  if (props.plan.popular) {
    return 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 scale-100 hover:scale-[1.02]'
  }
  return 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
})
</script>

<template>
  <div 
    class="relative flex flex-col p-6 sm:p-8 rounded-2xl transition-all duration-300 h-full"
    :class="[
      plan.popular 
        ? 'bg-white dark:bg-slate-800 border-2 border-indigo-500 dark:border-indigo-500 shadow-xl z-10' 
        : 'bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg'
    ]"
  >
    <div v-if="plan.popular" class="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
      Most Popular
    </div>

    <div class="mb-6">
      <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">{{ plan.name }}</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 min-h-[40px]">{{ plan.description || '解锁强大的 AI 能力' }}</p>
    </div>

    <div class="mb-8 flex items-baseline gap-1">
      <span class="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">¥{{ displayPrice }}</span>
      <span class="text-sm text-slate-500 dark:text-slate-400 font-medium">/ {{ periodLabel }}</span>
    </div>

    <button
      @click="emit('subscribe', plan)"
      :disabled="plan.current"
      class="w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 mb-8 active:scale-95"
      :class="buttonClass"
    >
      {{ plan.current ? '当前方案' : '立即订阅' }}
    </button>

    <div class="space-y-4 flex-1">
      <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">包含功能</p>
      <ul class="space-y-3">
        <li v-for="(feature, idx) in plan.features" :key="idx" class="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div class="mt-0.5 p-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span class="leading-tight">{{ feature }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
