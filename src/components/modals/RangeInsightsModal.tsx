
import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronLeft } from '../Icons';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

interface RangeScenario {
    name: string;
    speed: number;
    efficiency: number;
    range: number;
    isHistorical?: boolean;
}

interface RangeInsightsModalProps {
    isOpen: boolean;
    onClose: () => void;
    aiScenarios: Array<{ name: string; speed: number; efficiency: number; range: number }>;
    aiLoss: number | null;
    summary: any;
    isTraining?: boolean;
}

const RangeInsightsModal: React.FC<RangeInsightsModalProps> = ({ isOpen, onClose, aiScenarios, aiLoss, summary, isTraining = false }) => {
    const { t } = useTranslation();
    const [selectedScenario, setSelectedScenario] = React.useState<string | null>(null);

    if (!isOpen) return null;

    // AI Scenarios + Historical Reference
    const displayScenarios: RangeScenario[] = [
        ...aiScenarios.map(s => ({ ...s, isHistorical: false })),
        {
            name: 'Historical',
            speed: Number(summary?.avgSpeed ?? 0),
            efficiency: Number(summary?.avgEff ?? 0),
            range: Math.round(Number(summary?.estimatedRange ?? 0)),
            isHistorical: true
        }
    ];

    const chartData = {
        labels: displayScenarios.map(s => {
            if (s.isHistorical) return t('insights.historical', 'Historical');
            const label = s.name === 'City' ? t('insights.city') :
                s.name === 'Highway' ? t('insights.highway') :
                    t('insights.mixedScenario');
            return label.replace(/\s*\(Combinado\)/gi, '').trim();
        }),
        datasets: [
            {
                label: t('insights.rangeAxis'),
                data: displayScenarios.map(s => s.range),
                backgroundColor: displayScenarios.map(s => {
                    if (s.isHistorical) return 'rgba(100, 116, 139, 0.6)'; // Slate (Historical)
                    if (s.name === 'City') return 'rgba(34, 197, 94, 0.6)';
                    if (s.name === 'Highway') return 'rgba(239, 68, 68, 0.6)';
                    return 'rgba(59, 130, 246, 0.6)'; // Mixed
                }),
                borderColor: displayScenarios.map(s => {
                    if (s.isHistorical) return 'rgb(100, 116, 139)';
                    if (s.name === 'City') return 'rgb(34, 197, 94)';
                    if (s.name === 'Highway') return 'rgb(239, 68, 68)';
                    return 'rgb(59, 130, 246)';
                }),
                borderWidth: 1,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value: any) => value === 0 ? '(km)' : value
                },
                title: { display: false }
            }
        },
        onClick: (_event: any, elements: any[]) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const scenario = displayScenarios[index];
                setSelectedScenario(scenario.name);
            }
        }
    };

    const renderDetailView = () => {
        if (!selectedScenario) return null;
        const s = displayScenarios.find(sc => sc.name === selectedScenario);
        if (!s) return null;

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <button
                    onClick={() => setSelectedScenario(null)}
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm hover:underline"
                >
                    <ChevronLeft size={16} />
                    {t('common.back', 'Back')}
                </button>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-3 h-3 rounded-full ${s.name === 'City' ? 'bg-green-500' : s.name === 'Highway' ? 'bg-red-500' : s.isHistorical ? 'bg-slate-500' : 'bg-blue-500'}`}></div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {s.isHistorical ? t('insights.historical', 'Historical') :
                                s.name === 'City' ? t('insights.city', 'City') :
                                    s.name === 'Mixed' ? t('insights.mixedScenario', 'Mixed') :
                                        t('insights.highway', 'Highway')}
                        </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('stats.efficiency', 'Efficiency')}</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {s.efficiency.toFixed(1)} <span className="text-xs font-normal text-slate-500">kWh/100km</span>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('stats.estimatedRange', 'Range')}</div>
                            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                {s.range} <span className="text-xs font-normal text-slate-500">km</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                        <div className="flex items-center gap-2 mb-1">
                            {isTraining && !s.isHistorical && <span className="animate-spin text-xs">🧠</span>}
                            <p className="text-xs text-indigo-700 dark:text-indigo-300 italic font-medium">
                                {s.isHistorical ? t('insights.historicalNote', 'Based on your actual driving records.') : t('insights.scenarioDetail', 'This is a theoretical estimate based on your profile.')}
                            </p>
                        </div>
                        {isTraining && !s.isHistorical && (
                            <p className="text-[10px] text-indigo-500 mt-1">
                                {t('insights.stillLearning', 'AI is still learning from your recent trips to improve accuracy.')}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
                <div className="relative p-6 pb-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xl">
                            🧠
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                            {t('insights.rangeTitle', 'AI Range Analysis')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar">
                    {selectedScenario ? renderDetailView() : (
                        <div className="space-y-3">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-0.5 text-sm leading-tight">
                                    {t('insights.howItWorks', 'How this works')}
                                </h3>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                                    {t('insights.aiCheck', 'The AI analyzes your driving history (speed vs efficiency) and seasonality (temperature impact) to predict range more accurately than the standard fixed value.')}
                                </p>
                            </div>

                            <div className="h-40 sm:h-44">
                                <Bar data={chartData} options={chartOptions} />
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px]">
                                        <tr>
                                            <th className="px-3 py-1.5">{t('insights.scenario', 'Scenario')}</th>
                                            <th className="px-3 py-1.5 text-right">{t('stats.efficiency', 'Eff.')}</th>
                                            <th className="px-3 py-1.5 text-right">{t('stats.estimatedRange', 'Range')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {[...displayScenarios].sort((a, b) => (a.isHistorical ? 1 : 0) - (b.isHistorical ? 1 : 0)).map((s) => (
                                            <tr
                                                key={s.name}
                                                className="bg-white dark:bg-slate-900 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                onClick={() => setSelectedScenario(s.name)}
                                            >
                                                <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${s.name === 'City' ? 'bg-green-500' : s.name === 'Highway' ? 'bg-red-500' : s.isHistorical ? 'bg-slate-500' : 'bg-blue-500'}`}></div>
                                                    <span className="truncate">
                                                        {s.isHistorical ? t('insights.historical', 'Historical') : (s.name === 'City' ? t('insights.city', 'City') :
                                                            s.name === 'Mixed' ? t('insights.mixedScenario', 'Mixed') :
                                                                t('insights.highway', 'Highway')).replace(/\s*\(Combinado\)/gi, '').trim()}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-slate-500 whitespace-nowrap">{s.efficiency.toFixed(1)}</td>
                                                <td className="px-3 py-1.5 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                    {s.range} km
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
    );
};

export default RangeInsightsModal;
