import type {Migration} from './types.ts'
import addOrderPlanFields from './20260303_add_order_plan_fields.ts'
import addVisitLogsTable from './202603030002_add_visit_logs_table.ts'
import addOrderRefundAndAudit from './202603030003_add_order_refund_and_audit.ts'
import addRbacAndMediaTasks from './202603030004_add_rbac_and_media_tasks.ts'
import addCompositeIndexes from './202603030005_add_composite_indexes.ts'
import addConversationFavorite from './202603060001_add_conversation_favorite.ts'
import addConversationArchive from './202603060002_add_conversation_archive.ts'

export const MIGRATIONS: Migration[] = [
  addOrderPlanFields,
  addVisitLogsTable,
  addOrderRefundAndAudit,
  addRbacAndMediaTasks,
  addCompositeIndexes,
  addConversationFavorite,
  addConversationArchive,
]
