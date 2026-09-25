import type {
  User, Business, Product, Order, ChinaRequest,
  Quotation, ShippingOrder, AdminActivityLog, EmailRecord, NotificationItem
} from '../types';

const TOKEN_KEY = 'bonfils_store_auth_token';

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: Failed request`);
    }

    return data as T;
  },

  // Auth
  async register(payload: any) {
    return this.request<{ success: boolean; message: string; email: string; expiresInSeconds: number }>(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  async verifyRegistrationOtp(email: string, code: string) {
    const data = await this.request<{ success: boolean; message: string; user: User; token: string }>(
      '/api/auth/verify-registration-otp',
      { method: 'POST', body: JSON.stringify({ email, code }) }
    );
    if (data.token) this.setToken(data.token);
    return data;
  },

  async login(payload: { email: string; password: string }) {
    return this.request<{ success: boolean; requireOtp: boolean; email: string; maskedEmail: string; message: string; expiresInSeconds: number }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  async verifyLoginOtp(email: string, code: string) {
    const data = await this.request<{ success: boolean; message: string; user: User; token: string }>(
      '/api/auth/verify-login-otp',
      { method: 'POST', body: JSON.stringify({ email, code }) }
    );
    if (data.token) this.setToken(data.token);
    return data;
  },

  async resendOtp(email: string, purpose: 'registration' | 'login' | 'admin_login' | 'password_reset') {
    return this.request<{ success: boolean; message: string; expiresInSeconds: number }>(
      '/api/auth/resend-otp',
      { method: 'POST', body: JSON.stringify({ email, purpose }) }
    );
  },

  async forgotPassword(email: string) {
    return this.request<{ success: boolean; email: string; message: string }>(
      '/api/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) }
    );
  },

  async resetPassword(payload: { email: string; code: string; newPassword: string; confirmPassword: string }) {
    return this.request<{ success: boolean; message: string }>(
      '/api/auth/reset-password',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  async getMe() {
    return this.request<{ user: User; business?: Business }>('/api/auth/me');
  },

  async updateProfile(payload: Partial<User>) {
    return this.request<{ success: boolean; user: User }>(
      '/api/auth/profile',
      { method: 'PUT', body: JSON.stringify(payload) }
    );
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  },

  // Admin Auth & Management
  async adminLogin(payload: { email: string; password: string }) {
    return this.request<{ success: boolean; requireOtp: boolean; email: string; maskedEmail: string; message: string }>(
      '/api/admin/login',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  async verifyAdminOtp(email: string, code: string) {
    const data = await this.request<{ success: boolean; message: string; user: User; token: string }>(
      '/api/admin/verify-otp',
      { method: 'POST', body: JSON.stringify({ email, code }) }
    );
    if (data.token) this.setToken(data.token);
    return data;
  },

  async getAdminStats() {
    return this.request<any>('/api/admin/stats');
  },

  async getAdminUsers() {
    return this.request<{ users: User[] }>('/api/admin/users');
  },

  async createAdminUser(payload: any) {
    return this.request<{ success: boolean; user: User }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminUser(id: string, payload: any) {
    return this.request<{ success: boolean; user: User }>(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteAdminUser(id: string) {
    return this.request<{ success: boolean; message: string }>(`/api/admin/users/${id}`, {
      method: 'DELETE',
    });
  },

  async getAdminBusinesses() {
    return this.request<{ businesses: Business[] }>('/api/admin/businesses');
  },

  async updateAdminBusiness(id: string, payload: any) {
    return this.request<{ success: boolean; business: Business }>(`/api/admin/businesses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async assignStaffToChinaRequest(requestId: string, staffId: string) {
    return this.request<{ success: boolean; request: ChinaRequest }>(`/api/admin/china-requests/${requestId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ staffId }),
    });
  },

  async getAdminActivityLogs() {
    return this.request<{ logs: AdminActivityLog[] }>('/api/admin/activity-logs');
  },

  // Marketplace Products & Shops
  async getProducts(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request<{ products: Product[]; total: number }>(`/api/products?${query}`);
  },

  async getProduct(id: string) {
    return this.request<{ product: Product; business?: Business }>(`/api/products/${id}`);
  },

  async getCategories() {
    return this.request<{ categories: Array<{ name: string; count: number }> }>('/api/categories');
  },

  async getSellers() {
    return this.request<{ businesses: Business[] }>('/api/sellers');
  },

  async getSeller(id: string) {
    return this.request<{ business: Business; products: Product[] }>(`/api/sellers/${id}`);
  },

  // Orders
  async createOrder(payload: any) {
    return this.request<{ success: boolean; order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getOrders() {
    return this.request<{ orders: Order[] }>('/api/orders');
  },

  async getOrder(id: string) {
    return this.request<{ order: Order }>(`/api/orders/${id}`);
  },

  // China Sourcing
  async submitChinaRequest(payload: any) {
    return this.request<{ success: boolean; request: ChinaRequest; message: string }>('/api/china-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getChinaRequests(email?: string) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return this.request<{ requests: ChinaRequest[] }>(`/api/china-requests${query}`);
  },

  async getChinaRequest(id: string) {
    return this.request<{ request: ChinaRequest }>(`/api/china-requests/${id}`);
  },

  async prepareQuotation(requestId: string, payload: any) {
    return this.request<{ success: boolean; quotation: Quotation; request: ChinaRequest }>(
      `/api/china-requests/${requestId}/quotation`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  async respondQuotation(requestId: string, payload: { action: 'accept' | 'reject'; notes?: string }) {
    return this.request<{ success: boolean; request: ChinaRequest }>(
      `/api/china-requests/${requestId}/quotation/respond`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  async updateChinaRequestStatus(requestId: string, payload: { status: string; note?: string; carrier?: string; trackingNumber?: string }) {
    return this.request<{ success: boolean; request: ChinaRequest }>(
      `/api/china-requests/${requestId}/status`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    );
  },

  // Shipping
  async trackShipment(trackingNumber: string) {
    return this.request<{ shipment: ShippingOrder }>(`/api/shipping/track/${encodeURIComponent(trackingNumber)}`);
  },

  // Seller Dashboard
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

  // Emails & Notifications
  async getRecentEmails(email?: string) {
    const q = email ? `?email=${encodeURIComponent(email)}` : '';
    return this.request<{ emails: EmailRecord[] }>(`/api/emails/recent${q}`);
  },

  async getNotifications() {
    return this.request<{ notifications: NotificationItem[] }>('/api/notifications');
  },

  async markNotificationRead(id: string) {
    return this.request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },
};
