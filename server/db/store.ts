import type {
  User, Business, Product, Order, ChinaRequest, ShippingOrder,
  AdminActivityLog, EmailRecord, NotificationItem, Category
} from '../../src/types';

export type UserRecord = User & { passwordHash: string; passwordSalt: string };

export type OtpPurpose = 'registration' | 'login' | 'password_reset' | 'admin_login';

export interface OtpRecord {
  id: string;
  email: string;
  purpose: OtpPurpose;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  resendAvailableAt: number;
  verifiedAt?: number;
  createdAt: number;
  payload?: Record<string, unknown>;
}

export type SessionAudience = 'app' | 'admin';

export interface SessionRecord {
  token: string;
  userId: string;
  audience: SessionAudience;
  createdAt: number;
  expiresAt: number;
}

export interface ProductQuery {
  search?: string;
  category?: string;
  sellerId?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
  featuredOnly?: boolean;
  includeInactive?: boolean;
  ids?: string[];
}

export interface ProductPage {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  hasMore: boolean;
}

export interface OrderQuery {
  customerId?: string;
  businessId?: string;
  status?: string;
  paymentStatus?: string;
}

export interface ChinaRequestQuery {
  userId?: string;
  email?: string;
  status?: string;
  staffId?: string;
}

export interface MediaRecord {
  id: string;
  mime: string;
  data: string;
  createdAt: number;
}

export class InsufficientStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export interface Store {
  readonly kind: 'postgres' | 'memory';
  init(): Promise<void>;
  close(): Promise<void>;

  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  createUser(user: UserRecord): Promise<UserRecord>;
  updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord | null>;
  deleteUser(id: string): Promise<boolean>;

  createSession(session: SessionRecord): Promise<void>;
  getSession(token: string): Promise<SessionRecord | null>;
  deleteSession(token: string): Promise<void>;
  deleteSessionsForUser(userId: string): Promise<void>;
  deleteAdminSessionsForUser(userId: string): Promise<void>;

  createOtp(record: OtpRecord): Promise<void>;
  latestOtp(email: string, purpose: OtpPurpose): Promise<OtpRecord | null>;
  updateOtp(id: string, patch: Partial<OtpRecord>): Promise<void>;
  invalidateOtps(email: string, purpose: OtpPurpose): Promise<void>;

  listBusinesses(): Promise<Business[]>;
  findBusiness(id: string): Promise<Business | null>;
  findBusinessByOwner(ownerId: string): Promise<Business | null>;
  createBusiness(business: Business): Promise<Business>;
  updateBusiness(id: string, patch: Partial<Business>): Promise<Business | null>;

  listCategories(includeInactive?: boolean): Promise<Category[]>;
  findCategoryByName(name: string): Promise<Category | null>;
  createCategory(category: Category): Promise<Category>;
  updateCategory(id: string, patch: Partial<Category>): Promise<Category | null>;
  deleteCategory(id: string): Promise<boolean>;
  countProductsByCategory(): Promise<Record<string, number>>;

  listProducts(query: ProductQuery): Promise<ProductPage>;
  listAllProducts(): Promise<Product[]>;
  findProduct(id: string): Promise<Product | null>;
  createProduct(product: Product): Promise<Product>;
  updateProduct(id: string, patch: Partial<Product>): Promise<Product | null>;
  deleteProduct(id: string): Promise<boolean>;

  listOrders(query: OrderQuery): Promise<Order[]>;
  findOrder(idOrNumber: string): Promise<Order | null>;
  updateOrder(id: string, patch: Partial<Order>): Promise<Order | null>;
  placeOrder(order: Order, lines: Array<{ productId: string; quantity: number }>): Promise<Order>;

  listChinaRequests(query?: ChinaRequestQuery): Promise<ChinaRequest[]>;
  findChinaRequest(idOrNumber: string): Promise<ChinaRequest | null>;
  createChinaRequest(request: ChinaRequest): Promise<ChinaRequest>;
  updateChinaRequest(id: string, patch: Partial<ChinaRequest>): Promise<ChinaRequest | null>;

  listShippingOrders(): Promise<ShippingOrder[]>;
  findShippingOrder(id: string): Promise<ShippingOrder | null>;
  findShippingOrderByTracking(trackingNumber: string): Promise<ShippingOrder | null>;
  createShippingOrder(shipment: ShippingOrder): Promise<ShippingOrder>;
  updateShippingOrder(id: string, patch: Partial<ShippingOrder>): Promise<ShippingOrder | null>;

  addActivityLog(log: AdminActivityLog): Promise<void>;
  listActivityLogs(limit: number): Promise<AdminActivityLog[]>;

  createNotification(notification: NotificationItem): Promise<NotificationItem>;
  listNotifications(userId: string): Promise<NotificationItem[]>;
  markNotificationRead(id: string, userId: string): Promise<boolean>;

  recordEmail(email: EmailRecord): Promise<void>;
  listEmails(limit: number): Promise<EmailRecord[]>;

  nextCounter(name: string, startAt?: number): Promise<number>;

  createMedia(media: MediaRecord): Promise<void>;
  findMedia(id: string): Promise<MediaRecord | null>;
}
