import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useChartData } from '../../hooks/useChartData';
import { BarChart3, RefreshCw } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const TIME_RANGES = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

export default function PriceChart({ productId, className = '' }) {
  const [range, setRange] = useState('30d');
  const { data, isLoading, error, refetch, isFetching } = useChartData(productId, range);

  // Chart options
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e2e8f0',
        bodyColor: '#fff',
        borderColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context) => {
            const date = new Date(context[0].label);
            return date.toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          },
          label: (context) => {
            const value = context.parsed.y;
            const currency = data?.meta?.currency || 'USD';
            return `Price: ${new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency,
            }).format(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          maxTicksLimit: 6,
          callback: function(value, index) {
            const label = this.getLabelForValue(value);
            const date = new Date(label);
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
          },
        },
      },
      y: {
        display: true,
        grid: {
          color: 'rgba(100, 116, 139, 0.1)',
        },
        border: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: function(value) {
            return '$' + value.toFixed(2);
          },
        },
      },
    },
    elements: {
      line: {
        tension: 0.3,
      },
      point: {
        radius: 0,
        hoverRadius: 6,
        hoverBackgroundColor: '#818cf8',
        hoverBorderColor: '#fff',
        hoverBorderWidth: 2,
      },
    },
  }), [data?.meta?.currency]);

  // Transform API data to Chart.js format
  const chartData = useMemo(() => {
    if (!data?.labels || !data?.datasets) {
      return {
        labels: [],
        datasets: [{
          data: [],
          borderColor: 'rgb(129, 140, 248)',
          backgroundColor: 'rgba(129, 140, 248, 0.1)',
          fill: true,
        }],
      };
    }

    return {
      labels: data.labels,
      datasets: [{
        label: 'Price',
        data: data.datasets[0]?.data || [],
        borderColor: 'rgb(129, 140, 248)',
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 300);
          gradient.addColorStop(0, 'rgba(129, 140, 248, 0.3)');
          gradient.addColorStop(1, 'rgba(129, 140, 248, 0)');
          return gradient;
        },
        fill: true,
        borderWidth: 2,
      }],
    };
  }, [data]);

  // Render empty state
  if (!productId) {
    return (
      <div className={clsx(
        'h-64 rounded-xl',
        'bg-gradient-to-br from-slate-800/50 to-slate-900/50',
        'border border-slate-700/30',
        'flex items-center justify-center',
        className
      )}>
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No product selected</p>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className={clsx(
        'h-64 rounded-xl',
        'bg-gradient-to-br from-slate-800/50 to-slate-900/50',
        'border border-slate-700/30',
        'flex items-center justify-center',
        className
      )}>
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
          </motion.div>
          <p className="text-slate-500">Loading chart data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={clsx(
        'h-64 rounded-xl',
        'bg-gradient-to-br from-slate-800/50 to-slate-900/50',
        'border border-rose-500/30',
        'flex items-center justify-center',
        className
      )}>
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <p className="text-rose-400">Failed to load chart</p>
          <button 
            onClick={() => refetch()}
            className="mt-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Render empty data state
  if (!data?.labels?.length) {
    return (
      <div className={clsx(
        'h-64 rounded-xl',
        'bg-gradient-to-br from-slate-800/50 to-slate-900/50',
        'border border-slate-700/30',
        'flex items-center justify-center',
        className
      )}>
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500">No price history available</p>
          <p className="text-sm text-slate-600 mt-1">Data will appear after price checks</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                range === r.value
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        
        {/* Stats */}
        {data?.meta && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>{data.meta.dataPoints} data points</span>
            {isFetching && (
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-indigo-400"
              >
                Updating...
              </motion.span>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className={clsx(
        'h-64 rounded-xl p-4',
        'bg-gradient-to-br from-slate-800/30 to-slate-900/30',
        'border border-slate-700/30'
      )}>
        <Line options={options} data={chartData} />
      </div>

      {/* Price Summary */}
      {data?.meta && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Min', value: data.meta.minPrice, color: 'emerald' },
            { label: 'Max', value: data.meta.maxPrice, color: 'rose' },
            { label: 'Avg', value: data.meta.avgPrice, color: 'amber' },
            { label: 'Current', value: data.meta.lastPrice, color: 'indigo' },
          ].map((stat) => (
            <div 
              key={stat.label}
              className={clsx(
                'p-3 rounded-xl text-center',
                'bg-slate-800/30 border border-slate-700/30'
              )}
            >
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p className={clsx(
                'text-sm font-semibold',
                stat.color === 'emerald' && 'text-emerald-400',
                stat.color === 'rose' && 'text-rose-400',
                stat.color === 'amber' && 'text-amber-400',
                stat.color === 'indigo' && 'text-indigo-400',
              )}>
                {stat.value != null 
                  ? `$${parseFloat(stat.value).toFixed(2)}`
                  : 'N/A'
                }
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
