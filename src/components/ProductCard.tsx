import React, { useState } from 'react';
import { Star, ShoppingCart, Store, ShieldCheck } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { nextProductImage, productImageCandidates } from '../services/images';

interface ProductCardProps {
  product: Product;
  onNavigate: (route: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate }) => {
  const { addItem } = useCart();
  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= 5;
  const candidates = productImageCandidates(product);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inStock) addItem(product, 1);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inStock) addItem(product, 1);
  };

  const [imageIndex, setImageIndex] = useState(0);
  const displayImage = candidates[Math.min(imageIndex, candidates.length - 1)];

  return (
    <div
      onClick={() => onNavigate(`/products/${product.id}`)}
      className="group bg-white rounded-lg border border-[#E5E5E5] hover:border-[#FF6A00]/60 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
    >
      {/* Product Image Box */}
      <div className="relative aspect-4/3 w-full bg-[#F9F9F8] overflow-hidden">
        <img
          src={displayImage}
          alt={product.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover group-hover:scale-103 transition-transform duration-300 ${inStock ? '' : 'opacity-60 grayscale'}`}
          onError={() => {
            const next = nextProductImage(product, imageIndex);
            if (next) setImageIndex(imageIndex + 1);
          }}
        />

        {product.isOfficial && (
          <div className="absolute top-2 left-2 bg-[#222222]/90 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow-xs">
            <ShieldCheck className="w-3 h-3 text-[#FF6A00]" />
            <span>Official Store</span>
          </div>
        )}

        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-[#222222]/85 text-white text-[11px] font-bold px-3 py-1.5 rounded tracking-wide">
              Out of stock
            </span>
          </div>
        )}

        {lowStock && (
          <div className="absolute top-2 right-2 bg-[#FFF3E8] text-[#FF6A00] text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
            Only {product.stock} left
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          {/* Seller & Category - unboxed metadata */}
          <div className="flex items-center gap-1.5 text-[11px] text-[#666666] mb-1">
            <Store className="w-3 h-3 text-[#888888] shrink-0" />
            <span className="font-semibold text-[#444444] truncate">{product.sellerName}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{product.category}</span>
          </div>

          {/* Product Title */}
          <h3 className="text-xs sm:text-sm font-semibold text-[#222222] line-clamp-2 leading-snug group-hover:text-[#FF6A00] transition-colors">
            {product.title}
          </h3>

          {/* Rating & Orders */}
          <div className="flex items-center gap-2 text-[11px] text-[#777777] mt-1.5">
            <div className="flex items-center text-[#F5A623]">
              <Star className="w-3 h-3 fill-current" />
              <span className="ml-0.5 font-bold text-[#222222] tabular-nums">{product.rating.toFixed(1)}</span>
            </div>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{product.salesCount} sold</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#22A06B] font-medium">{product.shippingTimeDays}</span>
          </div>
        </div>

        {/* Pricing & Actions */}
        <div className="mt-3 pt-2.5 border-t border-[#F0F0F0]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-extrabold text-[#FF6A00] tabular-nums">
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && (
              <span className="text-xs text-[#999999] line-through tabular-nums">
                ${product.originalPrice.toFixed(2)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-2.5">
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              className="py-1.5 px-2 bg-[#FFF3E8] hover:bg-[#FFE6CF] text-[#FF6A00] text-[11px] font-bold rounded transition-colors cursor-pointer flex items-center justify-center gap-1 disabled:bg-[#F3F3F3] disabled:text-[#AAAAAA] disabled:cursor-not-allowed disabled:hover:bg-[#F3F3F3]"
            >
              <ShoppingCart className="w-3 h-3" />
              <span>{inStock ? 'Add to Cart' : 'Sold out'}</span>
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!inStock}
              className="py-1.5 px-2 bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-[11px] font-bold rounded transition-colors cursor-pointer disabled:bg-[#CCCCCC] disabled:cursor-not-allowed disabled:hover:bg-[#CCCCCC]"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
