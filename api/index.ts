import type { NextFunction, Request, Response } from 'express';
import { bootstrap } from '../server/app';

/**
 * Vercel serverless entry point. The Express app is created once per cold
 * start (schema migrations + idempotent seeding run inside bootstrap) and every
 * incoming request is forwarded to it.
 */
const appPromise = bootstrap().catch(error => {
  console.error('[api] failed to initialise the application', error);
  throw error;
});

export default async function handler(req: Request, res: Response, next: NextFunction) {
  try {
    const app = await appPromise;
    return app(req, res, next);
  } catch (error) {
    console.error('[api] request failed before the app was ready', error);
    if (!res.headersSent) {
      res.status(503).json({ error: 'The API is temporarily unavailable. Please retry.' });
    }
  }
}
