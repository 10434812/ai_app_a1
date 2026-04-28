var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, DataType, HasMany, ForeignKey, BelongsTo, PrimaryKey, Default, IsUUID } from 'sequelize-typescript';
import { v4 as uuidv4 } from 'uuid';
import { User } from "./User.js";
import { Message } from "./Message.js";
let Conversation = class Conversation extends Model {
};
__decorate([
    IsUUID(4),
    PrimaryKey,
    Default(uuidv4),
    Column(DataType.UUID),
    __metadata("design:type", String)
], Conversation.prototype, "id", void 0);
__decorate([
    ForeignKey(() => User),
    Column({
        type: DataType.UUID,
        allowNull: true,
    }),
    __metadata("design:type", String)
], Conversation.prototype, "userId", void 0);
__decorate([
    BelongsTo(() => User),
    __metadata("design:type", Object)
], Conversation.prototype, "user", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    }),
    __metadata("design:type", String)
], Conversation.prototype, "title", void 0);
__decorate([
    Default(false),
    Column({
        type: DataType.BOOLEAN,
        allowNull: false,
    }),
    __metadata("design:type", Boolean)
], Conversation.prototype, "isFavorite", void 0);
__decorate([
    Default(false),
    Column({
        type: DataType.BOOLEAN,
        allowNull: false,
    }),
    __metadata("design:type", Boolean)
], Conversation.prototype, "isArchived", void 0);
__decorate([
    HasMany(() => Message),
    __metadata("design:type", Object)
], Conversation.prototype, "messages", void 0);
Conversation = __decorate([
    Table({ tableName: 'conversations', timestamps: true })
], Conversation);
export { Conversation };
