import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  IsUUID,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript'
import {v4 as uuidv4} from 'uuid'
import {User} from './User.ts'

export type MediaTaskType = 'image' | 'video'
export type MediaTaskStatus = 'pending' | 'processing' | 'retrying' | 'succeeded' | 'failed'

@Table({
  tableName: 'media_tasks',
  timestamps: true,
  indexes: [
    {name: 'idx_media_tasks_status_next_retry', fields: ['status', 'nextRetryAt']},
    {name: 'idx_media_tasks_user_created_at', fields: ['userId', 'createdAt']},
    {name: 'idx_media_tasks_type_status_created', fields: ['type', 'status', 'createdAt']},
  ],
})
export class MediaTask extends Model {
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
  declare user?: User

  @Column({
    type: DataType.ENUM('image', 'video'),
    allowNull: false,
  })
  declare type: MediaTaskType

  @Default('pending')
  @Column({
    type: DataType.ENUM('pending', 'processing', 'retrying', 'succeeded', 'failed'),
    allowNull: false,
  })
  declare status: MediaTaskStatus

  @Column({
    type: DataType.STRING(32),
    allowNull: true,
  })
  declare provider: string | null

  @Column({
    type: DataType.STRING(128),
    allowNull: true,
  })
  declare model: string | null

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare prompt: string

  @Column({
    type: DataType.STRING(32),
    allowNull: true,
  })
  declare size: string | null

  @Default(1)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare n: number

  @Default(0)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare attempts: number

  @Default(3)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare maxAttempts: number

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  declare estimatedCost: number

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare actualCost: number | null

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare result: string | null

  @Column({
    type: DataType.STRING(64),
    allowNull: true,
  })
  declare errorCode: string | null

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare errorMessage: string | null

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare nextRetryAt: Date | null

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare startedAt: Date | null

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare completedAt: Date | null

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare meta: string | null
}

