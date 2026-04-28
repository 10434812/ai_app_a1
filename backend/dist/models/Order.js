var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, DataType, PrimaryKey, Default, IsUUID, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from "./User.js";
let Order = class Order extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID),
    __metadata("design:type", String)
], Order.prototype, "id", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], Order.prototype, "userId", void 0);
__decorate([
    BelongsTo(() => User),
    __metadata("design:type", Object)
], Order.prototype, "user", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    }),
    __metadata("design:type", String)
], Order.prototype, "amount", void 0);
__decorate([
    Column({
        type: DataType.ENUM('monthly', 'quarterly', 'yearly', 'token_pack'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], Order.prototype, "plan", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "planKey", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "planSnapshot", void 0);
__decorate([
    Default('pending'),
    Column({
        type: DataType.ENUM('pending', 'completed', 'failed', 'refunded'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], Order.prototype, "status", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "refundedAmount", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], Order.prototype, "refundedAt", void 0);
__decorate([
    Default('mock_pay'),
    Column({
        type: DataType.STRING,
        allowNull: false,
    }),
    __metadata("design:type", String)
], Order.prototype, "paymentMethod", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], Order.prototype, "transactionId", void 0);
Order = __decorate([
    Table({
        tableName: 'orders',
        timestamps: true,
    })
], Order);
export { Order };
