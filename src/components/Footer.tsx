import React from 'react';
import { ShieldCheck, Truck, Clock, RefreshCw, Mail, Phone, MapPin } from 'lucide-react';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#1A1A1A] text-white pt-12 pb-8 border-t-4 border-[#FF6A00]">
      {/* 4 Value Pillars */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 border-b border-[#333333]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-[#FF6A00]/10 text-[#FF6A00] shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Direct China Sourcing</h4>
              <p className="text-xs text-[#999999] mt-1">Guangzhou & Yiwu consolidation hubs with direct East Africa freight.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-[#FF6A00]/10 text-[#FF6A00] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Verified Multi-Vendors</h4>
              <p className="text-xs text-[#999999] mt-1">Strict business screening and authentic product guarantee on every order.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-[#FF6A00]/10 text-[#FF6A00] shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Air & Sea Cargo</h4>
              <p className="text-xs text-[#999999] mt-1">Real-time checkpoint tracking from China factory gate to your door.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-[#FF6A00]/10 text-[#FF6A00] shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Inspection & QC</h4>
              <p className="text-xs text-[#999999] mt-1">Pre-shipment quality checks and transparent itemized quotations.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded bg-[#FF6A00] flex items-center justify-center font-bold text-white text-sm">
                B
              </div>
              <span className="text-lg font-extrabold tracking-tight">
                BONFILS<span className="text-[#FF6A00]"> STORE</span>
              </span>
            </div>
            <p className="text-xs text-[#AAAAAA] leading-relaxed mb-4">
              The premier cross-border e-commerce platform bridging direct China manufacturing with African enterprises and retail buyers.
            </p>
            <div className="space-y-1.5 text-xs text-[#888888]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#FF6A00]" />
                <span>Kigali, Rwanda · Guangzhou Hub, China</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#FF6A00]" />
                <span>support@bonfilsstore.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#FF6A00]" />
                <span>+250 788 100 200</span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Marketplace</h5>
            <ul className="space-y-2 text-xs text-[#AAAAAA]">
              <li>
                <button onClick={() => onNavigate('/products')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  Browse All Products
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/shops')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  Verified Seller Stores
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/categories')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  Product Categories
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/register')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  Become a Seller
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3">China Sourcing & Freight</h5>
            <ul className="space-y-2 text-xs text-[#AAAAAA]">
              <li>
                <button onClick={() => onNavigate('/china-sourcing')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  Request Product from China
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/shipping')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  Track Cargo & Shipments
                </button>
              </li>
              <li>
                <span className="text-[#666666]">Consolidated Sea Freight (45 Days)</span>
              </li>
              <li>
                <span className="text-[#666666]">Express Air Cargo (7-12 Days)</span>
              </li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Customer Service</h5>
            <ul className="space-y-2 text-xs text-[#AAAAAA]">
              <li>
                <button onClick={() => onNavigate('/account?tab=orders')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  My Orders & Receipts
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('/account?tab=china-requests')} className="hover:text-[#FF6A00] transition-colors cursor-pointer">
                  My Sourcing Quotations
                </button>
              </li>
              <li>
                <span className="text-[#666666]">Buyer Protection Policy</span>
              </li>
              <li>
                <span className="text-[#666666]">Privacy & Terms of Service</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright Notice - strictly NO super admin link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between text-xs text-[#666666]">
        <p>© {new Date().getFullYear()} BONFILS STORE. All rights reserved.</p>
        <p className="mt-2 sm:mt-0 text-[11px]">
          Multi-Vendor E-Commerce Platform · International Logistics
        </p>
      </div>
    </footer>
  );
};
