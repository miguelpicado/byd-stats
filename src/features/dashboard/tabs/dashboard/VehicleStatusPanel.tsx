import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VehicleStatus } from '@/hooks/useVehicleStatus';
import { Wheel, Wind, Unlock, TirePressure } from '@/components/Icons'; // Icons for tabs

interface VehicleStatusPanelProps {
    status: VehicleStatus | null;
}

type TabType = 'tires' | 'windows' | 'doors';

const VehicleStatusPanel: React.FC<VehicleStatusPanelProps> = ({ status }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('tires');

    const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
        { id: 'tires', label: t('dashboard.tires', 'Tires'), icon: Wheel },
        { id: 'windows', label: t('dashboard.windows', 'Windows'), icon: Wind },
        { id: 'doors', label: t('dashboard.doors', 'Doors'), icon: Unlock },
    ];

    const renderTires = () => {
        const tires = status?.tirePressure || { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 };

        const getTireIcon = (pressure: number, limit: number) => {
            // Reverting conversion until we know the raw format
            const isLow = pressure > 0.1 && pressure < limit;
            return (
                <TirePressure
                    size={22}
                    className={isLow ? 'text-yellow-500' : 'text-slate-400 dark:text-slate-500'}
                />
            );
        };

        const TireItem = ({ label, pressure, limit }: { label: string, pressure: number, limit: number }) => (
            <div className="flex flex-col items-center justify-center gap-0.5">
                <div className="flex items-center gap-1.5">
                    {getTireIcon(pressure, limit)}
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {pressure > 0 ? Number(pressure).toFixed(1) : '-.-'}
                    </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                    {label}
                </div>
            </div>
        );

        return (
            <div className="grid grid-cols-4 gap-x-2 gap-y-2 px-2 py-2">
                <TireItem label="FL" pressure={tires.frontLeft} limit={2.1} />
                <TireItem label="FR" pressure={tires.frontRight} limit={2.1} />
                <TireItem label="RL" pressure={tires.rearLeft} limit={2.5} />
                <TireItem label="RR" pressure={tires.rearRight} limit={2.5} />
            </div>
        );
    };

    const renderWindows = () => {
        const windows = status?.windows || { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false };
        const getColor = (isOpen: boolean) => isOpen ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
        return (
            <div className="grid grid-cols-4 gap-1 p-2 text-[10px] text-center">
                <div>
                    <div className="text-slate-500 dark:text-slate-500">FL</div>
                    <div className={`font-bold ${getColor(windows.frontLeft)}`}>{windows.frontLeft ? 'OPEN' : 'CLSD'}</div>
                </div>
                <div>
                    <div className="text-slate-500 dark:text-slate-500">FR</div>
                    <div className={`font-bold ${getColor(windows.frontRight)}`}>{windows.frontRight ? 'OPEN' : 'CLSD'}</div>
                </div>
                <div>
                    <div className="text-slate-500 dark:text-slate-500">RL</div>
                    <div className={`font-bold ${getColor(windows.rearLeft)}`}>{windows.rearLeft ? 'OPEN' : 'CLSD'}</div>
                </div>
                <div>
                    <div className="text-slate-500 dark:text-slate-500">RR</div>
                    <div className={`font-bold ${getColor(windows.rearRight)}`}>{windows.rearRight ? 'OPEN' : 'CLSD'}</div>
                </div>
            </div>
        );
    };

    const renderDoors = () => {
        const doors = status?.doors || { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false, trunk: false, hood: false };
        const getColor = (isOpen: boolean) => isOpen ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';

        return (
            <div className="grid grid-cols-3 gap-y-1 gap-x-1 p-2 text-[10px] text-center">
                <div><span className="text-slate-500 dark:text-slate-500 mr-1">FL</span><span className={getColor(doors.frontLeft)}>{doors.frontLeft ? 'OPN' : 'CLS'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-500 mr-1">FR</span><span className={getColor(doors.frontRight)}>{doors.frontRight ? 'OPN' : 'CLS'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-500 mr-1">Hood</span><span className={getColor(doors.hood)}>{doors.hood ? 'OPN' : 'CLS'}</span></div>

                <div><span className="text-slate-500 dark:text-slate-500 mr-1">RL</span><span className={getColor(doors.rearLeft)}>{doors.rearLeft ? 'OPN' : 'CLS'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-500 mr-1">RR</span><span className={getColor(doors.rearRight)}>{doors.rearRight ? 'OPN' : 'CLS'}</span></div>
                <div><span className="text-slate-500 dark:text-slate-500 mr-1">Trunk</span><span className={getColor(doors.trunk)}>{doors.trunk ? 'OPN' : 'CLS'}</span></div>
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800/40 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/30 shrink-0 shadow-sm dark:shadow-none">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700/30">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-1 flex items-center justify-center gap-2 text-xs font-medium transition-colors ${activeTab === tab.id
                            ? 'bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="h-16 flex items-center justify-center w-full px-2">
                <div className="w-full">
                    {activeTab === 'tires' && renderTires()}
                    {activeTab === 'windows' && renderWindows()}
                    {activeTab === 'doors' && renderDoors()}
                </div>
            </div>
        </div>
    );
};

export default VehicleStatusPanel;
