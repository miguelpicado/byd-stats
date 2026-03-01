import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '@/context/AppContext';
import { useCar } from '@/context/CarContext';
import { useChargesContextData } from '@/hooks/useChargesContext';
import { Charge } from '@/types';

export const PriceSettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useApp();
    const { activeCar } = useCar();
    const { charges } = useChargesContextData();

    // Calculate average electricity and fuel prices
    const { avgElectricPrice, avgFuelPrice, electricStats, fuelStats } = useMemo(() => {
        if (!charges || charges.length === 0) return { avgElectricPrice: 0, avgFuelPrice: 0, electricStats: { count: 0, total: 0, kwh: 0 }, fuelStats: { count: 0, total: 0, liters: 0 } };

        const electricCharges = charges.filter((c: Charge) => !c.type || c.type === 'electric');
        const fuelCharges = charges.filter((c: Charge) => c.type === 'fuel');

        // Electric stats
        const eCost = electricCharges.reduce((sum: number, c: Charge) => sum + (c.totalCost || 0), 0);
        const eKwh = electricCharges.reduce((sum: number, c: Charge) => sum + (c.kwhCharged || 0), 0);
        const avgElectricPrice = eKwh > 0 ? eCost / eKwh : 0;

        // Fuel stats
        const fCost = fuelCharges.reduce((sum: number, c: Charge) => sum + (c.totalCost || 0), 0);
        const fLiters = fuelCharges.reduce((sum: number, c: Charge) => sum + (c.litersCharged || 0), 0);
        const avgFuelPrice = fLiters > 0 ? fCost / fLiters : 0;

        return {
            avgElectricPrice,
            avgFuelPrice,
            electricStats: { count: electricCharges.length, total: eCost, kwh: eKwh },
            fuelStats: { count: fuelCharges.length, total: fCost, liters: fLiters }
        };
    }, [charges]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="electricPrice" className="block text-sm text-slate-600 dark:text-slate-400 mb-2">{t('settings.electricityPrice')} (€/kWh)</label>

                {/* Pricing Strategy Selector */}
                <div className="flex gap-2 mb-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                    {['custom', 'average', 'dynamic'].map(strategy => {
                        const isActive = (settings.priceStrategy === strategy) ||
                            (!settings.priceStrategy && (
                                (strategy === 'average' && settings.useCalculatedPrice) ||
                                (strategy === 'custom' && !settings.useCalculatedPrice)
                            ));

                        return (
                            <button
                                key={strategy}
                                onClick={() => updateSettings({
                                    ...settings,
                                    priceStrategy: strategy,
                                    // Maintain legacy compatibility temporarily
                                    useCalculatedPrice: strategy === 'average'
                                })}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${isActive
                                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                    }`}
                                title={strategy === 'average' && (!charges || charges.length === 0) ? t('settings.priceCalculatedNoData') : ''}
                            >
                                {strategy === 'custom' ? t('settings.priceCustom') :
                                    strategy === 'average' ? t('settings.priceCalculated') :
                                        t('settings.priceDynamics')}
                            </button>
                        );
                    })}
                </div>

                {/* Dynamic Price Hint */}
                {(settings.priceStrategy === 'dynamic') && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 italic">
                        {t('settings.priceDynamicsHint')}
                    </p>
                )}

                {/* Price input - Only show if not dynamic */}
                {settings.priceStrategy !== 'dynamic' && (
                    <input
                        id="electricPrice"
                        name="electricPrice"
                        type="number"
                        step="0.001"
                        value={
                            (settings.priceStrategy === 'average' || (!settings.priceStrategy && settings.useCalculatedPrice))
                                ? avgElectricPrice.toFixed(3)
                                : (settings?.electricPrice || 0)
                        }
                        onChange={(e) => updateSettings({ ...settings, electricPrice: parseFloat(e.target.value) || 0 })}
                        disabled={settings.priceStrategy === 'average' || settings.useCalculatedPrice}
                        className={`w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 ${(settings.priceStrategy === 'average' || settings.useCalculatedPrice) ? 'opacity-60 cursor-not-allowed' : ''
                            }`}
                        placeholder={
                            (settings.priceStrategy === 'average' || (!settings.priceStrategy && settings.useCalculatedPrice))
                                ? t('settings.priceCalculatedAuto')
                                : '0.15'
                        }
                    />
                )}

                {/* Info text */}
                {(settings.priceStrategy === 'average' || (!settings.priceStrategy && settings.useCalculatedPrice)) && (
                    electricStats.count > 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {t('settings.priceCalculatedInfo', {
                                count: electricStats.count,
                                total: electricStats.total.toFixed(2),
                                kwh: electricStats.kwh.toFixed(2)
                            })}
                        </p>
                    ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            {t('settings.priceCalculatedNoCharges')}
                        </p>
                    )
                )}
            </div>

            {/* Fuel Price - Only for hybrid vehicles */}
            {activeCar?.isHybrid && (
                <div className="space-y-2">
                    <label htmlFor="fuelPrice" className="block text-sm text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                        <span className="text-lg">⛽</span>
                        {t('settings.fuelPrice')} (€/L)
                    </label>

                    {/* Fuel Pricing Strategy Selector */}
                    <div className="flex gap-2 mb-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
                        {['custom', 'average', 'dynamic'].map(strategy => {
                            const isActive = (settings.fuelPriceStrategy === strategy) ||
                                (!settings.fuelPriceStrategy && (
                                    (strategy === 'average' && settings.useCalculatedFuelPrice) ||
                                    (strategy === 'custom' && !settings.useCalculatedFuelPrice)
                                ));

                            return (
                                <button
                                    key={strategy}
                                    onClick={() => updateSettings({
                                        ...settings,
                                        fuelPriceStrategy: strategy,
                                        useCalculatedFuelPrice: strategy === 'average'
                                    })}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${isActive
                                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                    title={strategy === 'average' && fuelStats.count === 0 ? t('settings.priceCalculatedNoData') : ''}
                                >
                                    {strategy === 'custom' ? t('settings.priceCustom') :
                                        strategy === 'average' ? t('settings.priceCalculated') :
                                            t('settings.priceDynamics')}
                                </button>
                            );
                        })}
                    </div>

                    {/* Dynamic Price Hint */}
                    {(settings.fuelPriceStrategy === 'dynamic') && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 italic">
                            {t('settings.priceDynamicsHint')}
                        </p>
                    )}

                    {/* Fuel Price Input - Only show if not dynamic */}
                    {settings.fuelPriceStrategy !== 'dynamic' && (
                        <input
                            id="fuelPrice"
                            name="fuelPrice"
                            type="number"
                            step="0.01"
                            value={
                                (settings.fuelPriceStrategy === 'average' || (!settings.fuelPriceStrategy && settings.useCalculatedFuelPrice))
                                    ? avgFuelPrice.toFixed(3)
                                    : (settings?.fuelPrice || 1.50)
                            }
                            onChange={(e) => updateSettings({ ...settings, fuelPrice: parseFloat(e.target.value) || 1.50 })}
                            disabled={settings.fuelPriceStrategy === 'average' || settings.useCalculatedFuelPrice}
                            className={`w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-600 ${(settings.fuelPriceStrategy === 'average' || settings.useCalculatedFuelPrice) ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                            placeholder={
                                (settings.fuelPriceStrategy === 'average' || (!settings.fuelPriceStrategy && settings.useCalculatedFuelPrice))
                                    ? t('settings.priceCalculatedAuto')
                                    : '1.50'
                            }
                        />
                    )}

                    {/* Info text for fuel */}
                    {(settings.fuelPriceStrategy === 'average' || (!settings.fuelPriceStrategy && settings.useCalculatedFuelPrice)) && (
                        fuelStats.count > 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {t('settings.priceCalculatedInfoFuel', {
                                    count: fuelStats.count,
                                    total: fuelStats.total.toFixed(2),
                                    liters: fuelStats.liters.toFixed(2)
                                })}
                            </p>
                        ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                {t('settings.priceCalculatedNoCharges')}
                            </p>
                        )
                    )}

                    {(!settings.fuelPriceStrategy || settings.fuelPriceStrategy === 'custom') && !settings.useCalculatedFuelPrice && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('settings.fuelPriceHint')}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
