<script setup lang="ts">
import {onMounted, watch} from 'vue'
import {useRoute} from 'vue-router'
import {useWeChatShare} from '@/composables/useWeChatShare'
import {API_BASE_URL} from '@/constants/config'
import {trackVisit} from '@/api/visit'
import {useAuthStore} from '@/stores/auth'

const route = useRoute()
const {initWeChat, setShareData} = useWeChatShare()
const authStore = useAuthStore()

const updateShare = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/config`)
    const config = await res.json()
    
    setShareData({
      title: config.wechat_share_title || 'AI 智能助手',
      desc: config.wechat_share_desc || '汇聚全球顶尖大模型，为您提供智能问答服务',
      link: config.wechat_share_link || window.location.href.split('#')[0],
      imgUrl: config.wechat_share_img || window.location.origin + '/logo.png',
    })
  } catch (e) {
    console.error('Failed to update share data:', e)
  }
}

onMounted(async () => {
  await initWeChat()
  updateShare()
  trackVisit(route.path)
})

watch(
  () => route.path,
  async () => {
    // Android requires re-config on URL change (handled by initWeChat logic)
    // iOS uses entry URL (also handled)
    await initWeChat()
    updateShare()
    trackVisit(route.path)
  },
)
</script>

<template>
  <router-view />
</template>
