import {Table, Column, Model, DataType, HasMany, ForeignKey, BelongsTo, PrimaryKey, Default, IsUUID} from 'sequelize-typescript'
import {v4 as uuidv4} from 'uuid'
import type {NonAttribute} from 'sequelize'
import {User} from './User.ts'
import {Message} from './Message.ts'

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
  declare user: NonAttribute<User>

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
  declare messages: NonAttribute<Message[]>
}
