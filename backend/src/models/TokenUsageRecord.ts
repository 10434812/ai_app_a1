import {Table, Column, Model, DataType, ForeignKey, BelongsTo} from 'sequelize-typescript'
import {User} from './User.js'

@Table({
  tableName: 'token_usage_records',
  timestamps: true,
  indexes: [
    {
      name: 'idx_user_id',
      fields: ['userId'],
    },
    {
      name: 'idx_created_at',
      fields: ['createdAt'],
    },
  ],
})
export class TokenUsageRecord extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare userId: string

  @BelongsTo(() => User)
  declare user: User

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare amount: number

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare type: string // 'chat', 'topup', 'register_bonus', 'referral_bonus'

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare model?: string

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare balanceAfter: number

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare meta?: string
}
