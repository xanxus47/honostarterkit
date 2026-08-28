import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from './db'

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:8787',
]

function originList(env: AppBindings | undefined): string[] {
  const raw = env?.CORS_ORIGINS?.trim()
  if (!raw) return LOCAL_ORIGINS
  return raw.split(',').map((item) => item.trim()).filter(Boolean)
}

export function corsMiddleware(): MiddlewareHandler<{ Bindings: AppBindings }> {
  return async (c, next) => {
    const allowed = originList(c.env)
    const allowAny = allowed.includes('*')
    return cors({
      origin: allowAny
        ? '*'
        : (origin) => (origin && allowed.includes(origin) ? origin : ''),
      allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
      exposeHeaders: ['Content-Disposition', 'Content-Length', 'Content-Type'],
      credentials: !allowAny,
      maxAge: 86400,
    })(c, next)
  }
}
