import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MultiSellerCartDrawer } from './components/MultiSellerCartDrawer';
import { EmailInboxDrawer } from './components/EmailInboxDrawer';
import { HomeView } from './views/HomeView';
import { ProductsView } from './views/ProductsView';
import { ProductDetailView } from './views/ProductDetailView';
import { ChinaSourcingView } from './views/ChinaSourcingView';
import { ChinaRequestDetailView } from './views/ChinaRequestDetailView';
import { ShippingTrackingView } from './views/ShippingTrackingView';
import { CustomerAccountView } from './views/CustomerAccountView';
import { SellerDashboardView } from './views/SellerDashboardView';
import { AdminViews } from './views/AdminViews';
import { AuthViews } from './views/AuthViews';
import { ShopsView } from './views/ShopsView';
import { CategoriesView } from './views/CategoriesView';

function MainRouter() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash.replace('#', '');
    if (path.startsWith('/admin') || hash === 'admin' || hash.startsWith('/admin')) {
      return '/admin';
    }
    return hash ? `/${hash.replace(/^\//, '')}` : (path || '/');
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [autoFilledOtp, setAutoFilledOtp] = useState<string | undefined>();

  // Synchronize route with history & hash
  const navigate = (route: string) => {
    setCurrentRoute(route);
    window.location.hash = route.startsWith('/') ? route.slice(1) : route;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      const path = window.location.pathname;
      if (path.startsWith('/admin') || hash === 'admin' || hash.startsWith('/admin')) {
        setCurrentRoute('/admin');
      } else if (hash) {
        setCurrentRoute(`/${hash.replace(/^\//, '')}`);
      } else {
        setCurrentRoute(path || '/');
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const handleSearchSubmit = () => {
    navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
  };

  const handleSelectCategory = (cat: string) => {
    setActiveCategory(cat);
    navigate(`/products?category=${encodeURIComponent(cat)}`);
  };

  // Check if viewing protected /admin route (Do NOT show public header/footer on admin page)
  const isAdminRoute = currentRoute === '/admin' || currentRoute.startsWith('/admin');

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#141414]">
        <AdminViews 
          onNavigate={navigate} 
          onOtpAutoFillCode={autoFilledOtp} 
        />
        <EmailInboxDrawer onFillOtp={(code) => setAutoFilledOtp(code)} />
      </div>
    );
  }

  // Parse path and params
  const [basePath, paramString] = currentRoute.split('?');
  const urlParams = new URLSearchParams(paramString || '');
  const searchParam = urlParams.get('search') || '';
  const categoryParam = urlParams.get('category') || '';
  const trackingParam = urlParams.get('trk') || '';
  const tabParam = (urlParams.get('tab') as any) || 'orders';

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F7] text-[#222222]">
      {/* Public Header - Strictly NO Super Admin link anywhere */}
      <Header
        onNavigate={navigate}
        currentRoute={basePath}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Main Viewport */}
      <main className="flex-1">
        {/* Home */}
        {basePath === '/' && (
          <HomeView
            onNavigate={navigate}
            onSelectCategory={handleSelectCategory}
          />
        )}

        {/* Product Catalog */}
        {basePath === '/products' && (
          <ProductsView
            onNavigate={navigate}
            initialCategory={categoryParam || activeCategory}
            initialSearch={searchParam || searchQuery}
          />
        )}

        {/* Product Detail */}
        {basePath.startsWith('/products/') && (
          <ProductDetailView
            productId={basePath.replace('/products/', '')}
            onNavigate={navigate}
          />
        )}

        {/* Categories */}
        {basePath === '/categories' && (
          <CategoriesView onSelectCategory={handleSelectCategory} />
        )}

        {/* Verified Shops / Sellers */}
        {basePath === '/shops' && (
          <ShopsView onNavigate={navigate} />
        )}

        {basePath.startsWith('/shops/') && (
          <ShopsView
            sellerId={basePath.replace('/shops/', '')}
            onNavigate={navigate}
          />
        )}

        {/* China Product Sourcing Intake */}
        {basePath === '/china-sourcing' && (
          <ChinaSourcingView onNavigate={navigate} />
        )}

        {/* China Sourcing Detail & Quotation Tracker */}
        {basePath.startsWith('/china-sourcing/') && (
          <ChinaRequestDetailView
            requestId={basePath.replace('/china-sourcing/', '')}
            onNavigate={navigate}
          />
        )}

        {/* Shipping & Freight Checkpoint Tracking */}
        {basePath === '/shipping' && (
          <ShippingTrackingView
            initialTracking={trackingParam}
            onNavigate={navigate}
          />
        )}

        {/* Customer Account & Order History */}
        {basePath === '/account' && (
          <CustomerAccountView
            initialTab={tabParam}
            onNavigate={navigate}
          />
        )}

        {/* Seller Dashboard (For verified sellers / business owners) */}
        {basePath === '/seller' && (
          <SellerDashboardView onNavigate={navigate} />
        )}

        {/* Auth Views: Login / Register / Forgot Password / OTP */}
        {basePath === '/login' && (
          <AuthViews
            initialMode="login"
            onNavigate={navigate}
            onOtpAutoFillCode={autoFilledOtp}
          />
        )}

        {basePath === '/register' && (
          <AuthViews
            initialMode="register"
            onNavigate={navigate}
            onOtpAutoFillCode={autoFilledOtp}
          />
        )}

        {basePath === '/forgot-password' && (
          <AuthViews
            initialMode="forgot_password"
            onNavigate={navigate}
            onOtpAutoFillCode={autoFilledOtp}
          />
        )}
      </main>

      {/* Multi-Seller Cart Drawer */}
      <MultiSellerCartDrawer onNavigate={navigate} />

      {/* Real-time Email & OTP Dispatcher Drawer */}
      <EmailInboxDrawer onFillOtp={(code) => setAutoFilledOtp(code)} />

      {/* Public Footer */}
      <Footer onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <MainRouter />
      </CartProvider>
    </AuthProvider>
  );
}
