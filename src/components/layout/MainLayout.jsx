import React, { memo } from 'react';

const MainLayout = memo(({ children }) => {
    return (
        <div
            className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 text-slate-900 dark:text-slate-900 dark:text-white overflow-hidden transition-colors"
        >
            {children}
        </div>
    );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;


