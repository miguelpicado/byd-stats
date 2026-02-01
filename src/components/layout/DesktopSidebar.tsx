import React, { memo } from 'react';

interface DesktopSidebarProps {
    tabs: any[];
    activeTab: string;
    handleTabClick: (id: string) => void;
}

const DesktopSidebar = memo(({ tabs, activeTab, handleTabClick }: DesktopSidebarProps) => {
    return (
        <div className="w-64 flex-shrink-0 bg-slate-100 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-700/50 overflow-y-auto">
            <div role="tablist" aria-label="Main navigation" className="p-4 space-y-2">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={activeTab === t.id}
                        aria-controls={`tabpanel-${t.id}`}
                        onClick={() => handleTabClick(t.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${activeTab === t.id
                            ? 'byd-active-item shadow-lg shadow-red-900/20'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }`}
                    >
                        <t.icon className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium">{t.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
});

DesktopSidebar.displayName = 'DesktopSidebar';

export default DesktopSidebar;


