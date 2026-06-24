import type { VercelRequest, VercelResponse } from '@vercel/node'
import Fastify from 'fastify'
import serverless from 'serverless-http'
import { planRoutes } from '../src/routes/plan.js'

// Lazy-Init: Function-Instanz wird beim ersten Request gebaut und gecacht
let handler: ReturnType<typeof serverless> | null = null

async function getHandler() {
  if (handler) return handler

  const app = Fastify({ logger: false })
  await app.register(planRoutes)
  app.setErrorHandler((error, _req, reply) => {
    const e = error as Error & { statusCode?: number }
    reply.status(e.statusCode ?? 500).send({ error: e.message ?? 'Interner Fehler' })
  })
  await app.ready()

  handler = serverless(app as any)
  return handler
}

export default async function (req: VercelRequest, res: VercelResponse) {
  const h = await getHandler()
  return h(req as any, res as any)
}
