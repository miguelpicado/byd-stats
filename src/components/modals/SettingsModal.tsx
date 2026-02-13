// BYD Stats - SettingsModal Component

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BYD_RED } from '@core/constants';
import ModalHeader from '../common/ModalHeader';
import GoogleSyncSettings from '../settings/GoogleSyncSettings';
import { useData } from '../../providers/DataProvider';
import { useCar } from '../../context/CarContext';
import { VehicleSettings } from '../settings/VehicleSettings';
import { PriceSettings } from '../settings/PriceSettings';
import { ChargingSettings } from '../settings/ChargingSettings';
import { BydSettings } from '../settings/BydSettings';
import { AppPreferences } from '../settings/AppPreferences';

interface SettingsModalProps {
    onClose?: () => void;
}

/**
 * Settings modal for app configuration
 */
const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const { t } = useTranslation();
    const { googleSync, closeModal } = useData();
    const { updateCar, activeCarId } = useCar();

    // Handle close logic - either props or context
    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            closeModal('settings');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
                <ModalHeader title={t('settings.title')} onClose={handleClose} />

                <div className="space-y-6 mt-4">

                    {/* Vehicle Settings: Name, Plate, Insurance, Battery, SoH */}
                    <VehicleSettings />

                    <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

                    {/* Price Settings: Electricity & Fuel */}
                    <PriceSettings />

                    <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

                    {/* Charging Settings: Charger Types, Home Charging */}
                    <ChargingSettings />

                    <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

                    {/* App Preferences: Language, Theme, Tabs */}
                    <AppPreferences />

                    <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

                    {/* Google Drive Sync */}
                    <GoogleSyncSettings googleSync={googleSync} />

                    <div className="border-t border-slate-200 dark:border-slate-700 my-4" />

                    {/* BYD Direct API (PyBYD) */}
                    <BydSettings onConnectionChange={(connected, vin) => {
                        if (connected && vin && activeCarId) {
                            updateCar(activeCarId, {
                                vin,
                                connectorType: 'pybyd'
                            });
                        } else if (!connected && activeCarId) {
                            updateCar(activeCarId, {
                                vin: undefined,
                                connectorType: undefined
                            });
                        }
                    }} />

                </div>

                <button
                    onClick={handleClose}
                    className="w-full mt-6 py-3 rounded-xl font-medium text-white shadow-lg shadow-red-500/20 active:scale-[0.98] transition-transform"
                    style={{ backgroundColor: BYD_RED }}
                >
                    {t('common.save')}
                </button>
            </div>
        </div>
    );
};

export default SettingsModal;
