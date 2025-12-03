import { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { 
  GitCompare, 
  Plus, 
  X, 
  Search,
  TrendingDown,
  TrendingUp,
  Package,
  Check
} from 'lucide-react';
import { Card, Button } from '../components/common';
import { SearchInput } from '../components/common/Input';
import { SiteBadge, PriceChangeBadge } from '../components/common/Badge';
import { formatPrice } from '../utils/formatters';

// Sample products for comparison
const sampleProducts = [
  { id: 1, title: 'Sony WH-1000XM5 Headphones', site: 'amazon', currentPrice: 279.99, lowestPrice: 249.99, highestPrice: 349.99, avgPrice: 299.99 },
  { id: 2, title: 'Bose QuietComfort 45', site: 'amazon', currentPrice: 249.99, lowestPrice: 229.99, highestPrice: 329.99, avgPrice: 279.99 },
  { id: 3, title: 'Apple AirPods Max', site: 'amazon', currentPrice: 449.99, lowestPrice: 399.99, highestPrice: 549.99, avgPrice: 499.99 },
];

// Comparison row
function ComparisonRow({ label, values, highlight = null, format = 'text' }) {
  return (
    <div className="grid grid-cols-4 gap-4 py-3 border-b border-slate-800/30">
      <div className="text-sm text-slate-400">{label}</div>
      {values.map((value, index) => (
        <div 
          key={index} 
          className={clsx(
            'text-sm font-medium text-center',
            highlight === 'lowest' && value === Math.min(...values.filter(v => typeof v === 'number')) && 'text-emerald-400',
            highlight === 'highest' && value === Math.max(...values.filter(v => typeof v === 'number')) && 'text-rose-400',
            !highlight && 'text-white'
          )}
        >
          {format === 'price' ? formatPrice(value) : value}
        </div>
      ))}
    </div>
  );
}

// Product card in compare selection
function ProductSelectCard({ product, isSelected, onToggle }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={clsx(
        'p-4 rounded-xl cursor-pointer transition-all duration-200',
        'border',
        isSelected 
          ? 'bg-indigo-500/10 border-indigo-500/50' 
          : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={clsx(
          'h-10 w-10 rounded-lg flex-shrink-0 flex items-center justify-center',
          isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-700/50 text-slate-500'
        )}>
          {isSelected ? <Check className="h-5 w-5" /> : <Package className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white line-clamp-1">{product.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <SiteBadge site={product.site} />
            <span className="text-sm font-semibold text-white">{formatPrice(product.currentPrice)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Comparison card header
function CompareProductHeader({ product, onRemove }) {
  return (
    <div className="relative p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
      <button
        onClick={onRemove}
        className={clsx(
          'absolute -top-2 -right-2 p-1 rounded-full',
          'bg-slate-700 hover:bg-rose-500 text-slate-400 hover:text-white',
          'transition-colors duration-200'
        )}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="text-center">
        <div className={clsx(
          'mx-auto w-12 h-12 rounded-xl mb-3',
          'bg-gradient-to-br from-slate-700/50 to-slate-800/50',
          'border border-slate-700/50',
          'flex items-center justify-center'
        )}>
          <Package className="h-6 w-6 text-slate-500" />
        </div>
        <p className="text-sm font-medium text-white line-clamp-2 mb-2">{product.title}</p>
        <SiteBadge site={product.site} />
      </div>
    </div>
  );
}

export default function Compare() {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleProduct = (product) => {
    if (selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    } else if (selectedProducts.length < 3) {
      setSelectedProducts(prev => [...prev, product]);
    }
  };

  const removeProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const filteredProducts = sampleProducts.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitCompare className="h-7 w-7 text-indigo-400" />
          Compare Products
        </h1>
        <p className="text-slate-400 mt-1">
          Select up to 3 products to compare side by side
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <Card className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-white mb-4">Select Products</h2>
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="mb-4"
          />
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredProducts.map((product) => (
              <ProductSelectCard
                key={product.id}
                product={product}
                isSelected={selectedProducts.some(p => p.id === product.id)}
                onToggle={() => toggleProduct(product)}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            {selectedProducts.length}/3 products selected
          </p>
        </Card>

        {/* Comparison View */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4">Comparison</h2>
          
          {selectedProducts.length >= 2 ? (
            <div className="space-y-6">
              {/* Product Headers */}
              <div className="grid grid-cols-4 gap-4">
                <div /> {/* Empty cell for labels */}
                {selectedProducts.map((product) => (
                  <CompareProductHeader 
                    key={product.id} 
                    product={product} 
                    onRemove={() => removeProduct(product.id)}
                  />
                ))}
                {selectedProducts.length < 3 && (
                  <div className={clsx(
                    'p-4 rounded-xl border-2 border-dashed border-slate-700/50',
                    'flex flex-col items-center justify-center text-slate-500'
                  )}>
                    <Plus className="h-6 w-6 mb-2" />
                    <span className="text-xs">Add product</span>
                  </div>
                )}
              </div>

              {/* Comparison Rows */}
              <div className="space-y-1">
                <ComparisonRow 
                  label="Current Price" 
                  values={selectedProducts.map(p => p.currentPrice)}
                  highlight="lowest"
                  format="price"
                />
                <ComparisonRow 
                  label="Lowest Price" 
                  values={selectedProducts.map(p => p.lowestPrice)}
                  format="price"
                />
                <ComparisonRow 
                  label="Highest Price" 
                  values={selectedProducts.map(p => p.highestPrice)}
                  format="price"
                />
                <ComparisonRow 
                  label="Average Price" 
                  values={selectedProducts.map(p => p.avgPrice)}
                  format="price"
                />
                <ComparisonRow 
                  label="Savings from High" 
                  values={selectedProducts.map(p => p.highestPrice - p.currentPrice)}
                  highlight="highest"
                  format="price"
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <GitCompare className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Select Products to Compare</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                Choose at least 2 products from the list to start comparing their prices and features.
              </p>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
