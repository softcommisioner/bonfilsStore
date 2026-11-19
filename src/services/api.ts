import type {
  User, Business, Product, Order, ChinaRequest, Quotation, ShippingOrder,
  AdminActivityLog, NotificationItem, Category, AdminStats, Paginated,
} from '../types';

const TOKEN_KEY = 'bonfils_store_auth_token';
const USER_PROFILE_KEY = 'bonfils_store_user_profile';
const USER_BUSINESS_KEY = 'bonfils_store_user_business';
const ADMIN_TOKEN_KEY = 'bonfils_store_admin_token';
const ADMIN_PROFILE_KEY = 'bonfils_store_admin_profile';

export interface ProductPageResponse extends Paginated<Product> {
  products: Product[];
}

export const api = {
  // ------------------------------------------------------------------ tokens
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
    localStorage.removeItem(USER_BUSINESS_KEY);
  },
  getUserProfile(): User | null {
    try {
      const raw = localStorage.getItem(USER_PROFILE_KEY);
      return raw ? JSON.parse(raw) as User : null;
    } catch {
      return null;
    }
  },
  setUserProfile(user: User) {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
  },
  getUserBusiness(): Business | null {
    try {
      const raw = localStorage.getItem(USER_BUSINESS_KEY);
      return raw ? JSON.parse(raw) as Business : null;
    } catch {
      return null;
    }
  },
  setUserBusiness(business: Business | null) {
    if (business) localStorage.setItem(USER_BUSINESS_KEY, JSON.stringify(business));
    else localStorage.removeItem(USER_BUSINESS_KEY);
  },

  getAdminToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  },
  setAdminToken(token: string) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  },
  getAdminProfile(): User | null {
    try {
      const raw = localStorage.getItem(ADMIN_PROFILE_KEY);
      return raw ? JSON.parse(raw) as User : null;
    } catch {
      return null;
    }
  },
  setAdminProfile(user: User) {
    localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(user));
  },
  clearAdminProfile() {
    localStorage.removeItem(ADMIN_PROFILE_KEY);
  },
  clearAdminToken() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_PROFILE_KEY);
  },

  // ---------------------------------------------------------------- requests
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.send<T>(endpoint, options, this.getToken(), 'app');
  },

  async adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.send<T>(endpoint, options, this.getAdminToken(), 'admin');
  },

  async send<T>(
    endpoint: string,
    options: RequestInit,
    token: string | null,
    tokenType: 'app' | 'admin' = 'app',
    allowRetry = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, { ...options, headers });
    } catch {
      throw new Error('Network error. Please check your connection and try again.');
    }

    const refreshedToken = response.headers.get('x-session-token');
    if (refreshedToken) {
      const audience = response.headers.get('x-session-audience');
      if (audience === 'admin') this.setAdminToken(refreshedToken);
      else if (audience === 'app') this.setToken(refreshedToken);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && allowRetry) {
        const latestToken = tokenType === 'admin' ? this.getAdminToken() : this.getToken();
        if (latestToken && latestToken !== token) {
          return this.send<T>(endpoint, options, latestToken, tokenType, false);
        }
      }
      if (response.status === 401 || response.status === 403) {
        const fallback = response.status === 401
          ? 'Please sign in to continue.'
          : 'You do not have permission to perform this action.';
        const error = new Error((data as any).error || fallback);
        (error as any).status = response.status;
        throw error;
      }
      throw new Error((data as any).error || `HTTP ${response.status}: request failed`);
    }
    return data as T;
  },

  // -------------------------------------------------------------------- auth
  async register(payload: any) {
    const data = await this.send<{ success: boolean; message: string; user: User; token: string; business?: Business }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      null,
      'app',
    );
    if (data.token) this.setToken(data.token);
    if (data.user) this.setUserProfile(data.user);
    this.setUserBusiness(data.business || null);
    return data;
  },

  async login(payload: { email: string; password: string }) {
    const data = await this.send<{ success: boolean; message: string; user: User; token: string; business?: Business }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      null,
      'app',
    );
    if (data.token) this.setToken(data.token);
    if (data.user) this.setUserProfile(data.user);
    this.setUserBusiness(data.business || null);
    return data;
  },

  async forgotPassword(email: string) {
    return this.send<{ success: boolean; email: string; message: string }>(
      '/api/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) },
      null,
      'app',
    );
  },

  async resetPassword(payload: { email: string; newPassword: string; confirmPassword: string }) {
    const data = await this.send<{ success: boolean; message: string }>(
      '/api/auth/reset-password',
      { method: 'POST', body: JSON.stringify(payload) },
      null,
      'app',
    );
    this.clearToken();
    return data;
  },

  async getMe() {
    const data = await this.request<{ user: User; business?: Business }>('/api/auth/me');
    if (data.user) this.setUserProfile(data.user);
    this.setUserBusiness(data.business || null);
    return data;
  },

  async updateProfile(payload: Partial<User>) {
    const data = await this.request<{ success: boolean; user: User }>(
      '/api/auth/profile',
      { method: 'PUT', body: JSON.stringify(payload) },
    );
    if (data.user) this.setUserProfile(data.user);
    return data;
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  },

  // -------------------------------------------------------------- super admin
  async adminLogin(payload: { email: string; password: string }) {
    const data = await this.send<{ success: boolean; message: string; user: User; token: string }>(
      '/api/admin/login',
      { method: 'POST', body: JSON.stringify(payload) },
      null,
      'admin',
    );
    if (data.token) this.setAdminToken(data.token);
    if (data.user) this.setAdminProfile(data.user);
    return data;
  },

  async adminLogout() {
    try {
      await this.adminRequest('/api/admin/logout', { method: 'POST' });
    } finally {
      this.clearAdminToken();
    }
  },

  async getAdminSession() {
    const data = await this.adminRequest<{ success: boolean; user: User }>('/api/admin/session');
    if (data.user) this.setAdminProfile(data.user);
    return data;
  },

  async getAdminStats() {
    const data = await this.adminRequest<{ stats: AdminStats }>('/api/admin/stats');
    return data.stats;
  },

  async getAdminUsers() {
    const data = await this.adminRequest<{ users: User[] }>('/api/admin/users');
    return data.users;
  },

  async createAdminUser(payload: any) {
    return this.adminRequest<{ success: boolean; user: User }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminUser(id: string, payload: any) {
    return this.adminRequest<{ success: boolean; user: User }>(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminUser(id: string) {
    return this.adminRequest<{ success: boolean; message: string }>(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminBusinesses() {
    const data = await this.adminRequest<{ businesses: Business[] }>('/api/admin/businesses');
    return data.businesses;
  },

  async updateAdminBusiness(id: string, payload: any) {
    return this.adminRequest<{ success: boolean; business: Business }>(`/api/admin/businesses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getAdminProducts(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.adminRequest<ProductPageResponse>(`/api/admin/products?${query}`);
  },

  async createAdminProduct(payload: any) {
    return this.adminRequest<{ success: boolean; product: Product }>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminProduct(id: string, payload: any) {
    return this.adminRequest<{ success: boolean; product: Product }>(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminProduct(id: string) {
    return this.adminRequest<{ success: boolean; message: string }>(`/api/admin/products/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminCategories() {
    const data = await this.adminRequest<{ categories: Array<Category & { count: number }> }>('/api/admin/categories');
    return data.categories;
  },

  async createAdminCategory(payload: any) {
    return this.adminRequest<{ success: boolean; category: Category }>('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminCategory(id: string, payload: any) {
    return this.adminRequest<{ success: boolean; category: Category }>(`/api/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminCategory(id: string) {
    return this.adminRequest<{ success: boolean; message: string }>(`/api/admin/categories/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminOrders(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await this.adminRequest<{ orders: Order[] }>(`/api/admin/orders?${query}`);
    return data.orders;
  },

  async updateAdminOrder(id: string, payload: { status?: string; paymentStatus?: string }) {
    return this.adminRequest<{ success: boolean; order: Order }>(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getAdminChinaRequests(status?: string) {
    const data = await this.adminRequest<{ requests: ChinaRequest[] }>(
      `/api/admin/china-requests${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    );
    return data.requests;
  },

  async assignStaffToChinaRequest(requestId: string, staffId: string) {
    return this.adminRequest<{ success: boolean; request: ChinaRequest }>(
      `/api/admin/china-requests/${requestId}/assign`,
      { method: 'PATCH', body: JSON.stringify({ staffId }) },
    );
  },

  async updateChinaRequestStatus(requestId: string, payload: { status: string; note?: string; carrier?: string; trackingNumber?: string }) {
    return this.request<{ success: boolean; request: ChinaRequest }>(
      `/api/china-requests/${requestId}/status`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
  },

  async getAdminActivityLogs(limit = 60) {
    const data = await this.adminRequest<{ logs: AdminActivityLog[] }>(`/api/admin/activity-logs?limit=${limit}`);
    return data.logs;
  },

  async getAdminEmails(limit = 40) {
    const data = await this.adminRequest<{
      emails: Array<Pick<{ to: string; subject: string }, 'to' | 'subject'> & { id: string; purpose: string; status: string; sentAt: string }>;
      deliveryConfigured: boolean;
    }>(`/api/admin/emails?limit=${limit}`);
    return data;
  },

  async uploadImage(dataUrl: string, filename = 'image.png', folder = 'products') {
    return this.request<{ success: boolean; url: string; storage: string }>('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, filename, folder }),
    });
  },

  async adminUploadImage(dataUrl: string, filename = 'image.png', folder = 'products') {
    return this.adminRequest<{ success: boolean; url: string; storage: string }>('/api/admin/uploads', {
      method: 'POST',
      body: JSON.stringify({ dataUrl, filename, folder }),
    });
  },

  // ------------------------------------------------------------------ catalog
  async getProducts(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<ProductPageResponse>(`/api/products?${query}`);
  },

  async getFeaturedProducts() {
    const data = await this.request<{ products: Product[]; total: number }>('/api/products/featured');
    return data.products;
  },

  async getProduct(id: string) {
    return this.request<{ product: Product; business?: Business; related?: Product[] }>(`/api/products/${id}`);
  },

  async getCategories() {
    const data = await this.request<{ categories: Array<Category & { count: number }> }>('/api/categories');
    return data.categories;
  },

  async getSellers() {
    const data = await this.request<{ businesses: Business[] }>('/api/sellers');
    return data.businesses;
  },

  async getSeller(id: string) {
    return this.request<{ business: Business; products: Product[]; total: number }>(`/api/sellers/${id}`);
  },

  async getBrands() {
    const data = await this.request<{ brands: string[] }>('/api/brands');
    return data.brands;
  },

  // ------------------------------------------------------------------- orders
  async createOrder(payload: any) {
    return this.request<{ success: boolean; order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getOrders() {
    const data = await this.request<{ orders: Order[] }>('/api/orders');
    return data.orders;
  },

  async getOrder(id: string) {
    return this.request<{ order: Order }>(`/api/orders/${id}`);
  },

  async cancelOrder(id: string) {
    return this.request<{ success: boolean; order: Order; message: string }>(`/api/orders/${id}/cancel`, {
      method: 'POST',
    });
  },

  // ----------------------------------------------------------- china sourcing
  async submitChinaRequest(payload: any) {
    return this.request<{ success: boolean; request: ChinaRequest; message: string }>('/api/china-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getChinaRequests(email?: string) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    const data = await this.request<{ requests: ChinaRequest[] }>(`/api/china-requests${query}`);
    return data.requests;
  },

  async getChinaRequest(id: string) {
    const data = await this.request<{ request: ChinaRequest }>(`/api/china-requests/${id}`);
    return data.request;
  },

  async prepareQuotation(requestId: string, payload: any) {
    return this.request<{ success: boolean; quotation: Quotation; request: ChinaRequest }>(
      `/api/china-requests/${requestId}/quotation`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
  },

  async respondQuotation(requestId: string, payload: { action: 'accept' | 'reject'; notes?: string }) {
    return this.request<{ success: boolean; request: ChinaRequest }>(
      `/api/china-requests/${requestId}/quotation/respond`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
  },

  // ----------------------------------------------------------------- shipping
  async trackShipment(trackingNumber: string) {
    return this.request<{ shipment: ShippingOrder }>(`/api/shipping/track/${encodeURIComponent(trackingNumber)}`);
  },

  // ------------------------------------------------------------------ seller
  async getSellerDashboard() {
    return this.request<{ business: Business; products: Product[]; orders: Order[]; metrics: any }>('/api/seller/dashboard');
  },

  async createSellerProduct(payload: any) {
    return this.request<{ success: boolean; product: Product }>('/api/seller/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSellerProduct(id: string, payload: any) {
    return this.request<{ success: boolean; product: Product }>(`/api/seller/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteSellerProduct(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/seller/products/${id}`, {
      method: 'DELETE',
    });
  },

  async updateSellerOrderStatus(orderId: string, payload: { status: string; trackingNumber?: string }) {
    return this.request<{ success: boolean; order: Order }>(`/api/seller/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateSellerProfile(payload: any) {
    return this.request<{ success: boolean; business: Business }>('/api/seller/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // ----------------------------------------------------------- notifications
  async getNotifications() {
    const data = await this.request<{ notifications: NotificationItem[] }>('/api/notifications');
    return data.notifications;
  },

  async markNotificationRead(id: string) {
    return this.request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },

  async getHealth() {
    return this.request<{ status: string; storage: string; emailDelivery: boolean; blobStorage: boolean }>('/api/health');
  },
};
