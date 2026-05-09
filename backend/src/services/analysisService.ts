import {Op} from 'sequelize'
import {Conversation} from '../models/Conversation.js'
import {Message} from '../models/Message.js'
import {User} from '../models/User.js'
import {TokenUsageRecord} from '../models/TokenUsageRecord.js'
import {Order} from '../models/Order.js'
import {inferPlanKeyFromOrderPlan} from '../config/paymentPlans.js'

export const getAnalysisStats = async () => {
  const totalConversations = await Conversation.count()
  const totalMessages = await Message.count()
  const totalUsers = await User.count()

  return {
    totalConversations,
    totalMessages,
    totalUsers,
  }
}

export const getUserPortraits = async () => {
  const users = await User.findAll({
    include: [
      {
        model: Conversation,
        include: [Message],
      },
    ],
  })

  const portraits = users.map((user) => {
    // Check if conversations is undefined or null
    const conversations = user.conversations || []
    const messages = conversations.flatMap((c: Conversation) => c.messages || [])
    const userMessages = messages.filter((m: Message) => m.role === 'user')
    const content = userMessages.map((m: Message) => m.content).join(' ')

    const keywords: string[] = []
    if (content.match(/code|program|bug|error|api|java|python|react|vue|node/i)) keywords.push('Developer')
    if (content.match(/write|essay|story|poem|translate/i)) keywords.push('Content Creator')
    if (content.match(/health|doctor|pain|medicine|diet/i)) keywords.push('Health Conscious')
    if (content.match(/money|stock|invest|price|finance/i)) keywords.push('Investor')
    if (content.match(/design|color|ui|ux/i)) keywords.push('Designer')
    if (content.match(/marketing|seo|ad|social/i)) keywords.push('Marketer')

    if (keywords.length === 0 && userMessages.length > 0) keywords.push('General User')

    // Get last active date
    let lastActive = user.createdAt
    if (conversations.length > 0) {
      // Sort conversations by date desc
      const sortedConvos = [...conversations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      lastActive = sortedConvos[0].createdAt
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      totalQuestions: userMessages.length,
      tags: keywords,
      lastActive,
    }
  })

  return portraits
}

export const getRecentQuestions = async (limit = 50) => {
  return await Message.findAll({
    where: {role: 'user'},
    order: [['createdAt', 'DESC']],
    limit,
    include: [
      {
        model: Conversation,
        include: [User],
      },
    ],
  })
}

export const getCostDashboard = async () => {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)
  start.setHours(0, 0, 0, 0)

  const records = await TokenUsageRecord.findAll({
    where: {
      type: {[Op.in]: ['chat', 'image']},
      createdAt: {[Op.gte]: start},
    },
    order: [['createdAt', 'ASC']],
  })

  const daily: Record<string, {estimatedTokens: number; cost: number}> = {}
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const key = date.toISOString().slice(0, 10)
    daily[key] = {estimatedTokens: 0, cost: 0}
  }

  const modelStats: Record<string, {requests: number; estimatedTokens: number; cost: number}> = {}
  let totalTokens = 0
  let totalCost = 0

  for (const record of records) {
    const model = record.model || 'unknown'
    const tokens = Number(record.amount || 0)
    const cost = tokens
    const dateKey = (record.createdAt ? new Date(record.createdAt) : new Date()).toISOString().slice(0, 10)

    if (!modelStats[model]) {
      modelStats[model] = {requests: 0, estimatedTokens: 0, cost: 0}
    }

    modelStats[model].requests += 1
    modelStats[model].estimatedTokens += tokens
    modelStats[model].cost += cost
    if (!daily[dateKey]) daily[dateKey] = {estimatedTokens: 0, cost: 0}
    daily[dateKey].estimatedTokens += tokens
    daily[dateKey].cost += cost

    totalTokens += tokens
    totalCost += cost
  }

  const dailyCosts = Object.keys(daily)
    .sort()
    .map((date) => ({
      date,
      estimatedTokens: daily[date].estimatedTokens,
      cost: Number(daily[date].cost.toFixed(4)),
    }))

  const modelBreakdown = Object.keys(modelStats).map((model) => ({
    model,
    requests: modelStats[model].requests,
    estimatedTokens: modelStats[model].estimatedTokens,
    cost: Number(modelStats[model].cost.toFixed(4)),
  }))

  const averageDailyCost = dailyCosts.length ? Number((totalCost / dailyCosts.length).toFixed(4)) : 0

  return {
    totalTokensLast7Days: totalTokens,
    totalCostLast7Days: Number(totalCost.toFixed(4)),
    averageDailyCost,
    dailyCosts,
    modelBreakdown,
  }
}

export const getRetentionStats = async () => {
  const now = new Date()
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(dayStart)
  weekStart.setDate(dayStart.getDate() - 6)
  const monthStart = new Date(dayStart)
  monthStart.setDate(dayStart.getDate() - 29)

  const dau = await Conversation.count({
    distinct: true,
    col: 'userId',
    where: {userId: {[Op.ne]: null}, updatedAt: {[Op.gte]: dayStart}},
  })
  const wau = await Conversation.count({
    distinct: true,
    col: 'userId',
    where: {userId: {[Op.ne]: null}, updatedAt: {[Op.gte]: weekStart}},
  })
  const mau = await Conversation.count({
    distinct: true,
    col: 'userId',
    where: {userId: {[Op.ne]: null}, updatedAt: {[Op.gte]: monthStart}},
  })

  const newUsersLast7Days = await User.count({
    where: {createdAt: {[Op.gte]: weekStart}},
  })

  const conversations = await Conversation.findAll({
    where: {userId: {[Op.ne]: null}, updatedAt: {[Op.gte]: weekStart}},
    order: [['updatedAt', 'ASC']],
  })

  const dailyActiveMap: Record<string, Set<string>> = {}
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const key = date.toISOString().slice(0, 10)
    dailyActiveMap[key] = new Set<string>()
  }

  for (const convo of conversations) {
    const key = (convo.updatedAt ? new Date(convo.updatedAt) : new Date()).toISOString().slice(0, 10)
    if (!dailyActiveMap[key]) dailyActiveMap[key] = new Set<string>()
    if (convo.userId) dailyActiveMap[key].add(convo.userId)
  }

  const dailyActive = Object.keys(dailyActiveMap)
    .sort()
    .map((date) => ({
      date,
      activeUsers: dailyActiveMap[date].size,
    }))

  return {
    dau,
    wau,
    mau,
    newUsersLast7Days,
    dailyActive,
  }
}

const parseMetaJson = (raw?: string | null) => {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const toDateKey = (value: Date | string | null | undefined) => {
  return (value ? new Date(value) : new Date()).toISOString().slice(0, 10)
}

const ensureDailyRange = (days: number, start: Date) => {
  const result: Record<string, {tokenCost: number; revenue: number; orders: number}> = {}
  for (let i = 0; i < days; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    result[date.toISOString().slice(0, 10)] = {
      tokenCost: 0,
      revenue: 0,
      orders: 0,
    }
  }
  return result
}

export const getTokenEconomicsDashboard = async (daysInput = 30) => {
  const days = Math.min(365, Math.max(7, Number(daysInput) || 30))
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  const [records, orders] = await Promise.all([
    TokenUsageRecord.findAll({
      where: {
        type: {[Op.in]: ['chat', 'image', 'refund']},
        createdAt: {[Op.gte]: start},
      },
      order: [['createdAt', 'ASC']],
    }),
    Order.findAll({
      where: {
        createdAt: {[Op.gte]: start},
        status: {[Op.in]: ['completed', 'refunded']},
      },
      order: [['createdAt', 'ASC']],
    }),
  ])

  const dailyMap = ensureDailyRange(days, start)
  const byTypeMap = new Map<string, {type: string; count: number; cost: number}>()
  const userMap = new Map<string, {userId: string; requests: number; chatCost: number; imageCost: number; totalCost: number}>()
  const modelMap = new Map<string, {model: string; requests: number; chatCost: number; imageCost: number; totalCost: number}>()

  let chatCost = 0
  let imageCost = 0
  let adjustmentCost = 0
  let providerUsageCount = 0
  let estimateUsageCount = 0

  for (const record of records) {
    const type = String(record.type || 'unknown')
    const amount = Number(record.amount || 0)
    const model = String(record.model || 'unknown')
    const dateKey = toDateKey(record.createdAt)
    const meta = parseMetaJson(record.meta)

    if (!byTypeMap.has(type)) {
      byTypeMap.set(type, {type, count: 0, cost: 0})
    }
    const byType = byTypeMap.get(type)!
    byType.count += 1
    byType.cost += amount

    if (type === 'chat') {
      chatCost += amount
    } else if (type === 'image') {
      imageCost += amount
    } else {
      adjustmentCost += amount
    }

    if (dailyMap[dateKey]) {
      dailyMap[dateKey].tokenCost += amount
    }

    const usageSource = String(meta?.usage_source || '')
    if (usageSource === 'provider') providerUsageCount += 1
    if (usageSource === 'estimate') estimateUsageCount += 1

    const userId = String(record.userId || '')
    if (userId) {
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          requests: 0,
          chatCost: 0,
          imageCost: 0,
          totalCost: 0,
        })
      }
      const userStats = userMap.get(userId)!
      userStats.requests += 1
      if (type === 'chat') userStats.chatCost += amount
      if (type === 'image') userStats.imageCost += amount
      userStats.totalCost += amount
    }

    if (!modelMap.has(model)) {
      modelMap.set(model, {
        model,
        requests: 0,
        chatCost: 0,
        imageCost: 0,
        totalCost: 0,
      })
    }
    const modelStats = modelMap.get(model)!
    modelStats.requests += 1
    if (type === 'chat') modelStats.chatCost += amount
    if (type === 'image') modelStats.imageCost += amount
    modelStats.totalCost += amount
  }

  const userIds = Array.from(userMap.keys())
  const users = userIds.length
    ? await User.findAll({
        where: {id: {[Op.in]: userIds}},
        attributes: ['id', 'email', 'name'],
      })
    : []
  const userInfoMap = new Map(users.map((user) => [user.id, user]))

  const topUsers = Array.from(userMap.values())
    .map((item) => {
      const profile = userInfoMap.get(item.userId)
      return {
        ...item,
        email: profile?.email || '',
        name: profile?.name || '',
      }
    })
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10)

  const topModels = Array.from(modelMap.values())
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10)

  let completedRevenue = 0
  let refundedRevenue = 0
  let completedOrderCount = 0
  let refundedOrderCount = 0
  let tokenCompletedRevenue = 0
  let tokenRefundedRevenue = 0
  let membershipCompletedRevenue = 0
  let membershipRefundedRevenue = 0
  const paidUserSet = new Set<string>()
  const planStatsMap = new Map<
    string,
    {
      planKey: string
      completedOrders: number
      refundedOrders: number
      completedRevenue: number
      refundedRevenue: number
      netRevenue: number
    }
  >()

  for (const order of orders) {
    const planKey = order.planKey || inferPlanKeyFromOrderPlan(order.plan) || 'unknown'
    const amount = Number(order.amount || 0)
    const refundAmount = Number(order.refundedAmount || order.amount || 0)
    const isTokenPlan = planKey.includes('token')
    const dateKey = toDateKey(order.createdAt)

    if (!planStatsMap.has(planKey)) {
      planStatsMap.set(planKey, {
        planKey,
        completedOrders: 0,
        refundedOrders: 0,
        completedRevenue: 0,
        refundedRevenue: 0,
        netRevenue: 0,
      })
    }
    const stats = planStatsMap.get(planKey)!

    if (order.status === 'completed') {
      completedRevenue += amount
      completedOrderCount += 1
      paidUserSet.add(order.userId)
      stats.completedOrders += 1
      stats.completedRevenue += amount
      if (isTokenPlan) tokenCompletedRevenue += amount
      else membershipCompletedRevenue += amount

      if (dailyMap[dateKey]) {
        dailyMap[dateKey].revenue += amount
        dailyMap[dateKey].orders += 1
      }
    } else if (order.status === 'refunded') {
      refundedRevenue += refundAmount
      refundedOrderCount += 1
      stats.refundedOrders += 1
      stats.refundedRevenue += refundAmount
      if (isTokenPlan) tokenRefundedRevenue += refundAmount
      else membershipRefundedRevenue += refundAmount

      if (dailyMap[dateKey]) {
        dailyMap[dateKey].revenue -= refundAmount
      }
    }
  }

  const membershipPlans = Array.from(planStatsMap.values())
    .map((item) => ({
      ...item,
      netRevenue: Number((item.completedRevenue - item.refundedRevenue).toFixed(2)),
    }))
    .sort((a, b) => b.netRevenue - a.netRevenue)

  const usageTrackedCount = providerUsageCount + estimateUsageCount
  const providerUsageRate = usageTrackedCount > 0 ? Number(((providerUsageCount / usageTrackedCount) * 100).toFixed(2)) : 0
  const estimateUsageRate = usageTrackedCount > 0 ? Number(((estimateUsageCount / usageTrackedCount) * 100).toFixed(2)) : 0
  const netRevenue = Number((completedRevenue - refundedRevenue).toFixed(2))
  const modelTokenCost = Number((chatCost + imageCost).toFixed(2))
  const grossProfit = Number((netRevenue - modelTokenCost).toFixed(2))
  const refundRate =
    completedRevenue > 0 ? Number(((Math.max(0, refundedRevenue) / completedRevenue) * 100).toFixed(2)) : 0
  const arppu = paidUserSet.size > 0 ? Number((netRevenue / paidUserSet.size).toFixed(2)) : 0

  const daily = Object.keys(dailyMap)
    .sort()
    .map((date) => ({
      date,
      tokenCost: Number(dailyMap[date].tokenCost.toFixed(2)),
      revenue: Number(dailyMap[date].revenue.toFixed(2)),
      orders: dailyMap[date].orders,
    }))

  return {
    rangeDays: days,
    totals: {
      chatCost: Number(chatCost.toFixed(2)),
      imageCost: Number(imageCost.toFixed(2)),
      adjustmentCost: Number(adjustmentCost.toFixed(2)),
      modelTokenCost,
      completedRevenue: Number(completedRevenue.toFixed(2)),
      refundedRevenue: Number(refundedRevenue.toFixed(2)),
      completedOrderCount,
      refundedOrderCount,
      netRevenue,
      grossProfit,
      refundRate,
      tokenNetRevenue: Number((tokenCompletedRevenue - tokenRefundedRevenue).toFixed(2)),
      membershipNetRevenue: Number((membershipCompletedRevenue - membershipRefundedRevenue).toFixed(2)),
      paidUsers: paidUserSet.size,
      arppu,
      revenuePerPaidUser: arppu,
      records: records.length,
      usageTrackedCount,
      providerUsageCount,
      estimateUsageCount,
      providerUsageRate,
      estimateUsageRate,
    },
    byType: Array.from(byTypeMap.values())
      .map((item) => ({...item, cost: Number(item.cost.toFixed(2))}))
      .sort((a, b) => b.cost - a.cost),
    topUsers: topUsers.map((item) => ({
      ...item,
      chatCost: Number(item.chatCost.toFixed(2)),
      imageCost: Number(item.imageCost.toFixed(2)),
      totalCost: Number(item.totalCost.toFixed(2)),
    })),
    topModels: topModels.map((item) => ({
      ...item,
      chatCost: Number(item.chatCost.toFixed(2)),
      imageCost: Number(item.imageCost.toFixed(2)),
      totalCost: Number(item.totalCost.toFixed(2)),
    })),
    membershipPlans,
    daily,
  }
}
