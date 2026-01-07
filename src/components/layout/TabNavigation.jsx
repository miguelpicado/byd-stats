// BYD Stats - Tab Navigation Component

import React from 'react';
import { BYD_RED } from '../../utils/constants';

/**
 * Bottom tab navigation bar
 * @param {Object} props - Component props
 * @param {Array} props.tabs - Array of tab objects with id, label, icon
 * @param {string} props.activeTab - Currently active tab id
 * @param {Function} props.onTabChange - Tab change handler
 */
const TabNavigation = React.memo(({ tabs, activeTab, onTabChange }) => (
    <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-slate-100 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
        <div className="max-w-7xl mx-auto px-2 py-2">
            <div className="flex justify-around items-center">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => onTabChange(t.id)}
                        className="flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-0 flex-1"
                        style={{
                            backgroundColor: activeTab === t.id ? BYD_RED + '20' : 'transparent',
                            color: activeTab === t.id ? BYD_RED : ''
                        }}
                    >
                        <t.icon className={`w-6 h-6 mb-1 ${activeTab !== t.id ? 'text-slate-600 dark:text-slate-400' : ''}`} />
                        <span className={`text-[10px] font-medium ${activeTab !== t.id ? 'text-slate-600 dark:text-slate-400' : ''}`}>{t.label}</span>
                    </button>
                ))}
            </div>
        </div>
    </div>
));

TabNavigation.displayName = 'TabNavigation';

export default TabNavigation;
