import {Op} from 'sequelize'
import type {Request} from 'express'
import {VisitLog} from '../models/VisitLog.ts'

const VISITOR_ID_HEADER = 'x-visitor-id'
const MAX_VISITOR_ID_LENGTH = 128
const MAX_PATH_LENGTH = 255
const MAX_SOURCE_LENGTH = 64
const MAX_IP_LENGTH = 64
const MAX_UA_LENGTH = 512
const MAX_REFERER_LENGTH = 512

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const truncate = (value: string, maxLength: number) => {
  if (!value) return ''
  if (value.length <= maxLength) return value
  return value.slice(0, maxLength)
}

const normalizeVisitorId = (value: string) => {
  const compact = value.replace(/\s+/g, '')
  const safe = compact.replace(/[^a-zA-Z0-9:_-]/g, '')
  return truncate(safe, MAX_VISITOR_ID_LENGTH)
}

const ensureFallbackVisitorId = (userId: string | null, rawVisitorId: string) => {
  if (rawVisitorId) return rawVisitorId
  if (userId) return `user:${userId}`
  return `guest:${Date.now().toString(36)}`
}

const normalizePath = (value: string) => {
  const candidate = value || '/'
  const safe = candidate.startsWith('/') ? candidate : `/${candidate}`
  return truncate(safe, MAX_PATH_LENGTH)
}

export const resolveVisitorId = (req: Request) => {
  const headerValue = req.header(VISITOR_ID_HEADER)
  const bodyValue = normalizeText((req.body || {}).visitorId)
  const raw = headerValue || bodyValue
  return normalizeVisitorId(raw)
}

export const recordVisit = async (params: {
  userId: string | null
  visitorId: string
  path: string
  source?: string
  ip?: string
  userAgent?: string
  referer?: string
}) => {
  const userId = params.userId ?? null
  const visitorId = ensureFallbackVisitorId(userId, normalizeVisitorId(params.visitorId))
  const path = normalizePath(normalizeText(params.path))
  const source = truncate(normalizeText(params.source || 'web') || 'web', MAX_SOURCE_LENGTH)
  const ip = truncate(normalizeText(params.ip || ''), MAX_IP_LENGTH) || null
  const userAgent = truncate(normalizeText(params.userAgent || ''), MAX_UA_LENGTH) || null
  const referer = truncate(normalizeText(params.referer || ''), MAX_REFERER_LENGTH) || null

  await VisitLog.create({
    userId,
    visitorId,
    isGuest: !userId,
    path,
    source,
    ip,
    userAgent,
    referer,
  })
}

export const getVisitMetrics = async () => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [totalVisits, guestVisits, uniqueMemberVisitors, guestUniqueVisitors, todayVisits] =
    await Promise.all([
      VisitLog.count(),
      VisitLog.count({where: {isGuest: true}}),
      VisitLog.count({
        where: {userId: {[Op.ne]: null}},
        distinct: true,
        col: 'userId',
      }),
      VisitLog.count({
        where: {isGuest: true},
        distinct: true,
        col: 'visitorId',
      }),
      VisitLog.count({
        where: {
          createdAt: {[Op.gte]: todayStart},
        },
      }),
    ])

  return {
    totalVisits,
    guestVisits,
    uniqueVisitors: uniqueMemberVisitors + guestUniqueVisitors,
    guestUniqueVisitors,
    todayVisits,
  }
}
