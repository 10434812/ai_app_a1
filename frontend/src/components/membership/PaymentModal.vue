<script setup lang="ts">
import {ref, watch, onUnmounted} from 'vue'
import * as QRCode from 'qrcode'
import {createCheckout, getOrderStatus} from '../../api/payment'

interface WeChatPayInvokeResponse {
  err_msg?: string
}

interface WeChatBridge {
  invoke(
    method: 'getBrandWCPayRequest',
    params: Record<string, string>,
    callback: (result: WeChatPayInvokeResponse) => void,
  ): void
}

declare global {
  interface Window {
    WeixinJSBridge?: WeChatBridge
  }
}

export interface PaymentPlan {
  name?: string
  price?: string | number
  paymentPlanKey?: string
}

const props = defineProps<{
  isOpen: boolean
  plan: PaymentPlan | null
}>()

const emit = defineEmits(['close', 'success'])

const step = ref<'idle' | 'loading' | 'qr' | 'success' | 'error'>('idle')
const countdown = ref(300)
const qrCodeDataUrl = ref('')
const qrRawUrl = ref('')
const orderId = ref('')
const errorText = ref('')
const statusText = ref('')

let countdownTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let checkingStatus = false
const isWeChatBrowser = /micromessenger/i.test(navigator.userAgent)

const clearTimers = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const resetState = () => {
  step.value = 'idle'
  countdown.value = 300
  qrCodeDataUrl.value = ''
  qrRawUrl.value = ''
  orderId.value = ''
  errorText.value = ''
  statusText.value = ''
  checkingStatus = false
}

const handleClose = () => {
  clearTimers()
  emit('close')
}

const handlePaymentSuccess = () => {
  clearTimers()
  step.value = 'success'
  setTimeout(() => {
    emit('success', {orderId: orderId.value})
    emit('close')
  }, 1200)
}

const checkOrderStatus = async () => {
  if (!orderId.value || checkingStatus || step.value !== 'qr') return
  checkingStatus = true
  try {
    const status = await getOrderStatus(orderId.value)
    if (status === 'completed') {
      handlePaymentSuccess()
      return
    }
    if (status === 'failed') {
      clearTimers()
      step.value = 'error'
      errorText.value = '订单支付失败，请重试。'
    }
  } catch (error: unknown) {
    console.error('Check order status failed:', error)
  } finally {
    checkingStatus = false
  }
}

const startCountdown = () => {
  clearTimers()
  countdown.value = 300
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearTimers()
      step.value = 'error'
      errorText.value = '订单超时未支付，请重新创建订单。'
    }
  }, 1000)
}

const startPolling = () => {
  pollTimer = setInterval(() => {
    checkOrderStatus()
  }, 2500)
}

const invokeWeChatPay = (params: NonNullable<Awaited<ReturnType<typeof createCheckout>>['jsapiParams']>) =>
  new Promise<void>((resolve, reject) => {
    const invoke = () => {
      const bridge = window.WeixinJSBridge
      if (!bridge) {
        reject(new Error('未检测到微信支付环境'))
        return
      }

      bridge.invoke(
        'getBrandWCPayRequest',
        {
          appId: params.appId,
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
        },
        (res: WeChatPayInvokeResponse) => {
          const msg = String(res?.err_msg || '').toLowerCase()
          if (msg.includes('ok')) {
            resolve()
            return
          }
          if (msg.includes('cancel')) {
            reject(new Error('支付已取消'))
            return
          }
          reject(new Error('微信支付失败，请稍后重试'))
        },
      )
    }

    if (window.WeixinJSBridge) {
      invoke()
      return
    }

    document.addEventListener('WeixinJSBridgeReady', invoke, {once: true})
  })

const startPayment = async () => {
  const planKey = props.plan?.paymentPlanKey
  if (!planKey) {
    step.value = 'error'
    errorText.value = '当前套餐不支持在线支付。'
    return
  }

  step.value = 'loading'
  errorText.value = ''
  statusText.value = '正在创建订单...'

  try {
    const checkout = await createCheckout(planKey, isWeChatBrowser ? 'wechat_jsapi' : 'wechat_native')
    orderId.value = checkout.orderId
    qrRawUrl.value = checkout.codeUrl || ''

    if (checkout.paymentType === 'jsapi' && checkout.jsapiParams) {
      if (!checkout.jsapiParams.package || !checkout.jsapiParams.paySign) {
        throw new Error('微信支付参数不完整，请重新下单')
      }
      statusText.value = checkout.isMock ? '当前为模拟支付模式，将直接轮询订单状态。' : '正在调起微信支付...'
      step.value = 'loading'
      startCountdown()
      startPolling()
      if (!checkout.isMock) {
        await invokeWeChatPay(checkout.jsapiParams)
      }
      checkOrderStatus()
      return
    }

    if (qrRawUrl.value) {
      qrCodeDataUrl.value = await QRCode.toDataURL(qrRawUrl.value, {margin: 1, width: 220})
    } else {
      throw new Error('微信二维码链接为空，请重新下单')
    }

    statusText.value = checkout.isMock ? '当前为模拟支付模式，扫码后请在后台确认订单。' : ''
    step.value = 'qr'
    startCountdown()
    startPolling()
    checkOrderStatus()
  } catch (error: unknown) {
    console.error('Create checkout failed:', error)
    step.value = 'error'
    errorText.value = error instanceof Error ? error.message : '创建订单失败，请稍后重试'
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetState()
      startPayment()
      return
    }
    clearTimers()
    resetState()
  },
)

onUnmounted(() => {
  clearTimers()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="handleClose"></div>

        <!-- Modal -->
        <div class="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden transform transition-all">
          
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <h3 class="font-bold text-slate-800 dark:text-white">订阅支付</h3>
            <button @click="handleClose" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Content -->
          <div class="p-8 text-center">
            
            <!-- Loading State -->
            <div v-if="step === 'loading'" class="py-12">
              <div class="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p class="text-slate-500">{{ statusText || '正在创建订单...' }}</p>
            </div>

            <!-- QR Code State -->
            <div v-else-if="step === 'qr'" class="space-y-6">
              <div class="text-left bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <div class="flex justify-between mb-2">
                  <span class="text-slate-500 dark:text-slate-400">商品名称</span>
                  <span class="font-medium text-slate-800 dark:text-white">{{ plan?.name }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500 dark:text-slate-400">应付金额</span>
                  <span class="font-bold text-indigo-600 dark:text-indigo-400 text-lg">¥{{ plan?.price }}</span>
                </div>
              </div>

              <div class="relative w-56 h-56 mx-auto bg-white p-2 rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
                <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="微信支付二维码" class="w-full h-full object-contain" />
                <div v-else class="text-xs text-slate-500 leading-relaxed px-4 break-all text-left">
                  {{ qrRawUrl || '二维码生成中，请稍候...' }}
                </div>
              </div>

              <p class="text-sm text-slate-500">请使用微信扫描二维码支付</p>
              <p class="text-xs text-slate-400">支付倒计时: {{ Math.floor(countdown / 60) }}:{{ (countdown % 60).toString().padStart(2, '0') }}</p>
              <p v-if="statusText" class="text-xs text-amber-600">{{ statusText }}</p>
            </div>

            <!-- Success State -->
            <div v-else-if="step === 'success'" class="py-8">
              <div class="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h4 class="text-xl font-bold text-slate-800 dark:text-white mb-2">支付成功</h4>
              <p class="text-slate-500 dark:text-slate-400">您的会员权益已生效</p>
            </div>

            <!-- Error State -->
            <div v-else-if="step === 'error'" class="py-8 space-y-4">
              <div class="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <p class="text-slate-600 dark:text-slate-300">{{ errorText || '支付流程异常，请重试。' }}</p>
              <button @click="startPayment" class="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                重新下单
              </button>
            </div>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
