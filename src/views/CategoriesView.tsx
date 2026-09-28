import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { SafeImage } from '../components/SafeImage';
import { api } from '../services/api';

interface CategoriesViewProps {
  onSelectCategory: (cat: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onSelectCategory }) => {
  const [categories, setCategories] = useState<Array<{ name: string; image?: string; count: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const data = await api.getCategories();
        setCategories(data || []);
      } catch (err) {
        console.error('Error fetching categories', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#222222]">Marketplace Categories</h1>
        <p className="text-xs text-[#666666] mt-0.5">Explore equipment, tech, and wholesale supplies by trade department.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {categories.map(cat => (
          <button
            key={cat.name}
            onClick={() => onSelectCategory(cat.name)}
            className="group flex flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-white text-left transition-all hover:border-[#FF6A00]/50 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] cursor-pointer"
          >
            <SafeImage
              src={cat.image}
              alt={cat.name}
              label={cat.name}
              className="aspect-4/3 w-full bg-[#FAFAF9]"
              imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            />
            <div className="flex flex-1 flex-col gap-1 p-3">
              <h3 className="text-[13px] font-bold leading-snug text-[#222222] transition-colors group-hover:text-[#FF6A00] line-clamp-2">
                {cat.name}
              </h3>
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-[#888888] tabular-nums">{cat.count} items</span>
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#FF6A00]">
                  Shop
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
