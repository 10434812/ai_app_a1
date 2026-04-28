import WxPay from 'wechatpay-node-v3';
import { SystemConfig } from "../../models/SystemConfig.js";
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const readConfigMap = async (keys) => {
    const rows = await SystemConfig.findAll({ where: { key: keys } });
    const map = new Map(rows.map((row) => [row.key, row.value || '']));
    return map;
};
const normalizeHeaderValue = (value) => {
    if (Array.isArray(value))
        return value[0];
    return value;
};
const CONFIG_KEYS = [
    'WECHAT_PAY_ENABLED',
    'WECHAT_PAY_MOCK_MODE',
    'WECHAT_PAY_APP_ID',
    'WECHAT_PAY_MCH_ID',
    'WECHAT_PAY_API_V3_KEY',
    'WECHAT_PAY_CERT_SERIAL_NO',
    'WECHAT_PAY_CERT_PEM',
    'WECHAT_PAY_PRIVATE_KEY',
    'WECHAT_PAY_NOTIFY_URL',
];
const parseBoolean = (value, fallback) => {
    if (value === undefined || value === null || value === '')
        return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};
const normalizePem = (value) => value.replace(/\r\n/g, '\n').trim();
class WeChatPayService {
    async resolveConfig(override) {
        const configMap = await readConfigMap([...CONFIG_KEYS]);
        const merged = {
            WECHAT_PAY_ENABLED: override?.enabled === undefined ? configMap.get('WECHAT_PAY_ENABLED') : String(override.enabled),
            WECHAT_PAY_MOCK_MODE: override?.mockMode === undefined ? configMap.get('WECHAT_PAY_MOCK_MODE') : String(override.mockMode),
            WECHAT_PAY_APP_ID: override?.appId ?? configMap.get('WECHAT_PAY_APP_ID') ?? process.env.WX_APP_ID ?? '',
            WECHAT_PAY_MCH_ID: override?.mchId ?? configMap.get('WECHAT_PAY_MCH_ID') ?? process.env.WX_MCH_ID ?? '',
            WECHAT_PAY_API_V3_KEY: override?.apiV3Key ?? configMap.get('WECHAT_PAY_API_V3_KEY') ?? process.env.WX_API_V3_KEY ?? '',
            WECHAT_PAY_CERT_SERIAL_NO: override?.certSerialNo ?? configMap.get('WECHAT_PAY_CERT_SERIAL_NO') ?? process.env.WX_CERT_SERIAL_NO ?? '',
            WECHAT_PAY_CERT_PEM: override?.certPem ?? configMap.get('WECHAT_PAY_CERT_PEM') ?? process.env.WX_CERT_PEM ?? '',
            WECHAT_PAY_PRIVATE_KEY: override?.privateKey ?? configMap.get('WECHAT_PAY_PRIVATE_KEY') ?? process.env.WX_PRIVATE_KEY ?? '',
            WECHAT_PAY_NOTIFY_URL: override?.notifyUrl ?? configMap.get('WECHAT_PAY_NOTIFY_URL') ?? process.env.WX_PAY_NOTIFY_URL ?? '',
        };
        return {
            enabled: parseBoolean(merged.WECHAT_PAY_ENABLED, false),
            mockMode: parseBoolean(merged.WECHAT_PAY_MOCK_MODE, !IS_PRODUCTION),
            appId: String(merged.WECHAT_PAY_APP_ID || '').trim(),
            mchId: String(merged.WECHAT_PAY_MCH_ID || '').trim(),
            apiV3Key: String(merged.WECHAT_PAY_API_V3_KEY || '').trim(),
            certSerialNo: String(merged.WECHAT_PAY_CERT_SERIAL_NO || '').trim(),
            certPem: normalizePem(String(merged.WECHAT_PAY_CERT_PEM || '')),
            privateKey: normalizePem(String(merged.WECHAT_PAY_PRIVATE_KEY || '')),
            notifyUrl: String(merged.WECHAT_PAY_NOTIFY_URL || '').trim(),
        };
    }
    async getConfig(override) {
        return this.resolveConfig(override);
    }
    async getConfigState(override) {
        const config = await this.getConfig(override);
        const missing = [];
        if (!config.appId)
            missing.push('WECHAT_PAY_APP_ID');
        if (!config.mchId)
            missing.push('WECHAT_PAY_MCH_ID');
        if (!config.apiV3Key)
            missing.push('WECHAT_PAY_API_V3_KEY');
        if (!config.certPem)
            missing.push('WECHAT_PAY_CERT_PEM');
        if (!config.privateKey)
            missing.push('WECHAT_PAY_PRIVATE_KEY');
        if (!config.notifyUrl)
            missing.push('WECHAT_PAY_NOTIFY_URL');
        return {
            config,
            isReady: config.enabled && (config.mockMode || missing.length === 0),
            missing,
        };
    }
    async createClient(override) {
        const { config, isReady, missing } = await this.getConfigState(override);
        if (!config.enabled) {
            throw new Error('微信支付未启用，请先在后台开启');
        }
        if (config.mockMode) {
            return { config, client: null };
        }
        if (!isReady) {
            throw new Error(`微信支付配置不完整：${missing.join(', ')}`);
        }
        const client = new WxPay({
            appid: config.appId,
            mchid: config.mchId,
            serial_no: config.certSerialNo || undefined,
            publicKey: Buffer.from(config.certPem),
            privateKey: Buffer.from(config.privateKey),
            key: config.apiV3Key,
        });
        return { config, client };
    }
    async testConfiguration(override) {
        const { config, missing } = await this.getConfigState(override);
        if (!config.enabled) {
            return {
                success: false,
                mode: config.mockMode ? 'mock' : 'live',
                message: '微信支付未启用，请先开启后再测试',
                missing,
            };
        }
        if (config.mockMode) {
            return {
                success: true,
                mode: 'mock',
                message: '当前为模拟支付模式，配置格式已通过，本次未直连微信支付校验',
                missing,
                merchantSerialNo: config.certSerialNo || undefined,
            };
        }
        if (missing.length > 0) {
            return {
                success: false,
                mode: 'live',
                message: `微信支付配置不完整：${missing.join(', ')}`,
                missing,
            };
        }
        const { client } = await this.createClient(config);
        const merchantSerialNo = config.certSerialNo || client.getSN(config.certPem);
        const certificates = await client.get_certificates(config.apiV3Key);
        return {
            success: true,
            mode: 'live',
            message: `微信支付配置可用，已成功拉取 ${certificates.length} 张平台证书`,
            missing: [],
            certificateCount: certificates.length,
            merchantSerialNo,
        };
    }
    async createNativeTransaction(orderId, description, amount) {
        const { config, client } = await this.createClient();
        if (!client) {
            return {
                type: 'native',
                code_url: `weixin://wxpay/bizpayurl?pr=${Math.random().toString(36).slice(2)}`,
                mock: true,
            };
        }
        const result = (await client.transactions_native({
            description,
            out_trade_no: orderId,
            notify_url: config.notifyUrl,
            amount: {
                total: Math.round(amount * 100),
                currency: 'CNY',
            },
        }));
        if (result?.status !== 200 || !result?.data?.code_url) {
            throw new Error(result?.error || '微信 Native 下单失败');
        }
        return {
            type: 'native',
            code_url: result.data.code_url || '',
        };
    }
    async createJsapiTransaction(orderId, description, amount, openid) {
        const { config, client } = await this.createClient();
        if (!openid) {
            throw new Error('JSAPI 支付需要微信登录用户');
        }
        if (!client) {
            return {
                type: 'jsapi',
                appId: config.appId,
                timeStamp: `${Math.floor(Date.now() / 1000)}`,
                nonceStr: Math.random().toString(36).slice(2, 15),
                package: `prepay_id=mock_${orderId}`,
                signType: 'RSA',
                paySign: 'mock',
                mock: true,
            };
        }
        const result = (await client.transactions_jsapi({
            description,
            out_trade_no: orderId,
            notify_url: config.notifyUrl,
            amount: {
                total: Math.round(amount * 100),
                currency: 'CNY',
            },
            payer: {
                openid,
            },
        }));
        if (result?.status !== 200 || !result?.data?.package) {
            throw new Error(result?.error || '微信 JSAPI 下单失败');
        }
        return {
            type: 'jsapi',
            appId: String(result.data.appId || ''),
            timeStamp: String(result.data.timeStamp || ''),
            nonceStr: String(result.data.nonceStr || ''),
            package: String(result.data.package || ''),
            signType: String(result.data.signType || 'RSA'),
            paySign: String(result.data.paySign || ''),
        };
    }
    async verifySignature(headers, body) {
        const { config, client } = await this.createClient();
        if (!client) {
            return !IS_PRODUCTION;
        }
        const timestamp = normalizeHeaderValue(headers['wechatpay-timestamp']);
        const nonce = normalizeHeaderValue(headers['wechatpay-nonce']);
        const serial = normalizeHeaderValue(headers['wechatpay-serial']);
        const signature = normalizeHeaderValue(headers['wechatpay-signature']);
        if (!timestamp || !nonce || !serial || !signature)
            return false;
        const bodyPayload = typeof body === 'string' ? body : JSON.stringify(body || {});
        return client.verifySign({
            timestamp,
            nonce,
            serial,
            signature,
            body: bodyPayload,
            apiSecret: config.apiV3Key,
        });
    }
    async decryptResource(resource) {
        const { config, client } = await this.createClient();
        if (!client)
            return resource;
        const { ciphertext, associated_data, nonce } = resource;
        return client.decipher_gcm(ciphertext, associated_data, nonce, config.apiV3Key);
    }
    async createRefund(params) {
        const { config, client } = await this.createClient();
        const outRefundNo = `${params.orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}R${Date.now()}`;
        if (!client) {
            return {
                outRefundNo,
                refundId: `mock_refund_${Date.now()}`,
                status: 'SUCCESS',
                successTime: new Date().toISOString(),
                mock: true,
            };
        }
        const total = Math.max(1, Math.round(Number(params.totalAmount || 0) * 100));
        const refund = Math.max(1, Math.round(Number(params.refundAmount || 0) * 100));
        const payloadBase = {
            out_refund_no: outRefundNo,
            reason: params.reason || 'admin_refund',
            notify_url: params.notifyUrl || config.notifyUrl,
            amount: {
                total,
                refund,
                currency: 'CNY',
            },
        };
        const payload = params.transactionId
            ? {
                ...payloadBase,
                transaction_id: params.transactionId,
            }
            : {
                ...payloadBase,
                out_trade_no: params.outTradeNo || params.orderId,
            };
        const result = (await client.refunds(payload));
        return {
            outRefundNo,
            refundId: result?.data?.refund_id,
            status: result?.data?.status,
            successTime: result?.data?.success_time,
            mock: false,
        };
    }
}
export const weChatPayService = new WeChatPayService();
