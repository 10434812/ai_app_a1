import { SystemConfig } from "../models/SystemConfig.js";
import { ALL_MODELS } from "./llm/config.js";
const KEY_CHAT_RATES = 'BILLING_CHAT_RATES_V1';
const KEY_IMAGE_RATES = 'BILLING_IMAGE_RATES_V1';
const KEY_DEFAULT_CHAT_RATE = 'BILLING_DEFAULT_CHAT_RATE_V1';
const KEY_DEFAULT_IMAGE_RATE = 'BILLING_DEFAULT_IMAGE_RATE_V1';
const safeNumber = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0)
        return fallback;
    return parsed;
};
const normalizeChatRate = (value, fallback) => {
    const normalized = value && typeof value === 'object' ? value : {};
    return {
        inputPer1K: safeNumber(normalized.inputPer1K, fallback.inputPer1K),
        outputPer1K: safeNumber(normalized.outputPer1K, fallback.outputPer1K),
    };
};
const normalizeImageRate = (value, fallback) => {
    const normalized = value && typeof value === 'object' ? value : {};
    return {
        promptPer1K: safeNumber(normalized.promptPer1K, fallback.promptPer1K),
        perImage: safeNumber(normalized.perImage, fallback.perImage),
    };
};
const parseJsonRecord = (raw) => {
    try {
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
};
const buildDefaultChatRates = () => {
    const rates = {};
    for (const model of ALL_MODELS) {
        rates[model.id] = { inputPer1K: 50, outputPer1K: 50 };
    }
    return rates;
};
const buildDefaultImageRates = () => ({
    'aliyun:wanx2.0-t2i-turbo': { promptPer1K: 1000, perImage: 80 },
    'aliyun:wanx2.1-t2i-turbo': { promptPer1K: 1000, perImage: 80 },
    'zhipu:cogview-4-250304': { promptPer1K: 1000, perImage: 90 },
    'model:aliyun-image': { promptPer1K: 1000, perImage: 80 },
    'model:wanxiang': { promptPer1K: 1000, perImage: 80 },
    'model:zhipu-image': { promptPer1K: 1000, perImage: 90 },
});
const getConfigValue = async (key) => {
    try {
        const row = await SystemConfig.findByPk(key);
        return row?.value || '';
    }
    catch {
        return '';
    }
};
const setConfigValue = async (key, value) => {
    const [row] = await SystemConfig.findOrCreate({
        where: { key },
        defaults: { value },
    });
    row.value = value;
    await row.save();
};
export const estimateTextTokens = (text) => {
    if (!text)
        return 0;
    return Math.max(1, Math.ceil(text.length / 4));
};
export const getBillingConfig = async () => {
    const defaultChatRate = { inputPer1K: 50, outputPer1K: 50 };
    const defaultImageRate = { promptPer1K: 50, perImage: 80 };
    const defaultChatRates = buildDefaultChatRates();
    const defaultImageRates = buildDefaultImageRates();
    const [chatRatesRaw, imageRatesRaw, defaultChatRaw, defaultImageRaw] = await Promise.all([
        getConfigValue(KEY_CHAT_RATES),
        getConfigValue(KEY_IMAGE_RATES),
        getConfigValue(KEY_DEFAULT_CHAT_RATE),
        getConfigValue(KEY_DEFAULT_IMAGE_RATE),
    ]);
    const chatRatesParsed = parseJsonRecord(chatRatesRaw);
    const imageRatesParsed = parseJsonRecord(imageRatesRaw);
    const defaultChatParsed = parseJsonRecord(defaultChatRaw);
    const defaultImageParsed = parseJsonRecord(defaultImageRaw);
    const normalizedDefaultChat = normalizeChatRate(defaultChatParsed, defaultChatRate);
    const normalizedDefaultImage = normalizeImageRate(defaultImageParsed, defaultImageRate);
    const normalizedChatRates = {};
    const mergedChat = { ...defaultChatRates, ...chatRatesParsed };
    for (const key of Object.keys(mergedChat)) {
        normalizedChatRates[key] = normalizeChatRate(mergedChat[key], normalizedDefaultChat);
    }
    const normalizedImageRates = {};
    const mergedImage = { ...defaultImageRates, ...imageRatesParsed };
    for (const key of Object.keys(mergedImage)) {
        normalizedImageRates[key] = normalizeImageRate(mergedImage[key], normalizedDefaultImage);
    }
    return {
        defaultChatRate: normalizedDefaultChat,
        defaultImageRate: normalizedDefaultImage,
        chatRates: normalizedChatRates,
        imageRates: normalizedImageRates,
    };
};
export const updateBillingConfig = async (payload) => {
    const current = await getBillingConfig();
    const nextDefaultChat = payload.defaultChatRate
        ? normalizeChatRate(payload.defaultChatRate, current.defaultChatRate)
        : current.defaultChatRate;
    const nextDefaultImage = payload.defaultImageRate
        ? normalizeImageRate(payload.defaultImageRate, current.defaultImageRate)
        : current.defaultImageRate;
    const nextChatRates = { ...current.chatRates };
    if (payload.chatRates) {
        for (const [key, value] of Object.entries(payload.chatRates)) {
            nextChatRates[key] = normalizeChatRate(value, nextDefaultChat);
        }
    }
    const nextImageRates = { ...current.imageRates };
    if (payload.imageRates) {
        for (const [key, value] of Object.entries(payload.imageRates)) {
            nextImageRates[key] = normalizeImageRate(value, nextDefaultImage);
        }
    }
    await Promise.all([
        setConfigValue(KEY_DEFAULT_CHAT_RATE, JSON.stringify(nextDefaultChat)),
        setConfigValue(KEY_DEFAULT_IMAGE_RATE, JSON.stringify(nextDefaultImage)),
        setConfigValue(KEY_CHAT_RATES, JSON.stringify(nextChatRates)),
        setConfigValue(KEY_IMAGE_RATES, JSON.stringify(nextImageRates)),
    ]);
    return {
        defaultChatRate: nextDefaultChat,
        defaultImageRate: nextDefaultImage,
        chatRates: nextChatRates,
        imageRates: nextImageRates,
    };
};
export const calculateChatCost = (config, modelId, promptTokens, completionTokens) => {
    const rate = config.chatRates[modelId] || config.defaultChatRate;
    const raw = (Math.max(0, promptTokens) / 1000) * rate.inputPer1K +
        (Math.max(0, completionTokens) / 1000) * rate.outputPer1K;
    return Math.max(1, Math.ceil(raw));
};
const resolveImageRate = (config, params) => {
    const byProviderModel = `${params.provider}:${params.model}`;
    if (config.imageRates[byProviderModel])
        return config.imageRates[byProviderModel];
    if (params.modelId && config.imageRates[`model:${params.modelId}`])
        return config.imageRates[`model:${params.modelId}`];
    return config.defaultImageRate;
};
export const calculateImageCost = (config, params, promptTokens, imageCount) => {
    const rate = resolveImageRate(config, params);
    const raw = (Math.max(0, promptTokens) / 1000) * rate.promptPer1K + Math.max(1, imageCount) * rate.perImage;
    return Math.max(1, Math.ceil(raw));
};
