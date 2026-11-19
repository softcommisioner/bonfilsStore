import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { getStore } from '../db/index.js';
import type { UserRecord } from '../db/index.js';
import { CATEGORY_RENAMES } from '../seed/catalog.js';
import type { Category } from '../../src/types.js';

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

export const DEFAULT_CATEGORY = 'Other';

/**
 * Resolves a product category against the active category list so products can
 * never be filed under a name that does not exist (for example a category that
 * was retired by the 12-category restructure).
 *
 * A missing or empty category table must never turn a product save into a 500.
 * The products.category column is NOT NULL DEFAULT 'Other', so "Other" is
 * always a valid value even before seeding has run.
 */
export async function resolveCategoryName(value: unknown): Promise<string> {
  const requested = typeof value === 'string' ? value.trim() : '';
  let categories: Category[] = [];
  try {
    categories = await getStore().listCategories(false);
  } catch (error) {
    console.warn('[categories] could not load categories; using default', error);
  }
  const fallback = categories[0]?.name || DEFAULT_CATEGORY;
  if (!requested) return fallback;

  const match = categories.find(category => (
    category.name.toLowerCase() === requested.toLowerCase()
    || category.slug?.toLowerCase() === requested.toLowerCase()
  ));
  if (match) return match.name;

  // Legacy and retired names are mapped into the active 12-category catalogue
  // so a product can never be saved under a category the storefront hides.
  for (const [legacy, canonical] of Object.entries(CATEGORY_RENAMES)) {
    if (legacy.toLowerCase() !== requested.toLowerCase()) continue;
    const target = categories.find(category => category.name.toLowerCase() === canonical.toLowerCase());
    if (target) return target.name;
  }
  return fallback;
}

export function publicUser(user: UserRecord) {
  const { passwordHash, passwordSalt, ...rest } = user;
  return rest;
}


