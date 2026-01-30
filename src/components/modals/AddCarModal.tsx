import React, { useState, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import ModalHeader from '../common/ModalHeader';
import { Car } from '../../components/Icons';
import { BYD_RED } from '@core/constants';

interface AddCarModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (carData: { name: string; type: 'ev' | 'phev'; isHybrid: boolean }) => void;
}

const AddCarModal: React.FC<AddCarModalProps> = ({ isOpen, onClose, onSave }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [isHybrid, setIsHybrid] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        onSave({
            name: name.trim(),
            type: isHybrid ? 'phev' : 'ev',
            isHybrid
        });
        setName('');
        setIsHybrid(false);
        onClose();
    };

    const inputClass = "w-full bg-slate-100 dark:bg-slate-700/50 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 border border-slate-200 dark:border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50";
    const labelClass = "block text-sm text-slate-600 dark:text-slate-400 mb-1.5";

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24 sm:pt-32 animate-modal-backdrop">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-md w-full border border-slate-200 dark:border-slate-700 shadow-xl animate-modal-content"
                onClick={e => e.stopPropagation()}>

                <ModalHeader
                    title={t('cars.addCar', 'Añadir Coche')} // Fallback if translation missing
                    Icon={Car}
                    onClose={onClose}
                    iconColor={BYD_RED}
                    className="mb-4"
                />

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className={labelClass}>{t('cars.name', 'Nombre del coche')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. BYD Atto 3"
                            className={inputClass}
                            autoFocus
                        />
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700">
                        <input
                            type="checkbox"
                            id="isHybrid"
                            checked={isHybrid}
                            onChange={(e) => setIsHybrid(e.target.checked)}
                            className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                        />
                        <label htmlFor="isHybrid" className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                            {t('cars.isHybrid', 'Es Híbrido Enchufable (PHEV)')}
                            <p className="text-xs text-slate-500 font-normal mt-0.5">
                                {t('cars.hybridDesc', 'Habilita el registro de repostajes de gasolina')}
                            </p>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={!name.trim()}
                        className="w-full mt-6 py-3 rounded-xl font-medium text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{ backgroundColor: BYD_RED }}
                    >
                        {t('common.create', 'Crear')}
                    </button>
                </form>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;

    return createPortal(modalContent, document.body);
};

export default AddCarModal;
