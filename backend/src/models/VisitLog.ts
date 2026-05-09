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
import {User} from './User.js'

@Table({
  tableName: 'visit_logs',
  timestamps: true,
  indexes: [
    {
      name: 'idx_visit_logs_created_at',
      fields: ['createdAt'],
    },
    {
      name: 'idx_visit_logs_user_id_created_at',
      fields: ['userId', 'createdAt'],
    },
    {
      name: 'idx_visit_logs_visitor_id_created_at',
      fields: ['visitorId', 'createdAt'],
    },
    {
      name: 'idx_visit_logs_is_guest_created_at',
      fields: ['isGuest', 'createdAt'],
    },
  ],
})
export class VisitLog extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  declare id: string

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare userId: string | null

  @BelongsTo(() => User)
  declare user?: User

  @Column({
    type: DataType.STRING(128),
    allowNull: false,
  })
  declare visitorId: string

  @Default(true)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  declare isGuest: boolean

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  declare path: string

  @Default('web')
  @Column({
    type: DataType.STRING(64),
    allowNull: false,
  })
  declare source: string

  @Column({
    type: DataType.STRING(64),
    allowNull: true,
  })
  declare ip: string | null

  @Column({
    type: DataType.STRING(512),
    allowNull: true,
  })
  declare userAgent: string | null

  @Column({
    type: DataType.STRING(512),
    allowNull: true,
  })
  declare referer: string | null
}
