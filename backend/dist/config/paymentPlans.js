export const PAYMENT_PLANS = {
    monthly: { amount: 29.9, durationDays: 30, name: '月卡会员' },
    quarterly: { amount: 79.9, durationDays: 90, name: '季卡会员' },
    yearly: { amount: 299.9, durationDays: 365, name: '年卡会员' },
    token_pack_1000: { amount: 9.9, tokens: 1000, name: '1000 Token加油包' },
};
export const inferPlanKeyFromOrderPlan = (plan) => {
    if (plan === 'monthly')
        return 'monthly';
    if (plan === 'quarterly')
        return 'quarterly';
    if (plan === 'yearly')
        return 'yearly';
    if (plan === 'token_pack')
        return 'token_pack_1000';
    return '';
};
export const getPlanName = (planKey) => {
    if (planKey === 'monthly')
        return '月卡会员';
    if (planKey === 'quarterly')
        return '季卡会员';
    if (planKey === 'yearly')
        return '年卡会员';
    if (planKey.startsWith('token_pack'))
        return 'Token加油包';
    return planKey || '未知套餐';
};
export const makePlanSnapshot = (planKey, plan) => JSON.stringify({
    key: planKey,
    amount: Number(plan.amount || 0),
    durationDays: Number(plan.durationDays || 0),
    tokens: Number(plan.tokens || 0),
    name: plan.name || '',
    createdAt: new Date().toISOString(),
});
export const parsePlanSnapshot = (raw) => {
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
};
