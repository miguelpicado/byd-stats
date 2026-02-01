import React, { useMemo, useState } from 'react';
import { BYD_RED } from '@components/Icons';
import OverviewContent from './OverviewContent';
import MfgDateModal from '@components/modals/MfgDateModal';
import ThermalStressModal from '@components/modals/ThermalStressModal';
import RangeInsightsModal from '@components/modals/RangeInsightsModal';
import { useApp } from '@/context/AppContext';
import { useData } from '@/providers/DataProvider';
import { Summary, MonthlyData, Settings, Trip, TripInsightType } from '@/types';

// Static chart options that don't change
const LINE_CHART_OPTIONS_BASE = {
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false } },
  elements: { line: { tension: 0.4 }, point: { hitRadius: 20, hoverRadius: 6 } }
};

interface OverviewTabProps {
  summary: Summary | null;
  monthly: MonthlyData[];
  tripDist: any[];
  smallChartHeight: number | string;
  overviewSpacing: string;
  trips?: Trip[];
  settings: Settings;
  isActive?: boolean;
  onAddCharge?: () => void;
}

/**
 * Overview tab showing main statistics and charts
 */
const OverviewTab: React.FC<OverviewTabProps> = React.memo(({
  summary,
  monthly,
  tripDist,
  smallChartHeight,
  overviewSpacing,
  trips = [],
  settings,
  isActive = true
}) => {
  const { updateSettings } = useApp();
  const { aiScenarios, aiLoss, aiSoH, aiSoHStats, charges, stats } = useData();



  const [insightType, setInsightType] = useState<TripInsightType | null>(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [showMfgModal, setShowMfgModal] = useState(false);
  const [showThermalModal, setShowThermalModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);

  const handleCardClick = (type: TripInsightType) => {
    if (type === 'distance') {
      setShowOdometerModal(true);
    } else {
      setInsightType(type);
    }
  };

  const handleMfgDateSave = (isoDate: string, displayDate: string) => {
    updateSettings({
      mfgDate: isoDate,
      mfgDateDisplay: displayDate
    });
  };

  const handleThermalStressSave = (factor: number) => {
    updateSettings({
      thermalStressFactor: factor
    });
  };

  const lineChartOptionsHorizontal = useMemo(() => ({
    ...LINE_CHART_OPTIONS_BASE,
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false, dash: [] },
        grid: { color: 'rgba(203, 213, 225, 0.3)', tickBorderDash: [3, 3] }
      },
      x: {
        border: { display: false, dash: [] },
        grid: { display: false }
      }
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
        summary={summary!}
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
        onRangeClick={() => setShowRangeModal(true)}
        isAiReady={aiLoss !== null && aiLoss < 0.5} // Simple heuristic for availability
        aiSoH={aiSoH}
        aiSoHStats={aiSoHStats}
        charges={charges}
        stats={stats || undefined}
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
        initialValue={settings.thermalStressFactor || 1.0}
      />
      <RangeInsightsModal
        isOpen={showRangeModal}
        onClose={() => setShowRangeModal(false)}
        aiScenarios={aiScenarios}
        aiLoss={aiLoss}
      />
    </>
  );
});

OverviewTab.displayName = 'OverviewTab';

export default OverviewTab;


