// BYD Stats - Help Modal Component

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, HelpCircle, Bug, GitHub, Mail, Shield, Heart } from '../Icons';
import { BYD_RED } from '@core/constants';
import { useData } from '../../providers/DataProvider';

const HelpModal: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { modals, closeModal, openModal } = useData();
    const [appVersion, setAppVersion] = useState('v1.2');

    const isOpen = modals.help;
    const onClose = () => closeModal('help');

    // Fetch latest version from GitHub
    useEffect(() => {
        if (isOpen) {
            const fetchVersion = async () => {
                try {
                    const response = await fetch('https://api.github.com/repos/miguelpicado/byd-stats/releases/latest');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.tag_name) {
                            setAppVersion(data.tag_name);
                        }
                    }
                } catch (error) {

                }
            };

            fetchVersion();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                className="relative bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-700 animate-modal-content"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="help-modal-title"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <h2 id="help-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">{t('help.title')}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                        <Plus className="w-6 h-6 rotate-45" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-100 dark:bg-slate-700/50 rounded-xl p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {t('help.subtitle')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                            {t('help.description')}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <a
                            href="https://github.com/miguelpicado/byd-stats/issues/new"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2"
                            style={{ backgroundColor: BYD_RED }}
                        >
                            <Bug className="w-5 h-5" />
                            {t('help.reportBug')}
                        </a>

                        <a
                            href="https://github.com/miguelpicado/byd-stats"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <GitHub className="w-5 h-5" />
                            {t('footer.github')}
                        </a>

                        <a
                            href="mailto:contacto@bydstats.com?subject=BYD Stats - Contacto&body=Hola,%0A%0AMe gustaría contactar sobre..."
                            className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Mail className="w-5 h-5" />
                            {t('footer.email')}
                        </a>

                        <button
                            onClick={() => { closeModal('help'); navigate('/faq'); }}
                            className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <HelpCircle className="w-5 h-5" />
                            {t('footer.faq')}
                        </button>

                        <button
                            onClick={() => { openModal('legal'); }}
                            className="w-full py-3 rounded-xl font-medium text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <Shield className="w-5 h-5" />
                            {t('footer.legal')}
                        </button>
                    </div>

                    {/* Ko-Fi Donation Section */}
                    <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                            {t('help.supportDev')}
                        </h3>
                        <a
                            href="https://ko-fi.com/miguelpicado"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-[#f69a1d] hover:bg-[#e08b1a] text-white rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95 no-underline"
                        >
                            <img
                                src="https://ko-fi.com/img/cup-border.png"
                                alt="Ko-fi"
                                className="w-5 h-auto brightness-0 invert"
                            />
                            <span>{t('help.buyMeCoffee')}</span>
                        </a>
                    </div>

                    <div className="text-center text-xs text-slate-500 dark:text-slate-500 pt-2">
                        <p>BYD Stats Analyzer {appVersion}</p>
                        <p className="mt-1">{t('footer.madeWith')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
