import React from 'react';

/**
 * Fallback component shown while lazy-loaded tabs are loading.
 * Used with React.Suspense for code-split tab components.
 */
const TabFallback = () => (
    <div className="flex items-center justify-center h-48">
        <div className="animate-pulse text-slate-400 dark:text-slate-500">
            Loading...
        </div>
    </div>
);

export default TabFallback;
