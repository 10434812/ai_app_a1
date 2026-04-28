var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, Default, IsUUID, } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from "./User.js";
let VisitLog = class VisitLog extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID),
    __metadata("design:type", String)
], VisitLog.prototype, "id", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], VisitLog.prototype, "userId", void 0);
__decorate([
    BelongsTo(() => User),
    __metadata("design:type", Object)
], VisitLog.prototype, "user", void 0);
__decorate([
    Column({
        type: DataType.STRING(128),
        allowNull: false,
    }),
    __metadata("design:type", String)
], VisitLog.prototype, "visitorId", void 0);
__decorate([
    Default(true),
    Column({
        type: DataType.BOOLEAN,
        allowNull: false,
    }),
    __metadata("design:type", Boolean)
], VisitLog.prototype, "isGuest", void 0);
__decorate([
    Column({
        type: DataType.STRING(255),
        allowNull: false,
    }),
    __metadata("design:type", String)
], VisitLog.prototype, "path", void 0);
__decorate([
    Default('web'),
    Column({
        type: DataType.STRING(64),
        allowNull: false,
    }),
    __metadata("design:type", String)
], VisitLog.prototype, "source", void 0);
__decorate([
    Column({
        type: DataType.STRING(64),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], VisitLog.prototype, "ip", void 0);
__decorate([
    Column({
        type: DataType.STRING(512),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], VisitLog.prototype, "userAgent", void 0);
__decorate([
    Column({
        type: DataType.STRING(512),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], VisitLog.prototype, "referer", void 0);
VisitLog = __decorate([
    Table({
        tableName: 'visit_logs',
        timestamps: true,
        indexes: [
            {
                name: 'idx_visit_logs_created_at',
                fields: ['createdAt'],
            },
            {
                name: 'idx_visit_logs_user_id_created_at',
                fields: ['userId', 'createdAt'],
            },
            {
                name: 'idx_visit_logs_visitor_id_created_at',
                fields: ['visitorId', 'createdAt'],
            },
            {
                name: 'idx_visit_logs_is_guest_created_at',
                fields: ['isGuest', 'createdAt'],
            },
        ],
    })
], VisitLog);
export { VisitLog };
