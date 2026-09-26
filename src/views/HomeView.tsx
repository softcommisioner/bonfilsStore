import React, { useState, useEffect } from 'react';
import {
  PlaneTakeoff, ArrowRight, Store, Star, CheckCircle, Flame, Sparkles, Tag, ChevronRight
} from 'lucide-react';
import { HeroBanner } from '../components/HeroBanner';
import { ProductCard } from '../components/ProductCard';
import { api } from '../services/api';
import type { Product, Business } from '../types';

interface HomeViewProps {
  onNavigate: (route: string) => void;
  onSelectCategory: (cat: string) => void;
}

interface SectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  products: Product[];
  loading: boolean;
  onNavigate: (route: string) => void;
}

const ProductSection: React.FC<SectionProps> = ({
  title, subtitle, icon, actionLabel = 'View all', onAction, products, loading, onNavigate,
}) => (
  <section>
    <div className="flex items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-[#222222] tracking-tight">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && <p className="text-xs text-[#666666] mt-0.5">{subtitle}</p>}
      </div>
      {onAction && (
        <button
          onClick={onAction}
          className="shrink-0 text-xs font-bold text-[#FF6A00] hover:text-[#FF8A00] flex items-center gap-1 cursor-pointer"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>

    {loading ? (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-64 rounded-lg bg-white border border-[#E5E5E5] animate-pulse" />
        ))}
      </div>
    ) : products.length ? (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {products.map(product => (
          <ProductCard key={product.id} product={product} onNavigate={onNavigate} />
        ))}
      </div>
    ) : (
      <div className="rounded-lg border border-dashed border-[#E5E5E5] bg-white py-10 text-center text-sm text-[#777777]">
        No products in this section yet.
      </div>
    )}
  </section>
);

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onSelectCategory }) => {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [latest, setLatest] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ name: string; slug: string; image?: string; count: number }>>([]);
  const [sellers, setSellers] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuredData, latestData, categoryData, sellerData] = await Promise.all([
          api.getProducts({ featured: 'true', pageSize: '8', sort: 'popular' }),
          api.getProducts({ pageSize: '8', sort: 'newest' }),
          api.getCategories(),
          api.getSellers(),
        ]);
        setFeatured(featuredData.products || []);
        setLatest(latestData.products || []);
        setCategories(categoryData || []);
        setSellers(sellerData || []);
        setDeals(
          (latestData.products || [])
            .filter(product => product.originalPrice && product.originalPrice > product.price)
            .slice(0, 8),
        );
      } catch (error) {
        console.error('Error loading homepage data', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-16">
      <HeroBanner
        onNavigate={onNavigate}
        categories={categories as Array<{ name: string; count: number }>}
        onSelectCategory={onSelectCategory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 mt-8">

        {/* Shop by category - horizontal rail on mobile, grid on larger screens */}
        <section>
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#222222] tracking-tight">Shop by Category</h2>
              <p className="text-xs text-[#666666] mt-0.5">18 departments stocked from Kigali and China hubs.</p>
            </div>
            <button
              onClick={() => onNavigate('/categories')}
              className="shrink-0 text-xs font-bold text-[#FF6A00] hover:text-[#FF8A00] flex items-center gap-1 cursor-pointer"
            >
              <span>All categories</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
            {categories.map(category => (
              <button
                key={category.name}
                onClick={() => onSelectCategory(category.name)}
                className="shrink-0 w-32 sm:w-40 snap-start bg-white border border-[#E5E5E5] rounded-lg overflow-hidden hover:border-[#FF6A00]/60 hover:shadow-sm transition-all cursor-pointer text-left"
              >
                <div className="aspect-square w-full bg-[#F9F9F8]">
                  {category.image && (
                    <img
                      src={category.image}
                      alt={category.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[11px] font-bold text-[#222222] leading-tight line-clamp-2">{category.name}</div>
                  <div className="text-[10px] text-[#888888] mt-0.5 tabular-nums">{category.count} items</div>
                </div>
              </button>
            ))}
            {!categories.length && !isLoading && (
              <div className="text-xs text-[#777777] py-6">Categories are unavailable right now.</div>
            )}
          </div>
        </section>

        <ProductSection
          title="Featured Marketplace Products"
          subtitle="Top quality equipment and verified stock available for instant order."
          icon={<Sparkles className="w-5 h-5 text-[#FF6A00]" />}
          products={featured}
          loading={isLoading}
          onNavigate={onNavigate}
          onAction={() => onNavigate('/products?featured=true')}
        />

        {/* China sourcing spotlight */}
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
                Paste any link, photo, or specifications. Our on-the-ground procurement specialists in Guangzhou,
                Ningbo, and Yiwu negotiate factory-direct prices, run thorough QC inspections, and handle customs
                clearance right to your doorstep.
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

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { step: '01', title: 'Submit Details & Specs', copy: 'Upload pictures, target quantity, link, or technical parameters with your expected timeline.' },
                { step: '02', title: 'Itemized Quotation', copy: 'We verify factory credentials and prepare an all-inclusive quote with product, shipping, and fees.' },
                { step: '03', title: 'Quality Inspection', copy: 'Our team inspects batch quality at the factory warehouse before container packing and sealing.' },
                { step: '04', title: 'Air/Sea Freight Delivery', copy: 'Track every milestone online from China consolidation warehouse to final arrival in your city.' },
              ].map(item => (
                <div key={item.step} className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
                  <div className="w-7 h-7 rounded-md bg-[#FFF3E8] text-[#FF6A00] font-mono font-bold text-xs flex items-center justify-center mb-2">
                    {item.step}
                  </div>
                  <h4 className="text-xs font-bold text-[#222222]">{item.title}</h4>
                  <p className="text-[11px] text-[#666666] mt-1">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ProductSection
          title="New Arrivals"
          subtitle="The latest stock added to BONFILS STORE."
          icon={<ArrowRight className="w-5 h-5 text-[#FF6A00]" />}
          actionLabel="Browse catalogue"
          products={latest}
          loading={isLoading}
          onNavigate={onNavigate}
          onAction={() => onNavigate('/products?sort=newest')}
        />

        <ProductSection
          title="Best Deals & Price Drops"
          subtitle="Discounted equipment while stocks last."
          icon={<Tag className="w-5 h-5 text-[#FF6A00]" />}
          products={deals}
          loading={isLoading}
          onNavigate={onNavigate}
          onAction={() => onNavigate('/products?sort=price_asc')}
        />

        <ProductSection
          title="Most Popular Multi-Vendor Deals"
          subtitle="Best selling products across every verified store."
          icon={<Flame className="w-5 h-5 text-[#FF6A00]" />}
          products={[...featured, ...latest].sort((a, b) => b.salesCount - a.salesCount).slice(0, 8)}
          loading={isLoading}
          onNavigate={onNavigate}
          onAction={() => onNavigate('/products?sort=popular')}
        />

        {/* Verified sellers */}
        <section className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#222222]">Verified Stores & Independent Sellers</h2>
              <p className="text-xs text-[#666666] mt-0.5">
                Every business is screened for genuine stock, warranty compliance, and rapid dispatch.
              </p>
            </div>
            <button onClick={() => onNavigate('/shops')} className="text-xs font-bold text-[#FF6A00] hover:underline cursor-pointer">
              View All Stores
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sellers.map(seller => (
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
                      <span className="text-[10px] font-bold bg-[#222222] text-white px-2 py-0.5 rounded">Official Store</span>
                    ) : (
                      <span className="text-[10px] font-medium text-[#22A06B] flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-[#222222] flex items-center gap-1">
                    <span className="truncate">{seller.name}</span>
                    <ChevronRight className="w-3 h-3 shrink-0 text-[#AAAAAA]" />
                  </h4>
                  <p className="text-xs text-[#666666] mt-1 line-clamp-2 leading-relaxed">{seller.description}</p>
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
