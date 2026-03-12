<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">图片生成配置</h1>
      <button @click="saveSettings" :disabled="saving" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm transition-colors">
        <svg v-if="saving" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span v-else>保存配置</span>
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="p-6 space-y-6">
        <div>
          <h2 class="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            图片生成配置（阿里 + 智谱 + 硅基流动）
          </h2>

          <div class="space-y-6">
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <h3 class="text-sm font-medium text-gray-900">启用图片生成</h3>
                <p class="text-xs text-gray-500 mt-1">关闭后前台图片生成功能不可用。</p>
              </div>
              <button
                @click="settings.IMAGE_GEN_ENABLED = settings.IMAGE_GEN_ENABLED === 'true' ? 'false' : 'true'"
                :class="[
                  settings.IMAGE_GEN_ENABLED === 'true' ? 'bg-indigo-600' : 'bg-gray-200',
                  'relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
                ]">
                <span class="sr-only">Toggle image generation</span>
                <span aria-hidden="true" :class="[settings.IMAGE_GEN_ENABLED === 'true' ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200']"></span>
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">默认提供商</label>
                <select v-model="settings.IMAGE_DEFAULT_PROVIDER" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                  <option value="aliyun">阿里云（推荐）</option>
                  <option value="zhipu">智谱</option>
                  <option value="siliconflow">硅基流动（Kolors）</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">默认尺寸</label>
                <select v-model="settings.IMAGE_DEFAULT_SIZE" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                  <option value="1024x1024">1024x1024</option>
                  <option value="768x1024">768x1024</option>
                  <option value="1024x768">1024x768</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">单次最大出图数</label>
                <input v-model="settings.IMAGE_MAX_IMAGES_PER_REQUEST" type="number" min="1" max="4" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="2" />
              </div>
            </div>

            <div class="p-4 rounded-lg border border-gray-200 bg-gray-50/70">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">阿里云模型配置</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">阿里默认模型</label>
                  <input v-model="settings.ALIYUN_IMAGE_MODEL" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="wanx2.0-t2i-turbo" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">阿里 API Key</label>
                  <input v-model="settings.ALIYUN_IMAGE_API_KEY" type="password" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="sk-..." />
                </div>
              </div>
            </div>

            <div class="p-4 rounded-lg border border-gray-200 bg-gray-50/70">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">智谱模型配置</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">智谱默认模型</label>
                  <input v-model="settings.ZHIPU_IMAGE_MODEL" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="cogview-4-250304" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">智谱 API Key</label>
                  <input v-model="settings.ZHIPU_IMAGE_API_KEY" type="password" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="sk-..." />
                </div>
              </div>
            </div>

            <div class="p-4 rounded-lg border border-gray-200 bg-gray-50/70">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">硅基流动模型配置</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">硅基默认模型</label>
                  <input v-model="settings.SILICONFLOW_IMAGE_MODEL" type="text" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="Kwai-Kolors/Kolors" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">硅基 API Key</label>
                  <input v-model="settings.SILICONFLOW_IMAGE_API_KEY" type="password" class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="sk-..." />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showNotification" class="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform translate-y-0">
      <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span class="text-sm font-medium">配置已保存</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted} from 'vue'
import {getGeneralSettings, updateGeneralSettings} from '../api/admin'
import type {GeneralSettings} from '../api/admin'

type ImageSettings = Pick<
  GeneralSettings,
  | 'IMAGE_GEN_ENABLED'
  | 'IMAGE_DEFAULT_PROVIDER'
  | 'IMAGE_DEFAULT_SIZE'
  | 'IMAGE_MAX_IMAGES_PER_REQUEST'
  | 'ALIYUN_IMAGE_MODEL'
  | 'ALIYUN_IMAGE_API_KEY'
  | 'ZHIPU_IMAGE_MODEL'
  | 'ZHIPU_IMAGE_API_KEY'
  | 'SILICONFLOW_IMAGE_MODEL'
  | 'SILICONFLOW_IMAGE_API_KEY'
>

const settings = ref<ImageSettings>({
  IMAGE_GEN_ENABLED: 'true',
  IMAGE_DEFAULT_PROVIDER: 'aliyun',
  IMAGE_DEFAULT_SIZE: '1024x1024',
  IMAGE_MAX_IMAGES_PER_REQUEST: '2',
  ALIYUN_IMAGE_MODEL: 'wanx2.0-t2i-turbo',
  ALIYUN_IMAGE_API_KEY: '',
  ZHIPU_IMAGE_MODEL: 'cogview-4-250304',
  ZHIPU_IMAGE_API_KEY: '',
  SILICONFLOW_IMAGE_MODEL: 'Kwai-Kolors/Kolors',
  SILICONFLOW_IMAGE_API_KEY: '',
})

const saving = ref(false)
const showNotification = ref(false)

const fetchSettings = async () => {
  try {
    const allSettings = await getGeneralSettings()
    settings.value = {
      IMAGE_GEN_ENABLED: allSettings.IMAGE_GEN_ENABLED,
      IMAGE_DEFAULT_PROVIDER: allSettings.IMAGE_DEFAULT_PROVIDER,
      IMAGE_DEFAULT_SIZE: allSettings.IMAGE_DEFAULT_SIZE,
      IMAGE_MAX_IMAGES_PER_REQUEST: allSettings.IMAGE_MAX_IMAGES_PER_REQUEST,
      ALIYUN_IMAGE_MODEL: allSettings.ALIYUN_IMAGE_MODEL,
      ALIYUN_IMAGE_API_KEY: allSettings.ALIYUN_IMAGE_API_KEY,
      ZHIPU_IMAGE_MODEL: allSettings.ZHIPU_IMAGE_MODEL,
      ZHIPU_IMAGE_API_KEY: allSettings.ZHIPU_IMAGE_API_KEY,
      SILICONFLOW_IMAGE_MODEL: allSettings.SILICONFLOW_IMAGE_MODEL,
      SILICONFLOW_IMAGE_API_KEY: allSettings.SILICONFLOW_IMAGE_API_KEY,
    }
  } catch (error) {
    console.error('Failed to fetch image settings:', error)
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    await updateGeneralSettings(settings.value)
    showNotification.value = true
    setTimeout(() => {
      showNotification.value = false
    }, 3000)
  } catch (error) {
    console.error('Failed to save image settings:', error)
    alert('保存失败，请重试')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchSettings()
})
</script>
