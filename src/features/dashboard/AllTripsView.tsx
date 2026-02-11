import React, { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ModalContainer from '../../components/common/ModalContainer';
import VirtualizedTripList from '../../components/lists/VirtualizedTripList';
import { useFilteredData } from '../../hooks/useFilteredData';
import { useTripsContext } from '../../providers/TripsProvider';

import { Trip } from '@/types';
import { CloseModalFn } from '../../hooks/useModalState';

interface AllTripsViewProps {
    rawTrips: Trip[];
    filterType: string;
    month: string;
    dateFrom: string;
    dateTo: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    setFilterType: (val: string) => void;
    setMonth: (val: string) => void;
    setDateFrom: (val: string) => void;
    setDateTo: (val: string) => void;
    setSortBy: (val: string) => void;
    setSortOrder: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
    closeModal: CloseModalFn;
    openTripDetail: (trip: Trip) => void;
    scrollRef: React.MutableRefObject<any>;
    isNative: boolean;
}

const AllTripsView = ({
    rawTrips,
    closeModal,
    openTripDetail,
    scrollRef,
    isNative,
}: AllTripsViewProps) => {
    const { t } = useTranslation();

    // Define filter/sort functions
    const filterFunction = useCallback((trip: Trip, filterType: string, month: string, dateFrom: string, dateTo: string) => {
        if (filterType === 'month' && month) {
            return trip.month === month;
        } else if (filterType === 'range') {
            const dDateFrom = dateFrom ? dateFrom.replace(/-/g, '') : '';
            const dDateTo = dateTo ? dateTo.replace(/-/g, '') : '';
            if (dDateFrom && trip.date < dDateFrom) return false;
            if (dDateTo && trip.date > dDateTo) return false;
            return true;
        }
        return true;
    }, []);

    const sortFunction = useCallback((a: Trip, b: Trip, sortBy: string) => {
        if (sortBy === 'date') {
            const dateCompare = (b.date || '').localeCompare(a.date || '');
            if (dateCompare !== 0) return dateCompare;
            return (b.start_timestamp || 0) - (a.start_timestamp || 0);
        } else if (sortBy === 'efficiency') {
            const effA = a.trip > 0 && a.electricity !== undefined && a.electricity !== null && a.electricity !== 0
                ? (a.electricity / a.trip) * 100
                : Infinity;
            const effB = b.trip > 0 && b.electricity !== undefined && b.electricity !== null && b.electricity !== 0
                ? (b.electricity / b.trip) * 100
                : Infinity;
            return effA - effB;
        } else if (sortBy === 'distance') {
            return (b.trip || 0) - (a.trip || 0);
        } else if (sortBy === 'consumption') {
            return (b.electricity || 0) - (a.electricity || 0);
        }
        return 0;
    }, []);

    const {
        filterType, setFilterType,
        month, setMonth,
        dateFrom, setDateFrom,
        dateTo, setDateTo,
        sortBy, setSortBy,
        sortOrder, setSortOrder,
        filteredData: finalTrips
    } = useFilteredData({
        data: rawTrips,
        initialSortBy: 'date',
        filterFunction,
        sortFunction
    });

    // Score calculations
    const { minEff, maxEff } = useMemo(() => {
        const validTrips = finalTrips.filter(t => t.trip >= 1 && t.electricity !== 0);
        const efficiencies = validTrips.map(t => (t.electricity / t.trip) * 100);
        const min = efficiencies.length > 0 ? Math.min(...efficiencies) : 0;
        const max = efficiencies.length > 0 ? Math.max(...efficiencies) : 0;
        return { minEff: min, maxEff: max };
    }, [finalTrips]);

    // Handle close callback
    const handleClose = useCallback(() => closeModal('allTrips'), [closeModal]);

    // State for scroller element
    const [scroller, setScroller] = React.useState<HTMLDivElement | null>(null);

    const scrollRefCallback = React.useCallback((node: HTMLDivElement | null) => {
        if (node) {
            scrollRef.current = node;
            setScroller(node);
        }
    }, [scrollRef]);

    // NEW: Infinite Scroll
    const { loadMore, hasMore, isLoadingMore } = useTripsContext();

    // Pass this to VirtualizedTripList
    const handleEndReached = useCallback(() => {
        if (hasMore && !isLoadingMore) {
            loadMore();
        }
    }, [hasMore, isLoadingMore, loadMore]);

    return (
        <div
            ref={scrollRefCallback}
            className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-white"
        >
            <ModalContainer />

            <div className={`max-w-7xl mx-auto px-4 py-6 ${isNative ? 'pt-12' : ''}`}>
                <div className="flex flex-col gap-4 mb-6">
                    <div>
                        <button
                            onClick={handleClose}
                            className="text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 mb-2 transition-colors"
                        >
                            ← {t('common.back', 'Volver')}
                        </button>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {t('common.allTrips', 'Todos los viajes')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('header.trips', { count: finalTrips.length, defaultValue: 'viajes' })}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'all', label: t('filter.all', 'Todo') },
                                { id: 'month', label: t('filter.byMonth', 'Por mes') },
                                { id: 'range', label: t('filter.byRange', 'Por rango') }
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    onClick={() => {
                                        setFilterType(filter.id);
                                        if (filter.id === 'all') {
                                            setMonth('');
                                            setDateFrom('');
                                            setDateTo('');
                                        }
                                    }}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === filter.id
                                        ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        {/* Date Inputs */}
                        {filterType === 'month' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <label htmlFor="trip-month-filter" className="sr-only">{t('filter.byMonth', 'Filtrar por mes')}</label>
                                <input
                                    id="trip-month-filter"
                                    type="month"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                        )}

                        {filterType === 'range' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <label htmlFor="trip-date-from" className="sr-only">{t('common.from', 'Desde')}</label>
                                <input
                                    id="trip-date-from"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                                <span className="text-slate-400">-</span>
                                <label htmlFor="trip-date-to" className="sr-only">{t('common.to', 'Hasta')}</label>
                                <input
                                    id="trip-date-to"
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                        )}

                        {/* Sorting */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-sm text-slate-500 dark:text-slate-400 mr-1">
                                {t('sort.label', 'Ordenar:')}
                            </span>
                            {[
                                { id: 'date', label: t('common.date', 'Fecha') },
                                { id: 'efficiency', label: t('stats.efficiency', 'Eficiencia') },
                                { id: 'distance', label: t('stats.distance', 'Distancia') },
                                { id: 'consumption', label: t('tripDetail.consumption', 'Consumo') }
                            ].map(sort => (
                                <button
                                    key={sort.id}
                                    onClick={() => {
                                        if (sortBy === sort.id) {
                                            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                        } else {
                                            setSortBy(sort.id);
                                            setSortOrder('desc'); // Default to desc for new sort
                                        }
                                    }}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${sortBy === sort.id
                                        ? 'bg-slate-800 dark:bg-slate-700 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {sort.label}
                                    {sortBy === sort.id && (
                                        <span className="text-xs opacity-70">
                                            {sortOrder === 'asc' ? '↑' : '↓'}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <VirtualizedTripList
                        trips={finalTrips}
                        onTripClick={openTripDetail}
                        minEff={minEff}
                        maxEff={maxEff}
                        scrollElement={scroller}
                        onEndReached={handleEndReached}
                        isLoading={isLoadingMore}
                        hasMore={hasMore}
                    />
                </div>
            </div>
        </div>
    );
};

export default AllTripsView;


