// BYD Stats - Sidebar Navigation Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';
import { Settings, Database, Download, Filter, HelpCircle } from '../icons';

/**
 * Sidebar navigation for horizontal/desktop layout
 * @param {Object} props - Component props
 * @param {Array} props.tabs - Array of tab objects
 * @param {string} props.activeTab - Currently active tab id
 * @param {Function} props.onTabChange - Tab change handler
 * @param {Function} props.onSettings - Settings button handler
 * @param {Function} props.onDatabase - Database button handler
 * @param {Function} props.onExport - Export button handler
 * @param {Function} props.onFilter - Filter button handler
 * @param {Function} props.onHelp - Help button handler
 * @param {boolean} props.isCompact - Compact mode flag
 */
const Sidebar = React.memo(({
    tabs,
    activeTab,
    onTabChange,
    onSettings,
    onDatabase,
    onExport,
    onFilter,
    onHelp,
    isCompact
}) => (
    <div className={`fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/50 flex flex-col ${isCompact ? 'w-16' : 'w-20'} z-40`}>
        {/* Logo area */}
        <div className={`flex items-center justify-center border-b border-slate-200 dark:border-slate-700/50 ${isCompact ? 'h-12' : 'h-16'}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: BYD_RED }}>
                <span className="text-white font-bold text-sm">B</span>
            </div>
        </div>

        {/* Main tabs */}
        <div className="flex-1 py-2 overflow-y-auto">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onTabChange(t.id)}
                    className={`w-full flex flex-col items-center justify-center py-3 transition-all ${isCompact ? 'min-h-[56px]' : 'min-h-[64px]'}`}
                    style={{
                        backgroundColor: activeTab === t.id ? BYD_RED + '15' : 'transparent',
                        borderLeft: activeTab === t.id ? `3px solid ${BYD_RED}` : '3px solid transparent'
                    }}
                >
                    <t.icon
                        className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'}`}
                        style={{ color: activeTab === t.id ? BYD_RED : '' }}
                    />
                    <span
                        className={`mt-1 font-medium ${isCompact ? 'text-[8px]' : 'text-[10px]'} ${activeTab === t.id ? '' : 'text-slate-600 dark:text-slate-400'}`}
                        style={{ color: activeTab === t.id ? BYD_RED : '' }}
                    >
                        {t.label}
                    </span>
                </button>
            ))}
        </div>

        {/* Bottom action buttons */}
        <div className={`border-t border-slate-200 dark:border-slate-700/50 py-2 ${isCompact ? 'space-y-1' : 'space-y-2'}`}>
            <button
                onClick={onFilter}
                className={`w-full flex flex-col items-center justify-center py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ${isCompact ? 'min-h-[40px]' : 'min-h-[48px]'}`}
            >
                <Filter className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
                <span className={`mt-0.5 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>Filtrar</span>
            </button>
            <button
                onClick={onDatabase}
                className={`w-full flex flex-col items-center justify-center py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ${isCompact ? 'min-h-[40px]' : 'min-h-[48px]'}`}
            >
                <Database className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
                <span className={`mt-0.5 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>Base datos</span>
            </button>
            <button
                onClick={onExport}
                className={`w-full flex flex-col items-center justify-center py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ${isCompact ? 'min-h-[40px]' : 'min-h-[48px]'}`}
            >
                <Download className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
                <span className={`mt-0.5 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>Exportar</span>
            </button>
            <button
                onClick={onHelp}
                className={`w-full flex flex-col items-center justify-center py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ${isCompact ? 'min-h-[40px]' : 'min-h-[48px]'}`}
            >
                <HelpCircle className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
                <span className={`mt-0.5 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>Ayuda</span>
            </button>
            <button
                onClick={onSettings}
                className={`w-full flex flex-col items-center justify-center py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ${isCompact ? 'min-h-[40px]' : 'min-h-[48px]'}`}
            >
                <Settings className={isCompact ? 'w-4 h-4' : 'w-5 h-5'} />
                <span className={`mt-0.5 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>Config</span>
            </button>
        </div>
    </div>
));

Sidebar.displayName = 'Sidebar';

export default Sidebar;
