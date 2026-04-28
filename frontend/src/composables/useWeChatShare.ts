import {ref} from 'vue'
import wx from 'weixin-js-sdk'
import {requestJson} from '@/utils/http'

export interface WeChatShareData {
  title: string
  desc: string
  link: string
  imgUrl: string
}

interface WeChatApiSupportResponse {
  checkResult?: Record<string, boolean>
}

interface WeChatConfigError {
  errMsg?: string
  message?: string
}

declare global {
  interface Window {
    MSStream?: unknown
  }
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  const normalized = error as WeChatConfigError | null | undefined
  if (typeof normalized?.message === 'string' && normalized.message.trim()) return normalized.message.trim()
  if (typeof normalized?.errMsg === 'string' && normalized.errMsg.trim()) return normalized.errMsg.trim()
  return fallback
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
const entryUrl = decodeURIComponent(window.location.href.split('#')[0])
const isWeChatBrowser = /micromessenger/i.test(navigator.userAgent)

const shareStatus = ref<'idle' | 'ready' | 'error' | 'success'>('idle')
const errorMsg = ref('')
const voiceApiSupported = ref(false)
const isRetrying = ref(false)

let initPromise: Promise<void> | null = null
let configVersion = 0

async function reportShareEvent(type: string, url: string) {
  try {
    await requestJson('/api/wechat/callback', {
      method: 'POST',
      body: JSON.stringify({type, url, status: 'success'}),
    }, '上报分享事件失败')
    shareStatus.value = 'success'
  } catch (error) {
    console.error('Failed to report share event', error)
  }
}

async function getSignature(url: string) {
  return requestJson<{appId: string; timestamp: number; nonceStr: string; signature: string}>(
    '/api/wechat/signature',
    {
      method: 'POST',
      body: JSON.stringify({url}),
    },
    '获取微信签名失败',
  )
}

function inspectVoiceApiSupport() {
  return new Promise<void>((resolve) => {
    if (typeof wx.checkJsApi !== 'function') {
      voiceApiSupported.value = true
      resolve()
      return
    }

    wx.checkJsApi({
      jsApiList: ['startRecord', 'stopRecord', 'translateVoice'],
      success: (res: WeChatApiSupportResponse) => {
        const checkResult = res?.checkResult || {}
        voiceApiSupported.value = Boolean(
          checkResult.startRecord !== false &&
            checkResult.stopRecord !== false &&
            checkResult.translateVoice !== false,
        )
        resolve()
      },
      fail: () => {
        voiceApiSupported.value = true
        resolve()
      },
    })
  })
}

async function configAndSign(url: string) {
  const {appId, timestamp, nonceStr, signature} = await getSignature(url)
  const currentVersion = ++configVersion

  return new Promise<void>((resolve, reject) => {
    wx.config({
      debug: false,
      appId,
      timestamp,
      nonceStr,
      signature,
      jsApiList: [
        'checkJsApi',
        'updateAppMessageShareData',
        'updateTimelineShareData',
        'startRecord',
        'stopRecord',
        'translateVoice',
      ],
    })

    wx.ready(async () => {
      if (currentVersion !== configVersion) return
      try {
        await inspectVoiceApiSupport()
        shareStatus.value = 'ready'
        isRetrying.value = false
        resolve()
      } catch (error) {
        reject(error)
      }
    })

    wx.error((err: WeChatConfigError) => {
      if (currentVersion !== configVersion) return
      console.error('[WeChat] Config Error:', err)
      reject(err)
    })
  })
}

async function initWeChat() {
  if (!isWeChatBrowser) return
  if (shareStatus.value === 'ready' || shareStatus.value === 'success') return
  if (initPromise) return initPromise

  shareStatus.value = 'idle'
  errorMsg.value = ''
  voiceApiSupported.value = false

  initPromise = (async () => {
    try {
      const currentUrl = decodeURIComponent(window.location.href.split('#')[0])
      const urlToSign = isIOS ? entryUrl : currentUrl

      try {
        await configAndSign(urlToSign)
      } catch (err: unknown) {
        const errMsg = getErrorMessage(err, '')
        if (!isRetrying.value && (errMsg.includes('signature') || errMsg.includes('config:fail'))) {
          isRetrying.value = true
          const retryUrl = urlToSign === entryUrl ? currentUrl : entryUrl
          if (retryUrl !== urlToSign) {
            await configAndSign(retryUrl)
            return
          }
        }
        throw err
      }
    } catch (err: unknown) {
      console.error('Failed to init WeChat JSSDK:', err)
      shareStatus.value = 'error'
      errorMsg.value = getErrorMessage(err, '微信能力初始化失败')
      voiceApiSupported.value = false
      throw err
    } finally {
      initPromise = null
    }
  })()

  return initPromise
}

async function ensureWeChatReady() {
  if (!isWeChatBrowser) {
    throw new Error('当前不在微信浏览器中')
  }

  if (shareStatus.value !== 'ready' && shareStatus.value !== 'success') {
    await initWeChat()
  }

  if (shareStatus.value !== 'ready' && shareStatus.value !== 'success') {
    throw new Error(errorMsg.value || '微信能力尚未就绪')
  }
}

function setShareData(data: WeChatShareData) {
  if (!isWeChatBrowser) return

  wx.ready(() => {
    wx.updateAppMessageShareData({
      title: data.title,
      desc: data.desc,
      link: data.link,
      imgUrl: data.imgUrl,
      success() {
        reportShareEvent('friend', data.link)
      },
    })

    wx.updateTimelineShareData({
      title: data.title,
      link: data.link,
      imgUrl: data.imgUrl,
      success() {
        reportShareEvent('timeline', data.link)
      },
    })
  })
}

export function useWeChatShare() {
  return {
    initWeChat,
    ensureWeChatReady,
    setShareData,
    shareStatus,
    errorMsg,
    voiceApiSupported,
    isWeChatBrowser,
  }
}
