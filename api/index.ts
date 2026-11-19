import type { Express, NextFunction, Request, Response } from 'express';
import { bootstrap } from '../server/app.js';

/**
 * Vercel serverless entry point. The Express app is created once per cold
 * start (schema migrations + idempotent seeding run inside bootstrap) and every
 * incoming request is forwarded to it.
 */
let appPromise: Promise<Express> | null = null;

function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = bootstrap().catch(error => {
      appPromise = null;
      console.error('[api] failed to initialise the application', error);
      throw error;
    });
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response, next: NextFunction) {
  try {
    const app = await getApp();
    return app(req, res, next);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown startup error';
    console.error('[api] request failed before the app was ready', detail, error);
    if (!res.headersSent) {
      res.status(503).json({ error: 'The API is temporarily unavailable. Please retry.', detail });
    }
  }
}
