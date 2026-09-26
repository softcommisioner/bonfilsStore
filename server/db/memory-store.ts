import fs from 'fs';
import path from 'path';
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

interface MemoryTables {
  users: UserRecord[];
  sessions: SessionRecord[];
  otps: OtpRecord[];
  businesses: Business[];
  categories: Category[];
  products: Product[];
  orders: Order[];
  chinaRequests: ChinaRequest[];
  shippingOrders: ShippingOrder[];
  activityLogs: AdminActivityLog[];
  notifications: NotificationItem[];
  emails: EmailRecord[];
  counters: Record<string, number>;
  media: Map<string, MediaRecord>;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function sortProducts(products: Product[], sort?: string): Product[] {
  const sorted = [...products];
  switch (sort) {
    case 'price_asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'popular':
      sorted.sort((a, b) => b.salesCount - a.salesCount);
      break;
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    default:
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return sorted;
}

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;

  private tables: MemoryTables = {
    users: [], sessions: [], otps: [], businesses: [], categories: [], products: [],
    orders: [], chinaRequests: [], shippingOrders: [], activityLogs: [], notifications: [],
    emails: [], counters: {}, media: new Map(),
  };

  private snapshotPath: string | null = null;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(snapshotPath?: string | null) {
    this.snapshotPath = snapshotPath || null;
  }

  async init(): Promise<void> {
    if (this.snapshotPath && fs.existsSync(this.snapshotPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.snapshotPath, 'utf8'));
        const media = new Map<string, MediaRecord>();
        for (const entry of raw.media || []) media.set(entry.id, entry);
        this.tables = {
          users: raw.users || [],
          sessions: raw.sessions || [],
          otps: raw.otps || [],
          businesses: raw.businesses || [],
          categories: raw.categories || [],
          products: raw.products || [],
          orders: raw.orders || [],
          chinaRequests: raw.chinaRequests || [],
          shippingOrders: raw.shippingOrders || [],
          activityLogs: raw.activityLogs || [],
          notifications: raw.notifications || [],
          emails: raw.emails || [],
          counters: raw.counters || {},
          media,
        };
        console.log(`[store] memory store restored from ${this.snapshotPath}`);
      } catch (error) {
        console.warn('[store] failed to restore snapshot, starting empty:', (error as Error).message);
      }
    }
  }

  async close(): Promise<void> {
    this.writeSnapshot();
  }

  /** Coalesces bursts of writes into a single snapshot. */
  private flush(): void {
    if (!this.snapshotPath) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.writeSnapshot(), 250);
  }

  /**
   * Writes the snapshot synchronously. `close()` calls this directly because the
   * debounced `flush()` timer never runs when the process exits straight after
   * seeding, which would silently discard every change.
   */
  private writeSnapshot(): void {
    if (!this.snapshotPath) return;
    try {
      fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });
      fs.writeFileSync(
        this.snapshotPath,
        JSON.stringify({ ...this.tables, media: Array.from(this.tables.media.values()) }),
      );
    } catch (error) {
      console.warn('[store] snapshot write failed:', (error as Error).message);
    }
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.tables.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.tables.users.find(u => u.id === id) || null;
  }

  async listUsers(): Promise<UserRecord[]> {
    return clone(this.tables.users);
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    this.tables.users.push(user);
    this.flush();
    return clone(user);
  }

  async updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord | null> {
    const index = this.tables.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    this.tables.users[index] = { ...this.tables.users[index], ...patch };
    this.flush();
    return clone(this.tables.users[index]);
  }

  async deleteUser(id: string): Promise<boolean> {
    const index = this.tables.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.tables.users.splice(index, 1);
    this.tables.sessions = this.tables.sessions.filter(session => session.userId !== id);
    this.flush();
    return true;
  }

  async createSession(session: SessionRecord): Promise<void> {
    this.tables.sessions.push(session);
    this.flush();
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const session = this.tables.sessions.find(s => s.token === token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.tables.sessions = this.tables.sessions.filter(s => s.token !== token);
      return null;
    }
    return session;
  }

  async deleteSession(token: string): Promise<void> {
    this.tables.sessions = this.tables.sessions.filter(s => s.token !== token);
    this.flush();
  }

  async deleteSessionsForUser(userId: string): Promise<void> {
    this.tables.sessions = this.tables.sessions.filter(s => s.userId !== userId);
    this.flush();
  }

  async deleteAdminSessionsForUser(userId: string): Promise<void> {
    this.tables.sessions = this.tables.sessions.filter(s => !(s.userId === userId && s.audience === 'admin'));
    this.flush();
  }

  async createOtp(record: OtpRecord): Promise<void> {
    this.tables.otps.push(record);
    this.flush();
  }

  async latestOtp(email: string, purpose: OtpPurpose): Promise<OtpRecord | null> {
    const matches = this.tables.otps
      .filter(o => o.email === email && o.purpose === purpose)
      .sort((a, b) => b.createdAt - a.createdAt);
    return matches[0] || null;
  }

  async updateOtp(id: string, patch: Partial<OtpRecord>): Promise<void> {
    const index = this.tables.otps.findIndex(o => o.id === id);
    if (index === -1) return;
    this.tables.otps[index] = { ...this.tables.otps[index], ...patch };
    this.flush();
  }

  async invalidateOtps(email: string, purpose: OtpPurpose): Promise<void> {
    for (const record of this.tables.otps) {
      if (record.email === email && record.purpose === purpose) record.expiresAt = 0;
    }
    this.flush();
  }

  async listBusinesses(): Promise<Business[]> {
    return clone(this.tables.businesses);
  }

  async findBusiness(id: string): Promise<Business | null> {
    return this.tables.businesses.find(b => b.id === id) || null;
  }

  async findBusinessByOwner(ownerId: string): Promise<Business | null> {
    return this.tables.businesses.find(b => b.ownerId === ownerId) || null;
  }

  async createBusiness(business: Business): Promise<Business> {
    this.tables.businesses.push(business);
    this.flush();
    return clone(business);
  }

  async updateBusiness(id: string, patch: Partial<Business>): Promise<Business | null> {
    const index = this.tables.businesses.findIndex(b => b.id === id);
    if (index === -1) return null;
    this.tables.businesses[index] = { ...this.tables.businesses[index], ...patch };
    this.flush();
    return clone(this.tables.businesses[index]);
  }

  async listCategories(includeInactive = false): Promise<Category[]> {
    return this.tables.categories
      .filter(c => includeInactive || c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(c => ({ ...c, productCount: this.tables.products.filter(p => p.category === c.name).length }));
  }

  async findCategoryByName(name: string): Promise<Category | null> {
    return this.tables.categories.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async createCategory(category: Category): Promise<Category> {
    this.tables.categories.push(category);
    this.flush();
    return clone(category);
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<Category | null> {
    const index = this.tables.categories.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.tables.categories[index] = { ...this.tables.categories[index], ...patch };
    this.flush();
    return clone(this.tables.categories[index]);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const index = this.tables.categories.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.tables.categories.splice(index, 1);
    this.flush();
    return true;
  }

  async countProductsByCategory(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const product of this.tables.products) {
      counts[product.category] = (counts[product.category] || 0) + 1;
    }
    return counts;
  }

  async listProducts(query: ProductQuery): Promise<ProductPage> {
    let results = [...this.tables.products];
    if (!query.includeInactive) results = results.filter(p => p.isActive !== false);
    if (query.featuredOnly) results = results.filter(p => p.isFeatured);
    if (query.ids) results = results.filter(p => query.ids!.includes(p.id));
    if (query.search) {
      const needle = query.search.toLowerCase().trim();
      const terms = needle.split(/\s+/).filter(Boolean);
      results = results.filter(product => {
        const haystack = [product.title, product.description, product.category, product.brand, product.sellerName]
          .join(' ')
          .toLowerCase();
        return terms.every(term => haystack.includes(term));
      });
    }
    if (query.category && query.category !== 'All') {
      results = results.filter(p => p.category.toLowerCase() === query.category!.toLowerCase());
    }
    if (query.sellerId) results = results.filter(p => p.businessId === query.sellerId);
    if (query.brand) results = results.filter(p => p.brand.toLowerCase() === query.brand!.toLowerCase());
    if (typeof query.minPrice === 'number') results = results.filter(p => p.price >= query.minPrice!);
    if (typeof query.maxPrice === 'number') results = results.filter(p => p.price <= query.maxPrice!);

    const total = results.length;
    const sorted = sortProducts(results, query.sort);
    const pageSize = Math.min(Math.max(query.pageSize || 24, 1), 100);
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(query.page || 1, 1), pageCount);
    const start = (page - 1) * pageSize;

    return {
      products: sorted.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      pageCount,
      hasMore: start + pageSize < total,
    };
  }

  async listAllProducts(): Promise<Product[]> {
    return clone(this.tables.products);
  }

  async findProduct(id: string): Promise<Product | null> {
    return this.tables.products.find(p => p.id === id) || null;
  }

  async createProduct(product: Product): Promise<Product> {
    this.tables.products.unshift(product);
    this.flush();
    return clone(product);
  }

  async updateProduct(id: string, patch: Partial<Product>): Promise<Product | null> {
    const index = this.tables.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.tables.products[index] = { ...this.tables.products[index], ...patch };
    this.flush();
    return clone(this.tables.products[index]);
  }

  async deleteProduct(id: string): Promise<boolean> {
    const index = this.tables.products.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.tables.products.splice(index, 1);
    this.flush();
    return true;
  }

  async listOrders(query: OrderQuery): Promise<Order[]> {
    let results = [...this.tables.orders];
    if (query.customerId) results = results.filter(o => o.customerId === query.customerId);
    if (query.businessId) results = results.filter(o => o.items.some(i => i.businessId === query.businessId));
    if (query.status) results = results.filter(o => o.status === query.status);
    if (query.paymentStatus) results = results.filter(o => o.paymentStatus === query.paymentStatus);
    return clone(results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }

  async findOrder(idOrNumber: string): Promise<Order | null> {
    return this.tables.orders.find(o => o.id === idOrNumber || o.orderNumber === idOrNumber) || null;
  }

  async updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
    const index = this.tables.orders.findIndex(o => o.id === id);
    if (index === -1) return null;
    this.tables.orders[index] = { ...this.tables.orders[index], ...patch };
    this.flush();
    return clone(this.tables.orders[index]);
  }

  async placeOrder(order: Order, lines: Array<{ productId: string; quantity: number }>): Promise<Order> {
    for (const line of lines) {
      const product = this.tables.products.find(p => p.id === line.productId);
      if (!product) throw new InsufficientStockError(`Product ${line.productId} not found.`);
      if (product.stock < line.quantity) {
        throw new InsufficientStockError(`Insufficient stock for ${product.title}.`);
      }
    }
    for (const line of lines) {
      const product = this.tables.products.find(p => p.id === line.productId)!;
      product.stock -= line.quantity;
      product.salesCount += line.quantity;
    }
    this.tables.orders.unshift(order);
    this.flush();
    return clone(order);
  }

  async listChinaRequests(query: ChinaRequestQuery = {}): Promise<ChinaRequest[]> {
    let results = [...this.tables.chinaRequests];
    if (query.userId) results = results.filter(r => r.userId === query.userId);
    if (query.email) results = results.filter(r => r.customerEmail.toLowerCase() === query.email!.toLowerCase());
    if (query.status) results = results.filter(r => r.status === query.status);
    if (query.staffId) results = results.filter(r => r.assignedStaffId === query.staffId);
    return clone(results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }

  async findChinaRequest(idOrNumber: string): Promise<ChinaRequest | null> {
    return this.tables.chinaRequests.find(r => r.id === idOrNumber || r.requestNumber === idOrNumber) || null;
  }

  async createChinaRequest(request: ChinaRequest): Promise<ChinaRequest> {
    this.tables.chinaRequests.unshift(request);
    this.flush();
    return clone(request);
  }

  async updateChinaRequest(id: string, patch: Partial<ChinaRequest>): Promise<ChinaRequest | null> {
    const index = this.tables.chinaRequests.findIndex(r => r.id === id);
    if (index === -1) return null;
    this.tables.chinaRequests[index] = { ...this.tables.chinaRequests[index], ...patch };
    this.flush();
    return clone(this.tables.chinaRequests[index]);
  }

  async listShippingOrders(): Promise<ShippingOrder[]> {
    return clone(this.tables.shippingOrders);
  }

  async findShippingOrder(id: string): Promise<ShippingOrder | null> {
    return this.tables.shippingOrders.find(s => s.id === id) || null;
  }

  async findShippingOrderByTracking(trackingNumber: string): Promise<ShippingOrder | null> {
    const needle = trackingNumber.trim().toUpperCase();
    return this.tables.shippingOrders.find(s => s.trackingNumber.toUpperCase() === needle) || null;
  }

  async createShippingOrder(shipment: ShippingOrder): Promise<ShippingOrder> {
    this.tables.shippingOrders.push(shipment);
    this.flush();
    return clone(shipment);
  }

  async updateShippingOrder(id: string, patch: Partial<ShippingOrder>): Promise<ShippingOrder | null> {
    const index = this.tables.shippingOrders.findIndex(s => s.id === id);
    if (index === -1) return null;
    this.tables.shippingOrders[index] = { ...this.tables.shippingOrders[index], ...patch };
    this.flush();
    return clone(this.tables.shippingOrders[index]);
  }

  async addActivityLog(log: AdminActivityLog): Promise<void> {
    this.tables.activityLogs.unshift(log);
    if (this.tables.activityLogs.length > 500) this.tables.activityLogs.pop();
    this.flush();
  }

  async listActivityLogs(limit: number): Promise<AdminActivityLog[]> {
    return clone(this.tables.activityLogs.slice(0, limit));
  }

  async createNotification(notification: NotificationItem): Promise<NotificationItem> {
    this.tables.notifications.unshift(notification);
    this.flush();
    return clone(notification);
  }

  async listNotifications(userId: string): Promise<NotificationItem[]> {
    return clone(this.tables.notifications.filter(n => n.userId === userId));
  }

  async markNotificationRead(id: string, userId: string): Promise<boolean> {
    const notification = this.tables.notifications.find(n => n.id === id && n.userId === userId);
    if (!notification) return false;
    notification.read = true;
    this.flush();
    return true;
  }

  async recordEmail(email: EmailRecord): Promise<void> {
    this.tables.emails.unshift(email);
    if (this.tables.emails.length > 200) this.tables.emails.pop();
    this.flush();
  }

  async listEmails(limit: number): Promise<EmailRecord[]> {
    return clone(this.tables.emails.slice(0, limit));
  }

  async nextCounter(name: string, startAt = 1): Promise<number> {
    const current = this.tables.counters[name] || startAt - 1;
    const next = current + 1;
    this.tables.counters[name] = next;
    this.flush();
    return next;
  }

  async createMedia(media: MediaRecord): Promise<void> {
    this.tables.media.set(media.id, media);
    this.flush();
  }

  async findMedia(id: string): Promise<MediaRecord | null> {
    return this.tables.media.get(id) || null;
  }
}
