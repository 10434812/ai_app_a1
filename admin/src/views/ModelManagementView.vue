<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-800">模型管理</h1>
    </div>

    <div class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
      模型列表已按前端分类完整保留。即使暂未接入的模型也会继续展示，方便你后续随时补配置；绘图模型的实际出图参数仍以“图片生成配置”为准。
    </div>

    <div class="flex flex-wrap gap-2">
      <span
        v-for="group in groupedModels"
        :key="group.name"
        class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
      >
        {{ group.name }}
        <span class="text-slate-400">{{ group.models.length }}</span>
      </span>
    </div>

    <div v-for="group in groupedModels" :key="group.name" class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700 tracking-wide">{{ group.name }}</h2>
        <span class="text-xs text-slate-500">{{ group.models.length }} 个模型</span>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模型 ID</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">提供商</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="model in group.models" :key="model.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ model.id }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                <div class="font-medium text-gray-800">{{ model.name }}</div>
                <div v-if="model.description" class="mt-1 text-xs text-gray-400">{{ model.description }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {{ model.provider }}
                </span>
                <span v-if="model.isCustomized" class="ml-2 text-xs text-amber-600 border border-amber-200 bg-amber-50 px-1 rounded">自定义</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${model.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`">
                  {{ model.isActive ? '启用' : '禁用' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button @click="openConfigModal(model)" class="text-indigo-600 hover:text-indigo-900">配置</button>
                <button @click="toggleStatus(model)" :class="`text-sm font-medium ${model.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`">
                  {{ model.isActive ? '禁用' : '启用' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Config Modal -->
    <div v-if="isConfigModalOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
        <h2 class="text-xl font-bold mb-4">配置模型: {{ editingModel?.name }}</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">提供商类型</label>
            <select v-model="configForm.provider" class="w-full rounded-md border border-gray-300 p-2">
              <option value="mock">Mock (模拟)</option>
              <option value="openai">OpenAI Compatible (通用接口)</option>
            </select>
          </div>

          <div v-if="configForm.provider === 'openai'" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Base URL (接口地址)</label>
              <input v-model="configForm.baseURL" type="text" placeholder="https://api.example.com/v1" class="w-full rounded-md border border-gray-300 p-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input v-model="configForm.apiKey" type="password" placeholder="sk-..." class="w-full rounded-md border border-gray-300 p-2" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Model ID (实际模型名称)</label>
              <input v-model="configForm.modelId" type="text" :placeholder="editingModel?.id" class="w-full rounded-md border border-gray-300 p-2" />
              <p class="text-xs text-gray-500 mt-1">调用 API 时传递的模型参数名，如 gpt-4o, deepseek-chat</p>
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button @click="closeConfigModal" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">取消</button>
          <button @click="saveConfig" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">保存配置</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, reactive, ref} from 'vue'
import {getModels, toggleModelStatus, updateModelConfig} from '../api/admin'
import type {ModelConfig} from '../api/admin'

const models = ref<ModelConfig[]>([])
const isConfigModalOpen = ref(false)
const editingModel = ref<ModelConfig | null>(null)

const CATEGORY_ORDER = ['对话', '绘图', '编程', '办公', '视频', '语音', '搜索', '其他'] as const
const FRONTEND_MODEL_ID_ORDER = [
  'deepseek-v3', 'deepseek-r1', 'glm-4', 'qwen-turbo', 'qwen-plus', 'moonshot-v1', 'doubao-pro', 'hunyuan',
  'hailuo', 'yi', 'step-1', 'baichuan', 'tiangong', 'lingguang-ai', 'chatgpt', 'claude', 'gemini', 'grok',
  'qwen-coder', 'marscode', 'codegeex', 'fitten', 'manus', 'cursor', 'github-copilot',
  'kling', 'vidu', 'jimeng', 'runway', 'sora-luma',
  'aliyun-image', 'zhipu-image', 'liblib', 'wanxiang', 'kolors', 'whee', 'midjourney', 'flux',
  'metaso', '360-gpt', 'perplexity',
  'spark', 'notion', 'gamma',
  'suno', 'udio',
] as const
const FRONTEND_MODEL_ORDER = new Map(FRONTEND_MODEL_ID_ORDER.map((id, index) => [id, index]))

function getModelCategory(model: ModelConfig): string {
  return model.category || '其他'
}

const groupedModels = computed(() => {
  const groups = new Map<string, ModelConfig[]>()

  for (const model of models.value) {
    const category = getModelCategory(model)
    const list = groups.get(category) || []
    list.push(model)
    groups.set(category, list)
  }

  return CATEGORY_ORDER.map((name) => ({
    name,
    models: (groups.get(name) || []).slice().sort((a, b) => {
      const aOrder = FRONTEND_MODEL_ORDER.get(a.id)
      const bOrder = FRONTEND_MODEL_ORDER.get(b.id)

      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
      if (aOrder !== undefined) return -1
      if (bOrder !== undefined) return 1
      return a.id.localeCompare(b.id)
    }),
  })).filter((group) => group.models.length > 0)
})

const configForm = reactive({
  provider: 'mock',
  apiKey: '',
  baseURL: '',
  modelId: '',
})

const fetchModels = async () => {
  try {
    models.value = await getModels()
  } catch (error) {
    console.error('Failed to fetch models:', error)
  }
}

const toggleStatus = async (model: ModelConfig) => {
  try {
    await toggleModelStatus(model.id)
    // Refresh list to get latest state
    await fetchModels()
  } catch (error) {
    console.error('Failed to toggle model status:', error)
  }
}

const openConfigModal = (model: ModelConfig) => {
  editingModel.value = model

  if (model.customConfig) {
    configForm.provider = model.customConfig.provider
    configForm.apiKey = '' // Don't show masked key, require re-entry to change
    configForm.baseURL = model.customConfig.baseURL || ''
    configForm.modelId = model.customConfig.modelId || model.defaultConfig?.modelId || model.id
  } else {
    configForm.provider = model.defaultConfig?.provider || (model.provider === 'openai' ? 'openai' : 'mock')
    configForm.apiKey = ''
    configForm.baseURL = model.defaultConfig?.baseURL || ''
    configForm.modelId = model.defaultConfig?.modelId || model.id
  }

  isConfigModalOpen.value = true
}

const closeConfigModal = () => {
  isConfigModalOpen.value = false
  editingModel.value = null
}

const saveConfig = async () => {
  if (!editingModel.value) return

  try {
    await updateModelConfig(editingModel.value.id, {
      provider: configForm.provider,
      apiKey: configForm.apiKey,
      baseURL: configForm.baseURL,
      modelId: configForm.modelId,
    })

    await fetchModels()
    closeConfigModal()
    alert('配置已保存')
  } catch (error) {
    console.error('Failed to save config:', error)
    alert('保存失败')
  }
}

onMounted(() => {
  fetchModels()
})
</script>
