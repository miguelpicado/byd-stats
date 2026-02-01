import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, FileText, ChevronLeft } from '../components/Icons';
import LegalContent from '../components/LegalContent';

interface LegalPageProps {
    forcedTab?: string;
}

const LegalPage = ({ forcedTab }: LegalPageProps) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = React.useState(forcedTab || 'privacy');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pt-[env(safe-area-inset-top,24px)]">
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
                            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{t('legal.pageTitle')}</h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t('legal.projectSubtitle')}</p>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-red-600/10 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-red-600" />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[60vh]">
                    {/* Sidebar Tabs */}
                    <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <nav className="p-2 space-y-1">
                            <button
                                onClick={() => setActiveTab('privacy')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${activeTab === 'privacy'
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <Shield className="w-5 h-5 flex-shrink-0" />
                                {t('legal.privacyTab')}
                            </button>
                            <button
                                onClick={() => setActiveTab('legal')}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${activeTab === 'legal'
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <FileText className="w-5 h-5 flex-shrink-0" />
                                {t('legal.termsTab')}
                            </button>
                        </nav>
                    </aside>

                    {/* Document Area */}
                    <div className="flex-1 p-6 sm:p-10 overflow-y-auto">
                        <LegalContent section={activeTab} />
                    </div>
                </div>

                {/* Footer info */}
                <div className="mt-8 text-center text-slate-500 text-xs px-4">
                    <p>{t('legal.footerRights')}</p>
                    <p className="mt-1">{t('legal.footerNote')}</p>
                </div>
            </main>
        </div>
    );
};

export default LegalPage;

