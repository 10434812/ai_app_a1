import 'dotenv/config'
import {connectDB, sequelize} from '../config/db.js'

const main = async () => {
  await connectDB()
  await sequelize.close()
}

main().catch((error) => {
  console.error('Run migration script failed:', error)
  process.exit(1)
})
