import Fastify from 'fastify'
import serverless from 'serverless-http'
import { cfg } from '../src/config.js'
import { planRoutes } from '../src/routes/plan.js'

const app = Fastify({ logger: false })

await app.register(planRoutes)

app.setErrorHandler((error, _req, reply) => {
  const e = error as Error & { statusCode?: number }
  reply.status(e.statusCode ?? 500).send({ error: e.message ?? 'Interner Fehler' })
})

await app.ready()

export default serverless(app as any)
