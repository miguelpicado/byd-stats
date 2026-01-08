// BYD Stats - Filter Modal Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';
import { formatMonth } from '../../utils/dateUtils';
import { Filter, Plus } from '../Icons.jsx';

/**
 * Filter modal for trip filtering
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {string} props.filterType - Current filter type
 * @param {Function} props.setFilterType - Filter type setter
 * @param {string} props.selMonth - Selected month
 * @param {Function} props.setSelMonth - Month setter
 * @param {string} props.dateFrom - Start date
 * @param {Function} props.setDateFrom - Start date setter
 * @param {string} props.dateTo - End date
 * @param {Function} props.setDateTo - End date setter
 * @param {Array} props.months - Available months
 * @param {number} props.rawTripsCount - Total trips count
 * @param {number} props.filteredCount - Filtered trips count
 */
const FilterModal = ({
    isOpen,
    onClose,
    filterType,
    setFilterType,
    selMonth,
    setSelMonth,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    months,
    rawTripsCount,
    filteredCount
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Filtrar viajes</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Filter Type Buttons */}
                    <div className="space-y-2">
                        <label className="text-slate-600 dark:text-slate-400 text-sm">Tipo de filtro:</label>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => { setFilterType('all'); setSelMonth(''); setDateFrom(''); setDateTo(''); }}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'all'
                                    ? 'text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                style={{ backgroundColor: filterType === 'all' ? BYD_RED : '' }}
                            >
                                📊 Todos los viajes ({rawTripsCount})
                            </button>
                            <button
                                onClick={() => setFilterType('month')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'month'
                                    ? 'text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                style={{ backgroundColor: filterType === 'month' ? BYD_RED : '' }}
                            >
                                📅 Por mes
                            </button>
                            <button
                                onClick={() => setFilterType('range')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'range'
                                    ? 'text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                style={{ backgroundColor: filterType === 'range' ? BYD_RED : '' }}
                            >
                                📆 Rango de fechas
                            </button>
                        </div>
                    </div>

                    {/* Month Selector */}
                    {filterType === 'month' && (
                        <div className="space-y-2">
                            <label className="text-slate-600 dark:text-slate-400 text-sm">Seleccionar mes:</label>
                            <select
                                value={selMonth}
                                onChange={(e) => setSelMonth(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                            >
                                <option value="">Todos los meses</option>
                                {months.map((m) => (
                                    <option key={m} value={m}>{formatMonth(m)}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Date Range Selector */}
                    {filterType === 'range' && (
                        <div className="space-y-2">
                            <label className="text-slate-600 dark:text-slate-400 text-sm">Rango de fechas:</label>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                                    placeholder="Desde"
                                />
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                                    placeholder="Hasta"
                                />
                            </div>
                        </div>
                    )}

                    {/* Results Count */}
                    {filteredCount !== rawTripsCount && (
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-center text-sm">
                                <span className="text-slate-400">Mostrando </span>
                                <span className="font-bold" style={{ color: BYD_RED }}>{filteredCount}</span>
                                <span className="text-slate-400"> de {rawTripsCount} viajes</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Apply Button */}
                <button
                    onClick={onClose}
                    className="w-full mt-6 py-3 rounded-xl font-medium text-white"
                    style={{ backgroundColor: BYD_RED }}
                >
                    Aplicar filtro
                </button>
            </div>
        </div>
    );
};

export default FilterModal;
