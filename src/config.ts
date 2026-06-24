import { config } from 'dotenv'

// Lokal: .env.local laden. Auf Vercel sind env vars bereits gesetzt — dotenv überschreibt sie nicht.
try {
  config({ path: '.env.local' })
} catch {
  // ignorieren falls Datei nicht existiert
}

export const cfg = {
  port: Number(process.env.PORT ?? 3000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: (process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6').trim(),
  overpassUrl: process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter',
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT ?? 'FotowalkScout/0.1',
} as const
