import { config } from '../config';
import type { Store, UserRecord } from '../db';
import { getStore, initStore } from '../db';
import { hashPassword } from '../security';
import type { Category, Product } from '../../src/types';
import {
  buildDemoUser, CATEGORY_RENAMES, demoUsers, remapCategoryImageUrls, RETIRED_CATEGORIES,
  seedBusinesses, seedCategories, seedProducts,
} from './catalog';

function log(message: string) {
  console.log(`[seed] ${message}`);
}

/**
 * Collapses the legacy 18-category catalogue into the approved 12. Runs before
 * `seedCategoriesIfMissing` so the canonical rows already exist by name and the
 * seeder never has to insert a row whose id collides with a legacy one.
 *
 * The migration is idempotent and non-destructive: products are re-pointed at
 * the new category, legacy category artwork URLs are rewritten to the new
 * slugs, renamed rows are updated in place (keeping their id), and categories
 * that leave the storefront are deactivated rather than deleted.
 */
async function migrateCategoryStructure(store: Store): Promise<void> {
  let movedProducts = 0;
  let remappedImages = 0;
  let renamedCategories = 0;
  let alignedCategories = 0;
  let mergedCategories = 0;

  for (const [from, to] of Object.entries(CATEGORY_RENAMES)) {
    const page = await store.listProducts({ category: from, pageSize: 100, includeInactive: true });
    for (const product of page.products) {
      const images = remapCategoryImageUrls(product.images);
      const patch: Partial<Product> = {};
      if (from !== to) {
        patch.category = to;
        patch.updatedAt = new Date().toISOString();
        movedProducts += 1;
      }
      if (images !== product.images) {
        patch.images = images;
        remappedImages += 1;
      }
      if (Object.keys(patch).length > 0) {
        await store.updateProduct(product.id, patch);
      }
    }

    const source = await store.findCategoryByName(from);
    if (!source) continue;
    const canonical = seedCategories.find(category => category.name === to);
    const target = from === to ? source : await store.findCategoryByName(to);

    if (target && target.id !== source.id) {
      // The canonical row already exists, so the legacy duplicate is redundant.
      await store.deleteCategory(source.id);
      mergedCategories += 1;
      continue;
    }

    // The name is unchanged for the categories that were only re-slugged, but
    // the slug, artwork, copy and sort order still need to be aligned.
    const patch: Partial<Category> = { name: to };
    if (canonical) {
      patch.slug = canonical.slug;
      patch.image = canonical.image;
      patch.description = canonical.description;
      patch.sortOrder = canonical.sortOrder;
      patch.isActive = true;
    }
    const drifted = Object.entries(patch).some(
      ([field, value]) => (source as unknown as Record<string, unknown>)[field] !== value,
    );
    if (!drifted) continue;
    await store.updateCategory(source.id, patch);
    if (from === to) alignedCategories += 1;
    else renamedCategories += 1;
  }

  let retired = 0;
  for (const name of RETIRED_CATEGORIES) {
    const category = await store.findCategoryByName(name);
    if (!category) continue;
    // Their artwork is no longer generated, so drop the reference rather than
    // leave the row pointing at a file that returns 404. Re-checked on every
    // boot so an already-deactivated row still gets cleaned up.
    const image = category.image || '';
    if (!category.isActive && !image) continue;
    await store.updateCategory(category.id, { isActive: false, image: '' });
    retired += 1;
  }

  if (movedProducts || remappedImages || renamedCategories || alignedCategories || mergedCategories || retired) {
    log(
      `category migration: ${movedProducts} product(s) re-categorised, ${remappedImages} image URL(s) remapped, ` +
      `${renamedCategories} category renamed, ${alignedCategories} re-slugged, ${mergedCategories} duplicate merged, ` +
      `${retired} retired`,
    );
  }
}

export async function ensureSuperAdmin(store: Store): Promise<UserRecord | null> {
  if (!config.superAdminEmail || !config.superAdminPassword) {
    const existing = (await store.listUsers()).find(user => user.roles.includes('super_admin'));
    if (!existing) {
      console.warn(
        '[seed] No super admin exists and SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD are not set. ' +
        'Run "npm run superadmin:create -- --email you@example.com --password <strong-password>".',
      );
    }
    return existing || null;
  }

  const email = config.superAdminEmail.toLowerCase();
  const existing = await store.findUserByEmail(email);
  const { hash, salt } = await hashPassword(config.superAdminPassword);

  if (!existing) {
    const admin: UserRecord = {
      id: 'USR-ADMIN-001',
      name: config.superAdminName || 'Bonfils Super Admin',
      email,
      phone: '+250788100200',
      country: 'Rwanda',
      city: 'Kigali',
      roles: ['super_admin'],
      accountType: 'customer',
      isVerified: true,
      status: 'active',
      businessId: 'BIZ-001',
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };
    await store.createUser(admin);
    log(`super admin created for ${email}`);
    return admin;
  }

  if (!existing.roles.includes('super_admin') || existing.status !== 'active') {
    const updated = await store.updateUser(existing.id, {
      roles: Array.from(new Set([...existing.roles, 'super_admin'] as UserRecord['roles'])),
      status: 'active',
      isVerified: true,
      passwordHash: hash,
      passwordSalt: salt,
    });
    log(`super admin promoted/reset for ${email}`);
    return updated;
  }

  return existing;
}

async function seedCategoriesIfMissing(store: Store) {
  let created = 0;
  for (const category of seedCategories) {
    const existing = await store.findCategoryByName(category.name);
    if (!existing) {
      await store.createCategory(category);
      created += 1;
    }
  }
  log(`categories ready (${created} created, ${seedCategories.length} total)`);
}

async function seedBusinessesIfMissing(store: Store) {
  let created = 0;
  for (const business of seedBusinesses) {
    const existing = await store.findBusiness(business.id);
    if (!existing) {
      await store.createBusiness(business);
      created += 1;
    }
  }
  log(`businesses ready (${created} created, ${seedBusinesses.length} total)`);
}

async function seedDemoUsersIfMissing(store: Store) {
  if (!config.allowSeededDemoAccounts) {
    log('demo accounts skipped (SEED_DEMO_ACCOUNTS is disabled)');
    return;
  }
  for (const seed of demoUsers) {
    const existing = await store.findUserByEmail(seed.email);
    if (existing) continue;
    const { hash, salt } = await hashPassword(seed.password);
    await store.createUser(buildDemoUser(seed, hash, salt));
    log(`demo account created: ${seed.email}`);
  }
  const businesses = await store.listBusinesses();
  for (const business of businesses) {
    if (business.ownerId) continue;
    const ownerEmail = business.id === 'BIZ-001' ? config.superAdminEmail : 'seller@bonfilsstore.com';
    if (!ownerEmail) continue;
    const owner = await store.findUserByEmail(ownerEmail);
    if (owner) await store.updateBusiness(business.id, { ownerId: owner.id });
  }
}

async function seedProductsIfMissing(store: Store) {
  let created = 0;
  for (const product of seedProducts) {
    const existing = await store.findProduct(product.id);
    if (existing) continue;
    await store.createProduct(product);
    created += 1;
  }
  log(`products ready (${created} created, ${seedProducts.length} total)`);

  const counts: Record<string, { products: number; sales: number }> = {};
  for (const product of await store.listAllProducts()) {
    const entry = counts[product.businessId] || { products: 0, sales: 0 };
    entry.products += 1;
    entry.sales += product.salesCount;
    counts[product.businessId] = entry;
  }
  for (const business of await store.listBusinesses()) {
    const entry = counts[business.id];
    if (!entry) continue;
    await store.updateBusiness(business.id, { totalProducts: entry.products, totalSales: entry.sales });
  }
}

export async function runSeed(store: Store = getStore()): Promise<void> {
  await migrateCategoryStructure(store);
  await seedCategoriesIfMissing(store);
  await seedBusinessesIfMissing(store);
  await seedDemoUsersIfMissing(store);
  await seedProductsIfMissing(store);
  await ensureSuperAdmin(store);
  log('seeding complete');
}

const isDirectRun = process.argv[1] && /seed/i.test(process.argv[1]);

if (isDirectRun) {
  runSeed(await initStore())
    .then(async () => {
      const store = getStore();
      await store.close();
      process.exit(0);
    })
    .catch(async error => {
      console.error('[seed] failed', error);
      try {
        await getStore().close();
      } catch {
        // ignore
      }
      process.exit(1);
    });
}
