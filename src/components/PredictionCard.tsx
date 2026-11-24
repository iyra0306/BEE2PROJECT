import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { StockPrediction, StockRecord } from '../types/market';
import { formatCurrency, formatSignedPercent } from '../utils/formatters';

interface PredictionCardProps {
  prediction: StockPrediction;
  stock?: StockRecord;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({
  prediction,
  stock,
}) => {
  const { preferences } = useAppContext();
  const ticker = stock?.ticker ?? prediction.ticker;
  const name = stock?.name ?? prediction.stockName ?? prediction.ticker;
  const currency = stock?.currency ?? prediction.currency ?? 'USD';

  const isPositive = prediction.expectedMovePercent >= 0;
  const signalColor =
    prediction.signal === 'Bullish'
      ? 'text-[#36C982]'
      : prediction.signal === 'Bearish'
      ? 'text-[#E06C65]'
      : 'text-[#D4A857]';

  return (
    <div
      data-cursor="card"
      className="rounded-xl border border-white/8 bg-[#18211C] p-4 flex flex-col justify-between gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#91A197]">
            <span className="font-semibold text-[#E8F0EA]">{ticker}</span>
            <span aria-hidden="true">·</span>
            <span>{prediction.horizon} Horizon</span>
            <span aria-hidden="true">·</span>
            <span>Illustrative</span>
          </div>
          <p className="text-xs text-[#91A197] mt-0.5 truncate">{name}</p>
        </div>

        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold ${signalColor}`}
        >
          {prediction.signal === 'Bullish' ? (
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          ) : prediction.signal === 'Bearish' ? (
            <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {prediction.signal}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-[#91A197] block">Demo Target</span>
          <span className="font-mono-num text-sm font-semibold text-[#E8F0EA]">
            {formatCurrency(
              prediction.predictedPrice,
              currency,
              preferences.currencyMode
            )}
          </span>
        </div>
        <div>
          <span className="text-[#91A197] block">Projected Move</span>
          <span
            className={`font-mono-num text-sm font-semibold ${
              isPositive ? 'text-[#36C982]' : 'text-[#E06C65]'
            }`}
          >
            {formatSignedPercent(prediction.expectedMovePercent)}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-[#91A197] mb-1">
          <span>Demo Confidence</span>
          <span className="font-mono-num text-[#E8F0EA]">
            {prediction.confidence}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[#101512] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#36C982]"
            style={{ width: `${prediction.confidence}%` }}
          />
        </div>
      </div>

      <div className="pt-2 border-t border-white/6 flex items-center justify-between text-xs">
        <span className="text-[#91A197] font-mono-num">
          Range:{' '}
          {formatCurrency(
            prediction.predictedLow,
            currency,
            preferences.currencyMode,
            0
          )}
          –
          {formatCurrency(
            prediction.predictedHigh,
            currency,
            preferences.currencyMode,
            0
          )}
        </span>
        <Link
          to={`/app/predictions?ticker=${ticker}`}
          className="text-[#A5EBC3] hover:text-[#36C982] font-medium whitespace-nowrap"
        >
          Inspect
        </Link>
      </div>
    </div>
  );
};
