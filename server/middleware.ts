import type { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { getStore } from './db';
import type { Store, UserRecord } from './db';
import type { AdminActivityLog, NotificationItem } from '../src/types';
import { newId } from './security';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRecord;
      session?: { token: string; audience: 'app' | 'admin' };
      store?: Store;
    }
  }
}

export function attachStore(req: Request, _res: Response, next: NextFunction) {
  req.store = getStore();
  next();
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = (req as any).cookies?.bonfils_admin_token;
  if (typeof cookie === 'string' && cookie) return cookie;
  return null;
}

/**
 * Resolves the caller when a token is present. Public endpoints (catalog,
 * health, login) must stay reachable, so a missing token is not an error here;
 * `requireAuth`, `requireAdmin` and `requireRole` reject anonymous callers.
 * A present-but-invalid token is rejected immediately.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    if (!token) {
      next();
      return;
    }
    const session = await getStore().getSession(token);
    if (!session) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }
    const user = await getStore().findUserById(session.userId);
    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'Account is not active' });
      return;
    }
    req.user = user;
    req.session = { token: session.token, audience: session.audience };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Super Admin gate. A session must have been issued by the admin OTP
 * verification endpoint (audience = 'admin'); a normal app login session is
 * never enough, even for a user whose role list contains super_admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  if (req.session?.audience !== 'admin') {
    res.status(403).json({ error: 'Admin session required. Please verify your admin email code again.' });
    return;
  }
  if (!req.user.roles.includes('super_admin')) {
    res.status(403).json({ error: 'Super Admin role required' });
    return;
  }
  next();
}

export function requireRole(...roles: Array<UserRecord['roles'][number]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const allowed = roles.some(role => req.user!.roles.includes(role));
    if (!allowed) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
}

export async function logActivity(params: {
  actor: UserRecord | null;
  action: string;
  targetType: AdminActivityLog['targetType'];
  details: string;
  targetId?: string;
}) {
  const entry: AdminActivityLog = {
    id: newId('LOG'),
    actorId: params.actor?.id || 'system',
    actorName: params.actor?.name || 'System',
    actorRole: params.actor?.roles.join(', ') || 'system',
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    timestamp: new Date().toISOString(),
  };
  try {
    await getStore().addActivityLog(entry);
  } catch (error) {
    console.error('[activity] failed to write log', error);
  }
}

export async function pushNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: NotificationItem['type'];
  link?: string;
}) {
  const notification: NotificationItem = {
    id: newId('NTF'),
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: params.type,
    link: params.link,
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await getStore().createNotification(notification);
  } catch (error) {
    console.error('[notification] failed to create', error);
  }
  return notification;
}

export function isBootstrapConfigured(): boolean {
  return Boolean(config.superAdminEmail && config.superAdminPassword);
}
