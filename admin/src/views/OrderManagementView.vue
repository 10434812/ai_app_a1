<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">订单中心</h1>
        <p class="mt-1 text-sm text-gray-500">支持订单查询、详情审计、补单、状态修复和退款处理。微信订单会优先走真实退款接口。</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="downloadOrders"
          class="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50">
          导出订单 CSV
        </button>
        <button
          @click="downloadTokens"
          class="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50">
          导出 Token CSV
        </button>
        <button
          @click="fetchOrders"
          class="px-4 py-2 rounded-md bg-indigo-600 text-sm text-white hover:bg-indigo-700">
          刷新列表
        </button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-4">
      <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-400">当前页订单</div>
        <div class="mt-2 text-3xl font-bold text-gray-900">{{ orders.length }}</div>
      </div>
      <div class="rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-emerald-500">已支付</div>
        <div class="mt-2 text-3xl font-bold text-emerald-700">{{ paidCount }}</div>
      </div>
      <div class="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-amber-500">待支付</div>
        <div class="mt-2 text-3xl font-bold text-amber-700">{{ pendingCount }}</div>
      </div>
      <div class="rounded-xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">已退款</div>
        <div class="mt-2 text-3xl font-bold text-slate-700">{{ refundedCount }}</div>
      </div>
    </div>

    <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-6">
        <input
          v-model.trim="filters.q"
          @keyup.enter="handleSearch"
          placeholder="订单号 / 交易号"
          class="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        <select
          v-model="filters.status"
          class="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
          <option value="">全部状态</option>
          <option value="pending">待支付</option>
          <option value="completed">已支付</option>
          <option value="failed">失败</option>
          <option value="refunded">已退款</option>
        </select>
        <input
          v-model.trim="filters.planKey"
          placeholder="套餐 key"
          class="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        <input
          v-model.trim="filters.userId"
          placeholder="用户 ID"
          class="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
        <select
          v-model="filters.paymentMethod"
          class="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
          <option value="">全部支付方式</option>
          <option value="wechat_native">微信 Native</option>
          <option value="wechat_jsapi">微信 JSAPI</option>
          <option value="wechat">微信通用</option>
          <option value="mock_pay">模拟支付</option>
        </select>
        <button
          @click="handleSearch"
          class="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800">
          查询
        </button>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">订单</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">用户</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">套餐</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">支付</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">金额</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状态</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">时间</th>
              <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr v-if="loading">
              <td colspan="8" class="px-6 py-6 text-center text-sm text-gray-500">加载中...</td>
            </tr>
            <tr v-else-if="orders.length === 0">
              <td colspan="8" class="px-6 py-6 text-center text-sm text-gray-500">暂无订单</td>
            </tr>
            <tr v-for="order in orders" :key="order.id" class="hover:bg-gray-50">
              <td class="px-4 py-4 align-top text-xs text-gray-600">
                <div class="font-mono text-gray-900">{{ compactId(order.id) }}</div>
                <div v-if="order.transactionId" class="mt-1 text-[11px] text-gray-400">微信单号：{{ compactId(order.transactionId, 10) }}</div>
              </td>
              <td class="px-4 py-4 align-top">
                <div class="text-sm font-medium text-gray-900">{{ order.user?.name || 'Unknown' }}</div>
                <div class="text-xs text-gray-500">{{ order.user?.email || order.userId }}</div>
              </td>
              <td class="px-4 py-4 align-top text-sm text-gray-700">
                <div class="font-medium text-gray-900">{{ order.planKey || order.plan }}</div>
                <div class="mt-1 text-xs text-gray-400">{{ order.plan }}</div>
              </td>
              <td class="px-4 py-4 align-top">
                <span :class="paymentMethodClass(order.paymentMethod)" class="inline-flex rounded-full px-2 py-1 text-xs font-medium">
                  {{ formatPaymentMethod(order.paymentMethod) }}
                </span>
                <div v-if="isWechatOrder(order)" class="mt-2 text-[11px] text-emerald-600">支持真实微信退款</div>
              </td>
              <td class="px-4 py-4 align-top text-sm font-medium text-gray-900">
                ¥{{ formatCurrency(order.amount) }}
                <div v-if="order.status === 'refunded'" class="mt-1 text-xs text-red-500">退款：¥{{ formatCurrency(order.refundedAmount || order.amount) }}</div>
              </td>
              <td class="px-4 py-4 align-top">
                <span :class="getStatusClass(order.status)" class="inline-flex rounded-full px-2 py-1 text-xs font-semibold">
                  {{ formatStatus(order.status) }}
                </span>
              </td>
              <td class="px-4 py-4 align-top text-sm text-gray-500">{{ new Date(order.createdAt).toLocaleString() }}</td>
              <td class="px-4 py-4 text-right align-top">
                <div class="flex flex-wrap justify-end gap-2">
                  <button
                    @click="openDetails(order)"
                    class="rounded-md bg-white px-2 py-1 text-xs text-gray-700 border border-gray-200 hover:bg-gray-50">
                    详情
                  </button>
                  <button
                    v-if="order.status === 'pending' || order.status === 'failed'"
                    @click="openCompleteModal(order)"
                    class="rounded-md bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200">
                    手动补单
                  </button>
                  <button
                    v-if="order.status === 'completed'"
                    @click="openRefundModal(order)"
                    class="rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200">
                    退款
                  </button>
                  <button
                    @click="openRepairModal(order)"
                    class="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200">
                    修复状态
                  </button>
                  <button
                    @click="openDetails(order, true)"
                    class="rounded-md bg-indigo-100 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-200">
                    审计
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
        <span>共 {{ total }} 条，当前第 {{ page }} / {{ totalPages }} 页</span>
        <div class="space-x-2">
          <button
            :disabled="page <= 1"
            @click="changePage(page - 1)"
            class="rounded border border-gray-200 px-3 py-1 disabled:opacity-50">
            上一页
          </button>
          <button
            :disabled="page >= totalPages"
            @click="changePage(page + 1)"
            class="rounded border border-gray-200 px-3 py-1 disabled:opacity-50">
            下一页
          </button>
        </div>
      </div>
    </div>

    <transition name="fade">
      <div v-if="selectedOrder" class="fixed inset-0 z-40 bg-gray-900/35" @click="closeDetails"></div>
    </transition>
    <transition name="slide-left">
      <aside v-if="selectedOrder" class="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">订单详情</h2>
            <p class="mt-1 text-xs text-gray-500">支持查看订单主信息、支付方式和审计流水。</p>
          </div>
          <button @click="closeDetails" class="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="space-y-6 px-6 py-5">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div class="text-xs text-gray-400">订单 ID</div>
              <div class="mt-1 break-all font-mono text-sm text-gray-800">{{ selectedOrder.id }}</div>
            </div>
            <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div class="text-xs text-gray-400">支付方式</div>
              <div class="mt-1 text-sm font-medium text-gray-900">{{ formatPaymentMethod(selectedOrder.paymentMethod) }}</div>
              <div v-if="selectedOrder.transactionId" class="mt-1 break-all text-xs text-gray-500">交易号：{{ selectedOrder.transactionId }}</div>
            </div>
            <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div class="text-xs text-gray-400">用户</div>
              <div class="mt-1 text-sm font-medium text-gray-900">{{ selectedOrder.user?.name || 'Unknown' }}</div>
              <div class="mt-1 break-all text-xs text-gray-500">{{ selectedOrder.user?.email || selectedOrder.userId }}</div>
            </div>
            <div class="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div class="text-xs text-gray-400">金额 / 状态</div>
              <div class="mt-1 text-sm font-medium text-gray-900">¥{{ formatCurrency(selectedOrder.amount) }}</div>
              <div class="mt-1"><span :class="getStatusClass(selectedOrder.status)" class="inline-flex rounded-full px-2 py-1 text-xs font-semibold">{{ formatStatus(selectedOrder.status) }}</span></div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-100 bg-white p-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-gray-900">退款建议</h3>
                <p class="mt-1 text-xs text-gray-500">微信订单会优先调用真实微信退款；其他支付方式执行账务退款并写审计日志。</p>
              </div>
              <button
                v-if="selectedOrder.status === 'completed'"
                @click="openRefundModal(selectedOrder)"
                class="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-700 hover:bg-amber-200">
                发起退款
              </button>
            </div>
            <div class="mt-3 text-sm text-gray-600">
              {{ refundHint(selectedOrder) }}
            </div>
          </div>

          <div class="rounded-xl border border-gray-100 bg-white">
            <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 class="text-sm font-semibold text-gray-900">订单审计日志</h3>
              <button
                @click="loadAudits(selectedOrder.id)"
                class="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                刷新审计
              </button>
            </div>
            <div v-if="auditLoading" class="px-4 py-6 text-center text-sm text-gray-500">审计加载中...</div>
            <div v-else-if="audits.length === 0" class="px-4 py-6 text-center text-sm text-gray-500">暂无审计日志</div>
            <div v-else class="divide-y divide-gray-100">
              <div v-for="audit in audits" :key="audit.id" class="px-4 py-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="font-medium text-gray-900">{{ formatAuditAction(audit.action) }}</span>
                  <span class="text-xs text-gray-400">{{ new Date(audit.createdAt).toLocaleString() }}</span>
                </div>
                <div class="mt-1 text-xs text-gray-500">操作者：{{ audit.actorUser?.email || audit.actorUserId || 'system' }}</div>
                <div v-if="audit.note" class="mt-1 whitespace-pre-wrap text-xs text-gray-600">备注：{{ audit.note }}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </transition>

    <transition name="fade">
      <div v-if="operationModal.open" class="fixed inset-0 z-40 bg-gray-900/35" @click="closeOperationModal"></div>
    </transition>
    <transition name="fade-up">
      <div v-if="operationModal.open && operationModal.order" class="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl rounded-t-3xl border border-gray-200 bg-white shadow-2xl md:bottom-auto md:left-1/2 md:top-24 md:-translate-x-1/2 md:rounded-2xl">
        <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">{{ modalTitle }}</h2>
            <p class="mt-1 text-xs text-gray-500">订单：{{ compactId(operationModal.order.id) }} · {{ operationModal.order.user?.email || operationModal.order.userId }}</p>
          </div>
          <button @click="closeOperationModal" class="rounded-full border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="space-y-4 px-6 py-5">
          <div class="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            <div>套餐：{{ operationModal.order.planKey || operationModal.order.plan }}</div>
            <div class="mt-1">支付方式：{{ formatPaymentMethod(operationModal.order.paymentMethod) }}</div>
            <div class="mt-1">订单金额：¥{{ formatCurrency(operationModal.order.amount) }}</div>
            <div v-if="operationModal.type === 'refund'" class="mt-1 text-amber-700">{{ refundHint(operationModal.order) }}</div>
          </div>

          <template v-if="operationModal.type === 'repair'">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">目标状态</label>
              <select v-model="repairForm.status" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                <option value="pending">待支付</option>
                <option value="completed">已支付</option>
                <option value="failed">失败</option>
                <option value="refunded">已退款</option>
              </select>
            </div>
          </template>

          <template v-if="operationModal.type === 'refund'">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700">退款金额</label>
              <input v-model="refundForm.refundAmount" type="number" min="0" step="0.01" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" :placeholder="String(operationModal.order.amount)" />
              <p class="mt-1 text-xs text-gray-500">留空默认全额退款。当前模型仅支持一笔退款完成后把订单标记为已退款。</p>
            </div>
          </template>

          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">备注</label>
            <textarea
              v-model="operationForm.note"
              rows="4"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              :placeholder="operationModal.type === 'refund' ? '例如：用户申请退款，已核验到账' : '可填写原因或操作说明'" />
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button @click="closeOperationModal" class="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">取消</button>
          <button
            @click="submitOperation"
            :disabled="submittingOperation"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {{ submittingOperation ? '处理中...' : modalConfirmText }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {
  exportOrdersCsv,
  exportTokensCsv,
  getOrderAudits,
  getOrders,
  manualCompleteOrder,
  manualRefundOrder,
  repairOrderStatus,
  type Order,
  type OrderAudit,
} from '../api/admin'

const orders = ref<Order[]>([])
const loading = ref(false)
const page = ref(1)
const limit = ref(20)
const total = ref(0)
const totalPages = ref(1)
const audits = ref<OrderAudit[]>([])
const auditLoading = ref(false)
const selectedOrder = ref<Order | null>(null)
const submittingOperation = ref(false)

const operationModal = ref<{
  open: boolean
  type: 'refund' | 'repair' | 'complete' | null
  order: Order | null
}>({
  open: false,
  type: null,
  order: null,
})

const operationForm = ref({note: ''})
const refundForm = ref({refundAmount: ''})
const repairForm = ref<{status: Order['status']}>({status: 'pending'})

const filters = ref({
  q: '',
  status: '',
  planKey: '',
  userId: '',
  paymentMethod: '',
})

const paidCount = computed(() => orders.value.filter((order) => order.status === 'completed').length)
const pendingCount = computed(() => orders.value.filter((order) => order.status === 'pending').length)
const refundedCount = computed(() => orders.value.filter((order) => order.status === 'refunded').length)

const modalTitle = computed(() => {
  switch (operationModal.value.type) {
    case 'refund':
      return '订单退款'
    case 'repair':
      return '修复订单状态'
    case 'complete':
      return '手动补单'
    default:
      return '订单操作'
  }
})

const modalConfirmText = computed(() => {
  switch (operationModal.value.type) {
    case 'refund':
      return '确认退款'
    case 'repair':
      return '确认修复'
    case 'complete':
      return '确认补单'
    default:
      return '确认'
  }
})

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

const extractAdminErrorMessage = (error: any, fallback: string) => {
  const payload = error?.response?.data
  if (typeof payload?.error?.message === 'string') return payload.error.message
  if (typeof payload?.error === 'string') return payload.error
  if (typeof error?.message === 'string') return error.message
  return fallback
}

const syncSelectedOrder = () => {
  if (!selectedOrder.value) return
  const latest = orders.value.find((item) => item.id === selectedOrder.value?.id)
  if (latest) selectedOrder.value = latest
  if (operationModal.value.order) {
    const modalLatest = orders.value.find((item) => item.id === operationModal.value.order?.id)
    if (modalLatest) operationModal.value.order = modalLatest
  }
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: page.value,
      limit: limit.value,
      q: filters.value.q || undefined,
      status: filters.value.status || undefined,
      planKey: filters.value.planKey || undefined,
      userId: filters.value.userId || undefined,
      paymentMethod: filters.value.paymentMethod || undefined,
    }
    const data = await getOrders(params)
    orders.value = data.rows || []
    total.value = data.total || 0
    totalPages.value = data.totalPages || 1
    syncSelectedOrder()
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    alert('加载订单失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  page.value = 1
  await fetchOrders()
}

const changePage = async (nextPage: number) => {
  page.value = nextPage
  await fetchOrders()
}

const loadAudits = async (orderId: string) => {
  auditLoading.value = true
  try {
    const data = await getOrderAudits({orderId, page: 1, limit: 20})
    audits.value = data.rows || []
  } finally {
    auditLoading.value = false
  }
}

const openDetails = async (order: Order, focusAudit = false) => {
  selectedOrder.value = order
  await loadAudits(order.id)
  if (focusAudit) {
    window.setTimeout(() => {
      document.documentElement.style.scrollBehavior = 'smooth'
    }, 0)
  }
}

const closeDetails = () => {
  selectedOrder.value = null
  audits.value = []
}

const resetOperationForm = () => {
  operationForm.value.note = ''
  refundForm.value.refundAmount = ''
  repairForm.value.status = 'pending'
}

const openRefundModal = (order: Order) => {
  operationModal.value = {open: true, type: 'refund', order}
  operationForm.value.note = ''
  refundForm.value.refundAmount = ''
}

const openRepairModal = (order: Order) => {
  operationModal.value = {open: true, type: 'repair', order}
  operationForm.value.note = ''
  repairForm.value.status = order.status
}

const openCompleteModal = (order: Order) => {
  operationModal.value = {open: true, type: 'complete', order}
  operationForm.value.note = ''
}

const closeOperationModal = () => {
  operationModal.value = {open: false, type: null, order: null}
  resetOperationForm()
}

const submitOperation = async () => {
  if (!operationModal.value.order || !operationModal.value.type) return
  submittingOperation.value = true
  const orderId = operationModal.value.order.id

  try {
    if (operationModal.value.type === 'repair') {
      await repairOrderStatus(orderId, repairForm.value.status, operationForm.value.note)
    } else if (operationModal.value.type === 'complete') {
      await manualCompleteOrder(orderId, operationForm.value.note)
    } else if (operationModal.value.type === 'refund') {
      const refundAmount = refundForm.value.refundAmount ? Number(refundForm.value.refundAmount) : undefined
      if (refundAmount !== undefined && (!Number.isFinite(refundAmount) || refundAmount < 0)) {
        throw new Error('退款金额格式无效')
      }
      await manualRefundOrder(orderId, {note: operationForm.value.note, refundAmount})
    }

    await fetchOrders()
    if (selectedOrder.value?.id === orderId) {
      await loadAudits(orderId)
    }
    closeOperationModal()
  } catch (error) {
    alert(extractAdminErrorMessage(error, `${modalTitle.value}失败`))
  } finally {
    submittingOperation.value = false
  }
}

const downloadOrders = async () => {
  const blob = await exportOrdersCsv({status: filters.value.status || undefined})
  saveBlob(blob, `orders_${Date.now()}.csv`)
}

const downloadTokens = async () => {
  const blob = await exportTokensCsv()
  saveBlob(blob, `tokens_${Date.now()}.csv`)
}

const compactId = (value: string, length = 12) => {
  if (!value) return '-'
  return value.length > length ? `${value.slice(0, length)}...` : value
}

const formatCurrency = (value: number | string | null | undefined) => Number(value || 0).toFixed(2)

const formatStatus = (status: string) => {
  const map: Record<string, string> = {
    pending: '待支付',
    completed: '已支付',
    failed: '失败',
    refunded: '已退款',
  }
  return map[status] || status
}

const formatPaymentMethod = (method: string) => {
  const map: Record<string, string> = {
    wechat: '微信支付',
    wechat_native: '微信 Native',
    wechat_jsapi: '微信 JSAPI',
    mock_pay: '模拟支付',
  }
  return map[method] || method
}

const paymentMethodClass = (method: string) => {
  if (method === 'wechat_native' || method === 'wechat_jsapi' || method === 'wechat') return 'bg-emerald-100 text-emerald-700'
  if (method === 'mock_pay') return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-700'
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'refunded':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const formatAuditAction = (action: string) => {
  const map: Record<string, string> = {
    manual_complete: '手动补单',
    manual_refund: '订单退款',
    repair_status: '修复状态',
    payment_success: '支付成功',
  }
  return map[action] || action
}

const isWechatOrder = (order: Order) => ['wechat', 'wechat_native', 'wechat_jsapi'].includes(String(order.paymentMethod || ''))

const refundHint = (order: Order) => {
  if (!isWechatOrder(order)) return '当前不是微信订单，执行后会做账务退款并写入审计。'
  if (!order.transactionId) return '当前微信订单缺少交易号，将退回到按商户订单号发起退款。'
  if (order.plan !== 'token_pack') return '这是会员类订单。退款会走微信接口，但会员权益回退仍需人工复核。'
  return '这是微信 token 包订单，退款时会优先走真实微信退款，并同步写入账务审计。'
}

onMounted(() => {
  fetchOrders()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active,
.fade-up-enter-active,
.fade-up-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.slide-left-enter-from,
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
