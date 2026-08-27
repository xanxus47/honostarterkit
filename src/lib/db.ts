import { neon } from '@neondatabase/serverless'

export type Sql = ReturnType<typeof neon>

export type AppBindings = {
  DATABASE_URL?: string
}

export function getSql(databaseUrl: string | undefined): Sql {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Add it to .dev.vars (local) or wrangler secrets (deploy).')
  }
  return neon(databaseUrl)
}
