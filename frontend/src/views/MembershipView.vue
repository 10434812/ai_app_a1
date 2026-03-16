<script setup lang="ts">
import {ref, computed} from 'vue'
import {useAuthStore} from '../stores/auth'
import {useRouter} from 'vue-router'
import UserDropdown from '../components/UserDropdown.vue'
import UserAvatar from '../components/UserAvatar.vue'
import PricingCard from '../components/membership/PricingCard.vue'
import FeatureComparison from '../components/membership/FeatureComparison.vue'
import FaqSection from '../components/membership/FaqSection.vue'
import PaymentModal from '../components/membership/PaymentModal.vue'

interface MembershipPlan {
  id: 'free' | 'pro' | 'premium'
  name: string
  price: string
  period: string
  features: string[]
  current: boolean
  popular?: boolean
  color: string
  description: string
  paymentPlanKey: string
}

const authStore = useAuthStore()
const router = useRouter()

const billingCycle = ref<'monthly' | 'yearly'>('monthly')
const showPaymentModal = ref(false)
const selectedPlan = ref<MembershipPlan | null>(null)

const plans: MembershipPlan[] = [
  {
    id: 'free',
    name: '免费版',
    price: '0',
    period: '永久',
    features: ['每日 10 次对话', '标准响应速度', '不支持上下文记忆'],
    current: true, // Logic to be dynamic based on user state
    color: 'slate',
    description: '适合个人尝鲜体验 AI 能力',
    paymentPlanKey: '',
  },
  {
    id: 'pro',
    name: '专业版',
    price: '29.9',
    period: '月',
    features: ['无限次对话', '高级模型访问', '极速响应优先通道', '长上下文记忆 (32k)', '优先体验新功能'],
    current: false,
    popular: true,
    color: 'indigo',
    description: '适合重度使用者和专业人士',
    paymentPlanKey: 'monthly',
  },
  {
    id: 'premium',
    name: '高级版',
    price: '299.9',
    period: '年',
    features: ['包含专业版所有功能', '更高并发与更长上下文', '每月更高 Token 配额', '优先接入新模型', '优先工单支持'],
    current: false,
    color: 'amber',
    description: '适合高频使用和专业场景',
    paymentPlanKey: 'yearly',
  },
]

// Dynamic plan status based on user
const processedPlans = computed(() => {
  if (!authStore.user) return plans
  const currentLevel = authStore.user.membershipLevel || 'free'
  return plans.map((p) => ({
    ...p,
    current: p.id === currentLevel,
  }))
})

const handleSubscribe = (plan: MembershipPlan) => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  if (plan?.id === 'free' || plan?.current) return
  selectedPlan.value = plan
  showPaymentModal.value = true
}

const handlePaymentSuccess = async () => {
  await authStore.fetchUser()
  selectedPlan.value = null
  showPaymentModal.value = false
}

const handlePaymentClose = () => {
  selectedPlan.value = null
  showPaymentModal.value = false
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
    <!-- Payment Modal -->
    <PaymentModal :is-open="showPaymentModal" :plan="selectedPlan" @close="handlePaymentClose" @success="handlePaymentSuccess" />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-20">
      <!-- Header Section -->
      <div class="space-y-8">
        <!-- Top Bar -->
        <div class="flex items-center justify-between">
          <nav class="flex text-sm text-slate-500">
            <span class="hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer" @click="router.push('/')">首页</span>
            <span class="mx-2">/</span>
            <span class="text-slate-800 dark:text-white font-medium">会员中心</span>
          </nav>
          <UserDropdown placement="bottom" />
        </div>

        <!-- Hero Content -->
        <div class="text-center max-w-3xl mx-auto space-y-6">
          <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            解锁无限可能，<br />
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">释放 AI 全部潜力</span>
          </h1>
          <p class="text-lg text-slate-600 dark:text-slate-400">升级到专业版，体验AI的顶级能力，享受极速响应与专属服务。</p>

          <!-- Billing Toggle -->
          <!-- <div class="flex justify-center items-center gap-4 pt-4">
            <span class="text-sm font-medium" :class="billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'">月付</span>
            <button @click="billingCycle = billingCycle === 'monthly' ? 'yearly' : 'monthly'" class="relative w-14 h-8 bg-slate-200 dark:bg-slate-700 rounded-full p-1 transition-colors duration-300 focus:outline-none" :class="{'bg-indigo-600 dark:bg-indigo-600': billingCycle === 'yearly'}">
              <div class="w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300" :class="billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'"></div>
            </button>
            <span class="text-sm font-medium" :class="billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'"> 年付 <span class="text-emerald-500 text-xs ml-1 font-bold">-17%</span> </span>
          </div> -->
        </div>
      </div>

      <!-- User Status Card -->
      <div v-if="authStore.user" class="relative overflow-hidden bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-3xl p-1 border border-white/50 dark:border-slate-700 shadow-xl">
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50"></div>
        <div class="bg-white/50 dark:bg-slate-900/50 rounded-[1.4rem] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div class="relative shrink-0">
            <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-br from-indigo-100 to-white dark:from-slate-700 dark:to-slate-800 shadow-inner">
              <UserAvatar :user="authStore.user" size="lg" class="w-full h-full text-2xl" />
            </div>
            <div class="absolute bottom-0 right-0 bg-emerald-500 border-4 border-white dark:border-slate-900 w-6 h-6 rounded-full"></div>
          </div>

          <div class="flex-1 text-center sm:text-left space-y-2">
            <div class="flex flex-col sm:flex-row items-center gap-3">
              <h2 class="text-2xl font-bold text-slate-900 dark:text-white">{{ authStore.user.name }}</h2>
              <span class="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700"> {{ authStore.user.membershipLevel || 'Free' }} Plan </span>
            </div>
            <p class="text-slate-500 dark:text-slate-400 text-sm">当前账户状态正常。升级套餐可立即生效，剩余权益将自动结转。</p>
          </div>

          <div class="flex gap-8 text-center sm:text-right border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-6 sm:pt-0 sm:pl-8 mt-2 sm:mt-0 w-full sm:w-auto justify-center sm:justify-end">
            <div>
              <div class="text-3xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">{{ authStore.user.tokensBalance?.toLocaleString() || 0 }}</div>
              <div class="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">剩余 Token</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pricing Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
        <!-- Background Decor -->
        <div class="absolute inset-0 bg-gradient-to-b from-indigo-50/50 to-transparent dark:from-indigo-900/10 pointer-events-none -z-10 rounded-3xl transform scale-110 opacity-50 blur-3xl"></div>

        <PricingCard v-for="plan in processedPlans" :key="plan.id" :plan="plan" :billing-cycle="billingCycle" @subscribe="handleSubscribe" />
      </div>

      <!-- Feature Comparison -->
      <FeatureComparison />

      <!-- FAQ Section -->
      <FaqSection />

      <!-- Footer -->
      <div class="text-center pt-8 pb-12 text-slate-400 text-sm border-t border-slate-200 dark:border-slate-800">
        <p>© 2024 AI 聚合问答. All rights reserved.</p>
        <div class="flex justify-center gap-6 mt-4">
          <a href="#" class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">服务条款</a>
          <a href="#" class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">隐私政策</a>
          <a href="#" class="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">联系我们</a>
        </div>
      </div>
    </div>
  </div>
</template>
