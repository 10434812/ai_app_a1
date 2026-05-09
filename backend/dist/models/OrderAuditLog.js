var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, Default, IsUUID, } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { Order } from './Order.js';
import { User } from './User.js';
let OrderAuditLog = class OrderAuditLog extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID)
], OrderAuditLog.prototype, "id", void 0);
__decorate([
    ForeignKey(() => Order),
    Column({
        type: DataType.UUID,
        allowNull: false,
    })
], OrderAuditLog.prototype, "orderId", void 0);
__decorate([
    BelongsTo(() => Order)
], OrderAuditLog.prototype, "order", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: true,
    })
], OrderAuditLog.prototype, "actorUserId", void 0);
__decorate([
    BelongsTo(() => User)
], OrderAuditLog.prototype, "actorUser", void 0);
__decorate([
    Column({
        type: DataType.STRING(64),
        allowNull: false,
    })
], OrderAuditLog.prototype, "action", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
], OrderAuditLog.prototype, "beforeSnapshot", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
], OrderAuditLog.prototype, "afterSnapshot", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
], OrderAuditLog.prototype, "note", void 0);
OrderAuditLog = __decorate([
    Table({
        tableName: 'order_audit_logs',
        timestamps: true,
        indexes: [
            {
                name: 'idx_order_audit_logs_order_id',
                fields: ['orderId'],
            },
            {
                name: 'idx_order_audit_logs_actor_user_id',
                fields: ['actorUserId'],
            },
            {
                name: 'idx_order_audit_logs_created_at',
                fields: ['createdAt'],
            },
        ],
    })
], OrderAuditLog);
export { OrderAuditLog };
