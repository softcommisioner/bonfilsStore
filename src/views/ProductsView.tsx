import React, { useState, useEffect } from 'react';
import { Filter, SlidersHorizontal, ArrowUpDown, X, Store } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { api } from '../services/api';
import type { Product, Business } from '../types';

interface ProductsViewProps {
  onNavigate: (route: string) => void;
  initialCategory?: string;
  initialSearch?: string;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ 
  onNavigate, 
  initialCategory = '', 
  initialSearch = '' 
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [sellers, setSellers] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [search, setSearch] = useState<string>(initialSearch);

  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
      if (selectedSeller) params.sellerId = selectedSeller;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (sortBy) params.sort = sortBy;

      const data = await api.getProducts(params);
      setProducts(data.products || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catData, sellerData] = await Promise.all([
          api.getCategories(),
          api.getSellers(),
        ]);
        setCategories(catData.categories || []);
        setSellers(sellerData.businesses || []);
      } catch (err) {
        console.error('Failed metadata fetch', err);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedSeller, sortBy]);

  const handleApplyPriceFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedSeller('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setSearch('');
  };

  const hasActiveFilters = selectedCategory || selectedSeller || minPrice || maxPrice || search;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title & Active Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E5E5E5] gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#222222] tracking-tight">
            {selectedCategory ? `${selectedCategory}` : 'Marketplace Catalog'}
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Showing <span className="font-bold text-[#222222] tabular-nums">{products.length}</span> verified products
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#666666] flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort by:</span>
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs font-semibold bg-white border border-[#E5E5E5] rounded-lg px-3 py-1.5 focus:border-[#FF6A00] focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest Arrivals</option>
            <option value="popular">Most Popular</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
        
        {/* Left Filter Sidebar */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#E5E5E5] shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#222222] flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#FF6A00]" />
                Filters
              </h3>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-[#FF6A00] hover:underline cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Categories Filter */}
            <div>
              <h4 className="text-xs font-semibold text-[#444444] mb-2.5">Category</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                    !selectedCategory ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedCategory(c.name)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                      selectedCategory === c.name ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[10px] text-[#999999] tabular-nums font-mono">({c.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seller / Store Filter */}
            <div className="pt-4 border-t border-[#F0F0F0]">
              <h4 className="text-xs font-semibold text-[#444444] mb-2.5">Seller / Shop</h4>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedSeller('')}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                    !selectedSeller ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                  }`}
                >
                  All Sellers
                </button>
                {sellers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSeller(s.id)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                      selectedSeller === s.id ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    {s.type === 'official' && (
                      <span className="text-[9px] bg-[#222222] text-white px-1 rounded">Official</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range Filter */}
            <div className="pt-4 border-t border-[#F0F0F0]">
              <h4 className="text-xs font-semibold text-[#444444] mb-2.5">Price Range ($)</h4>
              <form onSubmit={handleApplyPriceFilter} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                  />
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 bg-[#F7F7F7] hover:bg-[#FFF3E8] hover:text-[#FF6A00] text-xs font-semibold text-[#555555] rounded-md border border-[#E5E5E5] transition-colors cursor-pointer"
                >
                  Apply Filter
                </button>
              </form>
            </div>

            {/* Custom China Request Reminder */}
            <div className="p-3 bg-[#FFF8F2] rounded-lg border border-[#FF6A00]/20 text-xs space-y-1.5">
              <div className="font-bold text-[#FF6A00]">Can't find a model?</div>
              <p className="text-[#666666] text-[11px] leading-relaxed">
                We can source any product directly from China factories and fly or ship it to you.
              </p>
              <button
                onClick={() => onNavigate('/china-sourcing')}
                className="text-xs font-bold text-[#FF6A00] hover:underline cursor-pointer"
              >
                Request from China →
              </button>
            </div>

          </div>
        </div>

        {/* Right Product Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-lg border border-[#E5E5E5] p-4 h-72 animate-pulse space-y-3">
                  <div className="w-full h-40 bg-[#EEEEEE] rounded-md" />
                  <div className="h-4 bg-[#EEEEEE] rounded w-3/4" />
                  <div className="h-4 bg-[#EEEEEE] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-[#E5E5E5] p-8 space-y-3">
              <Store className="w-12 h-12 mx-auto text-[#CCCCCC]" />
              <h3 className="text-base font-bold text-[#222222]">No products found matching filters</h3>
              <p className="text-xs text-[#777777] max-w-md mx-auto">
                Try clearing your search terms, changing the category, or submit a custom China sourcing request!
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 border border-[#E5E5E5] rounded-lg text-xs font-semibold hover:bg-[#F7F7F7] cursor-pointer"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => onNavigate('/china-sourcing')}
                  className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-xs font-bold hover:bg-[#FF8A00] cursor-pointer"
                >
                  Request from China
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
