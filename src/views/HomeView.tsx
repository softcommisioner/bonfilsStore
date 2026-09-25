import React, { useState, useEffect } from 'react';
import { 
  PlaneTakeoff, ShieldCheck, ArrowRight, Store, Star, 
  Truck, CheckCircle, PackageCheck, Flame, ExternalLink 
} from 'lucide-react';
import { HeroBanner } from '../components/HeroBanner';
import { ProductCard } from '../components/ProductCard';
import { api } from '../services/api';
import type { Product, Business } from '../types';

interface HomeViewProps {
  onNavigate: (route: string) => void;
  onSelectCategory: (cat: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onSelectCategory }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [sellers, setSellers] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodData, catData, sellerData] = await Promise.all([
          api.getProducts(),
          api.getCategories(),
          api.getSellers(),
        ]);
        setProducts(prodData.products || []);
        setCategories(catData.categories || []);
        setSellers(sellerData.businesses || []);
      } catch (err) {
        console.error('Error loading homepage data', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const featuredProducts = products.slice(0, 4);
  const popularProducts = [...products].sort((a, b) => b.salesCount - a.salesCount).slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-16">
      {/* Hero Banner with China Sourcing Hook */}
      <HeroBanner
        onNavigate={onNavigate}
        categories={categories}
        onSelectCategory={onSelectCategory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-8">
        
        {/* Section 1: Featured Marketplace Products */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-[#222222] tracking-tight">
                Featured Marketplace Products
              </h2>
              <p className="text-xs text-[#666666] mt-0.5">
                Top quality equipment and verified stock available for instant order.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/products')}
              className="text-xs font-bold text-[#FF6A00] hover:text-[#FF8A00] flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>

        {/* Section 2: Prominent China Sourcing Workflow Spotlight (Requirements 16-22) */}
        <section className="bg-white rounded-2xl border border-[#E5E5E5] p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-5 space-y-3">
              <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider flex items-center gap-1.5">
                <PlaneTakeoff className="w-4 h-4" />
                Special Sourcing Service
              </span>
              <h3 className="text-2xl font-extrabold text-[#222222] tracking-tight leading-snug">
                Need a specific machine, component, or bulk inventory from China?
              </h3>
              <p className="text-xs sm:text-sm text-[#555555] leading-relaxed">
                Paste any link, photo, or specifications. Our on-the-ground procurement specialists in Guangzhou, Ningbo, and Yiwu negotiate factory-direct prices, run thorough QC inspections, and handle customs clearance right to your doorstep.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => onNavigate('/china-sourcing')}
                  className="px-6 py-3 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center gap-2"
                >
                  <PlaneTakeoff className="w-4 h-4" />
                  <span>REQUEST PRODUCT FROM CHINA</span>
                </button>
              </div>
            </div>

            {/* 4-Step Visual Flow */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
                <div className="w-7 h-7 rounded-md bg-[#FFF3E8] text-[#FF6A00] font-mono font-bold text-xs flex items-center justify-center mb-2">
                  01
                </div>
                <h4 className="text-xs font-bold text-[#222222]">Submit Details & Specs</h4>
                <p className="text-[11px] text-[#666666] mt-1">
                  Upload pictures, target quantity, link, or technical parameters with your expected timeline.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
                <div className="w-7 h-7 rounded-md bg-[#FFF3E8] text-[#FF6A00] font-mono font-bold text-xs flex items-center justify-center mb-2">
                  02
                </div>
                <h4 className="text-xs font-bold text-[#222222]">Itemized Quotation</h4>
                <p className="text-[11px] text-[#666666] mt-1">
                  We verify factory credentials and prepare an all-inclusive quote with product, shipping, and fees.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
                <div className="w-7 h-7 rounded-md bg-[#FFF3E8] text-[#FF6A00] font-mono font-bold text-xs flex items-center justify-center mb-2">
                  03
                </div>
                <h4 className="text-xs font-bold text-[#222222]">Quality Inspection</h4>
                <p className="text-[11px] text-[#666666] mt-1">
                  Our team inspects batch quality at the factory warehouse before container packing and sealing.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
                <div className="w-7 h-7 rounded-md bg-[#FFF3E8] text-[#FF6A00] font-mono font-bold text-xs flex items-center justify-center mb-2">
                  04
                </div>
                <h4 className="text-xs font-bold text-[#222222]">Air/Sea Freight Delivery</h4>
                <p className="text-[11px] text-[#666666] mt-1">
                  Track every milestone online from China consolidation warehouse to final arrival in your city.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Section 3: Popular Products */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#FF6A00]" />
              <h2 className="text-xl font-bold text-[#222222] tracking-tight">
                Most Popular Multi-Vendor Deals
              </h2>
            </div>
            <button
              onClick={() => onNavigate('/products')}
              className="text-xs font-bold text-[#FF6A00] hover:text-[#FF8A00] flex items-center gap-1 cursor-pointer"
            >
              <span>Explore More</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {popularProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>

        {/* Section 4: Verified Sellers Showcase (Requirement 11 & 15) */}
        <section className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#222222]">
                Verified Stores & Independent Sellers
              </h2>
              <p className="text-xs text-[#666666] mt-0.5">
                Every business is screened for genuine stock, warranty compliance, and rapid dispatch.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/shops')}
              className="text-xs font-bold text-[#FF6A00] hover:underline cursor-pointer"
            >
              View All Stores
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sellers.map((seller) => (
              <div
                key={seller.id}
                onClick={() => onNavigate(`/shops/${seller.id}`)}
                className="p-4 rounded-xl border border-[#E5E5E5] hover:border-[#FF6A00]/50 transition-all hover:shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF3E8] text-[#FF6A00] font-bold text-sm flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    {seller.type === 'official' ? (
                      <span className="text-[10px] font-bold bg-[#222222] text-white px-2 py-0.5 rounded">
                        Official Store
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-[#22A06B] flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-[#222222]">{seller.name}</h4>
                  <p className="text-xs text-[#666666] mt-1 line-clamp-2 leading-relaxed">
                    {seller.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs text-[#777777]">
                  <div className="flex items-center text-[#F5A623]">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span className="ml-1 font-bold text-[#222222] tabular-nums">{seller.rating.toFixed(1)}</span>
                  </div>
                  <span className="tabular-nums">{seller.totalProducts} Products</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};
