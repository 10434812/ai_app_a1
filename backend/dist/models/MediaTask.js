var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, DataType, PrimaryKey, Default, IsUUID, ForeignKey, BelongsTo, } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from "./User.js";
let MediaTask = class MediaTask extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID),
    __metadata("design:type", String)
], MediaTask.prototype, "id", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: false,
    }),
    __metadata("design:type", String)
], MediaTask.prototype, "userId", void 0);
__decorate([
    BelongsTo(() => User),
    __metadata("design:type", Object)
], MediaTask.prototype, "user", void 0);
__decorate([
    Column({
        type: DataType.ENUM('image', 'video'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], MediaTask.prototype, "type", void 0);
__decorate([
    Default('pending'),
    Column({
        type: DataType.ENUM('pending', 'processing', 'retrying', 'succeeded', 'failed'),
        allowNull: false,
    }),
    __metadata("design:type", String)
], MediaTask.prototype, "status", void 0);
__decorate([
    Column({
        type: DataType.STRING(32),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "provider", void 0);
__decorate([
    Column({
        type: DataType.STRING(128),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "model", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: false,
    }),
    __metadata("design:type", String)
], MediaTask.prototype, "prompt", void 0);
__decorate([
    Column({
        type: DataType.STRING(32),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "size", void 0);
__decorate([
    Default(1),
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], MediaTask.prototype, "n", void 0);
__decorate([
    Default(0),
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], MediaTask.prototype, "attempts", void 0);
__decorate([
    Default(3),
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    }),
    __metadata("design:type", Number)
], MediaTask.prototype, "maxAttempts", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
    }),
    __metadata("design:type", Number)
], MediaTask.prototype, "estimatedCost", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "actualCost", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "result", void 0);
__decorate([
    Column({
        type: DataType.STRING(64),
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "errorCode", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "errorMessage", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "nextRetryAt", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "startedAt", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "completedAt", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    }),
    __metadata("design:type", Object)
], MediaTask.prototype, "meta", void 0);
MediaTask = __decorate([
    Table({
        tableName: 'media_tasks',
        timestamps: true,
        indexes: [
            { name: 'idx_media_tasks_status_next_retry', fields: ['status', 'nextRetryAt'] },
            { name: 'idx_media_tasks_user_created_at', fields: ['userId', 'createdAt'] },
            { name: 'idx_media_tasks_type_status_created', fields: ['type', 'status', 'createdAt'] },
        ],
    })
], MediaTask);
export { MediaTask };
