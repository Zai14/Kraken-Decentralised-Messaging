import React, { useEffect, useRef, useState } from 'react';
import { WalletConnect } from '../components/WalletConnect';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet as WalletIcon,
  DollarSign,
  BarChart3,
  RefreshCcw,
  Clock,
  TrendingUp,
  Sparkles
} from 'lucide-react';

interface CryptoData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
  image: string;
}

export function Wallet() {
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState<string>('bitcoin');
  const [chartData, setChartData] = useState<{ time: number; value: number; }[]>([]);
  const [timeframe, setTimeframe] = useState<string>('24h');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [loading, setLoading] = useState(true);
  const chartSeriesRef = useRef<any>(null);

  useEffect(() => {
    fetchCryptoData();
    const interval = setInterval(fetchCryptoData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCrypto) {
      fetchChartData();
    }
  }, [selectedCrypto, timeframe]);

  useEffect(() => {
    if (chartContainerRef.current) {
      if (chart) {
        chart.remove();
      }

      const chartInstance = createChart(chartContainerRef.current, {
        layout: {
          background: { color: '#18181B' },
          textColor: '#FFFFFF',
        },
        grid: {
          vertLines: { color: '#27272A' },
          horzLines: { color: '#27272A' },
        },
        width: chartContainerRef.current.clientWidth,
        height: 400,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#3F3F46',
        },
        rightPriceScale: {
          borderColor: '#3F3F46',
        },
        crosshair: {
          vertLine: {
            color: '#6B7280',
            width: 1,
            style: 3,
            labelBackgroundColor: '#3B82F6',
          },
          horzLine: {
            color: '#6B7280',
            width: 1,
            style: 3,
            labelBackgroundColor: '#3B82F6',
          },
        },
      });

      const handleResize = () => {
        if (chartContainerRef.current) {
          chartInstance.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', handleResize);
      setChart(chartInstance);

      return () => {
        window.removeEventListener('resize', handleResize);
        chartInstance.remove();
      };
    }
  }, []);

  useEffect(() => {
    if (chart && chartData.length > 0) {
      if (chartSeriesRef.current) {
        chart.removeSeries(chartSeriesRef.current);
      }

      const lineSeries = chart.addLineSeries({
        color: '#3B82F6',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 6,
        crosshairMarkerBorderColor: '#3B82F6',
        crosshairMarkerBackgroundColor: '#18181B',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      lineSeries.setData(chartData);
      chartSeriesRef.current = lineSeries;
      chart.timeScale().fitContent();
    }
  }, [chart, chartData]);

  const fetchCryptoData = async () => {
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&sparkline=false'
      );
      const data = await response.json();
      setCryptoData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching crypto data:', error);
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 365;
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${selectedCrypto}/market_chart?vs_currency=usd&days=${days}`
      );
      const data = await response.json();
      
      const processedData = data.prices
        .map(([timestamp, price]: [number, number]) => ({
          time: Math.floor(timestamp / 1000),
          value: price,
        }))
        .filter((item: any, index: number, self: any[]) => 
          index === self.findIndex((t) => t.time === item.time)
        )
        .sort((a: any, b: any) => a.time - b.time);

      setChartData(processedData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet Connect */}
        <div className="md:col-span-3">
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50 shadow-lg">
            <WalletConnect />
          </div>
        </div>

        {/* Market Overview */}
        <div className="md:col-span-2">
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold text-zinc-100">Market Overview</h2>
              </div>
              <button 
                onClick={fetchCryptoData}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-100"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {cryptoData.map((crypto) => (
                  <button
                    key={crypto.id}
                    onClick={() => setSelectedCrypto(crypto.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-all ${
                      selectedCrypto === crypto.id 
                        ? 'bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5' 
                        : 'hover:bg-zinc-800/50 border border-transparent hover:border-zinc-700/50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <img src={crypto.image} alt={crypto.name} className="w-10 h-10" />
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-zinc-900/10 rounded-full" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-medium text-zinc-100">{crypto.name}</h3>
                        <p className="text-sm text-zinc-400">{crypto.symbol.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-100">{formatNumber(crypto.current_price)}</p>
                      <p className={`text-sm flex items-center justify-end ${
                        crypto.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {crypto.price_change_percentage_24h >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 mr-1" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 mr-1" />
                        )}
                        {Math.abs(crypto.price_change_percentage_24h).toFixed(2)}%
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coming Soon Features */}
        <div>
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50 shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <Sparkles className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-bold text-zinc-100">Coming Soon</h2>
            </div>
            <div className="space-y-4">
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button disabled className="w-full bg-zinc-800/50 text-zinc-100 p-4 rounded-lg border border-zinc-700/50 flex items-center justify-between group-hover:border-blue-500/20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    <span>Buy Crypto</span>
                  </div>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button disabled className="w-full bg-zinc-800/50 text-zinc-100 p-4 rounded-lg border border-zinc-700/50 flex items-center justify-between group-hover:border-blue-500/20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <WalletIcon className="w-5 h-5 text-blue-500" />
                    <span>Sell Crypto</span>
                  </div>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button disabled className="w-full bg-zinc-800/50 text-zinc-100 p-4 rounded-lg border border-zinc-700/50 flex items-center justify-between group-hover:border-blue-500/20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <span>View Analytics</span>
                  </div>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Price Chart */}
        <div className="md:col-span-3">
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold text-zinc-100">Price Chart</h2>
              </div>
              <div className="flex items-center space-x-2">
                {['24h', '7d', '30d', '1y'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      timeframe === tf 
                        ? 'bg-blue-500 text-zinc-100 shadow-lg shadow-blue-500/20' 
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div ref={chartContainerRef} className="w-full h-[400px]" />
          </div>
        </div>
      </div>
    </div>
  );
}