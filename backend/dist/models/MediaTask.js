var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey, Default, IsUUID, ForeignKey, BelongsTo, } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from './User.js';
let MediaTask = class MediaTask extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID)
], MediaTask.prototype, "id", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: false,
    })
], MediaTask.prototype, "userId", void 0);
__decorate([
    BelongsTo(() => User)
], MediaTask.prototype, "user", void 0);
__decorate([
    Column({
        type: DataType.ENUM('image', 'video'),
        allowNull: false,
    })
], MediaTask.prototype, "type", void 0);
__decorate([
    Default('pending'),
    Column({
        type: DataType.ENUM('pending', 'processing', 'retrying', 'succeeded', 'failed'),
        allowNull: false,
    })
], MediaTask.prototype, "status", void 0);
__decorate([
    Column({
        type: DataType.STRING(32),
        allowNull: true,
    })
], MediaTask.prototype, "provider", void 0);
__decorate([
    Column({
        type: DataType.STRING(128),
        allowNull: true,
    })
], MediaTask.prototype, "model", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: false,
    })
], MediaTask.prototype, "prompt", void 0);
__decorate([
    Column({
        type: DataType.STRING(32),
        allowNull: true,
    })
], MediaTask.prototype, "size", void 0);
__decorate([
    Default(1),
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
], MediaTask.prototype, "n", void 0);
__decorate([
    Default(0),
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
], MediaTask.prototype, "attempts", void 0);
__decorate([
    Default(3),
    Column({
        type: DataType.INTEGER,
        allowNull: false,
    })
], MediaTask.prototype, "maxAttempts", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
    })
], MediaTask.prototype, "estimatedCost", void 0);
__decorate([
    Column({
        type: DataType.INTEGER,
        allowNull: true,
    })
], MediaTask.prototype, "actualCost", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
], MediaTask.prototype, "result", void 0);
__decorate([
    Column({
        type: DataType.STRING(64),
        allowNull: true,
    })
], MediaTask.prototype, "errorCode", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
], MediaTask.prototype, "errorMessage", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    })
], MediaTask.prototype, "nextRetryAt", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    })
], MediaTask.prototype, "startedAt", void 0);
__decorate([
    Column({
        type: DataType.DATE,
        allowNull: true,
    })
], MediaTask.prototype, "completedAt", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
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
