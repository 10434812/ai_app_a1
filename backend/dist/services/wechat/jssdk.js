import axios from 'axios';
import crypto from 'crypto';
import redisClient from "../../config/redis.js";
import { SystemConfig } from "../../models/SystemConfig.js";
const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';
// Cache keys
const ACCESS_TOKEN_KEY = 'wechat:access_token';
const JSAPI_TICKET_KEY = 'wechat:jsapi_ticket';
export class WeChatService {
    static async getConfig() {
        // Priority: DB SystemConfig > Environment Variables
        const appIdConfig = await SystemConfig.findOne({ where: { key: 'WECHAT_APP_ID' } });
        const appSecretConfig = await SystemConfig.findOne({ where: { key: 'WECHAT_APP_SECRET' } });
        const appId = appIdConfig?.value || process.env.WECHAT_APP_ID;
        const appSecret = appSecretConfig?.value || process.env.WECHAT_APP_SECRET;
        if (!appId || !appSecret) {
            throw new Error('WeChat AppID or AppSecret not configured');
        }
        // Handle ngrok or other reverse proxy warning pages
        // We add a custom User-Agent to bypass ngrok's warning page
        axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
        axios.defaults.headers.common['User-Agent'] = 'AIApp-Backend-Service';
        return { appId, appSecret };
    }
    static async getAccessToken() {
        const cachedToken = await redisClient.get(ACCESS_TOKEN_KEY);
        if (cachedToken)
            return cachedToken;
        const { appId, appSecret } = await this.getConfig();
        const url = `${WECHAT_API_BASE}/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
        const response = await axios.get(url);
        if (response.data.errcode) {
            throw new Error(`Failed to get access token: ${response.data.errmsg}`);
        }
        const token = response.data.access_token;
        const expiresIn = response.data.expires_in || 7200;
        // Cache with slight buffer (subtract 200s)
        await redisClient.set(ACCESS_TOKEN_KEY, token, { EX: expiresIn - 200 });
        return token;
    }
    static async getJsApiTicket() {
        const cachedTicket = await redisClient.get(JSAPI_TICKET_KEY);
        if (cachedTicket)
            return cachedTicket;
        const accessToken = await this.getAccessToken();
        const url = `${WECHAT_API_BASE}/ticket/getticket?access_token=${accessToken}&type=jsapi`;
        const response = await axios.get(url);
        if (response.data.errcode !== 0) {
            throw new Error(`Failed to get jsapi ticket: ${response.data.errmsg}`);
        }
        const ticket = response.data.ticket;
        const expiresIn = response.data.expires_in || 7200;
        await redisClient.set(JSAPI_TICKET_KEY, ticket, { EX: expiresIn - 200 });
        return ticket;
    }
    static createNonceStr() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    static createTimestamp() {
        return Math.floor(Date.now() / 1000);
    }
    static sign(ticket, nonceStr, timestamp, url) {
        const str = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
        const shasum = crypto.createHash('sha1');
        shasum.update(str);
        return shasum.digest('hex');
    }
    static async getSignature(url) {
        const ticket = await this.getJsApiTicket();
        const nonceStr = this.createNonceStr();
        const timestamp = this.createTimestamp();
        const signature = this.sign(ticket, nonceStr, timestamp, url);
        const { appId } = await this.getConfig();
        return {
            appId,
            timestamp,
            nonceStr,
            signature,
        };
    }
}
