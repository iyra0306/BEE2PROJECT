import type {
  CurrencyCode,
  ExchangeCode,
  MarketRegion,
} from '../../src/types/market.ts';

export interface IndexDefinition {
  id: 'NIFTY50' | 'SENSEX' | 'NASDAQ' | 'SP500';
  symbol: string;
  normalizedSymbol: string;
  name: string;
  market: MarketRegion;
  exchange: string;
  currency: CurrencyCode;
  provider: 'GFDL' | 'Twelve Data';
  providerSymbol: string;
}

export interface EquityDefinition {
  ticker: string;
  normalizedSymbol: string;
  name: string;
  market: MarketRegion;
  exchange: ExchangeCode;
  currency: CurrencyCode;
  sector: string;
  provider: 'GFDL' | 'Twelve Data';
  providerSymbol: string;
  alternateGfdlSymbols?: string[];
}

export const INDEX_DEFINITIONS: IndexDefinition[] = [
  {
    id: 'NIFTY50',
    symbol: 'NIFTY 50',
    normalizedSymbol: 'NSE:NIFTY 50',
    name: 'NSE Benchmark 50',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    provider: 'GFDL',
    providerSymbol: 'NIFTY 50',
  },
  {
    id: 'SENSEX',
    symbol: 'SENSEX',
    normalizedSymbol: 'BSE:SENSEX',
    name: 'BSE 30 Sensitive Index',
    market: 'India',
    exchange: 'BSE',
    currency: 'INR',
    provider: 'GFDL',
    providerSymbol: 'SENSEX',
  },
  {
    id: 'NASDAQ',
    symbol: 'IXIC',
    normalizedSymbol: 'NASDAQ:IXIC',
    name: 'Nasdaq Composite',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    provider: 'Twelve Data',
    providerSymbol: 'IXIC',
  },
  {
    id: 'SP500',
    symbol: 'SPX',
    normalizedSymbol: 'CBOE:SPX',
    name: 'S&P 500 Index',
    market: 'US',
    exchange: 'CBOE / NYSE',
    currency: 'USD',
    provider: 'Twelve Data',
    providerSymbol: 'SPX',
  },
];

export const TRACKED_EQUITIES: EquityDefinition[] = [
  // INDIA EQUITIES (GFDL — NSE & BSE)
  {
    ticker: 'RELIANCE',
    normalizedSymbol: 'NSE:RELIANCE',
    name: 'Reliance Industries Ltd',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    sector: 'Energy & Telecom',
    provider: 'GFDL',
    providerSymbol: 'RELIANCE',
  },
  {
    ticker: 'TCS',
    normalizedSymbol: 'NSE:TCS',
    name: 'Tata Consultancy Services Ltd',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    sector: 'Information Technology',
    provider: 'GFDL',
    providerSymbol: 'TCS',
  },
  {
    ticker: 'HDFCBANK',
    normalizedSymbol: 'NSE:HDFCBANK',
    name: 'HDFC Bank Ltd',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    sector: 'Banking & Finance',
    provider: 'GFDL',
    providerSymbol: 'HDFCBANK',
  },
  {
    ticker: 'INFY',
    normalizedSymbol: 'NSE:INFY',
    name: 'Infosys Ltd',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    sector: 'Information Technology',
    provider: 'GFDL',
    providerSymbol: 'INFY',
  },
  {
    ticker: 'ICICIBANK',
    normalizedSymbol: 'NSE:ICICIBANK',
    name: 'ICICI Bank Ltd',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    sector: 'Banking & Finance',
    provider: 'GFDL',
    providerSymbol: 'ICICIBANK',
  },
  {
    ticker: 'TATAMOTORS',
    normalizedSymbol: 'BSE:TATAMOTORS',
    name: 'Tata Motors Ltd',
    market: 'India',
    exchange: 'BSE',
    currency: 'INR',
    sector: 'Automotive & EV',
    provider: 'GFDL',
    providerSymbol: 'TATAMOTORS',
    alternateGfdlSymbols: ['500570'],
  },
  {
    ticker: 'BHARTIARTL',
    normalizedSymbol: 'NSE:BHARTIARTL',
    name: 'Bharti Airtel Ltd',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    sector: 'Telecom',
    provider: 'GFDL',
    providerSymbol: 'BHARTIARTL',
  },
  {
    ticker: 'ITC',
    normalizedSymbol: 'BSE:ITC',
    name: 'ITC Ltd',
    market: 'India',
    exchange: 'BSE',
    currency: 'INR',
    sector: 'Consumer Staples',
    provider: 'GFDL',
    providerSymbol: 'ITC',
    alternateGfdlSymbols: ['500875'],
  },
  {
    ticker: 'SBIN',
    normalizedSymbol: 'NSE:SBIN',
    name: 'State Bank of India',
    market: 'India',
    exchange: 'NSE',
    currency: 'INR',
    sector: 'Banking & Finance',
    provider: 'GFDL',
    providerSymbol: 'SBIN',
  },

  // US EQUITIES (Twelve Data — NASDAQ & NYSE)
  {
    ticker: 'NVDA',
    normalizedSymbol: 'NASDAQ:NVDA',
    name: 'NVIDIA Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Semiconductors & AI',
    provider: 'Twelve Data',
    providerSymbol: 'NVDA',
  },
  {
    ticker: 'AAPL',
    normalizedSymbol: 'NASDAQ:AAPL',
    name: 'Apple Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Consumer Technology',
    provider: 'Twelve Data',
    providerSymbol: 'AAPL',
  },
  {
    ticker: 'MSFT',
    normalizedSymbol: 'NASDAQ:MSFT',
    name: 'Microsoft Corporation',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Enterprise Software & Cloud',
    provider: 'Twelve Data',
    providerSymbol: 'MSFT',
  },
  {
    ticker: 'GOOGL',
    normalizedSymbol: 'NASDAQ:GOOGL',
    name: 'Alphabet Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Digital Media & AI',
    provider: 'Twelve Data',
    providerSymbol: 'GOOGL',
  },
  {
    ticker: 'AMZN',
    normalizedSymbol: 'NASDAQ:AMZN',
    name: 'Amazon.com Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Cloud & E-Commerce',
    provider: 'Twelve Data',
    providerSymbol: 'AMZN',
  },
  {
    ticker: 'TSLA',
    normalizedSymbol: 'NASDAQ:TSLA',
    name: 'Tesla Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Automotive & EV',
    provider: 'Twelve Data',
    providerSymbol: 'TSLA',
  },
  {
    ticker: 'AMD',
    normalizedSymbol: 'NASDAQ:AMD',
    name: 'Advanced Micro Devices Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Semiconductors & AI',
    provider: 'Twelve Data',
    providerSymbol: 'AMD',
  },
  {
    ticker: 'JPM',
    normalizedSymbol: 'NYSE:JPM',
    name: 'JPMorgan Chase & Co.',
    market: 'US',
    exchange: 'NYSE',
    currency: 'USD',
    sector: 'Banking & Finance',
    provider: 'Twelve Data',
    providerSymbol: 'JPM',
  },
  {
    ticker: 'META',
    normalizedSymbol: 'NASDAQ:META',
    name: 'Meta Platforms Inc.',
    market: 'US',
    exchange: 'NASDAQ',
    currency: 'USD',
    sector: 'Digital Media & AI',
    provider: 'Twelve Data',
    providerSymbol: 'META',
  },
];

export const TRACKED_UNIVERSE_LABEL =
  'BULLSIGHT Tracked Universe (18 NSE, BSE, NASDAQ & NYSE equities)';
