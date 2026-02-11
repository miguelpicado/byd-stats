import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ModalContainer from '../../components/common/ModalContainer';
import VirtualizedChargeList from '../../components/lists/VirtualizedChargeList';
import { useFilteredData } from '../../hooks/useFilteredData';

import { Charge, ChargerType } from '@/types';
import { OpenModalFn, CloseModalFn } from '../../hooks/useModalState';

interface AllChargesViewProps {
    charges: Charge[];
    chargerTypes: ChargerType[];
    openModal: OpenModalFn;
    closeModal: CloseModalFn;
    setSelectedCharge: (charge: Charge | null) => void;
    scrollRef: React.MutableRefObject<any>;
    isNative: boolean;
}

const AllChargesView = ({
    charges,
    chargerTypes,
    openModal,
    closeModal,
    setSelectedCharge,
    scrollRef,
    isNative,
}: AllChargesViewProps) => {
    const { t } = useTranslation();

    const filterFunction = useCallback((charge: Charge, filterType: string, month: string, dateFrom: string, dateTo: string) => {
        if (filterType === 'month' && month) {
            return charge.date.startsWith(month);
        } else if (filterType === 'range') {
            if (dateFrom && charge.date < dateFrom) return false;
            if (dateTo && charge.date > dateTo) return false;
            return true;
        }
        return true;
    }, []);

    const sortFunction = useCallback((a: Charge, b: Charge, sortBy: string) => {
        if (sortBy === 'date') {
            return b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
        } else if (sortBy === 'kwh') {
            return (b.kwhCharged || 0) - (a.kwhCharged || 0);
        } else if (sortBy === 'cost') {
            return (b.totalCost || 0) - (a.totalCost || 0);
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
        filteredData: finalCharges
    } = useFilteredData({
        data: charges,
        initialSortBy: 'date',
        filterFunction,
        sortFunction
    });

    const handleChargeClick = useCallback((charge: Charge) => {
        setSelectedCharge(charge);
        openModal('chargeDetail');
    }, [setSelectedCharge, openModal]);

    const getChargerTypeName = useCallback((chargerTypeId: string) => {
        const chargerType = (chargerTypes || []).find(ct => ct.id === chargerTypeId);
        return chargerType?.name || chargerTypeId || '-';
    }, [chargerTypes]);

    const formatDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }, []);

    const handleClose = useCallback(() => closeModal('allCharges'), [closeModal]);

    // State for scroller element to ensure virtualizer updates on mount
    const [scroller, setScroller] = React.useState<HTMLDivElement | null>(null);

    const scrollRefCallback = React.useCallback((node: HTMLDivElement | null) => {
        if (node) {
            scrollRef.current = node;
            setScroller(node);
        }
    }, [scrollRef]);

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
                            {t('charges.summary', 'Todas las cargas')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {finalCharges.length} {t('charges.chargeCount', 'cargas')}
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
                                <label htmlFor="charge-month-filter" className="sr-only">{t('filter.byMonth', 'Filtrar por mes')}</label>
                                <input
                                    id="charge-month-filter"
                                    type="month"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                        )}

                        {filterType === 'range' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <label htmlFor="charge-date-from" className="sr-only">{t('common.from', 'Desde')}</label>
                                <input
                                    id="charge-date-from"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                                <span className="text-slate-400">-</span>
                                <label htmlFor="charge-date-to" className="sr-only">{t('common.to', 'Hasta')}</label>
                                <input
                                    id="charge-date-to"
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
                                { id: 'kwh', label: 'kWh' },
                                { id: 'cost', label: t('charges.totalCost', 'Coste') }
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
                    <VirtualizedChargeList
                        charges={finalCharges}
                        onChargeClick={handleChargeClick}
                        scrollElement={scroller}
                        formatDate={formatDate}
                        getChargerTypeName={getChargerTypeName}
                    />
                </div>
            </div>
        </div >
    );
};

export default AllChargesView;


