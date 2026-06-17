import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
let loaded = false

export function loadEnv() {
  if (loaded) return
  config({ path: path.join(rootDir, '.env.local'), override: false, quiet: true })
  config({ path: path.join(rootDir, '.env'), override: false, quiet: true })
  loaded = true
}

loadEnv()
