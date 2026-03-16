import type {Sequelize} from 'sequelize-typescript'
import type {Transaction} from 'sequelize'

export interface Migration {
  id: string
  description: string
  up: (sequelize: Sequelize, transaction: Transaction) => Promise<void>
  down: (sequelize: Sequelize, transaction: Transaction) => Promise<void>
}
