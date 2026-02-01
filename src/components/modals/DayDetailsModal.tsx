import React from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { X, MapPin, Zap, Clock, TrendingUp, Car } from '../Icons';
import { useApp } from '../../context/AppContext';
import { Trip, Charge } from '@/types';

interface DayDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: Date | null;
    trips: Trip[];
    charges: Charge[];
    onTripSelect: (trip: Trip) => void;
    onChargeSelect?: (charge: Charge) => void;
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
    isOpen,
    onClose,
    date,
    trips = [],
    charges = [],
    onTripSelect,
    onChargeSelect
}) => {
    const { t } = useTranslation();
    const { settings } = useApp();

    const getChargerName = (id?: string) => {
        if (!id) return t('charges.chargerType');
        const type = settings.chargerTypes?.find(ct => ct.id === id);
        return type ? type.name : id;
    };

    if (!isOpen) return null;

    // Calculate day totals
    const totalDist = trips.reduce((acc, trip) => acc + (trip.trip || 0), 0);
    const totalKwh = trips.reduce((acc, trip) => acc + Math.abs(trip.electricity || 0), 0);
    const totalChargeKwh = charges.reduce((acc, charge) => acc + (charge.kwhCharged || 0), 0);

    // Use Portal to escape any parent stacking contexts (transforms, etc)
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div
                className="bg-white dark:bg-slate-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {date ? date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {trips.length} {t('calendar.trips')} · {charges.length} {t('calendar.charges')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">

                    {/* Summary Cards */}
                    {(trips.length > 0 || charges.length > 0) && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('stats.distance')}</p>
                                <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{(totalDist || 0).toFixed(1)} <span className="text-[10px] font-normal text-slate-500">{t('units.km')}</span></p>
                            </div>
                            <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('stats.consumption')}</p>
                                <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{(totalKwh || 0).toFixed(1)} <span className="text-[10px] font-normal text-slate-500">{t('units.kWh')}</span></p>
                            </div>
                            <div className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('charges.kwhCharged')}</p>
                                <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{(totalChargeKwh || 0).toFixed(1)} <span className="text-[10px] font-normal text-slate-500">{t('units.kWh')}</span></p>
                            </div>
                        </div>
                    )}

                    {/* Trips Section */}
                    {trips.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                                <Car className="w-4 h-4 text-orange-500" />
                                {t('calendar.trips')}
                            </h3>

                            <div className="space-y-2">
                                {trips.map((trip, index) => (
                                    <div
                                        key={trip.id || index}
                                        onClick={() => {
                                            onClose();
                                            onTripSelect(trip);
                                        }}
                                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/50 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-medium text-slate-500 group-hover:border-orange-200 dark:group-hover:border-orange-900/50 transition-colors">
                                                <span>{new Date(trip.startTime || trip.start_timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                                                    <span>{(trip.trip || 0).toFixed(1)} <span className="text-xs font-normal text-slate-500">{t('units.km')}</span></span>
                                                    {(trip.trip || 0) < 0.5 && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 font-medium">Stationary</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {Math.floor((trip.duration || 0) / 3600)}h {Math.floor(((trip.duration || 0) % 3600) / 60)}m
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-0.5">
                                                        <TrendingUp className="w-3 h-3" />
                                                        {((trip.trip || 0) / ((trip.duration || 1) / 3600)).toFixed(0)} {t('units.kmh')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-orange-500 font-bold text-sm">
                                                {(trip.electricity || 0).toFixed(1)} kWh
                                            </span>
                                            <p className="text-xs text-slate-400">
                                                {((Math.abs(trip.electricity || 0) / (trip.trip || 1)) * 100).toFixed(1)} {t('units.kWh100km')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Charges Section */}
                    {charges.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                                <Zap className="w-4 h-4 text-cyan-500" />
                                {t('calendar.charges')}
                            </h3>

                            <div className="space-y-2">
                                {charges.map((charge, index) => (
                                    <div
                                        key={charge.id || index}
                                        onClick={() => {
                                            onClose();
                                            onChargeSelect?.(charge);
                                        }}
                                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/50 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/30 shadow-sm text-xs font-medium group-hover:border-cyan-200 dark:group-hover:border-cyan-700/50 transition-colors">
                                                <span>{charge.time || new Date(charge.timestamp || charge.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold text-base">
                                                    <span>+{(charge.kwhCharged || 0).toFixed(1)} <span className="text-xs font-normal text-slate-500">kWh</span></span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <span>{getChargerName(charge.chargerTypeId)}</span>
                                                    {charge.location && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                                                                <MapPin className="w-3 h-3" />
                                                                {charge.location}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-cyan-500 font-bold text-sm">
                                                {(charge.totalCost || 0) > 0 ? `${(charge.totalCost || 0).toFixed(2)}€` : 'Gratis'}
                                            </span>
                                            <p className="text-xs text-slate-400">
                                                {charge.initialPercentage ? `${charge.initialPercentage}% → ` : ''}{charge.finalPercentage}%
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {trips.length === 0 && charges.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                            <Clock className="w-12 h-12 mb-3 stroke-1 opacity-50" />
                            <p>{t('calendar.noActivity')}</p>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium transition-colors shadow-sm"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div >,
        document.body
    );
};

export default DayDetailsModal;
