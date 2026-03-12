import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import {connectDB, sequelize} from '../config/db.ts'
import {upsertSystemConfigs, type ExportableConfigRow} from '../services/configSyncService.ts'

const parseArgs = (argv: string[]) => {
  const options: {
    input: string
    dryRun: boolean
  } = {
    input: './config-export.json',
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if ((arg === '--input' || arg === '-i') && argv[index + 1]) {
      options.input = argv[index + 1]
      index += 1
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
    }
  }

  return options
}

const parsePayload = (raw: string): ExportableConfigRow[] => {
  const payload = JSON.parse(raw)
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rows)) {
    throw new Error('Invalid config export file: missing rows array')
  }

  return payload.rows.map((row: any) => {
    if (!row || typeof row.key !== 'string') {
      throw new Error('Invalid config export file: row.key must be a string')
    }

    return {
      key: row.key,
      value: row.value === null || row.value === undefined ? null : String(row.value),
      description: row.description === null || row.description === undefined ? null : String(row.description),
    }
  })
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const inputPath = path.resolve(process.cwd(), options.input)
  const raw = await fs.readFile(inputPath, 'utf-8')
  const rows = parsePayload(raw)

  if (options.dryRun) {
    console.log(`Dry run: would import ${rows.length} config rows from ${inputPath}`)
    return
  }

  await connectDB()
  await upsertSystemConfigs(rows)
  console.log(`Imported ${rows.length} config rows from ${inputPath}`)
}

main()
  .catch((error) => {
    console.error('Import config failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await sequelize.close()
  })

