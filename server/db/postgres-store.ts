import { Pool, type PoolClient } from 'pg';
import type {
  Business, Product, Order, ChinaRequest, ShippingOrder, Category,
  AdminActivityLog, EmailRecord, NotificationItem
} from '../../src/types';
import {
  InsufficientStockError,
  type ChinaRequestQuery, type MediaRecord, type OrderQuery,
  type OtpPurpose, type OtpRecord, type ProductPage, type ProductQuery,
  type SessionRecord, type Store, type UserRecord
} from './store';

type Row = Record<string, any>;

const num = (value: any): number => (value === null || value === undefined ? 0 : Number(value));
const ts = (value: any): string => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());

function mapUser(row: Row): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    country: row.country || '',
    city: row.city || '',
    roles: row.roles || ['customer'],
    accountType: row.account_type,
    isVerified: row.is_verified,
    status: row.status,
    businessId: row.business_id || undefined,
    createdAt: ts(row.created_at),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
  };
}

function mapBusiness(row: Row): Business {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    type: row.type,
    description: row.description,
    phone: row.phone,
    email: row.email,
    country: row.country,
    city: row.city,
    rating: num(row.rating),
    reviewsCount: row.reviews_count,
    totalProducts: row.total_products,
    totalSales: row.total_sales,
    isVerified: row.is_verified,
    status: row.status,
    shippingTerms: row.shipping_terms,
    createdAt: ts(row.created_at),
  };
}

function mapCategory(row: Row): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    image: row.image || undefined,
    icon: row.icon || undefined,
    description: row.description || undefined,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: ts(row.created_at),
    productCount: row.product_count === undefined ? undefined : num(row.product_count),
  };
}

function mapProduct(row: Row): Product {
  return {
    id: row.id,
    businessId: row.business_id,
    sellerName: row.seller_name,
    isOfficial: row.is_official,
    title: row.title,
    description: row.description,
    category: row.category,
    brand: row.brand,
    price: num(row.price),
    originalPrice: row.original_price === null || row.original_price === undefined ? undefined : num(row.original_price),
    stock: row.stock,
    images: row.images || [],
    rating: num(row.rating),
    reviewsCount: row.reviews_count,
    salesCount: row.sales_count,
    shippingOrigin: row.shipping_origin,
    shippingTimeDays: row.shipping_time_days,
    specifications: row.specifications || {},
    isFeatured: row.is_featured,
    isActive: row.is_active,
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
}

function mapOrder(row: Row): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    items: row.items || [],
    subtotal: num(row.subtotal),
    shippingFee: num(row.shipping_fee),
    total: num(row.total),
    status: row.status,
    shippingAddress: row.shipping_address || {},
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
}

function mapChinaRequest(row: Row): ChinaRequest {
  return { ...(row.data || {}), id: row.id, requestNumber: row.request_number, createdAt: ts(row.created_at), updatedAt: ts(row.updated_at) } as ChinaRequest;
}

function mapShippingOrder(row: Row): ShippingOrder {
  return { ...(row.data || {}), id: row.id, trackingNumber: row.tracking_number } as ShippingOrder;
}

function mapActivityLog(row: Row): AdminActivityLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id || undefined,
    details: row.details,
    timestamp: ts(row.timestamp),
  };
}

function mapNotification(row: Row): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    link: row.link || undefined,
    read: row.read,
    createdAt: ts(row.created_at),
  };
}

function mapEmail(row: Row): EmailRecord {
  return {
    id: row.id,
    to: row.recipient,
    subject: row.subject,
    purpose: row.purpose,
    html: row.html,
    sentAt: ts(row.sent_at),
    status: row.status,
  } as EmailRecord;
}

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
    });
  }

  getPool(): Pool {
    return this.pool;
  }

  async init(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async query<T = Row>(text: string, values: any[] = []): Promise<T[]> {
    const result = await this.pool.query(text, values);
    return result.rows as T[];
  }

  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const rows = await this.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async listUsers(): Promise<UserRecord[]> {
    const rows = await this.query('SELECT * FROM users ORDER BY created_at DESC');
    return rows.map(mapUser);
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    const rows = await this.query(
      `INSERT INTO users (id, name, email, phone, country, city, roles, account_type, is_verified, status, business_id, password_hash, password_salt, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        user.id, user.name, user.email, user.phone, user.country, user.city, user.roles,
        user.accountType, user.isVerified, user.status, user.businessId || null,
        user.passwordHash, user.passwordSalt, user.createdAt,
      ],
    );
    return mapUser(rows[0]);
  }

  async updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord | null> {
    const map: Record<string, string> = {
      name: 'name', email: 'email', phone: 'phone', country: 'country', city: 'city',
      roles: 'roles', accountType: 'account_type', isVerified: 'is_verified', status: 'status',
      businessId: 'business_id', passwordHash: 'password_hash', passwordSalt: 'password_salt',
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, column] of Object.entries(map)) {
      if ((patch as any)[key] !== undefined) {
        values.push((patch as any)[key] === '' ? null : (patch as any)[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (!sets.length) return this.findUserById(id);
    values.push(id);
    const rows = await this.query(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async deleteUser(id: string): Promise<boolean> {
    const rows = await this.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  async createSession(session: SessionRecord): Promise<void> {
    await this.query(
      'INSERT INTO sessions (token, user_id, audience, created_at, expires_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (token) DO NOTHING',
      [session.token, session.userId, session.audience, new Date(session.createdAt), new Date(session.expiresAt)],
    );
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const rows = await this.query('SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW() LIMIT 1', [token]);
    if (!rows[0]) return null;
    return {
      token: rows[0].token,
      userId: rows[0].user_id,
      audience: rows[0].audience,
      createdAt: new Date(rows[0].created_at).getTime(),
      expiresAt: new Date(rows[0].expires_at).getTime(),
    };
  }

  async deleteSession(token: string): Promise<void> {
    await this.query('DELETE FROM sessions WHERE token = $1', [token]);
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    await this.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  async deleteAdminSessionsForUser(userId: string): Promise<void> {
    await this.query("DELETE FROM sessions WHERE user_id = $1 AND audience = 'admin'", [userId]);
  }

  async createOtp(record: OtpRecord): Promise<void> {
    await this.query(
      `INSERT INTO otps (id, email, purpose, otp_hash, expires_at, attempts, max_attempts, resend_available_at, verified_at, created_at, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        record.id, record.email, record.purpose, record.otpHash,
        new Date(record.expiresAt), record.attempts, record.maxAttempts,
        new Date(record.resendAvailableAt),
        record.verifiedAt ? new Date(record.verifiedAt) : null,
        new Date(record.createdAt),
        record.payload ? JSON.stringify(record.payload) : null,
      ],
    );
  }

  async latestOtp(email: string, purpose: OtpPurpose): Promise<OtpRecord | null> {
    const rows = await this.query(
      'SELECT * FROM otps WHERE email = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1',
      [email, purpose],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      purpose: row.purpose,
      otpHash: row.otp_hash,
      expiresAt: new Date(row.expires_at).getTime(),
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      resendAvailableAt: new Date(row.resend_available_at).getTime(),
      verifiedAt: row.verified_at ? new Date(row.verified_at).getTime() : undefined,
      createdAt: new Date(row.created_at).getTime(),
      payload: row.payload || undefined,
    };
  }

  async updateOtp(id: string, patch: Partial<OtpRecord>): Promise<void> {
    const timestampColumns = new Set(['expiresAt', 'resendAvailableAt', 'verifiedAt']);
    const map: Record<string, string> = {
      otpHash: 'otp_hash',
      expiresAt: 'expires_at',
      attempts: 'attempts',
      resendAvailableAt: 'resend_available_at',
      verifiedAt: 'verified_at',
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, column] of Object.entries(map)) {
      const value = (patch as any)[key];
      if (value === undefined) continue;
      if (value === null) {
        values.push(null);
      } else if (timestampColumns.has(key)) {
        values.push(new Date(value));
      } else {
        values.push(value);
      }
      sets.push(`${column} = $${values.length}`);
    }
    if (!sets.length) return;
    values.push(id);
    await this.query(`UPDATE otps SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
  }

  async invalidateOtps(email: string, purpose: OtpPurpose): Promise<void> {
    await this.query("UPDATE otps SET expires_at = NOW() - INTERVAL '1 minute' WHERE email = $1 AND purpose = $2", [email, purpose]);
  }

  async listBusinesses(): Promise<Business[]> {
    const rows = await this.query('SELECT * FROM businesses ORDER BY created_at ASC');
    return rows.map(mapBusiness);
  }

  async findBusiness(id: string): Promise<Business | null> {
    const rows = await this.query('SELECT * FROM businesses WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapBusiness(rows[0]) : null;
  }

  async findBusinessByOwner(ownerId: string): Promise<Business | null> {
    const rows = await this.query('SELECT * FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1', [ownerId]);
    return rows[0] ? mapBusiness(rows[0]) : null;
  }

  async createBusiness(business: Business): Promise<Business> {
    const rows = await this.query(
      `INSERT INTO businesses (id, owner_id, name, type, description, phone, email, country, city, rating, reviews_count, total_products, total_sales, is_verified, status, shipping_terms, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        business.id, business.ownerId || null, business.name, business.type, business.description,
        business.phone, business.email, business.country, business.city, business.rating,
        business.reviewsCount, business.totalProducts, business.totalSales, business.isVerified,
        business.status, business.shippingTerms, business.createdAt,
      ],
    );
    return mapBusiness(rows[0]);
  }

  async updateBusiness(id: string, patch: Partial<Business>): Promise<Business | null> {
    const map: Record<string, string> = {
      ownerId: 'owner_id', name: 'name', type: 'type', description: 'description', phone: 'phone',
      email: 'email', country: 'country', city: 'city', rating: 'rating', reviewsCount: 'reviews_count',
      totalProducts: 'total_products', totalSales: 'total_sales', isVerified: 'is_verified',
      status: 'status', shippingTerms: 'shipping_terms',
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, column] of Object.entries(map)) {
      if ((patch as any)[key] !== undefined) {
        values.push((patch as any)[key] === '' ? null : (patch as any)[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (!sets.length) return this.findBusiness(id);
    values.push(id);
    const rows = await this.query(`UPDATE businesses SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    return rows[0] ? mapBusiness(rows[0]) : null;
  }

  async listCategories(includeInactive = false): Promise<Category[]> {
    const rows = await this.query(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category = c.name) AS product_count
       FROM categories c
       ${includeInactive ? '' : 'WHERE c.is_active = TRUE'}
       ORDER BY c.sort_order ASC, c.name ASC`,
    );
    return rows.map(mapCategory);
  }

  async findCategoryByName(name: string): Promise<Category | null> {
    const rows = await this.query('SELECT * FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]);
    return rows[0] ? mapCategory(rows[0]) : null;
  }

  async createCategory(category: Category): Promise<Category> {
    const rows = await this.query(
      `INSERT INTO categories (id, name, slug, image, icon, description, sort_order, is_active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        category.id, category.name, category.slug, category.image || null, category.icon || null,
        category.description || '', category.sortOrder, category.isActive, category.createdAt,
      ],
    );
    return mapCategory(rows[0]);
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<Category | null> {
    const map: Record<string, string> = {
      name: 'name', slug: 'slug', image: 'image', icon: 'icon', description: 'description',
      sortOrder: 'sort_order', isActive: 'is_active',
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, column] of Object.entries(map)) {
      if ((patch as any)[key] !== undefined) {
        values.push((patch as any)[key] === '' ? null : (patch as any)[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (!sets.length) return (await this.listCategories(true)).find(c => c.id === id) || null;
    values.push(id);
    const rows = await this.query(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    return rows[0] ? mapCategory(rows[0]) : null;
  }

  async deleteCategory(id: string): Promise<boolean> {
    const rows = await this.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  async countProductsByCategory(): Promise<Record<string, number>> {
    const rows = await this.query('SELECT category, COUNT(*)::int AS count FROM products GROUP BY category');
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.category] = num(row.count);
    return counts;
  }

  async listProducts(query: ProductQuery): Promise<ProductPage> {
    const where: string[] = [];
    const values: any[] = [];

    if (!query.includeInactive) where.push('is_active = TRUE');
    if (query.featuredOnly) where.push('is_featured = TRUE');
    if (query.ids && query.ids.length) {
      values.push(query.ids);
      where.push(`id = ANY($${values.length})`);
    }
    if (query.search) {
      const terms = query.search.toLowerCase().split(/\s+/).filter(Boolean);
      for (const term of terms) {
        values.push(`%${term}%`);
        where.push(
          `(title ILIKE $${values.length} OR description ILIKE $${values.length} OR category ILIKE $${values.length} OR brand ILIKE $${values.length} OR seller_name ILIKE $${values.length})`,
        );
      }
    }
    if (query.category && query.category !== 'All') {
      values.push(query.category);
      where.push(`LOWER(category) = LOWER($${values.length})`);
    }
    if (query.sellerId) {
      values.push(query.sellerId);
      where.push(`business_id = $${values.length}`);
    }
    if (query.brand) {
      values.push(query.brand);
      where.push(`LOWER(brand) = LOWER($${values.length})`);
    }
    if (typeof query.minPrice === 'number') {
      values.push(query.minPrice);
      where.push(`price >= $${values.length}`);
    }
    if (typeof query.maxPrice === 'number') {
      values.push(query.maxPrice);
      where.push(`price <= $${values.length}`);
    }

    const orderBy = {
      price_asc: 'price ASC',
      price_desc: 'price DESC',
      popular: 'sales_count DESC',
      rating: 'rating DESC',
    }[query.sort || ''] || 'created_at DESC';

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const totalRows = await this.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM products ${whereSql}`, values);
    const total = totalRows[0] ? totalRows[0].count : 0;

    const pageSize = Math.min(Math.max(query.pageSize || 24, 1), 100);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(query.page || 1, 1), pageCount);
    const offset = (page - 1) * pageSize;

    const rows = await this.query(
      `SELECT * FROM products ${whereSql} ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, offset],
    );

    return {
      products: rows.map(mapProduct),
      total,
      page,
      pageSize,
      pageCount,
      hasMore: offset + pageSize < total,
    };
  }

  async listAllProducts(): Promise<Product[]> {
    const rows = await this.query('SELECT * FROM products ORDER BY created_at DESC');
    return rows.map(mapProduct);
  }

  async findProduct(id: string): Promise<Product | null> {
    const rows = await this.query('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapProduct(rows[0]) : null;
  }

  async createProduct(product: Product): Promise<Product> {
    const rows = await this.query(
      `INSERT INTO products (id, business_id, seller_name, is_official, title, description, category, brand, price, original_price, stock, images, rating, reviews_count, sales_count, shipping_origin, shipping_time_days, specifications, is_featured, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [
        product.id, product.businessId, product.sellerName, product.isOfficial, product.title,
        product.description, product.category, product.brand, product.price,
        product.originalPrice ?? null, product.stock, product.images, product.rating,
        product.reviewsCount, product.salesCount, product.shippingOrigin, product.shippingTimeDays,
        JSON.stringify(product.specifications || {}), product.isFeatured, product.isActive,
        product.createdAt, product.updatedAt,
      ],
    );
    return mapProduct(rows[0]);
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
    const map: Record<string, string> = {
      businessId: 'business_id', sellerName: 'seller_name', isOfficial: 'is_official', title: 'title',
      description: 'description', category: 'category', brand: 'brand', price: 'price',
      originalPrice: 'original_price', stock: 'stock', images: 'images', rating: 'rating',
      reviewsCount: 'reviews_count', salesCount: 'sales_count', shippingOrigin: 'shipping_origin',
      shippingTimeDays: 'shipping_time_days', specifications: 'specifications', isFeatured: 'is_featured',
      isActive: 'is_active',
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, column] of Object.entries(map)) {
      const value = (patch as any)[key];
      if (value !== undefined) {
        values.push(key === 'specifications' ? JSON.stringify(value || {}) : value === '' ? null : value);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (!sets.length) return this.findProduct(id);
    values.push(id);
    const rows = await this.query(
      `UPDATE products SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return rows[0] ? mapProduct(rows[0]) : null;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const rows = await this.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  async listOrders(query: OrderQuery): Promise<Order[]> {
    const where: string[] = [];
    const values: any[] = [];
    if (query.customerId) {
      values.push(query.customerId);
      where.push(`customer_id = $${values.length}`);
    }
    if (query.businessId) {
      values.push(JSON.stringify([{ businessId: query.businessId }]));
      where.push(`items @> $${values.length}::jsonb`);
    }
    if (query.status) {
      values.push(query.status);
      where.push(`status = $${values.length}`);
    }
    if (query.paymentStatus) {
      values.push(query.paymentStatus);
      where.push(`payment_status = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.query(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC`, values);
    return rows.map(mapOrder);
  }

  async findOrder(idOrNumber: string): Promise<Order | null> {
    const rows = await this.query('SELECT * FROM orders WHERE id = $1 OR order_number = $1 LIMIT 1', [idOrNumber]);
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
    const map: Record<string, string> = {
      status: 'status', paymentStatus: 'payment_status', items: 'items', total: 'total',
      subtotal: 'subtotal', shippingFee: 'shipping_fee',
    };
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, column] of Object.entries(map)) {
      if ((patch as any)[key] !== undefined) {
        values.push(key === 'items' ? JSON.stringify((patch as any)[key]) : (patch as any)[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    if (!sets.length) return this.findOrder(id);
    values.push(id);
    const rows = await this.query(
      `UPDATE orders SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return rows[0] ? mapOrder(rows[0]) : null;
  }

  async placeOrder(order: Order, lines: Array<{ productId: string; quantity: number }>): Promise<Order> {
    return this.withTransaction(async client => {
      for (const line of lines) {
        const result = await client.query('SELECT id, title, stock FROM products WHERE id = $1 FOR UPDATE', [line.productId]);
        const product = result.rows[0];
        if (!product) throw new InsufficientStockError(`Product ${line.productId} not found.`);
        if (product.stock < line.quantity) {
          throw new InsufficientStockError(`Insufficient stock for ${product.title}.`);
        }
        await client.query('UPDATE products SET stock = stock - $1, sales_count = sales_count + $1 WHERE id = $2', [
          line.quantity,
          line.productId,
        ]);
      }
      const inserted = await client.query(
        `INSERT INTO orders (id, order_number, customer_id, customer_name, customer_email, customer_phone, items, subtotal, shipping_fee, total, status, shipping_address, payment_method, payment_status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [
          order.id, order.orderNumber, order.customerId, order.customerName, order.customerEmail,
          order.customerPhone, JSON.stringify(order.items), order.subtotal, order.shippingFee, order.total,
          order.status, JSON.stringify(order.shippingAddress), order.paymentMethod, order.paymentStatus,
          order.createdAt, order.updatedAt,
        ],
      );
      return mapOrder(inserted.rows[0]);
    });
  }

  async listChinaRequests(query: ChinaRequestQuery = {}): Promise<ChinaRequest[]> {
    const where: string[] = [];
    const values: any[] = [];
    if (query.userId) {
      values.push(query.userId);
      where.push(`user_id = $${values.length}`);
    }
    if (query.email) {
      values.push(query.email);
      where.push(`LOWER(customer_email) = LOWER($${values.length})`);
    }
    if (query.status) {
      values.push(query.status);
      where.push(`status = $${values.length}`);
    }
    if (query.staffId) {
      values.push(query.staffId);
      where.push(`data->>'assignedStaffId' = $${values.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await this.query(`SELECT * FROM china_requests ${whereSql} ORDER BY created_at DESC`, values);
    return rows.map(mapChinaRequest);
  }

  async findChinaRequest(idOrNumber: string): Promise<ChinaRequest | null> {
    const rows = await this.query('SELECT * FROM china_requests WHERE id = $1 OR request_number = $1 LIMIT 1', [idOrNumber]);
    return rows[0] ? mapChinaRequest(rows[0]) : null;
  }

  async createChinaRequest(request: ChinaRequest): Promise<ChinaRequest> {
    const rows = await this.query(
      `INSERT INTO china_requests (id, request_number, user_id, customer_email, status, data, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        request.id, request.requestNumber, request.userId || null, request.customerEmail,
        request.status, JSON.stringify(request), request.createdAt, request.updatedAt,
      ],
    );
    return mapChinaRequest(rows[0]);
  }

  async updateChinaRequest(id: string, patch: Partial<ChinaRequest>): Promise<ChinaRequest | null> {
    const existing = await this.findChinaRequest(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch } as ChinaRequest;
    const rows = await this.query(
      `UPDATE china_requests SET status = $1, data = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [merged.status, JSON.stringify(merged), id],
    );
    return rows[0] ? mapChinaRequest(rows[0]) : null;
  }

  async listShippingOrders(): Promise<ShippingOrder[]> {
    const rows = await this.query('SELECT * FROM shipping_orders ORDER BY created_at DESC');
    return rows.map(mapShippingOrder);
  }

  async findShippingOrder(id: string): Promise<ShippingOrder | null> {
    const rows = await this.query('SELECT * FROM shipping_orders WHERE id = $1 LIMIT 1', [id]);
    return rows[0] ? mapShippingOrder(rows[0]) : null;
  }

  async findShippingOrderByTracking(trackingNumber: string): Promise<ShippingOrder | null> {
    const rows = await this.query('SELECT * FROM shipping_orders WHERE UPPER(tracking_number) = UPPER($1) LIMIT 1', [trackingNumber]);
    return rows[0] ? mapShippingOrder(rows[0]) : null;
  }

  async createShippingOrder(shipment: ShippingOrder): Promise<ShippingOrder> {
    const rows = await this.query(
      'INSERT INTO shipping_orders (id, tracking_number, status, data) VALUES ($1,$2,$3,$4) RETURNING *',
      [shipment.id, shipment.trackingNumber, shipment.status, JSON.stringify(shipment)],
    );
    return mapShippingOrder(rows[0]);
  }

  async updateShippingOrder(id: string, patch: Partial<ShippingOrder>): Promise<ShippingOrder | null> {
    const existing = await this.findShippingOrder(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch } as ShippingOrder;
    const rows = await this.query(
      'UPDATE shipping_orders SET status = $1, data = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [merged.status, JSON.stringify(merged), id],
    );
    return rows[0] ? mapShippingOrder(rows[0]) : null;
  }

  async addActivityLog(log: AdminActivityLog): Promise<void> {
    await this.query(
      `INSERT INTO activity_logs (id, actor_id, actor_name, actor_role, action, target_type, target_id, details, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [log.id, log.actorId, log.actorName, log.actorRole, log.action, log.targetType, log.targetId || null, log.details, log.timestamp],
    );
  }

  async listActivityLogs(limit: number): Promise<AdminActivityLog[]> {
    const rows = await this.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
    return rows.map(mapActivityLog);
  }

  async createNotification(notification: NotificationItem): Promise<NotificationItem> {
    const rows = await this.query(
      `INSERT INTO notifications (id, user_id, title, message, type, link, read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        notification.id, notification.userId, notification.title, notification.message,
        notification.type, notification.link || null, notification.read, notification.createdAt,
      ],
    );
    return mapNotification(rows[0]);
  }

  async listNotifications(userId: string): Promise<NotificationItem[]> {
    const rows = await this.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);
    return rows.map(mapNotification);
  }

  async markNotificationRead(id: string, userId: string): Promise<boolean> {
    const rows = await this.query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    return rows.length > 0;
  }

  async recordEmail(email: EmailRecord): Promise<void> {
    await this.query(
      'INSERT INTO emails (id, recipient, subject, purpose, html, sent_at, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [email.id, email.to, email.subject, email.purpose, email.html, email.sentAt, email.status],
    );
  }

  async listEmails(limit: number): Promise<EmailRecord[]> {
    const rows = await this.query('SELECT * FROM emails ORDER BY sent_at DESC LIMIT $1', [limit]);
    return rows.map(mapEmail);
  }

  async nextCounter(name: string, startAt = 1): Promise<number> {
    const rows = await this.query<{ value: string }>(
      `INSERT INTO counters (name, value) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET value = counters.value + 1
       RETURNING value`,
      [name, startAt],
    );
    return Number(rows[0].value);
  }

  async createMedia(media: MediaRecord): Promise<void> {
    await this.query(
      'INSERT INTO media (id, mime, data, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [media.id, media.mime, media.data, new Date(media.createdAt)],
    );
  }

  async findMedia(id: string): Promise<MediaRecord | null> {
    const rows = await this.query('SELECT * FROM media WHERE id = $1 LIMIT 1', [id]);
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      mime: rows[0].mime,
      data: rows[0].data,
      createdAt: new Date(rows[0].created_at).getTime(),
    };
  }
}
