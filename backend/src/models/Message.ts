import {Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, Default, IsUUID} from 'sequelize-typescript'
import {v4 as uuidv4} from 'uuid'
import {Conversation} from './Conversation.ts'

@Table({tableName: 'messages', timestamps: true})
export class Message extends Model {
  @IsUUID(4)
  @PrimaryKey
  @Default(uuidv4)
  @Column(DataType.UUID)
  declare id: string

  @ForeignKey(() => Conversation)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare conversationId: string

  @BelongsTo(() => Conversation)
  declare conversation: Conversation

  @Column({
    type: DataType.ENUM('user', 'assistant', 'system'),
    allowNull: false,
  })
  declare role: string

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare content: string

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare model: string
}
