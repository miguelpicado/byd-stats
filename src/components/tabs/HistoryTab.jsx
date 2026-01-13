// BYD Stats - History Tab Component
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Zap, Battery, Clock, TrendingUp, BYD_RED } from '../Icons.jsx';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { calculateScore, getScoreColor } from '../../utils/formatters';

const COMPACT_SPACE_Y = 'space-y-3';

/**
 * History tab showing last 10 trips and averages
 */
const HistoryTab = React.memo(({
  filtered,
  isCompact,
  isVertical,
  openTripDetail,
  setShowAllTripsModal,
  TripCard
}) => {
  const { t } = useTranslation();

  // Sort all trips by date and timestamp
  const allTrips = [...filtered].sort((a, b) => {
    const dateCompare = (b.date || '').localeCompare(a.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (b.start_timestamp || 0) - (a.start_timestamp || 0);
  });

  // Calculate min/max efficiency for scoring
  const validTrips = allTrips.filter(trip => trip.trip >= 1 && trip.electricity !== 0);
  const efficiencies = validTrips.map(trip => (trip.electricity / trip.trip) * 100);
  const minEff = Math.min(...efficiencies);
  const maxEff = Math.max(...efficiencies);

  // Get last 10 trips split into columns
  const last10 = allTrips.slice(0, 10);
  const firstColumn = last10.slice(0, 5);
  const secondColumn = last10.slice(5, 10);

  // Calculate averages for last 10 trips
  const avgDistance = last10.reduce((sum, trip) => sum + (trip.trip || 0), 0) / last10.length || 0;
  const avgConsumption = last10.reduce((sum, trip) => sum + (trip.electricity || 0), 0) / last10.length || 0;
  const avgEfficiency = last10.reduce((sum, trip) => {
    if (trip.trip > 0 && trip.electricity !== undefined) {
      return sum + ((trip.electricity / trip.trip) * 100);
    }
    return sum;
  }, 0) / last10.length || 0;
  const avgDuration = last10.reduce((sum, trip) => sum + ((trip.duration || 0) / 60), 0) / last10.length || 0;
  const avgSpeedFiltered = last10.filter(trip => trip.duration > 0 && trip.trip > 0);
  const avgSpeed = avgSpeedFiltered.length > 0
    ? avgSpeedFiltered.reduce((sum, trip) => sum + (trip.trip / ((trip.duration || 0) / 3600)), 0) / avgSpeedFiltered.length
    : 0;

  // Helper function to render a stat card
  const renderStatCard = (icon, label, value, unit, color, size = 'normal') => (
    <div className={`bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 ${isCompact ? 'p-2' : 'p-4'}`}>
      <div className="flex flex-col items-center text-center gap-2">
        <div className={`rounded-lg ${color} flex items-center justify-center ${isCompact ? 'w-8 h-8' : 'w-10 h-10'}`}>
          {React.createElement(icon, { className: `${isCompact ? 'w-4 h-4' : 'w-5 h-5'}` })}
        </div>
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
          <p className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-xl' : 'text-2xl'}`}>
            {value} <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>
          </p>
        </div>
      </div>
    </div>
  );

  // Render vertical layout
  if (isVertical) {
    return (
      <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
        {/* Averages section - at the top in vertical mode */}
        <div className={`space-y-4 ${isCompact ? 'space-y-3' : ''}`}>
          <h2 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
            {t('history.avgLast10')}
          </h2>

          {/* First row: 2 cards */}
          <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
            {renderStatCard(MapPin, t('history.avgDistance'), avgDistance.toFixed(1), 'km', 'bg-red-500/20 text-red-400')}
            {renderStatCard(Zap, t('history.avgConsumption'), avgConsumption.toFixed(2), 'kWh', 'bg-cyan-500/20 text-cyan-400')}
          </div>

          {/* Second row: 2 cards */}
          <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
            {renderStatCard(Battery, t('history.avgEfficiency'), avgEfficiency.toFixed(2), 'kWh/100km', 'bg-green-500/20 text-green-400')}
            {renderStatCard(Clock, t('history.avgDuration'), avgDuration.toFixed(0), 'min', 'bg-amber-500/20 text-amber-400')}
          </div>

          {/* Third row: 1 card centered */}
          <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${isCompact ? '!gap-3' : ''}`}>
            {renderStatCard(TrendingUp, t('history.avgSpeed'), avgSpeed.toFixed(1), 'km/h', 'bg-blue-500/20 text-blue-400')}
          </div>
        </div>

        {/* Last 10 trips section */}
        <div className={`space-y-4 ${isCompact ? 'space-y-3' : ''}`}>
          <h2 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
            {t('history.last10Trips')}
          </h2>

          <div className={`grid md:grid-cols-2 gap-4 ${isCompact ? 'gap-3' : ''}`}>
            <div className={`space-y-3 ${isCompact ? 'space-y-3' : ''}`}>
              {firstColumn.map((trip, i) => (
                <TripCard
                  key={i}
                  trip={trip}
                  minEff={minEff}
                  maxEff={maxEff}
                  onClick={openTripDetail}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  calculateScore={calculateScore}
                  getScoreColor={getScoreColor}
                />
              ))}
            </div>
            <div className={`space-y-3 ${isCompact ? 'space-y-3' : ''}`}>
              {secondColumn.map((trip, j) => (
                <TripCard
                  key={j + 5}
                  trip={trip}
                  minEff={minEff}
                  maxEff={maxEff}
                  onClick={openTripDetail}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  calculateScore={calculateScore}
                  getScoreColor={getScoreColor}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowAllTripsModal(true)}
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ backgroundColor: BYD_RED }}
          >
            {t('common.showAll')}
          </button>
        </div>
      </div>
    );
  }

  // Render horizontal layout (original layout)
  return (
    <div className={`${isCompact ? COMPACT_SPACE_Y : 'space-y-4 sm:space-y-6'}`}>
      <div className={`grid lg:grid-cols-8 gap-6 ${isCompact ? 'gap-4' : ''}`}>
        {/* Last 10 trips section */}
        <div className={`lg:col-span-6 space-y-4 ${isCompact ? 'space-y-3' : ''}`}>
          <h2 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
            {t('history.last10Trips')}
          </h2>

          <div className={`grid lg:grid-cols-2 gap-4 ${isCompact ? 'gap-3' : ''}`}>
            <div className={`space-y-3 ${isCompact ? 'space-y-3' : ''}`}>
              {firstColumn.map((trip, i) => (
                <TripCard
                  key={i}
                  trip={trip}
                  minEff={minEff}
                  maxEff={maxEff}
                  onClick={openTripDetail}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  calculateScore={calculateScore}
                  getScoreColor={getScoreColor}
                />
              ))}
            </div>
            <div className={`space-y-3 ${isCompact ? 'space-y-3' : ''}`}>
              {secondColumn.map((trip, j) => (
                <TripCard
                  key={j + 5}
                  trip={trip}
                  minEff={minEff}
                  maxEff={maxEff}
                  onClick={openTripDetail}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  calculateScore={calculateScore}
                  getScoreColor={getScoreColor}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowAllTripsModal(true)}
            className="w-full py-3 rounded-xl font-medium text-white"
            style={{ backgroundColor: BYD_RED }}
          >
            {t('common.showAll')}
          </button>
        </div>

        {/* Averages section */}
        <div className={`lg:col-span-2 space-y-4 ${isCompact ? 'space-y-3' : ''}`}>
          <h2 className={`font-bold text-slate-900 dark:text-white ${isCompact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>
            {t('history.avgLast10')}
          </h2>

          <div className={`space-y-3 ${isCompact ? 'space-y-2' : ''}`}>
            {renderStatCard(MapPin, t('history.avgDistance'), avgDistance.toFixed(1), 'km', 'bg-red-500/20 text-red-400')}
            {renderStatCard(Zap, t('history.avgConsumption'), avgConsumption.toFixed(2), 'kWh', 'bg-cyan-500/20 text-cyan-400')}
            {renderStatCard(Battery, t('history.avgEfficiency'), avgEfficiency.toFixed(2), 'kWh/100km', 'bg-green-500/20 text-green-400')}
            {renderStatCard(Clock, t('history.avgDuration'), avgDuration.toFixed(0), 'min', 'bg-amber-500/20 text-amber-400')}
            {renderStatCard(TrendingUp, t('history.avgSpeed'), avgSpeed.toFixed(1), 'km/h', 'bg-blue-500/20 text-blue-400')}
          </div>
        </div>
      </div>
    </div>
  );
});

HistoryTab.displayName = 'HistoryTab';

export default HistoryTab;
