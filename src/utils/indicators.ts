import type { OhlcvBar, SignalType } from '../types/market';

export interface TimeValuePoint {
  time: string;
  timestamp: number;
  value: number;
}

export interface BollingerPoint {
  time: string;
  timestamp: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdPoint {
  time: string;
  timestamp: number;
  macd: number;
  signal: number;
  histogram: number;
}

export function calculateSMA(bars: OhlcvBar[], period: number): TimeValuePoint[] {
  if (bars.length < period) return [];
  const result: TimeValuePoint[] = [];
  let sum = 0;

  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].close;
    if (i >= period) {
      sum -= bars[i - period].close;
    }
    if (i >= period - 1) {
      result.push({
        time: bars[i].time,
        timestamp: bars[i].timestamp,
        value: Number((sum / period).toFixed(2)),
      });
    }
  }
  return result;
}

export function calculateEMA(bars: OhlcvBar[], period: number): TimeValuePoint[] {
  if (bars.length < period) return [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < period; i++) {
    ema += bars[i].close;
  }
  ema /= period;

  const result: TimeValuePoint[] = [
    {
      time: bars[period - 1].time,
      timestamp: bars[period - 1].timestamp,
      value: Number(ema.toFixed(2)),
    },
  ];

  for (let i = period; i < bars.length; i++) {
    ema = bars[i].close * k + ema * (1 - k);
    result.push({
      time: bars[i].time,
      timestamp: bars[i].timestamp,
      value: Number(ema.toFixed(2)),
    });
  }
  return result;
}

export function calculateBollingerBands(
  bars: OhlcvBar[],
  period = 20,
  multiplier = 2
): BollingerPoint[] {
  if (bars.length < period) return [];
  const result: BollingerPoint[] = [];

  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, b) => acc + b.close, 0) / period;
    const variance =
      slice.reduce((acc, b) => acc + Math.pow(b.close - mean, 2), 0) / period;
    const std = Math.sqrt(variance);

    result.push({
      time: bars[i].time,
      timestamp: bars[i].timestamp,
      upper: Number((mean + multiplier * std).toFixed(2)),
      middle: Number(mean.toFixed(2)),
      lower: Number((mean - multiplier * std).toFixed(2)),
    });
  }
  return result;
}

export function calculateRSI(bars: OhlcvBar[], period = 14): TimeValuePoint[] {
  if (bars.length <= period) return [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const result: TimeValuePoint[] = [];
  const pushRsi = (idx: number) => {
    const rsi = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss);
    result.push({
      time: bars[idx].time,
      timestamp: bars[idx].timestamp,
      value: Number(rsi.toFixed(2)),
    });
  };

  pushRsi(period);

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    pushRsi(i + 1);
  }

  return result;
}

export function calculateMACD(
  bars: OhlcvBar[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdPoint[] {
  if (bars.length < slow + signalPeriod - 1) return [];

  const emaFast = calculateEMA(bars, fast);
  const emaSlow = calculateEMA(bars, slow);
  const fastMap = new Map(emaFast.map((p) => [p.timestamp, p.value]));

  const macdLine: TimeValuePoint[] = [];
  for (const slowPt of emaSlow) {
    const fastVal = fastMap.get(slowPt.timestamp);
    if (fastVal !== undefined) {
      macdLine.push({
        time: slowPt.time,
        timestamp: slowPt.timestamp,
        value: Number((fastVal - slowPt.value).toFixed(4)),
      });
    }
  }

  if (macdLine.length < signalPeriod) return [];

  const k = 2 / (signalPeriod + 1);
  let sig =
    macdLine.slice(0, signalPeriod).reduce((a, b) => a + b.value, 0) /
    signalPeriod;

  const result: MacdPoint[] = [
    {
      time: macdLine[signalPeriod - 1].time,
      timestamp: macdLine[signalPeriod - 1].timestamp,
      macd: Number(macdLine[signalPeriod - 1].value.toFixed(3)),
      signal: Number(sig.toFixed(3)),
      histogram: Number((macdLine[signalPeriod - 1].value - sig).toFixed(3)),
    },
  ];

  for (let i = signalPeriod; i < macdLine.length; i++) {
    sig = macdLine[i].value * k + sig * (1 - k);
    result.push({
      time: macdLine[i].time,
      timestamp: macdLine[i].timestamp,
      macd: Number(macdLine[i].value.toFixed(3)),
      signal: Number(sig.toFixed(3)),
      histogram: Number((macdLine[i].value - sig).toFixed(3)),
    });
  }

  return result;
}

export interface TechnicalSummary {
  overallSignal: SignalType;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  latestPrice: number | null;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: MacdPoint | null;
  bollinger: BollingerPoint | null;
}

export function summarizeIndicators(bars: OhlcvBar[]): TechnicalSummary {
  const sma20Arr = calculateSMA(bars, 20);
  const sma50Arr = calculateSMA(bars, 50);
  const ema12Arr = calculateEMA(bars, 12);
  const ema26Arr = calculateEMA(bars, 26);
  const rsiArr = calculateRSI(bars, 14);
  const macdArr = calculateMACD(bars, 12, 26, 9);
  const bbArr = calculateBollingerBands(bars, 20, 2);

  const latestPrice = bars.length ? bars[bars.length - 1].close : null;
  const sma20 = sma20Arr.length ? sma20Arr[sma20Arr.length - 1].value : null;
  const sma50 = sma50Arr.length ? sma50Arr[sma50Arr.length - 1].value : null;
  const ema12 = ema12Arr.length ? ema12Arr[ema12Arr.length - 1].value : null;
  const ema26 = ema26Arr.length ? ema26Arr[ema26Arr.length - 1].value : null;
  const rsi14 = rsiArr.length ? rsiArr[rsiArr.length - 1].value : null;
  const macd = macdArr.length ? macdArr[macdArr.length - 1] : null;
  const bollinger = bbArr.length ? bbArr[bbArr.length - 1] : null;

  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  if (latestPrice !== null && sma20 !== null) {
    if (latestPrice > sma20) bullishCount++;
    else bearishCount++;
  }
  if (latestPrice !== null && sma50 !== null) {
    if (latestPrice > sma50) bullishCount++;
    else bearishCount++;
  }
  if (ema12 !== null && ema26 !== null) {
    if (ema12 > ema26) bullishCount++;
    else bearishCount++;
  }
  if (rsi14 !== null) {
    if (rsi14 >= 55 && rsi14 <= 72) bullishCount++;
    else if (rsi14 <= 45) bearishCount++;
    else neutralCount++;
  }
  if (macd !== null) {
    if (macd.macd > macd.signal) bullishCount++;
    else if (macd.macd < macd.signal) bearishCount++;
    else neutralCount++;
  }

  let overallSignal: SignalType = 'Neutral';
  if (bullishCount > bearishCount + 1) overallSignal = 'Bullish';
  else if (bearishCount > bullishCount + 1) overallSignal = 'Bearish';
  else if (bullishCount > bearishCount) overallSignal = 'Bullish';
  else if (bearishCount > bullishCount) overallSignal = 'Bearish';

  return {
    overallSignal,
    bullishCount,
    bearishCount,
    neutralCount,
    latestPrice,
    sma20,
    sma50,
    ema12,
    ema26,
    rsi14,
    macd,
    bollinger,
  };
}
