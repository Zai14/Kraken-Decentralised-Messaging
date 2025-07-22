import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign,
  BarChart3,
  RefreshCcw,
  Clock,
  TrendingUp,
  Sparkles,
  AlertCircle,
  Shield,
  CheckCircle2,
  Activity,
  Globe,
  Star,
  Zap,
  WifiOff
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
  market_cap_rank: number;
  price_change_24h: number;
  high_24h: number;
  low_24h: number;
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
  const [marketStats, setMarketStats] = useState({
    totalMarketCap: 0,
    totalVolume: 0,
    btcDominance: 0,
    activeCryptocurrencies: 0
  });
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetchCryptoData();
    fetchGlobalStats();
    const interval = setInterval(() => {
      fetchCryptoData();
      fetchGlobalStats();
    }, 60000); // Update every minute
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
        height: 450,
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

      const selectedCryptoData = cryptoData.find(c => c.id === selectedCrypto);
      const isPositive = selectedCryptoData ? selectedCryptoData.price_change_percentage_24h >= 0 : true;

      const lineSeries = chart.addLineSeries({
        color: isPositive ? '#10B981' : '#EF4444',
        lineWidth: 3,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 8,
        crosshairMarkerBorderColor: isPositive ? '#10B981' : '#EF4444',
        crosshairMarkerBackgroundColor: '#18181B',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      lineSeries.setData(chartData);
      chartSeriesRef.current = lineSeries;
      chart.timeScale().fitContent();
    }
  }, [chart, chartData, selectedCrypto, cryptoData]);

  const fetchGlobalStats = async () => {
    try {
      setApiError(null); // Reset error state
      const response = await fetch('https://api.coingecko.com/api/v3/global');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setMarketStats({
        totalMarketCap: data.data.total_market_cap.usd,
        totalVolume: data.data.total_volume.usd,
        btcDominance: data.data.market_cap_percentage.btc,
        activeCryptocurrencies: data.data.active_cryptocurrencies
      });
    } catch (error) {
      console.error('Error fetching global stats:', error);
      setApiError('Failed to load market data. Please check your internet connection or try again later.');
    }
  };

  const fetchCryptoData = async () => {
    try {
      setApiError(null); // Reset error state
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&sparkline=false&price_change_percentage=24h'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setCryptoData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching crypto data:', error);
      setApiError('Failed to load cryptocurrency data. Please check your internet connection or try again later.');
      setLoading(false);
    }
  };

  const fetchChartData = async () => {
    try {
      const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 365;
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${selectedCrypto}/market_chart?vs_currency=usd&days=${days}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
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
      // Chart data errors are less critical, so we don't set the main apiError
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

  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) {
      return `$${(num / 1e12).toFixed(2)}T`;
    } else if (num >= 1e9) {
      return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `$${(num / 1e6).toFixed(2)}M`;
    } else {
      return formatNumber(num);
    }
  };

  const handleRetry = () => {
    setApiError(null);
    setLoading(true);
    fetchCryptoData();
    fetchGlobalStats();
  };

  const selectedCryptoData = cryptoData.find(c => c.id === selectedCrypto);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <TrendingUp className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-zinc-100">Cryptocurrency Market</h1>
        </div>
        <p className="text-zinc-400">Real-time cryptocurrency prices, charts, and market data</p>
      </div>

      {/* API Error Message */}
      {apiError && (
        <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <WifiOff className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 font-semibold mb-2">Connection Error</h3>
              <p className="text-red-300/90 mb-4">{apiError}</p>
              <div className="space-y-2 text-sm text-red-300/80 mb-4">
                <p>• Check your internet connection</p>
                <p>• Disable ad-blockers or browser extensions that might block API requests</p>
                <p>• The CoinGecko API might be temporarily unavailable</p>
              </div>
              <button
                onClick={handleRetry}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <RefreshCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Market Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50">
          <div className="flex items-center space-x-3 mb-2">
            <Globe className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-zinc-400">Total Market Cap</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {apiError ? '--' : formatLargeNumber(marketStats.totalMarketCap)}
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="w-5 h-5 text-green-500" />
            <span className="text-sm text-zinc-400">24h Volume</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {apiError ? '--' : formatLargeNumber(marketStats.totalVolume)}
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50">
          <div className="flex items-center space-x-3 mb-2">
            <Star className="w-5 h-5 text-orange-500" />
            <span className="text-sm text-zinc-400">BTC Dominance</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {apiError ? '--' : `${marketStats.btcDominance.toFixed(1)}%`}
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50">
          <div className="flex items-center space-x-3 mb-2">
            <Zap className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-zinc-400">Active Coins</span>
          </div>
          <p className="text-2xl font-bold text-zinc-100">
            {apiError ? '--' : marketStats.activeCryptocurrencies.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cryptocurrency List */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg border border-zinc-800/50 shadow-lg">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold text-zinc-100">Top Cryptocurrencies</h2>
              </div>
              <button 
                onClick={handleRetry}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-100"
                title="Refresh Data"
              >
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : apiError ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                <WifiOff className="w-12 h-12 text-zinc-500 mb-4" />
                <p className="text-zinc-400 mb-4">Unable to load cryptocurrency data</p>
                <button
                  onClick={handleRetry}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-4 py-2 rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                {cryptoData.map((crypto) => (
                  <button
                    key={crypto.id}
                    onClick={() => setSelectedCrypto(crypto.id)}
                    className={`w-full flex items-center justify-between p-4 transition-all border-b border-zinc-800/30 last:border-b-0 ${
                      selectedCrypto === crypto.id 
                        ? 'bg-blue-500/10 border-l-4 border-l-blue-500' 
                        : 'hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <img src={crypto.image} alt={crypto.name} className="w-10 h-10" />
                        <div className="absolute -top-1 -right-1 bg-zinc-700 text-zinc-300 text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {crypto.market_cap_rank}
                        </div>
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

        {/* Chart and Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Selected Crypto Details */}
          {selectedCryptoData && !apiError && (
            <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50 shadow-lg">
              <div className="flex items-center space-x-4 mb-6">
                <img src={selectedCryptoData.image} alt={selectedCryptoData.name} className="w-12 h-12" />
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100">{selectedCryptoData.name}</h2>
                  <p className="text-zinc-400">{selectedCryptoData.symbol.toUpperCase()}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-3xl font-bold text-zinc-100">{formatNumber(selectedCryptoData.current_price)}</p>
                  <p className={`text-lg flex items-center justify-end ${
                    selectedCryptoData.price_change_percentage_24h >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {selectedCryptoData.price_change_percentage_24h >= 0 ? (
                      <ArrowUpRight className="w-5 h-5 mr-1" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 mr-1" />
                    )}
                    {formatNumber(selectedCryptoData.price_change_24h)} ({selectedCryptoData.price_change_percentage_24h.toFixed(2)}%)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-zinc-400">Market Cap</p>
                  <p className="text-lg font-semibold text-zinc-100">{formatLargeNumber(selectedCryptoData.market_cap)}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">24h Volume</p>
                  <p className="text-lg font-semibold text-zinc-100">{formatLargeNumber(selectedCryptoData.total_volume)}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">24h High</p>
                  <p className="text-lg font-semibold text-green-400">{formatNumber(selectedCryptoData.high_24h)}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">24h Low</p>
                  <p className="text-lg font-semibold text-red-400">{formatNumber(selectedCryptoData.low_24h)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Price Chart */}
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
                    disabled={apiError !== null}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      timeframe === tf 
                        ? 'bg-blue-500 text-zinc-100 shadow-lg shadow-blue-500/20' 
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                    } ${apiError ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            {apiError ? (
              <div className="w-full h-[450px] flex items-center justify-center bg-zinc-800/30 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                  <p className="text-zinc-400">Chart data unavailable</p>
                </div>
              </div>
            ) : (
              <div ref={chartContainerRef} className="w-full h-[450px]" />
            )}
          </div>

          {/* FIU Compliance Notice */}
          <div className="bg-gradient-to-br from-amber-500/5 to-amber-600/10 rounded-lg overflow-hidden">
            <div className="p-6 backdrop-blur-sm border border-amber-500/20">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 bg-amber-500/10 p-3 rounded-lg">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-amber-400 font-bold text-lg flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    FIU Compliance Notice
                  </h3>
                  <p className="text-amber-200/90 leading-relaxed">
                    This cryptocurrency market viewer is for informational purposes only. Trading and investment 
                    features are currently disabled to ensure compliance with Financial Intelligence Unit (FIU) 
                    guidelines and regulatory requirements.
                  </p>
                  <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
                    <h4 className="text-amber-300 font-semibold mb-2">Compliance Status:</h4>
                    <ul className="space-y-2 text-sm text-amber-200/80">
                      <li className="flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-2 text-amber-400" />
                        Market data viewing - Enabled
                      </li>
                      <li className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-amber-400" />
                        Trading functionality - Under review
                      </li>
                      <li className="flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-amber-400" />
                        Wallet integration - Pending compliance
                      </li>
                    </ul>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-amber-400/80 pt-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Updates will be implemented following regulatory approval</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon Features */}
          <div className="bg-zinc-900/50 backdrop-blur-sm rounded-lg p-6 border border-zinc-800/50 shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <Sparkles className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-bold text-zinc-100">Coming Soon</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button disabled className="w-full bg-zinc-800/50 text-zinc-100 p-4 rounded-lg border border-zinc-700/50 flex items-center justify-between group-hover:border-blue-500/20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    <span>Portfolio Tracking</span>
                  </div>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button disabled className="w-full bg-zinc-800/50 text-zinc-100 p-4 rounded-lg border border-zinc-700/50 flex items-center justify-between group-hover:border-blue-500/20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <span>Price Alerts</span>
                  </div>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button disabled className="w-full bg-zinc-800/50 text-zinc-100 p-4 rounded-lg border border-zinc-700/50 flex items-center justify-between group-hover:border-blue-500/20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <span>Advanced Analytics</span>
                  </div>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </button>
              </div>

              <div className="group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button disabled className="w-full bg-zinc-800/50 text-zinc-100 p-4 rounded-lg border border-zinc-700/50 flex items-center justify-between group-hover:border-blue-500/20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <span>Trading Interface</span>
                  </div>
                  <Clock className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}