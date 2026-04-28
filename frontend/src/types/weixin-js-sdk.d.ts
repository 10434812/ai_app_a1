declare module 'weixin-js-sdk' {
  interface WeChatConfigOptions {
    debug?: boolean
    appId: string
    timestamp: number
    nonceStr: string
    signature: string
    jsApiList: string[]
  }

  interface WeChatConfigError {
    errMsg?: string
    message?: string
  }

  interface WeChatCheckJsApiResult {
    checkResult?: Record<string, boolean>
  }

  interface WeChatVoiceResult {
    localId?: string
    translateResult?: string
    errMsg?: string
    message?: string
  }

  interface WeChatShareOptions {
    title: string
    link: string
    imgUrl: string
    desc?: string
    success?: () => void
    fail?: (error: WeChatConfigError) => void
  }

  interface WeChatSdk {
    config(options: WeChatConfigOptions): void
    ready(callback: () => void): void
    error(callback: (error: WeChatConfigError) => void): void
    checkJsApi(options: {
      jsApiList: string[]
      success?: (result: WeChatCheckJsApiResult) => void
      fail?: (error: WeChatConfigError) => void
    }): void
    startRecord(options: {
      success?: () => void
      cancel?: (error: WeChatConfigError) => void
      fail?: (error: WeChatConfigError) => void
    }): void
    stopRecord(options: {
      success?: (result: WeChatVoiceResult) => void
      fail?: (error: WeChatConfigError) => void
    }): void
    onVoiceRecordEnd(options: {
      complete: (result: WeChatVoiceResult) => void
    }): void
    translateVoice(options: {
      localId: string
      isShowProgressTips?: 0 | 1
      success?: (result: WeChatVoiceResult) => void
      fail?: (error: WeChatConfigError) => void
    }): void
    updateAppMessageShareData(options: WeChatShareOptions): void
    updateTimelineShareData(options: Omit<WeChatShareOptions, 'desc'>): void
  }

  const wx: WeChatSdk
  export default wx
}
