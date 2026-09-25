import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, KeyRound, Mail, Users, Store, 
  Package, ShoppingCart, PlaneTakeoff, Activity, LogOut, Plus, 
  Trash2, Edit, CheckCircle2, AlertCircle, Search, DollarSign, Clock 
} from 'lucide-react';
import { api } from '../services/api';
import type { User, Business, Product, Order, ChinaRequest, AdminActivityLog, EmailRecord } from '../types';

interface AdminViewsProps {
  onNavigate: (route: string) => void;
  onOtpAutoFillCode?: string;
}

export const AdminViews: React.FC<AdminViewsProps> = ({ onNavigate, onOtpAutoFillCode }) => {
  // Admin Auth State
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('bonfils_admin_token'));
  const [adminUser, setAdminUser] = useState<User | null>(null);

  // Login & 2FA State
  const [loginStep, setLoginStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('admin@bonfilsstore.com');
  const [password, setPassword] = useState('Admin@12345');
  const [otpCode, setOtpCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Admin Console Active View
  const [activeTab, setActiveTab] = useState<
    'stats' | 'users' | 'businesses' | 'products' | 'orders' | 'china_requests' | 'activity_logs' | 'emails'
  >('stats');

  // Admin Data State
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [bizList, setBizList] = useState<Business[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [chinaList, setChinaList] = useState<ChinaRequest[]>([]);
  const [logsList, setLogsList] = useState<AdminActivityLog[]>([]);
  const [emailsList, setEmailsList] = useState<EmailRecord[]>([]);

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'customer' | 'seller' | 'staff' | 'super_admin'>('staff');
  const [newUserPassword, setNewUserPassword] = useState('');

  // Sourcing Quote Modal state
  const [selectedChinaReq, setSelectedChinaReq] = useState<ChinaRequest | null>(null);
  const [quoteProductCost, setQuoteProductCost] = useState('500');
  const [quoteLocalShip, setQuoteLocalShip] = useState('20');
  const [quoteIntlShip, setQuoteIntlShip] = useState('120');
  const [quoteServiceFee, setQuoteServiceFee] = useState('40');
  const [quoteNotes, setQuoteNotes] = useState('');

  // Auto-fill OTP if triggered from helper drawer
  useEffect(() => {
    if (onOtpAutoFillCode && loginStep === 'otp') {
      setOtpCode(onOtpAutoFillCode);
    }
  }, [onOtpAutoFillCode, loginStep]);

  // Load Admin Data when authenticated
  const loadAdminData = async () => {
    try {
      const [s, u, b, p, o, cr, l, e] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminBusinesses(),
        api.getProducts(),
        api.getOrders(),
        api.getChinaRequests(),
        api.getAdminActivityLogs(),
        api.getRecentEmails(),
      ]);
      setStats(s);
      setUsersList(u.users || []);
      setBizList(b.businesses || []);
      setProductsList(p.products || []);
      setOrdersList(o.orders || []);
      setChinaList(cr.requests || []);
      setLogsList(l.logs || []);
      setEmailsList(e.emails || []);
    } catch (err: any) {
      console.error('Error fetching admin data', err);
      if (err.message && err.message.includes('Forbidden')) {
        handleLogout();
      }
    }
  };

  useEffect(() => {
    if (adminToken) {
      loadAdminData();
    }
  }, [adminToken]);

  // Step 1: Admin Credentials Verification
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await api.adminLogin({ email, password });
      if (res.requireOtp) {
        setMaskedEmail(res.maskedEmail);
        setLoginStep('otp');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid administrator credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Admin OTP Verification
  const handleAdminOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!otpCode || otpCode.length < 6) {
      setErrorMessage('Please enter the 6-digit admin security code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.verifyAdminOtp(email, otpCode);
      setAdminToken(res.token);
      localStorage.setItem('bonfils_admin_token', res.token);
      setAdminUser(res.user);
      await loadAdminData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired OTP code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bonfils_admin_token');
    setAdminToken(null);
    setAdminUser(null);
    setLoginStep('credentials');
    setOtpCode('');
  };

  // Admin User Actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdminUser({
        name: newUserName,
        email: newUserEmail,
        role: newUserRole,
        password: newUserPassword,
      });
      setIsUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      await loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Error creating user');
    }
  };

  const handleToggleUserStatus = async (userItem: User) => {
    const nextStatus = userItem.status === 'active' ? 'disabled' : 'active';
    try {
      await api.updateAdminUser(userItem.id, { status: nextStatus });
      await loadAdminData();
    } catch (err) {
      alert('Error updating user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      await api.deleteAdminUser(userId);
      await loadAdminData();
    } catch (err) {
      alert('Error deleting user');
    }
  };

  // Prepare Quotation Submit
  const handleQuotationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChinaReq) return;

    try {
      await api.prepareQuotation(selectedChinaReq.id, {
        productCost: quoteProductCost,
        chinaLocalShipping: quoteLocalShip,
        internationalShipping: quoteIntlShip,
        serviceFee: quoteServiceFee,
        notes: quoteNotes,
      });
      setSelectedChinaReq(null);
      await loadAdminData();
      alert('Official quotation prepared and dispatched to customer email!');
    } catch (err: any) {
      alert(err.message || 'Error preparing quotation.');
    }
  };

  // If not logged in as Admin, show strictly protected Admin Login Form (Requirement 27 & 28)
  if (!adminToken) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#1F1F1F] border border-[#333333] rounded-2xl p-8 shadow-2xl text-white space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-[#FF6A00] flex items-center justify-center mx-auto shadow-md">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-wider text-white">
              Super Admin Control Console
            </h1>
            <p className="text-xs text-[#888888]">
              Restricted management portal for BONFILS STORE platform administrators
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-950/50 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {loginStep === 'credentials' ? (
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#CCCCCC] font-semibold mb-1">Admin Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#2B2B2B] border border-[#444444] rounded-lg text-white focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[#CCCCCC] font-semibold mb-1">Master Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#2B2B2B] border border-[#444444] rounded-lg text-white focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div className="p-2.5 bg-[#262626] rounded-lg border border-[#3A3A3A] text-[11px] text-[#999999]">
                Default Super Admin demo: <span className="text-[#FF6A00] font-mono">admin@bonfilsstore.com</span> / <span className="text-[#FF6A00] font-mono">Admin@12345</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md uppercase tracking-wider"
              >
                {isLoading ? 'Verifying Admin Authority...' : 'Verify Credentials'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminOtpSubmit} className="space-y-5 text-xs">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 bg-[#FF6A00]/20 text-[#FF6A00] rounded-full flex items-center justify-center mx-auto mb-1">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Super Admin 2FA Code</h3>
                <p className="text-[#888888]">
                  Verification code sent to: <span className="text-[#FF6A00] font-mono">{maskedEmail}</span>
                </p>
              </div>

              <div>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="_ _ _ _ _ _"
                  className="w-full py-3 text-center text-2xl font-mono font-black tracking-widest bg-[#2B2B2B] border-2 border-[#FF6A00] rounded-xl text-white focus:outline-none"
                />
                <span className="block text-[11px] text-[#777777] text-center mt-1">
                  Check bottom-right "Email & OTP Dispatcher" drawer for the code
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer uppercase tracking-wider shadow-md"
              >
                {isLoading ? 'Authenticating...' : 'Enter Super Admin Dashboard'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setLoginStep('credentials')}
                  className="text-[#888888] hover:text-white text-xs cursor-pointer"
                >
                  ← Back to Credentials
                </button>
              </div>
            </form>
          )}

          <div className="text-center pt-2 border-t border-[#2A2A2A] text-[11px] text-[#666666]">
            Strict RBAC Authorization Active · Server-Side Token Verified
          </div>
        </div>
      </div>
    );
  }

  // =========================================
  // AUTHENTICATED SUPER ADMIN CONSOLE
  // =========================================
  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col">
      
      {/* Top Admin Navbar */}
      <header className="bg-[#1F1F1F] text-white border-b-2 border-[#FF6A00] px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#FF6A00] flex items-center justify-center font-extrabold text-white">
            B
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight">
              BONFILS STORE <span className="text-[#FF6A00] text-xs font-normal">| Super Admin Console</span>
            </div>
            <div className="text-[10px] text-[#888888]">Direct Infrastructure & Multi-Vendor Control</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <button
            onClick={() => onNavigate('/')}
            className="text-[#AAAAAA] hover:text-white cursor-pointer"
          >
            Preview Public Store →
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#2B2B2B] hover:bg-red-900/60 text-red-300 rounded font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Admin Workspace with Sidebar (Requirement 29) */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Admin Navigation Sidebar */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-[#E5E5E5] p-4 shadow-xs space-y-1">
          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'stats' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Dashboard Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'users' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('businesses')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'businesses' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Business Owners & Shops</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'products' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Marketplace Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'orders' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Orders Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('china_requests')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'china_requests' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <PlaneTakeoff className="w-4 h-4" />
            <span>China Requests ({chinaList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('activity_logs')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'activity_logs' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Activity Audit Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'emails' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#555555] hover:bg-[#F7F7F7]'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email & OTP History</span>
          </button>
        </aside>

        {/* Admin Content Area */}
        <main className="lg:col-span-9 space-y-6">
          
          {/* TAB 1: METRICS & STATS */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-xs">
                  <span className="text-[11px] text-[#888888] font-semibold">Total Revenue</span>
                  <div className="text-xl font-black text-[#FF6A00] tabular-nums mt-1">
                    ${stats.totalRevenue?.toFixed(2) || '0.00'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-xs">
                  <span className="text-[11px] text-[#888888] font-semibold">Total Users</span>
                  <div className="text-xl font-black text-[#222222] tabular-nums mt-1">
                    {stats.totalUsers}
                  </div>
                  <span className="text-[10px] text-[#888888]">Customers: {stats.totalCustomers} · Sellers: {stats.totalSellers}</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-xs">
                  <span className="text-[11px] text-[#888888] font-semibold">China Requests</span>
                  <div className="text-xl font-black text-[#222222] tabular-nums mt-1">
                    {stats.chinaRequestsCount}
                  </div>
                  <span className="text-[10px] text-[#22A06B] font-bold">Active: {stats.activeChinaRequests}</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-xs">
                  <span className="text-[11px] text-[#888888] font-semibold">Live Shipments</span>
                  <div className="text-xl font-black text-[#222222] tabular-nums mt-1">
                    {stats.activeShipments}
                  </div>
                  <span className="text-[10px] text-[#666666]">Air & Sea Containers</span>
                </div>
              </div>

              {/* Recent Sourcing Requests Alert */}
              <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                    Recent China Sourcing Intake
                  </h3>
                  <button
                    onClick={() => setActiveTab('china_requests')}
                    className="text-xs text-[#FF6A00] hover:underline font-semibold cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                <div className="divide-y divide-[#F0F0F0]">
                  {chinaList.slice(0, 3).map((req) => (
                    <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-mono font-bold text-[#FF6A00]">{req.requestNumber}</span>
                        <h4 className="font-bold text-[#222222] mt-0.5">{req.productName}</h4>
                        <div className="text-[11px] text-[#666666]">
                          Customer: {req.customerName} ({req.customerEmail}) · Qty: {req.quantity}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF3E8] text-[#FF6A00]">
                          {req.status}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedChinaReq(req);
                            setActiveTab('china_requests');
                          }}
                          className="px-3 py-1 bg-[#FF6A00] text-white rounded font-bold text-xs cursor-pointer"
                        >
                          Prepare Quote
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                    User Accounts & Roles
                  </h3>
                  <p className="text-xs text-[#666666]">Total accounts: {usersList.length}</p>
                </div>

                <button
                  onClick={() => setIsUserModalOpen(true)}
                  className="px-3 py-1.5 bg-[#FF6A00] text-white rounded-lg text-xs font-bold hover:bg-[#FF8A00] cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create User</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F7] text-[#666666] border-y border-[#E5E5E5]">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Roles</th>
                      <th className="py-2.5 px-3">Verified</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-[#FAFAFA]">
                        <td className="py-3 px-3 font-semibold text-[#222222]">{u.name}</td>
                        <td className="py-3 px-3 text-[#555555] font-mono">{u.email}</td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[10px] bg-[#EEEEEE] text-[#444444] px-2 py-0.5 rounded">
                            {u.roles.join(', ')}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-bold ${u.isVerified ? 'text-[#22A06B]' : 'text-amber-600'}`}>
                            {u.isVerified ? 'YES' : 'PENDING OTP'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'active' ? 'bg-emerald-50 text-[#22A06B]' : 'bg-red-50 text-[#D92D20]'}`}>
                            {u.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className="text-[11px] font-semibold text-[#666666] hover:text-[#222222] cursor-pointer"
                            >
                              {u.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 text-[#888888] hover:text-[#D92D20] cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BUSINESSES / SHOPS */}
          {activeTab === 'businesses' && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                Registered Businesses & Multi-Vendors ({bizList.length})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bizList.map((biz) => (
                  <div key={biz.id} className="p-4 rounded-xl border border-[#E5E5E5] space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-[#222222] text-sm">{biz.name}</h4>
                        <span className="text-[11px] text-[#666666]">{biz.city}, {biz.country}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        biz.type === 'official' ? 'bg-[#222222] text-white' : 'bg-[#FFF3E8] text-[#FF6A00]'
                      }`}>
                        {biz.type === 'official' ? 'OFFICIAL STORE' : 'EXTERNAL SELLER'}
                      </span>
                    </div>

                    <p className="text-xs text-[#555555] line-clamp-2">{biz.description}</p>

                    <div className="pt-2 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#777777]">
                      <span>Rating: <strong className="text-[#222222]">{biz.rating}</strong></span>
                      <span>Products: <strong className="text-[#222222]">{biz.totalProducts}</strong></span>
                      <span>Status: <strong className="text-[#22A06B]">{biz.status.toUpperCase()}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CHINA SOURCING REQUESTS & QUOTATION SYSTEM */}
          {activeTab === 'china_requests' && (
            <div className="space-y-6">
              
              {/* Prepare Quotation Modal Drawer if selected */}
              {selectedChinaReq && (
                <div className="bg-[#FFF8F2] border-2 border-[#FF6A00] rounded-2xl p-6 shadow-sm space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#FF6A00]/20">
                    <h3 className="text-sm font-bold text-[#222222]">
                      Prepare Itemized Quotation for {selectedChinaReq.requestNumber}
                    </h3>
                    <button
                      onClick={() => setSelectedChinaReq(null)}
                      className="text-xs text-[#666666] hover:text-[#222222] cursor-pointer"
                    >
                      Close ✕
                    </button>
                  </div>

                  <p className="text-xs text-[#666666]">
                    Product: <strong>{selectedChinaReq.productName}</strong> · Qty: <strong>{selectedChinaReq.quantity}</strong> · Customer: <strong>{selectedChinaReq.customerName}</strong> ({selectedChinaReq.customerEmail})
                  </p>

                  <form onSubmit={handleQuotationSubmit} className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold text-[#444444] mb-1">Product Cost ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={quoteProductCost}
                          onChange={(e) => setQuoteProductCost(e.target.value)}
                          className="w-full px-3 py-1.5 border border-[#E5E5E5] rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#444444] mb-1">China Local Ship ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={quoteLocalShip}
                          onChange={(e) => setQuoteLocalShip(e.target.value)}
                          className="w-full px-3 py-1.5 border border-[#E5E5E5] rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#444444] mb-1">Int'l Freight ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={quoteIntlShip}
                          onChange={(e) => setQuoteIntlShip(e.target.value)}
                          className="w-full px-3 py-1.5 border border-[#E5E5E5] rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#444444] mb-1">Service Fee ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={quoteServiceFee}
                          onChange={(e) => setQuoteServiceFee(e.target.value)}
                          className="w-full px-3 py-1.5 border border-[#E5E5E5] rounded bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#444444] mb-1">Procurement Notes / Factory Guarantee</label>
                      <input
                        type="text"
                        value={quoteNotes}
                        onChange={(e) => setQuoteNotes(e.target.value)}
                        placeholder="e.g. Sourced from Ningbo Tier-1 factory. CE & ISO verified."
                        className="w-full px-3 py-1.5 border border-[#E5E5E5] rounded bg-white"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <div className="text-base font-bold text-[#FF6A00]">
                        TOTAL: ${(
                          (parseFloat(quoteProductCost) || 0) +
                          (parseFloat(quoteLocalShip) || 0) +
                          (parseFloat(quoteIntlShip) || 0) +
                          (parseFloat(quoteServiceFee) || 0)
                        ).toFixed(2)}
                      </div>

                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Issue & Dispatch Quotation Email
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Sourcing Requests Table */}
              <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                  China Sourcing Requests Pipeline
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F7] text-[#666666] border-y border-[#E5E5E5]">
                      <tr>
                        <th className="py-2.5 px-3">Request ID</th>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Shipping</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F0]">
                      {chinaList.map((req) => (
                        <tr key={req.id} className="hover:bg-[#FAFAFA]">
                          <td className="py-3 px-3 font-mono font-bold text-[#FF6A00]">{req.requestNumber}</td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-[#222222] line-clamp-1 max-w-xs">{req.productName}</div>
                            <span className="text-[10px] text-[#888888]">Qty: {req.quantity}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#222222]">{req.customerName}</div>
                            <div className="text-[10px] text-[#888888]">{req.customerEmail}</div>
                          </td>
                          <td className="py-3 px-3 uppercase text-[11px] font-semibold">{req.shippingMethod}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFF3E8] text-[#FF6A00]">
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => setSelectedChinaReq(req)}
                              className="px-3 py-1 bg-[#222222] hover:bg-[#333333] text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Quote / Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVITY AUDIT LOGS */}
          {activeTab === 'activity_logs' && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                System Activity & Security Audit Logs (Requirement 33)
              </h3>

              <div className="divide-y divide-[#F0F0F0] text-xs">
                {logsList.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EEEEEE] text-[#444444]">
                          {log.action}
                        </span>
                        <span className="font-semibold text-[#222222]">{log.actorName}</span>
                        <span className="text-[#888888]">({log.actorRole})</span>
                      </div>
                      <p className="text-[#555555] text-[11px] mt-1">{log.details}</p>
                    </div>

                    <span className="text-[10px] text-[#888888] shrink-0 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: TRANSACTIONAL EMAILS LOG */}
          {activeTab === 'emails' && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
                Dispatched Transactional Emails & Verification Codes
              </h3>

              <div className="divide-y divide-[#F0F0F0] text-xs">
                {emailsList.map((e) => (
                  <div key={e.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#FF6A00] uppercase text-[11px]">{e.purpose.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-[#888888] font-mono">{new Date(e.sentAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-semibold text-[#222222]">{e.subject}</div>
                    <div className="text-[#666666] text-[11px]">To: {e.to}</div>
                    {e.otpCode && (
                      <div className="p-2 bg-[#FFF3E8] border border-[#FF6A00]/30 rounded text-[#FF6A00] font-mono font-bold text-xs inline-block my-1">
                        Active Verification OTP: {e.otpCode}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>

      </div>

      {/* Create User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#222222]">Create User Account</h3>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#444444] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444444] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444444] mb-1">Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none bg-white"
                >
                  <option value="customer">Customer</option>
                  <option value="seller">Seller / Business Owner</option>
                  <option value="staff">Staff (Sourcing Team)</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#444444] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#F0F0F0]">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded-lg font-semibold text-[#666666] hover:bg-[#F7F7F7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6A00] hover:bg-[#FF8A00] text-white font-bold rounded-lg cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
