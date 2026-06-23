import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env.local') })

export const cfg = {
  port: Number(process.env.PORT ?? 3000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  overpassUrl: process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT ?? 'FotowalkScout/0.1',
} as const
