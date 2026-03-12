<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">Token 计费中心</h1>
      <button
        @click="saveConfig"
        :disabled="saving"
        class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm">
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
      <h2 class="font-semibold text-gray-900">默认聊天费率（每 1K Token 扣站内 Token）</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-gray-600 mb-1">输入单价 inputPer1K</label>
          <input
            v-model.number="form.defaultChatRate.inputPer1K"
            type="number"
            min="0"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">输出单价 outputPer1K</label>
          <input
            v-model.number="form.defaultChatRate.outputPer1K"
            type="number"
            min="0"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
      <h2 class="font-semibold text-gray-900">默认图片费率</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-gray-600 mb-1">提示词单价 promptPer1K</label>
          <input
            v-model.number="form.defaultImageRate.promptPer1K"
            type="number"
            min="0"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">每张图固定成本 perImage</label>
          <input
            v-model.number="form.defaultImageRate.perImage"
            type="number"
            min="0"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-gray-900">聊天模型费率明细（JSON）</h2>
        <button class="text-xs text-indigo-600" @click="resetChatJson">重置为当前格式</button>
      </div>
      <textarea
        v-model="chatRatesText"
        rows="14"
        class="w-full rounded-md border-gray-300 font-mono text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
      <p class="text-xs text-gray-500">格式示例: {"deepseek-v3":{"inputPer1K":600,"outputPer1K":800}}</p>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-gray-900">图片模型费率明细（JSON）</h2>
        <button class="text-xs text-indigo-600" @click="resetImageJson">重置为当前格式</button>
      </div>
      <textarea
        v-model="imageRatesText"
        rows="10"
        class="w-full rounded-md border-gray-300 font-mono text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
      <p class="text-xs text-gray-500">格式示例: {"aliyun:wanx2.0-t2i-turbo":{"promptPer1K":1000,"perImage":80}}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {getBillingConfig, updateBillingConfig, type BillingConfig} from '../api/admin'

const saving = ref(false)
const form = ref<BillingConfig>({
  defaultChatRate: {inputPer1K: 1000, outputPer1K: 1000},
  defaultImageRate: {promptPer1K: 1000, perImage: 80},
  chatRates: {},
  imageRates: {},
})
const chatRatesText = ref('{}')
const imageRatesText = ref('{}')

const resetChatJson = () => {
  chatRatesText.value = JSON.stringify(form.value.chatRates, null, 2)
}

const resetImageJson = () => {
  imageRatesText.value = JSON.stringify(form.value.imageRates, null, 2)
}

const fetchConfig = async () => {
  const data = await getBillingConfig()
  form.value = data
  resetChatJson()
  resetImageJson()
}

const saveConfig = async () => {
  saving.value = true
  try {
    const chatRates = JSON.parse(chatRatesText.value || '{}')
    const imageRates = JSON.parse(imageRatesText.value || '{}')

    const updated = await updateBillingConfig({
      defaultChatRate: form.value.defaultChatRate,
      defaultImageRate: form.value.defaultImageRate,
      chatRates,
      imageRates,
    })
    form.value = updated
    resetChatJson()
    resetImageJson()
    alert('计费配置已保存')
  } catch (error) {
    console.error('Save billing config failed:', error)
    alert('保存失败，请检查 JSON 格式')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchConfig()
})
</script>
