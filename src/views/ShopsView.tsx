import React, { useState, useEffect } from 'react';
import { Store, Star, ShieldCheck, MapPin, Package, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import type { Business, Product } from '../types';

interface ShopsViewProps {
  sellerId?: string;
  onNavigate: (route: string) => void;
}

export const ShopsView: React.FC<ShopsViewProps> = ({ sellerId, onNavigate }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [shopProducts, setShopProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (sellerId) {
          const data = await api.getSeller(sellerId);
          setSelectedBusiness(data.business);
          setShopProducts(data.products || []);
        } else {
          const data = await api.getSellers();
          setBusinesses(data || []);
        }
      } catch (err) {
        console.error('Error fetching shops', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [sellerId]);

  if (sellerId && selectedBusiness) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Storefront Header */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] text-white flex items-center justify-center font-extrabold text-2xl shadow-sm">
                {selectedBusiness.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#222222]">
                    {selectedBusiness.name}
                  </h1>
                  {selectedBusiness.type === 'official' ? (
                    <span className="text-[10px] bg-[#222222] text-white font-bold px-2 py-0.5 rounded">
                      Official Flagship
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-50 text-[#22A06B] font-bold px-2 py-0.5 rounded flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#666666] mt-1 max-w-xl">
                  {selectedBusiness.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-[#888888] mt-2">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FF6A00]" />
                    {selectedBusiness.city}, {selectedBusiness.country}
                  </span>
                  <span>·</span>
                  <span className="flex items-center text-[#F5A623]">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <strong className="text-[#222222] ml-0.5">{selectedBusiness.rating.toFixed(1)}</strong>
                    <span className="ml-1 text-[#888888]">({selectedBusiness.reviewsCount} reviews)</span>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('/shops')}
              className="text-xs text-[#FF6A00] font-bold hover:underline cursor-pointer"
            >
              ← All Stores
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F0F0] text-xs text-[#555555]">
            <strong>Shipping & Fulfillment Terms:</strong> {selectedBusiness.shippingTerms}
          </div>
        </div>

        {/* Store Catalog */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#222222]">
              Products from {selectedBusiness.name} ({shopProducts.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {shopProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#222222]">
          Verified Marketplace Stores
        </h1>
        <p className="text-xs text-[#666666] mt-0.5">
          Browse certified independent business owners, official procurement outlets, and wholesale importers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((biz) => (
          <div
            key={biz.id}
            onClick={() => onNavigate(`/shops/${biz.id}`)}
            className="bg-white rounded-2xl border border-[#E5E5E5] hover:border-[#FF6A00]/50 p-6 shadow-xs transition-all hover:shadow-sm cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#FFF3E8] text-[#FF6A00] font-black text-xl flex items-center justify-center">
                  {biz.name.charAt(0)}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  biz.type === 'official' ? 'bg-[#222222] text-white' : 'bg-[#FFF3E8] text-[#FF6A00]'
                }`}>
                  {biz.type === 'official' ? 'OFFICIAL STORE' : 'VERIFIED MERCHANT'}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#222222]">{biz.name}</h3>
                <p className="text-xs text-[#666666] line-clamp-2 mt-1 leading-relaxed">
                  {biz.description}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#888888]">
                <MapPin className="w-3.5 h-3.5 text-[#FF6A00]" />
                <span>{biz.city}, {biz.country}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
              <div className="flex items-center text-[#F5A623]">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="ml-1 font-bold text-[#222222] tabular-nums">{biz.rating.toFixed(1)}</span>
                <span className="text-[#888888] ml-1">({biz.reviewsCount})</span>
              </div>

              <span className="text-xs font-bold text-[#FF6A00] flex items-center gap-1">
                <span>View Products</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
