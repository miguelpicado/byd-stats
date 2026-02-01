import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ModalContainer from '../../components/common/ModalContainer';
import VirtualizedChargeList from '../../components/lists/VirtualizedChargeList';

import { Charge, ChargerType } from '@/types';

interface AllChargesViewProps {
    charges: Charge[];
    chargerTypes: ChargerType[];
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
    openModal: (modal: string) => void;
    closeModal: (modal: string) => void;
    setSelectedCharge: (charge: Charge | null) => void;
    scrollRef: React.MutableRefObject<any>;
    isNative: boolean;
}

const AllChargesView = ({
    charges,
    chargerTypes,
    filterType,
    month,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    setFilterType,
    setMonth,
    setDateFrom,
    setDateTo,
    setSortBy,
    setSortOrder,
    openModal,
    closeModal,
    setSelectedCharge,
    scrollRef,
    isNative,
}: AllChargesViewProps) => {
    const { t } = useTranslation();

    const finalCharges = useMemo(() => {
        let filtered = [...charges];

        // Apply filters
        if (filterType === 'month' && month) {
            filtered = filtered.filter(c => c.date.startsWith(month));
        } else if (filterType === 'range') {
            if (dateFrom) filtered = filtered.filter(c => c.date >= dateFrom);
            if (dateTo) filtered = filtered.filter(c => c.date <= dateTo);
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'date') {
                comparison = b.date.localeCompare(a.date) || b.time.localeCompare(a.time);
            } else if (sortBy === 'kwh') {
                comparison = (b.kwhCharged || 0) - (a.kwhCharged || 0);
            } else if (sortBy === 'cost') {
                comparison = (b.totalCost || 0) - (a.totalCost || 0);
            }
            return sortOrder === 'asc' ? -comparison : comparison;
        });

        return filtered;
    }, [charges, filterType, month, dateFrom, dateTo, sortBy, sortOrder]);


    const handleChargeClick = (charge: Charge) => {
        setSelectedCharge(charge);
        openModal('chargeDetail');
    };

    const getChargerTypeName = (chargerTypeId: string) => {
        const chargerType = (chargerTypes || []).find(ct => ct.id === chargerTypeId);
        return chargerType?.name || chargerTypeId || '-';
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

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
                            onClick={() => closeModal('allCharges')}
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
                                <input
                                    type="month"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                            </div>
                        )}

                        {filterType === 'range' && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                />
                                <span className="text-slate-400">-</span>
                                <input
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


