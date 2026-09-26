import React, { useCallback, useEffect, useState } from 'react';
import { SlidersHorizontal, ArrowUpDown, Store, Search, Loader2 } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { api } from '../services/api';
import type { Product, Business } from '../types';

interface ProductsViewProps {
  onNavigate: (route: string) => void;
  initialCategory?: string;
  initialSearch?: string;
  initialSort?: string;
  initialFeatured?: string;
}

const PAGE_SIZE = 12;

export const ProductsView: React.FC<ProductsViewProps> = ({
  onNavigate,
  initialCategory = '',
  initialSearch = '',
  initialSort = 'newest',
  initialFeatured = '',
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([]);
  const [sellers, setSellers] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>(initialSort || 'newest');
  const [search, setSearch] = useState<string>(initialSearch);
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [featuredOnly, setFeaturedOnly] = useState<boolean>(initialFeatured === 'true');

  useEffect(() => {
    if (initialCategory) setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setSearchInput(initialSearch);
    }
  }, [initialSearch]);

  useEffect(() => {
    if (initialSort) setSortBy(initialSort);
  }, [initialSort]);

  useEffect(() => {
    if (initialFeatured === 'true') setFeaturedOnly(true);
  }, [initialFeatured]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildParams = useCallback((targetPage: number) => {
    const params: Record<string, string> = {
      page: String(targetPage),
      pageSize: String(PAGE_SIZE),
    };
    if (search) params.search = search;
    if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
    if (selectedSeller) params.seller = selectedSeller;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (sortBy) params.sort = sortBy;
    if (featuredOnly) params.featured = 'true';
    return params;
  }, [search, selectedCategory, selectedSeller, minPrice, maxPrice, sortBy, featuredOnly]);

  const fetchProducts = useCallback(async (targetPage: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getProducts(buildParams(targetPage));
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setPageCount(data.pageCount || 1);
      setPage(data.page || targetPage);
    } catch (err: any) {
      setError(err.message || 'Failed to load products.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [buildParams]);

  const loadMore = async () => {
    if (isLoadingMore || page >= pageCount) return;
    setIsLoadingMore(true);
    try {
      const data = await api.getProducts(buildParams(page + 1));
      setProducts(prev => [...prev, ...(data.products || [])]);
      setPage(data.page || page + 1);
      setPageCount(data.pageCount || pageCount);
      setTotal(data.total || total);
    } catch (err: any) {
      setError(err.message || 'Failed to load more products.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [categoryData, sellerData] = await Promise.all([api.getCategories(), api.getSellers()]);
        setCategories(categoryData || []);
        setSellers(sellerData || []);
      } catch (err) {
        console.error('Failed metadata fetch', err);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchProducts(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [search, selectedCategory, selectedSeller, sortBy, minPrice, maxPrice, featuredOnly]);

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedSeller('');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    setSearch('');
    setSearchInput('');
    setFeaturedOnly(false);
  };

  const hasActiveFilters = Boolean(selectedCategory || selectedSeller || minPrice || maxPrice || search || featuredOnly);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E5E5E5] gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-[#222222] tracking-tight truncate">
            {selectedCategory || 'Marketplace Catalog'}
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            {isLoading ? 'Loading products…' : (
              <>
                Showing <span className="font-bold text-[#222222] tabular-nums">{products.length}</span> of{' '}
                <span className="tabular-nums">{total}</span> verified products
                {pageCount > 1 && <span className="ml-1">· page {page} of {pageCount}</span>}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-[#666666] flex items-center gap-1 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sort by:</span>
          </label>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="text-xs font-semibold bg-white border border-[#E5E5E5] rounded-lg px-3 py-1.5 focus:border-[#FF6A00] focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest Arrivals</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#E5E5E5] shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#222222] flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[#FF6A00]" />
                Filters
              </h3>
              {hasActiveFilters && (
                <button onClick={handleResetFilters} className="text-xs text-[#FF6A00] hover:underline cursor-pointer">
                  Clear all
                </button>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#444444] mb-2.5">Search</h4>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#AAAAAA]" />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Product, brand, seller…"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-[#444444] mb-2.5">Category</h4>
              <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                    !selectedCategory ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                  }`}
                >
                  All Categories
                </button>
                {categories.map(category => (
                  <button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                      selectedCategory === category.name ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="text-[10px] text-[#999999] tabular-nums font-mono">({category.count})</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0F0F0]">
              <h4 className="text-xs font-semibold text-[#444444] mb-2.5">Seller / Shop</h4>
              <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin">
                <button
                  onClick={() => setSelectedSeller('')}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                    !selectedSeller ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                  }`}
                >
                  All Sellers
                </button>
                {sellers.map(seller => (
                  <button
                    key={seller.id}
                    onClick={() => setSelectedSeller(seller.id)}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                      selectedSeller === seller.id ? 'bg-[#FFF3E8] text-[#FF6A00] font-bold' : 'text-[#666666] hover:bg-[#F7F7F7]'
                    }`}
                  >
                    <span className="truncate">{seller.name}</span>
                    {seller.type === 'official' && <span className="text-[9px] bg-[#222222] text-white px-1 rounded">Official</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#F0F0F0]">
              <h4 className="text-xs font-semibold text-[#444444] mb-2.5">Price Range ($)</h4>
              <form
                onSubmit={e => {
                  e.preventDefault();
                  fetchProducts(1);
                }}
                className="space-y-2"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={e => setMinPrice(e.target.value)}
                    placeholder="Min"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#E5E5E5] rounded-md focus:border-[#FF6A00] focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
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

            <label className="flex items-center gap-2 text-xs text-[#555555] cursor-pointer">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={e => setFeaturedOnly(e.target.checked)}
                className="accent-[#FF6A00]"
              />
              Featured products only
            </label>

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

        <div className="lg:col-span-3">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg border border-[#E5E5E5] p-4 h-72 animate-pulse space-y-3">
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
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} onNavigate={onNavigate} />
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center gap-3">
                {page < pageCount ? (
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="px-6 py-2.5 rounded-lg border border-[#FF6A00] text-[#FF6A00] text-xs font-bold hover:bg-[#FFF3E8] transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2"
                  >
                    {isLoadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isLoadingMore ? 'Loading…' : `Load more products (${products.length}/${total})`}
                  </button>
                ) : (
                  <p className="text-[11px] text-[#999999]">You have reached the end of the catalogue.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
