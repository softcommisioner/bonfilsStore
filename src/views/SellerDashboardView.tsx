import React, { useState, useEffect } from 'react';
import { 
  Store, Package, ShoppingCart, DollarSign, Plus, 
  Trash2, Edit, Truck, ArrowLeftRight, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { Product, Order, Business, Category } from '../types';

interface SellerDashboardViewProps {
  onNavigate: (route: string) => void;
}

export const SellerDashboardView: React.FC<SellerDashboardViewProps> = ({ onNavigate }) => {
  const { user, userMode, setUserMode } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'profile'>('overview');
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalUnitsSold: 0,
    pendingOrders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Add/Edit Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodOriginalPrice, setProdOriginalPrice] = useState('');
  const [prodStock, setProdStock] = useState('20');
  const [prodImage, setProdImage] = useState('');
  const [shippingTime, setShippingTime] = useState('1 - 2 Days');

  // Order status update state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderTrackingNum, setOrderTrackingNum] = useState('');

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [data, categoryList] = await Promise.all([
        api.getSellerDashboard(),
        api.getCategories().catch(() => [] as Category[]),
      ]);
      setBusiness(data.business);
      setProducts(data.products || []);
      setOrders(data.orders || []);
      setMetrics(data.metrics || {});
      setCategories(categoryList || []);
    } catch (err) {
      console.error('Error fetching seller dashboard', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setProdTitle('');
    setProdDesc('');
    setProdCategory(categories[0]?.name || '');
    setProdPrice('');
    setProdOriginalPrice('');
    setProdStock('20');
    setProdImage('');
    setShippingTime('1 - 2 Days');
    setIsProductModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setProdTitle(p.title);
    setProdDesc(p.description);
    setProdCategory(p.category);
    setProdPrice(p.price.toString());
    setProdOriginalPrice(p.originalPrice ? p.originalPrice.toString() : '');
    setProdStock(p.stock.toString());
    setProdImage(p.images[0] || '');
    setShippingTime(p.shippingTimeDays);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title: prodTitle,
        description: prodDesc,
        category: prodCategory,
        price: prodPrice,
        originalPrice: prodOriginalPrice || undefined,
        stock: prodStock,
        images: prodImage ? [prodImage] : ['/src/assets/images/product_cctv_camera_1790334796559.jpg'],
        shippingTimeDays: shippingTime,
      };

      if (editingProduct) {
        await api.updateSellerProduct(editingProduct.id, payload);
      } else {
        await api.createSellerProduct(payload);
      }

      setIsProductModalOpen(false);
      await fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Error saving product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteSellerProduct(id);
      await fetchDashboardData();
    } catch (err) {
      alert('Error deleting product');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.updateSellerOrderStatus(orderId, {
        status,
        trackingNumber: orderTrackingNum || undefined,
      });
      setSelectedOrderId(null);
      setOrderTrackingNum('');
      await fetchDashboardData();
    } catch (err) {
      alert('Error updating order');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Seller Header */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
              Seller & Business Console
            </span>
            {business?.isVerified && (
              <span className="text-[10px] bg-emerald-50 text-[#22A06B] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Verified Merchant
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[#222222] mt-0.5">
            {business?.name || `${user?.name}'s Store`}
          </h1>
          <p className="text-xs text-[#666666]">
            {business?.description || 'Independent multi-vendor shop on BONFILS STORE'}
          </p>
        </div>

        {/* Mode Switcher Button (Requirements 3 & 13) */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setUserMode('shopping');
              onNavigate('/');
            }}
            className="px-4 py-2 border border-[#FF6A00] text-[#FF6A00] hover:bg-[#FFF3E8] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Switch to Shopping Mode</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#FF6A00] hover:bg-[#FF8A00] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E5E5] flex gap-6 text-xs font-bold text-[#666666]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'overview' ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent hover:text-[#222222]'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'products' ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent hover:text-[#222222]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Manage Products ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'orders' ? 'border-[#FF6A00] text-[#FF6A00]' : 'border-transparent hover:text-[#222222]'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Customer Orders ({orders.length})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-xl border border-[#E5E5E5] shadow-xs">
              <span className="text-xs text-[#888888] font-semibold">Total Revenue</span>
              <div className="text-2xl font-black text-[#FF6A00] tabular-nums mt-1">
                ${metrics.totalRevenue.toFixed(2)}
              </div>
              <span className="text-[11px] text-[#22A06B] font-medium mt-1 block">From verified customer orders</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-[#E5E5E5] shadow-xs">
              <span className="text-xs text-[#888888] font-semibold">Units Sold</span>
              <div className="text-2xl font-black text-[#222222] tabular-nums mt-1">
                {metrics.totalUnitsSold}
              </div>
              <span className="text-[11px] text-[#666666] mt-1 block">Across all catalog items</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-[#E5E5E5] shadow-xs">
              <span className="text-xs text-[#888888] font-semibold">Live Products</span>
              <div className="text-2xl font-black text-[#222222] tabular-nums mt-1">
                {products.length}
              </div>
              <span className="text-[11px] text-[#666666] mt-1 block">Active on marketplace</span>
            </div>

            <div className="p-5 bg-white rounded-xl border border-[#E5E5E5] shadow-xs">
              <span className="text-xs text-[#888888] font-semibold">Pending Fulfillment</span>
              <div className="text-2xl font-black text-[#F5A623] tabular-nums mt-1">
                {metrics.pendingOrders}
              </div>
              <span className="text-[11px] text-[#888888] mt-1 block">Requires dispatch</span>
            </div>
          </div>

          {/* Recent Orders in Seller Shop */}
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
              Recent Orders Requiring Dispatch
            </h3>

            {orders.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#888888]">
                No customer orders for your store yet.
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-mono font-bold text-[#FF6A00]">{order.orderNumber}</span>
                      <span className="text-[#888888] ml-2">by {order.customerName}</span>
                      <div className="text-[11px] text-[#666666] mt-0.5">
                        Deliver to: {order.shippingAddress.city}, {order.shippingAddress.street}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 rounded font-bold uppercase text-[10px] bg-[#FFF3E8] text-[#FF6A00]">
                        {order.status}
                      </span>
                      <button
                        onClick={() => setActiveTab('orders')}
                        className="text-xs text-[#FF6A00] font-semibold hover:underline cursor-pointer"
                      >
                        Manage Dispatch →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Products */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#222222] uppercase tracking-wide">
              Store Catalog ({products.length} Items)
            </h3>
            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-1.5 bg-[#FF6A00] text-white rounded-lg text-xs font-bold hover:bg-[#FF8A00] cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F7F7] text-[#666666] border-y border-[#E5E5E5]">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Stock</th>
                  <th className="py-2.5 px-3">Sales</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAFAFA]">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={p.images[0] || '/src/assets/images/product_cctv_camera_1790334796559.jpg'}
                          alt={p.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 object-cover rounded border border-[#EEEEEE]"
                        />
                        <span className="font-semibold text-[#222222] line-clamp-1 max-w-xs">{p.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[#666666]">{p.category}</td>
                    <td className="py-3 px-3 font-bold text-[#FF6A00] tabular-nums">${p.price.toFixed(2)}</td>
                    <td className="py-3 px-3 tabular-nums">{p.stock}</td>
                    <td className="py-3 px-3 tabular-nums font-semibold text-[#222222]">{p.salesCount}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-[#666666] hover:text-[#222222] hover:bg-[#F0F0F0] rounded cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 text-[#888888] hover:text-[#D92D20] hover:bg-red-50 rounded cursor-pointer"
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

      {/* Tab 3: Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E5E5] text-xs text-[#888888]">
              No orders received yet.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#F0F0F0] gap-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-[#FF6A00]">{order.orderNumber}</span>
                    <span className="text-[#888888] ml-2">Customer: {order.customerName} ({order.customerPhone})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#666666]">Status:</span>
                    <span className="px-2 py-0.5 rounded font-bold uppercase text-[10px] bg-[#FFF3E8] text-[#FF6A00]">
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-[#F0F0F0]">
                  {order.items.map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.productImage || '/src/assets/images/product_cctv_camera_1790334796559.jpg'}
                          alt={item.productTitle}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded object-cover border border-[#EEEEEE]"
                        />
                        <div>
                          <div className="font-semibold text-[#222222]">{item.productTitle}</div>
                          <div className="text-[11px] text-[#666666]">Qty: {item.quantity} · Price: ${item.price.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-[#222222] tabular-nums">${(item.price * item.quantity).toFixed(2)}</div>
                        {item.trackingNumber && (
                          <div className="text-[10px] text-[#22A06B] font-mono">Trk: {item.trackingNumber}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dispatch Controls */}
                <div className="pt-3 border-t border-[#F0F0F0] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-[#666666]">
                    Delivery: <strong>{order.shippingAddress.street}, {order.shippingAddress.city}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedOrderId === order.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={orderTrackingNum}
                          onChange={(e) => setOrderTrackingNum(e.target.value)}
                          placeholder="Tracking # (e.g. KGL-8812)"
                          className="px-2.5 py-1 text-xs border border-[#E5E5E5] rounded focus:border-[#FF6A00] focus:outline-none"
                        />
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'shipped')}
                          className="px-3 py-1 bg-[#22A06B] text-white rounded font-bold cursor-pointer"
                        >
                          Confirm Shipped
                        </button>
                        <button
                          onClick={() => setSelectedOrderId(null)}
                          className="px-2 py-1 text-[#666666] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'processing')}
                          className="px-3 py-1.5 bg-[#F7F7F7] hover:bg-[#EEEEEE] text-[#444444] rounded font-semibold cursor-pointer"
                        >
                          Mark Processing
                        </button>
                        <button
                          onClick={() => setSelectedOrderId(order.id)}
                          className="px-3 py-1.5 bg-[#FF6A00] hover:bg-[#FF8A00] text-white rounded font-bold cursor-pointer"
                        >
                          Ship Order
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#222222]">
              {editingProduct ? 'Edit Product' : 'Add New Product to Store'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#444444] mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={prodTitle}
                  onChange={(e) => setProdTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444444] mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#444444] mb-1">Category</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none bg-white"
                  >
                    {categories.length === 0 && (
                      <option value="">No categories available</option>
                    )}
                    {categories.map(category => (
                      <option key={category.id} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#444444] mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#444444] mb-1">Original Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodOriginalPrice}
                    onChange={(e) => setProdOriginalPrice(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#444444] mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#444444] mb-1">Image URL</label>
                <input
                  type="text"
                  value={prodImage}
                  onChange={(e) => setProdImage(e.target.value)}
                  placeholder="URL or leave empty for default studio asset"
                  className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg focus:border-[#FF6A00] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#F0F0F0]">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E5] rounded-lg font-semibold text-[#666666] hover:bg-[#F7F7F7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#FF6A00] hover:bg-[#FF8A00] text-white font-bold rounded-lg cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
