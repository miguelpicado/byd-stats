import { useState, useMemo, FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths
} from 'date-fns';
import { enGB, es } from 'date-fns/locale';
import { ChevronLeft, Car, Zap } from '@components/Icons';
import DayDetailsModal from '@components/modals/DayDetailsModal';
import { Trip, Charge } from '@/types';

interface CalendarTabProps {
    trips?: Trip[];
    charges?: Charge[];
    onTripSelect: (trip: Trip) => void;
    onChargeSelect?: (charge: Charge) => void;
    isActive?: boolean;
}

const CalendarTab: FC<CalendarTabProps> = ({
    trips = [],
    charges = [],
    onTripSelect,
    onChargeSelect
}) => {
    const { t, i18n } = useTranslation();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Get locale object for date-fns
    const locale = useMemo(() => {
        return i18n.language.startsWith('es') ? es : enGB;
    }, [i18n.language]);

    // Calendar generation logic
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        return eachDayOfInterval({
            start: startDate,
            end: endDate
        });
    }, [currentMonth]);

    // Group data by date for quick lookup
    const dataByDate = useMemo(() => {
        const data: Record<string, { trips: Trip[], charges: Charge[] }> = {};

        // Process trips
        trips.forEach(trip => {
            let tripDate: Date | null = null;
            if (trip.start_timestamp) {
                tripDate = new Date(trip.start_timestamp * 1000);
            } else if (trip.date && trip.date.length === 8) {
                // Fallback to YYYYMMDD string
                const y = parseInt(trip.date.substring(0, 4), 10);
                const m = parseInt(trip.date.substring(4, 6), 10) - 1;
                const d = parseInt(trip.date.substring(6, 8), 10);
                tripDate = new Date(y, m, d);
            }

            if (!tripDate || isNaN(tripDate.getTime())) return; // Skip invalid dates

            const dateStr = format(tripDate, 'yyyy-MM-dd');
            if (!data[dateStr]) data[dateStr] = { trips: [], charges: [] };
            data[dateStr].trips.push(trip);
        });

        // Process charges
        charges.forEach(charge => {
            if (!charge.date) return;
            const chargeDate = new Date(charge.date);
            if (isNaN(chargeDate.getTime())) return; // Skip invalid dates

            const dateStr = format(chargeDate, 'yyyy-MM-dd');
            if (!data[dateStr]) data[dateStr] = { trips: [], charges: [] };
            data[dateStr].charges.push(charge);
        });

        return data;
    }, [trips, charges]);

    // Handlers
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToToday = () => setCurrentMonth(new Date());

    const handleDayClick = (day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayData = dataByDate[dateStr];

        if (dayData && (dayData.trips.length > 0 || dayData.charges.length > 0)) {
            setSelectedDate(day);
            setIsModalOpen(true);
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedDate(null), 300); // Clear after animation
    };

    const selectedDayData = useMemo(() => {
        if (!selectedDate) return { trips: [], charges: [] };
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return dataByDate[dateStr] || { trips: [], charges: [] };
    }, [selectedDate, dataByDate]);

    // Weekday headers
    const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; // Could be dynamic based on locale

    return (
        <div className="flex flex-col h-full animate-fade-in space-y-4 pb-20 md:pb-0">

            {/* Header / Month Navigation */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800/50 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <button
                    onClick={prevMonth}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>

                <div className="flex flex-col items-center">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale })}
                    </h2>
                    <button
                        onClick={goToToday}
                        className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
                    >
                        {t('filter.byRange') === 'By range' ? 'Today' : 'Ir a Hoy'} {/* Fallback translation */}
                    </button>
                </div>

                <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors rotate-180 transform"
                >
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 flex-1 flex flex-col">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-2">
                    {weekDays.map((day, i) => (
                        <div key={i} className="text-center text-xs font-semibold text-slate-400 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1 md:gap-2 flex-1 auto-rows-fr">
                    {calendarDays.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayData = dataByDate[dateStr];
                        const hasTrips = dayData?.trips?.length > 0;
                        const hasCharges = dayData?.charges?.length > 0;
                        const isCurrentMonth = isSameMonth(day, currentMonth);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <div
                                key={day.toString()}
                                onClick={() => handleDayClick(day)}
                                className={`
                            relative flex flex-col items-center p-1 md:p-2 rounded-xl transition-all border
                            ${isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-700/20' : 'bg-transparent text-slate-300 dark:text-slate-700'}
                            ${isToday ? 'border-red-500/50 dark:border-red-500/50 ring-1 ring-red-500/20' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'}
                            ${(hasTrips || hasCharges) ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:shadow-md hover:-translate-y-0.5' : ''}
                            min-h-[60px] md:min-h-[80px]
                        `}
                            >
                                {/* Day Number */}
                                <span className={`
                            text-xs md:text-sm font-medium mb-1 md:mb-2 w-6 h-6 flex items-center justify-center rounded-full
                            ${isToday ? 'bg-red-500 text-white' : 'text-slate-700 dark:text-slate-300'}
                        `}>
                                    {format(day, 'd')}
                                </span>

                                {/* Indicators Container */}
                                <div className="flex flex-wrap justify-center gap-1 w-full">
                                    {hasTrips && (
                                        <div className="flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-md p-0.5 md:p-1 w-full max-w-[24px] md:max-w-none md:w-auto md:px-2 md:gap-1" title={`${dayData.trips.length} viajes`}>
                                            <Car className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                            <span className="hidden md:inline text-[10px] font-bold">{dayData.trips.length}</span>
                                        </div>
                                    )}

                                    {hasCharges && (
                                        <div className="flex items-center justify-center bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-md p-0.5 md:p-1 w-full max-w-[24px] md:max-w-none md:w-auto md:px-2 md:gap-1" title={`${dayData.charges.length} cargas`}>
                                            <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                            <span className="hidden md:inline text-[10px] font-bold">{dayData.charges.length}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <DayDetailsModal
                isOpen={isModalOpen}
                onClose={closeModal}
                date={selectedDate}
                trips={selectedDayData.trips}
                charges={selectedDayData.charges}
                onTripSelect={onTripSelect}
                onChargeSelect={onChargeSelect}
            />
        </div>
    );
};

export default CalendarTab;


