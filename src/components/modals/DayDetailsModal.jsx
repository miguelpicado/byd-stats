import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, MapPin, Zap, Clock, TrendingUp, Car } from '../Icons';
import { formatTime, formatDate } from '../../utils/dateUtils';
import { BYD_RED } from '../../utils/constants';
import { useApp } from '../../context/AppContext';

const DayDetailsModal = ({ isOpen, onClose, date, trips = [], charges = [], onTripSelect, onChargeSelect }) => {
    const { t } = useTranslation();
    const { settings } = useApp();

    const getChargerName = (id) => {
        if (!id) return t('charges.chargerType');
        const type = settings.chargerTypes?.find(ct => ct.id === id);
        return type ? type.name : id;
    };

    if (!isOpen) return null;

    // Calculate day totals
    const totalDist = trips.reduce((acc, trip) => acc + (trip.trip || 0), 0);
    const totalKwh = trips.reduce((acc, trip) => acc + Math.abs(trip.electricity || 0), 0);
    const totalChargeKwh = charges.reduce((acc, charge) => acc + (charge.kwhCharged || 0), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-slide-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
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
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">

                    {/* Summary Cards */}
                    {(trips.length > 0 || charges.length > 0) && (
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-xs text-slate-500 uppercase">{t('stats.distance')}</p>
                                <p className="font-bold text-slate-900 dark:text-white">{(totalDist || 0).toFixed(1)} <span className="text-xs font-normal text-slate-500">{t('units.km')}</span></p>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-xs text-slate-500 uppercase">{t('stats.consumption')}</p>
                                <p className="font-bold text-slate-900 dark:text-white">{(totalKwh || 0).toFixed(1)} <span className="text-xs font-normal text-slate-500">{t('units.kWh')}</span></p>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="text-xs text-slate-500 uppercase">{t('charges.kwhCharged')}</p>
                                <p className="font-bold text-slate-900 dark:text-white">{(totalChargeKwh || 0).toFixed(1)} <span className="text-xs font-normal text-slate-500">{t('units.kWh')}</span></p>
                            </div>
                        </div>
                    )}

                    {/* Trips Section */}
                    {trips.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Car className="w-4 h-4 text-orange-500" />
                                {t('calendar.trips')}
                            </h3>

                            <div className="space-y-2">
                                {trips.map((trip) => (
                                    <div
                                        key={trip.id}
                                        onClick={() => {
                                            onClose();
                                            onTripSelect(trip);
                                        }}
                                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 shadow-sm text-xs font-medium text-slate-500">
                                                <span>{new Date(trip.startTime || trip.start_timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-medium">
                                                    <span>{(trip.trip || 0).toFixed(1)} {t('units.km')}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
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
                                            <span className="text-orange-500 font-semibold text-sm">
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
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <Zap className="w-4 h-4 text-cyan-500" />
                                {t('calendar.charges')}
                            </h3>

                            <div className="space-y-2">
                                {charges.map((charge) => (
                                    <div
                                        key={charge.id}
                                        onClick={() => {
                                            onClose();
                                            onChargeSelect(charge);
                                        }}
                                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/30 shadow-sm text-xs font-medium">
                                                <span>{charge.time || new Date(charge.timestamp || charge.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-medium">
                                                    <span>+{(charge.kwhCharged || 0).toFixed(1)} kWh</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span>{getChargerName(charge.chargerTypeId)}</span>
                                                    {charge.location && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-0.5">
                                                                <MapPin className="w-3 h-3" />
                                                                {charge.location}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-cyan-500 font-semibold text-sm">
                                                {charge.totalCost > 0 ? `${(charge.totalCost || 0).toFixed(2)}€` : 'Gratis'}
                                            </span>
                                            <p className="text-xs text-slate-400">
                                                {charge.initialPercentage ? `${charge.initialPercentage}% → ` : '→ '}{charge.finalPercentage}%
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
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium transition-colors"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </div >
    );
};

export default DayDetailsModal;
