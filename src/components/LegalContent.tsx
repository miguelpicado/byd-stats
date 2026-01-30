import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, AlertCircle } from './Icons';

const LegalContent = ({ section = 'privacy' }) => {
    const { t } = useTranslation();

    if (section === 'privacy') {
        return (
            <div className="prose prose-slate dark:prose-invert max-w-none">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('legal.privacy.title')}</h3>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-700 dark:text-blue-400">{t('legal.privacy.summary')}</p>
                </div>

                <section className="space-y-3">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.privacy.sections.collection.title')}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{t('legal.privacy.sections.collection.text')}</p>
                </section>

                <section className="space-y-3">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.privacy.sections.usage.title')}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t('legal.privacy.sections.usage.text')}
                    </p>
                </section>

                <section className="space-y-3">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.privacy.sections.storage.title')}</h4>
                    <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                        <li>{t('legal.privacy.sections.storage.local')}</li>
                        <li>{t('legal.privacy.sections.storage.cloud')}</li>
                    </ul>
                </section>

                <section className="space-y-3">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.privacy.sections.thirdParty.title')}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {t('legal.privacy.sections.thirdParty.text')}
                    </p>
                </section>

                <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500 text-center">{t('legal.lastUpdate')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="prose prose-slate dark:prose-invert max-w-none">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('legal.terms.title')}</h3>

            <section className="space-y-3">
                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.terms.sections.about.title')}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('legal.terms.sections.about.text')}
                </p>
            </section>

            <section className="space-y-3">
                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.terms.sections.trademarks.title')}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('legal.terms.sections.trademarks.text')}
                </p>
            </section>

            <section className="space-y-3">
                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.terms.sections.liability.title')}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('legal.terms.sections.liability.text')}
                </p>
            </section>

            <section className="space-y-3">
                <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">{t('legal.terms.sections.contributions.title')}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('legal.terms.sections.contributions.text')}
                </p>
            </section>
        </div>
    );
};

export default LegalContent;


