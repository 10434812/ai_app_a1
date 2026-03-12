import type {Sequelize} from 'sequelize-typescript'

export interface Migration {
  id: string
  description: string
  up: (sequelize: Sequelize) => Promise<void>
  down: (sequelize: Sequelize) => Promise<void>
}
