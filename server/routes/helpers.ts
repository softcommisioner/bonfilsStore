import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getStore } from '../db/index.js';
import type { UserRecord } from '../db/index.js';

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

export function requireString(value: unknown, field: string, max = 500): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw Object.assign(new Error(`${field} is required.`), { status: 400 });
  if (text.length > max) throw Object.assign(new Error(`${field} is too long.`), { status: 400 });
  return text;
}

export function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Resolves a product category against the active category list so products can
 * never be filed under a name that does not exist (for example a category that
 * was retired by the 12-category restructure).
 */
export async function resolveCategoryName(value: unknown): Promise<string> {
  const store = getStore();
  const categories = await store.listCategories(false);
  const requested = typeof value === 'string' ? value.trim() : '';
  if (requested) {
    const match = categories.find(category => category.name.toLowerCase() === requested.toLowerCase());
    if (!match) {
      throw Object.assign(new Error(`"${requested}" is not an active category.`), { status: 400 });
    }
    return match.name;
  }
  return categories[0]?.name || 'Other';
}

export function publicUser(user: UserRecord) {
  const { passwordHash, passwordSalt, ...rest } = user;
  return rest;
}


