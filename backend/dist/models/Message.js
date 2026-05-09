var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, Default, IsUUID } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from './Conversation.js';
let Message = class Message extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID)
], Message.prototype, "id", void 0);
__decorate([
    ForeignKey(() => Conversation),
    Column({
        type: DataType.UUID,
        allowNull: false,
    })
], Message.prototype, "conversationId", void 0);
__decorate([
    BelongsTo(() => Conversation)
], Message.prototype, "conversation", void 0);
__decorate([
    Column({
        type: DataType.ENUM('user', 'assistant', 'system'),
        allowNull: false,
    })
], Message.prototype, "role", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: false,
    })
], Message.prototype, "content", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    })
], Message.prototype, "model", void 0);
Message = __decorate([
    Table({ tableName: 'messages', timestamps: true })
], Message);
export { Message };
