var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { User } from "./User.js";
let TokenUsageRecord = class TokenUsageRecord extends Model {
};
__decorate([
    Column({
        type: DataType.UUID,
        defaultValue: DataType.UUIDV4,
        primaryKey: true,
    }),
    __metadata("design:type", String)
], TokenUsageRecord.prototype, "id", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], TokenUsageRecord.prototype, "userId", void 0);
__decorate([
    BelongsTo(() => User),
    __metadata("design:type", Object)
], TokenUsageRecord.prototype, "user", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], TokenUsageRecord.prototype, "amount", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: false,
    }),
    __metadata("design:type", String)
], TokenUsageRecord.prototype, "type", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], TokenUsageRecord.prototype, "model", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], TokenUsageRecord.prototype, "balanceAfter", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    }),
    __metadata("design:type", String)
], TokenUsageRecord.prototype, "meta", void 0);
TokenUsageRecord = __decorate([
    Table({
        tableName: 'token_usage_records',
        timestamps: true,
        indexes: [
            {
                name: 'idx_user_id',
                fields: ['userId'],
            },
            {
                name: 'idx_created_at',
                fields: ['createdAt'],
            },
        ],
    })
], TokenUsageRecord);
export { TokenUsageRecord };
