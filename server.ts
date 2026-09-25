import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import type { 
  User, Business, Product, Order, OrderItem, ChinaRequest, 
  Quotation, ShippingOrder, AdminActivityLog, EmailRecord, NotificationItem, ChinaRequestStatus 
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Helper: Password Hashing using PBKDF2 with Salt
function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
}

// In-Memory Database Store (Scalable & Persistent during server lifetime)
interface UserRecord extends User {
  passwordHash: string;
  passwordSalt: string;
}

interface OTPRecord {
  id: string;
  email: string;
  purpose: 'registration' | 'login' | 'password_reset' | 'admin_login';
  otpCode: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  verifiedAt?: number;
  resendAvailableAt: number;
  createdAt: number;
  payload?: any;
}

// In-Memory Tables
const users: UserRecord[] = [];
const businesses: Business[] = [];
const products: Product[] = [];
const orders: Order[] = [];
const chinaRequests: ChinaRequest[] = [];
const shippingOrders: ShippingOrder[] = [];
const otps: OTPRecord[] = [];
const sessions: Map<string, { userId: string; role: string; expiresAt: number }> = new Map();
const activityLogs: AdminActivityLog[] = [];
const sentEmails: EmailRecord[] = [];
const notifications: NotificationItem[] = [];

// Activity Logger
function logActivity(actorId: string, actorName: string, actorRole: string, action: string, targetType: AdminActivityLog['targetType'], details: string, targetId?: string) {
  const log: AdminActivityLog = {
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    actorId,
    actorName,
    actorRole,
    action,
    targetType,
    targetId,
    details,
    timestamp: new Date().toISOString(),
  };
  activityLogs.unshift(log);
  if (activityLogs.length > 500) activityLogs.pop();
  return log;
}

// Transactional Email Service
async function sendTransactionalEmail(options: {
  to: string;
  subject: string;
  purpose: EmailRecord['purpose'];
  otpCode?: string;
  html: string;
}) {
  const record: EmailRecord = {
    id: `EML-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    to: options.to,
    subject: options.subject,
    purpose: options.purpose,
    otpCode: options.otpCode,
    html: options.html,
    sentAt: new Date().toISOString(),
    status: 'delivered',
  };

  sentEmails.unshift(record);
  if (sentEmails.length > 200) sentEmails.pop();

  // If RESEND_API_KEY is configured in environment, attempt external dispatch
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && !resendApiKey.includes('optional')) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'BONFILS STORE <notifications@bonfilsstore.com>',
          to: [options.to],
          subject: options.subject,
          html: options.html,
        }),
      });
    } catch (err) {
      console.warn('Resend external dispatch error (logged internally):', err);
    }
  }

  return record;
}

// In-App Notification Sender
function createNotification(userId: string, title: string, message: string, type: NotificationItem['type'], link?: string) {
  const notif: NotificationItem = {
    id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    title,
    message,
    type,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  };
  notifications.unshift(notif);
  return notif;
}

// Generate OTP Email HTML Template (Alibaba orange/yellow + white aesthetic)
function generateOTPEmailTemplate(code: string, purposeText: string, recipientName: string = 'Customer') {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BONFILS STORE Security Verification</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #F7F7F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222222;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F7F7; padding: 30px 10px;">
      <tr>
        <td align="center">
          <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #E5E5E5; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <!-- Header -->
            <tr>
              <td style="background-color: #FFFFFF; padding: 24px 30px; border-bottom: 2px solid #FF6A00;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="font-size: 24px; font-weight: 800; color: #FF6A00; letter-spacing: -0.5px;">BONFILS</span>
                      <span style="font-size: 24px; font-weight: 800; color: #222222; letter-spacing: -0.5px;"> STORE</span>
                      <div style="font-size: 11px; text-transform: uppercase; color: #888888; letter-spacing: 1px; margin-top: 2px;">Marketplace & China Sourcing</div>
                    </td>
                    <td align="right">
                      <span style="display: inline-block; padding: 4px 10px; background-color: #FFF3E8; color: #FF6A00; font-size: 12px; font-weight: 700; border-radius: 4px;">Security Code</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 32px 30px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #222222;">${purposeText}</h2>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #555555;">
                  Hello <strong>${recipientName}</strong>,
                </p>
                <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #555555;">
                  Please use the single-use verification code below to complete your authentication with BONFILS STORE.
                </p>

                <!-- OTP Code Display -->
                <div style="background-color: #FFF3E8; border: 1px dashed #FF6A00; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                  <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #FF6A00; margin-bottom: 8px;">Your 6-Digit Verification Code</div>
                  <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #222222; font-family: monospace;">${code}</div>
                  <div style="font-size: 13px; color: #777777; margin-top: 10px;">Valid for <strong>5 minutes</strong> · Single-use only</div>
                </div>

                <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #888888;">
                  If you did not request this verification code, please ignore this email or contact support immediately. Never share this code with anyone.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #FAFAFA; padding: 20px 30px; border-top: 1px solid #EEEEEE; font-size: 12px; color: #999999; text-align: center;">
                <p style="margin: 0 0 6px 0;">© ${new Date().getFullYear()} BONFILS STORE. All rights reserved.</p>
                <p style="margin: 0;">Global Multi-Vendor E-Commerce · Direct China Sourcing & International Freight</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

// Generate China Request Email HTML Template
function generateChinaRequestEmailTemplate(req: ChinaRequest) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><title>China Product Sourcing Request Received</title></head>
  <body style="background-color: #F7F7F7; font-family: sans-serif; padding: 20px; color: #222222;">
    <div style="max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E5E5E5; overflow: hidden;">
      <div style="background: #FF6A00; padding: 20px; color: #FFFFFF;">
        <h1 style="margin: 0; font-size: 22px;">BONFILS STORE</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">China Sourcing & International Freight Service</p>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #222222; font-size: 18px; margin-top: 0;">China Product Request Received!</h2>
        <p style="color: #555555; line-height: 1.5;">Hello <strong>${req.customerName}</strong>,</p>
        <p style="color: #555555; line-height: 1.5;">Your product sourcing request has been received successfully by our dedicated procurement team in China and East Africa.</p>
        
        <div style="background: #F7F7F7; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #FF6A00;">
          <p style="margin: 0 0 6px 0;"><strong>Request ID:</strong> <span style="font-family: monospace; font-size: 16px; color: #FF6A00; font-weight: bold;">${req.requestNumber}</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Product:</strong> ${req.productName}</p>
          <p style="margin: 0 0 6px 0;"><strong>Quantity:</strong> ${req.quantity}</p>
          <p style="margin: 0 0 6px 0;"><strong>Shipping Method:</strong> ${req.shippingMethod.toUpperCase()}</p>
          <p style="margin: 0;"><strong>Current Status:</strong> <span style="color: #22A06B; font-weight: bold;">REQUEST RECEIVED</span></p>
        </div>

        <p style="color: #555555; line-height: 1.5;">Our sourcing specialists will verify factory pricing, inspect product specifications, and prepare an itemized quotation for you within 24 to 48 hours.</p>
        <p style="color: #888888; font-size: 13px;">Thank you for trusting BONFILS STORE.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// Generate Quotation Email Template
function generateQuotationEmailTemplate(req: ChinaRequest, quote: Quotation) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><title>BONFILS STORE - China Sourcing Quotation Ready</title></head>
  <body style="background-color: #F7F7F7; font-family: sans-serif; padding: 20px; color: #222222;">
    <div style="max-width: 580px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; border: 1px solid #E5E5E5; overflow: hidden;">
      <div style="background: #222222; padding: 20px; border-bottom: 3px solid #FF6A00; color: #FFFFFF;">
        <h1 style="margin: 0; font-size: 22px; color: #FF6A00;">BONFILS STORE</h1>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #CCCCCC;">Official China Product Quotation</p>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #222222; font-size: 18px; margin-top: 0;">Quotation Prepared for Request ${req.requestNumber}</h2>
        <p style="color: #555555; line-height: 1.5;">Hello <strong>${req.customerName}</strong>,</p>
        <p style="color: #555555; line-height: 1.5;">Our procurement team in China has completed supplier negotiations and prepared the quotation below for your review:</p>
        
        <table width="100%" cellpadding="10" cellspacing="0" style="border-collapse: collapse; margin: 20px 0; background: #FAFAFA; border: 1px solid #E5E5E5; border-radius: 6px;">
          <tr style="border-bottom: 1px solid #E5E5E5;">
            <td>Product Cost (${req.quantity} units)</td>
            <td align="right" style="font-weight: 600;">$${quote.productCost.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E5E5;">
            <td>China Local Warehouse Shipping</td>
            <td align="right" style="font-weight: 600;">$${quote.chinaLocalShipping.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E5E5E5;">
            <td>International Freight (${req.shippingMethod.toUpperCase()})</td>
            <td align="right" style="font-weight: 600;">$${quote.internationalShipping.toFixed(2)}</td>
          </tr>
          <tr style="border-bottom: 2px solid #DDDDDD;">
            <td>Procurement & Inspection Fee</td>
            <td align="right" style="font-weight: 600;">$${quote.serviceFee.toFixed(2)}</td>
          </tr>
          <tr style="background: #FFF3E8;">
            <td style="font-size: 16px; font-weight: bold; color: #FF6A00;">TOTAL PAYABLE</td>
            <td align="right" style="font-size: 18px; font-weight: bold; color: #FF6A00;">$${quote.total.toFixed(2)}</td>
          </tr>
        </table>

        ${quote.notes ? `<p style="background: #F0F0F0; padding: 10px; border-radius: 4px; font-size: 13px; color: #444;"><strong>Notes:</strong> ${quote.notes}</p>` : ''}
        <p style="color: #555555; line-height: 1.5;">Please log in to your BONFILS STORE dashboard to accept or reject this quotation before <strong>${quote.validUntil}</strong>.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

// Seed Initial Data
function seedDatabase() {
  // 1. Super Admin Account
  const adminSalt = crypto.randomBytes(16).toString('hex');
  const adminPass = hashPassword('Admin@12345', adminSalt);
  const adminUser: UserRecord = {
    id: 'USR-ADMIN-001',
    name: 'Bonfils Super Admin',
    email: 'admin@bonfilsstore.com',
    phone: '+250788100200',
    country: 'Rwanda',
    city: 'Kigali',
    roles: ['super_admin'],
    accountType: 'customer',
    isVerified: true,
    status: 'active',
    passwordHash: adminPass.hash,
    passwordSalt: adminPass.salt,
    createdAt: new Date().toISOString(),
  };
  users.push(adminUser);

  // 2. Staff Account
  const staffSalt = crypto.randomBytes(16).toString('hex');
  const staffPass = hashPassword('Staff@12345', staffSalt);
  const staffUser: UserRecord = {
    id: 'USR-STAFF-001',
    name: 'Jean Claude (Sourcing Team)',
    email: 'staff@bonfilsstore.com',
    phone: '+250788300400',
    country: 'Rwanda',
    city: 'Kigali',
    roles: ['staff'],
    accountType: 'customer',
    isVerified: true,
    status: 'active',
    passwordHash: staffPass.hash,
    passwordSalt: staffPass.salt,
    createdAt: new Date().toISOString(),
  };
  users.push(staffUser);

  // 3. Dual Customer + Seller Account (Kevin / Urukundo)
  const sellerSalt = crypto.randomBytes(16).toString('hex');
  const sellerPass = hashPassword('Seller@12345', sellerSalt);
  const sellerUser: UserRecord = {
    id: 'USR-SELLER-001',
    name: 'Kevin Mugisha',
    email: 'seller@bonfilsstore.com',
    phone: '+250788555666',
    country: 'Rwanda',
    city: 'Kigali',
    roles: ['customer', 'seller'],
    accountType: 'both',
    isVerified: true,
    status: 'active',
    businessId: 'BIZ-002',
    passwordHash: sellerPass.hash,
    passwordSalt: sellerPass.salt,
    createdAt: new Date().toISOString(),
  };
  users.push(sellerUser);

  // 4. Pure Customer Account
  const buyerSalt = crypto.randomBytes(16).toString('hex');
  const buyerPass = hashPassword('Buyer@12345', buyerSalt);
  const buyerUser: UserRecord = {
    id: 'USR-BUYER-001',
    name: 'Aline Uwase',
    email: 'buyer@bonfilsstore.com',
    phone: '+250788777888',
    country: 'Rwanda',
    city: 'Kigali',
    roles: ['customer'],
    accountType: 'customer',
    isVerified: true,
    status: 'active',
    passwordHash: buyerPass.hash,
    passwordSalt: buyerPass.salt,
    createdAt: new Date().toISOString(),
  };
  users.push(buyerUser);

  // Businesses
  businesses.push({
    id: 'BIZ-001',
    ownerId: 'USR-ADMIN-001',
    name: 'Bonfils Official Store',
    type: 'official',
    description: 'Direct procurement and guaranteed original products from Bonfils International Logistics & China Sourcing Hub.',
    phone: '+250788100200',
    email: 'official@bonfilsstore.com',
    country: 'Rwanda',
    city: 'Kigali',
    rating: 4.9,
    reviewsCount: 342,
    totalProducts: 48,
    totalSales: 1250,
    isVerified: true,
    status: 'active',
    shippingTerms: 'Same day dispatch for Kigali; 24-48 hours nationwide. 100% Genuine Guaranteed.',
    createdAt: new Date().toISOString(),
  });

  businesses.push({
    id: 'BIZ-002',
    ownerId: 'USR-SELLER-001',
    name: 'URUKUNDO SHOP',
    type: 'external',
    description: 'Quality smart electronics, cameras, home security devices, and modern gadgets imported from verified tier-1 factories.',
    phone: '+250788555666',
    email: 'seller@bonfilsstore.com',
    country: 'Rwanda',
    city: 'Kigali',
    rating: 4.8,
    reviewsCount: 184,
    totalProducts: 24,
    totalSales: 630,
    isVerified: true,
    status: 'active',
    shippingTerms: 'Free delivery within Kigali for orders over $50.',
    createdAt: new Date().toISOString(),
  });

  businesses.push({
    id: 'BIZ-003',
    ownerId: 'USR-SELLER-003',
    name: 'KEVIN ELECTRONICS',
    type: 'external',
    description: 'Audio systems, drones, wireless equipment, and studio electronics with comprehensive warranty.',
    phone: '+250789222333',
    email: 'kevin.elec@bonfilsstore.com',
    country: 'Rwanda',
    city: 'Kigali',
    rating: 4.7,
    reviewsCount: 96,
    totalProducts: 19,
    totalSales: 310,
    isVerified: true,
    status: 'active',
    shippingTerms: 'Express delivery nationwide. Full 1-year replacement warranty.',
    createdAt: new Date().toISOString(),
  });

  businesses.push({
    id: 'BIZ-004',
    ownerId: 'USR-SELLER-004',
    name: 'ABC IMPORTS',
    type: 'external',
    description: 'Industrial generators, solar equipment, construction power tools, and direct container imports.',
    phone: '+250785444555',
    email: 'abc.imports@bonfilsstore.com',
    country: 'Rwanda',
    city: 'Kigali',
    rating: 4.9,
    reviewsCount: 78,
    totalProducts: 12,
    totalSales: 195,
    isVerified: true,
    status: 'active',
    shippingTerms: 'Heavy freight warehouse pickup or specialized flatbed delivery available.',
    createdAt: new Date().toISOString(),
  });

  // Products with high-fidelity generated images
  products.push({
    id: 'PRD-001',
    businessId: 'BIZ-002',
    sellerName: 'URUKUNDO SHOP',
    isOfficial: false,
    title: 'Smart 4K PTZ Dual-Antenna Wireless CCTV Camera',
    description: 'High-definition 360-degree rotating outdoor security camera with auto-tracking, color night vision, two-way audio, and real-time mobile app alerts.',
    category: 'Security & Surveillance',
    brand: 'VisionPro',
    price: 38.00,
    originalPrice: 55.00,
    stock: 85,
    images: ['/src/assets/images/product_cctv_camera_1790334796559.jpg'],
    rating: 4.9,
    reviewsCount: 124,
    salesCount: 420,
    shippingOrigin: 'Guangzhou / Kigali Stock',
    shippingTimeDays: '1 - 2 Days',
    specifications: {
      'Resolution': '4K Ultra HD (3840x2160)',
      'Connectivity': '2.4GHz Wi-Fi + Dual External High-Gain Antennas',
      'Night Vision': 'Full Color Starlight Night Vision up to 35m',
      'Waterproof': 'IP66 Weatherproof Rating',
      'Storage': 'MicroSD up to 256GB & Encrypted Cloud'
    },
    createdAt: new Date().toISOString(),
  });

  products.push({
    id: 'PRD-002',
    businessId: 'BIZ-003',
    sellerName: 'KEVIN ELECTRONICS',
    isOfficial: false,
    title: 'Professional 4K Aerial Drone with 3-Axis Gimbal & GPS',
    description: 'Precision aerial cinematography drone featuring carbon fiber reinforced arms, 5km transmission range, obstacle avoidance sensors, and 38-minute flight time per battery.',
    category: 'Consumer Electronics',
    brand: 'AeroMax',
    price: 245.00,
    originalPrice: 320.00,
    stock: 22,
    images: ['/src/assets/images/product_smart_drone_1790334810567.jpg'],
    rating: 4.8,
    reviewsCount: 67,
    salesCount: 110,
    shippingOrigin: 'Shenzhen / Kigali Stock',
    shippingTimeDays: '2 - 3 Days',
    specifications: {
      'Camera': '4K HDR 60fps with 1/2-inch CMOS Sensor',
      'Flight Time': 'Up to 38 minutes per intelligent battery',
      'Range': '5.2 km OcuLink Low-Latency Transmission',
      'Features': 'Return-to-Home GPS, Waypoint Navigation, ActiveTrack 4.0'
    },
    createdAt: new Date().toISOString(),
  });

  products.push({
    id: 'PRD-003',
    businessId: 'BIZ-004',
    sellerName: 'ABC IMPORTS',
    isOfficial: false,
    title: 'Super-Silent 3500W Digital Inverter Power Generator',
    description: 'Pure sine wave clean energy generator engineered for residential, commercial backup, and sensitive electronics. Ultra-quiet 58dB operational sound level.',
    category: 'Industrial & Hardware',
    brand: 'PowerGen China Pro',
    price: 490.00,
    originalPrice: 590.00,
    stock: 14,
    images: ['/src/assets/images/product_industrial_generator_1790334833001.jpg'],
    rating: 4.9,
    reviewsCount: 42,
    salesCount: 78,
    shippingOrigin: 'Yiwu / Kigali Central Warehouse',
    shippingTimeDays: '1 - 2 Days',
    specifications: {
      'Rated Output': '3200W (Max 3500W Peak Surge)',
      'Waveform': 'Pure Sine Wave (<2.5% THD)',
      'Fuel Tank': '8.5L with Eco-Throttle Economy Mode',
      'Noise Level': '58 dBA at 7 meters distance',
      'Starting': 'Electric Key Start + Recoil Backup'
    },
    createdAt: new Date().toISOString(),
  });

  products.push({
    id: 'PRD-004',
    businessId: 'BIZ-001',
    sellerName: 'Bonfils Official Store',
    isOfficial: true,
    title: 'Bonfils International Freight Air Shipping Credit Coupon ($100)',
    description: 'Direct procurement credit for consolidated air cargo from Guangzhou / Yiwu to Kigali. Guaranteed 7-10 business days delivery with full customs handling.',
    category: 'Shipping & Freight',
    brand: 'Bonfils Logistics',
    price: 95.00,
    originalPrice: 100.00,
    stock: 999,
    images: ['/src/assets/images/hero_logistics_marketplace_1790334780179.jpg'],
    rating: 5.0,
    reviewsCount: 310,
    salesCount: 1450,
    shippingOrigin: 'China to Rwanda Express',
    shippingTimeDays: 'Instant Digital Voucher',
    specifications: {
      'Service': 'Air Freight per Kilogram Offset',
      'Origin Hub': 'Guangzhou Baiyun / Yiwu Cargo Terminal',
      'Destination': 'Kigali International Airport Cargo Terminal',
      'Customs': 'Inclusive of Rwanda Customs Clearance'
    },
    createdAt: new Date().toISOString(),
  });

  products.push({
    id: 'PRD-005',
    businessId: 'BIZ-001',
    sellerName: 'Bonfils Official Store',
    isOfficial: true,
    title: 'Industrial Heavy Duty Solar Power Inverter 5KVA Hybrid',
    description: 'Official Bonfils certified hybrid solar power inverter with MPPT solar charge controller, dual AC output, and Wi-Fi monitoring module.',
    category: 'Industrial & Hardware',
    brand: 'Bonfils Energy',
    price: 380.00,
    originalPrice: 460.00,
    stock: 35,
    images: ['/src/assets/images/product_industrial_generator_1790334833001.jpg'],
    rating: 4.9,
    reviewsCount: 88,
    salesCount: 220,
    shippingOrigin: 'Guangzhou Direct Hub',
    shippingTimeDays: '2 - 3 Days',
    specifications: {
      'Capacity': '5000VA / 5000W Pure Sine',
      'Solar Input': '500VDC Max MPPT Voltage',
      'Battery Type': 'Lithium Iron Phosphate / Lead-Acid Compatible',
      'Warranty': '2 Years Official Bonfils Warranty'
    },
    createdAt: new Date().toISOString(),
  });

  products.push({
    id: 'PRD-006',
    businessId: 'BIZ-002',
    sellerName: 'URUKUNDO SHOP',
    isOfficial: false,
    title: 'Solar-Powered 4G LTE Outdoor Security Camera with Pan/Tilt',
    description: 'Operates 100% wire-free with built-in solar charging panel and SIM card slot for areas without Wi-Fi or mains electricity.',
    category: 'Security & Surveillance',
    brand: 'SunCam 4G',
    price: 68.00,
    originalPrice: 90.00,
    stock: 45,
    images: ['/src/assets/images/product_cctv_camera_1790334796559.jpg'],
    rating: 4.8,
    reviewsCount: 52,
    salesCount: 180,
    shippingOrigin: 'Kigali Local Warehouse',
    shippingTimeDays: '1 Day',
    specifications: {
      'Network': '4G Micro SIM Card (All Networks)',
      'Solar Panel': '8W Monocrystalline with 15000mAh Battery',
      'Motion Detection': 'PIR Radar Humanoid Dual Detection',
      'Storage': 'MicroSD card included'
    },
    createdAt: new Date().toISOString(),
  });

  // Sample China Request 1 (Quotation Pending Customer Approval)
  const chinaReq1: ChinaRequest = {
    id: 'CR-001',
    requestNumber: 'BFS-CHINA-2026-000125',
    userId: 'USR-BUYER-001',
    productName: 'Commercial Automatic Coffee Espresso Machine with Dual Boilers',
    description: 'Italian commercial group heads, stainless steel dual boilers, rotary pump, 220V 50Hz, designed for busy cafe with 200 cups/hour capacity.',
    category: 'Commercial Kitchen & Cafe',
    quantity: 2,
    preferredBrand: 'Factory Direct OEM or Sanremo style',
    modelNumber: 'CM-PRO-900',
    color: 'Matte Black & Mirror Chrome',
    estimatedBudget: 1200,
    images: ['/src/assets/images/product_industrial_generator_1790334833001.jpg'],
    referenceUrl: 'https://1688.com/offer/commercial-espresso-machine',
    customerName: 'Aline Uwase',
    customerEmail: 'buyer@bonfilsstore.com',
    customerPhone: '+250788777888',
    whatsapp: '+250788777888',
    country: 'Rwanda',
    city: 'Kigali',
    deliveryAddress: 'Nyarutarama KG 9 Ave, House 14',
    preferredContactMethod: 'whatsapp',
    shippingMethod: 'air',
    maxWaitingTime: '15_days',
    preferredDeliveryPeriod: 'Before month end',
    urgency: 'urgent',
    destination: 'Kigali Airport Cargo Hub',
    status: 'CUSTOMER_CONFIRMATION',
    assignedStaffId: 'USR-STAFF-001',
    assignedStaffName: 'Jean Claude (Sourcing Team)',
    quotation: {
      id: 'QUO-001',
      requestId: 'CR-001',
      productCost: 850.00,
      chinaLocalShipping: 35.00,
      internationalShipping: 240.00,
      serviceFee: 65.00,
      total: 1190.00,
      currency: 'USD',
      notes: 'Sourced from verified ISO-certified manufacturer in Foshan, Guangdong. Includes English manual, spare gasket kit, and 12-month factory parts warranty.',
      validUntil: '2026-10-15',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    statusHistory: [
      { status: 'REQUEST_RECEIVED', note: 'Request registered in system.', updatedBy: 'System', timestamp: new Date(Date.now() - 86400000 * 2).toISOString() },
      { status: 'UNDER_REVIEW', note: 'Assigned to procurement team in Foshan.', updatedBy: 'Jean Claude', timestamp: new Date(Date.now() - 86400000 * 1.5).toISOString() },
      { status: 'SUPPLIER_FOUND', note: 'Tier 1 commercial espresso factory verified with CE certification.', updatedBy: 'Jean Claude', timestamp: new Date(Date.now() - 86400000).toISOString() },
      { status: 'CUSTOMER_CONFIRMATION', note: 'Official quotation generated and sent to customer.', updatedBy: 'Jean Claude', timestamp: new Date().toISOString() },
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  chinaRequests.push(chinaReq1);

  // Sample China Request 2 (In Transit with Live Shipping Tracking)
  const chinaReq2: ChinaRequest = {
    id: 'CR-002',
    requestNumber: 'BFS-CHINA-2026-000108',
    userId: 'USR-BUYER-001',
    productName: 'Heavy Duty Electric Pallet Jack 2.5 Ton with Lithium Battery',
    description: 'Compact warehouse electric pallet truck with quick charge 48V lithium battery and ergonomic control handle.',
    category: 'Industrial Machinery',
    quantity: 1,
    estimatedBudget: 2100,
    images: ['/src/assets/images/hero_logistics_marketplace_1790334780179.jpg'],
    customerName: 'Aline Uwase',
    customerEmail: 'buyer@bonfilsstore.com',
    customerPhone: '+250788777888',
    country: 'Rwanda',
    city: 'Kigali',
    deliveryAddress: 'Gikondo Industrial Park, Plot 45',
    preferredContactMethod: 'email',
    shippingMethod: 'sea',
    maxWaitingTime: '45_days',
    urgency: 'normal',
    destination: 'Magerwa Kigali Inland Port',
    status: 'IN_TRANSIT',
    carrier: 'Bonfils Global Ocean Freight (COSCO Line)',
    trackingNumber: 'BFS-TRK-789214',
    assignedStaffId: 'USR-STAFF-001',
    assignedStaffName: 'Jean Claude (Sourcing Team)',
    statusHistory: [
      { status: 'REQUEST_RECEIVED', note: 'Request initiated.', updatedBy: 'System', timestamp: new Date(Date.now() - 86400000 * 25).toISOString() },
      { status: 'PURCHASED', note: 'Factory payment completed in Ningbo.', updatedBy: 'Jean Claude', timestamp: new Date(Date.now() - 86400000 * 18).toISOString() },
      { status: 'SHIPPING', note: 'Container loaded at Ningbo Port.', updatedBy: 'Jean Claude', timestamp: new Date(Date.now() - 86400000 * 12).toISOString() },
      { status: 'IN_TRANSIT', note: 'Vessel en route from Mombasa corridor to Kigali customs.', updatedBy: 'Jean Claude', timestamp: new Date().toISOString() },
    ],
    createdAt: new Date(Date.now() - 86400000 * 25).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  chinaRequests.push(chinaReq2);

  // Shipping Order Tracking data for BFS-TRK-789214
  shippingOrders.push({
    id: 'SHP-001',
    trackingNumber: 'BFS-TRK-789214',
    carrier: 'Bonfils Global Ocean Freight (COSCO Line)',
    method: 'sea',
    origin: 'Ningbo Port, Zhejiang, China',
    destination: 'Kigali Central Cargo Port, Rwanda',
    recipientName: 'Aline Uwase',
    recipientPhone: '+250788777888',
    currentStage: 3, // International Shipping / Sea transit
    estimatedDelivery: '2026-10-18',
    status: 'in_transit',
    checkpoints: [
      { title: 'China Supplier Handover', location: 'Ningbo Machinery Factory, China', description: 'Cargo picked up and inspected by Bonfils China QC team.', date: '2026-09-02', completed: true },
      { title: 'China Consolidation Warehouse', location: 'Bonfils Ningbo Hub Bay 4', description: 'Export clearance completed and packed into 40ft container.', date: '2026-09-08', completed: true },
      { title: 'International Shipping & Sea Transit', location: 'Indian Ocean Transit to Mombasa', description: 'Vessel in transit; bills of lading processed.', date: '2026-09-15', completed: true },
      { title: 'Destination Port & Customs Clearance', location: 'Mombasa / Kigali Inland Port', description: 'Awaiting container berthing and customs entry inspection.', date: 'Expected 2026-10-12', completed: false },
      { title: 'Final Mile Delivery to Customer', location: 'Kigali, Rwanda', description: 'Direct truck dispatch to customer designated warehouse.', date: 'Expected 2026-10-18', completed: false }
    ]
  });

  // Sample Multi-Seller Order
  orders.push({
    id: 'ORD-2026-0041',
    orderNumber: 'BFS-ORD-2026-0041',
    customerId: 'USR-BUYER-001',
    customerName: 'Aline Uwase',
    customerEmail: 'buyer@bonfilsstore.com',
    customerPhone: '+250788777888',
    subtotal: 106.00,
    shippingFee: 5.00,
    total: 111.00,
    status: 'processing',
    shippingAddress: {
      fullName: 'Aline Uwase',
      phone: '+250788777888',
      street: 'KG 9 Ave, Nyarutarama',
      city: 'Kigali',
      country: 'Rwanda',
      notes: 'Call before delivery',
    },
    paymentMethod: 'mobile_money',
    paymentStatus: 'paid',
    items: [
      {
        id: 'ITM-01',
        productId: 'PRD-001',
        productTitle: 'Smart 4K PTZ Dual-Antenna Wireless CCTV Camera',
        productImage: '/src/assets/images/product_cctv_camera_1790334796559.jpg',
        businessId: 'BIZ-002',
        sellerName: 'URUKUNDO SHOP',
        price: 38.00,
        quantity: 1,
        status: 'processing',
        trackingNumber: 'LOC-KGL-9981'
      },
      {
        id: 'ITM-02',
        productId: 'PRD-006',
        productTitle: 'Solar-Powered 4G LTE Outdoor Security Camera',
        productImage: '/src/assets/images/product_cctv_camera_1790334796559.jpg',
        businessId: 'BIZ-002',
        sellerName: 'URUKUNDO SHOP',
        price: 68.00,
        quantity: 1,
        status: 'processing'
      }
    ],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  logActivity('SYSTEM', 'System Initializer', 'system', 'INITIALIZE', 'user', 'Bonfils Store pre-configured with multi-vendor catalogs, demo accounts, and China sourcing workflows.');
}

seedDatabase();

// Auth Middleware
function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return next();
  }

  const user = users.find(u => u.id === session.userId && u.status === 'active');
  if (user) {
    (req as any).user = user;
    (req as any).session = session;
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

function requireRole(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: UserRecord = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!user.roles.includes(requiredRole as any) && !user.roles.includes('super_admin')) {
      return res.status(403).json({ error: `Forbidden. You do not have the required '${requiredRole}' permission.` });
    }
    next();
  };
}

app.use(authenticateToken);

// ==========================================
// 1. AUTHENTICATION & OTP ENDPOINTS
// ==========================================

// Register (Customer / Seller / Both)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, password, confirmPassword, country, city, accountType, acceptTerms } = req.body;

    if (!name || !email || !phone || !password || !confirmPassword || !country || !city || !accountType) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!acceptTerms) {
      return res.status(400).json({ error: 'You must accept the Terms and Conditions.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalized)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const existingUser = users.find(u => u.email.toLowerCase() === emailNormalized);
    if (existingUser && existingUser.isVerified) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
    }

    // Determine roles based on selection
    const roles: User['roles'] = [];
    if (accountType === 'customer') roles.push('customer');
    else if (accountType === 'seller') roles.push('seller');
    else if (accountType === 'both') roles.push('customer', 'seller');
    else roles.push('customer');

    // Hash password
    const { hash, salt } = hashPassword(password);

    let userId: string;
    let businessId: string | undefined;

    if (existingUser && !existingUser.isVerified) {
      // Re-use pending registration
      userId = existingUser.id;
      existingUser.name = name;
      existingUser.phone = phone;
      existingUser.country = country;
      existingUser.city = city;
      existingUser.accountType = accountType;
      existingUser.roles = roles;
      existingUser.passwordHash = hash;
      existingUser.passwordSalt = salt;
      businessId = existingUser.businessId;
    } else {
      userId = `USR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (roles.includes('seller')) {
        businessId = `BIZ-${Date.now()}`;
        businesses.push({
          id: businessId,
          ownerId: userId,
          name: `${name}'s Shop`,
          type: 'external',
          description: `Direct marketplace store managed by ${name}.`,
          phone,
          email: emailNormalized,
          country,
          city,
          rating: 5.0,
          reviewsCount: 0,
          totalProducts: 0,
          totalSales: 0,
          isVerified: false,
          status: 'active',
          shippingTerms: 'Standard delivery in 1-3 business days.',
          createdAt: new Date().toISOString(),
        });
      }

      const newUser: UserRecord = {
        id: userId,
        name,
        email: emailNormalized,
        phone,
        country,
        city,
        roles,
        accountType,
        isVerified: false, // NOT activated until OTP is verified!
        status: 'active',
        businessId,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
    }

    // Generate Secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
    const now = Date.now();

    // Expire old registration OTPs for this email
    for (const record of otps) {
      if (record.email === emailNormalized && record.purpose === 'registration') {
        record.expiresAt = 0;
      }
    }

    const otpRecord: OTPRecord = {
      id: `OTP-${Date.now()}`,
      email: emailNormalized,
      purpose: 'registration',
      otpCode,
      otpHash,
      expiresAt: now + (5 * 60 * 1000), // 5 minutes
      attempts: 0,
      maxAttempts: 5,
      resendAvailableAt: now + (45 * 1000), // 45 seconds cooldown
      createdAt: now,
      payload: { userId },
    };
    otps.push(otpRecord);

    // Send Real Transactional Email with template
    await sendTransactionalEmail({
      to: emailNormalized,
      subject: 'BONFILS STORE - Verify Your Email',
      purpose: 'registration_otp',
      otpCode,
      html: generateOTPEmailTemplate(otpCode, 'Verify Your Email Address', name),
    });

    logActivity(userId, name, 'user', 'REGISTER_INITIATED', 'auth', `Registration initiated for ${emailNormalized}. OTP sent.`);

    return res.status(200).json({
      success: true,
      message: 'Account created! Please enter the 6-digit verification code sent to your email.',
      email: emailNormalized,
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error during registration.' });
  }
});

// Verify Registration OTP
app.post('/api/auth/verify-registration-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    const otpRecord = otps
      .filter(o => o.email === emailNormalized && o.purpose === 'registration')
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active verification code found for this email. Please request a new code.' });
    }

    if (Date.now() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a fresh verification code.' });
    }

    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (codeHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      const remaining = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(400).json({
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new code.'}`,
      });
    }

    // Mark OTP as verified and single-use
    otpRecord.verifiedAt = Date.now();
    otpRecord.expiresAt = 0;

    // Activate User
    const user = users.find(u => u.email.toLowerCase() === emailNormalized);
    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    user.isVerified = true;
    user.status = 'active';

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
      userId: user.id,
      role: user.roles[0],
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    });

    logActivity(user.id, user.name, user.roles.join(','), 'EMAIL_VERIFIED', 'auth', `Email verified and account activated for ${user.email}.`);

    // In-app welcome notification
    createNotification(user.id, 'Welcome to BONFILS STORE!', 'Your account has been verified successfully. Start shopping or manage your store today.', 'system');

    // Return sanitized user object
    const { passwordHash, passwordSalt, ...safeUser } = user;
    return res.status(200).json({
      success: true,
      message: 'Email Verified Successfully! Welcome to BONFILS STORE.',
      user: safeUser,
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error verifying OTP.' });
  }
});

// Login - Step 1: Validate Credentials & Issue Email OTP
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === emailNormalized);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'This account has been disabled. Please contact support.' });
    }

    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isVerified) {
      // If unverified, guide them to registration OTP flow
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
      const now = Date.now();

      otps.push({
        id: `OTP-${Date.now()}`,
        email: emailNormalized,
        purpose: 'registration',
        otpCode,
        otpHash,
        expiresAt: now + (5 * 60 * 1000),
        attempts: 0,
        maxAttempts: 5,
        resendAvailableAt: now + (45 * 1000),
        createdAt: now,
      });

      await sendTransactionalEmail({
        to: emailNormalized,
        subject: 'BONFILS STORE - Verify Your Email',
        purpose: 'registration_otp',
        otpCode,
        html: generateOTPEmailTemplate(otpCode, 'Complete Your Email Verification', user.name),
      });

      return res.status(403).json({
        error: 'Your email is not verified yet. We have resent a verification code to your email.',
        unverified: true,
        email: emailNormalized,
      });
    }

    // Generate Login OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
    const now = Date.now();

    // Invalidate prior login OTPs for this user
    for (const record of otps) {
      if (record.email === emailNormalized && record.purpose === 'login') {
        record.expiresAt = 0;
      }
    }

    otps.push({
      id: `OTP-${Date.now()}`,
      email: emailNormalized,
      purpose: 'login',
      otpCode,
      otpHash,
      expiresAt: now + (5 * 60 * 1000), // 5 min
      attempts: 0,
      maxAttempts: 5,
      resendAvailableAt: now + (45 * 1000),
      createdAt: now,
      payload: { userId: user.id },
    });

    // Masked email for UI display (e.g. u***@gmail.com)
    const [namePart, domainPart] = emailNormalized.split('@');
    const maskedEmail = `${namePart.charAt(0)}***@${domainPart}`;

    await sendTransactionalEmail({
      to: emailNormalized,
      subject: 'BONFILS STORE - Verify Your Login',
      purpose: 'login_otp',
      otpCode,
      html: generateOTPEmailTemplate(otpCode, 'Login Verification Code', user.name),
    });

    logActivity(user.id, user.name, user.roles.join(','), 'LOGIN_OTP_SENT', 'auth', `Login OTP dispatched to ${emailNormalized}.`);

    return res.status(200).json({
      success: true,
      requireOtp: true,
      email: emailNormalized,
      maskedEmail,
      message: `We sent a verification code to ${maskedEmail}`,
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login error.' });
  }
});

// Login - Step 2: Verify Login OTP
app.post('/api/auth/verify-login-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    const otpRecord = otps
      .filter(o => o.email === emailNormalized && o.purpose === 'login')
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active login OTP found. Please log in again.' });
    }

    if (Date.now() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'Verification code has expired. Please log in again.' });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please log in again.' });
    }

    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (codeHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      const remaining = otpRecord.maxAttempts - otpRecord.attempts;
      return res.status(400).json({
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new code.'}`,
      });
    }

    otpRecord.verifiedAt = Date.now();
    otpRecord.expiresAt = 0;

    const user = users.find(u => u.email.toLowerCase() === emailNormalized);
    if (!user || user.status === 'disabled') {
      return res.status(403).json({ error: 'User account disabled or not found.' });
    }

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
      userId: user.id,
      role: user.roles[0],
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000),
    });

    logActivity(user.id, user.name, user.roles.join(','), 'USER_LOGIN', 'auth', `Successful OTP login for ${user.email}.`);

    const { passwordHash, passwordSalt, ...safeUser } = user;
    return res.status(200).json({
      success: true,
      message: 'Login Successful! Welcome back.',
      user: safeUser,
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error completing login.' });
  }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) {
      return res.status(400).json({ error: 'Email and purpose are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === emailNormalized);

    const lastOtp = otps
      .filter(o => o.email === emailNormalized && o.purpose === purpose)
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    const now = Date.now();
    if (lastOtp && now < lastOtp.resendAvailableAt) {
      const waitSeconds = Math.ceil((lastOtp.resendAvailableAt - now) / 1000);
      return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting a new code.` });
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    otps.push({
      id: `OTP-${Date.now()}`,
      email: emailNormalized,
      purpose,
      otpCode,
      otpHash,
      expiresAt: now + (5 * 60 * 1000),
      attempts: 0,
      maxAttempts: 5,
      resendAvailableAt: now + (45 * 1000),
      createdAt: now,
    });

    let subject = 'BONFILS STORE Verification Code';
    let heading = 'Verification Code';
    if (purpose === 'registration') {
      subject = 'BONFILS STORE - Verify Your Email';
      heading = 'Verify Your Email Address';
    } else if (purpose === 'login') {
      subject = 'BONFILS STORE - Verify Your Login';
      heading = 'Login Verification Code';
    } else if (purpose === 'admin_login') {
      subject = 'BONFILS STORE - Super Admin Security Verification';
      heading = 'Super Admin Access Code';
    } else if (purpose === 'password_reset') {
      subject = 'BONFILS STORE - Password Reset Code';
      heading = 'Password Reset Code';
    }

    await sendTransactionalEmail({
      to: emailNormalized,
      subject,
      purpose: `${purpose}_otp` as any,
      otpCode,
      html: generateOTPEmailTemplate(otpCode, heading, user?.name || 'Customer'),
    });

    return res.status(200).json({
      success: true,
      message: 'New verification code sent to your email.',
      expiresInSeconds: 300,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error resending OTP.' });
  }
});

// Forgot Password - Step 1: Send OTP
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const user = users.find(u => u.email.toLowerCase() === emailNormalized);

    // If user exists, send OTP; otherwise avoid user enumeration
    if (user && user.status === 'active') {
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
      const now = Date.now();

      otps.push({
        id: `OTP-${Date.now()}`,
        email: emailNormalized,
        purpose: 'password_reset',
        otpCode,
        otpHash,
        expiresAt: now + (5 * 60 * 1000),
        attempts: 0,
        maxAttempts: 5,
        resendAvailableAt: now + (45 * 1000),
        createdAt: now,
      });

      await sendTransactionalEmail({
        to: emailNormalized,
        subject: 'BONFILS STORE - Password Reset Code',
        purpose: 'password_reset_otp',
        otpCode,
        html: generateOTPEmailTemplate(otpCode, 'Password Reset Code', user.name),
      });
    }

    return res.status(200).json({
      success: true,
      email: emailNormalized,
      message: 'If an account exists with this email, a reset verification code has been dispatched.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error in forgot password.' });
  }
});

// Reset Password - Step 2: Verify OTP and Set New Password
app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;
    if (!email || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    const otpRecord = otps
      .filter(o => o.email === emailNormalized && o.purpose === 'password_reset')
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!otpRecord || Date.now() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'Verification code is invalid or has expired.' });
    }

    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (codeHash !== otpRecord.otpHash) {
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }

    const user = users.find(u => u.email.toLowerCase() === emailNormalized);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Update password
    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    otpRecord.expiresAt = 0; // invalidate OTP

    logActivity(user.id, user.name, user.roles.join(','), 'PASSWORD_RESET', 'auth', `Password reset successfully for ${emailNormalized}.`);

    return res.status(200).json({
      success: true,
      message: 'Password Updated Successfully! Please sign in with your new password.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error resetting password.' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const { passwordHash, passwordSalt, ...safeUser } = user;
  let userBusiness: Business | undefined;
  if (user.businessId) {
    userBusiness = businesses.find(b => b.id === user.businessId);
  }
  return res.status(200).json({ user: safeUser, business: userBusiness });
});

// Update Profile
app.put('/api/auth/profile', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const { name, phone, country, city } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (country) user.country = country;
  if (city) user.city = city;

  const { passwordHash, passwordSalt, ...safeUser } = user;
  return res.status(200).json({ success: true, user: safeUser });
});

// Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    sessions.delete(token);
  }
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// ==========================================
// 2. SUPER ADMIN AUTHENTICATION (PROTECTED)
// ==========================================

// Super Admin Login - Step 1: Verify Admin Credentials & Send Admin OTP
app.post('/api/admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Admin credentials required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const admin = users.find(u => u.email.toLowerCase() === emailNormalized);

    // Enforce real Super Admin authorization: Non-admins get strictly rejected!
    if (!admin || !admin.roles.includes('super_admin')) {
      return res.status(403).json({ error: 'Access denied. You do not have Super Admin authorization.' });
    }

    if (admin.status === 'disabled') {
      return res.status(403).json({ error: 'Admin account is suspended.' });
    }

    const isValid = verifyPassword(password, admin.passwordHash, admin.passwordSalt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    // Generate High-Security Admin OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
    const now = Date.now();

    for (const record of otps) {
      if (record.email === emailNormalized && record.purpose === 'admin_login') {
        record.expiresAt = 0;
      }
    }

    otps.push({
      id: `OTP-${Date.now()}`,
      email: emailNormalized,
      purpose: 'admin_login',
      otpCode,
      otpHash,
      expiresAt: now + (5 * 60 * 1000), // 5 min
      attempts: 0,
      maxAttempts: 3, // Stronger brute-force cap for Admin
      resendAvailableAt: now + (45 * 1000),
      createdAt: now,
      payload: { userId: admin.id },
    });

    const [namePart, domainPart] = emailNormalized.split('@');
    const maskedEmail = `${namePart.charAt(0)}***@${domainPart}`;

    await sendTransactionalEmail({
      to: emailNormalized,
      subject: 'BONFILS STORE - Super Admin Security Verification',
      purpose: 'admin_otp',
      otpCode,
      html: generateOTPEmailTemplate(otpCode, 'Super Admin Access Verification', admin.name),
    });

    logActivity(admin.id, admin.name, 'super_admin', 'ADMIN_LOGIN_CHALLENGE', 'auth', `Admin 2FA OTP dispatched to ${emailNormalized}.`);

    return res.status(200).json({
      success: true,
      requireOtp: true,
      email: emailNormalized,
      maskedEmail,
      message: `Security code sent to admin address: ${maskedEmail}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Super Admin login error.' });
  }
});

// Super Admin Login - Step 2: Verify Admin OTP
app.post('/api/admin/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    const otpRecord = otps
      .filter(o => o.email === emailNormalized && o.purpose === 'admin_login')
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (!otpRecord) {
      return res.status(400).json({ error: 'No active admin verification session. Please log in again.' });
    }

    if (Date.now() > otpRecord.expiresAt) {
      return res.status(400).json({ error: 'Admin OTP has expired. Please log in again.' });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      return res.status(429).json({ error: 'Too many failed admin verification attempts. Access locked.' });
    }

    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    if (codeHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      return res.status(400).json({ error: 'Incorrect admin verification code.' });
    }

    otpRecord.verifiedAt = Date.now();
    otpRecord.expiresAt = 0;

    const admin = users.find(u => u.email.toLowerCase() === emailNormalized);
    if (!admin || !admin.roles.includes('super_admin')) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
      userId: admin.id,
      role: 'super_admin',
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours for admin
    });

    logActivity(admin.id, admin.name, 'super_admin', 'ADMIN_LOGIN_SUCCESS', 'auth', `Super Admin logged into control console.`);

    const { passwordHash, passwordSalt, ...safeAdmin } = admin;
    return res.status(200).json({
      success: true,
      message: 'Super Admin Access Granted.',
      user: safeAdmin,
      token,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Admin verification error.' });
  }
});

// ==========================================
// 3. PRODUCTS & MARKETPLACE (PUBLIC)
// ==========================================

// Get All Products (Filter, Search, Sort)
app.get('/api/products', (req: Request, res: Response) => {
  let results = [...products];
  const { search, category, sellerId, minPrice, maxPrice, brand, sort } = req.query;

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    results = results.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.sellerName.toLowerCase().includes(q)
    );
  }

  if (category && typeof category === 'string' && category !== 'All') {
    results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (sellerId && typeof sellerId === 'string') {
    results = results.filter(p => p.businessId === sellerId);
  }

  if (brand && typeof brand === 'string') {
    results = results.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
  }

  if (minPrice) {
    results = results.filter(p => p.price >= parseFloat(minPrice as string));
  }
  if (maxPrice) {
    results = results.filter(p => p.price <= parseFloat(maxPrice as string));
  }

  if (sort === 'price_asc') {
    results.sort((a, b) => a.price - b.price);
  } else if (sort === 'price_desc') {
    results.sort((a, b) => b.price - a.price);
  } else if (sort === 'popular') {
    results.sort((a, b) => b.salesCount - a.salesCount);
  } else {
    // Default newest
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return res.status(200).json({ products: results, total: results.length });
});

// Get Single Product
app.get('/api/products/:id', (req: Request, res: Response) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  const business = businesses.find(b => b.id === product.businessId);
  return res.status(200).json({ product, business });
});

// Get Categories Taxonomy
app.get('/api/categories', (req: Request, res: Response) => {
  const categoryCounts: Record<string, number> = {};
  for (const p of products) {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }
  const categories = Object.keys(categoryCounts).map(name => ({
    name,
    count: categoryCounts[name],
  }));
  return res.status(200).json({ categories });
});

// Get Sellers / Shops
app.get('/api/sellers', (req: Request, res: Response) => {
  return res.status(200).json({ businesses });
});

app.get('/api/sellers/:id', (req: Request, res: Response) => {
  const business = businesses.find(b => b.id === req.params.id);
  if (!business) {
    return res.status(404).json({ error: 'Shop not found.' });
  }
  const sellerProducts = products.filter(p => p.businessId === business.id);
  return res.status(200).json({ business, products: sellerProducts });
});

// ==========================================
// 4. ORDERS & MULTI-SELLER CHECKOUT
// ==========================================

// Create Multi-Seller Order
app.post('/api/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const user: UserRecord = (req as any).user;
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.city || !shippingAddress.street) {
      return res.status(400).json({ error: 'Complete shipping address is required.' });
    }

    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found.` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.title}.` });
      }

      product.stock -= item.quantity;
      product.salesCount += item.quantity;

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        id: `ITM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: product.id,
        productTitle: product.title,
        productImage: product.images[0] || '',
        businessId: product.businessId,
        sellerName: product.sellerName,
        price: product.price,
        quantity: item.quantity,
        status: 'pending',
      });
    }

    const shippingFee = subtotal > 100 ? 0 : 5; // Free shipping threshold
    const total = subtotal + shippingFee;

    const orderNumber = `BFS-ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      orderNumber,
      customerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone,
      items: orderItems,
      subtotal,
      shippingFee,
      total,
      status: 'processing',
      shippingAddress,
      paymentMethod: paymentMethod || 'mobile_money',
      paymentStatus: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);

    // Send Order Confirmation Email
    await sendTransactionalEmail({
      to: user.email,
      subject: `BONFILS STORE - Order Confirmed (${orderNumber})`,
      purpose: 'order_confirmation',
      html: `
        <div style="font-family: sans-serif; padding: 20px; background: #fff; max-width: 580px; margin: 0 auto; border: 1px solid #E5E5E5; border-radius: 8px;">
          <h2 style="color: #FF6A00;">Order Confirmed!</h2>
          <p>Thank you for shopping on BONFILS STORE, <strong>${user.name}</strong>.</p>
          <p>Order Number: <strong>${orderNumber}</strong></p>
          <p>Total: <strong>$${total.toFixed(2)}</strong></p>
          <p>Our sellers are packaging your items for prompt dispatch.</p>
        </div>
      `,
    });

    createNotification(user.id, `Order ${orderNumber} Confirmed`, `Your payment of $${total.toFixed(2)} was received. Sellers are packaging your order.`, 'order');

    logActivity(user.id, user.name, 'customer', 'ORDER_CREATED', 'order', `Order ${orderNumber} placed for $${total.toFixed(2)}.`, newOrder.id);

    return res.status(201).json({ success: true, order: newOrder });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error processing order.' });
  }
});

// List Customer Orders
app.get('/api/orders', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const userOrders = orders.filter(o => o.customerId === user.id);
  return res.status(200).json({ orders: userOrders });
});

// Get Order Details
app.get('/api/orders/:id', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const order = orders.find(o => o.id === req.params.id || o.orderNumber === req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  // Check authorization: customer, staff, admin, or seller containing items
  const isOwner = order.customerId === user.id;
  const isAdmin = user.roles.includes('super_admin') || user.roles.includes('staff');
  const isSellerOfItem = user.businessId && order.items.some(i => i.businessId === user.businessId);

  if (!isOwner && !isAdmin && !isSellerOfItem) {
    return res.status(403).json({ error: 'Unauthorized to view this order.' });
  }

  return res.status(200).json({ order });
});

// ==========================================
// 5. CHINA PRODUCT SOURCING SERVICE
// ==========================================

// Submit China Product Request
app.post('/api/china-requests', async (req: Request, res: Response) => {
  try {
    const user: UserRecord | undefined = (req as any).user;
    const {
      productName, description, category, quantity, preferredBrand,
      modelNumber, color, size, specifications, estimatedBudget,
      images, referenceUrl, customerName, customerEmail, customerPhone,
      whatsapp, country, city, deliveryAddress, preferredContactMethod,
      shippingMethod, maxWaitingTime, preferredDeliveryPeriod, urgency,
      destination, instructions
    } = req.body;

    if (!productName || !description || !quantity || !customerName || !customerEmail || !customerPhone || !country || !city || !deliveryAddress) {
      return res.status(400).json({ error: 'Please fill in all mandatory product and customer contact fields.' });
    }

    const emailNormalized = customerEmail.trim().toLowerCase();
    // Unique Request ID format: BFS-CHINA-2026-XXXXXX
    const count = chinaRequests.length + 126;
    const requestNumber = `BFS-CHINA-${new Date().getFullYear()}-${String(count).padStart(6, '0')}`;

    const newRequest: ChinaRequest = {
      id: `CR-${Date.now()}`,
      requestNumber,
      userId: user?.id,
      productName,
      description,
      category: category || 'General Merchandise',
      quantity: parseInt(quantity, 10) || 1,
      preferredBrand,
      modelNumber,
      color,
      size,
      specifications,
      estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : undefined,
      images: Array.isArray(images) && images.length > 0 ? images : ['/src/assets/images/hero_logistics_marketplace_1790334780179.jpg'],
      referenceUrl,
      customerName,
      customerEmail: emailNormalized,
      customerPhone,
      whatsapp,
      country,
      city,
      deliveryAddress,
      preferredContactMethod: preferredContactMethod || 'whatsapp',
      shippingMethod: shippingMethod || 'air',
      maxWaitingTime: maxWaitingTime || '30_days',
      preferredDeliveryPeriod,
      urgency: urgency || 'normal',
      destination: destination || `${city}, ${country}`,
      instructions,
      status: 'REQUEST_RECEIVED',
      statusHistory: [
        {
          status: 'REQUEST_RECEIVED',
          note: 'Request received and placed into the procurement intake queue.',
          updatedBy: 'System',
          timestamp: new Date().toISOString(),
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    chinaRequests.unshift(newRequest);

    // Send Automatic Email Confirmation
    await sendTransactionalEmail({
      to: emailNormalized,
      subject: `BONFILS STORE - China Product Request Received (${requestNumber})`,
      purpose: 'china_request',
      html: generateChinaRequestEmailTemplate(newRequest),
    });

    if (user) {
      createNotification(
        user.id,
        `China Request Received: ${requestNumber}`,
        `We have received your sourcing request for "${productName}". Our team in China will prepare a quotation shortly.`,
        'china_request',
        `/china-sourcing/${newRequest.id}`
      );
    }

    logActivity(user?.id || 'GUEST', customerName, 'customer', 'CHINA_REQUEST_SUBMITTED', 'china_request', `Request ${requestNumber} submitted for ${productName} (Qty: ${quantity}).`, newRequest.id);

    return res.status(201).json({
      success: true,
      request: newRequest,
      message: 'Request Submitted Successfully!',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error submitting China request.' });
  }
});

// List Customer China Requests
app.get('/api/china-requests', (req: Request, res: Response) => {
  const user: UserRecord | undefined = (req as any).user;
  const { email } = req.query;

  if (user && (user.roles.includes('super_admin') || user.roles.includes('staff'))) {
    return res.status(200).json({ requests: chinaRequests });
  }

  if (user) {
    const list = chinaRequests.filter(r => r.userId === user.id || r.customerEmail.toLowerCase() === user.email.toLowerCase());
    return res.status(200).json({ requests: list });
  }

  if (email && typeof email === 'string') {
    const list = chinaRequests.filter(r => r.customerEmail.toLowerCase() === email.toLowerCase());
    return res.status(200).json({ requests: list });
  }

  return res.status(200).json({ requests: [] });
});

// Get Single China Request
app.get('/api/china-requests/:id', (req: Request, res: Response) => {
  const item = chinaRequests.find(r => r.id === req.params.id || r.requestNumber === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Sourcing request not found.' });
  }
  return res.status(200).json({ request: item });
});

// Prepare Quotation (Staff / Admin)
app.post('/api/china-requests/:id/quotation', requireAuth, async (req: Request, res: Response) => {
  try {
    const user: UserRecord = (req as any).user;
    if (!user.roles.includes('staff') && !user.roles.includes('super_admin')) {
      return res.status(403).json({ error: 'Only Staff or Admin can prepare quotations.' });
    }

    const item = chinaRequests.find(r => r.id === req.params.id || r.requestNumber === req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const { productCost, chinaLocalShipping, internationalShipping, serviceFee, notes, validUntil } = req.body;
    const pCost = parseFloat(productCost) || 0;
    const cShipping = parseFloat(chinaLocalShipping) || 0;
    const iShipping = parseFloat(internationalShipping) || 0;
    const sFee = parseFloat(serviceFee) || 0;
    const total = pCost + cShipping + iShipping + sFee;

    const quotation: Quotation = {
      id: `QUO-${Date.now()}`,
      requestId: item.id,
      productCost: pCost,
      chinaLocalShipping: cShipping,
      internationalShipping: iShipping,
      serviceFee: sFee,
      total,
      currency: 'USD',
      notes: notes || '',
      validUntil: validUntil || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    item.quotation = quotation;
    item.status = 'CUSTOMER_CONFIRMATION';
    item.statusHistory.unshift({
      status: 'CUSTOMER_CONFIRMATION',
      note: `Official quotation prepared ($${total.toFixed(2)}) by ${user.name}.`,
      updatedBy: user.name,
      timestamp: new Date().toISOString(),
    });
    item.updatedAt = new Date().toISOString();

    // Send Quotation Email to Customer
    await sendTransactionalEmail({
      to: item.customerEmail,
      subject: `BONFILS STORE - China Sourcing Quotation Ready (${item.requestNumber})`,
      purpose: 'quotation_ready',
      html: generateQuotationEmailTemplate(item, quotation),
    });

    if (item.userId) {
      createNotification(
        item.userId,
        `Quotation Ready: ${item.requestNumber}`,
        `Your quotation for "${item.productName}" is ready ($${total.toFixed(2)}). Please review and accept to proceed.`,
        'quotation',
        `/china-sourcing/${item.id}`
      );
    }

    logActivity(user.id, user.name, user.roles.join(','), 'QUOTATION_CREATED', 'quotation', `Quotation $${total.toFixed(2)} issued for request ${item.requestNumber}.`, item.id);

    return res.status(200).json({ success: true, quotation, request: item });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error preparing quotation.' });
  }
});

// Customer Response to Quotation (Accept / Reject)
app.post('/api/china-requests/:id/quotation/respond', async (req: Request, res: Response) => {
  try {
    const { action, notes } = req.body; // action: 'accept' | 'reject'
    const item = chinaRequests.find(r => r.id === req.params.id || r.requestNumber === req.params.id);
    if (!item || !item.quotation) {
      return res.status(404).json({ error: 'Request or quotation not found.' });
    }

    if (action === 'accept') {
      item.quotation.status = 'accepted';
      item.status = 'PAYMENT_PENDING';
      item.statusHistory.unshift({
        status: 'PAYMENT_PENDING',
        note: `Quotation accepted by customer. Ready for payment processing. ${notes ? `(${notes})` : ''}`,
        updatedBy: item.customerName,
        timestamp: new Date().toISOString(),
      });
    } else {
      item.quotation.status = 'rejected';
      item.status = 'PRICE_NEGOTIATION';
      item.statusHistory.unshift({
        status: 'PRICE_NEGOTIATION',
        note: `Customer declined quotation or requested price adjustments: ${notes || 'No reason provided'}`,
        updatedBy: item.customerName,
        timestamp: new Date().toISOString(),
      });
    }
    item.updatedAt = new Date().toISOString();

    logActivity('CUSTOMER', item.customerName, 'customer', `QUOTATION_${action.toUpperCase()}`, 'china_request', `Customer ${action}ed quotation for ${item.requestNumber}.`, item.id);

    return res.status(200).json({ success: true, request: item });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error responding to quotation.' });
  }
});

// Update China Request Status (Staff / Admin)
app.patch('/api/china-requests/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const user: UserRecord = (req as any).user;
    if (!user.roles.includes('staff') && !user.roles.includes('super_admin')) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const { status, note, carrier, trackingNumber } = req.body;
    const item = chinaRequests.find(r => r.id === req.params.id || r.requestNumber === req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    item.status = status as ChinaRequestStatus;
    if (carrier) item.carrier = carrier;
    if (trackingNumber) item.trackingNumber = trackingNumber;

    item.statusHistory.unshift({
      status: status as ChinaRequestStatus,
      note: note || `Status updated to ${status}.`,
      updatedBy: user.name,
      timestamp: new Date().toISOString(),
    });
    item.updatedAt = new Date().toISOString();

    // If milestone shipping tracking added, also register tracking order
    if (trackingNumber && !shippingOrders.find(s => s.trackingNumber === trackingNumber)) {
      shippingOrders.push({
        id: `SHP-${Date.now()}`,
        trackingNumber,
        carrier: carrier || 'Bonfils International Freight',
        method: item.shippingMethod,
        origin: 'China Sourcing Hub (Guangzhou / Yiwu)',
        destination: item.destination,
        recipientName: item.customerName,
        recipientPhone: item.customerPhone,
        currentStage: 3,
        estimatedDelivery: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
        status: 'in_transit',
        checkpoints: [
          { title: 'China Supplier Handover', location: 'Guangzhou QC Hub', description: 'Item verified and cleared factory gate.', date: new Date().toISOString().split('T')[0], completed: true },
          { title: 'China Consolidation Warehouse', location: 'Bonfils Export Hub', description: 'Consolidated into international cargo batch.', date: new Date().toISOString().split('T')[0], completed: true },
          { title: 'International Transit En Route', location: 'In Flight / Vessel', description: 'Freight departing origin hub for destination country.', date: 'Current', completed: true },
          { title: 'Destination Customs Clearance', location: item.destination, description: 'Customs declaration under review.', date: 'Pending', completed: false },
          { title: 'Delivery to Customer', location: item.deliveryAddress, description: 'Direct final mile delivery dispatch.', date: 'Pending', completed: false },
        ]
      });
    }

    // Email notification on significant milestones
    if (['PURCHASED', 'SHIPPING', 'IN_TRANSIT', 'DELIVERED'].includes(status)) {
      await sendTransactionalEmail({
        to: item.customerEmail,
        subject: `BONFILS STORE - Sourcing Update: ${status.replace('_', ' ')} (${item.requestNumber})`,
        purpose: 'shipping_update',
        html: `
          <div style="font-family: sans-serif; padding: 20px; background: #fff; max-width: 580px; margin: 0 auto; border: 1px solid #E5E5E5; border-radius: 8px;">
            <h2 style="color: #FF6A00;">Status Update: ${status.replace('_', ' ')}</h2>
            <p>Hello <strong>${item.customerName}</strong>,</p>
            <p>Your China sourcing request <strong>${item.requestNumber}</strong> ("${item.productName}") has been updated to: <strong>${status}</strong>.</p>
            ${trackingNumber ? `<p>Tracking Number: <span style="font-family: monospace; font-size: 16px; color: #FF6A00;">${trackingNumber}</span></p>` : ''}
            <p>Note: ${note || 'Your order is progressing smoothly through our international logistics pipeline.'}</p>
          </div>
        `,
      });
    }

    if (item.userId) {
      createNotification(item.userId, `Update on ${item.requestNumber}`, `Status changed to ${status}. ${note || ''}`, 'china_request', `/china-sourcing/${item.id}`);
    }

    logActivity(user.id, user.name, user.roles.join(','), 'CHINA_STATUS_UPDATE', 'china_request', `Status of ${item.requestNumber} updated to ${status}.`, item.id);

    return res.status(200).json({ success: true, request: item });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error updating status.' });
  }
});

// ==========================================
// 6. SHIPPING TRACKING SERVICE
// ==========================================

// Track Shipment by Tracking Number
app.get('/api/shipping/track/:trackingNumber', (req: Request, res: Response) => {
  const trk = req.params.trackingNumber.trim().toUpperCase();
  const shipment = shippingOrders.find(s => s.trackingNumber.toUpperCase() === trk);
  if (!shipment) {
    return res.status(404).json({ error: `No shipment found with tracking number '${trk}'.` });
  }
  return res.status(200).json({ shipment });
});

// ==========================================
// 7. SELLER DASHBOARD ENDPOINTS
// ==========================================

// Seller Profile & Metrics
app.get('/api/seller/dashboard', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  if (!user.roles.includes('seller') && !user.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'Seller account required.' });
  }

  const business = businesses.find(b => b.ownerId === user.id || b.id === user.businessId) || businesses[1];
  const sellerProducts = products.filter(p => p.businessId === business.id);

  // Find orders containing items for this seller
  const sellerOrders = orders.filter(o => o.items.some(i => i.businessId === business.id));

  // Compute revenue
  let totalRevenue = 0;
  let totalUnitsSold = 0;
  for (const o of sellerOrders) {
    for (const item of o.items) {
      if (item.businessId === business.id) {
        totalRevenue += item.price * item.quantity;
        totalUnitsSold += item.quantity;
      }
    }
  }

  return res.status(200).json({
    business,
    products: sellerProducts,
    orders: sellerOrders,
    metrics: {
      totalProducts: sellerProducts.length,
      totalOrders: sellerOrders.length,
      totalRevenue,
      totalUnitsSold,
      pendingOrders: sellerOrders.filter(o => o.status === 'processing' || o.status === 'pending').length,
    }
  });
});

// Seller Add Product
app.post('/api/seller/products', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  if (!user.roles.includes('seller') && !user.roles.includes('super_admin')) {
    return res.status(403).json({ error: 'Seller account required.' });
  }

  const business = businesses.find(b => b.ownerId === user.id || b.id === user.businessId) || businesses[1];
  const { title, description, category, brand, price, originalPrice, stock, images, specifications, shippingTimeDays } = req.body;

  if (!title || !description || !category || !price || stock === undefined) {
    return res.status(400).json({ error: 'Title, description, category, price, and stock are required.' });
  }

  const newProduct: Product = {
    id: `PRD-${Date.now()}`,
    businessId: business.id,
    sellerName: business.name,
    isOfficial: business.type === 'official',
    title,
    description,
    category,
    brand: brand || business.name,
    price: parseFloat(price),
    originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
    stock: parseInt(stock, 10),
    images: Array.isArray(images) && images.length > 0 ? images : ['/src/assets/images/product_cctv_camera_1790334796559.jpg'],
    rating: 5.0,
    reviewsCount: 0,
    salesCount: 0,
    shippingOrigin: `${business.city}, ${business.country}`,
    shippingTimeDays: shippingTimeDays || '1 - 3 Days',
    specifications: specifications || {},
    createdAt: new Date().toISOString(),
  };

  products.unshift(newProduct);
  business.totalProducts += 1;

  logActivity(user.id, user.name, 'seller', 'PRODUCT_CREATED', 'product', `Seller added product: ${newProduct.title} ($${newProduct.price}).`, newProduct.id);

  return res.status(201).json({ success: true, product: newProduct });
});

// Seller Update Product
app.put('/api/seller/products/:id', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const business = businesses.find(b => b.ownerId === user.id || b.id === user.businessId);
  const isOwner = business && product.businessId === business.id;
  const isAdmin = user.roles.includes('super_admin');

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You can only edit products belonging to your shop.' });
  }

  const { title, description, category, price, originalPrice, stock, images, specifications, shippingTimeDays } = req.body;
  if (title) product.title = title;
  if (description) product.description = description;
  if (category) product.category = category;
  if (price !== undefined) product.price = parseFloat(price);
  if (originalPrice !== undefined) product.originalPrice = parseFloat(originalPrice);
  if (stock !== undefined) product.stock = parseInt(stock, 10);
  if (Array.isArray(images)) product.images = images;
  if (specifications) product.specifications = specifications;
  if (shippingTimeDays) product.shippingTimeDays = shippingTimeDays;

  logActivity(user.id, user.name, 'seller', 'PRODUCT_UPDATED', 'product', `Updated product: ${product.title}.`, product.id);

  return res.status(200).json({ success: true, product });
});

// Seller Delete Product
app.delete('/api/seller/products/:id', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const product = products[idx];
  const business = businesses.find(b => b.ownerId === user.id || b.id === user.businessId);
  const isOwner = business && product.businessId === business.id;
  const isAdmin = user.roles.includes('super_admin');

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You can only delete products belonging to your shop.' });
  }

  products.splice(idx, 1);
  if (business) business.totalProducts = Math.max(0, business.totalProducts - 1);

  logActivity(user.id, user.name, 'seller', 'PRODUCT_DELETED', 'product', `Deleted product: ${product.title}.`, product.id);

  return res.status(200).json({ success: true, message: 'Product deleted.' });
});

// Seller Update Order Item Status
app.patch('/api/seller/orders/:orderId/status', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const business = businesses.find(b => b.ownerId === user.id || b.id === user.businessId);
  const { status, trackingNumber } = req.body;

  let modified = false;
  for (const item of order.items) {
    if ((business && item.businessId === business.id) || user.roles.includes('super_admin')) {
      item.status = status;
      if (trackingNumber) item.trackingNumber = trackingNumber;
      modified = true;
    }
  }

  if (!modified) {
    return res.status(403).json({ error: 'No items in this order belong to your business.' });
  }

  // Update order master status if all items are shipped or delivered
  const allShipped = order.items.every(i => i.status === 'shipped' || i.status === 'delivered');
  const allDelivered = order.items.every(i => i.status === 'delivered');

  if (allDelivered) order.status = 'delivered';
  else if (allShipped) order.status = 'shipped';
  else order.status = 'partially_shipped';

  order.updatedAt = new Date().toISOString();

  return res.status(200).json({ success: true, order });
});

// Update Shop Profile
app.put('/api/seller/profile', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const business = businesses.find(b => b.ownerId === user.id || b.id === user.businessId);
  if (!business) {
    return res.status(404).json({ error: 'Business profile not found.' });
  }

  const { name, description, phone, shippingTerms } = req.body;
  if (name) business.name = name;
  if (description) business.description = description;
  if (phone) business.phone = phone;
  if (shippingTerms) business.shippingTerms = shippingTerms;

  return res.status(200).json({ success: true, business });
});

// ==========================================
// 8. SUPER ADMIN MANAGEMENT (RBAC ENFORCED)
// ==========================================

// Dashboard Statistics
app.get('/api/admin/stats', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
  const activeChinaRequests = chinaRequests.filter(r => !['DELIVERED', 'CANCELLED'].includes(r.status)).length;
  const activeShipments = shippingOrders.filter(s => s.status !== 'delivered').length;

  return res.status(200).json({
    totalUsers: users.length,
    totalCustomers: users.filter(u => u.roles.includes('customer')).length,
    totalSellers: users.filter(u => u.roles.includes('seller')).length,
    totalStaff: users.filter(u => u.roles.includes('staff')).length,
    totalBusinesses: businesses.length,
    totalProducts: products.length,
    totalOrders: orders.length,
    totalRevenue,
    pendingOrders,
    chinaRequestsCount: chinaRequests.length,
    activeChinaRequests,
    activeShipments,
  });
});

// Admin Users CRUD
app.get('/api/admin/users', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const safeUsers = users.map(({ passwordHash, passwordSalt, ...u }) => u);
  return res.status(200).json({ users: safeUsers });
});

app.post('/api/admin/users', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const { name, email, phone, role, password, country, city } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  const emailNormalized = email.trim().toLowerCase();
  if (users.find(u => u.email.toLowerCase() === emailNormalized)) {
    return res.status(400).json({ error: 'Email already exists.' });
  }

  const { hash, salt } = hashPassword(password);
  const newUser: UserRecord = {
    id: `USR-${Date.now()}`,
    name,
    email: emailNormalized,
    phone: phone || '+250788000000',
    country: country || 'Rwanda',
    city: city || 'Kigali',
    roles: [role],
    accountType: role === 'seller' ? 'seller' : 'customer',
    isVerified: true,
    status: 'active',
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  const { passwordHash: _, passwordSalt: __, ...safeUser } = newUser;
  return res.status(201).json({ success: true, user: safeUser });
});

app.put('/api/admin/users/:id', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const { name, phone, role, status, isVerified } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (role) user.roles = [role];
  if (status) user.status = status;
  if (isVerified !== undefined) user.isVerified = isVerified;

  const { passwordHash: _, passwordSalt: __, ...safeUser } = user;
  return res.status(200).json({ success: true, user: safeUser });
});

app.delete('/api/admin/users/:id', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }
  const deleted = users.splice(idx, 1)[0];
  return res.status(200).json({ success: true, message: `User ${deleted.email} deleted.` });
});

// Admin Businesses List & Toggle
app.get('/api/admin/businesses', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  return res.status(200).json({ businesses });
});

app.put('/api/admin/businesses/:id', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const biz = businesses.find(b => b.id === req.params.id);
  if (!biz) {
    return res.status(404).json({ error: 'Business not found.' });
  }
  const { isVerified, status } = req.body;
  if (isVerified !== undefined) biz.isVerified = isVerified;
  if (status) biz.status = status;
  return res.status(200).json({ success: true, business: biz });
});

// Admin Assign Staff to China Request
app.patch('/api/admin/china-requests/:id/assign', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  const { staffId } = req.body;
  const item = chinaRequests.find(r => r.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Request not found.' });
  }

  const staff = users.find(u => u.id === staffId && u.roles.includes('staff'));
  if (!staff) {
    return res.status(400).json({ error: 'Staff member not found.' });
  }

  item.assignedStaffId = staff.id;
  item.assignedStaffName = staff.name;
  item.statusHistory.unshift({
    status: item.status,
    note: `Assigned to sourcing specialist ${staff.name}.`,
    updatedBy: 'Super Admin',
    timestamp: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, request: item });
});

// Admin Activity Logs
app.get('/api/admin/activity-logs', requireAuth, requireRole('super_admin'), (req: Request, res: Response) => {
  return res.status(200).json({ logs: activityLogs });
});

// Sent Emails (Allows inspecting real dispatched OTPs & templates)
app.get('/api/emails/recent', (req: Request, res: Response) => {
  const { email } = req.query;
  let list = sentEmails;
  if (email && typeof email === 'string') {
    list = list.filter(e => e.to.toLowerCase() === email.toLowerCase());
  }
  return res.status(200).json({ emails: list.slice(0, 50) });
});

// In-App Notifications
app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
  const user: UserRecord = (req as any).user;
  const userNotifs = notifications.filter(n => n.userId === user.id);
  return res.status(200).json({ notifications: userNotifs });
});

app.patch('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  const notif = notifications.find(n => n.id === req.params.id);
  if (notif) notif.read = true;
  return res.status(200).json({ success: true });
});

// ==========================================
// VITE CLIENT MOUNTING (DEV & PROD)
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BONFILS STORE full-stack platform running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
