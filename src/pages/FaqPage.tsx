import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, ChevronLeft } from '../components/Icons';
import FaqContent from '../components/FaqContent';

const FaqPage = () => {
    const { t } = useTranslation();

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col pt-[env(safe-area-inset-top,24px)]">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 transition-colors">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"
                            title={t('common.close')}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{t('faq.pageTitle')}</h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t('faq.pageSubtitle')}</p>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
                        <HelpCircle className="w-6 h-6 text-red-600" />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 sm:p-10 min-h-[60vh]">
                    <FaqContent />
                </div>

                {/* Footer info */}
                <div className="mt-8 text-center text-slate-500 text-xs px-4">
                    <p>BYD Stats Analyzer</p>
                    <p className="mt-1">{t('footer.madeWith')}</p>
                </div>
            </main>
        </div>
    );
};

export default FaqPage;

