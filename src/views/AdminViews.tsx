import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Lock, Mail, LogOut, LayoutDashboard, Package, Tags, ShoppingCart,
  Users, Store, PlaneTakeoff, ScrollText, Send, Plus, Search, Pencil, Trash2,
  X, RefreshCw, AlertTriangle, Star, Upload, KeyRound, Ban, CheckCircle2, EyeOff, Settings,
} from 'lucide-react';
import {
  DEFAULT_USD_TO_RWF_RATE, formatRwf, fulfillmentStatusLabel, normalizeUsdToRwfRate,
} from '../types';
import { api } from '../services/api';
import { compressImageFile, resolveProductImage } from '../services/images';
import type {
  AdminActivityLog, AdminStats, Business, Category, ChinaRequest, Order, Product, User,
} from '../types';

interface AdminViewsProps {
  onNavigate: (route: string) => void;
}

type AdminTab =
  | 'overview' | 'products' | 'categories' | 'orders'
  | 'users' | 'businesses' | 'china' | 'activity' | 'email' | 'settings';

const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
  { id: 'categories', label: 'Categories', icon: <Tags className="w-4 h-4" /> },
  { id: 'orders', label: 'Orders', icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { id: 'businesses', label: 'Stores', icon: <Store className="w-4 h-4" /> },
  { id: 'china', label: 'China Requests', icon: <PlaneTakeoff className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity Log', icon: <ScrollText className="w-4 h-4" /> },
  { id: 'email', label: 'Email Delivery', icon: <Send className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

const inputClass =
  'w-full px-3 py-2 bg-[#1C1C1C] border border-[#2E2E2E] rounded-lg text-xs text-white placeholder-[#555555] focus:border-[#FF6A00] focus:outline-none';
const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-[#777777] mb-1';
const buttonClass =
  'px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const primaryButton = `${buttonClass} bg-[#FF6A00] hover:bg-[#FF8A00] text-white`;
const ghostButton = `${buttonClass} border border-[#2E2E2E] text-[#BBBBBB] hover:border-[#FF6A00] hover:text-[#FF6A00]`;
const dangerButton = `${buttonClass} border border-red-500/40 text-red-400 hover:bg-red-500/10`;

function StatCard({ label, value, hint, tone = 'default' }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'warning' | 'good';
}) {
  const toneClass = tone === 'warning' ? 'text-[#FF6A00]' : tone === 'good' ? 'text-emerald-400' : 'text-white';
  return (
    <div className="rounded-xl border border-[#262626] bg-[#181818] p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">{label}</div>
      <div className={`text-2xl font-extrabold mt-1 tabular-nums ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-[#666666] mt-0.5">{hint}</div>}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#262626] bg-[#181818] overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#262626]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#BBBBBB]">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Modal({ title, onClose, children, wide }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-xl border border-[#2E2E2E] bg-[#141414] my-8`}>
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#262626]">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-[#888888] hover:text-white cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}

const OFFICIAL_STORE_ID = 'BIZ-001';
const OFFICIAL_STORE_NAME = 'Bonfils Store Official';

function defaultStoreId(businesses: Business[]): string {
  return businesses.find(business => business.id === OFFICIAL_STORE_ID)?.id
    || businesses.find(business => business.name.toLowerCase() === OFFICIAL_STORE_NAME.toLowerCase())?.id
    || businesses.find(business => business.type === 'official')?.id
    || businesses[0]?.id
    || '';
}

const emptyProductDraft = {
  id: '',
  title: '',
  description: '',
  category: 'Other',
  brand: '',
  price: '',
  originalPrice: '',
  stock: '',
  businessId: 'BIZ-001',
  images: [] as string[],
  shippingOrigin: 'Kigali Local Warehouse',
  shippingTimeDays: '1 - 2 Days',
  fulfillmentStatus: 'available_now' as Product['fulfillmentStatus'],
  estimatedDeliveryDays: '',
  isFeatured: false,
  isActive: true,
  specifications: '',
};

type ProductDraft = typeof emptyProductDraft;

// ------------------------------------------------------------------ sign in
function AdminGate({ onVerified, onCancel }: { onVerified: (user: User) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.adminLogin({ email: email.trim(), password });
      onVerified(result.user);
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-[#141414]">
      <div className="w-full max-w-md rounded-2xl border border-[#262626] bg-[#181818] p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold text-white">Super Admin Console</h1>
          <p className="text-[11px] text-[#777777] leading-relaxed">
            Restricted access. Sign in with your administrator email and password.
          </p>
        </div>

        <form onSubmit={submitCredentials} className="space-y-4">
          <div>
            <label className={labelClass}>Administrator email</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={inputClass}
              placeholder="iranzibonfils9@gmail.com"
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••••••"
            />
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#262626] text-center">
          <button onClick={onCancel} className="text-[11px] text-[#666666] hover:text-[#BBBBBB] cursor-pointer">
            ← Return to the storefront
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- console
export const AdminViews: React.FC<AdminViewsProps> = ({ onNavigate }) => {
  const [admin, setAdmin] = useState<User | null>(() => (
    api.getAdminToken() ? api.getAdminProfile() : null
  ));
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [categories, setCategories] = useState<Array<Category & { count: number }>>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [chinaRequests, setChinaRequests] = useState<ChinaRequest[]>([]);
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [emailLog, setEmailLog] = useState<{
    emails: Array<{ id: string; to: string; subject: string; purpose: string; status: string; sentAt: string }>;
    deliveryConfigured: boolean;
  }>({ emails: [], deliveryConfigured: false });
  const [settingsDraft, setSettingsDraft] = useState({ usdToRwfRate: String(DEFAULT_USD_TO_RWF_RATE) });
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState('');
  const [paymentBusinessId, setPaymentBusinessId] = useState('');
  const [paymentDraft, setPaymentDraft] = useState({
    momoPayCode: '', airtelMoneyCode: '', bankName: '', bankAccountName: '', bankAccountNumber: '', whatsappNumber: '',
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsReauth, setNeedsReauth] = useState(false);
  const [toast, setToast] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [productImagePreview, setProductImagePreview] = useState('');
  const [userDraft, setUserDraft] = useState<any>(null);
  const [businessDraft, setBusinessDraft] = useState<any>(null);
  const [categoryDraft, setCategoryDraft] = useState<any>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }, []);

  const reportError = useCallback((err: any, fallback: string) => {
    if (err?.status === 401 || err?.status === 403) {
      api.clearAdminToken();
      api.clearAdminProfile();
      setAdmin(null);
      setNeedsReauth(false);
      setError(err.message || 'Please sign in through the Super Admin console to continue.');
      return;
    }
    setError(err.message || fallback);
  }, []);

  const handleVerified = useCallback((user: User) => {
    api.setAdminProfile(user);
    setAdmin(user);
    setNeedsReauth(false);
    setBooting(false);
  }, []);

  const loadProducts = useCallback(async () => {
    const data = await api.getAdminProducts({ pageSize: '100', search: productSearch });
    setProducts(data.products || []);
    setProductTotal(data.total || 0);
  }, [productSearch]);

  const loadAll = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const [statsData, productData, categoryData, businessData, userData, orderData, chinaData, logData, emailData, settingsData] =
        await Promise.all([
          api.getAdminStats(),
          api.getAdminProducts({ pageSize: '100', search: productSearch }),
          api.getAdminCategories(),
          api.getAdminStores(),
          api.getAdminUsers(),
          api.getAdminOrders(),
          api.getAdminChinaRequests(),
          api.getAdminActivityLogs(80),
          api.getAdminEmails(40),
          api.getAdminSettings(),
        ]);
      setStats(statsData);
      setProducts(productData.products || []);
      setProductTotal(productData.total || 0);
      setCategories(categoryData || []);
      setBusinesses(businessData || []);
      setUsers(userData || []);
      setOrders(orderData || []);
      setChinaRequests(chinaData || []);
      setLogs(logData || []);
      setEmailLog(emailData);
      setSettingsDraft({ usdToRwfRate: String(settingsData.settings.usdToRwfRate) });
      setSettingsUpdatedAt(settingsData.settings.updatedAt);
    } catch (err: any) {
      // Background data loading must never sign the admin out. A 401 only
      // offers an explicit re-authentication action; cached access stays put.
      reportError(err, 'Failed to load the console data.');
    } finally {
      setBusy(false);
    }
  }, [productSearch, reportError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!api.getAdminToken()) {
        api.clearAdminProfile();
        if (!cancelled) {
          setAdmin(null);
          setBooting(false);
        }
        return;
      }
      try {
        const session = await api.getAdminSession();
        if (!cancelled) setAdmin(session.user);
      } catch (err: any) {
        if (!cancelled) {
          if (err?.status === 401 || err?.status === 403) {
            api.clearAllLocalAuth();
            setAdmin(null);
            setNeedsReauth(false);
          } else {
            // Keep cached admin/profile visible; data loads will report availability issues.
            setError(err.message || 'Unable to verify the administrator session right now.');
          }
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!booting && admin) loadAll();
  }, [booting, admin]);

  useEffect(() => {
    const refresh = () => { if (admin) void loadAll(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [admin, loadAll]);

  useEffect(() => {
    if (!businesses.length) return;
    const selected = businesses.find(business => business.id === paymentBusinessId)
      || businesses.find(business => business.type === 'official')
      || businesses[0];
    setPaymentBusinessId(selected.id);
    setPaymentDraft({
      momoPayCode: selected.momoPayCode || '',
      airtelMoneyCode: selected.airtelMoneyCode || '',
      bankName: selected.bankName || '',
      bankAccountName: selected.bankAccountName || '',
      bankAccountNumber: selected.bankAccountNumber || '',
      whatsappNumber: selected.whatsappNumber || '',
    });
  }, [businesses, paymentBusinessId]);

  useEffect(() => {
    const draft = productDraft;
    if (!businesses.length || !draft) return;
    if (draft.businessId && businesses.some(business => business.id === draft.businessId)) return;
    const fallback = defaultStoreId(businesses);
    if (fallback) setProductDraft({ ...draft, businessId: fallback });
  }, [businesses, productDraft]);

  useEffect(() => {
    if (!admin || tab !== 'products') return;
    const timer = setTimeout(() => { loadProducts().catch(() => undefined); }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, tab, admin, loadProducts]);

  const logout = async () => {
    try {
      await api.adminLogout();
    } finally {
      setAdmin(null);
      setStats(null);
      setNeedsReauth(false);
    }
  };

  const staff = useMemo(() => users.filter(user => user.roles.includes('staff') || user.roles.includes('super_admin')), [users]);

  // ------------------------------------------------------------------ actions
  const saveProduct = async () => {
    if (!productDraft) return;
    setBusy(true);
    setError('');
    try {
      const payload: any = {
        title: productDraft.title.trim(),
        description: productDraft.description.trim(),
        category: productDraft.category,
        brand: productDraft.brand.trim(),
        price: Number(productDraft.price),
        originalPrice: productDraft.originalPrice ? Number(productDraft.originalPrice) : null,
        stock: Number(productDraft.stock),
        businessId: productDraft.businessId,
        images: productDraft.images.filter(Boolean),
        shippingOrigin: productDraft.shippingOrigin,
        shippingTimeDays: productDraft.shippingTimeDays,
        fulfillmentStatus: productDraft.fulfillmentStatus,
        estimatedDeliveryDays: productDraft.estimatedDeliveryDays || null,
        isFeatured: productDraft.isFeatured,
        isActive: productDraft.isActive,
        specifications: productDraft.specifications
          .split('\n')
          .map(line => line.split(':').map(part => part.trim()))
          .filter(parts => parts.length === 2 && parts[0] && parts[1])
          .reduce<Record<string, string>>((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
      };
      if (productDraft.id) {
        await api.updateAdminProduct(productDraft.id, payload);
        flash('Product updated.');
      } else {
        await api.createAdminProduct(payload);
        flash('Product created.');
      }
      setProductImagePreview('');
      setProductDraft(null);
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not save the product.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    const rawRate = Number(settingsDraft.usdToRwfRate);
    if (!Number.isFinite(rawRate) || rawRate <= 0) {
      setError('Enter a valid USD to RWF exchange rate.');
      return;
    }
    const rate = normalizeUsdToRwfRate(rawRate);
    setBusy(true);
    setError('');
    try {
      const result = await api.updateAdminSettings({ usdToRwfRate: rate });
      setSettingsDraft({ usdToRwfRate: String(result.settings.usdToRwfRate) });
      setSettingsUpdatedAt(result.settings.updatedAt);
      flash('Exchange rate saved.');
    } catch (err: any) {
      reportError(err, 'Could not save the exchange rate.');
    } finally {
      setBusy(false);
    }
  };

  const savePaymentDetails = async () => {
    if (!paymentBusinessId) {
      setError('Choose a store first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.updateAdminBusiness(paymentBusinessId, paymentDraft);
      flash('Payment details saved.');
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not save the payment details.');
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (product: Product) => {
    if (!window.confirm(`Delete "${product.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteAdminProduct(product.id);
      flash('Product deleted.');
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not delete the product.');
    }
  };

  const uploadProductImage = async (file: File) => {
    if (!productDraft) return;
    setBusy(true);
    setError('');
    const objectUrl = URL.createObjectURL(file);
    setProductImagePreview(objectUrl);
    try {
      const dataUrl = await compressImageFile(file);
      const result = await api.adminUploadImage(dataUrl, file.name.replace(/\.[^.]+$/, '') + '.webp', 'products');
      setProductDraft({ ...productDraft, images: [...productDraft.images, result.url].slice(0, 8) });
      setProductImagePreview(result.url);
      flash('Image uploaded.');
    } catch (err: any) {
      reportError(err, 'Image upload failed.');
      setProductImagePreview('');
    } finally {
      if (objectUrl.startsWith('blob:')) URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  };

  const saveUser = async () => {
    if (!userDraft) return;
    setBusy(true);
    setError('');
    try {
      if (userDraft.id) {
        await api.updateAdminUser(userDraft.id, {
          name: userDraft.name,
          phone: userDraft.phone,
          country: userDraft.country,
          city: userDraft.city,
          status: userDraft.status,
          roles: userDraft.roles,
          password: userDraft.password ? String(userDraft.password) : undefined,
        });
        flash('Account updated.');
      } else {
        await api.createAdminUser({
          name: userDraft.name,
          email: userDraft.email,
          phone: userDraft.phone,
          country: userDraft.country,
          city: userDraft.city,
          roles: userDraft.roles,
          password: userDraft.password,
        });
        flash('Account created.');
      }
      setUserDraft(null);
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not save the account.');
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (user: User) => {
    if (!window.confirm(`Delete the account ${user.email}?`)) return;
    try {
      await api.deleteAdminUser(user.id);
      flash('Account deleted.');
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not delete the account.');
    }
  };

  const saveBusiness = async () => {
    if (!businessDraft) return;
    setBusy(true);
    setError('');
    try {
      await api.updateAdminBusiness(businessDraft.id, {
        name: businessDraft.name,
        description: businessDraft.description,
        phone: businessDraft.phone,
        email: businessDraft.email,
        city: businessDraft.city,
        country: businessDraft.country,
        shippingTerms: businessDraft.shippingTerms,
        type: businessDraft.type,
        status: businessDraft.status,
        isVerified: businessDraft.isVerified,
      });
      flash('Store updated.');
      setBusinessDraft(null);
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not save the store.');
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = async () => {
    if (!categoryDraft) return;
    setBusy(true);
    setError('');
    try {
      if (categoryDraft.id) {
        await api.updateAdminCategory(categoryDraft.id, {
          name: categoryDraft.name,
          description: categoryDraft.description,
          image: categoryDraft.image,
          sortOrder: Number(categoryDraft.sortOrder),
          isActive: categoryDraft.isActive,
        });
        flash('Category updated.');
      } else {
        await api.createAdminCategory({
          name: categoryDraft.name,
          description: categoryDraft.description,
          image: categoryDraft.image,
          sortOrder: Number(categoryDraft.sortOrder),
          isActive: categoryDraft.isActive,
        });
        flash('Category created.');
      }
      setCategoryDraft(null);
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not save the category.');
    } finally {
      setBusy(false);
    }
  };

  const updateOrder = async (order: Order, patch: { status?: string; paymentStatus?: string }) => {
    try {
      await api.updateAdminOrder(order.id, patch);
      flash(`Order ${order.orderNumber} updated.`);
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not update the order.');
    }
  };

  const assignStaff = async (request: ChinaRequest, staffId: string) => {
    try {
      await api.assignStaffToChinaRequest(request.id, staffId);
      flash(`${request.requestNumber} reassigned.`);
      await loadAll();
    } catch (err: any) {
      reportError(err, 'Could not assign that request.');
    }
  };

  // --------------------------------------------------------------------- gate
  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141414] text-[#666666] text-xs">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
        Checking administrator session…
      </div>
    );
  }

  if (!admin) {
    return <AdminGate onVerified={handleVerified} onCancel={() => onNavigate('/')} />;
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <header className="sticky top-0 z-30 border-b border-[#262626] bg-[#141414]/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold truncate">Super Admin Console</h1>
              <p className="text-[10px] text-[#666666] truncate">
                {admin.email} · {needsReauth ? 're-authentication recommended' : 'verified session'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => loadAll()} className={ghostButton} disabled={busy}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 inline ${busy ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button onClick={() => onNavigate('/')} className={ghostButton}>Storefront</button>
            <button onClick={logout} className={dangerButton}><LogOut className="w-3.5 h-3.5 mr-1.5 inline" />Sign out</button>
          </div>
        </div>

        <nav className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-2 flex gap-1 overflow-x-auto [scrollbar-width:thin]">
          {TABS.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                tab === item.id ? 'bg-[#FF6A00] text-white' : 'text-[#888888] hover:text-white hover:bg-[#1E1E1E]'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {needsReauth && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span className="flex-1">
              Your saved admin session needs attention. Re-authenticate to continue from where you left off.
            </span>
            <button
              onClick={() => {
                api.clearAdminToken();
                setAdmin(null);
                setNeedsReauth(false);
              }}
              className="font-bold underline cursor-pointer"
            >
              Sign in again
            </button>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[11px] text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}
        {toast && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[11px] text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            {toast}
          </div>
        )}

        {tab === 'overview' && (
          <>
            {stats ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="Revenue (paid)" value={`$${stats.paidRevenue.toLocaleString()}`} hint={`$${stats.totalRevenue.toLocaleString()} gross`} tone="good" />
                  <StatCard label="Orders" value={stats.totalOrders} hint={`${stats.pendingOrders} pending`} />
                  <StatCard label="Products" value={stats.totalProducts} hint={`${stats.activeProducts} active · ${stats.featuredProducts} featured`} />
                  <StatCard label="Low / out of stock" value={stats.lowStockProducts + stats.outOfStockProducts} tone="warning" hint={`${stats.outOfStockProducts} out of stock`} />
                  <StatCard label="Users" value={stats.totalUsers} hint={`${stats.totalCustomers} customers · ${stats.totalSellers} sellers`} />
                  <StatCard label="Staff" value={stats.totalStaff} hint={`${stats.totalSuperAdmins} super admins`} />
                  <StatCard label="Stores" value={stats.totalBusinesses} />
                  <StatCard label="Categories" value={stats.totalCategories} />
                  <StatCard label="China requests" value={stats.chinaRequestsCount} hint={`${stats.activeChinaRequests} active`} />
                  <StatCard label="Active shipments" value={stats.activeShipments} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Panel title="Latest orders">
                    {stats.latestOrders?.length ? (
                      <ul className="space-y-2">
                        {stats.latestOrders.map(order => (
                          <li key={order.id} className="flex items-center justify-between gap-3 text-[11px] border-b border-[#202020] pb-2">
                            <div>
                              <div className="font-bold text-white">{order.orderNumber}</div>
                              <div className="text-[#666666]">{order.customerName} · {order.shippingAddress?.city}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold tabular-nums">${order.total.toFixed(2)}</div>
                              <div className="text-[#666666]">{order.status.replace(/_/g, ' ')}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-[11px] text-[#666666]">No orders yet.</p>}
                  </Panel>

                  <Panel title="Top products">
                    {stats.topProducts?.length ? (
                      <ul className="space-y-2">
                        {stats.topProducts.map(product => (
                          <li key={product.id} className="flex items-center gap-3 text-[11px] border-b border-[#202020] pb-2">
                            <img
                              src={resolveProductImage(product, 0)}
                              alt=""
                              className="w-9 h-9 rounded object-cover bg-[#202020]"
                              loading="lazy"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-white truncate">{product.title}</div>
                              <div className="text-[#666666]">{product.salesCount} sold · {product.stock} in stock</div>
                            </div>
                            <div className="text-[#FF6A00] font-bold tabular-nums">${product.price.toFixed(2)}</div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-[11px] text-[#666666]">No sales recorded yet.</p>}
                  </Panel>
                </div>
              </>
            ) : (
              <p className="text-xs text-[#666666]">Loading statistics…</p>
            )}
          </>
        )}

        {tab === 'products' && (
          <Panel
            title={`Products (${productTotal})`}
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555555]" />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search products…"
                    className="pl-8 pr-3 py-1.5 bg-[#1C1C1C] border border-[#2E2E2E] rounded-lg text-[11px] text-white focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
                <button
                  className={primaryButton}
                  onClick={() => {
                    setProductImagePreview('');
                    setProductDraft({
                      ...emptyProductDraft,
                      businessId: defaultStoreId(businesses) || emptyProductDraft.businessId,
                      category: categories[0]?.name || 'Other',
                    });
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1 inline" />New product
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-[11px] min-w-[820px]">
                <thead>
                  <tr className="text-[#666666] text-left">
                    <th className="py-2 font-bold uppercase tracking-wider">Product</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Category</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Store</th>
                    <th className="py-2 font-bold uppercase tracking-wider text-right">Price</th>
                    <th className="py-2 font-bold uppercase tracking-wider text-right">Stock</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Flags</th>
                    <th className="py-2 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(product => (
                    <tr key={product.id} className="border-t border-[#202020]">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={resolveProductImage(product, 0)}
                            alt=""
                            loading="lazy"
                            className="w-9 h-9 rounded object-cover bg-[#202020]"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate max-w-[240px]">{product.title}</div>
                            <div className="text-[#555555]">{product.brand || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-[#BBBBBB]">{product.category}</td>
                      <td className="py-2 pr-3 text-[#BBBBBB]">{product.sellerName}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">${product.price.toFixed(2)}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${product.stock <= 0 ? 'text-red-400' : product.stock <= 5 ? 'text-[#FF6A00]' : 'text-[#BBBBBB]'}`}>
                        {product.stock}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {product.isActive
                            ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">active</span>
                            : <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">hidden</span>}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                            product.fulfillmentStatus === 'requires_shipping_import'
                              ? 'bg-[#FF6A00]/15 text-[#FF6A00]'
                              : 'bg-emerald-500/15 text-emerald-300'
                          }`}>
                            {fulfillmentStatusLabel(product.fulfillmentStatus)}
                          </span>
                          {product.isFeatured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FF6A00]/15 text-[#FF6A00]">featured</span>}
                        </div>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          className="text-[#888888] hover:text-[#FF6A00] mr-3 cursor-pointer"
                          onClick={() => {
                            setProductImagePreview(product.images[0] || '');
                            setProductDraft({
                              id: product.id,
                              title: product.title,
                              description: product.description,
                              category: product.category,
                              brand: product.brand || '',
                              price: String(product.price),
                              originalPrice: product.originalPrice ? String(product.originalPrice) : '',
                              stock: String(product.stock),
                              businessId: product.businessId,
                              images: [...product.images],
                              shippingOrigin: product.shippingOrigin,
                              shippingTimeDays: product.shippingTimeDays,
                              fulfillmentStatus: product.fulfillmentStatus || 'available_now',
                              estimatedDeliveryDays: product.estimatedDeliveryDays ? String(product.estimatedDeliveryDays) : '',
                              isFeatured: product.isFeatured,
                              isActive: product.isActive,
                              specifications: Object.entries(product.specifications || {})
                                .map(([key, value]) => `${key}: ${value}`)
                                .join('\n'),
                            });
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button className="text-[#888888] hover:text-red-400 cursor-pointer" onClick={() => removeProduct(product)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!products.length && (
                    <tr><td colSpan={7} className="py-8 text-center text-[#666666]">No products match this search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'categories' && (
          <Panel
            title={`Categories (${categories.length})`}
            action={
              <button className={primaryButton} onClick={() => setCategoryDraft({
                id: '', name: '', description: '', image: '', sortOrder: categories.length + 1, isActive: true,
              })}>
                <Plus className="w-3.5 h-3.5 mr-1 inline" />New category
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map(category => (
                <div key={category.id} className="rounded-lg border border-[#262626] bg-[#141414] p-3 flex gap-3">
                  <img
                    src={category.image || '/images/categories/placeholder.svg'}
                    alt=""
                    loading="lazy"
                    className="w-12 h-12 rounded object-cover bg-[#202020]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{category.name}</div>
                    <div className="text-[10px] text-[#666666]">{category.count} products · order {category.sortOrder}</div>
                    <div className="mt-1">
                      {category.isActive
                        ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">visible</span>
                        : <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2E2E2E] text-[#888888]">hidden</span>}
                    </div>
                  </div>
                  <button
                    className="text-[#888888] hover:text-[#FF6A00] cursor-pointer self-start"
                    onClick={() => setCategoryDraft({
                      id: category.id,
                      name: category.name,
                      description: category.description || '',
                      image: category.image || '',
                      sortOrder: category.sortOrder,
                      isActive: category.isActive,
                    })}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'orders' && (
          <Panel title={`Orders (${orders.length})`}>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-[11px] min-w-[760px]">
                <thead>
                  <tr className="text-[#666666] text-left">
                    <th className="py-2 font-bold uppercase tracking-wider">Order</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Customer</th>
                    <th className="py-2 font-bold uppercase tracking-wider text-right">Total</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Payment</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Status</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="border-t border-[#202020]">
                      <td className="py-2 pr-3 font-bold text-white">{order.orderNumber}</td>
                      <td className="py-2 pr-3">
                        <div className="text-[#BBBBBB]">{order.customerName}</div>
                        <div className="text-[#555555]">{order.customerEmail}</div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">${order.total.toFixed(2)}</td>
                      <td className="py-2 pr-3">
                        <select
                          value={order.paymentStatus}
                          onChange={e => updateOrder(order, { paymentStatus: e.target.value })}
                          className="bg-[#1C1C1C] border border-[#2E2E2E] rounded px-1.5 py-1 text-[10px] text-white"
                        >
                          <option value="pending">pending</option>
                          <option value="paid">paid</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          value={order.status}
                          onChange={e => updateOrder(order, { status: e.target.value })}
                          className="bg-[#1C1C1C] border border-[#2E2E2E] rounded px-1.5 py-1 text-[10px] text-white"
                        >
                          {['pending', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled'].map(status => (
                            <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-[#666666]">{new Date(order.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!orders.length && (
                    <tr><td colSpan={6} className="py-8 text-center text-[#666666]">No orders yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'users' && (
          <Panel
            title={`Accounts (${users.length})`}
            action={
              <button
                className={primaryButton}
                onClick={() => setUserDraft({
                  id: '', name: '', email: '', phone: '', country: 'Rwanda', city: 'Kigali',
                  roles: ['customer'], password: '', status: 'active',
                })}
              >
                <Plus className="w-3.5 h-3.5 mr-1 inline" />New account
              </button>
            }
          >
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-[11px] min-w-[720px]">
                <thead>
                  <tr className="text-[#666666] text-left">
                    <th className="py-2 font-bold uppercase tracking-wider">User</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Location</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Roles</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Status</th>
                    <th className="py-2 font-bold uppercase tracking-wider">Joined</th>
                    <th className="py-2 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-t border-[#202020]">
                      <td className="py-2 pr-3">
                        <div className="font-bold text-white">{user.name}</div>
                        <div className="text-[#555555]">{user.email}</div>
                      </td>
                      <td className="py-2 pr-3 text-[#BBBBBB]">{user.city}, {user.country}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map(role => (
                            <span
                              key={role}
                              className={`text-[9px] px-1.5 py-0.5 rounded ${
                                role === 'super_admin' ? 'bg-[#FF6A00]/20 text-[#FF6A00]'
                                  : role === 'staff' ? 'bg-sky-500/15 text-sky-300'
                                  : 'bg-[#232323] text-[#999999]'
                              }`}
                            >
                              {role.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {user.status === 'active'
                          ? <span className="text-emerald-400">active</span>
                          : <span className="text-red-400">disabled</span>}
                      </td>
                      <td className="py-2 text-[#666666]">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          className="text-[#888888] hover:text-[#FF6A00] mr-3 cursor-pointer"
                          onClick={() => setUserDraft({
                            id: user.id, name: user.name, email: user.email, phone: user.phone,
                            country: user.country, city: user.city, roles: [...user.roles],
                            password: '', status: user.status,
                          })}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {user.id !== admin.id && !user.roles.includes('super_admin') && (
                          <button className="text-[#888888] hover:text-red-400 cursor-pointer" onClick={() => removeUser(user)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === 'businesses' && (
          <Panel title={`Stores (${businesses.length})`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {businesses.map(business => (
                <div key={business.id} className="rounded-lg border border-[#262626] bg-[#141414] p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{business.name}</div>
                      <div className="text-[10px] text-[#666666]">{business.email} · {business.phone || 'no phone'}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#232323] text-[#999999]">{business.type}</span>
                      {business.isVerified
                        ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">verified</span>
                        : <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FF6A00]/15 text-[#FF6A00]">unverified</span>}
                      {business.status === 'suspended' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300">suspended</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#888888] line-clamp-2">{business.description}</p>
                  <div className="flex items-center gap-4 text-[10px] text-[#666666]">
                    <span className="flex items-center gap-1"><Package className="w-3 h-3" />{business.totalProducts} products</span>
                    <span className="flex items-center gap-1"><Star className="w-3 h-3" />{business.rating.toFixed(1)}</span>
                    <span className="flex items-center gap-1"><Store className="w-3 h-3" />{business.city}</span>
                  </div>
                  <button
                    className={ghostButton}
                    onClick={() => setBusinessDraft({
                      id: business.id, name: business.name, description: business.description,
                      phone: business.phone, email: business.email, city: business.city,
                      country: business.country, shippingTerms: business.shippingTerms,
                      type: business.type, status: business.status, isVerified: business.isVerified,
                    })}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1 inline" />Manage store
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'china' && (
          <Panel title={`China sourcing requests (${chinaRequests.length})`}>
            <div className="space-y-2">
              {chinaRequests.map(request => (
                <div key={request.id} className="rounded-lg border border-[#262626] bg-[#141414] p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{request.requestNumber} · {request.productName}</div>
                      <div className="text-[10px] text-[#666666]">
                        {request.customerName} · {request.whatsapp || request.customerPhone || request.customerEmail} · {request.country} · qty {request.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#232323] text-[#999999]">
                        {String(request.status).replace(/_/g, ' ')}
                      </span>
                      <select
                        value={request.assignedStaffId || ''}
                        onChange={e => assignStaff(request, e.target.value)}
                        className="bg-[#1C1C1C] border border-[#2E2E2E] rounded px-1.5 py-1 text-[10px] text-white"
                      >
                        <option value="">Unassigned</option>
                        {staff.map(member => (
                          <option key={member.id} value={member.id}>{member.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#888888] line-clamp-2">{request.description}</p>
                  <div className="text-[10px] text-[#555555]">
                    {request.assignedStaffName ? `Assigned to ${request.assignedStaffName}` : 'No staff assigned yet'}
                    {request.estimatedBudget ? ` · budget $${request.estimatedBudget}` : ''}
                  </div>
                </div>
              ))}
              {!chinaRequests.length && <p className="text-[11px] text-[#666666]">No sourcing requests yet.</p>}
            </div>
          </Panel>
        )}

        {tab === 'activity' && (
          <Panel title={`Activity log (${logs.length})`}>
            <ul className="space-y-1.5">
              {logs.map(log => (
                <li key={log.id} className="flex flex-wrap items-baseline gap-2 text-[11px] border-b border-[#1F1F1F] pb-1.5">
                  <span className="text-[#FF6A00] font-bold">{log.action}</span>
                  <span className="text-[#BBBBBB]">{log.details}</span>
                  <span className="text-[#555555] ml-auto">{log.actorName} · {new Date(log.timestamp).toLocaleString()}</span>
                </li>
              ))}
              {!logs.length && <p className="text-[11px] text-[#666666]">No activity recorded yet.</p>}
            </ul>
          </Panel>
        )}

        {tab === 'email' && (
          <Panel title="Email delivery (metadata only)">
            <div className={`rounded-lg border px-3 py-2 text-[11px] mb-3 ${emailLog.deliveryConfigured ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-[#FF6A00]/30 bg-[#FF6A00]/10 text-[#FF6A00]'}`}>
              {emailLog.deliveryConfigured
                ? 'A mail transport is configured: messages are being delivered and recorded.'
                : 'No mail transport is configured. Set GMAIL_USER and GMAIL_APP_PASSWORD so codes and updates can be delivered.'}
            </div>
            <ul className="space-y-1.5">
              {emailLog.emails.map(email => (
                <li key={email.id} className="flex flex-wrap items-baseline gap-2 text-[11px] border-b border-[#1F1F1F] pb-1.5">
                  <Mail className="w-3 h-3 text-[#555555]" />
                  <span className="font-bold text-white">{email.to}</span>
                  <span className="text-[#888888]">{email.subject}</span>
                  <span className="text-[#555555]">{email.purpose.replace(/_/g, ' ')}</span>
                  <span className={email.status === 'failed' ? 'text-red-400' : 'text-emerald-400'}>{email.status}</span>
                  <span className="text-[#555555] ml-auto">{new Date(email.sentAt).toLocaleString()}</span>
                </li>
              ))}
              {!emailLog.emails.length && <p className="text-[11px] text-[#666666]">No emails recorded yet.</p>}
            </ul>
            <p className="mt-3 text-[10px] text-[#555555] flex items-center gap-1.5">
              <EyeOff className="w-3 h-3" />
              Message bodies and verification codes are never exposed to this console.
            </p>
          </Panel>
        )}

        {tab === 'settings' && (
          <>
            <Panel title="Currency conversion">
              <div className="max-w-xl space-y-3">
                <p className="text-[11px] text-[#888888] leading-relaxed">
                  Catalog prices are stored in USD. Checkout converts the final order total to RWF using this
                  store-wide rate.
                </p>
                <div>
                  <label className={labelClass}>USD to RWF exchange rate</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      className={inputClass}
                      value={settingsDraft.usdToRwfRate}
                      onChange={e => setSettingsDraft({ ...settingsDraft, usdToRwfRate: e.target.value })}
                    />
                    <button type="button" onClick={saveSettings} disabled={busy} className={`${primaryButton} shrink-0`}>
                      Save rate
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-[11px] text-[#BBBBBB]">
                  Example: <strong className="text-white">$100</strong> ={' '}
                  <strong className="text-[#FF6A00]">
                    {formatRwf(100, normalizeUsdToRwfRate(settingsDraft.usdToRwfRate))}
                  </strong>
                </div>
                {settingsUpdatedAt && (
                  <p className="text-[10px] text-[#555555]">
                    Last updated {new Date(settingsUpdatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="Payment collection details">
              <div className="max-w-xl space-y-3">
                <p className="text-[11px] text-[#888888] leading-relaxed">
                  Choose a store to configure the MoMo Pay, Airtel, and bank details buyers see at checkout.
                  Seeded values are clearly marked DEMO placeholders — replace them before going live.
                </p>
                <div>
                  <label className={labelClass}>Store</label>
                  <select
                    className={inputClass}
                    value={paymentBusinessId}
                    onChange={e => setPaymentBusinessId(e.target.value)}
                  >
                    {businesses.map(business => (
                      <option key={business.id} value={business.id}>{business.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>MoMo Pay code</label>
                    <input
                      className={inputClass}
                      value={paymentDraft.momoPayCode}
                      onChange={e => setPaymentDraft({ ...paymentDraft, momoPayCode: e.target.value })}
                      placeholder="DEMO MoMo *182*8*1*0000001#"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Airtel Money USSD / code</label>
                    <input
                      className={inputClass}
                      value={paymentDraft.airtelMoneyCode}
                      onChange={e => setPaymentDraft({ ...paymentDraft, airtelMoneyCode: e.target.value })}
                      placeholder="DEMO Airtel *150*00*0000002#"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Bank name</label>
                    <input
                      className={inputClass}
                      value={paymentDraft.bankName}
                      onChange={e => setPaymentDraft({ ...paymentDraft, bankName: e.target.value })}
                      placeholder="Demo Bank Rwanda"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Bank account name</label>
                    <input
                      className={inputClass}
                      value={paymentDraft.bankAccountName}
                      onChange={e => setPaymentDraft({ ...paymentDraft, bankAccountName: e.target.value })}
                      placeholder="DEMO account holder"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Bank account number</label>
                    <input
                      className={inputClass}
                      value={paymentDraft.bankAccountNumber}
                      onChange={e => setPaymentDraft({ ...paymentDraft, bankAccountNumber: e.target.value })}
                      placeholder="0000000001"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>WhatsApp number (optional)</label>
                    <input
                      className={inputClass}
                      value={paymentDraft.whatsappNumber}
                      onChange={e => setPaymentDraft({ ...paymentDraft, whatsappNumber: e.target.value })}
                      placeholder="+250 788 000 000"
                    />
                  </div>
                </div>
                <button type="button" onClick={savePaymentDetails} disabled={busy} className={primaryButton}>
                  Save payment details
                </button>
              </div>
            </Panel>
          </>
        )}
      </main>

      {productDraft && (
        <Modal title={productDraft.id ? 'Edit product' : 'New product'} onClose={() => { setProductImagePreview(''); setProductDraft(null); }} wide>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title</label>
              <input className={inputClass} value={productDraft.title} onChange={e => setProductDraft({ ...productDraft, title: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select className={inputClass} value={productDraft.category} onChange={e => setProductDraft({ ...productDraft, category: e.target.value })}>
                {categories.length === 0 && <option value="Other">Other</option>}
                {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Store</label>
              <select className={inputClass} value={productDraft.businessId} onChange={e => setProductDraft({ ...productDraft, businessId: e.target.value })}>
                {businesses.length === 0 && <option value="">No stores available</option>}
                {businesses.map(business => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Brand</label>
              <input className={inputClass} value={productDraft.brand} onChange={e => setProductDraft({ ...productDraft, brand: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Price (USD)</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={productDraft.price} onChange={e => setProductDraft({ ...productDraft, price: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Compare-at price</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={productDraft.originalPrice} onChange={e => setProductDraft({ ...productDraft, originalPrice: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Stock</label>
              <input type="number" min="0" className={inputClass} value={productDraft.stock} onChange={e => setProductDraft({ ...productDraft, stock: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Shipping origin</label>
              <input className={inputClass} value={productDraft.shippingOrigin} onChange={e => setProductDraft({ ...productDraft, shippingOrigin: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Delivery estimate</label>
              <input className={inputClass} value={productDraft.shippingTimeDays} onChange={e => setProductDraft({ ...productDraft, shippingTimeDays: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Availability</label>
              <select
                className={inputClass}
                value={productDraft.fulfillmentStatus}
                onChange={e => setProductDraft({ ...productDraft, fulfillmentStatus: e.target.value as Product['fulfillmentStatus'] })}
              >
                <option value="available_now">Available Now</option>
                <option value="requires_shipping_import">Requires Shipping / Import</option>
              </select>
            </div>
            {productDraft.fulfillmentStatus === 'requires_shipping_import' && (
              <div>
                <label className={labelClass}>Estimated delivery days (optional)</label>
                <input
                  type="number"
                  min="1"
                  className={inputClass}
                  value={productDraft.estimatedDeliveryDays}
                  onChange={e => setProductDraft({ ...productDraft, estimatedDeliveryDays: e.target.value })}
                  placeholder="e.g. 14"
                />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea rows={3} className={inputClass} value={productDraft.description} onChange={e => setProductDraft({ ...productDraft, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Specifications (one per line, "Key: Value")</label>
              <textarea rows={3} className={inputClass} value={productDraft.specifications} onChange={e => setProductDraft({ ...productDraft, specifications: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[11px] text-[#BBBBBB] cursor-pointer">
                <input type="checkbox" className="accent-[#FF6A00]" checked={productDraft.isFeatured} onChange={e => setProductDraft({ ...productDraft, isFeatured: e.target.checked })} />
                Featured
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#BBBBBB] cursor-pointer">
                <input type="checkbox" className="accent-[#FF6A00]" checked={productDraft.isActive} onChange={e => setProductDraft({ ...productDraft, isActive: e.target.checked })} />
                Visible in storefront
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Images</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {productDraft.images.map((image, index) => (
                  <div key={`${image}-${index}`} className="relative">
                    <img src={image} alt="" className="w-14 h-14 rounded object-cover border border-[#2E2E2E]" />
                    <button
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] cursor-pointer"
                      onClick={() => {
                        setProductImagePreview('');
                        setProductDraft({ ...productDraft, images: productDraft.images.filter((_, i) => i !== index) });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!productDraft.images.length && !productImagePreview && <span className="text-[11px] text-[#666666]">No images yet.</span>}
                {productImagePreview && (
                  <div className="relative">
                    <img src={productImagePreview} alt="Upload preview" className="w-14 h-14 rounded object-cover border border-[#FF6A00]" />
                    {busy && <span className="absolute inset-0 flex items-center justify-center rounded bg-black/50 text-[9px] text-white">Processing…</span>}
                  </div>
                )}
              </div>
              <label className={ghostButton}>
                <Upload className="w-3.5 h-3.5 mr-1 inline" />Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={e => { const file = e.target.files?.[0]; if (file) void uploadProductImage(file); e.target.value = ''; }}
                />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={ghostButton} onClick={() => { setProductImagePreview(''); setProductDraft(null); }}>Cancel</button>
            <button className={primaryButton} disabled={busy} onClick={saveProduct}>
              {busy ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </Modal>
      )}

      {userDraft && (
        <Modal
          title={userDraft.id ? 'Edit account' : 'Create account'}
          onClose={() => setUserDraft(null)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Full name</label>
              <input className={inputClass} value={userDraft.name} onChange={e => setUserDraft({ ...userDraft, name: e.target.value })} />
            </div>
            {!userDraft.id && (
              <div className="sm:col-span-2">
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} value={userDraft.email} onChange={e => setUserDraft({ ...userDraft, email: e.target.value })} />
              </div>
            )}
            <div>
              <label className={labelClass}>Phone</label>
              <input className={inputClass} value={userDraft.phone} onChange={e => setUserDraft({ ...userDraft, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input className={inputClass} value={userDraft.city} onChange={e => setUserDraft({ ...userDraft, city: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input className={inputClass} value={userDraft.country} onChange={e => setUserDraft({ ...userDraft, country: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={userDraft.status} onChange={e => setUserDraft({ ...userDraft, status: e.target.value })}>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Roles</label>
              <div className="flex flex-wrap gap-3">
                {(['customer', 'seller', 'staff', 'super_admin'] as const).map(role => (
                  <label key={role} className="flex items-center gap-1.5 text-[11px] text-[#BBBBBB] cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#FF6A00]"
                      checked={userDraft.roles.includes(role)}
                      onChange={e => setUserDraft({
                        ...userDraft,
                        roles: e.target.checked
                          ? [...userDraft.roles, role]
                          : userDraft.roles.filter((item: string) => item !== role),
                      })}
                    />
                    {role.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                {userDraft.id ? 'Reset password (leave blank to keep current)' : 'Password (minimum 12 characters)'}
              </label>
              <input
                type="password"
                minLength={12}
                className={inputClass}
                value={userDraft.password}
                onChange={e => setUserDraft({ ...userDraft, password: e.target.value })}
                placeholder={userDraft.id ? '••••••••••••' : 'At least 12 characters'}
              />
              {userDraft.id && (
                <p className="mt-1 text-[10px] text-[#FF6A00] flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Saving a new password signs this user out of every device.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={ghostButton} onClick={() => setUserDraft(null)}>Cancel</button>
            <button className={primaryButton} disabled={busy} onClick={saveUser}>
              {busy ? 'Saving…' : 'Save account'}
            </button>
          </div>
        </Modal>
      )}

      {businessDraft && (
        <Modal title={`Manage ${businessDraft.name}`} onClose={() => setBusinessDraft(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Store name</label>
              <input className={inputClass} value={businessDraft.name} onChange={e => setBusinessDraft({ ...businessDraft, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea rows={3} className={inputClass} value={businessDraft.description} onChange={e => setBusinessDraft({ ...businessDraft, description: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} value={businessDraft.email} onChange={e => setBusinessDraft({ ...businessDraft, email: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input className={inputClass} value={businessDraft.phone} onChange={e => setBusinessDraft({ ...businessDraft, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input className={inputClass} value={businessDraft.city} onChange={e => setBusinessDraft({ ...businessDraft, city: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input className={inputClass} value={businessDraft.country} onChange={e => setBusinessDraft({ ...businessDraft, country: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select className={inputClass} value={businessDraft.type} onChange={e => setBusinessDraft({ ...businessDraft, type: e.target.value })}>
                <option value="external">external</option>
                <option value="official">official</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={businessDraft.status} onChange={e => setBusinessDraft({ ...businessDraft, status: e.target.value })}>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Shipping terms</label>
              <input className={inputClass} value={businessDraft.shippingTerms} onChange={e => setBusinessDraft({ ...businessDraft, shippingTerms: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-[11px] text-[#BBBBBB] cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#FF6A00]"
                  checked={businessDraft.isVerified}
                  onChange={e => setBusinessDraft({ ...businessDraft, isVerified: e.target.checked })}
                />
                Verified seller badge
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={ghostButton} onClick={() => setBusinessDraft(null)}>Cancel</button>
            <button className={primaryButton} disabled={busy} onClick={saveBusiness}>
              {busy ? 'Saving…' : 'Save store'}
            </button>
          </div>
        </Modal>
      )}

      {categoryDraft && (
        <Modal title={categoryDraft.id ? 'Edit category' : 'New category'} onClose={() => setCategoryDraft(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Name</label>
              <input className={inputClass} value={categoryDraft.name} onChange={e => setCategoryDraft({ ...categoryDraft, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea rows={2} className={inputClass} value={categoryDraft.description} onChange={e => setCategoryDraft({ ...categoryDraft, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Image URL</label>
              <input className={inputClass} value={categoryDraft.image} onChange={e => setCategoryDraft({ ...categoryDraft, image: e.target.value })} placeholder="/images/categories/example.svg" />
            </div>
            <div>
              <label className={labelClass}>Sort order</label>
              <input type="number" min="0" className={inputClass} value={categoryDraft.sortOrder} onChange={e => setCategoryDraft({ ...categoryDraft, sortOrder: e.target.value })} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-[11px] text-[#BBBBBB] cursor-pointer">
                <input type="checkbox" className="accent-[#FF6A00]" checked={categoryDraft.isActive} onChange={e => setCategoryDraft({ ...categoryDraft, isActive: e.target.checked })} />
                Visible in storefront
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={ghostButton} onClick={() => setCategoryDraft(null)}>Cancel</button>
            <button className={primaryButton} disabled={busy} onClick={saveCategory}>
              {busy ? 'Saving…' : 'Save category'}
            </button>
          </div>
        </Modal>
      )}

      <footer className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 text-[10px] text-[#4A4A4A] flex items-center gap-2">
        <Lock className="w-3 h-3" />
        Every console action is written to the activity log. Session audience is verified server-side on each request.
        {stats && <span className="ml-auto flex items-center gap-1"><Ban className="w-3 h-3" />{stats.totalSuperAdmins} super admin(s)</span>}
      </footer>
    </div>
  );
};
