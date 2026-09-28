import React from 'react';
import { Star, ShoppingCart, ShieldCheck, Store, Truck, ImageOff } from 'lucide-react';
import type { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useProductImage } from '../services/images';

interface ProductCardProps {
  product: Product;
  onNavigate: (route: string) => void;
}

/** 1234 -> "1.2k", 14500 -> "14.5k" so sold counts never blow out the row. */
function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(value);
}

const RatingStars: React.FC<{ rating: number; className?: string }> = ({ rating, className = '' }) => {
  const percent = Math.max(0, Math.min(100, (rating / 5) * 100));
  const stars = Array.from({ length: 5 });
  return (
    <span className={`relative inline-flex ${className}`} aria-hidden="true">
      <span className="flex gap-px text-[#D8D8D8]">
        {stars.map((_, index) => (
          <Star key={index} className="w-3 h-3 fill-current" />
        ))}
      </span>
      <span
        className="absolute inset-0 flex gap-px text-[#F5A623] overflow-hidden"
        style={{ width: `${percent}%` }}
      >
        {stars.map((_, index) => (
          <Star key={index} className="w-3 h-3 fill-current shrink-0" />
        ))}
      </span>
    </span>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate }) => {
  const { addItem } = useCart();
  const { src, onError } = useProductImage(product);

  const inStock = product.stock > 0;
  const lowStock = inStock && product.stock <= 5;
  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inStock) addItem(product, 1);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inStock) addItem(product, 1);
  };

  return (
    <article
      onClick={() => onNavigate(`/products/${product.id}`)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E8E8E6] bg-white transition-all duration-200 hover:border-[#FF6A00]/50 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] cursor-pointer"
    >
      {/* Photography: square, neutral field, product letterboxed like a real listing */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#FAFAF9]">
        <img
          src={src}
          alt={product.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={onError}
          className={`h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.06] ${
            inStock ? '' : 'opacity-45 grayscale'
          }`}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 p-2">
          {product.isOfficial ? (
            <span className="inline-flex items-center gap-1 rounded bg-[#222222]/92 px-1.5 py-1 text-[10px] font-bold leading-none text-white shadow-sm backdrop-blur-sm">
              <ShieldCheck className="h-3 w-3 text-[#FF6A00]" />
              Official Store
            </span>
          ) : (
            <span />
          )}

          {discount > 0 && inStock && (
            <span className="rounded bg-[#FF6A00] px-1.5 py-1 text-[10px] font-extrabold leading-none text-white tabular-nums">
              -{discount}%
            </span>
          )}
        </div>

        {lowStock && (
          <span className="absolute bottom-2 left-2 rounded bg-white/95 px-1.5 py-1 text-[10px] font-bold leading-none text-[#FF6A00] shadow-sm tabular-nums">
            Only {product.stock} left
          </span>
        )}

        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/55">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#222222]/88 px-3 py-1.5 text-[11px] font-bold text-white">
              <ImageOff className="h-3.5 w-3.5" />
              Out of stock
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex min-w-0 items-center gap-1 text-[11px] text-[#8A8A8A]">
          <Store className="h-3 w-3 shrink-0 text-[#A3A3A3]" />
          <span className="truncate font-semibold text-[#525252]">{product.sellerName}</span>
          {product.brand && (
            <>
              <span aria-hidden="true" className="text-[#D4D4D4]">|</span>
              <span className="truncate">{product.brand}</span>
            </>
          )}
        </div>

        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-[#1F1F1F] transition-colors group-hover:text-[#FF6A00]">
          {product.title}
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#7A7A7A]">
          <span className="inline-flex items-center gap-1">
            <RatingStars rating={product.rating} />
            <span className="font-bold text-[#1F1F1F] tabular-nums">{product.rating.toFixed(1)}</span>
          </span>
          {product.reviewsCount > 0 && (
            <span className="tabular-nums">({compact(product.reviewsCount)})</span>
          )}
          {product.salesCount > 0 && (
            <>
              <span aria-hidden="true" className="text-[#D4D4D4]">·</span>
              <span className="tabular-nums">{compact(product.salesCount)} sold</span>
            </>
          )}
        </div>

        <div className="mt-auto space-y-2 pt-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-xl font-extrabold leading-none text-[#FF6A00] tabular-nums">
              ${product.price.toFixed(2)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <>
                <span className="text-xs text-[#A3A3A3] line-through tabular-nums">
                  ${product.originalPrice.toFixed(2)}
                </span>
                <span className="text-[11px] font-bold text-[#FF6A00] tabular-nums">-{discount}%</span>
              </>
            )}
          </div>

          {product.shippingTimeDays && (
            <div className="flex items-center gap-1 text-[11px] text-[#7A7A7A]">
              <Truck className="h-3 w-3 shrink-0 text-[#22A06B]" />
              <span className="truncate">{product.shippingTimeDays}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              onClick={handleAddToCart}
              disabled={!inStock}
              aria-label={`Add ${product.title} to cart`}
              className="inline-flex items-center justify-center gap-1 rounded border border-[#FF6A00] bg-white py-2 text-[11px] font-bold text-[#FF6A00] transition-colors hover:bg-[#FFF4EC] disabled:cursor-not-allowed disabled:border-[#E0E0E0] disabled:text-[#B5B5B5] disabled:hover:bg-white"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="truncate">{inStock ? 'Add to Cart' : 'Sold out'}</span>
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!inStock}
              aria-label={`Buy ${product.title} now`}
              className="rounded bg-[#FF6A00] py-2 text-[11px] font-bold text-white transition-colors hover:bg-[#FF8A00] disabled:cursor-not-allowed disabled:bg-[#D4D4D4] disabled:hover:bg-[#D4D4D4]"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
