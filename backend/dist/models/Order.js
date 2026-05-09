var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey, Default, IsUUID, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from './User.js';
let Order = class Order extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID)
], Order.prototype, "id", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: false,
    })
], Order.prototype, "userId", void 0);
__decorate([
    BelongsTo(() => User)
], Order.prototype, "user", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: false,
    })
], Order.prototype, "amount", void 0);
__decorate([
    Column({
        type: DataType.ENUM('monthly', 'quarterly', 'yearly', 'token_pack'),
        allowNull: false,
    })
], Order.prototype, "plan", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    })
], Order.prototype, "planKey", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
], Order.prototype, "planSnapshot", void 0);
__decorate([
    Default('pending'),
    Column({
        type: DataType.ENUM('pending', 'completed', 'failed', 'refunded'),
        allowNull: false,
    })
], Order.prototype, "status", void 0);
__decorate([
    Column({
        type: DataType.DECIMAL(10, 2),
        allowNull: true,
    })
], Order.prototype, "refundedAmount", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    })
], Order.prototype, "refundedAt", void 0);
__decorate([
    Default('mock_pay'),
    Column({
        type: DataType.STRING,
        allowNull: false,
    })
], Order.prototype, "paymentMethod", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    })
], Order.prototype, "transactionId", void 0);
Order = __decorate([
    Table({
        tableName: 'orders',
        timestamps: true,
    })
], Order);
export { Order };
