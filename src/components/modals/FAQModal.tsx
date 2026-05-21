import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, ChevronDown, ChevronUp } from '../Icons';
import ModalHeader from '../common/ModalHeader';
import { BYD_RED } from '@core/constants';
import { useData } from '../../providers/DataProvider';

interface FAQItemProps {
    title: string;
    content: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ title, content }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all duration-200">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
                <span className="font-medium text-slate-900 dark:text-white text-sm pr-4">{title}</span>
                {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                )}
            </button>
            {isOpen && (
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {content}
                    </p>
                </div>
            )}
        </div>
    );
};

const FAQModal: React.FC = () => {
    const { t } = useTranslation();
    const { modals, closeModal } = useData();

    const isOpen = modals.faq;
    const onClose = () => closeModal('faq');

    if (!isOpen) return null;

    const faqs = [
        {
            title: t('tooltips.faqImportTitle'),
            content: t('tooltips.faqImportDesc')
        },
        {
            title: t('tooltips.faqDynamicTitle'),
            content: t('tooltips.faqDynamicDesc')
        },
        {
            title: t('tooltips.faqStationaryTitle'),
            content: t('tooltips.faqStationaryDesc')
        },
        {
            title: t('tooltips.faqPrivacyTitle'),
            content: t('tooltips.faqPrivacyDesc')
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-backdrop" onClick={onClose}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
            <div
                className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh] animate-modal-content"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <ModalHeader
                        title={t('tooltips.faqTitle')}
                        Icon={HelpCircle}
                        onClose={onClose}
                        iconColor={BYD_RED}
                    />
                </div>

                <div className="overflow-y-auto p-6 space-y-3">
                    {faqs.map((faq, index) => (
                        <FAQItem key={index} title={faq.title} content={faq.content} />
                    ))}
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-2">
                    <p className="text-center text-xs text-slate-400">
                        {t('help.subtitle')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FAQModal;
