import axios from 'axios'
import { SystemConfig } from '../../models/SystemConfig.js'

interface WeChatConfig {
  appId: string
  appSecret: string
}

interface WeChatOAuthToken {
  access_token: string
  expires_in: number
  refresh_token: string
  openid: string
  scope: string
  unionid?: string
}

interface WeChatUserInfo {
  openid: string
  nickname: string
  sex: number
  province: string
  city: string
  country: string
  headimgurl: string
  privilege: string[]
  unionid?: string
}

export class WeChatOAuthService {
  private static async getConfig(): Promise<WeChatConfig> {
    const appIdConfig = await SystemConfig.findOne({ where: { key: 'WECHAT_APP_ID' } })
    const appSecretConfig = await SystemConfig.findOne({ where: { key: 'WECHAT_APP_SECRET' } })

    const appId = appIdConfig?.value || process.env.WECHAT_APP_ID
    const appSecret = appSecretConfig?.value || process.env.WECHAT_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error('WeChat AppID or AppSecret not configured')
    }

    return { appId, appSecret }
  }

  static async getOAuthToken(code: string): Promise<WeChatOAuthToken> {
    const { appId, appSecret } = await this.getConfig()
    const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`
    
    const response = await axios.get(url)
    if (response.data.errcode) {
      throw new Error(`Failed to get OAuth token: ${response.data.errmsg}`)
    }

    return response.data
  }

  static async getUserInfo(accessToken: string, openId: string): Promise<WeChatUserInfo> {
    const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openId}&lang=zh_CN`
    
    const response = await axios.get(url)
    if (response.data.errcode) {
      throw new Error(`Failed to get user info: ${response.data.errmsg}`)
    }

    return response.data
  }

  static async processCallback(code: string) {
    const tokenData = await this.getOAuthToken(code)
    const userInfo = await this.getUserInfo(tokenData.access_token, tokenData.openid)
    return userInfo
  }
}
