import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.API_PORT || 4000),
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  sessionCookieName: 'km_session',
}

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required. Example: postgres://user:pass@localhost:5432/kargomarket')
}
