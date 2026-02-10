// BYD Stats - Filter Modal Component

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BYD_RED } from '@core/constants';
import { formatMonth } from '@core/dateUtils';
import { Filter } from '../Icons';
import ModalHeader from '../common/ModalHeader';

import { useData } from '../../providers/DataProvider';

/**
 * Filter modal for trip filtering
 * Now consumes DataProvider directly
 */
const FilterModal: React.FC = () => {
    const { t } = useTranslation();
    const {
        filterType,
        setFilterType,
        selMonth,
        setSelMonth,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        months,
        trips: rawTrips,
        filtered,
        modals,
        closeModal
    } = useData();

    const isOpen = modals.filter;
    const onClose = () => closeModal('filter');

    const rawTripsCount = rawTrips ? rawTrips.length : 0;
    const filteredCount = filtered ? filtered.length : 0;


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-modal-title"
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 animate-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    title={t('filter.title')}
                    Icon={Filter}
                    onClose={onClose}
                    id="filter-modal-title"
                    iconClassName="w-5 h-5 text-slate-600 dark:text-slate-400"
                />

                <div className="space-y-4">
                    {/* Filter Type Buttons */}
                    <div className="space-y-2">
                        <p className="text-slate-600 dark:text-slate-400 text-sm">{t('filter.type')}:</p>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => { setFilterType('all'); setSelMonth(''); setDateFrom(''); setDateTo(''); }}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'all'
                                    ? 'text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                style={{ backgroundColor: filterType === 'all' ? BYD_RED : '' }}
                            >
                                📊 {t('common.allTrips')} ({rawTripsCount})
                            </button>
                            <button
                                onClick={() => setFilterType('month')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'month'
                                    ? 'text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                style={{ backgroundColor: filterType === 'month' ? BYD_RED : '' }}
                            >
                                📅 {t('filter.byMonth')}
                            </button>
                            <button
                                onClick={() => setFilterType('range')}
                                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${filterType === 'range'
                                    ? 'text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                                    }`}
                                style={{ backgroundColor: filterType === 'range' ? BYD_RED : '' }}
                            >
                                📆 {t('filter.byRange')}
                            </button>
                        </div>
                    </div>

                    {/* Month Selector */}
                    {filterType === 'month' && (
                        <div className="space-y-2">
                            <label htmlFor="selMonth" className="text-slate-600 dark:text-slate-400 text-sm">{t('filter.selectMonth')}:</label>
                            <select
                                id="selMonth"
                                value={selMonth}
                                onChange={(e) => setSelMonth(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                            >
                                <option value="">{t('filter.allMonths')}</option>
                                {months.map((m: string) => (
                                    <option key={m} value={m}>{formatMonth(m)}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Date Range Selector */}
                    {filterType === 'range' && (
                        <div className="space-y-2">
                            <p className="text-slate-600 dark:text-slate-400 text-sm">{t('filter.byRange')}:</p>
                            <div className="flex flex-col gap-2">
                                <label htmlFor="dateFrom" className="sr-only">{t('common.from', 'Desde')}</label>
                                <input
                                    id="dateFrom"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                                    placeholder="Desde"
                                    aria-label={t('common.from', 'Desde')}
                                />
                                <label htmlFor="dateTo" className="sr-only">{t('common.to', 'Hasta')}</label>
                                <input
                                    id="dateTo"
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-600 text-sm"
                                    placeholder="Hasta"
                                    aria-label={t('common.to', 'Hasta')}
                                />
                            </div>
                        </div>
                    )}

                    {/* Results Count */}
                    {filteredCount !== rawTripsCount && (
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-center text-sm">
                                <span className="text-slate-400">{t('filter.showing')} </span>
                                <span className="font-bold" style={{ color: BYD_RED }}>{filteredCount}</span>
                                <span className="text-slate-400"> {t('filter.of')} {rawTripsCount} {t('stats.trips').toLowerCase()}</span>
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
                    {t('filter.apply')}
                </button>
            </div>
        </div>
    );
};

export default FilterModal;
