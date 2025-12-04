import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { 
  GitCompare, 
  Plus, 
  X, 
  Search,
  TrendingDown,
  TrendingUp,
  Package,
  Check,
  BarChart3,
  ArrowRight,
  Minus
} from 'lucide-react';
import { Card, Button, CardSkeleton } from '../components/common';
import { SearchInput } from '../components/common/Input';
import { SiteBadge, PriceChangeBadge } from '../components/common/Badge';
import { formatPrice, formatDate } from '../utils/formatters';
import { useProducts, useProduct } from '../hooks/useProducts';
import { useChartData } from '../hooks/useChartData';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

// Chart colors for multiple products
const CHART_COLORS = [
  { border: 'rgb(129, 140, 248)', bg: 'rgba(129, 140, 248, 0.2)' }, // indigo
  { border: 'rgb(52, 211, 153)', bg: 'rgba(52, 211, 153, 0.2)' },   // emerald
  { border: 'rgb(251, 146, 60)', bg: 'rgba(251, 146, 60, 0.2)' },   // orange
];

// Comparison row
function ComparisonRow({ label, values, highlight = null, format = 'text', icon: Icon }) {
  const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  const minVal = numericValues.length > 0 ? Math.min(...numericValues) : null;
  const maxVal = numericValues.length > 0 ? Math.max(...numericValues) : null;

  return (
    <div className="grid gap-4 py-3 border-b border-slate-800/30" style={{ gridTemplateColumns: `180px repeat(${values.length}, 1fr)` }}>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </div>
      {values.map((value, index) => (
        <div 
          key={index} 
          className={clsx(
            'text-sm font-medium text-center py-1 px-2 rounded-lg',
            highlight === 'lowest' && value === minVal && 'bg-emerald-500/10 text-emerald-400',
            highlight === 'highest' && value === maxVal && 'bg-rose-500/10 text-rose-400',
            !(highlight === 'lowest' && value === minVal) && !(highlight === 'highest' && value === maxVal) && 'text-white'
          )}
        >
          {value == null || (typeof value === 'number' && isNaN(value)) 
            ? <span className="text-slate-500">N/A</span>
            : format === 'price' 
              ? formatPrice(value) 
              : format === 'date'
                ? formatDate(value)
                : format === 'percent'
                  ? `${value.toFixed(1)}%`
                  : value
          }
        </div>
      ))}
    </div>
  );
}

// Product card in compare selection
function ProductSelectCard({ product, isSelected, onToggle, disabled }) {
  return (
    <motion.div
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={() => !disabled && onToggle()}
      className={clsx(
        'p-4 rounded-xl cursor-pointer transition-all duration-200',
        'border',
        disabled && !isSelected && 'opacity-50 cursor-not-allowed',
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
          <p className="text-sm font-medium text-white line-clamp-2">{product.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <SiteBadge site={product.site} />
            <span className="text-sm font-semibold text-white">
              {formatPrice(product.latest_price || product.currentPrice)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Comparison card header
function CompareProductHeader({ product, onRemove, colorIndex }) {
  const color = CHART_COLORS[colorIndex % CHART_COLORS.length];
  
  return (
    <div className="relative p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
      <button
        onClick={onRemove}
        className={clsx(
          'absolute -top-2 -right-2 p-1 rounded-full z-10',
          'bg-slate-700 hover:bg-rose-500 text-slate-400 hover:text-white',
          'transition-colors duration-200'
        )}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="text-center">
        <div 
          className="mx-auto w-3 h-3 rounded-full mb-3"
          style={{ backgroundColor: color.border }}
        />
        <p className="text-sm font-medium text-white line-clamp-2 mb-2">{product.title}</p>
        <SiteBadge site={product.site} />
        <p className="text-lg font-bold text-white mt-2">
          {formatPrice(product.latest_price || product.currentPrice)}
        </p>
      </div>
    </div>
  );
}

// Product detail loader for comparison
function ProductDetailRow({ productId, onDataLoad }) {
  const { data } = useProduct(productId);
  
  // Pass data up when loaded
  useMemo(() => {
    if (data) {
      onDataLoad(productId, data);
    }
  }, [data, productId, onDataLoad]);
  
  return null;
}

// Multi-product chart component
function ComparisonChart({ productIds }) {
  // Fetch chart data for each product
  const chart1 = useChartData(productIds[0], '30d');
  const chart2 = useChartData(productIds[1], '30d');
  const chart3 = useChartData(productIds[2], '30d');
  
  const charts = [chart1, chart2, chart3].slice(0, productIds.length);
  const isLoading = charts.some(c => c.isLoading);
  
  const chartData = useMemo(() => {
    if (isLoading) return null;
    
    // Merge all labels and create unified dataset
    const allLabels = new Set();
    charts.forEach(c => {
      c.data?.labels?.forEach(l => allLabels.add(l));
    });
    const sortedLabels = Array.from(allLabels).sort((a, b) => new Date(a) - new Date(b));
    
    const datasets = charts.map((c, i) => {
      const color = CHART_COLORS[i % CHART_COLORS.length];
      const dataMap = new Map();
      c.data?.labels?.forEach((label, idx) => {
        dataMap.set(label, c.data.datasets[0]?.data[idx]);
      });
      
      return {
        label: `Product ${i + 1}`,
        data: sortedLabels.map(l => dataMap.get(l) ?? null),
        borderColor: color.border,
        backgroundColor: color.bg,
        fill: false,
        borderWidth: 2,
        tension: 0.3,
        spanGaps: true,
      };
    });
    
    return { labels: sortedLabels, datasets };
  }, [charts, isLoading]);
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e2e8f0',
        bodyColor: '#fff',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: {
          color: '#64748b',
          maxTicksLimit: 6,
          callback: function(value) {
            const label = this.getLabelForValue(value);
            return new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          },
        },
      },
      y: {
        display: true,
        grid: { color: 'rgba(100, 116, 139, 0.1)' },
        ticks: {
          color: '#64748b',
          callback: (value) => '$' + value.toFixed(0),
        },
      },
    },
  };
  
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-slate-500">Loading chart data...</div>
      </div>
    );
  }
  
  if (!chartData || chartData.labels.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No price history available for comparison</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-64">
      <Line options={options} data={chartData} />
    </div>
  );
}

export default function Compare() {
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productDetails, setProductDetails] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch products list
  const { data: productsData, isLoading: productsLoading } = useProducts(1, 50);
  const products = productsData?.products || [];

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.title?.toLowerCase().includes(query) ||
      p.site?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const toggleProduct = (product) => {
    if (selectedProductIds.includes(product.id)) {
      setSelectedProductIds(prev => prev.filter(id => id !== product.id));
      setProductDetails(prev => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
    } else if (selectedProductIds.length < 3) {
      setSelectedProductIds(prev => [...prev, product.id]);
    }
  };

  const removeProduct = (productId) => {
    setSelectedProductIds(prev => prev.filter(id => id !== productId));
    setProductDetails(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleProductDataLoad = (productId, data) => {
    setProductDetails(prev => ({ ...prev, [productId]: data }));
  };

  // Get selected products with their details
  const selectedProducts = useMemo(() => {
    return selectedProductIds.map(id => {
      const basic = products.find(p => p.id === id);
      const detail = productDetails[id];
      return { ...basic, ...detail };
    }).filter(Boolean);
  }, [selectedProductIds, products, productDetails]);

  // Calculate comparison stats
  const comparisonStats = useMemo(() => {
    if (selectedProducts.length < 2) return null;
    
    const prices = selectedProducts.map(p => p.latest_price || p.currentPrice).filter(Boolean);
    const lowest = Math.min(...prices);
    const highest = Math.max(...prices);
    const savings = highest - lowest;
    
    return { lowest, highest, savings };
  }, [selectedProducts]);

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Load product details */}
      {selectedProductIds.map(id => (
        <ProductDetailRow key={id} productId={id} onDataLoad={handleProductDataLoad} />
      ))}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompare className="h-7 w-7 text-indigo-400" />
            Compare Products
          </h1>
          <p className="text-slate-400 mt-1">
            Select up to 3 products to compare side by side
          </p>
        </div>
        {comparisonStats && (
          <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-sm text-emerald-400">
              Potential Savings: <span className="font-bold">{formatPrice(comparisonStats.savings)}</span>
            </span>
          </div>
        )}
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
            {productsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-800/30 animate-pulse" />
              ))
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductSelectCard
                  key={product.id}
                  product={product}
                  isSelected={selectedProductIds.includes(product.id)}
                  onToggle={() => toggleProduct(product)}
                  disabled={selectedProductIds.length >= 3 && !selectedProductIds.includes(product.id)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No products found</p>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            {selectedProductIds.length}/3 products selected
          </p>
        </Card>

        {/* Comparison View */}
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4">Comparison</h2>
          
          {selectedProducts.length >= 2 ? (
            <div className="space-y-6">
              {/* Product Headers */}
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selectedProducts.length}, 1fr)` }}>
                {selectedProducts.map((product, index) => (
                  <CompareProductHeader 
                    key={product.id} 
                    product={product} 
                    onRemove={() => removeProduct(product.id)}
                    colorIndex={index}
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

              {/* Price Chart */}
              <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
                <h3 className="text-sm font-medium text-slate-400 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Price History (30 Days)
                </h3>
                <ComparisonChart productIds={selectedProductIds} />
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4">
                  {selectedProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length].border }}
                      />
                      <span className="text-xs text-slate-400 truncate max-w-[150px]">{product.title}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparison Rows */}
              <div className="space-y-1">
                <ComparisonRow 
                  label="Current Price" 
                  values={selectedProducts.map(p => p.latest_price || p.currentPrice)}
                  highlight="lowest"
                  format="price"
                  icon={TrendingDown}
                />
                <ComparisonRow 
                  label="Lowest Price" 
                  values={selectedProducts.map(p => p.stats?.minPrice || p.lowestPrice)}
                  format="price"
                  icon={Minus}
                />
                <ComparisonRow 
                  label="Highest Price" 
                  values={selectedProducts.map(p => p.stats?.maxPrice || p.highestPrice)}
                  format="price"
                  icon={TrendingUp}
                />
                <ComparisonRow 
                  label="Average Price" 
                  values={selectedProducts.map(p => p.stats?.avgPrice || p.avgPrice)}
                  format="price"
                />
                <ComparisonRow 
                  label="Price Records" 
                  values={selectedProducts.map(p => p.stats?.priceCount || p.price_count || 'N/A')}
                />
                <ComparisonRow 
                  label="Site" 
                  values={selectedProducts.map(p => p.site?.charAt(0).toUpperCase() + p.site?.slice(1))}
                />
                <ComparisonRow 
                  label="Savings from High" 
                  values={selectedProducts.map(p => {
                    const high = p.stats?.maxPrice || p.highestPrice;
                    const current = p.latest_price || p.currentPrice;
                    return high && current ? high - current : null;
                  })}
                  highlight="highest"
                  format="price"
                  icon={ArrowRight}
                />
              </div>
            </div>
          ) : selectedProducts.length === 1 ? (
            <div className="text-center py-16">
              <div className="mb-4">
                <CompareProductHeader 
                  product={selectedProducts[0]} 
                  onRemove={() => removeProduct(selectedProducts[0].id)}
                  colorIndex={0}
                />
              </div>
              <p className="text-slate-500 mt-4">
                Select one more product to start comparing
              </p>
            </div>
          ) : (
            <div className="text-center py-16">
              <GitCompare className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Select Products to Compare</h3>
              <p className="text-slate-500 max-w-sm mx-auto">
                Choose at least 2 products from the list to start comparing their prices and history.
              </p>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
