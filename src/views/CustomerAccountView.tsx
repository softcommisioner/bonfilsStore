import React, { useState, useEffect } from 'react';
import { 
  Package, PlaneTakeoff, User, MapPin, Store, 
  ArrowLeftRight, Clock, CheckCircle2, ChevronRight, ExternalLink 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Order, ChinaRequest } from '../types';

interface CustomerAccountViewProps {
  initialTab?: 'orders' | 'china-requests' | 'profile';
  onNavigate: (route: string) => void;
}

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({ 
  initialTab = 'orders', 
  onNavigate 
}) => {
  const { user, userMode, setUserMode, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'china-requests' | 'profile'>(initialTab);

  const [orders, setOrders] = useState<Order[]>([]);
  const [chinaRequests, setChinaRequests] = useState<ChinaRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Profile edit fields
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editCity, setEditCity] = useState(user?.city || '');
  const [editCountry, setEditCountry] = useState(user?.country || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [ordersData, chinaData] = await Promise.all([
          api.getOrders(),
          api.getChinaRequests(user?.email),
        ]);
        setOrders(ordersData || []);
        setChinaRequests(chinaData || []);
      } catch (err) {
        console.error('Error fetching account data', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile({
        name: editName,
        phone: editPhone,
        city: editCity,
        country: editCountry,
      });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert('Error updating profile');
    }
  };

  const hasDualRole = user?.roles.includes('seller') && user?.roles.includes('customer');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Account Header with Dual Mode Switcher (Requirements 3 & 13) */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            Customer Dashboard
          </span>
          <h1 className="text-2xl font-extrabold text-[#222222]">
            Hello, {user?.name}
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            {user?.email} · Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
          </p>
        </div>

        {/* Dual Mode Switcher */}
        {hasDualRole && (
          <div className="p-3 bg-[#FFF3E8] border border-[#FF6A00]/30 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-xs">
              <span className="font-bold text-[#222222] flex items-center gap-1">
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#FF6A00]" />
                Customer + Seller Account
              </span>
              <span className="text-[11px] text-[#666666]">Switch modes without re-logging:</span>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setUserMode('shopping')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  userMode === 'shopping' ? 'bg-[#FF6A00] text-white shadow-xs' : 'bg-white text-[#666666] border border-[#E5E5E5]'
                }`}
              >
                Shopping Mode
              </button>
              <button
                onClick={() => {
                  setUserMode('seller');
                  onNavigate('/seller');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  userMode === 'seller' ? 'bg-[#FF6A00] text-white shadow-xs' : 'bg-white text-[#666666] border border-[#E5E5E5]'
                }`}
              >
                Seller Store
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Row */}
      <div className="border-b border-[#E5E5E5] flex gap-6 text-xs font-bold text-[#666666]">
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'orders' ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent hover:text-[#222222]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>My Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('china-requests')}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'china-requests' ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent hover:text-[#222222]'
          }`}
        >
          <PlaneTakeoff className="w-4 h-4" />
          <span>China Sourcing Requests ({chinaRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
            activeTab === 'profile' ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent hover:text-[#222222]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile & Addresses</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E5E5] p-6 space-y-3">
              <Package className="w-10 h-10 text-[#CCCCCC] mx-auto" />
              <h3 className="text-sm font-bold text-[#222222]">No orders placed yet</h3>
              <p className="text-xs text-[#888888]">Browse our verified sellers and place your first multi-vendor order.</p>
              <button
                onClick={() => onNavigate('/products')}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-xs font-bold hover:bg-[#FF8A00] cursor-pointer"
              >
                Browse Marketplace
              </button>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#F0F0F0] gap-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-[#FF6A00]">{order.orderNumber}</span>
                    <span className="text-[#888888] ml-2">Placed: {new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#222222] tabular-nums">Total: ${order.total.toFixed(2)}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#FFF3E8] text-[#FF6A00] uppercase">
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[#F0F0F0]">
                  {order.items.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.productImage || '/src/assets/images/product_cctv_camera_1790334796559.jpg'}
                          alt={item.productTitle}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded object-cover border border-[#EEEEEE] shrink-0"
                        />
                        <div className="truncate">
                          <h4 className="font-semibold text-[#222222] truncate">{item.productTitle}</h4>
                          <div className="text-[11px] text-[#666666] flex items-center gap-1.5 mt-0.5">
                            <Store className="w-3 h-3 text-[#FF6A00]" />
                            <span>Seller: {item.sellerName}</span>
                            <span>·</span>
                            <span>Qty: {item.quantity}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold text-[#222222] tabular-nums">${(item.price * item.quantity).toFixed(2)}</div>
                        {item.trackingNumber ? (
                          <button
                            onClick={() => onNavigate(`/shipping?trk=${item.trackingNumber}`)}
                            className="text-[11px] text-[#FF6A00] hover:underline flex items-center gap-0.5 justify-end font-mono"
                          >
                            <span>{item.trackingNumber}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#888888]">Packing</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-xs text-[#666666] flex justify-between items-center bg-[#FAFAFA] p-3 rounded-lg">
                  <div>
                    Delivery to: <strong>{order.shippingAddress.fullName}</strong> ({order.shippingAddress.street}, {order.shippingAddress.city})
                  </div>
                  <div className="text-[11px] text-[#888888]">
                    Paid via {order.paymentMethod.replace(/_/g, ' ').toUpperCase()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'china-requests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-[#666666]">
              Custom items sourced directly from China manufacturers for your account.
            </p>
            <button
              onClick={() => onNavigate('/china-sourcing')}
              className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-xs font-bold hover:bg-[#FF8A00] cursor-pointer flex items-center gap-1.5"
            >
              <PlaneTakeoff className="w-3.5 h-3.5" />
              <span>New China Request</span>
            </button>
          </div>

          {chinaRequests.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E5E5] p-6 space-y-3">
              <PlaneTakeoff className="w-10 h-10 text-[#CCCCCC] mx-auto" />
              <h3 className="text-sm font-bold text-[#222222]">No China sourcing requests yet</h3>
              <p className="text-xs text-[#888888]">Want an unlisted product or bulk inventory from China? Submit a request.</p>
              <button
                onClick={() => onNavigate('/china-sourcing')}
                className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-xs font-bold hover:bg-[#FF8A00] cursor-pointer"
              >
                Request Product from China
              </button>
            </div>
          ) : (
            chinaRequests.map((req) => (
              <div 
                key={req.id}
                onClick={() => onNavigate(`/china-sourcing/${req.id}`)}
                className="bg-white rounded-xl border border-[#E5E5E5] hover:border-[#FF6A00]/50 p-5 shadow-xs transition-all cursor-pointer space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#F0F0F0] gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#FF6A00]">{req.requestNumber}</span>
                    <span className="text-[#888888]">· {new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#FFF3E8] text-[#FF6A00] uppercase">
                    {req.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#222222]">{req.productName}</h3>
                    <p className="text-xs text-[#666666] line-clamp-1 mt-0.5">{req.description}</p>
                    <div className="flex items-center gap-3 text-xs text-[#888888] mt-1.5">
                      <span>Qty: {req.quantity}</span>
                      <span>·</span>
                      <span className="uppercase">{req.shippingMethod} Freight</span>
                      <span>·</span>
                      <span>Destination: {req.destination}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {req.quotation ? (
                      <div>
                        <div className="text-[11px] text-[#666666]">Quotation Total:</div>
                        <div className="text-base font-extrabold text-[#FF6A00] tabular-nums">
                          ${req.quotation.total.toFixed(2)}
                        </div>
                        <span className="text-[10px] text-[#22A06B] font-semibold">Quote Ready</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#888888]">Under Review</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F0F0F0] flex items-center justify-end text-xs font-semibold text-[#FF6A00] gap-1">
                  <span>View Full Timeline & Quotation Details</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs max-w-xl space-y-4">
          <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
            Account Information
          </h3>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 text-[#22A06B] text-xs rounded-lg">
              Profile updated successfully.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#444444] mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#444444] mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email}
              className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg bg-[#F9F9F8] text-[#888888] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#444444] mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#444444] mb-1">Country</label>
              <input
                type="text"
                required
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#444444] mb-1">City</label>
              <input
                type="text"
                required
                value={editCity}
                onChange={(e) => setEditCity(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      )}

    </div>
  );
};
