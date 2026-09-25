export type UserRole = 'customer' | 'seller' | 'staff' | 'super_admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  roles: UserRole[];
  accountType: 'customer' | 'seller' | 'both';
  isVerified: boolean;
  status: 'active' | 'disabled';
  createdAt: string;
  businessId?: string;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  type: 'official' | 'external';
  description: string;
  phone: string;
  email: string;
  country: string;
  city: string;
  rating: number;
  reviewsCount: number;
  totalProducts: number;
  totalSales: number;
  isVerified: boolean;
  status: 'active' | 'suspended';
  shippingTerms: string;
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  sellerName: string;
  isOfficial: boolean;
  title: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  originalPrice?: number;
  stock: number;
  images: string[];
  rating: number;
  reviewsCount: number;
  salesCount: number;
  shippingOrigin: string;
  shippingTimeDays: string;
  specifications: Record<string, string>;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  businessId: string;
  sellerName: string;
  price: number;
  quantity: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  status: 'pending' | 'processing' | 'partially_shipped' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: {
    fullName: string;
    phone: string;
    street: string;
    city: string;
    country: string;
    notes?: string;
  };
  paymentMethod: 'card' | 'mobile_money' | 'bank_transfer' | 'cash_on_delivery';
  paymentStatus: 'paid' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export type ChinaRequestStatus =
  | 'REQUEST_RECEIVED'
  | 'UNDER_REVIEW'
  | 'CONTACTING_CUSTOMER'
  | 'PRODUCT_SEARCHING'
  | 'SUPPLIER_FOUND'
  | 'PRICE_NEGOTIATION'
  | 'CUSTOMER_CONFIRMATION'
  | 'PAYMENT_PENDING'
  | 'PURCHASED'
  | 'SHIPPING'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Quotation {
  id: string;
  requestId: string;
  productCost: number;
  chinaLocalShipping: number;
  internationalShipping: number;
  serviceFee: number;
  total: number;
  currency: string;
  notes: string;
  validUntil: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface ChinaRequest {
  id: string;
  requestNumber: string; // e.g. BFS-CHINA-2026-000125
  userId?: string;
  // Product info
  productName: string;
  description: string;
  category: string;
  quantity: number;
  preferredBrand?: string;
  modelNumber?: string;
  color?: string;
  size?: string;
  specifications?: string;
  estimatedBudget?: number;
  images: string[];
  referenceUrl?: string;
  // Customer info
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  whatsapp?: string;
  country: string;
  city: string;
  deliveryAddress: string;
  preferredContactMethod: 'email' | 'whatsapp' | 'phone';
  // Shipping preferences
  shippingMethod: 'air' | 'sea' | 'express';
  maxWaitingTime: '15_days' | '30_days' | '45_days' | 'more_than_45_days';
  preferredDeliveryPeriod?: string;
  urgency: 'normal' | 'urgent';
  destination: string;
  instructions?: string;
  // Sourcing workflow
  status: ChinaRequestStatus;
  assignedStaffId?: string;
  assignedStaffName?: string;
  quotation?: Quotation;
  carrier?: string;
  trackingNumber?: string;
  supplierNotes?: string;
  statusHistory: Array<{
    status: ChinaRequestStatus;
    note: string;
    updatedBy: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingOrder {
  id: string;
  trackingNumber: string;
  carrier: string;
  method: 'air' | 'sea' | 'express';
  origin: string;
  destination: string;
  recipientName: string;
  recipientPhone: string;
  currentStage: 1 | 2 | 3 | 4 | 5; // 1: China Supplier, 2: China Warehouse, 3: Int'l Shipping, 4: Destination Country, 5: Customer Delivered
  estimatedDelivery: string;
  status: 'in_transit' | 'customs_clearance' | 'out_for_delivery' | 'delivered';
  checkpoints: Array<{
    title: string;
    location: string;
    description: string;
    date: string;
    completed: boolean;
  }>;
}

export interface AdminActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: 'user' | 'product' | 'order' | 'china_request' | 'quotation' | 'seller' | 'auth';
  targetId?: string;
  details: string;
  timestamp: string;
}

export interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  purpose: 'registration_otp' | 'login_otp' | 'password_reset_otp' | 'admin_otp' | 'china_request' | 'quotation_ready' | 'order_confirmation' | 'shipping_update';
  otpCode?: string;
  html: string;
  sentAt: string;
  status: 'sent' | 'delivered';
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'china_request' | 'quotation' | 'system';
  link?: string;
  read: boolean;
  createdAt: string;
}
