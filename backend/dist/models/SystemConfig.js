var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Table, Column, Model, DataType, PrimaryKey } from 'sequelize-typescript';
let SystemConfig = class SystemConfig extends Model {
};
__decorate([
    PrimaryKey,
    Column(DataType.STRING)
], SystemConfig.prototype, "key", void 0);
__decorate([
    Column({
        type: DataType.TEXT,
        allowNull: true,
    })
], SystemConfig.prototype, "value", void 0);
__decorate([
    Column({
        type: DataType.STRING,
        allowNull: true,
    })
], SystemConfig.prototype, "description", void 0);
SystemConfig = __decorate([
    Table({
        tableName: 'system_configs',
        timestamps: true,
    })
], SystemConfig);
export { SystemConfig };
