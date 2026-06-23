import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { cfg } from './config.js'
import { planRoutes } from './routes/plan.js'

const app = Fastify({ logger: true })

await app.register(swagger, {
  openapi: {
    info: { title: 'FotowalkScout API', version: '0.1.0', description: 'AI-gestützte Fotowalk-Planung' },
    tags: [{ name: 'plan', description: 'Fotowalk planen' }],
  },
})

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'full' },
})

await app.register(planRoutes)

// Globaler Fehler-Handler
app.setErrorHandler((error, _req, reply) => {
  app.log.error(error)
  const e = error as Error & { statusCode?: number }
  const statusCode = e.statusCode ?? 500
  reply.status(statusCode).send({ error: e.message ?? 'Interner Fehler' })
})

try {
  await app.listen({ port: cfg.port, host: '0.0.0.0' })
  console.log(`FotowalkScout läuft auf http://localhost:${cfg.port}`)
  console.log(`API-Docs: http://localhost:${cfg.port}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
