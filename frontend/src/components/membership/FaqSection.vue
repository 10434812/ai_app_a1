<script setup lang="ts">
import {ref} from 'vue'

const faqs = [
  {q: '订阅可以随时取消吗？', a: '当然。您可以随时在账户设置中取消订阅，您的权益将保留至当前计费周期结束。'},
  {q: '如何开具发票？', a: '支付成功后，您可以在订单历史中申请开具电子发票，我们将发送至您的注册邮箱。'},
  {q: '高级版和专业版有什么区别？', a: '高级版提供更高并发、更长上下文和更高每月 Token 配额，适合高频专业使用。'},
  {q: 'Token 额度不够用怎么办？', a: '您可以单独购买 Token 加油包，或者升级到更高级别的套餐。'},
]

const openIndex = ref<number | null>(0)

const toggle = (idx: number) => {
  openIndex.value = openIndex.value === idx ? null : idx
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-12">
    <!-- <div>
      <h3 class="text-2xl font-bold text-slate-800 dark:text-white mb-4">常见问题</h3>
      <p class="text-slate-500 dark:text-slate-400 mb-6">找不到您需要的答案？请联系我们的客服团队。</p>
    </div>
    <div class="space-y-4">
      <div v-for="(faq, idx) in faqs" :key="idx" class="border-b border-slate-200 dark:border-slate-700 pb-4">
        <button 
          @click="toggle(idx)"
          class="flex items-center justify-between w-full text-left focus:outline-none group"
        >
          <span class="font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{{ faq.q }}</span>
          <svg 
            class="w-5 h-5 text-slate-400 transition-transform duration-200" 
            :class="{ 'rotate-180': openIndex === idx }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div 
          v-show="openIndex === idx" 
          class="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed animate-fade-in"
        >
          {{ faq.a }}
        </div>
      </div>
    </div> -->
  </div>
</template>
