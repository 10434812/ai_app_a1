var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, DataType, PrimaryKey, Default, IsUUID, HasMany } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from "./Conversation.js";
let User = class User extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: false,
        unique: true,
    }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: false,
    }),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: false,
    }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    Default('user'),
    Column({
        type: DataType.ENUM('user', 'admin', 'super_admin', 'ops', 'finance', 'support'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    Default(true),
    Column({
        type: DataType.BOOLEAN,
        allowNull: false,
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    Default('free'),
    Column({
        type: DataType.ENUM('free', 'pro', 'premium'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], User.prototype, "membershipLevel", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], User.prototype, "membershipExpireAt", void 0);
__decorate([
    Default(100) // Free tier default quota
    ,
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], User.prototype, "tokensBalance", void 0);
__decorate([
    Default(0),
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], User.prototype, "multiModelUsageCount", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
        unique: true,
    }),
    __metadata("design:type", String)
], User.prototype, "referralCode", void 0);
__decorate([
    Column({
        type: DataType.STRING, // ID of the referrer
        allowNull: true,
    }),
    __metadata("design:type", String)
], User.prototype, "referredBy", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
        unique: true,
    }),
    __metadata("design:type", String)
], User.prototype, "wechatOpenId", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
        unique: true,
    }),
    __metadata("design:type", String)
], User.prototype, "wechatUnionId", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], User.prototype, "avatar", void 0);
__decorate([
    HasMany(() => Conversation),
    __metadata("design:type", Object)
], User.prototype, "conversations", void 0);
User = __decorate([
    Table({
        tableName: 'users',
        timestamps: true,
    })
], User);
export { User };
