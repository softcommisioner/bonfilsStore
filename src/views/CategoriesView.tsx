import React, { useState, useEffect } from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { api } from '../services/api';

interface CategoriesViewProps {
  onSelectCategory: (cat: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ onSelectCategory }) => {
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([]);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.name}
            onClick={() => onSelectCategory(cat.name)}
            className="p-5 bg-white rounded-xl border border-[#E5E5E5] hover:border-[#FF6A00] transition-all hover:shadow-xs cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFF3E8] text-[#FF6A00] flex items-center justify-center group-hover:bg-[#FF6A00] group-hover:text-white transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#222222] group-hover:text-[#FF6A00] transition-colors">{cat.name}</h3>
                <span className="text-xs text-[#888888] tabular-nums font-mono">{cat.count} Available Products</span>
              </div>
            </div>

            <ArrowRight className="w-4 h-4 text-[#CCCCCC] group-hover:text-[#FF6A00] transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
};
