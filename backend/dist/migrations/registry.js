import addOrderPlanFields from "./20260303_add_order_plan_fields.js";
import addVisitLogsTable from "./202603030002_add_visit_logs_table.js";
import addOrderRefundAndAudit from "./202603030003_add_order_refund_and_audit.js";
import addRbacAndMediaTasks from "./202603030004_add_rbac_and_media_tasks.js";
import addCompositeIndexes from "./202603030005_add_composite_indexes.js";
import addConversationFavorite from "./202603060001_add_conversation_favorite.js";
import addConversationArchive from "./202603060002_add_conversation_archive.js";
export const MIGRATIONS = [
    addOrderPlanFields,
    addVisitLogsTable,
    addOrderRefundAndAudit,
    addRbacAndMediaTasks,
    addCompositeIndexes,
    addConversationFavorite,
    addConversationArchive,
];
