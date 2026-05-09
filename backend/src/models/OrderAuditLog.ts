import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  PrimaryKey,
  Default,
  IsUUID,
} from 'sequelize-typescript'
import {v4 as uuidv4} from 'uuid'
import {Order} from './Order.js'
import {User} from './User.js'

@Table({
  tableName: 'order_audit_logs',
  timestamps: true,
  indexes: [
    {
      name: 'idx_order_audit_logs_order_id',
      fields: ['orderId'],
    },
    {
      name: 'idx_order_audit_logs_actor_user_id',
      fields: ['actorUserId'],
    },
    {
      name: 'idx_order_audit_logs_created_at',
      fields: ['createdAt'],
    },
  ],
})
export class OrderAuditLog extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  declare id: string

  @ForeignKey(() => Order)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare orderId: string

  @BelongsTo(() => Order)
  declare order: Order

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare actorUserId: string | null

  @BelongsTo(() => User)
  declare actorUser?: User

  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  declare action: string

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare beforeSnapshot: string | null

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare afterSnapshot: string | null

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare note: string | null
}
