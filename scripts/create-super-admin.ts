/**
 * Creates or promotes the Super Admin account on the command line.
 *
 *   npm run superadmin:create -- --email you@example.com --password "a-strong-password" --name "Your Name"
 *
 * Credentials are never stored in the frontend and are never printed back.
 */
import { getStore, initStore, runMigrations } from '../server/db';
import { PostgresStore } from '../server/db/postgres-store';
import { hashPassword } from '../server/security';
import { config } from '../server/config';
import type { UserRecord } from '../server/db';
import type { UserRole } from '../src/types';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const email = (arg('email') || process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = arg('password') || process.env.SUPER_ADMIN_PASSWORD || '';
  const name = arg('name') || config.superAdminName || 'Bonfils Super Admin';

  if (!email || !password) {
    console.error('Usage: npm run superadmin:create -- --email <email> --password <password> [--name "Display Name"]');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('The Super Admin password must be at least 12 characters long.');
    process.exit(1);
  }

  const store = await initStore();
  if (store instanceof PostgresStore) {
    await runMigrations(store);
  }

  const { hash, salt } = await hashPassword(password);
  const existing = await store.findUserByEmail(email);

  if (existing) {
    await store.updateUser(existing.id, {
      name,
      roles: Array.from(new Set<UserRole>([...existing.roles, 'super_admin'])),
      status: 'active',
      isVerified: true,
      passwordHash: hash,
      passwordSalt: salt,
    });
    await store.deleteAdminSessionsForUser(existing.id);
    console.log(`Super Admin access granted to ${email} (existing account promoted and password reset).`);
  } else {
    const user: UserRecord = {
      id: 'USR-ADMIN-001',
      name,
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
    await store.createUser(user);
    console.log(`Super Admin created for ${email}.`);
  }

  console.log('Sign in at /admin with these credentials, then complete the emailed verification code.');
  await store.close();
}

main().catch(error => {
  console.error('[superadmin] failed', error);
  process.exit(1);
});
