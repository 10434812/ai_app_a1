import {Table, Column, Model, DataType, PrimaryKey, Default, IsUUID, ForeignKey, BelongsTo} from 'sequelize-typescript'
import {v4 as uuidv4} from 'uuid'
import type {NonAttribute} from 'sequelize'
import {User} from './User.ts'

@Table({
  tableName: 'orders',
  timestamps: true,
})
export class Order extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  declare id: string

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare userId: string

  @BelongsTo(() => User)
  declare user: NonAttribute<User>

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  declare amount: string

  @Column({
    type: DataType.ENUM('monthly', 'quarterly', 'yearly', 'token_pack'),
    allowNull: false,
  })
  declare plan: 'monthly' | 'quarterly' | 'yearly' | 'token_pack'

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare planKey: string | null

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare planSnapshot: string | null

  @Default('pending')
  @Column({
    type: DataType.ENUM('pending', 'completed', 'failed', 'refunded'),
    allowNull: false,
  })
  declare status: 'pending' | 'completed' | 'failed' | 'refunded'

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
  })
  declare refundedAmount: string | null

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare refundedAt: Date | null

  @Default('mock_pay')
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare paymentMethod: string

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare transactionId: string // External Transaction ID (e.g. WeChat Order No)
}
