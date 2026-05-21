import React, { useState, useEffect } from 'react';
import { X, Shield, FileText } from '../Icons';
import LegalContent from '../LegalContent'; // Still JSX, but that's fine for now
import { useTranslation } from 'react-i18next';
import { useData } from '../../providers/DataProvider';

const LegalModal: React.FC = () => {
    const { t } = useTranslation();
    const { modals, closeModal, legalInitialSection } = useData(); // legalInitialSection might be missing from DataProvider types? Let's check or assume loose typing for now in useAppData/DataProvider

    // Props derived from context
    const isOpen = modals.legal;
    const onClose = () => closeModal('legal');

    // State
    const [activeSection, setActiveSection] = useState(legalInitialSection || 'privacy');

    // Update active section if global initial section changes (and modal re-opens)
    useEffect(() => {
        // cast to string for safety if needed
        if (isOpen && legalInitialSection) {
            setActiveSection(legalInitialSection);
        }
    }, [isOpen, legalInitialSection]);

    if (!isOpen) return null;

    const sections = [
        { id: 'privacy', label: t('legal.privacyTab'), icon: Shield },
        { id: 'legal', label: t('legal.termsTab'), icon: FileText },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-modal-backdrop">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="legal-modal-title"
                className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            <Shield className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <h2 id="legal-modal-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{t('legal.pageTitle')}</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('legal.projectSubtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close legal"
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Tabs */}
                <div role="tablist" aria-label="Legal sections" className="flex border-b border-slate-200 dark:border-slate-800">
                    {sections.map((s) => (
                        <button
                            key={s.id}
                            role="tab"
                            id={`tab-${s.id}`}
                            aria-selected={activeSection === s.id}
                            aria-controls={`tabpanel-${s.id}`}
                            onClick={() => setActiveSection(s.id)}
                            className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-all border-b-2 ${activeSection === s.id
                                ? 'border-red-600 text-red-600 bg-red-50/10'
                                : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                        >
                            <s.icon className="w-4 h-4" />
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div
                    role="tabpanel"
                    id={`tabpanel-${activeSection}`}
                    aria-labelledby={`tab-${activeSection}`}
                    className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
                >
                    <LegalContent section={activeSection} />
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl text-sm font-bold transition-all"
                    >
                        {t('legal.understood')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LegalModal;
