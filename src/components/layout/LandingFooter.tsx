import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, FileText, HelpCircle, GitHub } from '@components/Icons';

interface LandingFooterProps {
    appVersion: string;
}

const LandingFooter = memo(({ appVersion }: LandingFooterProps) => {
    const { t } = useTranslation();

    return (
        <>
            {/* Privacy & Legal links in bottom-left - Fixed positioning */}
            <div className="absolute left-6 bottom-6 z-10 flex flex-col gap-1.5 items-start pointer-events-none">
                <div className="flex items-center gap-3 pointer-events-auto">
                    <Link
                        to="/privacidad"
                        className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
                    >
                        <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                        <span>{t('footer.privacy')}</span>
                    </Link>
                    <div className="w-px h-3 bg-slate-800"></div>
                    <Link
                        to="/legal"
                        className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
                    >
                        <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                        <span>{t('footer.legal')}</span>
                    </Link>
                    <div className="w-px h-3 bg-slate-800"></div>
                    <Link
                        to="/faq"
                        className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1"
                    >
                        <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                        <span>{t('footer.faq')}</span>
                    </Link>
                </div>
                <p className="text-[10px] text-slate-600 pl-1">BYD Stats {appVersion}</p>
            </div>

            {/* GitHub link in bottom-right - Fixed positioning */}
            <div className="absolute right-6 bottom-6 z-10 flex flex-col gap-1.5 items-end pointer-events-none">
                <a
                    href="https://github.com/miguelpicado/byd-stats"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] sm:text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5 p-1 pointer-events-auto"
                >
                    <span>GitHub</span>
                    <GitHub className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                </a>
                <p className="text-[10px] text-slate-600 pr-1">Open Source Project</p>
            </div>
        </>
    );
});

LandingFooter.displayName = 'LandingFooter';

export default LandingFooter;
