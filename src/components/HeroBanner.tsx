import React from 'react';
import { PlaneTakeoff, Ship, ShieldCheck, ArrowRight, Search, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  onNavigate: (route: string) => void;
  categories: Array<{ name: string; count: number }>;
  onSelectCategory?: (category: string) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ onNavigate, categories, onSelectCategory }) => {
  return (
    <div className="bg-gradient-to-b from-[#FFF8F2] to-white border-b border-[#E5E5E5] pt-6 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Split Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Category Quick Bar (Desktop) */}
          <div className="hidden lg:block lg:col-span-3 bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-3">
                Marketplace Categories
              </h3>
              <ul className="space-y-1">
                {categories.slice(0, 7).map((cat) => (
                  <li key={cat.name}>
                    <button
                      onClick={() => onSelectCategory ? onSelectCategory(cat.name) : onNavigate('/products')}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-[#444444] hover:text-[#FF6A00] hover:bg-[#FFF3E8] rounded-md transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[11px] text-[#999999] tabular-nums font-mono">({cat.count})</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-[#F0F0F0]">
              <button
                onClick={() => onNavigate('/categories')}
                className="text-xs font-semibold text-[#FF6A00] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All Categories</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Center Main Showcase with China Sourcing Hero */}
          <div className="lg:col-span-6 relative rounded-2xl overflow-hidden min-h-[320px] flex flex-col justify-between p-6 sm:p-8 bg-[#1F1F1F] text-white shadow-md">
            <img
              src="/src/assets/images/hero_logistics_marketplace_1790334780179.jpg"
              alt="International Freight Logistics"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />

            <div className="relative z-10 max-w-md">
              <span className="text-xs font-bold uppercase tracking-wider text-[#FF8A00] flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#FF6A00]" />
                Direct Factory Procurement & Logistics
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Global Multi-Vendor Hub & Direct China Sourcing
              </h1>
              <p className="text-xs sm:text-sm text-[#DDDDDD] mt-2.5 leading-relaxed">
                Connect with verified local businesses or order any custom machinery, tech, or inventory directly from China with insured freight.
              </p>
            </div>

            {/* Prominent China Sourcing Callout (Requirement 16) */}
            <div className="relative z-10 mt-6 pt-4 border-t border-white/20">
              <div className="text-xs text-[#CCCCCC] font-medium mb-2">
                Can't find what you're looking for? Let BONFILS STORE find and ship it from China.
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => onNavigate('/china-sourcing')}
                  className="px-5 py-2.5 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md flex items-center gap-2"
                >
                  <PlaneTakeoff className="w-4 h-4" />
                  <span>REQUEST PRODUCT FROM CHINA</span>
                </button>
                <button
                  onClick={() => onNavigate('/products')}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer backdrop-blur-xs"
                >
                  Browse Storefront
                </button>
              </div>
            </div>
          </div>

          {/* Right Sourcing & Shipping Fast Card */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Air Cargo Card */}
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-xs flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#FF6A00] flex items-center gap-1">
                    <PlaneTakeoff className="w-3.5 h-3.5" />
                    Express Air Freight
                  </span>
                  <span className="text-[10px] bg-[#FFF3E8] text-[#FF6A00] font-bold px-1.5 py-0.5 rounded">
                    7 - 12 Days
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#222222]">Guangzhou to Kigali</h4>
                <p className="text-xs text-[#666666] mt-1">
                  Daily airport warehouse consolidation. Includes full customs clearance and domestic transit.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/china-sourcing')}
                className="mt-3 text-xs font-bold text-[#FF6A00] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Calculate Sourcing Quote</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Sea Container Card */}
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 shadow-xs flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#22A06B] flex items-center gap-1">
                    <Ship className="w-3.5 h-3.5" />
                    Consolidated Sea Cargo
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-[#22A06B] font-bold px-1.5 py-0.5 rounded">
                    35 - 45 Days
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#222222]">Heavy & Commercial Cargo</h4>
                <p className="text-xs text-[#666666] mt-1">
                  Affordable CBM container space from Ningbo, Yiwu, & Shenzhen straight to Kigali Magerwa.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/shipping')}
                className="mt-3 text-xs font-bold text-[#22A06B] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Track Active Shipments</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
