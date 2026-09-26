import React, { useState, useEffect } from 'react';
import { 
  Star, ShieldCheck, Store, Truck, Clock, 
  ArrowLeft, ShoppingCart, Plus, Minus, Check, MapPin, Share2 
} from 'lucide-react';
import { api } from '../services/api';
import { useCart } from '../context/CartContext';
import { nextProductImage, productImageCandidates } from '../services/images';
import type { Product, Business } from '../types';

interface ProductDetailViewProps {
  productId: string;
  onNavigate: (route: string) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ productId, onNavigate }) => {
  const { addItem, setIsCartOpen } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoading(true);
      try {
        const data = await api.getProduct(productId);
        setProduct(data.product);
        setBusiness(data.business || null);
        setImageIndex(0);
        setQuantity(1);
      } catch (err) {
        console.error('Error fetching product', err);
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-[#888888]">
        Loading product details...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-[#222222]">Product Not Found</h2>
        <button
          onClick={() => onNavigate('/products')}
          className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg text-xs font-bold cursor-pointer"
        >
          Back to Products
        </button>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    setIsCartOpen(true);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const inStock = product.stock > 0;
  const candidates = productImageCandidates(product);
  const activeImage = candidates[Math.min(imageIndex, candidates.length - 1)];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#666666] mb-6">
        <button 
          onClick={() => onNavigate('/products')} 
          className="hover:text-[#FF6A00] flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Products</span>
        </button>
        <span>/</span>
        <span className="text-[#888888]">{product.category}</span>
        <span>/</span>
        <span className="text-[#222222] font-medium truncate max-w-xs">{product.title}</span>
      </div>

      {/* Main PDP Grid: Gallery Left, Contiguous Purchase Module Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Gallery Column (Left) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="aspect-4/3 w-full bg-[#F9F9F8] rounded-2xl border border-[#E5E5E5] overflow-hidden relative">
            <img
              src={activeImage}
              alt={product.title}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover ${inStock ? '' : 'opacity-60 grayscale'}`}
              onError={() => {
                const next = nextProductImage(product, imageIndex);
                if (next) setImageIndex(imageIndex + 1);
              }}
            />
            {!inStock && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-[#222222]/85 text-white text-xs font-bold px-4 py-2 rounded-md tracking-wide">
                  Out of stock
                </span>
              </div>
            )}
            {product.isOfficial && (
              <div className="absolute top-4 left-4 bg-[#222222]/90 text-white text-xs font-bold px-3 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-[#FF6A00]" />
                <span>Bonfils Official Guarantee</span>
              </div>
            )}
          </div>

          {/* Thumbnails if multiple */}
          {candidates.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {candidates.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => setImageIndex(i)}
                  className={`w-16 h-16 rounded-lg border-2 overflow-hidden shrink-0 cursor-pointer ${
                    i === imageIndex ? 'border-[#FF6A00]' : 'border-[#E5E5E5]'
                  }`}
                >
                  <img src={img} alt={`${product.title} view ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Shipping & Origin Info Box */}
          <div className="p-4 bg-white rounded-xl border border-[#E5E5E5] text-xs space-y-3">
            <h4 className="font-bold text-[#222222] uppercase tracking-wider text-[11px]">
              Fulfillment & Logistics
            </h4>
            <div className="grid grid-cols-2 gap-3 text-[#555555]">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#FF6A00] shrink-0" />
                <div>
                  <div className="font-semibold text-[#222222]">Shipment Origin</div>
                  <div className="text-[11px] text-[#777777]">{product.shippingOrigin}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-[#FF6A00] shrink-0" />
                <div>
                  <div className="font-semibold text-[#222222]">Delivery Time</div>
                  <div className="text-[11px] text-[#777777]">{product.shippingTimeDays}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Purchase Module Column (Right) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-5">
            
            {/* Seller attribution */}
            <div className="flex items-center justify-between">
              <div 
                onClick={() => onNavigate(`/shops/${product.businessId}`)}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-md bg-[#FFF3E8] text-[#FF6A00] flex items-center justify-center font-bold text-xs">
                  <Store className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#222222] group-hover:text-[#FF6A00] transition-colors flex items-center gap-1">
                    <span>{product.sellerName}</span>
                    {product.isOfficial && <ShieldCheck className="w-3.5 h-3.5 text-[#FF6A00]" />}
                  </div>
                  <div className="text-[11px] text-[#888888]">Verified Marketplace Seller</div>
                </div>
              </div>

              <button
                onClick={handleShare}
                className="p-2 text-[#777777] hover:text-[#222222] hover:bg-[#F7F7F7] rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isCopied ? 'Link Copied!' : 'Share'}</span>
              </button>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#222222] tracking-tight leading-snug">
                {product.title}
              </h1>
              <div className="flex items-center gap-3 text-xs text-[#777777] mt-2">
                <div className="flex items-center text-[#F5A623]">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span className="ml-1 font-bold text-[#222222] tabular-nums">{product.rating.toFixed(1)}</span>
                  <span className="text-[#888888] ml-1">({product.reviewsCount} reviews)</span>
                </div>
                <span>·</span>
                <span className="tabular-nums font-semibold text-[#444444]">{product.salesCount} sold</span>
                <span>·</span>
                <span className="text-[#22A06B] font-semibold">
                  {product.stock > 0 ? `In Stock (${product.stock} units)` : 'Out of Stock'}
                </span>
              </div>
            </div>

            {/* Price block */}
            <div className="p-4 bg-[#FFF8F2] rounded-xl border border-[#FF6A00]/20 flex items-baseline gap-3">
              <span className="text-3xl font-black text-[#FF6A00] tabular-nums">
                ${product.price.toFixed(2)}
              </span>
              {product.originalPrice && (
                <span className="text-sm text-[#999999] line-through tabular-nums">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
              <span className="text-xs text-[#666666] ml-auto">
                All duties & Rwanda VAT inclusive
              </span>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-bold text-[#222222] uppercase tracking-wide mb-1.5">Overview</h4>
              <p className="text-xs text-[#555555] leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Quantity Stepper & CTAs */}
            <div className="pt-3 border-t border-[#F0F0F0] space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#444444]">Select Quantity:</label>
                <div className="flex items-center border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    disabled={!inStock || quantity <= 1}
                    className="px-3 py-2 hover:bg-[#F7F7F7] text-[#555555] cursor-pointer disabled:text-[#CCCCCC] disabled:cursor-not-allowed"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="px-4 text-xs font-bold tabular-nums text-[#222222]">
                    {inStock ? quantity : 0}
                  </span>
                  <button
                    onClick={() => setQuantity(prev => Math.min(product.stock, prev + 1))}
                    disabled={!inStock || quantity >= product.stock}
                    className="px-3 py-2 hover:bg-[#F7F7F7] text-[#555555] cursor-pointer disabled:text-[#CCCCCC] disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="py-3 px-4 bg-[#FFF3E8] hover:bg-[#FFE6CF] text-[#FF6A00] text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-[#FF6A00]/30 disabled:bg-[#F3F3F3] disabled:text-[#AAAAAA] disabled:border-[#E5E5E5] disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{inStock ? 'Add to Cart' : 'Sold out'}</span>
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={!inStock}
                  className="py-3 px-4 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm flex items-center justify-center disabled:bg-[#CCCCCC] disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {inStock ? `Buy Now ($${(product.price * quantity).toFixed(2)})` : 'Unavailable'}
                </button>
              </div>
            </div>

          </div>

          {/* Specifications Table */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-[#222222] tracking-tight">
                Technical Specifications
              </h3>
              <div className="divide-y divide-[#F0F0F0] text-xs">
                {Object.entries(product.specifications).map(([key, val]) => (
                  <div key={key} className="py-2.5 flex justify-between gap-4">
                    <span className="text-[#666666] font-medium">{key}</span>
                    <span className="text-[#222222] font-semibold text-right">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Business Owner Guarantee Banner */}
          {business && (
            <div className="bg-[#FAFAFA] rounded-xl border border-[#E5E5E5] p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E5E5] flex items-center justify-center font-bold text-[#FF6A00]">
                  {business.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-[#222222]">{business.name}</h4>
                  <p className="text-[11px] text-[#777777]">{business.shippingTerms}</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate(`/shops/${business.id}`)}
                className="text-xs font-bold text-[#FF6A00] hover:underline cursor-pointer"
              >
                Visit Store →
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
