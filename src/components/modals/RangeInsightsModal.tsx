
import React from 'react';
import { useTranslation } from 'react-i18next';
import ModalPortal from '../common/ModalPortal';
import { X, ChevronLeft, ChevronRight } from '../Icons';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

interface RangeInsightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    aiScenarios: Array<{ name: string; speed: number; efficiency: number; range: number }>;
    aiLoss: number | null;
}

const RangeInsightsModal: React.FC<RangeInsightsModalProps> = ({ isOpen, onClose, aiScenarios, aiLoss }) => {
    const { t } = useTranslation();
    const [selectedScenario, setSelectedScenario] = React.useState<string | null>(null);

    if (!isOpen) return null;

    const chartData = {
        labels: aiScenarios.map(s => s.name === 'City' ? t('insights.city') : s.name === 'Highway' ? t('insights.highway') : t('insights.mixedScenario')),
        datasets: [
            {
                label: t('insights.rangeAxis'),
                data: aiScenarios.map(s => s.range),
                backgroundColor: [
                    'rgba(34, 197, 94, 0.6)',  // Green (City)
                    'rgba(59, 130, 246, 0.6)', // Blue (Mixed)
                    'rgba(239, 68, 68, 0.6)',  // Red (Highway)
                ],
                borderColor: [
                    'rgb(34, 197, 94)',
                    'rgb(59, 130, 246)',
                    'rgb(239, 68, 68)',
                ],
                borderWidth: 1,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            title: { display: true, text: t('insights.predictedRange', 'Predicted Range by Scenario') }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: t('insights.rangeAxis', 'Range (km)') }
            }
        },
        onClick: (_event: any, elements: any[]) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const scenario = aiScenarios[index];
                setSelectedScenario(scenario.name);
            }
        }
    };

    const isTrained = aiLoss !== null && aiLoss > 0;

    const renderDetailView = () => {
        const scenario = aiScenarios.find(s => s.name === selectedScenario);
        if (!scenario) return null;

        const getScenarioDescription = (name: string) => {
            switch (name) {
                case 'City': return t('insights.cityDesc', 'Low speed, high efficiency due to regenerative braking. Ideal for EVs.');
                case 'Highway': return t('insights.highwayDesc', 'High speed increases aerodynamic drag, significantly reducing range.');
                case 'Mixed': return t('insights.mixedDesc', 'A balance of city and highway driving.');
                default: return '';
            }
        };

        const getTips = (name: string) => {
            switch (name) {
                case 'City': return [t('insights.tips.city1', 'Use Eco mode'), t('insights.tips.city2', 'Maximize regen')];
                case 'Highway': return [t('insights.tips.hwy1', 'Keep speed low'), t('insights.tips.hwy2', 'Close windows')];
                case 'Mixed': return [t('insights.tips.mix1', 'Anticipate traffic'), t('insights.tips.mix2', 'Steady momentum')];
                default: return [];
            }
        };

        // Synthesize a speed range for display
        const speedRange = `${Math.max(0, scenario.speed - 15)}-${scenario.speed + 15}`;

        return (
            <div className="space-y-6 animate-fadeIn">
                <div className={`p-6 rounded-2xl text-center border ${scenario.name === 'City' ? 'bg-green-50 border-green-100 text-green-800' :
                    scenario.name === 'Highway' ? 'bg-red-50 border-red-100 text-red-800' :
                        'bg-blue-50 border-blue-100 text-blue-800'
                    }`}>
                    <h3 className="text-2xl font-bold mb-1">{scenario.name === 'City' ? t('insights.city') : scenario.name === 'Highway' ? t('insights.highway') : t('insights.mixedScenario')}</h3>
                    <p className="text-4xl font-black mb-2">{scenario.range} <span className="text-xl font-medium opacity-70">km</span></p>
                    <p className="text-sm opacity-90">{getScenarioDescription(scenario.name)}</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">{t('insights.stats', 'Statistics')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <p className="text-xs text-slate-500 uppercase">{t('stats.efficiency')}</p>
                            <p className="text-xl font-bold text-slate-800 dark:text-white">{scenario.efficiency.toFixed(1)} <span className="text-xs font-normal">kWh/100km</span></p>
                        </div>
                        <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <p className="text-xs text-slate-500 uppercase">{t('insights.speedAvg', 'Avg Speed')}</p>
                            <p className="text-xl font-bold text-slate-800 dark:text-white">{speedRange} <span className="text-xs font-normal">km/h</span></p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3">{t('insights.improve', 'Tips to improve')}</h4>
                    <ul className="space-y-2">
                        {getTips(scenario.name).map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <span className="text-green-500 mt-0.5">✓</span> {tip}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };

    return (
        <ModalPortal>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                <div
                    role="dialog"
                    aria-modal="true"
                    className="relative bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full shadow-2xl animate-modal-content overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            {selectedScenario ? (
                                <button onClick={() => setSelectedScenario(null)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                </button>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <span className="text-xl">🧠</span>
                                </div>
                            )}

                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {selectedScenario ? (selectedScenario === 'City' ? t('insights.city') : selectedScenario === 'Highway' ? t('insights.highway') : t('insights.mixedScenario')) : t('dashboard.rangeInsights', 'AI Range Insights')}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="p-5 overflow-y-auto custom-scrollbar">
                        {selectedScenario ? renderDetailView() : (
                            <div className="space-y-6">
                                {/* AI Explanation Section */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                            {t('insights.howItWorks', 'How this works')}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                            {t('insights.aiCheck', 'The AI analyzes your driving history (speed vs efficiency) and seasonality (temperature impact) to predict range more accurately than the standard fixed value.')}
                                        </p>
                                    </div>
                                    {!isTrained && (
                                        <div className="mt-3 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                                            ⚠️ {t('insights.notEnoughData', 'Not enough data yet. Using standard estimates until ~5 trips are recorded.')}
                                        </div>
                                    )}
                                </div>

                                {/* Scenarios Chart */}
                                <div className="h-64">
                                    <Bar data={chartData} options={chartOptions} />
                                </div>

                                {/* Detailed Table */}
                                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-xs">
                                            <tr>
                                                <th className="px-4 py-3">{t('insights.scenario', 'Scenario')}</th>
                                                <th className="px-4 py-3">{t('stats.speed', 'Speed')}</th>
                                                <th className="px-4 py-3 text-right">{t('stats.efficiency', 'Eff.')}</th>
                                                <th className="px-4 py-3 text-right">{t('stats.estimatedRange', 'Range')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {aiScenarios.map((s) => (
                                                <tr
                                                    key={s.name}
                                                    className="bg-white dark:bg-slate-900 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                    onClick={() => setSelectedScenario(s.name)}
                                                >
                                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${s.name === 'City' ? 'bg-green-500' : s.name === 'Highway' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                                        {s.name === 'City' ? t('insights.city', 'City') :
                                                            s.name === 'Mixed' ? t('insights.mixedScenario', 'Mixed') :
                                                                t('insights.highway', 'Highway')}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">{s.speed} km/h</td>
                                                    <td className="px-4 py-3 text-right text-slate-500">{s.efficiency.toFixed(1)} kWh</td>
                                                    <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                        {s.range} km
                                                        <ChevronRight className="w-4 h-4 text-slate-300 inline-block ml-1" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
};

export default RangeInsightsModal;
