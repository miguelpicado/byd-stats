// BYD Stats - Overview Tab Component
import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { BYD_RED } from '@components/Icons.jsx';
import OverviewContent from './OverviewContent';
import MfgDateModal from '@components/modals/MfgDateModal';
import ThermalStressModal from '@components/modals/ThermalStressModal';
import { useApp } from '@/context/AppContext';

// Static chart options that don't change
const LINE_CHART_OPTIONS_BASE = {
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false } },
  elements: { line: { tension: 0.4 }, point: { hitRadius: 20, hoverRadius: 6 } }
};

/**
 * Overview tab showing main statistics and charts
 */
const OverviewTab = React.memo(({
  summary,
  monthly,
  tripDist,
  smallChartHeight,
  overviewSpacing,
  onAddCharge,
  trips = [],
  settings,
  isActive = true
}) => {
  const { updateSettings } = useApp();
  const [insightType, setInsightType] = useState(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [showMfgModal, setShowMfgModal] = useState(false);
  const [showThermalModal, setShowThermalModal] = useState(false);

  const handleCardClick = (type) => {
    if (type === 'distance') {
      setShowOdometerModal(true);
    } else {
      setInsightType(type);
    }
  };

  const handleMfgDateSave = (isoDate, displayDate) => {
    updateSettings({
      mfgDate: isoDate,
      mfgDateDisplay: displayDate
    });
  };

  const handleThermalStressSave = (factor) => {
    updateSettings({
      thermalStressFactor: factor
    });
  };

  const lineChartOptionsHorizontal = useMemo(() => ({
    ...LINE_CHART_OPTIONS_BASE,
    scales: {
      y: { beginAtZero: true, border: { dash: [] }, grid: { color: 'rgba(203, 213, 225, 0.3)', borderDash: [3, 3], drawBorder: false } },
      x: { border: { dash: [] }, grid: { display: false } }
    }
  }), []);

  // Memoize chart data
  const lineChartData = useMemo(() => ({
    labels: monthly.map(m => m.monthLabel),
    datasets: [{
      label: 'Km',
      data: monthly.map(m => m.km),
      borderColor: BYD_RED,
      backgroundColor: 'rgba(234, 0, 41, 0.1)',
      fill: true,
      pointBackgroundColor: BYD_RED,
      pointRadius: 4,
      borderWidth: 2
    }]
  }), [monthly]);

  const pieChartData = useMemo(() => ({
    labels: tripDist.map(d => `${d.range} km`),
    datasets: [{
      data: tripDist.map(d => d.count),
      backgroundColor: tripDist.map(d => d.color),
      borderWidth: 0,
      hoverOffset: 4
    }]
  }), [tripDist]);

  return (
    <>
      <OverviewContent
        summary={summary}
        monthly={monthly}
        tripDist={tripDist}
        smallChartHeight={smallChartHeight}
        overviewSpacing={overviewSpacing}
        lineChartOptions={lineChartOptionsHorizontal}
        lineChartData={lineChartData}
        pieChartData={pieChartData}
        trips={trips}
        settings={settings}
        onInsightClick={handleCardClick}
        onOdometerClick={() => handleCardClick('distance')}
        showOdometerModal={showOdometerModal}
        onCloseOdometerModal={() => setShowOdometerModal(false)}
        insightType={insightType}
        onCloseInsightModal={() => setInsightType(null)}
        onMfgDateClick={() => setShowMfgModal(true)}
        onThermalStressClick={() => setShowThermalModal(true)}
        isActive={isActive}
      />
      <MfgDateModal
        isOpen={showMfgModal}
        onClose={() => setShowMfgModal(false)}
        onSave={handleMfgDateSave}
        initialValue={settings.mfgDateDisplay}
      />
      <ThermalStressModal
        isOpen={showThermalModal}
        onClose={() => setShowThermalModal(false)}
        onSave={handleThermalStressSave}
        initialValue={parseFloat(settings.thermalStressFactor) || 1.0}
      />
    </>
  );
});

OverviewTab.propTypes = {
  summary: PropTypes.shape({
    totalKm: PropTypes.string,
    kmDay: PropTypes.string,
    totalKwh: PropTypes.string,
    totalTrips: PropTypes.number,
    tripsDay: PropTypes.string,
    totalHours: PropTypes.string,
    avgEff: PropTypes.string,
    avgSpeed: PropTypes.string,
    avgKm: PropTypes.string,
    avgMin: PropTypes.string,
    daysActive: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  monthly: PropTypes.arrayOf(PropTypes.shape({
    monthLabel: PropTypes.string,
    km: PropTypes.number
  })).isRequired,
  tripDist: PropTypes.arrayOf(PropTypes.shape({
    range: PropTypes.string,
    count: PropTypes.number,
    color: PropTypes.string
  })).isRequired,
  smallChartHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  overviewSpacing: PropTypes.string.isRequired,
  onAddCharge: PropTypes.func,
  trips: PropTypes.array,
  settings: PropTypes.shape({
    electricityPrice: PropTypes.number
  }),
  isActive: PropTypes.bool
};

OverviewTab.displayName = 'OverviewTab';

export default OverviewTab;


