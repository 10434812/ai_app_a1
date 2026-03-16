import {Table, Column, Model, DataType, PrimaryKey, Default, IsUUID, HasMany} from 'sequelize-typescript'
import {v4 as uuidv4} from 'uuid'
import type {NonAttribute} from 'sequelize'
import {Conversation} from './Conversation.ts'

@Table({
  tableName: 'users',
  timestamps: true,
})
export class User extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  declare id: string

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  declare email: string

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare passwordHash: string

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string

  @Default('user')
  @Column({
    type: DataType.ENUM('user', 'admin', 'super_admin', 'ops', 'finance', 'support'),
    allowNull: false,
  })
  declare role: 'user' | 'admin' | 'super_admin' | 'ops' | 'finance' | 'support'

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  declare isActive: boolean

  // Membership Fields
  @Default('free')
  @Column({
    type: DataType.ENUM('free', 'pro', 'premium'),
    allowNull: false,
  })
  declare membershipLevel: 'free' | 'pro' | 'premium'

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare membershipExpireAt: Date | null

  @Default(100) // Free tier default quota
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare tokensBalance: number

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare multiModelUsageCount: number

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare referralCode: string

  @Column({
    type: DataType.STRING, // ID of the referrer
    allowNull: true,
  })
  declare referredBy: string

  // WeChat Fields
  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare wechatOpenId: string

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  declare wechatUnionId: string

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare avatar: string

  @HasMany(() => Conversation)
  declare conversations: NonAttribute<Conversation[]>
}
