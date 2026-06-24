import type { VercelRequest, VercelResponse } from '@vercel/node'
import { geocode, findSpots } from '../src/services/geo.js'
import { fetchAndScore } from '../src/services/weather.js'
import { lightConditions } from '../src/services/astronomy.js'
import { rankSpots } from '../src/services/ranking.js'
import { enrichWithTips } from '../src/services/tips.js'
import { PlanRequestSchema, PlanResponseSchema } from '../src/schemas.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Health check
  if (req.url?.includes('/health')) {
    return res.status(200).json({ status: 'ok', ts: new Date().toISOString() })
  }

  // Debug: AI-Verbindungstest
  if (req.url?.includes('/debug-tips')) {
    try {
      const { generateObject } = await import('ai')
      const { createAnthropic } = await import('@ai-sdk/anthropic')
      const { z } = await import('zod')
      const key = process.env.ANTHROPIC_API_KEY ?? ''
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
      const client = createAnthropic({ apiKey: key })
      const { object } = await generateObject({
        model: client(model),
        schema: z.object({ ok: z.boolean() }),
        prompt: 'Return ok: true',
      })
      return res.status(200).json({ keyPrefix: key.slice(0, 10), model, result: object })
    } catch (e: unknown) {
      return res.status(500).json({ error: String(e) })
    }
  }

  // POST /plan
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const parsed = PlanRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Ungültige Anfrage', details: parsed.error.flatten() })
  }

  const t0 = Date.now()
  const { date, startLocation, radiusKm, motivTypes } = parsed.data

  try {
    const location = await geocode(startLocation)
    const [weather, light, rawSpots] = await Promise.all([
      fetchAndScore(date, location.lat, location.lon),
      Promise.resolve(lightConditions(date, location.lat, location.lon)),
      findSpots(location.lat, location.lon, radiusKm, motivTypes),
    ])

    const ranked = rankSpots(rawSpots, weather, light, 10)
    const { spots, tipsGenerated } = await enrichWithTips(ranked, weather, light, date)

    const response = PlanResponseSchema.parse({
      location, date, weather, light, spots, tipsGenerated,
      processingMs: Date.now() - t0,
    })

    return res.status(200).json(response)
  } catch (err) {
    const e = err as Error & { statusCode?: number }
    return res.status(e.statusCode ?? 500).json({ error: e.message ?? 'Interner Fehler' })
  }
}
