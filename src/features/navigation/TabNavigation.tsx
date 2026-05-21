import React, { memo } from 'react';

interface TabNavigationProps {
    tabs: any[];
    activeTab: string;
    handleTabClick: (id: string) => void;
}

const TabNavigation = memo(({ tabs, activeTab, handleTabClick }: TabNavigationProps) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-100 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-700/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="max-w-7xl mx-auto px-2 py-2">
                <div role="tablist" aria-label="Main navigation" className="flex justify-around items-center">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={activeTab === t.id}
                            aria-controls={`tabpanel-${t.id}`}
                            onClick={() => handleTabClick(t.id)}
                            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-0 flex-1 ${activeTab === t.id ? 'byd-active-item shadow-lg shadow-red-900/20' : 'text-slate-600 dark:text-slate-400'}`}
                        >
                            <t.icon className={`w-6 h-6 mb-1 ${activeTab !== t.id ? 'text-slate-600 dark:text-slate-400' : 'text-white'}`} />
                            <span className={`text-[10px] font-medium ${activeTab !== t.id ? 'text-slate-600 dark:text-slate-400' : 'text-white'}`}>{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
});

TabNavigation.displayName = 'TabNavigation';

export default TabNavigation;


