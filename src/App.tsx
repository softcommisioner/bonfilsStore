import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MultiSellerCartDrawer } from './components/MultiSellerCartDrawer';
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

function NotFoundView({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
      <p className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">Error 404</p>
      <h1 className="text-3xl font-extrabold text-[#222222]">This page could not be found</h1>
      <p className="text-sm text-[#666666]">
        The link may be broken or the product may have been removed from the catalogue.
      </p>
      <button
        onClick={() => onNavigate('/')}
        className="inline-block px-6 py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg cursor-pointer"
      >
        Back to homepage
      </button>
    </div>
  );
}

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

  // The Super Admin console is never linked from the public shell.
  const isAdminRoute = currentRoute === '/admin' || currentRoute.startsWith('/admin');

  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#141414]">
        <AdminViews onNavigate={navigate} />
      </div>
    );
  }

  const [basePath, paramString] = currentRoute.split('?');
  const urlParams = new URLSearchParams(paramString || '');
  const searchParam = urlParams.get('search') || '';
  const categoryParam = urlParams.get('category') || '';
  const sortParam = urlParams.get('sort') || '';
  const featuredParam = urlParams.get('featured') || '';
  const trackingParam = urlParams.get('trk') || '';
  const tabParam = (urlParams.get('tab') as any) || 'orders';

  const knownRoutes = [
    '/', '/products', '/categories', '/shops', '/china-sourcing', '/shipping',
    '/account', '/seller', '/login', '/register', '/forgot-password',
  ];
  const isKnownRoute = knownRoutes.includes(basePath)
    || basePath.startsWith('/products/')
    || basePath.startsWith('/shops/')
    || basePath.startsWith('/china-sourcing/');

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

      <main className="flex-1">
        {basePath === '/' && (
          <HomeView onNavigate={navigate} onSelectCategory={handleSelectCategory} />
        )}

        {basePath === '/products' && (
          <ProductsView
            onNavigate={navigate}
            initialCategory={categoryParam || activeCategory}
            initialSearch={searchParam || searchQuery}
            initialSort={sortParam}
            initialFeatured={featuredParam}
          />
        )}

        {basePath.startsWith('/products/') && (
          <ProductDetailView
            productId={basePath.replace('/products/', '')}
            onNavigate={navigate}
          />
        )}

        {basePath === '/categories' && (
          <CategoriesView onSelectCategory={handleSelectCategory} />
        )}

        {basePath === '/shops' && (
          <ShopsView onNavigate={navigate} />
        )}

        {basePath.startsWith('/shops/') && (
          <ShopsView sellerId={basePath.replace('/shops/', '')} onNavigate={navigate} />
        )}

        {basePath === '/china-sourcing' && (
          <ChinaSourcingView onNavigate={navigate} />
        )}

        {basePath.startsWith('/china-sourcing/') && (
          <ChinaRequestDetailView
            requestId={basePath.replace('/china-sourcing/', '')}
            onNavigate={navigate}
          />
        )}

        {basePath === '/shipping' && (
          <ShippingTrackingView initialTracking={trackingParam} onNavigate={navigate} />
        )}

        {basePath === '/account' && (
          <CustomerAccountView initialTab={tabParam} onNavigate={navigate} />
        )}

        {basePath === '/seller' && (
          <SellerDashboardView onNavigate={navigate} />
        )}

        {basePath === '/login' && <AuthViews initialMode="login" onNavigate={navigate} />}
        {basePath === '/register' && <AuthViews initialMode="register" onNavigate={navigate} />}
        {basePath === '/forgot-password' && <AuthViews initialMode="forgot_password" onNavigate={navigate} />}

        {!isKnownRoute && <NotFoundView onNavigate={navigate} />}
      </main>

      <MultiSellerCartDrawer onNavigate={navigate} />

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
