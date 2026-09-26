import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Lock, Mail, LogOut, LayoutDashboard, Package, Tags, ShoppingCart,
  Users, Store, PlaneTakeoff, ScrollText, Send, Plus, Search, Pencil, Trash2,
  X, RefreshCw, AlertTriangle, Star, Upload, KeyRound, Ban, CheckCircle2, EyeOff,
} from 'lucide-react';
import { api } from '../services/api';
import { resolveProductImage } from '../services/images';
import type {
  AdminActivityLog, AdminStats, Business, Category, ChinaRequest, Order, Product, User,
} from '../types';

interface AdminViewsProps {
  onNavigate: (route: string) => void;
}

type AdminTab =
  | 'overview' | 'products' | 'categories' | 'orders'
  | 'users' | 'businesses' | 'china' | 'activity' | 'email';

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

const emptyProductDraft = {
  id: '',
  title: '',
  description: '',
  category: '',
  brand: '',
  price: '',
  originalPrice: '',
  stock: '',
  businessId: 'BIZ-001',
  images: [] as string[],
  shippingOrigin: 'Kigali Local Warehouse',
  shippingTimeDays: '1 - 2 Days',
  isFeatured: false,
  isActive: true,
  specifications: '',
};

type ProductDraft = typeof emptyProductDraft;

// ------------------------------------------------------------------ sign in
function AdminGate({ onVerified, onCancel }: { onVerified: (user: User) => void; onCancel: () => void }) {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submitCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api.adminLogin({ email: email.trim(), password });
      if (!result.requireOtp) {
        setError('Two-step verification is required for administrator access.');
        return;
      }
      setMaskedEmail(result.maskedEmail || result.email);
      setStep('otp');
      setNotice(result.message || `A verification code was sent to ${result.maskedEmail || result.email}.`);
    } catch (err: any) {
      setError(err.message || 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.verifyAdminOtp(email.trim(), otpCode.trim());
      onVerified(result.user);
    } catch (err: any) {
      setError(err.message || 'That verification code is not valid.');
      setOtpCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.resendOtp(email.trim(), 'admin_login');
      setNotice(result.message || 'A new code is on its way.');
      setCooldown(45);
    } catch (err: any) {
      setError(err.message || 'Could not send a new code.');
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
            Restricted access. Credentials plus a one-time email code are required for every session.
          </p>
        </div>

        {step === 'credentials' ? (
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
                placeholder="admin@bonfilsstore.com"
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
              {busy ? 'Verifying credentials…' : 'Continue to verification'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <div className="rounded-lg border border-[#2E2E2E] bg-[#141414] px-3 py-2 text-[11px] text-[#999999]">
              Code sent to <span className="text-white font-bold">{maskedEmail}</span>
            </div>
            <div>
              <label className={labelClass}>6-digit verification code</label>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputClass} text-center text-lg tracking-[0.4em]`}
                placeholder="000000"
              />
            </div>
            {notice && <p className="text-[11px] text-emerald-400">{notice}</p>}
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <button type="submit" disabled={busy || otpCode.length !== 6} className={`${primaryButton} w-full`}>
              {busy ? 'Signing in…' : 'Verify and open console'}
            </button>
            <div className="flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => { setStep('credentials'); setOtpCode(''); setError(''); setNotice(''); }}
                className="text-[#888888] hover:text-white cursor-pointer"
              >
                Use a different account
              </button>
              <button type="button" onClick={resend} disabled={busy || cooldown > 0} className="text-[#FF6A00] hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

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
  const [admin, setAdmin] = useState<User | null>(null);
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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);
  const [userDraft, setUserDraft] = useState<any>(null);
  const [businessDraft, setBusinessDraft] = useState<any>(null);
  const [categoryDraft, setCategoryDraft] = useState<any>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
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
      const [statsData, productData, categoryData, businessData, userData, orderData, chinaData, logData, emailData] =
        await Promise.all([
          api.getAdminStats(),
          api.getAdminProducts({ pageSize: '100', search: productSearch }),
          api.getAdminCategories(),
          api.getAdminBusinesses(),
          api.getAdminUsers(),
          api.getAdminOrders(),
          api.getAdminChinaRequests(),
          api.getAdminActivityLogs(80),
          api.getAdminEmails(40),
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
    } catch (err: any) {
      if (err?.status === 401 || err?.status === 403) {
        api.clearAdminToken();
        setAdmin(null);
      } else {
        setError(err.message || 'Failed to load the console data.');
      }
    } finally {
      setBusy(false);
    }
  }, [productSearch]);

  useEffect(() => {
    (async () => {
      if (!api.getAdminToken()) {
        setBooting(false);
        return;
      }
      try {
        const session = await api.getAdminSession();
        setAdmin(session.user);
      } catch {
        api.clearAdminToken();
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (admin) loadAll();
  }, [admin]);

  useEffect(() => {
    if (!admin || tab !== 'products') return;
    const timer = setTimeout(() => { loadProducts().catch(() => undefined); }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, tab, admin, loadProducts]);

  const logout = async () => {
    await api.adminLogout();
    setAdmin(null);
    setStats(null);
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
      setProductDraft(null);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Could not save the product.');
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
      setError(err.message || 'Could not delete the product.');
    }
  };

  const uploadProductImage = async (file: File) => {
    if (!productDraft) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
      });
      const result = await api.adminUploadImage(dataUrl, file.name, 'products');
      setProductDraft({ ...productDraft, images: [...productDraft.images, result.url].slice(0, 8) });
      flash('Image uploaded.');
    } catch (err: any) {
      setError(err.message || 'Image upload failed.');
    } finally {
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
      setError(err.message || 'Could not save the account.');
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
      setError(err.message || 'Could not delete the account.');
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
      setError(err.message || 'Could not save the store.');
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
      setError(err.message || 'Could not save the category.');
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
      setError(err.message || 'Could not update the order.');
    }
  };

  const assignStaff = async (request: ChinaRequest, staffId: string) => {
    try {
      await api.assignStaffToChinaRequest(request.id, staffId);
      flash(`${request.requestNumber} reassigned.`);
      await loadAll();
    } catch (err: any) {
      setError(err.message || 'Could not assign that request.');
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
    return <AdminGate onVerified={setAdmin} onCancel={() => onNavigate('/')} />;
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
              <p className="text-[10px] text-[#666666] truncate">{admin.email} · verified session</p>
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
                  onClick={() => setProductDraft({ ...emptyProductDraft, category: categories[0]?.name || '' })}
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
                          {product.isFeatured && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FF6A00]/15 text-[#FF6A00]">featured</span>}
                        </div>
                      </td>
                      <td className="py-2 text-right whitespace-nowrap">
                        <button
                          className="text-[#888888] hover:text-[#FF6A00] mr-3 cursor-pointer"
                          onClick={() => setProductDraft({
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
                            isFeatured: product.isFeatured,
                            isActive: product.isActive,
                            specifications: Object.entries(product.specifications || {})
                              .map(([key, value]) => `${key}: ${value}`)
                              .join('\n'),
                          })}
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
                        {request.customerName} · {request.customerEmail} · {request.country} · qty {request.quantity}
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
                ? 'Resend is configured: messages are being delivered and recorded.'
                : 'Resend is not configured. Set RESEND_API_KEY and EMAIL_FROM so codes and updates can be delivered.'}
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
      </main>

      {productDraft && (
        <Modal title={productDraft.id ? 'Edit product' : 'New product'} onClose={() => setProductDraft(null)} wide>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Title</label>
              <input className={inputClass} value={productDraft.title} onChange={e => setProductDraft({ ...productDraft, title: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select className={inputClass} value={productDraft.category} onChange={e => setProductDraft({ ...productDraft, category: e.target.value })}>
                {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Store</label>
              <select className={inputClass} value={productDraft.businessId} onChange={e => setProductDraft({ ...productDraft, businessId: e.target.value })}>
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
                      onClick={() => setProductDraft({ ...productDraft, images: productDraft.images.filter((_, i) => i !== index) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!productDraft.images.length && <span className="text-[11px] text-[#666666]">No images yet.</span>}
              </div>
              <label className={ghostButton}>
                <Upload className="w-3.5 h-3.5 mr-1 inline" />Upload image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => { const file = e.target.files?.[0]; if (file) uploadProductImage(file); e.target.value = ''; }}
                />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className={ghostButton} onClick={() => setProductDraft(null)}>Cancel</button>
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
