import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { getStore, initStore } from './db/index.js';
import { attachStore, authenticateToken } from './middleware.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import chinaRoutes from './routes/china.js';
import notificationRoutes from './routes/notifications.js';
import orderRoutes from './routes/orders.js';
import sellerRoutes from './routes/seller.js';
import shippingRoutes from './routes/shipping.js';
import { runSeed } from './seed/seed.js';
import { UploadError } from './services/upload.js';

export function createServer(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true, limit: '6mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  // Sessions are resolved once per request; individual routes decide whether an
  // authenticated user is required.
  app.use(authenticateToken);
  app.use(attachStore);

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/seller', sellerRoutes);
  app.use('/api/china-requests', chinaRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/shipping', shippingRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api', catalogRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
  });

  const distDir = path.join(process.cwd(), 'dist');
  if (!config.isServerless && fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((error: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof UploadError ? error.status : error.status || 500;
    if (status >= 500) {
      console.error('[api] unhandled error', error);
    }
    res.status(status).json({ error: status >= 500 ? 'Unexpected server error. Please try again.' : error.message });
  });

  return app;
}

export async function bootstrap(): Promise<Express> {
  const store = await initStore();
  await runSeed(store);
  if (store.kind === 'memory' && config.isServerless) {
    console.warn('[api] running without a database: attach Neon/Postgres before accepting real orders.');
  }
  return createServer();
}
