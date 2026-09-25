import React, { useState } from 'react';
import { 
  Search, ShoppingCart, User as UserIcon, Globe, 
  Package, PlaneTakeoff, Store, LogOut, ChevronDown, 
  ArrowLeftRight, Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

interface HeaderProps {
  onNavigate: (route: string) => void;
  currentRoute: string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchSubmit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  currentRoute,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
}) => {
  const { user, isAuthenticated, userMode, setUserMode, logout } = useAuth();
  const { itemCount, setIsCartOpen } = useCart();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const hasDualRole = user?.roles.includes('seller') && user?.roles.includes('customer');

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E5E5E5] shadow-xs">
      {/* Top micro announcement bar */}
      <div className="bg-[#222222] text-white text-xs px-4 py-1.5 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 text-[#CCCCCC]">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#FF6A00]" />
              Direct China Sourcing & Worldwide Air/Sea Freight
            </span>
            <span>·</span>
            <span>Verified East Africa Logistics Hub</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <button 
              onClick={() => onNavigate('/shipping')} 
              className="text-[#E0E0E0] hover:text-[#FF6A00] transition-colors cursor-pointer"
            >
              Track Shipment
            </button>
            <span>·</span>
            <button 
              onClick={() => onNavigate('/china-sourcing')} 
              className="text-[#FF8A00] hover:text-white font-medium transition-colors cursor-pointer"
            >
              Request Custom Product from China
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Zone Navigation Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4 md:gap-8">
          
          {/* Zone 1: Brand Wordmark (Single clean typography element) */}
          <button 
            onClick={() => onNavigate('/')} 
            className="flex items-center gap-2 group text-left cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] flex items-center justify-center text-white font-black text-xl shadow-xs group-hover:opacity-95 transition-opacity">
              B
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-extrabold tracking-tight text-[#222222]">
                BONFILS<span className="text-[#FF6A00]"> STORE</span>
              </span>
              <span className="text-[10px] tracking-wider uppercase text-[#888888] font-medium mt-0.5">
                Marketplace · China Sourcing
              </span>
            </div>
          </button>

          {/* Central Search Bar (Alibaba-inspired orange search box) */}
          <div className="flex-1 max-w-2xl hidden md:block">
            <div className="flex items-center border-2 border-[#FF6A00] rounded-lg overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-[#FF6A00]/20 transition-all">
              <div className="px-3 py-2 text-xs font-medium text-[#666666] bg-[#F7F7F7] border-r border-[#E5E5E5] shrink-0">
                All Categories
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="What product are you looking for today? (e.g. CCTV, Inverter, Drone...)"
                className="w-full px-3.5 py-2 text-sm text-[#222222] placeholder-[#999999] focus:outline-none"
              />
              <button
                onClick={onSearchSubmit}
                className="bg-[#FF6A00] hover:bg-[#FF8A00] text-white px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Zone 3: Navigation Actions */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Quick Link: Request from China */}
            <button
              onClick={() => onNavigate('/china-sourcing')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FF6A00] text-[#FF6A00] hover:bg-[#FFF3E8] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <PlaneTakeoff className="w-3.5 h-3.5 text-[#FF6A00]" />
              <span>China Sourcing</span>
            </button>

            {/* Cart Button with Count Badge */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 rounded-lg text-[#222222] hover:bg-[#F7F7F7] transition-colors cursor-pointer flex items-center gap-1.5"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 text-[#222222]" />
              <span className="text-xs font-semibold hidden sm:inline text-[#222222]">Cart</span>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FF6A00] text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center tabular-nums">
                  {itemCount}
                </span>
              )}
            </button>

            {/* User Account / Dual Mode Switcher */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-[#F7F7F7] transition-colors cursor-pointer border border-[#E5E5E5]"
                >
                  <div className="w-7 h-7 rounded-full bg-[#FFF3E8] text-[#FF6A00] flex items-center justify-center font-bold text-xs">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-semibold text-[#222222] truncate max-w-[110px]">
                      {user?.name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-[#888888] capitalize">
                      {userMode === 'seller' ? 'Seller Mode' : 'Buyer'}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#666666]" />
                </button>

                {/* Account Dropdown Menu */}
                {isUserMenuOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[#E5E5E5] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-[#F0F0F0]">
                      <p className="text-xs font-bold text-[#222222] truncate">{user?.name}</p>
                      <p className="text-[11px] text-[#666666] truncate">{user?.email}</p>
                    </div>

                    {/* Dual Mode Switcher (Requirements 3 & 13) */}
                    {hasDualRole && (
                      <div className="px-3 py-2 border-b border-[#F0F0F0] bg-[#FFF3E8]/50">
                        <div className="text-[11px] font-semibold text-[#FF6A00] mb-1.5 flex items-center gap-1">
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>Active Account Mode</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-0.5 bg-white border border-[#E5E5E5] rounded-md">
                          <button
                            onClick={() => {
                              setUserMode('shopping');
                              setIsUserMenuOpen(false);
                              onNavigate('/');
                            }}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                              userMode === 'shopping' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#666666] hover:text-[#222222]'
                            }`}
                          >
                            Shopping
                          </button>
                          <button
                            onClick={() => {
                              setUserMode('seller');
                              setIsUserMenuOpen(false);
                              onNavigate('/seller');
                            }}
                            className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                              userMode === 'seller' ? 'bg-[#FF6A00] text-white shadow-xs' : 'text-[#666666] hover:text-[#222222]'
                            }`}
                          >
                            Seller Store
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate('/account?tab=orders');
                        }}
                        className="w-full px-4 py-2 text-xs text-left text-[#222222] hover:bg-[#F7F7F7] flex items-center gap-2 cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5 text-[#666666]" />
                        <span>My Orders</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate('/account?tab=china-requests');
                        }}
                        className="w-full px-4 py-2 text-xs text-left text-[#222222] hover:bg-[#F7F7F7] flex items-center gap-2 cursor-pointer"
                      >
                        <PlaneTakeoff className="w-3.5 h-3.5 text-[#666666]" />
                        <span>My China Sourcing Requests</span>
                      </button>

                      {user?.roles.includes('seller') && (
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            setUserMode('seller');
                            onNavigate('/seller');
                          }}
                          className="w-full px-4 py-2 text-xs text-left text-[#FF6A00] font-semibold hover:bg-[#FFF3E8] flex items-center gap-2 cursor-pointer"
                        >
                          <Store className="w-3.5 h-3.5" />
                          <span>Seller Dashboard</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onNavigate('/account?tab=profile');
                        }}
                        className="w-full px-4 py-2 text-xs text-left text-[#222222] hover:bg-[#F7F7F7] flex items-center gap-2 cursor-pointer"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-[#666666]" />
                        <span>Account Profile & Addresses</span>
                      </button>
                    </div>

                    <div className="border-t border-[#F0F0F0] pt-1">
                      <button
                        onClick={async () => {
                          setIsUserMenuOpen(false);
                          await logout();
                          onNavigate('/');
                        }}
                        className="w-full px-4 py-2 text-xs text-left text-[#D92D20] hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('/login')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#222222] hover:text-[#FF6A00] transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onNavigate('/register')}
                  className="bg-[#FF6A00] hover:bg-[#FF8A00] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-3 md:hidden">
          <div className="flex items-center border border-[#FF6A00] rounded-lg overflow-hidden bg-white">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search products or request from China..."
              className="w-full px-3 py-2 text-sm text-[#222222] focus:outline-none"
            />
            <button
              onClick={onSearchSubmit}
              className="bg-[#FF6A00] text-white px-3.5 py-2 text-xs font-semibold"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Clean Category & Navigation Strip */}
      <div className="bg-[#FAFAFA] border-t border-[#EEEEEE] overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <nav className="flex items-center gap-6 py-2 text-xs font-medium text-[#555555] whitespace-nowrap">
            <button 
              onClick={() => onNavigate('/')} 
              className={`hover:text-[#FF6A00] transition-colors cursor-pointer py-1 ${currentRoute === '/' ? 'text-[#FF6A00] font-bold border-b-2 border-[#FF6A00]' : ''}`}
            >
              All Marketplace
            </button>
            <button 
              onClick={() => onNavigate('/products')} 
              className={`hover:text-[#FF6A00] transition-colors cursor-pointer py-1 ${currentRoute === '/products' ? 'text-[#FF6A00] font-bold border-b-2 border-[#FF6A00]' : ''}`}
            >
              Explore Products
            </button>
            <button 
              onClick={() => onNavigate('/china-sourcing')} 
              className={`hover:text-[#FF6A00] transition-colors cursor-pointer py-1 font-semibold flex items-center gap-1 text-[#FF6A00] ${currentRoute === '/china-sourcing' ? 'border-b-2 border-[#FF6A00]' : ''}`}
            >
              <PlaneTakeoff className="w-3 h-3" />
              <span>Request from China</span>
            </button>
            <button 
              onClick={() => onNavigate('/shops')} 
              className={`hover:text-[#FF6A00] transition-colors cursor-pointer py-1 ${currentRoute === '/shops' ? 'text-[#FF6A00] font-bold border-b-2 border-[#FF6A00]' : ''}`}
            >
              Verified Sellers & Shops
            </button>
            <button 
              onClick={() => onNavigate('/shipping')} 
              className={`hover:text-[#FF6A00] transition-colors cursor-pointer py-1 ${currentRoute === '/shipping' ? 'text-[#FF6A00] font-bold border-b-2 border-[#FF6A00]' : ''}`}
            >
              Freight & Tracking
            </button>
          </nav>

          <div className="hidden lg:flex items-center gap-4 text-xs text-[#777777]">
            <span>Fast Shipping to East Africa & Global</span>
          </div>
        </div>
      </div>
    </header>
  );
};
