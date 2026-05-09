import {Table, Column, Model, DataType, HasMany, ForeignKey, BelongsTo, PrimaryKey, Default, IsUUID} from 'sequelize-typescript'
import {v4 as uuidv4} from 'uuid'
import {User} from './User.js'
import {Message} from './Message.js'

@Table({tableName: 'conversations', timestamps: true})
export class Conversation extends Model {
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
  declare userId: string

  @BelongsTo(() => User)
  declare user: User

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare title: string

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  declare isFavorite: boolean

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  declare isArchived: boolean

  @HasMany(() => Message)
  declare messages: Message[]
}
