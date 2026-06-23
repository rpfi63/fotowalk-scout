import type { FastifyInstance } from 'fastify'
import { PlanRequestSchema, PlanResponseSchema } from '../schemas.js'
import { geocode, findSpots } from '../services/geo.js'
import { fetchAndScore } from '../services/weather.js'
import { lightConditions } from '../services/astronomy.js'
import { rankSpots } from '../services/ranking.js'
import { enrichWithTips } from '../services/tips.js'

export async function planRoutes(app: FastifyInstance) {
  app.post('/plan', {
    schema: {
      description: 'Plane einen Fotowalk: Spots, Wetter, Licht und AI-Tipps',
      tags: ['plan'],
      body: {
        type: 'object',
        required: ['date', 'startLocation', 'radiusKm', 'motivTypes'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: 'HH:MM (optional)' },
          timeOfDay: { type: 'string', enum: ['sunrise', 'morning', 'noon', 'afternoon', 'sunset', 'night'] },
          startLocation: { type: 'string' },
          radiusKm: { type: 'number', minimum: 1, maximum: 200 },
          motivTypes: {
            type: 'array',
            items: { type: 'string', enum: ['lake', 'mountain', 'waterfall', 'castle', 'forest', 'viewpoint', 'river'] },
            minItems: 1,
          },
        },
      },
    },
  }, async (request, reply) => {
    const t0 = Date.now()

    const parsed = PlanRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Ungültige Anfrage', details: parsed.error.flatten() })
    }

    const { date, startLocation, radiusKm, motivTypes } = parsed.data

    // Parallel: Geocodierung + Wetter (Wetter braucht Koordinaten → erst geocode)
    const location = await geocode(startLocation)
    const [weather, light, rawSpots] = await Promise.all([
      fetchAndScore(date, location.lat, location.lon),
      Promise.resolve(lightConditions(date, location.lat, location.lon)),
      findSpots(location.lat, location.lon, radiusKm, motivTypes),
    ])

    const ranked = rankSpots(rawSpots, weather, light, 10)
    const { spots, tipsGenerated } = await enrichWithTips(ranked, weather, light, date)

    const response = PlanResponseSchema.parse({
      location,
      date,
      weather,
      light,
      spots,
      tipsGenerated,
      processingMs: Date.now() - t0,
    })

    return reply.send(response)
  })

  // Health check
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))
}
