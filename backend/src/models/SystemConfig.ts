import {Table, Column, Model, DataType, PrimaryKey} from 'sequelize-typescript'

@Table({
  tableName: 'system_configs',
  timestamps: true,
})
export class SystemConfig extends Model {
  @PrimaryKey
  @Column(DataType.STRING)
  declare key: string

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare value: string

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare description: string
}
